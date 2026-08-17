// Экспортирует состояние, DOM/SVG-метки и WebGL-навигацию 360 без доступа к сценарию новеллы.
(function(root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VN_PANORAMA_MARKS_CONTROLLER = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createPanoramaMarksControllerModule() {
  "use strict";

  // Создаёт контроллер одного набора меток и всей связанной навигационной графики панорамы.
  function createPanoramaMarksController(options) {
    options = options || {};

    var window = options.window || (typeof globalThis !== "undefined" ? globalThis : null);
    var document = options.document || (window && window.document ? window.document : null);
    var elBg360Marks = options.marksLayer || null;
    var elNovelWindow = options.novelWindow || null;
    var bg360Runtime = options.panoramaRuntime || {};
    var disposed = false;

    // Состояние принадлежит контроллеру, а координатор получает ссылку для совместимого чтения и записи команд walk360/goto360.
    var bg360MarksRuntime = {
      bgId: null,
      marks: [],
      lines: false,
      locked: false,
      interactive: false
    };

    // Ограничивает число диапазоном без зависимости от утилит центрального runtime.
    function clampNumber(value, min, max) {
      if (typeof options.clamp === "function") return options.clamp(value, min, max);
      return Math.max(min, Math.min(max, value));
    }

    // Нормализует FOV через координатор, поскольку допустимый диапазон задаётся общими настройками панорамы.
    function normalizeFov(value, fallback) {
      if (typeof options.normalizeFov === "function") return options.normalizeFov(value, fallback);
      var number = Number(value);
      return isFinite(number) ? number : fallback;
    }

    // Возвращает computed style через внедрённый API, сохраняя обязательный браузерный receiver Window.
    function readComputedStyle(element) {
      if (typeof options.getComputedStyle === "function") return options.getComputedStyle.call(window, element);
      if (window && typeof window.getComputedStyle === "function") return window.getComputedStyle(element);
      return { getPropertyValue: function getEmptyPanoramaMarksCssValue() { return ""; } };
    }

    // Назначает thumbnail через общую политику ресурсов движка.
    function assignRasterImage(element, source, handlers) {
      if (typeof options.assignImage === "function") options.assignImage(element, source, handlers || {});
    }

    // Пишет подробную диагностику только через внедрённый runtime-logger.
    function writeVerbose() {
      if (typeof options.writeVerbose === "function") options.writeVerbose.apply(null, arguments);
    }

    // Проверяет, что метка выводит из 360-пространства в обычную сцену и не должна становиться WebGL-стрелкой.
    function bg360IsSceneTargetMark(mark) {
      if (!mark || typeof mark !== "object") return false;
      if (mark.target && String(mark.target.type || "").toLowerCase() === "scene") return true;
      return mark.targetScene !== undefined && mark.targetScene !== null && String(mark.targetScene || "").trim() !== "";
    }
    
    // Возвращает экранную подпись scene-метки из того же text, который используется в компасе; id сцены остаётся только служебной целью перехода.
    function bg360GetSceneTargetLabel(mark) {
      if (!mark || typeof mark !== "object") return "";
      return bg360GetCompassMarkLabel(mark);
    }
    
    // Возвращает текст направления для компаса: пустой text намеренно скрывает подпись у этой метки.
    function bg360GetCompassMarkLabel(mark) {
      if (!mark || typeof mark !== "object") return "";
      return String(mark.text || "").trim();
    }
    
    // Проверяет, что метка является обзорной view-точкой: она видима как DOM-метка и отдельный пунктир в компасе, но без стрелки на полу.
    function bg360IsViewMark(mark) {
      return !!(mark && typeof mark === "object" && String(mark.kind || "").toLowerCase() === "view");
    }
    
    // Проверяет, что метка открывает просмотр изображений, а не навигацию walk360/goto360.
    function bg360IsPhotoMark(mark) {
      return typeof options.isPhotoMark === "function"
        ? !!options.isPhotoMark(mark)
        : !!(mark && typeof mark === "object" && String(mark.kind || "").toLowerCase() === "photo");
    }
    
    // Нормализует список изображений photo-метки в массив { file, caption }.
    function normalizeBg360PhotoImages(mark) {
      return typeof options.normalizePhotoImages === "function" ? options.normalizePhotoImages(mark) : [];
    }
    
    // Возвращает true, если среди меток есть хотя бы одна photo — слой поднимается над диалогом.
    function bg360MarksHasPhotoMarks(marks) {
      if (!Array.isArray(marks)) return false;
      for (var i = 0; i < marks.length; i++) {
        if (bg360IsPhotoMark(marks[i]) && normalizeBg360PhotoImages(marks[i]).length) return true;
      }
      return false;
    }
    
    // Ищет метку по id в текущем runtime.
    function findBg360MarkById(markId) {
      var id = markId != null ? String(markId) : "";
      if (!id || !Array.isArray(bg360MarksRuntime.marks)) return null;
      for (var i = 0; i < bg360MarksRuntime.marks.length; i++) {
        var mark = bg360MarksRuntime.marks[i];
        if (mark && String(mark.id || "") === id) return mark;
      }
      return null;
    }
    
    // Передаёт открытие photo-метки специализированному viewer-контроллеру.
    function openBg360PhotoViewer(mark) {
      return typeof options.openPhotoViewer === "function" && !!options.openPhotoViewer(mark);
    }
    
    // Название photo-метки на сцене 360 (рядом с превью); пустое — подпись не рисуется.
    function bg360GetPhotoMarkLabel(mark) {
      if (!mark || typeof mark !== "object") return "";
      return String(mark.label || "").trim();
    }
    
    // Проверяет, что метка участвует в навигации WebGL-стрелками: scene-выходы намеренно исключены и рисуются отдельной DOM-меткой.
    function bg360IsDirectionalMark(mark) {
      if (!mark || typeof mark !== "object") return false;
      var kind = String(mark.kind || "").toLowerCase();
      if (kind === "text" || kind === "view" || kind === "photo") return false;
      if (bg360IsSceneTargetMark(mark)) return false;
      var x = Number(mark.x);
      var y = Number(mark.y);
      return isFinite(x) && isFinite(y);
    }
    
    // Проверяет, есть ли среди меток хотя бы одна навигационная метка для WebGL-стрелок.
    function bg360MarksHasAnyDirectional(marks) {
      if (!Array.isArray(marks)) return false;
      for (var i = 0; i < marks.length; i++) {
        if (bg360IsDirectionalMark(marks[i])) return true;
      }
      return false;
    }
    
    // Проверяет, есть ли направления, которые должны попасть в SVG-компас: 360-стрелки, view-точки или выходы в обычные сцены.
    function bg360MarksHasAnyCompassMark(marks) {
      if (!Array.isArray(marks)) return false;
      for (var i = 0; i < marks.length; i++) {
        var mark = marks[i];
        if (bg360IsDirectionalMark(mark) || bg360IsViewMark(mark) || bg360IsSceneTargetMark(mark)) return true;
      }
      return false;
    }
    
    // Единая точка выбора метки: DOM-кнопки, WebGL hit-test и SVG-компас должны завершать ожидание одинаково.
    function activateBg360MarkById(markId, e) {
      if (e && typeof e.stopPropagation === "function") e.stopPropagation();
      if (e && typeof e.preventDefault === "function") e.preventDefault();
    
      var id = markId != null ? String(markId) : "";
      if (!id || bg360MarksRuntime.locked) return false;
    
      var markEarly = findBg360MarkById(id);
      if (markEarly && bg360IsPhotoMark(markEarly)) {
        return openBg360PhotoViewer(markEarly);
      }
    
      if (!bg360MarksRuntime.interactive) return false;
      if (typeof options.isGotoActive === "function" && options.isGotoActive()) {
        if (typeof options.isGotoDone === "function" && options.isGotoDone()) return false;
        if (typeof options.onGotoSelect === "function") options.onGotoSelect(id);
        return true;
      }
      if (typeof options.isWalkActive === "function" && options.isWalkActive()) {
        if (typeof options.isWalkDone === "function" && options.isWalkDone()) return false;
        if (typeof options.onWalkSelect === "function") options.onWalkSelect(id);
        return true;
      }
      return false;
    }
    
    // Перерисовывает DOM-слой меток 360.
    function renderBg360Marks() {
      if (!elBg360Marks) return;
    
      // Скрываем слой полностью, если меток нет.
      var hasMarks = Array.isArray(bg360MarksRuntime.marks) && bg360MarksRuntime.marks.length > 0;
      var hasPhotoMarks = bg360MarksHasPhotoMarks(bg360MarksRuntime.marks);
      elBg360Marks.classList.toggle("hidden", !hasMarks);
      elBg360Marks.classList.toggle("is-interactive", !!(hasMarks && bg360MarksRuntime.interactive && !bg360MarksRuntime.locked));
      elBg360Marks.classList.toggle("has-photo-marks", hasPhotoMarks);
    
      while (elBg360Marks.firstChild) elBg360Marks.removeChild(elBg360Marks.firstChild);
      if (!hasMarks) {
        elBg360Marks.classList.remove("is-webgl-nav-only");
        return;
      }
    
      // Если есть навигационные метки, отключаем пунктир и DOM-кружки направлений: переходы идут по WebGL-стрелкам.
      var useWebglNavArrows = bg360MarksHasAnyDirectional(bg360MarksRuntime.marks);
      var hasCompassMarks = bg360MarksHasAnyCompassMark(bg360MarksRuntime.marks);
      var domMarksAdded = 0;
    
      var linesLayer = null;
      if (bg360MarksRuntime.lines && !useWebglNavArrows) {
        linesLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        linesLayer.classList.add("bg360-mark-lines");
        linesLayer.setAttribute("aria-hidden", "true");
        linesLayer.setAttribute("preserveAspectRatio", "none");
        elBg360Marks.appendChild(linesLayer);
      }
    
      if (hasCompassMarks) {
        appendBg360Compass();
      }
    
      // Треугольные подсказки по краю экрана, если WebGL-стрелка к метке выходит за кадр.
      if (useWebglNavArrows) {
        var edgeHintsSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        edgeHintsSvg.classList.add("bg360-nav-edge-hints");
        edgeHintsSvg.setAttribute("aria-hidden", "true");
        edgeHintsSvg.setAttribute("preserveAspectRatio", "none");
        elBg360Marks.appendChild(edgeHintsSvg);
      }
    
      bg360MarksRuntime.marks.forEach(function (mark, index) {
        var isSceneTarget = bg360IsSceneTargetMark(mark);
        var isViewMark = bg360IsViewMark(mark);
        var isPhotoMark = bg360IsPhotoMark(mark);
        if (bg360MarksRuntime.lines && !useWebglNavArrows) {
          var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.classList.add("bg360-mark-line");
          if (isSceneTarget || isViewMark || isPhotoMark) line.classList.add("hidden");
          line.dataset.markId = mark.id;
          line.dataset.markLineIndex = String(index);
          linesLayer.appendChild(line);
        }
    
        if (useWebglNavArrows && bg360IsDirectionalMark(mark)) {
          return;
        }
        if (isViewMark) return;
        if (isPhotoMark && !normalizeBg360PhotoImages(mark).length) return;
    
        var btn = document.createElement("div");
        btn.className = "bg360-mark";
        if (mark.kind === "text") btn.classList.add("kind-text");
        if (isPhotoMark) btn.classList.add("kind-photo");
        if (isSceneTarget) btn.classList.add("kind-scene-target");
        if (bg360MarksRuntime.locked && !isPhotoMark) btn.classList.add("is-locked");
    
        // Сохраняем исходные UV-координаты метки (0..1), чтобы в каждом кадре
        // проецировать её в экранную позицию согласно текущему углу камеры.
        btn.style.left = "50%";
        btn.style.top = "50%";
        btn.setAttribute("role", "button");
        btn.setAttribute("tabindex", "0");
        btn.dataset.markId = mark.id;
        btn.dataset.markLineIndex = String(index);
        btn.dataset.markU = String(mark.x);
        btn.dataset.markV = String(mark.y);
    
        if (isSceneTarget) {
          var sceneLabelText = bg360GetSceneTargetLabel(mark);
          if (sceneLabelText) {
            var sceneLabel = document.createElement("div");
            sceneLabel.className = "bg360-scene-mark-label";
            // Подпись хранится внутри кликабельной метки: клик по тексту запускает тот же переход, что и клик по окружности.
            sceneLabel.textContent = sceneLabelText;
            btn.appendChild(sceneLabel);
          }
        }
    
        if (isPhotoMark) {
          var photoImages = normalizeBg360PhotoImages(mark);
          var thumbSrc = photoImages.length ? String(photoImages[0].file || "") : "";
          if (thumbSrc) {
            var thumbImg = document.createElement("img");
            thumbImg.className = "bg360-mark-photo-thumb";
            thumbImg.alt = "";
            thumbImg.draggable = false;
            thumbImg.decoding = "async";
            thumbImg.loading = "lazy";
            assignRasterImage(thumbImg, thumbSrc, {});
            btn.appendChild(thumbImg);
            if (photoImages.length > 1) {
              var photoCountBadge = document.createElement("span");
              photoCountBadge.className = "bg360-mark-photo-count";
              photoCountBadge.textContent = String(photoImages.length);
              photoCountBadge.setAttribute("aria-hidden", "true");
              btn.appendChild(photoCountBadge);
            }
          } else {
            var thumbFallback = document.createElement("span");
            thumbFallback.className = "bg360-mark-photo-fallback";
            thumbFallback.textContent = "🖼";
            thumbFallback.setAttribute("aria-hidden", "true");
            btn.appendChild(thumbFallback);
          }
          var photoLabelText = bg360GetPhotoMarkLabel(mark);
          if (photoLabelText) {
            var photoLabel = document.createElement("div");
            photoLabel.className = "bg360-photo-mark-label";
            // Подпись на сцене: клик по тексту открывает тот же viewer, что и по превью.
            photoLabel.textContent = photoLabelText;
            btn.appendChild(photoLabel);
          }
        }
    
        // Клик: photo открывает viewer всегда; остальные метки — только в walk360/goto360.
        btn.addEventListener("click", function (e) {
          if (isPhotoMark) {
            if (e && typeof e.stopPropagation === "function") e.stopPropagation();
            if (e && typeof e.preventDefault === "function") e.preventDefault();
            openBg360PhotoViewer(mark);
            return;
          }
          activateBg360MarkById(mark.id, e);
        });
    
        elBg360Marks.appendChild(btn);
        domMarksAdded++;
      });
    
      // Пустой оверлей: клики проходят на canvas (выбор по полосе WebGL-стрелки).
      elBg360Marks.classList.toggle("is-webgl-nav-only", useWebglNavArrows && domMarksAdded === 0);
    
      // После построения DOM сразу считаем экранные позиции.
      syncBg360OriginCoverMesh();
      syncBg360NavArrowsFromMarks();
      updateBg360MarksProjection();
      updateBg360NavEdgeHints();
    }
    
    // Служебные векторы для проекции меток 360 (создаются лениво, чтобы не плодить объекты каждый кадр).
    var bg360MarkProjPoint = null;
    var bg360MarkProjCameraDir = null;
    var bg360MarkProjNadirPoint = null;
    var bg360MarkProjNadirCameraPoint = null;
    
    // Преобразует UV текстуры сферы (0..1) в единичный вектор направления на сфере.
    // Должно совпадать с THREE.SphereGeometry (см. uvs: второй компонент = 1 - v_ряда)
    // и с последующим geometry.scale(-1, 1, 1), как в setBackground360.
    function bg360UvToDirection(u, v) {
      if (!window.THREE) return null;
      if (!bg360MarkProjPoint) bg360MarkProjPoint = new window.THREE.Vector3();
    
      var U = clampNumber(Number(u), 0, 1);
      var V = clampNumber(Number(v), 0, 1);
    
      var thetaPolar = (1 - V) * Math.PI;
      var phiAz = U * Math.PI * 2;
      var sinPolar = Math.sin(thetaPolar);
    
      var x0 = -Math.cos(phiAz) * sinPolar;
      var y0 = Math.cos(thetaPolar);
      var z0 = Math.sin(phiAz) * sinPolar;
    
      bg360MarkProjPoint.set(-x0, y0, z0);
      return bg360MarkProjPoint;
    }
    
    // Обновляет экранные координаты меток под текущий угол камеры.
    // Метка скрывается, если находится вне текущего поля зрения.
    function updateBg360MarksProjection() {
      if (!elBg360Marks) return;
      if (!bg360Runtime.active || !bg360Runtime.camera || !window.THREE) return;
    
      var nodes = elBg360Marks.querySelectorAll(".bg360-mark");
      if (!nodes || !nodes.length) return;
    
      if (!bg360MarkProjCameraDir) bg360MarkProjCameraDir = new window.THREE.Vector3();
      bg360Runtime.camera.getWorldDirection(bg360MarkProjCameraDir);
    
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var u = Number(node.dataset.markU);
        var v = Number(node.dataset.markV);
        var dir = bg360UvToDirection(u, v);
        if (!dir) {
          updateBg360MarkLine(node, 0, 0, false);
          continue;
        }
    
        // Проверяем, смотрит ли камера в сторону точки (точки за спиной скрываем).
        var facing = dir.dot(bg360MarkProjCameraDir) > 0;
        if (!facing) {
          node.classList.add("hidden");
          updateBg360MarkLine(node, 0, 0, false);
          continue;
        }
    
        node.classList.remove("hidden");
        dir.project(bg360Runtime.camera);
        var screenX = dir.x * 0.5 + 0.5;
        var screenY = -dir.y * 0.5 + 0.5;
        node.style.left = (screenX * 100) + "%";
        node.style.top = (screenY * 100) + "%";
        updateBg360MarkLine(node, screenX, screenY, true);
      }
    }
    
    // Читает множитель глубины точки "под камерой" из CSS, чтобы настройка 360-линий была рядом с размерами меток.
    function getBg360UnderCameraDepthMultiplier() {
      var fallbackDepth = 3;
      try {
        var raw = readComputedStyle(document.documentElement).getPropertyValue("--bg360-under-camera-depth");
        var value = Number(String(raw || "").trim());
        return isFinite(value) && value > 0 ? value : fallbackDepth;
      } catch (err) {
        return fallbackDepth;
      }
    }
    
    // Читает базовый px-размер из CSS и умножает на visualScale; это повторяет --bg360-origin-cover-size в CSS.
    function getBg360ScaledBaseCssPixel(baseVarName, fallbackPx) {
      try {
        var rootStyle = readComputedStyle(document.documentElement);
        var rawBase = rootStyle.getPropertyValue(baseVarName);
        var rawScale = rootStyle.getPropertyValue("--visualScale");
        var base = Number(String(rawBase || "").replace("px", "").trim());
        var scale = Number(String(rawScale || "").trim());
        if (!isFinite(base) || base <= 0) base = fallbackPx;
        if (!isFinite(scale) || scale <= 0) scale = 1;
        return base * scale;
      } catch (err) {
        return fallbackPx;
      }
    }
    
    // Читает CSS-переменную и разворачивает простую ссылку var(--name), чтобы настройки могли переиспользовать цвет/opacity стрелок.
    function readBg360CssCustomPropertyValue(varName) {
      try {
        var style = readComputedStyle(document.documentElement);
        var raw = style.getPropertyValue(varName).trim();
        for (var i = 0; i < 4; i++) {
          var ref = raw.match(/^var\(\s*(--[a-z0-9_-]+)\s*(?:,\s*(.*))?\)$/i);
          if (!ref) break;
          var next = style.getPropertyValue(ref[1]).trim();
          raw = next || String(ref[2] || "").trim();
        }
        return raw;
      } catch (err) {
        return "";
      }
    }
    
    // Читает числовую CSS-настройку без единиц; пустое значение не превращает в 0, а заменяет безопасным fallback.
    function getBg360CssNumber(varName, fallbackValue) {
      try {
        var raw = String(readBg360CssCustomPropertyValue(varName) || "").trim();
        if (!raw) return fallbackValue;
        var value = Number(raw);
        return isFinite(value) ? value : fallbackValue;
      } catch (err) {
        return fallbackValue;
      }
    }
    
    // Преобразует CSS-цвет rgba()/rgb()/hex в параметры THREE-материала.
    function parseBg360CssColor(varName, fallbackColor, fallbackOpacity) {
      var raw = readBg360CssCustomPropertyValue(varName);
      var opacityFallback = typeof fallbackOpacity === "number" ? fallbackOpacity : 1;
    
      var rgba = raw.match(/^rgba?\(([^)]+)\)$/i);
      if (rgba) {
        var parts = rgba[1].split(",").map(function (part) { return String(part || "").trim(); });
        var r = clampNumber(Number(parts[0]), 0, 255);
        var g = clampNumber(Number(parts[1]), 0, 255);
        var b = clampNumber(Number(parts[2]), 0, 255);
        var a = parts.length > 3 ? clampNumber(Number(parts[3]), 0, 1) : opacityFallback;
        if (isFinite(r) && isFinite(g) && isFinite(b) && isFinite(a)) {
          return { color: (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b), opacity: a };
        }
      }
    
      var hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (hex) {
        var value = hex[1];
        if (value.length === 3) {
          value = value.replace(/./g, function (ch) { return ch + ch; });
        }
        return { color: parseInt(value, 16), opacity: opacityFallback };
      }
    
      return { color: fallbackColor, opacity: opacityFallback };
    }
    
    // Переводит базовый экранный диаметр заглушки в угловой радиус на 360-сфере при эталонном FOV.
    function getBg360OriginCoverAngularRadius(viewHeight) {
      var safeHeight = Math.max(1, Number(viewHeight) || 1);
      var diameterPx = getBg360ScaledBaseCssPixel("--bg360-origin-cover-size-base", 110);
      var referenceFov = normalizeFov(getBg360CssNumber("--bg360-origin-cover-reference-fov", 70), 70);
      var referenceTan = Math.tan(window.THREE.MathUtils.degToRad(referenceFov) * 0.5);
      if (!isFinite(referenceTan) || referenceTan <= 0) referenceTan = Math.tan(window.THREE.MathUtils.degToRad(70) * 0.5);
      // Угловой радиус сохраняет заплатку привязанной к панораме и даёт зуму менять её экранный размер естественно.
      return clampNumber(Math.atan((diameterPx * 0.5) / (safeHeight * 0.5) * referenceTan), 0.002, Math.PI * 0.45);
    }
    
    // Переводит толщину обводки из базовых px в угловую ширину кольца на 360-сфере.
    function getBg360OriginCoverStrokeAngularWidth(viewHeight) {
      var safeHeight = Math.max(1, Number(viewHeight) || 1);
      var strokePx = getBg360ScaledBaseCssPixel("--bg360-origin-cover-stroke-width-base", 2);
      var referenceFov = normalizeFov(getBg360CssNumber("--bg360-origin-cover-reference-fov", 70), 70);
      var referenceTan = Math.tan(window.THREE.MathUtils.degToRad(referenceFov) * 0.5);
      if (!isFinite(referenceTan) || referenceTan <= 0) referenceTan = Math.tan(window.THREE.MathUtils.degToRad(70) * 0.5);
      return clampNumber(Math.atan(strokePx / (safeHeight * 0.5) * referenceTan), 0, Math.PI * 0.08);
    }
    
    // Создаёт сферическую заплатку вокруг нижней точки 360-сферы, без пересечений с основной сферой.
    function createBg360NadirCapGeometry(radius, angularRadius, radialSegments, angularSegments) {
      var geometry = new window.THREE.BufferGeometry();
      var rings = Math.max(2, radialSegments || 16);
      var segments = Math.max(32, angularSegments || 192);
      var positions = [];
      var indices = [];
    
      for (var r = 0; r <= rings; r++) {
        var theta = angularRadius * r / rings;
        var sinTheta = Math.sin(theta);
        var y = -Math.cos(theta) * radius;
        for (var s = 0; s <= segments; s++) {
          var phi = Math.PI * 2 * s / segments;
          positions.push(Math.cos(phi) * sinTheta * radius, y, Math.sin(phi) * sinTheta * radius);
        }
      }
    
      var row = segments + 1;
      for (var rr = 0; rr < rings; rr++) {
        for (var ss = 0; ss < segments; ss++) {
          var a = rr * row + ss;
          var b = a + 1;
          var c = (rr + 1) * row + ss;
          var d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    
      geometry.setAttribute("position", new window.THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    }
    
    // Создаёт тонкое сферическое кольцо вокруг заплатки, чтобы обводка не была экранным оверлеем.
    function createBg360NadirRingGeometry(radius, innerAngularRadius, outerAngularRadius, angularSegments) {
      var geometry = new window.THREE.BufferGeometry();
      var segments = Math.max(32, angularSegments || 192);
      var positions = [];
      var indices = [];
    
      for (var ring = 0; ring < 2; ring++) {
        var theta = ring === 0 ? innerAngularRadius : outerAngularRadius;
        var sinTheta = Math.sin(theta);
        var y = -Math.cos(theta) * radius;
        for (var s = 0; s <= segments; s++) {
          var phi = Math.PI * 2 * s / segments;
          positions.push(Math.cos(phi) * sinTheta * radius, y, Math.sin(phi) * sinTheta * radius);
        }
      }
    
      var row = segments + 1;
      for (var i = 0; i < segments; i++) {
        var a = i;
        var b = i + 1;
        var c = row + i;
        var d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    
      geometry.setAttribute("position", new window.THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    }
    
    // Освобождает 3D-заглушку штатива отдельно от основной сферы.
    function disposeBg360OriginCoverMesh() {
      if (bg360Runtime.originCoverMesh && bg360Runtime.scene) {
        bg360Runtime.scene.remove(bg360Runtime.originCoverMesh);
      }
      if (bg360Runtime.originCoverStrokeMesh && bg360Runtime.scene) {
        bg360Runtime.scene.remove(bg360Runtime.originCoverStrokeMesh);
      }
      if (bg360Runtime.originCoverMaterial && typeof bg360Runtime.originCoverMaterial.dispose === "function") {
        bg360Runtime.originCoverMaterial.dispose();
      }
      if (bg360Runtime.originCoverGeometry && typeof bg360Runtime.originCoverGeometry.dispose === "function") {
        bg360Runtime.originCoverGeometry.dispose();
      }
      if (bg360Runtime.originCoverStrokeMaterial && typeof bg360Runtime.originCoverStrokeMaterial.dispose === "function") {
        bg360Runtime.originCoverStrokeMaterial.dispose();
      }
      if (bg360Runtime.originCoverStrokeGeometry && typeof bg360Runtime.originCoverStrokeGeometry.dispose === "function") {
        bg360Runtime.originCoverStrokeGeometry.dispose();
      }
      bg360Runtime.originCoverMesh = null;
      bg360Runtime.originCoverMaterial = null;
      bg360Runtime.originCoverGeometry = null;
      bg360Runtime.originCoverStrokeMesh = null;
      bg360Runtime.originCoverStrokeMaterial = null;
      bg360Runtime.originCoverStrokeGeometry = null;
      bg360Runtime.originCoverSignature = "";
    }
    
    // Создаёт/обновляет круг-заглушку как 3D-диск в нижней точке 360-сферы, чтобы он не съезжал при наклоне камеры.
    function syncBg360OriginCoverMesh() {
      if (!window.THREE || !bg360Runtime.scene || !bg360Runtime.camera) return;
      var marks = bg360MarksRuntime.marks;
      var hasDirectional = bg360MarksHasAnyDirectional(marks);
      var hasCover =
        Array.isArray(marks) &&
        marks.length > 0 &&
        (bg360MarksRuntime.lines || hasDirectional);
      if (!hasCover) {
        disposeBg360OriginCoverMesh();
        return;
      }
    
      var viewHeight = elNovelWindow ? elNovelWindow.clientHeight : (elBg360Marks ? elBg360Marks.clientHeight : window.innerHeight);
      var capBias = getBg360CssNumber("--bg360-nav-cap-radius-bias", 1.35);
      var capLiftY = getBg360CssNumber("--bg360-nav-cap-y-lift", 5);
      var sphereRadius = 499 + (isFinite(capBias) ? capBias : 0);
      var angularRadius = getBg360OriginCoverAngularRadius(viewHeight);
      var strokeAngularWidth = getBg360OriginCoverStrokeAngularWidth(viewHeight);
      var fill = parseBg360CssColor("--bg360-origin-cover-fill", 0xffffff, 1);
      var stroke = parseBg360CssColor("--bg360-origin-cover-stroke", 0xffffff, 0.2);
      var signature = [
        sphereRadius.toFixed(5),
        capLiftY.toFixed(5),
        angularRadius.toFixed(5),
        strokeAngularWidth.toFixed(5),
        fill.color,
        fill.opacity.toFixed(3),
        stroke.color,
        stroke.opacity.toFixed(3)
      ].join("|");
      if (bg360Runtime.originCoverSignature === signature && bg360Runtime.originCoverMesh) return;
    
      disposeBg360OriginCoverMesh();
    
      var geometry = createBg360NadirCapGeometry(sphereRadius, angularRadius, 18, 256);
      /* Капа всегда в transparent-проходе (transparent: true), иначе при opacity=1 она уходит в opaque и рисуется ДО лент с depthTest:false — стрелки оказываются поверх круга. Порядок относительно лент задаём renderOrder. */
      var material = new window.THREE.MeshBasicMaterial({
        color: fill.color,
        opacity: fill.opacity,
        transparent: true,
        side: window.THREE.DoubleSide,
        depthTest: false,
        depthWrite: false
      });
      var mesh = new window.THREE.Mesh(geometry, material);
      /* Панорама (0) → ленты к меткам (10–11) → капа/ободок (200–201) → стрелка азимута на капе (210–211). */
      mesh.renderOrder = 200;
      mesh.position.y = isFinite(capLiftY) ? capLiftY : 0;
      bg360Runtime.scene.add(mesh);
    
      bg360Runtime.originCoverMesh = mesh;
      bg360Runtime.originCoverMaterial = material;
      bg360Runtime.originCoverGeometry = geometry;
    
      if (strokeAngularWidth > 0 && stroke.opacity > 0) {
        var ringGeometry = createBg360NadirRingGeometry(sphereRadius - 0.2, angularRadius, angularRadius + strokeAngularWidth, 256);
        var ringMaterial = new window.THREE.MeshBasicMaterial({
          color: stroke.color,
          opacity: stroke.opacity,
          transparent: true,
          side: window.THREE.DoubleSide,
          depthTest: false,
          depthWrite: false
        });
        var ringMesh = new window.THREE.Mesh(ringGeometry, ringMaterial);
        ringMesh.renderOrder = 201;
        ringMesh.position.y = isFinite(capLiftY) ? capLiftY : 0;
        bg360Runtime.scene.add(ringMesh);
        bg360Runtime.originCoverStrokeMesh = ringMesh;
        bg360Runtime.originCoverStrokeMaterial = ringMaterial;
        bg360Runtime.originCoverStrokeGeometry = ringGeometry;
      }
    
      bg360Runtime.originCoverSignature = signature;
    }
    
    // Возвращает экранную проекцию нижней точки сферы под камерой; если она за горизонтом, уводит старт ниже экрана.
    function getBg360UnderCameraScreenPoint(width, height) {
      if (!window.THREE || !bg360Runtime.camera || width <= 0 || height <= 0) {
        return { x: width * 0.5, y: height };
      }
    
      if (!bg360MarkProjNadirPoint) bg360MarkProjNadirPoint = new window.THREE.Vector3();
      if (!bg360MarkProjNadirCameraPoint) bg360MarkProjNadirCameraPoint = new window.THREE.Vector3();
    
      bg360Runtime.camera.updateMatrixWorld(true);
      var depthMultiplier = getBg360UnderCameraDepthMultiplier();
      // Нижняя точка сферы в координатах 360-мира: направление строго вниз от центра камеры.
      bg360MarkProjNadirCameraPoint.set(0, -500, 0).applyMatrix4(bg360Runtime.camera.matrixWorldInverse);
      if (bg360MarkProjNadirCameraPoint.z >= -0.001) {
        // Когда нижняя точка на горизонте или за камерой, её перспектива уходит в бесконечность ниже кадра.
        return { x: width * 0.5, y: height * depthMultiplier };
      }
    
      bg360MarkProjNadirPoint.set(0, -500, 0).project(bg360Runtime.camera);
      if (!isFinite(bg360MarkProjNadirPoint.x) || !isFinite(bg360MarkProjNadirPoint.y)) {
        return { x: width * 0.5, y: height * depthMultiplier };
      }
    
      var projectedX = (bg360MarkProjNadirPoint.x * 0.5 + 0.5) * width;
      var projectedY = (-bg360MarkProjNadirPoint.y * 0.5 + 0.5) * height;
      // У горизонта проекция может стать огромной; ограничиваем только DOM-длину, оставляя старт под экраном.
      return {
        x: projectedX,
        y: clampNumber(projectedY, -height * depthMultiplier, height * depthMultiplier)
      };
    }
    
    // Рисует пунктирную линию от нижней точки сферы под камерой до метки; линия лежит под самой меткой.
    function updateBg360MarkLine(markNode, screenX, screenY, visible) {
      if (!elBg360Marks || !bg360MarksRuntime.lines) return;
    
      var lineIndex = markNode ? String(markNode.dataset.markLineIndex || "") : "";
      var linesLayer = elBg360Marks.querySelector(".bg360-mark-lines");
      var line = linesLayer && lineIndex !== "" ? linesLayer.children[Number(lineIndex)] : null;
      if (!line || !line.classList || !line.classList.contains("bg360-mark-line")) return;
    
      if (markNode && markNode.classList && markNode.classList.contains("kind-scene-target")) {
        // Scene-выходы показываются окружностью с подписью, без пунктирной линии/стрелки к точке.
        line.classList.add("hidden");
        return;
      }
    
      if (!visible) {
        line.classList.add("hidden");
        return;
      }
    
      var width = elBg360Marks.clientWidth || 0;
      var height = elBg360Marks.clientHeight || 0;
      if (width <= 0 || height <= 0) {
        line.classList.add("hidden");
        return;
      }
      linesLayer.setAttribute("viewBox", "0 0 " + width + " " + height);
    
      var origin = getBg360UnderCameraScreenPoint(width, height);
      var originX = origin.x;
      var originY = origin.y;
      var targetX = screenX * width;
      var targetY = screenY * height;
      if (!isFinite(originX) || !isFinite(originY) || !isFinite(targetX) || !isFinite(targetY)) {
        line.classList.add("hidden");
        return;
      }
      line.classList.remove("hidden");
      // SVG-отрезок стабильнее повернутого div, когда старт находится далеко за нижней границей экрана.
      line.setAttribute("x1", originX);
      line.setAttribute("y1", originY);
      line.setAttribute("x2", targetX);
      line.setAttribute("y2", targetY);
    }
    
    // --- WebGL-стрелки навигации 360 (хорда от якоря UV к метке, billboard-лента + наконечник, клик по полосе в px) ---
    
    /** Минимальный dot(луч_к_точке, взгляд) для попадания точки в оверлей меток (как в редакторе). */
    var BG360_OVERLAY_DOT_MIN = 0.00001;
    
    /** Кэш отрезков hit-test в координатах слоя bg360MarksLayer. */
    var bg360NavArrowHitCache = [];
    
    /** Скретч для проекции мировой точки в слой меток (не путать с bg360MarkProjPoint из UV). */
    var bg360NavWorldProjScratch = null;
    
    /** Скретч для экранной позиции метки по UV. */
    var bg360NavMarkProjScratch = null;
    
    /** Скретчи для маркеров «стрелка за кадром» (подсказка по краю экрана). */
    var bg360HintWorldScratch = null;
    var bg360HintRight = null;
    var bg360HintUp = null;
    /** Точка на прямой хорде якорь→метка для позиции маркера (не на поверхности сферы). */
    var bg360HintChordP = null;
    
    /** Векторы billboard-обновления стрелок. */
    var bg360BillCam = null;
    var bg360BillBase = null;
    var bg360BillFwd = null;
    var bg360BillN = null;
    var bg360BillDpl = null;
    var bg360BillAlong = null;
    var bg360BillMid = null;
    var bg360BillView = null;
    var bg360BillRight = null;
    var bg360BillP0a = null;
    var bg360BillP0b = null;
    var bg360BillP1a = null;
    var bg360BillP1b = null;
    var bg360BillTmp = null;
    var bg360BillHorizDir = null;
    
    /** Векторы расчёта хорды при сборке мешей. */
    var bg360NavScratchA = null;
    var bg360NavScratchB = null;
    var bg360NavScratchDir = null;
    var bg360NavScratchStart = null;
    var bg360NavScratchEnd = null;
    var bg360NavScratchShaftEnd = null;
    
    // Читает настройки стрелок из CSS (корневые переменные --bg360-nav-*).
    function readBg360NavConfig() {
      var nadirArrowPaint = parseBg360CssColor("--bg360-nav-nadir-arrow-color", 0x96989e, 1);
      return {
        anchorU: clampNumber(getBg360CssNumber("--bg360-nav-anchor-u", 0), 0, 1),
        anchorV: clampNumber(getBg360CssNumber("--bg360-nav-anchor-v", 0), 0, 1),
        chordMarginStart: Math.max(0, getBg360CssNumber("--bg360-nav-chord-margin-start", 12)),
        chordMarginEnd: Math.max(0, getBg360CssNumber("--bg360-nav-chord-margin-end", 18)),
        arrowSteps: Math.max(4, Math.min(32, Math.round(getBg360CssNumber("--bg360-nav-arrow-steps", 22)))),
        startInsetPx: Math.max(0, getBg360CssNumber("--bg360-nav-start-inset-px", 0)),
        markGapPx: Math.max(0, getBg360CssNumber("--bg360-nav-mark-gap-px", 80)),
        minChordPx: Math.max(0, getBg360CssNumber("--bg360-nav-min-chord-px", 28)),
        hitBandPx: Math.max(8, getBg360CssNumber("--bg360-nav-hit-band-px", 38)),
        hitBandMul: clampNumber(getBg360CssNumber("--bg360-nav-hit-band-width-mul", 2), 0.25, 8),
        hitChordLenMul: clampNumber(getBg360CssNumber("--bg360-nav-hit-chord-length-mul", 2), 1, 6),
        ribbonHalfW: Math.max(1, getBg360CssNumber("--bg360-nav-ribbon-half-w", 14)),
        headDepth: Math.max(2, getBg360CssNumber("--bg360-nav-head-depth", 28)),
        headHalfW: Math.max(1, getBg360CssNumber("--bg360-nav-head-half-w", 10)),
        lineOpacity: clampNumber(getBg360CssNumber("--bg360-nav-line-opacity", 0.55), 0.05, 1),
        nadirArrowEnabled: getBg360CssNumber("--bg360-nav-nadir-arrow-enabled", 1) !== 0,
        /* Цвет стрелки на круге: rgb/rgba/#hex; альфа из rgba дополнительно умножается на nadirArrowOpacity. */
        nadirArrowPaint: nadirArrowPaint,
        nadirArrowOpacity: clampNumber(getBg360CssNumber("--bg360-nav-nadir-arrow-opacity", 0.72), 0.05, 1),
        nadirTailHalf: Math.max(0.5, getBg360CssNumber("--bg360-nav-nadir-tail-half", 14)),
        nadirFwdHalf: Math.max(0.5, getBg360CssNumber("--bg360-nav-nadir-fwd-half", 14)),
        nadirHeadDepth: Math.max(1, getBg360CssNumber("--bg360-nav-nadir-head-depth", 7)),
        nadirHeadHalfW: Math.max(0.5, getBg360CssNumber("--bg360-nav-nadir-head-half-w", 5)),
        nadirRibbonHalfW: Math.max(0.25, getBg360CssNumber("--bg360-nav-nadir-ribbon-half-w", 2.4)),
        nadirCenterLift: getBg360CssNumber("--bg360-nav-nadir-center-lift", 3)
      };
    }
    
    // Собирает подпись текущего набора меток и ключевых параметров, чтобы не пересоздавать меши без необходимости.
    function buildBg360NavArrowsSignature() {
      var cfg = readBg360NavConfig();
      var sphereRBias = getBg360CssNumber("--bg360-nav-cap-radius-bias", 1.35);
      var capLiftY = getBg360CssNumber("--bg360-nav-cap-y-lift", 5);
      var parts = [
        bg360MarksRuntime.lines ? "L1" : "L0",
        (isFinite(sphereRBias) ? sphereRBias : 0).toFixed(3),
        (isFinite(capLiftY) ? capLiftY : 0).toFixed(3),
        cfg.anchorU.toFixed(4),
        cfg.anchorV.toFixed(4),
        cfg.chordMarginStart.toFixed(2),
        cfg.chordMarginEnd.toFixed(2),
        cfg.arrowSteps,
        cfg.ribbonHalfW.toFixed(2),
        cfg.headDepth.toFixed(2),
        cfg.headHalfW.toFixed(2),
        cfg.lineOpacity.toFixed(3),
        cfg.nadirArrowEnabled ? "N1" : "N0",
        String(cfg.nadirArrowPaint.color),
        cfg.nadirArrowPaint.opacity.toFixed(3),
        cfg.nadirArrowOpacity.toFixed(3),
        cfg.nadirTailHalf.toFixed(2),
        cfg.nadirFwdHalf.toFixed(2),
        cfg.nadirHeadDepth.toFixed(2),
        cfg.nadirHeadHalfW.toFixed(2),
        cfg.nadirRibbonHalfW.toFixed(2),
        cfg.nadirCenterLift.toFixed(2)
      ];
      if (!Array.isArray(bg360MarksRuntime.marks)) return parts.join("|");
      for (var i = 0; i < bg360MarksRuntime.marks.length; i++) {
        var m = bg360MarksRuntime.marks[i];
        if (bg360IsDirectionalMark(m)) {
          parts.push(String(i), String(m.id || ""), String(m.x), String(m.y));
        }
      }
      return parts.join("|");
    }
    
    // Точка на сфере радиуса r в мировых координатах по UV панорамы (согласовано с bg360UvToDirection).
    function bg360UvToWorldPointOnSphere(u, v, radius) {
      var d = bg360UvToDirection(u, v);
      if (!d) return null;
      var r = Number(radius);
      if (!isFinite(r) || r <= 0) r = 500;
      return { x: d.x * r, y: d.y * r, z: d.z * r };
    }
    
    // Проецирует мировую точку на сфере в пиксели слоя меток (как линии SVG); null если за спиной камеры.
    function bg360ProjectWorldToMarksPx(wx, wy, wz) {
      if (!elBg360Marks || !bg360Runtime.camera || !window.THREE) return null;
      if (!bg360NavWorldProjScratch) bg360NavWorldProjScratch = new window.THREE.Vector3();
      if (!bg360MarkProjCameraDir) bg360MarkProjCameraDir = new window.THREE.Vector3();
    
      var w = elBg360Marks.clientWidth || 0;
      var h = elBg360Marks.clientHeight || 0;
      if (w <= 0 || h <= 0) return null;
    
      bg360Runtime.camera.updateMatrixWorld(true);
      bg360Runtime.camera.getWorldPosition(bg360NavWorldProjScratch);
      var camX = bg360NavWorldProjScratch.x;
      var camY = bg360NavWorldProjScratch.y;
      var camZ = bg360NavWorldProjScratch.z;
    
      bg360NavWorldProjScratch.set(wx - camX, wy - camY, wz - camZ);
      var toLen = bg360NavWorldProjScratch.length();
      if (toLen < 1e-10) return null;
      bg360NavWorldProjScratch.multiplyScalar(1 / toLen);
    
      bg360Runtime.camera.getWorldDirection(bg360MarkProjCameraDir);
      if (bg360NavWorldProjScratch.dot(bg360MarkProjCameraDir) < BG360_OVERLAY_DOT_MIN) return null;
    
      bg360NavWorldProjScratch.set(wx, wy, wz);
      bg360NavWorldProjScratch.project(bg360Runtime.camera);
      return {
        x: (bg360NavWorldProjScratch.x * 0.5 + 0.5) * w,
        y: (-bg360NavWorldProjScratch.y * 0.5 + 0.5) * h
      };
    }
    
    // Экранная позиция центра метки по UV; null если точка вне обзора.
    function bg360MarkUvToMarksPx(u, v) {
      if (!elBg360Marks || !bg360Runtime.camera || !window.THREE) return null;
      if (!bg360NavMarkProjScratch) bg360NavMarkProjScratch = new window.THREE.Vector3();
      if (!bg360MarkProjCameraDir) bg360MarkProjCameraDir = new window.THREE.Vector3();
    
      var dir = bg360UvToDirection(u, v);
      if (!dir) return null;
      bg360Runtime.camera.getWorldDirection(bg360MarkProjCameraDir);
      if (dir.dot(bg360MarkProjCameraDir) <= 0) return null;
    
      var w = elBg360Marks.clientWidth || 0;
      var h = elBg360Marks.clientHeight || 0;
      if (w <= 0 || h <= 0) return null;
    
      bg360NavMarkProjScratch.copy(dir);
      bg360NavMarkProjScratch.project(bg360Runtime.camera);
      return {
        x: (bg360NavMarkProjScratch.x * 0.5 + 0.5) * w,
        y: (-bg360NavMarkProjScratch.y * 0.5 + 0.5) * h
      };
    }
    
    // Ближайшая к якорю точка хорды, видимая на экране (бинарный поиск), если сам якорь за спиной.
    function bg360ArrowChordScreenStartOrNull(wxA, wyA, wzA, wxB, wyB, wzB, binarySteps) {
      var projA = bg360ProjectWorldToMarksPx(wxA, wyA, wzA);
      if (projA) return projA;
      if (!bg360ProjectWorldToMarksPx(wxB, wyB, wzB)) return null;
    
      var lo = 0;
      var hi = 1;
      var steps = Math.max(4, Math.min(28, Number(binarySteps) || 22));
      for (var k = 0; k < steps; k++) {
        var mid = (lo + hi) * 0.5;
        var mx = wxA + mid * (wxB - wxA);
        var my = wyA + mid * (wyB - wyA);
        var mz = wzA + mid * (wzB - wzA);
        if (bg360ProjectWorldToMarksPx(mx, my, mz)) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
    
      var tx = wxA + hi * (wxB - wxA);
      var ty = wyA + hi * (wyB - wyA);
      var tz = wzA + hi * (wzB - wzA);
      return bg360ProjectWorldToMarksPx(tx, ty, tz);
    }
    
    // Расстояние от точки до отрезка в 2D (полоса hit-test вокруг хорды).
    function bg360DistPointToSegment2d(px, py, x1, y1, x2, y2) {
      var vx = x2 - x1;
      var vy = y2 - y1;
      var wx = px - x1;
      var wy = py - y1;
      var c1 = vx * wx + vy * wy;
      if (c1 <= 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
      var c2 = vx * vx + vy * vy;
      if (c2 <= c1) return Math.sqrt((px - x2) * (px - x2) + (py - y2) * (py - y2));
      var t = c1 / c2;
      var projx = x1 + t * vx;
      var projy = y1 + t * vy;
      return Math.sqrt((px - projx) * (px - projx) + (py - projy) * (py - projy));
    }
    
    // Читает настройки SVG-маркеров «стрелка за кадром» из CSS (--bg360-nav-edge-hint-*).
    function readBg360NavEdgeHintConfig() {
      return {
        enabled: getBg360CssNumber("--bg360-nav-edge-hint-enabled", 1) !== 0,
        insetPx: Math.max(0, getBg360CssNumber("--bg360-nav-edge-hint-inset-px", 28)),
        depthPx: Math.max(4, getBg360CssNumber("--bg360-nav-edge-hint-depth-px", 16)),
        halfBasePx: Math.max(3, getBg360CssNumber("--bg360-nav-edge-hint-half-base-px", 12)),
        maxCount: Math.max(1, Math.round(getBg360CssNumber("--bg360-nav-edge-hint-max", 8))),
        fillPaint: parseBg360CssColor("--bg360-nav-edge-hint-fill", 0xffffff, 0.55),
        strokePaint: parseBg360CssColor("--bg360-nav-edge-hint-stroke", 0x000000, 0.35),
        strokeWidth: Math.max(0.25, getBg360CssNumber("--bg360-nav-edge-hint-stroke-width", 1.25)),
        chordT: clampNumber(getBg360CssNumber("--bg360-nav-edge-hint-chord-t", 0.22), 0, 1)
      };
    }
    
    // Преобразует результат parseBg360CssColor в rgb + opacity для SVG-атрибутов.
    function bg360PaintToSvgColorOpacity(paint) {
      var hex = paint && typeof paint.color === "number" ? paint.color : 0xffffff;
      var a = paint && isFinite(paint.opacity) ? clampNumber(paint.opacity, 0, 1) : 1;
      var r = (hex >> 16) & 255;
      var g = (hex >> 8) & 255;
      var b = hex & 255;
      return { rgb: "rgb(" + r + "," + g + "," + b + ")", opacity: a };
    }
    
    // Читает CSS-настройки SVG-компаса; длины заданы в координатах viewBox, а размер на экране задаёт CSS.
    function readBg360CompassConfig() {
      var minLen = Math.max(1, getBg360CssNumber("--bg360-compass-arrow-min-length", 25));
      var maxLen = Math.max(minLen, getBg360CssNumber("--bg360-compass-arrow-max-length", 47));
      var compassOpacity = clampNumber(getBg360CssNumber("--bg360-compass-opacity", 0.62), 0.05, 1);
      var arrowPaint = parseBg360CssColor("--bg360-compass-arrow-color", 0xdcdcdc, 1);
      return {
        enabled: getBg360CssNumber("--bg360-compass-enabled", 1) !== 0,
        opacity: compassOpacity,
        circleRadius: Math.max(1, getBg360CssNumber("--bg360-compass-circle-radius", 14)),
        circleStrokeWidth: Math.max(0, getBg360CssNumber("--bg360-compass-circle-stroke-width", 2)),
        circleFillPaint: parseBg360CssColor("--bg360-compass-circle-fill", 0x505050, 1),
        circleStrokePaint: parseBg360CssColor("--bg360-compass-circle-stroke", 0xdcdcdc, 1),
        arrowPaint: arrowPaint,
        arrowMinLength: minLen,
        arrowMaxLength: maxLen,
        arrowRibbonHalfW: Math.max(0.5, getBg360CssNumber("--bg360-compass-arrow-ribbon-half-w", 3.2)),
        arrowHeadDepth: Math.max(1, getBg360CssNumber("--bg360-compass-arrow-head-depth", 10)),
        arrowHeadHalfW: Math.max(0.5, getBg360CssNumber("--bg360-compass-arrow-head-half-w", 7.5)),
        scenePaint: parseBg360CssColor("--bg360-compass-scene-color", 0xdcdcdc, 1),
        sceneLineWidth: Math.max(0.25, getBg360CssNumber("--bg360-compass-scene-line-width", 1.35)),
        sceneCircleRadius: Math.max(0.5, getBg360CssNumber("--bg360-compass-scene-circle-radius", 3.8)),
        sceneCircleStrokeWidth: Math.max(0, getBg360CssNumber("--bg360-compass-scene-circle-stroke-width", 1.35)),
        sceneCircleFillPaint: parseBg360CssColor("--bg360-compass-scene-circle-fill", 0xdcdcdc, 1),
        sceneCircleStrokePaint: parseBg360CssColor("--bg360-compass-scene-circle-stroke", 0xdcdcdc, 1),
        viewLineWidth: Math.max(0.25, getBg360CssNumber("--bg360-compass-view-line-width", 1.15)),
        viewLineDash: Math.max(0, getBg360CssNumber("--bg360-compass-view-line-dash", 2.6)),
        viewLineGap: Math.max(0, getBg360CssNumber("--bg360-compass-view-line-gap", 2.3)),
        labelEnabled: getBg360CssNumber("--bg360-compass-label-enabled", 1) !== 0,
        labelFontSize: Math.max(1, getBg360CssNumber("--bg360-compass-label-font-size", 7.4)),
        labelGap: Math.max(0, getBg360CssNumber("--bg360-compass-label-gap", 3.6)),
        labelAnchorOffset: getBg360CssNumber("--bg360-compass-label-anchor-offset", 0),
        labelSideBias: clampNumber(getBg360CssNumber("--bg360-compass-label-side-bias", 0.28), 0, 0.95),
        labelWrapChars: Math.max(1, Math.round(getBg360CssNumber("--bg360-compass-label-wrap-chars", 6))),
        labelLineHeightMul: Math.max(0.8, getBg360CssNumber("--bg360-compass-label-line-height", 1.08)),
        labelOpacity: clampNumber(getBg360CssNumber("--bg360-compass-label-opacity", compassOpacity), 0.05, 1),
        labelPaint: parseBg360CssColor("--bg360-compass-label-color", arrowPaint.color, arrowPaint.opacity),
        labelStrokePaint: parseBg360CssColor("--bg360-compass-label-stroke", 0x000000, 0.62),
        labelStrokeWidth: Math.max(0, getBg360CssNumber("--bg360-compass-label-stroke-width", 2.2)),
        padding: Math.max(0, getBg360CssNumber("--bg360-compass-padding", 4))
      };
    }
    
    // Возвращает SVG path стрелки, направленной вверх; поворот конкретного направления задаётся transform rotate().
    function buildBg360CompassArrowPath(length, cfg) {
      var len = Math.max(1, Number(length) || 1);
      var headDepth = Math.min(cfg.arrowHeadDepth, len * 0.62);
      var shaftEnd = Math.max(0.5, len - headDepth);
      var ribbonHalf = Math.min(cfg.arrowRibbonHalfW, Math.max(0.5, shaftEnd * 0.42));
      var headHalf = Math.max(ribbonHalf, Math.min(cfg.arrowHeadHalfW, Math.max(ribbonHalf, len * 0.42)));
    
      return [
        "M", -ribbonHalf, 0,
        "L", ribbonHalf, 0,
        "L", ribbonHalf, -shaftEnd,
        "L", headHalf, -shaftEnd,
        "L", 0, -len,
        "L", -headHalf, -shaftEnd,
        "L", -ribbonHalf, -shaftEnd,
        "Z"
      ].join(" ");
    }
    
    // Собирает плоские направления компаса из тех же UV-меток и длины хорды, что используются WebGL-стрелками пола.
    function buildBg360CompassArrowData(compassCfg, navCfg) {
      var marks = bg360MarksRuntime.marks;
      if (!Array.isArray(marks) || !marks.length) return [];
    
      var wpAnchor = bg360UvToWorldPointOnSphere(navCfg.anchorU, navCfg.anchorV, 500);
      if (!wpAnchor) return [];
    
      var arrows = [];
      var rawMax = -Infinity;
      for (var i = 0; i < marks.length; i++) {
        var mark = marks[i];
        var isSceneTarget = bg360IsSceneTargetMark(mark);
        var isViewMark = bg360IsViewMark(mark);
        if (!bg360IsDirectionalMark(mark) && !isSceneTarget && !isViewMark) continue;
    
        var wMark = bg360UvToWorldPointOnSphere(mark.x, mark.y, 500);
        if (!wMark) continue;
    
        var dx = wMark.x - wpAnchor.x;
        var dy = wMark.y - wpAnchor.y;
        var dz = wMark.z - wpAnchor.z;
        var chordLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (chordLen < 1e-3) continue;
    
        var sm = Math.min(navCfg.chordMarginStart, chordLen * 0.4);
        var em = Math.min(navCfg.chordMarginEnd, chordLen * 0.4);
        var rawLen = Math.max(0, chordLen - sm - em);
        // Повторяем отбор 3D-стрелок: если на полу стрелка слишком короткая, компас её тоже не показывает.
        if (rawLen < navCfg.headDepth + 1) continue;
    
        var flatLen = Math.sqrt(dx * dx + dz * dz);
        if (flatLen < 1e-6) continue;
    
        var angleDeg = window.THREE.MathUtils.radToDeg(Math.atan2(dx, -dz));
        arrows.push({
          id: mark.id,
          kind: isSceneTarget ? "sceneTarget" : (isViewMark ? "view" : "arrow"),
          label: bg360GetCompassMarkLabel(mark),
          angleDeg: angleDeg,
          rawLen: rawLen
        });
        rawMax = Math.max(rawMax, rawLen);
      }
    
      if (!arrows.length) return [];
    
      var rawScaleMax = rawMax > 1e-6 ? rawMax : 1;
      for (var a = 0; a < arrows.length; a++) {
        // Сохраняем пропорцию с реальной WebGL-стрелкой: максимум сцены равен maxLength, остальные только ограничены снизу minLength.
        var proportionalLen = (arrows[a].rawLen / rawScaleMax) * compassCfg.arrowMaxLength;
        arrows[a].drawLen = clampNumber(proportionalLen, compassCfg.arrowMinLength, compassCfg.arrowMaxLength);
      }
      return arrows;
    }
    
    // Считает радиус точки привязки подписи: текст отодвигается от края направления и дополнительно смещается фиксированным сдвигом от центра.
    function getBg360CompassLabelRadius(arrow, cfg) {
      var extra = 0;
      if (arrow && arrow.kind === "sceneTarget") {
        extra = cfg.sceneCircleRadius + cfg.sceneCircleStrokeWidth * 0.5;
      } else if (arrow && arrow.kind === "view") {
        extra = cfg.viewLineWidth * 0.5;
      }
      var offset = cfg && isFinite(cfg.labelAnchorOffset) ? cfg.labelAnchorOffset : 0;
      return Math.max(0, (Number(arrow && arrow.drawLen) || 0) + extra + offset);
    }
    
    // Делит подпись компаса на строки: после порога переносит только по ближайшему пробелу справа, длинные слова остаются целыми.
    function wrapBg360CompassLabelText(text, wrapChars) {
      var limit = Math.max(1, Math.round(Number(wrapChars) || 10));
      var source = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      var sourceLines = source.split("\n");
      var result = [];
    
      for (var i = 0; i < sourceLines.length; i++) {
        var rest = String(sourceLines[i] || "").trim();
        if (!rest) continue;
    
        while (rest.length > limit) {
          var breakAt = rest.indexOf(" ", limit);
          if (breakAt < 0) break;
          var head = rest.slice(0, breakAt).trim();
          if (head) result.push(head);
          rest = rest.slice(breakAt).trim();
        }
        if (rest) result.push(rest);
      }
    
      return result;
    }
    
    // Не даёт нажатию по компасу начинать вращение 360-сцены под SVG-элементом.
    function handleBg360CompassTargetPointerDown(e) {
      if (e && typeof e.stopPropagation === "function") e.stopPropagation();
    }
    
    // Клик по SVG-элементу компаса выбирает ту же метку, что и соответствующая стрелка/точка на сцене.
    function handleBg360CompassTargetClick(e) {
      var el = e && e.currentTarget ? e.currentTarget : null;
      activateBg360MarkById(el && el.dataset ? el.dataset.markId : "", e);
    }
    
    // Помечает нарисованный элемент компаса как кликабельную область конкретной метки.
    function markBg360CompassClickTarget(el, markId) {
      var id = markId != null ? String(markId) : "";
      if (!el || !id) return;
      el.classList.add("bg360-compass-click-target");
      el.dataset.markId = id;
      el.addEventListener("pointerdown", handleBg360CompassTargetPointerDown);
      el.addEventListener("click", handleBg360CompassTargetClick);
    }
    
    // Добавляет горизонтальную подпись направления; координаты пересчитываются при каждом повороте компаса.
    function appendBg360CompassLabel(labelsGroup, arrow, cfg, labelPaint, labelStroke) {
      if (!labelsGroup || !arrow || !arrow.label) return;
      var lines = wrapBg360CompassLabelText(arrow.label, cfg.labelWrapChars);
      if (!lines.length) return;
    
      var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.classList.add("bg360-compass-label");
      markBg360CompassClickTarget(text, arrow.id);
      text.dataset.angleDeg = String(arrow.angleDeg);
      text.dataset.labelRadius = String(getBg360CompassLabelRadius(arrow, cfg));
      text.dataset.labelGap = String(cfg.labelGap);
      text.dataset.labelSideBias = String(cfg.labelSideBias);
      text.dataset.labelFontSize = String(cfg.labelFontSize);
      text.dataset.labelLineHeight = String(cfg.labelFontSize * cfg.labelLineHeightMul);
      text.dataset.labelLineCount = String(lines.length);
      text.setAttribute("font-size", String(cfg.labelFontSize));
      text.setAttribute("fill", labelPaint.rgb);
      text.setAttribute("fill-opacity", String(labelPaint.opacity));
      text.setAttribute("stroke", labelStroke.rgb);
      text.setAttribute("stroke-opacity", String(labelStroke.opacity));
      text.setAttribute("stroke-width", String(cfg.labelStrokeWidth));
      text.setAttribute("stroke-linejoin", "round");
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute("aria-hidden", "true");
      if (cfg.labelStrokeWidth <= 0) text.setAttribute("stroke", "none");
    
      for (var i = 0; i < lines.length; i++) {
        var tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        tspan.textContent = lines[i];
        tspan.dataset.lineIndex = String(i);
        text.appendChild(tspan);
      }
    
      labelsGroup.appendChild(text);
    }
    
    // Создаёт SVG-компас в левом нижнем углу слоя меток и рисует направления текущей 360-панорамы.
    function appendBg360Compass() {
      if (!elBg360Marks || !window.THREE) return;
      var cfg = readBg360CompassConfig();
      if (!cfg.enabled) return;
    
      var navCfg = readBg360NavConfig();
      var arrows = buildBg360CompassArrowData(cfg, navCfg);
      if (!arrows.length) return;
    
      var ns = "http://www.w3.org/2000/svg";
      var maxReach = Math.max(cfg.arrowMaxLength, cfg.circleRadius) +
        Math.max(cfg.arrowHeadHalfW, cfg.arrowRibbonHalfW, cfg.sceneCircleRadius, cfg.sceneLineWidth, cfg.viewLineWidth) +
        Math.max(cfg.circleStrokeWidth, cfg.sceneCircleStrokeWidth) +
        cfg.padding;
      var half = Math.ceil(Math.max(1, maxReach));
      var svg = document.createElementNS(ns, "svg");
      svg.classList.add("bg360-compass");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.setAttribute("viewBox", (-half) + " " + (-half) + " " + (half * 2) + " " + (half * 2));
    
      var group = document.createElementNS(ns, "g");
      group.classList.add("bg360-compass-shapes");
      // Общая прозрачность группы убирает двойное затемнение там, где круг и стрелки перекрываются.
      group.setAttribute("opacity", String(cfg.opacity));
    
      var circleFill = bg360PaintToSvgColorOpacity(cfg.circleFillPaint);
      var circleStroke = bg360PaintToSvgColorOpacity(cfg.circleStrokePaint);
      var arrowPaint = bg360PaintToSvgColorOpacity(cfg.arrowPaint);
      var scenePaint = bg360PaintToSvgColorOpacity(cfg.scenePaint);
      var sceneCircleFill = bg360PaintToSvgColorOpacity(cfg.sceneCircleFillPaint);
      var sceneCircleStroke = bg360PaintToSvgColorOpacity(cfg.sceneCircleStrokePaint);
      var labelPaint = bg360PaintToSvgColorOpacity(cfg.labelPaint);
      var labelStroke = bg360PaintToSvgColorOpacity(cfg.labelStrokePaint);
      var labelsGroup = null;
      if (cfg.labelEnabled) {
        labelsGroup = document.createElementNS(ns, "g");
        labelsGroup.classList.add("bg360-compass-labels");
        labelsGroup.setAttribute("opacity", String(cfg.labelOpacity));
      }
    
      var circle = document.createElementNS(ns, "circle");
      circle.classList.add("bg360-compass-shape");
      circle.setAttribute("cx", "0");
      circle.setAttribute("cy", "0");
      circle.setAttribute("r", String(cfg.circleRadius));
      circle.setAttribute("fill", circleFill.rgb);
      circle.setAttribute("stroke", circleStroke.rgb);
      circle.setAttribute("stroke-width", String(cfg.circleStrokeWidth));
      group.appendChild(circle);
    
      for (var i = 0; i < arrows.length; i++) {
        if (arrows[i].kind === "view") {
          var viewGroup = document.createElementNS(ns, "g");
          viewGroup.setAttribute("transform", "rotate(" + arrows[i].angleDeg.toFixed(3) + ")");
          viewGroup.dataset.markId = arrows[i].id != null ? String(arrows[i].id) : "";
    
          var viewLine = document.createElementNS(ns, "line");
          viewLine.classList.add("bg360-compass-shape");
          markBg360CompassClickTarget(viewLine, arrows[i].id);
          viewLine.setAttribute("x1", "0");
          viewLine.setAttribute("y1", String(-cfg.circleRadius));
          viewLine.setAttribute("x2", "0");
          viewLine.setAttribute("y2", String(-arrows[i].drawLen));
          viewLine.setAttribute("stroke", arrowPaint.rgb);
          viewLine.setAttribute("stroke-opacity", String(arrowPaint.opacity));
          viewLine.setAttribute("stroke-width", String(cfg.viewLineWidth));
          viewLine.setAttribute("stroke-linecap", "round");
          if (cfg.viewLineDash > 0 || cfg.viewLineGap > 0) {
            viewLine.setAttribute("stroke-dasharray", cfg.viewLineDash + " " + cfg.viewLineGap);
          }
          viewGroup.appendChild(viewLine);
    
          group.appendChild(viewGroup);
          appendBg360CompassLabel(labelsGroup, arrows[i], cfg, labelPaint, labelStroke);
          continue;
        }
    
        if (arrows[i].kind === "sceneTarget") {
          var sceneGroup = document.createElementNS(ns, "g");
          sceneGroup.setAttribute("transform", "rotate(" + arrows[i].angleDeg.toFixed(3) + ")");
          sceneGroup.dataset.markId = arrows[i].id != null ? String(arrows[i].id) : "";
    
          var lineEnd = Math.max(cfg.circleRadius + cfg.sceneCircleRadius, arrows[i].drawLen - cfg.sceneCircleRadius);
          var sceneLine = document.createElementNS(ns, "line");
          sceneLine.classList.add("bg360-compass-shape");
          markBg360CompassClickTarget(sceneLine, arrows[i].id);
          sceneLine.setAttribute("x1", "0");
          sceneLine.setAttribute("y1", String(-cfg.circleRadius));
          sceneLine.setAttribute("x2", "0");
          sceneLine.setAttribute("y2", String(-lineEnd));
          sceneLine.setAttribute("stroke", scenePaint.rgb);
          sceneLine.setAttribute("stroke-opacity", String(scenePaint.opacity));
          sceneLine.setAttribute("stroke-width", String(cfg.sceneLineWidth));
          sceneLine.setAttribute("stroke-linecap", "round");
          sceneGroup.appendChild(sceneLine);
    
          var sceneCircle = document.createElementNS(ns, "circle");
          sceneCircle.classList.add("bg360-compass-shape");
          markBg360CompassClickTarget(sceneCircle, arrows[i].id);
          sceneCircle.setAttribute("cx", "0");
          sceneCircle.setAttribute("cy", String(-arrows[i].drawLen));
          sceneCircle.setAttribute("r", String(cfg.sceneCircleRadius));
          sceneCircle.setAttribute("fill", sceneCircleFill.rgb);
          sceneCircle.setAttribute("fill-opacity", String(sceneCircleFill.opacity));
          sceneCircle.setAttribute("stroke", sceneCircleStroke.rgb);
          sceneCircle.setAttribute("stroke-opacity", String(sceneCircleStroke.opacity));
          sceneCircle.setAttribute("stroke-width", String(cfg.sceneCircleStrokeWidth));
          sceneGroup.appendChild(sceneCircle);
    
          group.appendChild(sceneGroup);
          appendBg360CompassLabel(labelsGroup, arrows[i], cfg, labelPaint, labelStroke);
          continue;
        }
    
        var path = document.createElementNS(ns, "path");
        path.classList.add("bg360-compass-shape");
        markBg360CompassClickTarget(path, arrows[i].id);
        path.setAttribute("d", buildBg360CompassArrowPath(arrows[i].drawLen, cfg));
        path.setAttribute("fill", arrowPaint.rgb);
        path.setAttribute("transform", "rotate(" + arrows[i].angleDeg.toFixed(3) + ")");
        path.dataset.markId = arrows[i].id != null ? String(arrows[i].id) : "";
        group.appendChild(path);
        appendBg360CompassLabel(labelsGroup, arrows[i], cfg, labelPaint, labelStroke);
      }
    
      svg.appendChild(group);
      if (labelsGroup && labelsGroup.childNodes.length) svg.appendChild(labelsGroup);
      elBg360Marks.appendChild(svg);
      updateBg360CompassRotation();
    }
    
    // Держит подписи горизонтальными и ставит их за концом направления, чтобы текст не ложился на линии компаса.
    function updateBg360CompassLabels(yawDeg) {
      if (!elBg360Marks) return;
      var labels = elBg360Marks.querySelectorAll(".bg360-compass-label");
      if (!labels || !labels.length) return;
    
      var yaw = Number(yawDeg);
      if (!isFinite(yaw)) yaw = Number(bg360Runtime.yawDeg) || 0;
    
      for (var i = 0; i < labels.length; i++) {
        var label = labels[i];
        var angle = Number(label.dataset.angleDeg);
        var radius = Math.max(0, Number(label.dataset.labelRadius) || 0);
        var gap = Math.max(0, Number(label.dataset.labelGap) || 0);
        var sideBias = clampNumber(Number(label.dataset.labelSideBias) || 0, 0, 0.95);
        var fontSize = Math.max(1, Number(label.dataset.labelFontSize) || Number(label.getAttribute("font-size")) || 1);
        var lineHeight = Math.max(1, Number(label.dataset.labelLineHeight) || 1);
        var lineCount = Math.max(1, Math.round(Number(label.dataset.labelLineCount) || 1));
        if (!isFinite(angle)) continue;
    
        var rad = (angle + yaw) * Math.PI / 180;
        var ux = Math.sin(rad);
        var uy = -Math.cos(rad);
        var x = ux * radius;
        var y = uy * radius;
        var anchor = "middle";
        var centerOffset = (lineCount - 1) * 0.5;
        var blockHalfHeight = ((lineCount - 1) * lineHeight + fontSize) * 0.5;
    
        if (ux > sideBias) {
          x += gap;
          anchor = "start";
        } else if (ux < -sideBias) {
          x -= gap;
          anchor = "end";
        } else {
          // Для верхних/нижних подписей gap считается до края текстового блока, а не до его центра.
          y += (uy < 0 ? -1 : 1) * (gap + blockHalfHeight);
        }
    
        label.setAttribute("x", x.toFixed(3));
        label.setAttribute("y", y.toFixed(3));
        label.setAttribute("text-anchor", anchor);
    
        var lineNodes = label.querySelectorAll("tspan");
        for (var j = 0; j < lineNodes.length; j++) {
          var lineIndex = Math.max(0, Number(lineNodes[j].dataset.lineIndex) || 0);
          var lineY = y + (lineIndex - centerOffset) * lineHeight;
          lineNodes[j].setAttribute("x", x.toFixed(3));
          lineNodes[j].setAttribute("y", lineY.toFixed(3));
        }
      }
    }
    
    // Поворачивает компас так, чтобы верх SVG всегда совпадал с текущим направлением взгляда камеры.
    function updateBg360CompassRotation() {
      if (!elBg360Marks) return;
      var group = elBg360Marks.querySelector(".bg360-compass-shapes");
      if (!group) return;
      var yaw = Number(bg360Runtime.yawDeg) || 0;
      group.setAttribute("transform", "rotate(" + yaw.toFixed(3) + ")");
      updateBg360CompassLabels(yaw);
    }
    
    /**
     * Цель для маркера «за кадром»: экранные px точки метки на сфере.
     * Если метка в поле зрения — обычная проекция; если за спиной — вынос за край по базису камеры.
     */
    function bg360NavHintTargetPxForMark(mark, width, height) {
      if (!mark || !bg360Runtime.camera || !window.THREE) return null;
      var dir = bg360UvToDirection(mark.x, mark.y);
      if (!dir) return null;
      if (!bg360MarkProjCameraDir) bg360MarkProjCameraDir = new window.THREE.Vector3();
      if (!bg360HintWorldScratch) bg360HintWorldScratch = new window.THREE.Vector3();
      if (!bg360HintRight) bg360HintRight = new window.THREE.Vector3();
      if (!bg360HintUp) bg360HintUp = new window.THREE.Vector3();
    
      bg360Runtime.camera.updateMatrixWorld(true);
      bg360Runtime.camera.getWorldDirection(bg360MarkProjCameraDir);
      var dot = dir.dot(bg360MarkProjCameraDir);
      var w = Number(width);
      var h = Number(height);
      var cx = w * 0.5;
      var cy = h * 0.5;
    
      if (dot > BG360_OVERLAY_DOT_MIN) {
        bg360HintWorldScratch.copy(dir).multiplyScalar(500);
        bg360HintWorldScratch.project(bg360Runtime.camera);
        return {
          x: (bg360HintWorldScratch.x * 0.5 + 0.5) * w,
          y: (-bg360HintWorldScratch.y * 0.5 + 0.5) * h
        };
      }
    
      bg360HintRight.crossVectors(bg360MarkProjCameraDir, bg360Runtime.camera.up);
      if (bg360HintRight.lengthSq() < 1e-10) {
        bg360HintRight.set(1, 0, 0);
      } else {
        bg360HintRight.normalize();
      }
      bg360HintUp.crossVectors(bg360HintRight, bg360MarkProjCameraDir).normalize();
      var sx = dir.dot(bg360HintRight);
      var sy = dir.dot(bg360HintUp);
      var len = Math.sqrt(sx * sx + sy * sy);
      if (len < 1e-6) return null;
      sx /= len;
      sy /= len;
      var mag = Math.max(w, h) * 2;
      return { x: cx + sx * mag, y: cy - sy * mag };
    }
    
    /**
     * Экранные px точки на прямой хорде между якорем и меткой (та же геометрия, что у WebGL-ленты).
     * Смещение к якорю даёт подсказку у «ног», а не у проекции метки при подъёме камеры.
     * Если точка при предпочтительном t за камерой — бинарный поиск ближайшей видимой на участке [t, 1].
     */
    function bg360NavHintChordTargetPx(anchorU, anchorV, markU, markV, width, height, tPrefer) {
      var A = bg360UvToWorldPointOnSphere(anchorU, anchorV, 500);
      var B = bg360UvToWorldPointOnSphere(markU, markV, 500);
      if (!A || !B || !bg360Runtime.camera || !window.THREE) return null;
      if (!bg360HintChordP) bg360HintChordP = new window.THREE.Vector3();
    
      function projAt(t) {
        var u = clampNumber(Number(t), 0, 1);
        bg360HintChordP.set(
          A.x + (B.x - A.x) * u,
          A.y + (B.y - A.y) * u,
          A.z + (B.z - A.z) * u
        );
        return bg360ProjectWorldToMarksPx(bg360HintChordP.x, bg360HintChordP.y, bg360HintChordP.z);
      }
    
      var t0 = clampNumber(Number(tPrefer), 0, 1);
      var p0 = projAt(t0);
      if (p0) return p0;
    
      var p1 = projAt(1);
      if (!p1) return null;
    
      var lo = t0;
      var hi = 1;
      for (var k = 0; k < 16; k++) {
        var mid = (lo + hi) * 0.5;
        if (projAt(mid)) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
      return projAt(hi);
    }
    
    // Обновляет SVG-треугольники у края экрана для меток, чья цель вне «мягкого» кадра.
    function updateBg360NavEdgeHints() {
      if (!elBg360Marks || !bg360Runtime.active || !bg360Runtime.camera || !window.THREE) return;
      var svg = elBg360Marks.querySelector(".bg360-nav-edge-hints");
      if (!svg) return;
    
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    
      if (bg360MarksRuntime.locked || !bg360MarksHasAnyDirectional(bg360MarksRuntime.marks)) return;
    
      var cfg = readBg360NavEdgeHintConfig();
      if (!cfg.enabled) return;
    
      var w = elBg360Marks.clientWidth || 0;
      var h = elBg360Marks.clientHeight || 0;
      if (w <= 0 || h <= 0) return;
    
      svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    
      var inset = cfg.insetPx;
      var minX = inset;
      var minY = inset;
      var maxX = w - inset;
      var maxY = h - inset;
      if (maxX <= minX || maxY <= minY) return;
    
      var navCfg = readBg360NavConfig();
      var marks = bg360MarksRuntime.marks;
      var items = [];
      for (var i = 0; i < marks.length; i++) {
        var mark = marks[i];
        if (!bg360IsDirectionalMark(mark)) continue;
        var tpMark = bg360NavHintTargetPxForMark(mark, w, h);
        if (!tpMark || !isFinite(tpMark.x) || !isFinite(tpMark.y)) continue;
        if (tpMark.x >= minX && tpMark.x <= maxX && tpMark.y >= minY && tpMark.y <= maxY) continue;
    
        var tpChord = bg360NavHintChordTargetPx(
          navCfg.anchorU,
          navCfg.anchorV,
          mark.x,
          mark.y,
          w,
          h,
          cfg.chordT
        );
        /* Положение у края — по хорде (стабильно при наклоне камеры); остриё треугольника — к проекции метки (куда указывает стрелка). */
        var tpEdge = tpChord && isFinite(tpChord.x) && isFinite(tpChord.y) ? tpChord : tpMark;
    
        var ex = clampNumber(tpEdge.x, minX, maxX);
        var ey = clampNumber(tpEdge.y, minY, maxY);
        var vx = tpMark.x - ex;
        var vy = tpMark.y - ey;
        var vlen = Math.sqrt(vx * vx + vy * vy);
        if (vlen < 1e-6) {
          vx = tpEdge.x - ex;
          vy = tpEdge.y - ey;
          vlen = Math.sqrt(vx * vx + vy * vy);
        }
        if (vlen < 1e-6) continue;
        var nx = vx / vlen;
        var ny = vy / vlen;
        var px = -ny;
        var py = nx;
        var d = cfg.depthPx;
        var hb = cfg.halfBasePx;
        var x0 = ex;
        var y0 = ey;
        var x1 = ex - nx * d + px * hb;
        var y1 = ey - ny * d + py * hb;
        var x2 = ex - nx * d - px * hb;
        var y2 = ey - ny * d - py * hb;
        var ox = 0;
        if (tpMark.x < minX) ox = minX - tpMark.x;
        else if (tpMark.x > maxX) ox = tpMark.x - maxX;
        var oy = 0;
        if (tpMark.y < minY) oy = minY - tpMark.y;
        else if (tpMark.y > maxY) oy = tpMark.y - maxY;
        var priority = ox + oy;
        items.push({
          markId: String(mark.id || ""),
          points: x0 + "," + y0 + " " + x1 + "," + y1 + " " + x2 + "," + y2,
          priority: priority
        });
      }
    
      items.sort(function (a, b) {
        return b.priority - a.priority;
      });
      var limit = Math.min(cfg.maxCount, items.length);
      var fo = bg360PaintToSvgColorOpacity(cfg.fillPaint);
      var so = bg360PaintToSvgColorOpacity(cfg.strokePaint);
    
      for (var j = 0; j < limit; j++) {
        var it = items[j];
        var poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        poly.classList.add("bg360-nav-edge-hint-triangle");
        poly.setAttribute("points", it.points);
        if (it.markId) poly.dataset.markId = it.markId;
        poly.setAttribute("fill", fo.rgb);
        poly.setAttribute("fill-opacity", String(fo.opacity));
        poly.setAttribute("stroke", so.rgb);
        poly.setAttribute("stroke-opacity", String(so.opacity));
        poly.setAttribute("stroke-width", String(cfg.strokeWidth));
        poly.setAttribute("stroke-linejoin", "round");
        svg.appendChild(poly);
      }
    }
    
    // Пересчитывает отрезки для pick по стрелке каждый кадр (после вращения камеры).
    function updateBg360NavArrowHitCache() {
      bg360NavArrowHitCache = [];
      if (!elBg360Marks || !bg360Runtime.active || !bg360Runtime.camera || !window.THREE) return;
      if (!bg360MarksHasAnyDirectional(bg360MarksRuntime.marks)) return;
      var marks = bg360MarksRuntime.marks;
      if (!Array.isArray(marks) || !marks.length) return;
    
      var cfg = readBg360NavConfig();
      var w = elBg360Marks.clientWidth || 0;
      var h = elBg360Marks.clientHeight || 0;
      if (w <= 0 || h <= 0) return;
    
      var wpAnchor = bg360UvToWorldPointOnSphere(cfg.anchorU, cfg.anchorV, 500);
      if (!wpAnchor) return;
    
      var hasDirectional = false;
      for (var h0 = 0; h0 < marks.length; h0++) {
        if (bg360IsDirectionalMark(marks[h0])) {
          hasDirectional = true;
          break;
        }
      }
      if (!hasDirectional) return;
    
      bg360Runtime.camera.updateMatrixWorld(true);
    
      for (var index = 0; index < marks.length; index++) {
        var mark = marks[index];
        if (!bg360IsDirectionalMark(mark)) continue;
    
        var pos = bg360MarkUvToMarksPx(mark.x, mark.y);
        if (!pos) continue;
        var wMark = bg360UvToWorldPointOnSphere(mark.x, mark.y, 500);
        if (!wMark) continue;
    
        var chordStart = bg360ArrowChordScreenStartOrNull(
          wpAnchor.x,
          wpAnchor.y,
          wpAnchor.z,
          wMark.x,
          wMark.y,
          wMark.z,
          cfg.arrowSteps
        );
        if (!chordStart) continue;
    
        var dx = pos.x - chordStart.x;
        var dy = pos.y - chordStart.y;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < cfg.minChordPx) continue;
        var ux = dx / len;
        var uy = dy / len;
        var sx = chordStart.x + ux * cfg.startInsetPx;
        var sy = chordStart.y + uy * cfg.startInsetPx;
        var ex = pos.x - ux * cfg.markGapPx;
        var ey = pos.y - uy * cfg.markGapPx;
        var drawnLen = Math.sqrt((ex - sx) * (ex - sx) + (ey - sy) * (ey - sy));
        if (drawnLen < cfg.minChordPx) continue;
    
        var chordLenMul = cfg.hitChordLenMul;
        if (chordLenMul > 1.0005 && drawnLen > 1e-6) {
          var eux = (ex - sx) / drawnLen;
          var euy = (ey - sy) / drawnLen;
          var extraChord = drawnLen * (chordLenMul - 1);
          ex += eux * extraChord;
          ey += euy * extraChord;
        }
    
        bg360NavArrowHitCache.push({
          markIndex: index,
          ax: sx,
          ay: sy,
          bx: ex,
          by: ey
        });
      }
    }
    
    // Возвращает id метки при попадании в расширенную полосу вокруг проекции хорды (сектор «вверх» не используется).
    function pickBg360NavArrowMarkId(clientX, clientY) {
      if (!elBg360Marks || !bg360NavArrowHitCache.length) return "";
      var cfg = readBg360NavConfig();
      var band = cfg.hitBandPx * cfg.hitBandMul;
      var locX = clientX;
      var locY = clientY;
      try {
        var r = elBg360Marks.getBoundingClientRect();
        locX = clientX - r.left;
        locY = clientY - r.top;
      } catch (e) {}
    
      var bestIdx = -1;
      var bestScore = Infinity;
      for (var i = 0; i < bg360NavArrowHitCache.length; i++) {
        var e = bg360NavArrowHitCache[i];
        var dSeg = bg360DistPointToSegment2d(locX, locY, e.ax, e.ay, e.bx, e.by);
        if (dSeg <= band) {
          if (dSeg < bestScore) {
            bestScore = dSeg;
            bestIdx = e.markIndex;
          }
        }
      }
      if (bestIdx < 0 || !Array.isArray(bg360MarksRuntime.marks)) return "";
      var mk = bg360MarksRuntime.marks[bestIdx];
      return mk && mk.id != null ? String(mk.id) : "";
    }
    
    function bg360EnsureBillboardScratch() {
      if (!window.THREE) return;
      if (!bg360BillCam) bg360BillCam = new window.THREE.Vector3();
      if (!bg360BillBase) bg360BillBase = new window.THREE.Vector3();
      if (!bg360BillFwd) bg360BillFwd = new window.THREE.Vector3();
      if (!bg360BillN) bg360BillN = new window.THREE.Vector3();
      if (!bg360BillDpl) bg360BillDpl = new window.THREE.Vector3();
      if (!bg360BillAlong) bg360BillAlong = new window.THREE.Vector3();
      if (!bg360BillMid) bg360BillMid = new window.THREE.Vector3();
      if (!bg360BillView) bg360BillView = new window.THREE.Vector3();
      if (!bg360BillRight) bg360BillRight = new window.THREE.Vector3();
      if (!bg360BillP0a) bg360BillP0a = new window.THREE.Vector3();
      if (!bg360BillP0b) bg360BillP0b = new window.THREE.Vector3();
      if (!bg360BillP1a) bg360BillP1a = new window.THREE.Vector3();
      if (!bg360BillP1b) bg360BillP1b = new window.THREE.Vector3();
      if (!bg360BillTmp) bg360BillTmp = new window.THREE.Vector3();
      if (!bg360BillHorizDir) bg360BillHorizDir = new window.THREE.Vector3();
    }
    
    // Центр основания наконечника в плоскости billboard (как в bg360-marks-editor).
    function bg360NavBillboardHeadBaseWorld(tipX, tipY, tipZ, dirX, dirY, dirZ, headDepth, camPosX, camPosY, camPosZ) {
      if (!window.THREE) return false;
      bg360EnsureBillboardScratch();
      bg360BillN.set(camPosX, camPosY, camPosZ).sub(bg360BillTmp.set(tipX, tipY, tipZ));
      if (bg360BillN.lengthSq() < 1e-10) return false;
      bg360BillN.normalize();
      bg360BillFwd.set(dirX, dirY, dirZ);
      if (bg360BillFwd.lengthSq() < 1e-10) return false;
      bg360BillFwd.normalize();
      var dn = bg360BillFwd.dot(bg360BillN);
      bg360BillDpl.copy(bg360BillFwd).addScaledVector(bg360BillN, -dn);
      if (bg360BillDpl.lengthSq() < 1e-10) {
        bg360BillDpl.copy(bg360BillN).cross(bg360BillTmp.set(0, 1, 0));
      }
      if (bg360BillDpl.lengthSq() < 1e-10) {
        bg360BillDpl.set(1, 0, 0);
      }
      bg360BillDpl.normalize();
      bg360BillFwd.copy(bg360BillDpl);
      bg360BillBase.copy(bg360BillTmp.set(tipX, tipY, tipZ)).addScaledVector(bg360BillFwd, -headDepth);
      return true;
    }
    
    // Четырёхугольник ленты стрелки между p0 и p1, толщина 2*halfW, плоскость обращена к камере.
    function bg360NavUpdateRibbonGeometry(geom, p0x, p0y, p0z, p1x, p1y, p1z, halfW, camPosX, camPosY, camPosZ) {
      if (!geom || !window.THREE) return;
      bg360EnsureBillboardScratch();
      bg360BillAlong.set(p1x - p0x, p1y - p0y, p1z - p0z);
      var segLen = bg360BillAlong.length();
      if (segLen < 1e-6) return;
      bg360BillAlong.multiplyScalar(1 / segLen);
      bg360BillMid.set(p0x + p1x, p0y + p1y, p0z + p1z).multiplyScalar(0.5);
      bg360BillView.set(camPosX, camPosY, camPosZ).sub(bg360BillMid);
      if (bg360BillView.lengthSq() < 1e-10) return;
      bg360BillView.normalize();
      bg360BillRight.crossVectors(bg360BillAlong, bg360BillView);
      if (bg360BillRight.lengthSq() < 1e-10) {
        bg360BillRight.set(0, 1, 0).cross(bg360BillAlong);
      }
      if (bg360BillRight.lengthSq() < 1e-10) {
        bg360BillRight.set(1, 0, 0).cross(bg360BillAlong);
      }
      bg360BillRight.normalize().multiplyScalar(halfW);
      bg360BillP0a.set(p0x, p0y, p0z).add(bg360BillRight);
      bg360BillP0b.set(p0x, p0y, p0z).sub(bg360BillRight);
      bg360BillP1a.set(p1x, p1y, p1z).add(bg360BillRight);
      bg360BillP1b.set(p1x, p1y, p1z).sub(bg360BillRight);
    
      var posAttr = geom.getAttribute("position");
      if (!posAttr || !posAttr.array || posAttr.array.length < 18) {
        geom.setAttribute("position", new window.THREE.BufferAttribute(new Float32Array(18), 3));
        posAttr = geom.getAttribute("position");
      }
      var arr = posAttr.array;
      var i = 0;
      arr[i++] = bg360BillP0a.x; arr[i++] = bg360BillP0a.y; arr[i++] = bg360BillP0a.z;
      arr[i++] = bg360BillP0b.x; arr[i++] = bg360BillP0b.y; arr[i++] = bg360BillP0b.z;
      arr[i++] = bg360BillP1a.x; arr[i++] = bg360BillP1a.y; arr[i++] = bg360BillP1a.z;
      arr[i++] = bg360BillP0b.x; arr[i++] = bg360BillP0b.y; arr[i++] = bg360BillP0b.z;
      arr[i++] = bg360BillP1b.x; arr[i++] = bg360BillP1b.y; arr[i++] = bg360BillP1b.z;
      arr[i++] = bg360BillP1a.x; arr[i++] = bg360BillP1a.y; arr[i++] = bg360BillP1a.z;
      posAttr.needsUpdate = true;
      geom.computeBoundingSphere();
    }
    
    // Треугольный наконечник в плоскости «камера — вершина».
    function bg360NavUpdateHeadGeometry(geom, tipX, tipY, tipZ, dirX, dirY, dirZ, headDepth, halfWidth, camPosX, camPosY, camPosZ) {
      if (!geom || !window.THREE) return;
      if (!bg360NavBillboardHeadBaseWorld(tipX, tipY, tipZ, dirX, dirY, dirZ, headDepth, camPosX, camPosY, camPosZ)) return;
      bg360EnsureBillboardScratch();
      bg360BillRight.crossVectors(bg360BillFwd, bg360BillN);
      if (bg360BillRight.lengthSq() < 1e-10) return;
      bg360BillRight.normalize().multiplyScalar(halfWidth);
      bg360BillP0a.copy(bg360BillBase).add(bg360BillRight);
      bg360BillP0b.copy(bg360BillBase).sub(bg360BillRight);
    
      var posAttr = geom.getAttribute("position");
      if (!posAttr || !posAttr.array || posAttr.array.length < 9) {
        geom.setAttribute("position", new window.THREE.BufferAttribute(new Float32Array(9), 3));
        posAttr = geom.getAttribute("position");
      }
      var arr = posAttr.array;
      arr[0] = tipX; arr[1] = tipY; arr[2] = tipZ;
      arr[3] = bg360BillP0a.x; arr[4] = bg360BillP0a.y; arr[5] = bg360BillP0a.z;
      arr[6] = bg360BillP0b.x; arr[7] = bg360BillP0b.y; arr[8] = bg360BillP0b.z;
      posAttr.needsUpdate = true;
      geom.computeBoundingSphere();
    }
    
    // Горизонтальный единичный вектор направления взгляда (XZ) для стрелки на капе.
    function bg360NavCameraHorizDirXZ(out3) {
      if (!bg360Runtime.camera || !window.THREE) return false;
      if (!bg360MarkProjCameraDir) bg360MarkProjCameraDir = new window.THREE.Vector3();
      bg360Runtime.camera.getWorldDirection(bg360MarkProjCameraDir);
      out3.set(bg360MarkProjCameraDir.x, 0, bg360MarkProjCameraDir.z);
      if (out3.lengthSq() < 1e-10) {
        out3.set(0, 0, 1);
      } else {
        out3.normalize();
      }
      return true;
    }
    
    // Перед рендером: обновляет геометрию billboard у дочерних мешей группы навигации.
    function updateBg360NavBillboardMeshes() {
      if (!bg360Runtime.navArrowsGroup || !bg360Runtime.camera || !window.THREE) return;
      bg360EnsureBillboardScratch();
      bg360Runtime.camera.getWorldPosition(bg360BillCam);
      var cx = bg360BillCam.x;
      var cy = bg360BillCam.y;
      var cz = bg360BillCam.z;
      var grp = bg360Runtime.navArrowsGroup;
      for (var i = 0; i < grp.children.length; i++) {
        var ch = grp.children[i];
        var bd = ch.userData && ch.userData.bg360Billboard;
        if (!bd || !ch.geometry) continue;
        if (bd.kind === "ribbon") {
          var p1rx = bd.p1.x;
          var p1ry = bd.p1.y;
          var p1rz = bd.p1.z;
          var jn = bd.join;
          if (jn && jn.tip && jn.dir && jn.depth != null) {
            if (
              bg360NavBillboardHeadBaseWorld(
                jn.tip.x,
                jn.tip.y,
                jn.tip.z,
                jn.dir.x,
                jn.dir.y,
                jn.dir.z,
                jn.depth,
                cx,
                cy,
                cz
              )
            ) {
              p1rx = bg360BillBase.x;
              p1ry = bg360BillBase.y;
              p1rz = bg360BillBase.z;
            }
          }
          bg360NavUpdateRibbonGeometry(
            ch.geometry,
            bd.p0.x,
            bd.p0.y,
            bd.p0.z,
            p1rx,
            p1ry,
            p1rz,
            bd.halfW,
            cx,
            cy,
            cz
          );
        } else if (bd.kind === "head") {
          bg360NavUpdateHeadGeometry(
            ch.geometry,
            bd.tip.x,
            bd.tip.y,
            bd.tip.z,
            bd.dir.x,
            bd.dir.y,
            bd.dir.z,
            bd.depth,
            bd.halfW,
            cx,
            cy,
            cz
          );
        } else if (bd.kind === "nadirViewRibbon") {
          if (!bg360NavCameraHorizDirXZ(bg360BillTmp)) continue;
          var ux = bg360BillTmp.x;
          var uz = bg360BillTmp.z;
          var oy = bd.centerY;
          var p0x = -ux * bd.tailLen;
          var p0z = -uz * bd.tailLen;
          var tipX = ux * (bd.fwdLen + bd.headDepth);
          var tipZ = uz * (bd.fwdLen + bd.headDepth);
          var p1rx = ux * bd.fwdLen;
          var p1ry = oy;
          var p1rz = uz * bd.fwdLen;
          if (
            bg360NavBillboardHeadBaseWorld(
              tipX,
              oy,
              tipZ,
              ux,
              0,
              uz,
              bd.headDepth,
              cx,
              cy,
              cz
            )
          ) {
            p1rx = bg360BillBase.x;
            p1ry = bg360BillBase.y;
            p1rz = bg360BillBase.z;
          }
          bg360NavUpdateRibbonGeometry(
            ch.geometry,
            p0x,
            oy,
            p0z,
            p1rx,
            p1ry,
            p1rz,
            bd.halfW,
            cx,
            cy,
            cz
          );
        } else if (bd.kind === "nadirViewHead") {
          if (!bg360NavCameraHorizDirXZ(bg360BillTmp)) continue;
          var ux2 = bg360BillTmp.x;
          var uz2 = bg360BillTmp.z;
          var oy2 = bd.centerY;
          var tipX2 = ux2 * (bd.fwdLen + bd.headDepth);
          var tipZ2 = uz2 * (bd.fwdLen + bd.headDepth);
          bg360NavUpdateHeadGeometry(
            ch.geometry,
            tipX2,
            oy2,
            tipZ2,
            ux2,
            0,
            uz2,
            bd.headDepth,
            bd.halfW,
            cx,
            cy,
            cz
          );
        }
      }
    }
    
    // Удаляет группу стрелок и освобождает геометрию/материалы.
    function disposeBg360NavArrowsGroup() {
      if (bg360Runtime.navArrowsGroup && bg360Runtime.scene) {
        bg360Runtime.scene.remove(bg360Runtime.navArrowsGroup);
      }
      var grp = bg360Runtime.navArrowsGroup;
      if (grp) {
        while (grp.children.length) {
          var ch = grp.children[0];
          grp.remove(ch);
          if (ch.geometry && typeof ch.geometry.dispose === "function") ch.geometry.dispose();
          if (ch.material && typeof ch.material.dispose === "function") ch.material.dispose();
        }
      }
      bg360Runtime.navArrowsGroup = null;
      bg360Runtime.navArrowsSignature = "";
    }
    
    // Снимает DOM-оверлей меток и WebGL-стрелки на время смены панорамы, чтобы не показывать направления новой сцены поверх старого фона или hold-слоя.
    function stripBg360NavigationOverlayPendingLoad() {
      disposeBg360NavArrowsGroup();
      if (!elBg360Marks) return;
      while (elBg360Marks.firstChild) elBg360Marks.removeChild(elBg360Marks.firstChild);
      elBg360Marks.classList.add("hidden");
      elBg360Marks.classList.remove("is-interactive", "is-webgl-nav-only");
    }
    
    // Возвращает true, пока для текущего loadSeq ещё не применена текстура к сфере после асинхронной загрузки CSS-пакета.
    function bg360ShouldDeferMarksUntilTextureReady() {
      if (typeof options.ensureRenderer === "function" && !options.ensureRenderer()) return false;
      var src = String(bg360Runtime.sourceSrc || "");
      if (!src) return false;
      var isPack = typeof options.isPanoramaPackPath === "function" && options.isPanoramaPackPath(src);
      if (!isPack && !bg360Runtime.isVideoSource) return false;
      return bg360Runtime.textureReadyLoadSeq !== bg360Runtime.loadSeq;
    }
    
    // Создаёт/обновляет меши стрелок к навигационным меткам и стрелку азимута на капе (вызывается при смене меток).
    function syncBg360NavArrowsFromMarks() {
      if (!window.THREE || !bg360Runtime.scene || !bg360Runtime.camera) return;
    
      var shouldShow =
        Array.isArray(bg360MarksRuntime.marks) &&
        bg360MarksRuntime.marks.some(function (m) {
          return bg360IsDirectionalMark(m);
        });
    
      if (!shouldShow) {
        disposeBg360NavArrowsGroup();
        return;
      }
    
      var sig = buildBg360NavArrowsSignature();
      if (bg360Runtime.navArrowsSignature === sig && bg360Runtime.navArrowsGroup) return;
    
      disposeBg360NavArrowsGroup();
    
      var cfg = readBg360NavConfig();
      var wpAnchor = bg360UvToWorldPointOnSphere(cfg.anchorU, cfg.anchorV, 500);
      if (!wpAnchor) {
        bg360Runtime.navArrowsSignature = sig;
        return;
      }
    
      var sphereR = 499 + getBg360CssNumber("--bg360-nav-cap-radius-bias", 1.35);
      var capLift = getBg360CssNumber("--bg360-nav-cap-y-lift", 5);
      var navGroup = new window.THREE.Group();
      navGroup.name = "bg360NavArrows";
      bg360Runtime.scene.add(navGroup);
      bg360Runtime.navArrowsGroup = navGroup;
      bg360Runtime.navArrowsSignature = sig;
    
      if (!bg360NavScratchA) bg360NavScratchA = new window.THREE.Vector3();
      if (!bg360NavScratchB) bg360NavScratchB = new window.THREE.Vector3();
      if (!bg360NavScratchDir) bg360NavScratchDir = new window.THREE.Vector3();
      if (!bg360NavScratchStart) bg360NavScratchStart = new window.THREE.Vector3();
      if (!bg360NavScratchEnd) bg360NavScratchEnd = new window.THREE.Vector3();
      if (!bg360NavScratchShaftEnd) bg360NavScratchShaftEnd = new window.THREE.Vector3();
    
      var arrowMatCommon = {
        color: 0xdcdcdc,
        opacity: cfg.lineOpacity,
        // Всегда transparent: навигационные стрелки рисуются как оверлей; без transparent они не попадают в transparent-проход и могут не видеться при depthTest:false.
        transparent: true,
        side: window.THREE.DoubleSide,
        // Стрелки — оверлей внутри сферы: без depthTest, чтобы их не съедала глубина панорамы.
        depthTest: false,
        depthWrite: false
      };
    
      bg360MarksRuntime.marks.forEach(function (mark) {
        if (!bg360IsDirectionalMark(mark)) return;
        var wMark = bg360UvToWorldPointOnSphere(mark.x, mark.y, 500);
        if (!wMark) return;
    
        bg360NavScratchA.set(wpAnchor.x, wpAnchor.y, wpAnchor.z);
        bg360NavScratchB.set(wMark.x, wMark.y, wMark.z);
        bg360NavScratchDir.subVectors(bg360NavScratchB, bg360NavScratchA);
        var chordLen = bg360NavScratchDir.length();
        if (chordLen < 1e-3) return;
        bg360NavScratchDir.multiplyScalar(1 / chordLen);
    
        var sm = Math.min(cfg.chordMarginStart, chordLen * 0.4);
        var em = Math.min(cfg.chordMarginEnd, chordLen * 0.4);
        bg360NavScratchStart.copy(bg360NavScratchA).addScaledVector(bg360NavScratchDir, sm);
        bg360NavScratchEnd.copy(bg360NavScratchB).addScaledVector(bg360NavScratchDir, -em);
        var segLen = bg360NavScratchStart.distanceTo(bg360NavScratchEnd);
        if (segLen < cfg.headDepth + 1) return;
    
        bg360NavScratchShaftEnd.copy(bg360NavScratchEnd).addScaledVector(bg360NavScratchDir, -cfg.headDepth);
        var shaftLen = bg360NavScratchStart.distanceTo(bg360NavScratchShaftEnd);
        if (shaftLen < 1) return;
    
        var arrowMatRibbon = new window.THREE.MeshBasicMaterial(arrowMatCommon);
        var arrowMatHead = new window.THREE.MeshBasicMaterial(arrowMatCommon);
        arrowMatRibbon.color = new window.THREE.Color(0xdcdcdc);
        arrowMatHead.color = new window.THREE.Color(0xdcdcdc);
    
        var ribbonGeom = new window.THREE.BufferGeometry();
        var ribbonMesh = new window.THREE.Mesh(ribbonGeom, arrowMatRibbon);
        /* Ниже капы надира (renderOrder капы 200+): одна ветка transparent, меньший порядок — раньше. */
        ribbonMesh.renderOrder = 10;
        // Без позиций в геометрии bounding sphere некорректен и frustum culling может скрыть меш до первого billboard-обновления.
        ribbonMesh.frustumCulled = false;
        ribbonMesh.userData.bg360Billboard = {
          kind: "ribbon",
          p0: { x: bg360NavScratchStart.x, y: bg360NavScratchStart.y, z: bg360NavScratchStart.z },
          p1: {
            x: bg360NavScratchShaftEnd.x,
            y: bg360NavScratchShaftEnd.y,
            z: bg360NavScratchShaftEnd.z
          },
          halfW: cfg.ribbonHalfW,
          join: {
            tip: { x: bg360NavScratchEnd.x, y: bg360NavScratchEnd.y, z: bg360NavScratchEnd.z },
            dir: { x: bg360NavScratchDir.x, y: bg360NavScratchDir.y, z: bg360NavScratchDir.z },
            depth: cfg.headDepth
          }
        };
        navGroup.add(ribbonMesh);
    
        var headGeom = new window.THREE.BufferGeometry();
        var headMesh = new window.THREE.Mesh(headGeom, arrowMatHead);
        headMesh.renderOrder = 11;
        headMesh.frustumCulled = false;
        headMesh.userData.bg360Billboard = {
          kind: "head",
          tip: { x: bg360NavScratchEnd.x, y: bg360NavScratchEnd.y, z: bg360NavScratchEnd.z },
          dir: { x: bg360NavScratchDir.x, y: bg360NavScratchDir.y, z: bg360NavScratchDir.z },
          depth: cfg.headDepth,
          halfW: cfg.headHalfW
        };
        navGroup.add(headMesh);
      });
    
      if (cfg.nadirArrowEnabled) {
        var nvPaint = cfg.nadirArrowPaint || { color: 0x96989e, opacity: 1 };
        var nvOpacityCombined = clampNumber(cfg.nadirArrowOpacity * nvPaint.opacity, 0.05, 1);
        var nvMatOpts = {
          color: nvPaint.color,
          opacity: nvOpacityCombined,
          transparent: true,
          side: window.THREE.DoubleSide,
          // Стрелка на круге должна быть видна поверх капы и текстуры панорамы.
          depthTest: false,
          depthWrite: false
        };
        var nvMatRibbon = new window.THREE.MeshBasicMaterial(nvMatOpts);
        var nvMatHead = new window.THREE.MeshBasicMaterial(nvMatOpts);
        nvMatRibbon.color = new window.THREE.Color(nvPaint.color);
        nvMatHead.color = new window.THREE.Color(nvPaint.color);
        var nvCenterY = -sphereR + capLift + cfg.nadirCenterLift;
        var nvRibbonGeom = new window.THREE.BufferGeometry();
        var nvRibbonMesh = new window.THREE.Mesh(nvRibbonGeom, nvMatRibbon);
        nvRibbonMesh.renderOrder = 210;
        nvRibbonMesh.frustumCulled = false;
        nvRibbonMesh.userData.bg360Billboard = {
          kind: "nadirViewRibbon",
          centerY: nvCenterY,
          tailLen: cfg.nadirTailHalf,
          fwdLen: cfg.nadirFwdHalf,
          headDepth: cfg.nadirHeadDepth,
          halfW: cfg.nadirRibbonHalfW
        };
        navGroup.add(nvRibbonMesh);
    
        var nvHeadGeom = new window.THREE.BufferGeometry();
        var nvHeadMesh = new window.THREE.Mesh(nvHeadGeom, nvMatHead);
        nvHeadMesh.renderOrder = 211;
        nvHeadMesh.frustumCulled = false;
        nvHeadMesh.userData.bg360Billboard = {
          kind: "nadirViewHead",
          centerY: nvCenterY,
          fwdLen: cfg.nadirFwdHalf,
          headDepth: cfg.nadirHeadDepth,
          halfW: cfg.nadirHeadHalfW
        };
        navGroup.add(nvHeadMesh);
      }
    
      writeVerbose("[bg360-nav] arrows rebuilt: meshes=" + navGroup.children.length +
        " marks=" + (Array.isArray(bg360MarksRuntime.marks) ? bg360MarksRuntime.marks.length : 0) +
        " anchorUV=" + cfg.anchorU.toFixed(3) + "," + cfg.anchorV.toFixed(3) +
        " nadirArrow=" + (cfg.nadirArrowEnabled ? "on" : "off"));
    }
    
    // Запускает walk360: показывает панель, включает hit-test меток и блокирует обычный next.

    // Полностью очищает DOM и WebGL-ресурсы меток при окончательном уходе со страницы.
    function dispose() {
      if (disposed) return;
      disposeBg360OriginCoverMesh();
      disposeBg360NavArrowsGroup();
      bg360NavArrowHitCache = [];
      bg360MarksRuntime.bgId = null;
      bg360MarksRuntime.marks = [];
      bg360MarksRuntime.lines = false;
      bg360MarksRuntime.locked = false;
      bg360MarksRuntime.interactive = false;
      if (elBg360Marks) {
        while (elBg360Marks.firstChild) elBg360Marks.removeChild(elBg360Marks.firstChild);
        elBg360Marks.classList.add("hidden");
        elBg360Marks.classList.remove("is-interactive", "is-webgl-nav-only", "has-photo-marks");
      }
      disposed = true;
    }

    return Object.freeze({
      state: bg360MarksRuntime,
      isSceneTargetMark: bg360IsSceneTargetMark,
      getCompassMarkLabel: bg360GetCompassMarkLabel,
      isViewMark: bg360IsViewMark,
      isPhotoMark: bg360IsPhotoMark,
      normalizePhotoImages: normalizeBg360PhotoImages,
      hasPhotoMarks: bg360MarksHasPhotoMarks,
      findMarkById: findBg360MarkById,
      getPhotoMarkLabel: bg360GetPhotoMarkLabel,
      isDirectionalMark: bg360IsDirectionalMark,
      hasAnyDirectional: bg360MarksHasAnyDirectional,
      hasAnyCompassMark: bg360MarksHasAnyCompassMark,
      activateMarkById: activateBg360MarkById,
      render: renderBg360Marks,
      uvToDirection: bg360UvToDirection,
      updateProjection: updateBg360MarksProjection,
      disposeOriginCover: disposeBg360OriginCoverMesh,
      syncOriginCover: syncBg360OriginCoverMesh,
      updateCompassRotation: updateBg360CompassRotation,
      updateEdgeHints: updateBg360NavEdgeHints,
      updateArrowHitCache: updateBg360NavArrowHitCache,
      pickArrowMarkId: pickBg360NavArrowMarkId,
      updateBillboardMeshes: updateBg360NavBillboardMeshes,
      disposeNavArrows: disposeBg360NavArrowsGroup,
      stripPendingLoad: stripBg360NavigationOverlayPendingLoad,
      shouldDeferUntilTextureReady: bg360ShouldDeferMarksUntilTextureReady,
      syncNavArrows: syncBg360NavArrowsFromMarks,
      distancePointToSegment2d: bg360DistPointToSegment2d,
      wrapCompassLabelText: wrapBg360CompassLabelText,
      dispose: dispose
    });
  }

  return {
    createPanoramaMarksController: createPanoramaMarksController
  };
});
