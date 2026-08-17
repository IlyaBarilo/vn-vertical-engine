import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const autosavePayload = require('../../engine/autosave-payload.js');

// Возвращает длину единственной синтетической сцены для изолированной проверки индекса.
function getStartSceneActionCount(sceneId) {
  return sceneId === 'start' ? 3 : -1;
}

// Собирает действующий payload и контекст, чтобы отдельные тесты меняли только проверяемое правило.
function createValidFixture() {
  const storyText = '[meta]\r\nprojectId = demo\r\n[scene start]\r\ntext = Тест\r\n';
  const fingerprint = autosavePayload.computeTextFingerprint(storyText);
  return {
    data: {
      v: autosavePayload.PAYLOAD_VERSION,
      projectId: 'demo',
      novelId: 'intro',
      hashHex: fingerprint.hashHex,
      textLength: fingerprint.textLength,
      sceneId: 'start',
      actionIndex: 2
    },
    options: {
      projectId: 'demo',
      novelId: 'intro',
      currentFingerprint: fingerprint,
      loadsafe: true,
      getSceneActionCount: getStartSceneActionCount
    }
  };
}

// Фиксирует прежний djb2-подобный fingerprint, используемый уже созданными сохранениями.
test('fingerprint сохраняет действующий формат hashHex и длину текста', function() {
  assert.deepEqual(autosavePayload.computeTextFingerprint('abc'), {
    hashUnsigned: 193485963,
    hashHex: 'b885c8b',
    textLength: 3
  });
  assert.deepEqual(autosavePayload.computeTextFingerprint(null), {
    hashUnsigned: 5381,
    hashHex: '1505',
    textLength: 0
  });
});

// Удаляет только projectId из [meta], сохраняя CRLF и одноимённые строки других секций.
test('legacy-fingerprint восстанавливает текст до добавления projectId', function() {
  const legacyText = '[meta]\r\ntitle = Demo\r\n[scene projectId]\r\ntext = keep\r\n';
  const currentText = '[meta]\r\ntitle = Demo\r\nprojectId = demo\r\n[scene projectId]\r\ntext = keep\r\n';

  assert.deepEqual(
    autosavePayload.computeLegacyProjectFingerprint(currentText),
    autosavePayload.computeTextFingerprint(legacyText)
  );
  assert.equal(autosavePayload.computeLegacyProjectFingerprint(legacyText), null);
});

// Снимает только мёртвую nextLocked-комбинацию и сохраняет допустимые флаги ожидания.
test('нормализация interaction-флагов учитывает позицию внутри сцены', function() {
  assert.deepEqual(autosavePayload.normalizeInteractionFlags(3, 1, false, true), {
    waitingNext: false,
    nextLocked: false
  });
  assert.deepEqual(autosavePayload.normalizeInteractionFlags(3, 1, true, true), {
    waitingNext: true,
    nextLocked: true
  });
  assert.deepEqual(autosavePayload.normalizeInteractionFlags(3, 3, false, true), {
    waitingNext: false,
    nextLocked: true
  });
});

// Принимает payload только при совпадении версии, проекта, novel-слота, fingerprint, сцены и индекса.
test('валидатор принимает полностью совместимый payload', function() {
  const fixture = createValidFixture();
  assert.deepEqual(autosavePayload.validatePayload(fixture.data, fixture.options), {
    valid: true,
    reason: '',
    fingerprintSkipped: false
  });
});

// Различает несовместимость проекта и novel-слота до любых проверок состояния сцены.
test('валидатор отклоняет чужой projectId и novelId', function() {
  const projectFixture = createValidFixture();
  projectFixture.data.projectId = 'other';
  assert.equal(autosavePayload.validatePayload(projectFixture.data, projectFixture.options).reason, 'project');

  const novelFixture = createValidFixture();
  novelFixture.data.novelId = 'other';
  assert.equal(autosavePayload.validatePayload(novelFixture.data, novelFixture.options).reason, 'novel');
});

// Разрешает legacy-слоту отсутствие projectId только с отдельным fingerprint прежнего текста.
test('валидатор поддерживает безопасную projectId-миграцию', function() {
  const fixture = createValidFixture();
  delete fixture.data.projectId;
  fixture.options.allowMissingProjectId = true;
  fixture.options.requiredFingerprint = fixture.options.currentFingerprint;

  assert.equal(autosavePayload.validatePayload(fixture.data, fixture.options).valid, true);
  fixture.data.projectId = 'foreign';
  assert.equal(autosavePayload.validatePayload(fixture.data, fixture.options).reason, 'project');
});

// loadsafe=false пропускает только fingerprint, сохраняя проверку версии, сцены, индекса и устаревших полей.
test('валидатор ограничивает послабление loadsafe=false', function() {
  const fixture = createValidFixture();
  fixture.options.loadsafe = false;
  fixture.data.hashHex = 'changed';
  fixture.data.textLength = 999;
  const accepted = autosavePayload.validatePayload(fixture.data, fixture.options);
  assert.equal(accepted.valid, true);
  assert.equal(accepted.fingerprintSkipped, true);

  fixture.data.bgScroll = { focus: 0.5 };
  assert.equal(autosavePayload.validatePayload(fixture.data, fixture.options).reason, 'legacy-bg-scroll-focus');
  delete fixture.data.bgScroll;
  fixture.data.actionIndex = 4;
  assert.equal(autosavePayload.validatePayload(fixture.data, fixture.options).reason, 'action-index');
});

// Защищает загрузку payload-модуля до controller/engine и использование единственного источника версии формата.
test('runtime подключает autosave payload до controller и engine.js', async function() {
  const [indexSource, engineSource, controllerSource] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../engine/engine.js', import.meta.url), 'utf8'),
    readFile(new URL('../../engine/autosave-controller.js', import.meta.url), 'utf8')
  ]);
  const payloadPosition = indexSource.indexOf('engine/autosave-payload.js');
  const controllerPosition = indexSource.indexOf('engine/autosave-controller.js');
  const enginePosition = indexSource.indexOf('engine/engine.js');

  assert.ok(payloadPosition >= 0);
  assert.ok(controllerPosition > payloadPosition);
  assert.ok(enginePosition > controllerPosition);
  assert.ok(engineSource.includes('VN_AUTOSAVE_PAYLOAD.PAYLOAD_VERSION'));
  assert.equal(controllerSource.includes('var AUTOSAVE_PAYLOAD_VERSION'), false);
});
