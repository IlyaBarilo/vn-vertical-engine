// Экспортирует единый lifecycle iframe мини-игр для браузерного runtime и прямых Node.js-тестов.
(function(root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VN_GAME_HOST = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createGameHostModule() {
  "use strict";

  var GAME_FRAME_PERMISSIONS_POLICY = [
    "autoplay",
    "accelerometer 'none'",
    "camera 'none'",
    "clipboard-read 'none'",
    "clipboard-write 'none'",
    "display-capture 'none'",
    "fullscreen 'none'",
    "gamepad 'none'",
    "geolocation 'none'",
    "gyroscope 'none'",
    "hid 'none'",
    "magnetometer 'none'",
    "microphone 'none'",
    "payment 'none'",
    "serial 'none'",
    "usb 'none'",
    "xr-spatial-tracking 'none'"
  ].join("; ");

  // Устанавливает неизменяемые ограничения iframe перед каждым явным запуском локальной мини-игры.
  function applyGameFrameSecurity(frame) {
    if (!frame || typeof frame.setAttribute !== "function") return;
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("allow", GAME_FRAME_PERMISSIONS_POLICY);
    frame.setAttribute("referrerpolicy", "no-referrer");
  }

  // Возвращает зарегистрированную пару iframe и модального окна только для известного вида запуска.
  function getFrameConfig(frames, frameKind) {
    if (!frames || !Object.prototype.hasOwnProperty.call(frames, frameKind)) return null;
    var config = frames[frameKind];
    if (!config || !config.frame || !config.modal) return null;
    return config;
  }

  // Определяет видимость модального окна без предположений о конкретной реализации classList в тестах.
  function isFrameVisible(config) {
    return !!(
      config &&
      config.modal &&
      config.modal.classList &&
      typeof config.modal.classList.contains === "function" &&
      !config.modal.classList.contains("hidden")
    );
  }

  // Создаёт контроллер одной активной игровой сессии с явными зависимостями и очисткой обработчика message.
  function createGameHost(options) {
    options = options || {};

    var eventTarget = options.eventTarget;
    var protocol = options.protocol;
    var frames = options.frames || {};
    var activeLaunch = null;
    var disposed = false;

    if (!eventTarget || typeof eventTarget.addEventListener !== "function" || typeof eventTarget.removeEventListener !== "function") {
      throw new Error("Game host requires an event target with addEventListener/removeEventListener");
    }
    if (
      !protocol ||
      typeof protocol.createGameSessionId !== "function" ||
      typeof protocol.createGameInitMessage !== "function" ||
      typeof protocol.isGameResultEventAllowed !== "function"
    ) {
      throw new Error("Game host requires the VN_GAME_PROTOCOL API");
    }

    // Передаёт предупреждение координатору, не связывая модуль с режимом консольной диагностики движка.
    function reportWarning(message, frameKind) {
      if (typeof options.onWarning === "function") {
        options.onWarning(message, frameKind);
      }
    }

    // Сбрасывает визуальное состояние одного iframe и вызывает относящуюся к нему UI-очистку координатора.
    function resetFrameConfig(config) {
      if (!config) return;
      if (config.modal.classList && typeof config.modal.classList.add === "function") {
        config.modal.classList.add("hidden");
      }
      config.frame.onload = null;
      config.frame.src = "about:blank";
      if (typeof config.onClose === "function") config.onClose();
    }

    // Инвалидирует активную сессию выбранного iframe и гарантированно возвращает его к about:blank.
    function closeFrame(frameKind) {
      var config = getFrameConfig(frames, frameKind);
      if (!config) return false;

      if (activeLaunch && activeLaunch.frameKind === frameKind) {
        activeLaunch.session.resultAccepted = true;
        activeLaunch.session.expectedSource = null;
        activeLaunch = null;
      }

      resetFrameConfig(config);
      return true;
    }

    // Проверяет возможность нового запуска, включая единственность сессии и фактическую видимость обеих модалок.
    function canOpen(frameKind, warnOnReject) {
      var config = getFrameConfig(frames, frameKind);
      var frameKinds = Object.keys(frames);
      var blocked = disposed || !config || !!activeLaunch;

      for (var frameIndex = 0; frameIndex < frameKinds.length && !blocked; frameIndex++) {
        blocked = isFrameVisible(getFrameConfig(frames, frameKinds[frameIndex]));
      }

      if (blocked && warnOnReject) {
        reportWarning("[GAME] Новый запуск отклонён: другая мини-игра уже активна", frameKind);
      }
      return !blocked;
    }

    // Создаёт одноразовую сессию протокола и сохраняет точный iframe, от которого ожидается результат.
    function createSession(gameId, frameKind) {
      return {
        gameId: String(gameId),
        sessionId: protocol.createGameSessionId(),
        protocolVersion: protocol.GAME_PROTOCOL_VERSION,
        requireProtocolVersion: false,
        expectedSource: null,
        frameKind: frameKind,
        resultAccepted: false
      };
    }

    // Каждый запуск получает новый iframe: запоздалый load старого about:blank не может выдать init или закрыть новую игру.
    function open(launch) {
      launch = launch || {};
      var frameKind = String(launch.frameKind || "");
      var config = getFrameConfig(frames, frameKind);

      if (!launch.src || !launch.gameId || !canOpen(frameKind, true)) return null;

      var frameKinds = Object.keys(frames);
      for (var frameIndex = 0; frameIndex < frameKinds.length; frameIndex++) {
        if (frameKinds[frameIndex] !== frameKind) closeFrame(frameKinds[frameIndex]);
      }

      var previousFrame = config.frame;
      var gameFrame = previousFrame.cloneNode(false);
      gameFrame.removeAttribute("src");
      gameFrame.removeAttribute("srcdoc");
      config.frame = gameFrame;
      var session = createSession(launch.gameId, frameKind);
      var openedLaunch = {
        frameKind: frameKind,
        frame: gameFrame,
        gameId: String(launch.gameId),
        params: launch.params && typeof launch.params === "object" ? launch.params : {},
        loadHandled: false,
        session: session
      };
      activeLaunch = openedLaunch;

      try {
        applyGameFrameSecurity(config.frame);
        // Геометрия модалки должна быть готова до вставки iframe: игры вычисляют масштаб уже в своём стартовом скрипте.
        if (config.modal.classList && typeof config.modal.classList.remove === "function") {
          config.modal.classList.remove("hidden");
        }
        if (typeof config.onOpen === "function") config.onOpen(launch);
        if (typeof previousFrame.getBoundingClientRect === "function") previousFrame.getBoundingClientRect();
        // WindowProxy сохраняется при навигации, поэтому одного сравнения contentWindow недостаточно для повторного load.
        config.frame.onload = function handleGameFrameLoad() {
          if (!activeLaunch || activeLaunch !== openedLaunch) return;
          if (openedLaunch.loadHandled) {
            // Сначала отзываем сессию и очищаем iframe, затем разрешаем координатору восстановить UI.
            closeFrame(frameKind);
            reportWarning("[GAME] Игра остановлена: повторная навигация iframe запрещена.", frameKind);
            if (typeof options.onNavigationBlocked === "function") options.onNavigationBlocked(openedLaunch);
            return;
          }
          openedLaunch.loadHandled = true;
          if (session.resultAccepted) return;

          var gameWindow = config.frame.contentWindow;
          if (!gameWindow || typeof gameWindow.postMessage !== "function") return;
          session.expectedSource = gameWindow;

          var payload = protocol.createGameInitMessage(openedLaunch.gameId, openedLaunch.params, session.sessionId);
          try {
            gameWindow.postMessage(payload, "*");
            if (typeof options.onInitSent === "function") options.onInitSent(openedLaunch, payload);
          } catch (error) {
            if (typeof options.onPostMessageError === "function") {
              options.onPostMessageError(error, openedLaunch);
            }
          }
        };

        // Назначаем URL и обработчик до вставки: новый iframe не проходит промежуточную загрузку about:blank.
        gameFrame.src = String(launch.src);
        previousFrame.onload = null;
        previousFrame.replaceWith(gameFrame);
        if (typeof options.onFrameReplaced === "function") options.onFrameReplaced(frameKind, gameFrame);
        return session;
      } catch (error) {
        closeFrame(frameKind);
        throw error;
      }
    }

    // Принимает только первое сообщение активной сессии и передаёт координатору уже проверенное событие.
    function handleGameResultMessage(event) {
      if (disposed || !activeLaunch || activeLaunch.session.resultAccepted) return;
      if (!protocol.isGameResultEventAllowed(event, activeLaunch.session)) return;

      var acceptedLaunch = activeLaunch;
      acceptedLaunch.session.resultAccepted = true;
      if (typeof options.onResult === "function") options.onResult(event, acceptedLaunch);
    }

    // Возвращает активную сессию только для диагностики и связи с состоянием координатора.
    function getActiveSession() {
      return activeLaunch ? activeLaunch.session : null;
    }

    // Удаляет глобальный обработчик и очищает все iframe, не оставляя активной сессии после завершения runtime.
    function dispose() {
      if (disposed) return;
      eventTarget.removeEventListener("message", handleGameResultMessage);

      var frameKinds = Object.keys(frames);
      for (var frameIndex = 0; frameIndex < frameKinds.length; frameIndex++) {
        closeFrame(frameKinds[frameIndex]);
      }

      activeLaunch = null;
      disposed = true;
    }

    eventTarget.addEventListener("message", handleGameResultMessage);

    return Object.freeze({
      canOpen: canOpen,
      open: open,
      closeFrame: closeFrame,
      getActiveSession: getActiveSession,
      dispose: dispose
    });
  }

  return {
    GAME_FRAME_PERMISSIONS_POLICY: GAME_FRAME_PERMISSIONS_POLICY,
    applyGameFrameSecurity: applyGameFrameSecurity,
    createGameHost: createGameHost
  };
});
