import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const protocol = require('../engine/game-protocol.js');

// Проверяет обязательные поля и передачу дополнительных параметров в искусственном gameInit.
test('протокол создаёт сообщение gameInit с параметрами', function() {
  const message = protocol.createGameInitMessage('puzzle', {
    difficulty: 3,
    speed: 1.5
  });

  assert.deepEqual(message, {
    type: 'gameInit',
    gameId: 'puzzle',
    difficulty: 3,
    speed: 1.5
  });
});

// Защищает служебные поля gameInit от подмены параметрами сценария.
test('параметры не подменяют type и gameId', function() {
  const params = {
    type: 'otherMessage',
    gameId: 'otherGame',
    difficulty: 2
  };
  const message = protocol.createGameInitMessage('puzzle', params);

  assert.equal(message.type, 'gameInit');
  assert.equal(message.gameId, 'puzzle');
  assert.equal(message.difficulty, 2);
  assert.equal(params.type, 'otherMessage');
  assert.equal(params.gameId, 'otherGame');
});

// Не передаёт унаследованные свойства и корректно работает без объекта параметров.
test('gameInit копирует только собственные параметры', function() {
  const params = Object.create({ inherited: 'не передавать' });
  params.difficulty = 4;

  const message = protocol.createGameInitMessage('puzzle', params);
  const emptyMessage = protocol.createGameInitMessage('puzzle', null);

  assert.equal(message.difficulty, 4);
  assert.equal(Object.prototype.hasOwnProperty.call(message, 'inherited'), false);
  assert.deepEqual(emptyMessage, {
    type: 'gameInit',
    gameId: 'puzzle'
  });
});

// Отделяет искусственный gameResult от посторонних сообщений окна.
test('протокол распознаёт только gameResult', function() {
  assert.equal(protocol.isGameResultMessage({ type: 'gameResult', result: 1 }), true);
  assert.equal(protocol.isGameResultMessage({ type: 'gameInit', result: 1 }), false);
  assert.equal(protocol.isGameResultMessage(null), false);
  assert.equal(protocol.isGameResultMessage('gameResult'), false);
});

// Проверяет сохранение обычного числового результата мини-игры.
test('протокол сохраняет числовой результат', function() {
  assert.equal(protocol.normalizeGameResult({ result: 7 }), 7);
  assert.equal(protocol.normalizeGameResult({ result: -2.5 }), -2.5);
});

// Сохраняет совместимость со старыми играми, отправляющими число строкой.
test('протокол принимает числовую строку результата', function() {
  assert.equal(protocol.normalizeGameResult({ result: '12' }), 12);
});

// Некорректные и отсутствующие результаты безопасно превращаются в ноль.
test('протокол заменяет некорректный результат нулём', function() {
  assert.equal(protocol.normalizeGameResult({}), 0);
  assert.equal(protocol.normalizeGameResult({ result: 'ошибка' }), 0);
  assert.equal(protocol.normalizeGameResult({ result: Infinity }), 0);
  assert.equal(protocol.normalizeGameResult(null), 0);
});

// Защищает обязательное подключение общего модуля до основного кода движка.
test('модуль протокола подключён к runtime до engine.js', async function() {
  const [indexSource, engineSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../engine/engine.js', import.meta.url), 'utf8')
  ]);
  const protocolPosition = indexSource.indexOf('engine/game-protocol.js');
  const enginePosition = indexSource.indexOf('engine/engine.js');

  assert.ok(protocolPosition >= 0);
  assert.ok(enginePosition > protocolPosition);
  assert.ok(engineSource.includes('VN_GAME_PROTOCOL.createGameInitMessage'));
  assert.ok(engineSource.includes('VN_GAME_PROTOCOL.normalizeGameResult'));
});
