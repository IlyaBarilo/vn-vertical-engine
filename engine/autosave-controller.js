// Экспортирует lifecycle автосохранения: debounce, запись, загрузку, миграцию и очистку активного слота.
(function(root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VN_AUTOSAVE_CONTROLLER = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createAutosaveControllerModule() {
  "use strict";

  var DEFAULT_DEBOUNCE_MS = 2000;

  // Возвращает пустой объект состояния для координаторов без подробной runtime-диагностики.
  function returnEmptyRuntimeState() {
    return {};
  }

  // Возвращает null, когда проект не поддерживает миграцию прежнего общего слота.
  function returnNoLegacyMigration() {
    return null;
  }

  // Создаёт контроллер одной очереди записи с явными callback-границами состояния и интерфейса движка.
  function createAutosaveController(options) {
    options = options || {};

    var storage = options.storage;
    var isEnabled = options.isEnabled;
    var isStorageBlocked = options.isStorageBlocked;
    var buildPayload = options.buildPayload;
    var validatePayload = options.validatePayload;
    var applyPayload = options.applyPayload;
    var createLegacyMigration = typeof options.createLegacyMigration === "function"
      ? options.createLegacyMigration
      : returnNoLegacyMigration;
    var getRuntimeState = typeof options.getRuntimeState === "function"
      ? options.getRuntimeState
      : returnEmptyRuntimeState;
    var setTimer = typeof options.setTimer === "function" ? options.setTimer : setTimeout;
    var clearTimer = typeof options.clearTimer === "function" ? options.clearTimer : clearTimeout;
    var debounceMs = Number.isFinite(Number(options.debounceMs)) && Number(options.debounceMs) >= 0
      ? Number(options.debounceMs)
      : DEFAULT_DEBOUNCE_MS;
    var timerId = null;
    var disposed = false;

    if (
      !storage ||
      typeof storage.readCurrent !== "function" ||
      typeof storage.writeCurrent !== "function" ||
      typeof storage.removeCurrent !== "function" ||
      typeof storage.migrateLegacy !== "function"
    ) {
      throw new Error("Autosave controller requires the VN_AUTOSAVE_STORAGE controller API");
    }
    if (
      typeof isEnabled !== "function" ||
      typeof isStorageBlocked !== "function" ||
      typeof buildPayload !== "function" ||
      typeof validatePayload !== "function" ||
      typeof applyPayload !== "function"
    ) {
      throw new Error("Autosave controller requires runtime state callbacks");
    }

    // Передаёт отладочную запись движку, не связывая модуль с режимами и содержимым console.
    function debug(tag, detail) {
      if (typeof options.onDebug === "function") options.onDebug(tag, detail);
    }

    // Передаёт безопасное предупреждение координатору, который решает способ показа ошибки Storage API.
    function warn(message, error) {
      if (typeof options.onWarning === "function") options.onWarning(message, error);
    }

    // Снимает единственный отложенный таймер и при необходимости фиксирует причину отмены.
    function cancelPending(reason, reportCancellation) {
      if (timerId === null) return false;
      clearTimer(timerId);
      timerId = null;
      if (reportCancellation) debug("debounce:cancelled", { reason: reason || "" });
      return true;
    }

    // Сериализует payload и записывает его в активный слот с прежними диагностическими полями движка.
    function writePayload(payload, usesPrebuilt) {
      if (!payload) {
        var emptyState = getRuntimeState();
        debug("flush:no_payload", {
          usesPrebuilt: usesPrebuilt,
          inGame: emptyState.inGame,
          inVideo: emptyState.inVideo,
          sceneId: emptyState.sceneId,
          actionIndex: emptyState.actionIndex
        });
        return false;
      }

      var writeResult = storage.writeCurrent(JSON.stringify(payload));
      if (!writeResult.ok) throw writeResult.error;
      debug("flush:written", {
        storageKey: writeResult.key,
        usesPrebuilt: usesPrebuilt,
        sceneId: payload.sceneId,
        actionIndex: payload.actionIndex,
        waitingNext: payload.waitingNext,
        nextLocked: payload.nextLocked
      });
      return true;
    }

    // Немедленно записывает переданный checkpoint или строит снимок из актуального состояния движка.
    function flush(prebuiltPayload) {
      if (disposed || !isEnabled()) {
        debug("flush:skip", { reason: disposed ? "disposed" : "no_story_or_disabled" });
        return false;
      }

      try {
        var usesPrebuilt = arguments.length >= 1 && prebuiltPayload !== undefined && prebuiltPayload !== null;
        var payload = usesPrebuilt ? prebuiltPayload : buildPayload();
        return writePayload(payload, usesPrebuilt);
      } catch (error) {
        warn("[AUTOSAVE] flush failed:", error);
        debug("flush:error", String(error && error.message ? error.message : error));
        return false;
      }
    }

    // Перед lifecycle-записью снимает debounce без дополнительного лога и сохраняет последнее состояние синхронно.
    function flushPending() {
      cancelPending("lifecycle", false);
      return flush();
    }

    // Сбрасывает временное состояние; удаляет слот только при включённом автосохранении и отсутствии URL-запрета.
    function clear() {
      if (disposed) {
        debug("clear:skip", { reason: "disposed" });
        return false;
      }
      cancelPending("clear_storage", true);
      if (typeof options.onBeforeClear === "function") options.onBeforeClear();

      // Запрет автора распространяется и на перезапуск: прежнее сохранение остаётся нетронутым.
      if (!isEnabled()) {
        debug("clear:skip", { reason: "no_story_or_disabled" });
        return false;
      }

      if (isStorageBlocked()) {
        debug("clear:skip", { reason: "url_storage_blocked" });
        return false;
      }

      var removeResult = storage.removeCurrent();
      if (!removeResult.ok) {
        warn("[AUTOSAVE] clear failed:", removeResult.error);
        debug(
          "clear:error",
          String(removeResult.error && removeResult.error.message ? removeResult.error.message : removeResult.error)
        );
        return false;
      }

      debug("clear:removed", { storageKey: removeResult.key });
      return true;
    }

    // Откладывает запись и заменяет предыдущий таймер, чтобы снимок всегда строился из последнего состояния.
    function schedule() {
      if (disposed || !isEnabled()) return false;
      cancelPending("reschedule", true);

      timerId = setTimer(function flushScheduledAutosave() {
        timerId = null;
        var runtimeState = getRuntimeState();
        debug("debounce:fired", {
          sceneId: runtimeState.sceneId,
          actionIndex: runtimeState.actionIndex,
          waitingNext: runtimeState.waitingNext,
          nextLocked: runtimeState.nextLocked
        });
        flush();
      }, debounceMs);
      debug("debounce:scheduled", { ms: debounceMs });
      return true;
    }

    // Выполняет безопасную legacy-миграцию и сохраняет прежние категории диагностики и предупреждений.
    function migrateLegacySlot() {
      var migration = createLegacyMigration();
      if (!migration) return null;

      var migrationResult = storage.migrateLegacy(migration);
      if (migrationResult.status === "read-error" || migrationResult.status === "context-error") {
        var readError = migrationResult.error;
        debug(
          "migration:legacy_read_failed",
          String(readError && readError.message ? readError.message : readError)
        );
        return null;
      }
      if (migrationResult.status === "parse-error") {
        debug("migration:legacy_parse_failed", {});
        return null;
      }
      if (migrationResult.status === "rejected" || migrationResult.status === "validation-error") {
        debug("migration:legacy_rejected", {
          legacyStorageKey: migrationResult.legacyKey,
          targetStorageKey: migrationResult.targetKey
        });
        return null;
      }
      if (migrationResult.status === "write-error" || migrationResult.status === "transform-error") {
        warn("[AUTOSAVE] migration write failed:", migrationResult.error);
        return null;
      }
      if (migrationResult.status !== "migrated") return null;

      debug("migration:completed", {
        legacyStorageKey: migrationResult.legacyKey,
        targetStorageKey: migrationResult.targetKey
      });
      return migrationResult.raw;
    }

    // Читает, разбирает и проверяет активный слот, а координатору передаёт только готовый payload.
    function loadAndApply() {
      if (disposed || !isEnabled()) return false;
      if (typeof options.onBeforeLoad === "function") options.onBeforeLoad();

      var readResult = storage.readCurrent();
      if (!readResult.ok) return false;
      var raw = readResult.raw || migrateLegacySlot();
      if (!raw) return false;

      var data;
      try {
        data = JSON.parse(raw);
      } catch (error) {
        debug("restore:parse_failed", String(error && error.message ? error.message : error));
        clear();
        return false;
      }

      var valid = false;
      try {
        valid = validatePayload(data);
      } catch (error) {
        valid = false;
      }
      if (!valid) {
        if (typeof options.onInvalidPayload === "function") options.onInvalidPayload(data);
        clear();
        return false;
      }

      var applied = false;
      try {
        applied = applyPayload(data, raw) === true;
      } catch (error) {
        warn("[AUTOSAVE] restore failed:", error);
        debug("restore:apply_failed", String(error && error.message ? error.message : error));
        return false;
      }
      if (!applied) clear();
      return applied;
    }

    // Останавливает debounce и запрещает новые операции после завершения runtime.
    function dispose() {
      if (disposed) return;
      cancelPending("dispose", false);
      disposed = true;
    }

    // Возвращает минимальное состояние lifecycle только для тестов и безопасной диагностики координатора.
    function getStatus() {
      return {
        disposed: disposed,
        pending: timerId !== null,
        debounceMs: debounceMs
      };
    }

    return Object.freeze({
      flush: flush,
      flushPending: flushPending,
      clear: clear,
      schedule: schedule,
      loadAndApply: loadAndApply,
      dispose: dispose,
      getStatus: getStatus
    });
  }

  return {
    DEFAULT_DEBOUNCE_MS: DEFAULT_DEBOUNCE_MS,
    createAutosaveController: createAutosaveController
  };
});
