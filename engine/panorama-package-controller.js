// Экспортирует безопасную загрузку декларативных CSS-пакетов 360 и фоновую проверку их содержимого.
(function(root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VN_PANORAMA_PACKAGE_CONTROLLER = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createPanoramaPackageControllerModule() {
  "use strict";

  // Лимиты совпадают с редактором и конвертером: они отсекают вредные пакеты, сохраняя большие панорамы будущих камер.
  var CSS_PACK_MAX_ENCODED_LENGTH = 128 * 1024 * 1024;
  var CSS_PACK_MAX_DECODED_SIZE = 96 * 1024 * 1024;
  var CSS_PACK_MAX_CHUNKS = 4096;
  var CSS_PACK_MAX_CHUNK_LENGTH = 32 * 1024;
  var CSS_PACK_MAX_SOURCE_LENGTH = CSS_PACK_MAX_ENCODED_LENGTH + 2 * 1024 * 1024;
  var CSS_DECODE_BATCH_LENGTH = 4 * 1024 * 1024;
  var CSS_IMAGE_MAX_WIDTH = 20000;
  var CSS_IMAGE_MAX_HEIGHT = 15000;
  var CSS_IMAGE_MAX_PIXELS = 300000000;
  var CSS_IMAGE_HEADER_MAX_BYTES = 4 * 1024 * 1024;
  var STATS_DESKTOP_CONCURRENCY = 4;
  var STATS_PHONE_CONCURRENCY = 2;

  // Проверяет только декларативное расширение пакета; исполняемые JS-варианты намеренно не поддерживаются.
  function isCssPackPath(path) {
    return /-360(?:-[a-z0-9_-]+)?\.css(\?.*)?$/i.test(String(path || ""));
  }

  // Читает строго двойную строку custom property; CSS-escape и вычисляемые выражения не считаются данными пакета.
  function readCssQuotedValue(computedStyle, propertyName) {
    var raw = String(computedStyle.getPropertyValue(propertyName) || "").trim();
    var match = raw.match(/^"([^"\\]*)"$/);
    if (!match) throw new Error("CSS-пакет не содержит корректное свойство " + propertyName + ".");
    return match[1];
  }

  // Разбирает единственный декларативный #vn360-pack и отклоняет импорты, сторонние правила, дубли и CSS-escape.
  function createCssPropertyReader(cssSource) {
    var source = String(cssSource || "").replace(/^\uFEFF/, "");
    if (!source || source.length > CSS_PACK_MAX_SOURCE_LENGTH) {
      throw new Error("CSS-пакет отсутствует или превышает допустимый размер исходного текста.");
    }
    var sourceWithoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
    if (/\/\*|\*\//.test(sourceWithoutComments)) {
      throw new Error("CSS-пакет содержит незавершённый комментарий.");
    }
    var ruleMatch = sourceWithoutComments.trim().match(/^#vn360-pack\s*\{([\s\S]*)\}$/);
    if (!ruleMatch) {
      throw new Error("CSS-пакет должен содержать только правило #vn360-pack без @import и сторонних стилей.");
    }

    var declarationBody = ruleMatch[1];
    var declarationPattern = /(--vn360-(?:schema|mode|mime|width|height|size|quality|chunk-count|data-(?:0|[1-9][0-9]*)))\s*:\s*"([^"\\]*)"\s*;/g;
    var properties = Object.create(null);
    var cursor = 0;
    var propertyCount = 0;
    var declarationMatch;
    while ((declarationMatch = declarationPattern.exec(declarationBody))) {
      if (!/^\s*$/.test(declarationBody.slice(cursor, declarationMatch.index))) {
        throw new Error("CSS-пакет содержит недопустимую декларацию.");
      }
      var propertyName = declarationMatch[1];
      if (Object.prototype.hasOwnProperty.call(properties, propertyName)) {
        throw new Error("CSS-пакет содержит повторное свойство " + propertyName + ".");
      }
      propertyCount++;
      if (propertyCount > CSS_PACK_MAX_CHUNKS + 8) {
        throw new Error("CSS-пакет содержит слишком много свойств.");
      }
      properties[propertyName] = declarationMatch[2];
      cursor = declarationPattern.lastIndex;
    }
    if (!/^\s*$/.test(declarationBody.slice(cursor))) {
      throw new Error("CSS-пакет содержит недопустимую декларацию.");
    }

    var requiredProperties = ["schema", "mode", "mime", "width", "height", "size", "quality", "chunk-count"];
    for (var requiredIndex = 0; requiredIndex < requiredProperties.length; requiredIndex++) {
      if (!Object.prototype.hasOwnProperty.call(properties, "--vn360-" + requiredProperties[requiredIndex])) {
        throw new Error("CSS-пакет не содержит обязательные метаданные.");
      }
    }
    var declaredChunkCount = Number(properties["--vn360-chunk-count"]);
    if (!Number.isInteger(declaredChunkCount) || declaredChunkCount < 1 || declaredChunkCount > CSS_PACK_MAX_CHUNKS) {
      throw new Error("Некорректное количество частей CSS-пакета 360.");
    }
    for (var dataIndex = 0; dataIndex < declaredChunkCount; dataIndex++) {
      if (!Object.prototype.hasOwnProperty.call(properties, "--vn360-data-" + dataIndex)) {
        throw new Error("CSS-пакет содержит неполный набор частей.");
      }
    }
    if (propertyCount !== requiredProperties.length + declaredChunkCount) {
      throw new Error("CSS-пакет содержит части вне объявленного диапазона.");
    }

    return {
      getPropertyValue: function(propertyName) {
        return Object.prototype.hasOwnProperty.call(properties, propertyName)
          ? '"' + properties[propertyName] + '"'
          : "";
      }
    };
  }

  // Декодирует выровненную часть base64 и сохраняет начало файла для проверки сигнатуры без второго большого буфера.
  function appendDecodedPart(encodedPart, binaryParts, signatureBytes, atobFn) {
    if (!encodedPart) return;
    var binary = atobFn(encodedPart);
    var bytes = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index++) {
      var byteValue = binary.charCodeAt(index);
      bytes[index] = byteValue;
      if (signatureBytes.length < 12) signatureBytes.push(byteValue);
    }
    binaryParts.push(bytes);
  }

  // Проверяет JPEG, PNG и WebP по magic bytes до передачи недоверенных данных браузерному декодеру.
  function isImageSignatureValid(mimeType, bytes) {
    if (mimeType === "image/jpeg") {
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (mimeType === "image/png") {
      return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
        bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    }
    if (mimeType === "image/webp") {
      return bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    }
    return false;
  }

  // Возвращает нужное начало изображения, не объединяя весь сжатый файл в новый большой массив.
  function collectImageHeader(binaryParts, maxLength) {
    var availableLength = 0;
    for (var index = 0; index < binaryParts.length; index++) availableLength += binaryParts[index].length;
    var headerLength = Math.min(availableLength, maxLength);
    var header = new Uint8Array(headerLength);
    var offset = 0;
    for (var partIndex = 0; partIndex < binaryParts.length && offset < headerLength; partIndex++) {
      var part = binaryParts[partIndex];
      var copyLength = Math.min(part.length, headerLength - offset);
      header.set(part.subarray(0, copyLength), offset);
      offset += copyLength;
    }
    return header;
  }

  // Читает 32-битное число с прямым порядком байтов без знакового преобразования JavaScript.
  function readUint32Be(bytes, offset) {
    return bytes[offset] * 0x1000000 + bytes[offset + 1] * 0x10000 + bytes[offset + 2] * 0x100 + bytes[offset + 3];
  }

  // Находит фактические размеры JPEG по SOF-маркеру до запуска декодера изображения.
  function readJpegDimensions(header) {
    var offset = 2;
    while (offset + 1 < header.length) {
      while (offset < header.length && header[offset] !== 0xff) offset++;
      while (offset < header.length && header[offset] === 0xff) offset++;
      if (offset >= header.length) break;
      var marker = header[offset++];
      if (marker === 0x00 || marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (marker === 0xd9 || marker === 0xda || offset + 1 >= header.length) break;
      var segmentLength = header[offset] * 0x100 + header[offset + 1];
      if (segmentLength < 2 || offset + segmentLength > header.length) break;
      var isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
      if (isStartOfFrame) {
        if (segmentLength < 7) break;
        return {
          width: header[offset + 5] * 0x100 + header[offset + 6],
          height: header[offset + 3] * 0x100 + header[offset + 4]
        };
      }
      offset += segmentLength;
    }
    throw new Error("Не удалось определить размер JPEG до запуска декодера изображения.");
  }

  // Извлекает размеры из обязательного заголовка PNG, JPEG или WebP до создания Blob URL.
  function readImageDimensions(mimeType, binaryParts) {
    var header = collectImageHeader(binaryParts, mimeType === "image/jpeg" ? CSS_IMAGE_HEADER_MAX_BYTES : 30);
    if (mimeType === "image/png") {
      if (header.length < 24 || header[12] !== 0x49 || header[13] !== 0x48 || header[14] !== 0x44 || header[15] !== 0x52) {
        throw new Error("PNG в CSS-пакете не содержит корректный заголовок IHDR.");
      }
      return { width: readUint32Be(header, 16), height: readUint32Be(header, 20) };
    }
    if (mimeType === "image/jpeg") return readJpegDimensions(header);
    if (mimeType === "image/webp") {
      if (header.length < 30) throw new Error("WebP в CSS-пакете содержит обрезанный заголовок.");
      var chunkType = String.fromCharCode(header[12], header[13], header[14], header[15]);
      if (chunkType === "VP8X") {
        return {
          width: 1 + header[24] + header[25] * 0x100 + header[26] * 0x10000,
          height: 1 + header[27] + header[28] * 0x100 + header[29] * 0x10000
        };
      }
      if (chunkType === "VP8L" && header[20] === 0x2f) {
        return {
          width: 1 + header[21] + (header[22] & 0x3f) * 0x100,
          height: 1 + ((header[22] & 0xc0) >> 6) + header[23] * 4 + (header[24] & 0x0f) * 0x400
        };
      }
      if (chunkType === "VP8 " && header[23] === 0x9d && header[24] === 0x01 && header[25] === 0x2a) {
        return {
          width: (header[26] + header[27] * 0x100) & 0x3fff,
          height: (header[28] + header[29] * 0x100) & 0x3fff
        };
      }
      throw new Error("WebP в CSS-пакете содержит неподдерживаемый заголовок изображения.");
    }
    throw new Error("CSS-пакет содержит неподдерживаемый формат изображения.");
  }

  // Ограничивает стороны и площадь кадра единообразно для normal и mobile.
  function validateImageDimensions(width, height) {
    if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
      throw new Error("CSS-пакет не содержит корректный размер панорамы.");
    }
    if (width > CSS_IMAGE_MAX_WIDTH || height > CSS_IMAGE_MAX_HEIGHT || width * height > CSS_IMAGE_MAX_PIXELS) {
      throw new Error("Размер CSS-панорамы " + width + "x" + height + " превышает предел 20000x15000 px или 300000000 пикселей.");
    }
  }

  // Извлекает известные свойства пакета и собирает Blob порциями без выполнения кода.
  function extractCssPackBlob(computedStyle, runtimeOptions) {
    runtimeOptions = runtimeOptions || {};
    var atobFn = runtimeOptions.atob || (typeof atob === "function" ? atob : null);
    var BlobConstructor = runtimeOptions.Blob || (typeof Blob === "function" ? Blob : null);
    if (!atobFn || !BlobConstructor) throw new Error("Браузер не поддерживает декодирование CSS-пакета.");

    var schema = readCssQuotedValue(computedStyle, "--vn360-schema");
    if (schema !== "vn360-css-pack-v1") throw new Error("Неподдерживаемая версия CSS-пакета 360.");
    var mode = readCssQuotedValue(computedStyle, "--vn360-mode");
    if (mode !== "normal" && mode !== "mobile") throw new Error("Некорректный режим CSS-пакета 360.");
    var mimeType = readCssQuotedValue(computedStyle, "--vn360-mime").toLowerCase();
    if (!/^image\/(?:jpeg|png|webp)$/.test(mimeType)) throw new Error("CSS-пакет содержит неподдерживаемый формат изображения.");

    var chunkCount = Number(readCssQuotedValue(computedStyle, "--vn360-chunk-count"));
    if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > CSS_PACK_MAX_CHUNKS) {
      throw new Error("Некорректное количество частей CSS-пакета 360.");
    }
    var declaredWidth = Number(readCssQuotedValue(computedStyle, "--vn360-width"));
    var declaredHeight = Number(readCssQuotedValue(computedStyle, "--vn360-height"));
    var declaredSize = Number(readCssQuotedValue(computedStyle, "--vn360-size"));
    validateImageDimensions(declaredWidth, declaredHeight);
    if (!Number.isInteger(declaredSize) || declaredSize < 1 || declaredSize > CSS_PACK_MAX_DECODED_SIZE) {
      throw new Error("CSS-пакет содержит недопустимый размер изображения.");
    }
    var maxTextureSize = Number(runtimeOptions.maxTextureSize) || 0;
    if (maxTextureSize > 0 && (declaredWidth > maxTextureSize || declaredHeight > maxTextureSize)) {
      throw new Error("Размер CSS-панорамы " + declaredWidth + "x" + declaredHeight + " превышает лимит WebGL " + maxTextureSize + " px.");
    }

    var binaryParts = [];
    var signatureBytes = [];
    var pendingBase64 = "";
    var encodedLength = 0;
    for (var index = 0; index < chunkCount; index++) {
      var cssChunk = readCssQuotedValue(computedStyle, "--vn360-data-" + index);
      if (cssChunk.length > CSS_PACK_MAX_CHUNK_LENGTH) throw new Error("Часть CSS-пакета превышает допустимый размер.");
      if (index === 0) {
        var prefixMatch = cssChunk.match(/^data:(image\/(?:jpeg|png|webp));base64,(.*)$/i);
        if (!prefixMatch) throw new Error("Первая часть CSS-пакета не содержит ожидаемый data:image base64.");
        if (prefixMatch[1].toLowerCase() !== mimeType) throw new Error("MIME CSS-пакета не совпадает с данными изображения.");
        cssChunk = prefixMatch[2];
      }
      if (!/^[a-z0-9+/]*={0,2}$/i.test(cssChunk) || (index < chunkCount - 1 && cssChunk.indexOf("=") !== -1)) {
        throw new Error("CSS-пакет содержит недопустимые символы base64.");
      }
      encodedLength += cssChunk.length;
      if (encodedLength > CSS_PACK_MAX_ENCODED_LENGTH) throw new Error("CSS-пакет превышает допустимый размер.");
      pendingBase64 += cssChunk;
      if (index < chunkCount - 1 && pendingBase64.length >= CSS_DECODE_BATCH_LENGTH) {
        var readyLength = pendingBase64.length - (pendingBase64.length % 4);
        appendDecodedPart(pendingBase64.slice(0, readyLength), binaryParts, signatureBytes, atobFn);
        pendingBase64 = pendingBase64.slice(readyLength);
      }
    }

    if (!pendingBase64 || pendingBase64.length % 4 !== 0) throw new Error("CSS-пакет содержит обрезанные данные base64.");
    appendDecodedPart(pendingBase64, binaryParts, signatureBytes, atobFn);
    if (!isImageSignatureValid(mimeType, signatureBytes)) throw new Error("Сигнатура изображения в CSS-пакете не совпадает с MIME.");

    var decodedSize = 0;
    for (var partIndex = 0; partIndex < binaryParts.length; partIndex++) decodedSize += binaryParts[partIndex].length;
    if (decodedSize !== declaredSize) throw new Error("Размер изображения в CSS-пакете не совпадает с метаданными.");
    var actualDimensions = readImageDimensions(mimeType, binaryParts);
    validateImageDimensions(actualDimensions.width, actualDimensions.height);
    if (actualDimensions.width !== declaredWidth || actualDimensions.height !== declaredHeight) {
      throw new Error("Размер изображения в заголовке " + actualDimensions.width + "x" + actualDimensions.height +
        " не совпадает с метаданными CSS-пакета " + declaredWidth + "x" + declaredHeight + ".");
    }
    var blob = new BlobConstructor(binaryParts, { type: mimeType });
    return {
      blob: blob,
      meta: {
        schema: schema,
        mode: mode,
        type: mimeType,
        size: blob.size,
        width: declaredWidth,
        height: declaredHeight,
        quality: readCssQuotedValue(computedStyle, "--vn360-quality"),
        chunkCount: chunkCount,
        encodedLength: encodedLength
      }
    };
  }

  // Создаёт контроллер с явно переданными DOM, политикой путей, качеством и UI-callback.
  function createPanoramaPackageController(options) {
    options = options || {};
    var windowRef = options.window || (typeof window !== "undefined" ? window : null);
    var documentRef = options.document || (typeof document !== "undefined" ? document : null);
    var URLRef = options.URL || (windowRef && windowRef.URL) || (typeof URL !== "undefined" ? URL : null);
    var BlobConstructor = options.Blob || (windowRef && windowRef.Blob) || (typeof Blob === "function" ? Blob : null);
    var atobFn = options.atob || (windowRef && windowRef.atob && windowRef.atob.bind(windowRef)) || (typeof atob === "function" ? atob : null);
    var ImageConstructor = options.Image || (windowRef && windowRef.Image) || (typeof Image === "function" ? Image : null);
    var setTimeoutFn = options.setTimeout || setTimeout;
    var clearTimeoutFn = options.clearTimeout || clearTimeout;
    var cssPackState = Object.create(null);
    var inspectionState = {
      entries: Object.create(null),
      queue: [],
      activeKeys: [],
      activeCount: 0,
      timerId: null,
      refreshTimerId: null,
      refreshScheduled: false
    };
    var activeFrames = [];
    var activeResources = [];
    var trackedTimers = [];
    var abortControllers = [];
    var disposed = false;

    // Планирует принадлежащий контроллеру таймер, чтобы dispose не оставлял фоновые callback.
    function schedule(callback, delay) {
      var timerId = setTimeoutFn(function runScheduledPanoramaPackageTask() {
        var index = trackedTimers.indexOf(timerId);
        if (index >= 0) trackedTimers.splice(index, 1);
        if (!disposed) callback();
      }, delay);
      trackedTimers.push(timerId);
      return timerId;
    }

    // Снимает таймер и удаляет его из lifecycle-реестра.
    function cancelTimer(timerId) {
      if (timerId === null || timerId === undefined) return;
      clearTimeoutFn(timerId);
      var index = trackedTimers.indexOf(timerId);
      if (index >= 0) trackedTimers.splice(index, 1);
    }

    // Нормализует URL только через переданную движком политику сравнения.
    function normalizeUrl(value) {
      return typeof options.normalizeUrl === "function" ? options.normalizeUrl(value) : String(value || "");
    }

    // Очищает путь для диагностики, не раскрывая query, hash или встроенные данные.
    function sanitizeResource(value) {
      return typeof options.sanitizeResource === "function" ? options.sanitizeResource(value) : String(value || "");
    }

    // Выбирает фактическое качество через общую политику движка.
    function resolveEffectiveQuality(quality) {
      if (typeof options.resolveEffectiveQuality === "function") return options.resolveEffectiveQuality(quality);
      return String(quality || "auto").toLowerCase() === "mobile" ? "mobile" : "normal";
    }

    // Разрешает сценарный путь только через переданную общую политику ресурсов.
    function resolveAssetUrl(sourceUrl) {
      return typeof options.resolveAssetUrl === "function" ? options.resolveAssetUrl(sourceUrl, "panorama") : String(sourceUrl || "");
    }

    // Выбирает normal или mobile CSS без допуска сторонних расширений.
    function getCssUrl(sourceUrl, quality) {
      var normalized = resolveAssetUrl(sourceUrl);
      var normalizedQuality = resolveEffectiveQuality(quality);
      if (!isCssPackPath(normalized)) return "";
      if (normalizedQuality === "normal" && /-360-mobile\.css(\?.*)?$/i.test(normalized)) {
        return normalized.replace(/-360-mobile\.css(\?.*)?$/i, "-360.css$1");
      }
      if (normalizedQuality === "mobile" && /-360\.css(\?.*)?$/i.test(normalized)) {
        return normalized.replace(/-360\.css(\?.*)?$/i, "-360-mobile.css$1");
      }
      return normalized;
    }

    // Возвращает текущий аппаратный предел WebGL без передачи renderer внутрь контроллера.
    function getMaxTextureSize() {
      return typeof options.getMaxTextureSize === "function" ? Number(options.getMaxTextureSize()) || 0 : 0;
    }

    // Извлекает пакет с учётом текущего аппаратного ограничения WebGL.
    function extractPack(computedStyle) {
      return extractCssPackBlob(computedStyle, {
        atob: atobFn,
        Blob: BlobConstructor,
        maxTextureSize: getMaxTextureSize()
      });
    }

    // Регистрирует скрытый iframe, чтобы dispose мог удалить незавершённую изолированную загрузку.
    function trackFrame(frame) {
      activeFrames.push(frame);
      return frame;
    }

    // Снимает iframe с lifecycle-реестра и удаляет его из документа.
    function removeFrame(frame) {
      var index = activeFrames.indexOf(frame);
      if (index >= 0) activeFrames.splice(index, 1);
      if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
    }

    // Загружает CSS как текстовый sandbox-документ и передаёт его строгому парсеру без применения правил.
    function readCssPackFromTextDocument(cssUrl) {
      return new Promise(function(resolve, reject) {
        if (!documentRef || !documentRef.body) {
          reject(new Error("Документ не готов для загрузки CSS-пакета: " + cssUrl));
          return;
        }
        var settled = false;
        var timeoutId = null;
        var frame = trackFrame(documentRef.createElement("iframe"));
        frame.hidden = true;
        frame.setAttribute("aria-hidden", "true");
        frame.setAttribute("sandbox", "allow-same-origin");
        frame.setAttribute("referrerpolicy", "no-referrer");
        frame.setAttribute("data-bg360-css-pack-loader", cssUrl);

        // Завершает ровно один исход и обязательно удаляет временный iframe.
        function finish(error, result) {
          if (settled) return;
          settled = true;
          cancelTimer(timeoutId);
          frame.onload = null;
          frame.onerror = null;
          removeFrame(frame);
          if (error) reject(error);
          else resolve(result);
        }

        frame.onload = function() {
          if (settled) return;
          try {
            var frameDocument;
            try {
              frameDocument = frame.contentDocument;
            } catch (accessCause) {
              var deniedAccessError = new Error("Браузер не разрешил прочитать локальный CSS-пакет как текст: " + cssUrl);
              deniedAccessError.code = "VN360_CSS_TEXT_ACCESS";
              throw deniedAccessError;
            }
            if (!frameDocument || !frameDocument.body) {
              var accessError = new Error("Браузер не разрешил прочитать локальный CSS-пакет как текст: " + cssUrl);
              accessError.code = "VN360_CSS_TEXT_ACCESS";
              throw accessError;
            }
            if (frameDocument.contentType !== "text/css") {
              throw new Error("Локальный ресурс не является CSS-пакетом: " + cssUrl);
            }
            var cssSource;
            try {
              cssSource = frameDocument.body.textContent || "";
            } catch (bodyAccessCause) {
              var deniedBodyError = new Error("Браузер не разрешил прочитать локальный CSS-пакет как текст: " + cssUrl);
              deniedBodyError.code = "VN360_CSS_TEXT_ACCESS";
              throw deniedBodyError;
            }
            finish(null, extractPack(createCssPropertyReader(cssSource)));
          } catch (error) {
            finish(error);
          }
        };
        frame.onerror = function() {
          finish(new Error("Не удалось загрузить CSS-пакет: " + cssUrl));
        };
        timeoutId = schedule(function() {
          finish(new Error("Истекло время загрузки CSS-пакета: " + cssUrl));
        }, 30000);
        frame.src = cssUrl;
        documentRef.body.appendChild(frame);
      });
    }

    // Создаёт непредсказуемый nonce для единственного локального link совместимого file:// пути Chromium.
    function createStyleNonce() {
      if (!windowRef || !windowRef.crypto || typeof windowRef.crypto.getRandomValues !== "function") {
        throw new Error("Браузер не поддерживает безопасный генератор для загрузки CSS-пакета.");
      }
      var bytes = new Uint8Array(16);
      windowRef.crypto.getRandomValues(bytes);
      var nonce = "";
      for (var index = 0; index < bytes.length; index++) {
        nonce += (bytes[index] < 16 ? "0" : "") + bytes[index].toString(16);
      }
      return nonce;
    }

    // Читает file:// CSS через изолированный link только при запрете текстового доступа; CSP блокирует побочные ресурсы.
    function readCssPackFromIsolatedStyle(cssUrl) {
      return new Promise(function(resolve, reject) {
        if (!documentRef || !documentRef.body) {
          reject(new Error("Документ не готов для загрузки CSS-пакета: " + cssUrl));
          return;
        }
        var settled = false;
        var initialized = false;
        var timeoutId = null;
        var styleNonce = createStyleNonce();
        var frame = trackFrame(documentRef.createElement("iframe"));
        frame.hidden = true;
        frame.setAttribute("aria-hidden", "true");
        frame.setAttribute("sandbox", "allow-same-origin");
        frame.setAttribute("referrerpolicy", "no-referrer");
        frame.setAttribute("data-bg360-css-pack-loader", cssUrl);
        frame.srcdoc = "<!doctype html><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'nonce-" + styleNonce + "'; style-src-attr 'none'; script-src 'none'; img-src 'none'; font-src 'none'; media-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'\"><div id=\"vn360-pack\"></div>";

        // Завершает совместимый путь и не оставляет link вместе с iframe в DOM.
        function finish(error, result) {
          if (settled) return;
          settled = true;
          cancelTimer(timeoutId);
          frame.onload = null;
          frame.onerror = null;
          removeFrame(frame);
          if (error) reject(error);
          else resolve(result);
        }

        frame.onload = function() {
          if (initialized || settled) return;
          initialized = true;
          try {
            var frameDocument = frame.contentDocument;
            var marker = frameDocument && frameDocument.getElementById("vn360-pack");
            if (!frameDocument || !marker) throw new Error("Не удалось создать изолированный загрузчик CSS-пакета.");
            var link = frameDocument.createElement("link");
            link.rel = "stylesheet";
            link.nonce = styleNonce;
            link.referrerPolicy = "no-referrer";
            link.onload = function() {
              try {
                finish(null, extractPack(frame.contentWindow.getComputedStyle(marker)));
              } catch (error) {
                finish(error);
              }
            };
            link.onerror = function() {
              finish(new Error("Не удалось загрузить CSS-пакет: " + cssUrl));
            };
            link.href = cssUrl;
            frameDocument.head.appendChild(link);
          } catch (error) {
            finish(error);
          }
        };
        timeoutId = schedule(function() {
          finish(new Error("Истекло время загрузки CSS-пакета: " + cssUrl));
        }, 30000);
        documentRef.body.appendChild(frame);
      });
    }

    // Выбирает строгий текстовый путь; CSP-link разрешён лишь для локального file:// с закрытым origin Chromium.
    function readCssPack(cssUrl) {
      if (typeof options.readCssPack === "function") return options.readCssPack(cssUrl, extractPack);
      return readCssPackFromTextDocument(cssUrl).catch(function(error) {
        var protocol = windowRef && windowRef.location ? windowRef.location.protocol : "";
        if (!error || error.code !== "VN360_CSS_TEXT_ACCESS" || protocol !== "file:") throw error;
        return readCssPackFromIsolatedStyle(cssUrl);
      });
    }

    // Запускает одну загрузку на URL и будит всех ожидающих; ошибка остаётся до перезагрузки страницы.
    function ensureLoaded(sourceUrl, quality, onReady) {
      if (disposed) return "none";
      var cssUrl = getCssUrl(sourceUrl, quality);
      if (!cssUrl) return "none";
      var state = cssPackState[cssUrl];
      if (state && state.status === "loaded") return "ready";
      if (state && state.status === "loading") {
        if (typeof onReady === "function") state.waiters.push(onReady);
        return "loading";
      }
      if (state && state.status === "error") return "none";

      state = cssPackState[cssUrl] = {
        status: "loading",
        waiters: typeof onReady === "function" ? [onReady] : [],
        blob: null,
        meta: null,
        errorMessage: "",
        refs: 0
      };
      readCssPack(cssUrl).then(function(pack) {
        var entry = cssPackState[cssUrl];
        if (disposed || !entry || entry !== state) return;
        entry.status = "loaded";
        entry.blob = pack.blob;
        entry.meta = pack.meta;
        entry.errorMessage = "";
        var waiters = entry.waiters.slice();
        entry.waiters.length = 0;
        for (var index = 0; index < waiters.length; index++) {
          try { waiters[index](true); } catch (error) {}
        }
        schedule(function() {
          var current = cssPackState[cssUrl];
          if (current === entry && current.status === "loaded" && current.refs === 0) {
            current.blob = null;
            current.meta = null;
            delete cssPackState[cssUrl];
          }
        }, 0);
      }).catch(function(error) {
        var entry = cssPackState[cssUrl];
        if (disposed || !entry || entry !== state) return;
        entry.status = "error";
        entry.blob = null;
        entry.meta = null;
        entry.errorMessage = error && error.message ? error.message : String(error || "Неизвестная ошибка CSS-пакета.");
        if (typeof options.writeVerbose === "function") {
          options.writeVerbose("[BG360] CSS-пакет недоступен", {
            css: sanitizeResource(cssUrl),
            reason: error && error.message ? error.message : String(error || "")
          });
        }
        var waiters = entry.waiters.slice();
        entry.waiters.length = 0;
        for (var index = 0; index < waiters.length; index++) {
          try { waiters[index](false); } catch (waiterError) {}
        }
      });
      return "loading";
    }

    // Создаёт отдельный Blob URL для одного декодирования и учитывает активного потребителя пакета.
    function acquireResource(sourceUrl, quality) {
      var cssUrl = getCssUrl(sourceUrl, quality);
      var state = cssUrl ? cssPackState[cssUrl] : null;
      if (!state || state.status !== "loaded" || !state.blob || !URLRef) return null;
      var objectUrl;
      try {
        objectUrl = URLRef.createObjectURL(state.blob);
      } catch (error) {
        state.status = "error";
        state.blob = null;
        state.meta = null;
        state.errorMessage = error && error.message ? error.message : "Не удалось создать Blob URL CSS-пакета.";
        return null;
      }
      state.refs++;
      var resource = {
        kind: "css",
        src: objectUrl,
        meta: state.meta,
        expectedQuality: resolveEffectiveQuality(quality),
        cssUrl: cssUrl,
        cssState: state,
        released: false
      };
      activeResources.push(resource);
      return resource;
    }

    // Освобождает Blob URL и при ошибке декодера помечает пакет невалидным до перезагрузки.
    function releaseResource(resource, markCssError) {
      if (!resource || resource.kind !== "css" || resource.released) return;
      resource.released = true;
      var resourceIndex = activeResources.indexOf(resource);
      if (resourceIndex >= 0) activeResources.splice(resourceIndex, 1);
      try { if (URLRef) URLRef.revokeObjectURL(resource.src); } catch (error) {}
      var state = resource.cssState;
      if (!state) return;
      state.refs = Math.max(0, Number(state.refs || 0) - 1);
      if (markCssError) {
        state.status = "error";
        state.blob = null;
        state.meta = null;
        if (!state.errorMessage) state.errorMessage = "Браузер не смог декодировать изображение CSS-панорамы.";
      }
      if (state.refs === 0 && state.status !== "error") {
        state.blob = null;
        state.meta = null;
        if (cssPackState[resource.cssUrl] === state) delete cssPackState[resource.cssUrl];
      }
    }

    // Возвращает готовый CSS-ресурс либо просит вызывающий код повторить выбор после общей асинхронной загрузки.
    function resolveResource(sourceUrl, quality, onReady) {
      var cssStatus = ensureLoaded(sourceUrl, quality, onReady);
      if (cssStatus === "loading") return { status: "loading" };
      if (cssStatus === "ready") {
        var resource = acquireResource(sourceUrl, quality);
        if (resource) {
          resource.status = "ready";
          return resource;
        }
      }
      return { status: "none" };
    }

    // Сверяет режим и фактический размер декодированной картинки с проверенными метаданными.
    function validateDecodedImage(image, resource) {
      if (!resource || resource.kind !== "css") return "";
      var width = Number(image && (image.naturalWidth || image.videoWidth || image.width)) || 0;
      var height = Number(image && (image.naturalHeight || image.videoHeight || image.height)) || 0;
      var meta = resource.meta || {};
      if (meta.mode !== resource.expectedQuality) {
        return "Режим CSS-пакета " + meta.mode + " не совпадает с запрошенным качеством " + resource.expectedQuality + ".";
      }
      if (width !== Number(meta.width) || height !== Number(meta.height)) {
        return "Фактический размер CSS-панорамы " + width + "x" + height + " не совпадает с метаданными " + meta.width + "x" + meta.height + ".";
      }
      return "";
    }

    // Дополняет проверку декодированного изображения ограничением текущего WebGL-устройства.
    function validateTexture(texture, resource) {
      if (!resource || resource.kind !== "css") return "";
      var image = texture && texture.image;
      var decodedImageError = validateDecodedImage(image, resource);
      if (decodedImageError) return decodedImageError;
      var width = Number(image && (image.naturalWidth || image.videoWidth || image.width)) || 0;
      var height = Number(image && (image.naturalHeight || image.videoHeight || image.height)) || 0;
      var maxTextureSize = getMaxTextureSize();
      if (maxTextureSize > 0 && (width > maxTextureSize || height > maxTextureSize)) {
        return "Размер CSS-панорамы " + width + "x" + height + " превышает лимит WebGL " + maxTextureSize + " px.";
      }
      return "";
    }

    // Возвращает сохранённую причину отказа без раскрытия внутреннего объекта кэша движку.
    function getLoadError(sourceUrl, quality) {
      var cssUrl = getCssUrl(sourceUrl, quality);
      var state = cssUrl ? cssPackState[cssUrl] : null;
      return state && state.errorMessage ? state.errorMessage : "";
    }

    // Проверяет, загружается ли выбранный CSS-пакет прямо сейчас.
    function isLoadPending(sourceUrl, quality) {
      var cssUrl = getCssUrl(sourceUrl, quality);
      var state = cssUrl ? cssPackState[cssUrl] : null;
      return Boolean(state && state.status === "loading");
    }

    // Возвращает небольшую копию метаданных для статистики без Blob и DOM-изображения.
    function copyInspectionMeta(meta) {
      if (!meta || typeof meta !== "object") return null;
      return {
        schema: String(meta.schema || ""),
        mode: String(meta.mode || ""),
        type: String(meta.type || ""),
        size: Number(meta.size) || 0,
        width: Number(meta.width) || 0,
        height: Number(meta.height) || 0,
        quality: String(meta.quality || ""),
        chunkCount: Number(meta.chunkCount) || 0,
        encodedLength: Number(meta.encodedLength) || 0
      };
    }

    // Строит стабильный ключ фактически выбранного CSS-файла, а неверные пути изолирует отдельным ключом.
    function getInspectionKey(sourceUrl, quality) {
      var cssUrl = getCssUrl(sourceUrl, quality);
      if (cssUrl) return normalizeUrl(cssUrl);
      return "invalid:" + String(sourceUrl || "") + "\u0000" + String(quality || "auto");
    }

    // Определяет статусы, которые повторно не ставятся в тяжёлую очередь текущей страницы.
    function isInspectionTerminal(status) {
      return status === "loaded" || status === "verified" || status === "missing" || status === "invalid";
    }

    // Создаёт или находит сессионную запись проверки для фактического CSS-файла.
    function getOrCreateInspectionEntry(sourceUrl, quality, displayPath) {
      var effectiveQuality = resolveEffectiveQuality(quality);
      var cssUrl = getCssUrl(sourceUrl, effectiveQuality);
      var key = getInspectionKey(sourceUrl, effectiveQuality);
      var entry = inspectionState.entries[key];
      if (!entry) {
        entry = inspectionState.entries[key] = {
          key: key,
          path: displayPath || sourceUrl || "",
          sourceUrl: sourceUrl || "",
          cssUrl: cssUrl || "",
          quality: effectiveQuality,
          refs: [],
          status: cssUrl ? "queued" : "invalid",
          details: cssUrl ? "Queued for full CSS package validation." : "The path is not an allowed *-360.css panorama package.",
          meta: null
        };
      }
      if (displayPath) entry.path = displayPath;
      if (sourceUrl) entry.sourceUrl = sourceUrl;
      return entry;
    }

    // Объединяет места использования пакета без дублей для компактной статистики.
    function mergeInspectionRefs(entry, refs) {
      if (!entry || !Array.isArray(refs)) return;
      for (var index = 0; index < refs.length; index++) {
        var ref = String(refs[index] || "");
        if (ref && entry.refs.indexOf(ref) === -1) entry.refs.push(ref);
      }
    }

    // Возвращает прогресс только по пакетам текущей истории.
    function getInspectionProgress() {
      var keys = inspectionState.activeKeys || [];
      var completed = 0;
      for (var index = 0; index < keys.length; index++) {
        var entry = inspectionState.entries[keys[index]];
        if (entry && isInspectionTerminal(entry.status)) completed++;
      }
      return { completed: completed, total: keys.length };
    }

    // Передаёт актуальный прогресс интерфейсу, не связывая контроллер с DOM статистики.
    function notifyInspectionProgress() {
      if (typeof options.onInspectionProgress === "function") options.onInspectionProgress(getInspectionProgress());
    }

    // Применяет результат, не позволяя слабой проверке затереть успешную WebGL-валидацию.
    function applyInspectionResult(entry, status, details, meta) {
      if (!entry || disposed) return;
      if (entry.status === "loaded" && status !== "loaded") return;
      if (entry.status === "verified" && status !== "loaded" && status !== "verified") return;
      entry.status = status;
      entry.details = String(details || "");
      if (meta) entry.meta = copyInspectionMeta(meta);
      notifyInspectionProgress();
    }

    // Сохраняет результат по сценарию в малый сессионный кэш, не требуя от вызывающего кода доступа к записи.
    function recordInspectionResult(sourceUrl, quality, status, details, meta) {
      var entry = getOrCreateInspectionEntry(sourceUrl, quality, sourceUrl);
      applyInspectionResult(entry, status, details, meta);
    }

    // Сохраняет результат реального runtime или графа в тот же малый сессионный кэш статистики.
    function recordInspectionResultByResource(resource, sourceUrl, status, details) {
      if (!resource || resource.kind !== "css") return;
      recordInspectionResult(sourceUrl || resource.cssUrl, resource.expectedQuality, status, details, resource.meta);
    }

    // На HTTP уточняет только 404 и 410; остальные ответы не заменяют полную строгую загрузку.
    function probeMissingByHttp(cssUrl) {
      var protocol = windowRef && windowRef.location ? windowRef.location.protocol : "";
      var fetchFn = options.fetch || (windowRef && windowRef.fetch && windowRef.fetch.bind(windowRef));
      if ((protocol !== "http:" && protocol !== "https:") || typeof fetchFn !== "function") return Promise.resolve(null);
      var AbortControllerConstructor = options.AbortController || (windowRef && windowRef.AbortController);
      var controller = typeof AbortControllerConstructor === "function" ? new AbortControllerConstructor() : null;
      if (controller) abortControllers.push(controller);
      var fetchOptions = { method: "HEAD", cache: "no-store", credentials: "same-origin", redirect: "error" };
      if (controller) fetchOptions.signal = controller.signal;

      return new Promise(function(resolve) {
        var settled = false;

        // Завершает HEAD-пробу и снимает AbortController с lifecycle-реестра.
        function finish(status) {
          if (settled) return;
          settled = true;
          cancelTimer(timeoutId);
          var controllerIndex = abortControllers.indexOf(controller);
          if (controllerIndex >= 0) abortControllers.splice(controllerIndex, 1);
          resolve(status);
        }

        var timeoutId = schedule(function() {
          if (controller) controller.abort();
          finish(null);
        }, 5000);
        fetchFn(cssUrl, fetchOptions).then(function(response) {
          finish(response.status === 404 || response.status === 410 ? response.status : null);
        }).catch(function() {
          finish(null);
        });
      });
    }

    // Полностью загружает и декодирует пакет, после чего сразу освобождает тяжёлые данные.
    function inspectEntry(entry) {
      return probeMissingByHttp(entry.cssUrl).then(function(missingStatus) {
        if (missingStatus) {
          return { status: "missing", details: "The server returned HTTP " + missingStatus + ".", meta: null };
        }
        return new Promise(function(resolve) {
          var settled = false;

          // Завершает только первый результат декодирования одной записи.
          function finish(result) {
            if (settled) return;
            settled = true;
            resolve(result);
          }

          // Повторяет получение после общей асинхронной загрузки и создаёт Image только для готового Blob URL.
          function acquireAndDecode() {
            if (disposed) return;
            var resource = resolveResource(entry.sourceUrl, entry.quality, function() {
              acquireAndDecode();
            });
            if (!resource || resource.status === "loading") return;
            if (resource.status !== "ready" || !resource.src) {
              var failureReason = getLoadError(entry.sourceUrl, entry.quality) || "The CSS panorama package could not be loaded.";
              var failureStatus = /Не удалось загрузить CSS-пакет/i.test(failureReason) ? "missing" : "invalid";
              finish({ status: failureStatus, details: failureReason, meta: null });
              return;
            }
            if (!ImageConstructor) {
              releaseResource(resource, false);
              finish({ status: "invalid", details: "The browser image decoder is unavailable.", meta: resource.meta });
              return;
            }

            var image = new ImageConstructor();
            var timeoutId = schedule(function() {
              image.onload = null;
              image.onerror = null;
              releaseResource(resource, true);
              try { image.removeAttribute("src"); } catch (error) {}
              finish({ status: "invalid", details: "The panorama image decoder timed out.", meta: resource.meta });
            }, 30000);
            image.onload = function() {
              cancelTimer(timeoutId);
              var validationError = validateDecodedImage(image, resource);
              image.onload = null;
              image.onerror = null;
              releaseResource(resource, Boolean(validationError));
              try { image.removeAttribute("src"); } catch (error) {}
              finish({
                status: validationError ? "invalid" : "verified",
                details: validationError || "CSS package and image were fully validated and decoded.",
                meta: resource.meta
              });
            };
            image.onerror = function() {
              cancelTimer(timeoutId);
              image.onload = null;
              image.onerror = null;
              releaseResource(resource, true);
              try { image.removeAttribute("src"); } catch (error) {}
              finish({ status: "invalid", details: "The browser could not decode the panorama image.", meta: resource.meta });
            };
            image.src = resource.src;
          }

          acquireAndDecode();
        });
      });
    }

    // Планирует один финальный перерендер открытой текстовой статистики после всей очереди.
    function scheduleStatsFinalRefresh() {
      if (inspectionState.refreshScheduled || disposed) return;
      inspectionState.refreshScheduled = true;
      inspectionState.refreshTimerId = schedule(function() {
        inspectionState.refreshTimerId = null;
        inspectionState.refreshScheduled = false;
        notifyInspectionProgress();
        if (typeof options.onInspectionComplete === "function") options.onInspectionComplete();
      }, 50);
    }

    // Выбирает меньший пул декодирования для телефона и умеренный параллелизм настольного браузера.
    function getInspectionConcurrency() {
      return typeof options.isPhone === "function" && options.isPhone()
        ? STATS_PHONE_CONCURRENCY
        : STATS_DESKTOP_CONCURRENCY;
    }

    // Извлекает следующую незавершённую запись, пропуская результаты, уже полученные графом или runtime.
    function takeNextInspectionEntry() {
      while (inspectionState.queue.length) {
        var candidateKey = inspectionState.queue.shift();
        var candidate = inspectionState.entries[candidateKey];
        if (candidate && !isInspectionTerminal(candidate.status)) return candidate;
      }
      return null;
    }

    // Даёт приоритет открытому графу и ещё загружаемой панораме текущей сцены.
    function isInspectionPaused() {
      if (typeof options.isInspectionPaused === "function" && options.isInspectionPaused()) return true;
      var runtime = typeof options.getRuntimePanoramaState === "function" ? options.getRuntimePanoramaState() || {} : {};
      if (runtime.isVideoSource || !isCssPackPath(runtime.sourceSrc || "")) return false;
      if (runtime.textureReadyLoadSeq === runtime.loadSeq) return false;
      return isLoadPending(runtime.sourceSrc, runtime.sourceQuality || "auto");
    }

    // Запускает ограниченный пул тяжёлых проверок и уступает активному интерфейсу между заданиями.
    function runInspectionQueue() {
      if (disposed || inspectionState.timerId !== null) return;
      if (inspectionState.activeCount >= getInspectionConcurrency()) return;
      inspectionState.timerId = schedule(function runNextInspection() {
        inspectionState.timerId = null;
        if (isInspectionPaused()) {
          inspectionState.timerId = schedule(runNextInspection, 150);
          return;
        }
        var concurrency = getInspectionConcurrency();
        var startedCount = 0;

        // Освобождает слот после результата и продолжает насос до полного опустошения очереди.
        function startInspection(entry) {
          inspectionState.activeCount++;
          entry.status = "checking";
          entry.details = "Full CSS package validation is running.";
          notifyInspectionProgress();
          inspectEntry(entry).then(function(result) {
            applyInspectionResult(entry, result.status, result.details, result.meta);
          }).catch(function(error) {
            applyInspectionResult(entry, "invalid", error && error.message ? error.message : "The panorama check failed.", null);
          }).then(function() {
            if (disposed) return;
            inspectionState.activeCount = Math.max(0, inspectionState.activeCount - 1);
            if (inspectionState.queue.length) runInspectionQueue();
            else if (inspectionState.activeCount === 0) scheduleStatsFinalRefresh();
          });
        }

        while (inspectionState.activeCount < concurrency) {
          var entry = takeNextInspectionEntry();
          if (!entry) break;
          startedCount++;
          startInspection(entry);
        }
        if (startedCount === 0 && inspectionState.activeCount === 0) {
          notifyInspectionProgress();
          var progress = getInspectionProgress();
          if (progress.total > 0 && progress.completed >= progress.total) scheduleStatsFinalRefresh();
        }
      }, 40);
    }

    // Регистрирует пакеты текущей истории, запускает фоновую очередь и возвращает мгновенный снимок малого кэша.
    function checkReferences(items) {
      var references = Array.isArray(items) ? items : [];
      var activeKeys = [];
      var activeKeyMap = Object.create(null);
      for (var index = 0; index < references.length; index++) {
        var item = references[index] || {};
        var resolvedUrl = resolveAssetUrl(item.path || "");
        var entry = getOrCreateInspectionEntry(resolvedUrl || item.path || "", item.quality || "auto", item.path || "");
        mergeInspectionRefs(entry, item.refs);
        if (!activeKeyMap[entry.key]) {
          activeKeyMap[entry.key] = true;
          activeKeys.push(entry.key);
        }
        if (entry.status === "queued" && inspectionState.queue.indexOf(entry.key) === -1) {
          inspectionState.queue.push(entry.key);
        }
      }
      inspectionState.activeKeys = activeKeys;
      notifyInspectionProgress();
      if (inspectionState.queue.length) runInspectionQueue();
      return activeKeys.map(function(key) {
        var entry = inspectionState.entries[key];
        return {
          path: entry.path,
          cssUrl: entry.cssUrl,
          quality: entry.quality,
          refs: entry.refs.slice(),
          status: entry.status,
          details: entry.details,
          meta: copyInspectionMeta(entry.meta)
        };
      });
    }

    // Отменяет фоновые действия, удаляет iframe и освобождает все выданные Blob URL при окончательном уходе со страницы.
    function dispose() {
      if (disposed) return;
      disposed = true;
      trackedTimers.slice().forEach(cancelTimer);
      abortControllers.slice().forEach(function(controller) {
        try { controller.abort(); } catch (error) {}
      });
      abortControllers = [];
      activeFrames.slice().forEach(removeFrame);
      activeResources.slice().forEach(function(resource) {
        releaseResource(resource, false);
      });
      Object.keys(cssPackState).forEach(function(cssUrl) {
        var state = cssPackState[cssUrl];
        if (state) {
          state.waiters = [];
          state.blob = null;
          state.meta = null;
        }
        delete cssPackState[cssUrl];
      });
      inspectionState.queue = [];
      inspectionState.activeKeys = [];
      inspectionState.timerId = null;
      inspectionState.refreshTimerId = null;
      inspectionState.refreshScheduled = false;
    }

    return {
      isCssPackPath: isCssPackPath,
      isPackPath: isCssPackPath,
      getCssUrl: getCssUrl,
      resolveResource: resolveResource,
      releaseResource: releaseResource,
      validateDecodedImage: validateDecodedImage,
      validateTexture: validateTexture,
      getLoadError: getLoadError,
      recordInspectionResult: recordInspectionResult,
      recordInspectionResultByResource: recordInspectionResultByResource,
      checkReferences: checkReferences,
      getInspectionProgress: getInspectionProgress,
      notifyInspectionProgress: notifyInspectionProgress,
      dispose: dispose
    };
  }

  return {
    CSS_PACK_MAX_ENCODED_LENGTH: CSS_PACK_MAX_ENCODED_LENGTH,
    CSS_PACK_MAX_DECODED_SIZE: CSS_PACK_MAX_DECODED_SIZE,
    CSS_PACK_MAX_CHUNKS: CSS_PACK_MAX_CHUNKS,
    CSS_PACK_MAX_CHUNK_LENGTH: CSS_PACK_MAX_CHUNK_LENGTH,
    CSS_PACK_MAX_SOURCE_LENGTH: CSS_PACK_MAX_SOURCE_LENGTH,
    CSS_IMAGE_MAX_WIDTH: CSS_IMAGE_MAX_WIDTH,
    CSS_IMAGE_MAX_HEIGHT: CSS_IMAGE_MAX_HEIGHT,
    CSS_IMAGE_MAX_PIXELS: CSS_IMAGE_MAX_PIXELS,
    isCssPackPath: isCssPackPath,
    createCssPropertyReader: createCssPropertyReader,
    extractCssPackBlob: extractCssPackBlob,
    readImageDimensions: readImageDimensions,
    validateImageDimensions: validateImageDimensions,
    createPanoramaPackageController: createPanoramaPackageController
  };
});
