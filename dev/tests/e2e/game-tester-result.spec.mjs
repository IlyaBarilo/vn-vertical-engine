import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const testerUrl = new URL('../../../tools/game-tester.html', import.meta.url);
const specUrl = new URL('../../../docs/specs/spec-game.md', import.meta.url);

// Запускает опубликованный каркас в тестере, чтобы отправлять сообщения из настоящего активного iframe.
async function openTesterGame(page) {
  await page.goto(testerUrl.href);
  const markdown = await readFile(specUrl, 'utf8');
  const html = [...markdown.matchAll(/\x60{3}html\r?\n([\s\S]*?)\x60{3}/g)]
    .map(match => match[1]).find(source => source.includes('<!doctype html>'));
  await page.locator('#gameFile').setInputFiles({
    name: 'result-test.html', mimeType: 'text/html', buffer: Buffer.from(html)
  });
  const frame = await (await page.locator('#gameFrame').elementHandle()).contentFrame();
  await expect.poll(() => frame.evaluate('activeGameInit && activeGameInit.sessionId')).toBeTruthy();
  await frame.evaluate('window.testInit = activeGameInit');
  return frame;
}

// Отправляет реальное сообщение текущей сессии; отсутствие поля проверяется отдельно от undefined.
async function sendResult(frame, value, omit = false) {
  await frame.evaluate(({ value, omit }) => {
    const payload = { ...window.testInit, type: 'gameResult' };
    if (!omit) payload.result = value;
    parent.postMessage(payload, '*');
  }, { value, omit });
}

// Неверный тип не должен фиксировать сессию; следующее корректное число всё ещё принимается ровно один раз.
test('тестер отклоняет нечисловой result без потери активной сессии', async ({ page }) => {
  const frame = await openTesterGame(page);
  for (const value of ['1', '', true, false, null, [], [1], {}, undefined]) {
    await sendResult(frame, value);
    await expect(page.locator('#status')).toContainText('поле result должно содержать конечное число');
    expect(await page.evaluate('activeGameSession.resultAccepted')).toBe(false);
    expect(await page.evaluate('lastGameResult')).toBe(null);
    // Убираем статус, чтобы следующий шаг не прошёл по предыдущему ответу.
    await page.locator('#status').evaluate(element => { element.textContent = ''; });
  }
  await sendResult(frame, undefined, true);
  await expect(page.locator('#status')).toContainText('поле result должно содержать конечное число');
  await sendResult(frame, 1);
  await expect(page.locator('#status')).toHaveText('Получен gameResult: 1');
  await sendResult(frame, 0);
  await expect(page.locator('#status')).toContainText('результат этой сессии уже принят');
  expect(await page.evaluate('lastGameResult')).toBe(1);
});

// Конечные ноль, отрицательный и дробный счёт допустимы; NaN и бесконечности недопустимы.
test('тестер различает конечное число и неконечные значения', async ({ page }) => {
  const frame = await openTesterGame(page);
  for (const value of [NaN, Infinity, -Infinity]) {
    await sendResult(frame, value);
    await expect(page.locator('#status')).toContainText('поле result должно содержать конечное число');
    expect(await page.evaluate('activeGameSession.resultAccepted')).toBe(false);
    await page.locator('#status').evaluate(element => { element.textContent = ''; });
  }
  // Ручная отправка init находится на вкладке ввода.
  await page.locator('#workspaceTabInput').click();
  for (const value of [0, -2, 2.5]) {
    await page.locator('#sendInitBtn').click();
    await expect.poll(() => page.evaluate('activeGameSession.resultAccepted')).toBe(false);
    await expect.poll(() => frame.evaluate('activeGameInit.sessionId')).toBe(await page.evaluate('activeGameSession.sessionId'));
    await frame.evaluate('window.testInit = activeGameInit');
    await sendResult(frame, value);
    await expect(page.locator('#status')).toHaveText('Получен gameResult: ' + value);
  }
});
