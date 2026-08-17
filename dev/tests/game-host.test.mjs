import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const gameHostModule = require('../../engine/game-host.js');
const gameProtocol = require('../../engine/game-protocol.js');

// Создаёт минимальный classList модального окна с наблюдаемым состоянием hidden.
function createClassList(hidden = true) {
  const values = new Set(hidden ? ['hidden'] : []);
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); }
  };
}

// Имитирует iframe и сохраняет атрибуты, навигацию и отправленные сообщения без настоящего DOM.
function createFrame() {
  const messages = [];
  const attributes = {};
  const contentWindow = {
    postMessage(payload, targetOrigin) {
      messages.push({ payload, targetOrigin });
    }
  };
  return {
    attributes,
    contentWindow,
    messages,
    onload: null,
    src: 'about:blank',
    setAttribute(name, value) { attributes[name] = value; }
  };
}

// Имитирует window-события и позволяет проверить регистрацию и удаление единственного message-listener.
function createEventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    dispatch(type, event) {
      const listener = listeners.get(type);
      if (listener) listener(event);
    }
  };
}

// Собирает две игровые модалки и журнал callback-событий для повторного использования в unit-тестах.
function createHostFixture() {
  const eventTarget = createEventTarget();
  const storyFrame = createFrame();
  const statsFrame = createFrame();
  const storyModal = { classList: createClassList() };
  const statsModal = { classList: createClassList() };
  const acceptedResults = [];
  const warnings = [];
  const openedKinds = [];
  const closedKinds = [];

  // Сохраняет только уже проверенные модулем результаты вместе с активной сессией.
  function captureAcceptedResult(event, launch) {
    acceptedResults.push({ event, launch });
  }

  // Сохраняет причину отказа нового запуска без зависимости теста от console.
  function captureWarning(message, frameKind) {
    warnings.push({ message, frameKind });
  }

  // Отмечает подготовку UI конкретного вида запуска.
  function markStoryOpen() { openedKinds.push('story'); }
  function markStatsOpen() { openedKinds.push('stats'); }

  // Отмечает очистку UI конкретного вида запуска.
  function markStoryClose() { closedKinds.push('story'); }
  function markStatsClose() { closedKinds.push('stats'); }

  const host = gameHostModule.createGameHost({
    eventTarget,
    protocol: gameProtocol,
    frames: {
      story: { frame: storyFrame, modal: storyModal, onOpen: markStoryOpen, onClose: markStoryClose },
      stats: { frame: statsFrame, modal: statsModal, onOpen: markStatsOpen, onClose: markStatsClose }
    },
    onResult: captureAcceptedResult,
    onWarning: captureWarning
  });

  return {
    host,
    eventTarget,
    storyFrame,
    statsFrame,
    storyModal,
    statsModal,
    acceptedResults,
    warnings,
    openedKinds,
    closedKinds
  };
}

// Закрепляет строгие iframe-ограничения как единый публичный контракт нового модуля.
test('game host применяет sandbox и Permissions Policy до навигации', function() {
  const frame = createFrame();

  gameHostModule.applyGameFrameSecurity(frame);

  assert.equal(frame.attributes.sandbox, 'allow-scripts');
  assert.equal(frame.attributes.referrerpolicy, 'no-referrer');
  assert.match(frame.attributes.allow, /autoplay/);
  assert.match(frame.attributes.allow, /camera 'none'/);
  assert.match(frame.attributes.allow, /microphone 'none'/);
  assert.match(frame.attributes.allow, /usb 'none'/);
});

// Создаёт сессию, показывает нужную модалку и отправляет gameInit только после фактического load iframe.
test('game host открывает игру и отправляет gameInit активной сессии', function() {
  const fixture = createHostFixture();
  const session = fixture.host.open({
    frameKind: 'story',
    gameId: 'puzzle',
    src: 'assets/games/puzzle.html',
    params: { difficulty: 4 }
  });

  assert.ok(session);
  assert.equal(session.gameId, 'puzzle');
  assert.equal(session.frameKind, 'story');
  assert.equal(fixture.storyModal.classList.contains('hidden'), false);
  assert.equal(fixture.storyFrame.src, 'assets/games/puzzle.html');
  assert.deepEqual(fixture.openedKinds, ['story']);

  fixture.storyFrame.onload();

  assert.equal(session.expectedSource, fixture.storyFrame.contentWindow);
  assert.equal(fixture.storyFrame.messages.length, 1);
  assert.equal(fixture.storyFrame.messages[0].targetOrigin, '*');
  assert.equal(fixture.storyFrame.messages[0].payload.type, 'gameInit');
  assert.equal(fixture.storyFrame.messages[0].payload.gameId, 'puzzle');
  assert.equal(fixture.storyFrame.messages[0].payload.sessionId, session.sessionId);
  assert.equal(fixture.storyFrame.messages[0].payload.difficulty, 4);
});

// Принимает результат только от активного contentWindow и блокирует повторное или параллельное завершение.
test('game host допускает только одну игру и один результат сессии', function() {
  const fixture = createHostFixture();
  const session = fixture.host.open({
    frameKind: 'story',
    gameId: 'puzzle',
    src: 'assets/games/puzzle.html',
    params: {}
  });
  fixture.storyFrame.onload();

  assert.equal(fixture.host.canOpen('stats', true), false);
  assert.equal(fixture.warnings.length, 1);

  const resultData = {
    type: 'gameResult',
    protocolVersion: gameProtocol.GAME_PROTOCOL_VERSION,
    gameId: 'puzzle',
    sessionId: session.sessionId,
    result: 7
  };
  fixture.eventTarget.dispatch('message', { source: {}, data: resultData });
  assert.equal(fixture.acceptedResults.length, 0);

  const acceptedEvent = { source: fixture.storyFrame.contentWindow, data: resultData };
  fixture.eventTarget.dispatch('message', acceptedEvent);
  fixture.eventTarget.dispatch('message', acceptedEvent);

  assert.equal(fixture.acceptedResults.length, 1);
  assert.equal(fixture.acceptedResults[0].launch.session, session);
  assert.equal(session.resultAccepted, true);
});

// Закрывает iframe, инвалидирует сессию и после этого разрешает запуск второго вида игры.
test('game host очищает iframe и переключается между сюжетной и статистической игрой', function() {
  const fixture = createHostFixture();
  const storySession = fixture.host.open({
    frameKind: 'story',
    gameId: 'storyGame',
    src: 'assets/games/story.html'
  });

  assert.equal(fixture.host.closeFrame('story'), true);
  assert.equal(storySession.resultAccepted, true);
  assert.equal(storySession.expectedSource, null);
  assert.equal(fixture.storyModal.classList.contains('hidden'), true);
  assert.equal(fixture.storyFrame.src, 'about:blank');

  const statsSession = fixture.host.open({
    frameKind: 'stats',
    gameId: 'statsGame',
    src: 'assets/games/stats.html'
  });

  assert.ok(statsSession);
  assert.equal(fixture.statsModal.classList.contains('hidden'), false);
  assert.equal(fixture.statsFrame.src, 'assets/games/stats.html');
});

// Dispose удаляет глобальный listener, сбрасывает оба iframe и становится безопасным при повторном вызове.
test('game host dispose полностью завершает lifecycle', function() {
  const fixture = createHostFixture();
  fixture.host.open({
    frameKind: 'story',
    gameId: 'puzzle',
    src: 'assets/games/puzzle.html'
  });

  fixture.host.dispose();
  fixture.host.dispose();

  assert.equal(fixture.eventTarget.listeners.has('message'), false);
  assert.equal(fixture.host.getActiveSession(), null);
  assert.equal(fixture.storyFrame.src, 'about:blank');
  assert.equal(fixture.statsFrame.src, 'about:blank');
  assert.equal(fixture.host.canOpen('story'), false);
});

// Закрепляет загрузку game host после протокола и отсутствие прежнего низкоуровневого lifecycle в engine.js.
test('runtime использует game host до engine.js', async function() {
  const [indexSource, engineSource] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../engine/engine.js', import.meta.url), 'utf8')
  ]);
  const protocolPosition = indexSource.indexOf('engine/game-protocol.js');
  const hostPosition = indexSource.indexOf('engine/game-host.js');
  const enginePosition = indexSource.indexOf('engine/engine.js');

  assert.ok(protocolPosition >= 0);
  assert.ok(hostPosition > protocolPosition);
  assert.ok(enginePosition > hostPosition);
  assert.match(engineSource, /VN_GAME_HOST\.createGameHost/);
  assert.doesNotMatch(engineSource, /function\s+applyGameFrameSandbox\s*\(/);
  assert.doesNotMatch(engineSource, /function\s+createActiveGameSession\s*\(/);
  assert.doesNotMatch(engineSource, /addEventListener\("message",\s*handleGameResultMessage\)/);
});
