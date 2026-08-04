import assert from 'node:assert/strict';
import test from 'node:test';

import { runStoryLoader } from './helpers/run-story-loader.mjs';

// Собирает синтетический сценарий со всеми объявлениями, необходимыми командам сцены.
function createSceneActionsStory(actions) {
  return [
    '[meta]',
    'title = "Тест команд"',
    'startScene = intro',
    '',
    '[bg]',
    'hall file=synthetic/backgrounds/hall.jpg',
    '',
    '[char]',
    'anna emotion=smile file=synthetic/characters/anna.png name="Анна" color=#0F0',
    '',
    '[audio]',
    'theme file=synthetic/audio/theme.ogg volume=0.4',
    '',
    '[video]',
    'introVideo file=synthetic/video/intro.mp4 poster=synthetic/video/intro.jpg volume=0.2',
    '',
    '[game]',
    'puzzle file=synthetic/games/puzzle.html title="Головоломка" sandbox=strict',
    '',
    '[var]',
    'gameResult = 0',
    '',
    '[scene]',
    'scene intro',
    ...actions
  ].join('\n');
}

// Проверяет AST основных команд сцены без выполнения браузерного интерфейса.
test('парсер собирает основные команды сцены', async function() {
  const result = await runStoryLoader(createSceneActionsStory([
    'bg hall',
    'show anna smile right focusx=25 focusy=top scale=1.2',
    'anna: "Привет\\nмир"',
    '"Авторский текст"',
    'hide all',
    'music theme loop volume=0.6',
    'music stop',
    'game puzzle difficulty=2 mode=timed result=gameResult',
    'video introVideo start=1 stop=3 skip=false skipText="Пропустить" fit=contain volume=0.8 scroll=center focusx=left focusy=bottom scale=1.1'
  ]));

  assert.equal(result.errors.length, 0);
  assert.ok(result.story);

  const actions = result.story.scenes[0].actions;
  assert.equal(actions[0].type, 'bg');
  assert.equal(actions[0].src, '@bg.hall');
  assert.equal(actions[1].type, 'char');
  assert.equal(actions[1].charId, 'anna');
  assert.equal(actions[1].emotion, 'smile');
  assert.equal(actions[1].pos, 'right');
  assert.equal(actions[1].focusX, 0.25);
  assert.equal(actions[1].focusY, 1);
  assert.equal(actions[1].scale, 1.2);
  assert.equal(actions[2].type, 'say');
  assert.equal(actions[2].text, 'Привет\nмир');
  assert.equal(actions[3].type, 'text');
  assert.equal(actions[4].type, 'char');
  assert.equal(actions[4].charId, null);
  assert.equal(actions[5].type, 'bgm');
  assert.equal(actions[5].src, '@audio.theme');
  assert.equal(actions[5].loop, true);
  assert.equal(actions[5].volume, 0.6);
  assert.equal(actions[6].src, null);
  assert.equal(actions[7].type, 'game');
  assert.equal(actions[7].gameId, 'puzzle');
  assert.equal(Object.prototype.hasOwnProperty.call(actions[7], 'sandboxMode'), false);
  assert.equal(actions[7].resultVar, 'gameResult');
  assert.equal(actions[7].params.difficulty, 2);
  assert.equal(actions[7].params.mode, 'timed');
  assert.equal(actions[8].type, 'video');
  assert.equal(actions[8].start, 1);
  assert.equal(actions[8].stop, 3);
  assert.equal(actions[8].skippable, false);
  assert.equal(actions[8].skipText, 'Пропустить');
  assert.equal(actions[8].fit, 'contain');
  assert.equal(actions[8].volume, 0.8);
  assert.equal(actions[8].scroll.start, 0.5);
  assert.equal(actions[8].focusX, 0);
  assert.equal(actions[8].focusY, 1);
  assert.equal(actions[8].scale, 1.1);
});

// Проверяет локальные параметры команды bg и их нормализацию.
test('команда bg принимает локальные параметры медиа и перехода', async function() {
  const result = await runStoryLoader(createSceneActionsStory([
    'bg hall scroll=right focusx=30 focusy=top scale=1.5 transition=fade transitionMs=180'
  ]));

  assert.equal(result.errors.length, 0);
  const action = result.story.scenes[0].actions[0];
  assert.equal(action.scroll.start, 1);
  assert.equal(action.focusX, 0.3);
  assert.equal(action.focusY, 0);
  assert.equal(action.scale, 1.5);
  assert.equal(action.transition, 'fade');
  assert.equal(action.transitionMs, 180);
});

// Сохраняет старый алиас bgm для команды фоновой музыки.
test('алиас bgm остаётся совместимым с music', async function() {
  const result = await runStoryLoader(createSceneActionsStory([
    'bgm theme loop=false'
  ]));

  assert.equal(result.errors.length, 0);
  assert.equal(result.story.scenes[0].actions[0].type, 'bgm');
  assert.equal(result.story.scenes[0].actions[0].loop, false);
});

// Проверяет обязательные поля и безопасное имя результата команды game.
test('команда game отклоняет некорректные вызовы', async function(t) {
  const cases = [
    ['game puzzle', 'must contain result=<varName>'],
    ['game puzzle result=engine', 'reserved for system engine.* parameters'],
    ['game missingGame result=gameResult', 'is not declared in [game]']
  ];

  for (const testCase of cases) {
    await t.test(testCase[0], async function() {
      const result = await runStoryLoader(createSceneActionsStory([testCase[0]]));

      assert.equal(result.story, null);
      assert.ok(result.errors.some(function(error) {
        return error.message.includes(testCase[1]);
      }));
    });
  }
});

// Проверяет диапазоны и взаимоисключающие параметры команды video.
test('команда video отклоняет некорректные параметры', async function(t) {
  const cases = [
    ['video introVideo start=-1', 'start= value must be a number from 0'],
    ['video introVideo start=3 stop=2', 'stop= value must be greater than start='],
    ['video introVideo skip=true skippable=false', 'Use only one video skip option'],
    ['video introVideo fit=stretch', 'fit= value must be cover or contain'],
    ['video introVideo volume=2', 'volume= value must be a number from 0 to 1'],
    ['video introVideo scale=0', 'scale= value must be a positive number or variable name'],
    ['video introVideo scroll=sideways', 'Invalid scroll value'],
    ['video missingVideo', 'is not declared in [video]']
  ];

  for (const testCase of cases) {
    await t.test(testCase[0], async function() {
      const result = await runStoryLoader(createSceneActionsStory([testCase[0]]));

      assert.equal(result.story, null);
      assert.ok(result.errors.some(function(error) {
        return error.message.includes(testCase[1]);
      }));
    });
  }
});

// Проверяет ссылочную ошибку диалога от имени необъявленного персонажа.
test('диалог необъявленного персонажа создаёт ошибку', async function() {
  const result = await runStoryLoader(createSceneActionsStory([
    'missingCharacter: "Текст"'
  ]));

  assert.equal(result.story, null);
  assert.ok(result.errors.some(function(error) {
    return error.message.includes('is not defined in the [char] section');
  }));
});
