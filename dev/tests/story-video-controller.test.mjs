import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const storyVideoModule = require('../../engine/story-video-controller.js');

// Имитирует classList слоёв сюжетного видео.
function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); },
    toggle(value, force) { if (force) values.add(value); else values.delete(value); }
  };
}

// Создаёт DOM-слой с событиями, стилями и media-методами, нужными контроллеру.
function createElementStub(initial = ['hidden']) {
  const listeners = new Map();
  return {
    src: '',
    currentSrc: '',
    currentTime: 0,
    duration: 10,
    readyState: 2,
    style: {},
    textContent: '',
    classList: createClassList(initial),
    playCalls: 0,
    pauseCalls: 0,
    loadCalls: 0,
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      if (listeners.has(type)) listeners.get(type).delete(callback);
    },
    dispatch(type, extra = {}) {
      for (const callback of listeners.get(type) || []) callback({ type, ...extra });
    },
    listenerCount(type) { return (listeners.get(type) || new Set()).size; },
    play() { this.playCalls += 1; return Promise.resolve(); },
    pause() { this.pauseCalls += 1; },
    load() { this.loadCalls += 1; },
    removeAttribute(name) { if (name === 'src') { this.src = ''; this.currentSrc = ''; } },
    setAttribute() {}
  };
}

// Создаёт document-подобную цель для глобального keyboard lifecycle.
function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      if (listeners.has(type)) listeners.get(type).delete(callback);
    },
    dispatch(type, event) { for (const callback of listeners.get(type) || []) callback(event); },
    listenerCount(type) { return (listeners.get(type) || new Set()).size; }
  };
}

// Предоставляет ручные timeout, чтобы fallback и seek не зависели от реального времени.
function createManualTimers() {
  const callbacks = new Map();
  let nextId = 1;
  return {
    callbacks,
    setTimeout(callback) { const id = nextId++; callbacks.set(id, callback); return id; },
    clearTimeout(id) { callbacks.delete(id); },
    runAll() { const entries = [...callbacks.values()]; callbacks.clear(); for (const callback of entries) callback(); }
  };
}

// Собирает контроллер с управляемым временем и журналами внешней координации.
function createFixture(overrides = {}) {
  const overlay = createElementStub();
  const video = createElementStub();
  const poster = createElementStub();
  const fallbackText = createElementStub();
  const skipHint = createElementStub();
  const eventTarget = createEventTarget();
  const timers = createManualTimers();
  const volumes = [];
  const finishes = [];
  const traces = [];
  let currentNow = 1000;
  let active = true;
  let keepUntilBackground = false;
  let swallowed = 0;

  const controller = storyVideoModule.createStoryVideoController({
    overlay,
    video,
    poster,
    fallbackText,
    skipHint,
    eventTarget,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    now() { return currentNow; },
    resolveAssetUrl(src, kind) { return src.startsWith('assets/') ? `file:///project/${kind}/${src}` : ''; },
    normalizeUrl(src) { return src; },
    translate(key) { return key === 'videoUnavailable' ? 'Видео недоступно' : 'Пропустить'; },
    renderText(value) { return value; },
    setStoryVideoVolume(value) { volumes.push(value); },
    shouldKeepUntilBackgroundVideo() { return keepUntilBackground; },
    isStoryVideoActive() { return active; },
    onFinish(reason) { finishes.push(reason); },
    visualTrace(label, detail) { traces.push({ label, detail }); },
    swallowEvent() { swallowed += 1; },
    ...overrides
  });

  return {
    controller,
    overlay,
    video,
    poster,
    fallbackText,
    skipHint,
    eventTarget,
    timers,
    volumes,
    finishes,
    traces,
    setNow(value) { currentNow = value; },
    setActive(value) { active = value; },
    setKeep(value) { keepUntilBackground = value; },
    getSwallowed() { return swallowed; }
  };
}

// Назначает только проверенные видео/постер и начинает playback после metadata.
test('story video controller запускает разрешённый ролик после metadata', async function() {
  const fixture = createFixture();
  fixture.controller.startLifecycle();
  assert.equal(fixture.controller.start({ src: 'assets/intro.mp4', poster: 'assets/poster.jpg', volume: 0.4 }), true);

  assert.equal(fixture.video.src, 'file:///project/video/assets/intro.mp4');
  assert.equal(fixture.poster.src, 'file:///project/image/assets/poster.jpg');
  fixture.video.onloadedmetadata();
  await Promise.resolve();

  assert.equal(fixture.video.playCalls, 1);
  assert.equal(fixture.video.classList.contains('hidden'), false);
  assert.equal(fixture.volumes.at(-1), 0.4);
});

// Переводит запрещённый src в пропускаемый poster fallback с ограниченным таймером.
test('небезопасный ролик использует poster fallback и затем завершает команду', function() {
  const fixture = createFixture();
  fixture.controller.start({ src: 'https://example.com/intro.mp4', poster: 'assets/poster.jpg', fallbackDuration: 2 });

  assert.equal(fixture.controller.state.fallback, true);
  assert.equal(fixture.poster.classList.contains('hidden'), false);
  assert.equal(fixture.timers.callbacks.size, 1);
  fixture.timers.runAll();
  assert.deepEqual(fixture.finishes, ['fallback timeout']);
});

// Удерживает финальный кадр до готовности следующего видеофона и затем очищает media.
test('finish удерживает слой до сигнала следующего фонового видео', function() {
  const fixture = createFixture();
  fixture.setKeep(true);
  fixture.controller.start({ src: 'assets/intro.mp4' });
  fixture.controller.finish('ended');

  assert.equal(fixture.controller.state.keepUntilBgVideoReady, true);
  assert.equal(fixture.video.src, 'file:///project/video/assets/intro.mp4');
  fixture.controller.hideKeptAfterBackgroundReady('loaded');
  assert.equal(fixture.controller.state.keepUntilBgVideoReady, false);
  assert.equal(fixture.video.src, '');
});

// Не пропускает ролик в guard-период, но принимает тот же pointer после его окончания.
test('skip guard защищает ролик от запускающего клика', function() {
  const fixture = createFixture();
  fixture.controller.start({ src: 'assets/intro.mp4', skippable: true });
  fixture.controller.handleSkip({ type: 'pointerup' });
  assert.equal(fixture.finishes.length, 0);
  assert.equal(fixture.getSwallowed(), 1);

  fixture.setNow(2000);
  fixture.controller.handleSkip({ type: 'pointerup' });
  assert.deepEqual(fixture.finishes, ['skip']);
});

// Снимает overlay/keyboard обработчики и отменяет ожидающие timeout при окончательном уходе.
test('dispose полностью очищает lifecycle сюжетного видео', function() {
  const fixture = createFixture();
  fixture.controller.startLifecycle();
  fixture.controller.start({ src: 'https://example.com/intro.mp4', fallbackDuration: 5 });
  assert.equal(fixture.overlay.listenerCount('pointerup'), 1);
  assert.equal(fixture.eventTarget.listenerCount('keydown'), 1);

  fixture.controller.dispose();
  assert.equal(fixture.overlay.listenerCount('pointerup'), 0);
  assert.equal(fixture.eventTarget.listenerCount('keydown'), 0);
  assert.equal(fixture.timers.callbacks.size, 0);
  assert.equal(fixture.video.src, '');
});

// Защищает bootstrap-порядок, делегирование start и явную очистку controller на pagehide.
test('runtime подключает story video controller до engine.js', async function() {
  const [indexSource, engineSource] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../engine/engine.js', import.meta.url), 'utf8')
  ]);

  assert.ok(indexSource.indexOf('engine/story-video-controller.js') < indexSource.indexOf('engine/engine.js'));
  assert.ok(engineSource.includes('VN_STORY_VIDEO_CONTROLLER.createStoryVideoController'));
  assert.ok(engineSource.includes('storyVideoController.start(action)'));
  assert.ok(engineSource.includes('storyVideoController.dispose()'));
  assert.equal(engineSource.includes('var STORY_VIDEO_SEEK_TIMEOUT_MS'), false);
});
