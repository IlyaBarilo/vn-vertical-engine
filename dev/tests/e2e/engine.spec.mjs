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

// Открывает реальный index.html и ждёт первую реплику синтетической истории.
async function openStory(page) {
  await installRepositoryRoutes(page);
  await page.goto('/');
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

// Проверяет загрузку настоящего интерфейса и применение title из синтетического сценария.
test('движок запускает историю в браузере без демо-ассетов', async function({ page }) {
  const pageErrors = collectPageErrors(page);

  await openStory(page);

  await expect(page).toHaveTitle('E2E-проверка движка');
  await expect(page.locator('#dialog')).toBeVisible();
  await expect(page.locator('#gameModal')).toHaveClass(/hidden/);
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
  await expect(game.locator('#token')).toHaveText('e2e');
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
