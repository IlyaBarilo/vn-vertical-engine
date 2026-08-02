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

  var GAME_PROTOCOL_VERSION = 2;

  // Создаёт непредсказуемый идентификатор запуска; fallback сохраняет работу в старых браузерах без Web Crypto.
  function createGameSessionId(cryptoProvider) {
    var provider = cryptoProvider;
    if (!provider && typeof globalThis !== "undefined") {
      provider = globalThis.crypto;
    }

    if (provider && typeof provider.getRandomValues === "function") {
      var values = new Uint32Array(4);
      provider.getRandomValues(values);
      var randomParts = [];
      for (var i = 0; i < values.length; i++) {
        randomParts.push(values[i].toString(16).padStart(8, "0"));
      }
      return "game-" + randomParts.join("");
    }

    return "game-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  // Создаёт gameInit и защищает служебные поля; sessionId включает версию нового протокола без поломки старых вызовов API.
  function createGameInitMessage(gameId, params, sessionId) {
    var payload = {
      type: "gameInit",
      gameId: gameId
    };
    var source = params && typeof params === "object" ? params : {};

    if (sessionId !== undefined && sessionId !== null && sessionId !== "") {
      payload.protocolVersion = GAME_PROTOCOL_VERSION;
      payload.sessionId = String(sessionId);
    }

    Object.keys(source).forEach(function(key) {
      if (
        key === "type" ||
        key === "gameId" ||
        key === "protocolVersion" ||
        key === "sessionId"
      ) return;
      payload[key] = source[key];
    });

    return payload;
  }

  // Отделяет сообщения с результатом игры от остальных событий postMessage.
  function isGameResultMessage(data) {
    return !!(data && typeof data === "object" && data.type === "gameResult");
  }

  // Принимает результат только от активного iframe; отсутствие id разрешает лишь явно совместимая legacy-сессия.
  function isGameResultEventAllowed(event, session) {
    if (!event || !isGameResultMessage(event.data)) return false;
    if (!session || session.resultAccepted || !session.expectedSource) return false;
    if (event.source !== session.expectedSource) return false;

    var data = event.data;
    var hasGameId = Object.prototype.hasOwnProperty.call(data, "gameId");
    var hasSessionId = Object.prototype.hasOwnProperty.call(data, "sessionId");
    if (session.allowLegacyResult === false && (!hasGameId || !hasSessionId)) return false;
    if (
      hasGameId &&
      String(data.gameId) !== String(session.gameId)
    ) return false;
    if (
      hasSessionId &&
      String(data.sessionId) !== String(session.sessionId)
    ) return false;

    return true;
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
    GAME_PROTOCOL_VERSION: GAME_PROTOCOL_VERSION,
    createGameSessionId: createGameSessionId,
    createGameInitMessage: createGameInitMessage,
    isGameResultMessage: isGameResultMessage,
    isGameResultEventAllowed: isGameResultEventAllowed,
    normalizeGameResult: normalizeGameResult
  };
});
