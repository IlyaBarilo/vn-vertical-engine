import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const storyAnalysis = require('../../engine/story-analysis.js');

// Разбирает только алиасы ожидаемой группы и сохраняет составной идентификатор после первого разделителя.
test('анализ истории извлекает идентификаторы алиасов ресурсов', function() {
  assert.equal(storyAnalysis.extractAliasId('@bg.hall', 'bg'), 'hall');
  assert.equal(storyAnalysis.extractAliasId('@audio.music.theme', 'audio'), 'music.theme');
  assert.equal(storyAnalysis.extractAliasId('@ch.anna', 'bg'), '');
  assert.equal(storyAnalysis.extractAliasId('assets/backgrounds/hall.webp', 'bg'), '');
  assert.equal(storyAnalysis.extractAliasId('@bg', 'bg'), '');
});

// Сохраняет действующий подсчёт символов и слов верхнеуровневых реплик без включения вложенного выбора.
test('анализ истории считает текст верхнего уровня', function() {
  const result = storyAnalysis.computeTextInfo({
    scenes: [
      {
        id: 'start',
        actions: [
          { type: 'say', text: 'Привет мир' },
          { type: 'text', text: 'Ещё текст' },
          { type: 'text', text: '   ' },
          {
            type: 'choice',
            choices: [{ text: 'Ветка', actions: [{ type: 'text', text: 'Не считать здесь' }] }]
          }
        ]
      }
    ]
  });

  assert.deepEqual(result, { characters: 22, words: 4 });
});

// Подсчитывает объявления во всех ветках и отделяет использованные ресурсы и эмоции от неиспользованных.
test('анализ истории считает вложенные действия и использование ресурсов', function() {
  const story = {
    assets: {
      backgrounds: {
        hall: { file: 'assets/backgrounds/hall.webp' },
        cellar: { file: 'assets/backgrounds/cellar.webp' }
      },
      characters: {
        anna: {
          name: 'Анна',
          images: { happy: 'happy.webp', neutral: 'neutral.webp', sad: 'sad.webp' }
        },
        bob: {
          name: 'Боб',
          images: { neutral: 'bob.webp' }
        }
      }
    },
    scenes: [
      {
        id: 'start',
        actions: [
          { type: 'bg', src: '@bg.hall' },
          { type: 'char', charId: 'anna', emotion: 'neutral' },
          { type: 'say', text: 'Начало' },
          {
            type: 'choice',
            choices: [
              {
                text: 'Путь',
                actions: [
                  { type: 'bg', src: '@bg.hall' },
                  { type: 'char', charId: 'anna', emotion: 'happy' },
                  { type: 'bgm', src: '@audio.theme' },
                  { type: 'sfx', src: '@audio.click' },
                  { type: 'video', src: '@video.intro' }
                ]
              }
            ]
          },
          {
            type: 'if_block',
            branches: [
              {
                condition: 'ready',
                actions: [
                  { type: 'bg', src: '@bg.hall' },
                  { type: 'char', charId: 'anna', emotion: 'neutral' },
                  { type: 'text', text: 'Продолжение' }
                ]
              }
            ],
            elseActions: [{ type: 'sfx', src: '@audio.cancel' }]
          }
        ]
      },
      { id: 'finish', actions: [] }
    ]
  };
  const sourceBeforeAnalysis = JSON.stringify(story);
  const result = storyAnalysis.computeStoryStats(story);

  assert.equal(JSON.stringify(story), sourceBeforeAnalysis);
  assert.equal(result.sceneCount, 2);
  assert.deepEqual(result.usedBackgroundIds, ['hall']);
  assert.deepEqual(result.unusedBackgroundIds, ['cellar']);
  assert.deepEqual(result.backgroundCounts, { hall: 3 });
  assert.deepEqual(result.backgroundsDetailed, [
    { id: 'hall', used: true },
    { id: 'cellar', used: false }
  ]);
  assert.deepEqual(result.usedCharacterIds, ['anna']);
  assert.deepEqual(result.unusedCharacterIds, ['bob']);
  assert.deepEqual(result.characterEmotionCounts, {
    anna: { neutral: 2, happy: 1 }
  });
  assert.deepEqual(result.usedCharactersDetailed, [
    { id: 'anna', name: 'Анна', used: true, emotionsDisplay: ['happy', 'neutral', 'sad*'] },
    { id: 'bob', name: 'Боб', used: false, emotionsDisplay: ['neutral*'] }
  ]);
  assert.equal(result.sayCount, 1);
  assert.equal(result.textCount, 1);
  assert.equal(result.choiceCount, 1);
  assert.equal(result.bgmActions, 1);
  assert.equal(result.sfxActions, 2);
  assert.equal(result.videoActions, 1);
  assert.deepEqual(result.audioCounts, { theme: 1 });
});

// Закрепляет загрузку анализа до координатора и отсутствие прежних реализаций внутри engine.js.
test('runtime использует отдельный модуль анализа до engine.js', async function() {
  const [indexSource, engineSource] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../engine/engine.js', import.meta.url), 'utf8')
  ]);
  const analysisPosition = indexSource.indexOf('engine/story-analysis.js');
  const enginePosition = indexSource.indexOf('engine/engine.js');

  assert.ok(analysisPosition >= 0);
  assert.ok(enginePosition > analysisPosition);
  assert.match(engineSource, /VN_STORY_ANALYSIS\.computeTextInfo/);
  assert.match(engineSource, /VN_STORY_ANALYSIS\.computeStoryStats/);
  assert.match(engineSource, /VN_STORY_ANALYSIS\.extractAliasId/);
  assert.doesNotMatch(engineSource, /function\s+computeTextInfo\s*\(/);
  assert.doesNotMatch(engineSource, /function\s+computeStoryStats\s*\(/);
  assert.doesNotMatch(engineSource, /function\s+extractAliasId\s*\(/);
});
