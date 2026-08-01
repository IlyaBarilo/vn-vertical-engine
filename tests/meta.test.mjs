import assert from 'node:assert/strict';
import test from 'node:test';

import { runStoryLoader } from './helpers/run-story-loader.mjs';

// Собирает минимальный синтетический сценарий с переданными строками секции [meta].
function createMetaStory(metaLines) {
  return [
    '[meta]',
    ...metaLines,
    '',
    '[scene]',
    'scene intro',
    '"Текст"'
  ].join('\n');
}

// Фиксирует значения meta по умолчанию для минимального сценария.
test('парсер сохраняет значения meta по умолчанию', async function() {
  const result = await runStoryLoader(createMetaStory([
    'startScene = intro'
  ]));

  assert.equal(result.errors.length, 0);
  assert.ok(result.story);
  assert.equal(result.story.meta.title, 'Без названия');
  assert.equal(result.story.meta.lang, 'en');
  assert.equal(result.story.meta.mode, 'debug');
  assert.equal(result.story.meta.window, 'vertical');
  assert.equal(result.story.meta.blurBackground, true);
  assert.equal(result.story.meta.bg360Quality, 'normal');
  assert.equal(result.story.meta.engine.loadsafe, true);
  assert.equal(result.story.meta.engine.optimized, 'false');
  assert.equal(result.story.vars.mode, 'debug');
});

// Проверяет поддерживаемые meta-параметры, двоеточие как разделитель и нормализацию регистра.
test('парсер преобразует полный набор meta-параметров', async function() {
  const result = await runStoryLoader(createMetaStory([
    'title: "Полный набор"',
    'startScene: intro',
    'lang = RU',
    'mode = RELEASE',
    'window = auto',
    'bg360Quality = mobile',
    'engine.optimized = auto',
    'engine.loadsafe = 0',
    'topSpacing = 120',
    'bottomSpacing = 340',
    'leftSpacing = 10',
    'rightSpacing = 20',
    'blurBackground = false',
    'blurStrength = 42.5',
    'blurBrightness = 0.8',
    'blurOpacity = 0.9',
    'autosave = false',
    'transition = white',
    'transitionMs = 250'
  ]));

  assert.equal(result.errors.length, 0);
  assert.ok(result.story);
  assert.equal(result.story.meta.title, 'Полный набор');
  assert.equal(result.story.meta.lang, 'ru');
  assert.equal(result.story.meta.mode, 'release');
  assert.equal(result.story.meta.window, 'auto');
  assert.equal(result.story.meta.bg360Quality, 'mobile');
  assert.equal(result.story.meta.engine.optimized, 'auto');
  assert.equal(result.story.meta.engine.loadsafe, false);
  assert.equal(result.story.meta.topSpacing, 120);
  assert.equal(result.story.meta.bottomSpacing, 340);
  assert.equal(result.story.meta.leftSpacing, 10);
  assert.equal(result.story.meta.rightSpacing, 20);
  assert.equal(result.story.meta.blurBackground, false);
  assert.equal(result.story.meta.blurStrength, 42.5);
  assert.equal(result.story.meta.blurBrightness, 0.8);
  assert.equal(result.story.meta.blurOpacity, 0.9);
  assert.equal(result.story.meta.autosave, false);
  assert.equal(result.story.meta.transition, 'white');
  assert.equal(result.story.meta.transitionMs, 250);
  assert.equal(result.story.vars.mode, 'release');
});

// Проверяет диагностические ошибки перечислимых meta-параметров.
test('парсер отклоняет недопустимые режимы meta', async function(t) {
  const cases = [
    {
      name: 'режим истории',
      line: 'mode = production',
      message: 'Invalid mode "production"'
    },
    {
      name: 'режим окна',
      line: 'window = wide',
      message: 'Invalid window mode "wide"'
    },
    {
      name: 'качество 360',
      line: 'bg360Quality = ultra',
      message: 'Invalid 360 quality "ultra"'
    },
    {
      name: 'оптимизация изображений',
      line: 'engine.optimized = sometimes',
      message: 'The "engine.optimized" value must be false, true or auto.'
    }
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async function() {
      const result = await runStoryLoader(createMetaStory([
        'startScene = intro',
        testCase.line
      ]));

      assert.equal(result.story, null);
      assert.ok(result.errors.some(function(error) {
        return error.message.includes(testCase.message);
      }));
    });
  }
});

// Защищает зарезервированное пространство engine.* и сообщает о неизвестном параметре.
test('парсер проверяет пространство engine в meta', async function(t) {
  await t.test('ключ engine без параметра', async function() {
    const result = await runStoryLoader(createMetaStory([
      'startScene = intro',
      'engine = false'
    ]));

    assert.equal(result.story, null);
    assert.ok(result.errors.some(function(error) {
      return error.message.includes('The "engine" meta key is reserved');
    }));
  });

  await t.test('неизвестный параметр engine', async function() {
    const result = await runStoryLoader(createMetaStory([
      'startScene = intro',
      'engine.unknown = true'
    ]));

    assert.equal(result.story, null);
    assert.ok(result.errors.some(function(error) {
      return error.message.includes('Unknown engine meta parameter "engine.unknown"');
    }));
  });
});

// Проверяет обязательность непустой стартовой сцены.
test('пустой startScene создаёт ошибку', async function() {
  const result = await runStoryLoader(createMetaStory([
    'startScene ='
  ]));

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('startScene cannot be empty');
  }));
});

// Проверяет fallback на первую сцену и существование явно указанной стартовой сцены.
test('парсер проверяет ссылку startScene', async function(t) {
  await t.test('параметр отсутствует', async function() {
    const result = await runStoryLoader(createMetaStory([
      'title = "Без старта"'
    ]));

    assert.equal(result.errors.length, 0);
    assert.equal(result.story.meta.start, 'intro');
  });

  await t.test('сцена отсутствует', async function() {
    const result = await runStoryLoader(createMetaStory([
      'startScene = missingStart'
    ]));

    assert.equal(result.story, null);
    assert.ok(result.errors.some(function(error) {
      return error.message.includes('The start scene "missingStart" does not exist');
    }));
  });
});
