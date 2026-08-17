// Экспортирует lifecycle обычных фоновых изображений/видео и их blur-дубликата без логики 360-панорам.
(function(root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VN_BACKGROUND_MEDIA_CONTROLLER = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createBackgroundMediaControllerModule() {
  "use strict";

  // Ограничивает громкость видео диапазоном 0..1 без зависимости от центральных утилит.
  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // Создаёт контроллер основного 2D-фона и неактивного blur-video кадра с явной очисткой ресурсов.
  function createBackgroundMediaController(options) {
    options = options || {};

    var image = options.image || null;
    var video = options.video || null;
    var container = options.container || null;
    var blurLayer = options.blurLayer || null;
    var blurImage = options.blurImage || null;
    var blurVideo = options.blurVideo || null;
    var failedImages = options.failedImages || Object.create(null);
    var setTimeoutFn = options.setTimeout || setTimeout;
    var clearTimeoutFn = options.clearTimeout || clearTimeout;
    var disposed = false;
    var blurSyncSeq = 0;
    var metadataHandler = null;
    var blurLoadedHandler = null;
    var refreshLoadedHandler = null;
    var refreshTimers = [];

    // Передаёт предупреждение координатору либо безопасно использует console.warn.
    function warn() {
      if (typeof options.warn === "function") {
        options.warn.apply(null, arguments);
      } else if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn.apply(console, arguments);
      }
    }

    // Записывает подробную диагностику через режим, выбранный центральным runtime.
    function verbose() {
      if (typeof options.writeVerbose === "function") options.writeVerbose.apply(null, arguments);
    }

    // Отправляет структурированный снимок визуальной операции только внедрённому trace-механизму.
    function trace(label, details) {
      if (typeof options.visualTrace === "function") options.visualTrace(label, details || {});
    }

    // Нормализует сценарные scroll/focus параметры через общий координатор медиа.
    function normalizeScrollOptions(value) {
      return typeof options.normalizeScrollOptions === "function" ? options.normalizeScrollOptions(value) : (value || {});
    }

    // Повторно проверяет путь с учётом требуемого типа ресурса.
    function resolveAssetUrl(value, kind) {
      return typeof options.resolveAssetUrl === "function" ? options.resolveAssetUrl(value, kind) : String(value || "");
    }

    // Приводит уже назначенный src к форме, используемой failed-cache и stale-event проверками.
    function normalizeUrl(value) {
      return typeof options.normalizeUrl === "function" ? options.normalizeUrl(value) : String(value || "");
    }

    // Очищает URL только для диагностического вывода.
    function sanitizeResource(value) {
      return typeof options.sanitizeResource === "function" ? options.sanitizeResource(value) : String(value || "");
    }

    // Определяет видео по той же таблице расширений, которую использует координатор графа и панорам.
    function isVideoPath(value) {
      return typeof options.isVideoPath === "function" && options.isVideoPath(value);
    }

    // Отменяет сохранённый loadedmetadata предыдущего видео, чтобы он не восстанавливал старый scroll.
    function clearMetadataHandler() {
      if (video && metadataHandler) video.removeEventListener("loadedmetadata", metadataHandler);
      metadataHandler = null;
    }

    // Снимает ожидающий loadeddata retry, если фон сменился или runtime завершает работу раньше события.
    function clearRefreshLoadedHandler() {
      if (video && refreshLoadedHandler) video.removeEventListener("loadeddata", refreshLoadedHandler);
      refreshLoadedHandler = null;
    }

    // Останавливает и очищает основной видеофон при переходе к картинке, панораме или dispose.
    function clearBackgroundVideo() {
      if (!video) return;
      clearMetadataHandler();
      clearRefreshLoadedHandler();
      video.onloadeddata = null;
      video.onerror = null;
      try { video.pause(); } catch (error) {}
      if (typeof video.removeAttribute === "function") video.removeAttribute("src");
      try {
        if (typeof video.load === "function") video.load();
      } catch (error2) {}
      video.classList.add("hidden");
    }

    // Останавливает blur-video и удаляет его src, не затрагивая основной фон.
    function hideBlurVideo() {
      if (!blurVideo) return;
      if (blurLoadedHandler) blurVideo.removeEventListener("loadeddata", blurLoadedHandler);
      blurLoadedHandler = null;
      blurVideo.onerror = null;
      try { blurVideo.pause(); } catch (error) {}
      if (typeof blurVideo.removeAttribute === "function") blurVideo.removeAttribute("src");
      try {
        if (typeof blurVideo.load === "function") blurVideo.load();
      } catch (error2) {}
      blurVideo.classList.add("hidden");
    }

    // Копирует pan/zoom стили основного видео на остановленный blur-дубликат.
    function copyVideoPositionToBlur(sourceVideo, targetVideo) {
      if (!sourceVideo || !targetVideo || !sourceVideo.style) return;
      targetVideo.style.objectPosition = sourceVideo.style.objectPosition || "";
      targetVideo.style.transform = sourceVideo.style.transform || "";
      targetVideo.style.transformOrigin = sourceVideo.style.transformOrigin || "";
    }

    // Показывает размытый фон из изображения либо полностью скрывает blur-слой по настройке истории.
    function updateBlurBackground(src) {
      if (!blurLayer || !blurImage) {
        warn("[Engine] Элементы размытого фона не найдены");
        return;
      }
      if (typeof options.isBlurEnabled === "function" && !options.isBlurEnabled()) {
        blurLayer.classList.add("hidden");
        hideBlurVideo();
        return;
      }

      if (src) {
        hideBlurVideo();
        blurImage.classList.remove("hidden");
        if (typeof options.assignRasterImage === "function") options.assignRasterImage(blurImage, src, {});
        blurLayer.classList.remove("hidden");
        blurLayer.style.display = "block";
        blurImage.style.objectFit = "cover";
        blurImage.style.width = "100%";
        blurImage.style.height = "100%";
      } else {
        blurLayer.classList.add("hidden");
        hideBlurVideo();
      }
    }

    // Ставит blur-дубликат видео на кадр 0 и при ошибке использует объявленный или найденный image fallback.
    function syncBlurVideo(sourceVideo, fallbackSrc) {
      if (!blurLayer || !blurImage || (typeof options.isBlurEnabled === "function" && !options.isBlurEnabled())) return;

      var fallbackTrim = typeof fallbackSrc === "string" ? fallbackSrc.trim() : "";
      var sourceForFallback = sourceVideo ? normalizeUrl(sourceVideo.currentSrc || sourceVideo.src || "") : "";
      var imageFallback = fallbackTrim || (
        typeof options.findVideoFallbackImage === "function" ? options.findVideoFallbackImage(sourceForFallback) : ""
      );

      // Единый fallback скрывает video-дубликат и не оставляет пустой blur-слой видимым.
      function applyImageFallback() {
        hideBlurVideo();
        if (imageFallback) updateBlurBackground(imageFallback);
        else blurLayer.classList.add("hidden");
      }

      if (!blurVideo) {
        if (imageFallback) updateBlurBackground(imageFallback);
        return;
      }

      var seq = ++blurSyncSeq;
      if (!sourceVideo) {
        applyImageFallback();
        return;
      }

      var targetUrl = normalizeUrl(sourceVideo.currentSrc || sourceVideo.src || "");
      trace("blurVideoSync:start", { fallbackSrc: imageFallback, videoSrc: targetUrl });
      if (!targetUrl) {
        trace("blurVideoSync:no-src", {});
        applyImageFallback();
        return;
      }

      if (typeof blurImage.removeAttribute === "function") blurImage.removeAttribute("src");
      blurImage.classList.add("hidden");
      blurVideo.classList.remove("hidden");
      blurVideo.muted = true;
      blurVideo.defaultMuted = true;
      blurVideo.loop = false;
      blurVideo.autoplay = false;
      if ("playsInline" in blurVideo) blurVideo.playsInline = true;
      blurVideo.setAttribute("playsinline", "");
      blurVideo.preload = "auto";

      // Финализирует только актуальное поколение sync и не запускает второй декодирующий playback.
      function finalizeBlurVideoFrame() {
        if (seq !== blurSyncSeq || disposed) return;
        try {
          blurVideo.pause();
          blurVideo.currentTime = 0;
        } catch (error) {}
        copyVideoPositionToBlur(sourceVideo, blurVideo);
        blurVideo.style.objectFit = "cover";
        blurVideo.style.width = "100%";
        blurVideo.style.height = "100%";
        blurLayer.classList.remove("hidden");
        blurLayer.style.display = "block";
        trace("blurVideoSync:ready", {
          videoWidth: blurVideo.videoWidth,
          videoHeight: blurVideo.videoHeight
        });
      }

      blurVideo.onerror = function handleBlurVideoError() {
        if (seq !== blurSyncSeq || disposed) return;
        trace("blurVideoSync:error", { videoSrc: targetUrl });
        applyImageFallback();
      };

      var sameSrc = normalizeUrl(blurVideo.currentSrc || blurVideo.src || "") === targetUrl && !!(blurVideo.currentSrc || blurVideo.src);
      if (sameSrc && blurVideo.readyState >= 2) {
        finalizeBlurVideoFrame();
        return;
      }

      if (blurLoadedHandler) blurVideo.removeEventListener("loadeddata", blurLoadedHandler);
      blurLoadedHandler = function finalizeBlurVideoAfterData() {
        blurLoadedHandler = null;
        finalizeBlurVideoFrame();
      };
      blurVideo.addEventListener("loadeddata", blurLoadedHandler, { once: true });
      blurVideo.src = sourceVideo.currentSrc || sourceVideo.src || "";
      try { blurVideo.load(); } catch (error) {}

      refreshTimers.push(setTimeoutFn(function showBlurFallbackAfterTimeout() {
        if (seq !== blurSyncSeq || disposed) return;
        if (!blurVideo.videoWidth && imageFallback) {
          trace("blurVideoSync:timeout-fallback", { videoSrc: targetUrl });
          applyImageFallback();
        }
      }, 600));
    }

    // Повторяет синхронизацию blur после восстановления того же bg-video, когда loadeddata может не прийти заново.
    function scheduleBlurRefreshFromVideo(fallbackSrc) {
      if (typeof options.isBlurEnabled === "function" && !options.isBlurEnabled()) return;
      var fallback = typeof fallbackSrc === "string" ? fallbackSrc : "";

      // Подтягивает blur только из всё ещё видимого и назначенного основного видео.
      function tick() {
        if (disposed || !video || video.classList.contains("hidden")) return;
        if (!(video.currentSrc || video.src)) return;
        syncBlurVideo(video, fallback);
      }

      clearRefreshLoadedHandler();
      if (video) {
        refreshLoadedHandler = function refreshBlurAfterBackgroundData() {
          refreshLoadedHandler = null;
          tick();
        };
        video.addEventListener("loadeddata", refreshLoadedHandler, { once: true });
      }
      tick();
      [0, 60, 200, 600].forEach(function scheduleBlurRefresh(delay) {
        refreshTimers.push(setTimeoutFn(tick, delay));
      });
    }

    // Переключает обычный 2D-фон, маршрутизируя 360 отдельно и сохраняя fallback/scroll/audio поведение.
    function setBackground(src, fallbackSrc, videoVolume, scrollOptions) {
      if (disposed) return;
      var normalizedScroll = normalizeScrollOptions(scrollOptions);
      var use360 = normalizedScroll.is360 === true;

      if (!src) {
        trace("setBackground:empty-src", { fallbackSrc: fallbackSrc || "" });
        if (typeof options.disablePanorama === "function") options.disablePanorama();
        if (typeof options.disableScroll === "function") options.disableScroll();
        if (typeof options.releaseBackgroundDucking === "function") options.releaseBackgroundDucking("setBackground empty src");
        if (typeof options.setBackgroundVideoVolume === "function") options.setBackgroundVideoVolume(0);
        if (fallbackSrc) setBackground(fallbackSrc, "", null, normalizedScroll);
        return;
      }

      var sourceKind = use360 ? "panorama" : "background";
      var normalizedSrc = resolveAssetUrl(src, sourceKind);
      var normalizedFallback = fallbackSrc ? resolveAssetUrl(fallbackSrc, "image") : "";
      if (!normalizedSrc) {
        if (typeof options.disablePanorama === "function") options.disablePanorama();
        if (typeof options.disableScroll === "function") options.disableScroll();
        return;
      }

      if (use360) {
        verbose("[BG360 HOLD] setBackground route -> 360");
        if (typeof options.showPanorama === "function") options.showPanorama(normalizedSrc, normalizedFallback, normalizedScroll);
        return;
      }

      if (typeof options.disablePanorama === "function") options.disablePanorama();
      if (typeof options.hidePanoramaHold === "function") options.hidePanoramaHold();
      verbose("[BG360 HOLD] setBackground route -> non-360, hide hold");
      var sourceIsVideo = isVideoPath(normalizedSrc);
      trace("setBackground:start", {
        src: normalizedSrc,
        fallbackSrc: normalizedFallback,
        isVideo: sourceIsVideo,
        videoVolume: videoVolume
      });

      if (!sourceIsVideo && typeof options.areAllImageCandidatesFailed === "function" && options.areAllImageCandidatesFailed(src)) {
        var failedLogKey = normalizeUrl(src) + "_logged";
        if (!failedImages[failedLogKey]) {
          warn("[IMG] skip failed background src:", sanitizeResource(src));
          failedImages[failedLogKey] = true;
        }
        if (typeof options.disableScroll === "function") options.disableScroll();
        return;
      }

      if (sourceIsVideo) {
        if (typeof options.setScrollOptions === "function") options.setScrollOptions(normalizedScroll, video, container);
        if (video) {
          clearMetadataHandler();
          video.onerror = null;
          video.onloadeddata = null;
          var volumeClamp = typeof options.clamp === "function" ? options.clamp : clampNumber;
          var resolvedVolume = typeof videoVolume === "number" ? volumeClamp(videoVolume, 0, 1) : 0;
          trace("bgVideo:set", { src: normalizedSrc, fallbackSrc: normalizedFallback, volume: resolvedVolume });
          if (typeof options.setBackgroundVideoVolume === "function") options.setBackgroundVideoVolume(resolvedVolume);

          video.onerror = function handleBackgroundVideoError() {
            var badSrc = normalizeUrl(video.currentSrc || video.src || normalizedSrc);
            warn("[VIDEO] background load error:", sanitizeResource(badSrc));
            trace("bgVideo:error", { src: badSrc, fallbackSrc: normalizedFallback });
            if (typeof options.releaseBackgroundDucking === "function") options.releaseBackgroundDucking("bg video load error");
            if (badSrc) failedImages[badSrc] = true;

            if (normalizedFallback) {
              warn("[VIDEO] fallback image used:", sanitizeResource(normalizedFallback));
              trace("bgVideo:error:fallback-image", { fallbackSrc: normalizedFallback });
              if (typeof options.hideKeptStoryVideo === "function") options.hideKeptStoryVideo("bg video fallback image");
              setBackground(normalizedFallback, "", null, normalizedScroll);
              return;
            }

            clearBackgroundVideo();
            if (typeof options.disableScroll === "function") options.disableScroll();
            trace("bgVideo:error:hidden", { src: badSrc });
            if (typeof options.hideKeptStoryVideo === "function") options.hideKeptStoryVideo("bg video load error");
          };

          video.onloadeddata = function showBackgroundVideoAfterData() {
            var currentSrc = normalizeUrl(video.currentSrc || video.src || "");
            if (currentSrc !== normalizedSrc || disposed) return;
            trace("bgVideo:loadeddata", { src: currentSrc });
            if (image) {
              image.classList.add("hidden");
              trace("bgImage:hidden-before-bgVideo", { nextVideoSrc: currentSrc });
            }
            video.classList.remove("hidden");
            trace("bgVideo:shown", { src: currentSrc });
            if (typeof options.hideKeptStoryVideo === "function") options.hideKeptStoryVideo("bg video loaded");
            syncBlurVideo(video, normalizedFallback);
            if (typeof options.updateScrollAvailability === "function") options.updateScrollAvailability();
            if (typeof options.flushAutosaveScrollRestore === "function") options.flushAutosaveScrollRestore();
            if (typeof options.setDuckingForActiveVideos === "function") options.setDuckingForActiveVideos("bg video shown");
          };

          video.src = normalizedSrc;
          metadataHandler = function restoreBackgroundScrollAfterMetadata() {
            metadataHandler = null;
            if (typeof options.flushAutosaveScrollRestore === "function") options.flushAutosaveScrollRestore();
          };
          video.addEventListener("loadedmetadata", metadataHandler, { once: true });
          trace("bgVideo:src-set", { src: normalizedSrc });
          video.loop = true;
          video.playsInline = true;
          if (typeof options.applyAudioSettings === "function") options.applyAudioSettings();
          var playPromise = video.play();
          if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(function reportBackgroundAutoplayFailure(error) {
              warn("[VIDEO] background autoplay blocked or failed:", sanitizeResource(normalizedSrc), error && error.message ? error.message : error);
              trace("bgVideo:play-failed", { src: normalizedSrc, error: error && error.name ? error.name : String(error) });
            });
          }
        }
        if (normalizedFallback) updateBlurBackground(normalizedFallback);
        return;
      }

      if (video) {
        if (typeof options.releaseBackgroundDucking === "function") options.releaseBackgroundDucking("bg image shown");
        if (typeof options.setBackgroundVideoVolume === "function") options.setBackgroundVideoVolume(0);
        clearBackgroundVideo();
        trace("bgVideo:hidden-before-bgImage", { imageSrc: normalizedSrc });
      }

      if (image) {
        image.classList.remove("hidden");
        image.onerror = null;
        image.onload = null;
        if (typeof options.setScrollOptions === "function") options.setScrollOptions(normalizedScroll, image, container);
        trace("bgImage:set", { src: src });
        if (typeof options.assignRasterImage === "function") {
          options.assignRasterImage(image, src, {
            // После успешного кандидата обновляет размеры scroll и отложенное восстановление autosave.
            onLoad: function handleBackgroundImageLoad(loadedUrl) {
              trace("bgImage:load", { src: loadedUrl });
              if (typeof options.updateScrollAvailability === "function") options.updateScrollAvailability();
              if (typeof options.flushAutosaveScrollRestore === "function") options.flushAutosaveScrollRestore();
            },
            // После исчерпания кандидатов скрывает повреждённый src и отключает drag-scroll.
            onAllFailed: function handleAllBackgroundImageCandidatesFailed() {
              warn("[IMG] background load error:", sanitizeResource(src));
              trace("bgImage:error", { src: src });
              if (typeof options.disableScroll === "function") options.disableScroll();
              if (typeof image.removeAttribute === "function") image.removeAttribute("src");
              image.src = "";
            }
          });
        }
        if (typeof options.updateScrollAvailability === "function") options.updateScrollAvailability();
        trace("bgImage:src-set", { src: src });
      }
      updateBlurBackground(src);
    }

    // Освобождает основные и blur media-ресурсы, обработчики и все retry-таймеры.
    function dispose() {
      if (disposed) return;
      disposed = true;
      blurSyncSeq++;
      refreshTimers.forEach(function cancelBackgroundMediaTimer(timerId) {
        clearTimeoutFn(timerId);
      });
      refreshTimers = [];
      clearRefreshLoadedHandler();
      clearBackgroundVideo();
      hideBlurVideo();
      if (image) {
        image.onload = null;
        image.onerror = null;
      }
    }

    return Object.freeze({
      setBackground: setBackground,
      clearBackgroundVideo: clearBackgroundVideo,
      updateBlurBackground: updateBlurBackground,
      syncBlurVideo: syncBlurVideo,
      scheduleBlurRefreshFromVideo: scheduleBlurRefreshFromVideo,
      hideBlurVideo: hideBlurVideo,
      copyVideoPositionToBlur: copyVideoPositionToBlur,
      dispose: dispose
    });
  }

  return {
    createBackgroundMediaController: createBackgroundMediaController
  };
});
