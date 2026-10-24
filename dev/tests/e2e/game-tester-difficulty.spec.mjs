import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const testerUrl = new URL('../../../tools/game-tester.html', import.meta.url);
const specUrl = new URL('../../../docs/specs/spec-game.md', import.meta.url);

// Загружает опубликованный каркас через настоящий file input тестера и проверяет отправленный init.
test('тестер нормализует сложность и передаёт её игре', async ({ page }) => {
  await page.goto(testerUrl.href);
  const input = page.locator('#difficulty');
  await expect(input).toHaveAttribute('min', '1');
  await expect(input).toHaveAttribute('max', '5');
  for (const [value, expected] of [['1', 1], ['5', 5], ['2', 2], ['0', 3], ['6', 3], ['2.5', 3], ['', 3]]) {
    await input.fill(value);
    await expect.poll(async () => JSON.parse(await page.locator('#payloadEditor').inputValue()).difficulty).toBe(expected);
  }
  await input.fill('2.5');
  const markdown = await readFile(specUrl, 'utf8');
  const html = [...markdown.matchAll(/\x60{3}html\r?\n([\s\S]*?)\x60{3}/g)]
    .map(match => match[1]).find(source => source.includes('<!doctype html>'));
  await page.locator('#gameFile').setInputFiles({
    name: 'skeleton.html', mimeType: 'text/html', buffer: Buffer.from(html)
  });
  const game = page.frameLocator('#gameFrame');
  await expect(game.locator('#startButton')).toBeVisible();
  const frame = await (await page.locator('#gameFrame').elementHandle()).contentFrame();
  await expect.poll(() => frame.evaluate('activeGameInit && activeGameInit.difficulty')).toBe(3);
  expect(await frame.evaluate('difficulty')).toBe(3);
});
