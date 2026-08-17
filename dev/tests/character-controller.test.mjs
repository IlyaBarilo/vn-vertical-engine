import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const characterModule = require('../../engine/character-controller.js');

// Имитирует classList слоя и рамки персонажа.
function createClassList(initial = ['hidden']) {
  const values = new Set(initial);
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); }
  };
}

// Создаёт DOM-заглушку изображения с синхронизированными src-атрибутом и свойством.
function createCharacterElement() {
  const attributes = new Map();
  let source = '';
  const element = {
    classList: createClassList(),
    style: {},
    dataset: {},
    currentSrc: '',
    naturalWidth: 400,
    naturalHeight: 800,
    offsetWidth: 0,
    offsetHeight: 0,
    complete: false,
    onload: null,
    onerror: null,
    getAttribute(name) { return attributes.get(name) || ''; },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === 'src') {
        source = '';
        this.currentSrc = '';
      }
      if (name === 'data-char-id') delete this.dataset.charId;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    }
  };
  Object.defineProperty(element, 'src', {
    get() { return source; },
    set(value) {
      source = String(value || '');
      element.currentSrc = source;
      attributes.set('src', source);
    }
  });
  return element;
}

// Создаёт рамку персонажа и минимальную геометрию игрового окна.
function createFrameFixture() {
  return {
    frame: {
      classList: createClassList(),
      style: {},
      getBoundingClientRect() {
        return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
      }
    },
    novelWindow: {
      clientWidth: 1000,
      clientHeight: 800,
      getBoundingClientRect() {
        return { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 };
      }
    }
  };
}

// Собирает контроллер с управляемой загрузкой изображений и реальными короткими таймерами.
function createFixture(overrides = {}) {
  const character = createCharacterElement();
  const geometry = createFrameFixture();
  const requests = [];
  const definitions = {
    anna: {
      focusX: 0.4,
      images: {
        neutral: 'assets/characters/anna-neutral.png',
        smile: { file: 'assets/characters/anna-smile.png', focusY: 0.7 }
      },
      imageOptions: { smile: { scale: 1.15 } }
    },
    igor: {
      images: { neutral: 'assets/characters/igor-neutral.png' }
    }
  };
  const autoLoad = overrides.autoLoad !== false;

  const controller = characterModule.createCharacterController({
    character,
    frame: geometry.frame,
    novelWindow: geometry.novelWindow,
    window: { innerWidth: 1000, innerHeight: 800 },
    failedImages: Object.create(null),
    getCharacterDefinition(charId) { return definitions[charId] || null; },
    getRuntimeContext() { return { sceneId: 'intro', actionIndex: 1, currentSceneId: 'intro' }; },
    normalizeFocusX(value, fallback) {
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
    },
    normalizeScale(value, fallback) {
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(0.05, Math.min(8, number)) : fallback;
    },
    resolveVariableValue(value) { return value; },
    normalizeUrl(value) { return String(value || '').replace(/^file:\/\/\/project\//, ''); },
    imageMatchesCandidates(current, expected) { return String(current || '').endsWith(String(expected || '')); },
    areAllImageCandidatesFailed() { return false; },
    assignRasterImage(element, src, callbacks) {
      element.src = src;
      requests.push({ element, src, callbacks });
      if (autoLoad && callbacks.onLoad) callbacks.onLoad(src);
    },
    requestAnimationFrame(callback) { return setTimeout(callback, 0); },
    cancelAnimationFrame(timerId) { clearTimeout(timerId); },
    warn() {},
    log() {},
    ...overrides
  });

  return { controller, character, frame: geometry.frame, novelWindow: geometry.novelWindow, requests };
}

// Даёт завершиться callback, поставленным контроллером через timer и animation frame.
async function flushCharacterWork() {
  await new Promise(function waitForCharacterTimers(resolve) { setTimeout(resolve, 15); });
}

// Закрепляет object-формат изображения и приоритет imageOptions конкретной эмоции.
test('character controller разрешает ассет и нормализует focus-настройки', function() {
  const fixture = createFixture();
  const resolved = fixture.controller.resolveAssetInfo('anna', 'smile');

  assert.equal(resolved.file, 'assets/characters/anna-smile.png');
  assert.deepEqual(resolved.focusOptions, { focusX: 0.4, focusY: 0.7, scale: 1.15 });
  assert.deepEqual(fixture.controller.normalizeFocusOptions({ pos: 'right', focusY: 'top', scale: 2 }), {
    pos: 'right',
    focusX: 0.5,
    focusY: 1,
    scale: 2
  });
});

// Проверяет видимость, точную геометрию и совместимый autosave-снимок после загрузки.
test('show позиционирует персонажа и формирует снимок', async function() {
  const fixture = createFixture();
  let completed = 0;
  const result = fixture.controller.show(
    'assets/characters/anna-neutral.png',
    'left',
    'anna',
    function onCharacterReady() { completed += 1; },
    { focusX: 0.25, focusY: 0.75, scale: 1.2 }
  );

  assert.deepEqual(result, { async: true, changed: true });
  await flushCharacterWork();
  assert.equal(completed, 1);
  assert.equal(fixture.character.classList.contains('hidden'), false);
  assert.equal(fixture.frame.classList.contains('hidden'), false);
  assert.equal(fixture.frame.style.left, '146px');
  assert.equal(fixture.frame.style.top, '52px');
  assert.equal(fixture.frame.style.width, '408px');
  assert.equal(fixture.character.style.left, '102px');
  assert.equal(fixture.character.style.top, '-170px');
  assert.deepEqual(fixture.controller.captureSnapshot(), {
    hidden: false,
    src: 'assets/characters/anna-neutral.png',
    charId: 'anna',
    pos: 'left',
    focusX: 0.25,
    focusY: 0.75,
    scale: 1.2
  });

  assert.deepEqual(
    fixture.controller.show('assets/characters/anna-neutral.png', 'left', 'anna', null, { focusX: 0.25, focusY: 0.75, scale: 1.2 }),
    { async: false, changed: false }
  );
});

// Не позволяет поздней загрузке предыдущего charId показать спрайт или продолжить старый flow.
test('новое поколение игнорирует устаревший onload', async function() {
  const fixture = createFixture({ autoLoad: false });
  let annaDone = 0;
  let igorDone = 0;

  fixture.controller.show('assets/characters/anna-neutral.png', 'left', 'anna', function onAnnaReady() { annaDone += 1; });
  fixture.controller.show('assets/characters/igor-neutral.png', 'right', 'igor', function onIgorReady() { igorDone += 1; });
  fixture.requests[0].callbacks.onLoad(fixture.requests[0].src);
  fixture.requests[1].callbacks.onLoad(fixture.requests[1].src);
  await flushCharacterWork();

  assert.equal(annaDone, 0);
  assert.equal(igorDone, 1);
  assert.equal(fixture.character.dataset.charId, 'igor');
  assert.equal(fixture.character.classList.contains('hidden'), false);
});

// Подготавливает transition без DOM-изменений и применяет его через тот же lifecycle изображения.
test('visual transition использует controller prepare и apply', async function() {
  const fixture = createFixture();
  const prepared = fixture.controller.prepareVisualAction({
    type: 'char',
    charId: 'anna',
    emotion: 'smile',
    pos: 'right',
    focusX: 0.6
  });

  assert.equal(prepared.kind, 'show');
  assert.equal(prepared.changesVisual, true);
  assert.equal(fixture.character.src, '');
  fixture.controller.applyPreparedVisualState(prepared);
  await flushCharacterWork();
  assert.equal(fixture.character.src, 'assets/characters/anna-smile.png');
  assert.equal(fixture.character.dataset.charId, 'anna');
  assert.equal(fixture.controller.getFocusOptions().pos, 'right');

  fixture.controller.applyPreparedVisualState({ kind: 'hide', changesVisual: true });
  assert.deepEqual(fixture.controller.captureSnapshot(), { hidden: true });
});

// Восстанавливает сохранённый кадр и прекращает отложенные callback после dispose.
test('autosave restore и dispose принадлежат единому lifecycle', async function() {
  const fixture = createFixture({ autoLoad: false });
  fixture.controller.applySnapshot({
    hidden: false,
    src: 'assets/characters/anna-neutral.png',
    charId: 'anna',
    pos: 'center',
    focusX: 0.45,
    focusY: 0.55,
    scale: 0.9
  });
  assert.equal(fixture.requests.length, 1);

  fixture.controller.dispose();
  fixture.requests[0].callbacks.onLoad(fixture.requests[0].src);
  await flushCharacterWork();
  assert.equal(fixture.character.src, '');
  assert.equal(fixture.character.classList.contains('hidden'), true);
  assert.deepEqual(fixture.controller.captureSnapshot(), { hidden: true });
});

// Защищает bootstrap, engine-интеграцию и окончательное удаление старого глобального character-state.
test('runtime загружает character controller до engine.js', async function() {
  const [indexSource, engineSource] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../engine/engine.js', import.meta.url), 'utf8')
  ]);

  assert.ok(indexSource.indexOf('engine/character-controller.js') < indexSource.indexOf('engine/engine.js'));
  assert.ok(engineSource.includes('VN_CHARACTER_CONTROLLER.createCharacterController'));
  assert.ok(engineSource.includes('characterController.show('));
  assert.ok(engineSource.includes('characterController.captureSnapshot()'));
  assert.ok(engineSource.includes('characterController.dispose()'));
  assert.equal(engineSource.includes('__activeCharSeq'), false);
  assert.equal(engineSource.includes('function setCharacter('), false);
  assert.equal(engineSource.includes('function adjustCharacterScale('), false);
});
