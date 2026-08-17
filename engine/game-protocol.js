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

  /** @typedef {Pick<Crypto, "getRandomValues">} RandomValuesProvider */
  /** @typedef {{type: "gameInit", gameId: unknown, protocolVersion?: number, sessionId?: string, [key: string]: unknown}} GameInitMessage */
  /** @typedef {{type: "gameResult", result?: unknown, gameId?: unknown, sessionId?: unknown, protocolVersion?: unknown}} GameResultMessage */
  /** @typedef {{data: unknown, source: unknown}} GameResultEvent */
  /** @typedef {{resultAccepted: boolean, expectedSource: unknown, gameId: unknown, sessionId: unknown, protocolVersion?: unknown, requireProtocolVersion?: boolean}} GameResultSession */

  var GAME_PROTOCOL_VERSION = 2;

  /**
   * Проверяет номер протокола без неявного принятия дробных, отрицательных и неизвестных версий.
   * @param {unknown} value Значение из сообщения игры.
   * @returns {boolean}
   */
  function isSupportedGameProtocolVersion(value) {
    var numericVersion = Number(value);
    return Number.isInteger(numericVersion) && numericVersion === GAME_PROTOCOL_VERSION;
  }

  /**
   * Создаёт непредсказуемый идентификатор запуска; fallback сохраняет работу в старых браузерах без Web Crypto.
   * @param {RandomValuesProvider | null | undefined} cryptoProvider Явный источник случайных значений для тестов.
   * @returns {string}
   */
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
        var value = /** @type {number} */ (values[i]);
        randomParts.push(value.toString(16).padStart(8, "0"));
      }
      return "game-" + randomParts.join("");
    }

    return "game-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  /**
   * Создаёт gameInit и защищает служебные поля; sessionId включает версию нового протокола без поломки старых вызовов API.
   * @param {unknown} gameId Идентификатор запускаемой игры.
   * @param {Record<string, unknown> | null | undefined} params Пользовательские параметры игры.
   * @param {unknown} sessionId Идентификатор текущего запуска.
   * @returns {GameInitMessage}
   */
  function createGameInitMessage(gameId, params, sessionId) {
    /** @type {GameInitMessage} */
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

  /**
   * Отделяет сообщения с результатом игры от остальных событий postMessage.
   * @param {unknown} data Данные входящего сообщения.
   * @returns {data is GameResultMessage}
   */
  function isGameResultMessage(data) {
    return !!(
      data &&
      typeof data === "object" &&
      /** @type {{type?: unknown}} */ (data).type === "gameResult"
    );
  }

  /**
   * Принимает результат только от активного iframe; явный номер обязан совпадать, а его отсутствие временно означает прежний v2.
   * @param {GameResultEvent | null | undefined} event Событие от iframe.
   * @param {GameResultSession | null | undefined} session Ожидаемый активный запуск.
   * @returns {boolean}
   */
  function isGameResultEventAllowed(event, session) {
    if (!event || !isGameResultMessage(event.data)) return false;
    if (!session || session.resultAccepted || !session.expectedSource) return false;
    if (event.source !== session.expectedSource) return false;

    var data = event.data;
    var hasGameId = Object.prototype.hasOwnProperty.call(data, "gameId");
    var hasSessionId = Object.prototype.hasOwnProperty.call(data, "sessionId");
    var hasProtocolVersion = Object.prototype.hasOwnProperty.call(data, "protocolVersion");
    if (!hasGameId || !hasSessionId) return false;
    if (String(data.gameId) !== String(session.gameId)) return false;
    if (String(data.sessionId) !== String(session.sessionId)) return false;
    if (hasProtocolVersion) {
      if (!isSupportedGameProtocolVersion(data.protocolVersion)) return false;
      if (Number(data.protocolVersion) !== Number(session.protocolVersion || GAME_PROTOCOL_VERSION)) return false;
    } else if (session.requireProtocolVersion === true) {
      return false;
    }

    return true;
  }

  /**
   * Приводит результат к конечному числу; числовые строки сохраняются ради совместимости со старыми играми.
   * @param {GameResultMessage | null | undefined} resultData Сообщение с результатом.
   * @returns {number}
   */
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
    isSupportedGameProtocolVersion: isSupportedGameProtocolVersion,
    createGameSessionId: createGameSessionId,
    createGameInitMessage: createGameInitMessage,
    isGameResultMessage: isGameResultMessage,
    isGameResultEventAllowed: isGameResultEventAllowed,
    normalizeGameResult: normalizeGameResult
  };
});
