import assert from 'node:assert/strict';
import test from 'node:test';

import { runStoryLoader } from './helpers/run-story-loader.mjs';

// Собирает минимальный синтетический сценарий для команд 360 без загрузки панорам и story360.js.
function createStory360CommandsStory(actions, additionalScenes = []) {
  return [
    '[meta]',
    'title = "Тест команд 360"',
    'startScene = intro',
    '',
    '[scene]',
    'scene intro',
    ...actions,
    ...additionalScenes
  ].join('\n');
}

// Проверяет метки переходов, legacy-алиас walk2 и список изображений photo-метки.
test('парсер собирает bg360marks и нормализует типы меток', async function() {
  const result = await runStoryLoader(createStory360CommandsStory([
    'bg360marks sphere (door, 0.2, 0.3, walk2, next) (gallery, 0.5, 0.6, photo, synthetic/photo/a.jpg|synthetic/photo/b.jpg) lines'
  ], [
    '',
    'scene next',
    '"Следующая сцена"'
  ]));

  assert.equal(result.errors.length, 0);
  assert.ok(result.story);

  const action = result.story.scenes[0].actions[0];
  assert.equal(action.type, 'bg360marks');
  assert.equal(action.bgId, 'sphere');
  assert.equal(action.lines, true);
  assert.equal(action.marks[0].kind, 'walk');
  assert.equal(action.marks[0].targetScene, 'next');
  assert.equal(action.marks[1].kind, 'photo');
  assert.equal(action.marks[1].targetScene, null);
  assert.equal(action.marks[1].images.length, 2);
  assert.equal(action.marks[1].images[0].file, 'synthetic/photo/a.jpg');
  assert.equal(action.marks[1].images[1].file, 'synthetic/photo/b.jpg');
});

// Проверяет диапазоны координат, допустимые типы и обязательные данные bg360marks.
test('bg360marks отклоняет некорректные метки', async function(t) {
  const cases = [
    ['координаты', 'bg360marks sphere (door, 1.2, 0.3, walk, next)', 'x/y должны быть числами 0..1'],
    ['тип', 'bg360marks sphere (door, 0.2, 0.3, jump, next)', 'type должен быть walk'],
    ['photo без файла', 'bg360marks sphere (gallery, 0.5, 0.6, photo, )', 'для photo укажите путь к файлу'],
    ['нет меток', 'bg360marks sphere lines', 'не найдено ни одной метки']
  ];

  for (const testCase of cases) {
    await t.test(testCase[0], async function() {
      const result = await runStoryLoader(createStory360CommandsStory([testCase[1]]));

      assert.equal(result.story, null);
      assert.ok(result.errors.some(function(error) {
        return error.message.includes(testCase[2]);
      }));
    });
  }
});

// Проверяет рекурсивную ссылочную проверку целевой сцены обычной 360-метки.
test('bg360marks сообщает об отсутствующей целевой сцене', async function() {
  const result = await runStoryLoader(createStory360CommandsStory([
    'bg360marks sphere (door, 0.2, 0.3, walk, missingScene)'
  ]));

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('ведет в несуществующую сцену "missingScene"');
  }));
});

// Проверяет состав goto360, приоритет entry и параметры с текстом в кавычках.
test('парсер собирает goto360 с именованными параметрами', async function() {
  const result = await runStoryLoader(createStory360CommandsStory([
    'goto360 campus.entrance entry=fromLobby from=ignored text="Осмотреть вход" button="Выйти наружу" result=selectedMark'
  ]));

  assert.equal(result.errors.length, 0);
  const action = result.story.scenes[0].actions[0];
  assert.equal(action.type, 'goto360');
  assert.equal(action.spaceId, 'campus');
  assert.equal(action.panoramaId, 'entrance');
  assert.equal(action.entry, 'fromLobby');
  assert.equal(action.text, 'Осмотреть вход');
  assert.equal(action.button, 'Выйти наружу');
  assert.equal(action.result, 'selectedMark');
});

// Проверяет позиционную форму goto360 и нормализацию совместимого from360 через двоеточие.
test('goto360 принимает позиционную форму и from360', async function() {
  const result = await runStoryLoader(createStory360CommandsStory([
    'goto360 campus entrance from360=campus:hall'
  ]));

  assert.equal(result.errors.length, 0);
  const action = result.story.scenes[0].actions[0];
  assert.equal(action.spaceId, 'campus');
  assert.equal(action.panoramaId, 'entrance');
  assert.equal(action.entry, 'campus.hall');
});

// Проверяет обязательную пару space/panorama и безопасное имя результата goto360.
test('goto360 отклоняет неполную ссылку и системный result', async function(t) {
  const cases = [
    ['goto360 campus', 'укажите пространство и панораму'],
    ['goto360 campus.entrance result=engine', 'reserved for system engine.* parameters']
  ];

  for (const testCase of cases) {
    await t.test(testCase[0], async function() {
      const result = await runStoryLoader(createStory360CommandsStory([testCase[0]]));

      assert.equal(result.story, null);
      assert.ok(result.errors.some(function(error) {
        return error.message.includes(testCase[1]);
      }));
    });
  }
});

// Проверяет состав walk360 и сохранение строковых параметров с пробелами.
test('парсер собирает walk360', async function() {
  const result = await runStoryLoader(createStory360CommandsStory([
    'walk360 sphere text="Найдите выход" button="Закрыть обзор" result=selectedMark'
  ]));

  assert.equal(result.errors.length, 0);
  const action = result.story.scenes[0].actions[0];
  assert.equal(action.type, 'walk360');
  assert.equal(action.bgId, 'sphere');
  assert.equal(action.text, 'Найдите выход');
  assert.equal(action.button, 'Закрыть обзор');
  assert.equal(action.result, 'selectedMark');
});

// Проверяет запрет системного имени результата walk360.
test('walk360 отклоняет системный result', async function() {
  const result = await runStoryLoader(createStory360CommandsStory([
    'walk360 sphere result=engine'
  ]));

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('reserved for system engine.* parameters');
  }));
});
