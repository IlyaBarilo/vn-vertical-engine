import assert from 'node:assert/strict';
import {
  constants,
  generateKeyPairSync,
  sign
} from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../../index.html', import.meta.url)));
const enginePath = path.join(repositoryRoot, 'engine', 'engine.js');
const jsrsasignPath = path.join(repositoryRoot, 'lib', 'jsrsasign-all-min.js');
const syntheticKeys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
let runtimeSourcesPromise = null;

// Извлекает настоящий лицензионный блок движка и кэширует тяжёлый исходник jsrsasign между тестами.
async function readLicenseRuntimeSources() {
  if (!runtimeSourcesPromise) {
    runtimeSourcesPromise = Promise.all([
      readFile(enginePath, 'utf8'),
      readFile(jsrsasignPath, 'utf8')
    ]).then(function(sources) {
      const engineSource = sources[0];
      const startMarker = 'var VN_LICENSE_KEY_PREFIX = "VNV1";';
      const endMarker = '// Кладёт статус лицензии в переменные сценария';
      const startIndex = engineSource.indexOf(startMarker);
      const endIndex = engineSource.indexOf(endMarker, startIndex);
      assert.ok(startIndex >= 0, 'В engine.js не найдено начало лицензионного runtime.');
      assert.ok(endIndex > startIndex, 'В engine.js не найден конец лицензионного runtime.');
      return {
        engine: engineSource.slice(startIndex, endIndex),
        jsrsasign: sources[1]
      };
    });
  }
  return runtimeSourcesPromise;
}

// Создаёт изолированный браузероподобный контекст и выполняет настоящий код проверки лицензии.
async function createLicenseRuntime(options = {}) {
  const sources = await readLicenseRuntimeSources();
  const warnings = [];
  const sandbox = {
    atob: globalThis.atob,
    btoa: globalThis.btoa,
    Buffer,
    console: {
      warn: function collectWarning() {
        warnings.push(Array.from(arguments).map(String).join(' '));
      }
    },
    crypto: globalThis.crypto,
    Date,
    decodeURIComponent,
    encodeURIComponent,
    escape,
    navigator: { appName: 'Netscape' },
    Promise,
    TextDecoder,
    Uint8Array
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);

  if (options.withVerifier !== false) {
    new vm.Script(sources.jsrsasign, { filename: jsrsasignPath }).runInContext(context, { timeout: 5000 });
  }
  new vm.Script(sources.engine, { filename: enginePath }).runInContext(context, { timeout: 5000 });
  if (options.withSyntheticPublicKey !== false) {
    context.VN_LICENSE_PUBLIC_KEY_PEM = syntheticKeys.publicKey;
  }
  context.__warnings = warnings;
  return context;
}

// Подписывает синтетический payload временным тестовым ключом, не используя реальные лицензионные данные.
function createSyntheticLicenseKey(payload) {
  const payloadPart = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const dataToSign = 'VNV1.' + payloadPart;
  const signature = sign('sha256', Buffer.from(dataToSign, 'utf8'), {
    key: syntheticKeys.privateKey,
    padding: constants.RSA_PKCS1_PSS_PADDING,
    saltLength: 32
  });
  return dataToSign + '.' + signature.toString('base64url');
}

// Возвращает минимальный корректный payload для проверок подписи и бизнес-полей.
function createValidPayload(overrides = {}) {
  return {
    schema: 1,
    productId: 'vn-vertical-engine',
    licenseId: 'TEST-01-2026-000001',
    customer: 'Synthetic Test',
    installations: 1,
    issuedAt: '2026-01-01',
    expiresAt: '2099-12-31',
    ...overrides
  };
}

// Проверяет, что фактический публичный ключ движка остаётся читаемым bundled-библиотекой.
test('публичный ключ движка разбирается jsrsasign', async function() {
  const runtime = await createLicenseRuntime({ withSyntheticPublicKey: false });
  const publicKey = runtime.window.KEYUTIL.getKey(runtime.VN_LICENSE_PUBLIC_KEY_PEM);

  assert.ok(publicKey);
  assert.ok(publicKey.n);
  assert.equal(publicKey.n.bitLength(), 2048);
});

// Проверяет настоящий RSA-PSS путь bundled-jsrsasign на синтетической паре ключей.
test('действительная синтетическая лицензия проходит jsrsasign-проверку', async function() {
  const runtime = await createLicenseRuntime();
  runtime.window.VN_LICENSE_KEY = createSyntheticLicenseKey(createValidPayload());

  const state = await runtime.resolveLicenseState();
  assert.equal(state.status, 'valid');
  assert.equal(state.valid, true);
  assert.equal(state.mode, 'registered');
  assert.equal(state.payload.licenseId, 'TEST-01-2026-000001');
  assert.deepEqual(runtime.__warnings, []);
});

// Подтверждает штатный незарегистрированный режим, когда опциональный license-key.js отсутствует.
test('отсутствующий лицензионный ключ не вызывает ошибку runtime', async function() {
  const runtime = await createLicenseRuntime();
  const state = await runtime.resolveLicenseState();

  assert.equal(state.status, 'missing');
  assert.equal(state.valid, false);
  assert.equal(state.mode, 'unregistered');
});

// Проверяет, что корректно подписанный, но просроченный payload отклоняется после криптографической проверки.
test('просроченная лицензия отклоняется по бизнес-правилам', async function() {
  const runtime = await createLicenseRuntime();
  runtime.window.VN_LICENSE_KEY = createSyntheticLicenseKey(createValidPayload({ expiresAt: '2000-01-01' }));

  const state = await runtime.resolveLicenseState();
  assert.equal(state.status, 'invalid-payload');
  assert.equal(state.valid, false);
  assert.equal(state.message, 'License has expired.');
  assert.equal(state.payload.licenseId, 'TEST-01-2026-000001');
});

// Искажает один байт подписи и подтверждает, что payload не принимается и не возвращается вызывающему коду.
test('повреждённая подпись лицензии отклоняется', async function() {
  const runtime = await createLicenseRuntime();
  const parts = createSyntheticLicenseKey(createValidPayload()).split('.');
  const signatureBytes = Buffer.from(parts[2], 'base64url');
  signatureBytes[0] ^= 1;
  runtime.window.VN_LICENSE_KEY = parts[0] + '.' + parts[1] + '.' + signatureBytes.toString('base64url');

  const state = await runtime.resolveLicenseState();
  assert.equal(state.status, 'invalid-signature');
  assert.equal(state.valid, false);
  assert.equal(state.payload, null);
});

// Фиксирует обработку испорченного формата и недопустимой календарной даты без исключения наружу.
test('неверный формат и дата лицензии возвращают контролируемые статусы', async function(t) {
  await t.test('формат ключа', async function() {
    const runtime = await createLicenseRuntime();
    runtime.window.VN_LICENSE_KEY = 'not-a-license';
    const state = await runtime.resolveLicenseState();
    assert.equal(state.status, 'invalid-format');
    assert.equal(state.valid, false);
  });

  await t.test('дата окончания', async function() {
    const runtime = await createLicenseRuntime();
    runtime.window.VN_LICENSE_KEY = createSyntheticLicenseKey(createValidPayload({ expiresAt: 'not-a-date' }));
    const state = await runtime.resolveLicenseState();
    assert.equal(state.status, 'invalid-payload');
    assert.equal(state.message, 'License expiration date is invalid.');
  });
});

// Проверяет отдельный статус при отсутствии bundled-проверяющего модуля вместо ложного valid.
test('отсутствующий jsrsasign возвращает missing-verifier', async function() {
  const runtime = await createLicenseRuntime({ withVerifier: false });
  runtime.window.VN_LICENSE_KEY = createSyntheticLicenseKey(createValidPayload());

  const state = await runtime.resolveLicenseState();
  assert.equal(state.status, 'missing-verifier');
  assert.equal(state.valid, false);
  assert.equal(state.payload.licenseId, 'TEST-01-2026-000001');
});
