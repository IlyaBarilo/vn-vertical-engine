// Экспортирует чистый контракт payload автосохранения: fingerprint, флаги и проверку совместимости слота.
(function(root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VN_AUTOSAVE_PAYLOAD = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createAutosavePayloadModule() {
  "use strict";

  var PAYLOAD_VERSION = 3;

  // Вычисляет прежний компактный fingerprint без изменения формата существующих сохранений.
  function computeTextFingerprint(sourceText) {
    var text = typeof sourceText === "string" ? sourceText : "";
    var length = text.length;
    var hash = 5381;
    for (var index = 0; index < length; index++) {
      hash = ((hash << 5) + hash) + text.charCodeAt(index);
      hash = hash | 0;
    }
    return {
      hashUnsigned: hash >>> 0,
      hashHex: (hash >>> 0).toString(16),
      textLength: length
    };
  }

  // Восстанавливает fingerprint текста до projectId, удаляя только его строку в [meta] и сохраняя исходные EOL.
  function computeLegacyProjectFingerprint(sourceText) {
    var text = typeof sourceText === "string" ? sourceText : "";
    var chunks = text.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) || [];
    var result = "";
    var insideMeta = false;
    var removedProjectId = false;

    for (var index = 0; index < chunks.length; index++) {
      var chunk = chunks[index];
      if (!chunk) continue;
      var body = chunk.replace(/(?:\r\n|\n|\r)$/, "");
      var trimmed = body.trim();
      var sectionMatch = trimmed.match(/^\[([^\]]+)\]\s*(?:#.*)?$/);
      if (sectionMatch) insideMeta = sectionMatch[1].trim().toLowerCase() === "meta";

      if (insideMeta && /^projectId\s*[:=]/.test(trimmed)) {
        removedProjectId = true;
        continue;
      }
      result += chunk;
    }

    return removedProjectId ? computeTextFingerprint(result) : null;
  }

  // Не сохраняет мёртвую блокировку nextLocked без waitingNext посередине незавершённой сцены.
  function normalizeInteractionFlags(sceneActionCount, runtimeActionIndex, waitingNext, nextLocked) {
    var normalizedWaitingNext = !!waitingNext;
    var normalizedNextLocked = !!nextLocked;
    if (
      Number.isInteger(sceneActionCount) &&
      sceneActionCount >= 0 &&
      typeof runtimeActionIndex === "number" &&
      runtimeActionIndex >= 0 &&
      runtimeActionIndex < sceneActionCount &&
      !normalizedWaitingNext &&
      normalizedNextLocked
    ) {
      normalizedNextLocked = false;
    }
    return { waitingNext: normalizedWaitingNext, nextLocked: normalizedNextLocked };
  }

  // Возвращает единый структурированный результат отказа, чтобы движок мог диагностировать причину без дублирования правил.
  function rejectPayload(reason, fingerprintSkipped) {
    return { valid: false, reason: reason, fingerprintSkipped: !!fingerprintSkipped };
  }

  // Проверяет версию, принадлежность, fingerprint, сцену и индекс без доступа к глобальному состоянию runtime.
  function validatePayload(data, validationOptions) {
    var options = validationOptions || {};
    if (!data || data.v !== PAYLOAD_VERSION) return rejectPayload("version", false);

    var activeProjectId = String(options.projectId || "");
    var payloadProjectId = String(data.projectId || "");
    if (activeProjectId) {
      if (options.allowMissingProjectId) {
        if (payloadProjectId) return rejectPayload("project", false);
      } else if (payloadProjectId !== activeProjectId) {
        return rejectPayload("project", false);
      }
    } else if (payloadProjectId) {
      return rejectPayload("project", false);
    }

    var activeNovelId = String(options.novelId || "");
    if (activeNovelId && String(data.novelId || "") !== activeNovelId) {
      return rejectPayload("novel", false);
    }
    if (!activeNovelId && data.novelId) return rejectPayload("novel", false);

    if (
      data.bgScroll &&
      typeof data.bgScroll === "object" &&
      Object.prototype.hasOwnProperty.call(data.bgScroll, "focus")
    ) {
      return rejectPayload("legacy-bg-scroll-focus", false);
    }

    var fingerprint = options.requiredFingerprint || options.currentFingerprint;
    var shouldCheckFingerprint = !!options.requiredFingerprint || options.loadsafe !== false;
    if (shouldCheckFingerprint) {
      if (!fingerprint) return rejectPayload("fingerprint-context", false);
      if (String(data.hashHex || "") !== String(fingerprint.hashHex || "")) {
        return rejectPayload("fingerprint", false);
      }
      if (Number(data.textLength) !== Number(fingerprint.textLength)) {
        return rejectPayload("fingerprint", false);
      }
    }

    if (!data.sceneId || typeof options.getSceneActionCount !== "function") {
      return rejectPayload("scene", !shouldCheckFingerprint);
    }
    var actionCount = options.getSceneActionCount(data.sceneId);
    if (!Number.isInteger(actionCount) || actionCount < 0) {
      return rejectPayload("scene", !shouldCheckFingerprint);
    }
    var actionIndex = parseInt(data.actionIndex, 10);
    if (!isFinite(actionIndex) || actionIndex < 0 || actionIndex > actionCount) {
      return rejectPayload("action-index", !shouldCheckFingerprint);
    }

    return { valid: true, reason: "", fingerprintSkipped: !shouldCheckFingerprint };
  }

  return {
    PAYLOAD_VERSION: PAYLOAD_VERSION,
    computeTextFingerprint: computeTextFingerprint,
    computeLegacyProjectFingerprint: computeLegacyProjectFingerprint,
    normalizeInteractionFlags: normalizeInteractionFlags,
    validatePayload: validatePayload
  };
});
