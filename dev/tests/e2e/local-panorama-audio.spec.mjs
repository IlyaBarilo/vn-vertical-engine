import { expect, test } from '@playwright/test';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const fixtureParent = path.join(repositoryRoot, 'dev/.playwright/local-media');
const panoramaData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
let fixtureRoot;
let server;
let httpOrigin;

// Строгая политика нужна и установленному moz-firefox: настройки автоматизации иначе скрывают отказ текстового file:// пути.
test.use({
  launchOptions: {
    firefoxUserPrefs: {
      'security.fileuri.strict_origin_policy': true,
      ...(process.env.VN_E2E_FIREFOX_SOFTWARE_WEBGL === '1' ? { 'webgl.forbid-software': false } : {})
    }
  }
});

// Записывает синтетические файлы с обязательными для проекта окончаниями CRLF.
async function writeFixture(relativePath, source) {
  await writeFile(path.join(fixtureRoot, relativePath), source.replace(/\r?\n/g, '\r\n'), 'utf8');
}

// Создаёт валидный CSS-пакет для выбранного качества; испорченная схема проверяется отдельным сценарием.
function createPanoramaCss(quality) {
  return [
    '#vn360-pack {',
    '  --vn360-schema: "vn360-css-pack-v1";',
    `  --vn360-mode: "${quality}";`,
    '  --vn360-mime: "image/png";',
    '  --vn360-width: "1";',
    '  --vn360-height: "1";',
    `  --vn360-size: "${Buffer.from(panoramaData.split(',')[1], 'base64').length}";`,
    '  --vn360-quality: "1";',
    '  --vn360-chunk-count: "1";',
    `  --vn360-data-0: "${panoramaData}";`,
    '}',
    ''
  ].join('\n');
}

// Использует настоящий сценарный поток для перехода между двумя CSS-панорамами и перезапуска.
function createStory(quality, first = 'first') {
  const story = [
    '[meta]',
    'title = Local media regression',
    'lang = ru',
    'startScene = intro',
    'mode = release',
    'autosave = false',
    'transition = none',
    'transitionMs = 0',
    `bg360Quality = ${quality}`,
    '[bg]',
    `first file=assets/360/${first}-360.css 360 quality=${quality}`,
    `second file=assets/360/second-360.css 360 quality=${quality}`,
    '[scene]',
    'scene intro',
    'bg first scroll',
    '"Первая панорама"',
    'bg second scroll',
    '"Вторая панорама"'
  ].join('\n');
  return `window.STORY_TEXT = ${JSON.stringify(story)};\n`;
}

// Отдаёт только файлы из изолированной копии проекта с настоящими MIME, включая CSS-документы и Worker.
async function serveFixture(request, response) {
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const filePath = path.resolve(fixtureRoot, `.${pathname === '/' ? '/index.html' : pathname}`);
  const relativePath = path.relative(fixtureRoot, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(filePath);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    response.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' }).end();
  }
}

// Копирует runtime без пользовательских сценариев и ассетов, чтобы file:// проверял реальные файлы без перехвата запросов.
test.beforeAll(async function prepareLocalMediaFixture() {
  await mkdir(fixtureParent, { recursive: true });
  fixtureRoot = await mkdtemp(path.join(fixtureParent, 'project-'));
  await Promise.all(['engine', 'lib', 'index.html'].map(
    // Копирует только обязательные каталоги и точку входа runtime.
    function copyRuntime(relativePath) {
      return cp(path.join(repositoryRoot, relativePath), path.join(fixtureRoot, relativePath), { recursive: true });
    }
  ));
  await mkdir(path.join(fixtureRoot, 'assets/360'), { recursive: true });
  for (const quality of ['normal', 'mobile']) {
    const suffix = quality === 'mobile' ? '-mobile' : '';
    for (const name of ['first', 'second', 'invalid']) {
      const css = createPanoramaCss(quality);
      await writeFixture(`assets/360/${name}-360${suffix}.css`, name === 'invalid' ? css.replace('vn360-css-pack-v1', 'invalid-schema') : css);
    }
  }
  server = createServer(function handleFixtureRequest(request, response) {
    // Ошибка служебного запроса завершает только его ответ.
    serveFixture(request, response).catch(function handleServerFailure() { response.destroy(); });
  });
  // Дожидается выделения свободного порта вместо конфликта с общим E2E-сервером.
  await new Promise(function listenFixture(resolve, reject) {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  httpOrigin = `http://127.0.0.1:${server.address().port}`;
});

// Закрывает сервер и удаляет только созданный этим worker каталог внутри .playwright.
test.afterAll(async function cleanLocalMediaFixture() {
  if (server) {
    // Освобождает порт после закрытия браузерных страниц.
    await new Promise(function closeFixture(resolve) { server.close(resolve); });
  }
  if (fixtureRoot && path.dirname(fixtureRoot) === fixtureParent && path.basename(fixtureRoot).startsWith('project-')) {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

// Возвращает один и тот же проект через реальный file:// либо локальный HTTP.
function fixtureUrl(protocol) {
  return protocol === 'file' ? pathToFileURL(path.join(fixtureRoot, 'index.html')).href : `${httpOrigin}/`;
}

// Дожидается видимой WebGL-панорамы и завершения всех временных загрузчиков.
async function expectPanoramaReady(page, text) {
  await expect(page.locator('#textBox')).toHaveText(text);
  await expect(page.locator('#bg360Layer')).not.toHaveClass(/hidden/);
  await expect(page.locator('canvas#bg360Layer')).toBeVisible();
  await expect(page.locator('iframe[data-bg360-css-pack-loader]')).toHaveCount(0);
}

// Наблюдает загрузчики через DOM: BiDi Firefox не обязан выдавать сетевые события для file://.
async function observePanoramaLoads(page) {
  // Регистрирует только добавление iframe, не меняя origin, содержимое или способ загрузки пакетов.
  await page.addInitScript(function installPanoramaObserver() {
    window.__localMediaCssLoads = [];
    // Сохраняет пути до удаления временных iframe самим контроллером.
    const observer = new MutationObserver(function recordPanoramaFrames(records) {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1 && node.matches('iframe[data-bg360-css-pack-loader]')) {
            window.__localMediaCssLoads.push(node.getAttribute('data-bg360-css-pack-loader'));
          }
        }
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}

for (const protocol of ['file', 'http']) {
  for (const quality of ['normal', 'mobile']) {
    // Проверяет оба качества, смену фона, повторный старт и F5 с фактической загрузкой CSS.
    test(`локальные панорамы: ${protocol}, ${quality}, переход и перезапуск`, async function({ page }) {
      const warnings = [];
      const errors = [];
      // Отказ CSS или WebGL делает видимость старого слоя недостаточным доказательством успеха.
      page.on('console', function capturePanoramaWarnings(message) {
        if (message.type() === 'warning' && message.text().includes('[BG360]')) warnings.push(message.text());
      });
      // Сохраняет необработанные ошибки runtime.
      page.on('pageerror', function capturePageError(error) { errors.push(error.message); });
      await observePanoramaLoads(page);
      await writeFixture('story.js', createStory(quality));
      await page.goto(fixtureUrl(protocol));
      await expectPanoramaReady(page, 'Первая панорама');
      await page.waitForTimeout(350);
      await page.locator('#dialog').click();
      await expectPanoramaReady(page, 'Вторая панорама');
      await page.locator('#btnRestart').click();
      await expectPanoramaReady(page, 'Первая панорама');
      // Сохраняет наблюдения текущего документа перед F5.
      const requests = await page.evaluate(function readPanoramaLoads() { return window.__localMediaCssLoads; });
      await page.reload();
      await expectPanoramaReady(page, 'Первая панорама');
      // Учитывает повторную загрузку в новом документе после F5.
      requests.push(...await page.evaluate(function readReloadedPanoramaLoads() { return window.__localMediaCssLoads; }));
      const suffix = quality === 'mobile' ? '-mobile' : '';
      // Подтверждает фактический переход ко второму пакету, а не видимость предыдущей панорамы.
      expect(requests.some(function requestedSecond(url) { return url.endsWith(`/second-360${suffix}.css`); })).toBe(true);
      // Каждый созданный загрузчик должен использовать только запрошенное качество.
      expect(requests.every(function requestedQuality(url) { return quality === 'mobile' ? url.endsWith('-mobile.css') : !url.endsWith('-mobile.css'); })).toBe(true);
      expect(warnings).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  for (const invalidKind of ['missing', 'invalid']) {
    // Отличает отсутствие файла от неверной схемы и проверяет удаление iframe после обоих отказов.
    test(`причина отказа CSS: ${protocol}, ${invalidKind}`, async function({ page }) {
      // Firefox может не послать событие ошибки file:// iframe; тогда действует штатный таймаут загрузчика 30 с.
      test.setTimeout(45_000);
      const warnings = [];
      // Сохраняет полное предупреждение движка, включая аргумент с причиной.
      page.on('console', function captureLoadWarning(message) {
        if (message.type() === 'warning' && message.text().includes('[BG360] CSS-пакет панорамы недоступен:')) warnings.push(message.text());
      });
      await writeFixture('story.js', createStory('normal', invalidKind));
      await page.goto(fixtureUrl(protocol));
      // Ожидает завершения асинхронного отказа, а не только показа реплики.
      await expect.poll(function readWarnings() { return warnings.join('\n'); }, { timeout: 35_000 }).toMatch(
        invalidKind === 'invalid' ? /Неподдерживаемая версия CSS-пакета 360\./ : /Не удалось загрузить CSS-пакет|Локальный ресурс не является CSS-пакетом|Истекло время загрузки CSS-пакета/
      );
      expect(warnings.join('\n')).toContain(`${invalidKind}-360.css`);
      await expect(page.locator('iframe[data-bg360-css-pack-loader]')).toHaveCount(0);
      await expect(page.locator('#bg360Layer')).toHaveClass(/hidden/);
    });
  }

  // Настоящий Audio обнаруживает пустой src и MediaError, которые не воспроизводит DOM-заглушка.
  test(`остановка пустого Audio без MediaError: ${protocol}`, async function({ page }) {
    await writeFixture('story.js', createStory('normal'));
    await page.goto(fixtureUrl(protocol));
    await expect(page.locator('#textBox')).toHaveText('Первая панорама');
    // Проверяет немедленный сброс и отложенные события error после повторных остановок.
    const result = await page.evaluate(async function stopRealAudioRepeatedly() {
      const bgm = new Audio();
      const errors = [];
      // Сохраняет ошибки до того, как обработчики могли бы сбросить MediaError.
      bgm.addEventListener('error', function captureAudioError() { errors.push(bgm.error && bgm.error.code); });
      const controller = window.VN_AUDIO_CONTROLLER.createAudioController({ bgm, sfx: new Audio() });
      for (let attempt = 0; attempt < 3; attempt++) {
        controller.stopBgmImmediate();
        // Даёт браузеру обработать задачу выбора медиаресурса после изменения источника.
        await new Promise(function waitForMediaEvents(resolve) { setTimeout(resolve, 100); });
      }
      const snapshot = { src: bgm.getAttribute('src'), currentSrc: bgm.currentSrc, currentTime: bgm.currentTime, networkState: bgm.networkState, error: bgm.error && bgm.error.code, errors };
      controller.dispose();
      return snapshot;
    });
    expect(result).toEqual({ src: null, currentSrc: '', currentTime: 0, networkState: 0, error: null, errors: [] });
  });
}
