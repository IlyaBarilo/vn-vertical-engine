import assert from 'node:assert/strict';
import test from 'node:test';

import { runStoryLoader } from './helpers/run-story-loader.mjs';

// Собирает минимальный синтетический сценарий для проверки ветвлений и меню.
function createBranchingStory(introActions, additionalScenes = []) {
  return [
    '[meta]',
    'title = "Тест ветвлений"',
    'lang = ru',
    'startScene = intro',
    '',
    '[var]',
    'score = 10',
    '',
    '[scene]',
    'scene intro',
    ...introActions,
    ...additionalScenes
  ].join('\n');
}

// Проверяет структуру корректного блока if с ветками elif и else.
test('парсер собирает if, elif и else в единый блок', async function() {
  const storyText = createBranchingStory([
    'if score >= 10',
    'goto high',
    'elif score >= 5',
    'goto middle',
    'else',
    'goto low',
    'end'
  ], [
    '',
    'scene high',
    '"Высокий результат"',
    '',
    'scene middle',
    '"Средний результат"',
    '',
    'scene low',
    '"Низкий результат"'
  ]);
  const result = await runStoryLoader(storyText);

  assert.equal(result.errors.length, 0);
  assert.ok(result.story);

  const condition = result.story.scenes[0].actions[0];
  assert.equal(condition.type, 'if_block');
  assert.equal(condition.branches.length, 2);
  assert.equal(condition.branches[0].condition, 'score >= 10');
  assert.equal(condition.branches[0].actions[0].target, 'high');
  assert.equal(condition.branches[1].condition, 'score >= 5');
  assert.equal(condition.branches[1].actions[0].target, 'middle');
  assert.equal(condition.elseActions[0].target, 'low');
});

// Проверяет рекурсивный обход перехода из if-блока, вложенного в новый choice.
test('переход внутри if и choice проверяется рекурсивно', async function() {
  const storyText = createBranchingStory([
    'menu',
    'choice "Проверить результат"',
    'if score > 0',
    'goto missingNestedTarget',
    'else',
    'goto fallback',
    'end',
    'end'
  ], [
    '',
    'scene fallback',
    '"Запасной путь"'
  ]);
  const result = await runStoryLoader(storyText);

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('non-existent scene "missingNestedTarget"');
  }));
});

// Фиксирует понятную ошибку при отсутствии end у блочного условия.
test('незакрытый if создаёт ошибку', async function() {
  const storyText = createBranchingStory([
    'if score > 0',
    '"Ветка без завершения"'
  ]);
  const result = await runStoryLoader(storyText);

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('Unclosed conditional block');
  }));
});

// Запрещает elif после уже открытой ветки else в том же условии.
test('elif после else создаёт ошибку', async function() {
  const storyText = createBranchingStory([
    'if score > 0',
    '"Положительное значение"',
    'else',
    '"Остальные значения"',
    'elif score == 0',
    '"Ноль"',
    'end'
  ]);
  const result = await runStoryLoader(storyText);

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('"elif" cannot be used after "else"');
  }));
});

// Защищает запрет смешивать старые пункты со стрелкой и новый синтаксис choice в одном menu.
test('смешение старого и нового формата menu создаёт ошибку', async function() {
  const storyText = createBranchingStory([
    'menu',
    '"Старый вариант" -> oldTarget',
    'choice "Новый вариант" -> newTarget',
    'end'
  ]);
  const result = await runStoryLoader(storyText);

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('Mixed menu formats');
  }));
});
