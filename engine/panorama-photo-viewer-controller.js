// Экспортирует lifecycle просмотрщика изображений из photo-меток 360 без доступа к глобальному состоянию движка.
(function(root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VN_PANORAMA_PHOTO_VIEWER_CONTROLLER = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createPanoramaPhotoViewerControllerModule() {
  "use strict";

  var PHOTO_ZOOM_MIN = 1;
  var PHOTO_ZOOM_MAX = 4;

  // Ограничивает число заданным диапазоном без зависимости от утилит центрального runtime.
  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // Читает первое явно заданное поле, сохраняя алиасы прежнего формата photo-меток.
  function readFirstField(source, fieldNames) {
    if (!source || typeof source !== "object") return undefined;
    for (var index = 0; index < fieldNames.length; index++) {
      var key = fieldNames[index];
      if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
    }
    return undefined;
  }

  // Проверяет, что метка открывает просмотр изображений, а не навигацию 360.
  function isPhotoMark(mark) {
    return !!(mark && typeof mark === "object" && String(mark.kind || "").toLowerCase() === "photo");
  }

  // Нормализует поддерживаемые строковые и объектные записи изображений в массив { file, caption }.
  function normalizePhotoImages(mark) {
    if (!mark || typeof mark !== "object") return [];
    var raw = readFirstField(mark, ["images", "image", "photos", "photo"]);
    var list = [];
    if (Array.isArray(raw)) {
      for (var index = 0; index < raw.length; index++) {
        var item = raw[index];
        if (typeof item === "string") {
          var onlyFile = String(item || "").trim();
          if (onlyFile) list.push({ file: onlyFile, caption: "" });
        } else if (item && typeof item === "object") {
          var file = String(readFirstField(item, ["file", "src", "path", "url"]) || "").trim();
          var caption = String(readFirstField(item, ["caption", "text"]) || "").trim();
          if (file) list.push({ file: file, caption: caption });
        }
      }
    } else if (typeof raw === "string") {
      var oneFile = String(raw || "").trim();
      if (oneFile) list.push({ file: oneFile, caption: "" });
    }
    return list;
  }

  // Создаёт контроллер карточки, одного переиспользуемого img и всех viewer-жестов.
  function createPanoramaPhotoViewerController(options) {
    options = options || {};

    var viewer = options.viewer || null;
    var viewport = options.viewport || null;
    var inner = options.inner || null;
    var image = options.image || null;
    var caption = options.caption || null;
    var panoramaCanvas = options.panoramaCanvas || null;
    var marksLayer = options.marksLayer || null;
    var windowTarget = options.window || null;
    var documentTarget = options.document || null;
    var previousButton = viewer && viewer.querySelector ? viewer.querySelector("[data-bg360-photo-prev]") : null;
    var nextButton = viewer && viewer.querySelector ? viewer.querySelector("[data-bg360-photo-next]") : null;
    var lifecycleStarted = false;
    var disposed = false;
    var imageGeneration = 0;
    var scheduledFrames = [];

    var state = {
      active: false,
      markId: "",
      images: [],
      index: 0,
      slideState: null,
      was360Interactive: true,
      slideGesture: null,
      pinchPointers: {},
      pinchStartDistance: null,
      pinchStartZoom: 1,
      suppressUiClickUntil: 0
    };

    // Возвращает текущее время через внедрённые часы для предсказуемой блокировки click после pan.
    function now() {
      return typeof options.now === "function" ? options.now() : Date.now();
    }

    // Передаёт предупреждение координатору либо использует консоль как безопасный fallback.
    function warn() {
      if (typeof options.warn === "function") {
        options.warn.apply(null, arguments);
      } else if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn.apply(console, arguments);
      }
    }

    // Запрашивает кадр через окно или синхронно выполняет callback в среде без requestAnimationFrame.
    function requestFrame(callback) {
      if (typeof options.requestAnimationFrame === "function") return options.requestAnimationFrame(callback);
      if (windowTarget && typeof windowTarget.requestAnimationFrame === "function") {
        return windowTarget.requestAnimationFrame(callback);
      }
      callback();
      return 0;
    }

    // Отменяет ранее запрошенный кадр тем же провайдером, которым он был создан.
    function cancelFrame(frameId) {
      if (!frameId) return;
      if (typeof options.cancelAnimationFrame === "function") {
        options.cancelAnimationFrame(frameId);
      } else if (windowTarget && typeof windowTarget.cancelAnimationFrame === "function") {
        windowTarget.cancelAnimationFrame(frameId);
      }
    }

    // Планирует layout с защитой от close/dispose и сохраняет кадр для явной отмены.
    function scheduleFrame(callback) {
      var record = { id: 0, active: true };
      scheduledFrames.push(record);
      record.id = requestFrame(function runScheduledPhotoViewerFrame() {
        if (!record.active) return;
        record.active = false;
        var recordIndex = scheduledFrames.indexOf(record);
        if (recordIndex >= 0) scheduledFrames.splice(recordIndex, 1);
        if (!disposed) callback();
      });
    }

    // Отменяет все ожидающие layout-кадры, чтобы закрытый viewer не менял DOM позднее.
    function cancelScheduledFrames() {
      scheduledFrames.slice().forEach(function cancelScheduledPhotoViewerFrame(record) {
        record.active = false;
        cancelFrame(record.id);
      });
      scheduledFrames = [];
    }

    // Создаёт пустое состояние zoom/pan: 100% соответствует базовой рамке, zoom ограничен 1..4.
    function createSlideState() {
      return {
        naturalW: 0,
        naturalH: 0,
        baseViewportW: 0,
        baseViewportH: 0,
        baseFitScale: 1,
        zoom: 1,
        tx: 0,
        ty: 0,
        loaded: false
      };
    }

    // Возвращает связанные DOM-элементы кадра и вычисляемую media-обёртку.
    function getViewerElements() {
      if (!viewport || !inner || !image) return null;
      return {
        media: viewport.parentElement,
        viewport: viewport,
        inner: inner,
        image: image
      };
    }

    // Возвращает метку по id через координатор, которому принадлежит список меток сцены.
    function getMarkById(markId) {
      return typeof options.getMarkById === "function" ? options.getMarkById(markId) : null;
    }

    // Проверяет фактическую активность 360-слоя перед открытием или восстановлением управления.
    function isPanoramaActive() {
      return typeof options.isPanoramaActive === "function" && !!options.isPanoramaActive();
    }

    // Проверяет блокировку меток, чтобы viewer не обходил ожидание навигационной команды.
    function isMarksLocked() {
      return typeof options.isMarksLocked === "function" && !!options.isMarksLocked();
    }

    // Читает интерактивность панорамы до заморозки viewer.
    function getPanoramaInteractive() {
      return typeof options.getPanoramaInteractive === "function" && !!options.getPanoramaInteractive();
    }

    // Передаёт центральному runtime новое состояние интерактивности панорамы.
    function setPanoramaInteractive(value) {
      if (typeof options.setPanoramaInteractive === "function") options.setPanoramaInteractive(!!value);
    }

    // Назначает изображение через общую политику движка либо напрямую в изолированном тестовом окружении.
    function assignImageSource(source, handlers) {
      if (typeof options.assignImage === "function") {
        options.assignImage(image, source, handlers || {});
      } else if (image) {
        image.src = source;
        if (handlers && typeof handlers.onLoad === "function") handlers.onLoad();
      }
    }

    // Возвращает подпись только из текущего элемента images[], не смешивая её с подписью метки на сцене.
    function getCaptionText(mark, imageIndex) {
      if (!mark || typeof mark !== "object") return "";
      var images = normalizePhotoImages(mark);
      var index = Math.max(0, Math.min(images.length - 1, Number(imageIndex) || 0));
      return images[index] ? String(images[index].caption || "").trim() : "";
    }

    // Синхронизирует ширину области фото и подписи, чтобы текст не раздувал карточку шире кадра.
    function applyFrameWidth(viewportWidth) {
      var widthPx = Math.max(1, Math.round(Number(viewportWidth) || 1)) + "px";
      var parts = getViewerElements();
      if (parts && parts.viewport) {
        parts.viewport.style.width = widthPx;
        parts.viewport.style.maxWidth = widthPx;
      }
      if (parts && parts.media) {
        parts.media.style.width = widthPx;
        parts.media.style.maxWidth = widthPx;
      }
      if (caption) {
        if (caption.classList.contains("hidden")) {
          caption.style.width = "";
          caption.style.maxWidth = "";
        } else {
          caption.style.width = widthPx;
          caption.style.maxWidth = widthPx;
        }
      }
    }

    // Вычисляет итоговый CSS-scale как базовое вписывание, умноженное на пользовательский zoom.
    function getImageScale(slideState) {
      if (!slideState) return 1;
      var base = slideState.baseFitScale > 0 ? slideState.baseFitScale : 1;
      var zoom = slideState.zoom > 0 ? slideState.zoom : 1;
      return base * zoom;
    }

    // Возвращает доступное место stage под кадр после учёта подписи.
    function getStageImageLimits() {
      var stage = viewer && viewer.querySelector ? viewer.querySelector(".bg360-photo-viewer-stage") : null;
      if (!stage) return { maxW: 1, maxH: 1 };
      var stageRect = stage.getBoundingClientRect();
      var hasCaption = !!(caption && !caption.classList.contains("hidden"));
      var captionHeight = hasCaption ? (caption.offsetHeight || 0) : 0;
      return {
        maxW: stageRect.width * 0.92,
        maxH: Math.max(64, stageRect.height * 0.9 - 12 - captionHeight)
      };
    }

    // Сбрасывает inline-размеры карточки при закрытии, чтобы следующий кадр считался с чистой геометрией.
    function clearFrameSizes() {
      var parts = getViewerElements();
      if (parts && parts.viewport) {
        parts.viewport.style.width = "";
        parts.viewport.style.height = "";
        parts.viewport.style.maxWidth = "";
      }
      if (parts && parts.media) {
        parts.media.style.width = "";
        parts.media.style.maxWidth = "";
      }
      if (caption) {
        caption.style.width = "";
        caption.style.maxWidth = "";
      }
    }

    // Применяет zoom/pan только к изображению, не масштабируя кнопки и подпись.
    function applySlideTransform() {
      var parts = getViewerElements();
      var slideState = state.slideState;
      if (!parts || !parts.inner || !slideState) return;
      var scale = getImageScale(slideState);
      parts.inner.style.transform =
        "translate(calc(-50% + " + slideState.tx + "px), calc(-50% + " + slideState.ty + "px)) scale(" + scale + ")";
    }

    // Ограничивает смещение увеличенного изображения фактическими границами viewport.
    function clampSlidePan() {
      var parts = getViewerElements();
      var slideState = state.slideState;
      if (!parts || !parts.viewport || !slideState || !slideState.naturalW || !slideState.naturalH) return;
      var rect = parts.viewport.getBoundingClientRect();
      var scale = getImageScale(slideState);
      var imageWidth = slideState.naturalW * scale;
      var imageHeight = slideState.naturalH * scale;
      var maxTx = Math.max(0, (imageWidth - rect.width) * 0.5);
      var maxTy = Math.max(0, (imageHeight - rect.height) * 0.5);
      slideState.tx = clampNumber(slideState.tx, -maxTx, maxTx);
      slideState.ty = clampNumber(slideState.ty, -maxTy, maxTy);
    }

    // Применяет zoom к размеру viewport: рамка растёт до границ экрана, но не становится меньше базовой.
    function applyZoomLayout() {
      var slideState = state.slideState;
      var parts = getViewerElements();
      if (!slideState || !parts || !parts.viewport || !slideState.baseViewportW || !slideState.baseViewportH) return;

      slideState.zoom = clampNumber(slideState.zoom, PHOTO_ZOOM_MIN, PHOTO_ZOOM_MAX);
      var limits = getStageImageLimits();
      var imageWidth = slideState.naturalW * slideState.baseFitScale * slideState.zoom;
      var imageHeight = slideState.naturalH * slideState.baseFitScale * slideState.zoom;
      var viewportWidth = Math.min(Math.max(slideState.baseViewportW, imageWidth), limits.maxW);
      var viewportHeight = Math.min(Math.max(slideState.baseViewportH, imageHeight), limits.maxH);

      applyFrameWidth(viewportWidth);
      parts.viewport.style.height = Math.round(viewportHeight) + "px";
      applySlideTransform();
      clampSlidePan();
    }

    // Обновляет подпись текущего фото и откладывает повторный layout после изменения её высоты.
    function updateCaption(mark, imageIndex) {
      if (!caption) return;
      var text = getCaptionText(mark, imageIndex);
      caption.textContent = text;
      caption.classList.toggle("hidden", !text);
      if (!text) {
        caption.style.width = "";
        caption.style.maxWidth = "";
      }
      if (state.active && state.slideState && state.slideState.loaded) {
        scheduleFrame(function relayoutAfterPhotoCaptionChange() {
          layoutCard(false);
        });
      }
    }

    // Показывает только доступные направления листания для текущего индекса.
    function updateNavButtons() {
      var count = state.images.length;
      if (previousButton) previousButton.classList.toggle("hidden", state.index <= 0 || count <= 1);
      if (nextButton) nextButton.classList.toggle("hidden", state.index >= count - 1 || count <= 1);
    }

    // Считает базовую рамку 100% с учётом aspect ratio и применяет сохранённый zoom.
    function layoutCard(resetZoom) {
      if (!state.active || !viewer) return;
      var stage = viewer.querySelector ? viewer.querySelector(".bg360-photo-viewer-stage") : null;
      var slideState = state.slideState;
      var parts = getViewerElements();
      if (!stage || !slideState || !parts || !parts.viewport || !slideState.naturalW || !slideState.naturalH) return;

      var stageRect = stage.getBoundingClientRect();
      var maxWidth = stageRect.width * 0.92;
      var maxHeight = stageRect.height * 0.9 - 12;
      var hasCaption = !!(caption && !caption.classList.contains("hidden"));
      var aspect = slideState.naturalW / slideState.naturalH;
      var viewportWidth;
      var viewportHeight;

      // Вписывает исходное соотношение сторон в доступную высоту и общую ширину stage.
      function computeBaseViewportSize(availableHeight) {
        var height = Math.max(64, availableHeight);
        if (maxWidth / height > aspect) {
          viewportHeight = height;
          viewportWidth = viewportHeight * aspect;
        } else {
          viewportWidth = maxWidth;
          viewportHeight = viewportWidth / aspect;
        }
      }

      computeBaseViewportSize(maxHeight);
      if (hasCaption) {
        applyFrameWidth(viewportWidth);
        var captionHeight = caption.offsetHeight || 0;
        if (captionHeight > 0) {
          computeBaseViewportSize(stageRect.height * 0.9 - captionHeight - 12);
        }
      }

      slideState.baseViewportW = viewportWidth;
      slideState.baseViewportH = viewportHeight;
      slideState.baseFitScale = Math.min(viewportWidth / slideState.naturalW, viewportHeight / slideState.naturalH);
      if (!isFinite(slideState.baseFitScale) || slideState.baseFitScale <= 0) slideState.baseFitScale = 1;

      if (resetZoom) {
        slideState.zoom = 1;
        slideState.tx = 0;
        slideState.ty = 0;
      }
      applyZoomLayout();
    }

    // Загружает один кадр и игнорирует поздний onLoad предыдущего изображения или уже закрытого viewer.
    function renderImage(imageIndex) {
      if (!state.images.length || !image) return;
      var index = clampNumber(Math.round(Number(imageIndex) || 0), 0, state.images.length - 1);
      state.index = index;
      var source = String((state.images[index] && state.images[index].file) || "").trim();
      var slideState = state.slideState || createSlideState();
      state.slideState = slideState;
      slideState.loaded = false;
      slideState.naturalW = 0;
      slideState.naturalH = 0;
      slideState.zoom = 1;
      slideState.tx = 0;
      slideState.ty = 0;
      applySlideTransform();

      var generation = ++imageGeneration;
      if (!source) {
        image.removeAttribute("src");
        return;
      }

      assignImageSource(source, {
        onLoad: function handlePhotoViewerImageLoad() {
          if (disposed || !state.active || generation !== imageGeneration || state.index !== index) return;
          slideState.naturalW = image.naturalWidth || image.width || 0;
          slideState.naturalH = image.naturalHeight || image.height || 0;
          slideState.loaded = true;
          layoutCard(true);
        }
      });
    }

    // Переключает единственный img на допустимый индекс и синхронизирует подпись с кнопками.
    function setIndex(nextIndex) {
      var count = state.images.length;
      if (!count) return false;
      var index = clampNumber(Math.round(Number(nextIndex) || 0), 0, count - 1);
      if (index === state.index && state.slideState && state.slideState.loaded) {
        updateNavButtons();
        return true;
      }
      renderImage(index);
      updateCaption(getMarkById(state.markId), index);
      updateNavButtons();
      return true;
    }

    // Замораживает 360 и показывает первый кадр только для доступной photo-метки с изображениями.
    function open(mark) {
      if (disposed || !mark || !isPhotoMark(mark)) return false;
      if (!viewer || !image || !isPanoramaActive() || isMarksLocked()) return false;

      var images = normalizePhotoImages(mark);
      if (!images.length) {
        warn("[bg360-photo] mark has no images", mark.id);
        return false;
      }

      cancelScheduledFrames();
      state.active = true;
      state.markId = String(mark.id || "");
      state.images = images;
      state.index = 0;
      state.slideState = createSlideState();
      state.slideGesture = null;
      state.pinchPointers = {};
      state.pinchStartDistance = null;
      state.was360Interactive = getPanoramaInteractive();
      setPanoramaInteractive(false);
      if (panoramaCanvas) panoramaCanvas.classList.add("is-photo-viewer-open");

      updateCaption(mark, 0);
      updateNavButtons();
      renderImage(0);
      viewer.classList.remove("hidden");
      viewer.setAttribute("aria-hidden", "false");
      if (marksLayer) marksLayer.classList.add("is-photo-viewer-open");

      scheduleFrame(function layoutOpenedPhotoViewer() {
        layoutCard(true);
      });
      return true;
    }

    // Закрывает карточку, отменяет её async-работу и возвращает прежнюю интерактивность активной панорамы.
    function close(reason) {
      if (!state.active) return false;
      state.active = false;
      imageGeneration++;
      cancelScheduledFrames();
      state.markId = "";
      state.images = [];
      state.index = 0;
      state.slideState = null;
      state.slideGesture = null;
      state.pinchPointers = {};
      state.pinchStartDistance = null;

      if (viewer) {
        viewer.classList.add("hidden");
        viewer.setAttribute("aria-hidden", "true");
      }
      if (image) image.removeAttribute("src");
      if (inner) inner.style.transform = "";
      if (viewport) viewport.classList.remove("is-panning");
      clearFrameSizes();
      if (caption) {
        caption.textContent = "";
        caption.classList.add("hidden");
      }
      if (marksLayer) marksLayer.classList.remove("is-photo-viewer-open");
      if (isPanoramaActive()) setPanoramaInteractive(state.was360Interactive);
      if (panoramaCanvas) panoramaCanvas.classList.remove("is-photo-viewer-open");

      if (reason) {
        // Причина сохраняется только в стеке вызова для отладки и не меняет пользовательское поведение.
      }
      return true;
    }

    // Проверяет, выходит ли масштабированное изображение за viewport хотя бы по одной оси.
    function slideOverflowsViewport() {
      var parts = getViewerElements();
      var slideState = state.slideState;
      if (!parts || !parts.viewport || !slideState || !slideState.loaded || !slideState.naturalW || !slideState.naturalH) return false;
      var rect = parts.viewport.getBoundingClientRect();
      var scale = getImageScale(slideState);
      return slideState.naturalW * scale > rect.width + 0.5 || slideState.naturalH * scale > rect.height + 0.5;
    }

    // Меняет zoom относительно точки жеста, сохраняя находящийся под ней участок изображения.
    function applyZoomAt(nextZoom, focalX, focalY) {
      var parts = getViewerElements();
      var slideState = state.slideState;
      if (!parts || !parts.viewport || !slideState) return;
      var previousZoom = slideState.zoom;
      var zoom = clampNumber(nextZoom, PHOTO_ZOOM_MIN, PHOTO_ZOOM_MAX);
      var rect = parts.viewport.getBoundingClientRect();
      var centerX = rect.left + rect.width * 0.5;
      var centerY = rect.top + rect.height * 0.5;
      var focusX = isFinite(focalX) ? focalX : centerX;
      var focusY = isFinite(focalY) ? focalY : centerY;
      var previousScale = slideState.baseFitScale * previousZoom;
      var nextScale = slideState.baseFitScale * zoom;
      var ratio = previousScale > 0 ? nextScale / previousScale : 1;
      slideState.tx = (slideState.tx + (focusX - centerX)) * ratio - (focusX - centerX);
      slideState.ty = (slideState.ty + (focusY - centerY)) * ratio - (focusY - centerY);
      slideState.zoom = zoom;
      applyZoomLayout();
    }

    // Пересчитывает карточку после изменения размера окна, сохраняя текущий zoom.
    function handleResize() {
      if (state.active) layoutCard(false);
    }

    // Обрабатывает кнопки, backdrop и не закрывает viewer при клике внутри карточки.
    function handleUiClick(event) {
      if (!state.active || now() < (state.suppressUiClickUntil || 0)) return;
      var target = event.target;
      if (!target || !target.closest) return;
      if (target.closest("[data-bg360-photo-close]")) {
        event.preventDefault();
        event.stopPropagation();
        close("ui");
        return;
      }
      if (target.closest("[data-bg360-photo-prev]")) {
        event.preventDefault();
        event.stopPropagation();
        setIndex(state.index - 1);
        return;
      }
      if (target.closest("[data-bg360-photo-next]")) {
        event.preventDefault();
        event.stopPropagation();
        setIndex(state.index + 1);
        return;
      }
      if (target.closest(".bg360-photo-card")) return;
      if (
        (target.getAttribute && target.getAttribute("data-bg360-photo-dismiss") === "1") ||
        (target.classList && target.classList.contains("bg360-photo-viewer-backdrop"))
      ) {
        event.preventDefault();
        event.stopPropagation();
        close("ui");
      }
    }

    // Считает активные pointer-точки pinch-трекера без зависимости от Map.
    function getPinchPointerCount() {
      var count = 0;
      for (var key in state.pinchPointers) {
        if (Object.prototype.hasOwnProperty.call(state.pinchPointers, key)) count++;
      }
      return count;
    }

    // Возвращает расстояние между первыми двумя pointer-точками для pinch-zoom.
    function getPinchDistance() {
      var points = [];
      for (var key in state.pinchPointers) {
        if (Object.prototype.hasOwnProperty.call(state.pinchPointers, key)) points.push(state.pinchPointers[key]);
      }
      if (points.length < 2) return null;
      var dx = points[0].x - points[1].x;
      var dy = points[0].y - points[1].y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    // Начинает pan или pinch только внутри viewport и не перехватывает управляющие кнопки.
    function handlePointerDown(event) {
      if (!state.active) return;
      var target = event.target;
      if (target && target.closest && target.closest("[data-bg360-photo-close], [data-bg360-photo-prev], [data-bg360-photo-next]")) return;
      var parts = getViewerElements();
      if (!parts || !parts.viewport) return;
      if (!parts.viewport.contains(event.target) && event.target !== parts.viewport) return;

      state.pinchPointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      if (getPinchPointerCount() >= 2) {
        state.pinchStartDistance = getPinchDistance();
        state.pinchStartZoom = state.slideState ? state.slideState.zoom : 1;
        state.slideGesture = null;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      var slideState = state.slideState;
      if (!slideState) return;
      if (slideOverflowsViewport()) {
        state.slideGesture = {
          mode: "pan",
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startTx: slideState.tx,
          startTy: slideState.ty
        };
        parts.viewport.classList.add("is-panning");
        if (parts.viewport.setPointerCapture) {
          try { parts.viewport.setPointerCapture(event.pointerId); } catch (error) {
            // Pointer capture необязателен: pan продолжает отслеживаться по pointerId.
          }
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    }

    // Обновляет pinch или pan, ограничивая кадр сразу во время pointermove.
    function handlePointerMove(event) {
      if (!state.active) return;
      if (state.pinchPointers[event.pointerId]) {
        state.pinchPointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      }

      if (getPinchPointerCount() >= 2 && state.pinchStartDistance) {
        var distance = getPinchDistance();
        if (distance && distance > 0 && state.slideState) {
          var midpointX = 0;
          var midpointY = 0;
          var count = 0;
          for (var key in state.pinchPointers) {
            if (!Object.prototype.hasOwnProperty.call(state.pinchPointers, key)) continue;
            midpointX += state.pinchPointers[key].x;
            midpointY += state.pinchPointers[key].y;
            count++;
          }
          midpointX /= count;
          midpointY /= count;
          applyZoomAt(state.pinchStartZoom * (distance / state.pinchStartDistance), midpointX, midpointY);
        }
        event.preventDefault();
        return;
      }

      var pan = state.slideGesture;
      if (pan && pan.mode === "pan" && pan.pointerId === event.pointerId && state.slideState) {
        state.slideState.tx = pan.startTx + (event.clientX - pan.startX);
        state.slideState.ty = pan.startTy + (event.clientY - pan.startY);
        clampSlidePan();
        applySlideTransform();
        event.preventDefault();
      }
    }

    // Завершает pointer-жест, снимает capture и подавляет следующий click после заметного pan.
    function handlePointerUp(event) {
      if (!state.active) return;
      delete state.pinchPointers[event.pointerId];
      if (getPinchPointerCount() < 2) state.pinchStartDistance = null;

      var pan = state.slideGesture;
      if (pan && pan.pointerId === event.pointerId) {
        var parts = getViewerElements();
        if (parts && parts.viewport && parts.viewport.releasePointerCapture) {
          try { parts.viewport.releasePointerCapture(event.pointerId); } catch (error) {
            // Pointer capture мог быть уже снят браузером, состояние pan очищается ниже.
          }
        }
        if (parts && parts.viewport) parts.viewport.classList.remove("is-panning");
        var panTravel = Math.abs(event.clientX - pan.startX) + Math.abs(event.clientY - pan.startY);
        if (panTravel > 6) state.suppressUiClickUntil = now() + 400;
        state.slideGesture = null;
        event.preventDefault();
      }
    }

    // Масштабирует кадр колесом только над viewport и блокирует прокрутку страницы.
    function handleWheel(event) {
      if (!state.active) return;
      var parts = getViewerElements();
      if (!parts || !parts.viewport || !parts.viewport.contains(event.target) || !state.slideState) return;
      var factor = event.deltaY > 0 ? 0.92 : 1.08;
      applyZoomAt(state.slideState.zoom * factor, event.clientX, event.clientY);
      event.preventDefault();
    }

    // Закрывает viewer по Escape и листает изображения стрелками клавиатуры.
    function handleKeydown(event) {
      if (!state.active) return;
      var key = event.key || "";
      if (key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close("escape");
      } else if (key === "ArrowLeft") {
        event.preventDefault();
        setIndex(state.index - 1);
      } else if (key === "ArrowRight") {
        event.preventDefault();
        setIndex(state.index + 1);
      }
    }

    // Один раз подключает локальные и глобальные обработчики viewer с симметричным dispose.
    function start() {
      if (lifecycleStarted || disposed || !viewer) return false;
      lifecycleStarted = true;
      viewer.addEventListener("click", handleUiClick);
      viewer.addEventListener("pointerdown", handlePointerDown);
      viewer.addEventListener("pointermove", handlePointerMove);
      viewer.addEventListener("pointerup", handlePointerUp);
      viewer.addEventListener("pointercancel", handlePointerUp);
      viewer.addEventListener("wheel", handleWheel, { passive: false });
      if (windowTarget && typeof windowTarget.addEventListener === "function") {
        windowTarget.addEventListener("resize", handleResize);
      }
      if (documentTarget && typeof documentTarget.addEventListener === "function") {
        documentTarget.addEventListener("keydown", handleKeydown, true);
      }
      return true;
    }

    // Снимает все обработчики, закрывает viewer и инвалидирует незавершённую загрузку изображения.
    function dispose() {
      if (disposed) return;
      if (state.active) close("dispose");
      cancelScheduledFrames();
      imageGeneration++;
      if (lifecycleStarted && viewer) {
        viewer.removeEventListener("click", handleUiClick);
        viewer.removeEventListener("pointerdown", handlePointerDown);
        viewer.removeEventListener("pointermove", handlePointerMove);
        viewer.removeEventListener("pointerup", handlePointerUp);
        viewer.removeEventListener("pointercancel", handlePointerUp);
        viewer.removeEventListener("wheel", handleWheel);
      }
      if (lifecycleStarted && windowTarget && typeof windowTarget.removeEventListener === "function") {
        windowTarget.removeEventListener("resize", handleResize);
      }
      if (lifecycleStarted && documentTarget && typeof documentTarget.removeEventListener === "function") {
        documentTarget.removeEventListener("keydown", handleKeydown, true);
      }
      disposed = true;
    }

    return Object.freeze({
      state: state,
      start: start,
      open: open,
      close: close,
      setIndex: setIndex,
      applyZoomAt: applyZoomAt,
      layout: layoutCard,
      dispose: dispose
    });
  }

  return {
    PHOTO_ZOOM_MIN: PHOTO_ZOOM_MIN,
    PHOTO_ZOOM_MAX: PHOTO_ZOOM_MAX,
    isPhotoMark: isPhotoMark,
    normalizePhotoImages: normalizePhotoImages,
    createPanoramaPhotoViewerController: createPanoramaPhotoViewerController
  };
});
