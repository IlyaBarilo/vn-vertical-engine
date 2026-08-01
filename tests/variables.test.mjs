import assert from 'node:assert/strict';
import test from 'node:test';

import { runStoryLoader } from './helpers/run-story-loader.mjs';

// Собирает минимальный синтетический сценарий с отдельными объявлениями переменных и командами сцены.
function createVariablesStory(variableLines, sceneActions = ['"Текст"']) {
  return [
    '[meta]',
    'title = "Тест переменных"',
    'lang = ru',
    'startScene = intro',
    '',
    '[var]',
    ...variableLines,
    '',
    '[scene]',
    'scene intro',
    ...sceneActions
  ].join('\n');
}

// Проверяет преобразование основных типов значений из синтетической секции [var].
test('парсер сохраняет основные типы переменных', async function() {
  const storyText = createVariablesStory([
    'score = 12.5',
    'enabled = true',
    'finished = false',
    'playerName = "Анна"',
    "location = 'Лаборатория'",
    'legacyText = текст без кавычек'
  ]);
  const result = await runStoryLoader(storyText);

  assert.equal(result.errors.length, 0);
  assert.ok(result.story);
  assert.equal(result.story.vars.score, 12.5);
  assert.equal(result.story.vars.enabled, true);
  assert.equal(result.story.vars.finished, false);
  assert.equal(result.story.vars.playerName, 'Анна');
  assert.equal(result.story.vars.location, 'Лаборатория');
  assert.equal(result.story.vars.legacyText, 'текст без кавычек');
});

// Проверяет допустимую арифметику, сравнения, скобки и логические операторы в set и if.
test('парсер принимает безопасные выражения set и if', async function() {
  const storyText = createVariablesStory([
    'score = 4',
    'bonus = 3',
    'enabled = true'
  ], [
    'set score = (score + bonus) * 2 - 1',
    'if enabled && score >= 5 -> ending',
    '',
    'scene ending',
    '"Конец"'
  ]);
  const result = await runStoryLoader(storyText);

  assert.equal(result.errors.length, 0);
  assert.ok(result.story);
  assert.equal(result.story.scenes[0].actions[0].type, 'set');
  assert.equal(result.story.scenes[0].actions[0].expression, 'score = (score + bonus) * 2 - 1');
  assert.equal(result.story.scenes[0].actions[1].type, 'if_expr');
  assert.equal(result.story.scenes[0].actions[1].condition, 'enabled && score >= 5');
});

// Защищает системное имя engine от объявления пользовательской переменной.
test('системное имя engine нельзя объявить в var', async function() {
  const result = await runStoryLoader(createVariablesStory(['engine = 1']));

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('reserved for system engine.* parameters');
  }));
});

// Защищает объектные служебные ключи от использования как имён переменных.
test('небезопасные прототипные имена переменных отклоняются', async function() {
  const result = await runStoryLoader(createVariablesStory(['constructor = 1']));

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('Unsafe variable in [var] name "constructor"');
  }));
});

// Проверяет общие правила имён и обязательность значения в секции [var].
test('секция var отклоняет некорректные имена и пустые значения', async function(t) {
  const cases = [
    ['цифра в начале', ['1score = 1'], 'Invalid variable in [var] name "1score"'],
    ['кириллица', ['счёт = 1'], 'Invalid variable in [var] name "счёт"'],
    ['дефис', ['game-score = 1'], 'Invalid variable in [var] name "game-score"'],
    ['пустое имя', ['= 1'], 'variable name in [var] cannot be empty'],
    ['пустое значение', ['score ='], 'value of the variable in [var] cannot be empty']
  ];

  for (const testCase of cases) {
    await t.test(testCase[0], async function() {
      const result = await runStoryLoader(createVariablesStory(testCase[1]));

      assert.equal(result.story, null);
      assert.ok(result.errors.some(function(error) {
        return error.message.includes(testCase[2]);
      }));
    });
  }
});

// Проверяет запрет доступа к глобальным объектам из выражения сценария.
test('выражение не получает доступ к globalThis', async function() {
  const result = await runStoryLoader(createVariablesStory([
    'score = 1'
  ], [
    'set score = globalThis'
  ]));

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('Global object "globalThis" is not allowed');
  }));
});

// Проверяет запрет вызовов функций и обращения к свойствам в безопасном языке выражений.
test('выражение отклоняет вызовы функций и доступ к свойствам', async function(t) {
  await t.test('вызов функции', async function() {
    const result = await runStoryLoader(createVariablesStory([
      'score = 1'
    ], [
      'set score = alert(1)'
    ]));

    assert.equal(result.story, null);
    assert.ok(result.errors.some(function(error) {
      return error.message.includes('Invalid set expression');
    }));
  });

  await t.test('доступ к свойству', async function() {
    const result = await runStoryLoader(createVariablesStory([
      'score = 1'
    ], [
      'set score = score.constructor'
    ]));

    assert.equal(result.story, null);
    assert.ok(result.errors.some(function(error) {
      return error.message.includes('Unsupported symbol "."');
    }));
  });
});

// Проверяет ошибки незавершённых строк и скобок в выражениях сценария.
test('выражение отклоняет незавершённые литералы и скобки', async function(t) {
  const cases = [
    ['строка', 'set score = "текст', 'Unclosed string literal'],
    ['скобка', 'set score = (score + 1', 'Unexpected token eof:']
  ];

  for (const testCase of cases) {
    await t.test(testCase[0], async function() {
      const result = await runStoryLoader(createVariablesStory([
        'score = 1'
      ], [
        testCase[1]
      ]));

      assert.equal(result.story, null);
      assert.ok(result.errors.some(function(error) {
        return error.message.includes(testCase[2]);
      }));
    });
  }
});
