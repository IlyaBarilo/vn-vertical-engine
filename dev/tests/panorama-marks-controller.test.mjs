import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const marksModule = require('../../engine/panorama-marks-controller.js');

// Имитирует classList и синхронизирует его с className тестового DOM-элемента.
function createClassList(readClassName, writeClassName) {
  function readValues() {
    return new Set(String(readClassName() || '').split(/\s+/).filter(Boolean));
  }

  // Записывает итоговый набор классов одной строкой, как это делает настоящий DOM.
  function writeValues(values) {
    writeClassName([...values].join(' '));
  }

  return {
    add(...names) {
      const values = readValues();
      names.forEach(function(name) { values.add(name); });
      writeValues(values);
    },
    remove(...names) {
      const values = readValues();
      names.forEach(function(name) { values.delete(name); });
      writeValues(values);
    },
    contains(name) { return readValues().has(name); },
    toggle(name, force) {
      const values = readValues();
      const shouldAdd = force === undefined ? !values.has(name) : !!force;
      if (shouldAdd) values.add(name); else values.delete(name);
      writeValues(values);
      return shouldAdd;
    }
  };
}

// Создаёт минимальный DOM-элемент с деревом, атрибутами и событиями для render-тестов.
function createElementStub(tagName = 'div') {
  const listeners = new Map();
  const attributes = new Map();
  let className = '';
  const element = {
    tagName: tagName.toUpperCase(),
    children: [],
    parentElement: null,
    style: {},
    dataset: {},
    textContent: '',
    classList: null,
    appendChild(child) {
      child.parentElement = element;
      element.children.push(child);
      return child;
    },
    removeChild(child) {
      const index = element.children.indexOf(child);
      if (index >= 0) element.children.splice(index, 1);
      child.parentElement = null;
      return child;
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
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
    },
    querySelector(selector) { return element.querySelectorAll(selector)[0] || null; },
    querySelectorAll(selector) {
      const matches = [];
      const classNameSelector = selector.startsWith('.') ? selector.slice(1) : '';
      // Обходит только небольшой тестовый DOM и поддерживает нужные контроллеру class-селекторы.
      function visit(node) {
        for (const child of node.children) {
          if (classNameSelector && child.classList.contains(classNameSelector)) matches.push(child);
          visit(child);
        }
      }
      visit(element);
      return matches;
    },
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
  };
  Object.defineProperty(element, 'className', {
    get() { return className; },
    set(value) { className = String(value || ''); }
  });
  Object.defineProperty(element, 'firstChild', {
    get() { return element.children[0] || null; }
  });
  element.classList = createClassList(function() { return className; }, function(value) { className = value; });
  return element;
}

// Создаёт document-заглушку для HTML- и SVG-узлов одного контроллера.
function createDocumentStub() {
  return {
    documentElement: createElementStub('html'),
    createElement(tagName) { return createElementStub(tagName); },
    createElementNS(namespace, tagName) { return createElementStub(tagName); }
  };
}

// Реализует только операции Vector3, необходимые чистому UV-преобразованию.
class Vector3Stub {
  // Сохраняет начальные координаты так же, как конструктор THREE.Vector3.
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  // Перезаписывает координаты и возвращает тот же объект для цепочек THREE API.
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}

// Проверяет начальное состояние и семантическую классификацию всех типов меток.
test('контроллер владеет состоянием и классифицирует панорамные метки', function() {
  const controller = marksModule.createPanoramaMarksController({});
  assert.deepEqual(controller.state, {
    bgId: null,
    marks: [],
    lines: false,
    locked: false,
    interactive: false
  });
  assert.equal(controller.isSceneTargetMark({ targetScene: 'outside' }), true);
  assert.equal(controller.isViewMark({ kind: 'VIEW' }), true);
  assert.equal(controller.isDirectionalMark({ kind: 'walk', x: 0.2, y: 0.7 }), true);
  assert.equal(controller.isDirectionalMark({ kind: 'photo', x: 0.2, y: 0.7 }), false);
  assert.equal(controller.isDirectionalMark({ kind: 'walk', targetScene: 'outside', x: 0.2, y: 0.7 }), false);
  controller.dispose();
});

// Направляет photo, goto360 и walk360 через разные callbacks и соблюдает locked/done.
test('единая активация меток сохраняет приоритеты viewer и сценарной навигации', function() {
  const selected = [];
  const opened = [];
  let gotoActive = false;
  let gotoDone = false;
  let walkActive = false;
  const controller = marksModule.createPanoramaMarksController({
    isPhotoMark(mark) { return mark?.kind === 'photo'; },
    normalizePhotoImages(mark) { return mark?.images || []; },
    openPhotoViewer(mark) { opened.push(mark.id); return true; },
    isGotoActive() { return gotoActive; },
    isGotoDone() { return gotoDone; },
    onGotoSelect(id) { selected.push(`goto:${id}`); },
    isWalkActive() { return walkActive; },
    isWalkDone() { return false; },
    onWalkSelect(id) { selected.push(`walk:${id}`); }
  });
  controller.state.marks = [
    { id: 'photo', kind: 'photo', images: [{ file: 'assets/a.jpg' }] },
    { id: 'route', kind: 'walk', x: 0.5, y: 0.5 }
  ];
  controller.state.interactive = true;

  assert.equal(controller.activateMarkById('photo'), true);
  gotoActive = true;
  assert.equal(controller.activateMarkById('route'), true);
  gotoDone = true;
  assert.equal(controller.activateMarkById('route'), false);
  gotoActive = false;
  walkActive = true;
  assert.equal(controller.activateMarkById('route'), true);
  controller.state.locked = true;
  assert.equal(controller.activateMarkById('photo'), false);
  assert.deepEqual(opened, ['photo']);
  assert.deepEqual(selected, ['goto:route', 'walk:route']);
  controller.dispose();
});

// Строит photo/text DOM, назначает thumbnail и открывает viewer кликом по созданной метке.
test('render создаёт DOM-метки и делегирует thumbnail общей политике ресурсов', function() {
  const document = createDocumentStub();
  const marksLayer = createElementStub('div');
  const assigned = [];
  const opened = [];
  const controller = marksModule.createPanoramaMarksController({
    window: {},
    document,
    marksLayer,
    panoramaRuntime: { active: false },
    isPhotoMark(mark) { return mark?.kind === 'photo'; },
    normalizePhotoImages(mark) { return mark?.images || []; },
    assignImage(element, source) { assigned.push(source); element.src = source; },
    openPhotoViewer(mark) { opened.push(mark.id); return true; }
  });
  controller.state.interactive = true;
  controller.state.marks = [
    {
      id: 'gallery',
      kind: 'photo',
      x: 0.5,
      y: 0.5,
      label: 'Галерея',
      images: [{ file: 'assets/a.jpg' }, { file: 'assets/b.jpg' }]
    },
    { id: 'note', kind: 'text', x: 0.4, y: 0.4, text: 'Описание' }
  ];

  controller.render();
  const marks = marksLayer.querySelectorAll('.bg360-mark');
  assert.equal(marks.length, 2);
  assert.equal(marks[0].classList.contains('kind-photo'), true);
  assert.equal(marks[0].querySelectorAll('.bg360-mark-photo-count')[0].textContent, '2');
  assert.equal(marks[0].querySelectorAll('.bg360-photo-mark-label')[0].textContent, 'Галерея');
  assert.deepEqual(assigned, ['assets/a.jpg']);
  marks[0].dispatch('click');
  assert.deepEqual(opened, ['gallery']);
  controller.dispose();
  assert.equal(marksLayer.children.length, 0);
});

// Проверяет устойчивые математические примитивы hit-test, подписей и UV-направления.
test('геометрические helpers сохраняют координаты и границы навигации', function() {
  const controller = marksModule.createPanoramaMarksController({
    window: { THREE: { Vector3: Vector3Stub } }
  });
  assert.equal(controller.distancePointToSegment2d(5, 2, 0, 0, 10, 0), 2);
  assert.equal(controller.distancePointToSegment2d(15, 0, 0, 0, 10, 0), 5);
  assert.deepEqual(controller.wrapCompassLabelText('один два три', 8), ['один два', 'три']);

  const direction = controller.uvToDirection(0.5, 0.5);
  assert.ok(Math.abs(direction.x + 1) < 1e-10);
  assert.ok(Math.abs(direction.y) < 1e-10);
  assert.ok(Math.abs(direction.z) < 1e-10);
  controller.dispose();
});

// Освобождает геометрию/материалы стрелок и отличает ожидающую texture от готовой.
test('контроллер очищает WebGL-навигацию и отслеживает поколение texture', function() {
  const disposed = [];
  const child = {
    geometry: { dispose() { disposed.push('geometry'); } },
    material: { dispose() { disposed.push('material'); } }
  };
  const group = {
    children: [child],
    remove(item) { this.children.splice(this.children.indexOf(item), 1); }
  };
  const removed = [];
  const runtime = {
    scene: { remove(item) { removed.push(item); } },
    navArrowsGroup: group,
    navArrowsSignature: 'old',
    sourceSrc: 'assets/360/hall-360.css',
    isVideoSource: false,
    loadSeq: 4,
    textureReadyLoadSeq: 3
  };
  const controller = marksModule.createPanoramaMarksController({
    panoramaRuntime: runtime,
    ensureRenderer() { return true; },
    isPanoramaPackPath(path) { return path.endsWith('-360.css'); }
  });

  assert.equal(controller.shouldDeferUntilTextureReady(), true);
  runtime.textureReadyLoadSeq = 4;
  assert.equal(controller.shouldDeferUntilTextureReady(), false);
  controller.disposeNavArrows();
  assert.deepEqual(disposed, ['geometry', 'material']);
  assert.deepEqual(removed, [group]);
  assert.equal(runtime.navArrowsGroup, null);
  assert.equal(runtime.navArrowsSignature, '');
  controller.dispose();
});

// Защищает bootstrap-порядок, создание состояния и отсутствие большой реализации в engine.js.
test('runtime подключает panorama marks controller до engine.js', async function() {
  const [indexSource, engineSource] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../engine/engine.js', import.meta.url), 'utf8')
  ]);

  assert.ok(indexSource.indexOf('engine/panorama-marks-controller.js') < indexSource.indexOf('engine/engine.js'));
  assert.ok(engineSource.includes('VN_PANORAMA_MARKS_CONTROLLER.createPanoramaMarksController'));
  assert.ok(engineSource.includes('getComputedStyle: window.getComputedStyle.bind(window)'));
  assert.ok(engineSource.includes('var bg360MarksRuntime = panoramaMarksController.state'));
  assert.ok(engineSource.includes('panoramaMarksController.render()'));
  assert.ok(engineSource.includes('panoramaMarksController.pickArrowMarkId(clientX, clientY)'));
  assert.ok(engineSource.includes('panoramaMarksController.dispose()'));
  assert.equal(engineSource.includes('var bg360NavArrowHitCache'), false);
  assert.equal(engineSource.includes('function bg360NavUpdateRibbonGeometry'), false);
});
