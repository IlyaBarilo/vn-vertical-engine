import { expect } from '@playwright/test';

// Firefox BiDi иногда возвращает null для boundingBox строгого iframe; DOM-прямоугольники позволяют проверить настоящий указатель.
export async function clickFrameButton(page, frameSelector, buttonSelector) {
  const button = page.frameLocator(frameSelector).locator(buttonSelector);
  await expect(button).toBeVisible();
  // Предпросмотр тестера может находиться ниже видимой части страницы; прокрутка предшествует чтению координат.
  await page.locator(frameSelector).evaluate(function revealFrame(element) { element.scrollIntoView({ block: 'center', inline: 'center' }); });
  await button.evaluate(function revealButton(element) { element.scrollIntoView({ block: 'center', inline: 'center' }); });
  const frame = await page.locator(frameSelector).evaluate(function readFrameGeometry(element) {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, scaleX: rect.width / element.offsetWidth, scaleY: rect.height / element.offsetHeight, borderX: element.clientLeft, borderY: element.clientTop };
  });
  const target = await button.evaluate(function readButtonGeometry(element) {
    const rect = element.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width, height: rect.height };
  });
  expect(target.width).toBeGreaterThan(0);
  expect(target.height).toBeGreaterThan(0);
  await page.mouse.click(frame.x + (frame.borderX + target.x) * frame.scaleX, frame.y + (frame.borderY + target.y) * frame.scaleY);
}
