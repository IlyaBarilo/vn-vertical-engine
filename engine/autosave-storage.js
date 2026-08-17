// Экспортирует адресацию и безопасные операции хранилища автосохранений для браузера и Node.js-тестов.
(function(root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VN_AUTOSAVE_STORAGE = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createAutosaveStorageModule() {
  "use strict";

  var DEFAULT_STORAGE_KEY = "vn_engine_autosave_v1";

  // Нормализует идентификатор слота так же для meta и URL, чтобы регистр и пробелы не создавали дубликаты.
  function normalizeSaveId(value) {
    if (value === undefined || value === null) return "";
    return String(value).trim().toLowerCase();
  }

  // Строит прежний общий или novel-ключ, который используется проектами без projectId и при миграции.
  function buildLegacyStorageKey(baseKey, novelId) {
    var normalizedBaseKey = String(baseKey || DEFAULT_STORAGE_KEY);
    var normalizedNovelId = normalizeSaveId(novelId);
    if (!normalizedNovelId) return normalizedBaseKey;
    return normalizedBaseKey + ":novel:" + encodeURIComponent(normalizedNovelId);
  }

  // Строит изолированный projectId-ключ, сохраняя прежнюю схему при отсутствии идентификатора проекта.
  function buildStorageKey(baseKey, projectId, novelId) {
    var normalizedBaseKey = String(baseKey || DEFAULT_STORAGE_KEY);
    var normalizedProjectId = normalizeSaveId(projectId);
    var normalizedNovelId = normalizeSaveId(novelId);
    if (!normalizedProjectId) return buildLegacyStorageKey(normalizedBaseKey, normalizedNovelId);

    var storageKey = normalizedBaseKey + ":project:" + encodeURIComponent(normalizedProjectId);
    if (normalizedNovelId) storageKey += ":novel:" + encodeURIComponent(normalizedNovelId);
    return storageKey;
  }

  // Подставляет пустой идентификатор для необязательного контекста проекта или novel-режима.
  function returnEmptySaveId() {
    return "";
  }

  // Создаёт контроллер над внедрённым Storage, не обращаясь к localStorage до фактической операции.
  function createAutosaveStorage(options) {
    options = options || {};

    var getStorage = options.getStorage;
    var getProjectId = typeof options.getProjectId === "function" ? options.getProjectId : returnEmptySaveId;
    var getNovelId = typeof options.getNovelId === "function" ? options.getNovelId : returnEmptySaveId;
    var baseKey = String(options.baseKey || DEFAULT_STORAGE_KEY);

    if (typeof getStorage !== "function") {
      throw new Error("Autosave storage requires a getStorage function");
    }

    // Получает нормализованный контекст на момент операции, поскольку история и URL-режим задаются после bootstrap.
    function readContext() {
      return {
        projectId: normalizeSaveId(getProjectId()),
        novelId: normalizeSaveId(getNovelId())
      };
    }

    // Возвращает пару текущего и legacy-ключа для единого решения во всех операциях и миграции.
    function resolveKeys() {
      var context = readContext();
      return {
        context: context,
        legacyKey: buildLegacyStorageKey(baseKey, context.novelId),
        currentKey: buildStorageKey(baseKey, context.projectId, context.novelId)
      };
    }

    // Читает строку по точному ключу и превращает запрет Storage API в проверяемый результат вместо исключения.
    function readRaw(storageKey) {
      try {
        var storage = getStorage();
        if (!storage || typeof storage.getItem !== "function") throw new Error("Storage.getItem is unavailable");
        return { ok: true, key: storageKey, raw: storage.getItem(storageKey), error: null };
      } catch (error) {
        return { ok: false, key: storageKey, raw: null, error: error };
      }
    }

    // Записывает готовую строку по точному ключу, сохраняя ошибку квоты или доступа для решения координатора.
    function writeRaw(storageKey, raw) {
      try {
        var storage = getStorage();
        if (!storage || typeof storage.setItem !== "function") throw new Error("Storage.setItem is unavailable");
        storage.setItem(storageKey, String(raw));
        return { ok: true, key: storageKey, error: null };
      } catch (error) {
        return { ok: false, key: storageKey, error: error };
      }
    }

    // Удаляет только точный активный ключ и сообщает ошибку, не затрагивая другие проекты или legacy-слот.
    function removeRaw(storageKey) {
      try {
        var storage = getStorage();
        if (!storage || typeof storage.removeItem !== "function") throw new Error("Storage.removeItem is unavailable");
        storage.removeItem(storageKey);
        return { ok: true, key: storageKey, error: null };
      } catch (error) {
        return { ok: false, key: storageKey, error: error };
      }
    }

    // Возвращает прежний ключ активного novel-слота для диагностики и безопасной миграции.
    function getLegacyKey() {
      return resolveKeys().legacyKey;
    }

    // Возвращает изолированный ключ активного проекта или прежний ключ для проекта без projectId.
    function getCurrentKey() {
      return resolveKeys().currentKey;
    }

    // Читает текущий слот и никогда самостоятельно не удаляет повреждённые данные.
    function readCurrent() {
      var keys;
      try {
        keys = resolveKeys();
      } catch (error) {
        return { ok: false, key: "", raw: null, error: error };
      }
      return readRaw(keys.currentKey);
    }

    // Записывает уже сериализованный payload только в текущий projectId/novel-слот.
    function writeCurrent(raw) {
      var keys;
      try {
        keys = resolveKeys();
      } catch (error) {
        return { ok: false, key: "", error: error };
      }
      return writeRaw(keys.currentKey, raw);
    }

    // Удаляет только текущий projectId/novel-слот; решение о запрете удаления принимает координатор.
    function removeCurrent() {
      var keys;
      try {
        keys = resolveKeys();
      } catch (error) {
        return { ok: false, key: "", error: error };
      }
      return removeRaw(keys.currentKey);
    }

    // Копирует только одобренный координатором legacy-payload и оставляет исходный слот неизменным при любом исходе.
    function migrateLegacy(migrationOptions) {
      var migration = migrationOptions || {};
      var keys;
      try {
        keys = resolveKeys();
      } catch (error) {
        return { status: "context-error", legacyKey: "", targetKey: "", error: error };
      }

      if (!keys.context.projectId) {
        return { status: "not-needed", legacyKey: keys.legacyKey, targetKey: keys.currentKey, error: null };
      }

      var readResult = readRaw(keys.legacyKey);
      if (!readResult.ok) {
        return { status: "read-error", legacyKey: keys.legacyKey, targetKey: keys.currentKey, error: readResult.error };
      }
      if (!readResult.raw) {
        return { status: "missing", legacyKey: keys.legacyKey, targetKey: keys.currentKey, error: null };
      }

      var legacyData;
      try {
        legacyData = JSON.parse(readResult.raw);
      } catch (error) {
        return { status: "parse-error", legacyKey: keys.legacyKey, targetKey: keys.currentKey, error: error };
      }

      try {
        if (typeof migration.validate !== "function" || !migration.validate(legacyData, keys.context)) {
          return { status: "rejected", legacyKey: keys.legacyKey, targetKey: keys.currentKey, error: null };
        }
      } catch (error) {
        return { status: "validation-error", legacyKey: keys.legacyKey, targetKey: keys.currentKey, error: error };
      }

      var migratedData = legacyData;
      try {
        if (typeof migration.transform === "function") {
          migratedData = migration.transform(legacyData, keys.context);
        }
        var migratedRaw = JSON.stringify(migratedData);
        var writeResult = writeRaw(keys.currentKey, migratedRaw);
        if (!writeResult.ok) {
          return { status: "write-error", legacyKey: keys.legacyKey, targetKey: keys.currentKey, error: writeResult.error };
        }
        return {
          status: "migrated",
          legacyKey: keys.legacyKey,
          targetKey: keys.currentKey,
          raw: migratedRaw,
          error: null
        };
      } catch (error) {
        return { status: "transform-error", legacyKey: keys.legacyKey, targetKey: keys.currentKey, error: error };
      }
    }

    return Object.freeze({
      getLegacyKey: getLegacyKey,
      getCurrentKey: getCurrentKey,
      readCurrent: readCurrent,
      writeCurrent: writeCurrent,
      removeCurrent: removeCurrent,
      migrateLegacy: migrateLegacy
    });
  }

  return {
    DEFAULT_STORAGE_KEY: DEFAULT_STORAGE_KEY,
    normalizeSaveId: normalizeSaveId,
    buildLegacyStorageKey: buildLegacyStorageKey,
    buildStorageKey: buildStorageKey,
    createAutosaveStorage: createAutosaveStorage
  };
});
