// Экспортирует чистый анализ переходов истории для браузерного runtime и прямых Node.js-тестов.
(function(root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VN_STORY_GRAPH = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createStoryGraphModule() {
  "use strict";

  // Обходит обычные переходы, включая вложенные ветви if и choice, сохраняя подпись условия или выбора.
  function forEachOutgoingTarget(actions, callback, currentLabel) {
    if (!Array.isArray(actions) || typeof callback !== "function") return;
    var label = currentLabel || "";

    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];
      if (!action || !action.type) continue;

      if (action.type === "goto" && action.target) {
        callback({ to: action.target, label: label });
        continue;
      }

      if (action.type === "if_expr" && action.target) {
        callback({ to: action.target, label: String(action.condition || "") });
        continue;
      }

      if (action.type === "if_block") {
        if (Array.isArray(action.branches)) {
          for (var branchIndex = 0; branchIndex < action.branches.length; branchIndex++) {
            var branch = action.branches[branchIndex];
            if (branch && Array.isArray(branch.actions)) {
              forEachOutgoingTarget(branch.actions, callback, String(branch.condition || ""));
            }
          }
        }
        if (Array.isArray(action.elseActions)) {
          forEachOutgoingTarget(action.elseActions, callback, "else");
        }
        continue;
      }

      if (action.type === "choice" && Array.isArray(action.choices)) {
        for (var choiceIndex = 0; choiceIndex < action.choices.length; choiceIndex++) {
          var choice = action.choices[choiceIndex];
          if (!choice) continue;
          var choiceLabel = String(choice.text || "");
          if (choice.goto) {
            callback({ to: choice.goto, label: choiceLabel });
          }
          if (Array.isArray(choice.actions)) {
            forEachOutgoingTarget(choice.actions, callback, choiceLabel);
          }
        }
      }
    }
  }

  // Строит карту объявленных сцен и направленные рёбра обычных переходов без обращения к DOM или runtime-состоянию.
  function buildAdjacency(story) {
    var scenes = story && Array.isArray(story.scenes) ? story.scenes : [];
    var sceneMap = {};
    var adjacency = {};

    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i] && scenes[i].id) {
        sceneMap[scenes[i].id] = true;
        adjacency[scenes[i].id] = [];
      }
    }

    for (var sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
      var scene = scenes[sceneIndex];
      if (!scene || !scene.id) continue;

      // Добавляет нормализованное ребро текущей сцены, сохраняя порядок команд сценария.
      forEachOutgoingTarget(scene.actions || [], function addSceneEdge(edge) {
        adjacency[scene.id].push({ to: edge.to, label: edge.label });
      });
    }

    return { sceneMap: sceneMap, adj: adjacency };
  }

  // Находит все узлы, достижимые из старта; принимает как строки рёбер, так и объекты { to }.
  function findReachableNodes(startId, nodeMap, adjacency) {
    var nodes = nodeMap && typeof nodeMap === "object" ? nodeMap : {};
    var edgesByNode = adjacency && typeof adjacency === "object" ? adjacency : {};
    var visited = {};

    if (!startId || !Object.prototype.hasOwnProperty.call(nodes, startId)) return visited;

    var stack = [startId];
    visited[startId] = true;

    while (stack.length) {
      var current = stack.pop();
      var edges = Array.isArray(edgesByNode[current]) ? edgesByNode[current] : [];
      for (var i = 0; i < edges.length; i++) {
        var edge = edges[i];
        var target = typeof edge === "string" ? edge : (edge && edge.to);
        if (
          target &&
          !visited[target] &&
          Object.prototype.hasOwnProperty.call(nodes, target)
        ) {
          visited[target] = true;
          stack.push(target);
        }
      }
    }

    return visited;
  }

  // Разделяет обычные сцены на достижимые и недостижимые относительно meta.start.
  function findSceneReachability(story) {
    var source = story && typeof story === "object" ? story : {};
    var startId = source.meta && source.meta.start ? source.meta.start : null;
    var built = buildAdjacency(source);
    var sceneIds = Object.keys(built.sceneMap).sort();
    var visited = findReachableNodes(startId, built.sceneMap, built.adj);
    var reachable = [];
    var unreachable = [];

    for (var i = 0; i < sceneIds.length; i++) {
      if (visited[sceneIds[i]]) reachable.push(sceneIds[i]);
      else unreachable.push(sceneIds[i]);
    }

    return { unreachable: unreachable, reachable: reachable };
  }

  // Находит циклы сцен алгоритмом сильно связанных компонент, включая одиночные самопетли.
  function findCyclesSCC(story) {
    var built = buildAdjacency(story || {});
    var sceneMap = built.sceneMap;
    var adjacency = built.adj;
    var index = 0;
    var stack = [];
    var onStack = {};
    var indexes = {};
    var lowLinks = {};
    var components = [];

    // Выполняет один рекурсивный шаг алгоритма Тарьяна и сохраняет завершённую компоненту.
    function connectStrongly(sceneId) {
      indexes[sceneId] = index;
      lowLinks[sceneId] = index;
      index++;
      stack.push(sceneId);
      onStack[sceneId] = true;

      var edges = adjacency[sceneId] || [];
      for (var edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
        var target = edges[edgeIndex].to;
        if (!Object.prototype.hasOwnProperty.call(sceneMap, target)) continue;

        if (indexes[target] === undefined) {
          connectStrongly(target);
          lowLinks[sceneId] = Math.min(lowLinks[sceneId], lowLinks[target]);
        } else if (onStack[target]) {
          lowLinks[sceneId] = Math.min(lowLinks[sceneId], indexes[target]);
        }
      }

      if (lowLinks[sceneId] === indexes[sceneId]) {
        var component = [];
        while (true) {
          var member = stack.pop();
          onStack[member] = false;
          component.push(member);
          if (member === sceneId) break;
        }
        components.push(component);
      }
    }

    var sceneIds = Object.keys(sceneMap);
    for (var sceneIndex = 0; sceneIndex < sceneIds.length; sceneIndex++) {
      if (indexes[sceneIds[sceneIndex]] === undefined) connectStrongly(sceneIds[sceneIndex]);
    }

    var cycles = [];
    for (var componentIndex = 0; componentIndex < components.length; componentIndex++) {
      var component = components[componentIndex];
      if (component.length > 1) {
        component.sort();
        cycles.push(component);
        continue;
      }

      var single = component[0];
      var singleEdges = adjacency[single] || [];
      for (var singleEdgeIndex = 0; singleEdgeIndex < singleEdges.length; singleEdgeIndex++) {
        if (singleEdges[singleEdgeIndex].to === single) {
          cycles.push([single]);
          break;
        }
      }
    }

    // Стабилизирует порядок компонент для воспроизводимого текста статистики и unit-тестов.
    cycles.sort(function compareCycles(left, right) {
      return left[0].localeCompare(right[0]);
    });

    return cycles;
  }

  return {
    forEachOutgoingTarget: forEachOutgoingTarget,
    buildAdjacency: buildAdjacency,
    findReachableNodes: findReachableNodes,
    findSceneReachability: findSceneReachability,
    findCyclesSCC: findCyclesSCC
  };
});
