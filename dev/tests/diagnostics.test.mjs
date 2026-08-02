import assert from 'node:assert/strict';
import test from 'node:test';

import { runStoryLoader } from './helpers/run-story-loader.mjs';

// Собирает минимальный синтетический сценарий с заданными командами стартовой сцены.
function createDiagnosticStory(sceneLines) {
  return [
    '[meta]',
    'title = "Тест диагностики"',
    'startScene = intro',
    '',
    '[scene]',
    'scene intro',
    ...sceneLines
  ].join('\n');
}

// Проверяет состав ошибки, который используется статистикой и тестовым выводом.
test('ошибка парсера содержит строку, номер и признак критичности', async function() {
  const result = await runStoryLoader(createDiagnosticStory([
    'unknown command'
  ]), { sourceName: 'diagnostic.story.txt' });
  const error = result.errors.find(function(item) {
    return item.message === 'Unrecognized string format';
  });

  assert.equal(result.story, null);
  assert.ok(error);
  assert.equal(error.lineNumber, 7);
  assert.equal(error.line, 'unknown command');
  assert.equal(error.isCritical, true);
});

// Проверяет ошибку неожиданного end вне блочной конструкции.
test('end без открытого блока создаёт ошибку', async function() {
  const result = await runStoryLoader(createDiagnosticStory(['end']));

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('Unexpected "end" without opened block');
  }));
});

// Проверяет ошибки управляющих слов вне подходящего блока.
test('else, elif и choice вне блока создают ошибки', async function(t) {
  const cases = [
    ['else', 'Unexpected "else" without opened if-block'],
    ['elif score > 0', 'Unexpected "elif" without opened if-block'],
    ['choice "Путь"', '"choice" can be used only inside "menu" block']
  ];

  for (const testCase of cases) {
    await t.test(testCase[0], async function() {
      const result = await runStoryLoader(createDiagnosticStory([testCase[0]]));

      assert.equal(result.story, null);
      assert.ok(result.errors.some(function(error) {
        return error.message.includes(testCase[1]);
      }));
    });
  }
});

// Проверяет ограничения идентификаторов сцен и целей переходов.
test('пробелы в идентификаторах сцен и переходов создают ошибки', async function(t) {
  await t.test('идентификатор сцены', async function() {
    const storyText = [
      '[meta]',
      'startScene = bad scene',
      '',
      '[scene]',
      'scene bad scene',
      '"Текст"'
    ].join('\n');
    const result = await runStoryLoader(storyText);

    assert.equal(result.story, null);
    assert.ok(result.errors.some(function(error) {
      return error.message.includes('contains spaces. Scene IDs cannot contain spaces');
    }));
  });

  await t.test('цель goto', async function() {
    const result = await runStoryLoader(createDiagnosticStory([
      'goto bad target'
    ]));

    assert.equal(result.story, null);
    assert.ok(result.errors.some(function(error) {
      return error.message.includes('The target scene "bad target" contains spaces');
    }));
  });
});

// Проверяет, что inline-комментарий удаляется, а решётка внутри реплики сохраняется.
test('комментарии не повреждают текст внутри кавычек', async function() {
  const result = await runStoryLoader(createDiagnosticStory([
    '"Цвет #0F0" # комментарий'
  ]));

  assert.equal(result.errors.length, 0);
  assert.ok(result.story);
  assert.equal(result.story.scenes[0].actions[0].text, 'Цвет #0F0');
});
