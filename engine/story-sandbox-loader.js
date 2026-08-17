// story-sandbox-loader.js
// Изолированно выполняет авторские story.js и story360.js в Worker и возвращает странице только данные.

(function() {
  "use strict";

  var SANDBOX_LOAD_TIMEOUT_MS = 10000;
  var STORY360_FORMAT_VERSION = 1;

  // Этот bootstrap работает только внутри отдельного Worker и держит MessagePort в недоступном скрипту замыкании.
  function workerBootstrap() {
    "use strict";

    var STORY_TEXT_MAX_LENGTH = 8 * 1024 * 1024;
    var STORY360_MAX_DEPTH = 64;
    var STORY360_MAX_ENTRIES = 250000;
    var STORY360_MAX_STRING_LENGTH = 4 * 1024 * 1024;
    var STORY360_MAX_TOTAL_STRING_LENGTH = 16 * 1024 * 1024;
    var initialized = false;
    var SafeArray = Array;
    var SafeError = Error;
    var SafeString = String;
    var SafeWeakSet = WeakSet;
    var safeArrayIsArray = Array.isArray;
    var safeNumberIsFinite = Number.isFinite;
    var safeObjectCreate = Object.create;
    var safeObjectDefineProperty = Object.defineProperty;
    var safeObjectGetPrototypeOf = Object.getPrototypeOf;
    var safeObjectKeys = Object.keys;
    var safeObjectPrototype = Object.prototype;
    var safeWeakSetAdd = Function.prototype.call.bind(WeakSet.prototype.add);
    var safeWeakSetDelete = Function.prototype.call.bind(WeakSet.prototype.delete);
    var safeWeakSetHas = Function.prototype.call.bind(WeakSet.prototype.has);
    var unsafeObjectKeys = safeObjectCreate(null);
    unsafeObjectKeys.__proto__ = true;
    unsafeObjectKeys.prototype = true;
    unsafeObjectKeys.constructor = true;

    // Проверяет STORY_TEXT внутри Worker, чтобы слишком длинная строка не попала в structured clone.
    function validateStoryText(value) {
      if (typeof value !== "string") {
        throw new SafeError("Файл загружен, но не создал строку window.STORY_TEXT.");
      }
      if (value.length > STORY_TEXT_MAX_LENGTH) {
        throw new SafeError("STORY_TEXT превышает допустимый размер.");
      }
      return value;
    }

    // Резервирует узлы до создания копии и тем самым быстро отклоняет заведомо слишком большие ветви.
    function reserveStory360Nodes(state, count, message) {
      if (count > STORY360_MAX_ENTRIES - state.nodes) {
        throw new SafeError(message);
      }
    }

    // Рекурсивно строит ограниченную JSON-подобную копию, учитывая контейнеры и все примитивные значения.
    function copyStory360Value(value, state, depth) {
      if (depth > STORY360_MAX_DEPTH) {
        throw new SafeError("STORY360 превышает допустимую глубину вложенности.");
      }

      reserveStory360Nodes(state, 1, "STORY360 содержит слишком много элементов.");
      state.nodes += 1;

      if (value === null || typeof value === "boolean") return value;
      if (typeof value === "number") {
        if (!safeNumberIsFinite(value)) throw new SafeError("STORY360 содержит некорректное число.");
        return value;
      }
      if (typeof value === "string") {
        if (value.length > STORY360_MAX_STRING_LENGTH) {
          throw new SafeError("STORY360 содержит слишком длинную строку.");
        }
        state.totalStringLength += value.length;
        if (state.totalStringLength > STORY360_MAX_TOTAL_STRING_LENGTH) {
          throw new SafeError("Суммарный размер строк STORY360 превышает допустимый предел.");
        }
        return value;
      }
      if (!value || typeof value !== "object") {
        throw new SafeError("STORY360 содержит значение неподдерживаемого типа.");
      }
      if (safeWeakSetHas(state.seen, value)) {
        throw new SafeError("STORY360 содержит циклическую ссылку.");
      }

      safeWeakSetAdd(state.seen, value);

      var result;
      if (safeArrayIsArray(value)) {
        // Каждый слот массива потребует минимум один узел, поэтому квота проверяется до выделения второй структуры.
        reserveStory360Nodes(state, value.length, "STORY360 содержит слишком много элементов массива.");
        result = new SafeArray(value.length);
        for (var i = 0; i < value.length; i++) {
          safeObjectDefineProperty(result, i, {
            value: copyStory360Value(value[i], state, depth + 1),
            configurable: true,
            enumerable: true,
            writable: true
          });
        }
      } else {
        var prototype = safeObjectGetPrototypeOf(value);
        if (prototype !== safeObjectPrototype && prototype !== null) {
          throw new SafeError("STORY360 содержит объект с неподдерживаемым прототипом.");
        }
        result = safeObjectCreate(null);
        var keys = safeObjectKeys(value);
        // Каждое поле содержит значение, которое будет отдельным учитываемым узлом.
        reserveStory360Nodes(state, keys.length, "STORY360 содержит слишком много полей.");
        for (var keyIndex = 0; keyIndex < keys.length; keyIndex++) {
          var key = keys[keyIndex];
          if (unsafeObjectKeys[key]) {
            throw new SafeError("STORY360 содержит небезопасный ключ " + key + ".");
          }
          result[key] = copyStory360Value(value[key], state, depth + 1);
        }
      }

      safeWeakSetDelete(state.seen, value);
      return result;
    }

    // Проверяет версию и обязательную форму корня до обхода, затем возвращает ограниченную копию STORY360.
    function validateStory360(value, expectedFormatVersion) {
      if (!value || typeof value !== "object" || safeArrayIsArray(value)) {
        throw new SafeError("STORY360 должен быть объектом.");
      }
      if (!safeNumberIsFinite(value.version) || value.version !== expectedFormatVersion) {
        throw new SafeError("STORY360 имеет отсутствующую или неподдерживаемую версию формата.");
      }
      if (!value.spaces || typeof value.spaces !== "object" || safeArrayIsArray(value.spaces)) {
        throw new SafeError("STORY360 должен содержать объект spaces.");
      }

      var copied = copyStory360Value(value, {
        seen: new SafeWeakSet(),
        nodes: 0,
        totalStringLength: 0
      }, 0);

      // Повторная проверка относится уже к копии и защищает от изменяемых getter/proxy исходного объекта.
      if (copied.version !== expectedFormatVersion) {
        throw new SafeError("STORY360 имеет отсутствующую или неподдерживаемую версию формата.");
      }
      if (!copied.spaces || typeof copied.spaces !== "object" || safeArrayIsArray(copied.spaces)) {
        throw new SafeError("STORY360 должен содержать объект spaces.");
      }
      return copied;
    }

    // Подменяет Worker API до запуска файла и аварийно прекращает sandbox, если блокировку нельзя гарантировать.
    function blockWorkerGlobal(name, replacement) {
      try {
        safeObjectDefineProperty(self, name, {
          value: replacement,
          configurable: false,
          enumerable: false,
          writable: false
        });
      } catch (error) {
        try { self[name] = replacement; } catch (ignored) {
          throw new SafeError("Не удалось заблокировать Worker API " + name + ".");
        }
      }
      if (self[name] !== replacement) {
        throw new SafeError("Worker API " + name + " сохранил небезопасное значение.");
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
      var story360FormatVersion = event.data.story360FormatVersion;
      var loadScript = self.importScripts.bind(self);
      var dataWindow = safeObjectCreate(null);
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
          } catch (ignored) {
            // Ошибка отправки ответа означает закрытый канал и не требует повторной отправки.
          }
        }
        try { closePort(); } catch (ignoredClose) {
          // Канал мог быть уже закрыт другой стороной.
        }
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
      try {
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
          throw new SafeError("Пользовательскому сценарию запрещено подключать дополнительные скрипты.");
        });
      } catch (blockError) {
        finish({
          status: "invalid",
          kind: kind,
          message: "Безопасное окружение Worker недоступно: " + SafeString(blockError && blockError.message ? blockError.message : blockError)
        });
        return;
      }

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
        try {
          var safeStoryText = validateStoryText(dataWindow.STORY_TEXT);
          finish({ status: "loaded", kind: kind, value: safeStoryText });
        } catch (validationError) {
          finish({
            status: "invalid",
            kind: kind,
            message: validationError && validationError.message
              ? SafeString(validationError.message)
              : "Некорректный STORY_TEXT."
          });
        }
        return;
      }

      try {
        var safeStory360 = validateStory360(dataWindow.STORY360, story360FormatVersion);
        finish({ status: "loaded", kind: kind, value: safeStory360 });
      } catch (story360ValidationError) {
        finish({
          status: "invalid",
          kind: kind,
          message: story360ValidationError && story360ValidationError.message
            ? SafeString(story360ValidationError.message)
            : "Некорректный STORY360."
        });
      }
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
          try { URL.revokeObjectURL(workerUrl); } catch (revokeError) {
            // Worker не создан, поэтому повторная очистка URL выполняется best-effort.
          }
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
          try { channel.port1.close(); } catch (closeError) {
            // Порт мог быть уже закрыт обработчиком ответа или ошибки.
          }
          try { channel.port2.close(); } catch (closeError2) {
            // Порт мог быть уже закрыт обработчиком ответа или ошибки.
          }
        }
        if (worker) {
          try { worker.terminate(); } catch (terminateError) {
            // Worker мог завершиться самостоятельно до общей очистки.
          }
        }
        if (workerUrl) {
          try { URL.revokeObjectURL(workerUrl); } catch (revokeError) {
            // URL уже не используется, повторное освобождение выполняется best-effort.
          }
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
        kind: kind,
        story360FormatVersion: STORY360_FORMAT_VERSION
      }, [channel.port2]);
    });
  }

  // Загружает story.js; ограничение размера применяется внутри Worker до передачи строки странице.
  function loadStoryText(source) {
    return loadSandboxedScript(source, "story");
  }

  // Восстанавливает нулевые прототипы объектов после structured clone без создания ещё одной глубокой копии.
  function hardenValidatedStory360Value(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (var arrayIndex = 0; arrayIndex < value.length; arrayIndex++) {
        hardenValidatedStory360Value(value[arrayIndex]);
      }
      return;
    }

    Object.setPrototypeOf(value, null);
    var keys = Object.keys(value);
    for (var keyIndex = 0; keyIndex < keys.length; keyIndex++) {
      hardenValidatedStory360Value(value[keys[keyIndex]]);
    }
  }

  // Загружает story360.js; Worker передаёт странице только уже проверенную ограниченную копию.
  function loadStory360(source) {
    return loadSandboxedScript(source, "story360").then(function(result) {
      if (result.status === "loaded") hardenValidatedStory360Value(result.value);
      return result;
    });
  }

  window.VNStorySandboxLoader = Object.freeze({
    STORY360_FORMAT_VERSION: STORY360_FORMAT_VERSION,
    loadStoryText: loadStoryText,
    loadStory360: loadStory360
  });
})();
