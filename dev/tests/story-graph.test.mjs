import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const storyGraph = require('../../engine/story-graph.js');

// Проверяет единый рекурсивный обход прямых, условных и вложенных переходов сценария.
test('граф собирает переходы из goto, if и choice', function() {
  const story = {
    meta: { start: 'start' },
    scenes: [
      {
        id: 'start',
        actions: [
          { type: 'goto', target: 'direct' },
          { type: 'if_expr', condition: 'score > 1', target: 'shortCondition' },
          {
            type: 'if_block',
            branches: [
              { condition: 'flag', actions: [{ type: 'goto', target: 'branch' }] }
            ],
            elseActions: [{ type: 'goto', target: 'fallback' }]
          },
          {
            type: 'choice',
            choices: [
              { text: 'Прямой выбор', goto: 'choiceTarget' },
              { text: 'Вложенный выбор', actions: [{ type: 'goto', target: 'nestedTarget' }] }
            ]
          }
        ]
      },
      // Создаёт пустые целевые сцены, чтобы карта содержала все проверяемые переходы.
      ...['direct', 'shortCondition', 'branch', 'fallback', 'choiceTarget', 'nestedTarget'].map(function createTargetScene(id) {
        return { id, actions: [] };
      })
    ]
  };

  const built = storyGraph.buildAdjacency(story);

  assert.deepEqual(built.adj.start, [
    { to: 'direct', label: '' },
    { to: 'shortCondition', label: 'score > 1' },
    { to: 'branch', label: 'flag' },
    { to: 'fallback', label: 'else' },
    { to: 'choiceTarget', label: 'Прямой выбор' },
    { to: 'nestedTarget', label: 'Вложенный выбор' }
  ]);
});

// Разделяет обычные сцены по достижимости и не считает отдельную сцену частью основного маршрута.
test('граф находит недостижимые сцены', function() {
  const result = storyGraph.findSceneReachability({
    meta: { start: 'start' },
    scenes: [
      { id: 'start', actions: [{ type: 'goto', target: 'middle' }] },
      { id: 'middle', actions: [{ type: 'if_expr', condition: 'ready', target: 'finish' }] },
      { id: 'finish', actions: [] },
      { id: 'orphan', actions: [] }
    ]
  });

  assert.deepEqual(result.reachable, ['finish', 'middle', 'start']);
  assert.deepEqual(result.unreachable, ['orphan']);
});

// При отсутствующем meta.start сохраняет прежнее безопасное поведение: все сцены считаются сомнительными.
test('граф считает все сцены недостижимыми без существующего старта', function() {
  const result = storyGraph.findSceneReachability({
    meta: { start: 'missing' },
    scenes: [
      { id: 'alpha', actions: [{ type: 'goto', target: 'beta' }] },
      { id: 'beta', actions: [] }
    ]
  });

  assert.deepEqual(result.reachable, []);
  assert.deepEqual(result.unreachable, ['alpha', 'beta']);
});

// Универсальный обход принимает рёбра сцен как объекты и добавленные runtime рёбра 360-графа как строки.
test('граф обходит объединённые обычные и 360-узлы', function() {
  const visited = storyGraph.findReachableNodes(
    'scene',
    { scene: true, panorama: true, ending: true, orphan: true },
    {
      scene: [{ to: 'panorama', label: '' }],
      panorama: ['ending']
    }
  );

  assert.deepEqual(Object.keys(visited).sort(), ['ending', 'panorama', 'scene']);
});

// Находит многосценовый цикл и самопетлю, игнорируя переход в необъявленную сцену.
test('граф находит сильно связанные циклы и самопетли', function() {
  const cycles = storyGraph.findCyclesSCC({
    meta: { start: 'a' },
    scenes: [
      { id: 'a', actions: [{ type: 'goto', target: 'b' }] },
      { id: 'b', actions: [{ type: 'choice', choices: [{ text: 'Назад', goto: 'a' }] }] },
      { id: 'self', actions: [{ type: 'if_expr', condition: 'again', target: 'self' }] },
      { id: 'tail', actions: [{ type: 'goto', target: 'missing' }] }
    ]
  });

  assert.deepEqual(cycles, [['a', 'b'], ['self']]);
});

// Закрепляет загрузку чистого модуля до монолитного координатора и отсутствие старых локальных реализаций.
test('runtime использует отдельный модуль графа до engine.js', async function() {
  const [indexSource, engineSource] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../engine/engine.js', import.meta.url), 'utf8')
  ]);
  const graphPosition = indexSource.indexOf('engine/story-graph.js');
  const enginePosition = indexSource.indexOf('engine/engine.js');

  assert.ok(graphPosition >= 0);
  assert.ok(enginePosition > graphPosition);
  assert.match(engineSource, /VN_STORY_GRAPH\.forEachOutgoingTarget/);
  assert.match(engineSource, /VN_STORY_GRAPH\.findReachableNodes/);
  assert.match(engineSource, /VN_STORY_GRAPH\.findCyclesSCC/);
  assert.doesNotMatch(engineSource, /function\s+forEachOutgoingTarget\s*\(/);
  assert.doesNotMatch(engineSource, /function\s+findCyclesSCC\s*\(/);
});
