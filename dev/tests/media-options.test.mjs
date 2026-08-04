import assert from 'node:assert/strict';
import test from 'node:test';

import { runStoryLoader } from './helpers/run-story-loader.mjs';

// Собирает минимальный сценарий вокруг переданных секций ресурсов.
function createMediaStory(resourceLines) {
  return [
    '[meta]',
    'title = "Тест медиа"',
    'startScene = intro',
    '',
    ...resourceLines,
    '',
    '[scene]',
    'scene intro',
    '"Текст"'
  ].join('\n');
}

// Проверяет алиасы путей и расширенные параметры всех типов ресурсов.
test('парсер нормализует алиасы и параметры медиа', async function() {
  const result = await runStoryLoader(createMediaStory([
    '[bg]',
    'wide image=synthetic/bg/wide.jpg fallbackimage=synthetic/bg/fallback.jpg volume=0.3 scroll=left focusx=right focusy=25 scale=zoom',
    'sphere file=synthetic/360/sphere-360.css projection=360 quality=auto focusz=25 fov=60 userfocus',
    '',
    '[char]',
    'anna emo=smile src=synthetic/char/anna.png name="Анна" focusx=left focusy=bottom scale=1.1',
    '',
    '[audio]',
    'theme src=synthetic/audio/theme.ogg volume=0.7',
    '',
    '[video]',
    'clip src=synthetic/video/clip.mp4 fallbackimage=synthetic/video/poster.jpg volume=0.5 scroll=right focusx=30 focusy=top scale=1.2',
    '',
    '[game]',
    'puzzle src=synthetic/game/puzzle.html thumbnail=synthetic/game/cover.jpg title="Игра"'
  ]));

  assert.equal(result.errors.length, 0);
  assert.ok(result.story);

  const wide = result.story.assets.backgrounds.wide;
  assert.equal(wide.file, 'synthetic/bg/wide.jpg');
  assert.equal(wide.fallback, 'synthetic/bg/fallback.jpg');
  assert.equal(wide.volume, 0.3);
  assert.equal(wide.scroll.start, 0);
  assert.equal(wide.focusX, 1);
  assert.equal(wide.focusY, 0.25);
  assert.equal(wide.scale, 'zoom');

  const sphere = result.story.assets.backgrounds.sphere;
  assert.equal(sphere.is360, true);
  assert.equal(sphere.quality, 'auto');
  assert.equal(sphere.focusZ, 0.25);
  assert.equal(sphere.fov, 60);
  assert.equal(sphere.userFocus, true);

  const anna = result.story.assets.characters.anna;
  assert.equal(anna.images.smile, 'synthetic/char/anna.png');
  assert.equal(anna.imageOptions.smile.focusX, 0);
  assert.equal(anna.imageOptions.smile.focusY, 0);
  assert.equal(anna.imageOptions.smile.scale, 1.1);
  assert.equal(result.story.assets.audio.theme.file, 'synthetic/audio/theme.ogg');
  assert.equal(result.story.assets.audio.theme.volume, 0.7);
  assert.equal(result.story.assets.videos.clip.poster, 'synthetic/video/poster.jpg');
  assert.equal(result.story.assets.videos.clip.scroll.start, 1);
  assert.equal(result.story.assets.videos.clip.focusX, 0.3);
  assert.equal(result.story.assets.videos.clip.focusY, 0);
  assert.equal(result.story.assets.games.puzzle.cover, 'synthetic/game/cover.jpg');
});

// Сохраняет старый формат объявлений фонов, аудио и свойств персонажа.
test('парсер принимает старый формат объявлений медиа', async function() {
  const result = await runStoryLoader(createMediaStory([
    '[bg]',
    'hall = synthetic/bg/hall.jpg',
    '',
    '[audio]',
    'theme = synthetic/audio/theme.ogg',
    '',
    '[char]',
    'anna image neutral = synthetic/char/anna.png',
    'anna name = "Анна"',
    'anna focusx neutral = 25',
    'anna focusy neutral = top',
    'anna scale neutral = 1.2'
  ]));

  assert.equal(result.errors.length, 0);
  assert.equal(result.story.assets.backgrounds.hall, 'synthetic/bg/hall.jpg');
  assert.equal(result.story.assets.audio.theme, 'synthetic/audio/theme.ogg');
  assert.equal(result.story.assets.characters.anna.images.neutral, 'synthetic/char/anna.png');
  assert.equal(result.story.assets.characters.anna.name, 'Анна');
  assert.equal(result.story.assets.characters.anna.imageOptions.neutral.focusX, 0.25);
  assert.equal(result.story.assets.characters.anna.imageOptions.neutral.focusY, 1);
  assert.equal(result.story.assets.characters.anna.imageOptions.neutral.scale, 1.2);
});

// Проверяет диапазон громкости в объявлениях фона, аудио и видео.
test('объявления медиа отклоняют громкость вне диапазона', async function(t) {
  const cases = [
    ['фон', ['[bg]', 'bad file=synthetic/bg/bad.mp4 volume=2'], 'Background volume'],
    ['аудио', ['[audio]', 'bad file=synthetic/audio/bad.ogg volume=-0.1'], 'Audio volume'],
    ['видео', ['[video]', 'bad file=synthetic/video/bad.mp4 volume=abc'], 'Invalid video volume']
  ];

  for (const testCase of cases) {
    await t.test(testCase[0], async function() {
      const result = await runStoryLoader(createMediaStory(testCase[1]));

      assert.equal(result.story, null);
      assert.ok(result.errors.some(function(error) {
        return error.message.includes(testCase[2]);
      }));
    });
  }
});

// Проверяет недопустимые значения кадрирования, масштаба и параметров 360.
test('объявления медиа отклоняют некорректные визуальные параметры', async function(t) {
  const cases = [
    ['scroll', ['[bg]', 'bad file=synthetic/bg/bad.jpg scroll=sideways'], 'Invalid scroll value'],
    ['focusX', ['[char]', 'anna file=synthetic/char/anna.png focusx=200'], 'Invalid focusX value'],
    ['scale', ['[char]', 'anna file=synthetic/char/anna.png scale=0'], 'Invalid character scale'],
    ['fov', ['[bg]', 'bad file=synthetic/360/bad-360.css 360 fov=100'], 'fov "100" is out of range'],
    ['quality', ['[bg]', 'bad file=synthetic/360/bad-360.css 360 quality=ultra'], 'Invalid 360 quality']
  ];

  for (const testCase of cases) {
    await t.test(testCase[0], async function() {
      const result = await runStoryLoader(createMediaStory(testCase[1]));

      assert.equal(result.story, null);
      assert.ok(result.errors.some(function(error) {
        return error.message.includes(testCase[2]);
      }));
    });
  }
});

// Проверяет запрет старого строкового формата для game и video.
test('game и video требуют новый формат с file', async function(t) {
  const cases = [
    ['game', ['[game]', 'puzzle = synthetic/game/puzzle.html'], 'In [game], use only the new format'],
    ['video', ['[video]', 'clip = synthetic/video/clip.mp4'], 'In [video], use only the new format']
  ];

  for (const testCase of cases) {
    await t.test(testCase[0], async function() {
      const result = await runStoryLoader(createMediaStory(testCase[1]));

      assert.equal(result.story, null);
      assert.ok(result.errors.some(function(error) {
        return error.message.includes(testCase[2]);
      }));
    });
  }
});
