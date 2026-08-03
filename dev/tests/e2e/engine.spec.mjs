import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../../../index.html', import.meta.url)));
const fixtureRoot = path.dirname(fileURLToPath(new URL('./fixtures/story-fixture.js', import.meta.url)));
const fixtureRoutes = new Map([
  ['/story.js', path.join(fixtureRoot, 'story-fixture.js')],
  ['/__e2e__/game.html', path.join(fixtureRoot, 'game.html')],
  ['/__e2e__/legacy-game.html', path.join(fixtureRoot, 'legacy-game.html')]
]);
// localhost нужен отдельному WebCrypto-тесту как доверенный origin; e2e.local сохраняет обычный режим.
const allowedEngineOrigins = new Set(['http://e2e.local', 'http://localhost']);
const blockedLocalRoutes = new Set(['/story360.js', '/license-key.js']);
const tinyPanoramaDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+N4fVAAAAAElFTkSuQmCC';

// Создаёт короткую историю для проверки projectId, миграции и независимости localStorage-слотов.
function createAutosaveProjectStorySource(projectId, label) {
  const lines = [
    'window.STORY_TEXT = `',
    '',
    '[meta]',
    `title = ${JSON.stringify(`Автосохранение ${label}`)}`,
    'lang = ru',
    'startScene = intro',
    'mode = release',
    'autosave = true',
    'transition = none',
    'transitionMs = 0',
    'engine.gameSandbox = strict',
    '',
    '[scene]',
    'scene intro',
    JSON.stringify(`Начало ${label}`),
    JSON.stringify(`Прогресс ${label}`),
    '`;',
    ''
  ];
  if (projectId) lines.splice(4, 0, `projectId = ${projectId}`);
  return lines.join('\n');
}

// Создаёт минимальную историю с 360-фоном, чтобы проверять порядок CSS → JS в настоящем runtime движка.
function createBg360RuntimeStorySource(assetPath, quality = 'normal') {
  return [
    'window.STORY_TEXT = `',
    '',
    '[meta]',
    'title = CSS 360 E2E',
    'lang = ru',
    'startScene = intro',
    'mode = release',
    'autosave = false',
    'transition = none',
    'transitionMs = 0',
    `bg360Quality = ${quality}`,
    'engine.gameSandbox = strict',
    '',
    '[bg]',
    `runtimePano file=${assetPath} 360 quality=${quality}`,
    '',
    '[scene]',
    'scene intro',
    'bg runtimePano scroll',
    '"Панорама CSS E2E"',
    '`;',
    ''
  ].join('\n');
}

// Создаёт минимальный story360.js с одним путём, чтобы проверять загрузку редактора без пользовательских файлов.
function createScene360StorySource(assetPath) {
  return `window.STORY360 = ${JSON.stringify({
    version: 1,
    spaces: {
      testSpace: {
        panoramas: {
          start: {
            file: assetPath,
            marks: []
          }
        }
      }
    }
  }, null, 2)};\n`;
}

// Собирает синтетический пакет конвертера с заметным побочным эффектом для проверки отсутствия скрытого выполнения.
function createScene360PackSource(datasetKey) {
  return [
    '(function() {',
    "  'use strict';",
    `  document.body.dataset[${JSON.stringify(datasetKey)}] = '1';`,
    '  window.VN360_PACKS_VARIANTS = window.VN360_PACKS_VARIANTS || {};',
    '  window.VN360_PACKS_META_VARIANTS = window.VN360_PACKS_META_VARIANTS || {};',
    '  var dataUrl = [',
    `    '${tinyPanoramaDataUrl}'`,
    "  ].join('');",
    '  var packMeta = {"schema":"vn360-pack-meta-v1","mode":"normal","type":"image/png","width":1,"height":1};',
    '  var packKey = document.currentScript && document.currentScript.src ? document.currentScript.src : "";',
    '  window.VN360_PACKS_VARIANTS[packKey] = { normal: dataUrl };',
    '  window.VN360_PACKS_META_VARIANTS[packKey] = { normal: packMeta };',
    '})();',
    ''
  ].join('\n');
}

// Собирает декларативный CSS-пакет с агрессивным стилем и необязательным @import для проверки CSP-изоляции.
function createScene360CssPackSource(mode = 'normal', importPath = '') {
  const payload = tinyPanoramaDataUrl.split(',')[1];
  const imageBytes = Buffer.from(payload, 'base64').length;
  const chunks = [];
  for (let offset = 0; offset < tinyPanoramaDataUrl.length; offset += 32) {
    chunks.push(tinyPanoramaDataUrl.slice(offset, offset + 32));
  }
  return [
    ...(importPath ? [`@import url(${JSON.stringify(importPath)});`] : []),
    'html, body { display: none !important; --scene360-css-injection: "1"; }',
    '#vn360-pack {',
    '  --vn360-schema: "vn360-css-pack-v1";',
    `  --vn360-mode: "${mode}";`,
    '  --vn360-mime: "image/png";',
    '  --vn360-width: "1";',
    '  --vn360-height: "1";',
    `  --vn360-size: "${imageBytes}";`,
    '  --vn360-quality: "1";',
    `  --vn360-chunk-count: "${chunks.length}";`,
    ...chunks.map(function(chunk, index) {
      return `  --vn360-data-${index}: "${chunk}";`;
    }),
    '}',
    ''
  ].join('\n');
}

// Добавляет доступ к внутренней проверке лицензии только в E2E-копию engine.js, не меняя публичный runtime.
function exposeLicenseVerifierToE2e(engineSource) {
  const eol = engineSource.includes('\r\n') ? '\r\n' : '\n';
  const closingMarker = eol + '})();';
  const closingIndex = engineSource.lastIndexOf(closingMarker);
  if (closingIndex < 0) {
    throw new Error('Не найден конец IIFE в engine.js.');
  }

  const hookSource = [
    '// Открывает лицензионную функцию только в изменённой копии, которую получает E2E-браузер.',
    'window.__VN_E2E_VERIFY_LICENSE = function(dataToVerify, signatureBytes, publicKeyPem) {',
    '  VN_LICENSE_PUBLIC_KEY_PEM = publicKeyPem;',
    '  return verifyLicenseSignature(dataToVerify, signatureBytes);',
    '};'
  ].join(eol);

  return engineSource.slice(0, closingIndex) + eol + hookSource + engineSource.slice(closingIndex);
}

// Возвращает MIME-тип для настоящих файлов движка и синтетических fixtures.
function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp'
  };
  return types[extension] || 'application/octet-stream';
}

// Проверяет, что запрошенный путь остаётся внутри репозитория и не читает соседние файлы.
function isInsideRepository(filePath) {
  const relativePath = path.relative(repositoryRoot, filePath);
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

// Отдаёт Chromium runtime-файлы, имитирует разные проекты и при запросе добавляет только тестовый hook.
async function handleEngineRoute(route, routeOptions = {}) {
  let requestUrl;
  let pathname;
  try {
    requestUrl = new URL(route.request().url());
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch (error) {
    await route.fulfill({ status: 400, contentType: 'text/plain; charset=utf-8', body: 'Bad Request' });
    return;
  }

  if (!allowedEngineOrigins.has(requestUrl.origin)) {
    await route.abort('blockedbyclient');
    return;
  }

  const virtualBasePath = String(routeOptions.virtualBasePath || '').replace(/\/$/, '');
  if (virtualBasePath && (pathname === virtualBasePath || pathname.startsWith(`${virtualBasePath}/`))) {
    pathname = pathname.slice(virtualBasePath.length) || '/';
  }

  if (blockedLocalRoutes.has(pathname)) {
    await route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'Not Found' });
    return;
  }

  if (pathname === '/story.js' && typeof routeOptions.storySource === 'string') {
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript; charset=utf-8',
      headers: { 'Cache-Control': 'no-store' },
      body: routeOptions.storySource
    });
    return;
  }

  const fixturePath = fixtureRoutes.get(pathname);
  const normalizedPath = pathname === '/' ? '/index.html' : pathname;
  const repositoryPath = path.resolve(repositoryRoot, `.${normalizedPath}`);
  const filePath = fixturePath || repositoryPath;
  if (!fixturePath && !isInsideRepository(filePath)) {
    await route.fulfill({ status: 403, contentType: 'text/plain; charset=utf-8', body: 'Forbidden' });
    return;
  }

  try {
    let body = await readFile(filePath);
    if (routeOptions.exposeLicenseVerifier && normalizedPath === '/engine/engine.js') {
      body = Buffer.from(exposeLicenseVerifierToE2e(body.toString('utf8')), 'utf8');
    }
    await route.fulfill({
      status: 200,
      contentType: getContentType(filePath),
      headers: { 'Cache-Control': 'no-store' },
      body
    });
  } catch (error) {
    const status = error && error.code === 'ENOENT' ? 404 : 500;
    await route.fulfill({
      status,
      contentType: 'text/plain; charset=utf-8',
      body: status === 404 ? 'Not Found' : 'Route Error'
    });
  }
}

// Устанавливает один актуальный перехват запросов, чтобы последовательные открытия могли менять тестовый проект.
async function installRepositoryRoutes(page, routeOptions = {}) {
  await page.unroute('**/*');
  await page.route('**/*', function serveEngineRoute(route) {
    return handleEngineRoute(route, routeOptions);
  });
}

// Собирает необработанные ошибки страницы, не считая ожидаемые сообщения об отсутствующих optional-файлах.
function collectPageErrors(page) {
  const errors = [];
  // Сохраняет текст ошибки после события pageerror для итоговой проверки сценария.
  function handlePageError(error) {
    errors.push(error && error.message ? error.message : String(error));
  }
  page.on('pageerror', handlePageError);
  return errors;
}

// Устанавливает ранний перехват console до загрузки index.html и сохраняет сериализованные аргументы для проверки утечек.
async function installConsoleCapture(page) {
  await page.addInitScript(function captureConsoleMessages() {
    window.__vnE2eConsoleMessages = [];
    ['log', 'info', 'warn', 'error', 'debug', 'trace'].forEach(function(method) {
      const original = console[method];
      console[method] = function captureConsoleCall(...args) {
        const text = args.map(function(value) {
          if (value === null || value === undefined) return String(value);
          if (typeof value === 'string') return value;
          if (typeof value === 'number' || typeof value === 'boolean') return String(value);
          try {
            return JSON.stringify(value);
          } catch (error) {
            return Object.prototype.toString.call(value);
          }
        }).join(' ');
        window.__vnE2eConsoleMessages.push({ method, text });
        return original.apply(console, args);
      };
    });
  });
}

// Возвращает накопленные браузером сообщения после завершения проверяемых действий.
async function readConsoleMessages(page) {
  return page.evaluate(function readCapturedConsoleMessages() {
    return Array.isArray(window.__vnE2eConsoleMessages)
      ? window.__vnE2eConsoleMessages.slice()
      : [];
  });
}

// Открывает реальный index.html и ждёт заданную реплику стандартной либо подменённой синтетической истории.
async function openStory(page, storyUrl = '/', routeOptions = {}) {
  await installRepositoryRoutes(page, routeOptions);
  await page.goto(storyUrl);
  await expect(page.locator('#textBox')).toHaveText(routeOptions.expectedText || 'Первый экран E2E');
}

// Учитывает защиту движка от двойного клика и переводит историю к следующему действию.
async function advanceDialog(page) {
  await page.waitForTimeout(350);
  await page.locator('#dialog').click();
}

// Открывает меню из первой сцены и выбирает пункт по видимой подписи.
async function chooseRoute(page, routeLabel) {
  await advanceDialog(page);
  const choices = page.locator('#choices');
  await expect(choices).toBeVisible();
  await choices.getByRole('button', { name: routeLabel }).click();
}

// Открывает настоящий тестер и загружает в него синтетическую игру через выбранный режим изоляции.
async function openGameTester(page, gamePath, sandboxMode = 'strict') {
  await installRepositoryRoutes(page);
  await page.goto('/tools/game-tester.html');
  await page.locator('#sandboxMode').selectOption(sandboxMode);
  await page.locator('#gameUrl').fill(gamePath);
  await page.locator('#gameId').fill('testGame');
  await page.locator('#workspaceTabInput').click();
  await page.locator('#loadGameBtn').click();

  const game = page.frameLocator('#gameFrame');
  await expect(game.locator('#status')).toHaveText('gameInit получен');
  return game;
}

// Открывает настоящий Scene360 Editor с тем же сетевым перехватом, что и остальные браузерные проверки.
async function openScene360Editor(page) {
  await installRepositoryRoutes(page);
  await page.goto('/tools/scene360-editor.html');
  await expect(page.locator('#packFileInput')).toBeVisible();
}

// Проверяет загрузку настоящего интерфейса и применение title из синтетического сценария.
test('движок запускает историю в браузере без демо-ассетов', async function({ page }) {
  const pageErrors = collectPageErrors(page);

  await openStory(page);

  await expect(page).toHaveTitle('E2E-проверка движка');
  await expect(page.locator('#dialog')).toBeVisible();
  await expect(page.locator('#gameModal')).toHaveClass(/hidden/);
  expect(pageErrors).toEqual([]);
});

// Даже при сохранённом JS-пути выбирает mobile CSS первым и не позволяет стилям пакета воздействовать на страницу новеллы.
test('движок загружает mobile CSS-пакет 360 раньше JS', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  const sourcePath = 'assets/360/runtime-priority-360.js';
  const cssPath = 'assets/360/runtime-priority-360-mobile.css';
  const jsPath = 'assets/360/runtime-priority-360-mobile.js';
  let cssRequestCount = 0;
  let jsRequestCount = 0;
  await installRepositoryRoutes(page, {
    storySource: createBg360RuntimeStorySource(sourcePath, 'mobile')
  });
  await page.route(`http://e2e.local/${cssPath}`, async function serveRuntimeCssPanorama(route) {
    cssRequestCount++;
    await route.fulfill({
      status: 200,
      contentType: 'text/css; charset=utf-8',
      body: createScene360CssPackSource('mobile')
    });
  });
  await page.route(`http://e2e.local/${jsPath}`, async function rejectUnexpectedRuntimeJs(route) {
    jsRequestCount++;
    await route.fulfill({ status: 500, contentType: 'text/plain', body: 'JS must not be requested' });
  });
  await page.goto('/');

  await expect(page.locator('#textBox')).toHaveText('Панорама CSS E2E');
  await expect(page.locator('#bg360Layer')).not.toHaveClass(/hidden/);
  await expect(page.locator('iframe[data-bg360-css-pack-loader]')).toHaveCount(0);
  expect(cssRequestCount).toBeGreaterThanOrEqual(1);
  expect(jsRequestCount).toBe(0);
  expect(await page.locator('body').evaluate(function(body) {
    return {
      display: getComputedStyle(body).display,
      injectedValue: getComputedStyle(body).getPropertyValue('--scene360-css-injection').trim()
    };
  })).toEqual({ display: 'block', injectedValue: '' });
  expect(pageErrors).toEqual([]);
});

// Пакет с @import должен быть отклонён целиком без запроса импорта, после чего движок безопасно использует JS-фолбэк.
test('движок блокирует CSS @import панорамы и использует JS-пакет', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  const sourcePath = 'assets/360/runtime-import-360.css';
  const cssPath = 'assets/360/runtime-import-360.css';
  const jsPath = 'assets/360/runtime-import-360.js';
  const blockedImportPath = '/__e2e__/runtime-imported-style.css';
  let cssRequestCount = 0;
  let jsRequestCount = 0;
  let importRequestCount = 0;
  await installRepositoryRoutes(page, {
    storySource: createBg360RuntimeStorySource(sourcePath, 'normal')
  });
  await page.route(`http://e2e.local/${cssPath}`, async function serveRuntimeCssWithImport(route) {
    cssRequestCount++;
    await route.fulfill({
      status: 200,
      contentType: 'text/css; charset=utf-8',
      body: createScene360CssPackSource('normal', blockedImportPath)
    });
  });
  await page.route(`http://e2e.local${blockedImportPath}`, async function rejectRuntimeCssImport(route) {
    importRequestCount++;
    await route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '#vn360-pack { --vn360-import-ran: "1"; }' });
  });
  await page.route(`http://e2e.local/${jsPath}`, async function serveRuntimeImportFallback(route) {
    jsRequestCount++;
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript; charset=utf-8',
      body: createScene360PackSource('runtimeImportFallbackExecuted')
    });
  });
  await page.goto('/');

  await expect(page.locator('body')).toHaveAttribute('data-runtime-import-fallback-executed', '1');
  await expect(page.locator('#bg360Layer')).not.toHaveClass(/hidden/);
  expect(cssRequestCount).toBeGreaterThanOrEqual(1);
  expect(jsRequestCount).toBeGreaterThanOrEqual(1);
  expect(importRequestCount).toBe(0);
  expect(pageErrors).toEqual([]);
});

// Имитирует отсутствие CSS и подтверждает последовательный переход к прежнему исполняемому JS-пакету.
test('движок использует JS-пакет 360 после ошибки CSS', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  const sourcePath = 'assets/360/runtime-fallback-360.css';
  const cssPath = 'assets/360/runtime-fallback-360.css';
  const jsPath = 'assets/360/runtime-fallback-360.js';
  let cssRequestCount = 0;
  let jsRequestCount = 0;
  await installRepositoryRoutes(page, {
    storySource: createBg360RuntimeStorySource(sourcePath, 'normal')
  });
  await page.route(`http://e2e.local/${cssPath}`, async function rejectMissingRuntimeCss(route) {
    cssRequestCount++;
    await route.fulfill({ status: 404, contentType: 'text/css; charset=utf-8', body: '' });
  });
  await page.route(`http://e2e.local/${jsPath}`, async function serveRuntimeLegacyJs(route) {
    jsRequestCount++;
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript; charset=utf-8',
      body: createScene360PackSource('runtimeLegacyFallbackExecuted')
    });
  });
  await page.goto('/');

  await expect(page.locator('#textBox')).toHaveText('Панорама CSS E2E');
  await expect(page.locator('body')).toHaveAttribute('data-runtime-legacy-fallback-executed', '1');
  await expect(page.locator('#bg360Layer')).not.toHaveClass(/hidden/);
  expect(cssRequestCount).toBeGreaterThanOrEqual(1);
  expect(jsRequestCount).toBeGreaterThanOrEqual(1);
  expect(pageErrors).toEqual([]);
});

// Проверяет нативный RSA-PSS путь в настоящем Chromium и запрещает незаметный переход на jsrsasign.
test('браузер проверяет подпись лицензии через WebCrypto', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  await openStory(page, 'http://localhost/', { exposeLicenseVerifier: true });

  // Генерирует только временную браузерную пару и вызывает настоящий проверяющий код движка.
  const isValid = await page.evaluate(async function verifyBrowserLicenseSignature() {
    const keyPair = await crypto.subtle.generateKey({
      name: 'RSA-PSS',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    }, true, ['sign', 'verify']);
    const publicKeyBytes = new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey));
    let publicKeyBinary = '';
    for (let index = 0; index < publicKeyBytes.length; index++) {
      publicKeyBinary += String.fromCharCode(publicKeyBytes[index]);
    }
    const publicKeyBase64 = btoa(publicKeyBinary).match(/.{1,64}/g).join('\n');
    window.VN_LICENSE_PUBLIC_KEY_PEM = [
      '-----BEGIN PUBLIC KEY-----',
      publicKeyBase64,
      '-----END PUBLIC KEY-----'
    ].join('\n');

    const dataToVerify = 'VNV1.synthetic-browser-payload';
    const signedData = new TextEncoder().encode(dataToVerify);
    const signatureBytes = new Uint8Array(await crypto.subtle.sign(
      { name: 'RSA-PSS', saltLength: 32 },
      keyPair.privateKey,
      signedData
    ));

    // Делает резервный путь заведомо нерабочим: true возможен только после успешного WebCrypto.
    window.KJUR.crypto.Signature = function rejectUnexpectedFallback() {
      throw new Error('jsrsasign fallback must not run in Chromium.');
    };
    return window.__VN_E2E_VERIFY_LICENSE(dataToVerify, signatureBytes, window.VN_LICENSE_PUBLIC_KEY_PEM);
  });

  expect(isValid).toBe(true);
  expect(pageErrors).toEqual([]);
});

// Проверяет, что публичный режим не пишет информационные runtime-сообщения при загрузке и переходе Next.
test('release-режим оставляет консоль без обычной диагностики', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  await installConsoleCapture(page);

  await openStory(page, '/?mode=release');
  await advanceDialog(page);
  await page.waitForTimeout(450);

  const messages = await readConsoleMessages(page);
  const informational = messages.filter(function(message) {
    return ['log', 'info', 'debug', 'trace'].includes(message.method);
  });
  expect(informational).toEqual([]);
  expect(pageErrors).toEqual([]);
});

// Подтверждает документированное имя Debug и независимое включение только выбранной категории.
test('параметр Debug включает выбранную категорию в release', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  await installConsoleCapture(page);

  await openStory(page, '/?mode=release&Debug=autosave');
  await page.waitForTimeout(450);

  const messages = await readConsoleMessages(page);
  expect(messages.some(function(message) {
    return message.text.includes('[AUTOSAVE_DEBUG]');
  })).toBe(true);
  expect(messages.some(function(message) {
    return message.text.includes('[VN DEBUG]');
  })).toBe(false);
  expect(pageErrors).toEqual([]);
});

// Проверяет регистронезависимое чтение ключа Debug без изменения документированной записи с заглавной буквы.
test('ключ Debug читается без учёта регистра', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  await installConsoleCapture(page);

  await openStory(page, '/?mode=release&dEbUg=runtime');

  const messages = await readConsoleMessages(page);
  expect(messages.some(function(message) {
    return message.text.includes('[VN DEBUG]');
  })).toBe(true);
  expect(pageErrors).toEqual([]);
});

// Подтверждает реальное подключение единственного URL-parser и отсутствие верхнего лимита отступов.
test('URL принимает большие отступы без учёта регистра', async function({ page }) {
  const pageErrors = collectPageErrors(page);

  await openStory(page, '/?TOPSPACING=5000&bottomSpacing=8000');

  const spacing = await page.evaluate(function readAppliedSpacing() {
    return {
      top: document.documentElement.style.getPropertyValue('--topSpacing'),
      bottom: document.documentElement.style.getPropertyValue('--bottomSpacing'),
      manualMode: document.getElementById('novelWindow').classList.contains('window-manual')
    };
  });
  expect(spacing).toEqual({ top: '5000px', bottom: '8000px', manualMode: true });
  expect(pageErrors).toEqual([]);
});

// Проверяет DOM-кнопки menu, изменение переменной и переход между сценами.
test('выбор в меню переводит историю в нужную ветку', async function({ page }) {
  const pageErrors = collectPageErrors(page);

  await openStory(page);
  await chooseRoute(page, 'Правая ветка');

  await expect(page.locator('#textBox')).toHaveText('Выбрана правая ветка');
  await advanceDialog(page);
  await expect(page.locator('#textBox')).toHaveText('Финал: right, результат: 0');
  expect(pageErrors).toEqual([]);
});

// Проверяет запись localStorage и восстановление текущей реплики после перезагрузки страницы.
test('автосохранение восстанавливает прогресс после reload', async function({ page }) {
  const pageErrors = collectPageErrors(page);

  await openStory(page);
  await chooseRoute(page, 'Правая ветка');
  await expect(page.locator('#textBox')).toHaveText('Выбрана правая ветка');

  // Ждёт отложенную запись изолированного autosave-слота синтетического проекта.
  await page.waitForFunction(function hasAutosave() {
    return window.localStorage.getItem('vn_engine_autosave_v1:project:e2e-story') !== null;
  });
  await page.reload();

  await expect(page.locator('#textBox')).toHaveText('Выбрана правая ветка');
  expect(pageErrors).toEqual([]);
});

// Подтверждает, что две папки одного origin используют разные projectId-слоты и перезапуск не трогает соседний проект.
test('projectId разделяет автосохранения новелл одного домена', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  const projectASource = createAutosaveProjectStorySource('project-a', 'проекта A');
  const projectBSource = createAutosaveProjectStorySource('project-b', 'проекта B');
  const projectAKey = 'vn_engine_autosave_v1:project:project-a';
  const projectBKey = 'vn_engine_autosave_v1:project:project-b';

  await openStory(page, '/project-a/', {
    virtualBasePath: '/project-a',
    storySource: projectASource,
    expectedText: 'Начало проекта A'
  });
  await advanceDialog(page);
  await expect(page.locator('#textBox')).toHaveText('Прогресс проекта A');
  await page.waitForFunction(function hasProjectASave(key) {
    return window.localStorage.getItem(key) !== null;
  }, projectAKey);
  const projectARaw = await page.evaluate(function readProjectASave(key) {
    return window.localStorage.getItem(key);
  }, projectAKey);

  await openStory(page, '/project-b/', {
    virtualBasePath: '/project-b',
    storySource: projectBSource,
    expectedText: 'Начало проекта B'
  });
  await advanceDialog(page);
  await expect(page.locator('#textBox')).toHaveText('Прогресс проекта B');
  await page.waitForFunction(function hasProjectBSave(key) {
    return window.localStorage.getItem(key) !== null;
  }, projectBKey);
  const projectBRaw = await page.evaluate(function readProjectBSave(key) {
    return window.localStorage.getItem(key);
  }, projectBKey);

  await openStory(page, '/project-a/', {
    virtualBasePath: '/project-a',
    storySource: projectASource,
    expectedText: 'Прогресс проекта A'
  });
  expect(await page.evaluate(function readOtherProjectSave(key) {
    return window.localStorage.getItem(key);
  }, projectBKey)).toBe(projectBRaw);

  await page.locator('#btnRestart').click();
  await expect(page.locator('#textBox')).toHaveText('Начало проекта A');
  const slotsAfterRestart = await page.evaluate(function readProjectSlots(keys) {
    return {
      projectA: window.localStorage.getItem(keys.projectA),
      projectB: window.localStorage.getItem(keys.projectB)
    };
  }, { projectA: projectAKey, projectB: projectBKey });
  expect(slotsAfterRestart.projectA).not.toBe(projectARaw);
  expect(slotsAfterRestart.projectB).toBe(projectBRaw);
  expect(pageErrors).toEqual([]);
});

// Проверяет, что URL-режим novel создаёт вложенный слот проекта и не заменяет его обычное прохождение.
test('projectId разделяет обычный и novel-слоты', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  const storySource = createAutosaveProjectStorySource('project-slots', 'проекта со слотами');
  const standardKey = 'vn_engine_autosave_v1:project:project-slots';
  const novelKey = 'vn_engine_autosave_v1:project:project-slots:novel:intro';
  const routeOptions = {
    virtualBasePath: '/project-slots',
    storySource
  };

  await openStory(page, '/project-slots/', {
    ...routeOptions,
    expectedText: 'Начало проекта со слотами'
  });
  await advanceDialog(page);
  await page.waitForFunction(function hasStandardSave(key) {
    return window.localStorage.getItem(key) !== null;
  }, standardKey);
  const standardRaw = await page.evaluate(function readStandardSave(key) {
    return window.localStorage.getItem(key);
  }, standardKey);

  await openStory(page, '/project-slots/?novel=intro', {
    ...routeOptions,
    expectedText: 'Начало проекта со слотами'
  });
  await advanceDialog(page);
  await page.waitForFunction(function hasNovelSave(key) {
    return window.localStorage.getItem(key) !== null;
  }, novelKey);
  expect(await page.evaluate(function readStandardSaveAgain(key) {
    return window.localStorage.getItem(key);
  }, standardKey)).toBe(standardRaw);

  await page.locator('#btnRestart').click();
  await expect(page.locator('#textBox')).toHaveText('Начало проекта со слотами');
  expect(await page.evaluate(function readStandardAfterNovelRestart(key) {
    return window.localStorage.getItem(key);
  }, standardKey)).toBe(standardRaw);

  await openStory(page, '/project-slots/', {
    ...routeOptions,
    expectedText: 'Прогресс проекта со слотами'
  });
  expect(pageErrors).toEqual([]);
});

// Создаёт старое сохранение и проверяет его одноразовое копирование после добавления projectId без иных правок сценария.
test('projectId мигрирует подходящее legacy-сохранение', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  const legacySource = createAutosaveProjectStorySource('', 'мигрируемого проекта');
  const projectSource = createAutosaveProjectStorySource('migrated-project', 'мигрируемого проекта');
  const legacyKey = 'vn_engine_autosave_v1';
  const projectKey = 'vn_engine_autosave_v1:project:migrated-project';

  await openStory(page, '/migration-legacy/', {
    virtualBasePath: '/migration-legacy',
    storySource: legacySource,
    expectedText: 'Начало мигрируемого проекта'
  });
  await advanceDialog(page);
  await page.waitForFunction(function hasLegacySave(key) {
    return window.localStorage.getItem(key) !== null;
  }, legacyKey);

  await openStory(page, '/migration-legacy/', {
    virtualBasePath: '/migration-legacy',
    storySource: legacySource,
    expectedText: 'Прогресс мигрируемого проекта'
  });
  const legacyRaw = await page.evaluate(function readLegacyBeforeMigration(key) {
    return window.localStorage.getItem(key);
  }, legacyKey);

  await openStory(page, '/migration-project/', {
    virtualBasePath: '/migration-project',
    storySource: projectSource,
    expectedText: 'Прогресс мигрируемого проекта'
  });
  const migratedSlots = await page.evaluate(function readMigratedSlots(keys) {
    return {
      legacy: window.localStorage.getItem(keys.legacy),
      project: window.localStorage.getItem(keys.project)
    };
  }, { legacy: legacyKey, project: projectKey });
  expect(migratedSlots.legacy).toBe(legacyRaw);
  expect(migratedSlots.project).not.toBeNull();
  expect(JSON.parse(migratedSlots.project).projectId).toBe('migrated-project');
  expect(pageErrors).toEqual([]);
});

// Чужой валидный legacy-слот должен пережить запуск нового projectId и не превращаться в его сохранение.
test('projectId не удаляет чужое legacy-сохранение', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  const foreignSource = createAutosaveProjectStorySource('', 'чужого legacy-проекта');
  const currentSource = createAutosaveProjectStorySource('current-project', 'текущего проекта');
  const legacyKey = 'vn_engine_autosave_v1';
  const projectKey = 'vn_engine_autosave_v1:project:current-project';

  await openStory(page, '/foreign-legacy/', {
    virtualBasePath: '/foreign-legacy',
    storySource: foreignSource,
    expectedText: 'Начало чужого legacy-проекта'
  });
  await advanceDialog(page);
  await page.waitForFunction(function hasForeignLegacySave(key) {
    return window.localStorage.getItem(key) !== null;
  }, legacyKey);
  const foreignRaw = await page.evaluate(function readForeignLegacySave(key) {
    return window.localStorage.getItem(key);
  }, legacyKey);

  await openStory(page, '/current-project/', {
    virtualBasePath: '/current-project',
    storySource: currentSource,
    expectedText: 'Начало текущего проекта'
  });
  const storage = await page.evaluate(function readUnmigratedSlots(keys) {
    return {
      legacy: window.localStorage.getItem(keys.legacy),
      project: window.localStorage.getItem(keys.project)
    };
  }, { legacy: legacyKey, project: projectKey });
  expect(storage.legacy).toBe(foreignRaw);
  expect(storage.project).toBeNull();
  expect(pageErrors).toEqual([]);
});

// Повреждённый legacy JSON остаётся на месте: миграция не должна очищать данные, принадлежность которых не доказана.
test('projectId сохраняет повреждённый legacy-слот без миграции', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  const storySource = createAutosaveProjectStorySource('corrupt-check', 'проверки повреждения');
  await page.addInitScript(function seedCorruptLegacyAutosave() {
    window.localStorage.setItem('vn_engine_autosave_v1', '{broken-json');
  });

  await openStory(page, '/corrupt-check/', {
    virtualBasePath: '/corrupt-check',
    storySource,
    expectedText: 'Начало проверки повреждения'
  });
  const storage = await page.evaluate(function readCorruptLegacyAutosave() {
    return {
      legacy: window.localStorage.getItem('vn_engine_autosave_v1'),
      project: window.localStorage.getItem('vn_engine_autosave_v1:project:corrupt-check')
    };
  });
  expect(storage.legacy).toBe('{broken-json');
  expect(storage.project).toBeNull();
  expect(pageErrors).toEqual([]);
});

// Проверяет gameInit v2, блокировку поддельных и повторных результатов и продолжение сценария после игры.
test('мини-игра обменивается сообщениями с движком', async function({ page }) {
  const pageErrors = collectPageErrors(page);

  await openStory(page);
  await chooseRoute(page, 'Левая ветка');
  await expect(page.locator('#textBox')).toHaveText('Выбрана левая ветка');
  await advanceDialog(page);

  await expect(page.locator('#gameModal')).toBeVisible();
  await expect(page.locator('#gameFrame')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.locator('#gameFrame')).toHaveAttribute('allow', 'autoplay');
  await expect(page.locator('#gameFrame')).toHaveAttribute('referrerpolicy', 'no-referrer');
  const game = page.frameLocator('#gameFrame');
  await expect(game.locator('#status')).toHaveText('gameInit получен');
  await expect(game.locator('#gameId')).toHaveText('testGame');
  await expect(game.locator('#protocolVersion')).toHaveText('2');
  await expect(game.locator('#sessionId')).toHaveText(/^game-[a-z0-9]+/);
  await expect(game.locator('#difficulty')).toHaveText('2');
  await expect(game.locator('#token')).toHaveText('private-token-do-not-log');
  await expect(game.locator('#parentDom')).toHaveText('заблокирован');
  await expect(game.locator('#parentStorage')).toHaveText('заблокировано');
  await expect(game.locator('#topNavigation')).toHaveText('заблокирована');
  await expect(game.locator('#popup')).toHaveText('заблокирован');
  await expect(page).toHaveURL('http://e2e.local/');

  const sessionId = await game.locator('#sessionId').textContent();
  // Отправляет сообщение с правильными id из родительского окна: движок обязан проверить event.source.
  await page.evaluate(function sendForgedResult(activeSessionId) {
    window.postMessage({
      type: 'gameResult',
      gameId: 'testGame',
      sessionId: activeSessionId,
      result: 99
    }, '*');
  }, sessionId);
  await expect(page.locator('#gameModal')).toBeVisible();

  await game.getByRole('button', { name: 'Отправить результат без сессии' }).click();
  await expect(page.locator('#gameModal')).toBeVisible();
  await game.getByRole('button', { name: 'Отправить неверную сессию' }).click();
  await expect(page.locator('#gameModal')).toBeVisible();
  await game.getByRole('button', { name: 'Завершить игру' }).click();

  await expect(page.locator('#gameModal')).toHaveClass(/hidden/);
  await expect(page.locator('#textBox')).toHaveText('Игра завершена: 7');
  await advanceDialog(page);
  await expect(page.locator('#textBox')).toHaveText('Финал: left, результат: 7');
  expect(pageErrors).toEqual([]);
});

// Даже полная явно включённая диагностика не должна раскрывать текст истории, параметры игры и sessionId.
test('Debug=all не выводит чувствительные данные новеллы и мини-игры', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  await installConsoleCapture(page);

  await openStory(page, '/?mode=release&Debug=all');
  await chooseRoute(page, 'Левая ветка');
  await advanceDialog(page);

  const game = page.frameLocator('#gameFrame');
  await expect(game.locator('#status')).toHaveText('gameInit получен');
  const sessionId = await game.locator('#sessionId').textContent();
  expect(sessionId).toBeTruthy();

  const messages = await readConsoleMessages(page);
  const consoleText = messages.map(function(message) { return message.text; }).join('\n');
  expect(consoleText).not.toContain('private-token-do-not-log');
  expect(consoleText).not.toContain(sessionId);
  expect(consoleText).not.toContain('Первый экран E2E');
  expect(pageErrors).toEqual([]);
});

// Подтверждает, что старая мини-игра без gameId и sessionId продолжает работать после замены файлов движка.
test('legacy-мини-игра возвращает результат в старом формате', async function({ page }) {
  const pageErrors = collectPageErrors(page);

  await openStory(page);
  await chooseRoute(page, 'Старая мини-игра');
  await expect(page.locator('#textBox')).toHaveText('Выбрана legacy-ветка');
  await advanceDialog(page);

  await expect(page.locator('#gameModal')).toBeVisible();
  expect(await page.locator('#gameFrame').getAttribute('sandbox')).toBeNull();
  expect(await page.locator('#gameFrame').getAttribute('referrerpolicy')).toBeNull();
  const game = page.frameLocator('#gameFrame');
  await expect(game.locator('#status')).toHaveText('gameInit получен');
  await game.getByRole('button', { name: 'Завершить старую игру' }).click();

  await expect(page.locator('#gameModal')).toHaveClass(/hidden/);
  await expect(page.locator('#textBox')).toHaveText('Legacy-игра завершена: 5');
  await advanceDialog(page);
  await expect(page.locator('#textBox')).toHaveText('Финал: legacy, результат: 5');
  expect(pageErrors).toEqual([]);
});

// Имитирует AST старой новеллы без новой meta-настройки и проверяет прежние права и формат результата.
test('новелла без gameSandbox сохраняет legacy-поведение', async function({ page }) {
  const pageErrors = collectPageErrors(page);

  await openStory(page);
  await page.evaluate(function useLegacyDefaultFromOldStory() {
    window.STORY.meta.engine.gameSandbox = 'legacy';
    delete window.STORY.assets.games.legacyGame.sandbox;
  });
  await chooseRoute(page, 'Старая мини-игра');
  await expect(page.locator('#textBox')).toHaveText('Выбрана legacy-ветка');
  await advanceDialog(page);

  await expect(page.locator('#gameModal')).toBeVisible();
  expect(await page.locator('#gameFrame').getAttribute('sandbox')).toBeNull();
  const game = page.frameLocator('#gameFrame');
  await expect(game.locator('#status')).toHaveText('gameInit получен');
  await game.getByRole('button', { name: 'Завершить старую игру' }).click();

  await expect(page.locator('#gameModal')).toHaveClass(/hidden/);
  await expect(page.locator('#textBox')).toHaveText('Legacy-игра завершена: 5');
  expect(pageErrors).toEqual([]);
});

// Проверяет отдельную сессию iframe статистики, отклонение результата сюжетного iframe и ручное закрытие.
test('игра из статистики изолирована от сюжетного iframe', async function({ page }) {
  const pageErrors = collectPageErrors(page);

  await openStory(page);
  await page.locator('#btnStats').click();
  await expect(page.locator('#statsPanel')).toBeVisible();
  await page.locator('#btnShowGames').click();

  const gameCard = page.locator('#gamesGrid .gameCatalogCard').filter({
    hasText: 'Синтетическая мини-игра'
  });
  await gameCard.getByRole('button', { name: '3', exact: true }).click();
  await expect(page.locator('#statsGameModal')).toBeVisible();
  await expect(page.locator('#statsGameFrame')).toHaveAttribute('sandbox', 'allow-scripts');

  const statsGame = page.frameLocator('#statsGameFrame');
  await expect(statsGame.locator('#status')).toHaveText('gameInit получен');
  await expect(statsGame.locator('#protocolVersion')).toHaveText('2');

  // Загружает служебный fixture в неактивный сюжетный iframe и имитирует legacy-результат от неверного окна.
  await page.locator('#gameFrame').evaluate(function loadInactiveStoryFrame(frame) {
    frame.src = '/__e2e__/legacy-game.html';
  });
  const inactiveStoryGame = page.frameLocator('#gameFrame');
  await expect(inactiveStoryGame.locator('#status')).toHaveText('Ожидание gameInit');
  await inactiveStoryGame.locator('body').evaluate(function sendResultFromWrongFrame() {
    window.parent.postMessage({ type: 'gameResult', result: 99 }, '*');
  });
  await expect(page.locator('#statsGameModal')).toBeVisible();

  await statsGame.getByRole('button', { name: 'Завершить игру' }).click();
  await expect(page.locator('#statsGameModal')).toHaveClass(/hidden/);
  await expect(page.locator('#gamesStatus')).toHaveText(
    'Последний запуск: Синтетическая мини-игра, сложность 3, результат 7'
  );
  await expect(page.locator('#textBox')).toHaveText('Первый экран E2E');

  await gameCard.getByRole('button', { name: '1', exact: true }).click();
  await expect(page.locator('#statsGameModal')).toBeVisible();
  await expect(statsGame.locator('#status')).toHaveText('gameInit получен');
  await page.locator('#btnCloseStatsGame').click();
  await expect(page.locator('#statsGameModal')).toHaveClass(/hidden/);
  await expect(page.locator('#gamesStatus')).toHaveText(
    'Последний запуск: Синтетическая мини-игра, сложность 1, игра закрыта вручную'
  );
  expect(pageErrors).toEqual([]);
});

// Проверяет sandbox тестера, безопасный лог и одноразовую привязку результата к gameInit v2.
test('тестер мини-игр безопасно проверяет strict-протокол', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  const game = await openGameTester(page, '/__e2e__/game.html');

  await expect(page.locator('#sandboxMode')).toHaveValue('strict');
  await expect(page.locator('#gameFrame')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.locator('#gameFrame')).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(game.locator('#gameId')).toHaveText('testGame');
  await expect(game.locator('#protocolVersion')).toHaveText('2');
  await expect(game.locator('#sessionId')).toHaveText(/^game-[a-z0-9]+/);
  await expect(game.locator('#parentDom')).toHaveText('заблокирован');
  await expect(game.locator('#parentStorage')).toHaveText('заблокировано');

  await game.getByRole('button', { name: 'Отправить опасный тип' }).click();
  await expect(page.locator('#messageLog')).toContainText('<img id="tester-xss"');
  await expect(page.locator('#messageLog #tester-xss')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveAttribute('data-xss', '1');

  await game.getByRole('button', { name: 'Отправить результат без сессии' }).click();
  await expect(page.locator('#status')).toContainText('strict-режим требует gameId и sessionId');
  await game.getByRole('button', { name: 'Отправить неверную сессию' }).click();
  await expect(page.locator('#status')).toContainText('sessionId не совпадает');

  // Сообщение из родительского окна не должно попасть в журнал игрового iframe.
  const resultLogCount = await page.locator('#messageLog [data-message-type="gameResult"]').count();
  await page.evaluate(function sendForgedTesterResult() {
    window.postMessage({
      type: 'gameResult',
      gameId: 'testGame',
      sessionId: 'forged-session',
      result: 123
    }, '*');
  });
  await expect(page.locator('#messageLog [data-message-type="gameResult"]')).toHaveCount(resultLogCount);

  await game.getByRole('button', { name: 'Завершить игру' }).click();
  await expect(page.locator('#messageLog')).toContainText('[принят]');
  await expect(page.locator('#messageLog')).toContainText('результат этой сессии уже принят');
  await expect(page.locator('#status')).toContainText('результат этой сессии уже принят');
  expect(pageErrors).toEqual([]);
});

// Проверяет, что загрузка локального HTML через srcdoc сохраняет диагностику внутри strict sandbox.
test('тестер сохраняет диагностику локального HTML в strict-режиме', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  await installRepositoryRoutes(page);
  await page.goto('/tools/game-tester.html');
  await page.locator('#gameId').fill('testGame');
  await page.locator('#gameFile').setInputFiles(path.join(fixtureRoot, 'game.html'));

  await expect(page.locator('#gameFrame')).toHaveAttribute('sandbox', 'allow-scripts');
  const game = page.frameLocator('#gameFrame');
  await expect(game.locator('#status')).toHaveText('gameInit получен');
  await expect(game.locator('#protocolVersion')).toHaveText('2');
  await expect(game.locator('#sessionId')).toHaveText(/^game-[a-z0-9]+/);
  await expect(page.locator('#diagRisk')).toContainText('Встроенная диагностика активна');
  expect(pageErrors).toEqual([]);
});

// Сохраняет прежние настройки v4, но безопасно выбирает strict при отсутствии нового поля режима.
test('старые настройки тестера получают strict-режим по умолчанию', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  await installRepositoryRoutes(page);
  await page.goto('/tools/game-tester.html');
  await page.evaluate(function saveOldTesterSettings() {
    localStorage.setItem('vn-game-tester-settings-v4', JSON.stringify({
      gameUrl: '/__e2e__/legacy-game.html',
      gameId: 'oldGame',
      difficulty: '2'
    }));
  });
  await page.reload();

  await expect(page.locator('#sandboxMode')).toHaveValue('strict');
  await expect(page.locator('#gameFrame')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.locator('#legacyModeHelp')).toBeHidden();
  expect(pageErrors).toEqual([]);
});

// Подтверждает явный legacy-режим, предупреждение о доверии и приём результата старой игры.
test('тестер сохраняет явную поддержку доверенных legacy-игр', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  const game = await openGameTester(page, '/__e2e__/legacy-game.html', 'legacy');

  expect(await page.locator('#gameFrame').getAttribute('sandbox')).toBeNull();
  expect(await page.locator('#gameFrame').getAttribute('referrerpolicy')).toBeNull();
  await page.locator('#workspaceTabSetup').click();
  await expect(page.locator('#legacyModeHelp')).toBeVisible();
  await expect(page.locator('#legacyModeHelp')).toContainText('нейросети');
  await expect(page.locator('#legacyModeHelp')).toContainText('gameId');
  await expect(page.locator('#legacyModeHelp')).toContainText('sessionId');
  await expect(page.locator('#legacyModeHelp a')).toHaveAttribute('href', '../docs/specs/spec-game.md');

  await game.getByRole('button', { name: 'Завершить старую игру' }).click();
  await expect(page.locator('#status')).toHaveText('Получен gameResult: 5');
  await expect(page.locator('#messageLog')).toContainText('[принят]');
  expect(pageErrors).toEqual([]);
});

// Импортирует недоверенный story360 и подтверждает, что ссылка на JS-пакет остаётся данными, а не запускаемым кодом.
test('Scene360 Editor не выполняет пакет из импортированного story360', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  let packRequestCount = 0;
  page.on('request', function countUnexpectedPackRequest(request) {
    if (new URL(request.url()).pathname === '/assets/360/untrusted-360.js') packRequestCount += 1;
  });

  await openScene360Editor(page);
  await page.locator('#story360Input').setInputFiles({
    name: 'story360.js',
    mimeType: 'text/javascript',
    buffer: Buffer.from(createScene360StorySource('assets/360/untrusted-360.js'))
  });

  await expect(page.locator('#assetPathInput')).toHaveValue('assets/360/untrusted-360.js');
  await expect(page.locator('#statusBox')).toContainText('код не выполнен');
  expect(packRequestCount).toBe(0);
  await expect(page.locator('body')).not.toHaveAttribute('data-scene-untrusted-pack-executed', '1');
  expect(pageErrors).toEqual([]);
});

// Проверяет, что выбранный растр становится основным file текущей панорамы, а не остаётся только временным превью.
test('Scene360 Editor заменяет JS-путь выбранным 360-изображением', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  await openScene360Editor(page);
  await page.locator('#story360Input').setInputFiles({
    name: 'story360.js',
    mimeType: 'text/javascript',
    buffer: Buffer.from(createScene360StorySource('assets/360/korpusnight/176-360.js'))
  });

  await expect(page.locator('#assetPathInput')).toHaveValue('assets/360/korpusnight/176-360.js');
  await page.locator('#bgImageInput').setInputFiles({
    name: '176.png',
    mimeType: 'image/png',
    buffer: Buffer.from(tinyPanoramaDataUrl.split(',')[1], 'base64')
  });

  await expect(page.locator('#assetPathInput')).toHaveValue('assets/360/korpusnight/176.png');
  await expect(page.locator('#statusBox')).toContainText('Путь story360: assets/360/korpusnight/176.png');
  await expect(page.locator('script[data-scene360-legacy-pack]')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

// Загружает растровый file прямо из story360 и доказывает, что для него не запускается legacy-ветка JS-пакетов.
test('Scene360 Editor загружает 360-изображение по пути из story360', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  const imagePath = 'assets/360/direct-panorama.png';
  await openScene360Editor(page);
  await page.route(`http://e2e.local/${imagePath}`, async function serveDirectPanorama(route) {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(tinyPanoramaDataUrl.split(',')[1], 'base64')
    });
  });
  await page.locator('#story360Input').setInputFiles({
    name: 'story360.js',
    mimeType: 'text/javascript',
    buffer: Buffer.from(createScene360StorySource(imagePath))
  });

  await expect(page.locator('#assetPathInput')).toHaveValue(imagePath);
  await expect(page.locator('#statusBox')).toContainText(`Панорама загружена: ${imagePath}`);
  await expect(page.locator('script[data-scene360-legacy-pack]')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

// Передаёт результат настоящего конвертера в редактор, чтобы формат CSS не расходился между двумя инструментами.
test('Конвертер создаёт совместимый CSS-пакет 360', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  await installRepositoryRoutes(page);
  await page.goto('/tools/convert-360-img-to-css.html');
  await page.locator('#fileInput').setInputFiles({
    name: 'converter-source.png',
    mimeType: 'image/png',
    buffer: Buffer.from(tinyPanoramaDataUrl.split(',')[1], 'base64')
  });
  await expect(page.locator('#status')).toContainText('Можно генерировать JS и CSS');
  await page.locator('#btnGenerate').click();
  await expect(page.locator('#status')).toContainText('для сохранения выбран CSS');
  await expect(page.locator('#btnDownload')).toBeEnabled();
  await expect(page.locator('#btnDownload')).toHaveText('Скачать оба CSS');
  await page.locator('#resultGrid').getByRole('button', { name: 'Показать CSS' }).first().click();
  const cssSource = await page.locator('#output').inputValue();
  expect(cssSource).toContain('--vn360-schema: "vn360-css-pack-v1"');
  expect(cssSource).toContain('--vn360-data-0: "data:image/');
  expect(cssSource).not.toContain('window.VN360_PACKS');

  const cssPath = 'assets/360/converter-source-360.css';
  await openScene360Editor(page);
  await page.route(`http://e2e.local/${cssPath}`, async function serveConvertedCssPanorama(route) {
    await route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: cssSource });
  });
  await page.locator('#story360Input').setInputFiles({
    name: 'story360.js',
    mimeType: 'text/javascript',
    buffer: Buffer.from(createScene360StorySource(cssPath))
  });

  await expect(page.locator('#statusBox')).toContainText(`Панорама загружена: ${cssPath}`);
  await expect(page.locator('iframe[data-scene360-css-pack-loader]')).toHaveCount(0);
  await expect(page.locator('script[data-scene360-legacy-pack]')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

// Проверяет общий список разрешений и единый выбор CSS/JS, чтобы одиночный и пакетный экспорт не расходились.
test('Конвертер сохраняет только выбранный формат пакета', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  await installRepositoryRoutes(page);
  await page.goto('/tools/convert-360-img-to-css.html');
  const expectedHeightOptions = ['source', '3840', '2880', '1920', '1440', '1080'];
  for (const selector of ['#normalHeight', '#mobileHeight', '#batchNormalHeight', '#batchMobileHeight']) {
    await expect(page.locator(`${selector} option`)).toHaveCount(expectedHeightOptions.length);
    expect(await page.locator(selector).locator('option').evaluateAll(function(options) {
      return options.map(function(option) { return option.value; });
    })).toEqual(expectedHeightOptions);
  }
  await page.locator('#fileInput').setInputFiles({
    name: 'format-source.png',
    mimeType: 'image/png',
    buffer: Buffer.from(tinyPanoramaDataUrl.split(',')[1], 'base64')
  });
  await page.locator('#btnGenerate').click();
  await expect(page.locator('#btnDownload')).toBeEnabled();

  await page.locator('#packOutputFormat').selectOption('js');
  await expect(page.locator('#btnDownload')).toHaveText('Скачать оба JS');
  await expect(page.locator('#resultGrid').getByRole('button', { name: 'Скачать CSS', exact: true })).toHaveCount(0);
  const jsDownloadPromise = page.waitForEvent('download');
  await page.locator('#resultGrid').getByRole('button', { name: 'Скачать JS', exact: true }).first().click();
  const jsDownload = await jsDownloadPromise;
  expect(jsDownload.suggestedFilename()).toBe('format-source-360.js');

  await page.locator('#packOutputFormat').selectOption('css');
  await expect(page.locator('#btnDownload')).toHaveText('Скачать оба CSS');
  await expect(page.locator('#btnBatchStart')).toHaveText('Пакетно преобразовать и скачать CSS');
  await expect(page.locator('#resultGrid').getByRole('button', { name: 'Скачать JS', exact: true })).toHaveCount(0);
  const cssDownloadPromise = page.waitForEvent('download');
  await page.locator('#resultGrid').getByRole('button', { name: 'Скачать CSS', exact: true }).first().click();
  const cssDownload = await cssDownloadPromise;
  expect(cssDownload.suggestedFilename()).toBe('format-source-360.css');

  await page.locator('#tabBatch').click();
  await page.locator('#batchMobileChk').uncheck();
  await page.locator('#batchFileInput').setInputFiles({
    name: 'batch-source.png',
    mimeType: 'image/png',
    buffer: Buffer.from(tinyPanoramaDataUrl.split(',')[1], 'base64')
  });
  const batchDownloadPromise = page.waitForEvent('download');
  await page.locator('#btnBatchStart').click();
  const batchDownload = await batchDownloadPromise;
  expect(batchDownload.suggestedFilename()).toBe('batch-source-360.css');
  await expect(page.locator('#batchStatus')).toContainText('скачано CSS: 1');
  expect(pageErrors).toEqual([]);
});

// Загружает CSS только во временный iframe, проверяет отсутствие влияния его правил на редактор и повторную загрузку из Local после F5.
test('Scene360 Editor изолированно загружает CSS-пакет после F5', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  const cssPath = 'assets/360/safe-test-360.css';
  let cssRequestCount = 0;
  await openScene360Editor(page);
  await page.route(`http://e2e.local/${cssPath}`, async function serveCssPanorama(route) {
    cssRequestCount++;
    await route.fulfill({
      status: 200,
      contentType: 'text/css; charset=utf-8',
      body: createScene360CssPackSource()
    });
  });
  await page.locator('#story360Input').setInputFiles({
    name: 'story360.js',
    mimeType: 'text/javascript',
    buffer: Buffer.from(createScene360StorySource(cssPath))
  });

  await expect(page.locator('#assetPathInput')).toHaveValue(cssPath);
  await expect(page.locator('#statusBox')).toContainText(`Панорама загружена: ${cssPath}`);
  await expect(page.locator('#statusBox')).toContainText('формат PNG');
  await expect(page.locator('iframe[data-scene360-css-pack-loader]')).toHaveCount(0);
  await expect(page.locator('script[data-scene360-legacy-pack]')).toHaveCount(0);
  expect(await page.locator('body').evaluate(function(body) {
    return {
      display: getComputedStyle(body).display,
      injectedValue: getComputedStyle(body).getPropertyValue('--scene360-css-injection').trim()
    };
  })).toEqual({ display: 'block', injectedValue: '' });

  await page.reload();
  await expect(page.locator('#assetPathInput')).toHaveValue(cssPath);
  await expect(page.locator('#statusBox')).toContainText(`Панорама загружена: ${cssPath}`);
  await expect(page.locator('iframe[data-scene360-css-pack-loader]')).toHaveCount(0);
  expect(cssRequestCount).toBeGreaterThanOrEqual(2);
  expect(pageErrors).toEqual([]);
});

// Редактор отклоняет CSS с @import и не обращается к импортируемому ресурсу, даже если сам пакет содержит корректную панораму.
test('Scene360 Editor блокирует CSS @import панорамы', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  const cssPath = 'assets/360/editor-import-360.css';
  const blockedImportPath = '/__e2e__/scene360-editor-import.css';
  let importRequestCount = 0;
  await openScene360Editor(page);
  await page.route(`http://e2e.local/${cssPath}`, async function serveEditorCssWithImport(route) {
    await route.fulfill({
      status: 200,
      contentType: 'text/css; charset=utf-8',
      body: createScene360CssPackSource('normal', blockedImportPath)
    });
  });
  await page.route(`http://e2e.local${blockedImportPath}`, async function rejectEditorCssImport(route) {
    importRequestCount++;
    await route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '#vn360-pack { --vn360-import-ran: "1"; }' });
  });
  await page.locator('#story360Input').setInputFiles({
    name: 'story360.js',
    mimeType: 'text/javascript',
    buffer: Buffer.from(createScene360StorySource(cssPath))
  });

  await expect(page.locator('#statusBox')).toContainText(`Не удалось загрузить CSS-пакет: ${cssPath}`);
  await expect(page.locator('iframe[data-scene360-css-pack-loader]')).toHaveCount(0);
  expect(importRequestCount).toBe(0);
  expect(pageErrors).toEqual([]);
});

// Во время новой загрузки сохраняет прежнее превью, а после ошибки MIME заменяет его чёрным фоном.
test('Scene360 Editor отклоняет подменённые данные CSS-пакета', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  const validCssPath = 'assets/360/valid-before-error-360.css';
  const cssPath = 'assets/360/invalid-test-360.css';
  const invalidCssSource = createScene360CssPackSource().replace('data:image/png;base64,', 'data:text/html;base64,');
  let releaseInvalidCssResponse;
  const invalidCssResponseGate = new Promise(function(resolve) {
    releaseInvalidCssResponse = resolve;
  });
  await openScene360Editor(page);
  await page.route(`http://e2e.local/${validCssPath}`, async function serveValidCssPanorama(route) {
    await route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: createScene360CssPackSource() });
  });
  await page.route(`http://e2e.local/${cssPath}`, async function serveInvalidCssPanorama(route) {
    await invalidCssResponseGate;
    await route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: invalidCssSource });
  });
  await page.locator('#story360Input').setInputFiles({
    name: 'story360.js',
    mimeType: 'text/javascript',
    buffer: Buffer.from(createScene360StorySource(validCssPath))
  });

  await expect(page.locator('#statusBox')).toContainText(`Панорама загружена: ${validCssPath}`);
  expect(await page.evaluate(function hasLoadedPanoramaTexture() {
    return Boolean(window.sphereMesh && window.sphereMesh.material && window.sphereMesh.material.map);
  })).toBe(true);
  await page.locator('#assetPathInput').fill(cssPath);
  await page.locator('#loadAssetPathBtn').click();
  await expect(page.locator('#statusBox')).toContainText(`Загрузка безопасного CSS-пакета: ${cssPath}`);
  expect(await page.evaluate(function keepsPreviousTextureWhileLoading() {
    return Boolean(window.sphereMesh && window.sphereMesh.material && window.sphereMesh.material.map);
  })).toBe(true);
  releaseInvalidCssResponse();
  await expect(page.locator('#statusBox')).toContainText('Первая часть CSS-пакета не содержит ожидаемый data:image base64');
  await expect(page.locator('iframe[data-scene360-css-pack-loader]')).toHaveCount(0);
  await expect(page.locator('script[data-scene360-legacy-pack]')).toHaveCount(0);
  expect(await page.evaluate(function readPanoramaFallbackMaterial() {
    var material = window.sphereMesh && window.sphereMesh.material;
    return {
      hasMap: Boolean(material && material.map),
      color: material && material.color ? material.color.getHex() : null,
      wireframe: Boolean(material && material.wireframe)
    };
  })).toEqual({ hasMap: false, color: 0x000000, wireframe: false });
  expect(pageErrors).toEqual([]);
});

// После успешного превью загружает панораму без file и проверяет тот же чёрный фон без остатка прежней текстуры.
test('Scene360 Editor показывает чёрный фон при отсутствии изображения', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  const validCssPath = 'assets/360/valid-before-empty-360.css';
  await openScene360Editor(page);
  await page.route(`http://e2e.local/${validCssPath}`, async function serveValidCssPanorama(route) {
    await route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: createScene360CssPackSource() });
  });
  await page.locator('#story360Input').setInputFiles({
    name: 'story360-with-image.js',
    mimeType: 'text/javascript',
    buffer: Buffer.from(createScene360StorySource(validCssPath))
  });
  await expect(page.locator('#statusBox')).toContainText(`Панорама загружена: ${validCssPath}`);

  await page.locator('#story360Input').setInputFiles({
    name: 'story360-without-image.js',
    mimeType: 'text/javascript',
    buffer: Buffer.from(createScene360StorySource(''))
  });
  await expect(page.locator('#statusBox')).toContainText('Панорама загружена без file/src/path');
  expect(await page.evaluate(function readEmptyPanoramaMaterial() {
    var material = window.sphereMesh && window.sphereMesh.material;
    return {
      hasMap: Boolean(material && material.map),
      color: material && material.color ? material.color.getHex() : null
    };
  })).toEqual({ hasMap: false, color: 0x000000 });
  expect(pageErrors).toEqual([]);
});

// Проверяет одинаковый запрет внешних схем и выхода из проекта даже после явного включения legacy-режима.
test('Scene360 Editor отклоняет опасные пути пакетов', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  await openScene360Editor(page);
  await page.locator('#legacyPackModeInput').check();
  await expect(page.locator('#legacyPackWarning')).toBeVisible();

  await page.locator('#assetPathInput').fill('https://example.invalid/evil-360.js');
  await page.locator('#loadAssetPathBtn').click();
  await expect(page.locator('#statusBox')).toContainText('только относительные пути внутри проекта');

  await page.locator('#assetPathInput').fill('../assets/360/evil-360.js');
  await page.locator('#loadAssetPathBtn').click();
  await expect(page.locator('#statusBox')).toContainText('через `..` запрещён');
  expect(pageErrors).toEqual([]);
});

// Передаёт пакет с побочным эффектом через FileReader и проверяет загрузку картинки без исполнения остального JavaScript.
test('Scene360 Editor безопасно читает выбранный JS-пакет как данные', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  await openScene360Editor(page);
  await page.locator('#packFileInput').setInputFiles({
    name: 'safe-preview-360.js',
    mimeType: 'text/javascript',
    buffer: Buffer.from(createScene360PackSource('sceneSafePackExecuted'))
  });

  await expect(page.locator('#statusBox')).toContainText('безопасно прочитан без выполнения кода');
  await expect(page.locator('#statusBox')).toContainText('формат PNG');
  await expect(page.locator('body')).not.toHaveAttribute('data-scene-safe-pack-executed', '1');
  await expect(page.locator('script[data-scene360-legacy-pack]')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

// Сначала отменяет, затем подтверждает тот же доверенный путь и доказывает, что legacy-код не запускается без согласия.
test('Scene360 Editor выполняет legacy-пакет только после подтверждения', async function({ page }) {
  const pageErrors = collectPageErrors(page);
  const trustedPackSource = createScene360PackSource('sceneLegacyPackExecuted');
  await openScene360Editor(page);
  await page.route('http://e2e.local/assets/360/trusted-test-360.js', async function serveTrustedPack(route) {
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript; charset=utf-8',
      body: trustedPackSource
    });
  });
  await page.locator('#assetPathInput').fill('assets/360/trusted-test-360.js');
  await page.locator('#legacyPackModeInput').check();

  page.once('dialog', async function dismissLegacyConfirmation(dialog) {
    expect(dialog.message()).toContain('Пакет получит доступ к странице редактора');
    await dialog.dismiss();
  });
  await page.locator('#loadAssetPathBtn').click();
  await expect(page.locator('#statusBox')).toContainText('отменено пользователем');
  await expect(page.locator('body')).not.toHaveAttribute('data-scene-legacy-pack-executed', '1');

  page.once('dialog', async function acceptLegacyConfirmation(dialog) {
    expect(dialog.message()).toContain('trusted-test-360.js');
    await dialog.accept();
  });
  await page.locator('#loadAssetPathBtn').click();
  await expect(page.locator('body')).toHaveAttribute('data-scene-legacy-pack-executed', '1');
  await expect(page.locator('#statusBox')).toContainText('Панорама загружена');
  await expect(page.locator('script[data-scene360-legacy-pack]')).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});
