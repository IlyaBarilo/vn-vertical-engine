// Экспортирует чистые расчёты статистики истории для браузерного runtime и прямых Node.js-тестов.
(function(root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VN_STORY_ANALYSIS = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createStoryAnalysisModule() {
  "use strict";

  // Извлекает идентификатор из ссылки вида @bg.name, оставляя прямые пути и другие группы без изменений.
  function extractAliasId(reference, group) {
    if (!reference || typeof reference !== "string") return "";
    if (reference.indexOf("@") !== 0) return "";
    var parts = reference.substring(1).split(".");
    if (parts.length < 2 || parts[0] !== group) return "";
    return parts.slice(1).join(".");
  }

  // Считает символы и слова верхнеуровневых реплик, сохраняя действующий контракт панели статистики.
  function computeTextInfo(story) {
    var scenes = story && Array.isArray(story.scenes) ? story.scenes : [];
    var characters = 0;
    var words = 0;

    for (var sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
      var actions = scenes[sceneIndex] && Array.isArray(scenes[sceneIndex].actions)
        ? scenes[sceneIndex].actions
        : [];

      for (var actionIndex = 0; actionIndex < actions.length; actionIndex++) {
        var action = actions[actionIndex];
        if (!action || (action.type !== "say" && action.type !== "text")) continue;

        var text = action.text || "";
        characters += text.length;
        if (text.trim() !== "") words += text.trim().split(/\s+/).length;
      }
    }

    return {
      characters: characters,
      words: words
    };
  }

  // Подсчитывает использование ресурсов и действий во всех сценах и вложенных ветках без обращения к DOM.
  function computeStoryStats(story) {
    var scenes = story && Array.isArray(story.scenes) ? story.scenes : [];
    var usedBackgrounds = {};
    var backgroundCounts = {};
    var usedCharacters = {};
    var usedCharacterEmotions = {};
    var characterEmotionCounts = {};
    var sayCount = 0;
    var textCount = 0;
    var choiceCount = 0;
    var bgmActions = 0;
    var sfxActions = 0;
    var videoActions = 0;
    var audioCounts = {};

    // Рекурсивно учитывает действия внутри choice и if_block, сохраняя каждый фактический вызов ресурса.
    function collectStatsFromActions(actions) {
      if (!Array.isArray(actions)) return;

      for (var actionIndex = 0; actionIndex < actions.length; actionIndex++) {
        var action = actions[actionIndex];
        if (!action || !action.type) continue;

        if (action.type === "bg") {
          var backgroundId = extractAliasId(action.src, "bg");
          if (backgroundId) {
            usedBackgrounds[backgroundId] = true;
            backgroundCounts[backgroundId] = (backgroundCounts[backgroundId] || 0) + 1;
          }
        }

        if (action.type === "char" && action.charId) {
          usedCharacters[action.charId] = true;
          if (!usedCharacterEmotions[action.charId]) usedCharacterEmotions[action.charId] = {};
          if (!characterEmotionCounts[action.charId]) characterEmotionCounts[action.charId] = {};

          if (action.emotion) {
            usedCharacterEmotions[action.charId][action.emotion] = true;
            characterEmotionCounts[action.charId][action.emotion] =
              (characterEmotionCounts[action.charId][action.emotion] || 0) + 1;
          }
        }

        if (action.type === "say") sayCount++;
        if (action.type === "text") textCount++;

        if (action.type === "choice") {
          choiceCount++;
          if (Array.isArray(action.choices)) {
            for (var choiceIndex = 0; choiceIndex < action.choices.length; choiceIndex++) {
              var choice = action.choices[choiceIndex];
              if (choice && Array.isArray(choice.actions)) {
                collectStatsFromActions(choice.actions);
              }
            }
          }
        }

        if (action.type === "if_block") {
          if (Array.isArray(action.branches)) {
            for (var branchIndex = 0; branchIndex < action.branches.length; branchIndex++) {
              var branch = action.branches[branchIndex];
              if (branch && Array.isArray(branch.actions)) {
                collectStatsFromActions(branch.actions);
              }
            }
          }
          if (Array.isArray(action.elseActions)) {
            collectStatsFromActions(action.elseActions);
          }
        }

        if (action.type === "bgm") {
          bgmActions++;
          if (action.src) {
            var audioId = extractAliasId(action.src, "audio");
            if (audioId) audioCounts[audioId] = (audioCounts[audioId] || 0) + 1;
          }
        }
        if (action.type === "sfx") sfxActions++;
        if (action.type === "video") videoActions++;
      }
    }

    for (var sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
      collectStatsFromActions(scenes[sceneIndex] && scenes[sceneIndex].actions);
    }

    var assets = story && story.assets ? story.assets : {};
    var backgrounds = assets.backgrounds || {};
    var allBackgroundIds = Object.keys(backgrounds).sort();
    var usedBackgroundIds = [];
    var unusedBackgroundIds = [];

    for (var backgroundIndex = 0; backgroundIndex < allBackgroundIds.length; backgroundIndex++) {
      var currentBackgroundId = allBackgroundIds[backgroundIndex];
      if (usedBackgrounds[currentBackgroundId]) usedBackgroundIds.push(currentBackgroundId);
      else unusedBackgroundIds.push(currentBackgroundId);
    }

    var backgroundsDetailed = [];
    for (var usedBackgroundIndex = 0; usedBackgroundIndex < usedBackgroundIds.length; usedBackgroundIndex++) {
      backgroundsDetailed.push({ id: usedBackgroundIds[usedBackgroundIndex], used: true });
    }
    for (var unusedBackgroundIndex = 0; unusedBackgroundIndex < unusedBackgroundIds.length; unusedBackgroundIndex++) {
      backgroundsDetailed.push({ id: unusedBackgroundIds[unusedBackgroundIndex], used: false });
    }

    var characters = assets.characters || {};
    var allCharacterIds = Object.keys(characters).sort();
    var usedCharacterIds = [];
    var unusedCharacterIds = [];

    for (var characterIndex = 0; characterIndex < allCharacterIds.length; characterIndex++) {
      var characterId = allCharacterIds[characterIndex];
      if (usedCharacters[characterId]) usedCharacterIds.push(characterId);
      else unusedCharacterIds.push(characterId);
    }

    var orderedCharacterIds = usedCharacterIds.concat(unusedCharacterIds);
    var usedCharactersDetailed = [];
    for (var orderedIndex = 0; orderedIndex < orderedCharacterIds.length; orderedIndex++) {
      var currentCharacterId = orderedCharacterIds[orderedIndex];
      var characterData = characters[currentCharacterId] || {};
      var allEmotions = characterData.images ? Object.keys(characterData.images).sort() : [];
      var usedEmotionsMap = usedCharacterEmotions[currentCharacterId] || {};
      var usedEmotions = [];
      var unusedEmotions = [];

      for (var emotionIndex = 0; emotionIndex < allEmotions.length; emotionIndex++) {
        var emotion = allEmotions[emotionIndex];
        if (usedEmotionsMap[emotion]) usedEmotions.push(emotion);
        else unusedEmotions.push(emotion + "*");
      }

      usedCharactersDetailed.push({
        id: currentCharacterId,
        name: characterData.name || currentCharacterId,
        used: !!usedCharacters[currentCharacterId],
        emotionsDisplay: usedEmotions.concat(unusedEmotions)
      });
    }

    return {
      sceneCount: scenes.length,
      usedBackgroundIds: usedBackgroundIds,
      unusedBackgroundIds: unusedBackgroundIds,
      backgroundCounts: backgroundCounts,
      backgroundsDetailed: backgroundsDetailed,
      usedCharacterIds: usedCharacterIds,
      unusedCharacterIds: unusedCharacterIds,
      characterEmotionCounts: characterEmotionCounts,
      usedCharactersDetailed: usedCharactersDetailed,
      sayCount: sayCount,
      textCount: textCount,
      choiceCount: choiceCount,
      bgmActions: bgmActions,
      sfxActions: sfxActions,
      videoActions: videoActions,
      audioCounts: audioCounts
    };
  }

  return {
    extractAliasId: extractAliasId,
    computeTextInfo: computeTextInfo,
    computeStoryStats: computeStoryStats
  };
});
