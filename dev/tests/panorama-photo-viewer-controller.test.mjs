import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const photoViewerModule = require('../../engine/panorama-photo-viewer-controller.js');

// Имитирует classList элементов photo-viewer с поддержкой явного и обычного toggle.
function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(...names) { names.forEach(function(name) { values.add(name); }); },
    remove(...names) { names.forEach(function(name) { values.delete(name); }); },
    contains(name) { return values.has(name); },
    toggle(name, force) {
      const shouldAdd = force === undefined ? !values.has(name) : !!force;
      if (shouldAdd) values.add(name); else values.delete(name);
      return shouldAdd;
    }
  };
}

// Создаёт DOM-подобный элемент с геометрией, атрибутами и управляемыми событиями.
function createElementStub(options = {}) {
  const listeners = new Map();
  const attributes = new Map();
  const queryResults = new Map();
  const contained = new Set();
  const element = {
    style: {},
    textContent: '',
    src: '',
    width: options.width || 0,
    height: options.height || 0,
    naturalWidth: options.naturalWidth || 0,
    naturalHeight: options.naturalHeight || 0,
    offsetHeight: options.offsetHeight || 0,
    parentElement: options.parentElement || null,
    classList: createClassList(options.classes || []),
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      if (listeners.has(type)) listeners.get(type).delete(callback);
    },
    dispatch(type, extra = {}) {
      const event = {
        type,
        target: element,
        preventDefault() {},
        stopPropagation() {},
        ...extra
      };
      for (const callback of listeners.get(type) || []) callback(event);
      return event;
    },
    listenerCount(type) { return (listeners.get(type) || new Set()).size; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === 'src') element.src = '';
    },
    querySelector(selector) { return queryResults.get(selector) || null; },
    setQueryResult(selector, value) { queryResults.set(selector, value); },
    contains(target) { return target === element || contained.has(target); },
    addContained(target) { contained.add(target); },
    getBoundingClientRect() {
      return {
        left: options.left || 0,
        top: options.top || 0,
        width: options.rectWidth || options.width || 0,
        height: options.rectHeight || options.height || 0
      };
    },
    setPointerCapture() {},
    releasePointerCapture() {}
  };
  return element;
}

// Создаёт отдельную цель глобальных resize/keydown событий.
function createEventTargetStub() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      if (listeners.has(type)) listeners.get(type).delete(callback);
    },
    dispatch(type, event) {
      for (const callback of listeners.get(type) || []) callback(event);
    },
    listenerCount(type) { return (listeners.get(type) || new Set()).size; }
  };
}

// Предоставляет ручную очередь animation frame для проверки close/dispose без реального браузера.
function createManualFrames() {
  const callbacks = new Map();
  let nextId = 1;
  return {
    request(callback) { const id = nextId++; callbacks.set(id, callback); return id; },
    cancel(id) { callbacks.delete(id); },
    runAll() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach(function(callback) { callback(); });
    },
    size() { return callbacks.size; }
  };
}

// Собирает полностью управляемый viewer и журналы назначений изображения.
function createFixture(overrides = {}) {
  const stage = createElementStub({ rectWidth: 1000, rectHeight: 700 });
  const media = createElementStub();
  const viewport = createElementStub({ parentElement: media, rectWidth: 800, rectHeight: 450 });
  const inner = createElementStub();
  const image = createElementStub({ naturalWidth: 1600, naturalHeight: 900 });
  const caption = createElementStub({ classes: ['hidden'], offsetHeight: 42 });
  const previousButton = createElementStub({ classes: ['hidden'] });
  const nextButton = createElementStub({ classes: ['hidden'] });
  const viewer = createElementStub({ classes: ['hidden'] });
  const panoramaCanvas = createElementStub();
  const marksLayer = createElementStub();
  const windowTarget = createEventTargetStub();
  const documentTarget = createEventTargetStub();
  const frames = createManualFrames();
  const assignments = [];
  const warnings = [];
  const marks = new Map();
  let panoramaActive = true;
  let marksLocked = false;
  let panoramaInteractive = true;

  viewer.setQueryResult('.bg360-photo-viewer-stage', stage);
  viewer.setQueryResult('[data-bg360-photo-prev]', previousButton);
  viewer.setQueryResult('[data-bg360-photo-next]', nextButton);
  viewport.addContained(inner);
  viewport.addContained(image);

  const controller = photoViewerModule.createPanoramaPhotoViewerController({
    viewer,
    viewport,
    inner,
    image,
    caption,
    panoramaCanvas,
    marksLayer,
    window: windowTarget,
    document: documentTarget,
    requestAnimationFrame: frames.request,
    cancelAnimationFrame: frames.cancel,
    assignImage(target, source, handlers) {
      target.src = source;
      assignments.push({ target, source, handlers });
    },
    getMarkById(markId) { return marks.get(String(markId)) || null; },
    isPanoramaActive() { return panoramaActive; },
    isMarksLocked() { return marksLocked; },
    getPanoramaInteractive() { return panoramaInteractive; },
    setPanoramaInteractive(value) { panoramaInteractive = value; },
    warn(...args) { warnings.push(args); },
    ...overrides
  });

  return {
    controller,
    viewer,
    viewport,
    inner,
    image,
    caption,
    previousButton,
    nextButton,
    panoramaCanvas,
    marksLayer,
    windowTarget,
    documentTarget,
    frames,
    assignments,
    warnings,
    marks,
    setPanoramaActive(value) { panoramaActive = value; },
    setMarksLocked(value) { marksLocked = value; },
    getPanoramaInteractive() { return panoramaInteractive; }
  };
}

// Сохраняет все прежние алиасы photo/images и отбрасывает записи без пути.
test('нормализация photo-меток поддерживает строковые и объектные изображения', function() {
  assert.deepEqual(photoViewerModule.normalizePhotoImages({
    kind: 'photo',
    photos: [
      ' assets/a.jpg ',
      { src: 'assets/b.webp', text: ' Второе ' },
      { path: 'assets/c.png', caption: 'Третье' },
      { caption: 'Без файла' }
    ]
  }), [
    { file: 'assets/a.jpg', caption: '' },
    { file: 'assets/b.webp', caption: 'Второе' },
    { file: 'assets/c.png', caption: 'Третье' }
  ]);
  assert.deepEqual(photoViewerModule.normalizePhotoImages({ image: 'assets/one.jpg' }), [
    { file: 'assets/one.jpg', caption: '' }
  ]);
});

// Не открывает viewer вне активной панорамы, при блокировке или без изображения.
test('open проверяет runtime и содержимое photo-метки до изменения DOM', function() {
  const fixture = createFixture();
  fixture.controller.start();
  fixture.setPanoramaActive(false);
  assert.equal(fixture.controller.open({ kind: 'photo', images: ['assets/a.jpg'] }), false);
  fixture.setPanoramaActive(true);
  fixture.setMarksLocked(true);
  assert.equal(fixture.controller.open({ kind: 'photo', images: ['assets/a.jpg'] }), false);
  fixture.setMarksLocked(false);
  assert.equal(fixture.controller.open({ kind: 'photo', id: 'empty', images: [] }), false);
  assert.equal(fixture.warnings.length, 1);
  assert.equal(fixture.viewer.classList.contains('hidden'), true);
  fixture.controller.dispose();
});

// Открывает карточку, листает один img и полностью восстанавливает 360 после Escape.
test('viewer синхронизирует изображение, подпись, навигацию и закрытие', function() {
  const fixture = createFixture();
  const mark = {
    kind: 'photo',
    id: 'gallery',
    images: [
      { file: 'assets/a.jpg', caption: 'Первое' },
      { file: 'assets/b.jpg', caption: 'Второе' }
    ]
  };
  fixture.marks.set(mark.id, mark);
  fixture.controller.start();

  assert.equal(fixture.controller.open(mark), true);
  assert.equal(fixture.getPanoramaInteractive(), false);
  assert.equal(fixture.viewer.classList.contains('hidden'), false);
  assert.equal(fixture.viewer.getAttribute('aria-hidden'), 'false');
  assert.equal(fixture.caption.textContent, 'Первое');
  assert.equal(fixture.previousButton.classList.contains('hidden'), true);
  assert.equal(fixture.nextButton.classList.contains('hidden'), false);
  fixture.assignments[0].handlers.onLoad();
  fixture.frames.runAll();

  fixture.documentTarget.dispatch('keydown', {
    key: 'ArrowRight',
    preventDefault() {},
    stopPropagation() {}
  });
  assert.equal(fixture.assignments.at(-1).source, 'assets/b.jpg');
  assert.equal(fixture.caption.textContent, 'Второе');
  assert.equal(fixture.nextButton.classList.contains('hidden'), true);
  fixture.assignments.at(-1).handlers.onLoad();

  fixture.documentTarget.dispatch('keydown', {
    key: 'Escape',
    preventDefault() {},
    stopPropagation() {}
  });
  assert.equal(fixture.controller.state.active, false);
  assert.equal(fixture.viewer.classList.contains('hidden'), true);
  assert.equal(fixture.image.src, '');
  assert.equal(fixture.getPanoramaInteractive(), true);
  assert.equal(fixture.panoramaCanvas.classList.contains('is-photo-viewer-open'), false);
  assert.equal(fixture.marksLayer.classList.contains('is-photo-viewer-open'), false);
  fixture.controller.dispose();
});

// Игнорирует поздний onLoad прежнего кадра и масштабирует актуальный кадр колесом.
test('async-загрузка и zoom не применяют устаревшее состояние изображения', function() {
  const fixture = createFixture();
  const mark = { kind: 'photo', id: 'gallery', images: ['assets/a.jpg', 'assets/b.jpg'] };
  fixture.marks.set(mark.id, mark);
  fixture.controller.start();
  fixture.controller.open(mark);
  const firstLoad = fixture.assignments[0].handlers.onLoad;
  fixture.controller.setIndex(1);
  const secondLoad = fixture.assignments[1].handlers.onLoad;

  firstLoad();
  assert.equal(fixture.controller.state.slideState.loaded, false);
  secondLoad();
  assert.equal(fixture.controller.state.slideState.loaded, true);
  const previousZoom = fixture.controller.state.slideState.zoom;
  fixture.viewer.dispatch('wheel', {
    target: fixture.viewport,
    deltaY: -1,
    clientX: 400,
    clientY: 225,
    preventDefault() {}
  });
  assert.ok(fixture.controller.state.slideState.zoom > previousZoom);
  assert.ok(fixture.inner.style.transform.includes('scale('));
  fixture.controller.dispose();
});

// Снимает все локальные и глобальные обработчики и отменяет ожидающий layout при dispose.
test('dispose полностью очищает lifecycle photo-viewer', function() {
  const fixture = createFixture();
  fixture.controller.start();
  fixture.controller.open({ kind: 'photo', id: 'one', image: 'assets/a.jpg' });
  assert.equal(fixture.viewer.listenerCount('pointerdown'), 1);
  assert.equal(fixture.windowTarget.listenerCount('resize'), 1);
  assert.equal(fixture.documentTarget.listenerCount('keydown'), 1);
  assert.ok(fixture.frames.size() > 0);

  fixture.controller.dispose();
  assert.equal(fixture.viewer.listenerCount('pointerdown'), 0);
  assert.equal(fixture.windowTarget.listenerCount('resize'), 0);
  assert.equal(fixture.documentTarget.listenerCount('keydown'), 0);
  assert.equal(fixture.frames.size(), 0);
  assert.equal(fixture.controller.state.active, false);
});

// Защищает bootstrap-порядок, делегирование engine.js и удаление прежнего глобального runtime viewer.
test('runtime подключает photo-viewer controller до engine.js', async function() {
  const [indexSource, engineSource] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../engine/engine.js', import.meta.url), 'utf8')
  ]);

  assert.ok(indexSource.indexOf('engine/panorama-photo-viewer-controller.js') < indexSource.indexOf('engine/engine.js'));
  assert.ok(engineSource.includes('VN_PANORAMA_PHOTO_VIEWER_CONTROLLER.createPanoramaPhotoViewerController'));
  assert.ok(engineSource.includes('panoramaPhotoViewerController.open(mark)'));
  assert.ok(engineSource.includes('panoramaPhotoViewerController.close(reason)'));
  assert.ok(engineSource.includes('panoramaPhotoViewerController.dispose()'));
  assert.equal(engineSource.includes('bg360PhotoViewerRuntime'), false);
  assert.equal(engineSource.includes('function handleBg360PhotoViewerPointerMove'), false);
});
