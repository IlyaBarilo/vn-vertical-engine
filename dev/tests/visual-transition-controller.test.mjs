import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const visualTransitionModule = require('../../engine/visual-transition-controller.js');

// Имитирует classList основных и временных визуальных слоёв.
function createClassList(initial = ['hidden']) {
  const values = new Set(initial);
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); },
    toggle(value, force) {
      const enabled = force === undefined ? !values.has(value) : !!force;
      if (enabled) values.add(value);
      else values.delete(value);
      return enabled;
    }
  };
}

// Создаёт DOM/media-заглушку с listener-реестром и поддержкой удаления дочерних overlay.
function createElementStub(tagName = 'div', initial = ['hidden']) {
  const listeners = new Map();
  return {
    tagName: tagName.toUpperCase(),
    className: initial.join(' '),
    classList: createClassList(initial),
    style: {},
    children: [],
    parentNode: null,
    src: '',
    currentSrc: '',
    currentTime: 0,
    readyState: 0,
    naturalWidth: 0,
    naturalHeight: 0,
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter(function(candidate) { return candidate !== child; });
      child.parentNode = null;
      return child;
    },
    setAttribute() {},
    removeAttribute(name) {
      if (name === 'src') {
        this.src = '';
        this.currentSrc = '';
      }
    },
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      if (listeners.has(type)) listeners.get(type).delete(callback);
    },
    dispatch(type) {
      for (const callback of listeners.get(type) || []) callback({ type });
    },
    listenerCount(type) { return (listeners.get(type) || new Set()).size; },
    play() { return Promise.resolve(); },
    pause() {},
    load() {}
  };
}

// Создаёт минимальный document, который сохраняет CSS-переменную и типы созданных overlay.
function createDocumentStub() {
  const properties = new Map();
  const createdElements = [];
  return {
    documentElement: {
      style: {
        setProperty(name, value) { properties.set(name, value); },
        removeProperty(name) { properties.delete(name); }
      }
    },
    createElement(tagName) {
      const element = createElementStub(tagName);
      createdElements.push(element);
      return element;
    },
    properties,
    createdElements
  };
}

// Собирает контроллер с реальными Promise и ускоренными таймерами для детерминированных lifecycle-проверок.
function createFixture(overrides = {}) {
  const document = createDocumentStub();
  const novelWindow = createElementStub('div', []);
  const backgroundImage = createElementStub('img', []);
  const backgroundVideo = createElementStub('video');
  const panorama = createElementStub('div');
  const character = createElementStub('img');
  const blurLayer = createElementStub('div');
  const blurImage = createElementStub('img');
  const blurVideo = createElementStub('video');
  const calls = [];
  const timers = new Set();

  // Ускоряет длительности переходов, сохраняя асинхронную границу Promise/timer.
  function fastTimeout(callback) {
    const id = setTimeout(function runFastTimer() {
      timers.delete(id);
      callback();
    }, 0);
    timers.add(id);
    return id;
  }

  // Отменяет только таймеры, созданные тестовой fixture.
  function fastClearTimeout(id) {
    timers.delete(id);
    clearTimeout(id);
  }

  const controller = visualTransitionModule.createVisualTransitionController({
    document,
    novelWindow,
    backgroundImage,
    backgroundVideo,
    panorama,
    character,
    blurLayer,
    blurImage,
    blurVideo,
    getStoryMeta() { return { transition: 'fade', transitionMs: 20, blurBackground: false }; },
    isCurrentBackground360() { return false; },
    prepareBackground(action) {
      return {
        action,
        file: action.src,
        fallback: action.fallback || '',
        normalizedSrc: action.src,
        mediaOptions: action.mediaOptions || {},
        changesVisual: action.changesVisual !== false
      };
    },
    prepareCharacter(action) {
      return action.src === null
        ? { kind: 'hide', changesVisual: true }
        : { kind: 'show', normalizedSrc: action.src, changesVisual: true };
    },
    applyBackground(prepared) {
      calls.push(['background', prepared.file]);
      backgroundImage.src = prepared.file;
      backgroundImage.classList.remove('hidden');
    },
    applyCharacter(prepared) {
      calls.push(['character', prepared.kind]);
      character.classList.toggle('hidden', prepared.kind !== 'show');
    },
    applyPanoramaMarks(action) { calls.push(['marks', action.id]); },
    preloadImage() { return Promise.resolve(true); },
    assignRasterImage(element, src, callbacks) {
      element.src = src;
      element.currentSrc = src;
      element.naturalWidth = 100;
      element.naturalHeight = 100;
      if (callbacks.onLoad) callbacks.onLoad(src);
    },
    resolveVideoUrl(src) { return src; },
    normalizeUrl(src) { return src; },
    isVideoPath(src) { return /\.mp4$/i.test(src); },
    isBlurEnabled() { return false; },
    normalizeScrollOptions(value) { return value || {}; },
    normalizeMediaScale(value, fallback) { return typeof value === 'number' ? value : fallback; },
    normalizeScrollStart(value, fallback) { return typeof value === 'number' ? value : fallback; },
    computeFocusedMediaPosition(element, container, focusX) { return focusX; },
    resetScrollableMediaPosition(element) {
      element.style.objectPosition = '';
      element.style.transform = '';
    },
    setTimeout: fastTimeout,
    clearTimeout: fastClearTimeout,
    requestAnimationFrame: fastTimeout,
    cancelAnimationFrame: fastClearTimeout,
    ...overrides
  });

  return {
    controller,
    document,
    novelWindow,
    backgroundImage,
    backgroundVideo,
    panorama,
    character,
    blurLayer,
    blurVideo,
    calls,
    timers
  };
}

// Собирает только непрерывную группу bg/char/bg360marks и останавливается перед репликой.
test('visual transition controller группирует только соседние визуальные действия', function() {
  const fixture = createFixture();
  const scene = {
    actions: [
      { type: 'bg', src: 'hall.jpg' },
      { type: 'char', src: 'guide.png' },
      { type: 'bg360marks', id: 'doors' },
      { type: 'dialog', text: 'Стоп' },
      { type: 'bg', src: 'outside.jpg' }
    ]
  };

  assert.equal(fixture.controller.isCandidate(scene.actions[0]), true);
  assert.equal(fixture.controller.isCandidate(scene.actions[3]), false);
  assert.deepEqual(fixture.controller.collectActions(scene, 0), scene.actions.slice(0, 3));
  fixture.controller.dispose();
});

// Учитывает локальный override, цвет cover и верхнюю границу длительности.
test('настройки перехода нормализуют режим и transitionMs', function() {
  const fixture = createFixture();
  const settings = fixture.controller.getSettings({ transition: 'white', transitionMs: 9000 });

  assert.deepEqual(settings, {
    enabled: true,
    mode: 'cover',
    coverColor: '#fff',
    outMs: 889,
    inMs: 1111
  });
  fixture.controller.dispose();
});

// При transition=none синхронно применяет финальный фон, метки и персонажа без временных DOM-слоёв.
test('отключённый переход применяет батч синхронно', async function() {
  const fixture = createFixture({ getStoryMeta() { return { transition: 'none', transitionMs: 0 }; } });
  const execution = fixture.controller.execute([
    { type: 'bg', src: 'hall.jpg' },
    { type: 'bg360marks', id: 'exit' },
    { type: 'char', src: 'guide.png' }
  ]);

  assert.equal(execution.async, false);
  assert.equal(await execution.promise, true);
  assert.deepEqual(fixture.calls, [
    ['background', 'hall.jpg'],
    ['marks', 'exit'],
    ['character', 'show']
  ]);
  assert.equal(fixture.document.createdElements.length, 0);
  fixture.controller.dispose();
});

// Fade проявляет новый image-overlay, применяет основной фон и очищает временный src после swap.
test('fade выполняет crossfade обычного изображения и очищает overlay', async function() {
  const fixture = createFixture();
  const execution = fixture.controller.execute([{ type: 'bg', src: 'cafe.jpg', mediaOptions: { focusX: 0.25 } }]);

  assert.equal(execution.async, true);
  assert.equal(await execution.promise, true);
  assert.deepEqual(fixture.calls, [['background', 'cafe.jpg']]);
  const crossfadeImage = fixture.document.createdElements.find(function(element) {
    return element.tagName === 'IMG' && element.parentNode === fixture.novelWindow;
  });
  assert.ok(crossfadeImage);
  assert.equal(crossfadeImage.src, '');
  assert.equal(crossfadeImage.classList.contains('hidden'), true);
  assert.equal(fixture.timers.size, 0);
  fixture.controller.dispose();
});

// Отмена до завершения preload не применяет устаревший план и возвращает false вызывающему координатору.
test('cancel не позволяет отменённому переходу продолжить историю', async function() {
  let releasePreload;
  const fixture = createFixture({
    preloadImage() {
      return new Promise(function(resolve) { releasePreload = resolve; });
    }
  });
  const execution = fixture.controller.execute([{ type: 'bg', src: 'delayed.jpg' }]);
  fixture.controller.cancel();
  releasePreload(true);

  assert.equal(await execution.promise, false);
  assert.deepEqual(fixture.calls, []);
  assert.equal(fixture.timers.size, 0);
  fixture.controller.dispose();
});

// Dispose удаляет созданную завесу, сбрасывает CSS-переменную и не оставляет ожидающих операций.
test('dispose освобождает overlay и transition lifecycle', async function() {
  const fixture = createFixture({ getStoryMeta() { return { transition: 'black', transitionMs: 10 }; } });
  const execution = fixture.controller.execute([{ type: 'char', src: 'guide.png' }]);
  assert.equal(await execution.promise, true);
  assert.ok(fixture.novelWindow.children.length > 0);

  fixture.controller.dispose();
  assert.equal(fixture.novelWindow.children.length, 0);
  assert.equal(fixture.document.properties.has('--visualTransitionMs'), false);
  assert.equal(fixture.timers.size, 0);
});

// Закрепляет bootstrap-порядок, lifecycle-подключение и отсутствие прежнего состояния переходов в engine.js.
test('runtime загружает visual transition controller до engine.js', async function() {
  const [indexSource, engineSource] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../engine/engine.js', import.meta.url), 'utf8')
  ]);

  assert.ok(indexSource.indexOf('engine/visual-transition-controller.js') < indexSource.indexOf('engine/engine.js'));
  assert.ok(engineSource.includes('VN_VISUAL_TRANSITION_CONTROLLER.createVisualTransitionController'));
  assert.ok(engineSource.includes('visualTransitionController.execute(actions)'));
  assert.ok(engineSource.includes('visualTransitionController.cancel()'));
  assert.ok(engineSource.includes('visualTransitionController.dispose()'));
  assert.equal(engineSource.includes('__visualTransitionSeq'), false);
  assert.equal(engineSource.includes('function runFadeVisualTransition('), false);
});
