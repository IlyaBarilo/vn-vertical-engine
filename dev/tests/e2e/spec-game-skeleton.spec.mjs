import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const specUrl = new URL('../../../docs/specs/spec-game.md', import.meta.url);

// Загружает именно опубликованный каркас в строгий iframe и собирает его ответы.
async function openSkeleton(page) {
  const markdown = await readFile(specUrl, 'utf8');
  const html = [...markdown.matchAll(/\x60{3}html\r?\n([\s\S]*?)\x60{3}/g)]
    .map(match => match[1]).find(source => source.includes('<!doctype html>'));
  expect(html).toBeTruthy();
  await page.setContent('<iframe id="game" sandbox="allow-scripts" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>');
  await page.evaluate(source => {
    window.results = [];
    window.addEventListener('message', event => {
      if (event.data?.type === 'gameResult') window.results.push(event.data);
    });
    document.getElementById('game').srcdoc = source;
  }, html);
  const frame = await (await page.locator('#game').elementHandle()).contentFrame();
  await frame.locator('#startButton').waitFor();
  return frame;
}

// Отправляет init из реального родителя и ждёт принятия новой сессии.
async function sendInit(page, frame, sessionId) {
  await page.evaluate(id => document.getElementById('game').contentWindow.postMessage({
    type: 'gameInit', protocolVersion: 2, gameId: 'example', sessionId: id, difficulty: 3
  }, '*'), sessionId);
  await expect.poll(() => frame.evaluate('activeGameInit && activeGameInit.sessionId')).toBe(sessionId);
}

// Проверяет пропорции макета, видимых кнопок и обратное преобразование координат.
test('каркас масштабирует макет и координаты на малом и большом экране', async ({ page }) => {
  const frame = await openSkeleton(page);
  for (const [width, height] of [[360, 640], [810, 1440], [1620, 2880]]) {
    await page.setViewportSize({ width, height });
    await frame.evaluate('applyScale()');
    const geometry = await frame.evaluate(`(() => {
      const rect = gameRoot.getBoundingClientRect();
      const button = startButton.getBoundingClientRect();
      return { width: rect.width, height: rect.height, buttonHeight: button.height,
        point: toGamePoint(rect.left + rect.width / 2, rect.top + rect.height / 2) };
    })()`);
    expect(geometry.width).toBeCloseTo(width, 1);
    expect(geometry.height).toBeCloseTo(height, 1);
    expect(geometry.buttonHeight).toBeCloseTo(96 * width / 810, 1);
    expect(geometry.point.x).toBeCloseTo(405, 3);
    expect(geometry.point.y).toBeCloseTo(720, 3);
  }
});

// Проверяет повтор init, неизменность результата и полное восстановление новой сессии.
test('каркас отправляет один результат на сессию и принимает следующую', async ({ page }) => {
  const frame = await openSkeleton(page);
  await sendInit(page, frame, 'A');
  await frame.locator('#startButton').click();
  await sendInit(page, frame, 'A');
  expect(await frame.evaluate('gameStarted')).toBe(true);
  await frame.evaluate('showFinish(1)');
  await frame.locator('#finishButton').click();
  await expect.poll(() => page.evaluate(() => window.results.length)).toBe(1);
  await sendInit(page, frame, 'A');
  await frame.evaluate('startGame(); finishGame(0)');
  expect(await frame.evaluate('resultSent && !gameStarted')).toBe(true);
  await sendInit(page, frame, 'B');
  expect(await frame.evaluate('resultSent')).toBe(false);
  await expect(frame.locator('#startButton')).toBeEnabled();
  await frame.locator('#startButton').click();
  await frame.evaluate('showFinish(0)');
  await frame.locator('#finishButton').click();
  await expect.poll(() => page.evaluate(() => window.results.length)).toBe(2);
  expect(await page.evaluate(() => window.results.map(item => [item.sessionId, item.result])))
    .toEqual([['A', 1], ['B', 0]]);
  // Поздний init старой сессии не может открыть её заново.
  await page.evaluate(() => document.getElementById('game').contentWindow.postMessage({
    type: 'gameInit', protocolVersion: 2, gameId: 'example', sessionId: 'A'
  }, '*'));
  await frame.evaluate(() => new Promise(resolve => setTimeout(resolve, 30)));
  expect(await frame.evaluate('activeGameInit.sessionId')).toBe('B');
  await expect(frame.locator('#finishButton')).toBeDisabled();
});
