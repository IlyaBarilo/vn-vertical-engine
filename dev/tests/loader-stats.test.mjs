import assert from 'node:assert/strict';
import test from 'node:test';

import { runStoryLoader } from './helpers/run-story-loader.mjs';

// Проверяет счётчики, которые загрузчик передаёт встроенной статистике после успешного разбора.
test('загрузчик считает сцены, действия и объявления ресурсов', async function() {
  const storyText = [
    '[meta]',
    'title = "Тест статистики"',
    'startScene = intro',
    '',
    '[bg]',
    'hall file=assets/synthetic/bg/hall.jpg',
    'room file=assets/synthetic/bg/room.jpg',
    '',
    '[char]',
    'anna file=assets/synthetic/char/anna.png',
    '',
    '[audio]',
    'theme file=assets/synthetic/audio/theme.ogg',
    '',
    '[video]',
    'clip file=assets/synthetic/video/clip.mp4',
    '',
    '[game]',
    'puzzle file=assets/synthetic/game/puzzle.html',
    '',
    '[scene]',
    'scene intro',
    'bg hall',
    '"Начало"',
    'goto ending',
    '',
    'scene ending',
    '"Конец"'
  ].join('\n');
  const result = await runStoryLoader(storyText);

  assert.equal(result.errors.length, 0);
  assert.equal(result.stats.scenesCount, 2);
  assert.equal(result.stats.actionsCount, 4);
  assert.equal(result.stats.backgroundsCount, 2);
  assert.equal(result.stats.charactersCount, 1);
  assert.equal(result.stats.audioCount, 1);
  assert.equal(result.stats.videosCount, 1);
  assert.equal(result.stats.gamesCount, 1);
});

// Проверяет, что незавершённый разбор не публикует частичные счётчики как успешную статистику.
test('при ошибке парсинга итоговые счётчики остаются нулевыми', async function() {
  const storyText = [
    '[meta]',
    'startScene = intro',
    '',
    '[scene]',
    'scene intro',
    'unknown command'
  ].join('\n');
  const result = await runStoryLoader(storyText);

  assert.equal(result.story, null);
  assert.ok(result.errors.length > 0);
  assert.equal(result.stats.scenesCount, 0);
  assert.equal(result.stats.actionsCount, 0);
});
