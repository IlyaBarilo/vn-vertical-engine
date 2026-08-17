import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const autosaveStorageModule = require('../../engine/autosave-storage.js');

// Имитирует Web Storage и сохраняет наблюдаемую карту слотов без зависимости от браузера.
function createMemoryStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

// Создаёт контроллер с изменяемым контекстом, чтобы имитировать позднюю загрузку STORY и URL-режима.
function createStorageFixture(initialValues = {}) {
  const storage = createMemoryStorage(initialValues);
  const context = { projectId: '', novelId: '' };

  // Возвращает тестовое хранилище только в момент операции контроллера.
  function getStorage() { return storage; }

  // Читает актуальный projectId после возможной смены синтетической истории.
  function getProjectId() { return context.projectId; }

  // Читает актуальный novelId после возможной смены URL-режима.
  function getNovelId() { return context.novelId; }

  const controller = autosaveStorageModule.createAutosaveStorage({
    getStorage,
    getProjectId,
    getNovelId
  });
  return { storage, context, controller };
}

// Принимает только ожидаемый legacy-payload и не меняет его во время проверки.
function validateLegacyPayload(data) {
  return Boolean(data && data.v === 3 && data.sceneId === 'start');
}

// Добавляет принадлежность новому проекту, сохраняя остальные данные мигрируемого payload.
function attachProjectId(data, context) {
  data.projectId = context.projectId;
  return data;
}

// Фиксирует точную схему общих, projectId- и novel-ключей с нормализацией регистра и пробелов.
test('строитель ключей сохраняет legacy-схему и изолирует projectId/novel-слоты', function() {
  const baseKey = autosaveStorageModule.DEFAULT_STORAGE_KEY;

  assert.equal(autosaveStorageModule.buildLegacyStorageKey(baseKey, ''), 'vn_engine_autosave_v1');
  assert.equal(
    autosaveStorageModule.buildLegacyStorageKey(baseKey, ' Intro Scene '),
    'vn_engine_autosave_v1:novel:intro%20scene'
  );
  assert.equal(
    autosaveStorageModule.buildStorageKey(baseKey, ' Museum Demo ', ''),
    'vn_engine_autosave_v1:project:museum%20demo'
  );
  assert.equal(
    autosaveStorageModule.buildStorageKey(baseKey, 'Museum Demo', ' Intro '),
    'vn_engine_autosave_v1:project:museum%20demo:novel:intro'
  );
});

// Проверяет позднее переключение контекста без пересоздания контроллера после загрузки другой истории.
test('контроллер вычисляет активный ключ на момент каждой операции', function() {
  const fixture = createStorageFixture();
  assert.equal(fixture.controller.getCurrentKey(), 'vn_engine_autosave_v1');

  fixture.context.projectId = 'Project-A';
  assert.equal(fixture.controller.getCurrentKey(), 'vn_engine_autosave_v1:project:project-a');

  fixture.context.novelId = 'Chapter-1';
  assert.equal(
    fixture.controller.getCurrentKey(),
    'vn_engine_autosave_v1:project:project-a:novel:chapter-1'
  );
});

// Проверяет чтение, запись и удаление только активного слота без затрагивания соседнего проекта.
test('операции контроллера изолируют текущий слот', function() {
  const fixture = createStorageFixture({
    'vn_engine_autosave_v1:project:other': '{"other":true}'
  });
  fixture.context.projectId = 'current';

  const writeResult = fixture.controller.writeCurrent('{"sceneId":"start"}');
  assert.equal(writeResult.ok, true);
  assert.equal(writeResult.key, 'vn_engine_autosave_v1:project:current');
  assert.equal(fixture.controller.readCurrent().raw, '{"sceneId":"start"}');

  const removeResult = fixture.controller.removeCurrent();
  assert.equal(removeResult.ok, true);
  assert.equal(fixture.controller.readCurrent().raw, null);
  assert.equal(fixture.storage.getItem('vn_engine_autosave_v1:project:other'), '{"other":true}');
});

// Превращает недоступный Storage API в результат ошибки, не выбрасывая исключение в runtime.
test('операции контроллера безопасно возвращают ошибки хранилища', function() {
  // Имитирует запрет localStorage браузером только при фактическом обращении.
  function getBlockedStorage() {
    throw new Error('storage blocked');
  }

  const controller = autosaveStorageModule.createAutosaveStorage({ getStorage: getBlockedStorage });
  assert.equal(controller.readCurrent().ok, false);
  assert.match(controller.writeCurrent('{}').error.message, /storage blocked/);
  assert.match(controller.removeCurrent().error.message, /storage blocked/);
});

// Копирует одобренный legacy-payload в projectId-слот и намеренно сохраняет исходную запись.
test('миграция копирует подходящий legacy-слот без удаления оригинала', function() {
  const legacyRaw = JSON.stringify({ v: 3, sceneId: 'start' });
  const fixture = createStorageFixture({ vn_engine_autosave_v1: legacyRaw });
  fixture.context.projectId = 'Migrated Project';

  const result = fixture.controller.migrateLegacy({
    validate: validateLegacyPayload,
    transform: attachProjectId
  });

  assert.equal(result.status, 'migrated');
  assert.equal(result.targetKey, 'vn_engine_autosave_v1:project:migrated%20project');
  assert.equal(fixture.storage.getItem('vn_engine_autosave_v1'), legacyRaw);
  assert.deepEqual(JSON.parse(fixture.storage.getItem(result.targetKey)), {
    v: 3,
    sceneId: 'start',
    projectId: 'migrated project'
  });
});

// Оставляет повреждённый и отклонённый legacy-слот без изменений и не создаёт целевой слот.
test('миграция не изменяет повреждённые или чужие legacy-данные', function() {
  const corruptFixture = createStorageFixture({ vn_engine_autosave_v1: '{broken-json' });
  corruptFixture.context.projectId = 'current';
  const corruptResult = corruptFixture.controller.migrateLegacy({ validate: validateLegacyPayload });
  assert.equal(corruptResult.status, 'parse-error');
  assert.equal(corruptFixture.storage.getItem('vn_engine_autosave_v1'), '{broken-json');
  assert.equal(corruptFixture.storage.getItem(corruptResult.targetKey), null);

  const foreignRaw = JSON.stringify({ v: 2, sceneId: 'foreign' });
  const foreignFixture = createStorageFixture({ vn_engine_autosave_v1: foreignRaw });
  foreignFixture.context.projectId = 'current';
  const foreignResult = foreignFixture.controller.migrateLegacy({ validate: validateLegacyPayload });
  assert.equal(foreignResult.status, 'rejected');
  assert.equal(foreignFixture.storage.getItem('vn_engine_autosave_v1'), foreignRaw);
  assert.equal(foreignFixture.storage.getItem(foreignResult.targetKey), null);
});

// Защищает подключение storage-модуля до engine.js и отсутствие прямых операций localStorage в autosave-коде движка.
test('runtime подключает autosave storage до engine.js и использует его API', async function() {
  const [indexSource, engineSource] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../engine/engine.js', import.meta.url), 'utf8')
  ]);
  const storagePosition = indexSource.indexOf('engine/autosave-storage.js');
  const enginePosition = indexSource.indexOf('engine/engine.js');

  assert.ok(storagePosition >= 0);
  assert.ok(enginePosition > storagePosition);
  assert.ok(engineSource.includes('VN_AUTOSAVE_STORAGE.createAutosaveStorage'));
  assert.equal(engineSource.includes('localStorage.getItem(getAutosaveStorageKey())'), false);
  assert.equal(engineSource.includes('localStorage.setItem(storageKey, JSON.stringify(payload))'), false);
  assert.equal(engineSource.includes('localStorage.removeItem(storageKey)'), false);
});
