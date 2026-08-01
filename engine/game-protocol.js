// Экспортирует чистую логику протокола и в браузерный window, и в Node.js-тесты.
(function(root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VN_GAME_PROTOCOL = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";

  // Создаёт обязательное сообщение gameInit и не позволяет пользовательским параметрам подменить служебные поля.
  function createGameInitMessage(gameId, params) {
    var payload = {
      type: "gameInit",
      gameId: gameId
    };
    var source = params && typeof params === "object" ? params : {};

    Object.keys(source).forEach(function(key) {
      if (key === "type" || key === "gameId") return;
      payload[key] = source[key];
    });

    return payload;
  }

  // Отделяет сообщения с результатом игры от остальных событий postMessage.
  function isGameResultMessage(data) {
    return !!(data && typeof data === "object" && data.type === "gameResult");
  }

  // Приводит результат к конечному числу; числовые строки сохраняются ради совместимости со старыми играми.
  function normalizeGameResult(resultData) {
    if (!resultData) return 0;

    var rawResult = resultData.result;
    var numericResult = typeof rawResult === "number"
      ? rawResult
      : Number(rawResult);

    return isFinite(numericResult) ? numericResult : 0;
  }

  return {
    createGameInitMessage: createGameInitMessage,
    isGameResultMessage: isGameResultMessage,
    normalizeGameResult: normalizeGameResult
  };
});
