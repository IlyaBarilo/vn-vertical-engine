import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const indexUrl = new URL('../../index.html', import.meta.url);

// Имитирует функцию публичного API без собственной логики, чтобы тестировать только проверку контракта.
function runtimeMethodStub() {}

// Извлекает чистые функции bootstrap-контрактов из настоящего index.html, чтобы тест не дублировал их реализацию.
async function loadBootstrapContractApi(windowObject) {
  const indexSource = await readFile(indexUrl, 'utf8');
  const start = indexSource.indexOf('      function createBootstrapError');
  const end = indexSource.indexOf('      function loadScript', start);

  assert.ok(start >= 0 && end > start, 'Не удалось извлечь функции проверки runtime-контрактов.');

  const context = vm.createContext({ window: windowObject });
  const source = [
    indexSource.slice(start, end),
    'this.bootstrapApi = {',
    '  createBootstrapError: createBootstrapError,',
    '  readRuntimeContractValue: readRuntimeContractValue,',
    '  validateRuntimeContract: validateRuntimeContract',
    '};'
  ].join('\n');

  vm.runInContext(source, context, { filename: 'index-bootstrap-contracts.js' });
  return context.bootstrapApi;
}

// Принимает модуль, если все перечисленные экспорты существуют и имеют ожидаемые типы.
test('bootstrap принимает корректный API обязательного runtime-модуля', async function() {
  const api = await loadBootstrapContractApi({
    VN_STORY_ANALYSIS: {
      extractAliasId: runtimeMethodStub,
      computeStoryStats: runtimeMethodStub
    },
    VN_ENGINE_READY: true,
    STORY: {}
  });

  assert.doesNotThrow(function validateCompleteModule() {
    api.validateRuntimeContract('engine/story-analysis.js', [
      'VN_STORY_ANALYSIS.extractAliasId:function',
      'VN_STORY_ANALYSIS.computeStoryStats:function',
      'VN_ENGINE_READY:true',
      'STORY:object'
    ]);
  });
});

// Отклоняет полученный файл без ожидаемого экспорта и сохраняет категорию и имя повреждённого модуля.
test('bootstrap отклоняет runtime-файл без ожидаемого API', async function() {
  const api = await loadBootstrapContractApi({ VN_STORY_ANALYSIS: {} });
  let failure = null;

  try {
    api.validateRuntimeContract('engine/story-analysis.js', [
      'VN_STORY_ANALYSIS.extractAliasId:function'
    ]);
  } catch (error) {
    failure = error;
  }

  assert.ok(failure);
  assert.equal(failure.bootstrapCategory, 'runtime');
  assert.equal(failure.bootstrapSource, 'engine/story-analysis.js');
  assert.match(failure.message, /не предоставил ожидаемый API VN_STORY_ANALYSIS\.extractAliasId/);
});

// Не позволяет контракту обходить window через прототипные сегменты вычисляемого пути.
test('bootstrap блокирует прототипные пути runtime-контракта', async function() {
  const api = await loadBootstrapContractApi({});

  assert.equal(api.readRuntimeContractValue('__proto__.polluted'), undefined);
  assert.equal(api.readRuntimeContractValue('constructor.prototype'), undefined);
});

// Сохраняет отдельную категорию сценария, чтобы пользовательское сообщение не называло его ошибкой движка.
test('bootstrap отличает ошибку сценария от ошибки runtime', async function() {
  const api = await loadBootstrapContractApi({});
  const error = api.createBootstrapError('story', 'story.js', 'Некорректные данные сценария.');

  assert.equal(error.bootstrapCategory, 'story');
  assert.equal(error.bootstrapSource, 'story.js');
  assert.match(error.message, /Некорректные данные сценария/);
});
