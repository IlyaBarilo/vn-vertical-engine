import { expect, test } from '@playwright/test';
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { clickFrameButton } from './helpers/frame-input.mjs';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const fixtureParent = path.join(repositoryRoot, 'dev/.playwright/local-games');
const gameFiles = (await readdir(path.join(repositoryRoot, 'assets/games'))).filter(function isHtml(name) { return name.endsWith('.html'); }).sort();
let fixtureRoot;

// Сохраняет реальную файловую изоляцию, которую Playwright иначе ослабляет у установленного Firefox.
test.use({ launchOptions: { firefoxUserPrefs: { 'security.fileuri.strict_origin_policy': true } } });

// Копирует доверенный runtime и штатные игры; пользовательский сценарий не исполняется в проверке.
test.beforeAll(async function prepareLocalGames() {
  await mkdir(fixtureParent, { recursive: true });
  fixtureRoot = await mkdtemp(path.join(fixtureParent, 'project-'));
  for (const name of ['index.html', 'engine', 'lib', 'assets/games']) {
    await cp(path.join(repositoryRoot, name), path.join(fixtureRoot, name), { recursive: true });
  }
  await cp(new URL('./fixtures/game.html', import.meta.url), path.join(fixtureRoot, 'assets/games/probe.html'));
  const story = [
    '[meta]', 'title=Local games', 'lang=ru', 'startScene=intro', 'autosave=false', 'transition=none',
    '[game]', 'probe file=assets/games/probe.html',
    ...gameFiles.map(function registerGame(name, index) { return `game${index} file=assets/games/${name}`; }),
    '[var]', 'gameResult=0', '[scene]', 'scene intro', '"До игры"',
    'game probe difficulty=2 result=gameResult', '"После игры: {gameResult}"'
  ].join('\n');
  await writeFile(path.join(fixtureRoot, 'story.js'), 'window.STORY_TEXT = ' + JSON.stringify(story) + ';\r\n', 'utf8');
});

// Удаляет только тестовую копию в проверенном каталоге, не затрагивая исходные игры.
test.afterAll(async function cleanLocalGames() {
  if (fixtureRoot && path.dirname(fixtureRoot) === fixtureParent && path.basename(fixtureRoot).startsWith('project-')) {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

// Настоящий file:// проверяет отзыв сессии, продолжение сюжета и штатный перезапуск без локального сервера.
test('file://: защита игры останавливает навигацию и сохраняет повторный запуск', async function({ page }) {
  await page.goto(pathToFileURL(path.join(fixtureRoot, 'index.html')).href);
  await expect(page.locator('#textBox')).toHaveText('До игры');
  await page.waitForTimeout(350);
  await page.locator('#dialog').click();
  const game = page.frameLocator('#gameFrame');
  await expect(game.locator('#status')).toHaveText('gameInit получен');
  // Chromium сам запрещает file reload; about:blank разрешён и проверяет именно реакцию host на новый документ.
  await game.locator('body').evaluate(function navigateGame() { location.href = 'about:blank'; });
  await expect(page.locator('#gameModal')).toHaveClass(/hidden/);
  await expect(page.locator('#textBox')).toHaveText('После игры: 0');
  await page.locator('#btnRestart').click();
  await expect(page.locator('#textBox')).toHaveText('До игры');
  await page.waitForTimeout(350);
  await page.locator('#dialog').click();
  await expect(game.locator('#status')).toHaveText('gameInit получен');
  await clickFrameButton(page, '#gameFrame', '#finishGame');
  await expect(page.locator('#textBox')).toHaveText('После игры: 7');
});

// Перехват не отправляет запрос во внешнюю сеть; проверяется именно запрет выполнения внешнего документа.
test('file://: CSP родителя блокирует внешний документ игрового iframe', async function({ page }) {
  await page.addInitScript(function observeFramePolicy() {
    if (window !== window.top) return;
    window.__frameViolations = [];
    window.__remoteSignals = [];
    // Сохраняет факт срабатывания браузерной политики независимо от формулировки консоли.
    document.addEventListener('securitypolicyviolation', function recordViolation(event) {
      if (event.effectiveDirective === 'frame-src') window.__frameViolations.push(event.blockedURI);
    });
    // Новый документ сообщил бы о выполнении ещё до получения gameInit.
    window.addEventListener('message', function recordRemoteDocument(event) {
      if (event.data && event.data.type === 'remoteDocumentExecuted') window.__remoteSignals.push(event.data.type);
    });
  });
  await page.route('https://vn-game-probe.invalid/**', async function mockRemoteDocument(route) {
    await route.fulfill({ contentType: 'text/html', body: '<script>parent.postMessage({type:"remoteDocumentExecuted"},"*")</script>' });
  });
  await page.goto(pathToFileURL(path.join(fixtureRoot, 'index.html')).href + '?game=probe');
  const game = page.frameLocator('#gameFrame');
  await expect(game.locator('#status')).toHaveText('gameInit получен');
  await game.locator('body').evaluate(function navigateOutsideProject() { location.href = 'https://vn-game-probe.invalid/next.html'; });
  await expect.poll(async function readViolationCount() { return page.evaluate(() => window.__frameViolations.length); }).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__remoteSignals)).toEqual([]);
  expect(page.frames().some(function isRemoteFrame(frame) { return frame.url().startsWith('https://vn-game-probe.invalid/'); })).toBe(false);
});

for (const [index, gameFile] of gameFiles.entries()) {
  // Наблюдает gameInit без изменения кода игры; это проверка запуска и повторного открытия, а не полного прохождения.
  test(`file://: штатная игра ${gameFile} получает init и перезапускается`, async function({ page }) {
    const errors = [];
    page.on('pageerror', function recordError(error) { errors.push(error.message); });
    await page.addInitScript(function observeGameInit() {
      window.__gameInits = [];
      // Сохраняет только служебную сессию, чтобы различить старый и новый запуск.
      window.addEventListener('message', function recordInit(event) {
        if (event.source === window.parent && event.data && event.data.type === 'gameInit') window.__gameInits.push(event.data.sessionId);
      });
    });
    await page.goto(pathToFileURL(path.join(fixtureRoot, 'index.html')).href + `?game=game${index}&diff=2`);
    const game = page.frameLocator('#gameFrame');
    await expect.poll(async function readInitCount() { return game.locator('body').evaluate(() => (window.__gameInits || []).length); }).toBe(1);
    const firstSession = await game.locator('body').evaluate(() => window.__gameInits[0]);
    // Абсолютные игровые слои могут иметь видимый canvas при нулевой высоте body.
    await expect(game.locator('canvas:visible, button:visible').first()).toBeVisible();
    await page.locator('#btnCloseGame').click();
    await expect.poll(async function readNextInit() {
      return game.locator('body').evaluate((previous) => {
        const inits = window.__gameInits || [];
        return inits.length === 1 && inits[0] !== previous;
      }, firstSession);
    }).toBe(true);
    if (gameFile === 'coffee-rush.html') await expect(game.locator('#startBtn')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
