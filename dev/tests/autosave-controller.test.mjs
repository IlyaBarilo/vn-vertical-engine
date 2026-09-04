import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const autosaveControllerModule = require('../../engine/autosave-controller.js');

// Имитирует адаптер autosave-storage и сохраняет вызовы без настоящего localStorage.
function createStorageAdapter() {
  return {
    currentRaw: null,
    migrationResult: { status: 'missing', legacyKey: 'legacy', targetKey: 'current', error: null },
    writes: [],
    removals: 0,
    readCurrent() {
      return { ok: true, key: 'current', raw: this.currentRaw, error: null };
    },
    writeCurrent(raw) {
      this.writes.push(raw);
      this.currentRaw = raw;
      return { ok: true, key: 'current', error: null };
    },
    removeCurrent() {
      this.removals += 1;
      this.currentRaw = null;
      return { ok: true, key: 'current', error: null };
    },
    migrateLegacy() {
      return this.migrationResult;
    }
  };
}

// Создаёт управляемые таймеры, чтобы debounce-тесты не зависели от реального времени.
function createManualTimers() {
  const callbacks = new Map();
  let nextId = 1;
  return {
    callbacks,
    setTimer(callback) {
      const timerId = nextId++;
      callbacks.set(timerId, callback);
      return timerId;
    },
    clearTimer(timerId) {
      callbacks.delete(timerId);
    },
    runPending() {
      const entries = Array.from(callbacks.entries());
      callbacks.clear();
      for (const entry of entries) entry[1]();
    }
  };
}

// Собирает контроллер, изменяемое runtime-состояние и журналы callback-событий для unit-тестов.
function createControllerFixture() {
  const storage = createStorageAdapter();
  const timers = createManualTimers();
  const state = {
    enabled: true,
    blocked: false,
    sceneId: 'start',
    actionIndex: 1,
    waitingNext: true,
    nextLocked: false,
    inGame: false,
    inVideo: false
  };
  const debugEntries = [];
  const warnings = [];
  const applied = [];
  let beforeClearCount = 0;
  let beforeLoadCount = 0;
  let invalidCount = 0;

  // Разрешает операции только для активной синтетической истории.
  function isEnabled() { return state.enabled; }

  // Имитирует scene/nosave-режим, в котором удаление Storage запрещено.
  function isStorageBlocked() { return state.blocked; }

  // Создаёт минимальный payload из актуального состояния на момент срабатывания debounce.
  function buildPayload() {
    return {
      v: 3,
      sceneId: state.sceneId,
      actionIndex: state.actionIndex,
      waitingNext: state.waitingNext,
      nextLocked: state.nextLocked
    };
  }

  // Принимает только payload текущей версии с известной стартовой сценой.
  function validatePayload(data) {
    return Boolean(data && data.v === 3 && data.sceneId === 'start');
  }

  // Сохраняет уже проверенный payload вместо применения его к DOM тестового окружения.
  function applyPayload(data, raw) {
    applied.push({ data, raw });
    return true;
  }

  // Возвращает поля, которые контроллер использует только в безопасной runtime-диагностике.
  function getRuntimeState() { return state; }

  // Сохраняет диагностические события без вывода в консоль тестов.
  function onDebug(tag, detail) { debugEntries.push({ tag, detail }); }

  // Сохраняет предупреждения Storage и восстановления без зависимости от console.
  function onWarning(message, error) { warnings.push({ message, error }); }

  // Отмечает очистку связанных с восстановлением данных координатора.
  function onBeforeClear() { beforeClearCount += 1; }

  // Отмечает подготовку координатора перед чтением нового слота.
  function onBeforeLoad() { beforeLoadCount += 1; }

  // Отмечает отклонение структурно неверного payload до удаления активного слота.
  function onInvalidPayload() { invalidCount += 1; }

  const controller = autosaveControllerModule.createAutosaveController({
    storage,
    isEnabled,
    isStorageBlocked,
    buildPayload,
    validatePayload,
    applyPayload,
    getRuntimeState,
    onDebug,
    onWarning,
    onBeforeClear,
    onBeforeLoad,
    onInvalidPayload,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    debounceMs: 25
  });

  return {
    storage,
    timers,
    state,
    controller,
    debugEntries,
    warnings,
    applied,
    getBeforeClearCount() { return beforeClearCount; },
    getBeforeLoadCount() { return beforeLoadCount; },
    getInvalidCount() { return invalidCount; }
  };
}

// Проверяет debounce, замену старого таймера и построение снимка из последнего состояния.
test('контроллер откладывает запись и сохраняет последнее runtime-состояние', function() {
  const fixture = createControllerFixture();
  assert.equal(fixture.controller.schedule(), true);
  fixture.state.actionIndex = 2;
  assert.equal(fixture.controller.schedule(), true);
  assert.equal(fixture.timers.callbacks.size, 1);

  fixture.state.actionIndex = 3;
  fixture.timers.runPending();
  assert.equal(fixture.storage.writes.length, 1);
  assert.equal(JSON.parse(fixture.storage.writes[0]).actionIndex, 3);
  assert.equal(fixture.controller.getStatus().pending, false);
  assert.ok(fixture.debugEntries.some((entry) => entry.tag === 'debounce:fired'));
});

// Различает готовый checkpoint и снимок из callback, сохраняя прежний флаг usesPrebuilt в диагностике.
test('немедленная запись принимает готовый payload или строит новый', function() {
  const fixture = createControllerFixture();
  const checkpoint = { v: 3, sceneId: 'game', actionIndex: 7 };

  assert.equal(fixture.controller.flush(checkpoint), true);
  assert.equal(JSON.parse(fixture.storage.writes[0]).sceneId, 'game');
  assert.equal(fixture.controller.flush(), true);
  assert.equal(JSON.parse(fixture.storage.writes[1]).sceneId, 'start');

  const writtenEntries = fixture.debugEntries.filter((entry) => entry.tag === 'flush:written');
  assert.equal(writtenEntries[0].detail.usesPrebuilt, true);
  assert.equal(writtenEntries[1].detail.usesPrebuilt, false);
});

// Запрет автора отменяет ожидающую запись и исключает любые обращения к адаптеру, включая удаление при перезапуске.
test('отключённое автосохранение не обращается к Storage', function() {
  const fixture = createControllerFixture();
  const savedRaw = '{"existing":"preserve"}';
  fixture.storage.currentRaw = savedRaw;
  fixture.controller.schedule();
  fixture.state.enabled = false;

  for (const method of ['readCurrent', 'writeCurrent', 'removeCurrent', 'migrateLegacy']) {
    // Любое обращение к хранилищу запрещено, даже если операция не меняет содержимое слота.
    fixture.storage[method] = function rejectStorageOperation() {
      assert.fail(`Отключённое автосохранение вызвало ${method}`);
    };
  }

  assert.equal(fixture.controller.flushPending(), false);
  assert.equal(fixture.controller.schedule(), false);
  assert.equal(fixture.controller.flush({ v: 3, sceneId: 'start', actionIndex: 2 }), false);
  assert.equal(fixture.controller.loadAndApply(), false);
  assert.equal(fixture.controller.clear(), false);
  fixture.timers.runPending();
  assert.equal(fixture.timers.callbacks.size, 0);
  assert.equal(fixture.storage.currentRaw, savedRaw);
  assert.deepEqual(fixture.warnings, []);
});

// Не удаляет слот в заблокированном URL-режиме, но очищает связанное временное состояние координатора.
test('очистка соблюдает запрет Storage для scene и nosave', function() {
  const fixture = createControllerFixture();
  fixture.state.blocked = true;

  assert.equal(fixture.controller.clear(), false);
  assert.equal(fixture.storage.removals, 0);
  assert.equal(fixture.getBeforeClearCount(), 1);
  assert.ok(fixture.debugEntries.some((entry) => entry.tag === 'clear:skip'));
});

// Передаёт координатору только разобранный и проверенный payload активного слота.
test('загрузка проверяет payload до применения', function() {
  const fixture = createControllerFixture();
  fixture.storage.currentRaw = JSON.stringify({ v: 3, sceneId: 'start', actionIndex: 4 });

  assert.equal(fixture.controller.loadAndApply(), true);
  assert.equal(fixture.applied.length, 1);
  assert.equal(fixture.applied[0].data.actionIndex, 4);
  assert.equal(fixture.getBeforeLoadCount(), 1);
  assert.equal(fixture.storage.removals, 0);
});

// Удаляет только активный слот после повреждённого JSON или отклонённой структуры.
test('загрузка очищает повреждённый и недействительный payload', function() {
  const corruptFixture = createControllerFixture();
  corruptFixture.storage.currentRaw = '{broken-json';
  assert.equal(corruptFixture.controller.loadAndApply(), false);
  assert.equal(corruptFixture.storage.removals, 1);
  assert.ok(corruptFixture.debugEntries.some((entry) => entry.tag === 'restore:parse_failed'));

  const invalidFixture = createControllerFixture();
  invalidFixture.storage.currentRaw = JSON.stringify({ v: 2, sceneId: 'other' });
  assert.equal(invalidFixture.controller.loadAndApply(), false);
  assert.equal(invalidFixture.getInvalidCount(), 1);
  assert.equal(invalidFixture.storage.removals, 1);
});

// Использует безопасно мигрированную строку только при отсутствии текущего projectId-слота.
test('загрузка применяет результат legacy-миграции', function() {
  const fixture = createControllerFixture();
  const migratedRaw = JSON.stringify({ v: 3, sceneId: 'start', actionIndex: 5 });

  // Возвращает контракт проверки и преобразования, который storage-модуль применяет к legacy-payload.
  function createLegacyMigration() {
    return { validate() { return true; }, transform(data) { return data; } };
  }

  fixture.controller.dispose();
  const controller = autosaveControllerModule.createAutosaveController({
    storage: {
      ...fixture.storage,
      migrateLegacy() {
        return { status: 'migrated', legacyKey: 'legacy', targetKey: 'current', raw: migratedRaw, error: null };
      }
    },
    isEnabled() { return true; },
    isStorageBlocked() { return false; },
    buildPayload() { return null; },
    validatePayload(data) { return data.v === 3; },
    applyPayload(data) { fixture.applied.push({ data, raw: migratedRaw }); return true; },
    createLegacyMigration,
    setTimer: fixture.timers.setTimer,
    clearTimer: fixture.timers.clearTimer
  });

  assert.equal(controller.loadAndApply(), true);
  assert.equal(fixture.applied.at(-1).data.actionIndex, 5);
});

// Снимает ожидающую запись при lifecycle flush и окончательно запрещает операции после dispose.
test('lifecycle flush и dispose не оставляют таймеров', function() {
  const fixture = createControllerFixture();
  fixture.controller.schedule();
  assert.equal(fixture.controller.flushPending(), true);
  assert.equal(fixture.timers.callbacks.size, 0);
  assert.equal(fixture.storage.writes.length, 1);

  fixture.controller.schedule();
  fixture.controller.dispose();
  assert.deepEqual(fixture.controller.getStatus(), { disposed: true, pending: false, debounceMs: 25 });
  assert.equal(fixture.controller.schedule(), false);
  assert.equal(fixture.controller.flush(), false);
  assert.equal(fixture.controller.clear(), false);
  assert.equal(fixture.storage.removals, 0);
});

// Защищает порядок storage → controller → engine и удаление прежней ручной координации таймера из монолита.
test('runtime подключает autosave controller до engine.js и использует его lifecycle API', async function() {
  const [indexSource, engineSource] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../engine/engine.js', import.meta.url), 'utf8')
  ]);
  const storagePosition = indexSource.indexOf('engine/autosave-storage.js');
  const controllerPosition = indexSource.indexOf('engine/autosave-controller.js');
  const enginePosition = indexSource.indexOf('engine/engine.js');

  assert.ok(storagePosition >= 0);
  assert.ok(controllerPosition > storagePosition);
  assert.ok(enginePosition > controllerPosition);
  assert.ok(engineSource.includes('VN_AUTOSAVE_CONTROLLER.createAutosaveController'));
  assert.equal(engineSource.includes('var vnAutosaveTimer'), false);
  assert.equal(engineSource.includes('function scheduleAutosave('), false);
  assert.equal(engineSource.includes('function flushAutosaveToStorageSync('), false);
  assert.equal(engineSource.includes('function clearAutosaveStorage('), false);
});
