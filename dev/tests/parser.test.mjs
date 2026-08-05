import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadStoryFixture,
  loadStoryTextFromScript,
  runStoryLoader
} from './helpers/run-story-loader.mjs';

// Собирает минимальный корректный сценарий для изолированной проверки одного meta-заголовка.
function createMinimalStory(titleLine) {
  return [
    '[meta]',
    titleLine,
    'startScene = intro',
    'lang = ru',
    '',
    '[scene]',
    'scene intro',
    '"Текст"'
  ].join('\n');
}

// Подтверждает, что версия грамматики принадлежит парсеру и не требует поля внутри пользовательского сценария.
test('парсер сообщает версию DSL без метаданных story.js', async function() {
  const result = await runStoryLoader(createMinimalStory('title = "Моя история"'));

  assert.equal(result.errors.length, 0);
  assert.equal(result.dslVersion, 1);
  assert.equal(Object.hasOwn(result.story.meta, 'dslVersion'), false);
});

// Фиксирует рекомендуемый формат title и защищает удаление внешних двойных кавычек от регрессии.
test('парсер убирает двойные кавычки вокруг title', async function() {
  const result = await runStoryLoader(createMinimalStory('title = "Моя история"'));

  assert.equal(result.errors.length, 0);
  assert.ok(result.story);
  assert.equal(result.story.meta.title, 'Моя история');
});

// Сохраняет поддержку старых новелл, где строковый title записан без кавычек.
test('парсер сохраняет title без кавычек', async function() {
  const result = await runStoryLoader(createMinimalStory('title = Моя старая история'));

  assert.equal(result.errors.length, 0);
  assert.ok(result.story);
  assert.equal(result.story.meta.title, 'Моя старая история');
});

// Проверяет дополнительный допустимый вариант с парными одинарными кавычками.
test('парсер убирает одинарные кавычки вокруг title', async function() {
  const result = await runStoryLoader(createMinimalStory("title = 'Моя история'"));

  assert.equal(result.errors.length, 0);
  assert.ok(result.story);
  assert.equal(result.story.meta.title, 'Моя история');
});

// Защищает совместимость устаревших секций и старого формата menu со стрелками.
test('парсер принимает legacy-сценарий', async function() {
  const storyText = await loadStoryFixture('legacy.story.txt');
  const result = await runStoryLoader(storyText, { sourceName: 'legacy.story.txt' });

  assert.equal(result.errors.length, 0);
  assert.ok(result.story);
  assert.equal(result.story.meta.title, 'Старая история');
  assert.equal(result.story.scenes.length, 2);
  assert.equal(result.story.scenes[0].actions[1].choices[0].goto, 'ending');
});

// Разбирает реальный демонстрационный сценарий, чтобы изменения грамматики не ломали поставляемый пример.
test('story-example.js проходит полный разбор', async function() {
  const storyText = await loadStoryTextFromScript('story-example.js');
  const result = await runStoryLoader(storyText, { sourceName: 'story-example.js' });

  assert.equal(result.errors.length, 0);
  assert.ok(result.story);
  assert.equal(result.story.meta.title, 'Вуз: демо-новелла с выбором');
  assert.equal(result.story.meta.engine.gameSandbox, 'strict');
  assert.ok(result.story.scenes.length > 0);
});
