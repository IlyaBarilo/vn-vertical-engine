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

test.describe('сенсорные кнопки каркаса', () => {
  test.use({ hasTouch: true });

  // Настоящий браузерный tap должен активировать кнопку один раз и не запускать игровой ввод.
  test('tap запускает игру и подтверждает единственный результат', async ({ page }) => {
    const frame = await openSkeleton(page);
    await sendInit(page, frame, 'touch');
    // Считаем входы в игровой обработчик: UI не должен их вызывать, tap поля — только один.
    await frame.evaluate(`(() => {
      window.gameInputs = 0;
      const original = onGameInputStart;
      onGameInputStart = function (...args) {
        window.gameInputs += 1;
        original(...args);
      };
    })()`);
    await frame.locator('#startButton').tap();
    await expect.poll(() => frame.evaluate('gameStarted')).toBe(true);
    expect(await frame.evaluate('window.gameInputs')).toBe(0);
    // Прозрачная часть UI-слоя принимает hit-test и передаёт игровой ввод общему контейнеру.
    await frame.locator('#uiRoot').tap({ position: { x: 100, y: 200 } });
    expect(await frame.evaluate('window.gameInputs')).toBe(1);
    expect(await frame.evaluate('activePointerId')).toBe(null);
    await frame.evaluate('showFinish(1)');
    await frame.locator('#finishButton').tap();
    await expect.poll(() => page.evaluate(() => window.results.length)).toBe(1);
    expect(await frame.evaluate('resultSent && activePointerId === null')).toBe(true);
  });
});

// Проверяет нормализацию параметра в настоящем родительском init, включая границы и отсутствие значения.
test('каркас принимает только целую сложность 1..5', async ({ page }) => {
  const frame = await openSkeleton(page);
  const cases = [[1, 1], [5, 5], ['2', 2], [0, 3], [6, 3], [-1, 3],
    [2.5, 3], ['bad', 3], [true, 3], [null, 3], [undefined, 3], [[], 3], [{}, 3], [Infinity, 3]];
  for (const [index, [input, expected]] of cases.entries()) {
    await page.evaluate(({ index, input }) => {
      document.getElementById('game').contentWindow.postMessage({
        type: 'gameInit', protocolVersion: 2, gameId: 'example',
        sessionId: 'difficulty-' + index, difficulty: input
      }, '*');
    }, { index, input });
    await expect.poll(() => frame.evaluate('activeGameInit.sessionId')).toBe('difficulty-' + index);
    expect(await frame.evaluate('difficulty')).toBe(expected);
  }
});

// Настоящее удержание продолжает получать события за пределами макета и освобождается при cancel и финише.
test('захват указателя и отмена не оставляют удержание активным', async ({ page }) => {
  const frame = await openSkeleton(page);
  await sendInit(page, frame, 'drag');
  await frame.locator('#startButton').click();
  await frame.locator('#gameRoot').evaluate(element => {
    window.moveCount = 0;
    element.addEventListener('pointermove', () => { window.moveCount += 1; });
  });
  await page.mouse.move(200, 400);
  await page.mouse.down();
  expect(await frame.evaluate('activePointerId !== null && pointerCaptureTarget.hasPointerCapture(activePointerId)')).toBe(true);
  await page.mouse.move(200, 900);
  expect(await frame.evaluate('window.moveCount')).toBeGreaterThan(0);
  // Синтетический pointercancel проверяет ветку отмены после настоящего pointerdown.
  await frame.evaluate(`pointerCaptureTarget.dispatchEvent(new PointerEvent('pointercancel', {
    bubbles: true, pointerId: activePointerId, pointerType: 'mouse', cancelable: true
  }))`);
  expect(await frame.evaluate('activePointerId === null && pointerCaptureTarget === null')).toBe(true);
  await page.mouse.up();
  await page.mouse.move(200, 400);
  await page.mouse.down();
  await frame.evaluate('showFinish(1)');
  expect(await frame.evaluate('activePointerId === null')).toBe(true);
  await page.mouse.up();
  await frame.locator('#finishButton').click();
  await expect.poll(() => page.evaluate(() => window.results.length)).toBe(1);
});

// Проверяет резервные каналы без Pointer Events и отмену touch без зависимости от устройства.
test('fallback обрабатывает один touch и сбрасывает touchcancel', async ({ page }) => {
  await page.addInitScript(() => { delete window.PointerEvent; });
  const frame = await openSkeleton(page);
  expect(await frame.evaluate('HAS_POINTER_EVENTS')).toBe(false);
  await sendInit(page, frame, 'fallback');
  await frame.locator('#startButton').click();
  await frame.evaluate(`(() => {
    const target = document.getElementById('gameCanvas');
    const emit = (type, id) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'changedTouches', { value: [{ identifier: id, clientX: 50, clientY: 200 }] });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    window.emitTouch = emit;
    window.touchDefaultPrevented = emit('touchstart', 7);
    emit('touchstart', 8);
  })()`);
  expect(await frame.evaluate('activeTouchId')).toBe(7);
  expect(await frame.evaluate('window.touchDefaultPrevented')).toBe(true);
  await frame.evaluate("window.emitTouch('touchcancel', 7)");
  expect(await frame.evaluate('activeTouchId')).toBe(null);
  await page.mouse.move(100, 300);
  await page.mouse.down();
  expect(await frame.evaluate('mouseActive')).toBe(true);
  await page.mouse.up();
  expect(await frame.evaluate('mouseActive')).toBe(false);
});
