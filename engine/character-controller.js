// Экспортирует показ, позиционирование, автосохранение и lifecycle единственного слоя персонажа.
(function(root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VN_CHARACTER_CONTROLLER = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createCharacterControllerModule() {
  "use strict";

  var CHARACTER_WORK_HEIGHT_RATIO = 0.85;
  var DEFAULT_FOCUS_OPTIONS = Object.freeze({
    pos: "center",
    focusX: 0.5,
    focusY: 0.5,
    scale: 1
  });

  // Ограничивает число диапазоном, если координатор не передал общий clamp.
  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // Возвращает число либо fallback без зависимости от утилит engine.js.
  function numberOr(value, fallback) {
    return typeof value === "number" && !isNaN(value) ? value : fallback;
  }

  // Создаёт независимую копию focus-настроек, чтобы вызывающий код не менял внутреннее состояние по ссылке.
  function cloneFocusOptions(value) {
    var source = value || DEFAULT_FOCUS_OPTIONS;
    return {
      pos: source.pos,
      focusX: source.focusX,
      focusY: source.focusY,
      scale: source.scale
    };
  }

  // Извлекает путь изображения из строковой и object-записи ассета персонажа.
  function getCharacterImagePath(imageEntry) {
    if (typeof imageEntry === "string") return imageEntry;
    if (imageEntry && typeof imageEntry === "object") {
      return imageEntry.file || imageEntry.src || imageEntry.image || "";
    }
    return "";
  }

  // Создаёт контроллер единственного слоя персонажа с явно переданными DOM и runtime-зависимостями.
  function createCharacterController(options) {
    options = options || {};

    var character = options.character || null;
    var frame = options.frame || null;
    var novelWindow = options.novelWindow || null;
    var windowRef = options.window || (typeof window !== "undefined" ? window : null);
    var performanceRef = options.performance || (typeof performance !== "undefined" ? performance : null);
    var failedImages = options.failedImages || Object.create(null);
    var setTimeoutFn = options.setTimeout || setTimeout;
    var clearTimeoutFn = options.clearTimeout || clearTimeout;
    var requestAnimationFrameFn = options.requestAnimationFrame || function(callback) {
      return setTimeoutFn(callback, 0);
    };
    var cancelAnimationFrameFn = options.cancelAnimationFrame || clearTimeoutFn;
    var warn = typeof options.warn === "function" ? options.warn : function() {};
    var log = typeof options.log === "function" ? options.log : function() {};
    var verbose = typeof options.writeVerbose === "function" ? options.writeVerbose : function() {};
    var focusOptions = cloneFocusOptions(DEFAULT_FOCUS_OPTIONS);
    var issuedSequence = 0;
    var activeSequence = 0;
    var pendingTimers = [];
    var pendingFrames = [];
    var disposed = false;

    // Использует общий clamp движка либо безопасную локальную реализацию.
    function clamp(value, min, max) {
      return typeof options.clamp === "function"
        ? options.clamp(value, min, max)
        : clampNumber(value, min, max);
    }

    // Нормализует URL для сравнения и снимков, не выполняя сетевых операций внутри контроллера.
    function normalizeUrl(value) {
      return typeof options.normalizeUrl === "function" ? options.normalizeUrl(value) : String(value || "");
    }

    // Очищает URL для debug/warning без раскрытия query, hash и встроенных данных.
    function sanitizeResource(value) {
      return typeof options.sanitizeResource === "function" ? options.sanitizeResource(value) : String(value || "");
    }

    // Очищает диагностический объект через общую политику runtime.
    function sanitizeDetails(value) {
      return typeof options.sanitizeDetails === "function" ? options.sanitizeDetails(value) : value;
    }

    // Возвращает scene/action контекст только для явно включённой диагностики и защиты загрузки.
    function getRuntimeContext() {
      var context = typeof options.getRuntimeContext === "function" ? options.getRuntimeContext() : null;
      return context && typeof context === "object" ? context : {};
    }

    // Проверяет, разрешена ли подробная диагностика персонажей.
    function isDebugEnabled() {
      return typeof options.isDebugEnabled === "function" && options.isDebugEnabled();
    }

    // Снимает завершённый таймер с lifecycle-реестра.
    function untrackTimer(timerId) {
      var index = pendingTimers.indexOf(timerId);
      if (index >= 0) pendingTimers.splice(index, 1);
    }

    // Снимает выполненный animation frame с lifecycle-реестра.
    function untrackFrame(frameId) {
      var index = pendingFrames.indexOf(frameId);
      if (index >= 0) pendingFrames.splice(index, 1);
    }

    // Отменяет отложенные flow-callback и перерасчёты предыдущего поколения.
    function cancelScheduledWork() {
      pendingTimers.slice().forEach(function(timerId) {
        clearTimeoutFn(timerId);
      });
      pendingFrames.slice().forEach(function(frameId) {
        cancelAnimationFrameFn(frameId);
      });
      pendingTimers = [];
      pendingFrames = [];
    }

    // Планирует callback только для всё ещё активного поколения персонажа.
    function scheduleCallback(callback, sequence) {
      if (typeof callback !== "function") return null;
      var timerId = setTimeoutFn(function runCharacterCallback() {
        untrackTimer(timerId);
        if (!disposed && sequence === activeSequence) callback();
      }, 0);
      pendingTimers.push(timerId);
      return timerId;
    }

    // Планирует DOM-перерасчёт и не выполняет его после cancel/dispose.
    function scheduleFrame(callback, sequence) {
      if (typeof callback !== "function") return null;
      var frameId = requestAnimationFrameFn(function runCharacterFrame() {
        untrackFrame(frameId);
        if (!disposed && sequence === activeSequence) callback();
      });
      pendingFrames.push(frameId);
      return frameId;
    }

    // Начинает новое поколение, снимая обработчики и отложенные действия старого изображения.
    function beginGeneration() {
      issuedSequence++;
      activeSequence = issuedSequence;
      cancelScheduledWork();
      if (character) {
        character.onload = null;
        character.onerror = null;
      }
      return activeSequence;
    }

    // Проверяет, что callback загрузки относится к текущему изображению.
    function isGenerationActive(sequence) {
      return !disposed && sequence === activeSequence;
    }

    // Инвалидирует текущую загрузку, не меняя видимость и src самостоятельно.
    function cancel(reason) {
      issuedSequence++;
      activeSequence = issuedSequence;
      cancelScheduledWork();
      if (character) {
        character.onload = null;
        character.onerror = null;
      }
      logCharacterFocusDebug("cancel", { reason: reason || "" });
    }

    // Приводит позицию персонажа к одному из трёх поддерживаемых слотов.
    function normalizePosition(pos) {
      var value = String(pos || "").trim().toLowerCase();
      if (value === "left" || value === "right" || value === "center") return value;
      return DEFAULT_FOCUS_OPTIONS.pos;
    }

    // Нормализует инвертированную вертикальную точку фокуса персонажа: 0 снизу, 1 сверху.
    function normalizeFocusY(value, fallback) {
      if (value === null || value === undefined || value === "") return fallback;
      var rawValue = typeof value === "string" ? value.trim() : value;
      var textValue = typeof rawValue === "string" ? rawValue.toLowerCase() : rawValue;
      if (textValue === "bottom" || textValue === "end") return 0;
      if (textValue === "top" || textValue === "start") return 1;
      if (textValue === "center" || textValue === "middle") return 0.5;

      var resolvedValue = typeof options.resolveVariableValue === "function"
        ? options.resolveVariableValue(rawValue, "character focusY")
        : rawValue;
      var numeric = Number(resolvedValue);
      if (!isFinite(numeric)) return fallback;
      if (numeric > 1 && numeric <= 100) numeric = numeric / 100;
      return clamp(numeric, 0, 1);
    }

    // Собирает полный набор focus-настроек, используя прежнее состояние только как явный fallback.
    function normalizeFocusOptions(value, fallback) {
      var base = fallback || DEFAULT_FOCUS_OPTIONS;
      var source = value || {};
      var normalizedFocusX = typeof options.normalizeFocusX === "function"
        ? options.normalizeFocusX(source.focusX, base.focusX)
        : numberOr(source.focusX, base.focusX);
      var normalizedScale = typeof options.normalizeScale === "function"
        ? options.normalizeScale(source.scale, base.scale)
        : numberOr(source.scale, base.scale);

      return {
        pos: normalizePosition(source.pos !== undefined ? source.pos : base.pos),
        focusX: normalizedFocusX,
        focusY: normalizeFocusY(source.focusY, base.focusY),
        scale: normalizedScale === null ? base.scale : normalizedScale
      };
    }

    // Сливает общие и локальные настройки, копируя только явно заданные поля.
    function mergeFocusOptions(baseOptions, overrideOptions) {
      var merged = {};

      // Копирует одно непустое поле без переноса прототипа исходного объекта.
      function copyOption(source, key) {
        if (source && source[key] !== undefined && source[key] !== null && source[key] !== "") {
          merged[key] = source[key];
        }
      }

      ["pos", "focusX", "focusY", "scale"].forEach(function(key) {
        copyOption(baseOptions, key);
      });
      ["pos", "focusX", "focusY", "scale"].forEach(function(key) {
        copyOption(overrideOptions, key);
      });
      return merged;
    }

    // Сравнивает нормализованные focus-настройки с небольшим допуском для дробных значений.
    function areFocusOptionsEqual(first, second) {
      if (!first || !second) return false;
      return (
        normalizePosition(first.pos) === normalizePosition(second.pos) &&
        Math.abs(numberOr(first.focusX, 0.5) - numberOr(second.focusX, 0.5)) < 0.0001 &&
        Math.abs(numberOr(first.focusY, 0.5) - numberOr(second.focusY, 0.5)) < 0.0001 &&
        Math.abs(numberOr(first.scale, 1) - numberOr(second.scale, 1)) < 0.0001
      );
    }

    // Возвращает горизонтальный центр выбранного композиционного слота.
    function getSlotRatio(pos) {
      var normalizedPos = normalizePosition(pos);
      if (normalizedPos === "left") return 0.35;
      if (normalizedPos === "right") return 0.65;
      return 0.5;
    }

    // Собирает путь и focus-настройки из общих полей персонажа, эмоции и imageOptions.
    function resolveAssetInfo(charId, emotion) {
      var result = { file: "", focusOptions: {} };
      if (!charId || typeof options.getCharacterDefinition !== "function") return result;

      var characterDefinition = options.getCharacterDefinition(charId);
      var emotionKey = emotion || "neutral";
      if (!characterDefinition || !characterDefinition.images) return result;

      var imageEntry = characterDefinition.images[emotionKey];
      result.file = getCharacterImagePath(imageEntry);
      result.focusOptions = mergeFocusOptions(result.focusOptions, characterDefinition);
      result.focusOptions = mergeFocusOptions(result.focusOptions, imageEntry);
      if (characterDefinition.imageOptions && characterDefinition.imageOptions[emotionKey]) {
        result.focusOptions = mergeFocusOptions(result.focusOptions, characterDefinition.imageOptions[emotionKey]);
      }
      return result;
    }

    // Проверяет, относится ли текущий DOM-src к одному ассету с учётом оптимизированных кандидатов.
    function imageMatches(currentSrc, storySrc) {
      return typeof options.imageMatchesCandidates === "function"
        ? options.imageMatchesCandidates(currentSrc, storySrc)
        : normalizeUrl(currentSrc) === normalizeUrl(storySrc);
    }

    // Проверяет, исчерпаны ли все разрешённые варианты изображения.
    function areAllCandidatesFailed(src) {
      return typeof options.areAllImageCandidatesFailed === "function" && options.areAllImageCandidatesFailed(src);
    }

    // Округляет числа диагностического снимка до читаемой точности.
    function roundDebugNumber(value) {
      return typeof value === "number" && isFinite(value) ? Math.round(value * 1000) / 1000 : value;
    }

    // Копирует DOMRect в обычный объект, исключая изменяемые live-значения браузера.
    function getDebugRect(element) {
      if (!element || typeof element.getBoundingClientRect !== "function") return null;
      var rect = element.getBoundingClientRect();
      return {
        left: roundDebugNumber(rect.left),
        top: roundDebugNumber(rect.top),
        right: roundDebugNumber(rect.right),
        bottom: roundDebugNumber(rect.bottom),
        width: roundDebugNumber(rect.width),
        height: roundDebugNumber(rect.height)
      };
    }

    // Собирает подробный снимок DOM и focus-состояния только для явно включённой диагностики.
    function getDebugSnapshot(extra) {
      var getComputedStyleFn = options.getComputedStyle || (windowRef && windowRef.getComputedStyle
        ? windowRef.getComputedStyle.bind(windowRef)
        : null);
      var frameComputed = frame && getComputedStyleFn ? getComputedStyleFn(frame) : null;
      var characterComputed = character && getComputedStyleFn ? getComputedStyleFn(character) : null;
      var runtime = getRuntimeContext();
      var attrSrc = character && typeof character.getAttribute === "function" ? character.getAttribute("src") || "" : "";

      return {
        timeMs: Date.now(),
        perfMs: performanceRef && typeof performanceRef.now === "function" ? roundDebugNumber(performanceRef.now()) : null,
        sceneId: runtime.sceneId || null,
        actionIndex: runtime.actionIndex === undefined ? null : runtime.actionIndex,
        currentSceneId: runtime.currentSceneId || null,
        charSeq: issuedSequence,
        activeCharSeq: activeSequence,
        focusOptions: cloneFocusOptions(focusOptions),
        extra: sanitizeDetails(extra || {}),
        viewport: {
          width: windowRef ? windowRef.innerWidth : null,
          height: windowRef ? windowRef.innerHeight : null
        },
        novelWindow: novelWindow ? {
          clientWidth: novelWindow.clientWidth,
          clientHeight: novelWindow.clientHeight,
          rect: getDebugRect(novelWindow)
        } : null,
        frame: frame ? {
          hidden: frame.classList.contains("hidden"),
          rect: getDebugRect(frame),
          inlineStyle: {
            left: frame.style.left,
            top: frame.style.top,
            right: frame.style.right,
            bottom: frame.style.bottom,
            width: frame.style.width,
            height: frame.style.height,
            transform: frame.style.transform,
            overflow: frame.style.overflow
          },
          computedStyle: frameComputed ? {
            left: frameComputed.left,
            top: frameComputed.top,
            right: frameComputed.right,
            bottom: frameComputed.bottom,
            width: frameComputed.width,
            height: frameComputed.height,
            transform: frameComputed.transform,
            overflow: frameComputed.overflow,
            display: frameComputed.display,
            opacity: frameComputed.opacity
          } : null
        } : null,
        char: character ? {
          hidden: character.classList.contains("hidden"),
          complete: !!character.complete,
          naturalWidth: character.naturalWidth || 0,
          naturalHeight: character.naturalHeight || 0,
          offsetWidth: character.offsetWidth,
          offsetHeight: character.offsetHeight,
          datasetCharId: character.dataset ? character.dataset.charId || "" : "",
          attrSrc: sanitizeResource(attrSrc),
          currentSrc: sanitizeResource(character.currentSrc || character.src || ""),
          rect: getDebugRect(character),
          inlineStyle: {
            left: character.style.left,
            top: character.style.top,
            right: character.style.right,
            bottom: character.style.bottom,
            width: character.style.width,
            height: character.style.height,
            maxHeight: character.style.maxHeight,
            transform: character.style.transform
          },
          computedStyle: characterComputed ? {
            left: characterComputed.left,
            top: characterComputed.top,
            right: characterComputed.right,
            bottom: characterComputed.bottom,
            width: characterComputed.width,
            height: characterComputed.height,
            maxHeight: characterComputed.maxHeight,
            transform: characterComputed.transform,
            display: characterComputed.display,
            opacity: characterComputed.opacity
          } : null
        } : null
      };
    }

    // Выводит структурированный debug-снимок только при явной категории character.
    function logCharacterFocusDebug(label, extra) {
      if (!isDebugEnabled()) return;
      log("[CHAR DEBUG] " + label, getDebugSnapshot(extra));
    }

    // Выводит плоскую строку координат для копирования из браузерной консоли.
    function logCharacterFrameLine(label, values) {
      if (!isDebugEnabled()) return;
      var data = values || {};
      var parts = [];
      Object.keys(data).forEach(function(key) {
        var value = data[key];
        if (typeof value === "number" && isFinite(value)) value = roundDebugNumber(value);
        if (/(?:src|url|file|poster|fallback)$/i.test(key)) value = sanitizeResource(value);
        parts.push(key + "=" + value);
      });
      log("[CHAR FRAME] " + label + " " + parts.join(" "));
    }

    // Сбрасывает inline-геометрию, чтобы старые px-координаты не мигали при следующем show.
    function resetVisualLayout(reason) {
      focusOptions = cloneFocusOptions(DEFAULT_FOCUS_OPTIONS);
      if (frame) {
        frame.classList.add("hidden");
        frame.style.left = "50%";
        frame.style.top = "";
        frame.style.bottom = "0";
        frame.style.width = "0px";
        frame.style.height = "0px";
        frame.style.transform = "translateX(-50%)";
        frame.style.overflow = "visible";
      }
      if (character) {
        character.classList.add("hidden");
        character.style.left = "0";
        character.style.top = "0";
        character.style.bottom = "auto";
        character.style.width = "100%";
        character.style.height = "0px";
        character.style.maxHeight = "none";
        character.style.transform = "";
      }
      logCharacterFocusDebug("resetLayout", { reason: reason || "" });
    }

    // Скрывает персонажа, инвалидирует загрузки и очищает идентификатор текущего ассета.
    function hide(reason) {
      cancel(reason || "hide");
      if (!character) {
        warn("[Engine] Не найден DOM-слой персонажа");
        return;
      }
      character.classList.add("hidden");
      character.src = "";
      if (typeof character.removeAttribute === "function") character.removeAttribute("data-char-id");
      resetVisualLayout(reason || "hide");
    }

    // Пересчитывает рамку и изображение по размеру окна, слоту, focus и scale.
    function adjustScale(reason) {
      if (disposed || !character) return;

      var availableHeight = novelWindow ? novelWindow.clientHeight : (windowRef ? windowRef.innerHeight : 0);
      var availableWidth = novelWindow ? novelWindow.clientWidth : (windowRef ? windowRef.innerWidth : 0);
      focusOptions = normalizeFocusOptions(focusOptions, DEFAULT_FOCUS_OPTIONS);
      var baseCharHeight = Math.max(0, availableHeight * CHARACTER_WORK_HEIGHT_RATIO);
      var targetCharHeight = baseCharHeight * focusOptions.scale;
      var naturalWidth = character.naturalWidth || 0;
      var naturalHeight = character.naturalHeight || 0;
      var runtime = getRuntimeContext();

      logCharacterFocusDebug("scale:start", {
        reason: reason || "",
        availableWidth: availableWidth,
        availableHeight: availableHeight,
        baseCharHeight: baseCharHeight,
        targetCharHeight: targetCharHeight,
        naturalWidth: naturalWidth,
        naturalHeight: naturalHeight
      });

      if (!naturalWidth || !naturalHeight || !availableWidth || !availableHeight) {
        if (frame) {
          frame.style.left = (getSlotRatio(focusOptions.pos) * 100) + "%";
          frame.style.top = Math.max(0, availableHeight - baseCharHeight) + "px";
          frame.style.bottom = "auto";
          frame.style.width = "0px";
          frame.style.height = targetCharHeight + "px";
          frame.style.transform = "translateX(-50%)";
          frame.style.overflow = "visible";
        }
        character.style.left = "0";
        character.style.top = "0";
        character.style.bottom = "auto";
        character.style.width = "100%";
        character.style.height = "100%";
        character.style.transform = "";
        character.style.maxHeight = "none";
        logCharacterFocusDebug("scale:fallbackNoNaturalSize", {
          reason: reason || "",
          availableWidth: availableWidth,
          availableHeight: availableHeight,
          focusOptions: cloneFocusOptions(focusOptions),
          frame: frame ? {
            left: frame.style.left,
            top: frame.style.top,
            width: frame.style.width,
            height: frame.style.height
          } : null,
          baseCharHeight: baseCharHeight,
          targetCharHeight: targetCharHeight
        });
        logCharacterFrameLine("fallbackNoNaturalSize", {
          reason: reason || "",
          scene: runtime.sceneId || "",
          index: runtime.actionIndex === undefined ? "" : runtime.actionIndex,
          pos: focusOptions.pos,
          focusX: focusOptions.focusX,
          focusY: focusOptions.focusY,
          scale: focusOptions.scale,
          availableWidth: availableWidth,
          availableHeight: availableHeight,
          frameLeft: frame ? frame.style.left : "",
          frameTop: frame ? frame.style.top : "",
          frameWidth: frame ? frame.style.width : "",
          frameHeight: frame ? frame.style.height : "",
          naturalWidth: naturalWidth,
          naturalHeight: naturalHeight
        });
        return;
      }

      var baseCharWidth = naturalWidth * (baseCharHeight / naturalHeight);
      var targetCharWidth = baseCharWidth * focusOptions.scale;
      var targetScale = targetCharHeight / naturalHeight;
      var slotCenterX = availableWidth * getSlotRatio(focusOptions.pos);
      var workCenterY = availableHeight - baseCharHeight / 2;
      var frameLeft = slotCenterX - targetCharWidth / 2;
      var frameTop = workCenterY - targetCharHeight / 2;
      var innerLeft = (0.5 - focusOptions.focusX) * targetCharWidth;
      var innerTop = (0.5 - focusOptions.focusY) * baseCharHeight;
      var imageViewportLeft = frameLeft + innerLeft;
      var imageViewportTop = frameTop + innerTop;

      if (frame) {
        frame.style.left = frameLeft + "px";
        frame.style.top = frameTop + "px";
        frame.style.bottom = "auto";
        frame.style.width = targetCharWidth + "px";
        frame.style.height = targetCharHeight + "px";
        frame.style.transform = "none";
        frame.style.overflow = "visible";
        character.style.left = innerLeft + "px";
        character.style.top = innerTop + "px";
      } else {
        character.style.left = imageViewportLeft + "px";
        character.style.top = imageViewportTop + "px";
      }
      character.style.bottom = "auto";
      character.style.width = targetCharWidth + "px";
      character.style.height = targetCharHeight + "px";
      character.style.transform = "";

      if (isDebugEnabled()) {
        logCharacterFocusDebug("scale:applied", {
          reason: reason || "",
          availableWidth: availableWidth,
          availableHeight: availableHeight,
          baseCharHeight: baseCharHeight,
          targetCharWidth: targetCharWidth,
          targetCharHeight: targetCharHeight,
          frame: {
            left: frameLeft,
            top: frameTop,
            width: targetCharWidth,
            height: targetCharHeight,
            slotCenterX: slotCenterX,
            workCenterY: workCenterY
          },
          innerImage: {
            left: innerLeft,
            top: innerTop,
            width: targetCharWidth,
            height: targetCharHeight,
            viewportLeft: imageViewportLeft,
            viewportTop: imageViewportTop
          },
          slotCenterX: slotCenterX,
          workCenterY: workCenterY,
          targetScale: targetScale
        });
        logCharacterFrameLine("applied", {
          reason: reason || "",
          scene: runtime.sceneId || "",
          index: runtime.actionIndex === undefined ? "" : runtime.actionIndex,
          src: character.currentSrc || character.src || "",
          pos: focusOptions.pos,
          focusX: focusOptions.focusX,
          focusY: focusOptions.focusY,
          scale: focusOptions.scale,
          availableWidth: availableWidth,
          availableHeight: availableHeight,
          naturalWidth: naturalWidth,
          naturalHeight: naturalHeight,
          frameLeft: frameLeft,
          frameTop: frameTop,
          frameWidth: targetCharWidth,
          frameHeight: targetCharHeight,
          innerLeft: innerLeft,
          innerTop: innerTop,
          imageViewportLeft: imageViewportLeft,
          imageViewportTop: imageViewportTop,
          charRectLeft: getDebugRect(character) ? getDebugRect(character).left : "",
          charRectTop: getDebugRect(character) ? getDebugRect(character).top : "",
          frameRectLeft: frame && getDebugRect(frame) ? getDebugRect(frame).left : "",
          frameRectTop: frame && getDebugRect(frame) ? getDebugRect(frame).top : ""
        });
      }
      character.style.maxHeight = "none";
    }

    // Применяет новые focus-настройки и сразу обновляет геометрию текущего изображения.
    function applyFocusOptions(value, reason) {
      var beforeOptions = cloneFocusOptions(focusOptions);
      focusOptions = normalizeFocusOptions(value || {}, focusOptions || DEFAULT_FOCUS_OPTIONS);
      logCharacterFocusDebug("applyFocusOptions", {
        reason: reason || "",
        inputOptions: value || {},
        beforeOptions: beforeOptions,
        normalizedOptions: cloneFocusOptions(focusOptions)
      });
      adjustScale(reason || "applyFocusOptions");
    }

    // Назначает растровое изображение с общей цепочкой оптимизированных кандидатов и проверкой поколения.
    function assignImage(src, sequence, handlers) {
      if (!character || typeof options.assignRasterImage !== "function") {
        if (handlers && handlers.onAllFailed) handlers.onAllFailed(src);
        return;
      }
      var callbacks = handlers || {};
      callbacks.isActive = function isCurrentCharacterGeneration() {
        return isGenerationActive(sequence);
      };
      options.assignRasterImage(character, src, callbacks);
    }

    // Показывает персонажа, обрабатывая тот же кадр, смену эмоции и полную загрузку нового charId.
    function show(src, pos, charId, done, rawFocusOptions) {
      if (disposed) return { async: false, changed: false };
      if (src === null || src === "" || src === undefined) {
        hide("show empty src");
        if (typeof done === "function") done();
        return { async: false, changed: true };
      }
      if (!character) {
        warn("[Engine] Не найден DOM-слой персонажа");
        if (typeof done === "function") done();
        return { async: false, changed: false };
      }

      var normalizedCharacterFocusOptions = normalizeFocusOptions(
        mergeFocusOptions({ pos: pos }, rawFocusOptions),
        DEFAULT_FOCUS_OPTIONS
      );
      var currentSrc = typeof character.getAttribute === "function" ? character.getAttribute("src") || "" : character.src || "";
      var currentCharId = character.dataset ? character.dataset.charId || "" : "";
      var sameImageVisible = imageMatches(currentSrc, src) && !character.classList.contains("hidden");
      var sameFocus = areFocusOptionsEqual(normalizedCharacterFocusOptions, focusOptions);
      if (sameImageVisible && sameFocus) {
        return { async: false, changed: false };
      }

      var sequence = beginGeneration();
      var normalizedSrc = normalizeUrl(src);
      if (areAllCandidatesFailed(src)) {
        var failedLogKey = normalizedSrc + "_logged";
        if (!failedImages[failedLogKey]) {
          warn("[CHAR FLOW] skip failed character src", {
            src: sanitizeResource(src),
            charId: charId
          });
          failedImages[failedLogKey] = true;
        }
        scheduleCallback(done, sequence);
        return { async: typeof done === "function", changed: false };
      }

      logCharacterFocusDebug("show:start", {
        seq: sequence,
        src: src,
        pos: pos,
        charId: charId,
        focusOptions: rawFocusOptions,
        normalizedSrc: normalizedSrc
      });
      applyFocusOptions(normalizedCharacterFocusOptions, "show");

      if (sameImageVisible) {
        if (frame) frame.classList.remove("hidden");
        scheduleCallback(done, sequence);
        return { async: typeof done === "function", changed: true };
      }

      if (currentCharId === charId && currentCharId && !character.classList.contains("hidden")) {
        assignImage(src, sequence, {
          onLoad: function handleEmotionImageLoad() {
            if (!isGenerationActive(sequence)) return;
            if (frame) frame.classList.remove("hidden");
            character.classList.remove("hidden");
            adjustScale("show:emotionOnLoad");
            scheduleCallback(done, sequence);
          },
          onAllFailed: function handleEmotionImageFailure() {
            if (!isGenerationActive(sequence)) return;
            scheduleCallback(done, sequence);
          }
        });
        return { async: typeof done === "function", changed: true };
      }

      if (charId && character.dataset) character.dataset.charId = charId;
      if (frame) frame.classList.add("hidden");
      character.classList.add("hidden");
      character.style.height = "0px";
      character.style.maxHeight = "none";

      assignImage(src, sequence, {
        onLoad: function handleCharacterImageLoad() {
          if (!isGenerationActive(sequence)) {
            warn("[CHAR FLOW] stale onload ignored", {
              seq: sequence,
              activeSeq: activeSequence,
              src: sanitizeResource(src)
            });
            return;
          }
          var runtime = getRuntimeContext();
          if (runtime.sceneId && runtime.currentSceneId && runtime.sceneId !== runtime.currentSceneId) {
            scheduleCallback(done, sequence);
            return;
          }
          if (frame) frame.classList.remove("hidden");
          character.classList.remove("hidden");
          adjustScale("show:onLoad");
          scheduleFrame(function finalizeCharacterAfterFrame() {
            adjustScale("show:onLoad:raf");
            logCharacterFocusDebug("show:onLoad:afterRaf", {
              seq: sequence,
              src: src,
              charId: charId,
              normalizedFocusOptions: normalizedCharacterFocusOptions
            });
            if (typeof done === "function") done();
          }, sequence);
        },
        onAllFailed: function handleCharacterImageFailure() {
          if (!isGenerationActive(sequence)) return;
          character.classList.add("hidden");
          if (typeof character.removeAttribute === "function") {
            character.removeAttribute("src");
            character.removeAttribute("data-char-id");
          }
          resetVisualLayout("show:onAllFailed");
          scheduleCallback(done, sequence);
        }
      });
      return { async: typeof done === "function", changed: true };
    }

    // Готовит финальное состояние персонажа для общего visual-transition batch без изменения DOM.
    function prepareVisualAction(action) {
      if (!action) return null;
      if ((!action.charId || action.charId === null) && action.src === null) {
        return { kind: "hide", changesVisual: isVisible() };
      }
      if (!action.charId) return { kind: "hide", changesVisual: isVisible() };

      var assetInfo = resolveAssetInfo(action.charId, action.emotion);
      var src = assetInfo.file;
      if (!src) {
        verbose("[VISUAL BATCH] char skipped: image not found", action.charId);
        return { kind: "skip", changesVisual: false };
      }
      if (areAllCandidatesFailed(src)) {
        verbose("[VISUAL BATCH] char skipped: image marked failed", sanitizeResource(src));
        return { kind: "skip", changesVisual: false };
      }

      var normalizedSrc = normalizeUrl(src);
      var currentSrc = character
        ? normalizeUrl((typeof character.getAttribute === "function" ? character.getAttribute("src") : "") || character.currentSrc || character.src || "")
        : "";
      var currentCharId = character && character.dataset ? character.dataset.charId || "" : "";
      var hidden = !isVisible();
      var mergedFocusOptions = mergeFocusOptions(assetInfo.focusOptions, action);
      var normalizedFocusOptions = normalizeFocusOptions(mergedFocusOptions, DEFAULT_FOCUS_OPTIONS);
      var changesVisual =
        hidden ||
        !currentSrc ||
        !imageMatches(currentSrc, src) ||
        currentCharId !== action.charId ||
        !areFocusOptionsEqual(normalizedFocusOptions, focusOptions);

      logCharacterFocusDebug("prepareVisualAction", {
        action: action,
        resolvedSrc: src,
        assetFocusOptions: assetInfo.focusOptions,
        actionFocusOptions: mergedFocusOptions,
        normalizedFocusOptions: normalizedFocusOptions,
        currentSrc: currentSrc,
        currentCharId: currentCharId,
        hidden: hidden,
        changesVisual: changesVisual
      });
      return {
        kind: "show",
        src: src,
        normalizedSrc: normalizedSrc,
        pos: action.pos,
        charId: action.charId,
        focusOptions: normalizedFocusOptions,
        changesVisual: changesVisual
      };
    }

    // Применяет подготовленный transition-план, сохраняя загрузку изображения внутри character lifecycle.
    function applyPreparedVisualState(preparedCharacter) {
      if (!preparedCharacter || disposed || !character) return;
      logCharacterFocusDebug("visualBatch:apply:start", { preparedChar: preparedCharacter });

      if (preparedCharacter.kind === "hide") {
        hide("visualBatch:hide");
        return;
      }
      if (preparedCharacter.kind !== "show" || areAllCandidatesFailed(preparedCharacter.src)) return;

      var sequence = beginGeneration();
      applyFocusOptions(
        mergeFocusOptions({ pos: preparedCharacter.pos }, preparedCharacter.focusOptions),
        "visualBatch:applyFocus"
      );
      if (preparedCharacter.charId && character.dataset) character.dataset.charId = preparedCharacter.charId;
      character.style.maxHeight = "none";
      assignImage(preparedCharacter.src, sequence, {
        onLoad: function handlePreparedCharacterLoad(loadedUrl) {
          if (!isGenerationActive(sequence)) return;
          logCharacterFocusDebug("visualBatch:onLoad", {
            preparedChar: preparedCharacter,
            loadedUrl: loadedUrl
          });
          adjustScale("visualBatch:onLoad");
          scheduleFrame(function adjustPreparedCharacterAfterFrame() {
            adjustScale("visualBatch:onLoad:raf");
          }, sequence);
        },
        onAllFailed: function handlePreparedCharacterFailure(failedSrc) {
          if (!isGenerationActive(sequence)) return;
          logCharacterFocusDebug("visualBatch:onAllFailed", {
            preparedChar: preparedCharacter,
            failedSrc: failedSrc
          });
        }
      });
      if (frame) frame.classList.remove("hidden");
      character.classList.remove("hidden");
      logCharacterFocusDebug("visualBatch:afterSrcVisible", { preparedChar: preparedCharacter });
      adjustScale("visualBatch:afterSrcVisible");
      scheduleFrame(function adjustPreparedCharacterVisibilityAfterFrame() {
        adjustScale("visualBatch:raf");
      }, sequence);
    }

    // Возвращает true, когда персонаж видим и имеет назначенный src.
    function isVisible() {
      return !!(
        character &&
        !character.classList.contains("hidden") &&
        String(character.currentSrc || character.src || "").trim()
      );
    }

    // Формирует совместимый снимок персонажа для payload автосохранения.
    function captureSnapshot() {
      if (!isVisible()) return { hidden: true };
      return {
        hidden: false,
        src: normalizeUrl(character.currentSrc || character.src || ""),
        charId: character.dataset && character.dataset.charId ? String(character.dataset.charId) : "",
        pos: normalizePosition(focusOptions.pos),
        focusX: typeof focusOptions.focusX === "number" ? focusOptions.focusX : 0.5,
        focusY: typeof focusOptions.focusY === "number" ? focusOptions.focusY : 0.5,
        scale: typeof focusOptions.scale === "number" ? focusOptions.scale : 1
      };
    }

    // Показывает или скрывает персонажа из проверенного autosave payload до продолжения runCurrent.
    function applySnapshot(snapshot) {
      logCharacterFocusDebug("autosave:applyCharacterSnapshot:start", { snapshot: snapshot });
      if (!snapshot || typeof snapshot !== "object") return;
      if (snapshot.hidden) {
        hide("autosave hidden");
        return;
      }
      var src = typeof snapshot.src === "string" ? snapshot.src.trim() : "";
      if (!src) {
        hide("autosave empty src");
        return;
      }
      var pos = normalizePosition(snapshot.pos);
      var charId = typeof snapshot.charId === "string" && snapshot.charId ? snapshot.charId : null;
      show(src, pos, charId, null, {
        pos: pos,
        focusX: typeof snapshot.focusX === "number" ? snapshot.focusX : 0.5,
        focusY: typeof snapshot.focusY === "number" ? snapshot.focusY : 0.5,
        scale: typeof snapshot.scale === "number" ? snapshot.scale : 1
      });
    }

    // Возвращает копию текущих focus-настроек для координации и тестов без доступа к внутреннему объекту.
    function getFocusOptions() {
      return cloneFocusOptions(focusOptions);
    }

    // Полностью прекращает загрузки и освобождает DOM-src при уходе со страницы.
    function dispose() {
      if (disposed) return;
      cancel("dispose");
      if (character) {
        character.classList.add("hidden");
        character.src = "";
        if (typeof character.removeAttribute === "function") character.removeAttribute("data-char-id");
      }
      resetVisualLayout("dispose");
      disposed = true;
    }

    return Object.freeze({
      getImagePath: getCharacterImagePath,
      resolveAssetInfo: resolveAssetInfo,
      normalizePosition: normalizePosition,
      normalizeFocusOptions: normalizeFocusOptions,
      mergeFocusOptions: mergeFocusOptions,
      areFocusOptionsEqual: areFocusOptionsEqual,
      prepareVisualAction: prepareVisualAction,
      applyPreparedVisualState: applyPreparedVisualState,
      show: show,
      hide: hide,
      cancel: cancel,
      adjustScale: adjustScale,
      captureSnapshot: captureSnapshot,
      applySnapshot: applySnapshot,
      getFocusOptions: getFocusOptions,
      isVisible: isVisible,
      getDebugSnapshot: getDebugSnapshot,
      dispose: dispose
    });
  }

  return {
    CHARACTER_WORK_HEIGHT_RATIO: CHARACTER_WORK_HEIGHT_RATIO,
    DEFAULT_FOCUS_OPTIONS: DEFAULT_FOCUS_OPTIONS,
    getCharacterImagePath: getCharacterImagePath,
    createCharacterController: createCharacterController
  };
});
