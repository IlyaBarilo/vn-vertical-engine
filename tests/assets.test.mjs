import assert from 'node:assert/strict';
import test from 'node:test';

import { runStoryLoader } from './helpers/run-story-loader.mjs';

// Собирает минимальный синтетический сценарий вокруг проверяемых секций и команд.
function createSyntheticStory(lines) {
  return [
    '[meta]',
    'title = "Тест ассетов"',
    'lang = ru',
    'startScene = intro',
    '',
    ...lines
  ].join('\n');
}

// Проверяет структуру реестра на вымышленных путях без чтения файлов демо-новеллы.
test('парсер регистрирует синтетические ассеты всех типов', async function() {
  const storyText = createSyntheticStory([
    '[bg]',
    'hall file=synthetic/backgrounds/hall.jpg',
    'sphere file=synthetic/360/sphere-360.js 360 quality=mobile',
    '',
    '[char]',
    'anna emotion=calm file=synthetic/characters/anna.png name="Анна" color=#0F0',
    '',
    '[audio]',
    'theme file=synthetic/audio/theme.ogg volume=0.4',
    '',
    '[video]',
    'introVideo file=synthetic/video/intro.mp4 poster=synthetic/video/intro.jpg volume=0.2',
    '',
    '[game]',
    'puzzle file=synthetic/games/puzzle.html title="Головоломка" cover=synthetic/games/puzzle.jpg',
    '',
    '[scene]',
    'scene intro',
    '"Текст"'
  ]);
  const result = await runStoryLoader(storyText);

  assert.equal(result.errors.length, 0);
  assert.ok(result.story);
  assert.equal(result.story.assets.backgrounds.hall, 'synthetic/backgrounds/hall.jpg');
  assert.equal(result.story.assets.backgrounds.sphere.file, 'synthetic/360/sphere-360.js');
  assert.equal(result.story.assets.backgrounds.sphere.is360, true);
  assert.equal(result.story.assets.characters.anna.name, 'Анна');
  assert.equal(result.story.assets.characters.anna.images.calm, 'synthetic/characters/anna.png');
  assert.equal(result.story.assets.audio.theme.file, 'synthetic/audio/theme.ogg');
  assert.equal(result.story.assets.audio.theme.volume, 0.4);
  assert.equal(result.story.assets.videos.introVideo.file, 'synthetic/video/intro.mp4');
  assert.equal(result.story.assets.games.puzzle.file, 'synthetic/games/puzzle.html');
});

// Фиксирует обязательность file= для записей нового формата.
test('парсер отклоняет синтетический ассет без file', async function() {
  const storyText = createSyntheticStory([
    '[game]',
    'broken title="Нет файла"',
    '',
    '[scene]',
    'scene intro',
    '"Текст"'
  ]);
  const result = await runStoryLoader(storyText);

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('must contain file=...');
  }));
});

// Проверяет ограничение формата источника для синтетического 360-фона.
test('парсер отклоняет картинку вместо пакета 360', async function() {
  const storyText = createSyntheticStory([
    '[bg]',
    'sphere file=synthetic/360/sphere.jpg 360',
    '',
    '[scene]',
    'scene intro',
    '"Текст"'
  ]);
  const result = await runStoryLoader(storyText);

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('360 background file must be a -360.js package or video');
  }));
});

// Проверяет ссылочную ошибку на вымышленного персонажа, не обращаясь к реальным изображениям.
test('парсер обнаруживает ссылку на необъявленный ассет персонажа', async function() {
  const storyText = createSyntheticStory([
    '[scene]',
    'scene intro',
    'show missingCharacter',
    '"Текст"'
  ]);
  const result = await runStoryLoader(storyText);

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('is not defined in the [char] section');
  }));
});
