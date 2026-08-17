// resource-path-policy.js
// Единая политика разрешает авторские ресурсы только по каноническим путям внутри assets/.

(function(root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root) root.VNResourcePathPolicy = api;
  // VM-тесты используют отдельный объект window; браузерный globalThis и window совпадают.
  if (root && root.window && root.window !== root) /** @type {any} */ (root.window).VNResourcePathPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";

  /**
   * Результат проверки хранит только безопасный относительный путь и при успешном разрешении URL.
   * @typedef {{ok: boolean, code: string, message: string, path: string, extension: string, url?: string}} ResourcePathResult
   */
  /** @typedef {{image: readonly string[], audio: readonly string[], video: readonly string[], game: readonly string[], [kind: string]: readonly string[]}} ExtensionMap */

  var MAX_PATH_LENGTH = 1024;
  var MAX_PATH_SEGMENTS = 64;
  var MAX_SEGMENT_LENGTH = 128;
  var DIRECTORY_SEGMENT_RE = /^[A-Za-z0-9_-]+$/;
  var FILE_SEGMENT_RE = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$/;
  var PANORAMA_CSS_RE = /-360(?:-[a-z0-9_-]+)?\.css$/i;
  /** @type {Readonly<ExtensionMap>} */
  var EXTENSIONS = Object.freeze({
    image: Object.freeze([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"]),
    audio: Object.freeze([".mp3", ".wav", ".ogg", ".m4a", ".aac"]),
    video: Object.freeze([".mp4", ".webm"]),
    game: Object.freeze([".html"])
  });

  /**
   * Возвращает единообразный результат отказа без раскрытия абсолютного пути устройства.
   * @param {string} code Машиночитаемая причина отказа.
   * @param {string} message Безопасное сообщение для пользователя.
   * @returns {ResourcePathResult}
   */
  function invalid(code, message) {
    return { ok: false, code: code, message: message, path: "", extension: "" };
  }

  /**
   * Возвращает расширение канонического пути вместе с точкой в нижнем регистре.
   * @param {unknown} path Проверяемое значение пути.
   * @returns {string}
   */
  function getExtension(path) {
    var fileName = String(path || "").split("/").pop() || "";
    var dotIndex = fileName.lastIndexOf(".");
    return dotIndex > 0 ? fileName.slice(dotIndex).toLowerCase() : "";
  }

  /**
   * Проверяет соответствие расширения назначению ресурса, не полагаясь на MIME сервера.
   * @param {string} path Канонический относительный путь.
   * @param {string} kind Назначение ресурса.
   * @returns {boolean}
   */
  function isExtensionAllowed(path, kind) {
    var extension = getExtension(path);
    if (kind === "panorama") {
      return PANORAMA_CSS_RE.test(path) || EXTENSIONS.video.indexOf(extension) !== -1;
    }
    if (kind === "background") {
      return EXTENSIONS.image.indexOf(extension) !== -1 || EXTENSIONS.video.indexOf(extension) !== -1;
    }
    var allowedExtensions = EXTENSIONS[kind];
    if (allowedExtensions) return allowedExtensions.indexOf(extension) !== -1;
    return (
      EXTENSIONS.image.indexOf(extension) !== -1 ||
      EXTENSIONS.audio.indexOf(extension) !== -1 ||
      EXTENSIONS.video.indexOf(extension) !== -1 ||
      EXTENSIONS.game.indexOf(extension) !== -1 ||
      PANORAMA_CSS_RE.test(path)
    );
  }

  /**
   * Проверяет исходную строку до URL-нормализации, чтобы кодировки и разделители не скрывали выход из assets/.
   * @param {unknown} pathValue Исходное значение пути.
   * @param {unknown} kind Назначение ресурса.
   * @returns {ResourcePathResult}
   */
  function validate(pathValue, kind) {
    if (typeof pathValue !== "string") return invalid("TYPE", "путь должен быть строкой");

    var path = pathValue.trim();
    if (!path) return invalid("EMPTY", "путь пуст");
    if (path !== pathValue) return invalid("WHITESPACE", "пробелы по краям пути запрещены");
    if (path.length > MAX_PATH_LENGTH) return invalid("TOO_LONG", "путь превышает 1024 символа");
    if (/[\u0000-\u001F\u007F]/.test(path)) return invalid("CONTROL", "управляющие символы запрещены");
    if (path.indexOf("\\") !== -1) return invalid("BACKSLASH", "обратные слеши запрещены; используйте /");
    if (/[?#%]/.test(path)) return invalid("URL_SYNTAX", "query, fragment и URL-кодирование запрещены");
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(path) || /^\//.test(path)) {
      return invalid("ABSOLUTE", "URL и абсолютные пути запрещены");
    }
    if (path.indexOf("assets/") !== 0) return invalid("ASSETS_ROOT", "путь должен начинаться с assets/");

    var segments = path.split("/");
    if (segments.length > MAX_PATH_SEGMENTS) return invalid("TOO_DEEP", "в пути слишком много каталогов");
    for (var index = 0; index < segments.length; index++) {
      var segment = segments[index];
      if (!segment || segment === "." || segment === "..") {
        return invalid("TRAVERSAL", "пустые сегменты, . и .. запрещены");
      }
      if (segment.length > MAX_SEGMENT_LENGTH) return invalid("SEGMENT_LONG", "сегмент пути превышает 128 символов");
      var isFile = index === segments.length - 1;
      var segmentValid = isFile ? FILE_SEGMENT_RE.test(segment) : DIRECTORY_SEGMENT_RE.test(segment);
      if (!segmentValid) {
        return invalid("SEGMENT", "имена каталогов и файлов могут содержать только латиницу, цифры, _ и -");
      }
    }

    var resourceKind = String(kind || "asset").toLowerCase();
    if (!isExtensionAllowed(path, resourceKind)) {
      return invalid("EXTENSION", "расширение не разрешено для ресурса типа " + resourceKind);
    }
    return { ok: true, code: "", message: "", path: path, extension: getExtension(path) };
  }

  /**
   * Разрешает уже проверенный путь относительно каталога index.html и повторно подтверждает границу проекта.
   * @param {unknown} pathValue Исходное значение пути.
   * @param {unknown} baseHref Адрес index.html.
   * @param {unknown} kind Назначение ресурса.
   * @returns {ResourcePathResult}
   */
  function resolve(pathValue, baseHref, kind) {
    var validation = validate(pathValue, kind);
    if (!validation.ok) return validation;

    try {
      var baseUrl = new URL("./", String(baseHref || ""));
      var resourceUrl = new URL(validation.path, baseUrl);
      if (resourceUrl.protocol !== baseUrl.protocol || resourceUrl.host !== baseUrl.host || resourceUrl.href.indexOf(baseUrl.href) !== 0) {
        return invalid("OUTSIDE_PROJECT", "нормализованный путь вышел из каталога проекта");
      }
      return {
        ok: true,
        code: "",
        message: "",
        path: validation.path,
        extension: validation.extension,
        url: resourceUrl.href
      };
    } catch (error) {
      return invalid("URL_ERROR", "браузер не смог разобрать путь ресурса");
    }
  }

  return Object.freeze({
    MAX_PATH_LENGTH: MAX_PATH_LENGTH,
    validate: validate,
    resolve: resolve,
    getExtension: getExtension,
    isExtensionAllowed: isExtensionAllowed
  });
});
