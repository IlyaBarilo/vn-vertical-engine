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
const blockedLocalRoutes = new Set(['/story360.js', '/license-key.js']);
const tinyPanoramaDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+N4fVAAAAAElFTkSuQmCC';

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

// Отдаёт Chromium настоящие runtime-файлы, блокируя внешнюю сеть, локальный story.js и лицензионный ключ.
async function handleEngineRoute(route) {
  let requestUrl;
  let pathname;
  try {
    requestUrl = new URL(route.request().url());
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch (error) {
    await route.fulfill({ status: 400, contentType: 'text/plain; charset=utf-8', body: 'Bad Request' });
    return;
  }

  if (requestUrl.origin !== 'http://e2e.local') {
    await route.abort('blockedbyclient');
    return;
  }

  if (blockedLocalRoutes.has(pathname)) {
    await route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'Not Found' });
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
    const body = await readFile(filePath);
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

// Устанавливает изолированный перехват всех запросов до первой навигации страницы.
async function installRepositoryRoutes(page) {
  await page.route('**/*', handleEngineRoute);
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

// Открывает реальный index.html с необязательной query-строкой и ждёт первую реплику синтетической истории.
async function openStory(page, storyUrl = '/') {
  await installRepositoryRoutes(page);
  await page.goto(storyUrl);
  await expect(page.locator('#textBox')).toHaveText('Первый экран E2E');
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

  // Ждёт отложенную запись штатного autosave-слота движка.
  await page.waitForFunction(function hasAutosave() {
    return window.localStorage.getItem('vn_engine_autosave_v1') !== null;
  });
  await page.reload();

  await expect(page.locator('#textBox')).toHaveText('Выбрана правая ветка');
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
