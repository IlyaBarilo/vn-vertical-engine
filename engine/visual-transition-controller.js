// Экспортирует группировку визуальных действий и lifecycle переходов без зависимости от глобального состояния engine.js.
(function(root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VN_VISUAL_TRANSITION_CONTROLLER = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createVisualTransitionControllerModule() {
  "use strict";

  var DEFAULT_TRANSITION_OUT_MS = 80;
  var DEFAULT_TRANSITION_IN_MS = 100;
  var DEFAULT_TRANSITION_TOTAL_MS = DEFAULT_TRANSITION_OUT_MS + DEFAULT_TRANSITION_IN_MS;
  var MAX_TRANSITION_MS = 2000;
  var MEDIA_READY_TIMEOUT_MS = 5000;

  // Ограничивает число диапазоном, когда координатор не передал собственную реализацию clamp.
  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // Проверяет, можно ли включать действие в общий визуальный батч до ближайшей реплики или выбора.
  function isVisualBatchCandidate(action) {
    return !!(action && (
      action.type === "bg" ||
      action.type === "char" ||
      action.type === "bg360marks"
    ));
  }

  // Собирает подряд идущие визуальные действия, сохраняя их исходный порядок для меток 360.
  function collectVisualBatchActions(scene, startIndex) {
    var actions = [];
    if (!scene || !Array.isArray(scene.actions)) return actions;
    for (var i = startIndex; i < scene.actions.length; i++) {
      var action = scene.actions[i];
      if (!isVisualBatchCandidate(action)) break;
      actions.push(action);
    }
    return actions;
  }

  // Создаёт один контроллер переходов и связывает его только с переданными элементами и callback-функциями.
  function createVisualTransitionController(options) {
    options = options || {};

    var documentRef = options.document || (typeof document !== "undefined" ? document : null);
    if (!documentRef) throw new Error("Visual transition controller requires document");

    var novelWindow = options.novelWindow || null;
    var backgroundImage = options.backgroundImage || null;
    var backgroundVideo = options.backgroundVideo || null;
    var panorama = options.panorama || null;
    var character = options.character || null;
    var blurLayer = options.blurLayer || null;
    var blurImage = options.blurImage || null;
    var blurVideo = options.blurVideo || null;
    var setTimeoutFn = options.setTimeout || setTimeout;
    var clearTimeoutFn = options.clearTimeout || clearTimeout;
    var requestAnimationFrameFn = options.requestAnimationFrame || function(callback) {
      return setTimeoutFn(callback, 0);
    };
    var cancelAnimationFrameFn = options.cancelAnimationFrame || clearTimeoutFn;
    var warn = typeof options.warn === "function" ? options.warn : function() {};
    var transitionSequence = 0;
    var disposed = false;
    var pendingCleanups = [];
    var transitionCover = null;
    var backgroundCrossfade = null;
    var backgroundVideoCrossfade = null;
    var blurBackgroundCrossfade = null;
    var blurBackgroundVideoCrossfade = null;

    // Использует координаторный clamp либо безопасную локальную реализацию.
    function clamp(value, min, max) {
      return typeof options.clamp === "function"
        ? options.clamp(value, min, max)
        : clampNumber(value, min, max);
    }

    // Возвращает актуальные meta-настройки истории без хранения STORY внутри модуля.
    function getStoryMeta() {
      var meta = typeof options.getStoryMeta === "function" ? options.getStoryMeta() : null;
      return meta && typeof meta === "object" ? meta : {};
    }

    // Проверяет, что асинхронный шаг ещё относится к текущему переходу и контроллер не освобождён.
    function isSequenceActive(sequence) {
      return !disposed && sequence === transitionSequence;
    }

    // Регистрирует отмену таймера, кадра или media-ожидания для restart, goto и dispose.
    function trackPendingCleanup(cleanup) {
      if (typeof cleanup === "function") pendingCleanups.push(cleanup);
    }

    // Убирает завершённую операцию из реестра, чтобы последующая отмена не вызывала её повторно.
    function untrackPendingCleanup(cleanup) {
      var index = pendingCleanups.indexOf(cleanup);
      if (index >= 0) pendingCleanups.splice(index, 1);
    }

    // Отменяет все ожидающие операции; каждая из них сама освобождает обработчики и завершает Promise.
    function cancelPendingOperations() {
      var cleanups = pendingCleanups.slice();
      pendingCleanups = [];
      cleanups.forEach(function(cleanup) {
        try {
          cleanup();
        } catch (error) {}
      });
    }

    // Создаёт отменяемую задержку и завершает её false при смене сцены или restart.
    function delayTransition(ms) {
      return new Promise(function(resolve) {
        var settled = false;
        var timer = null;

        // Завершает задержку ровно один раз и снимает её регистрацию.
        function finishDelay(completed) {
          if (settled) return;
          settled = true;
          if (timer !== null) clearTimeoutFn(timer);
          untrackPendingCleanup(cancelDelay);
          resolve(!!completed);
        }

        // Прерывает задержку без продолжения отменённого визуального перехода.
        function cancelDelay() {
          finishDelay(false);
        }

        trackPendingCleanup(cancelDelay);
        timer = setTimeoutFn(function completeDelay() {
          finishDelay(true);
        }, Math.max(0, ms || 0));
      });
    }

    // Ожидает два кадра браузера, чтобы CSS успел зафиксировать начальное и конечное состояния transition.
    function waitTransitionFrame() {
      return new Promise(function(resolve) {
        var settled = false;
        var firstFrame = null;
        var secondFrame = null;

        // Завершает ожидание кадров и удаляет отмену из lifecycle-реестра.
        function finishFrame(completed) {
          if (settled) return;
          settled = true;
          untrackPendingCleanup(cancelFrame);
          resolve(!!completed);
        }

        // Отменяет оба запрошенных кадра при прекращении текущего перехода.
        function cancelFrame() {
          if (firstFrame !== null) cancelAnimationFrameFn(firstFrame);
          if (secondFrame !== null) cancelAnimationFrameFn(secondFrame);
          finishFrame(false);
        }

        trackPendingCleanup(cancelFrame);
        firstFrame = requestAnimationFrameFn(function waitSecondTransitionFrame() {
          secondFrame = requestAnimationFrameFn(function completeTransitionFrame() {
            finishFrame(true);
          });
        });
      });
    }

    // Читает transition/transitionMs из meta и локального override команды bg.
    function getTransitionSettings(override) {
      var meta = getStoryMeta();
      var modeSource = override && override.transition !== undefined && override.transition !== null
        ? override.transition
        : meta.transition;
      var rawMode = String(modeSource === undefined || modeSource === null ? "fade" : modeSource).trim().toLowerCase();
      var enabled = !(rawMode === "none" || rawMode === "instant" || rawMode === "off" || rawMode === "false" || rawMode === "0");
      var mode = rawMode === "black" || rawMode === "white" ? "cover" : "fade";
      var coverColor = rawMode === "white" ? "#fff" : "#000";
      var durationSource = override && override.transitionMs !== undefined && override.transitionMs !== null
        ? override.transitionMs
        : meta.transitionMs;
      var totalMs = typeof durationSource === "number" && isFinite(durationSource)
        ? clamp(durationSource, 0, MAX_TRANSITION_MS)
        : DEFAULT_TRANSITION_TOTAL_MS;
      var outRatio = DEFAULT_TRANSITION_OUT_MS / DEFAULT_TRANSITION_TOTAL_MS;
      var outMs = Math.round(totalMs * outRatio);
      var inMs = Math.max(0, totalMs - outMs);

      return {
        enabled: enabled && totalMs > 0,
        mode: mode,
        coverColor: coverColor,
        outMs: outMs,
        inMs: inMs
      };
    }

    // Передаёт длительность CSS-переходу через общую переменную документа.
    function setTransitionDuration(ms) {
      if (!documentRef.documentElement || !documentRef.documentElement.style) return;
      documentRef.documentElement.style.setProperty("--visualTransitionMs", Math.max(0, Math.round(ms || 0)) + "ms");
    }

    // Создаёт завесу поверх сцены отдельно от сюжетного overlay.
    function ensureTransitionCover() {
      if (transitionCover) return transitionCover;
      if (!novelWindow) return null;

      var cover = documentRef.createElement("div");
      cover.className = "visual-transition-cover hidden";
      cover.setAttribute("aria-hidden", "true");
      novelWindow.appendChild(cover);
      transitionCover = cover;
      return cover;
    }

    // Показывает или скрывает непрозрачность цветной завесы, сохраняя её в DOM между переходами.
    function showTransitionCover(color, visible) {
      var cover = ensureTransitionCover();
      if (!cover) return;
      cover.style.background = color || "#000";
      cover.classList.remove("hidden");
      cover.classList.toggle("is-visible", !!visible);
    }

    // Полностью скрывает цветную завесу после завершения или отмены перехода.
    function hideTransitionCover() {
      if (!transitionCover) return;
      transitionCover.classList.remove("is-visible");
      transitionCover.classList.add("hidden");
    }

    // Создаёт временный image-слой для проявления нового обычного фона поверх старого.
    function ensureBackgroundCrossfadeLayer() {
      if (backgroundCrossfade) return backgroundCrossfade;
      if (!novelWindow) return null;

      var layer = documentRef.createElement("img");
      layer.className = "visual-bg-crossfade hidden";
      layer.alt = "";
      layer.draggable = false;
      layer.setAttribute("aria-hidden", "true");
      novelWindow.appendChild(layer);
      backgroundCrossfade = layer;
      return layer;
    }

    // Скрывает image-overlay и освобождает назначенный ему ресурс.
    function hideBackgroundCrossfadeLayer() {
      if (!backgroundCrossfade) return;
      backgroundCrossfade.onload = null;
      backgroundCrossfade.onerror = null;
      backgroundCrossfade.classList.remove("is-visible");
      backgroundCrossfade.classList.add("hidden");
      backgroundCrossfade.removeAttribute("src");
    }

    // Создаёт немой video-overlay, удерживающий новый кадр до переключения основного bgVideo.
    function ensureBackgroundVideoCrossfadeLayer() {
      if (backgroundVideoCrossfade) return backgroundVideoCrossfade;
      if (!novelWindow) return null;

      var layer = documentRef.createElement("video");
      layer.className = "visual-bg-crossfade hidden";
      layer.muted = true;
      layer.defaultMuted = true;
      layer.loop = true;
      layer.preload = "auto";
      if ("playsInline" in layer) layer.playsInline = true;
      layer.setAttribute("playsinline", "");
      layer.setAttribute("aria-hidden", "true");
      novelWindow.appendChild(layer);
      backgroundVideoCrossfade = layer;
      return layer;
    }

    // Останавливает временное видео и освобождает его src после swap или отмены.
    function hideBackgroundVideoCrossfadeLayer() {
      if (!backgroundVideoCrossfade) return;
      backgroundVideoCrossfade.onloadeddata = null;
      backgroundVideoCrossfade.onerror = null;
      backgroundVideoCrossfade.classList.remove("is-visible");
      backgroundVideoCrossfade.classList.add("hidden");
      try {
        backgroundVideoCrossfade.pause();
      } catch (error) {}
      backgroundVideoCrossfade.removeAttribute("src");
      try {
        backgroundVideoCrossfade.load();
      } catch (error2) {}
    }

    // Создаёт отдельный image-overlay внутри blur-слоя.
    function ensureBlurBackgroundCrossfadeLayer() {
      if (blurBackgroundCrossfade) return blurBackgroundCrossfade;
      if (!blurLayer) return null;

      var layer = documentRef.createElement("img");
      layer.className = "blur-bg-image blur-bg-crossfade hidden";
      layer.alt = "";
      layer.draggable = false;
      layer.setAttribute("aria-hidden", "true");
      blurLayer.appendChild(layer);
      blurBackgroundCrossfade = layer;
      return layer;
    }

    // Скрывает и освобождает временную размытую картинку.
    function hideBlurBackgroundCrossfadeLayer() {
      if (!blurBackgroundCrossfade) return;
      blurBackgroundCrossfade.onload = null;
      blurBackgroundCrossfade.onerror = null;
      blurBackgroundCrossfade.classList.remove("is-visible");
      blurBackgroundCrossfade.classList.add("hidden");
      blurBackgroundCrossfade.removeAttribute("src");
    }

    // Создаёт остановленный video-overlay для первого кадра размытого нового фона.
    function ensureBlurBackgroundVideoCrossfadeLayer() {
      if (blurBackgroundVideoCrossfade) return blurBackgroundVideoCrossfade;
      if (!blurLayer) return null;

      var layer = documentRef.createElement("video");
      layer.className = "blur-bg-video blur-bg-crossfade hidden";
      layer.muted = true;
      layer.defaultMuted = true;
      layer.loop = false;
      layer.autoplay = false;
      layer.preload = "auto";
      if ("playsInline" in layer) layer.playsInline = true;
      layer.setAttribute("playsinline", "");
      layer.setAttribute("aria-hidden", "true");
      blurLayer.appendChild(layer);
      blurBackgroundVideoCrossfade = layer;
      return layer;
    }

    // Останавливает и освобождает временный blur-video после готовности основного дубликата.
    function hideBlurBackgroundVideoCrossfadeLayer() {
      if (!blurBackgroundVideoCrossfade) return;
      blurBackgroundVideoCrossfade.onloadeddata = null;
      blurBackgroundVideoCrossfade.onerror = null;
      blurBackgroundVideoCrossfade.classList.remove("is-visible");
      blurBackgroundVideoCrossfade.classList.add("hidden");
      try {
        blurBackgroundVideoCrossfade.pause();
      } catch (error) {}
      blurBackgroundVideoCrossfade.removeAttribute("src");
      try {
        blurBackgroundVideoCrossfade.load();
      } catch (error2) {}
    }

    // Переключает прозрачность основного элемента через CSS-класс перехода.
    function setTransitionTransparent(element, transparent) {
      if (!element) return;
      element.classList.toggle("visual-transition-transparent", !!transparent);
    }

    // Возвращает все основные слои в устойчивое состояние и освобождает временные media-src.
    function clearVisualState() {
      [backgroundImage, backgroundVideo, panorama, character].forEach(function(element) {
        setTransitionTransparent(element, false);
      });
      hideTransitionCover();
      hideBackgroundCrossfadeLayer();
      hideBackgroundVideoCrossfadeLayer();
      hideBlurBackgroundCrossfadeLayer();
      hideBlurBackgroundVideoCrossfadeLayer();
    }

    // Проверяет фактическую видимость элемента по общему классу hidden.
    function isElementVisible(element) {
      return !!(element && !element.classList.contains("hidden"));
    }

    // Возвращает видимые фоновые слои, которые нужно погасить перед заменой без crossfade.
    function getVisibleBackgroundElements() {
      return [backgroundImage, backgroundVideo, panorama].filter(function(element) {
        return isElementVisible(element);
      });
    }

    // Выбирает основной DOM-элемент, который станет видимым после применения подготовленного фона.
    function getPreparedBackgroundTarget(preparedBackground) {
      if (!preparedBackground || !preparedBackground.file) return null;
      if (preparedBackground.mediaOptions && preparedBackground.mediaOptions.is360 === true) return panorama;
      if (typeof options.isVideoPath === "function" && options.isVideoPath(preparedBackground.file)) return backgroundVideo;
      return backgroundImage;
    }

    // Разрешает crossfade только для обычных фоновых media; 360 сохраняет отдельную схему рендера.
    function canCrossfadeBackground(preparedBackground) {
      return !!(
        preparedBackground &&
        preparedBackground.changesVisual &&
        preparedBackground.file &&
        !(preparedBackground.mediaOptions && preparedBackground.mediaOptions.is360 === true)
      );
    }

    // Строит финальный план батча через явно переданные функции подготовки фона и персонажа.
    function buildVisualBatchPlan(actions) {
      var plan = { bg: null, char: null, marks: [] };
      (actions || []).forEach(function(action) {
        if (!action) return;
        if (action.type === "bg" && typeof options.prepareBackground === "function") {
          plan.bg = options.prepareBackground(action);
        } else if (action.type === "char" && typeof options.prepareCharacter === "function") {
          plan.char = options.prepareCharacter(action);
        } else if (action.type === "bg360marks") {
          plan.marks.push(action);
        }
      });
      return plan;
    }

    // Предварительно загружает новые растровые фон и персонажа до начала исчезновения старого кадра.
    function preloadVisualBatchPlan(plan) {
      var waits = [];
      var preloadImage = typeof options.preloadImage === "function" ? options.preloadImage : null;
      var isVideoPath = typeof options.isVideoPath === "function" ? options.isVideoPath : function() { return false; };
      if (preloadImage && plan && plan.bg && plan.bg.file && !isVideoPath(plan.bg.file)) {
        waits.push(Promise.resolve(preloadImage(plan.bg.file)));
      }
      if (preloadImage && plan && plan.char && plan.char.kind === "show" && plan.char.changesVisual) {
        waits.push(Promise.resolve(preloadImage(plan.char.normalizedSrc)));
      }
      return Promise.all(waits);
    }

    // Проверяет, содержит ли план фактическое изменение фона или персонажа.
    function planHasVisualTransition(plan) {
      return !!(plan && (
        (plan.bg && plan.bg.changesVisual) ||
        (plan.char && plan.char.changesVisual)
      ));
    }

    // Собирает старые элементы, которые должны исчезнуть перед обычной заменой без фонового crossfade.
    function getFadeOutElements(plan) {
      var elements = [];
      if (plan && plan.bg && plan.bg.changesVisual && !canCrossfadeBackground(plan.bg)) {
        elements = elements.concat(getVisibleBackgroundElements());
      }
      if (plan && plan.char && plan.char.changesVisual && isElementVisible(character)) {
        elements.push(character);
      }
      return elements;
    }

    // Собирает новые основные элементы, прозрачность которых снимается после DOM-swap.
    function getFadeInElements(plan) {
      var elements = [];
      if (plan && plan.bg && plan.bg.changesVisual && !canCrossfadeBackground(plan.bg)) {
        var backgroundTarget = getPreparedBackgroundTarget(plan.bg);
        if (backgroundTarget) elements.push(backgroundTarget);
      }
      if (plan && plan.char && plan.char.kind === "show" && plan.char.changesVisual && character) {
        elements.push(character);
      }
      return elements;
    }

    // Применяет весь подготовленный план через координаторные callback-функции.
    function applyVisualBatchPlan(plan) {
      if (!plan) return;
      if (plan.bg && typeof options.applyBackground === "function") options.applyBackground(plan.bg);
      plan.marks.forEach(function(action) {
        if (typeof options.applyPanoramaMarks === "function") options.applyPanoramaMarks(action);
      });
      if (plan.char && typeof options.applyCharacter === "function") options.applyCharacter(plan.char);
    }

    // Применяет персонажа и метки без фона, пока временный crossfade-слой закрывает основной media-swap.
    function applyVisualBatchPlanWithoutBackground(plan) {
      if (!plan) return;
      plan.marks.forEach(function(action) {
        if (typeof options.applyPanoramaMarks === "function") options.applyPanoramaMarks(action);
      });
      if (plan.char && typeof options.applyCharacter === "function") options.applyCharacter(plan.char);
    }

    // Копирует текущее object-позиционирование на временный слой до расчёта финального focus/scale.
    function copyBackgroundCrossfadePosition(layer) {
      var source = null;
      if (backgroundVideo && !backgroundVideo.classList.contains("hidden")) {
        source = backgroundVideo;
      } else if (backgroundImage && !backgroundImage.classList.contains("hidden")) {
        source = backgroundImage;
      } else {
        source = backgroundImage || backgroundVideo;
      }
      if (!layer || !source) return;
      layer.style.objectFit = source.style.objectFit || "";
      layer.style.objectPosition = source.style.objectPosition || "";
      layer.style.transform = source.style.transform || "";
      layer.style.transformOrigin = source.style.transformOrigin || "";
    }

    // Применяет к временному overlay финальные scroll/focus/scale, исключая рывок после swap.
    function applyScrollOptionsToTemporaryLayer(layer, scrollOptions) {
      if (!layer) return;
      var normalized = typeof options.normalizeScrollOptions === "function"
        ? options.normalizeScrollOptions(scrollOptions)
        : (scrollOptions || {});
      var mediaScale = typeof options.normalizeMediaScale === "function"
        ? options.normalizeMediaScale(normalized.scale, 1)
        : (typeof normalized.scale === "number" ? normalized.scale : 1);
      var hasTransform =
        normalized.enabled ||
        typeof normalized.focusX === "number" ||
        typeof normalized.focusY === "number" ||
        Math.abs(mediaScale - 1) > 1e-6;

      if (!hasTransform) {
        if (typeof options.resetScrollableMediaPosition === "function") options.resetScrollableMediaPosition(layer);
        return;
      }

      var position = typeof normalized.focusX === "number" && typeof options.computeFocusedMediaPosition === "function"
        ? options.computeFocusedMediaPosition(layer, novelWindow, normalized.focusX, mediaScale)
        : (typeof options.normalizeScrollStart === "function" ? options.normalizeScrollStart(normalized.start, 0.5) : 0.5);
      var x = clamp(position, 0, 1) * 100;
      var yCss = "center";
      var yOrigin = "50%";
      if (typeof normalized.focusY === "number") {
        var yFraction = clamp(normalized.focusY, 0, 1);
        yCss = (yFraction * 100).toFixed(3) + "%";
        yOrigin = yCss;
      }
      layer.style.objectPosition = x.toFixed(3) + "% " + yCss;
      layer.style.transformOrigin = x.toFixed(3) + "% " + yOrigin;
      layer.style.transform = Math.abs(mediaScale - 1) > 1e-6 ? "scale(" + mediaScale + ")" : "";
    }

    // Загружает временный image-overlay и ожидает его natural-размеры для корректного focusX.
    function loadCrossfadeImage(imageElement, src) {
      var storyPath = String(src || "").trim();
      if (!imageElement || !storyPath || typeof options.assignRasterImage !== "function") return Promise.resolve(false);

      return new Promise(function(resolve) {
        var settled = false;
        var timer = null;

        // Завершает image-ожидание и снимает таймер с lifecycle-контроля.
        function finishImageLoad(ok) {
          if (settled) return;
          settled = true;
          if (timer !== null) clearTimeoutFn(timer);
          untrackPendingCleanup(cancelImageLoad);
          resolve(!!ok);
        }

        // Останавливает обработчики временной картинки при отмене перехода.
        function cancelImageLoad() {
          imageElement.onload = null;
          imageElement.onerror = null;
          finishImageLoad(false);
        }

        trackPendingCleanup(cancelImageLoad);
        timer = setTimeoutFn(function finishImageLoadAfterTimeout() {
          finishImageLoad(!!(imageElement.naturalWidth && imageElement.naturalHeight));
        }, MEDIA_READY_TIMEOUT_MS);
        options.assignRasterImage(imageElement, storyPath, {
          onLoad: function handleCrossfadeImageLoad() {
            finishImageLoad(true);
          },
          onAllFailed: function handleCrossfadeImageFailure() {
            finishImageLoad(false);
          }
        });
      });
    }

    // Загружает временный video-overlay до первого готового кадра и при необходимости запускает его без звука.
    function loadCrossfadeVideo(videoElement, src, shouldPlay) {
      var normalizedSrc = typeof options.resolveVideoUrl === "function" ? options.resolveVideoUrl(src || "") : String(src || "");
      if (!videoElement || !normalizedSrc) return Promise.resolve(false);

      return new Promise(function(resolve) {
        var settled = false;
        var timer = null;

        // Освобождает media-обработчики и завершает ожидание ровно один раз.
        function finishVideoLoad(ok) {
          if (settled) return;
          settled = true;
          videoElement.onloadeddata = null;
          videoElement.onerror = null;
          if (timer !== null) clearTimeoutFn(timer);
          untrackPendingCleanup(cancelVideoLoad);
          resolve(!!ok);
        }

        // Прерывает ожидание временного video при restart, goto или dispose.
        function cancelVideoLoad() {
          finishVideoLoad(false);
        }

        trackPendingCleanup(cancelVideoLoad);
        timer = setTimeoutFn(function finishVideoLoadAfterTimeout() {
          finishVideoLoad(false);
        }, MEDIA_READY_TIMEOUT_MS);
        videoElement.onloadeddata = function handleCrossfadeVideoData() {
          var currentUrl = typeof options.normalizeUrl === "function"
            ? options.normalizeUrl(videoElement.currentSrc || videoElement.src || "")
            : String(videoElement.currentSrc || videoElement.src || "");
          if (currentUrl !== normalizedSrc) return;
          if (shouldPlay) {
            var playPromise = videoElement.play();
            if (playPromise && typeof playPromise.catch === "function") playPromise.catch(function() {});
          } else {
            try {
              videoElement.pause();
              videoElement.currentTime = 0;
            } catch (error) {}
          }
          finishVideoLoad(true);
        };
        videoElement.onerror = function handleCrossfadeVideoError() {
          finishVideoLoad(false);
        };
        videoElement.src = normalizedSrc;
        try {
          videoElement.load();
        } catch (error2) {}
      });
    }

    // Ожидает готовность основного видео либо его blur-дубликата и снимает оба listener при отмене.
    function waitForVideoElementReady(videoElement, normalizedSrc, skipWhenHidden) {
      if (!videoElement || !normalizedSrc) return Promise.resolve(false);
      var normalizeUrl = typeof options.normalizeUrl === "function" ? options.normalizeUrl : String;
      if (
        normalizeUrl(videoElement.currentSrc || videoElement.src || "") === normalizedSrc &&
        videoElement.readyState >= 2 &&
        (!skipWhenHidden || !videoElement.classList.contains("hidden"))
      ) {
        return Promise.resolve(true);
      }

      return new Promise(function(resolve) {
        var settled = false;
        var timer = null;

        // Завершает ожидание основного media и гарантированно снимает оба listener.
        function finishVideoReady(ok) {
          if (settled) return;
          settled = true;
          videoElement.removeEventListener("loadeddata", handleVideoReadyData);
          videoElement.removeEventListener("error", handleVideoReadyError);
          if (timer !== null) clearTimeoutFn(timer);
          untrackPendingCleanup(cancelVideoReady);
          resolve(!!ok);
        }

        // Принимает только событие от ожидаемого src, игнорируя старый ролик.
        function handleVideoReadyData() {
          if (normalizeUrl(videoElement.currentSrc || videoElement.src || "") !== normalizedSrc) return;
          finishVideoReady(true);
        }

        // Завершает ожидание false, чтобы fallback не блокировал продолжение истории.
        function handleVideoReadyError() {
          finishVideoReady(false);
        }

        // Прерывает media-ожидание при смене поколения перехода.
        function cancelVideoReady() {
          finishVideoReady(false);
        }

        trackPendingCleanup(cancelVideoReady);
        timer = setTimeoutFn(function finishVideoReadyAfterTimeout() {
          finishVideoReady(false);
        }, MEDIA_READY_TIMEOUT_MS);
        videoElement.addEventListener("loadeddata", handleVideoReadyData);
        videoElement.addEventListener("error", handleVideoReadyError);
      });
    }

    // Готовит временную размытую картинку только при включённом blurBackground.
    function prepareBlurBackgroundImageCrossfade(src) {
      if (!src || typeof options.isBlurEnabled !== "function" || !options.isBlurEnabled()) return null;
      if (!blurLayer || !blurImage || typeof options.assignRasterImage !== "function") return null;

      var layer = ensureBlurBackgroundCrossfadeLayer();
      if (!layer) return null;
      blurLayer.classList.remove("hidden");
      blurLayer.style.display = "block";
      layer.classList.remove("is-visible");
      layer.classList.remove("hidden");
      options.assignRasterImage(layer, src, {});
      return layer;
    }

    // Готовит первый кадр blur-video либо статичный fallback для нового видеофона.
    function prepareBlurBackgroundVideoCrossfade(preparedBackground) {
      if (!preparedBackground || !preparedBackground.normalizedSrc) return Promise.resolve(null);
      if (typeof options.isBlurEnabled !== "function" || !options.isBlurEnabled() || !blurLayer) return Promise.resolve(null);

      var fallbackSrc = typeof options.normalizeUrl === "function"
        ? options.normalizeUrl(preparedBackground.fallback || "")
        : String(preparedBackground.fallback || "");
      if (fallbackSrc && typeof options.isVideoPath === "function" && !options.isVideoPath(fallbackSrc)) {
        return Promise.resolve(prepareBlurBackgroundImageCrossfade(fallbackSrc));
      }

      var layer = ensureBlurBackgroundVideoCrossfadeLayer();
      if (!layer) return Promise.resolve(null);
      blurLayer.classList.remove("hidden");
      blurLayer.style.display = "block";
      layer.classList.remove("is-visible");
      layer.classList.remove("hidden");
      return loadCrossfadeVideo(layer, preparedBackground.normalizedSrc, false).then(function(resolveBlurVideoLayer) {
        if (!resolveBlurVideoLayer) {
          hideBlurBackgroundVideoCrossfadeLayer();
          return null;
        }
        return layer;
      });
    }

    // Проявляет новый обычный фон поверх старого и держит overlay до готовности основных media-слоёв.
    function runBackgroundMediaCrossfade(preparedBackground, transitionSettings, sequence) {
      if (!canCrossfadeBackground(preparedBackground) || !isSequenceActive(sequence)) return Promise.resolve(false);

      var isVideo = typeof options.isVideoPath === "function" && options.isVideoPath(preparedBackground.file);
      var layer = isVideo ? ensureBackgroundVideoCrossfadeLayer() : ensureBackgroundCrossfadeLayer();
      if (!layer) return Promise.resolve(false);

      copyBackgroundCrossfadePosition(layer);
      setTransitionDuration(transitionSettings.inMs);
      layer.classList.remove("is-visible");
      layer.classList.remove("hidden");

      var mediaReady = isVideo
        ? loadCrossfadeVideo(layer, preparedBackground.normalizedSrc, true)
        : loadCrossfadeImage(layer, preparedBackground.file || preparedBackground.normalizedSrc);
      var blurReady = isVideo
        ? prepareBlurBackgroundVideoCrossfade(preparedBackground)
        : Promise.resolve(prepareBlurBackgroundImageCrossfade(preparedBackground.file || preparedBackground.normalizedSrc));

      return Promise.all([mediaReady, blurReady]).then(function showPreparedCrossfadeLayers(results) {
        if (!isSequenceActive(sequence)) return false;
        if (!results[0]) {
          if (isVideo) hideBackgroundVideoCrossfadeLayer();
          else hideBackgroundCrossfadeLayer();
          if (typeof options.applyBackground === "function") options.applyBackground(preparedBackground);
          return false;
        }
        var preparedBlurLayer = results[1];
        applyScrollOptionsToTemporaryLayer(layer, preparedBackground.mediaOptions);
        if (isVideo && preparedBlurLayer && String(preparedBlurLayer.tagName || "").toLowerCase() === "video") {
          applyScrollOptionsToTemporaryLayer(preparedBlurLayer, preparedBackground.mediaOptions);
        }
        return waitTransitionFrame().then(function revealCrossfadeLayers(frameReady) {
          if (!frameReady || !isSequenceActive(sequence)) return false;
          layer.classList.add("is-visible");
          if (preparedBlurLayer) preparedBlurLayer.classList.add("is-visible");
          return delayTransition(transitionSettings.inMs);
        }).then(function applyPreparedBackgroundAfterFade(delayCompleted) {
          if (!delayCompleted || !isSequenceActive(sequence)) return false;
          var finalVideoReady = isVideo
            ? waitForVideoElementReady(backgroundVideo, preparedBackground.normalizedSrc, true)
            : Promise.resolve(true);
          if (typeof options.applyBackground === "function") options.applyBackground(preparedBackground);
          return finalVideoReady;
        }).then(function waitForBlurBackgroundReady(mainReady) {
          if (!isSequenceActive(sequence)) return false;
          if (!isVideo || (preparedBackground.fallback && typeof options.isVideoPath === "function" && !options.isVideoPath(preparedBackground.fallback))) {
            return mainReady;
          }
          if (typeof options.isBlurEnabled !== "function" || !options.isBlurEnabled() || !blurVideo) return mainReady;
          return waitForVideoElementReady(blurVideo, preparedBackground.normalizedSrc, true);
        }).then(function waitFinalCrossfadeFrame(mediaReadyResult) {
          if (!isSequenceActive(sequence)) return false;
          return waitTransitionFrame().then(function hidePreparedCrossfadeLayers(frameReady) {
            if (!frameReady || !isSequenceActive(sequence)) return false;
            if (isVideo) hideBackgroundVideoCrossfadeLayer();
            else hideBackgroundCrossfadeLayer();
            hideBlurBackgroundCrossfadeLayer();
            hideBlurBackgroundVideoCrossfadeLayer();
            return mediaReadyResult !== false;
          });
        });
      });
    }

    // Выполняет переход через полностью непрозрачную чёрную или белую завесу.
    function runCoverTransition(plan, transitionSettings, sequence) {
      return preloadVisualBatchPlan(plan).then(function showInitialCoverState() {
        if (!isSequenceActive(sequence)) return false;
        setTransitionDuration(transitionSettings.outMs);
        showTransitionCover(transitionSettings.coverColor, false);
        return waitTransitionFrame();
      }).then(function showOpaqueCover(frameReady) {
        if (!frameReady || !isSequenceActive(sequence)) return false;
        showTransitionCover(transitionSettings.coverColor, true);
        return delayTransition(transitionSettings.outMs);
      }).then(function swapCoveredVisuals(delayCompleted) {
        if (!delayCompleted || !isSequenceActive(sequence)) return false;
        applyVisualBatchPlan(plan);
        setTransitionDuration(transitionSettings.inMs);
        return waitTransitionFrame();
      }).then(function hideOpaqueCover(frameReady) {
        if (!frameReady || !isSequenceActive(sequence)) return false;
        showTransitionCover(transitionSettings.coverColor, false);
        return delayTransition(transitionSettings.inMs);
      }).then(function completeCoverTransition(delayCompleted) {
        if (!delayCompleted || !isSequenceActive(sequence)) return false;
        hideTransitionCover();
        return true;
      });
    }

    // Выполняет обычный fade персонажа и crossfade обычного фонового media.
    function runFadeTransition(plan, transitionSettings, sequence) {
      var hasBackgroundCrossfade = canCrossfadeBackground(plan && plan.bg);
      return preloadVisualBatchPlan(plan).then(function fadeOldVisuals() {
        if (!isSequenceActive(sequence)) return false;
        var fadeOutElements = getFadeOutElements(plan);
        setTransitionDuration(transitionSettings.outMs);
        fadeOutElements.forEach(function(element) {
          setTransitionTransparent(element, true);
        });
        return delayTransition(fadeOutElements.length > 0 ? transitionSettings.outMs : 0);
      }).then(function swapAndRevealNewVisuals(delayCompleted) {
        if (!delayCompleted || !isSequenceActive(sequence)) return false;
        var fadeInElements = getFadeInElements(plan);
        setTransitionDuration(transitionSettings.inMs);
        fadeInElements.forEach(function(element) {
          setTransitionTransparent(element, true);
        });

        if (hasBackgroundCrossfade) applyVisualBatchPlanWithoutBackground(plan);
        else applyVisualBatchPlan(plan);

        return waitTransitionFrame().then(function runFadeIn(frameReady) {
          if (!frameReady || !isSequenceActive(sequence)) return false;
          fadeInElements.forEach(function(element) {
            setTransitionTransparent(element, false);
          });
          var waits = [];
          if (fadeInElements.length > 0) waits.push(delayTransition(transitionSettings.inMs));
          if (hasBackgroundCrossfade) waits.push(runBackgroundMediaCrossfade(plan.bg, transitionSettings, sequence));
          return Promise.all(waits);
        });
      }).then(function completeFadeTransition(result) {
        return isSequenceActive(sequence) && result !== false;
      });
    }

    // Подготавливает и запускает батч, возвращая синхронный либо асинхронный контракт для runCurrent.
    function execute(actions) {
      if (disposed || !actions || actions.length === 0) {
        return { async: false, hasCharacterShow: false, promise: Promise.resolve(false), plan: null };
      }

      transitionSequence++;
      cancelPendingOperations();
      clearVisualState();

      var plan = buildVisualBatchPlan(actions);
      var backgroundAction = plan && plan.bg && plan.bg.action ? plan.bg.action : null;
      var hasBackgroundOverride = !!(
        backgroundAction &&
        (backgroundAction.transition !== undefined || backgroundAction.transitionMs !== undefined)
      );
      var transitionSettings = getTransitionSettings(backgroundAction);
      var currentIs360 = typeof options.isCurrentBackground360 === "function" && options.isCurrentBackground360();
      var nextIs360 = !!(plan && plan.bg && plan.bg.mediaOptions && plan.bg.mediaOptions.is360 === true);
      if ((currentIs360 || nextIs360) && !hasBackgroundOverride) transitionSettings.enabled = false;

      var hasTransition = planHasVisualTransition(plan) && transitionSettings.enabled;
      var hasCharacterShow = !!(plan.char && plan.char.kind === "show");
      if (!hasTransition) {
        applyVisualBatchPlan(plan);
        return { async: false, hasCharacterShow: hasCharacterShow, promise: Promise.resolve(true), plan: plan };
      }

      var sequence = transitionSequence;
      var transitionPromise = transitionSettings.mode === "cover"
        ? runCoverTransition(plan, transitionSettings, sequence)
        : runFadeTransition(plan, transitionSettings, sequence);
      transitionPromise = transitionPromise.then(function finalizeSuccessfulTransition(completed) {
        if (!completed || !isSequenceActive(sequence)) return false;
        clearVisualState();
        return true;
      }).catch(function recoverFailedTransition(error) {
        if (!isSequenceActive(sequence)) return false;
        warn("[VISUAL BATCH] transition failed:", error);
        clearVisualState();
        return true;
      });

      return { async: true, hasCharacterShow: hasCharacterShow, promise: transitionPromise, plan: plan };
    }

    // Отменяет текущее поколение перехода и сразу возвращает DOM в устойчивое состояние.
    function cancel() {
      transitionSequence++;
      cancelPendingOperations();
      clearVisualState();
    }

    // Удаляет созданные контроллером overlay-элементы и освобождает все ожидающие операции.
    function dispose() {
      if (disposed) return;
      cancel();
      disposed = true;
      [transitionCover, backgroundCrossfade, backgroundVideoCrossfade, blurBackgroundCrossfade, blurBackgroundVideoCrossfade]
        .forEach(function(element) {
          if (element && element.parentNode) element.parentNode.removeChild(element);
        });
      transitionCover = null;
      backgroundCrossfade = null;
      backgroundVideoCrossfade = null;
      blurBackgroundCrossfade = null;
      blurBackgroundVideoCrossfade = null;
      if (documentRef.documentElement && documentRef.documentElement.style && typeof documentRef.documentElement.style.removeProperty === "function") {
        documentRef.documentElement.style.removeProperty("--visualTransitionMs");
      }
    }

    return Object.freeze({
      isCandidate: isVisualBatchCandidate,
      collectActions: collectVisualBatchActions,
      getSettings: getTransitionSettings,
      execute: execute,
      cancel: cancel,
      dispose: dispose
    });
  }

  return {
    DEFAULT_TRANSITION_OUT_MS: DEFAULT_TRANSITION_OUT_MS,
    DEFAULT_TRANSITION_IN_MS: DEFAULT_TRANSITION_IN_MS,
    DEFAULT_TRANSITION_TOTAL_MS: DEFAULT_TRANSITION_TOTAL_MS,
    createVisualTransitionController: createVisualTransitionController
  };
});
