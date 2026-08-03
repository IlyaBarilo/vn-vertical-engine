// story-sandbox-loader.js
// Изолированно выполняет авторские story.js и story360.js в Worker и возвращает странице только данные.

(function() {
  "use strict";

  var SANDBOX_LOAD_TIMEOUT_MS = 10000;
  var STORY_TEXT_MAX_LENGTH = 8 * 1024 * 1024;
  var STORY360_MAX_DEPTH = 64;
  var STORY360_MAX_ENTRIES = 250000;
  var STORY360_MAX_STRING_LENGTH = 4 * 1024 * 1024;
  var STORY360_MAX_TOTAL_STRING_LENGTH = 16 * 1024 * 1024;
  var UNSAFE_OBJECT_KEYS = Object.create(null);
  UNSAFE_OBJECT_KEYS.__proto__ = true;
  UNSAFE_OBJECT_KEYS.prototype = true;
  UNSAFE_OBJECT_KEYS.constructor = true;

  // Этот bootstrap работает только внутри отдельного Worker и держит MessagePort в недоступном скрипту замыкании.
  function workerBootstrap() {
    "use strict";

    var initialized = false;

    // Подменяет доступный Worker API до запуска пользовательского файла, не затрагивая сохранённый importScripts.
    function blockWorkerGlobal(name, replacement) {
      try {
        Object.defineProperty(self, name, {
          value: replacement,
          configurable: false,
          enumerable: false,
          writable: false
        });
      } catch (error) {
        try { self[name] = replacement; } catch (ignored) {}
      }
    }

    // Принимает приватный канал один раз, блокирует побочные API и загружает ровно указанный пользовательский файл.
    function initializeWorker(event) {
      if (initialized || !event || !event.data || event.data.type !== "vnv-story-worker-init") return;
      if (!event.ports || !event.ports[0]) return;

      initialized = true;
      self.removeEventListener("message", initializeWorker, false);

      var port = event.ports[0];
      var send = port.postMessage.bind(port);
      var closePort = port.close.bind(port);
      var source = typeof event.data.source === "string" ? event.data.source : "";
      var kind = event.data.kind === "story360" ? "story360" : "story";
      var loadScript = self.importScripts.bind(self);
      var dataWindow = Object.create(null);
      var runtimeError = "";
      var sent = false;

      // Завершает протокол один раз; ошибка structured clone превращается в безопасный статус invalid.
      function finish(payload) {
        if (sent) return;
        sent = true;
        try {
          send(payload);
        } catch (error) {
          try {
            send({
              status: "invalid",
              kind: kind,
              message: "Данные пользовательского скрипта нельзя безопасно скопировать."
            });
          } catch (ignored) {}
        }
        try { closePort(); } catch (ignoredClose) {}
      }

      // Запоминает runtime-ошибку импортированного файла и не позволяет ей уйти как необработанная ошибка страницы.
      self.addEventListener("error", function rememberWorkerRuntimeError(errorEvent) {
        if (!runtimeError) {
          runtimeError = errorEvent && errorEvent.message
            ? String(errorEvent.message)
            : "Ошибка выполнения пользовательского скрипта.";
        }
        if (errorEvent && typeof errorEvent.preventDefault === "function") errorEvent.preventDefault();
      }, true);

      // Отдельный объект window сохраняет старый контракт присваивания, но не открывает глобальные API Worker.
      blockWorkerGlobal("window", dataWindow);
      blockWorkerGlobal("fetch", undefined);
      blockWorkerGlobal("XMLHttpRequest", undefined);
      blockWorkerGlobal("WebSocket", undefined);
      blockWorkerGlobal("EventSource", undefined);
      blockWorkerGlobal("WebTransport", undefined);
      blockWorkerGlobal("Worker", undefined);
      blockWorkerGlobal("SharedWorker", undefined);
      blockWorkerGlobal("BroadcastChannel", undefined);
      blockWorkerGlobal("indexedDB", undefined);
      blockWorkerGlobal("caches", undefined);
      blockWorkerGlobal("importScripts", function rejectNestedScriptLoad() {
        throw new Error("Пользовательскому сценарию запрещено подключать дополнительные скрипты.");
      });

      if (!source) {
        finish({ status: "invalid", kind: kind, message: "Не задан путь пользовательского скрипта." });
        return;
      }

      try {
        loadScript(source);
      } catch (error) {
        var errorName = error && error.name ? String(error.name) : "";
        if (!runtimeError && errorName === "NetworkError") {
          finish({ status: "missing", kind: kind });
          return;
        }
        finish({
          status: "invalid",
          kind: kind,
          message: runtimeError || (error && error.message ? String(error.message) : "Ошибка выполнения пользовательского скрипта.")
        });
        return;
      }

      if (runtimeError) {
        finish({ status: "invalid", kind: kind, message: runtimeError });
        return;
      }

      if (kind === "story") {
        if (typeof dataWindow.STORY_TEXT !== "string") {
          finish({
            status: "invalid",
            kind: kind,
            message: "Файл загружен, но не создал строку window.STORY_TEXT."
          });
          return;
        }
        finish({ status: "loaded", kind: kind, value: dataWindow.STORY_TEXT });
        return;
      }

      if (!dataWindow.STORY360 || typeof dataWindow.STORY360 !== "object") {
        finish({
          status: "invalid",
          kind: kind,
          message: "Файл загружен, но не создал объект window.STORY360."
        });
        return;
      }
      finish({ status: "loaded", kind: kind, value: dataWindow.STORY360 });
    }

    self.addEventListener("message", initializeWorker, false);
  }

  // Выполняет один пользовательский файл в отдельном потоке и прекращает Worker после результата или таймаута.
  function loadSandboxedScript(source, kind) {
    return new Promise(function(resolve, reject) {
      var settled = false;
      var timeoutId = null;
      var channel = null;
      var worker = null;
      var workerUrl = "";
      var absoluteSource;

      try {
        absoluteSource = new URL(source, window.location.href).href;
        var workerSource = "(" + workerBootstrap.toString() + ")();";
        workerUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
        worker = new Worker(workerUrl, { name: "vnv-" + kind + "-sandbox" });
        channel = new MessageChannel();
      } catch (error) {
        if (workerUrl) {
          try { URL.revokeObjectURL(workerUrl); } catch (revokeError) {}
        }
        reject(error);
        return;
      }

      // Завершает отдельный поток при любом исходе, поэтому бесконечный цикл не переживает внешний таймаут.
      function finish(error, result) {
        if (settled) return;
        settled = true;
        if (timeoutId !== null) clearTimeout(timeoutId);
        if (channel) {
          try { channel.port1.close(); } catch (closeError) {}
          try { channel.port2.close(); } catch (closeError2) {}
        }
        if (worker) {
          try { worker.terminate(); } catch (terminateError) {}
        }
        if (workerUrl) {
          try { URL.revokeObjectURL(workerUrl); } catch (revokeError) {}
        }
        if (error) reject(error);
        else resolve(result);
      }

      channel.port1.onmessage = function receiveWorkerResult(event) {
        var data = event && event.data;
        if (!data || data.kind !== kind) {
          finish(new Error("Sandbox Worker вернул сообщение неизвестного типа."));
          return;
        }
        finish(null, {
          status: data.status,
          source: source,
          value: data.value,
          message: data.message || ""
        });
      };

      // Ошибка bootstrap-Worker считается внутренней ошибкой runtime, а ошибки импортируемого файла идут через канал.
      worker.onerror = function reportWorkerBootstrapError(event) {
        if (event && typeof event.preventDefault === "function") event.preventDefault();
        finish(new Error(event && event.message ? event.message : "Не удалось запустить sandbox Worker."));
      };

      timeoutId = setTimeout(function reportWorkerTimeout() {
        finish(null, {
          status: "timeout",
          source: source,
          message: "Истекло время ожидания sandbox Worker."
        });
      }, SANDBOX_LOAD_TIMEOUT_MS);

      worker.postMessage({
        type: "vnv-story-worker-init",
        source: absoluteSource,
        kind: kind
      }, [channel.port2]);
    });
  }

  // Проверяет размер текста до передачи парсеру, чтобы один сценарий не занял всю память страницы.
  function validateStoryText(value) {
    if (typeof value !== "string") {
      throw new Error("Sandbox не вернул строку STORY_TEXT.");
    }
    if (value.length > STORY_TEXT_MAX_LENGTH) {
      throw new Error("STORY_TEXT превышает допустимый размер.");
    }
    return value;
  }

  // Рекурсивно копирует STORY360 в JSON-подобные структуры без прототипов, функций и опасных ключей.
  function copyStory360Value(value, state, depth) {
    if (depth > STORY360_MAX_DEPTH) {
      throw new Error("STORY360 превышает допустимую глубину вложенности.");
    }
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("STORY360 содержит некорректное число.");
      return value;
    }
    if (typeof value === "string") {
      if (value.length > STORY360_MAX_STRING_LENGTH) {
        throw new Error("STORY360 содержит слишком длинную строку.");
      }
      state.totalStringLength += value.length;
      if (state.totalStringLength > STORY360_MAX_TOTAL_STRING_LENGTH) {
        throw new Error("Суммарный размер строк STORY360 превышает допустимый предел.");
      }
      return value;
    }
    if (!value || typeof value !== "object") {
      throw new Error("STORY360 содержит значение неподдерживаемого типа.");
    }
    if (state.seen.has(value)) {
      throw new Error("STORY360 содержит циклическую ссылку.");
    }

    state.seen.add(value);
    state.entries += 1;
    if (state.entries > STORY360_MAX_ENTRIES) {
      throw new Error("STORY360 содержит слишком много элементов.");
    }

    var result;
    if (Array.isArray(value)) {
      result = [];
      for (var i = 0; i < value.length; i++) {
        result.push(copyStory360Value(value[i], state, depth + 1));
      }
    } else {
      var prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error("STORY360 содержит объект с неподдерживаемым прототипом.");
      }
      result = Object.create(null);
      var keys = Object.keys(value);
      for (var keyIndex = 0; keyIndex < keys.length; keyIndex++) {
        var key = keys[keyIndex];
        if (UNSAFE_OBJECT_KEYS[key]) {
          throw new Error("STORY360 содержит небезопасный ключ " + key + ".");
        }
        state.entries += 1;
        if (state.entries > STORY360_MAX_ENTRIES) {
          throw new Error("STORY360 содержит слишком много полей.");
        }
        result[key] = copyStory360Value(value[key], state, depth + 1);
      }
    }

    state.seen.delete(value);
    return result;
  }

  // Проверяет корень STORY360 и возвращает независимую копию, пригодную только как данные движка.
  function validateStory360(value) {
    var copied = copyStory360Value(value, {
      seen: new WeakSet(),
      entries: 0,
      totalStringLength: 0
    }, 0);

    if (!copied || typeof copied !== "object" || Array.isArray(copied)) {
      throw new Error("STORY360 должен быть объектом.");
    }
    if (!copied.spaces || typeof copied.spaces !== "object" || Array.isArray(copied.spaces)) {
      throw new Error("STORY360 должен содержать объект spaces.");
    }
    return copied;
  }

  // Загружает story.js и принимает от Worker только ограниченную строку сценария.
  function loadStoryText(source) {
    return loadSandboxedScript(source, "story").then(function(result) {
      if (result.status === "loaded") result.value = validateStoryText(result.value);
      return result;
    });
  }

  // Загружает story360.js и принимает от Worker только проверенную JSON-подобную карту пространств.
  function loadStory360(source) {
    return loadSandboxedScript(source, "story360").then(function(result) {
      if (result.status === "loaded") result.value = validateStory360(result.value);
      return result;
    });
  }

  window.VNStorySandboxLoader = Object.freeze({
    loadStoryText: loadStoryText,
    loadStory360: loadStory360
  });
})();
