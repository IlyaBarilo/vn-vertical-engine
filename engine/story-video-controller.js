// Экспортирует lifecycle полноэкранного сюжетного видео без доступа к глобальному состоянию новеллы.
(function(root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VN_STORY_VIDEO_CONTROLLER = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createStoryVideoControllerModule() {
  "use strict";

  var DEFAULT_FALLBACK_DURATION = 5;
  var SEEK_TIMEOUT_MS = 2500;
  var SKIP_GUARD_MS = 450;
  var OVERLAY_EVENT_TYPES = ["pointerup", "click", "touchend"];

  // Ограничивает числовую громкость без зависимости от утилит центрального runtime.
  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // Создаёт контроллер одного переиспользуемого video-слоя, постера и fallback-состояния.
  function createStoryVideoController(options) {
    options = options || {};

    var overlay = options.overlay || null;
    var video = options.video || null;
    var poster = options.poster || null;
    var fallbackText = options.fallbackText || null;
    var skipHint = options.skipHint || null;
    var eventTarget = options.eventTarget || null;
    var setTimeoutFn = options.setTimeout || setTimeout;
    var clearTimeoutFn = options.clearTimeout || clearTimeout;
    var now = options.now || Date.now;
    var lifecycleStarted = false;
    var disposed = false;

    var state = {
      action: null,
      done: false,
      fallback: false,
      skipAllowed: true,
      skipEnabledAt: 0,
      keepUntilBgVideoReady: false,
      seekTimer: null,
      stopTimer: null,
      fallbackTimer: null
    };

    // Передаёт предупреждение координатору либо использует консоль как безопасный fallback.
    function warn() {
      if (typeof options.warn === "function") {
        options.warn.apply(null, arguments);
      } else if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn.apply(console, arguments);
      }
    }

    // Записывает подробное сообщение только через внедрённый runtime-logger.
    function verbose() {
      if (typeof options.writeVerbose === "function") {
        options.writeVerbose.apply(null, arguments);
      }
    }

    // Отправляет структурированный визуальный trace координатору, не зная его debug-режима.
    function trace(label, details) {
      if (typeof options.visualTrace === "function") options.visualTrace(label, details || {});
    }

    // Получает локализованную строку интерфейса с англоязычным запасным значением.
    function translate(key, fallback) {
      var value = typeof options.translate === "function" ? options.translate(key) : "";
      return value || fallback;
    }

    // Подставляет сценарные переменные в пользовательскую подпись через координатор.
    function renderText(value) {
      return typeof options.renderText === "function" ? options.renderText(value) : String(value || "");
    }

    // Повторно проверяет путь видео или постера общей политикой ресурсов.
    function resolveAssetUrl(value, kind) {
      return typeof options.resolveAssetUrl === "function" ? options.resolveAssetUrl(value, kind) : String(value || "");
    }

    // Нормализует назначенный media.src для диагностики и сравнения.
    function normalizeUrl(value) {
      return typeof options.normalizeUrl === "function" ? options.normalizeUrl(value) : String(value || "");
    }

    // Очищает URL перед предупреждением, чтобы не раскрывать query/hash и встроенные данные.
    function sanitizeResource(value) {
      return typeof options.sanitizeResource === "function" ? options.sanitizeResource(value) : String(value || "");
    }

    // Применяет громкость сюжетного видео через единый аудиоконтроллер.
    function setStoryVideoVolume(value) {
      if (typeof options.setStoryVideoVolume === "function") options.setStoryVideoVolume(value);
    }

    // Пересчитывает общий BGM ducking после появления, fallback или завершения ролика.
    function updateAudioDucking(reason) {
      if (typeof options.updateAudioDucking === "function") options.updateAudioDucking(reason);
    }

    // Отменяет все отложенные переходы, чтобы события предыдущего ролика не завершили новый.
    function clearTimers() {
      if (state.seekTimer) {
        clearTimeoutFn(state.seekTimer);
        state.seekTimer = null;
      }
      if (state.stopTimer) {
        clearTimeoutFn(state.stopTimer);
        state.stopTimer = null;
      }
      if (state.fallbackTimer) {
        clearTimeoutFn(state.fallbackTimer);
        state.fallbackTimer = null;
      }
    }

    // Снимает одноразовые media-обработчики перед новым src или окончательной очисткой.
    function resetMediaHandlers() {
      if (!video) return;
      video.onloadedmetadata = null;
      video.onloadeddata = null;
      video.onseeked = null;
      video.ontimeupdate = null;
      video.onended = null;
      video.onerror = null;
    }

    // Ограничивает fit двумя поддерживаемыми режимами, сохраняя прежний cover по умолчанию.
    function normalizeFit(fit) {
      return String(fit || "cover").toLowerCase() === "contain" ? "contain" : "cover";
    }

    // Синхронно применяет одинаковое кадрирование к видео и fallback-постеру.
    function applyFit(fit) {
      var objectFit = normalizeFit(fit);
      if (video) video.style.objectFit = objectFit;
      if (poster) poster.style.objectFit = objectFit;
    }

    // Показывает локализованную подсказку пропуска с актуальными сценарными переменными.
    function setSkipHint(text, visible) {
      if (!skipHint) return;
      skipHint.textContent = renderText(String(text || translate("videoSkipHint", "Click to skip")));
      skipHint.classList.toggle("hidden", !visible);
    }

    // Показывает проверенный постер и передаёт его подсистемам scroll и blur.
    function showPoster(posterSrc, fit) {
      if (!poster) return;
      applyFit(fit);
      poster.onload = null;
      if (posterSrc) {
        poster.onload = function updatePosterScrollAfterLoad() {
          if (typeof options.isScrollTarget === "function" && options.isScrollTarget(poster)) {
            if (typeof options.updateScrollAvailability === "function") options.updateScrollAvailability();
          }
        };
        poster.src = posterSrc;
        poster.classList.remove("hidden");
        if (typeof options.switchScrollTarget === "function") options.switchScrollTarget(poster);
        if (typeof options.updateBlurBackground === "function") options.updateBlurBackground(posterSrc);
      } else {
        if (typeof poster.removeAttribute === "function") poster.removeAttribute("src");
        poster.classList.add("hidden");
      }
    }

    // Убирает визуальные слои и media-ресурсы без продвижения сценария, что важно для restart и dispose.
    function cleanupVisualOnly() {
      trace("storyVideo:cleanup:start", {});
      state.keepUntilBgVideoReady = false;
      clearTimers();
      resetMediaHandlers();

      if (video) {
        try { video.pause(); } catch (error) {
          // Ошибка Media API не должна прерывать очистку источника и UI.
        }
        if (typeof video.removeAttribute === "function") video.removeAttribute("src");
        if (typeof video.load === "function") video.load();
        video.classList.add("hidden");
      }
      if (poster) {
        poster.onload = null;
        if (typeof poster.removeAttribute === "function") poster.removeAttribute("src");
        poster.classList.add("hidden");
      }
      if (fallbackText) fallbackText.classList.add("hidden");
      setSkipHint("", false);
      if (overlay) overlay.classList.add("hidden");
      if (typeof options.restoreBackgroundScroll === "function") options.restoreBackgroundScroll();
      setStoryVideoVolume(0);
      trace("storyVideo:cleanup:end", {});
    }

    // Удаляет удержанный финальный кадр только после готовности следующего фонового видео.
    function hideKeptAfterBackgroundReady(reason) {
      if (!state.keepUntilBgVideoReady) return;
      trace("storyVideo:kept-layer-hide", { reason: reason || "bg ready" });
      cleanupVisualOnly();
      verbose("[VIDEO] kept story video layer hidden:", reason || "bg ready");
    }

    // Завершает ролик ровно один раз и сообщает координатору, что можно продолжить runtime-очередь.
    function finish(reason) {
      if (state.done || disposed) return;
      state.done = true;
      var keepUntilReady = typeof options.shouldKeepUntilBackgroundVideo === "function" && options.shouldKeepUntilBackgroundVideo();
      trace("storyVideo:finish", {
        reason: reason || "done",
        keepUntilBgVideoReady: keepUntilReady
      });

      if (keepUntilReady) {
        clearTimers();
        resetMediaHandlers();
        state.keepUntilBgVideoReady = true;
        trace("storyVideo:keep-until-bg-video", { reason: reason || "done" });
        setSkipHint("", false);
        if (fallbackText) fallbackText.classList.add("hidden");
        if (video) {
          try { video.pause(); } catch (error) {
            // Ошибка Media API не должна мешать скрытию остановленного видео.
          }
        }
        setStoryVideoVolume(0);
      } else {
        cleanupVisualOnly();
      }

      if (typeof options.onFinish === "function") options.onFinish(reason || "done");
    }

    // Переводит ошибочный или заблокированный ролик в ограниченный по времени poster/text fallback.
    function showFallback(action, reason) {
      if (state.done || disposed) return;
      clearTimers();
      resetMediaHandlers();

      var fallbackDuration = Math.max(
        0.1,
        Number(action && action.fallbackDuration !== undefined ? action.fallbackDuration : DEFAULT_FALLBACK_DURATION)
      );
      var posterSrc = action && action.poster ? resolveAssetUrl(action.poster, "image") : "";
      var skipText = (action && action.skipText) || translate("videoSkipHint", "Click to skip");
      trace("storyVideo:fallback", {
        reason: reason || "fallback",
        posterSrc: posterSrc,
        fallbackDuration: fallbackDuration
      });

      state.fallback = true;
      state.skipAllowed = true;
      state.skipEnabledAt = now();
      setStoryVideoVolume(0);
      updateAudioDucking("story video fallback: " + (reason || "fallback"));

      if (video) {
        try { video.pause(); } catch (error) {
          // Ошибка Media API не должна мешать показу текстового fallback.
        }
        video.classList.add("hidden");
      }
      if (overlay) overlay.classList.remove("hidden");
      showPoster(posterSrc, action && action.fit);
      if (fallbackText) {
        fallbackText.textContent = posterSrc ? "" : translate("videoUnavailable", "Video unavailable");
        fallbackText.classList.toggle("hidden", !!posterSrc);
      }
      setSkipHint(skipText, true);
      state.fallbackTimer = setTimeoutFn(function finishStoryFallbackAfterDelay() {
        finish("fallback timeout");
      }, fallbackDuration * 1000);
    }

    // Начинает воспроизведение после готовности metadata и необязательного seek к start.
    function startPlayback(action) {
      if (!video || state.done || disposed) return;
      var volume = (typeof options.clamp === "function" ? options.clamp : clampNumber)(
        typeof action.volume === "number" ? action.volume : 0,
        0,
        1
      );
      var stopAt = typeof action.stop === "number" ? action.stop : null;
      state.fallback = false;
      setStoryVideoVolume(volume);
      if (volume > 0) updateAudioDucking("story video shown");

      if (poster) poster.classList.add("hidden");
      if (fallbackText) fallbackText.classList.add("hidden");
      video.classList.remove("hidden");
      if (typeof options.switchScrollTarget === "function") options.switchScrollTarget(video);
      if (typeof options.updateScrollAvailability === "function") options.updateScrollAvailability();
      trace("storyVideo:playback-start", {
        src: normalizeUrl(video.currentSrc || video.src || ""),
        currentTime: Number(video.currentTime.toFixed(3)),
        stopAt: stopAt,
        volume: volume
      });

      if (stopAt !== null) {
        var msLeft = Math.max(0, (stopAt - video.currentTime) * 1000);
        state.stopTimer = setTimeoutFn(function finishStoryVideoAtStop() {
          finish("stop reached");
        }, msLeft + 80);
      }
      video.ontimeupdate = function finishStoryVideoFromTimeUpdate() {
        if (stopAt !== null && video.currentTime >= stopAt) finish("stop reached");
      };

      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.then(function reportStoryVideoPlaySuccess() {
          trace("storyVideo:play-resolved", { src: normalizeUrl(video.currentSrc || video.src || "") });
        }).catch(function reportStoryVideoPlayFailure(error) {
          warn("[VIDEO] story video play failed:", error);
          trace("storyVideo:play-failed", { error: error && error.name ? error.name : String(error) });
          showFallback(action, "play failed");
        });
      }
    }

    // Выполняет seek только после metadata и переводит зависший или недопустимый переход в fallback.
    function prepareSeek(action) {
      if (!video || state.done || disposed) return;
      var startAt = typeof action.start === "number" ? action.start : 0;
      var duration = video.duration;
      trace("storyVideo:metadata", {
        startAt: startAt,
        stop: typeof action.stop === "number" ? action.stop : null,
        duration: isFinite(duration) ? Number(duration.toFixed(3)) : null
      });

      if (startAt > 0 && isFinite(duration) && startAt >= duration) {
        showFallback(action, "start beyond duration");
        return;
      }
      if (startAt <= 0) {
        startPlayback(action);
        return;
      }

      state.seekTimer = setTimeoutFn(function showStoryVideoSeekTimeout() {
        trace("storyVideo:seek-timeout", { startAt: startAt });
        showFallback(action, "seek timeout");
      }, SEEK_TIMEOUT_MS);
      video.onseeked = function startStoryVideoAfterSeek() {
        if (state.seekTimer) {
          clearTimeoutFn(state.seekTimer);
          state.seekTimer = null;
        }
        trace("storyVideo:seeked", { currentTime: Number(video.currentTime.toFixed(3)) });
        startPlayback(action);
      };

      try {
        trace("storyVideo:seek-start", { startAt: startAt });
        video.currentTime = startAt;
      } catch (error) {
        warn("[VIDEO] story video seek failed:", error);
        trace("storyVideo:seek-failed", { error: error && error.name ? error.name : String(error) });
        showFallback(action, "seek failed");
      }
    }

    // Подготавливает новый сюжетный ролик, его scroll/focus, постер и одноразовые media-обработчики.
    function start(action) {
      if (disposed) return false;
      if (!action || !action.src || !overlay || !video) {
        if (typeof options.onUnavailable === "function") options.onUnavailable(action);
        return false;
      }

      cleanupVisualOnly();
      state.action = action;
      state.done = false;
      state.fallback = false;
      state.skipAllowed = action.skippable !== false;
      state.skipEnabledAt = now() + SKIP_GUARD_MS;

      var src = resolveAssetUrl(action.src, "video");
      var posterSrc = action.poster ? resolveAssetUrl(action.poster, "image") : "";
      if (!src) {
        showFallback({
          poster: action.poster || "",
          fallbackDuration: action.fallbackDuration,
          skipText: action.skipText
        }, "unsafe_source");
        return true;
      }

      var fit = normalizeFit(action.fit);
      var skipText = action.skipText || translate("videoSkipHint", "Click to skip");
      trace("storyVideo:start", {
        src: src,
        posterSrc: posterSrc,
        fit: fit,
        skippable: state.skipAllowed,
        skipEnabledAt: state.skipEnabledAt
      });

      applyFit(fit);
      overlay.classList.remove("hidden");
      if (typeof options.setScrollOptions === "function") {
        options.setScrollOptions(action, posterSrc ? poster : video);
      }
      showPoster(posterSrc, fit);
      setSkipHint(skipText, state.skipAllowed);
      resetMediaHandlers();
      video.loop = false;
      video.playsInline = true;
      video.preload = "auto";
      video.classList.add("hidden");

      video.onerror = function showStoryVideoLoadFallback() {
        warn("[VIDEO] story video load error:", sanitizeResource(src));
        trace("storyVideo:error", { src: src });
        showFallback(action, "load error");
      };
      video.onended = function finishStoryVideoFromEnded() {
        trace("storyVideo:ended", { currentTime: Number(video.currentTime.toFixed(3)) });
        finish("ended");
      };
      video.onloadeddata = function syncStoryVideoAfterData() {
        trace("storyVideo:loadeddata", {
          currentTime: Number(video.currentTime.toFixed(3)),
          readyState: video.readyState
        });
        if (typeof options.syncBlurVideo === "function") options.syncBlurVideo(video, posterSrc);
        if (typeof options.isScrollTarget === "function" && options.isScrollTarget(video)) {
          if (typeof options.updateScrollAvailability === "function") options.updateScrollAvailability();
        }
      };
      video.onloadedmetadata = function prepareStoryVideoAfterMetadata() {
        prepareSeek(action);
      };

      setStoryVideoVolume(0);
      video.src = src;
      trace("storyVideo:src-set", { src: src });
      video.load();
      return true;
    }

    // Поглощает событие пропуска с guard-периодом и завершает только разрешённый ролик или fallback.
    function handleSkip(event) {
      if (typeof options.isStoryVideoActive === "function" && !options.isStoryVideoActive()) return;
      if (
        event &&
        event.type === "pointerup" &&
        typeof options.isScrollDragging === "function" &&
        options.isScrollDragging() &&
        typeof options.finishScrollPointer === "function"
      ) {
        options.finishScrollPointer(event);
      }
      if (typeof options.consumeSuppressedClick === "function" && options.consumeSuppressedClick()) {
        if (typeof options.swallowEvent === "function") options.swallowEvent(event);
        return;
      }
      if (now() < (state.skipEnabledAt || 0)) {
        trace("storyVideo:skip-guard", { now: now(), skipEnabledAt: state.skipEnabledAt });
        if (typeof options.swallowEvent === "function") options.swallowEvent(event);
        return;
      }
      if (!state.skipAllowed && !state.fallback) return;
      if (typeof options.swallowEvent === "function") options.swallowEvent(event);
      trace("storyVideo:skip", { fallback: state.fallback });
      finish("skip");
    }

    // Преобразует Escape/Enter/Space в тот же безопасный путь пропуска, что pointer-события overlay.
    function handleKeyDown(event) {
      if (typeof options.isStoryVideoActive === "function" && !options.isStoryVideoActive()) return;
      var key = event && event.key ? event.key : "";
      if (key === "Escape" || key === "Enter" || key === " ") handleSkip(event);
    }

    // Один раз подключает overlay и keyboard-обработчики, сохраняя их для явного dispose.
    function startLifecycle() {
      if (lifecycleStarted || disposed) return;
      lifecycleStarted = true;
      if (overlay) {
        OVERLAY_EVENT_TYPES.forEach(function attachStoryVideoOverlayEvent(type) {
          overlay.addEventListener(type, handleSkip, true);
        });
      }
      if (eventTarget && typeof eventTarget.addEventListener === "function") {
        eventTarget.addEventListener("keydown", handleKeyDown, true);
      }
    }

    // Снимает глобальные обработчики и освобождает video/poster без продвижения истории.
    function dispose() {
      if (disposed) return;
      if (lifecycleStarted && overlay) {
        OVERLAY_EVENT_TYPES.forEach(function detachStoryVideoOverlayEvent(type) {
          overlay.removeEventListener(type, handleSkip, true);
        });
      }
      if (lifecycleStarted && eventTarget && typeof eventTarget.removeEventListener === "function") {
        eventTarget.removeEventListener("keydown", handleKeyDown, true);
      }
      cleanupVisualOnly();
      state.done = true;
      disposed = true;
    }

    return Object.freeze({
      state: state,
      startLifecycle: startLifecycle,
      start: start,
      finish: finish,
      showFallback: showFallback,
      hideKeptAfterBackgroundReady: hideKeptAfterBackgroundReady,
      cleanupVisualOnly: cleanupVisualOnly,
      handleSkip: handleSkip,
      dispose: dispose
    });
  }

  return {
    DEFAULT_FALLBACK_DURATION: DEFAULT_FALLBACK_DURATION,
    SEEK_TIMEOUT_MS: SEEK_TIMEOUT_MS,
    SKIP_GUARD_MS: SKIP_GUARD_MS,
    createStoryVideoController: createStoryVideoController
  };
});
