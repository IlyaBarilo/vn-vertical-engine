import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadStoryFixture,
  runStoryLoader
} from './helpers/run-story-loader.mjs';

// Проверяет положительный путь: существующий goto не должен создавать ошибок ссылок.
test('существующий переход goto проходит проверку', async function() {
  const storyText = [
    '[meta]',
    'title = "Корректный переход"',
    'startScene = intro',
    '',
    '[scene]',
    'scene intro',
    'goto ending',
    '',
    'scene ending',
    '"Конец"'
  ].join('\n');
  const result = await runStoryLoader(storyText);

  assert.equal(result.errors.length, 0);
  assert.ok(result.story);
  assert.equal(result.story.scenes[0].actions[0].target, 'ending');
});

// Фиксирует ошибку перехода на отсутствующую сцену, которую движок показывает в статистике.
test('отсутствующая цель goto создаёт ошибку', async function() {
  const storyText = await loadStoryFixture('missing-transition.story.txt');
  const result = await runStoryLoader(storyText, { sourceName: 'missing-transition.story.txt' });

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('non-existent scene "missingScene"');
  }));
});

// Проверяет, что валидатор обходит переходы внутри нового блока choice.
test('переход внутри choice проверяется рекурсивно', async function() {
  const storyText = [
    '[meta]',
    'title = "Вложенный переход"',
    'startScene = intro',
    '',
    '[scene]',
    'scene intro',
    'menu',
    'choice "Продолжить"',
    'goto missingChoiceTarget',
    'end'
  ].join('\n');
  const result = await runStoryLoader(storyText);

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('non-existent scene "missingChoiceTarget"');
  }));
});
