import assert from 'node:assert/strict';
import {
  constants,
  generateKeyPairSync,
  sign,
  webcrypto
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
  let runtimeCrypto = options.withWebCrypto === false ? undefined : webcrypto;

  if (options.webCryptoImportError) {
    runtimeCrypto = {
      subtle: {
        // Имитирует технический отказ importKey, чтобы проверить переход на резервную библиотеку.
        importKey: function rejectImportKey() {
          return Promise.reject(new Error('Synthetic WebCrypto import failure.'));
        },
        verify: webcrypto.subtle.verify.bind(webcrypto.subtle)
      }
    };
  }

  const sandbox = {
    atob: globalThis.atob,
    btoa: globalThis.btoa,
    Buffer,
    console: {
      warn: function collectWarning() {
        warnings.push(Array.from(arguments).map(String).join(' '));
      }
    },
    crypto: runtimeCrypto,
    Date,
    decodeURIComponent,
    encodeURIComponent,
    escape,
    navigator: { appName: 'Netscape' },
    Promise,
    TextDecoder,
    TextEncoder,
    Uint8Array
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);

  if (options.withJsrsasign !== false) {
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

// Меняет подписанный payload без пересоздания подписи, имитируя подделку содержимого лицензии.
function alterSyntheticLicensePayload(licenseKey) {
  const parts = licenseKey.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  payload.customer = 'Changed after signing';
  parts[1] = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return parts.join('.');
}

// Искажает один байт подписи, не затрагивая подписанный payload.
function corruptSyntheticLicenseSignature(licenseKey) {
  const parts = licenseKey.split('.');
  const signatureBytes = Buffer.from(parts[2], 'base64url');
  signatureBytes[0] ^= 1;
  parts[2] = signatureBytes.toString('base64url');
  return parts.join('.');
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

// Описывает два принудительно изолированных способа проверки для общей таблицы сценариев.
const verifierModes = [
  { name: 'WebCrypto', runtimeOptions: { withJsrsasign: false } },
  { name: 'jsrsasign fallback', runtimeOptions: { withWebCrypto: false } }
];

// Проверяет, что фактический публичный ключ движка читается обоими криптографическими механизмами.
test('публичный ключ движка разбирается WebCrypto и jsrsasign', async function(t) {
  await t.test('WebCrypto', async function() {
    const runtime = await createLicenseRuntime({
      withJsrsasign: false,
      withSyntheticPublicKey: false
    });
    const publicKey = await runtime.crypto.subtle.importKey(
      'spki',
      runtime.pemPublicKeyToBytes(runtime.VN_LICENSE_PUBLIC_KEY_PEM),
      { name: 'RSA-PSS', hash: 'SHA-256' },
      false,
      ['verify']
    );

    assert.equal(publicKey.algorithm.name, 'RSA-PSS');
    assert.equal(publicKey.algorithm.modulusLength, 2048);
  });

  await t.test('jsrsasign', async function() {
    const runtime = await createLicenseRuntime({
      withSyntheticPublicKey: false,
      withWebCrypto: false
    });
    const publicKey = runtime.window.KEYUTIL.getKey(runtime.VN_LICENSE_PUBLIC_KEY_PEM);

    assert.ok(publicKey);
    assert.ok(publicKey.n);
    assert.equal(publicKey.n.bitLength(), 2048);
  });
});

// Прогоняет одинаковые лицензии через WebCrypto и резервный jsrsasign, чтобы результаты не расходились.
test('WebCrypto и jsrsasign одинаково обрабатывают лицензионные сценарии', async function(t) {
  const validKey = createSyntheticLicenseKey(createValidPayload());
  const scenarios = [
    {
      name: 'действительная лицензия',
      licenseKey: validKey,
      expectedStatus: 'valid',
      expectedValid: true,
      expectedPayload: true
    },
    {
      name: 'изменённый после подписи payload',
      licenseKey: alterSyntheticLicensePayload(validKey),
      expectedStatus: 'invalid-signature',
      expectedValid: false,
      expectedPayload: false
    },
    {
      name: 'просроченная лицензия',
      licenseKey: createSyntheticLicenseKey(createValidPayload({ expiresAt: '2000-01-01' })),
      expectedStatus: 'invalid-payload',
      expectedValid: false,
      expectedPayload: true,
      expectedMessage: 'License has expired.'
    },
    {
      name: 'повреждённая подпись',
      licenseKey: corruptSyntheticLicenseSignature(validKey),
      expectedStatus: 'invalid-signature',
      expectedValid: false,
      expectedPayload: false,
      expectedJsrsasignWarning: true
    }
  ];

  for (const verifierMode of verifierModes) {
    await t.test(verifierMode.name, async function(t) {
      for (const scenario of scenarios) {
        await t.test(scenario.name, async function() {
          const runtime = await createLicenseRuntime(verifierMode.runtimeOptions);
          runtime.window.VN_LICENSE_KEY = scenario.licenseKey;

          const state = await runtime.resolveLicenseState();
          assert.equal(state.status, scenario.expectedStatus);
          assert.equal(state.valid, scenario.expectedValid);
          assert.equal(!!state.payload, scenario.expectedPayload);
          assert.equal(state.mode, scenario.expectedValid ? 'registered' : 'unregistered');
          assert.equal(state.message, scenario.expectedMessage || (
            scenario.expectedValid ? 'License is valid.' : 'License signature is invalid.'
          ));
          if (scenario.expectedJsrsasignWarning && verifierMode.name === 'jsrsasign fallback') {
            assert.equal(runtime.__warnings.length, 1);
            assert.match(runtime.__warnings[0], /jsrsasign verification failed/);
          } else {
            assert.deepEqual(runtime.__warnings, []);
          }
        });
      }
    });
  }
});

// Доказывает приоритет WebCrypto: рабочая нативная проверка не должна обращаться к резервной библиотеке.
test('рабочий WebCrypto не запускает jsrsasign', async function() {
  const runtime = await createLicenseRuntime();
  runtime.window.KJUR.crypto.Signature = function rejectUnexpectedFallback() {
    throw new Error('jsrsasign fallback must not run.');
  };
  runtime.window.VN_LICENSE_KEY = createSyntheticLicenseKey(createValidPayload());

  const state = await runtime.resolveLicenseState();
  assert.equal(state.status, 'valid');
  assert.deepEqual(runtime.__warnings, []);
});

// Имитирует технический сбой WebCrypto и подтверждает успешную проверку старым локальным способом.
test('ошибка WebCrypto включает резервный jsrsasign', async function() {
  const runtime = await createLicenseRuntime({ webCryptoImportError: true });
  runtime.window.VN_LICENSE_KEY = createSyntheticLicenseKey(createValidPayload());

  const state = await runtime.resolveLicenseState();
  assert.equal(state.status, 'valid');
  assert.equal(state.valid, true);
  assert.equal(runtime.__warnings.length, 1);
  assert.match(runtime.__warnings[0], /WebCrypto verification unavailable/);
});

// Подтверждает штатный незарегистрированный режим, когда опциональный license-key.js отсутствует.
test('отсутствующий лицензионный ключ не вызывает ошибку runtime', async function() {
  const runtime = await createLicenseRuntime();
  const state = await runtime.resolveLicenseState();

  assert.equal(state.status, 'missing');
  assert.equal(state.valid, false);
  assert.equal(state.mode, 'unregistered');
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

// Проверяет отдельный статус, когда недоступны и WebCrypto, и bundled-jsrsasign.
test('отсутствие обоих проверяющих механизмов возвращает missing-verifier', async function() {
  const runtime = await createLicenseRuntime({
    withJsrsasign: false,
    withWebCrypto: false
  });
  runtime.window.VN_LICENSE_KEY = createSyntheticLicenseKey(createValidPayload());

  const state = await runtime.resolveLicenseState();
  assert.equal(state.status, 'missing-verifier');
  assert.equal(state.valid, false);
  assert.equal(state.payload.licenseId, 'TEST-01-2026-000001');
});
