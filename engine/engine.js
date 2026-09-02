/* engine.js
   Офлайн VN-движок: классические скрипты без ES-модулей и сборщика для максимальной совместимости.
*/
(function () {
  "use strict";

// Проверяет явно включённую через ?Debug= категорию и безопасно отключает её при ошибке конфигурации.
function isExplicitDebugCategoryEnabled(category) {
  try {
    return typeof window.VN_DEBUG_ENABLED === "function" && window.VN_DEBUG_ENABLED(category);
  } catch (error) {
    return false;
  }
}

// Определяет обычный режим диагностики без влияния на исполнение новеллы при неполной ранней загрузке.
function isRuntimeDebugModeEnabled() {
  try {
    return getStoryMode() === "debug";
  } catch (error) {
    return false;
  }
}

// Убирает query/hash и содержимое data/blob URL, чтобы диагностический журнал не раскрывал токены и встроенные данные.
function sanitizeDiagnosticResource(value) {
  var raw = String(value || "");
  if (!raw) return "";
  if (/^data:/i.test(raw)) return "[data-url]";
  if (/^blob:/i.test(raw)) return "[blob-url]";

  var queryIndex = raw.indexOf("?");
  var hashIndex = raw.indexOf("#");
  var cutIndex = raw.length;
  if (queryIndex >= 0) cutIndex = Math.min(cutIndex, queryIndex);
  if (hashIndex >= 0) cutIndex = Math.min(cutIndex, hashIndex);
  return raw.substring(0, cutIndex);
}

// Очищает только URL-поля небольшого диагностического объекта, не обходя runtime-структуры истории.
function sanitizeDiagnosticDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return details;
  var result = {};
  Object.keys(details).forEach(function(key) {
    var value = details[key];
    if (/(?:src|url|file|poster|fallback)$/i.test(key)) {
      result[key] = sanitizeDiagnosticResource(value);
    } else {
      result[key] = value;
    }
  });
  return result;
}

// Выводит краткую диагностику в debug или при явном ?Debug=runtime; ошибки используют прямой console.error/warn.
function writeRuntimeDebug() {
  if (!isRuntimeDebugModeEnabled() && !isExplicitDebugCategoryEnabled("runtime")) return;
  try {
    console.log.apply(console, arguments);
  } catch (error) {
    // Недоступная консоль не должна влиять на выполнение runtime.
  }
}

// Оставляет старые подробные сообщения только для целевой диагностики ?Debug=runtime или ?Debug=all.
function writeRuntimeVerbose() {
  if (!isExplicitDebugCategoryEnabled("runtime")) return;
  try {
    console.log.apply(console, arguments);
  } catch (error) {
    // Недоступная консоль не должна влиять на выполнение runtime.
  }
}

// =========================================================
// ПРОФАЙЛЕР ВРЕМЕНИ
// =========================================================
var profiler = {
  startTime: Date.now(),
  marks: {},
  
  mark: function(name) {
    this.marks[name] = Date.now() - this.startTime;
    writeRuntimeVerbose('[PROFILER]', name, ':', this.marks[name] + 'ms');
  },
  
  getReport: function() {
    var report = "Load and execution time:\n";
    report += "  Start: 0ms\n";
    
    // Сортируем метки по времени
    var sortedMarks = Object.keys(this.marks).sort(function(a, b) {
        return profiler.marks[a] - profiler.marks[b];
    });
    
    var lastTime = 0;
    sortedMarks.forEach(function(name) {
      var time = profiler.marks[name];
      report += "  " + name + ": " + time + "ms (+" + (time - lastTime) + "ms)\n";
      lastTime = time;
    });
    
    var totalTime = Date.now() - profiler.startTime;
    report += "\n  Total time: " + totalTime + "ms (" + (totalTime/1000).toFixed(2) + "с)\n";





    if (this.marks['First screen is ready'] !== undefined) {
      report += "  To the first screen: " + this.marks['First screen is ready'] + "ms (" +
        (this.marks['First screen is ready']/1000).toFixed(2) + "с)\n";
    }

    if (window.LOADER_STATS && window.LOADER_STATS.startTime) {
      var totalFromLoaderStart = Date.now() - window.LOADER_STATS.startTime;
      report += "  From the loader's startup to the display of statistics: " + totalFromLoaderStart + "ms (" +
        (totalFromLoaderStart/1000).toFixed(2) + "с)\n";

      if (this.marks['First screen is ready'] !== undefined) {
        var firstScreenFromLoaderStart =
          (profiler.startTime - window.LOADER_STATS.startTime) + this.marks['First screen is ready'];

        report += "  From the loader's startup to the first screen: " + firstScreenFromLoaderStart + "ms (" +
          (firstScreenFromLoaderStart/1000).toFixed(2) + "с)\n";
      }
    }




    // Оценка сложности сценария
    if (window.STORY) {
      var sceneCount = window.STORY.scenes ? window.STORY.scenes.length : 0;
      var actionCount = 0;
      window.STORY.scenes.forEach(function(scene) {
        actionCount += scene.actions ? scene.actions.length : 0;
      });
      
      report += "\nScenario complexity:\n";
      report += "  Scenes: " + sceneCount + "\n";
      report += "  Actions: " + actionCount + "\n";
      report += "  Average time per scene: " + (totalTime / Math.max(1, sceneCount)).toFixed(2) + "ms\n";
      report += "  Average time per action: " + (totalTime / Math.max(1, actionCount)).toFixed(2) + "ms\n";
    }

    return report;
  }
};

// Ставим первую метку
profiler.mark('The script has started loading');




// === ЗАЩИТА ОТ СИСТЕМНЫХ МЕНЮ И ВЫДЕЛЕНИЯ ===
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('selectstart', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => {
  if (e.target.tagName === 'IMG' || e.target.closest('img')) e.preventDefault();
});
if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  document.body.style.webkitTouchCallout = 'none';
}






const UI_I18N = {
  en: {
    mute: "Mute",
    volume: "Volume",
    settings: "About app",
    stats: "Stats",
    restart: "Restart story",
    next: "Next",
    choices: "Choices",
    game: "Game",
    closeGame: "Close Game",
    restartGame: "Restart Game",
    gameNavigationBlocked: "The game was stopped after an unexpected navigation or reload. Use the restart button to try again.",
    hintContinue: "Click to continue",
    statsTitle: "Script Statistics",
    fullGraphButton: "📊 Full Graph",
    resourcesGraphButton: "📦 Resources graph",
    textButton: "📄 Text",
    fullGraphButtonTitle: "Show full graph",
    resourcesGraphButtonTitle: "Compact resources graph: start scene only, same full asset blocks as the main graph",
    textButtonTitle: "Show text statistics",
    settingsTitle: "About app",
    closeSettings: "Close app info",
    closeStats: "Close stats",
    zoomOut: "Zoom Out",
    zoomIn: "Zoom In",
    zoomReset: "Reset zoom",
    copyCode: "📋 Copy code",
    refresh: "🔄 Refresh",
    copied: "✅ Copied!",
    copyError: "Failed to copy code",
    loadingStory: "Loading story...",
    parseErrorTitle: "❌ SCRIPT PARSE ERROR:",
    parseErrorHint: "Please fix the errors in the story.js file",
    statsRenderError: "Error generating statistics:",
    statsFileError: "File verification error:",
    mermaidRenderError: "Mermaid graph rendering error:",
    mermaidScriptError: "Could not load Mermaid library:",
    gamesButton: "🎮 Games",
    gamesButtonTitle: "Show/hide games",
    gamesNoCover: "No preview",
    gamesLastLaunchNone: "Last launch: —",
    gamesLastLaunchClosed: "Last launch: {title}, difficulty {difficulty}, closed manually",
    gamesLastLaunchResult: "Last launch: {title}, difficulty {difficulty}, result {result}",
    gamesLaunchFailed: "Unable to launch the game",
    gamesNoGames: "No games found",
    videoSkipHint: "Click to skip",
    videoUnavailable: "Video unavailable",
    bgScrollHint: "Move background sideways",
    bg360Hint: "Move viewpoint"
  },
  ru: {
    mute: "Звук",
    volume: "Громкость",
    settings: "Информация о программе",
    stats: "Статистика",
    restart: "Перезапустить историю",
    next: "Далее",
    choices: "Выбор",
    game: "Игра",
    closeGame: "Закрыть игру",
    restartGame: "Перезапустить",
    gameNavigationBlocked: "Игра остановлена после самостоятельного перехода или перезагрузки. Для повторного запуска нажмите кнопку перезапуска.",
    hintContinue: "Нажмите, чтобы продолжить",
    statsTitle: "Статистика сценария",
    fullGraphButton: "📊 Граф полный",
    resourcesGraphButton: "📦 Граф ресурсов",
    textButton: "📄 Текст",
    fullGraphButtonTitle: "Показать полный граф",
    resourcesGraphButtonTitle: "Компактный граф ресурсов: на схеме только стартовая сцена, блоки ассетов — полные, как на основном графе",
    textButtonTitle: "Показать текстовую статистику",
    settingsTitle: "Информация о программе",
    closeSettings: "Закрыть информацию",
    closeStats: "Закрыть статистику",
    zoomOut: "Уменьшить",
    zoomIn: "Увеличить",
    zoomReset: "Сбросить масштаб",
    copyCode: "📋 Копировать код",
    refresh: "🔄 Обновить",
    copied: "✅ Скопировано!",
    copyError: "Не удалось скопировать код",
    loadingStory: "Загрузка сценария...",
    parseErrorTitle: "❌ ОШИБКА ПАРСИНГА СЦЕНАРИЯ:",
    parseErrorHint: "Исправьте ошибки в файле story.js",
    statsRenderError: "Ошибка генерации статистики:",
    statsFileError: "Ошибка проверки файлов:",
    mermaidRenderError: "Ошибка рендера графа Mermaid:",
    mermaidScriptError: "Не удалось загрузить библиотеку Mermaid:",
    gamesButton: "🎮 Игры",
    gamesButtonTitle: "Показать/скрыть игры",
    gamesNoCover: "Нет превью",
    gamesLastLaunchNone: "Последний запуск: —",
    gamesLastLaunchClosed: "Последний запуск: {title}, сложность {difficulty}, игра закрыта вручную",
    gamesLastLaunchResult: "Последний запуск: {title}, сложность {difficulty}, результат {result}",
    gamesLaunchFailed: "Не удалось запустить игру",
    gamesNoGames: "Игры не найдены",
    videoSkipHint: "Нажмите, чтобы пропустить",
    videoUnavailable: "Видео недоступно",
    bgScrollHint: "Перемещайте фон",
    bg360Hint: "Двигайте обзор, приближайте"
  }
};

function getCurrentUiLanguage() {
  var lang =
    (window.STORY && window.STORY.meta && window.STORY.meta.lang) ||
    window.STORY_LANG ||
    'en';

  lang = String(lang || 'en').toLowerCase();
  if (!UI_I18N[lang]) lang = 'en';
  return lang;
}

function t(key) {
  var lang = getCurrentUiLanguage();
  return (UI_I18N[lang] && UI_I18N[lang][key]) || UI_I18N.en[key] || key;
}

function applyUiLanguage() {
  var html = document.documentElement;
  if (html) {
    html.lang = getCurrentUiLanguage();
  }

  var btnMute = document.getElementById("btnMute");
  if (btnMute) btnMute.setAttribute("aria-label", t("mute"));

  var volume = document.getElementById("volume");
  if (volume) volume.setAttribute("aria-label", t("volume"));

  var btnSettings = document.getElementById("btnSettings");
  if (btnSettings) {
    btnSettings.setAttribute("aria-label", t("settings"));
    btnSettings.title = t("settings");
  }

  var btnStats = document.getElementById("btnStats");
  if (btnStats) btnStats.setAttribute("aria-label", t("stats"));

  var btnRestart = document.getElementById("btnRestart");
  if (btnRestart) btnRestart.setAttribute("aria-label", t("restart"));

  var dialog = document.getElementById("dialog");
  if (dialog) dialog.setAttribute("aria-label", t("next"));

  var choices = document.getElementById("choices");
  if (choices) choices.setAttribute("aria-label", t("choices"));

  var gameModal = document.getElementById("gameModal");
  if (gameModal) gameModal.setAttribute("aria-label", t("game"));

  var statsGameModal = document.getElementById("statsGameModal");
  if (statsGameModal) statsGameModal.setAttribute("aria-label", t("game"));

  var btnCloseGame = document.getElementById("btnCloseGame");
  if (btnCloseGame) btnCloseGame.textContent = getStoryGameControlButtonText();

  var btnCloseStatsGame = document.getElementById("btnCloseStatsGame");
  if (btnCloseStatsGame) btnCloseStatsGame.textContent = t("closeGame");

  var hint = document.querySelector(".hint");
  if (hint) hint.textContent = t("hintContinue");

  var bgScrollHint = document.getElementById("bgScrollHint");
  if (bgScrollHint) {
    var hintKey = bgScrollHint.classList.contains("is-360") ? "bg360Hint" : "bgScrollHint";
    bgScrollHint.textContent = t(hintKey);
  }

  var statsTitle = document.querySelector(".statsTitle");
  if (statsTitle) statsTitle.textContent = t("statsTitle");
  var settingsTitle = document.querySelector(".settingsTitle");
  if (settingsTitle) settingsTitle.textContent = t("settingsTitle");

  var btnShowFullGraph = document.getElementById("btnShowFullGraph");
  if (btnShowFullGraph) {
    btnShowFullGraph.textContent = t("fullGraphButton");
    btnShowFullGraph.title = t("fullGraphButtonTitle");
    btnShowFullGraph.classList.toggle("is-active", window.currentStatsView === "graph-full");
    btnShowFullGraph.setAttribute("aria-pressed", window.currentStatsView === "graph-full" ? "true" : "false");
  }

  var btnShowResourcesGraph = document.getElementById("btnShowResourcesGraph");
  if (btnShowResourcesGraph) {
    btnShowResourcesGraph.textContent = t("resourcesGraphButton");
    btnShowResourcesGraph.title = t("resourcesGraphButtonTitle");
    btnShowResourcesGraph.classList.toggle("is-active", window.currentStatsView === "graph-resources");
    btnShowResourcesGraph.setAttribute("aria-pressed", window.currentStatsView === "graph-resources" ? "true" : "false");
  }

  var btnShowGames = document.getElementById("btnShowGames");
  if (btnShowGames) {
    btnShowGames.textContent = t("gamesButton");
    btnShowGames.title = t("gamesButtonTitle");
    btnShowGames.classList.toggle("is-active", window.currentStatsView === "games");
    btnShowGames.setAttribute("aria-pressed", window.currentStatsView === "games" ? "true" : "false");
  }

  var btnShowText = document.getElementById("btnShowText");
  if (btnShowText) {
    btnShowText.textContent = t("textButton");
    btnShowText.title = t("textButtonTitle");
    btnShowText.classList.toggle("is-active", window.currentStatsView === "text");
    btnShowText.setAttribute("aria-pressed", window.currentStatsView === "text" ? "true" : "false");
  }

  var btnCloseStats = document.getElementById("btnCloseStats");
  if (btnCloseStats) btnCloseStats.setAttribute("aria-label", t("closeStats"));
  var btnCloseSettings = document.getElementById("btnCloseSettings");
  if (btnCloseSettings) btnCloseSettings.setAttribute("aria-label", t("closeSettings"));

  var zoomOutBtn = document.getElementById("zoomOutBtn");
  if (zoomOutBtn) zoomOutBtn.title = t("zoomOut");

  var zoomInBtn = document.getElementById("zoomInBtn");
  if (zoomInBtn) zoomInBtn.title = t("zoomIn");

  var zoomResetBtn = document.getElementById("zoomResetBtn");
  if (zoomResetBtn) zoomResetBtn.title = t("zoomReset");

  var btnCopyMermaid = document.getElementById("btnCopyMermaid");
  if (btnCopyMermaid) btnCopyMermaid.textContent = t("copyCode");

  var btnRefreshGraph = document.getElementById("btnRefreshGraph");
  if (btnRefreshGraph) btnRefreshGraph.textContent = t("refresh");

}

function getStoryGameControlButtonText(mode) {
  var isUrlGameMode = mode === "url" || (
    typeof state !== "undefined" &&
    state &&
    state.currentGame &&
    state.currentGame.mode === "url"
  );
  return isUrlGameMode ? t("restartGame") : t("closeGame");
}

function updateStoryGameControlButtonLabel(mode) {
  var btnCloseGame = document.getElementById("btnCloseGame");
  if (!btnCloseGame) return;
  btnCloseGame.textContent = getStoryGameControlButtonText(mode);
}

window.showingGraph = false;
window.currentStatsView = "text";


var firstScreenMetrics = {
  waitingForCharacter: false,
  firstScreenShown: false
};

function markFirstScreenReady(reason) {
  if (firstScreenMetrics.firstScreenShown) return;

  firstScreenMetrics.firstScreenShown = true;
  profiler.mark('First screen is ready');

  writeRuntimeDebug('[VN DEBUG] Первый экран готов', {
    reason: reason,
    totalFromEngineStart: Date.now() - profiler.startTime,
    loaderStartExists: !!window.LOADER_STATS,
    totalFromLoaderStart: window.LOADER_STATS
      ? (Date.now() - window.LOADER_STATS.startTime)
      : null
  });
}





// Mermaid подключается лениво (см. ensureMermaidScriptLoaded), чтобы не тянуть ~сотни KB на старте новеллы.

// Относительный URL UMD-сборки; должен совпадать с бывшим тегом <script> в index.html.
var MERMAID_SCRIPT_SRC = "lib/mermaid.min.js";

// Одно общее Promise на сессию: параллельные вызовы не создают второй <script>.
var mermaidScriptLoadPromise = null;

/**
 * Задаёт глобальные параметры Mermaid после загрузки библиотеки.
 * Вызывается один раз при первом успешном подключении скрипта.
 */
function configureMermaidLibrary() {
  if (!window.mermaid || typeof window.mermaid.initialize !== "function") {
    return;
  }

  window.mermaid.initialize({
    startOnLoad: false,
    // Strict запрещает Mermaid добавлять активные ссылки и необработанный HTML из текста диаграммы.
    securityLevel: "strict",
    suppressErrorRendering: false,

    // главное для больших графов
    maxTextSize: 350000,
    maxEdges: 5000,

    theme: "default",
    flowchart: {
      useMaxWidth: false,
      htmlLabels: true,
      curve: "basis",
      padding: 4,
      nodeSpacing: 60,
      rankSpacing: 100
    }
  });
}

/**
 * Гарантирует наличие window.mermaid: при первом вызове вставляет <script> и ждёт onload.
 * Повторные вызовы возвращают то же Promise; при ошибке загрузки Promise сбрасывается для повторной попытки.
 */
function ensureMermaidScriptLoaded() {
  if (window.mermaid && typeof window.mermaid.initialize === "function") {
    return Promise.resolve();
  }

  if (mermaidScriptLoadPromise) {
    return mermaidScriptLoadPromise;
  }

  mermaidScriptLoadPromise = new Promise(function(resolve, reject) {
    var script = document.createElement("script");
    script.src = MERMAID_SCRIPT_SRC;
    script.async = true;
    script.setAttribute("data-vn-mermaid", "1");

    script.onload = function() {
      try {
        configureMermaidLibrary();
      } catch (err) {
        mermaidScriptLoadPromise = null;
        reject(err);
        return;
      }
      resolve();
    };

    script.onerror = function() {
      mermaidScriptLoadPromise = null;
      reject(new Error(MERMAID_SCRIPT_SRC));
    };

    document.head.appendChild(script);
  });

  return mermaidScriptLoadPromise;
}



// Для получения версии из GitHub. Заменяется только первая найденная метка версии (см. ниже)
window.APP_VERSION = "__VERSION__";

if (window.APP_VERSION === "__VERSION__") {
  window.APP_VERSION = "0.0.0.0dev";
}

// =========================================================
// ЛИЦЕНЗИРОВАНИЕ
// =========================================================

var VN_LICENSE_KEY_PREFIX = "VNV1";
var VN_LICENSE_PRODUCT_ID = "vn-vertical-engine";
var VN_LICENSE_PUBLIC_KEY_PEM = [
  "-----BEGIN PUBLIC KEY-----",
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAryWstNi/un/SfbCR/zBy",
  "LtGWzGo3/6g+1jDnQxUYiklUCtrWRz2UPryscp27T2WozjCVo5xFen0laVuLfmYd",
  "BW0GgB7A8D/4xHeGa69oJr122rUTRv+X0PrU0rGgANqYVJ4J2O2b8pACfLd2+kL+",
  "1ySX2fQrWlxgSzBmTboXJhk9bnp/snAwkj+sE/5HMCtJ7oEjOas1JOtprwR/fy2H",
  "Hm2QNifOT6w36rUSL+xHVZI5ITeK0zyzbm6rsCXVAVo/Iz2d52nOj8zJZgGHvlTN",
  "Neik9+0QXBCKeDYvuBOtyn6M499DQtArpoiYiWspdchELF+TCGTfr4SVf2pgYzke",
  "IQIDAQAB",
  "-----END PUBLIC KEY-----"
].join("\n");

var licenseStartRequested = false;
window.VN_LICENSE = createLicenseState("pending", false, null, "License has not been checked yet.");

// Создаёт единый объект состояния лицензии, чтобы остальной движок не зависел от деталей проверки подписи.
function createLicenseState(status, valid, payload, message) {
  return {
    valid: !!valid,
    status: status || "unknown",
    mode: valid ? "registered" : "unregistered",
    payload: payload || null,
    message: message || "",
    checkedAt: new Date().toISOString()
  };
}

// Возвращает productId, на который должна быть выписана лицензия для текущей сборки.
function getExpectedLicenseProductId() {
  return VN_LICENSE_PRODUCT_ID;
}

// Забирает ключ из опционального license-key.js и не падает, если файл отсутствует.
function getRawLicenseKey() {
  return String(window.VN_LICENSE_KEY || "").trim();
}

// Декодирует base64url-сегмент лицензионного ключа в байты для JSON и подписи.
function base64UrlToBytes(value) {
  var base64 = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";

  var binary = atob(base64);
  var bytes = new Uint8Array(binary.length);

  for (var i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

// Декодирует UTF-8 байты payload обратно в JSON-строку лицензии.
function bytesToUtf8Text(bytes) {
  if (window.TextDecoder) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  var binary = "";
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return decodeURIComponent(escape(binary));
}

// Кодирует строку в UTF-8 для WebCrypto и сохраняет работу в браузерах без TextEncoder.
function utf8TextToBytes(value) {
  if (window.TextEncoder) {
    return new TextEncoder().encode(String(value || ""));
  }

  var binary = unescape(encodeURIComponent(String(value || "")));
  var bytes = new Uint8Array(binary.length);

  for (var i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

// Удаляет PEM-обрамление и возвращает DER-байты публичного ключа для importKey.
function pemPublicKeyToBytes(pem) {
  var base64 = String(pem || "")
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s/g, "");

  return base64UrlToBytes(base64);
}

// Кодирует байты подписи в hex-строку, потому что jsrsasign принимает подписи в hex.
function bytesToHex(bytes) {
  var hex = "";
  for (var i = 0; i < bytes.length; i++) {
    hex += ("0" + bytes[i].toString(16)).slice(-2);
  }

  return hex;
}

// Проверяет наличие нативного WebCrypto со всеми операциями, нужными для RSA-PSS.
function isWebCryptoAvailable() {
  return !!(
    window.crypto &&
    window.crypto.subtle &&
    typeof window.crypto.subtle.importKey === "function" &&
    typeof window.crypto.subtle.verify === "function"
  );
}

// Проверяет RSA-PSS подпись через WebCrypto; null означает, что следует применить резервный путь.
function verifyLicenseSignatureWithWebCrypto(dataToVerify, signatureBytes) {
  if (!isWebCryptoAvailable()) {
    return Promise.resolve(null);
  }

  try {
    var publicKeyBytes = pemPublicKeyToBytes(VN_LICENSE_PUBLIC_KEY_PEM);
    var signedDataBytes = utf8TextToBytes(dataToVerify);

    return window.crypto.subtle.importKey(
      "spki",
      publicKeyBytes,
      { name: "RSA-PSS", hash: "SHA-256" },
      false,
      ["verify"]
    ).then(function(publicKey) {
      return window.crypto.subtle.verify(
        { name: "RSA-PSS", saltLength: 32 },
        publicKey,
        signatureBytes,
        signedDataBytes
      );
    }).then(function(isValid) {
      return !!isValid;
    }).catch(function(error) {
      console.warn("[LICENSE] WebCrypto verification unavailable, using local fallback:", error);
      return null;
    });
  } catch (error) {
    console.warn("[LICENSE] WebCrypto setup failed, using local fallback:", error);
    return Promise.resolve(null);
  }
}

// Проверяет наличие локально подключённой MIT-библиотеки jsrsasign для резервной проверки.
function isJsrsasignAvailable() {
  return !!(
    window.KJUR &&
    window.KJUR.crypto &&
    window.KJUR.crypto.Signature &&
    window.KEYUTIL
  );
}

// Проверяет RSA-PSS подпись через jsrsasign, когда WebCrypto отсутствует или завершился ошибкой.
function verifyLicenseSignatureWithJsrsasign(dataToVerify, signatureBytes) {
  if (!isJsrsasignAvailable()) {
    return Promise.resolve(null);
  }

  try {
    var signature = new window.KJUR.crypto.Signature({
      alg: "SHA256withRSAandMGF1",
      psssaltlen: 32
    });

    signature.init(window.KEYUTIL.getKey(VN_LICENSE_PUBLIC_KEY_PEM));
    signature.updateString(dataToVerify);

    return Promise.resolve(!!signature.verify(bytesToHex(signatureBytes)));
  } catch (error) {
    console.warn("[LICENSE] jsrsasign verification failed:", error);
    return Promise.resolve(false);
  }
}

// Принимает успешный WebCrypto сразу, а отрицательный или недоступный результат перепроверяет через jsrsasign.
function verifyLicenseSignature(dataToVerify, signatureBytes) {
  return verifyLicenseSignatureWithWebCrypto(dataToVerify, signatureBytes).then(function(webCryptoResult) {
    if (webCryptoResult === true) {
      return true;
    }

    return verifyLicenseSignatureWithJsrsasign(dataToVerify, signatureBytes).then(function(jsrsasignResult) {
      return jsrsasignResult === null ? webCryptoResult : jsrsasignResult;
    });
  });
}

// Разбирает строку VNV1.<payload>.<signature> и отделяет подписанные данные от подписи.
function parseLicensePayload(rawKey) {
  var parts = String(rawKey || "").trim().split(".");
  if (parts.length !== 3 || parts[0] !== VN_LICENSE_KEY_PREFIX) {
    throw new Error("Invalid license key format.");
  }

  var payloadText = bytesToUtf8Text(base64UrlToBytes(parts[1]));
  var payload = JSON.parse(payloadText);

  return {
    payload: payload,
    dataToVerify: parts[0] + "." + parts[1],
    signatureBytes: base64UrlToBytes(parts[2])
  };
}

// Считает срок действия лицензии; дата без времени действует до конца указанного UTC-дня.
function getLicenseExpiryTime(expiresAt) {
  if (expiresAt === null || expiresAt === undefined || String(expiresAt).trim() === "") {
    return null;
  }

  var value = String(expiresAt).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    value += "T23:59:59.999Z";
  }

  var time = Date.parse(value);
  return isNaN(time) ? NaN : time;
}

// Проверяет бизнес-поля лицензии после успешной криптографической проверки подписи.
function validateLicensePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "License payload is empty.";
  }

  if (payload.schema !== 1) {
    return "Unsupported license schema.";
  }

  if (payload.productId !== getExpectedLicenseProductId()) {
    return "License belongs to another product.";
  }

  if (!/^[A-Z0-9]{2,5}-\d{2}-\d{4}-\d{6}$/.test(String(payload.licenseId || ""))) {
    return "License ID format is invalid.";
  }

  if (Object.prototype.hasOwnProperty.call(payload, "channel")) {
    return "License payload contains obsolete channel field.";
  }

  var quantity = payload.installations !== undefined ? payload.installations : payload.seats;
  var quantityNumber = Number(quantity);
  if (quantity !== undefined && (!isFinite(quantityNumber) || quantityNumber < 1)) {
    return "License quantity must be positive.";
  }

  var expiryTime = getLicenseExpiryTime(payload.expiresAt);
  if (isNaN(expiryTime)) {
    return "License expiration date is invalid.";
  }

  if (expiryTime !== null && Date.now() > expiryTime) {
    return "License has expired.";
  }

  return "";
}

// Выполняет полный цикл проверки: наличие ключа, формат, подпись и допустимость полей.
function resolveLicenseState() {
  var rawKey = getRawLicenseKey();
  if (!rawKey) {
    return Promise.resolve(createLicenseState("missing", false, null, "License key file is missing."));
  }

  var parsed;
  try {
    parsed = parseLicensePayload(rawKey);
  } catch (error) {
    return Promise.resolve(createLicenseState("invalid-format", false, null, error.message));
  }

  return verifyLicenseSignature(parsed.dataToVerify, parsed.signatureBytes).then(function(isSignatureValid) {
    if (isSignatureValid === null) {
      return createLicenseState("missing-verifier", false, parsed.payload, "No supported license signature verifier is available.");
    }

    if (!isSignatureValid) {
      return createLicenseState("invalid-signature", false, null, "License signature is invalid.");
    }

    var validationError = validateLicensePayload(parsed.payload);
    if (validationError) {
      return createLicenseState("invalid-payload", false, parsed.payload, validationError);
    }

    return createLicenseState("valid", true, parsed.payload, "License is valid.");
  }).catch(function(error) {
    return createLicenseState("check-error", false, parsed ? parsed.payload : null, error.message);
  });
}

// Кладёт статус лицензии в переменные сценария, чтобы история могла реагировать на режим поставки.
function applyLicenseStateToStoryVars() {
  if (!state || !state.vars) return;

  var license = window.VN_LICENSE || {};
  var payload = license.payload || {};

  state.vars.__licenseValid = !!license.valid;
  state.vars.__licenseStatus = license.status || "unknown";
  state.vars.__licenseMode = license.mode || "unregistered";
  state.vars.__licenseCustomer = payload.customer || "";
  state.vars.__licenseId = payload.licenseId || "";
  state.vars.__licenseInstallations = payload.installations || payload.seats || 0;
}

// Формирует короткий блок для текстовой статистики, чтобы установщик сразу видел статус лицензии.
function formatLicenseStatsText() {
  var license = window.VN_LICENSE || {};
  var payload = license.payload || {};
  var hasPayload = !!license.payload;
  var quantity = payload.installations || payload.seats || 0;
  var lines = [];

  if (license.status === "missing") {
    return [
      "License file: license-key.js not found",
      "Public license: noncommercial use is permitted under PolyForm Noncommercial 1.0.0.",
      "Permitted organizations include educational institutions and other organizations listed in the public license."
    ].join("\n") + "\n";
  }

  lines.push("License mode: " + (license.mode || "unknown"));
  lines.push("License status: " + (license.status || "unknown"));

  if (license.message) {
    lines.push("License message: " + license.message);
  }

  if (payload.customer) {
    lines.push("Licensed to: " + payload.customer);
  }

  if (payload.licenseId) {
    lines.push("License ID: " + payload.licenseId);
  }

  if (quantity) {
    lines.push("Licensed installations: " + quantity);
  }

  if (payload.issuedAt) {
    lines.push("License issued: " + payload.issuedAt);
  }

  if (hasPayload) {
    lines.push("License expires: " + (payload.expiresAt || "never"));
  }

  return lines.join("\n") + "\n";
}

// Запускает историю только после завершения проверки лицензии, но не блокирует незарегистрированный режим.
function startLicensedEngine() {
  if (licenseStartRequested) return;
  licenseStartRequested = true;
  window.VN_LICENSE = createLicenseState("checking", false, null, "License check is running.");

  resolveLicenseState().then(function(license) {
    window.VN_LICENSE = license;
    writeRuntimeDebug("[VN DEBUG] Лицензия", license.status, license.mode);
    restart();
  }).catch(function(error) {
    window.VN_LICENSE = createLicenseState("check-error", false, null, error.message);
    console.warn("[LICENSE] check failed:", error);
    restart();
  });
}

// Единый конфиг параметров интерфейса
// cssVar   — CSS-переменная
// default  — значение по умолчанию
// unit     — единица измерения
// type     — ожидаемый тип
// query    — можно ли задавать параметр через URL
// validate — дополнительная проверка значения
const UI_STYLE_CONFIG = {
  topSpacing: {
    cssVar: '--topSpacing',
    default: 0,
    unit: 'px',
    type: 'int',
    query: true,
    min: 0
  },
  rightSpacing: {
    cssVar: '--rightSpacing',
    default: 0,
    unit: 'px',
    type: 'int',
    query: true,
    min: 0
  },
  bottomSpacing: {
    cssVar: '--bottomSpacing',
    default: 0,
    unit: 'px',
    type: 'int',
    query: true,
    min: 0
  },
  leftSpacing: {
    cssVar: '--leftSpacing',
    default: 0,
    unit: 'px',
    type: 'int',
    query: true,
    min: 0
  },
  blurStrength: {
    cssVar: '--blurStrength',
    default: 50,
    unit: 'px',
    type: 'float',
    min: 0
  },
  blurBrightness: {
    cssVar: '--blurBrightness',
    default: 0.9,
    unit: '',
    type: 'float',
    min: 0
  },
  blurOpacity: {
    cssVar: '--blurOpacity',
    default: 0.95,
    unit: '',
    type: 'float',
    min: 0,
    max: 1
  }
};

const MAX_NOVEL_ASPECT_W = 10;
const MAX_NOVEL_ASPECT_H = 16;
const STORY_WINDOW_VERTICAL = "vertical";
const STORY_WINDOW_AUTO = "auto";

// ---------- DOM ----------
var elTitle = document.getElementById("title");
var elStage = document.getElementById("stage");
var elNovelWindow = document.getElementById("novelWindow");
var elBg = document.getElementById("bgLayer");
var elBgVideo = document.getElementById("bgVideoLayer");
var elBg360 = document.getElementById("bg360Layer");
var elBg360Hold = null;
var elBg360Marks = document.getElementById("bg360MarksLayer");
var elBg360PhotoViewer = document.getElementById("bg360PhotoViewer");
var elBg360PhotoViewport = document.getElementById("bg360PhotoViewport");
var elBg360PhotoInner = document.getElementById("bg360PhotoInner");
var elBg360PhotoImg = document.getElementById("bg360PhotoImg");
var elBg360PhotoViewerCaption = document.getElementById("bg360PhotoViewerCaption");
var elBgScrollHint = document.getElementById("bgScrollHint");
var elCharFrame = document.getElementById("charFrame");
var elChar = document.getElementById("charLayer");
var elStoryVideoOverlay = document.getElementById("storyVideoOverlay");
var elStoryVideo = document.getElementById("storyVideoLayer");
var elStoryVideoPoster = document.getElementById("storyVideoPoster");
var elStoryVideoFallbackText = document.getElementById("storyVideoFallbackText");
var elStoryVideoSkipHint = document.getElementById("storyVideoSkipHint");

// Жёстко скрываем персонажа на старте, чтобы не было первого "всплеска" когда появляется большого размера
if (elChar) {
  if (elCharFrame) {
    elCharFrame.classList.add("hidden");
  }
  elChar.classList.add("hidden");
  elChar.src = "";
  elChar.style.height = "0px";
  elChar.style.maxHeight = "none";
}

var elOverlay = document.getElementById("overlay");

var elDialog = document.getElementById("dialog");
var elName = document.getElementById("nameBox");
var elText = document.getElementById("textBox");
var elChoices = document.getElementById("choices");
var activeFitChoiceLayout = null;

var btnMute = document.getElementById("btnMute");
var sliderVolume = document.getElementById("volume");
var btnRestart = document.getElementById("btnRestart");

var elGameModal = document.getElementById("gameModal");
var elGameFrame = document.getElementById("gameFrame");
var btnCloseGame = document.getElementById("btnCloseGame");

var elStatsGameModal = document.getElementById("statsGameModal");
var elStatsGameFrameWrap = document.getElementById("statsGameFrameWrap");
var elStatsGameFrame = document.getElementById("statsGameFrame");
var btnCloseStatsGame = document.getElementById("btnCloseStatsGame");
var storyGameReturnFocus = null;
var statsGameReturnFocus = null;

function syncStatsGameFrameWrapToStoryGameWindow() {
  if (!elNovelWindow || !elGameModal || !elStatsGameModal || !elStatsGameFrameWrap) return;

  var novelRect = elNovelWindow.getBoundingClientRect();
  var statsModalRect = elStatsGameModal.getBoundingClientRect();
  var storyGameModalStyle = window.getComputedStyle(elGameModal);

  var padLeft = parseFloat(storyGameModalStyle.paddingLeft) || 0;
  var padTop = parseFloat(storyGameModalStyle.paddingTop) || 0;
  var padRight = parseFloat(storyGameModalStyle.paddingRight) || 0;
  var padBottom = parseFloat(storyGameModalStyle.paddingBottom) || 0;

  // Это и есть геометрия сюжетного gameFrameWrap:
  // он занимает весь content-box gameModal.
  var left = (novelRect.left - statsModalRect.left) + padLeft;
  var top = (novelRect.top - statsModalRect.top) + padTop;
  var width = Math.max(0, novelRect.width - padLeft - padRight);
  var height = Math.max(0, novelRect.height - padTop - padBottom);

  elStatsGameFrameWrap.style.left = left + "px";
  elStatsGameFrameWrap.style.top = top + "px";
  elStatsGameFrameWrap.style.width = width + "px";
  elStatsGameFrameWrap.style.height = height + "px";

  writeRuntimeVerbose("[GAME] syncStatsGameFrameWrapToStoryGameWindow", {
    left: left,
    top: top,
    width: width,
    height: height
  });
}

// Готовит сюжетную модалку после того, как game host применил ограничения iframe и показал окно.
function prepareStoryGameHostUi(launch) {
  storyGameReturnFocus = getCurrentUiFocusTarget(elDialog);
  updateStoryGameControlButtonLabel(launch && launch.mode);
}

// Возвращает подпись кнопки и клавиатурный фокус после закрытия сюжетной игры.
function resetStoryGameHostUi() {
  var returnFocus = storyGameReturnFocus;
  storyGameReturnFocus = null;
  updateStoryGameControlButtonLabel(null);
  focusUiElement(returnFocus);
}

// Подгоняет модалку игры из статистики к геометрии основного окна после её показа.
function prepareStatsGameHostUi() {
  statsGameReturnFocus = getCurrentUiFocusTarget(btnShowGames);
  syncStatsGameFrameWrapToStoryGameWindow();
}

// Очищает геометрию статистической модалки и возвращает фокус к запустившему элементу.
function resetStatsGameHostUi() {
  var returnFocus = statsGameReturnFocus;
  statsGameReturnFocus = null;
  if (elStatsGameFrameWrap) {
    elStatsGameFrameWrap.style.left = "";
    elStatsGameFrameWrap.style.top = "";
    elStatsGameFrameWrap.style.width = "";
    elStatsGameFrameWrap.style.height = "";
  }
  focusUiElement(returnFocus);
}

// Сохраняет прежнее предупреждение о параллельном запуске, не связывая game host с runtime-логгером.
function reportGameHostWarning(message, frameKind) {
  console.warn(message, frameKind);
}

// Записывает подтверждение gameInit и передаёт клавиатурный фокус загруженному iframe игры.
function reportGameHostInitSent(launch) {
  var label = launch.frameKind === "stats" ? "gameInit статистики отправлен" : "gameInit отправлен";
  writeRuntimeDebug("[VN DEBUG] " + label, launch.gameId);
  focusUiElement(launch && launch.frame);
}

// Выводит техническую ошибку postMessage без раскрытия параметров игры или состояния сценария.
function reportGameHostPostMessageError(error, launch) {
  var label = launch && launch.frameKind === "stats" ? "stats gameInit" : "gameInit";
  console.error("[GAME] failed to send " + label, error && error.message ? error.message : error);
}

// Возвращает сюжет и каталог из остановленной игры; URL-запуск остаётся на сообщении до ручного перезапуска.
function handleGameHostNavigationBlocked(launch) {
  if (!state.currentGame || state.currentGame.session !== launch.session) return;
  if (state.currentGame.mode === "url") {
    state.currentGame = null;
    state.inGame = false;
    state.waitingNext = false;
    state.nextLocked = true;
    setStandaloneGameModeEnabled(false);
    showError(t("gameNavigationBlocked"));
    return;
  }
  // Для сюжета и статистики остановка соответствует существующему ручному закрытию с результатом 0.
  closeGame({ manualClose: true, result: 0 });
}

// Обновляет ссылки клавиатурных обработчиков после замены iframe перед новым запуском.
function handleGameFrameReplaced(frameKind, frame) {
  if (frameKind === "stats") elStatsGameFrame = frame;
  else if (frameKind === "story") elGameFrame = frame;
}

// Создаёт единственный host для сюжетной, статистической и URL-игры с общей активной сессией.
var gameHost = window.VN_GAME_HOST.createGameHost({
  eventTarget: window,
  protocol: window.VN_GAME_PROTOCOL,
  frames: {
    story: {
      frame: elGameFrame,
      modal: elGameModal,
      onOpen: prepareStoryGameHostUi,
      onClose: resetStoryGameHostUi
    },
    stats: {
      frame: elStatsGameFrame,
      modal: elStatsGameModal,
      onOpen: prepareStatsGameHostUi,
      onClose: resetStatsGameHostUi
    }
  },
  onResult: handleGameResultMessage,
  onWarning: reportGameHostWarning,
  onInitSent: reportGameHostInitSent,
  onNavigationBlocked: handleGameHostNavigationBlocked,
  onFrameReplaced: handleGameFrameReplaced,
  onPostMessageError: reportGameHostPostMessageError
});

function swallowEvent(e) {
  if (!e) return;
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function") {
    e.stopImmediatePropagation();
  }
}

// Блокируем любые клики/тапы по модалке вне iframe и кнопки закрытия
["pointerdown", "pointerup", "click", "touchstart", "touchend", "mousedown", "mouseup"].forEach(function (type) {
  elGameModal.addEventListener(type, function (e) {
    // Разрешаем события только внутри iframe и кнопки Close Game
    if (e.target === elGameFrame || elGameFrame.contains(e.target)) return;
    if (e.target === btnCloseGame || btnCloseGame.contains(e.target)) return;

    swallowEvent(e);
  }, true);
});

["pointerdown", "pointerup", "click", "touchstart", "touchend", "mousedown", "mouseup"].forEach(function (type) {
  if (!elStatsGameModal) return;

  elStatsGameModal.addEventListener(type, function (e) {
    if (e.target === elStatsGameFrame || elStatsGameFrame.contains(e.target)) return;
    if (e.target === btnCloseStatsGame || btnCloseStatsGame.contains(e.target)) return;

    swallowEvent(e);
  }, true);
});

var btnSettings = document.getElementById("btnSettings");
var btnStats = document.getElementById("btnStats");
var elSettingsPanel = document.getElementById("settingsPanel");
var btnCloseSettings = document.getElementById("btnCloseSettings");
var elSettingsBody = document.getElementById("settingsBody");
var elStatsPanel = document.getElementById("statsPanel");
var btnCloseStats = document.getElementById("btnCloseStats");
var elStatsBody = document.getElementById("statsBody");
var elStatsLoadProgress = document.getElementById("statsLoadProgress");
var elStatsLoadProgressBar = document.getElementById("statsLoadProgressBar");
var elStatsLoadProgressLabel = document.getElementById("statsLoadProgressLabel");
var elGraphLoadProgress = document.getElementById("graphLoadProgress");
var elGraphLoadProgressBar = document.getElementById("graphLoadProgressBar");
var elGraphLoadProgressText = document.getElementById("graphLoadProgressText");
var elGraphLoadProgressLabel = document.getElementById("graphLoadProgressLabel");
var settingsPanelReturnFocus = null;
var statsPanelReturnFocus = null;

// Переводит фокус без прокрутки и безопасно поддерживает браузеры со старой сигнатурой focus().
function focusUiElement(element) {
  if (!element || typeof element.focus !== "function" || element.isConnected === false) return false;
  try {
    element.focus({ preventScroll: true });
  } catch (error) {
    try {
      element.focus();
    } catch (fallbackError) {
      // Недоступный элемент уже удалён или скрыт; lifecycle интерфейса продолжается без ошибки.
      return false;
    }
  }
  return true;
}

// Запоминает реальный активный элемент либо устойчивую кнопку, к которой можно вернуться после модалки.
function getCurrentUiFocusTarget(fallback) {
  var activeElement = document.activeElement;
  if (
    activeElement &&
    activeElement !== document.body &&
    activeElement !== document.documentElement &&
    typeof activeElement.focus === "function"
  ) {
    return activeElement;
  }
  return fallback || null;
}

// Новые DOM-элементы
var elBlurBgLayer = document.getElementById("blurBgLayer");
var elBlurBgImage = document.getElementById("blurBgImage");
var elBlurBgVideo = document.getElementById("blurBgVideo");

[elBg, elBgVideo, elStoryVideo, elStoryVideoPoster, elChar, elBlurBgImage, elBlurBgVideo].forEach(function (el) {
  if (!el) return;
  el.setAttribute("draggable", "false");
  el.addEventListener("dragstart", function (e) {
    e.preventDefault();
  });
});

// Глобальный наблюдатель за именем
var nameObserver = null;

// В начале файла, после других переменных:
let currentSceneId = null;

// Для отладки
writeRuntimeVerbose('[Engine] blurBgLayer:', elBlurBgLayer);
writeRuntimeVerbose('[Engine] blurBgImage:', elBlurBgImage);
writeRuntimeVerbose('[Engine] blurBgVideo:', elBlurBgVideo);

if (btnSettings) {
  btnSettings.addEventListener("click", function () {
    toggleSettingsPanel();
  });
}

if (btnStats) {
  btnStats.addEventListener("click", function () {
    toggleStatsPanel();
  });
}

if (btnCloseSettings) {
  btnCloseSettings.addEventListener("click", function () {
    hideSettingsPanel();
  });
}

if (btnCloseStats) {
  btnCloseStats.addEventListener("click", function () {
    hideStatsPanel();
  });
}

if (elSettingsPanel) {
  // Клик по затемнению окна настроек (вне карточки) — закрывает окно.
  elSettingsPanel.addEventListener("click", function (e) {
    if (e.target === elSettingsPanel) hideSettingsPanel();
  });
}

// клик по затемнению (вне карточки) — закрывает
elStatsPanel.addEventListener("click", function (e) {
  if (e.target === elStatsPanel) hideStatsPanel();
});

// Клик по фону/персонажу/сцене тоже листает дальше
var elStage = document.getElementById("stage");

// чтобы клик по кнопкам/слайдеру/меню НЕ листал
function isUiClick(target) {
  if (!target || !target.closest) return false;
  if (target.closest(".topbar")) return true;
  if (target.closest("#settingsPanel")) return true;
  // Панель статистики — отдельный UI-слой; её клики не должны листать сюжет.
  if (target.closest("#statsPanel")) return true;
  if (target.closest("#dialog")) return true;
  if (target.closest("#choices")) return true;
  if (target.closest("#storyVideoOverlay")) return true;
  var gm = target.closest("#gameModal");
  if (gm && !gm.classList.contains("hidden")) return true;
  var sgm = target.closest("#statsGameModal");
  if (sgm && !sgm.classList.contains("hidden")) return true;
  return false;
}

elStage.addEventListener("click", function (e) {
  // При ожидании window.STORY движок делает return до инициализации state — не обращаемся к полям.
  if (!state) return;

  writeRuntimeVerbose("[LOG] stage click", {
    targetId: e.target && e.target.id,
    modalHidden: elGameModal.classList.contains("hidden"),
    inGame: state.inGame
  });

  if (state.inVideo) {
    // Поля вокруг полноэкранной видео-вставки тоже должны работать как область пропуска.
    handleStoryVideoSkip(e);
    return;
  }

  if (backgroundScroll && backgroundScroll.suppressClick) {
    backgroundScroll.suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  
  if (isUiClick(e.target)) return;
  onNext();
});

if (elNovelWindow) {
  elNovelWindow.addEventListener("pointerdown", handleBackgroundScrollPointerDown);
  elNovelWindow.addEventListener("pointermove", handleBackgroundScrollPointerMove);
  elNovelWindow.addEventListener("pointerup", handleBackgroundScrollPointerUp);
  elNovelWindow.addEventListener("pointercancel", handleBackgroundScrollPointerCancel);
  elNovelWindow.addEventListener("wheel", handleBackgroundScrollWheel, { passive: false });
}
setupBg360Interactions();




profiler.mark('DOM has been loaded');










// Элементы управления статистикой и графиком
var btnShowFullGraph = document.getElementById("btnShowFullGraph");
var btnShowResourcesGraph = document.getElementById("btnShowResourcesGraph");
var btnShowGames = document.getElementById("btnShowGames");
var btnShowText = document.getElementById("btnShowText");
var graphContainer = document.getElementById("graphContainer");
var gamesContainer = document.getElementById("gamesContainer");
var gamesGrid = document.getElementById("gamesGrid");
var gamesStatus = document.getElementById("gamesStatus");
var graphControls = document.getElementById("graphControls");
var btnCopyMermaid = document.getElementById("btnCopyMermaid");
var btnRefreshGraph = document.getElementById("btnRefreshGraph");
var mermaidGraph = document.getElementById("mermaidGraph");

// Состояние отображения
var currentStatsView = "text";
var showingGraph = false;
var showingGames = false;

// Переменная для хранения текущего кода графа
var currentMermaidCode = "";

// Номер активного рендера графа: устаревшие async-ответы Mermaid не должны менять DOM и panzoom.
var graphRenderSequence = 0;

// Состояние относится к одному Mermaid-render и считает каждый реально гидратируемый элемент img один раз.
var graphImageLoadProgressState = {
  generation: 0,
  renderSequence: 0,
  phase: "idle",
  registrationComplete: false,
  total: 0,
  completed: 0,
  failed: 0,
  startedAt: 0
};

// Возвращает прошедшее время текущей загрузки, не полагаясь на доступность performance.now в старых браузерах.
function getGraphImageLoadElapsedSeconds() {
  if (!graphImageLoadProgressState.startedAt) return 0;
  return Math.max(0, (Date.now() - graphImageLoadProgressState.startedAt) / 1000);
}

// Синхронизирует отдельную полосу графа с фазой Mermaid-render и результатами декодирования изображений.
function updateGraphImageLoadProgress() {
  if (!elGraphLoadProgress || !elGraphLoadProgressBar || !elGraphLoadProgressText || !elGraphLoadProgressLabel) return;

  var progress = graphImageLoadProgressState;
  var isGraphView = isGraphStatsView(currentStatsView);
  var shouldShow = isGraphView && progress.phase !== "idle";
  elGraphLoadProgress.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) return;

  elGraphLoadProgress.classList.toggle("is-complete", progress.phase === "complete" && progress.failed === 0);
  elGraphLoadProgress.classList.toggle("has-errors", progress.phase === "render-error" || progress.failed > 0);

  if (progress.phase === "preparing") {
    elGraphLoadProgressText.textContent = "Preparing graph images";
    elGraphLoadProgressLabel.textContent = "...";
    elGraphLoadProgressBar.max = 1;
    elGraphLoadProgressBar.removeAttribute("value");
    return;
  }

  if (progress.phase === "render-error") {
    elGraphLoadProgressText.textContent = "Graph could not be rendered";
    elGraphLoadProgressLabel.textContent = "error";
    elGraphLoadProgressBar.max = 1;
    elGraphLoadProgressBar.value = 1;
    return;
  }

  if (progress.registrationComplete && progress.completed >= progress.total) {
    progress.phase = "complete";
  }

  var elapsedLabel = getGraphImageLoadElapsedSeconds().toFixed(1) + " s";
  elGraphLoadProgressBar.max = Math.max(1, progress.total);
  elGraphLoadProgressBar.value = progress.total === 0 && progress.phase === "complete" ? 1 : progress.completed;

  if (progress.phase === "complete") {
    if (progress.total === 0) {
      elGraphLoadProgressText.textContent = "Graph contains no images";
    } else if (progress.failed > 0) {
      elGraphLoadProgressText.textContent = "Graph images loaded with errors";
    } else {
      elGraphLoadProgressText.textContent = "Graph images loaded";
    }
  } else {
    elGraphLoadProgressText.textContent = "Loading graph images";
  }

  elGraphLoadProgressLabel.textContent = progress.completed + " / " + progress.total +
    (progress.failed > 0 ? " · errors: " + progress.failed : "") + " · " + elapsedLabel;
  elGraphLoadProgress.classList.toggle("is-complete", progress.phase === "complete" && progress.failed === 0);
}

// Показывает неопределённый этап подготовки SVG до того, как известен набор безопасных изображений графа.
function prepareGraphImageLoadProgress(renderSequence) {
  graphImageLoadProgressState.generation++;
  graphImageLoadProgressState.renderSequence = renderSequence;
  graphImageLoadProgressState.phase = "preparing";
  graphImageLoadProgressState.registrationComplete = false;
  graphImageLoadProgressState.total = 0;
  graphImageLoadProgressState.completed = 0;
  graphImageLoadProgressState.failed = 0;
  graphImageLoadProgressState.startedAt = Date.now();
  updateGraphImageLoadProgress();
}

// Начинает регистрацию изображений уже очищенного SVG; повторный fallback Mermaid сбрасывает предыдущий частичный подсчёт.
function beginGraphImageLoadRegistration(renderSequence) {
  if (graphImageLoadProgressState.renderSequence !== renderSequence) {
    prepareGraphImageLoadProgress(renderSequence);
  }
  // Каждый Mermaid fallback получает новое поколение: события удалённого частичного SVG должны стать неактуальными.
  graphImageLoadProgressState.generation++;
  graphImageLoadProgressState.phase = "loading";
  graphImageLoadProgressState.registrationComplete = false;
  graphImageLoadProgressState.total = 0;
  graphImageLoadProgressState.completed = 0;
  graphImageLoadProgressState.failed = 0;
  graphImageLoadProgressState.startedAt = Date.now();
  updateGraphImageLoadProgress();
}

// Регистрирует один штатный img графа и возвращает токен, защищённый от повторной гидрации и старого рендера.
function registerGraphImageLoad(img) {
  if (!img || graphImageLoadProgressState.phase !== "loading") return null;
  var existingToken = img.__vnvGraphImageLoadToken;
  if (existingToken && existingToken.generation === graphImageLoadProgressState.generation) {
    return existingToken;
  }

  var token = {
    generation: graphImageLoadProgressState.generation,
    settled: false
  };
  img.__vnvGraphImageLoadToken = token;
  graphImageLoadProgressState.total++;
  updateGraphImageLoadProgress();
  return token;
}

// Завершает один токен только один раз; события старого SVG не меняют полосу нового графа.
function settleGraphImageLoad(token, success) {
  if (!token || token.settled) return;
  token.settled = true;
  if (token.generation !== graphImageLoadProgressState.generation) return;

  graphImageLoadProgressState.completed++;
  if (!success) graphImageLoadProgressState.failed++;
  updateGraphImageLoadProgress();
}

// Закрывает синхронный этап регистрации, чтобы нулевой граф или уже кешированные картинки получили финальный статус.
function completeGraphImageLoadRegistration() {
  if (graphImageLoadProgressState.phase !== "loading") return;
  graphImageLoadProgressState.registrationComplete = true;
  updateGraphImageLoadProgress();
}

// Оставляет видимый итог ошибки Mermaid, но не смешивает её со счётчиком отдельных изображений.
function markGraphImageRenderFailed(renderSequence) {
  if (graphImageLoadProgressState.renderSequence !== renderSequence) return;
  graphImageLoadProgressState.phase = "render-error";
  graphImageLoadProgressState.registrationComplete = true;
  updateGraphImageLoadProgress();
}

var currentMermaidVariants = {
  full: {
    fullCode: "",
    compactCode: "",
    code: "",
    useCompact: false
  },
  // Второй вариант графа: scope "resources" в buildMermaidGraph (раньше «intro»).
  // Компактная диаграмма (одна сцена), блоки ассетов — полные, см. комментарий у buildMermaidGraph.
  resources: {
    fullCode: "",
    compactCode: "",
    code: "",
    useCompact: false
  }
};

var lastStandaloneGameInfo = null;

if (btnShowFullGraph) {
  btnShowFullGraph.addEventListener("click", function() {
    setStatsView("graph-full");
  });
}

if (btnShowResourcesGraph) {
  btnShowResourcesGraph.addEventListener("click", function() {
    setStatsView("graph-resources");
  });
}

if (btnShowGames) {
  btnShowGames.addEventListener("click", function() {
    setStatsView("games");
  });
}

if (btnShowText) {
  btnShowText.addEventListener("click", function() {
    setStatsView("text");
  });
}

// Обработчик кнопки копирования
if (btnCopyMermaid) {
  btnCopyMermaid.addEventListener("click", function() {
    if (currentMermaidCode) {
      navigator.clipboard.writeText(currentMermaidCode).then(function() {
        var originalText = btnCopyMermaid.textContent;
        btnCopyMermaid.textContent = t("copied");
        setTimeout(function() {
          btnCopyMermaid.textContent = originalText;
        }, 2000);
      }).catch(function(err) {
        console.error("Copy error:", err);
        alert(t("copyError"));
      });
    }
  });
}

// Обработчик кнопки обновления
if (btnRefreshGraph) {
  btnRefreshGraph.addEventListener("click", function() {
    if (!showingGraph) return;
    var refreshKey = getPanzoomStateKeyForView(currentStatsView);
    if (refreshKey) {
      renderGraphViewWithPanzoomLifecycle(refreshKey);
    }
  });
}

function getMermaidVariantForStatsView(view) {
  if (view === "graph-resources") {
    return currentMermaidVariants.resources;
  }

  return currentMermaidVariants.full;
}

function syncCurrentMermaidCodeWithView() {
  var variant = getMermaidVariantForStatsView(currentStatsView);
  if (!variant) {
    currentMermaidCode = "";
    return;
  }

  if (currentStatsView === "graph-full" && variant.fullCode) {
    currentMermaidCode = variant.fullCode;
    return;
  }

  currentMermaidCode = variant.code || variant.fullCode || "";
}

function setStatsView(view) {
  var statsBody = document.getElementById("statsBody");
  var previousView = currentStatsView;
  var previousStateKey = getPanzoomStateKeyForView(previousView);
  var currentStateKey;
  var isGraphView;

  if (previousStateKey) {
    savedPanzoomByView[previousStateKey] = clonePanzoomState();
  }

  currentStatsView = view || "text";
  currentStateKey = getPanzoomStateKeyForView(currentStatsView);
  isGraphView = currentStateKey !== null;

  if (!isGraphView) {
    // При уходе с графа отменяем незавершённые Mermaid-render/restore, чтобы они не меняли скрытый DOM.
    graphRenderSequence++;
  }

  showingGraph = isGraphView;
  showingGames = (currentStatsView === "games");
  window.showingGraph = showingGraph;
  window.showingGames = showingGames;
  window.currentStatsView = currentStatsView;

  syncCurrentMermaidCodeWithView();

  if (statsBody) {
    statsBody.classList.toggle("hidden", currentStatsView !== "text");
  }

  if (graphContainer) {
    graphContainer.classList.toggle("hidden", !isGraphView);
  }

  if (graphControls) {
    graphControls.classList.toggle("hidden", !isGraphView);
  }

  if (gamesContainer) {
    gamesContainer.classList.toggle("hidden", currentStatsView !== "games");
  }

  // На графе показываем его собственную загрузку, а полосу фоновой проверки CSS-панорам возвращаем только в текстовую статистику.
  updateBg360PackageInspectionProgress();
  updateGraphImageLoadProgress();

  if (isGraphView) {
    renderGraphViewWithPanzoomLifecycle(currentStateKey);
  }

  if (currentStatsView === "games") {
    renderGamesCatalog();
  }

  if (
    currentStatsView === "text" &&
    previousView !== "text" &&
    elStatsPanel &&
    !elStatsPanel.classList.contains("hidden")
  ) {
    renderStats();
  }

  applyUiLanguage();
}





// Проверяем, есть ли ошибки парсинга
if (window.PARSE_ERRORS && window.PARSE_ERRORS.length > 0) {
  writeRuntimeVerbose('[Engine] Обнаружены ошибки парсинга, движок не запускается');
  
  // Показываем ошибку сразу после загрузки DOM
  setTimeout(function() {
    const dialog = document.getElementById('dialog');
    const textBox = document.getElementById('textBox');
    const nameBox = document.getElementById('nameBox');
    const choices = document.getElementById('choices');
    
    if (dialog && textBox) {
      nameBox?.classList.add('hidden');
      choices?.classList.add('hidden');
      dialog.classList.remove('hiddenByChoices', 'has-name', 'no-name');
      
      let errorText = "❌ ОШИБКА ПАРСИНГА СЦЕНАРИЯ:\n\n";
      window.PARSE_ERRORS.forEach((error, index) => {
        errorText += `${index + 1}. Строка ${error.lineNumber}: ${error.message}\n`;
        errorText += `   "${error.line}"\n\n`;
      });
      
      textBox.textContent = errorText;
      textBox.style.whiteSpace = 'pre-wrap';
      textBox.style.fontFamily = 'monospace';
      textBox.style.color = '#ff6b6b';
      
      const hint = document.querySelector('.hint');
      if (hint) hint.style.display = 'none';
    }
  }, 100);
  
  return; // Останавливаем выполнение движка
}



// ---------- Проверка story ----------
if (!window.STORY) {
  writeRuntimeVerbose('[Engine] Ожидание window.STORY...');
  elText.textContent = t("loadingStory"); // "Загрузка сценария..."
  
  // Ждём загрузки от story-loader.js
  window.__onStoryLoaded = function(story) {
    writeRuntimeVerbose('[Engine] Сценарий загружен, перезапускаем');
    profiler.mark('Сценарий загружен парсером');

    // Обновляем STORY
    window.STORY = story;
    updateStatsButtonByStoryMode();
    
    // Перестраиваем карту сцен
    buildSceneMap();
    
    
    // Обновляем заголовок
    if (story.meta && story.meta.title) {
      if (elTitle) elTitle.textContent = story.meta.title;
      document.title = story.meta.title;
    }

    applySpacingSettings();

    applyUiLanguage();

    // Применяем настройки аудио
    setAudioFromStoryDefaults();
    
    profiler.mark('Запускаем сценарий');
    // Запускаем сценарий
    restart();
  };
  
  return;
}

var STORY = window.STORY;
profiler.mark('Script found immediately');
updateStatsButtonByStoryMode();


// Применяем настройки отступов
applySpacingSettings();
applyUiLanguage();
profiler.mark('Indentation settings applied');

// =========================================================
// НАСТРОЙКИ ИНТЕРФЕЙСА (масштаб)
// =========================================================

// Ручная коррекция масштаба интерфейса
// 1.0 = стандарт
// 0.9 = немного меньше
// 1.1 = немного больше
var UI_FONT_SCALE = 1.4;
writeRuntimeVerbose('[SCALE] UI_FONT_SCALE initialized:', UI_FONT_SCALE);

// Дополнительный множитель масштаба интерфейса только при уверенном определении смартфона.
// В applyUiScale итог: UI_FONT_SCALE * autoScale * (телефон ? UI_PHONE_EXTRA_FONT_SCALE : 1).
// Значение 1.0 отключает эффект; >1 укрупняет текст и UI на телефонах поверх обычной формулы.
var UI_PHONE_EXTRA_FONT_SCALE = 1.45;
writeRuntimeVerbose('[SCALE] UI_PHONE_EXTRA_FONT_SCALE initialized:', UI_PHONE_EXTRA_FONT_SCALE);

// Верхняя граница меньшей стороны viewport (CSS px) для «карманного» экрана; выше — не считаем телефоном.
var UI_PHONE_VIEWPORT_MAX_SHORT_PX = 560;
// Минимум отношения длинной стороны к короткой (отсекает почти квадратные окна на ПК).
var UI_PHONE_VIEWPORT_MIN_ASPECT = 1.35;

// Высота экрана, под которую делался дизайн
// используется для автоадаптации
var UI_REFERENCE_HEIGHT = 1440;
writeRuntimeVerbose('[SCALE] UI_REFERENCE_HEIGHT initialized:', UI_REFERENCE_HEIGHT);

// Высота, от которой считаются визуальные эффекты: blur, тонкие бордеры и тени.
// Минимум не даёт эффектам стать слишком тонкими на очень низком окне.
var UI_VISUAL_REFERENCE_HEIGHT = UI_REFERENCE_HEIGHT;
var UI_VISUAL_MIN_HEIGHT = 400;
writeRuntimeVerbose('[SCALE] UI_VISUAL_REFERENCE_HEIGHT initialized:', UI_VISUAL_REFERENCE_HEIGHT);
writeRuntimeVerbose('[SCALE] UI_VISUAL_MIN_HEIGHT initialized:', UI_VISUAL_MIN_HEIGHT);

// ---------- Состояние движка ----------
var state = {
  // Текущая сцена
  sceneId: STORY.meta && STORY.meta.start ? STORY.meta.start : null,
  // Индекс текущего action внутри сцены
  actionIndex: 0,
  // Кэш для быстрого поиска сцен по id
  sceneMap: {},
  // Переменные (на будущее, для if/set и результатов мини-игр)
  vars: JSON.parse(JSON.stringify((STORY && STORY.vars) ? STORY.vars : {})),
  // Текущий id фона из [bg], показанный командой bg (нужно для walk360 и проверок сценария).
  currentBgId: null,
  // Флаг: ждём ли клика "дальше"
  waitingNext: false,
  // Флаг: открыта ли мини-игра
  inGame: false,
  currentGame: null,
  // Сюжетное видео блокирует выполнение сцены до завершения, пропуска или таймаута fallback.
  inVideo: false,
  lastNextAt: 0,
  nextLocked: false,
  // Очередь временных действий (например, тело выбранного пункта menu), которые
  // исполняются сразу и не мутируют исходный массив scene.actions.
  pendingActions: []
};
applyStoryModeToStateVars(state);

// Режим URL-запуска фиксируется один раз: scene/nosave отключают сохранения, novel выбирает отдельный слот.
var storyUrlLaunch = parseStoryUrlLaunchFromUrl();
// Канонический id сцены заполняется после построения sceneMap и используется для старта и ключа novel-сохранения.
var storyUrlLaunchSceneId = null;

// URL-режим мини-игры фиксируется один раз при загрузке страницы: он намеренно обходит сценарий и автосейв.
var standaloneGameLaunch = parseStandaloneGameLaunchFromUrl();

// Допустимый диапазон scale для фона/сюжетного видео (множитель к «базовому» object-fit: cover).
var BG_MEDIA_SCALE_MIN = 0.05;
var BG_MEDIA_SCALE_MAX = 8;
var BG_360_FOV_MIN = 35;
var BG_360_FOV_MAX = 90;
/**
 * Длительность «наезда» (сужение FOV) при goto360 между 360-панорамами, миллисекунды.
 * Загрузка новой сцены идёт параллельно; если текстура пришла раньше — WebGL-зум кадра останавливается,
 * но визуальный наезд продолжается на снимке hold (CSS scale) до конца этого интервала.
 * Альтернатива без правки этого файла: перед игрой в консоли window.VN_BG360_GOTO_ZOOM_MS = 2000;
 */
var BG_360_GOTO_ZOOM_MS = 4000;
/**
 * Растворение снимка старой сцены (hold) поверх уже отрисованной новой на canvas, мс. 0 — сразу убрать hold.
 * Новая сцена остаётся непрозрачной; hold сверху уходит opacity 1→0 (полупрозрачный WebGL-canvas даёт чёрную подмес).
 * Переопределение: window.VN_BG360_NEW_SCENE_REVEAL_MS = 600;
 */
var BG_360_NEW_SCENE_REVEAL_MS = 500;

var backgroundScroll = {
  enabled: false,
  available: false,
  owner: "background",
  target: null,
  container: null,
  interactive: false,
  position: 0.5,
  start: 0.5,
  focusX: null,
  focusY: null,
  mediaScale: 1,
  maxOffset: 0,
  dragging: false,
  pointerId: null,
  dragStartX: 0,
  dragStartY: 0,
  dragStartPosition: 0.5,
  dragStartFocusY: 0.5,
  moved: false,
  suppressClick: false,
  suppressTimer: null,
  hintTimer: null,
  panorama360Fallback: false,
  backgroundOptions: { enabled: false, start: 0.5, focusX: null, focusY: null, scale: 1, is360: false, focusZ: null, fov: null, quality: "auto", panorama360Fallback: false },
  backgroundTarget: null,
  backgroundContainer: null,
  backgroundPosition: 0.5
};

// Runtime 360-фона: держит WebGL-ресурсы, жесты и текущее направление камеры.
var bg360Runtime = {
  active: false,
  interactive: false,
  sourceSrc: "",
  sourceQuality: "auto", // Фактический normal/mobile нужен для приоритета той же загрузки в фоновой очереди статистики.
  blurFallbackSrc: "",
  isVideoSource: false,
  renderer: null,
  scene: null,
  camera: null,
  mesh: null,
  material: null,
  geometry: null,
  originCoverMesh: null,
  originCoverMaterial: null,
  originCoverGeometry: null,
  originCoverStrokeMesh: null,
  originCoverStrokeMaterial: null,
  originCoverStrokeGeometry: null,
  originCoverSignature: "",
  texture: null,
  video: null,
  frameId: 0,
  loadSeq: 0,
  yawDeg: 180,
  pitchDeg: 0,
  fovDeg: 70,
  pointers: {},
  pinchDistance: null,
  dragPointerId: null,
  dragLastX: 0,
  dragLastY: 0,
  /** Группа WebGL-стрелок к меткам 360 и стрелки азимута на капе надира. */
  navArrowsGroup: null,
  /** Подпись набора меток/настроек; при совпадении группа не пересобирается каждый кадр. */
  navArrowsSignature: "",
  /** Сумма |dx|+|dy| при перетаскивании одним указателем — отличает тап от вращения. */
  pointerTravelSum: 0,
  /**
   * Номер поколения loadSeq, на котором последний раз была применена текстура к сфере (успешный onLoadTexture).
   * Пока не совпадает с текущим loadSeq, навигационный оверлей к новой панораме не строим — иначе стрелки опережают фон.
   */
  textureReadyLoadSeq: 0,
  /** Один раз не дублировать showBg360HoldFromCurrentFrame: кадр уже захвачен после зума к метке goto360. */
  suppressNextHoldCapture: false,
  /** Таймер плавного скрытия hold-слоя (чтобы не копить таймеры при быстрых переходах). */
  holdFadeTimer: null,
  /** goto360: зум и загрузка следующей панорамы параллельно; метки новой сцены — в pending до прихода текстуры. */
  goto360ParallelZoomActive: false,
  pendingGoto360MarksPayload: null,
  /** requestAnimationFrame зума FOV при параллельной загрузке (отменяется при готовности текстуры). */
  goto360ZoomRafId: 0,
  /** Продолжение того же наезда на img-hold после подмены сферы (CSS scale, тот же easing по времени). */
  goto360HoldZoomRafId: 0,
  /** Начало таймлайна easeOutCubic для параллельного зума (мс, performance.now). */
  goto360ParallelZoomAnimT0: 0,
  /** Длительность полного параллельного зума, мс (копия resolveBg360GotoZoomDurationMs на старте). */
  goto360ParallelZoomAnimDurationMs: 0,
  /** FOV на старте и в конце параллельного зума goto360 (для продолжения на hold). */
  goto360ParallelZoomStartFov: 0,
  goto360ParallelZoomTargetFov: 0,
  /** Таймер завершения растворения hold поверх новой сцены; сбрасывается в resetBg360CanvasRevealStyles / disable. */
  revealFallbackTimer: null
};

// Проверяет тип photo-метки через уже загруженный специализированный viewer-модуль.
function isPanoramaMarksPhotoMark(mark) {
  return window.VN_PANORAMA_PHOTO_VIEWER_CONTROLLER.isPhotoMark(mark);
}

// Нормализует изображения photo-метки тем же контрактом, который использует viewer.
function normalizePanoramaMarksPhotoImages(mark) {
  return window.VN_PANORAMA_PHOTO_VIEWER_CONTROLLER.normalizePhotoImages(mark);
}

// Открывает photo-viewer по запросу общего контроллера панорамных меток.
function openPanoramaMarksPhotoViewer(mark) {
  return openBg360PhotoViewer(mark);
}

// Сообщает контроллеру меток состояние активного ожидания goto360.
function isPanoramaMarksGotoActive() {
  return !!(goto360Runtime && goto360Runtime.active);
}

// Не позволяет повторно выбрать метку после завершения goto360.
function isPanoramaMarksGotoDone() {
  return !!(goto360Runtime && goto360Runtime.done);
}

// Передаёт выбранную метку координатору переходов goto360.
function selectPanoramaMarksGoto(markId) {
  onGoto360SelectMark(markId);
}

// Сообщает контроллеру меток состояние активного ожидания walk360.
function isPanoramaMarksWalkActive() {
  return !!(walk360Runtime && walk360Runtime.active);
}

// Не позволяет повторно выбрать метку после завершения walk360.
function isPanoramaMarksWalkDone() {
  return !!(walk360Runtime && walk360Runtime.done);
}

// Передаёт выбранную метку координатору команды walk360.
function selectPanoramaMarksWalk(markId) {
  onWalk360SelectMark(markId);
}

// Контроллер владеет состоянием, DOM/SVG-метками, WebGL-стрелками и их hit-test.
var panoramaMarksController = window.VN_PANORAMA_MARKS_CONTROLLER.createPanoramaMarksController({
  window: window,
  document: document,
  marksLayer: elBg360Marks,
  novelWindow: elNovelWindow,
  panoramaRuntime: bg360Runtime,
  clamp: clamp,
  normalizeFov: normalizeMediaFov,
  getComputedStyle: window.getComputedStyle.bind(window),
  assignImage: assignRasterImageToElement,
  isPhotoMark: isPanoramaMarksPhotoMark,
  normalizePhotoImages: normalizePanoramaMarksPhotoImages,
  openPhotoViewer: openPanoramaMarksPhotoViewer,
  isGotoActive: isPanoramaMarksGotoActive,
  isGotoDone: isPanoramaMarksGotoDone,
  onGotoSelect: selectPanoramaMarksGoto,
  isWalkActive: isPanoramaMarksWalkActive,
  isWalkDone: isPanoramaMarksWalkDone,
  onWalkSelect: selectPanoramaMarksWalk,
  ensureRenderer: ensureBg360Renderer,
  isPanoramaPackPath: isBg360PackPath,
  writeVerbose: writeRuntimeVerbose
});

// Координатор сценария сохраняет прежнее имя ссылки, но само состояние создаёт и очищает модуль меток.
var bg360MarksRuntime = panoramaMarksController.state;

// Сообщает контроллеру, можно ли открыть photo-viewer поверх текущей панорамы.
function isPanoramaPhotoViewerPanoramaActive() {
  return !!bg360Runtime.active;
}

// Передаёт контроллеру блокировку меток активной команды walk360/goto360.
function isPanoramaPhotoViewerMarksLocked() {
  return !!bg360MarksRuntime.locked;
}

// Возвращает интерактивность панорамы, которую viewer должен восстановить после закрытия.
function getPanoramaPhotoViewerInteractive() {
  return !!bg360Runtime.interactive;
}

// Замораживает или восстанавливает вращение панорамы по решению photo-viewer.
function setPanoramaPhotoViewerInteractive(value) {
  bg360Runtime.interactive = !!value;
}

// Контроллер владеет карточкой фото, её DOM-событиями, zoom/pan и асинхронным lifecycle изображения.
var panoramaPhotoViewerController = window.VN_PANORAMA_PHOTO_VIEWER_CONTROLLER.createPanoramaPhotoViewerController({
  viewer: elBg360PhotoViewer,
  viewport: elBg360PhotoViewport,
  inner: elBg360PhotoInner,
  image: elBg360PhotoImg,
  caption: elBg360PhotoViewerCaption,
  panoramaCanvas: elBg360,
  marksLayer: elBg360Marks,
  window: window,
  document: document,
  assignImage: assignRasterImageToElement,
  getMarkById: findBg360MarkById,
  isPanoramaActive: isPanoramaPhotoViewerPanoramaActive,
  isMarksLocked: isPanoramaPhotoViewerMarksLocked,
  getPanoramaInteractive: getPanoramaPhotoViewerInteractive,
  setPanoramaInteractive: setPanoramaPhotoViewerInteractive
});
panoramaPhotoViewerController.start();

// Runtime walk360: активен, пока игрок не выберет метку или не выйдет кнопкой.
var walk360Runtime = {
  active: false,
  bgId: null,
  resultVar: "",
  done: false
};

// Runtime goto360 держит игрока внутри одного 360-пространства, пока метка не выведет в обычную сцену.
var goto360Runtime = {
  active: false,
  spaceId: "",
  panoramaId: "",
  entryId: "default",
  resultVar: "",
  done: false,
  titleText: "",
  buttonText: ""
};

// Подробная отладка автосохранения включается только через ?Debug=autosave или явный флаг window.VN_AUTOSAVE_DEBUG=true.
// Обычные ошибки записи остаются прямыми console.warn и не зависят от диагностического режима.

/** Выводит обезличенное состояние автосохранения только по явному запросу разработчика. */
function autosaveDebugLog(tag, detail) {
  var enabledByFlag = typeof window !== "undefined" && window.VN_AUTOSAVE_DEBUG === true;
  if (!enabledByFlag && !isExplicitDebugCategoryEnabled("autosave")) return;
  if (detail !== undefined) console.log("[AUTOSAVE_DEBUG]", tag, detail);
  else console.log("[AUTOSAVE_DEBUG]", tag);
}

// Возвращает реальные размеры img/video-элемента, потому что браузер хранит их в разных полях.
function getScrollableMediaSize(mediaEl) {
  if (!mediaEl) return null;

  var tagName = String(mediaEl.tagName || "").toLowerCase();
  if (tagName === "video") {
    if (!mediaEl.videoWidth || !mediaEl.videoHeight) return null;
    return { width: mediaEl.videoWidth, height: mediaEl.videoHeight };
  }

  if (!mediaEl.naturalWidth || !mediaEl.naturalHeight) return null;
  return { width: mediaEl.naturalWidth, height: mediaEl.naturalHeight };
}

// Сбрасывает только тот media-элемент, который раньше двигался, чтобы скрытые слои не наследовали старую позицию.
function resetScrollableMediaPosition(mediaEl) {
  if (mediaEl && mediaEl.style) {
    mediaEl.style.objectPosition = "center";
    mediaEl.style.transform = "";
    mediaEl.style.transformOrigin = "";
  }
}

// Включает общий горизонтальный скролл для активного img/video-элемента внутри заданного контейнера.
function activateMediaScroll(options, targetEl, containerEl, owner, positionOverride) {
  var normalized = normalizeBackgroundScrollOptions(options);
  var nextTarget = targetEl || elBg;
  var nextContainer = containerEl || elNovelWindow;

  if (backgroundScroll.target && backgroundScroll.target !== nextTarget) {
    resetScrollableMediaPosition(backgroundScroll.target);
  }

  backgroundScroll.owner = owner || "background";
  backgroundScroll.target = nextTarget;
  backgroundScroll.container = nextContainer;
  backgroundScroll.interactive = !!normalized.enabled;
  backgroundScroll.panorama360Fallback = normalized.panorama360Fallback === true;
  backgroundScroll.mediaScale = normalizeMediaScale(normalized.scale, 1);
  backgroundScroll.enabled =
    backgroundScroll.interactive ||
    typeof normalized.focusX === "number" ||
    typeof normalized.focusY === "number" ||
    (typeof backgroundScroll.mediaScale === "number" && Math.abs(backgroundScroll.mediaScale - 1) > 1e-6);
  backgroundScroll.start = normalizeBackgroundScrollStart(normalized.start, 0.5);
  backgroundScroll.focusX = typeof normalized.focusX === "number" ? normalized.focusX : null;
  backgroundScroll.focusY = typeof normalized.focusY === "number" ? normalized.focusY : null;
  backgroundScroll.position = typeof positionOverride === "number"
    ? clamp(positionOverride, 0, 1)
    : backgroundScroll.start;
  backgroundScroll.dragStartFocusY = typeof backgroundScroll.focusY === "number" ? backgroundScroll.focusY : 0.5;
  backgroundScroll.dragging = false;
  backgroundScroll.moved = false;
  applyBackgroundScrollPosition();

  if (!backgroundScroll.enabled) {
    backgroundScroll.available = false;
    backgroundScroll.maxOffset = 0;
    backgroundScroll.interactive = false;
    backgroundScroll.focusX = null;
    backgroundScroll.focusY = null;
    backgroundScroll.mediaScale = 1;
    resetScrollableMediaPosition(backgroundScroll.target);
    if (elNovelWindow) {
      elNovelWindow.classList.remove("bg-scrollable");
      elNovelWindow.classList.remove("bg-scroll-dragging");
    }
    hideBackgroundScrollHint();
    return;
  }

  updateBackgroundScrollAvailability();
}

// Устанавливает настройки скролла для текущего фонового media-слоя и запоминает их для возврата после видео-вставок.
function setBackgroundScrollOptions(options, targetEl, containerEl) {
  var normalized = normalizeBackgroundScrollOptions(options);
  backgroundScroll.backgroundOptions = normalized;
  backgroundScroll.backgroundTarget = targetEl || elBg;
  backgroundScroll.backgroundContainer = containerEl || elNovelWindow;
  backgroundScroll.backgroundPosition = typeof normalized.focusX === "number"
    ? 0.5
    : normalizeBackgroundScrollStart(normalized.start, 0.5);
  activateMediaScroll(normalized, backgroundScroll.backgroundTarget, backgroundScroll.backgroundContainer, "background");
}

// Включает временный скролл поверх сюжетного video/poster и не затирает настройки фонового слоя.
function setStoryVideoScrollOptions(options, targetEl) {
  var normalized = normalizeBackgroundScrollOptions(options);
  var scaleEff = normalizeMediaScale(normalized.scale, 1);
  if (
    !normalized.enabled &&
    typeof normalized.focusX !== "number" &&
    typeof normalized.focusY !== "number" &&
    Math.abs(scaleEff - 1) <= 1e-6
  ) {
    return;
  }
  activateMediaScroll(normalized, targetEl || elStoryVideo, elStoryVideoOverlay || elNovelWindow, "storyVideo");
}

// Переключает скролл сюжетного видео с постера на ролик или обратно, сохраняя уже выбранную позицию.
function switchStoryVideoScrollTarget(targetEl) {
  if (backgroundScroll.owner !== "storyVideo" || !backgroundScroll.enabled || !targetEl) return;
  activateMediaScroll(
    {
      enabled: backgroundScroll.interactive,
      start: backgroundScroll.start,
      focusX: backgroundScroll.focusX,
      focusY: backgroundScroll.focusY,
      scale: backgroundScroll.mediaScale
    },
    targetEl,
    elStoryVideoOverlay || elNovelWindow,
    "storyVideo",
    backgroundScroll.position
  );
}

// После завершения сюжетного ролика возвращает интерактивность к фону, если она была временно занята видео.
function restoreBackgroundScrollAfterStoryVideo() {
  if (backgroundScroll.owner !== "storyVideo") return;
  activateMediaScroll(
    backgroundScroll.backgroundOptions,
    backgroundScroll.backgroundTarget || elBg,
    backgroundScroll.backgroundContainer || elNovelWindow,
    "background",
    backgroundScroll.backgroundPosition
  );
}

// Полностью выключает интерактивный скролл и возвращает фон к обычному центрированию.
function disableBackgroundScroll() {
  resetScrollableMediaPosition(backgroundScroll.target);
  backgroundScroll.enabled = false;
  backgroundScroll.available = false;
  backgroundScroll.dragging = false;
  backgroundScroll.pointerId = null;
  backgroundScroll.maxOffset = 0;
  backgroundScroll.owner = "background";
  backgroundScroll.target = null;
  backgroundScroll.container = null;
  backgroundScroll.interactive = false;
  backgroundScroll.position = 0.5;
  backgroundScroll.focusX = null;
  backgroundScroll.focusY = null;
  backgroundScroll.mediaScale = 1;
  backgroundScroll.panorama360Fallback = false;
  backgroundScroll.backgroundOptions = { enabled: false, start: 0.5, focusX: null, focusY: null, scale: 1, is360: false, focusZ: null, fov: null, quality: "auto", panorama360Fallback: false };
  backgroundScroll.backgroundTarget = null;
  backgroundScroll.backgroundContainer = null;
  backgroundScroll.backgroundPosition = 0.5;
  if (elNovelWindow) {
    elNovelWindow.classList.remove("bg-scrollable");
    elNovelWindow.classList.remove("bg-scroll-dragging");
  }
  hideBackgroundScrollHint();
}

// Пересчитывает, есть ли у текущего img/video скрытая ширина для горизонтального перетаскивания.
function updateBackgroundScrollAvailability() {
  // Для активного WebGL-360 используем отдельную подсказку навигации.
  // Иначе общий resize-хендлер для wide-bg скрывает hint, хотя 360 остаётся интерактивным.
  if (bg360Runtime && bg360Runtime.active) {
    if (elNovelWindow) {
      elNovelWindow.classList.remove("bg-scrollable");
      elNovelWindow.classList.remove("bg-scroll-dragging");
    }
    if (bg360Runtime.interactive) showBg360NavigationHint();
    else hideBackgroundScrollHint();
    return;
  }

  var targetEl = backgroundScroll.target || elBg;
  var containerEl = backgroundScroll.container || elNovelWindow;

  if (!backgroundScroll.enabled || !targetEl || !containerEl || targetEl.classList.contains("hidden")) {
    backgroundScroll.available = false;
    if (elNovelWindow) elNovelWindow.classList.remove("bg-scrollable");
    hideBackgroundScrollHint();
    return;
  }

  var mediaSize = getScrollableMediaSize(targetEl);
  if (!mediaSize) {
    backgroundScroll.available = false;
    if (elNovelWindow) elNovelWindow.classList.remove("bg-scrollable");
    hideBackgroundScrollHint();
    return;
  }

  var rect = containerEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  var objectFit = "cover";
  if (window.getComputedStyle) {
    objectFit = window.getComputedStyle(targetEl).objectFit || objectFit;
  }
  var layoutScale = typeof backgroundScroll.mediaScale === "number" ? backgroundScroll.mediaScale : 1;
  if (!isFinite(layoutScale) || layoutScale <= 0) layoutScale = 1;
  var scale = (objectFit === "contain"
    ? Math.min(rect.width / mediaSize.width, rect.height / mediaSize.height)
    : Math.max(rect.width / mediaSize.width, rect.height / mediaSize.height)) * layoutScale;
  var renderedWidth = mediaSize.width * scale;
  backgroundScroll.maxOffset = Math.max(0, renderedWidth - rect.width);
  // Для 360-fallback интерактив нужен даже когда горизонтального запаса мало:
  // остаются вертикальный обзор и zoom колесом.
  backgroundScroll.available = backgroundScroll.interactive && (
    backgroundScroll.maxOffset > 1 ||
    backgroundScroll.panorama360Fallback
  );

  elNovelWindow.classList.toggle("bg-scrollable", backgroundScroll.available);

  if (
    typeof backgroundScroll.focusX === "number" ||
    typeof backgroundScroll.focusY === "number" ||
    backgroundScroll.maxOffset > 1 ||
    (typeof backgroundScroll.mediaScale === "number" && Math.abs(backgroundScroll.mediaScale - 1) > 1e-6)
  ) {
    applyBackgroundScrollPosition();
  }

  if (backgroundScroll.available) {
    showBackgroundScrollHint();
  } else {
    hideBackgroundScrollHint();
  }
}

// Собирает размеры media и контейнера для cover/contain — общая основа для focusX и обратного пересчёта.
// mediaScaleFactor — множитель «зума» сценария (scale), совпадает с CSS transform на элементе.
function getMediaCoverLayoutMetrics(targetEl, containerEl, mediaScaleFactor) {
  if (!targetEl || !containerEl) return null;
  var mediaSize = getScrollableMediaSize(targetEl);
  if (!mediaSize) return null;
  var rect = containerEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  var objectFit = "cover";
  if (window.getComputedStyle) {
    objectFit = window.getComputedStyle(targetEl).objectFit || objectFit;
  }
  var extra = typeof mediaScaleFactor === "number" && isFinite(mediaScaleFactor) && mediaScaleFactor > 0 ? mediaScaleFactor : 1;
  var scale = (objectFit === "contain"
    ? Math.min(rect.width / mediaSize.width, rect.height / mediaSize.height)
    : Math.max(rect.width / mediaSize.width, rect.height / mediaSize.height)) * extra;
  var renderedWidth = mediaSize.width * scale;
  var hiddenWidth = Math.max(0, renderedWidth - rect.width);
  return {
    renderedWidth: renderedWidth,
    hiddenWidth: hiddenWidth,
    rectWidth: rect.width,
    objectFit: objectFit
  };
}

// Переводит focusX (доля по ширине исходника) в object-position по X: точка композиции стремится к центру контейнера, но без пустых полей.
function computeFocusedMediaPosition(targetEl, containerEl, focusX, mediaScaleFactor) {
  var metrics = getMediaCoverLayoutMetrics(targetEl, containerEl, mediaScaleFactor);
  if (!metrics) return 0.5;
  if (metrics.hiddenWidth <= 1) return 0.5;

  var desiredHiddenLeft = clamp(focusX, 0, 1) * metrics.renderedWidth - metrics.rectWidth / 2;
  return clamp(desiredHiddenLeft / metrics.hiddenWidth, 0, 1);
}

// Обратная к computeFocusedMediaPosition: по доле горизонтального pan (как в backgroundScroll.position) даёт focusX 0..1.
function computeSemanticFocusFromScrollPosition(targetEl, containerEl, position, mediaScaleFactor) {
  var metrics = getMediaCoverLayoutMetrics(targetEl, containerEl, mediaScaleFactor);
  if (!metrics) return null;
  if (metrics.hiddenWidth <= 1) return null;
  var P = clamp(position, 0, 1);
  var fx = (P * metrics.hiddenWidth + metrics.rectWidth / 2) / metrics.renderedWidth;
  return clamp(fx, 0, 1);
}

// Читает горизонтальную долю из object-position (inline или computed), 0 = слева, 0.5 = center, 1 = справа.
function readHorizontalObjectPositionFraction(mediaEl) {
  if (!mediaEl) return 0.5;
  var raw = (mediaEl.style && mediaEl.style.objectPosition) ? String(mediaEl.style.objectPosition).trim() : "";
  if (!raw && window.getComputedStyle) {
    raw = String(window.getComputedStyle(mediaEl).objectPosition || "").trim();
  }
  if (!raw) return 0.5;
  var first = raw.split(/\s+/)[0].toLowerCase();
  if (first === "left") return 0;
  if (first === "right") return 1;
  if (first === "center") return 0.5;
  var m = first.match(/^([\d.]+)%$/);
  if (m) return clamp(Number(m[1]) / 100, 0, 1);
  return 0.5;
}

// Формирует блок статистики: видимые фон/сюжетное видео и значение focusX для копирования в story.js.
function formatCurrentViewportMediaFocusForStats() {
  var lines = [];
  lines.push("=== ТЕКУЩИЙ КАДР — focusX (для правки сценария) ===");
  lines.push("");

  function appendLayer(title, mediaEl, containerEl) {
    if (!mediaEl || mediaEl.classList.contains("hidden")) return;
    var src = normalizeAssetUrl(mediaEl.currentSrc || mediaEl.src || "");
    if (!src) return;
    var container = containerEl || elNovelWindow;
    var shortName = src.split(/[\\/]/).pop() || src;

    var msLayer =
      backgroundScroll && backgroundScroll.enabled && backgroundScroll.target === mediaEl
        ? (typeof backgroundScroll.mediaScale === "number" ? backgroundScroll.mediaScale : 1)
        : 1;
    var metrics = getMediaCoverLayoutMetrics(mediaEl, container, msLayer);
    var hasScriptFocus = !!(backgroundScroll && backgroundScroll.enabled && backgroundScroll.target === mediaEl && typeof backgroundScroll.focusX === "number");
    var semantic = null;
    var note = "";

    if (!metrics && !hasScriptFocus) {
      lines.push(title + ": " + shortName);
      lines.push("  focusX: размеры кадра ещё не известны (загрузка media) — закройте и снова откройте статистику через секунду");
      lines.push("");
      return;
    }

    if (hasScriptFocus) {
      semantic = clamp(backgroundScroll.focusX, 0, 1);
      if (metrics && metrics.hiddenWidth <= 1) {
        note = " (на текущем размере окна горизонтального кропа нет — при другом aspect значение всё равно задаёт центр композиции)";
      }
    } else {
      var pan = 0.5;
      if (backgroundScroll && backgroundScroll.enabled && backgroundScroll.target === mediaEl) {
        pan = typeof backgroundScroll.position === "number" ? backgroundScroll.position : 0.5;
      } else {
        pan = readHorizontalObjectPositionFraction(mediaEl);
      }
      semantic = computeSemanticFocusFromScrollPosition(mediaEl, container, pan, msLayer);
      if (semantic === null) {
        note = " — на этом размере окна горизонтальный кроп отсутствует, focusX в сценарии не сдвинет кадр";
        semantic = 0.5;
      }
    }

    lines.push(title + ": " + shortName);
    lines.push("  focusX=" + semantic.toFixed(4) + note);
    lines.push("  скопируйте в сценарий: focusx=" + semantic.toFixed(4) + " в [bg]/[video] или focusX=" + semantic.toFixed(4) + " в команде bg / video");
    if (backgroundScroll && backgroundScroll.enabled && backgroundScroll.target === mediaEl && typeof backgroundScroll.focusY === "number") {
      lines.push("  focusY=" + clamp(backgroundScroll.focusY, 0, 1).toFixed(4) + " (ось Y: прямой % в object-position, без учёта кропа)");
      lines.push("  скопируйте: focusy=" + clamp(backgroundScroll.focusY, 0, 1).toFixed(4));
    }
    lines.push("");
  }

  var any = false;
  if (elBgVideo && !elBgVideo.classList.contains("hidden") && (elBgVideo.currentSrc || elBgVideo.src)) {
    appendLayer("Фон (видео)", elBgVideo, elNovelWindow);
    any = true;
  } else if (elBg && !elBg.classList.contains("hidden") && (elBg.currentSrc || elBg.src)) {
    appendLayer("Фон (изображение)", elBg, elNovelWindow);
    any = true;
  }

  if (elStoryVideoOverlay && !elStoryVideoOverlay.classList.contains("hidden")) {
    if (elStoryVideo && !elStoryVideo.classList.contains("hidden") && (elStoryVideo.currentSrc || elStoryVideo.src)) {
      appendLayer("Сюжетное видео (ролик)", elStoryVideo, elStoryVideoOverlay || elNovelWindow);
      any = true;
    } else if (elStoryVideoPoster && !elStoryVideoPoster.classList.contains("hidden") && (elStoryVideoPoster.currentSrc || elStoryVideoPoster.src)) {
      appendLayer("Сюжетное видео (постер)", elStoryVideoPoster, elStoryVideoOverlay || elNovelWindow);
      any = true;
    }
  }

  if (!any) {
    lines.push("(нет видимого фонового слоя изображения/видео и слоя сюжетного ролика с источником)");
    lines.push("");
  }

  return lines.join("\n");
}

// Применяет позицию object-position: scroll задаёт прямую позицию по X, focusX — с учётом кропа по X;
// focusY задаётся долей 0..1 и идёт в % по Y напрямую (без коррекции по «скрытой» высоте).
function applyBackgroundScrollPosition() {
  var targetEl = backgroundScroll.target || elBg;
  if (!targetEl) return;
  var ms = typeof backgroundScroll.mediaScale === "number" ? backgroundScroll.mediaScale : 1;
  if (!isFinite(ms) || ms <= 0) ms = 1;
  var position = typeof backgroundScroll.focusX === "number"
    ? computeFocusedMediaPosition(targetEl, backgroundScroll.container || elNovelWindow, backgroundScroll.focusX, ms)
    : backgroundScroll.position;
  var x = clamp(position, 0, 1) * 100;
  var yCss = "center";
  var yOrigin = "50%";
  if (typeof backgroundScroll.focusY === "number") {
    var yFrac = clamp(backgroundScroll.focusY, 0, 1);
    yCss = (yFrac * 100).toFixed(3) + "%";
    yOrigin = yCss;
  }
  targetEl.style.objectPosition = x.toFixed(3) + "% " + yCss;
  targetEl.style.transformOrigin = x.toFixed(3) + "% " + yOrigin;
  if (Math.abs(ms - 1) > 1e-6) {
    targetEl.style.transform = "scale(" + ms + ")";
  } else {
    targetEl.style.transform = "";
  }
  // Дубликат под blur должен совпадать по кропу с основным роликом при pan wide-bg.
  if (STORY && STORY.meta && STORY.meta.blurBackground && elBlurBgVideo && !elBlurBgVideo.classList.contains("hidden")) {
    if (targetEl === elBgVideo || targetEl === elStoryVideo) {
      copyBgVideoObjectPositionToBlur(targetEl, elBlurBgVideo);
    }
  }
}

// Показывает короткую подсказку, чтобы игрок заметил возможность сдвинуть широкий фон.
function showBackgroundScrollHint() {
  if (!elBgScrollHint || !backgroundScroll.available) return;

  clearTimeout(backgroundScroll.hintTimer);
  elBgScrollHint.textContent = t("bgScrollHint");
  elBgScrollHint.classList.toggle("is-story-video", backgroundScroll.owner === "storyVideo");
  elBgScrollHint.classList.remove("hidden");
  requestAnimationFrame(function () {
    if (elBgScrollHint) elBgScrollHint.classList.add("is-visible");
  });
}

// Показывает подсказку навигации 360, когда обзор можно двигать в любом направлении.
function showBg360NavigationHint() {
  if (!elBgScrollHint || !bg360Runtime.interactive) return;
  clearTimeout(backgroundScroll.hintTimer);
  elBgScrollHint.textContent = t("bg360Hint");
  elBgScrollHint.classList.remove("is-story-video");
  elBgScrollHint.classList.add("is-360");
  elBgScrollHint.classList.remove("hidden");
  requestAnimationFrame(function () {
    if (elBgScrollHint) elBgScrollHint.classList.add("is-visible");
  });
}

// Скрывает подсказку без удаления элемента, чтобы ее можно было снова показать при следующем фоне.
function hideBackgroundScrollHint() {
  if (!elBgScrollHint) return;
  clearTimeout(backgroundScroll.hintTimer);
  backgroundScroll.hintTimer = null;
  elBgScrollHint.classList.remove("is-visible");
  elBgScrollHint.classList.remove("is-story-video");
  elBgScrollHint.classList.remove("is-360");
  elBgScrollHint.classList.add("hidden");
}

// Начинает drag только по сцене: UI, меню и видео не должны перехватываться как скролл фона.
function handleBackgroundScrollPointerDown(e) {
  // Пока сценарий не загружен, возможен ранний return движка — backgroundScroll ещё не создан.
  if (!backgroundScroll) return;
  if (!backgroundScroll.interactive || !backgroundScroll.available || backgroundScroll.dragging) return;
  if (state.inGame) return;
  if (state.inVideo && backgroundScroll.owner !== "storyVideo") return;
  if (e.pointerType === "mouse" && e.button !== 0) return;
  if (isUiClick(e.target) && backgroundScroll.owner !== "storyVideo") return;

  if (typeof backgroundScroll.focusX === "number" && backgroundScroll.maxOffset > 1) {
    var msDrag = typeof backgroundScroll.mediaScale === "number" ? backgroundScroll.mediaScale : 1;
    backgroundScroll.position = computeFocusedMediaPosition(
      backgroundScroll.target || elBg,
      backgroundScroll.container || elNovelWindow,
      backgroundScroll.focusX,
      msDrag
    );
    backgroundScroll.focusX = null;
  }
  backgroundScroll.dragging = true;
  backgroundScroll.pointerId = e.pointerId;
  backgroundScroll.dragStartX = e.clientX;
  backgroundScroll.dragStartY = e.clientY;
  backgroundScroll.dragStartPosition = backgroundScroll.position;
  backgroundScroll.dragStartFocusY = typeof backgroundScroll.focusY === "number" ? backgroundScroll.focusY : 0.5;
  backgroundScroll.moved = false;

  if (elNovelWindow) {
    elNovelWindow.classList.add("bg-scroll-dragging");
    if (typeof elNovelWindow.setPointerCapture === "function") {
      try {
        elNovelWindow.setPointerCapture(e.pointerId);
      } catch (captureError) {
        // Pointer capture необязателен: drag продолжает отслеживаться по pointerId.
      }
    }
  }
}

// Во время drag двигаем фон в сторону указателя; в 360-fallback добавляем вертикальный обзор по Y.
function handleBackgroundScrollPointerMove(e) {
  if (!backgroundScroll) return;
  if (!backgroundScroll.dragging || e.pointerId !== backgroundScroll.pointerId) return;

  var dx = e.clientX - backgroundScroll.dragStartX;
  var dy = e.clientY - backgroundScroll.dragStartY;
  if (Math.abs(dx) > 3 || (backgroundScroll.panorama360Fallback && Math.abs(dy) > 3)) {
    backgroundScroll.moved = true;
  }

  if (backgroundScroll.maxOffset > 1) {
    // У object-position увеличение X визуально уводит слой влево, поэтому dx вычитается.
    backgroundScroll.position = clamp(
      backgroundScroll.dragStartPosition - (dx / backgroundScroll.maxOffset),
      0,
      1
    );
  }
  if (backgroundScroll.owner === "background") {
    backgroundScroll.backgroundPosition = backgroundScroll.position;
  }
  if (backgroundScroll.panorama360Fallback) {
    var containerHeight = backgroundScroll.container ? backgroundScroll.container.clientHeight : (elNovelWindow ? elNovelWindow.clientHeight : 0);
    if (containerHeight > 0) {
      var yDelta = (e.clientY - backgroundScroll.dragStartY) / containerHeight;
      backgroundScroll.focusY = clamp((typeof backgroundScroll.dragStartFocusY === "number" ? backgroundScroll.dragStartFocusY : 0.5) - yDelta, 0, 1);
    }
  }
  applyBackgroundScrollPosition();

  if (backgroundScroll.moved) {
    e.preventDefault();
    e.stopPropagation();
  }
}

// Поддерживает zoom колесом в 360-fallback (без WebGL), меняя mediaScale в реальном времени.
function handleBackgroundScrollWheel(e) {
  if (!backgroundScroll || !backgroundScroll.interactive) return;
  if (!backgroundScroll.panorama360Fallback) return;
  if (isUiClick(e.target) && backgroundScroll.owner !== "storyVideo") return;
  var currentScale = typeof backgroundScroll.mediaScale === "number" ? backgroundScroll.mediaScale : 1;
  var nextScale = e.deltaY < 0 ? currentScale * 1.06 : currentScale * 0.94;
  backgroundScroll.mediaScale = normalizeMediaScale(nextScale, currentScale);
  applyBackgroundScrollPosition();
  updateBackgroundScrollAvailability();
  e.preventDefault();
  e.stopPropagation();
}

// Завершает drag и подавляет следующий click, если пользователь действительно двигал фон.
function handleBackgroundScrollPointerUp(e) {
  if (!backgroundScroll) return;
  if (!backgroundScroll.dragging || e.pointerId !== backgroundScroll.pointerId) return;

  var wasMoved = backgroundScroll.moved;
  backgroundScroll.dragging = false;
  backgroundScroll.pointerId = null;

  if (elNovelWindow) {
    elNovelWindow.classList.remove("bg-scroll-dragging");
    if (typeof elNovelWindow.releasePointerCapture === "function") {
      try {
        elNovelWindow.releasePointerCapture(e.pointerId);
      } catch (captureError) {
        // Pointer capture мог быть уже снят браузером, состояние drag всё равно очищается ниже.
      }
    }
  }

  if (wasMoved) {
    backgroundScroll.suppressClick = true;
    clearTimeout(backgroundScroll.suppressTimer);
    backgroundScroll.suppressTimer = setTimeout(function () {
      backgroundScroll.suppressClick = false;
    }, 250);
    e.preventDefault();
    e.stopPropagation();
  }
}

// Сбрасывает незавершенный drag, если браузер отменил pointer-событие.
function handleBackgroundScrollPointerCancel(e) {
  if (!backgroundScroll) return;
  if (!backgroundScroll.dragging || e.pointerId !== backgroundScroll.pointerId) return;
  backgroundScroll.dragging = false;
  backgroundScroll.pointerId = null;
  if (elNovelWindow) elNovelWindow.classList.remove("bg-scroll-dragging");
}

// Флаг для отслеживания первого диалога
var isFirstDialog = true;

var failedAssets = {
  audio: Object.create(null),
  images: Object.create(null)
};

// ---------- Аудио ----------
// Возвращает настройки истории при старте и рестарте, не связывая модуль с глобальным STORY.
function getAudioControllerDefaults() {
  return STORY && STORY.audioSettings ? STORY.audioSettings : null;
}

// Проверяет аудиопуть через общую runtime-политику с фиксированным видом ресурса.
function resolveAudioControllerAssetUrl(src) {
  return resolveRuntimeStoryAssetUrl(src, "audio");
}

// Открывает подробные аудиосообщения только для явно включённой debug-категории.
function isAudioControllerDebugEnabled() {
  return isExplicitDebugCategoryEnabled("audio");
}

// Сообщает контроллеру о сюжетном видео через состояние координатора, нужное для общего ducking.
function isStoryVideoActiveForAudio() {
  return !!(state && state.inVideo);
}

// Один lifecycle-контроллер владеет BGM/SFX, UI громкости и звуком обычных видеоэлементов.
var audioController = window.VN_AUDIO_CONTROLLER.createAudioController({
  AudioConstructor: window.Audio,
  bgVideo: elBgVideo,
  storyVideo: elStoryVideo,
  muteButton: btnMute,
  volumeSlider: sliderVolume,
  failedAudio: failedAssets.audio,
  getDefaults: getAudioControllerDefaults,
  resolveAudioUrl: resolveAudioControllerAssetUrl,
  normalizeUrl: normalizeAssetUrl,
  sanitizeResource: sanitizeDiagnosticResource,
  isAudioDebugEnabled: isAudioControllerDebugEnabled,
  isStoryVideoActive: isStoryVideoActiveForAudio,
  writeVerbose: writeRuntimeVerbose,
  warn: console.warn.bind(console),
  clamp: clamp,
  lerp: lerp,
  endsWith: endsWith
});
var audio = audioController.state;
var DEFAULT_BGM_DUCKING_RELEASE_MS = window.VN_AUDIO_CONTROLLER.DEFAULT_BGM_DUCKING_RELEASE_MS;

// Возвращает текущую настройку blurBackground без передачи STORY в медиамодуль.
function isBackgroundMediaBlurEnabled() {
  return !!(STORY && STORY.meta && STORY.meta.blurBackground);
}

// Маршрутизирует только 360-запрос к существующей панорамной подсистеме.
function showBackgroundMediaPanorama(src, fallbackSrc, scrollOptions) {
  setBackground360(src, fallbackSrc, scrollOptions);
}

// Сохраняет громкость обычного видеофона в общем аудиосостоянии.
function setBackgroundMediaVideoVolume(volume) {
  audio.currentBgVideoVolume = volume;
}

// Возвращает BGM к обычной громкости после исчезновения слышимого видеофона.
function releaseBackgroundMediaDucking(reason) {
  audioController.setBgmDuckingTarget(1, DEFAULT_BGM_DUCKING_RELEASE_MS, reason);
}

// Контроллер владеет обычными background image/video, fallback и остановленным blur-video дубликатом.
var backgroundMediaController = window.VN_BACKGROUND_MEDIA_CONTROLLER.createBackgroundMediaController({
  image: elBg,
  video: elBgVideo,
  container: elNovelWindow,
  blurLayer: elBlurBgLayer,
  blurImage: elBlurBgImage,
  blurVideo: elBlurBgVideo,
  failedImages: failedAssets.images,
  normalizeScrollOptions: normalizeBackgroundScrollOptions,
  resolveAssetUrl: resolveRuntimeStoryAssetUrl,
  normalizeUrl: normalizeAssetUrl,
  sanitizeResource: sanitizeDiagnosticResource,
  isVideoPath: isVideoAssetPath,
  areAllImageCandidatesFailed: areAllImageCandidatesFailed,
  assignRasterImage: assignRasterImageToElement,
  isBlurEnabled: isBackgroundMediaBlurEnabled,
  findVideoFallbackImage: findBlurFallbackImageForBgVideoUrl,
  disablePanorama: disableBg360Renderer,
  showPanorama: showBackgroundMediaPanorama,
  hidePanoramaHold: hideBg360HoldLayer,
  setScrollOptions: setBackgroundScrollOptions,
  disableScroll: disableBackgroundScroll,
  updateScrollAvailability: updateBackgroundScrollAvailability,
  flushAutosaveScrollRestore: flushAutosaveBgScrollRestorePending,
  hideKeptStoryVideo: hideKeptStoryVideoAfterBgReady,
  setBackgroundVideoVolume: setBackgroundMediaVideoVolume,
  releaseBackgroundDucking: releaseBackgroundMediaDucking,
  setDuckingForActiveVideos: setBgmDuckingForActiveVideos,
  applyAudioSettings: applyAudioSettings,
  visualTrace: visualTrace,
  writeVerbose: writeRuntimeVerbose,
  warn: console.warn.bind(console),
  clamp: clamp
});

// Возвращает контроллеру только описание запрошенного персонажа из текущей истории.
function getCharacterControllerDefinition(charId) {
  return STORY && STORY.assets && STORY.assets.characters ? STORY.assets.characters[charId] || null : null;
}

// Передаёт минимальный flow-контекст для защиты загрузки и явно включённой диагностики персонажа.
function getCharacterControllerRuntimeContext() {
  return {
    sceneId: state && state.sceneId,
    actionIndex: state && state.actionIndex,
    currentSceneId: currentSceneId
  };
}

// Открывает подробную диагностику только по старому флагу или явной категории Debug=character.
function isCharacterControllerDebugEnabled() {
  return window.VN_CHAR_DEBUG === true || isExplicitDebugCategoryEnabled("character");
}

// Контроллер владеет поколениями загрузки, focus/scale, DOM-рамкой и снимком персонажа для autosave.
var characterController = window.VN_CHARACTER_CONTROLLER.createCharacterController({
  character: elChar,
  frame: elCharFrame,
  novelWindow: elNovelWindow,
  window: window,
  performance: window.performance,
  failedImages: failedAssets.images,
  getCharacterDefinition: getCharacterControllerDefinition,
  getRuntimeContext: getCharacterControllerRuntimeContext,
  isDebugEnabled: isCharacterControllerDebugEnabled,
  normalizeFocusX: normalizeMediaFocus,
  normalizeScale: normalizeMediaScale,
  resolveVariableValue: resolveMediaVariableValue,
  normalizeUrl: normalizeAssetUrl,
  imageMatchesCandidates: imageUrlMatchesStoryCandidates,
  areAllImageCandidatesFailed: areAllImageCandidatesFailed,
  assignRasterImage: assignRasterImageToElement,
  sanitizeResource: sanitizeDiagnosticResource,
  sanitizeDetails: sanitizeDiagnosticDetails,
  writeVerbose: writeRuntimeVerbose,
  getComputedStyle: window.getComputedStyle.bind(window),
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: typeof window.cancelAnimationFrame === "function" ? window.cancelAnimationFrame.bind(window) : null,
  warn: console.warn.bind(console),
  log: console.log.bind(console),
  clamp: clamp
});

// Возвращает visual controller только актуальные meta-настройки, не передавая ему глобальный STORY.
function getVisualTransitionStoryMeta() {
  return STORY && STORY.meta ? STORY.meta : {};
}

// Сообщает, что текущий фон отрисовывается панорамным renderer и не должен участвовать в обычном crossfade.
function isCurrentVisualTransitionBackground360() {
  return !!(backgroundScroll && backgroundScroll.backgroundOptions && backgroundScroll.backgroundOptions.is360 === true);
}

// Загружает растровый ассет через общую цепочку оптимизированных кандидатов до начала fade-out.
function preloadVisualTransitionImage(src) {
  var storyPath = String(src || "").trim();
  if (!storyPath || areAllImageCandidatesFailed(storyPath)) return Promise.resolve(false);

  return new Promise(function(resolve) {
    loadRasterImageResource(storyPath, {
      onLoad: function handleVisualTransitionPreloadSuccess() {
        resolve(true);
      },
      onError: function handleVisualTransitionPreloadFailure() {
        resolve(false);
      }
    });
  });
}

// Проверяет video-src временного слоя через ту же политику ресурсов, что и основной фон.
function resolveVisualTransitionVideoUrl(src) {
  return resolveRuntimeStoryAssetUrl(src, "video");
}

// Контроллер владеет батчами, временными DOM-слоями, ожиданиями media и отменой визуальных переходов.
var visualTransitionController = window.VN_VISUAL_TRANSITION_CONTROLLER.createVisualTransitionController({
  document: document,
  novelWindow: elNovelWindow,
  backgroundImage: elBg,
  backgroundVideo: elBgVideo,
  panorama: elBg360,
  character: elChar,
  blurLayer: elBlurBgLayer,
  blurImage: elBlurBgImage,
  blurVideo: elBlurBgVideo,
  getStoryMeta: getVisualTransitionStoryMeta,
  isCurrentBackground360: isCurrentVisualTransitionBackground360,
  prepareBackground: prepareBackgroundVisualAction,
  prepareCharacter: characterController.prepareVisualAction,
  applyBackground: applyPreparedBackgroundVisualState,
  applyCharacter: characterController.applyPreparedVisualState,
  applyPanoramaMarks: applyBg360Marks,
  preloadImage: preloadVisualTransitionImage,
  assignRasterImage: assignRasterImageToElement,
  resolveVideoUrl: resolveVisualTransitionVideoUrl,
  normalizeUrl: normalizeAssetUrl,
  isVideoPath: isVideoAssetPath,
  isBlurEnabled: isBackgroundMediaBlurEnabled,
  normalizeScrollOptions: normalizeBackgroundScrollOptions,
  normalizeMediaScale: normalizeMediaScale,
  normalizeScrollStart: normalizeBackgroundScrollStart,
  computeFocusedMediaPosition: computeFocusedMediaPosition,
  resetScrollableMediaPosition: resetScrollableMediaPosition,
  clamp: clamp,
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: typeof window.cancelAnimationFrame === "function" ? window.cancelAnimationFrame.bind(window) : null,
  warn: console.warn.bind(console)
});

function normalizeAssetUrl(url) {
  if (!url) return "";
  try {
    return new URL(url, window.location.href).href;
  } catch (e) {
    return String(url);
  }
}

// Проверяет сценарный путь на общей политике и возвращает только URL внутри assets текущего проекта.
// Уже нормализованный URL разрешён лишь для внутренних повторных вызовов движка и проходит ту же проверку каталога и типа.
function resolveRuntimeStoryAssetUrl(path, kind) {
  var value = typeof path === "string" ? path.trim() : "";
  var policy = window.VNResourcePathPolicy;
  if (!value || !policy || typeof policy.validate !== "function" || typeof policy.resolve !== "function") {
    return "";
  }

  var check = policy.validate(value, kind);
  if (check.ok) {
    var resolved = policy.resolve(value, window.location.href, kind);
    if (resolved.ok) return resolved.url;
  }

  try {
    var assetBase = new URL("assets/", window.location.href);
    var absolute = new URL(value);
    var assetBaseHref = assetBase.href;
    if (
      absolute.protocol === assetBase.protocol &&
      absolute.host === assetBase.host &&
      !absolute.username &&
      !absolute.password &&
      !absolute.search &&
      !absolute.hash &&
      absolute.href.indexOf(assetBaseHref) === 0
    ) {
      var relative = "assets/" + absolute.href.slice(assetBaseHref.length);
      var internalCheck = policy.validate(relative, kind);
      if (internalCheck.ok) return absolute.href;
    }
  } catch (e) {
    // Некорректный URL обрабатывается общей блокировкой ресурса ниже.
  }

  console.warn("[SECURITY] Заблокирован недопустимый путь ресурса:", sanitizeDiagnosticResource(value), kind || "asset");
  return "";
}

// Кэш уже найденного рабочего URL для пути из сценария: повторные показы не перебирают 404 webp.
var imageOptimizeResolvedCache = Object.create(null);
// Если оба webp-варианта уже дали 404, дальше для этого пути пробуем только исходник из сценария.
var imageOptimizeWebpExhaustedCache = Object.create(null);

// Возвращает режим engine.optimized: false, true или auto (по умолчанию false).
function getEngineOptimizedMode() {
  var engine = window.STORY && window.STORY.meta && window.STORY.meta.engine;
  var raw = engine && engine.optimized !== undefined && engine.optimized !== null
    ? String(engine.optimized).trim().toLowerCase()
    : "false";
  if (raw === "true" || raw === "1") return "true";
  if (raw === "auto") return "auto";
  return "false";
}

// В true/auto включается цепочка webp-копий; false оставляет только исходный путь из сценария.
function isEngineImageOptimizationEnabled() {
  var mode = getEngineOptimizedMode();
  return mode === "true" || mode === "auto";
}

// Проверяет, что путь — растровое изображение, для которого имеет смысл искать --vnv-optimized webp.
function isRasterImagePathForOptimization(path) {
  var value = String(path || "").trim();
  if (!value) return false;
  if (/^data:/i.test(value)) return false;
  if (/--vnv-optimized(-mobile)?\.webp(\?|#|$)/i.test(value)) return false;
  if (/\.(mp4|webm|js)(\?|#|$)/i.test(value)) return false;
  if (!/\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(value)) return false;
  if (/\.webp(\?|#|$)/i.test(value)) return false;
  return true;
}

// Проверяет, что путь можно сохранить для гидрации миниатюр Mermaid: src может пропасть у любого обычного растрового файла.
function isGraphRasterImagePath(path) {
  var value = String(path || "").trim();
  if (!value) return false;
  if (/^data:/i.test(value)) return false;
  if (/\.(mp4|webm|js)(\?|#|$)/i.test(value)) return false;
  return /\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(value);
}

// Делит путь сценария на базу без расширения и хвост (?query/#hash).
function splitStoryImagePathForOptimize(path) {
  var raw = String(path || "").trim();
  if (!raw) return { basePath: "", suffix: "" };
  var hashIdx = raw.indexOf("#");
  var hash = hashIdx >= 0 ? raw.slice(hashIdx) : "";
  var withoutHash = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
  var queryIdx = withoutHash.indexOf("?");
  var query = queryIdx >= 0 ? withoutHash.slice(queryIdx) : "";
  var pathOnly = queryIdx >= 0 ? withoutHash.slice(0, queryIdx) : withoutHash;
  var dot = pathOnly.lastIndexOf(".");
  if (dot <= 0) return { basePath: pathOnly, suffix: query + hash };
  return {
    basePath: pathOnly.slice(0, dot),
    suffix: query + hash
  };
}

// Собирает путь webp-копии: desktop (--vnv-optimized) или mobile (--vnv-optimized-mobile).
function buildVnvOptimizedImagePath(basePath, variant, suffix) {
  var tag = variant === "mobile" ? "--vnv-optimized-mobile" : "--vnv-optimized";
  return basePath + tag + ".webp" + (suffix || "");
}

// true, если URL — webp-копия оптимизатора (--vnv-optimized).
function isVnvOptimizedWebpPath(path) {
  return /--vnv-optimized(-mobile)?\.webp(\?|#|$)/i.test(String(path || ""));
}

// Запоминает, что для пути сценария webp-копий нет — больше не дергаем их по сети.
function markImageOptimizeWebpExhausted(storyPath) {
  var key = normalizeAssetUrl(String(storyPath || "").trim());
  if (!key) return;
  imageOptimizeWebpExhaustedCache[key] = true;
}

// true, если оба webp-варианта для этого сценарного пути уже провалились.
function areImageOptimizeWebpVariantsExhausted(storyPath) {
  return !!imageOptimizeWebpExhaustedCache[normalizeAssetUrl(String(storyPath || "").trim())];
}

// После 404 обоих webp сужаем цепочку до исходного файла из сценария.
function noteImageOptimizeCandidateFailure(storyPath, failedNormalizedUrl) {
  if (!isEngineImageOptimizationEnabled()) return;
  if (!isVnvOptimizedWebpPath(failedNormalizedUrl)) return;

  var original = String(storyPath || "").trim();
  if (!original || !isRasterImagePathForOptimization(original)) return;

  var parts = splitStoryImagePathForOptimize(original);
  var desktopNorm = normalizeAssetUrl(buildVnvOptimizedImagePath(parts.basePath, "desktop", parts.suffix));
  var mobileNorm = normalizeAssetUrl(buildVnvOptimizedImagePath(parts.basePath, "mobile", parts.suffix));
  if (failedAssets.images[desktopNorm] && failedAssets.images[mobileNorm]) {
    markImageOptimizeWebpExhausted(original);
  }
}

// Возвращает упорядоченный список путей сценария: сначала webp под устройство, затем исходник.
function getImageLoadCandidatePaths(storyPath) {
  var original = String(storyPath || "").trim();
  if (!original) return [];
  var resolvedOriginal = resolveRuntimeStoryAssetUrl(original, "image");
  if (!resolvedOriginal) return [];
  if (!isEngineImageOptimizationEnabled() || !isRasterImagePathForOptimization(original)) {
    return [resolvedOriginal];
  }

  var cacheKey = resolvedOriginal;
  var cachedWinner = imageOptimizeResolvedCache[cacheKey];
  if (cachedWinner) {
    return [cachedWinner];
  }

  if (areImageOptimizeWebpVariantsExhausted(original)) {
    return [resolvedOriginal];
  }

  var parts = splitStoryImagePathForOptimize(original);
  var desktopPath = buildVnvOptimizedImagePath(parts.basePath, "desktop", parts.suffix);
  var mobilePath = buildVnvOptimizedImagePath(parts.basePath, "mobile", parts.suffix);
  if (isConfidentPhoneForUiBoost()) {
    return [mobilePath, desktopPath, resolvedOriginal];
  }
  return [desktopPath, mobilePath, resolvedOriginal];
}

// Нормализует кандидатов для загрузки в DOM/прелоад.
function getImageLoadCandidates(storyPath) {
  var list = getImageLoadCandidatePaths(storyPath);
  var out = [];
  var seen = Object.create(null);
  for (var i = 0; i < list.length; i++) {
    var normalized = normalizeAssetUrl(list[i]);
    if (!normalized || seen[normalized]) continue;
    seen[normalized] = true;
    out.push(normalized);
  }
  return out;
}

// Запоминает рабочий URL, чтобы не повторять цепочку 404 на следующих показах той же картинки.
function rememberImageOptimizeWinner(storyPath, winnerNormalizedUrl) {
  if (!storyPath || !winnerNormalizedUrl) return;
  imageOptimizeResolvedCache[normalizeAssetUrl(storyPath)] = winnerNormalizedUrl;
}

// true, если загруженный URL относится к одному ассету сценария (исходник или его webp-копии).
function imageUrlMatchesStoryCandidates(normalizedUrl, storyPath) {
  if (!normalizedUrl || !storyPath) return false;
  var candidates = getImageLoadCandidates(storyPath);
  for (var i = 0; i < candidates.length; i++) {
    if (urlsMatchForAutosaveRestore(normalizedUrl, candidates[i])) return true;
  }
  return false;
}

// true, если для сценарного пути исчерпаны все варианты (webp и исходник).
function areAllImageCandidatesFailed(storyPath) {
  var candidates = getImageLoadCandidates(storyPath);
  if (!candidates.length) return true;
  for (var i = 0; i < candidates.length; i++) {
    if (!failedAssets.images[candidates[i]]) return false;
  }
  return true;
}

// Подбирает src для <img>: перебирает кандидатов до onload или исчерпания списка.
function assignRasterImageToElement(img, storyPath, handlers) {
  handlers = handlers || {};
  if (!img) {
    if (handlers.onAllFailed) handlers.onAllFailed(storyPath);
    return;
  }

  var story = String(storyPath || "").trim();
  if (!story) {
    if (handlers.onAllFailed) handlers.onAllFailed(story);
    return;
  }

  var seq = handlers.seq;
  var activeSeq = handlers.activeSeq;
  var candidates = getImageLoadCandidates(story);
  var index = 0;

  // Контроллеры с собственным lifecycle передают живую проверку поколения; старый числовой контракт сохраняется.
  function shouldAbort() {
    if (typeof handlers.isActive === "function" && !handlers.isActive()) return true;
    return seq !== undefined && seq !== null && activeSeq !== undefined && seq !== activeSeq;
  }

  function clearRasterHandlers() {
    img.onload = null;
    img.onerror = null;
  }

  function tryAssignNext() {
    if (shouldAbort()) return;
    clearRasterHandlers();

    while (index < candidates.length) {
      var url = candidates[index++];
      if (failedAssets.images[url]) continue;

      img.onload = function() {
        if (shouldAbort()) return;
        var loaded = normalizeAssetUrl(img.currentSrc || img.src || "");
        if (!imageUrlMatchesStoryCandidates(loaded, story)) return;
        rememberImageOptimizeWinner(story, loaded);
        clearRasterHandlers();
        if (handlers.onLoad) handlers.onLoad(loaded, story);
      };

      img.onerror = function() {
        if (shouldAbort()) return;
        var badSrc = normalizeAssetUrl(img.currentSrc || img.src || url);
        if (badSrc) {
          failedAssets.images[badSrc] = true;
          noteImageOptimizeCandidateFailure(story, badSrc);
        }
        clearRasterHandlers();
        tryAssignNext();
      };

      img.src = url;
      if (img.complete && img.naturalWidth && img.naturalHeight) {
        var loadedNow = normalizeAssetUrl(img.currentSrc || img.src || url);
        if (imageUrlMatchesStoryCandidates(loadedNow, story)) {
          rememberImageOptimizeWinner(story, loadedNow);
          clearRasterHandlers();
          if (handlers.onLoad) handlers.onLoad(loadedNow, story);
        }
      }
      return;
    }

    if (handlers.onAllFailed) handlers.onAllFailed(story);
  }

  tryAssignNext();
}

// Загружает растровую картинку во временный Image() с той же цепочкой кандидатов.
function loadRasterImageResource(storyPath, handlers) {
  handlers = handlers || {};
  var story = String(storyPath || "").trim();
  if (!story) {
    if (handlers.onError) handlers.onError();
    return;
  }

  var candidates = getImageLoadCandidates(story);
  var index = 0;

  function tryNext() {
    while (index < candidates.length) {
      var url = candidates[index++];
      if (failedAssets.images[url]) continue;

      var image = new Image();
      if (handlers.crossOrigin) image.crossOrigin = handlers.crossOrigin;

      image.onload = function() {
        rememberImageOptimizeWinner(story, normalizeAssetUrl(url));
        if (handlers.onLoad) handlers.onLoad(image, url);
      };
      image.onerror = function() {
        var badSrc = normalizeAssetUrl(url);
        failedAssets.images[badSrc] = true;
        noteImageOptimizeCandidateFailure(story, badSrc);
        tryNext();
      };
      image.src = url;
      if (image.complete && image.naturalWidth && image.naturalHeight) {
        rememberImageOptimizeWinner(story, normalizeAssetUrl(url));
        if (handlers.onLoad) handlers.onLoad(image, url);
      }
      return;
    }
    if (handlers.onError) handlers.onError();
  }

  tryNext();
}

// Атрибут data-vnv-story-img хранит исходный путь, чтобы после Mermaid восстановить src даже без optimized-режима.
function getGraphRasterImgDataAttr(storyPath) {
  var story = String(storyPath || "").trim();
  if (!story || !isGraphRasterImagePath(story)) {
    return "";
  }
  return " data-vnv-story-img='" + escapeMermaidLabelText(story) + "'";
}

// После отрисовки графа всегда подставляет рабочий src: Mermaid может удалить src из HTML-лейбла.
function hydrateRasterGraphThumbnails(root) {
  var host = root || mermaidGraph;
  if (!host) return;

  var thumbs = host.querySelectorAll("img[data-vnv-story-img]");
  if (!thumbs || !thumbs.length) return;

  for (var i = 0; i < thumbs.length; i++) {
    (function(img) {
      var story = img.getAttribute("data-vnv-story-img") || "";
      if (!story) return;
      var progressToken = registerGraphImageLoad(img);
      assignRasterImageToElement(img, story, {
        onLoad: function() {
          settleGraphImageLoad(progressToken, true);
        },
        onAllFailed: function() {
          settleGraphImageLoad(progressToken, false);
        }
      });
    })(thumbs[i]);
  }
}

// Переносит реальный DOM-прямоугольник img в координаты миниатюры: рамка живет на самом img, а эти координаты нужны для счетчика в углу картинки.
function applyGraphCharacterVisibleFrame(img) {
  var wrap = img && img.closest ? img.closest(".cew") : null;
  if (!wrap || !img.complete || !img.naturalWidth || !img.naturalHeight) return;

  var wrapRect = wrap.getBoundingClientRect();
  var imgRect = img.getBoundingClientRect();
  var wrapWidth = wrap.offsetWidth || 0;
  var wrapHeight = wrap.offsetHeight || 0;
  if (!wrapWidth || !wrapHeight || !wrapRect.width || !wrapRect.height || !imgRect.width || !imgRect.height) return;

  var scaleX = wrapWidth / wrapRect.width;
  var scaleY = wrapHeight / wrapRect.height;
  var imageLeft = (imgRect.left - wrapRect.left) * scaleX;
  var imageTop = (imgRect.top - wrapRect.top) * scaleY;
  var renderedWidth = imgRect.width * scaleX;
  var renderedHeight = imgRect.height * scaleY;

  // Не анализируем alpha-канал: прозрачные поля являются частью файла, а счетчик должен стоять в углу прямоугольника img.
  var frameLeft = imageLeft;
  var frameTop = imageTop;
  var frameWidth = renderedWidth;
  var frameHeight = renderedHeight;

  frameLeft = Math.max(0, Math.min(wrapWidth - 1, frameLeft));
  frameTop = Math.max(0, Math.min(wrapHeight - 1, frameTop));
  frameWidth = Math.max(1, Math.min(wrapWidth - frameLeft, frameWidth));
  frameHeight = Math.max(1, Math.min(wrapHeight - frameTop, frameHeight));

  wrap.style.setProperty("--char-frame-left", frameLeft.toFixed(1) + "px");
  wrap.style.setProperty("--char-frame-top", frameTop.toFixed(1) + "px");
  wrap.style.setProperty("--char-frame-width", frameWidth.toFixed(1) + "px");
  wrap.style.setProperty("--char-frame-height", frameHeight.toFixed(1) + "px");
  wrap.classList.add("char-frame-ready");
}

// Подключает расчет рамок к миниатюрам персонажей после Mermaid-render и после возможной подстановки webp-версии изображения.
function hydrateGraphCharacterFrames(root) {
  var host = root || mermaidGraph;
  if (!host) return;

  var thumbs = host.querySelectorAll(".char-emotion-thumbnail");
  if (!thumbs || !thumbs.length) return;

  function scheduleFrameUpdate(img) {
    requestAnimationFrame(function() {
      applyGraphCharacterVisibleFrame(img);
    });
  }

  for (var i = 0; i < thumbs.length; i++) {
    (function(img) {
      if (!img.getAttribute("data-vnv-char-frame-bound")) {
        img.setAttribute("data-vnv-char-frame-bound", "1");
        img.addEventListener("load", function() {
          scheduleFrameUpdate(img);
        });
      }
      if (img.complete && img.naturalWidth && img.naturalHeight) {
        scheduleFrameUpdate(img);
      }
    })(thumbs[i]);
  }
}

function isVideoAssetPath(path) {
  return /\.(mp4|webm)$/i.test(String(path || ""));
}

function getBackgroundAssetPrimaryPath(assetEntry) {
  if (!assetEntry) return "";
  if (typeof assetEntry === "string") return assetEntry;
  if (typeof assetEntry === "object" && typeof assetEntry.file === "string") {
    return assetEntry.file;
  }
  return "";
}

// Возвращает CSS-класс формы превью фона на графе: wide-фоны рисуются широкой рамкой,
// остальные растровые фоны — вертикальной рамкой, как сцены в новелле.
function getGraphBackgroundFrameClass(assetEntry) {
  var src = getBackgroundAssetPrimaryPath(assetEntry);
  var entry = assetEntry && typeof assetEntry === "object" ? assetEntry : null;

  if (entry && entry.scroll) {
    return "graph-frame-wide";
  }

  if (/(^|[-_])wide(?=[-_.]|$)/i.test(String(src || ""))) {
    return "graph-frame-wide";
  }

  return "graph-frame-portrait";
}

// Возвращает путь аудио-ассета: старые сценарии хранят строку, новые с volume — объект.
function getAudioAssetPrimaryPath(assetEntry) {
  if (!assetEntry) return "";
  if (typeof assetEntry === "string") return assetEntry;
  if (typeof assetEntry === "object" && typeof assetEntry.file === "string") {
    return assetEntry.file;
  }
  return "";
}

// Возвращает базовую громкость трека из [audio]; null означает общий дефолт BGM.
function getAudioAssetVolume(assetEntry) {
  if (!assetEntry || typeof assetEntry !== "object") return null;
  if (typeof assetEntry.volume !== "number") return null;
  return clamp(assetEntry.volume, 0, 1);
}

function getBackgroundAssetFallbackPath(assetEntry) {
  if (!assetEntry || typeof assetEntry !== "object") return "";
  if (typeof assetEntry.fallback === "string") return assetEntry.fallback;
  return "";
}

function getBackgroundAssetVolume(assetEntry) {
  if (!assetEntry || typeof assetEntry !== "object") return null;
  if (typeof assetEntry.volume !== "number") return null;
  return clamp(assetEntry.volume, 0, 1);
}

// Возвращает горизонтальный focusX из описания фона в [bg], если задан.
function getBackgroundAssetFocusX(assetEntry) {
  if (!assetEntry || typeof assetEntry !== "object") return null;
  return normalizeMediaFocus(assetEntry.focusX, null);
}

// Возвращает scale из описания фона в [bg], если задан (иначе null — в движке подставится 1).
// Число может прийти строкой после промежуточных преобразований — нормализуем через Number.
function getBackgroundAssetScale(assetEntry) {
  if (!assetEntry || typeof assetEntry !== "object") return null;
  if (assetEntry.scale === null || assetEntry.scale === undefined || assetEntry.scale === "") return null;
  return normalizeMediaScale(assetEntry.scale, null);
}

// Вертикальный фокус из [bg]; в отличие от X, в layout идёт как прямой % без crop-коррекции.
function getBackgroundAssetFocusY(assetEntry) {
  if (!assetEntry || typeof assetEntry !== "object") return null;
  return normalizeMediaFocusY(assetEntry.focusY, null);
}

// Возвращает флаг 360-фона из [bg]; поддерживаем явный is360 и mode/projection=360 для совместимости.
function getBackgroundAssetIs360(assetEntry) {
  if (!assetEntry || typeof assetEntry !== "object") return false;
  if (assetEntry.is360 === true) return true;
  var mode = typeof assetEntry.mode === "string" ? assetEntry.mode.toLowerCase() : "";
  var projection = typeof assetEntry.projection === "string" ? assetEntry.projection.toLowerCase() : "";
  return mode === "360" || projection === "360";
}

// Возвращает focusZ (нормализованный зум 0..1) из [bg], если задан.
function getBackgroundAssetFocusZ(assetEntry) {
  if (!assetEntry || typeof assetEntry !== "object") return null;
  return normalizeMediaFocusZ(assetEntry.focusZ, null);
}

// Возвращает стартовый FOV в градусах из [bg], если задан.
function getBackgroundAssetFov(assetEntry) {
  if (!assetEntry || typeof assetEntry !== "object") return null;
  return normalizeMediaFov(assetEntry.fov, null);
}

// Возвращает локальный режим 360-пакета из [bg], если задан; auto означает выбор через [meta] и устройство.
function getBackgroundAssetQuality(assetEntry) {
  if (!assetEntry || typeof assetEntry !== "object") return null;
  return normalizeBg360Quality(assetEntry.quality, null);
}

// Проверяет имя переменной перед подстановкой в media-параметры.
function isSafeScenarioVariableName(name) {
  var key = String(name || "").trim();
  return !!(
    key &&
    /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) &&
    key !== "__proto__" &&
    key !== "prototype" &&
    key !== "constructor"
  );
}

// Подставляет значение переменной сценария для числовых media-параметров вроде focusx/focusz/fov.
function resolveMediaVariableValue(value, contextLabel) {
  if (typeof value !== "string") return value;

  var key = value.trim();
  if (!isSafeScenarioVariableName(key)) return value;
  if (!state || !state.vars || !Object.prototype.hasOwnProperty.call(state.vars, key)) {
    console.warn("[VN] media variable not found:", key, "for", contextLabel || "media");
    return value;
  }
  return state.vars[key];
}

// Переводит focusX в долю 0..1; null означает, что композиционный фокус по X не задан.
function normalizeMediaFocus(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  var rawValue = typeof value === "string" ? value.trim() : value;
  var textValue = typeof rawValue === "string" ? rawValue.toLowerCase() : rawValue;
  if (textValue === "left" || textValue === "start") return 0;
  if (textValue === "right" || textValue === "end") return 1;
  if (textValue === "center" || textValue === "middle") return 0.5;

  var numeric = Number(resolveMediaVariableValue(rawValue, "focusX"));
  if (!isFinite(numeric)) return fallback;
  if (numeric > 1 && numeric <= 100) numeric = numeric / 100;
  return clamp(numeric, 0, 1);
}

// focusY: доля 0..1 по вертикали для object-position; в рендере идёт напрямую в % (без учёта «скрытой» высоты кропа).
function normalizeMediaFocusY(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  var rawValue = typeof value === "string" ? value.trim() : value;
  var textValue = typeof rawValue === "string" ? rawValue.toLowerCase() : rawValue;
  if (textValue === "top" || textValue === "start") return 0;
  if (textValue === "bottom" || textValue === "end") return 1;
  if (textValue === "center" || textValue === "middle") return 0.5;

  var numeric = Number(resolveMediaVariableValue(rawValue, "focusY"));
  if (!isFinite(numeric)) return fallback;
  if (numeric > 1 && numeric <= 100) numeric = numeric / 100;
  return clamp(numeric, 0, 1);
}

// Нормализует scale сценария (положительное число); иначе возвращает fallback (например 1 или null).
function normalizeMediaScale(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  var n = Number(resolveMediaVariableValue(value, "scale"));
  if (!isFinite(n) || n <= 0) return fallback;
  return clamp(n, BG_MEDIA_SCALE_MIN, BG_MEDIA_SCALE_MAX);
}

// Нормализует focusZ в долю 0..1 для 360-зумирования.
function normalizeMediaFocusZ(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  var n = Number(resolveMediaVariableValue(value, "focusZ"));
  if (!isFinite(n)) return fallback;
  if (n > 1 && n <= 100) n = n / 100;
  return clamp(n, 0, 1);
}

// Нормализует стартовый FOV для 360-режима в безопасный диапазон.
function normalizeMediaFov(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  var n = Number(resolveMediaVariableValue(value, "fov"));
  if (!isFinite(n)) return fallback;
  return clamp(n, BG_360_FOV_MIN, BG_360_FOV_MAX);
}

// Нормализует режим 360-пакета: normal/mobile фиксируют вариант, auto откладывает выбор до настроек истории и устройства.
function normalizeBg360Quality(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  var raw = String(value).trim().toLowerCase();
  if (raw === "mobile") return "mobile";
  if (raw === "normal") return "normal";
  if (raw === "auto") return "auto";
  return fallback;
}

// Нормализует режим истории: поддерживаются только release/debug, иначе берём fallback.
function normalizeStoryMode(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  var raw = String(value).trim().toLowerCase();
  if (raw === "release") return "release";
  if (raw === "debug") return "debug";
  return fallback;
}

// Читает безопасный URL-переход в release: поддерживает mode=release и короткий флаг release без учёта регистра.
function getStoryReleaseModeFromUrl() {
  if (typeof window === "undefined" || !window.location || !window.location.search) return null;

  try {
    var params = new URLSearchParams(window.location.search);
    var normalized = Object.create(null);
    params.forEach(function(value, key) {
      normalized[String(key || "").trim().toLowerCase()] = value;
    });

    if (normalizeStoryMode(normalized.mode, "") === "release") return "release";
    if (!Object.prototype.hasOwnProperty.call(normalized, "release")) return null;

    var rawFlag = String(normalized.release || "").trim().toLowerCase();
    if (rawFlag === "false" || rawFlag === "0" || rawFlag === "no" || rawFlag === "off") {
      return null;
    }
    return "release";
  } catch (e) {
    console.warn("[VN] Story mode URL params parse failed:", e);
    return null;
  }
}

// Возвращает эффективный режим истории: URL может повысить debug до release, иначе используется [meta].
function getStoryMode() {
  var urlMode = getStoryReleaseModeFromUrl();
  if (urlMode === "release") return urlMode;
  var meta = window.STORY && window.STORY.meta ? window.STORY.meta : {};
  return normalizeStoryMode(meta.mode, "debug");
}

// Синхронизирует mode из meta в сценарные переменные state.vars.
function applyStoryModeToStateVars(targetState) {
  if (!targetState || !targetState.vars) return;
  targetState.vars.mode = getStoryMode();
}

// В release скрываем кнопку статистики, в debug — показываем.
function updateStatsButtonByStoryMode() {
  if (!btnStats) return;
  var isReleaseMode = getStoryMode() === "release";
  btnStats.classList.toggle("hidden", isReleaseMode);
  btnStats.setAttribute("aria-hidden", isReleaseMode ? "true" : "false");
}

// Возвращает глобальный режим 360 из [meta]; если настройка не задана, сохраняет прежнее поведение normal.
function getStoryBg360QualityMode() {
  var meta = window.STORY && window.STORY.meta ? window.STORY.meta : {};
  return normalizeBg360Quality(meta.bg360Quality, "normal");
}

// В auto-режиме выбирает облегченный 360-пакет только для уверенно определенного телефона.
function getAutoBg360Quality() {
  return isConfidentPhoneForUiBoost() ? "mobile" : "normal";
}

// Переводит локальный quality и настройку истории в фактический normal/mobile-вариант CSS- или JS-пакета.
function resolveBg360EffectiveQuality(value) {
  var localQuality = normalizeBg360Quality(value, "auto");
  if (localQuality === "normal" || localQuality === "mobile") return localQuality;

  var storyQuality = getStoryBg360QualityMode();
  if (storyQuality === "normal" || storyQuality === "mobile") return storyQuality;

  return getAutoBg360Quality();
}

// Приводит разные формы scroll/focusX/focusY/scale из сценария к единому объекту для рендера.
function normalizeBackgroundScrollOptions(value) {
  if (value === true) {
    return { enabled: true, start: 0.5, focusX: null, focusY: null, scale: 1, is360: false, focusZ: null, fov: null, quality: "auto", panorama360Fallback: false };
  }

  if (!value) {
    return { enabled: false, start: 0.5, focusX: null, focusY: null, scale: 1, is360: false, focusZ: null, fov: null, quality: "auto", panorama360Fallback: false };
  }

  if (typeof value === "object") {
    var enabled = value.enabled !== false;
    var start = normalizeBackgroundScrollStart(value.start, 0.5);
    var focusX = normalizeMediaFocus(value.focusX, null);
    var focusY = normalizeMediaFocusY(value.focusY, null);
    var scale = normalizeMediaScale(value.scale, 1);
    var is360 = value.is360 === true;
    var focusZ = normalizeMediaFocusZ(value.focusZ, null);
    var fov = normalizeMediaFov(value.fov, null);
    var quality = normalizeBg360Quality(value.quality, "auto");
    var panorama360Fallback = value.panorama360Fallback === true;
    if (scale === null) scale = 1;
    return { enabled: enabled, start: start, focusX: focusX, focusY: focusY, scale: scale, is360: is360, focusZ: focusZ, fov: fov, quality: quality, panorama360Fallback: panorama360Fallback };
  }

  if (typeof value === "string") {
    var raw = value.toLowerCase();
    if (raw === "false" || raw === "0" || raw === "no" || raw === "off") return { enabled: false, start: 0.5, focusX: null, focusY: null, scale: 1, is360: false, focusZ: null, fov: null, quality: "auto", panorama360Fallback: false };
    if (raw === "left" || raw === "start") return { enabled: true, start: 0, focusX: null, focusY: null, scale: 1, is360: false, focusZ: null, fov: null, quality: "auto", panorama360Fallback: false };
    if (raw === "right" || raw === "end") return { enabled: true, start: 1, focusX: null, focusY: null, scale: 1, is360: false, focusZ: null, fov: null, quality: "auto", panorama360Fallback: false };
    if (raw === "center" || raw === "middle") return { enabled: true, start: 0.5, focusX: null, focusY: null, scale: 1, is360: false, focusZ: null, fov: null, quality: "auto", panorama360Fallback: false };
    if (raw === "true" || raw === "1" || raw === "yes" || raw === "on") return { enabled: true, start: 0.5, focusX: null, focusY: null, scale: 1, is360: false, focusZ: null, fov: null, quality: "auto", panorama360Fallback: false };
  }

  return { enabled: false, start: 0.5, focusX: null, focusY: null, scale: 1, is360: false, focusZ: null, fov: null, quality: "auto", panorama360Fallback: false };
}

// Переводит стартовую позицию скролла в долю от 0 до 1.
function normalizeBackgroundScrollStart(value, fallback) {
  if (value === "left" || value === "start") return 0;
  if (value === "right" || value === "end") return 1;
  if (value === "center" || value === "middle") return 0.5;

  var numeric = Number(value);
  if (!isFinite(numeric)) return fallback;
  if (numeric > 1 && numeric <= 100) numeric = numeric / 100;
  return clamp(numeric, 0, 1);
}

// Добавляет focusX, focusY и/или scale к настройкам media, не включая drag-скролл, если он не был задан отдельно.
function mergeMediaFocusOptions(scrollOptions, focusX, scale, focusY, is360, focusZ, fov, quality) {
  if (
    (focusX === null || focusX === undefined) &&
    (scale === null || scale === undefined) &&
    (focusY === null || focusY === undefined) &&
    (is360 === null || is360 === undefined) &&
    (focusZ === null || focusZ === undefined) &&
    (fov === null || fov === undefined) &&
    (quality === null || quality === undefined)
  ) {
    return scrollOptions;
  }

  var normalized = normalizeBackgroundScrollOptions(scrollOptions);
  if (focusX !== null && focusX !== undefined) {
    var normalizedFocusX = normalizeMediaFocus(focusX, null);
    if (normalizedFocusX !== null) normalized.focusX = normalizedFocusX;
  }
  if (focusY !== null && focusY !== undefined) {
    var normalizedFocusY = normalizeMediaFocusY(focusY, null);
    if (normalizedFocusY !== null) normalized.focusY = normalizedFocusY;
  }
  if (scale !== null && scale !== undefined) {
    var normalizedScale = normalizeMediaScale(scale, null);
    if (normalizedScale !== null) normalized.scale = normalizedScale;
  }
  if (is360 !== null && is360 !== undefined) {
    normalized.is360 = is360 === true;
  }
  if (focusZ !== null && focusZ !== undefined) {
    var normalizedFocusZ = normalizeMediaFocusZ(focusZ, null);
    if (normalizedFocusZ !== null) normalized.focusZ = normalizedFocusZ;
  }
  if (fov !== null && fov !== undefined) {
    var normalizedFov = normalizeMediaFov(fov, null);
    if (normalizedFov !== null) normalized.fov = normalizedFov;
  }
  if (quality !== null && quality !== undefined) {
    var normalizedQuality = normalizeBg360Quality(quality, null);
    if (normalizedQuality !== null) normalized.quality = normalizedQuality;
  }
  return normalized;
}

// Подставляет в scroll/focus-опции 360 последний ракурс активной сферы (после перетаскивания игроком),
// только для полей, которые сценарий не задал явно (null). Явные focusx/focusy/fov из [bg] или команды bg имеют приоритет.
function applyLastUserBg360FocusToScrollOptionsIfNeeded(options) {
  if (!options || options.is360 !== true) return options;
  if (!bg360Runtime || !bg360Runtime.active) return options;
  var snap = captureBg360ViewSnapshotForAutosave();
  if (!snap || typeof snap !== "object") return options;
  if (options.focusX === null || options.focusX === undefined) {
    if (typeof snap.focusX === "number" && isFinite(snap.focusX)) {
      options.focusX = snap.focusX;
    }
  }
  if (options.focusY === null || options.focusY === undefined) {
    if (typeof snap.focusY === "number" && isFinite(snap.focusY)) {
      options.focusY = snap.focusY;
    }
  }
  if (options.fov === null || options.fov === undefined) {
    if (typeof snap.fov === "number" && isFinite(snap.fov)) {
      options.fov = snap.fov;
    }
  }
  return options;
}

// Решает, включён ли userfocus в команде bg или в [bg], и при необходимости подмешивает последний ракурс.
// Нужна одна точка входа: тот же merge вызывается из prepareBackgroundVisualAction (visual_batch) и из executeAction("bg") без батча.
function applyUserFocusToMergedBgMediaOptions(action, bgAssetInfo, bgMediaOptions) {
  if (!action || !bgAssetInfo || !bgMediaOptions) return bgMediaOptions;
  var userFocusWanted = false;
  if (action.userFocus === true) {
    userFocusWanted = true;
  } else if (action.userFocus === false) {
    userFocusWanted = false;
  } else {
    userFocusWanted = bgAssetInfo.userFocus === true;
  }
  if (userFocusWanted && bgMediaOptions.is360 === true) {
    return applyLastUserBg360FocusToScrollOptionsIfNeeded(bgMediaOptions);
  }
  return bgMediaOptions;
}

// Возвращает настройки скролла, заданные у фонового ассета.
// Важно: focusX, focusY и scale в [bg] живут на объекте ассета рядом с scroll, а не внутри scroll.
// mergeMediaFocusOptions при отсутствии override в команде bg делает ранний return, если focusX, focusY и scale
// все null — тогда единственный источник зума/фокуса этот объект; без подмешивания scale сюда зум теряется.
function getBackgroundAssetScrollOptions(assetEntry) {
  if (!assetEntry || typeof assetEntry !== "object" || assetEntry.scroll === undefined) {
    var baseNoScroll = { enabled: false, start: 0.5, focusX: null, focusY: null, scale: 1, is360: false, focusZ: null, fov: null, quality: "auto" };
    var scaleOnly = getBackgroundAssetScale(assetEntry);
    if (scaleOnly !== null) baseNoScroll.scale = scaleOnly;
    var focusOnly = getBackgroundAssetFocusX(assetEntry);
    if (focusOnly !== null) baseNoScroll.focusX = focusOnly;
    var focusYOnly = getBackgroundAssetFocusY(assetEntry);
    if (focusYOnly !== null) baseNoScroll.focusY = focusYOnly;
    if (getBackgroundAssetIs360(assetEntry)) baseNoScroll.is360 = true;
    var focusZOnly = getBackgroundAssetFocusZ(assetEntry);
    if (focusZOnly !== null) baseNoScroll.focusZ = focusZOnly;
    var fovOnly = getBackgroundAssetFov(assetEntry);
    if (fovOnly !== null) baseNoScroll.fov = fovOnly;
    var qualityOnly = getBackgroundAssetQuality(assetEntry);
    if (qualityOnly !== null) baseNoScroll.quality = qualityOnly;
    return baseNoScroll;
  }
  var fromScroll = normalizeBackgroundScrollOptions(assetEntry.scroll);
  var scaleAsset = getBackgroundAssetScale(assetEntry);
  if (scaleAsset !== null) fromScroll.scale = scaleAsset;
  var focusAsset = getBackgroundAssetFocusX(assetEntry);
  if (focusAsset !== null) fromScroll.focusX = focusAsset;
  var focusYAsset = getBackgroundAssetFocusY(assetEntry);
  if (focusYAsset !== null) fromScroll.focusY = focusYAsset;
  if (getBackgroundAssetIs360(assetEntry)) fromScroll.is360 = true;
  var focusZAsset = getBackgroundAssetFocusZ(assetEntry);
  if (focusZAsset !== null) fromScroll.focusZ = focusZAsset;
  var fovAsset = getBackgroundAssetFov(assetEntry);
  if (fovAsset !== null) fromScroll.fov = fovAsset;
  var qualityAsset = getBackgroundAssetQuality(assetEntry);
  if (qualityAsset !== null) fromScroll.quality = qualityAsset;
  return fromScroll;
}

function visualTraceMediaState(el) {
  // Собирает только диагностическое состояние слоя, не меняя DOM и порядок отрисовки.
  if (!el) return null;

  var isMedia = typeof el.currentTime === "number";
  return {
    id: el.id || "",
    hidden: el.classList ? el.classList.contains("hidden") : null,
    display: window.getComputedStyle ? window.getComputedStyle(el).display : "",
    src: sanitizeDiagnosticResource(normalizeAssetUrl(el.currentSrc || el.src || "")),
    currentTime: isMedia ? Number(el.currentTime.toFixed(3)) : null,
    readyState: isMedia ? el.readyState : null,
    paused: isMedia ? el.paused : null
  };
}

function visualTrace(label, data) {
  // Снимок стилей дорогой, поэтому строится только через ?Debug=visual или window.VN_VISUAL_DEBUG=true.
  var enabledByFlag = typeof window !== "undefined" && window.VN_VISUAL_DEBUG === true;
  if (!enabledByFlag && !isExplicitDebugCategoryEnabled("visual")) return;

  var now = (window.performance && typeof window.performance.now === "function")
    ? window.performance.now()
    : Date.now();

  console.log("[VISUAL TRACE]", now.toFixed(1) + "ms", label, {
    sceneId: state && state.sceneId,
    actionIndex: state && state.actionIndex,
    extra: sanitizeDiagnosticDetails(data || null),
    bg: visualTraceMediaState(elBg),
    bgVideo: visualTraceMediaState(elBgVideo),
    storyOverlay: visualTraceMediaState(elStoryVideoOverlay),
    storyVideo: visualTraceMediaState(elStoryVideo),
    storyPoster: visualTraceMediaState(elStoryVideoPoster),
    keepStoryVideo: storyVideoRuntime ? storyVideoRuntime.keepUntilBgVideoReady : null
  });
}

function getGraphImageSrc(src) {
  var original = String(src || "").trim();
  if (!original) return "";
  if (areAllImageCandidatesFailed(original)) return "";

  var candidates = getImageLoadCandidates(original);
  if (!candidates.length) return "";

  var pick = candidates[0];
  for (var i = 0; i < candidates.length; i++) {
    if (!failedAssets.images[candidates[i]]) {
      pick = candidates[i];
      break;
    }
  }
  return escapeMermaidLabelText(pick);
}

// Контроллер подключает media/UI-обработчики только после полной подготовки STORY и DOM.
audioController.start();
profiler.mark('Audio is set up');

applyUiScale();
window.addEventListener("resize", applyUiScale);
window.addEventListener("resize", updateBackgroundScrollAvailability);
window.addEventListener("resize", resizeBg360Renderer);

window.addEventListener("pagehide", function (event) {
  autosaveDebugLog("lifecycle:pagehide", {
    sceneId: state && state.sceneId,
    actionIndex: state && state.actionIndex,
    inGame: state && state.inGame,
    waitingNext: state && state.waitingNext,
    nextLocked: state && state.nextLocked
  });
  autosaveController.flushPending();
  // При реальном уходе очищаем долгоживущие контроллеры; bfcache сохраняет их для возврата на страницу.
  if (!event || event.persisted !== true) {
    autosaveController.dispose();
    gameHost.dispose();
    visualTransitionController.dispose();
    characterController.dispose();
    panoramaPackageController.dispose();
    panoramaMarksController.dispose();
    panoramaPhotoViewerController.dispose();
    storyVideoController.dispose();
    backgroundMediaController.dispose();
    audioController.dispose();
  }
});
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") {
    autosaveDebugLog("lifecycle:visibilityhidden", {
      sceneId: state && state.sceneId,
      actionIndex: state && state.actionIndex
    });
    autosaveController.flushPending();
  }
});
window.addEventListener("beforeunload", function () {
  autosaveDebugLog("lifecycle:beforeunload", {
    sceneId: state && state.sceneId,
    actionIndex: state && state.actionIndex
  });
  autosaveController.flushPending();
});

// ---------- Подготовка сцен ----------
buildSceneMap();
profiler.mark('The scene map has been created');

// Заголовок
if (STORY.meta && STORY.meta.title) {
  if (elTitle) elTitle.textContent = STORY.meta.title;
  document.title = STORY.meta.title;
}

// ---------- UI события ----------
// основной обработчик перехода (один!)
elDialog.addEventListener("pointerup", function(e){

  writeRuntimeVerbose("[LOG] dialog pointerup", {
    targetId: e.target && e.target.id,
    modalHidden: elGameModal.classList.contains("hidden"),
    inGame: state.inGame,
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked
  });

  writeRuntimeVerbose(
    "[VN] pointerup",
    "waitingNext:", state.waitingNext,
    "locked:", state.nextLocked,
    "scene:", state.sceneId,
    "actionIndex:", state.actionIndex
  );

  // Защита от всплытия
  e.stopPropagation();
  e.preventDefault();

  // Защита от двойных кликов
  if (e.detail > 1) {
    writeRuntimeVerbose("[VN] двойной клик проигнорирован");
    return;
  }

  onNext(e);

});


elDialog.addEventListener("keydown", function (e) {
  // Enter / Space
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onNext();
  }
});

btnRestart.addEventListener("click", function () {
  restart({ clearAutosave: true });
});

// Закрывает или перезапускает сюжетную игру одинаково для pointer и клавиатурной активации кнопки.
function closeStoryGameFromControl(e) {
  writeRuntimeVerbose("[LOG] close control", {
    inGame: state.inGame,
    modalHidden: elGameModal.classList.contains("hidden"),
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked
  });

  swallowEvent(e);

  // Сброс от случайного "следующего клика" после закрытия
  lastNextTime = Date.now();

  if (isCurrentStoryGameUrlMode()) {
    restartStandaloneGameFromUrl();
    writeRuntimeVerbose("[LOG] after restartStandaloneGameFromUrl", {
      inGame: state.inGame,
      modalHidden: elGameModal.classList.contains("hidden"),
      waitingNext: state.waitingNext,
      nextLocked: state.nextLocked
    });
    return;
  }

  closeGame({ manualClose: true, result: 0 });

  writeRuntimeVerbose("[LOG] after closeGame", {
    inGame: state.inGame,
    modalHidden: elGameModal.classList.contains("hidden"),
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked
  });
}

btnCloseGame.addEventListener("pointerup", function (e) {
  closeStoryGameFromControl(e);
});

btnCloseGame.addEventListener("click", function (e) {
  // Нативная клавиатурная активация button создаёт click без pointerup и с detail=0.
  if (e.detail === 0) closeStoryGameFromControl(e);
  else swallowEvent(e);
});

// Закрывает игру из статистики через общий путь и не пропускает активирующее событие под модалку.
function closeStatsGameFromControl(e) {
  swallowEvent(e);
  lastNextTime = Date.now();
  closeGame({ manualClose: true, result: 0 });
}

btnCloseStatsGame.addEventListener("pointerup", function (e) {
  closeStatsGameFromControl(e);
});

btnCloseStatsGame.addEventListener("click", function (e) {
  if (e.detail === 0) closeStatsGameFromControl(e);
  else swallowEvent(e);
});

// Применяет уже проверенный game host результат, предупреждает о временной совместимости и завершает режим движка.
function handleGameResultMessage(event, acceptedLaunch) {
  var activeGame = state.currentGame;
  if (!activeGame || !acceptedLaunch || activeGame.session !== acceptedLaunch.session) return;

  // До версии 1.0 принимаем прежний результат v2 без номера, но сообщаем разработчику о необходимой миграции.
  if (!Object.prototype.hasOwnProperty.call(event.data, "protocolVersion")) {
    console.warn(
      "[GAME DEPRECATION] Игра",
      String(activeGame.gameId || "game"),
      "не вернула protocolVersion. Такая совместимость будет удалена в версии 1.0."
    );
  }

  closeGame(event.data);
}

// ---------- Старт ----------
startLicensedEngine();

// =========================================================
//                   ОСНОВНЫЕ ФУНКЦИИ
// =========================================================

// ---------- Автосейв (localStorage, legacy-слот или отдельный слот projectId/novel) ----------
// Состояние сценария живёт в памяти движка; в localStorage пишем с дебаунсом (редко перезаписываем диск),
// плюс сразу при pagehide, входе в game/video и после продолжения сюжета из игры/сюжетного видео.
// Версия поднята после смены модели позиционирования персонажей:
// старые autosave-слоты могли восстановить прежний pos/focus и снова сдвинуть персонажа.
var VN_AUTOSAVE_PAYLOAD_VERSION = window.VN_AUTOSAVE_PAYLOAD.PAYLOAD_VERSION;
var vnAutosaveBgScrollRestorePending = null;
var vnAutosaveStory360RestorePending = null;
// Активная 360-команда нужна автосейву, чтобы отличать обычный шаг сцены от временного шага из menu/if.
var vnAutosaveActive360Action = null;
// Последний успешно показанный фон/видео для восстановления «унаследованного» визуала
// в сценах, где нет собственного bg (например, menu/text после перехода).
var vnAutosaveLastVisualSnapshot = null;

// Сравнение URL фона после нормализации (расхождение только origin при смене способа открытия страницы).
function urlsMatchForAutosaveRestore(hrefA, hrefB) {
  if (!hrefA || !hrefB) return false;
  if (hrefA === hrefB) return true;
  try {
    var ua = new URL(hrefA);
    var ub = new URL(hrefB);
    return ua.pathname === ub.pathname && ua.search === ub.search;
  } catch (e) {
    return false;
  }
}

// Ищет статичный fallback у [bg], если основной файл ассета — то же видео (canvas blur часто ломается на file://).
function findBlurFallbackImageForBgVideoUrl(normalizedVideoUrl) {
  if (!STORY || !STORY.assets || !STORY.assets.backgrounds || !normalizedVideoUrl) return "";
  var want = normalizeAssetUrl(normalizedVideoUrl);
  var bgs = STORY.assets.backgrounds;
  for (var id in bgs) {
    if (!Object.prototype.hasOwnProperty.call(bgs, id)) continue;
    var primaryPath = resolveAsset("@bg." + id);
    if (!primaryPath || !isVideoAssetPath(primaryPath)) continue;
    var primaryNorm = normalizeAssetUrl(primaryPath);
    if (primaryNorm !== want && !urlsMatchForAutosaveRestore(primaryNorm, want)) continue;
    var fb = getBackgroundAssetFallbackPath(bgs[id]);
    if (!fb || isVideoAssetPath(fb)) continue;
    return fb;
  }
  return "";
}

// Возвращает нормализованный id именованного novel-слота; регистр URL не должен создавать дубликаты сохранений.
function getActiveNovelSaveId() {
  if (!storyUrlLaunch || storyUrlLaunch.mode !== "novel" || !storyUrlLaunchSceneId) return "";
  return String(storyUrlLaunchSceneId).toLowerCase();
}

// Возвращает постоянный id проекта из meta; отсутствие значения намеренно сохраняет старую схему ключей.
function getActiveProjectSaveId() {
  if (!STORY || !STORY.meta || !STORY.meta.projectId) return "";
  return String(STORY.meta.projectId).trim().toLowerCase();
}

// Получает localStorage только внутри защищённой операции модуля, чтобы запрет API не останавливал запуск движка.
function getAutosaveLocalStorage() {
  return window.localStorage;
}

// Создаёт единый адаптер ключей и Storage API; payload и правила принадлежности остаются ответственностью движка.
var autosaveStorage = window.VN_AUTOSAVE_STORAGE.createAutosaveStorage({
  getStorage: getAutosaveLocalStorage,
  getProjectId: getActiveProjectSaveId,
  getNovelId: getActiveNovelSaveId
});

// Возвращает контроллеру только безопасные поля текущего состояния для технической диагностики записи.
function getAutosaveRuntimeState() {
  return {
    sceneId: state && state.sceneId,
    actionIndex: state && state.actionIndex,
    waitingNext: state && state.waitingNext,
    nextLocked: state && state.nextLocked,
    inGame: state && state.inGame,
    inVideo: state && state.inVideo
  };
}

// Сбрасывает временное восстановление 360 до загрузки или удаления другого слота.
function resetAutosaveRestoreState() {
  vnAutosaveStory360RestorePending = null;
}

// Сохраняет прежний канал предупреждений автосохранения без прямой зависимости контроллера от console.
function reportAutosaveControllerWarning(message, error) {
  console.warn(message, error);
}

// Записывает fingerprint и координаты отклонённого payload, не передавая детали истории в общий модуль.
function reportInvalidAutosavePayload(data) {
  var fpNow = computeStoryTextFingerprint();
  autosaveDebugLog("restore:validate_failed", {
    sceneId: data && data.sceneId,
    actionIndex: data && data.actionIndex,
    v: data && data.v,
    slotHashHex: data && data.hashHex,
    slotTextLength: data && data.textLength,
    currentHashHex: fpNow.hashHex,
    currentTextLength: fpNow.textLength
  });
}

// Создаёт единый lifecycle автосохранения, оставляя снимки и применение интерфейса callback-ами движка.
var autosaveController = window.VN_AUTOSAVE_CONTROLLER.createAutosaveController({
  storage: autosaveStorage,
  isEnabled: isAutosaveRuntimeEnabled,
  isStorageBlocked: isStoryUrlAutosaveStorageBlocked,
  buildPayload: buildAutosavePayload,
  validatePayload: validateAutosavePayload,
  applyPayload: applyAutosavePayload,
  createLegacyMigration: createLegacyAutosaveMigration,
  getRuntimeState: getAutosaveRuntimeState,
  onDebug: autosaveDebugLog,
  onWarning: reportAutosaveControllerWarning,
  onBeforeClear: resetAutosaveRestoreState,
  onBeforeLoad: resetAutosaveRestoreState,
  onInvalidPayload: reportInvalidAutosavePayload
});

// Запрещает любые операции с localStorage для nosave, scene-режима и ошибочного novel-параметра.
function isStoryUrlAutosaveStorageBlocked() {
  if (!storyUrlLaunch) return false;
  if (storyUrlLaunch.noSave) return true;
  if (storyUrlLaunch.mode === "default") return false;
  if (storyUrlLaunch.mode === "scene") return true;
  return storyUrlLaunch.mode === "novel" && !storyUrlLaunchSceneId;
}

// Учитывает настройку сценария и URL-режим, чтобы scene/nosave не обращались к сохранениям.
function isStoryAutosaveEnabled() {
  if (isStoryUrlAutosaveStorageBlocked()) return false;
  if (!STORY || !STORY.meta) return true;
  return STORY.meta.autosave !== false;
}

// Запрещает lifecycle-операции контроллера до появления истории, сохраняя прежнее поведение flush и debounce.
function isAutosaveRuntimeEnabled() {
  return !!STORY && isStoryAutosaveEnabled();
}

// Возвращает строгий режим проверки автосейва: engine.loadsafe=false разрешает dev-загрузку после изменения текста истории.
function isStoryLoadsafeEnabled() {
  if (!STORY || !STORY.meta) return true;
  var engineMeta = STORY.meta.engine;
  if (!engineMeta || typeof engineMeta !== "object") return true;
  return engineMeta.loadsafe !== false;
}

/**
 * Снимает «мёртвую» комбинацию nextLocked без waitingNext посередине сцены (после гонок при F5),
 * иначе onNext не вызывается и кажется, что диалог не реагирует.
 */
function fixAutosaveDeadlockInteractionFlags() {
  if (!state || !state.sceneId || !state.sceneMap) return;
  var scene = state.sceneMap[state.sceneId];
  if (!scene || !Array.isArray(scene.actions)) return;
  var len = scene.actions.length;
  if (state.actionIndex < len && !state.waitingNext && state.nextLocked) {
    autosaveDebugLog("fixDeadlock:cleared_nextLocked", {
      sceneId: state.sceneId,
      actionIndex: state.actionIndex,
      actionsLen: len
    });
    state.nextLocked = false;
  }
}

// Возвращает fingerprint фактически загруженного текста сценария.
function computeStoryTextFingerprint() {
  return window.VN_AUTOSAVE_PAYLOAD.computeTextFingerprint(
    typeof window.STORY_TEXT === "string" ? window.STORY_TEXT : ""
  );
}

/**
 * Восстанавливает fingerprint версии сценария до добавления projectId.
 * Удаляется только строка projectId внутри [meta], а остальные символы и EOL остаются без изменений.
 */
function computeLegacyStoryFingerprintForProjectMigration() {
  var text = typeof window.STORY_TEXT === "string" ? window.STORY_TEXT : "";
  return window.VN_AUTOSAVE_PAYLOAD.computeLegacyProjectFingerprint(text);
}

function captureBackgroundSnapshotForAutosave() {
  function isUsableAutosaveBgSrc(src) {
    var normalized = normalizeAssetUrl(src || "");
    if (!normalized) return false;
    // Пустой <img src> в браузере часто превращается в URL текущей страницы (index.html),
    // такой путь нельзя считать валидным снимком фона для автосейва.
    var currentPage = normalizeAssetUrl((window && window.location && window.location.href) ? window.location.href : "");
    if (currentPage && urlsMatchForAutosaveRestore(normalized, currentPage)) return false;
    return true;
  }

  if (bg360Runtime && bg360Runtime.active && bg360Runtime.sourceSrc) {
    return {
      isVideo: !!bg360Runtime.isVideoSource,
      src: normalizeAssetUrl(bg360Runtime.sourceSrc),
      blurFallback: bg360Runtime.blurFallbackSrc ? normalizeAssetUrl(bg360Runtime.blurFallbackSrc) : ""
    };
  }
  if (elBgVideo && !elBgVideo.classList.contains("hidden") && (elBgVideo.currentSrc || elBgVideo.src)) {
    var vnorm = normalizeAssetUrl(elBgVideo.currentSrc || elBgVideo.src || "");
    if (!isUsableAutosaveBgSrc(vnorm)) return null;
    return {
      isVideo: true,
      src: vnorm,
      blurFallback: findBlurFallbackImageForBgVideoUrl(vnorm)
    };
  }
  if (elBg && !elBg.classList.contains("hidden") && (elBg.currentSrc || elBg.src)) {
    var inorm = normalizeAssetUrl(elBg.currentSrc || elBg.src || "");
    if (!isUsableAutosaveBgSrc(inorm)) return null;
    return {
      isVideo: false,
      src: inorm
    };
  }
  return null;
}

// Обновляет и возвращает «последний визуальный снимок» для автосейва.
// Если текущий bg не виден, сохраняем предыдущее валидное значение.
function captureLastVisualSnapshotForAutosave(currentBgSnap) {
  if (currentBgSnap && currentBgSnap.src) {
    vnAutosaveLastVisualSnapshot = JSON.parse(JSON.stringify(currentBgSnap));
  }
  if (vnAutosaveLastVisualSnapshot && vnAutosaveLastVisualSnapshot.src) {
    return JSON.parse(JSON.stringify(vnAutosaveLastVisualSnapshot));
  }
  return null;
}

// Приводит yaw к диапазону 0..360, чтобы сохранённый ракурс не ломался после поворота в отрицательные углы.
function normalizeBg360YawDegForAutosave(yawDeg) {
  var yaw = typeof yawDeg === "number" && isFinite(yawDeg) ? yawDeg : 180;
  return ((yaw % 360) + 360) % 360;
}

// Снимает направление 360-камеры в двух формах: градусы удобны для отладки, focusX/Y — для штатного восстановления.
function captureBg360ViewSnapshotForAutosave() {
  if (!bg360Runtime || !bg360Runtime.active) return null;

  var yaw = normalizeBg360YawDegForAutosave(bg360Runtime.yawDeg);
  var pitch = clamp(
    typeof bg360Runtime.pitchDeg === "number" && isFinite(bg360Runtime.pitchDeg) ? bg360Runtime.pitchDeg : 0,
    -85,
    85
  );
  var q = "auto";
  if (bg360Runtime.sourceSrc && /-360-mobile\.(?:css|js)(\?.*)?$/i.test(bg360Runtime.sourceSrc)) q = "mobile";
  else if (bg360Runtime.sourceSrc && /-360\.(?:css|js)(\?.*)?$/i.test(bg360Runtime.sourceSrc)) q = "normal";

  return {
    yawDeg: yaw,
    pitchDeg: pitch,
    focusX: yaw / 360,
    focusY: (pitch + 85) / 170,
    fov: typeof bg360Runtime.fovDeg === "number" && isFinite(bg360Runtime.fovDeg) ? bg360Runtime.fovDeg : null,
    quality: q
  };
}

function captureBackgroundScrollSnapshotForAutosave() {
  // Для активного 360 сохраняем положение камеры и интерактивность напрямую из runtime.
  // Иначе после F5 восстановится только источник, но не ракурс/управление.
  if (bg360Runtime && bg360Runtime.active) {
    var view = captureBg360ViewSnapshotForAutosave();
    var fx = view ? view.focusX : 0.5;
    var fy = view ? view.focusY : 0.5;
    return {
      interactive: !!bg360Runtime.interactive,
      position: fx,
      focusX: fx,
      focusY: fy,
      scale: 1,
      start: fx,
      is360: true,
      yawDeg: view ? view.yawDeg : null,
      pitchDeg: view ? view.pitchDeg : null,
      fov: view ? view.fov : null,
      quality: view ? view.quality : "auto"
    };
  }
  if (!backgroundScroll || !backgroundScroll.enabled) return null;
  if (backgroundScroll.owner !== "background" || !backgroundScroll.target) return null;
  if (backgroundScroll.target !== elBg && backgroundScroll.target !== elBgVideo) return null;
  return {
    interactive: !!backgroundScroll.interactive,
    position: typeof backgroundScroll.position === "number" ? backgroundScroll.position : 0.5,
    focusX: typeof backgroundScroll.focusX === "number" ? backgroundScroll.focusX : null,
    focusY: typeof backgroundScroll.focusY === "number" ? backgroundScroll.focusY : null,
    scale: typeof backgroundScroll.mediaScale === "number" ? backgroundScroll.mediaScale : 1,
    start: typeof backgroundScroll.start === "number" ? backgroundScroll.start : 0.5
  };
}

// Копирует только безопасные поля ракурса 360 из bgScroll/вложенного view для последующего восстановления камеры.
function buildStory360ViewRestoreSnapshot(source) {
  if (!source || typeof source !== "object") return null;
  var out = {};
  var hasAny = false;

  if (typeof source.focusX === "number" && isFinite(source.focusX)) {
    out.focusX = clamp(source.focusX, 0, 1);
    hasAny = true;
  } else if (typeof source.yawDeg === "number" && isFinite(source.yawDeg)) {
    out.focusX = normalizeBg360YawDegForAutosave(source.yawDeg) / 360;
    out.yawDeg = normalizeBg360YawDegForAutosave(source.yawDeg);
    hasAny = true;
  }

  if (typeof source.focusY === "number" && isFinite(source.focusY)) {
    out.focusY = clamp(source.focusY, 0, 1);
    hasAny = true;
  } else if (typeof source.pitchDeg === "number" && isFinite(source.pitchDeg)) {
    out.focusY = (clamp(source.pitchDeg, -85, 85) + 85) / 170;
    out.pitchDeg = clamp(source.pitchDeg, -85, 85);
    hasAny = true;
  }

  if (typeof source.fov === "number" && isFinite(source.fov)) {
    out.fov = source.fov;
    hasAny = true;
  }
  if (typeof source.quality === "string" && source.quality) {
    out.quality = source.quality;
    hasAny = true;
  }

  return hasAny ? out : null;
}

// Запоминает активную 360-команду на время асинхронного ожидания, чтобы автосейв мог восстановить шаг из pendingActions.
function rememberActive360ActionForAutosave(action, fromPending, sceneActionIndex, resumeActionIndex) {
  if (!action || (action.type !== "goto360" && action.type !== "walk360")) {
    vnAutosaveActive360Action = null;
    return;
  }

  vnAutosaveActive360Action = {
    type: action.type,
    fromPending: !!fromPending,
    sceneActionIndex: typeof sceneActionIndex === "number" && isFinite(sceneActionIndex) ? sceneActionIndex : -1,
    resumeActionIndex: typeof resumeActionIndex === "number" && isFinite(resumeActionIndex) ? resumeActionIndex : state.actionIndex,
    action: JSON.parse(JSON.stringify(action))
  };
}

// Очищает привязку активной 360-команды, чтобы завершённый переход не влиял на следующий автосейв.
function clearActive360ActionForAutosave(actionType) {
  if (!vnAutosaveActive360Action) return;
  if (actionType && vnAutosaveActive360Action.type !== actionType) return;
  vnAutosaveActive360Action = null;
}

// Возвращает индекс, с которого нужно продолжать сцену: pending-360 не откатывается к menu, а обычный 360 — к своей строке.
function getActive360PersistActionIndexForAutosave(actionType, fallbackActionIndex) {
  var info = vnAutosaveActive360Action;
  if (info && info.type === actionType) {
    if (info.fromPending) return info.resumeActionIndex;
    if (info.sceneActionIndex >= 0) return info.sceneActionIndex;
  }
  return fallbackActionIndex > 0 ? fallbackActionIndex - 1 : fallbackActionIndex;
}

// Кладёт в слот копию pending goto360, чтобы после F5 продолжить выбранный пункт меню без повторного показа menu.
function buildPending360ResumeActionForAutosave(actionType) {
  var info = vnAutosaveActive360Action;
  if (!info || info.type !== actionType || !info.fromPending || !info.action) return null;
  return JSON.parse(JSON.stringify(info.action));
}

// Сохраняет текущее положение игрока внутри story360/goto360: пространство, панораму и ракурс камеры.
function captureStory360SnapshotForAutosave(bgScrollSnapshot) {
  if (!goto360Runtime || !goto360Runtime.active || goto360Runtime.done) return null;

  var spaceId = String(goto360Runtime.spaceId || "").trim();
  var panoramaId = String(goto360Runtime.panoramaId || "").trim();
  if (!spaceId || !panoramaId) return null;

  var snapshot = {
    active: true,
    spaceId: spaceId,
    panoramaId: panoramaId,
    entryId: String(goto360Runtime.entryId || "default") || "default",
    resultVar: String(goto360Runtime.resultVar || ""),
    titleText: String(goto360Runtime.titleText || ""),
    buttonText: String(goto360Runtime.buttonText || ""),
    view: buildStory360ViewRestoreSnapshot(bgScrollSnapshot || captureBg360ViewSnapshotForAutosave())
  };
  var resumeAction = buildPending360ResumeActionForAutosave("goto360");
  if (resumeAction) snapshot.resumeAction = resumeAction;
  return snapshot;
}

// Сохраняет текущую BGM так, чтобы после F5 кнопка unmute могла возобновить тот же трек.
function captureBgmSnapshotForAutosave() {
  if (!audio || !audio.bgm) return null;
  var src = normalizeAssetUrl(audio.bgm.currentSrc || audio.bgm.src || "");
  if (!src) return null;
  return {
    src: src,
    loop: audio.bgm.loop !== false,
    volume: clamp((typeof audio.currentBgmVolume === "number" ? audio.currentBgmVolume : 0.7), 0, 1),
    currentTime: isFinite(audio.bgm.currentTime) ? Math.max(0, audio.bgm.currentTime) : 0
  };
}

// Разрешает восстановление BGM только для трека, который объявлен в текущем сценарии и прошёл политику assets.
// Это не позволяет подменённому localStorage превратить автосохранение в произвольный сетевой запрос.
function resolveDeclaredAutosaveAudioUrl(snapshotSrc) {
  var requested = normalizeAssetUrl(snapshotSrc || "");
  var entries = STORY && STORY.assets && STORY.assets.audio ? STORY.assets.audio : {};
  if (!requested) return "";

  var ids = Object.keys(entries);
  for (var i = 0; i < ids.length; i++) {
    var declared = getAudioAssetPrimaryPath(entries[ids[i]]);
    var safeDeclared = resolveRuntimeStoryAssetUrl(declared, "audio");
    if (safeDeclared && urlsMatchForAutosaveRestore(safeDeclared, requested)) return safeDeclared;
  }
  return "";
}

// Восстанавливает BGM без принудительного включения звука: если UI в mute, трек только подготавливается.
function applyAutosaveBgmSnapshot(bgmSnap) {
  if (!audio || !audio.bgm) return false;
  if (!bgmSnap || typeof bgmSnap !== "object" || !bgmSnap.src) {
    stopBgmImmediate();
    return false;
  }

  var src = resolveDeclaredAutosaveAudioUrl(bgmSnap.src);
  if (!src || failedAssets.audio[src]) return false;

  audio.bgm.loop = bgmSnap.loop !== false;
  audio.currentBgmVolume = clamp((typeof bgmSnap.volume === "number" ? bgmSnap.volume : 0.7), 0, 1);
  try {
    if (!audio.bgm.src || !urlsMatchForAutosaveRestore(normalizeAssetUrl(audio.bgm.currentSrc || audio.bgm.src || ""), src)) {
      audio.bgm.pause();
      audio.bgm.src = src;
    }
    var resumeAt = typeof bgmSnap.currentTime === "number" ? Math.max(0, bgmSnap.currentTime) : 0;
    if (resumeAt > 0) {
      try {
        audio.bgm.currentTime = resumeAt;
      } catch (timeError) {
        audio.bgm.addEventListener("loadedmetadata", function restoreBgmTimeOnce() {
          try { audio.bgm.currentTime = resumeAt; } catch (e) {
            // Если seek недоступен и после metadata, восстановление безопасно продолжится с начала трека.
          }
        }, { once: true });
      }
    }
    applyAudioSettings();
    if (!audio.muted && audio.masterVolume > 0) {
      resumeBgmIfNeeded("autosave restore");
    }
    return true;
  } catch (err) {
    console.warn("[AUTOSAVE] bgm restore failed:", err);
    return false;
  }
}

/**
 * Собирает JSON автосейва с принадлежностью текущему novel-слоту.
 * opts.persistActionIndex — явный индекс шага (например шаг game/video до инкремента в runCurrent).
 */
function buildAutosavePayload(opts) {
  opts = opts || {};
  if (!STORY || !isStoryAutosaveEnabled()) {
    autosaveDebugLog("buildPayload:null", { reason: "no_story_or_disabled" });
    return null;
  }
  if (!opts.allowDuringEmbeddedMedia && (state.inGame || state.inVideo)) {
    autosaveDebugLog("buildPayload:null", {
      reason: "embedded_media",
      inGame: state.inGame,
      inVideo: state.inVideo
    });
    return null;
  }
  if (!state.sceneId) {
    autosaveDebugLog("buildPayload:null", { reason: "no_sceneId" });
    return null;
  }

  var scene = state.sceneMap[state.sceneId];
  if (!scene || !Array.isArray(scene.actions)) {
    autosaveDebugLog("buildPayload:null", { reason: "bad_scene", sceneId: state.sceneId });
    return null;
  }
  if (state.actionIndex < 0 || state.actionIndex > scene.actions.length) {
    autosaveDebugLog("buildPayload:null", {
      reason: "actionIndex_out_of_range",
      sceneId: state.sceneId,
      actionIndex: state.actionIndex,
      actionsLen: scene.actions.length
    });
    return null;
  }

  var fp = computeStoryTextFingerprint();
  var bgSnap = captureBackgroundSnapshotForAutosave();
  var lastVisualSnap = captureLastVisualSnapshotForAutosave(bgSnap);
  var bgScroll = captureBackgroundScrollSnapshotForAutosave();
  var story360Snap = captureStory360SnapshotForAutosave(bgScroll);
  var charSnap = characterController.captureSnapshot();
  var bgmSnap = captureBgmSnapshotForAutosave();
  // В runCurrent перед выполнением шага делается actionIndex++; во время ожидания клика «дальше»
  // в state уже лежит индекс СЛЕДУЮЩЕГО действия. Если сохранить его как есть, после F5 runCurrent
  // сразу выполнит следующий шаг без клика — при быстрых обновлениях сценарий «убегает» вперёд.
  // Если открыто меню choice, индекс уже указывает ПОСЛЕ выполненного «menu» — без поправки после F5
  // поднимется предыдущая реплика вместо меню (старый слот автосейва не обновлялся при видимых #choices).
  var persistActionIndex;
  if (typeof opts.persistActionIndex === "number" && isFinite(opts.persistActionIndex)) {
    persistActionIndex = opts.persistActionIndex | 0;
    if (persistActionIndex < 0 || persistActionIndex > scene.actions.length) {
      autosaveDebugLog("buildPayload:null", {
        reason: "persistActionIndex_invalid",
        persistActionIndex: persistActionIndex,
        actionsLen: scene.actions.length
      });
      return null;
    }
  } else {
    persistActionIndex = state.actionIndex;
    var choicesVisible = !!(elChoices && !elChoices.classList.contains("hidden"));
    // walk360 — это асинхронное ожидание: пока игрок не выбрал метку, сохраняем саму команду,
    // иначе после F5 сценарий перескочит к следующему действию и может преждевременно открыть menu.
    if (walk360Runtime && walk360Runtime.active && persistActionIndex > 0) {
      persistActionIndex = getActive360PersistActionIndexForAutosave("walk360", persistActionIndex);
    } else if (goto360Runtime && goto360Runtime.active && persistActionIndex > 0) {
      // goto360 тоже остаётся на одном действии, но pending-ветку menu нужно продолжать после самого menu.
      persistActionIndex = getActive360PersistActionIndexForAutosave("goto360", persistActionIndex);
    } else if (persistActionIndex > 0 && (state.waitingNext || choicesVisible)) {
      persistActionIndex = persistActionIndex - 1;
    }
    persistActionIndex = clamp(persistActionIndex, 0, scene.actions.length);
  }

  var flagsForDisk = window.VN_AUTOSAVE_PAYLOAD.normalizeInteractionFlags(
    scene.actions.length,
    state.actionIndex,
    state.waitingNext,
    state.nextLocked
  );

  autosaveDebugLog("buildPayload:ok", {
    sceneId: state.sceneId,
    runtimeActionIndex: state.actionIndex,
    persistActionIndex: persistActionIndex,
    actionsLen: scene.actions.length,
    waitingNextRuntime: !!state.waitingNext,
    nextLockedRuntime: !!state.nextLocked,
    waitingNextDisk: flagsForDisk.waitingNext,
    nextLockedDisk: flagsForDisk.nextLocked,
    walk360Active: !!(walk360Runtime && walk360Runtime.active),
    goto360Active: !!(goto360Runtime && goto360Runtime.active),
    choicesVisible: !!(elChoices && !elChoices.classList.contains("hidden")),
    optsPersistOverride: typeof opts.persistActionIndex === "number"
  });

  return {
    v: VN_AUTOSAVE_PAYLOAD_VERSION,
    projectId: getActiveProjectSaveId(),
    novelId: getActiveNovelSaveId(),
    hashHex: fp.hashHex,
    textLength: fp.textLength,
    metaStart: STORY.meta && STORY.meta.start ? String(STORY.meta.start) : "",
    metaTitle: STORY.meta && STORY.meta.title ? String(STORY.meta.title) : "",
    sceneId: state.sceneId,
    actionIndex: persistActionIndex,
    // currentBgId помогает восстановить унаследованный фон, когда текущая сцена не содержит bg.
    currentBgId: state.currentBgId ? String(state.currentBgId) : "",
    vars: JSON.parse(JSON.stringify(state.vars || {})),
    waitingNext: flagsForDisk.waitingNext,
    nextLocked: flagsForDisk.nextLocked,
    bg: bgSnap,
    lastVisualSnapshot: lastVisualSnap,
    bgScroll: bgScroll,
    story360: story360Snap,
    char: charSnap,
    bgm: bgmSnap
  };
}

/**
 * Проверяет структуру, fingerprint и принадлежность payload активному projectId/novel-слоту.
 * Параметры используются только при безопасной миграции старого слота без projectId.
 */
function validateAutosavePayload(data, validationOptions) {
  var options = validationOptions || {};
  var validationResult = window.VN_AUTOSAVE_PAYLOAD.validatePayload(data, {
    projectId: getActiveProjectSaveId(),
    novelId: getActiveNovelSaveId(),
    allowMissingProjectId: !!options.allowMissingProjectId,
    requiredFingerprint: options.requiredFingerprint || null,
    currentFingerprint: computeStoryTextFingerprint(),
    loadsafe: isStoryLoadsafeEnabled(),
    getSceneActionCount: getAutosaveSceneActionCount
  });

  if (validationResult.reason === "legacy-bg-scroll-focus") {
    autosaveDebugLog("restore:reject_legacy_bgScroll_focus", {});
  }
  if (validationResult.fingerprintSkipped) {
    // В dev-режиме engine.loadsafe=false пропускает только проверку fingerprint, но не структуру слота.
    autosaveDebugLog("restore:loadsafe_disabled_skip_fingerprint", {
      slotHashHex: data.hashHex || "",
      slotTextLength: data.textLength || 0
    });
  }
  return validationResult.valid;
}

// Возвращает длину только известной сцены, не передавая чистому payload-модулю всю runtime-карту.
function getAutosaveSceneActionCount(sceneId) {
  var scene = state && state.sceneMap ? state.sceneMap[sceneId] : null;
  return scene && Array.isArray(scene.actions) ? scene.actions.length : -1;
}

/**
 * Готовит правила проверки и преобразования legacy-слота для общего autosave-контроллера.
 * Чужой, повреждённый или неоднозначный payload отклоняется до записи projectId-слота.
 */
function createLegacyAutosaveMigration() {
  var projectSaveId = getActiveProjectSaveId();
  if (!projectSaveId) return null;

  var legacyFingerprint = computeLegacyStoryFingerprintForProjectMigration();
  if (!legacyFingerprint) return null;

  // Проверяет legacy-payload в контексте прежнего fingerprint до добавления нового projectId.
  function validateLegacyPayloadForMigration(legacyData) {
    return validateAutosavePayload(legacyData, {
      allowMissingProjectId: true,
      requiredFingerprint: legacyFingerprint
    });
  }

  // Перепривязывает проверенный payload к текущему проекту и актуальному fingerprint текста истории.
  function transformLegacyPayloadForProject(legacyData, context) {
    var currentFingerprint = computeStoryTextFingerprint();
    legacyData.projectId = context.projectId;
    legacyData.hashHex = currentFingerprint.hashHex;
    legacyData.textLength = currentFingerprint.textLength;
    return legacyData;
  }

  return {
    validate: validateLegacyPayloadForMigration,
    transform: transformLegacyPayloadForProject
  };
}

// Достаёт focusX из снимка bgScroll автосейва (только актуальный формат).
function getBgScrollFocusXFromAutosavePayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.focusX === "number") return payload.focusX;
  return null;
}

// Достаёт focusY из снимка bgScroll автосейва.
function getBgScrollFocusYFromAutosavePayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.focusY === "number") return payload.focusY;
  return null;
}

// Нормализует сохранённое состояние story360 перед одноразовым применением в startGoto360.
function buildStory360RestorePendingFromAutosave(story360Snap, bgScrollSnap) {
  if (!story360Snap || typeof story360Snap !== "object" || story360Snap.active !== true) return null;

  var spaceId = String(story360Snap.spaceId || "").trim();
  var panoramaId = String(story360Snap.panoramaId || "").trim();
  if (!spaceId || !panoramaId) return null;

  var view = buildStory360ViewRestoreSnapshot(story360Snap.view);
  if (!view && bgScrollSnap && bgScrollSnap.is360 === true) {
    view = buildStory360ViewRestoreSnapshot(bgScrollSnap);
  }

  return {
    spaceId: spaceId,
    panoramaId: panoramaId,
    entryId: String(story360Snap.entryId || "default") || "default",
    resultVar: String(story360Snap.resultVar || ""),
    titleText: String(story360Snap.titleText || ""),
    buttonText: String(story360Snap.buttonText || ""),
    view: view
  };
}

// Достаёт сохранённый pending goto360; для старых слотов умеет собрать минимальный шаг из самой story360-панорамы.
function buildStory360ResumeActionFromAutosave(story360Snap, allowSynthetic) {
  if (!story360Snap || typeof story360Snap !== "object" || story360Snap.active !== true) return null;

  var savedAction = story360Snap.resumeAction && typeof story360Snap.resumeAction === "object"
    ? story360Snap.resumeAction
    : null;
  if (savedAction && savedAction.type === "goto360") {
    return JSON.parse(JSON.stringify(savedAction));
  }
  if (!allowSynthetic) return null;

  var spaceId = String(story360Snap.spaceId || "").trim();
  var panoramaId = String(story360Snap.panoramaId || "").trim();
  if (!spaceId || !panoramaId) return null;

  return {
    type: "goto360",
    spaceId: spaceId,
    panoramaId: panoramaId,
    entry: String(story360Snap.entryId || "default") || "default",
    result: String(story360Snap.resultVar || ""),
    text: String(story360Snap.titleText || ""),
    button: String(story360Snap.buttonText || "")
  };
}

// Восстанавливает pan/focusX без смены src; true если позиция применена (видимый слой и для видео есть размеры кадра).
function applyAutosaveBackgroundPanAndFocus(dataBg, dataBgScroll) {
  if (!dataBg || !dataBg.src || !dataBgScroll || typeof dataBgScroll !== "object") return false;

  var targetEl = dataBg.isVideo ? elBgVideo : elBg;
  if (!targetEl) return false;

  var want = normalizeAssetUrl(dataBg.src);
  var have = normalizeAssetUrl(targetEl.currentSrc || targetEl.src || "");
  if (!want || !have || !urlsMatchForAutosaveRestore(want, have)) return false;

  if (targetEl.classList.contains("hidden")) return false;

  if (dataBg.isVideo && !getScrollableMediaSize(targetEl)) return false;

  var baseScroll = { enabled: false, start: 0.5, focusX: null, focusY: null, scale: 1 };
  baseScroll.enabled = !!dataBgScroll.interactive;
  baseScroll.start = typeof dataBgScroll.start === "number" ? dataBgScroll.start : 0.5;
  var mergedScroll = mergeMediaFocusOptions(
    baseScroll,
    getBgScrollFocusXFromAutosavePayload(dataBgScroll),
    typeof dataBgScroll.scale === "number" ? dataBgScroll.scale : undefined,
    getBgScrollFocusYFromAutosavePayload(dataBgScroll)
  );
  var posOverride = typeof dataBgScroll.position === "number" ? clamp(dataBgScroll.position, 0, 1) : undefined;
  activateMediaScroll(mergedScroll, targetEl, elNovelWindow, "background", posOverride);
  updateBackgroundScrollAvailability();
  return true;
}

function flushAutosaveBgScrollRestorePending() {
  var p = vnAutosaveBgScrollRestorePending;
  if (!p || !p.dataBg || !p.dataBgScroll) return;

  var want = normalizeAssetUrl(p.dataBg.src || "");
  var targetEl = p.dataBg.isVideo ? elBgVideo : elBg;
  if (!targetEl || !want) {
    vnAutosaveBgScrollRestorePending = null;
    return;
  }

  var have = normalizeAssetUrl(targetEl.currentSrc || targetEl.src || "");
  if (have && !urlsMatchForAutosaveRestore(want, have)) {
    vnAutosaveBgScrollRestorePending = null;
    return;
  }

  if (applyAutosaveBackgroundPanAndFocus(p.dataBg, p.dataBgScroll)) {
    vnAutosaveBgScrollRestorePending = null;
    if (p.dataBg.isVideo) {
      scheduleBlurRefreshFromBgVideo(typeof p.dataBg.blurFallback === "string" ? p.dataBg.blurFallback : "");
    }
  }
}

/**
 * executeIfBlock раньше делал splice в scene.actions (индекс автосейва «раздувался» вместе с массивом).
 * Теперь ветка выполняется через state.pendingActions (как у choice.actions) — без мутации сцены,
 * чтобы повторный goto на ту же сцену не копил старые bg/реплики и не откатывал картинку.
 * rewindAutosaveIndexIfPastColdSceneEnd по-прежнему откатывает к последнему if_block, если слот
 * указывал за пределы «холодной» длины массива после смены сценария.
 */
function rewindAutosaveIndexIfPastColdSceneEnd(savedWaitingNext) {
  if (!state || !state.sceneId || !state.sceneMap) return;
  var scene = state.sceneMap[state.sceneId];
  if (!scene || !Array.isArray(scene.actions)) return;
  var idx = state.actionIndex;
  var len = scene.actions.length;
  if (idx < len) return;
  if (!savedWaitingNext) return;
  var ifIdx = -1;
  for (var i = scene.actions.length - 1; i >= 0; i--) {
    if (scene.actions[i] && scene.actions[i].type === "if_block") {
      ifIdx = i;
      break;
    }
  }
  if (ifIdx < 0) {
    autosaveDebugLog("restore:splice_mismatch_no_if_block", { savedIndex: idx, coldLen: len });
    return;
  }
  state.actionIndex = ifIdx;
  autosaveDebugLog("restore:rewind_to_if_block", { savedIndex: idx, coldLen: len, ifIdx: ifIdx });
}

// Применяет уже разобранный и проверенный контроллером payload к состоянию, медиа и интерфейсу истории.
function applyAutosavePayload(data, raw) {
  function isUsableAutosaveBgSrc(src) {
    var normalized = normalizeAssetUrl(src || "");
    if (!normalized) return false;
    var currentPage = normalizeAssetUrl((window && window.location && window.location.href) ? window.location.href : "");
    if (currentPage && urlsMatchForAutosaveRestore(normalized, currentPage)) return false;
    return true;
  }

  var restoreScene = state.sceneMap[data.sceneId];
  var restoreIdx = clamp(
    parseInt(data.actionIndex, 10) || 0,
    0,
    restoreScene && Array.isArray(restoreScene.actions) ? restoreScene.actions.length : 0
  );
  var restoreAction = restoreScene && Array.isArray(restoreScene.actions)
    ? restoreScene.actions[restoreIdx]
    : null;
  // Миграционный safeguard для старых слотов (до lastVisualSnapshot):
  // если слот открывает меню и не содержит никакого визуального снимка,
  // восстановление даст «пустой» экран — такой слот сбрасываем.
  if (
    restoreAction &&
    restoreAction.type === "choice" &&
    !(data.bg && data.bg.src) &&
    !(data.lastVisualSnapshot && data.lastVisualSnapshot.src)
  ) {
    autosaveDebugLog("restore:skip_legacy_choice_without_visual_snapshot", {
      sceneId: data.sceneId,
      actionIndex: data.actionIndex
    });
    return false;
  }

  autosaveDebugLog("restore:slot_before_apply", {
    sceneId: data.sceneId,
    actionIndex: data.actionIndex,
    waitingNext: data.waitingNext,
    nextLocked: data.nextLocked,
    rawLen: raw.length
  });

  state.sceneId = data.sceneId;
  currentSceneId = data.sceneId;
  state.actionIndex = parseInt(data.actionIndex, 10);
  state.currentBgId = typeof data.currentBgId === "string" && data.currentBgId
    ? data.currentBgId
    : null;
  state.vars = data.vars && typeof data.vars === "object"
    ? JSON.parse(JSON.stringify(data.vars))
    : JSON.parse(JSON.stringify((STORY && STORY.vars) ? STORY.vars : {}));
  applyStoryModeToStateVars(state);
  applyLicenseStateToStoryVars();
  state.waitingNext = !!data.waitingNext;
  state.nextLocked = !!data.nextLocked;
  rewindAutosaveIndexIfPastColdSceneEnd(!!data.waitingNext);
  fixAutosaveDeadlockInteractionFlags();
  autosaveDebugLog("restore:state_after_flags", {
    sceneId: state.sceneId,
    actionIndex: state.actionIndex,
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked
  });
  state.inGame = false;
  state.inVideo = false;
  state.currentGame = null;
  // Runtime-очередь не хранится в localStorage; при восстановлении собираем её заново только для pending goto360.
  state.pendingActions = [];
  suppressAutoRunOnce = false;

  hideChoices();
  cleanupStoryVideoVisualOnly();
  gameHost.closeFrame("story");

  var restoreBgSnapshot = (data.bg && isUsableAutosaveBgSrc(data.bg.src))
    ? data.bg
    : ((data.lastVisualSnapshot && isUsableAutosaveBgSrc(data.lastVisualSnapshot.src)) ? data.lastVisualSnapshot : null);
  if (restoreBgSnapshot && restoreBgSnapshot.src) {
    var baseScroll = { enabled: false, start: 0.5, focusX: null, focusY: null, scale: 1 };
    if (data.bgScroll && typeof data.bgScroll === "object") {
      baseScroll.enabled = !!data.bgScroll.interactive;
      baseScroll.start = typeof data.bgScroll.start === "number" ? data.bgScroll.start : 0.5;
    }
    var mergedScroll = mergeMediaFocusOptions(
      baseScroll,
      data.bgScroll ? getBgScrollFocusXFromAutosavePayload(data.bgScroll) : null,
      data.bgScroll && typeof data.bgScroll.scale === "number" ? data.bgScroll.scale : undefined,
      data.bgScroll ? getBgScrollFocusYFromAutosavePayload(data.bgScroll) : null,
      data.bgScroll && data.bgScroll.is360 === true ? true : null,
      null,
      data.bgScroll && typeof data.bgScroll.fov === "number" ? data.bgScroll.fov : null,
      data.bgScroll && typeof data.bgScroll.quality === "string" ? data.bgScroll.quality : null
    );
    // Для 360-пакетов (file=...-360.css/js) при восстановлении явно включаем 360-режим,
    // иначе setBackground пойдёт в обычный image-слой и попытается загрузить JS как картинку.
    var restoreIs360 = isBg360PackPath(restoreBgSnapshot.src);
    if (!restoreIs360 && state.currentBgId) {
      try {
        var restoreBgAsset = resolveBackgroundAsset("@bg." + state.currentBgId);
        restoreIs360 = !!(restoreBgAsset && restoreBgAsset.is360);
      } catch (e) {
        // Повреждённая ссылка ассета не отменяет восстановление по уже сохранённому пути пакета.
      }
    }
    if (restoreIs360) {
      mergedScroll = mergeMediaFocusOptions(mergedScroll, null, undefined, null, true);
    }
    var blurFb =
      restoreBgSnapshot && typeof restoreBgSnapshot.blurFallback === "string" ? restoreBgSnapshot.blurFallback : "";
    if (restoreIs360 && !blurFb && state.currentBgId) {
      // Для 360 без явного blurFallback пытаемся взять fallback из ассета, чтобы blur-слой
      // не получал путь пакета вида *-360.css/js.
      try {
        var blurAsset = resolveBackgroundAsset("@bg." + state.currentBgId);
        if (blurAsset && blurAsset.fallback && !isBg360PackPath(blurAsset.fallback)) {
          blurFb = blurAsset.fallback;
        }
      } catch (e) {
        // Необязательный blur fallback не должен отменять восстановление основного фона.
      }
    }
    setBackground(restoreBgSnapshot.src, blurFb, null, mergedScroll);
    // После успешного восстановления обновляем кэш унаследованного визуала.
    vnAutosaveLastVisualSnapshot = JSON.parse(JSON.stringify(restoreBgSnapshot));
  }
  // Если в слоте нет снимка bg, восстанавливаем последний bg из уже пройденных действий сцены.
  // Это защищает от «черного экрана» после F5 на шагах ожидания choice/text.
  if (!(restoreBgSnapshot && restoreBgSnapshot.src)) {
    if (!restoreBgFromCurrentBgIdForAutosave(state.currentBgId)) {
      restoreBgFromScenePrefixForAutosave(state.sceneId, state.actionIndex);
    }
  }

  if (data.char && typeof data.char === "object") {
    characterController.applySnapshot(data.char);
  }

  if (Object.prototype.hasOwnProperty.call(data, "bgm")) {
    applyAutosaveBgmSnapshot(data.bgm);
  } else {
    restoreBgmFromScenePrefixForAutosave(state.sceneId, state.actionIndex);
  }

  if (elName) {
    elName.textContent = "";
    elName.classList.add("hidden");
  }
  if (elText) {
    elText.textContent = "";
  }

  writeRuntimeDebug("[VN DEBUG] Автосохранение восстановлено", data.sceneId, data.actionIndex);
  // Перед runCurrent передаём startGoto360 текущую панораму story360; иначе команда откроет стартовый узел.
  var story360RestorePending = buildStory360RestorePendingFromAutosave(data.story360, data.bgScroll);
  var restoreActionIsGoto360 = !!(restoreAction && restoreAction.type === "goto360");
  var story360ResumeAction = story360RestorePending
    ? buildStory360ResumeActionFromAutosave(data.story360, !restoreActionIsGoto360)
    : null;
  if (story360ResumeAction) {
    // Старые слоты могли указывать прямо на menu; перескакиваем за него и запускаем сохранённый 360-шаг из pendingActions.
    if (restoreAction && restoreAction.type === "choice" && restoreScene && Array.isArray(restoreScene.actions)) {
      state.actionIndex = clamp((parseInt(data.actionIndex, 10) || 0) + 1, 0, restoreScene.actions.length);
    }
    state.pendingActions = [story360ResumeAction];
  }
  vnAutosaveStory360RestorePending =
    story360RestorePending && (restoreActionIsGoto360 || story360ResumeAction)
      ? story360RestorePending
      : null;
  vnAutosaveBgScrollRestorePending =
    data.bg && data.bgScroll && typeof data.bgScroll === "object"
      ? { dataBg: data.bg, dataBgScroll: data.bgScroll }
      : null;
  runCurrent();
  autosaveDebugLog("restore:after_runCurrent", {
    sceneId: state.sceneId,
    actionIndex: state.actionIndex,
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked,
    inGame: state.inGame,
    inVideo: state.inVideo,
    elTextLen: elText ? String(elText.textContent || "").length : -1,
    gameModalHidden: elGameModal ? elGameModal.classList.contains("hidden") : null
  });
  flushAutosaveBgScrollRestorePending();
  var blurVideoFb =
    data.bg && typeof data.bg.blurFallback === "string" ? data.bg.blurFallback : "";
  requestAnimationFrame(function () {
    flushAutosaveBgScrollRestorePending();
    requestAnimationFrame(function () {
      flushAutosaveBgScrollRestorePending();
      if (data.bg && data.bg.isVideo) {
        scheduleBlurRefreshFromBgVideo(blurVideoFb);
      }
    });
  });
  return true;
}

// Для старых автосейвов без поля bgm восстанавливает последнюю пройденную music-команду текущей сцены.
function restoreBgmFromScenePrefixForAutosave(sceneId, actionIndex) {
  if (!state || !state.sceneMap || !sceneId) return false;
  var scene = state.sceneMap[sceneId];
  if (!scene || !Array.isArray(scene.actions) || scene.actions.length === 0) return false;

  var limit = clamp(parseInt(actionIndex, 10) || 0, 0, scene.actions.length);
  var lastBgmAction = null;
  for (var i = 0; i < limit; i++) {
    var a = scene.actions[i];
    if (a && a.type === "bgm") {
      lastBgmAction = a;
    }
  }
  if (!lastBgmAction) return false;
  if (!lastBgmAction.src) {
    stopBgmImmediate();
    return false;
  }

  var bgmAsset = resolveAudioAsset(lastBgmAction.src);
  var volume = num(lastBgmAction.volume, bgmAsset.volume != null ? bgmAsset.volume : 0.7);
  return applyAutosaveBgmSnapshot({
    src: bgmAsset.file,
    loop: !!lastBgmAction.loop,
    volume: volume,
    currentTime: 0
  });
}

// Восстанавливает фон по bgId, который был активен до входа в «пустую» сцену без bg.
// Это надёжнее для 360/видео кейсов, где прямой снимок data.bg мог отсутствовать.
function restoreBgFromCurrentBgIdForAutosave(currentBgId) {
  var bgId = typeof currentBgId === "string" ? currentBgId.trim() : "";
  if (!bgId) return false;
  var bgAssetInfo = resolveBackgroundAsset("@bg." + bgId);
  if (!bgAssetInfo || !bgAssetInfo.file) return false;
  state.currentBgId = bgId;
  setBackground(bgAssetInfo.file, bgAssetInfo.fallback, bgAssetInfo.volume, bgAssetInfo.scroll);
  return true;
}

// Восстанавливает последний bg и связанные bg360marks из префикса сцены [0..actionIndex), когда в автосейве нет data.bg.
// Используем только визуальные действия, без выполнения логики/ветвлений.
function restoreBgFromScenePrefixForAutosave(sceneId, actionIndex) {
  if (!state || !state.sceneMap || !sceneId) return false;
  var scene = state.sceneMap[sceneId];
  if (!scene || !Array.isArray(scene.actions) || scene.actions.length === 0) return false;

  var limit = clamp(parseInt(actionIndex, 10) || 0, 0, scene.actions.length);
  var lastBgAction = null;
  var lastBg360MarksAction = null;
  for (var i = 0; i < limit; i++) {
    var a = scene.actions[i];
    if (a && a.type === "bg") {
      lastBgAction = a;
      lastBg360MarksAction = null;
    } else if (a && a.type === "bg360marks") {
      lastBg360MarksAction = a;
    }
  }
  if (!lastBgAction) return false;

  var bgAssetInfo = resolveBackgroundAsset(lastBgAction.src);
  var bgMediaOptions = lastBgAction.scroll !== undefined ? lastBgAction.scroll : bgAssetInfo.scroll;
  bgMediaOptions = mergeMediaFocusOptions(
    bgMediaOptions,
    lastBgAction.focusX !== undefined ? lastBgAction.focusX : bgAssetInfo.focusX,
    lastBgAction.scale !== undefined ? lastBgAction.scale : bgAssetInfo.scale,
    lastBgAction.focusY !== undefined ? lastBgAction.focusY : bgAssetInfo.focusY,
    lastBgAction.is360 !== undefined ? lastBgAction.is360 : bgAssetInfo.is360,
    lastBgAction.focusZ !== undefined ? lastBgAction.focusZ : bgAssetInfo.focusZ,
    lastBgAction.fov !== undefined ? lastBgAction.fov : bgAssetInfo.fov,
    lastBgAction.quality !== undefined ? lastBgAction.quality : bgAssetInfo.quality
  );
  bgMediaOptions = applyUserFocusToMergedBgMediaOptions(lastBgAction, bgAssetInfo, bgMediaOptions);
  state.currentBgId = lastBgAction.bgId || extractBgIdFromRef(lastBgAction.src);
  setBackground(bgAssetInfo.file, bgAssetInfo.fallback, bgAssetInfo.volume, bgMediaOptions);
  if (lastBg360MarksAction) {
    // Метки нужны до повторного входа в walk360, иначе restore покажет фон без кликабельных точек.
    applyBg360Marks(lastBg360MarksAction);
  }
  return true;
}

function restart() {
  vnAutosaveBgScrollRestorePending = null;
  vnAutosaveStory360RestorePending = null;
  visualTransitionController.cancel();

  // Сбрасываем ошибки парсинга
  window.PARSE_ERRORS = [];

  var restartOptions = arguments.length > 0 && arguments[0] !== null && typeof arguments[0] === "object"
    ? arguments[0]
    : {};

  var shouldWriteCleanAutosaveAfterReset = !!restartOptions.clearAutosave;
  var shouldRunStandaloneGame = !!standaloneGameLaunch;
  var resolvedStoryUrlLaunch = resolveStoryUrlLaunch();
  storyUrlLaunchSceneId = resolvedStoryUrlLaunch.sceneId;

  if (shouldWriteCleanAutosaveAfterReset) {
    autosaveController.clear();
  }

  setStandaloneGameModeEnabled(false);
  suppressAutoRunOnce = false;
  lastNextTime = 0;
  // На рестарте инвалидируем старые асинхронные загрузки персонажа,
  // чтобы callback из предыдущего состояния не «вернул» старый спрайт.
  characterController.cancel("restart");
  state.currentGame = null;
  state.waitingNext = false;
  state.nextLocked = false;
  state.inVideo = false;
  // При рестарте временные ветки menu/if пересобираются заново из сценария, старую очередь нельзя переносить.
  state.pendingActions = [];

  hideChoices();
  reset360InteractionStateForRestart("restart");
  cleanupStoryVideoVisualOnly();
  gameHost.closeFrame("story");
  hideOverlay();
  // Явно сбрасываем персонажа до запуска стартовой сцены.
  characterController.hide("restart reset");

  // URL-игра обходит сюжет, scene блокирует storage через isStoryAutosaveEnabled, а novel читает только свой слот.
  if (
    !shouldRunStandaloneGame &&
    !restartOptions.clearAutosave &&
    isStoryAutosaveEnabled() &&
    autosaveController.loadAndApply()
  ) {
    return;
  }

  // Полный сброс без автосейва (или сохранение недействительно).
  state.vars = JSON.parse(JSON.stringify((STORY && STORY.vars) ? STORY.vars : {}));
  applyStoryModeToStateVars(state);
  applyLicenseStateToStoryVars();
  state.inGame = false;

  // Сбрасываем флаг первого диалога и класс диалога
  isFirstDialog = true;
  var dialogElement = document.getElementById('dialog');
  if (dialogElement) {
    dialogElement.classList.remove('no-hint', 'has-hint', 'has-name', 'no-name');
  }


  // Проверяем наличие ошибок парсинга
  if (window.PARSE_ERRORS && window.PARSE_ERRORS.length > 0) {
    writeRuntimeVerbose('[Engine] Обнаружены ошибки парсинга, показываем сообщение');
    // Здесь ничего не делаем, так как story-loader.js уже создал сцену с ошибкой
    // Просто продолжаем выполнение - движок покажет сцену с ошибкой
  }

  if (elName) {
    elName.textContent = "";
    elName.classList.add("hidden");
  }
  if (elText) {
    elText.textContent = "";
  }

  applyUiLanguage();



  // Ошибка в явном scene/novel не должна незаметно запускать другую историю или затрагивать её сохранение.
  if (
    !shouldRunStandaloneGame &&
    resolvedStoryUrlLaunch.mode !== "default" &&
    !resolvedStoryUrlLaunch.valid
  ) {
    state.sceneId = null;
    currentSceneId = null;
    state.actionIndex = 0;
    state.currentBgId = null;
    stopBgmImmediate();
    showError(
      "Не найдена сцена для параметра " +
      resolvedStoryUrlLaunch.mode +
      ": " +
      resolvedStoryUrlLaunch.requestedId
    );
    return;
  }

  // novel и scene используют найденное без учёта регистра каноническое имя; обычный запуск сохраняет startScene.
  state.sceneId = resolvedStoryUrlLaunch.sceneId || (STORY.meta && STORY.meta.start ? STORY.meta.start : null);
  currentSceneId = state.sceneId;
  state.actionIndex = 0;
  state.currentBgId = null;
  state.waitingNext = false;

  // (по желанию) останавливаем звук при рестарте:
  // но у вас музыка должна играть фоном -> оставим как есть?
  // Я сделаю так: если в start-сцене есть bgm action, она сама запустит.
  stopBgmImmediate();

  // Сбрасываем размытый фон
  if (elBlurBgLayer) { // Добавляем проверку
    if (STORY.meta && STORY.meta.blurBackground) {
      updateBlurBackground(elBg.src);
    } else {
      elBlurBgLayer.classList.add("hidden");
    }
  }

  firstScreenMetrics.waitingForCharacter = false;
  firstScreenMetrics.firstScreenShown = false;

  // Если в адресе задана игра, обычный поток новеллы не стартует: остаётся чёрный фон и iframe игры.
  if (shouldRunStandaloneGame && startStandaloneGameFromUrl()) {
    return;
  }

  runCurrent();

  if (shouldWriteCleanAutosaveAfterReset) {
    // После ручного сброса сразу заменяем старый слот стартовым состоянием, а не ждём debounce/pagehide.
    autosaveController.flush();
  }
}

function runCurrent() {
  try {
  writeRuntimeDebug('[VN DEBUG] Исполнение сцены', state.sceneId, 'с индекса', state.actionIndex);

  // безопасность: если сцены нет
  var scene = state.sceneMap[state.sceneId];
  if (!scene) {
    showError("Не найдена сцена: " + state.sceneId);
    return;
  }

  // обработка списка actions
  while (true) {
    // Игра и сюжетное видео управляют потоком сами, пока их callback не возобновит сцену.
    if (state.inGame || state.inVideo) return;

    var scene = state.sceneMap[state.sceneId];
    if (!scene) {
      showError("Не найдена сцена: " + state.sceneId);
      return;
    }

    // Если дошли до конца сцены и нет временных действий — останавливаемся.
    if (
      state.actionIndex >= scene.actions.length &&
      (!Array.isArray(state.pendingActions) || state.pendingActions.length === 0)
    ) {
      writeRuntimeVerbose('[VN] Достигнут конец сцены', state.sceneId);
      autosaveDebugLog("runCurrent:end_of_scene", {
        sceneId: state.sceneId,
        actionIndex: state.actionIndex,
        actionsLen: scene.actions.length
      });
      state.waitingNext = false;
      state.nextLocked = true; // Блокируем дальнейшие клики
      return;
    }


    var actionIndexBeforeInc = state.actionIndex;
    var action = null;
    // Флаг нужен автосейву: временные действия из menu/if не имеют собственного индекса в scene.actions.
    var actionFromPending = false;
    if (Array.isArray(state.pendingActions) && state.pendingActions.length > 0) {
      action = state.pendingActions.shift();
      actionFromPending = true;
    } else {
      action = scene.actions[actionIndexBeforeInc];
      if (visualTransitionController.isCandidate(action)) {
        var visualBatchActions = visualTransitionController.collectActions(scene, actionIndexBeforeInc);
        action = {
          type: "visual_batch",
          actions: visualBatchActions
        };
        state.actionIndex += visualBatchActions.length;
      } else {
        state.actionIndex++;
      }
    }
    if (!action || !action.type) continue;

    writeRuntimeDebug('[VN DEBUG] Действие', {
      sceneId: state.sceneId,
      actionIndex: actionFromPending ? -1 : actionIndexBeforeInc,
      type: action.type,
      pending: actionFromPending
    });

    var shouldWait = executeAction(action);
    if (shouldWait === "async" && (action.type === "walk360" || action.type === "goto360")) {
      rememberActive360ActionForAutosave(action, actionFromPending, actionFromPending ? -1 : actionIndexBeforeInc, state.actionIndex);
    }

    if (shouldWait === "async") {
      // Ждём внутреннего завершения действия (например, загрузки персонажа),
      // но НЕ разрешаем пользовательский клик "дальше".
      state.waitingNext = false;
      state.nextLocked = true;
      return;
    }

    if (shouldWait === true) {
      // Обычное ожидание пользовательского next
      state.waitingNext = true;
      state.nextLocked = false;
      return;
    }
    
  }
  } finally {
    autosaveController.schedule();
  }
}


// Ограничивает повторные click/pointerup одним переходом за короткий интервал.
var lastNextTime = 0;
var NEXT_COOLDOWN = 300; // миллисекунд
var suppressAutoRunOnce = false;

function onNext(e) {
  if (state.inGame || state.inVideo) {
    autosaveDebugLog("onNext:blocked", { reason: "inGame_or_inVideo", inGame: state.inGame, inVideo: state.inVideo });
    return;
  }
  if (elGameModal && !elGameModal.classList.contains("hidden")) {
    autosaveDebugLog("onNext:blocked", { reason: "gameModal_visible" });
    return;
  }
  // Пока открыты настройки, любые "next" блокируем: пользователь работает с интерфейсом настроек.
  if (elSettingsPanel && !elSettingsPanel.classList.contains("hidden")) {
    autosaveDebugLog("onNext:blocked", { reason: "settingsPanel_visible" });
    return;
  }
  // Пока открыта статистика, любые "next" блокируем: пользователь взаимодействует с UI, а не со сценой.
  if (elStatsPanel && !elStatsPanel.classList.contains("hidden")) {
    autosaveDebugLog("onNext:blocked", { reason: "statsPanel_visible" });
    return;
  }

  // Защита от двойных кликов
  var now = Date.now();
  if (now - lastNextTime < NEXT_COOLDOWN) {
    autosaveDebugLog("onNext:blocked", { reason: "cooldown_ms", dt: now - lastNextTime, NEXT_COOLDOWN: NEXT_COOLDOWN });
    return;
  }

  lastNextTime = now;

  // Защита от всплытия
  if (e && typeof e.stopPropagation === "function") {
    e.stopPropagation();
  }
  
  if (!elChoices.classList.contains("hidden")) {
    autosaveDebugLog("onNext:blocked", { reason: "choices_visible" });
    return;
  }
  if (state.inGame || state.inVideo) {
    autosaveDebugLog("onNext:blocked", { reason: "inGame_or_inVideo_late", inGame: state.inGame, inVideo: state.inVideo });
    return;
  }

  // ВАЖНО: проверяем, ждём ли мы следующего действия
  if (!state.waitingNext) {
    autosaveDebugLog("onNext:blocked", { reason: "not_waitingNext" });
    return;
  }

  // Конец основной сцены не всегда означает конец выполнения: menu/if/goto360 могут держать продолжение в runtime-очереди.
  var scene = state.sceneMap[state.sceneId];
  var pendingActionsLen = Array.isArray(state.pendingActions) ? state.pendingActions.length : 0;
  if (!scene || !Array.isArray(scene.actions)) {
    autosaveDebugLog("onNext:blocked", {
      reason: "bad_scene",
      sceneId: state.sceneId
    });
    return;
  }
  if (pendingActionsLen === 0 && state.actionIndex >= scene.actions.length) {
    autosaveDebugLog("onNext:blocked", {
      reason: "past_end_of_scene",
      actionIndex: state.actionIndex,
      actionsLen: scene.actions.length,
      pendingActionsLen: pendingActionsLen
    });
    return;
  }

  // Разрешаем только один "next" до следующего say/text
  if (state.nextLocked) {
    autosaveDebugLog("onNext:blocked", { reason: "nextLocked" });
    return;
  }
  state.nextLocked = true;

  // Защита от двойных событий (click после pointerup и т.п.)
  if (e && typeof e.preventDefault === "function") e.preventDefault();

  state.waitingNext = false;

  // ВАЖНО: добавляем принудительный сброс nextLocked через небольшой таймаут
  // чтобы гарантировать, что следующий диалог сможет быть обработан
  setTimeout(function() {
    if (!state.waitingNext) {
      state.nextLocked = false;
    }
  }, 100);

  runCurrent();
  // Клик "дальше" — гарантированный user gesture, поэтому пытаемся поднять звук фонового видео.
  resumeBackgroundVideoIfNeeded('onNext');
}

function renderTextVars(text) {
  if (typeof text !== "string") return text;

  return text.replace(/\{([^}]+)\}/g, function(_, varName) {
    var key = varName.trim();
    var value = state.vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

// Безопасно вычисляет выражение для set/if без исполнения произвольного JS-кода.
function evaluateSafeExpression(expression, vars) {
  return window.VNExpression.evaluate(expression, vars);
}

// Проверяет грамматику безопасного выражения и собирает имена переменных без вычисления выражения.
function validateAndCollectSafeExpressionIdentifiers(expression) {
  return window.VNExpression.inspect(expression);
}

// =========================================================
//                   ACTION EXECUTION
// =========================================================

// Готовит финальное состояние фона из команды bg, но не меняет DOM до общего swap.
function prepareBackgroundVisualAction(action) {
  if (!action) return null;
  resetBg360MarksOnNewBackground();
  cancelWalk360IfActive("bg");

  var bgAssetInfo = resolveBackgroundAsset(action.src);
  var bgMediaOptions = action.scroll !== undefined ? action.scroll : bgAssetInfo.scroll;
  bgMediaOptions = mergeMediaFocusOptions(
    bgMediaOptions,
    action.focusX !== undefined ? action.focusX : bgAssetInfo.focusX,
    action.scale !== undefined ? action.scale : bgAssetInfo.scale,
    action.focusY !== undefined ? action.focusY : bgAssetInfo.focusY,
    action.is360 !== undefined ? action.is360 : bgAssetInfo.is360,
    action.focusZ !== undefined ? action.focusZ : bgAssetInfo.focusZ,
    action.fov !== undefined ? action.fov : bgAssetInfo.fov,
    action.quality !== undefined ? action.quality : bgAssetInfo.quality
  );

  bgMediaOptions = applyUserFocusToMergedBgMediaOptions(action, bgAssetInfo, bgMediaOptions);

  state.currentBgId = action.bgId || extractBgIdFromRef(action.src);

  var bgFile = bgAssetInfo.file || "";
  var normalizedSrc = normalizeAssetUrl(bgFile);
  var currentBg = captureBackgroundSnapshotForAutosave();
  var currentSrc = currentBg && currentBg.src ? normalizeAssetUrl(currentBg.src) : "";
  var changesVisual = !!normalizedSrc && (
    !currentSrc ||
    !imageUrlMatchesStoryCandidates(currentSrc, bgFile) ||
    (bgMediaOptions && bgMediaOptions.is360 === true)
  );

  return {
    action: action,
    file: bgAssetInfo.file,
    fallback: bgAssetInfo.fallback,
    volume: bgAssetInfo.volume,
    mediaOptions: bgMediaOptions,
    normalizedSrc: normalizedSrc,
    changesVisual: changesVisual
  };
}

function applyPreparedBackgroundVisualState(preparedBg) {
  if (!preparedBg) return;
  setBackground(preparedBg.file, preparedBg.fallback, preparedBg.volume, preparedBg.mediaOptions);
}

// Передаёт батч контроллеру и после завершения только актуального перехода возобновляет runCurrent.
function executeVisualBatch(actions) {
  var execution = visualTransitionController.execute(actions);
  var hasCharacterShow = !!execution.hasCharacterShow;

  if (hasCharacterShow && !firstScreenMetrics.firstScreenShown) {
    firstScreenMetrics.waitingForCharacter = true;
  }

  if (!execution.async) {
    if (hasCharacterShow) firstScreenMetrics.waitingForCharacter = false;
    return false;
  }

  execution.promise.then(function continueAfterVisualTransition(shouldContinue) {
    if (!shouldContinue) return;
    if (hasCharacterShow) firstScreenMetrics.waitingForCharacter = false;
    state.nextLocked = false;
    state.waitingNext = false;
    runCurrent();
  }).catch(function recoverUnexpectedVisualTransitionFailure(error) {
    console.warn("[VISUAL BATCH] unexpected controller failure:", error);
    visualTransitionController.cancel();
    if (hasCharacterShow) firstScreenMetrics.waitingForCharacter = false;
    state.nextLocked = false;
    state.waitingNext = false;
    runCurrent();
  });

  return "async";
}

// Возвращает true, если надо "ждать" (клик дальше/выбор/игра)
function executeAction(action) {
  switch (action.type) {
    case "visual_batch":
      return executeVisualBatch(action.actions || []);

    case "bg":
      // Любая смена фона сбрасывает блокировку меток 360 (и прячет их, пока сценарий не задаст новые).
      resetBg360MarksOnNewBackground();
      // Если walk360 ещё активен, то это ошибка сценария, но движок должен продолжить работу.
      cancelWalk360IfActive("bg");
      var bgAssetInfo = resolveBackgroundAsset(action.src);
      var bgMediaOptions = action.scroll !== undefined ? action.scroll : bgAssetInfo.scroll;
      bgMediaOptions = mergeMediaFocusOptions(
        bgMediaOptions,
        action.focusX !== undefined ? action.focusX : bgAssetInfo.focusX,
        action.scale !== undefined ? action.scale : bgAssetInfo.scale,
        action.focusY !== undefined ? action.focusY : bgAssetInfo.focusY,
        action.is360 !== undefined ? action.is360 : bgAssetInfo.is360,
        action.focusZ !== undefined ? action.focusZ : bgAssetInfo.focusZ,
        action.fov !== undefined ? action.fov : bgAssetInfo.fov,
        action.quality !== undefined ? action.quality : bgAssetInfo.quality
      );
      bgMediaOptions = applyUserFocusToMergedBgMediaOptions(action, bgAssetInfo, bgMediaOptions);
      // Сохраняем id фона, чтобы walk360 мог проверить соответствие.
      state.currentBgId = action.bgId || extractBgIdFromRef(action.src);
      setBackground(bgAssetInfo.file, bgAssetInfo.fallback, bgAssetInfo.volume, bgMediaOptions);
      return false;

    case "bg360marks":
      // Список меток относится к конкретному фону из [bg].
      applyBg360Marks(action);
      return false;

    case "walk360":
      // Блокирующая команда: ждём, пока игрок выберет метку или нажмёт кнопку выхода.
      return startWalk360(action);

    case "goto360":
      // Блокирующая команда: управление переходит к графу 360-пространства из story360.js.
      return startGoto360(action);

    case "char":
      // Любая команда без charId и без src - это скрытие
      if ((!action.charId || action.charId === null) && action.src === null) {
        writeRuntimeVerbose('[ENGINE] ВЫПОЛНЯЕТСЯ HIDE ALL!');
        characterController.hide("action hide all");
        writeRuntimeVerbose('[ENGINE] HIDE ALL ВЫПОЛНЕН, возвращаем false');
        return false;
      }
      
      // Только новый формат:
      // { type: "char", charId: "anna", emotion: "neutral", pos: "center" }
      writeRuntimeVerbose('[Engine CHAR] New format - charId:', action.charId, 'emotion:', action.emotion);

      if (!action.charId) {
        console.warn('[Engine CHAR] charId отсутствует:', state.sceneId, state.actionIndex - 1);
        characterController.hide("action without charId");
        return false;
      }

      var charAssetInfoForAction = characterController.resolveAssetInfo(action.charId, action.emotion);
      var charSrcForAction = charAssetInfoForAction.file;
      var charFocusOptionsForAction = characterController.mergeFocusOptions(
        charAssetInfoForAction.focusOptions,
        action
      );
      writeRuntimeVerbose('[Engine CHAR] Resolved src:', sanitizeDiagnosticResource(charSrcForAction));

      // Если картинка не найдена — не показываем, но и не скрываем
      if (!charSrcForAction) {
        // Просто пропускаем, не меняем видимость
        return false;
      }

      if (!firstScreenMetrics.firstScreenShown) {
        firstScreenMetrics.waitingForCharacter = true;
      }

      var characterShowResult = characterController.show(charSrcForAction, action.pos, action.charId, function continueAfterCharacterLoad() {
        firstScreenMetrics.waitingForCharacter = false;

        // ✅ Если ожидаем клик пользователя – не продолжаем автоматически
        if (state.waitingNext) {
          writeRuntimeVerbose('[FLOW] char(new):done callback but waiting for user click, skipping runCurrent');
          state.nextLocked = false;      // снимаем блокировку, если была
          return;
        }

        state.nextLocked = false;
        state.waitingNext = false;

        if (suppressAutoRunOnce) {
          writeRuntimeVerbose('[FLOW] char(new):done callback suppressed after manual game close');
          suppressAutoRunOnce = false;
          state.nextLocked = false;
          state.waitingNext = true;
          return;
        }

        runCurrent();
      }, charFocusOptionsForAction);

      // Уже видимый персонаж с тем же focus применяется синхронно и не блокирует runCurrent.
      if (!characterShowResult.async) {
        firstScreenMetrics.waitingForCharacter = false;
        return false;
      }

      return "async";

    case "say":
      writeRuntimeVerbose('[ENGINE SAY] Показываю диалог, возвращаю true');
      // Только новый формат:
      // { type: "say", charVar: "anna", text: "..." }

      if (!action.charVar) {
        console.warn('[Engine] say: charVar отсутствует:', state.sceneId, state.actionIndex - 1);
        showDialog(null, renderTextVars(action.text || ""));
        return true;
      }


      // Получаем данные персонажа из assets
      let displayName = action.charVar; // по умолчанию используем ID
      let nameColor = null;
      
      if (STORY.assets && STORY.assets.characters) {
        const char = STORY.assets.characters[action.charVar];
        if (char) {
          if (char.name) displayName = char.name;
          if (char.color) nameColor = char.color;
        }
      }
      
      // Показываем диалог с именем (даже если персонаж не на экране)
      showDialog(displayName, renderTextVars(action.text), nameColor);

      if (!firstScreenMetrics.firstScreenShown && !firstScreenMetrics.waitingForCharacter) {
        markFirstScreenReady('say');
      }

      return true;

    case "game":
      openGame(action);
      return "async";

    case "text":
      writeRuntimeVerbose('[ENGINE TEXT] Показываю текст, возвращаю true');
      showDialog(null, renderTextVars(action.text));

      // ВАЖНО: принудительно устанавливаем ожидание
      state.waitingNext = true;
      state.nextLocked = false;

      writeRuntimeVerbose('[VN] text action - waitingNext установлен в true');

      return true;

    case "choice":
      showChoices(action.choices || [], action);
      return true;

    case "goto":
      writeRuntimeVerbose('[ENGINE GOTO] Переход, возвращаю false');
      gotoScene(action.target);
      return false;

    case "overlay":
      // опционально: показать/скрыть оверлей
      if (action.show) showOverlay(action.opacity);
      else hideOverlay();
      return false;

    case "bgm":
      if (!action.src) {
        // music stop должен очистить BGM-канал, чтобы автосейв не resurrect-ил старый трек.
        stopBgmImmediate();
        return false;
      }
      var bgmAsset = resolveAudioAsset(action.src);
      // Базовая громкость из [audio] применяется только когда команда music не задала свой volume.
      playBgm(bgmAsset.file, !!action.loop, num(action.volume, bgmAsset.volume != null ? bgmAsset.volume : 0.7), num(action.fadeMs, 0));
      return false;

    case "sfx":
      playSfx(resolveAsset(action.src), num(action.volume, 1));
      return false;

    case "set": {
      var eqPos = action.expression.indexOf('=');

      if (eqPos === -1) {
        console.error("[VN] set: неверное выражение в сцене", state.sceneId, state.actionIndex - 1);
        return false;
      }

      var varName = action.expression.substring(0, eqPos).trim();
      var expr = action.expression.substring(eqPos + 1).trim();

      if (!varName) {
        console.error("[VN] set: пустое имя переменной в сцене", state.sceneId, state.actionIndex - 1);
        return false;
      }

      try {
        // set вычисляет только безопасное выражение без запуска JavaScript-кода из сценария.
        state.vars[varName] = evaluateSafeExpression(expr, state.vars);
      } catch (e) {
        console.error("[VN] set error для переменной", varName, e && e.message ? e.message : e);
      }

      return false;
    }
   case "if_expr": {
      try {
        // Условие if_expr ограничено безопасным языком выражений.
        var ok = !!evaluateSafeExpression(action.condition, state.vars);

        if (ok) {
          gotoScene(action.target);
          return false;
        }

        return false;
      } catch (e) {
        console.error("[VN] if_expr error в сцене", state.sceneId, state.actionIndex - 1, e && e.message ? e.message : e);
        return false;
      }
    }
    case "if_block":
      return executeIfBlock(action);
    case "if":
      // if: { cond: "vars.score >= 3", then: "a", else: "b" }
      // ВНИМАНИЕ: без eval для безопасности. Поддержим только простую форму:
      // { key: "score", op: ">=", value: 3, then: "...", else: "..." }
      return executeIfSafe(action);

    case "video":
      startStoryVideo(action);
      return "async";

    default:
      // неизвестный action — пропускаем
      return false;
  }
}

// Извлекает bgId из ссылки вида "@bg.someId".
function extractBgIdFromRef(ref) {
  var s = String(ref || "");
  var m = s.match(/^@bg\.([A-Za-z0-9_-]+)$/);
  return m ? m[1] : null;
}

// Полный сброс меток при любом новом bg: это освобождает hit-test и убирает старые метки.
function resetBg360MarksOnNewBackground() {
  closeBg360PhotoViewer("bg_change");
  bg360MarksRuntime.bgId = null;
  bg360MarksRuntime.marks = [];
  bg360MarksRuntime.lines = false;
  bg360MarksRuntime.locked = false;
  bg360MarksRuntime.interactive = false;
  renderBg360Marks();
}

// Отмена активного walk360 (например если сценарий неожиданно сменил фон).
function cancelWalk360IfActive(reason) {
  if (!walk360Runtime.active) return;
  console.warn("[walk360] cancelled due to", reason);
  finishWalk360("");
}

// Сбрасывает 360-ожидание без runCurrent: при рестарте сценарий сам заново дойдёт до нужной команды.
function reset360InteractionStateForRestart(reason) {
  closeBg360PhotoViewer(reason || "restart");
  clearActive360ActionForAutosave();
  walk360Runtime.active = false;
  walk360Runtime.bgId = null;
  walk360Runtime.resultVar = "";
  walk360Runtime.done = false;

  goto360Runtime.active = false;
  goto360Runtime.spaceId = "";
  goto360Runtime.panoramaId = "";
  goto360Runtime.entryId = "default";
  goto360Runtime.resultVar = "";
  goto360Runtime.done = false;
  goto360Runtime.titleText = "";
  goto360Runtime.buttonText = "";

  bg360MarksRuntime.bgId = null;
  bg360MarksRuntime.marks = [];
  bg360MarksRuntime.lines = false;
  bg360MarksRuntime.locked = false;
  bg360MarksRuntime.interactive = false;
  renderBg360Marks();

  if (elChoices) {
    clearFitChoiceLayout();
    elChoices.classList.add("hidden");
    elChoices.innerHTML = "";
  }

  // Отключаем старый canvas и инвалидируем его отложенные загрузки, чтобы после сброса не вернулся прежний 360-фон.
  disableBg360Renderer();
  writeRuntimeVerbose("[walk360] reset interaction state", reason || "");
}

// Прячет обычную реплику на время walk360 и убирает оставшийся текст/имя, чтобы не было пустой нижней плашки.
function hideDialogForWalk360() {
  if (elName) {
    elName.textContent = "";
    elName.classList.add("hidden");
    elName.removeAttribute("data-protected");
  }
  if (elText) {
    elText.textContent = "";
  }
  if (elDialog) {
    elDialog.classList.add("hiddenByChoices");
    elDialog.classList.remove("has-name", "has-hint");
    elDialog.classList.add("no-name", "no-hint");
  }
  var hintElement = document.querySelector(".hint");
  if (hintElement) hintElement.style.display = "none";
}

// Применяет команду bg360marks: подготавливает слой меток (показываем/прячем в зависимости от walk360).
function applyBg360Marks(action) {
  var bgId = action && action.bgId ? String(action.bgId) : "";
  var marks = action && Array.isArray(action.marks) ? action.marks : [];

  bg360MarksRuntime.bgId = bgId;
  bg360MarksRuntime.lines = !!(action && action.lines);
  var normalizedMarks = marks.map(function (m) {
    var targetSceneRaw = m && m.targetScene !== undefined && m.targetScene !== null
      ? String(m.targetScene).trim()
      : "";
    var labelRaw = readStory360Field(m, ["label", "title", "name"]);
    var textRaw = readStory360Field(m, ["text"]);
    return {
      id: String(m.id || ""),
      x: Number(m.x),
      y: Number(m.y),
      kind: normalizeBg360MarkKind(m.kind || m.type || "walk"),
      label: String(labelRaw || "").trim(),
      text: String(textRaw || "").trim(),
      images: normalizeBg360PhotoImages(m),
      visibleIf: getStory360MarkVisibleIf(m),
      // Пустая сцена означает "переход не задан на метке", дальше отработает обычная логика.
      targetScene: targetSceneRaw || null,
      target: m && m.target ? m.target : null
    };
  });
  bg360MarksRuntime.marks = filterStory360VisibleMarks(normalizedMarks, "bg360marks " + bgId);
  bg360MarksRuntime.locked = false;
  // Интерактивность включится только внутри walk360.
  bg360MarksRuntime.interactive = false;
  if (bg360ShouldDeferMarksUntilTextureReady()) {
    stripBg360NavigationOverlayPendingLoad();
    return;
  }
  renderBg360Marks();
}

// Возвращает корневой объект story360.js, если он был подключён до движка.
function getStory360Root() {
  var root = window.STORY360;
  return root && typeof root === "object" ? root : null;
}

// Находит 360-пространство по id; данные хранятся в window.STORY360.spaces.
function getStory360Space(spaceId) {
  var root = getStory360Root();
  var id = String(spaceId || "").trim();
  if (!root || !id || !root.spaces || typeof root.spaces !== "object") return null;
  var space = root.spaces[id];
  return space && typeof space === "object" ? space : null;
}

// Возвращает словарь панорам пространства, поддерживая несколько понятных имён поля.
function getStory360Panoramas(space) {
  if (!space || typeof space !== "object") return null;
  var panoramas = space.panoramas || space.scenes || space.images;
  return panoramas && typeof panoramas === "object" ? panoramas : null;
}

// Находит описание панорамы внутри выбранного 360-пространства.
function getStory360Panorama(spaceId, panoramaId) {
  var space = getStory360Space(spaceId);
  var panoramas = getStory360Panoramas(space);
  var id = String(panoramaId || "").trim();
  if (!panoramas || !id) return null;
  var panorama = panoramas[id];
  return panorama && typeof panorama === "object" ? panorama : null;
}

// Читает первое заданное поле из объекта; нужно для мягкой поддержки bgId/bg/backgroundId и похожих алиасов.
function readStory360Field(source, fieldNames) {
  if (!source || typeof source !== "object") return undefined;
  for (var i = 0; i < fieldNames.length; i++) {
    var key = fieldNames[i];
    if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
  }
  return undefined;
}

// Приводит условие видимости метки scene360 к строке: пустое значение означает, что условия нет.
function normalizeStory360VisibleIf(value) {
  return String(value === undefined || value === null ? "" : value).trim();
}

// Старые списки переменных читаем как AND-условие, чтобы ручные/старые story360 продолжали работать предсказуемо.
function buildStory360VisibleIfFromLegacyVars(value) {
  if (value === undefined || value === null) return "";
  var items = Array.isArray(value) ? value : String(value).split(/[,\s]+/);
  var names = [];
  for (var i = 0; i < items.length; i++) {
    var name = String(items[i] || "").trim();
    if (name) names.push(name);
  }
  return names.join(" && ");
}

// Читает условие видимости метки из visibleIf или совместимых старых полей vars/variables/var.
function getStory360MarkVisibleIf(mark) {
  if (!mark || typeof mark !== "object") return "";
  var raw = readStory360Field(mark, ["visibleIf", "showIf", "condition"]);
  var explicit = normalizeStory360VisibleIf(raw);
  if (explicit) return explicit;

  var legacyVars = readStory360Field(mark, ["vars", "variables", "var"]);
  return normalizeStory360VisibleIf(buildStory360VisibleIfFromLegacyVars(legacyVars));
}

// Для visibleIf принимаем только true/false и числовые 1/0; остальные результаты считаются ложными.
function coerceStory360VisibleIfResult(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === "number" && isFinite(value)) {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return false;
}

// Вычисляет visibleIf без eval: если хотя бы одной переменной нет в vars, условие считается отсутствующим и метка показывается.
function shouldShowStory360MarkByVisibleIf(mark, vars, contextLabel) {
  var expression = getStory360MarkVisibleIf(mark);
  if (!expression) return true;

  var parsed = validateAndCollectSafeExpressionIdentifiers(expression);
  if (!parsed.ok) {
    console.warn("[story360] invalid visibleIf; mark hidden", {
      context: contextLabel || "",
      markId: mark && mark.id,
      error: parsed.error
    });
    return false;
  }

  var names = parsed.identifiers || [];
  for (var i = 0; i < names.length; i++) {
    var key = names[i];
    if (!vars || !Object.prototype.hasOwnProperty.call(vars, key)) {
      return true;
    }
  }

  try {
    return coerceStory360VisibleIfResult(evaluateSafeExpression(expression, vars || {}));
  } catch (e) {
    console.warn("[story360] visibleIf evaluation failed; mark hidden", {
      context: contextLabel || "",
      markId: mark && mark.id,
      error: e && e.message ? e.message : String(e)
    });
    return false;
  }
}

// Отбрасывает только те метки, для которых существующее и безопасное условие явно дало false/0.
function filterStory360VisibleMarks(marks, contextLabel) {
  if (!Array.isArray(marks)) return [];
  return marks.filter(function (mark) {
    return shouldShowStory360MarkByVisibleIf(mark, state && state.vars ? state.vars : {}, contextLabel);
  });
}

// Читает focus.* из entry или панорамы, если значение не задано плоским полем focusX/focusY/focusZ.
function readStory360FocusField(source, focusKey) {
  if (!source || typeof source !== "object") return undefined;
  var focus = source.focus;
  if (!focus || typeof focus !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(focus, focusKey)) return focus[focusKey];
  return undefined;
}

// Включает фокус-диагностику через ?Debug=360; старые флаг и query сохраняются для совместимости.
function story360DebugFocusLogEnabled() {
  if (typeof window === "undefined") return false;
  if (isExplicitDebugCategoryEnabled("360")) return true;
  if (window.STORY360_DEBUG_FOCUS === true) return true;
  try {
    var q = window.location && window.location.search;
    return typeof q === "string" && /(?:^|[?&])debug360focus=1(?:&|$)/.test(q);
  } catch (e) {
    return false;
  }
}

// Снимок полей фокуса объекта записи entries.* для отладки (без полного дампа панорамы).
function story360EntryFocusSnapshot(obj) {
  if (!obj || typeof obj !== "object") return null;
  return {
    focusX: readStory360Field(obj, ["focusX", "focusx", "x"]),
    focusY: readStory360Field(obj, ["focusY", "focusy", "y"]),
    hasFocusNested: !!(obj.focus && typeof obj.focus === "object")
  };
}

// Ключи entries и снимок focus по каждому ключу — для консоли.
function story360SummarizeEntriesForDebug(entries) {
  if (!entries || typeof entries !== "object") return { note: "объект записей отсутствует" };
  var keys = Object.keys(entries).sort();
  var slots = {};
  keys.forEach(function (k) {
    slots[k] = story360EntryFocusSnapshot(entries[k]);
  });
  return { keys: keys, slots: slots };
}

// Собирает настройки прихода на панораму назначения по ключу arrivalKey в panorama.entries.
//
// Приоритет для камеры (и прочих полей точки входа):
// 1) Запись entries[arrivalKey], если есть — её поля перекрывают базу (например приход с панорамы «175» → ключ "175", см. resolveGoto360EntryKey).
// 2) Иначе используется только сценарный базовый объект entries.default (в данных он часто назван ключом default — это не «режим по умолчанию» в смысле приоритета над источником, а просто общий слой).
//
// Имена entryPoints / focuses — допустимые синонимы объекта записей в JSON (как в других местах движка).
function getStory360Entry(panorama, arrivalKey) {
  if (!panorama || typeof panorama !== "object") return {};
  var entries = panorama.entries || panorama.entryPoints || panorama.focuses;
  var key = String(arrivalKey || "default").trim() || "default";

  var scenarioBaseline = {};
  if (entries && typeof entries === "object" && entries.default != null && typeof entries.default === "object") {
    scenarioBaseline = entries.default;
  }

  var out;
  if (!entries || typeof entries !== "object") {
    out = Object.assign({}, scenarioBaseline);
  } else {
    var arrivalOverlay = entries[key];
    if (arrivalOverlay != null && typeof arrivalOverlay === "object") {
      out = Object.assign({}, scenarioBaseline, arrivalOverlay);
    } else {
      out = Object.assign({}, scenarioBaseline);
    }
  }

  if (story360DebugFocusLogEnabled()) {
    console.info("[goto360-focus] getStory360Entry", {
      arrivalKey: key,
      entryObjectKeys: entries && typeof entries === "object" ? Object.keys(entries).sort() : [],
      hasBaselineDefault: !!(entries && entries.default && typeof entries.default === "object"),
      baselineFocus: story360EntryFocusSnapshot(scenarioBaseline),
      overlayKey: key,
      overlayPresent: !!(entries && entries[key] && typeof entries[key] === "object"),
      overlayFocus: entries && entries[key] ? story360EntryFocusSnapshot(entries[key]) : null,
      mergedFocus: story360EntryFocusSnapshot(out)
    });
  }

  return out;
}

// Возвращает ключ arrivalKey для getStory360Entry на панораме назначения.
//
// Важно: ключ default в команде goto360 и у метки — это имя записи «сценарный базис» (entries.default), а не автоматический выбор вместо фокуса по источнику.
//
// — Первый вход из линейного сценария (sourcePanoramaId пуст): ключ берётся из команды goto360 entry=... или from=<sceneId> (без них default — только baseline).
// — Переход меткой уже внутри goto360 (sourcePanoramaId задан — например «175»): если у метки не указано своё имя записи или указано имя default,
//   ключом прихода считается id панорамы источника ("175"), чтобы подтянуть entries["175"] поверх baseline. Так приоритет у фокуса «пришли с 175», если он задан в данных.
// — Если задано другое непустое имя (не default) — используется оно (именованная точка входа).
function resolveGoto360EntryKey(panorama, requestedEntryId, sourcePanoramaId) {
  var src = String(sourcePanoramaId || "").trim();
  var req =
    requestedEntryId !== null && requestedEntryId !== undefined ? String(requestedEntryId).trim() : "";

  var branchDescription = "";
  var resultKey = "";

  if (!src) {
    branchDescription =
      "первый_вход_из_сценария_или_apply без источника: ключ только из метки/команды (или default)";
    resultKey = req || "default";
  } else if (req === "" || req.toLowerCase() === "default") {
    branchDescription =
      "переход_меткой_внутри_goto360: у метки пустой entry или default → ключ = id панорамы откуда (источник)";
    resultKey = src;
  } else {
    branchDescription = "переход_меткой_внутри_goto360: у метки явное имя записи (не default)";
    resultKey = req || "default";
  }

  if (story360DebugFocusLogEnabled()) {
    console.info("[goto360-focus] resolveGoto360EntryKey", {
      branch: branchDescription,
      requestedEntryRaw: requestedEntryId,
      requestedTrimmed: req,
      sourcePanoramaId: src || "(пусто)",
      resolvedArrivalKey: resultKey
    });
  }

  return resultKey;
}

// Достаёт параметр камеры сначала из entry, потом из панорамы, затем нормализует его штатной функцией.
function readStory360CameraOption(entry, panorama, fieldNames, focusKey, normalizer, fallback) {
  var raw = readStory360Field(entry, fieldNames);
  if (raw === undefined) raw = readStory360FocusField(entry, focusKey);
  if (raw === undefined) raw = readStory360Field(panorama, fieldNames);
  if (raw === undefined) raw = readStory360FocusField(panorama, focusKey);
  return normalizer(raw, fallback);
}

// Переводит мировое направление «куда смотреть из центра сферы» в доли focusX/focusY BG360 (как updateBg360Camera).
// Нельзя использовать Object3D.lookAt на «пустышке»: у PerspectiveCamera вперёд — локальный −Z, а lookAt для обычного Object3D ориентирует +Z на цель — получался разворот на 180° по yaw относительно меток и реальной камеры.
function story360ViewDirectionToBgFocusFractions(dir) {
  if (!window.THREE || !dir) return null;
  if (dir.lengthSq() < 1e-12) return null;
  var targetDir = dir.clone();
  targetDir.normalize();
  var forwardCam = new window.THREE.Vector3(0, 0, -1);
  var q = new window.THREE.Quaternion().setFromUnitVectors(forwardCam, targetDir);
  var euler = new window.THREE.Euler().setFromQuaternion(q, "YXZ");
  var yawDeg = window.THREE.MathUtils.radToDeg(euler.y);
  var pitchDeg = clamp(window.THREE.MathUtils.radToDeg(euler.x), -85, 85);
  yawDeg = ((yawDeg % 360) + 360) % 360;
  return { focusX: yawDeg / 360, focusY: (pitchDeg + 85) / 170 };
}

// Переводит focus точки входа, сохранённый редактором как UV панорамы (entryFocusAsPanoramaUv), в доли yaw/pitch BG360.
function story360PanoramaUvEntryToBgFocusFractions(u, v) {
  if (!window.THREE) return null;
  var U = clamp(Number(u), 0, 1);
  var V = clamp(Number(v), 0, 1);
  var thetaPolar = (1 - V) * Math.PI;
  var phiAz = U * Math.PI * 2;
  var sinPolar = Math.sin(thetaPolar);
  var x0 = -Math.cos(phiAz) * sinPolar;
  var y0 = Math.cos(thetaPolar);
  var z0 = Math.sin(phiAz) * sinPolar;
  var dir = new window.THREE.Vector3(-x0, y0, z0);
  return story360ViewDirectionToBgFocusFractions(dir);
}

// Собирает scroll/focus/options для setBackground360 из выбранной точки входа.
function buildStory360MediaOptions(panorama, entry) {
  var rawFxEntry = readStory360Field(entry, ["focusX", "focusx", "x"]);
  var rawFyEntry = readStory360Field(entry, ["focusY", "focusy", "y"]);
  var rawFxPano = readStory360Field(panorama, ["focusX", "focusx", "x"]);
  var rawFyPano = readStory360Field(panorama, ["focusY", "focusy", "y"]);

  var focusX = readStory360CameraOption(entry, panorama, ["focusX", "focusx", "x"], "x", normalizeMediaFocus, null);
  var focusY = readStory360CameraOption(entry, panorama, ["focusY", "focusy", "y"], "y", normalizeMediaFocusY, null);
  var usedUvConversion = false;
  if (
    panorama &&
    panorama.entryFocusAsPanoramaUv === true &&
    focusX !== null &&
    focusX !== undefined &&
    focusY !== null &&
    focusY !== undefined
  ) {
    var convUv = story360PanoramaUvEntryToBgFocusFractions(focusX, focusY);
    if (convUv) {
      focusX = convUv.focusX;
      focusY = convUv.focusY;
      usedUvConversion = true;
    }
  }
  var focusZ = readStory360CameraOption(entry, panorama, ["focusZ", "focusz", "z"], "z", normalizeMediaFocusZ, null);
  var fov = readStory360CameraOption(entry, panorama, ["fov"], "fov", normalizeMediaFov, null);
  var scaleRaw = readStory360Field(entry, ["scale"]);
  if (scaleRaw === undefined) scaleRaw = readStory360Field(panorama, ["scale"]);
  var qualityRaw = readStory360Field(entry, ["quality"]);
  if (qualityRaw === undefined) qualityRaw = readStory360Field(panorama, ["quality"]);

  var options = {
    enabled: true,
    start: 0.5,
    focusX: focusX,
    focusY: focusY,
    scale: normalizeMediaScale(scaleRaw, 1),
    is360: true,
    focusZ: focusZ,
    fov: fov,
    quality: normalizeBg360Quality(qualityRaw, "auto"),
    panorama360Fallback: false
  };

  if (story360DebugFocusLogEnabled()) {
    console.info("[goto360-focus] buildStory360MediaOptions", {
      entryFocusAsPanoramaUv: !!(panorama && panorama.entryFocusAsPanoramaUv),
      usedUvConversion: usedUvConversion,
      rawFlatOnEntry: { focusX: rawFxEntry, focusY: rawFyEntry },
      rawFlatOnPanoramaFallback: { focusX: rawFxPano, focusY: rawFyPano },
      note:
        "Итоговые focusX/Y после readStory360CameraOption (entry затем panorama); UV-режим конвертирует в доли yaw/pitch.",
      resultFocusX: options.focusX,
      resultFocusY: options.focusY,
      resultFocusZ: options.focusZ,
      resultFov: options.fov
    });
  }

  return options;
}

// Перекрывает стартовые настройки entry сохранённым ракурсом: панорама берётся из story360, а камера остаётся как перед F5.
function applyStory360RestoreViewToMediaOptions(options, restoreView) {
  if (!options || !restoreView || typeof restoreView !== "object") return options;

  var fx = null;
  if (typeof restoreView.focusX === "number" && isFinite(restoreView.focusX)) {
    fx = clamp(restoreView.focusX, 0, 1);
  } else if (typeof restoreView.yawDeg === "number" && isFinite(restoreView.yawDeg)) {
    fx = normalizeBg360YawDegForAutosave(restoreView.yawDeg) / 360;
  }
  if (fx !== null) options.focusX = fx;

  var fy = null;
  if (typeof restoreView.focusY === "number" && isFinite(restoreView.focusY)) {
    fy = clamp(restoreView.focusY, 0, 1);
  } else if (typeof restoreView.pitchDeg === "number" && isFinite(restoreView.pitchDeg)) {
    fy = (clamp(restoreView.pitchDeg, -85, 85) + 85) / 170;
  }
  if (fy !== null) options.focusY = fy;

  if (typeof restoreView.fov === "number" && isFinite(restoreView.fov)) {
    options.fov = normalizeMediaFov(restoreView.fov, options.fov);
  }
  if (typeof restoreView.quality === "string" && restoreView.quality) {
    options.quality = normalizeBg360Quality(restoreView.quality, options.quality || "auto");
  }

  return options;
}

// Определяет файл/ассет панорамы: story360 может ссылаться на [bg] через bgId или хранить путь прямо у себя.
function getStory360PanoramaMedia(spaceId, panoramaId, panorama) {
  var bgId = String(readStory360Field(panorama, ["bgId", "bg", "backgroundId"]) || "").trim();
  var assetInfo = bgId ? resolveBackgroundAsset("@bg." + bgId) : null;
  var directFile = String(readStory360Field(panorama, ["file", "src", "path"]) || "").trim();
  var directFallback = String(readStory360Field(panorama, ["fallback", "poster"]) || "").trim();

  return {
    bgId: bgId || ("story360:" + String(spaceId || "") + "." + String(panoramaId || "")),
    file: directFile || (assetInfo && assetInfo.file ? assetInfo.file : ""),
    fallback: directFallback || (assetInfo && assetInfo.fallback ? assetInfo.fallback : ""),
    volume: assetInfo ? assetInfo.volume : null,
    assetInfo: assetInfo
  };
}

// Достаёт id точки входа у метки: null если поле отсутствует или пусто — тогда движок подставит панораму «откуда пришли».
function story360MarkEntryIdFromRaw(rawEntry) {
  if (rawEntry === undefined || rawEntry === null) return null;
  var s = String(rawEntry).trim();
  return s === "" ? null : s;
}

// Приводит target метки из story360 к единому виду: переход в другую панораму или выход в обычную сцену.
function normalizeStory360Target(mark, defaultSpaceId) {
  if (!mark || typeof mark !== "object") return null;

  var rawTarget = mark.target !== undefined ? mark.target : (mark.goto !== undefined ? mark.goto : mark.to);
  if (rawTarget === undefined || rawTarget === null || rawTarget === "") {
    var sceneRaw = readStory360Field(mark, ["targetScene", "scene", "storyScene"]);
    if (sceneRaw !== undefined && sceneRaw !== null && String(sceneRaw).trim() !== "") {
      return { type: "scene", sceneId: String(sceneRaw).trim() };
    }
    var panoRaw = readStory360Field(mark, ["targetPanorama", "panorama", "panoramaId"]);
    if (panoRaw !== undefined && panoRaw !== null && String(panoRaw).trim() !== "") {
      return {
        type: "360",
        spaceId: String(readStory360Field(mark, ["targetSpace", "space", "spaceId"]) || defaultSpaceId || "").trim(),
        panoramaId: String(panoRaw).trim(),
        entryId: story360MarkEntryIdFromRaw(readStory360Field(mark, ["entry", "targetEntry", "from"]))
      };
    }
    return null;
  }

  if (typeof rawTarget === "object" && rawTarget !== null) {
    var rawType = String(readStory360Field(rawTarget, ["type", "kind"]) || "360").trim().toLowerCase();
    if (rawType === "scene" || rawType === "story") {
      var targetScene = String(readStory360Field(rawTarget, ["scene", "sceneId", "id", "targetScene"]) || "").trim();
      return targetScene ? { type: "scene", sceneId: targetScene } : null;
    }
    if (rawType === "360") {
      var implicitTargetScene = String(readStory360Field(rawTarget, ["sceneId", "targetScene", "storyScene"]) || "").trim();
      var hasExplicitPanorama = readStory360Field(rawTarget, ["panorama", "panoramaId"]) !== undefined;
      if (implicitTargetScene && !hasExplicitPanorama) {
        // Старый/ручной формат без type: { sceneId: "..." } тоже является выходом в обычную сцену.
        return { type: "scene", sceneId: implicitTargetScene };
      }
    }
    var targetPanorama = String(readStory360Field(rawTarget, ["panorama", "panoramaId", "scene", "id"]) || "").trim();
    if (!targetPanorama) return null;
    return {
      type: "360",
      spaceId: String(readStory360Field(rawTarget, ["space", "spaceId"]) || defaultSpaceId || "").trim(),
      panoramaId: targetPanorama,
      entryId: story360MarkEntryIdFromRaw(readStory360Field(rawTarget, ["entry", "entryId", "from"]))
    };
  }

  var text = String(rawTarget || "").trim();
  if (!text) return null;
  if (/^(scene|story):/i.test(text)) {
    return { type: "scene", sceneId: text.replace(/^(scene|story):/i, "").trim() };
  }
  text = text.replace(/^360:/i, "").trim();
  var entryFromStr = null;
  var atIndex = text.indexOf("@");
  if (atIndex >= 0) {
    var tail = text.slice(atIndex + 1).trim();
    entryFromStr = tail === "" ? "default" : tail;
    text = text.slice(0, atIndex).trim();
  }
  var spaceId = String(defaultSpaceId || "").trim();
  var panoramaId = text;
  var dotIndex = text.indexOf(".");
  if (dotIndex > 0) {
    spaceId = text.slice(0, dotIndex).trim();
    panoramaId = text.slice(dotIndex + 1).trim();
  }
  return panoramaId ? { type: "360", spaceId: spaceId, panoramaId: panoramaId, entryId: entryFromStr } : null;
}

// Приводит тип 360-метки к поддержанным вариантам: walk рисует стрелку, text/view остаются экранными метками без WebGL-стрелок.
function normalizeBg360MarkKind(kind) {
  var value = String(kind || "walk").toLowerCase();
  if (value === "text" || value === "view" || value === "photo") return value;
  return "walk";
}

// Нормализует метки выбранной панорамы, отбрасывая неполные координаты.
function normalizeStory360Marks(spaceId, panorama) {
  var sourceMarks = panorama && (panorama.marks || panorama.hotspots || panorama.points);
  if (!Array.isArray(sourceMarks)) return [];
  var result = [];
  for (var i = 0; i < sourceMarks.length; i++) {
    var mark = sourceMarks[i] || {};
    var x = Number(readStory360Field(mark, ["x", "u"]));
    var y = Number(readStory360Field(mark, ["y", "v"]));
    if (!isFinite(x) || x < 0 || x > 1 || !isFinite(y) || y < 0 || y > 1) continue;
    var kind = normalizeBg360MarkKind(readStory360Field(mark, ["type", "kind"]) || "walk");
    result.push({
      id: String(mark.id || ("mark" + (result.length + 1))),
      x: x,
      y: y,
      kind: kind,
      label: String(readStory360Field(mark, ["label", "title", "name"]) || "").trim(),
      text: String(readStory360Field(mark, ["text"]) || "").trim(),
      images: normalizeBg360PhotoImages(mark),
      visibleIf: getStory360MarkVisibleIf(mark),
      target: normalizeStory360Target(mark, spaceId)
    });
  }
  return result;
}

// Итоговая длительность наезда: константа BG_360_GOTO_ZOOM_MS или переопределение window.VN_BG360_GOTO_ZOOM_MS (число ≥ 0).
// Тот же интервал задаёт продолжение наезда на hold после готовности текстуры (до конца easing).
function resolveBg360GotoZoomDurationMs() {
  if (typeof window !== "undefined" && typeof window.VN_BG360_GOTO_ZOOM_MS === "number" && isFinite(window.VN_BG360_GOTO_ZOOM_MS)) {
    return Math.max(0, window.VN_BG360_GOTO_ZOOM_MS);
  }
  return Math.max(0, BG_360_GOTO_ZOOM_MS);
}

// Длительность растворения hold (снимок старой сцены) поверх уже отрисованной новой: BG_360_NEW_SCENE_REVEAL_MS или window.VN_BG360_NEW_SCENE_REVEAL_MS.
function resolveBg360NewSceneRevealMs() {
  if (typeof window !== "undefined" && window.VN_BG360_NEW_SCENE_REVEAL_MS != null && window.VN_BG360_NEW_SCENE_REVEAL_MS !== "") {
    var w = Number(window.VN_BG360_NEW_SCENE_REVEAL_MS);
    if (isFinite(w)) return Math.max(0, w);
  }
  return Math.max(0, BG_360_NEW_SCENE_REVEAL_MS);
}

// Проверяет, что hold-изображение реально показывает снимок (атрибут src и свойство .src расходятся в части движков).
function bg360HoldLayerHasUsableSnapshot(holdEl) {
  if (!holdEl || holdEl.classList.contains("hidden")) return false;
  var fromAttr = holdEl.getAttribute("src");
  if (fromAttr && String(fromAttr).length > 0) return true;
  var fromProp = (holdEl.currentSrc || holdEl.src || "").trim();
  if (!fromProp || fromProp === window.location.href.split("#")[0]) return false;
  return fromProp.indexOf("data:") === 0 || fromProp.indexOf("blob:") === 0 || /^https?:/i.test(fromProp);
}

// Сбрасывает стили проявления: canvas (на случай прерванной анимации) и hold (z-index после растворения).
// ВАЖНО: эта функция вызывается в начале onLoadTexture ДО запуска новой reveal-анимации,
// поэтому она НЕ должна задавать transition у hold (иначе короткие 0.14s «съедают» наш длинный reveal до того,
// как успеют сработать RAF-колбэки). Транзишены назначаются точечно — в hideBg360HoldLayer и в ветке reveal.
function resetBg360CanvasRevealStyles() {
  if (bg360Runtime.revealFallbackTimer) {
    clearTimeout(bg360Runtime.revealFallbackTimer);
    bg360Runtime.revealFallbackTimer = null;
  }
  if (elBg360) {
    elBg360.style.zIndex = "";
    elBg360.style.opacity = "";
    elBg360.style.transition = "";
  }
  if (elBg360Hold) {
    elBg360Hold.style.zIndex = "3";
    elBg360Hold.style.pointerEvents = "none";
    elBg360Hold.style.transform = "";
    elBg360Hold.style.transformOrigin = "";
  }
  cancelGoto360HoldZoomRaf();
}

// Прерывает параллельный зум FOV при goto360 (когда текстура новой панорамы уже загружена).
function cancelGoto360ParallelZoomRaf() {
  if (bg360Runtime.goto360ZoomRafId) {
    cancelAnimationFrame(bg360Runtime.goto360ZoomRafId);
    bg360Runtime.goto360ZoomRafId = 0;
  }
}

// Прерывает донастройку масштаба hold после swap (см. runGoto360HoldZoomContinueAfterParallelSwap).
function cancelGoto360HoldZoomRaf() {
  if (bg360Runtime.goto360HoldZoomRafId) {
    cancelAnimationFrame(bg360Runtime.goto360HoldZoomRafId);
    bg360Runtime.goto360HoldZoomRafId = 0;
  }
}

// После загрузки текстуры: продолжает тот же наезд на снимке hold через scale, пока не догонит глобальный t=1 по easeOutCubic.
// holdEl — слой снимка; loadSeqExpected — поколение загрузки: при смене фона анимация гасится.
function runGoto360HoldZoomContinueAfterParallelSwap(holdEl, loadSeqExpected) {
  if (!holdEl) return;
  cancelGoto360HoldZoomRaf();
  var durationMs = bg360Runtime.goto360ParallelZoomAnimDurationMs;
  var animT0 = bg360Runtime.goto360ParallelZoomAnimT0;
  var startFov = bg360Runtime.goto360ParallelZoomStartFov;
  var targetFov = bg360Runtime.goto360ParallelZoomTargetFov;
  if (!(durationMs > 0) || !isFinite(startFov) || !isFinite(targetFov) || targetFov >= startFov - 0.01) return;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  var now0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  var tLoad = Math.min(1, Math.max(0, (now0 - animT0) / durationMs));
  if (tLoad >= 1) return;

  var fovAtLoad = startFov + (targetFov - startFov) * easeOutCubic(tLoad);
  if (!(fovAtLoad > 0.01)) return;

  holdEl.style.transformOrigin = "50% 50%";

  function tick(now) {
    if (!bg360Runtime.goto360HoldZoomRafId) return;
    if (loadSeqExpected !== bg360Runtime.loadSeq) {
      cancelGoto360HoldZoomRaf();
      return;
    }
    if (holdEl.classList.contains("hidden")) {
      cancelGoto360HoldZoomRaf();
      return;
    }
    var t = Math.min(1, Math.max(0, (now - animT0) / durationMs));
    var e = easeOutCubic(t);
    var fovInterp = startFov + (targetFov - startFov) * e;
    if (fovInterp < BG_360_FOV_MIN) fovInterp = BG_360_FOV_MIN;
    var scale = fovAtLoad / fovInterp;
    holdEl.style.transform = "scale(" + scale + ")";

    if (t < 1) {
      bg360Runtime.goto360HoldZoomRafId = requestAnimationFrame(tick);
    } else {
      bg360Runtime.goto360HoldZoomRafId = 0;
    }
  }

  bg360Runtime.goto360HoldZoomRafId = requestAnimationFrame(tick);
}

// Параллельно с загрузкой следующей панорамы: только сужает FOV (yaw/pitch без изменений). WebGL-часть прерывается при swap; визуальное продолжение — на hold (runGoto360HoldZoomContinueAfterParallelSwap).
function runGoto360ParallelFovZoomWhileLoading(mark) {
  if (!mark) return;

  var startFov = bg360Runtime.fovDeg;
  var targetFov = clamp(Math.min(startFov - 20, (startFov + BG_360_FOV_MIN) * 0.5), BG_360_FOV_MIN, BG_360_FOV_MAX);

  cancelGoto360ParallelZoomRaf();
  cancelGoto360HoldZoomRaf();
  if (bg360Runtime.frameId) {
    cancelAnimationFrame(bg360Runtime.frameId);
    bg360Runtime.frameId = 0;
  }

  var durationMs = resolveBg360GotoZoomDurationMs();
  var t0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  bg360Runtime.goto360ParallelZoomAnimT0 = t0;
  bg360Runtime.goto360ParallelZoomAnimDurationMs = durationMs;
  bg360Runtime.goto360ParallelZoomStartFov = startFov;
  bg360Runtime.goto360ParallelZoomTargetFov = targetFov;
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function tick(now) {
    if (!bg360Runtime.goto360ZoomRafId) return;
    var t = Math.min(1, (now - t0) / durationMs);
    var e = easeOutCubic(t);
    bg360Runtime.fovDeg = startFov + (targetFov - startFov) * e;
    updateBg360Camera();
    updateBg360NavBillboardMeshes();
    if (bg360Runtime.renderer && bg360Runtime.scene && bg360Runtime.camera) {
      bg360Runtime.renderer.render(bg360Runtime.scene, bg360Runtime.camera);
    }
    updateBg360NavArrowHitCache();
    updateBg360MarksProjection();
    updateBg360NavEdgeHints();

    if (t < 1) {
      bg360Runtime.goto360ZoomRafId = requestAnimationFrame(tick);
      return;
    }
    bg360Runtime.goto360ZoomRafId = 0;
    if (bg360Runtime.renderer && bg360Runtime.scene && bg360Runtime.camera) {
      bg360Runtime.renderer.render(bg360Runtime.scene, bg360Runtime.camera);
    }
  }

  bg360Runtime.goto360ZoomRafId = requestAnimationFrame(tick);
}

// Показывает панораму из story360 и включает кликабельные метки для внутренней навигации goto360.
// sourcePanoramaIdForEntryResolve — id панорамы «откуда» при переходе меткой (непусто только внутри goto360); смотри resolveGoto360EntryKey / getStory360Entry.
// markForZoomTransition — метка клика (walk): перед сменой фона выполняется короткий зум к ней и захват hold, чтобы не было чёрной вспышки и «отрыва» стрелок.
// restoreViewOverride — ракурс из автосейва; он перекрывает entry только при восстановлении текущей 360-сцены.
function applyGoto360Panorama(spaceId, panoramaId, entryId, sourcePanoramaIdForEntryResolve, markForZoomTransition, restoreViewOverride) {
  var panorama = getStory360Panorama(spaceId, panoramaId);
  if (!panorama) {
    console.warn("[goto360] panorama not found", { spaceId: spaceId, panoramaId: panoramaId });
    return false;
  }

  var resolvedEntryKey = resolveGoto360EntryKey(panorama, entryId, sourcePanoramaIdForEntryResolve);
  var entry = getStory360Entry(panorama, resolvedEntryKey);
  var media = getStory360PanoramaMedia(spaceId, panoramaId, panorama);
  if (!media.file) {
    console.warn("[goto360] panorama has no file/bgId", { spaceId: spaceId, panoramaId: panoramaId });
    return false;
  }

  var options = buildStory360MediaOptions(panorama, entry);
  if (restoreViewOverride) {
    options = applyStory360RestoreViewToMediaOptions(options, restoreViewOverride);
  }
  var marksNormalized = normalizeStory360Marks(spaceId, panorama);
  var marksVisible = filterStory360VisibleMarks(marksNormalized, "story360 " + String(spaceId || "") + "." + String(panoramaId || ""));

  function commitGoto360StateAndStartLoad(isParallelZoom) {
    state.currentBgId = media.bgId;

    goto360Runtime.spaceId = String(spaceId || "");
    goto360Runtime.panoramaId = String(panoramaId || "");
    goto360Runtime.entryId = String(resolvedEntryKey || "default") || "default";

    if (!isParallelZoom) {
      bg360MarksRuntime.bgId = state.currentBgId;
      bg360MarksRuntime.lines = readStory360Field(panorama, ["lines"]) !== false;
      bg360MarksRuntime.marks = marksVisible;
      bg360MarksRuntime.locked = false;
      bg360MarksRuntime.interactive = true;
    } else {
      bg360Runtime.pendingGoto360MarksPayload = {
        lines: readStory360Field(panorama, ["lines"]) !== false,
        marks: marksVisible
      };
    }

    if (story360DebugFocusLogEnabled()) {
      var entriesRoot = panorama.entries || panorama.entryPoints || panorama.focuses;
      console.groupCollapsed("[goto360-focus] applyGoto360Panorama → " + spaceId + "." + panoramaId);
      console.info("режим входа", {
        тип:
          String(sourcePanoramaIdForEntryResolve || "").trim() === ""
            ? "из_сценария_или_без_источника — ключ только из entryId переданного сюда"
            : "из_метки_внутри_goto360 — ключ обычно = id панорамы-источника «" +
              String(sourcePanoramaIdForEntryResolve).trim() +
              "» если у метки нет своего entry"
      });
      console.info("аргументы вызова", {
        rawEntryIdFromCaller: entryId,
        sourcePanoramaIdForEntryResolve: sourcePanoramaIdForEntryResolve || "(пусто)",
        resolvedArrivalKey: resolvedEntryKey,
        goto360RuntimeПослеСохранения: {
          spaceId: goto360Runtime.spaceId,
          panoramaId: goto360Runtime.panoramaId,
          entryId: goto360Runtime.entryId
        }
      });
      console.info("entries на панораме назначения", story360SummarizeEntriesForDebug(entriesRoot));
      console.info("итог камеры setBackground360", {
        focusX: options.focusX,
        focusY: options.focusY,
        focusZ: options.focusZ,
        fov: options.fov,
        entryFocusAsPanoramaUv: !!panorama.entryFocusAsPanoramaUv
      });
      console.info(
        "метки на новой панораме (id / uv / target / visibleIf)",
        marksVisible.map(function (m) {
          return {
            id: m.id,
            uv: [m.x, m.y],
            visibleIf: m.visibleIf || "",
            targetType: m.target ? m.target.type : null,
            targetPanorama: m.target && m.target.type === "360" ? m.target.panoramaId : null,
            targetEntryId: m.target && m.target.type === "360" ? m.target.entryId : null
          };
        })
      );
      console.groupEnd();
    }

    setBackground(media.file, media.fallback, media.volume, options);
  }

  var useZoomTransition =
    markForZoomTransition &&
    bg360IsDirectionalMark(markForZoomTransition) &&
    bg360Runtime.active &&
    bg360Runtime.mesh &&
    !bg360Runtime.isVideoSource &&
    ensureBg360Renderer();

  if (useZoomTransition) {
    bg360MarksRuntime.locked = true;
    bg360MarksRuntime.interactive = false;
    bg360Runtime.goto360ParallelZoomActive = true;
    runGoto360ParallelFovZoomWhileLoading(markForZoomTransition);
    commitGoto360StateAndStartLoad(true);
  } else {
    stripBg360NavigationOverlayPendingLoad();
    commitGoto360StateAndStartLoad(false);
  }

  return true;
}

// Нормализует photo-изображения через единый контракт контроллера меток и viewer.
function normalizeBg360PhotoImages(mark) {
  return panoramaMarksController.normalizePhotoImages(mark);
}

// Ищет метку по id внутри состояния, которым владеет отдельный контроллер.
function findBg360MarkById(markId) {
  return panoramaMarksController.findMarkById(markId);
}

// Делегирует открытие photo-метки специализированному viewer-контроллеру.
function openBg360PhotoViewer(mark) {
  return panoramaPhotoViewerController.open(mark);
}

// Делегирует закрытие viewer без завершения активной команды walk360/goto360.
function closeBg360PhotoViewer(reason) {
  return panoramaPhotoViewerController.close(reason);
}

// Проверяет навигационный тип метки через контроллер общей 360-графики.
function bg360IsDirectionalMark(mark) {
  return panoramaMarksController.isDirectionalMark(mark);
}

// Передаёт выбор DOM/WebGL/SVG-метки единой точке активации контроллера.
function activateBg360MarkById(markId, event) {
  return panoramaMarksController.activateMarkById(markId, event);
}

// Перестраивает DOM/SVG-слой по актуальному состоянию меток.
function renderBg360Marks() {
  panoramaMarksController.render();
}

// Обновляет экранные координаты DOM-меток после изменения камеры.
function updateBg360MarksProjection() {
  panoramaMarksController.updateProjection();
}

// Создаёт или обновляет нижнюю WebGL-заглушку для навигационной сцены.
function syncBg360OriginCoverMesh() {
  panoramaMarksController.syncOriginCover();
}

// Освобождает геометрию и материалы нижней WebGL-заглушки.
function disposeBg360OriginCoverMesh() {
  panoramaMarksController.disposeOriginCover();
}

// Поворачивает SVG-компас синхронно с yaw панорамной камеры.
function updateBg360CompassRotation() {
  panoramaMarksController.updateCompassRotation();
}

// Пересчитывает боковые указатели скрытых за границей навигационных целей.
function updateBg360NavEdgeHints() {
  panoramaMarksController.updateEdgeHints();
}

// Обновляет экранный hit-test WebGL-стрелок после рендера камеры.
function updateBg360NavArrowHitCache() {
  panoramaMarksController.updateArrowHitCache();
}

// Возвращает id WebGL-стрелки под экранной координатой или пустое значение.
function pickBg360NavArrowMarkId(clientX, clientY) {
  return panoramaMarksController.pickArrowMarkId(clientX, clientY);
}

// Перестраивает billboard-геометрию стрелок относительно текущей камеры.
function updateBg360NavBillboardMeshes() {
  panoramaMarksController.updateBillboardMeshes();
}

// Удаляет группу WebGL-стрелок и освобождает принадлежащие ей ресурсы.
function disposeBg360NavArrowsGroup() {
  panoramaMarksController.disposeNavArrows();
}

// Скрывает старую навигацию до готовности текстуры следующей панорамы.
function stripBg360NavigationOverlayPendingLoad() {
  panoramaMarksController.stripPendingLoad();
}

// Проверяет, нужно ли отложить метки до применения новой texture к сфере.
function bg360ShouldDeferMarksUntilTextureReady() {
  return panoramaMarksController.shouldDeferUntilTextureReady();
}

// Запускает walk360: показывает панель, включает hit-test меток и блокирует обычный next.
function startWalk360(action) {
  var bgId = action && action.bgId ? String(action.bgId) : "";
  var resultVar = action && action.result ? String(action.result) : "";
  var titleText = action && action.text ? String(action.text) : "";
  var buttonText = action && action.button ? String(action.button) : "";

  // Если фон не совпадает — это ошибка сценария, но продолжаем с пустым результатом.
  if (!bgId || state.currentBgId !== bgId) {
    console.warn("[walk360] background mismatch", { requested: bgId, current: state.currentBgId });
    if (resultVar) state.vars[resultVar] = "";
    return false;
  }

  if (resultVar) {
    // Новое ожидание не должно наследовать выбор из предыдущей 360-точки или из старого автосейва.
    state.vars[resultVar] = "";
  }

  walk360Runtime.active = true;
  walk360Runtime.bgId = bgId;
  walk360Runtime.resultVar = resultVar;
  walk360Runtime.done = false;

  // Включаем интерактивность меток только во время walk360.
  bg360MarksRuntime.interactive = true;
  bg360MarksRuntime.locked = false;
  renderBg360Marks();

  showWalk360Panel(titleText, buttonText);

  // Это ожидание управляется внутренними событиями (метка/кнопка), а не onNext.
  return "async";
}

// Обрабатывает выбор метки: фиксируем result, выключаем hit-test и продолжаем сценарий.
function onWalk360SelectMark(markId) {
  var id = String(markId || "");
  if (!walk360Runtime.active) return;
  if (walk360Runtime.done) return;
  var selectedMark = null;
  if (Array.isArray(bg360MarksRuntime.marks)) {
    for (var i = 0; i < bg360MarksRuntime.marks.length; i++) {
      var mark = bg360MarksRuntime.marks[i];
      if (mark && String(mark.id || "") === id) {
        selectedMark = mark;
        break;
      }
    }
  }

  if (walk360Runtime.resultVar) {
    state.vars[walk360Runtime.resultVar] = id;
  }

  // После выбора метки сразу скрываем все метки: интерактив уже завершён.
  bg360MarksRuntime.locked = true;
  bg360MarksRuntime.interactive = false;
  bg360MarksRuntime.marks = [];
  renderBg360Marks();

  // Если на метке задан targetScene, завершаем wait и сразу переводим игрока в нужную сцену.
  finishWalk360(id, selectedMark && selectedMark.targetScene ? String(selectedMark.targetScene) : "");
}

// Завершает walk360 (и по метке, и по кнопке выхода).
function finishWalk360(selectedId, targetScene) {
  if (!walk360Runtime.active) return;
  if (walk360Runtime.done) return;
  walk360Runtime.done = true;

  hideWalk360Panel();

  // Сбрасываем флаги ожидания, чтобы продолжить выполнение.
  state.inGame = false;
  state.inVideo = false;
  state.waitingNext = false;
  state.nextLocked = false;

  walk360Runtime.active = false;
  walk360Runtime.bgId = null;
  walk360Runtime.resultVar = "";
  clearActive360ActionForAutosave("walk360");
  var target = String(targetScene || "").trim();
  if (target) {
    if (state.sceneMap && state.sceneMap[target]) {
      writeRuntimeVerbose("[walk360] targetScene jump ->", target, "(goto + runCurrent)");
      gotoScene(target);
      // gotoScene только меняет состояние, а этот путь вызван из UI-события walk360.
      // Поэтому явно запускаем обработку новой сцены, иначе переход "зависнет" на actionIndex=0.
      runCurrent();
      return;
    }
    // Не роняем движок: если сцена не найдена, продолжаем обычный поток и пишем предупреждение.
    console.warn("[walk360] targetScene not found", { selectedId: selectedId, targetScene: target });
  }
  runCurrent();
}

// Берёт сохранённую story360-панораму ровно для ближайшего goto360; если данные устарели, даём сценарию стартовать обычно.
function consumeStory360RestorePendingForGoto(action) {
  var restore = vnAutosaveStory360RestorePending;
  vnAutosaveStory360RestorePending = null;

  if (!restore) return null;
  if (!action || action.type !== "goto360") return null;

  if (!getStory360Panorama(restore.spaceId, restore.panoramaId)) {
    console.warn("[goto360] autosave panorama not found, fallback to action start", {
      spaceId: restore.spaceId,
      panoramaId: restore.panoramaId
    });
    return null;
  }

  return restore;
}

// Запускает навигацию по 360-пространству из story360.js.
function startGoto360(action) {
  var spaceId = action && action.spaceId ? String(action.spaceId).trim() : "";
  var panoramaId = action && action.panoramaId ? String(action.panoramaId).trim() : "";
  var entryId = action && action.entry ? String(action.entry).trim() : "default";
  var resultVar = action && action.result ? String(action.result).trim() : "";
  var titleText = action && action.text ? String(action.text) : "";
  var buttonText = action && action.button ? String(action.button) : "";
  // После автосейва ближайший goto360 возобновляется из сохранённой панорамы и ракурса, а не из стартовых параметров команды.
  var restore360 = consumeStory360RestorePendingForGoto(action);

  if (resultVar && !restore360) {
    // Новый вход в 360-пространство не должен наследовать прежнюю выбранную метку.
    state.vars[resultVar] = "";
  }

  if (!getStory360Root()) {
    console.warn("[goto360] story360.js is not loaded");
    return false;
  }

  goto360Runtime.active = true;
  goto360Runtime.spaceId = restore360 ? restore360.spaceId : spaceId;
  goto360Runtime.panoramaId = restore360 ? restore360.panoramaId : panoramaId;
  goto360Runtime.entryId = restore360 ? (restore360.entryId || "default") : (entryId || "default");
  goto360Runtime.resultVar = resultVar;
  goto360Runtime.done = false;
  goto360Runtime.titleText = titleText;
  goto360Runtime.buttonText = buttonText;

  if (story360DebugFocusLogEnabled()) {
    console.groupCollapsed("[goto360-focus] startGoto360 — вход из линейной сцены (не из другой панорамы 360)");
    console.info("сколько передано в applyGoto360Panorama", {
      spaceId: spaceId,
      panoramaId: panoramaId,
      entryIdИзДействияСценария: entryId || "default",
      sourcePanoramaIdForApply: "(пустая строка — движок не знает story360-панораму «откуда», только сценарий)"
    });
    console.info(
      "почему фокус может отличаться от перехода меткой",
      "При клике метки с панорамы A передаётся sourcePanoramaId=A → ключ часто становится «A» и читается entries[A]. " +
        "При первом goto360 из сценария источника нет → ключ только из команды (часто default = записи entries.default). " +
        "Чтобы из сцены открыть отдельный сценарный фокус, создайте в story360 entries[sceneId] и укажите goto360 параметр from=sceneId. " +
        "Для совместимости с фокусом прихода с панорамы можно использовать entry=175 или from360=175."
    );
    console.groupEnd();
  }

  var applyOk = applyGoto360Panorama(
    goto360Runtime.spaceId,
    goto360Runtime.panoramaId,
    goto360Runtime.entryId,
    "",
    null,
    restore360 ? restore360.view : null
  );
  if (!applyOk && restore360) {
    console.warn("[goto360] autosave restore failed, fallback to action start", restore360);
    if (resultVar) state.vars[resultVar] = "";
    goto360Runtime.spaceId = spaceId;
    goto360Runtime.panoramaId = panoramaId;
    goto360Runtime.entryId = entryId || "default";
    applyOk = applyGoto360Panorama(spaceId, panoramaId, goto360Runtime.entryId, "");
  }
  if (!applyOk) {
    goto360Runtime.active = false;
    goto360Runtime.done = false;
    return false;
  }

  showWalk360Panel(titleText, buttonText, function () {
    if (!goto360Runtime.active) return;
    if (goto360Runtime.resultVar) state.vars[goto360Runtime.resultVar] = "";
    bg360MarksRuntime.locked = true;
    bg360MarksRuntime.interactive = false;
    bg360MarksRuntime.marks = [];
    renderBg360Marks();
    finishGoto360("");
  });
  return "async";
}

// Обрабатывает выбор метки внутри goto360: либо меняет панораму, либо выходит в обычную сцену.
function onGoto360SelectMark(markId) {
  var id = String(markId || "");
  if (!goto360Runtime.active || goto360Runtime.done) return;

  var selectedMark = null;
  if (Array.isArray(bg360MarksRuntime.marks)) {
    for (var i = 0; i < bg360MarksRuntime.marks.length; i++) {
      var mark = bg360MarksRuntime.marks[i];
      if (mark && String(mark.id || "") === id) {
        selectedMark = mark;
        break;
      }
    }
  }

  if (goto360Runtime.resultVar) {
    state.vars[goto360Runtime.resultVar] = id;
  }

  var target = selectedMark && selectedMark.target ? selectedMark.target : null;

  if (story360DebugFocusLogEnabled()) {
    var allMarkSummaries = Array.isArray(bg360MarksRuntime.marks)
      ? bg360MarksRuntime.marks.map(function (m, idx) {
          return {
            index: idx,
            id: m && m.id,
            uv: m ? [m.x, m.y] : null,
            targetPanorama: m && m.target && m.target.type === "360" ? m.target.panoramaId : null
          };
        })
      : [];
    console.groupCollapsed("[goto360-focus] onGoto360SelectMark — клик по метке id=" + id);
    console.info("текущая панорама до перехода (станет source для resolve)", {
      goto360RuntimePanoramaId: goto360Runtime.panoramaId,
      goto360RuntimeSpaceId: goto360Runtime.spaceId,
      clickedMarkId: id,
      найденаВыбраннаяМетка: !!selectedMark,
      всегоМетокНаЭкране: allMarkSummaries.length,
      сводкаМетокПоId: allMarkSummaries
    });
    if (!selectedMark) {
      console.warn(
        "метка не найдена по id среди bg360MarksRuntime.marks — проверьте совпадение dataset.markId и mark.id в DOM."
      );
    } else if (target && target.type === "360") {
      console.info("цель перехода (передаётся в applyGoto360Panorama)", {
        nextSpace: target.spaceId || goto360Runtime.spaceId,
        nextPanoramaId: target.panoramaId,
        targetEntryIdУМетки: target.entryId,
        sourcePanoramaIdБудет: goto360Runtime.panoramaId,
        note:
          "Если target.entryId null или default → resolve вернёт ключ = sourcePanoramaId (панорама «откуда»). Иначе — явное имя записи."
      });
    } else {
      console.info("цель не 360 (или нет target)", { target: target });
    }
    console.groupEnd();
  }

  if (target && target.type === "360") {
    var nextSpace = target.spaceId || goto360Runtime.spaceId;
    var sourcePanoramaId = goto360Runtime.panoramaId;
    var nextEntry = target.entryId;
    if (applyGoto360Panorama(nextSpace, target.panoramaId, nextEntry, sourcePanoramaId, selectedMark)) {
      return;
    }
    console.warn("[goto360] target panorama not found", target);
    return;
  }

  bg360MarksRuntime.locked = true;
  bg360MarksRuntime.interactive = false;
  bg360MarksRuntime.marks = [];
  renderBg360Marks();

  finishGoto360(target && target.type === "scene" ? target.sceneId : "");
}

// Завершает goto360 и либо возвращает выполнение к следующей строке, либо переводит в обычную сцену.
function finishGoto360(targetScene) {
  if (!goto360Runtime.active) return;
  if (goto360Runtime.done) return;
  goto360Runtime.done = true;

  hideWalk360Panel();
  state.inGame = false;
  state.inVideo = false;
  state.waitingNext = false;
  state.nextLocked = false;

  goto360Runtime.active = false;
  goto360Runtime.spaceId = "";
  goto360Runtime.panoramaId = "";
  goto360Runtime.entryId = "default";
  goto360Runtime.resultVar = "";
  goto360Runtime.titleText = "";
  goto360Runtime.buttonText = "";
  clearActive360ActionForAutosave("goto360");

  var target = String(targetScene || "").trim();
  if (target) {
    if (state.sceneMap && state.sceneMap[target]) {
      gotoScene(target);
      runCurrent();
      return;
    }
    console.warn("[goto360] target scene not found", target);
  }

  runCurrent();
}

// Показывает панель 360-ожидания в контейнере choices (чтобы onNext автоматически блокировался).
function showWalk360Panel(titleText, buttonText, exitHandler) {
  if (!elChoices) return;

  var renderedTitle = renderTextVars(String(titleText || "")).trim();
  var renderedButton = renderTextVars(String(buttonText || "")).trim();
  var hasPanelContent = renderedTitle !== "" || renderedButton !== "";

  clearFitChoiceLayout();
  elChoices.innerHTML = "";
  hideDialogForWalk360();

  // Если сценарий не задал ни текст, ни кнопку, оставляем только 360-метки без нижней панели.
  if (!hasPanelContent) {
    elChoices.classList.add("hidden");
    return;
  }

  elChoices.classList.remove("hidden");

  var panel = document.createElement("div");
  panel.className = "choicePanel walk360Panel";

  if (renderedTitle !== "") {
    var title = document.createElement("div");
    title.className = "choiceTitle walk360Title";
    title.textContent = renderedTitle;
    panel.appendChild(title);
  }

  if (renderedButton !== "") {
    var list = document.createElement("div");
    list.className = "choiceList";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choiceBtn walk360ExitBtn";
    btn.textContent = renderedButton;

    btn.addEventListener("click", function (e) {
      if (e && typeof e.stopPropagation === "function") e.stopPropagation();
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      if (typeof exitHandler === "function") {
        exitHandler();
        return;
      }
      if (!walk360Runtime.active) return;
      if (walk360Runtime.resultVar) state.vars[walk360Runtime.resultVar] = "";
      // После выхода метки тоже скрываем, чтобы не оставлять «пустой» UI.
      bg360MarksRuntime.locked = true;
      bg360MarksRuntime.interactive = false;
      bg360MarksRuntime.marks = [];
      renderBg360Marks();
      finishWalk360("");
    });

    list.appendChild(btn);
    panel.appendChild(list);
  }

  elChoices.appendChild(panel);
}

function hideWalk360Panel() {
  if (!elChoices) return;
  // Не трогаем showChoices() напрямую; walk360 использует тот же контейнер, поэтому чистим полностью.
  elDialog.classList.remove("hiddenByChoices");
  elChoices.classList.add("hidden");
  elChoices.innerHTML = "";
}

function executeIfSafe(action) {
  // Поддержка безопасного if без eval:
  // { type:"if", key:"quizScore", op:">=", value:2, then:"good", else:"bad" }
  var key = action.key;
  var op = action.op;
  var expected = action.value;

  var actual = state.vars[key];

  var ok = compare(actual, op, expected);

  if (ok && action.then) gotoScene(action.then);
  if (!ok && action.else) gotoScene(action.else);

  return false;
}

function executeIfBlock(action) {
  // if_block использует тот же безопасный evaluator, чтобы ветки не могли исполнять JS-код.
  // Ветку ставим в pendingActions (а не splice в scene.actions): иначе при каждом повторном
  // входе в сцену накапливаются старые вставки, и следующий за новым bg шаг снова ставит первый фон.
  if (!action || !Array.isArray(action.branches)) return false;

  var selectedActions = null;

  for (var i = 0; i < action.branches.length; i++) {
    var branch = action.branches[i];
    if (!branch || !branch.condition) continue;

    try {
      var ok = !!evaluateSafeExpression(branch.condition, state.vars);
      if (ok) {
        selectedActions = Array.isArray(branch.actions) ? branch.actions : [];
        break;
      }
    } catch (e) {
      console.error("[VN] if_block error в сцене", state.sceneId, state.actionIndex - 1, e && e.message ? e.message : e);
      return false;
    }
  }

  if (!selectedActions) {
    selectedActions = Array.isArray(action.elseActions) ? action.elseActions : [];
  }

  if (selectedActions.length === 0) return false;

  var clone = JSON.parse(JSON.stringify(selectedActions));
  if (!Array.isArray(state.pendingActions)) {
    state.pendingActions = [];
  }
  state.pendingActions = clone.concat(state.pendingActions);
  return false;
}

function compare(a, op, b) {
  // приводим числа, если похоже на числа
  var an = toNumberMaybe(a);
  var bn = toNumberMaybe(b);
  var useNum = (an !== null && bn !== null);

  if (useNum) {
    a = an; b = bn;
  }

  switch (op) {
    case "==": return a == b; // eslint-disable-line eqeqeq
    case "===": return a === b;
    case "!=": return a != b; // eslint-disable-line eqeqeq
    case "!==": return a !== b;
    case ">": return a > b;
    case ">=": return a >= b;
    case "<": return a < b;
    case "<=": return a <= b;
    default: return false;
  }
}

function toNumberMaybe(x) {
  if (typeof x === "number") return x;
  if (typeof x === "string" && x.trim() !== "" && !isNaN(Number(x))) return Number(x);
  return null;
}

// =========================================================
//                   СЦЕНЫ / ПЕРЕХОДЫ
// =========================================================

function buildSceneMap() {
  state.sceneMap = {};
  var scenes = STORY.scenes || [];
  for (var i = 0; i < scenes.length; i++) {
    var sc = scenes[i];
    if (sc && sc.id) state.sceneMap[sc.id] = sc;
  }
}

function gotoScene(sceneId) {
  if (!sceneId) return;

  writeRuntimeDebug("[VN DEBUG] Переход сцены", state.sceneId, "->", sceneId);
  
  // Отменяем ожидающую загрузку до смены sceneId, чтобы её callback не продолжил старую сцену.
  characterController.cancel("gotoScene");
  visualTransitionController.cancel();

  state.sceneId = sceneId;
  currentSceneId = sceneId;
  state.actionIndex = 0;
  state.waitingNext = false;
  state.nextLocked = false;  // ← ВАЖНО!
  
  // В функции gotoScene, после установки state.sceneId:
  currentSceneId = sceneId;

  // Скрываем персонажа по умолчанию при смене сцены
  characterController.hide("gotoScene reset");

}


// =========================================================
//                   ВИЗУАЛ
// =========================================================

// Преобразует focusZ 0..1 в FOV: меньший FOV визуально приближает картинку внутри 360-сферы.
// Если focusZ в данных не задан (null), подставляется 0 — максимальный FOV (BG_360_FOV_MAX), т.е. максимальное отдаление.
function mapFocusZToFov(focusZ) {
  var z = normalizeMediaFocusZ(focusZ, 0);
  return BG_360_FOV_MAX - (BG_360_FOV_MAX - BG_360_FOV_MIN) * z;
}

// Проверяет, доступен ли WebGL-рендер для 360-фона.
function canUseBg360Renderer() {
  if (!window.THREE) return false;
  if (!elBg360) return false;
  try {
    var testCanvas = document.createElement("canvas");
    return !!(testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl"));
  } catch (e) {
    return false;
  }
}

// Создаёт renderer/camera/scene для 360 и переиспользует их между сменами фона.
function ensureBg360Renderer() {
  if (!canUseBg360Renderer()) return false;
  if (bg360Runtime.renderer) return true;

  var renderer = new window.THREE.WebGLRenderer({
    canvas: elBg360,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    // Без preserveDrawingBuffer вызов canvas.toDataURL() после композитинга возвращает пустой буфер —
    // и hold-снимок старой 360-сцены оказывается прозрачным (визуально перехода нет).
    preserveDrawingBuffer: true
  });
  // Прозрачный clear, чтобы при необходимости полупрозрачный canvas не «подмешивал» чёрный к слою под ним.
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(Math.max(1, elNovelWindow.clientWidth), Math.max(1, elNovelWindow.clientHeight), false);

  var scene = new window.THREE.Scene();
  var camera = new window.THREE.PerspectiveCamera(70, 1, 0.1, 1100);

  bg360Runtime.renderer = renderer;
  bg360Runtime.scene = scene;
  bg360Runtime.camera = camera;
  return true;
}

// Обновляет размер WebGL-буфера под текущее окно новеллы.
function resizeBg360Renderer() {
  if (!bg360Runtime.renderer || !bg360Runtime.camera || !elNovelWindow) return;
  var width = Math.max(1, elNovelWindow.clientWidth);
  var height = Math.max(1, elNovelWindow.clientHeight);
  bg360Runtime.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  bg360Runtime.renderer.setSize(width, height, false);
  bg360Runtime.camera.aspect = width / height;
  bg360Runtime.camera.updateProjectionMatrix();
  syncBg360OriginCoverMesh();
}

// Применяет yaw/pitch/fov к камере и кадрирует 360-сферу.
function updateBg360Camera() {
  if (!bg360Runtime.camera) return;
  bg360Runtime.pitchDeg = clamp(bg360Runtime.pitchDeg, -85, 85);
  bg360Runtime.fovDeg = clamp(bg360Runtime.fovDeg, BG_360_FOV_MIN, BG_360_FOV_MAX);
  bg360Runtime.camera.fov = bg360Runtime.fovDeg;
  bg360Runtime.camera.updateProjectionMatrix();
  bg360Runtime.camera.rotation.order = "YXZ";
  bg360Runtime.camera.rotation.y = window.THREE.MathUtils.degToRad(bg360Runtime.yawDeg || 0);
  bg360Runtime.camera.rotation.x = window.THREE.MathUtils.degToRad(bg360Runtime.pitchDeg || 0);
}

// Возвращает число активных указателей на canvas для распознавания drag/pinch.
function getBg360PointerCount() {
  return Object.keys(bg360Runtime.pointers).length;
}

// Считает дистанцию между двумя указателями, чтобы реализовать pinch-zoom.
function getBg360PinchDistance() {
  var keys = Object.keys(bg360Runtime.pointers);
  if (keys.length < 2) return null;
  var a = bg360Runtime.pointers[keys[0]];
  var b = bg360Runtime.pointers[keys[1]];
  var dx = a.x - b.x;
  var dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

var bg360DragLocalRayScratch = null;
var bg360DragWorldRayScratch = null;

// Возвращает локальный луч камеры из экранной точки canvas; так drag зависит от FOV и размера окна, а не от фиксированного коэффициента.
function getBg360LocalRayFromClientPoint(clientX, clientY) {
  if (!window.THREE || !elBg360 || !bg360Runtime.camera) return null;
  var rect = elBg360.getBoundingClientRect();
  var width = rect.width || elBg360.clientWidth || 0;
  var height = rect.height || elBg360.clientHeight || 0;
  if (!(width > 0) || !(height > 0)) return null;

  var ndcX = ((clientX - rect.left) / width) * 2 - 1;
  var ndcY = 1 - ((clientY - rect.top) / height) * 2;
  var fovDeg = typeof bg360Runtime.fovDeg === "number" && isFinite(bg360Runtime.fovDeg)
    ? bg360Runtime.fovDeg
    : bg360Runtime.camera.fov;
  var fovRad = window.THREE.MathUtils.degToRad(clamp(fovDeg || 70, BG_360_FOV_MIN, BG_360_FOV_MAX));
  var tanHalfFov = Math.tan(fovRad / 2);
  var aspect = bg360Runtime.camera.aspect || (width / height) || 1;

  if (!bg360DragLocalRayScratch) bg360DragLocalRayScratch = new window.THREE.Vector3();
  return bg360DragLocalRayScratch.set(ndcX * tanHalfFov * aspect, ndcY * tanHalfFov, -1).normalize();
}

// Запоминает направление точки панорамы под указателем в мировых координатах, чтобы следующий шаг drag держал её под курсором.
function getBg360WorldRayFromClientPoint(clientX, clientY) {
  var localRay = getBg360LocalRayFromClientPoint(clientX, clientY);
  if (!localRay || !bg360Runtime.camera) return null;

  if (!bg360DragWorldRayScratch) bg360DragWorldRayScratch = new window.THREE.Vector3();
  bg360Runtime.camera.updateMatrixWorld(true);
  return bg360DragWorldRayScratch.copy(localRay).applyQuaternion(bg360Runtime.camera.quaternion).normalize();
}

// Подбирает ближайший эквивалент угла к текущему, чтобы yaw/pitch не прыгали при переходе через ±180°.
function normalizeBg360AngleRadNear(angleRad, referenceRad) {
  var fullTurn = Math.PI * 2;
  while (angleRad - referenceRad > Math.PI) angleRad -= fullTurn;
  while (angleRad - referenceRad < -Math.PI) angleRad += fullTurn;
  return angleRad;
}

// Пересчитывает yaw/pitch так, чтобы точка панорамы из предыдущей позиции указателя оказалась под новой позицией указателя.
function applyBg360ProjectedDrag(prevClientX, prevClientY, nextClientX, nextClientY) {
  if (!window.THREE || !bg360Runtime.camera) return false;
  var anchorDir = getBg360WorldRayFromClientPoint(prevClientX, prevClientY);
  if (!anchorDir) return false;
  var localRay = getBg360LocalRayFromClientPoint(nextClientX, nextClientY);
  if (!localRay) return false;

  var currentPitchRad = window.THREE.MathUtils.degToRad(bg360Runtime.pitchDeg || 0);
  var currentYawRad = window.THREE.MathUtils.degToRad(bg360Runtime.yawDeg || 0);
  var localPitchPlane = Math.sqrt(localRay.y * localRay.y + localRay.z * localRay.z);
  if (!(localPitchPlane > 1e-6)) return false;

  var pitchBase = Math.atan2(localRay.z, localRay.y);
  var pitchCosArg = clamp(anchorDir.y / localPitchPlane, -1, 1);
  var pitchOffset = Math.acos(pitchCosArg);
  var pitchA = normalizeBg360AngleRadNear(pitchOffset - pitchBase, currentPitchRad);
  var pitchB = normalizeBg360AngleRadNear(-pitchOffset - pitchBase, currentPitchRad);
  var pitchRad = Math.abs(pitchA - currentPitchRad) <= Math.abs(pitchB - currentPitchRad) ? pitchA : pitchB;
  pitchRad = window.THREE.MathUtils.degToRad(clamp(window.THREE.MathUtils.radToDeg(pitchRad), -85, 85));

  var sinPitch = Math.sin(pitchRad);
  var cosPitch = Math.cos(pitchRad);
  var pitchedX = localRay.x;
  var pitchedZ = sinPitch * localRay.y + cosPitch * localRay.z;
  var yawPlane = pitchedX * pitchedX + pitchedZ * pitchedZ;
  if (!(yawPlane > 1e-8)) return false;

  var yawCos = (anchorDir.x * pitchedX + anchorDir.z * pitchedZ) / yawPlane;
  var yawSin = (anchorDir.x * pitchedZ - anchorDir.z * pitchedX) / yawPlane;
  var yawRad = normalizeBg360AngleRadNear(Math.atan2(yawSin, yawCos), currentYawRad);

  bg360Runtime.yawDeg = window.THREE.MathUtils.radToDeg(yawRad);
  bg360Runtime.pitchDeg = clamp(window.THREE.MathUtils.radToDeg(pitchRad), -85, 85);
  return true;
}

// Обрабатывает pointerdown для 360: старт drag и фиксация двух пальцев для pinch.
function handleBg360PointerDown(e) {
  if (!bg360Runtime.active || !elBg360) return;
  if (!bg360Runtime.interactive) return;
  if (elBg360) elBg360.classList.remove("is-nav-arrow-hover");
  bg360Runtime.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  if (getBg360PointerCount() === 1) {
    bg360Runtime.dragPointerId = e.pointerId;
    bg360Runtime.dragLastX = e.clientX;
    bg360Runtime.dragLastY = e.clientY;
    bg360Runtime.pointerTravelSum = 0;
  } else if (getBg360PointerCount() >= 2) {
    bg360Runtime.pinchDistance = getBg360PinchDistance();
    bg360Runtime.dragPointerId = null;
  }
  if (elBg360.setPointerCapture) {
    try { elBg360.setPointerCapture(e.pointerId); } catch (err) {
      // Pointer capture необязателен: обзор продолжает отслеживаться по pointerId.
    }
  }
  updateBg360CursorClasses();
  e.preventDefault();
}

// Обрабатывает pointermove для 360: один указатель вращает, два указателя масштабируют FOV.
function handleBg360PointerMove(e) {
  if (!bg360Runtime.active || !bg360Runtime.pointers[e.pointerId]) return;
  if (!bg360Runtime.interactive) return;
  bg360Runtime.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };

  var pointerCount = getBg360PointerCount();
  if (pointerCount >= 2) {
    var newDistance = getBg360PinchDistance();
    if (bg360Runtime.pinchDistance !== null && newDistance !== null) {
      var delta = newDistance - bg360Runtime.pinchDistance;
      bg360Runtime.fovDeg = clamp(bg360Runtime.fovDeg - delta * 0.08, BG_360_FOV_MIN, BG_360_FOV_MAX);
      updateBg360Camera();
    }
    bg360Runtime.pinchDistance = newDistance;
  } else if (bg360Runtime.dragPointerId === e.pointerId) {
    var prevDragX = bg360Runtime.dragLastX;
    var prevDragY = bg360Runtime.dragLastY;
    var dx = e.clientX - prevDragX;
    var dy = e.clientY - prevDragY;
    bg360Runtime.pointerTravelSum += Math.abs(dx) + Math.abs(dy);
    // Двигаем камеру по экранной проекции: выбранная точка сферы остаётся под указателем при текущем FOV.
    if (applyBg360ProjectedDrag(prevDragX, prevDragY, e.clientX, e.clientY)) {
      updateBg360Camera();
    }
    bg360Runtime.dragLastX = e.clientX;
    bg360Runtime.dragLastY = e.clientY;
  }
  e.preventDefault();
}

// Очищает pointer-состояние при завершении касания/мыши.
function handleBg360PointerUpLike(e) {
  if (elBg360 && elBg360.releasePointerCapture) {
    try { elBg360.releasePointerCapture(e.pointerId); } catch (err) {
      // Pointer capture мог быть уже снят браузером, runtime-состояние очищается ниже.
    }
  }
  var travel = bg360Runtime.pointerTravelSum || 0;
  delete bg360Runtime.pointers[e.pointerId];
  if (bg360Runtime.dragPointerId === e.pointerId) {
    bg360Runtime.dragPointerId = null;
  }
  if (getBg360PointerCount() < 2) {
    bg360Runtime.pinchDistance = null;
  }
  // Короткий тап без заметного перетаскивания: выбор метки по полосе вокруг WebGL-стрелки.
  if (
    getBg360PointerCount() === 0 &&
    travel < 18 &&
    bg360Runtime.active &&
    bg360Runtime.interactive &&
    !bg360MarksRuntime.locked &&
    bg360MarksRuntime.interactive &&
    elBg360Marks &&
    !elBg360Marks.classList.contains("hidden")
  ) {
    var pickId = pickBg360NavArrowMarkId(e.clientX, e.clientY);
    if (pickId) {
      activateBg360MarkById(pickId, null);
    }
  }
  bg360Runtime.pointerTravelSum = 0;
  updateBg360CursorClasses();
}

// Поддерживает zoom колесом на десктопе, изменяя FOV в допустимых пределах.
function handleBg360Wheel(e) {
  if (!bg360Runtime.active) return;
  if (!bg360Runtime.interactive) return;
  bg360Runtime.fovDeg = clamp(bg360Runtime.fovDeg + e.deltaY * 0.03, BG_360_FOV_MIN, BG_360_FOV_MAX);
  updateBg360Camera();
  e.preventDefault();
}

// Готовит canvas-события для 360-управления; вызывается один раз при старте движка.
function setupBg360Interactions() {
  if (!elBg360) return;
  elBg360.addEventListener("pointerdown", handleBg360PointerDown);
  elBg360.addEventListener("pointermove", handleBg360PointerMove);
  elBg360.addEventListener("pointerup", handleBg360PointerUpLike);
  elBg360.addEventListener("pointercancel", handleBg360PointerUpLike);
  elBg360.addEventListener("wheel", handleBg360Wheel, { passive: false });
  elBg360.addEventListener("mousemove", handleBg360NavHoverMove);
  elBg360.addEventListener("mouseleave", handleBg360NavHoverLeave);
}

// Наведение мыши: курсор pointer над зоной стрелки, если не тянем обзор.
function handleBg360NavHoverMove(e) {
  if (!elBg360 || !bg360Runtime.active || !bg360Runtime.interactive) {
    if (elBg360) elBg360.classList.remove("is-nav-arrow-hover");
    return;
  }
  if (bg360MarksRuntime.locked || !bg360MarksRuntime.interactive) {
    elBg360.classList.remove("is-nav-arrow-hover");
    return;
  }
  if (bg360Runtime.dragPointerId !== null || getBg360PointerCount() > 0) return;
  var pickId = pickBg360NavArrowMarkId(e.clientX, e.clientY);
  elBg360.classList.toggle("is-nav-arrow-hover", !!pickId);
}

function handleBg360NavHoverLeave() {
  if (elBg360) elBg360.classList.remove("is-nav-arrow-hover");
}

// Обновляет классы курсора у 360-canvas: на ПК показываем "руку", когда обзор можно тянуть.
function updateBg360CursorClasses() {
  if (!elBg360) return;
  elBg360.classList.toggle("is-interactive", !!bg360Runtime.interactive);
  var dragging = !!(bg360Runtime.active && bg360Runtime.interactive && bg360Runtime.dragPointerId !== null);
  elBg360.classList.toggle("is-dragging", dragging);
}

// Создаёт временный слой-«скриншот» для 360, чтобы старый кадр оставался на экране до готовности нового.
function ensureBg360HoldLayer() {
  if (elBg360Hold) return elBg360Hold;
  if (!elNovelWindow) return null;
  var hold = document.createElement("img");
  hold.className = "hidden";
  hold.setAttribute("aria-hidden", "true");
  hold.alt = "";
  hold.draggable = false;
  hold.style.position = "absolute";
  hold.style.left = "0";
  hold.style.top = "0";
  hold.style.width = "100%";
  hold.style.height = "100%";
  hold.style.objectFit = "fill";
  hold.style.pointerEvents = "none";
  // Держим снимок выше фоновых слоёв (.bg z-index:2), но ниже меток 360 и UI.
  hold.style.zIndex = "3";
  hold.style.opacity = "1";
  hold.style.transition = "opacity 0.14s ease-out";
  elNovelWindow.appendChild(hold);
  elBg360Hold = hold;
  writeRuntimeVerbose("[BG360 HOLD] layer created");
  return hold;
}

// Скрывает hold-слой 360; вызывается после успешной загрузки нового кадра или при отмене смены.
// Снимает hold-слой; при immediate=true — сразу (сброс движка), иначе короткое затухание, чтобы не мигал переход с новой панорамой.
function hideBg360HoldLayer(immediate) {
  if (!elBg360Hold) return;
  if (elBg360Hold.classList.contains("hidden")) return;
  cancelGoto360HoldZoomRaf();
  if (bg360Runtime.holdFadeTimer) {
    clearTimeout(bg360Runtime.holdFadeTimer);
    bg360Runtime.holdFadeTimer = null;
  }
  if (immediate) {
    writeRuntimeVerbose("[BG360 HOLD] hide immediate");
    elBg360Hold.classList.add("hidden");
    elBg360Hold.removeAttribute("src");
    elBg360Hold.style.opacity = "1";
    elBg360Hold.style.zIndex = "3";
    elBg360Hold.style.transition = "opacity 0.14s ease-out";
    elBg360Hold.style.transform = "";
    elBg360Hold.style.transformOrigin = "";
    return;
  }
  writeRuntimeVerbose("[BG360 HOLD] hide (fade)");
  // Гарантируем короткое затухание именно здесь, не полагаясь на наследуемый из reveal "1500ms".
  elBg360Hold.style.transition = "opacity 0.14s ease-out";
  elBg360Hold.style.opacity = "0";
  bg360Runtime.holdFadeTimer = setTimeout(function() {
    bg360Runtime.holdFadeTimer = null;
    if (!elBg360Hold) return;
    elBg360Hold.classList.add("hidden");
    elBg360Hold.removeAttribute("src");
    elBg360Hold.style.opacity = "1";
    elBg360Hold.style.transform = "";
    elBg360Hold.style.transformOrigin = "";
  }, 140);
}

// Делает снимок текущего 360-canvas, чтобы не показывать «черный» фон между загрузками.
function showBg360HoldFromCurrentFrame() {
  if (!elBg360) {
    writeRuntimeVerbose("[BG360 HOLD] skip capture: no canvas");
    return false;
  }
  // Не требуем active: при первом включении 360 после 2D-фона снимок может быть пустым/тёмным,
  // но hold всё равно даёт плавное растворение вместо мгновенного cut (ветка revealMs && holdOk).
  var hold = ensureBg360HoldLayer();
  if (!hold) {
    writeRuntimeVerbose("[BG360 HOLD] skip capture: no hold layer");
    return false;
  }
  try {
    if (bg360Runtime.holdFadeTimer) {
      clearTimeout(bg360Runtime.holdFadeTimer);
      bg360Runtime.holdFadeTimer = null;
    }
    writeRuntimeVerbose("[BG360 HOLD] capture start", {
      width: elBg360.width,
      height: elBg360.height,
      clientWidth: elBg360.clientWidth,
      clientHeight: elBg360.clientHeight
    });
    // Перед снимком форсируем свежий рендер: иначе после композитинга буфер может быть очищен
    // (характерно для preserveDrawingBuffer:false, но и с true — даёт гарантированно актуальный кадр).
    if (
      bg360Runtime.renderer &&
      bg360Runtime.scene &&
      bg360Runtime.camera &&
      bg360Runtime.mesh
    ) {
      try {
        bg360Runtime.renderer.render(bg360Runtime.scene, bg360Runtime.camera);
      } catch (rerr) {
        console.warn("[BG360 HOLD] pre-capture render failed", rerr);
      }
    }
    hold.style.opacity = "1";
    // JPEG-снимок легче PNG (~10x), декодируется быстрее — критично для растворения за 1.5s.
    hold.src = elBg360.toDataURL("image/jpeg", 0.85);
    hold.classList.remove("hidden");
    writeRuntimeVerbose("[BG360 HOLD] capture success: hold shown", {
      srcLength: hold.src ? hold.src.length : 0,
      hasMeshAtCapture: !!bg360Runtime.mesh
    });
    return true;
  } catch (e) {
    // Если canvas нельзя экспортировать (например, tainted), просто продолжаем без hold-слоя.
    console.warn("[BG360 HOLD] capture failed", e);
    return false;
  }
}

// Освобождает текущую 360-сцену (текстуры/материалы/геометрию/видео), сохраняя renderer для повторного использования.
function clearBg360MediaResources() {
  disposeBg360OriginCoverMesh();
  disposeBg360NavArrowsGroup();
  if (elBg360Marks) {
    while (elBg360Marks.firstChild) elBg360Marks.removeChild(elBg360Marks.firstChild);
    elBg360Marks.classList.add("hidden");
    elBg360Marks.classList.remove("is-interactive", "is-webgl-nav-only");
  }
  if (bg360Runtime.mesh && bg360Runtime.scene) {
    bg360Runtime.scene.remove(bg360Runtime.mesh);
  }
  if (bg360Runtime.material && typeof bg360Runtime.material.dispose === "function") {
    bg360Runtime.material.dispose();
  }
  if (bg360Runtime.geometry && typeof bg360Runtime.geometry.dispose === "function") {
    bg360Runtime.geometry.dispose();
  }
  if (bg360Runtime.texture && typeof bg360Runtime.texture.dispose === "function") {
    bg360Runtime.texture.dispose();
  }
  if (bg360Runtime.video) {
    try { bg360Runtime.video.pause(); } catch (e) {
      // Ошибка Media API не должна прерывать освобождение остальных ресурсов панорамы.
    }
    bg360Runtime.video.removeAttribute("src");
    bg360Runtime.video.load();
  }

  bg360Runtime.mesh = null;
  bg360Runtime.material = null;
  bg360Runtime.geometry = null;
  bg360Runtime.texture = null;
  bg360Runtime.video = null;
}

// Рисует 360-сцену кадрами requestAnimationFrame, пока слой активен.
function renderBg360Frame() {
  if (!bg360Runtime.active || !bg360Runtime.renderer || !bg360Runtime.scene || !bg360Runtime.camera) return;
  updateBg360NavBillboardMeshes();
  bg360Runtime.renderer.render(bg360Runtime.scene, bg360Runtime.camera);
  // Кэш hit-test стрелок и DOM-метки синхронизируем после актуальной матрицы камеры.
  updateBg360NavArrowHitCache();
  updateBg360NavEdgeHints();
  updateBg360MarksProjection();
  updateBg360CompassRotation();
  bg360Runtime.frameId = requestAnimationFrame(renderBg360Frame);
}

// Останавливает 360-режим и скрывает canvas-слой.
function disableBg360Renderer() {
  closeBg360PhotoViewer("disable_360");
  // Каждое отключение инвалидирует старые async onload, чтобы они не вернули уже сброшенный фон.
  bg360Runtime.loadSeq++;
  bg360Runtime.textureReadyLoadSeq = 0;
  bg360Runtime.suppressNextHoldCapture = false;
  cancelGoto360ParallelZoomRaf();
  bg360Runtime.goto360ParallelZoomActive = false;
  bg360Runtime.pendingGoto360MarksPayload = null;
  resetBg360CanvasRevealStyles();
  if (bg360Runtime.holdFadeTimer) {
    clearTimeout(bg360Runtime.holdFadeTimer);
    bg360Runtime.holdFadeTimer = null;
  }
  bg360Runtime.active = false;
  bg360Runtime.interactive = false;
  bg360Runtime.sourceSrc = "";
  bg360Runtime.sourceQuality = "auto";
  bg360Runtime.blurFallbackSrc = "";
  bg360Runtime.isVideoSource = false;
  if (bg360Runtime.frameId) {
    cancelAnimationFrame(bg360Runtime.frameId);
    bg360Runtime.frameId = 0;
  }
  clearBg360MediaResources();
  bg360Runtime.pointers = {};
  bg360Runtime.pinchDistance = null;
  bg360Runtime.dragPointerId = null;
  bg360Runtime.pointerTravelSum = 0;
  if (elBg360) {
    elBg360.classList.add("hidden");
    elBg360.classList.remove("is-nav-arrow-hover");
  }
  updateBg360CursorClasses();
  hideBg360HoldLayer(true);
}

// Передаёт контроллеру актуальный аппаратный предел WebGL без раскрытия renderer.
function getPanoramaPackageMaxTextureSize() {
  return Number(bg360Runtime.renderer && bg360Runtime.renderer.capabilities && bg360Runtime.renderer.capabilities.maxTextureSize) || 0;
}

// Передаёт очереди только поля текущей панорамы, необходимые для приоритета пользовательской загрузки.
function getPanoramaPackageRuntimeState() {
  return {
    sourceSrc: bg360Runtime.sourceSrc,
    sourceQuality: bg360Runtime.sourceQuality,
    isVideoSource: bg360Runtime.isVideoSource,
    textureReadyLoadSeq: bg360Runtime.textureReadyLoadSeq,
    loadSeq: bg360Runtime.loadSeq
  };
}

// Приостанавливает тяжёлую фоновую проверку, пока пользователь работает с полноразмерным графом.
function isPanoramaPackageInspectionPaused() {
  return Boolean(showingGraph && elStatsPanel && !elStatsPanel.classList.contains("hidden"));
}

// Обновляет DOM прогресса по небольшому снимку контроллера, не передавая ему элементы интерфейса.
function renderPanoramaPackageInspectionProgress(progress) {
  if (!elStatsLoadProgress || !elStatsLoadProgressBar || !elStatsLoadProgressLabel) return;
  progress = progress || { completed: 0, total: 0 };
  elStatsLoadProgressBar.max = Math.max(1, progress.total);
  elStatsLoadProgressBar.value = progress.completed;
  elStatsLoadProgressLabel.textContent = progress.completed + " / " + progress.total;
  elStatsLoadProgress.classList.toggle(
    "hidden",
    currentStatsView !== "text" || progress.total === 0 || progress.completed >= progress.total
  );
}

// Перерисовывает открытую текстовую статистику только после завершения всей фоновой очереди.
function completePanoramaPackageInspection() {
  if (currentStatsView === "text" && elStatsPanel && !elStatsPanel.classList.contains("hidden")) {
    renderStats();
  }
}

// Контроллер владеет строгим чтением CSS, Blob URL и фоновой проверкой, а engine.js оставляет WebGL и UI.
var panoramaPackageController = window.VN_PANORAMA_PACKAGE_CONTROLLER.createPanoramaPackageController({
  window: window,
  document: document,
  resolveAssetUrl: resolveRuntimeStoryAssetUrl,
  resolveEffectiveQuality: resolveBg360EffectiveQuality,
  normalizeUrl: normalizeAssetUrl,
  sanitizeResource: sanitizeDiagnosticResource,
  getMaxTextureSize: getPanoramaPackageMaxTextureSize,
  getRuntimePanoramaState: getPanoramaPackageRuntimeState,
  isInspectionPaused: isPanoramaPackageInspectionPaused,
  isPhone: isConfidentPhoneForUiBoost,
  onInspectionProgress: renderPanoramaPackageInspectionProgress,
  onInspectionComplete: completePanoramaPackageInspection,
  writeVerbose: writeRuntimeVerbose
});

// Проверяет путь через единый контроллер декларативных CSS-пакетов.
function isBg360PackCssPath(path) {
  return panoramaPackageController.isCssPackPath(path);
}

// Сохраняет прежнюю точку вызова движка, не допуская исполняемые JS-пакеты.
function isBg360PackPath(path) {
  return panoramaPackageController.isPackPath(path);
}

// Выбирает normal или mobile CSS через общую политику путей контроллера.
function getBg360PackCssUrl(sourceUrl, quality) {
  return panoramaPackageController.getCssUrl(sourceUrl, quality);
}

// Возвращает готовый Blob URL либо состояние общей асинхронной загрузки.
function resolveBg360PackResource(sourceUrl, quality, onReady) {
  return panoramaPackageController.resolveResource(sourceUrl, quality, onReady);
}

// Освобождает выданный Blob URL и при необходимости запоминает ошибку декодирования.
function releaseBg360PackResource(resource, markCssError) {
  panoramaPackageController.releaseResource(resource, markCssError);
}

// Проверяет декодированное изображение по метаданным строгого CSS-пакета.
function validateBg360DecodedImage(image, resource) {
  return panoramaPackageController.validateDecodedImage(image, resource);
}

// Проверяет изображение и аппаратный предел WebGL текущего устройства.
function validateBg360PackTexture(texture, resource) {
  return panoramaPackageController.validateTexture(texture, resource);
}

// Передаёт результат runtime или графа в малый сессионный кэш проверки.
function recordBg360PackageInspectionResultByResource(resource, sourceUrl, status, details) {
  panoramaPackageController.recordInspectionResultByResource(resource, sourceUrl, status, details);
}

// Передаёт ошибку до создания ресурса в тот же сессионный кэш проверки.
function recordBg360PackageInspectionResult(sourceUrl, quality, status, details) {
  panoramaPackageController.recordInspectionResult(sourceUrl, quality, status, details, null);
}

// Регистрирует ссылки истории и возвращает мгновенный снимок фоновой проверки.
function checkPanoramaPackageReferences(items) {
  return panoramaPackageController.checkReferences(items);
}

// Повторно передаёт текущий прогресс UI после смены вкладки статистики.
function updateBg360PackageInspectionProgress() {
  panoramaPackageController.notifyInspectionProgress();
}

// Включает 360-рендер только из изолированного CSS-пакета либо из видео.
function setBackground360(src, fallbackSrc, scrollOptions) {
  if (!src) {
    disableBg360Renderer();
    return;
  }

  var normalized = normalizeBackgroundScrollOptions(scrollOptions);
  var normalizedSrc = resolveRuntimeStoryAssetUrl(src, "panorama");
  var normalizedFallback = fallbackSrc ? resolveRuntimeStoryAssetUrl(fallbackSrc, "image") : "";
  if (!normalizedSrc) {
    disableBg360Renderer();
    return;
  }
  var isVideo = isVideoAssetPath(normalizedSrc);
  // Сохраняем текущий 360-источник для автосейва, чтобы после F5 не подставлялся
  // «последний обычный» фон из 2D-слоёв.
  bg360Runtime.sourceSrc = normalizedSrc;
  bg360Runtime.blurFallbackSrc = normalizedFallback;
  bg360Runtime.isVideoSource = !!isVideo;
  // На этом шаге auto превращается в normal/mobile с учетом [meta] и текущего устройства.
  var bg360Quality = resolveBg360EffectiveQuality(normalized.quality);
  bg360Runtime.sourceQuality = bg360Quality;
  var selectedPackCssUrl = getBg360PackCssUrl(normalizedSrc, bg360Quality);
  var isPackSource = isBg360PackPath(normalizedSrc);
  // Поколение загрузки защищает рестарт и смену фона от старых image/video callbacks.
  var bg360LoadSeq = ++bg360Runtime.loadSeq;
  function isCurrentBg360Load() {
    return bg360LoadSeq === bg360Runtime.loadSeq;
  }
  var deferSwapUntilTexture = bg360Runtime.goto360ParallelZoomActive === true;
  if (deferSwapUntilTexture) {
    bg360Runtime.goto360ParallelZoomActive = false;
  }
  var packResource = null;
  writeRuntimeVerbose("[BG360 HOLD] setBackground360 start", {
    src: normalizedSrc,
    fallback: normalizedFallback,
    hadActive360: !!bg360Runtime.active
  });
  if (!isVideo) {
    if (!isPackSource) {
      if (deferSwapUntilTexture) {
        bg360Runtime.goto360ParallelZoomActive = true;
      }
      console.warn("[BG360] 360-фон должен ссылаться на пакет *-360.css:", sanitizeDiagnosticResource(normalizedSrc));
      return;
    }
    packResource = resolveBg360PackResource(normalizedSrc, bg360Quality, function() {
      if (isCurrentBg360Load()) {
        setBackground360(src, fallbackSrc, scrollOptions);
      }
    });
    // Пока CSS подгружается, не трогаем текущие слои: старая панорама остаётся видимой до готовности новой.
    if (packResource.status === "loading") {
      if (deferSwapUntilTexture) {
        bg360Runtime.goto360ParallelZoomActive = true;
      }
      return;
    }
    if (packResource.status !== "ready" || !packResource.src) {
      if (deferSwapUntilTexture) {
        bg360Runtime.goto360ParallelZoomActive = true;
      }
      // Сохранённая причина отличает отсутствие файла от запрета чтения и ошибки содержимого CSS.
      console.warn(
        "[BG360] CSS-пакет панорамы недоступен:",
        sanitizeDiagnosticResource(selectedPackCssUrl || normalizedSrc),
        panoramaPackageController.getLoadError(normalizedSrc, bg360Quality) ||
          "Не удалось получить ресурс CSS-панорамы."
      );
      return;
    }
  }
  var textureSource = packResource ? packResource.src : normalizedSrc;

  function buildNonWebgl360FallbackOptions(baseOptions) {
    // Фолбэк без WebGL: включаем drag по широкой 2:1-картинке, чтобы 360 не превращался в полностью статичный фон.
    var fallback = Object.assign({}, normalizeBackgroundScrollOptions(baseOptions), { is360: false, panorama360Fallback: true });
    fallback.enabled = true;
    fallback.start = clamp(typeof fallback.focusX === "number" ? fallback.focusX : 0.5, 0, 1);
    fallback.focusY = clamp(typeof fallback.focusY === "number" ? fallback.focusY : 0.5, 0, 1);
    if (fallback.scale === null || fallback.scale === undefined) {
      fallback.scale = 1;
    }
    return fallback;
  }
  if (!ensureBg360Renderer()) {
    console.warn("[BG360] WebGL/THREE недоступны, включен drag-фолбэк без 3D");
    releaseBg360PackResource(packResource, false);
    cancelGoto360ParallelZoomRaf();
    cancelGoto360HoldZoomRaf();
    bg360Runtime.goto360ParallelZoomActive = false;
    if (bg360Runtime.pendingGoto360MarksPayload) {
      var plW = bg360Runtime.pendingGoto360MarksPayload;
      bg360MarksRuntime.bgId = state.currentBgId;
      bg360MarksRuntime.lines = plW.lines;
      bg360MarksRuntime.marks = plW.marks;
      bg360MarksRuntime.locked = false;
      bg360MarksRuntime.interactive = true;
      bg360Runtime.pendingGoto360MarksPayload = null;
    }
    setBackground(src, fallbackSrc, null, buildNonWebgl360FallbackOptions(normalized));
    return;
  }

  var geometry = null;

  if (!deferSwapUntilTexture) {
    // Для 360-слоя интерактив включается только при явном scroll в сценарии (после swap — сразу; при отложенном swap — в onLoadTexture).
    bg360Runtime.interactive = normalized.enabled === true;
    updateBg360CursorClasses();
    cancelGoto360ParallelZoomRaf();
    cancelGoto360HoldZoomRaf();
    if (bg360Runtime.suppressNextHoldCapture) {
      bg360Runtime.suppressNextHoldCapture = false;
      var holdKeep = ensureBg360HoldLayer();
      if (holdKeep) {
        holdKeep.style.opacity = "1";
        holdKeep.classList.remove("hidden");
      }
      writeRuntimeVerbose("[BG360 HOLD] reuse snapshot after goto360 zoom (skip duplicate capture)");
    } else {
      showBg360HoldFromCurrentFrame();
      writeRuntimeVerbose("[BG360 HOLD] capture requested before swap");
    }
    disableBackgroundScroll();
    if (elBg) elBg.classList.add("hidden");
    backgroundMediaController.clearBackgroundVideo();
    // 360-фон пока считается визуальным слоем без отдельного аудио-канала.
    setBgmDuckingTarget(1, DEFAULT_BGM_DUCKING_RELEASE_MS, "bg360 shown");
    audio.currentBgVideoVolume = 0;

    clearBg360MediaResources();
    resizeBg360Renderer();

    var initialYaw = clamp(typeof normalized.focusX === "number" ? normalized.focusX : 0.5, 0, 1) * 360;
    var initialPitch = -85 + clamp(typeof normalized.focusY === "number" ? normalized.focusY : 0.5, 0, 1) * 170;
    var initialFov = normalizeMediaFov(normalized.fov, null);
    if (initialFov === null) {
      initialFov = mapFocusZToFov(normalized.focusZ);
    }

    bg360Runtime.yawDeg = initialYaw;
    bg360Runtime.pitchDeg = initialPitch;
    bg360Runtime.fovDeg = initialFov;
    updateBg360Camera();

    geometry = new window.THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    bg360Runtime.geometry = geometry;
  }

  if (packResource) {
    writeRuntimeVerbose("[BG360] Используется " + packResource.kind.toUpperCase() + "-пакет для:", normalizedSrc);
  }

  function onLoadTexture(texture) {
    if (!isCurrentBg360Load()) {
      // Если пользователь успел сделать сброс или включился другой фон, старую текстуру только освобождаем.
      releaseBg360PackResource(packResource, false);
      if (texture && typeof texture.dispose === "function") texture.dispose();
      return;
    }
    var textureValidationError = validateBg360PackTexture(texture, packResource);
    if (textureValidationError) {
      if (texture && typeof texture.dispose === "function") texture.dispose();
      console.warn("[BG360] CSS-пакет отклонён после декодирования:", textureValidationError);
      onLoadError(textureValidationError);
      return;
    }
    if (packResource && packResource.kind === "css") {
      recordBg360PackageInspectionResultByResource(packResource, normalizedSrc, "loaded", "Loaded and validated in WebGL by the 360° runtime.");
    }
    releaseBg360PackResource(packResource, false);
    resetBg360CanvasRevealStyles();
    if (deferSwapUntilTexture) {
      cancelGoto360ParallelZoomRaf();
      showBg360HoldFromCurrentFrame();
      // Пока hold растворяется, продолжаем тот же наезд (масштаб снимка), что шёл на старой сфере до swap.
      runGoto360HoldZoomContinueAfterParallelSwap(elBg360Hold, bg360LoadSeq);
      if (elBg360) elBg360.classList.add("hidden");
      stripBg360NavigationOverlayPendingLoad();
      if (bg360Runtime.pendingGoto360MarksPayload) {
        var pl = bg360Runtime.pendingGoto360MarksPayload;
        bg360MarksRuntime.bgId = state.currentBgId;
        bg360MarksRuntime.lines = pl.lines;
        bg360MarksRuntime.marks = pl.marks;
        bg360MarksRuntime.locked = false;
        bg360MarksRuntime.interactive = true;
        bg360Runtime.pendingGoto360MarksPayload = null;
      }
      bg360Runtime.interactive = normalized.enabled === true;
      updateBg360CursorClasses();
      disableBackgroundScroll();
      if (elBg) elBg.classList.add("hidden");
      backgroundMediaController.clearBackgroundVideo();
      setBgmDuckingTarget(1, DEFAULT_BGM_DUCKING_RELEASE_MS, "bg360 shown");
      audio.currentBgVideoVolume = 0;
      clearBg360MediaResources();
      resizeBg360Renderer();
      var initialYawD = clamp(typeof normalized.focusX === "number" ? normalized.focusX : 0.5, 0, 1) * 360;
      var initialPitchD = -85 + clamp(typeof normalized.focusY === "number" ? normalized.focusY : 0.5, 0, 1) * 170;
      var initialFovD = normalizeMediaFov(normalized.fov, null);
      if (initialFovD === null) {
        initialFovD = mapFocusZToFov(normalized.focusZ);
      }
      bg360Runtime.yawDeg = initialYawD;
      bg360Runtime.pitchDeg = initialPitchD;
      bg360Runtime.fovDeg = initialFovD;
      updateBg360Camera();
      geometry = new window.THREE.SphereGeometry(500, 60, 40);
      geometry.scale(-1, 1, 1);
      bg360Runtime.geometry = geometry;
    }
    var material = new window.THREE.MeshBasicMaterial({ map: texture });
    var mesh = new window.THREE.Mesh(geometry, material);
    bg360Runtime.texture = texture;
    bg360Runtime.material = material;
    bg360Runtime.mesh = mesh;
    bg360Runtime.scene.add(mesh);
    bg360Runtime.textureReadyLoadSeq = bg360LoadSeq;
    bg360Runtime.active = true;
    // Метки и стрелки привязаны к UV новой сферы: пересобираем оверлей только после готовности текстуры.
    renderBg360Marks();
    // Важно: сначала рисуем первый кадр нового 360, затем показываем canvas; при reveal hold сверху уходит opacity 1→0.
    if (bg360Runtime.renderer && bg360Runtime.scene && bg360Runtime.camera) {
      // Обновляем billboard-геометрию ДО первого рендера, чтобы меши не были пустыми на первом кадре.
      updateBg360NavBillboardMeshes();
      bg360Runtime.renderer.render(bg360Runtime.scene, bg360Runtime.camera);
      updateBg360NavArrowHitCache();
      updateBg360MarksProjection();
    }
    var revealMs = resolveBg360NewSceneRevealMs();
    var swapSeqForReveal = bg360LoadSeq;
    if (elBg360) {
      elBg360.classList.remove("hidden");
    }
    if (bg360Runtime.interactive) showBg360NavigationHint();
    else hideBackgroundScrollHint();

    var holdEl = elBg360Hold;
    var holdOk = bg360HoldLayerHasUsableSnapshot(holdEl);
    writeRuntimeVerbose("[BG360 HOLD] reveal decision", {
      revealMs: revealMs,
      holdOk: holdOk,
      holdHasSrc: !!(holdEl && holdEl.getAttribute("src")),
      holdHidden: !!(holdEl && holdEl.classList.contains("hidden")),
      holdInlineOpacity: holdEl ? holdEl.style.opacity : null
    });

    if (revealMs <= 0 || !holdOk) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          if (swapSeqForReveal !== bg360Runtime.loadSeq) return;
          hideBg360HoldLayer();
        });
      });
    } else {
      // Готовим стартовое состояние: hold над canvas, полностью непрозрачен, без transition.
      // Применяем стили в первом RAF, ставим transition во втором, opacity=0 в третьем — так браузер гарантированно увидит изменение.
      holdEl.classList.remove("hidden");
      holdEl.style.opacity = "1";
      holdEl.style.pointerEvents = "none";
      holdEl.style.transition = "none";
      holdEl.style.zIndex = "5";
      requestAnimationFrame(function() {
        if (swapSeqForReveal !== bg360Runtime.loadSeq) return;
        // На текущем кадре фиксируем длительность; следующий кадр — целевое значение opacity.
        holdEl.style.transition = "opacity " + revealMs + "ms ease-out";
        requestAnimationFrame(function() {
          if (swapSeqForReveal !== bg360Runtime.loadSeq) return;
          if (isExplicitDebugCategoryEnabled("visual")) {
            console.log("[BG360 HOLD] reveal start", {
              revealMs: revealMs,
              computedTransition: window.getComputedStyle(holdEl).transition,
              computedOpacity: window.getComputedStyle(holdEl).opacity
            });
          }
          holdEl.style.opacity = "0";
        });
      });
      bg360Runtime.revealFallbackTimer = setTimeout(function() {
        bg360Runtime.revealFallbackTimer = null;
        if (swapSeqForReveal !== bg360Runtime.loadSeq) {
          resetBg360CanvasRevealStyles();
          return;
        }
        writeRuntimeVerbose("[BG360 HOLD] reveal fallback fire (cleanup)");
        hideBg360HoldLayer(true);
        resetBg360CanvasRevealStyles();
      }, revealMs + 120);
    }
    if (bg360Runtime.frameId) cancelAnimationFrame(bg360Runtime.frameId);
    bg360Runtime.frameId = requestAnimationFrame(renderBg360Frame);
    if (typeof updateBlurBackground === "function") {
      // Для 360-пакета sourceSrc указывает на CSS; blur-слой должен получать только изображение/видео fallback.
      var blurSource = normalizedFallback || "";
      if (!blurSource && !isPackSource) {
        blurSource = normalizedSrc;
      }
      if (blurSource) updateBlurBackground(blurSource);
    }
  }

  function onLoadError(reason) {
    if (!isCurrentBg360Load()) {
      releaseBg360PackResource(packResource, false);
      return;
    }
    if (packResource && packResource.kind === "css") {
      // Декодер мог отклонить картинку после успешного чтения CSS: помечаем пакет ошибочным без исполнения JS-фолбэка.
      var packageFailureReason = typeof reason === "string" && reason
        ? reason
        : "The browser could not decode the panorama image.";
      recordBg360PackageInspectionResultByResource(
        packResource,
        normalizedSrc,
        "invalid",
        packageFailureReason
      );
      releaseBg360PackResource(packResource, true);
    } else {
      releaseBg360PackResource(packResource, false);
    }
    console.warn("[BG360] Не удалось загрузить ресурс:", sanitizeDiagnosticResource(normalizedSrc));
    console.warn("[BG360 HOLD] texture load error: hide hold and fallback", {
      src: sanitizeDiagnosticResource(normalizedSrc),
      fallback: normalizedFallback
    });
    cancelGoto360ParallelZoomRaf();
    cancelGoto360HoldZoomRaf();
    bg360Runtime.pendingGoto360MarksPayload = null;
    disableBg360Renderer();
    var fallbackOptions = buildNonWebgl360FallbackOptions(normalized);
    if (normalizedFallback) {
      setBackground(normalizedFallback, "", null, fallbackOptions);
    } else {
      setBackground(normalizedSrc, "", null, fallbackOptions);
    }
  }

  if (isVideo) {
    var video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = normalizedSrc;
    bg360Runtime.video = video;
    video.onloadeddata = function() {
      if (!isCurrentBg360Load()) {
        try { video.pause(); } catch (e) {
          // Устаревшая загрузка уже исключена из runtime и очищается best-effort.
        }
        return;
      }
      var texture = new window.THREE.VideoTexture(video);
      texture.minFilter = window.THREE.LinearFilter;
      texture.magFilter = window.THREE.LinearFilter;
      texture.generateMipmaps = false;
      onLoadTexture(texture);
      if (!isCurrentBg360Load()) return;
      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function ignorePanoramaAutoplayFailure() {
          // Запрет autoplay оставляет первый декодированный кадр и не ломает панораму.
        });
      }
    };
    video.onerror = onLoadError;
    video.load();
    return;
  }

  // Для file:// TextureLoader может падать из-за CORS (origin null).
  // В этом режиме грузим картинку через HTMLImageElement без crossOrigin и оборачиваем в THREE.Texture вручную.
  if (window.location && window.location.protocol === "file:") {
    if (packResource) {
      var fileImagePacked = new Image();
      fileImagePacked.onload = function() {
        var texturePacked = new window.THREE.Texture(fileImagePacked);
        texturePacked.needsUpdate = true;
        texturePacked.minFilter = window.THREE.LinearFilter;
        texturePacked.magFilter = window.THREE.LinearFilter;
        texturePacked.generateMipmaps = false;
        texturePacked.colorSpace = window.THREE.SRGBColorSpace || texturePacked.colorSpace;
        onLoadTexture(texturePacked);
      };
      fileImagePacked.onerror = onLoadError;
      fileImagePacked.src = textureSource;
      return;
    }
    loadRasterImageResource(src, {
      onLoad: function(fileImage) {
        var texture = new window.THREE.Texture(fileImage);
        texture.needsUpdate = true;
        texture.minFilter = window.THREE.LinearFilter;
        texture.magFilter = window.THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.colorSpace = window.THREE.SRGBColorSpace || texture.colorSpace;
        onLoadTexture(texture);
      },
      onError: onLoadError
    });
    return;
  }

  var loader = new window.THREE.TextureLoader();
  if (!packResource && isEngineImageOptimizationEnabled() && isRasterImagePathForOptimization(src)) {
    loadRasterImageResource(src, {
      onLoad: function(_img, resolvedUrl) {
        loader.load(
          normalizeAssetUrl(resolvedUrl),
          function(texture) {
            texture.colorSpace = window.THREE.SRGBColorSpace || texture.colorSpace;
            onLoadTexture(texture);
          },
          undefined,
          onLoadError
        );
      },
      onError: onLoadError
    });
    return;
  }

  loader.load(
    textureSource,
    function(texture) {
      texture.colorSpace = window.THREE.SRGBColorSpace || texture.colorSpace;
      onLoadTexture(texture);
    },
    undefined,
    onLoadError
  );
}

// Переключает фоновое медиа и при необходимости включает горизонтальный скролл wide-изображения или видео.
function setBackground(src, fallbackSrc, videoVolume, scrollOptions) {
  // engine.js определяет момент смены фона, а модуль владеет обычными media, fallback, blur и их handlers.
  backgroundMediaController.setBackground(src, fallbackSrc, videoVolume, scrollOptions);
}

function showDialog(name, text, color) {
  var dialogElement = document.getElementById('dialog');

  // Имя показываем ВСЕГДА, если оно есть
  if (name && String(name).trim() !== "") {
    elName.textContent = name;
    elName.classList.remove("hidden");

    // Добавляем защиту от скрытия
    elName.setAttribute('data-protected', 'true');

    dialogElement.classList.add('has-name');
    dialogElement.classList.remove('no-name');

    // Устанавливаем только цвет текста, без бордера и тени
    if (color) {
      elName.style.color = color;
      elName.style.background = "rgba(0,0,0,0.5)"; // Полупрозрачный фон для читаемости
      elName.style.border = "1px solid rgba(255,255,255,0.12)"; // Стандартная рамка
      elName.style.textShadow = "none"; // Убираем тень
    } else {
      elName.style.color = ""; // Сброс на цвет по умолчанию из CSS
      elName.style.background = ""; // Сброс на фон из CSS
      elName.style.textShadow = ""; // Сброс тени
    }


    // Создаём наблюдатель только один раз
    if (!nameObserver) {
      nameObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.attributeName === 'class') {
            // Если имя должно быть видимо, но его скрыли - восстанавливаем
            if (elName.hasAttribute('data-protected') && elName.classList.contains('hidden')) {
              elName.classList.remove('hidden');
              elName.style.display = 'inline-block';
            }
          }
        });
      });
      
      nameObserver.observe(elName, { attributes: true });
    }


  } else {
    elName.textContent = "";
    elName.classList.add("hidden");
    elName.removeAttribute('data-protected');
    dialogElement.classList.remove('has-name');
    dialogElement.classList.add('no-name');
  }
  
  //elText.textContent = text ? String(text) : "";
  elText.textContent = text ? renderTextVars(String(text)) : "";

  // Управление подсказкой и классом диалога
  var hintElement = document.querySelector('.hint');
  
  if (hintElement && dialogElement) {
    if (isFirstDialog) {
      hintElement.style.display = 'block';
      dialogElement.classList.add('has-hint');
      dialogElement.classList.remove('no-hint');
      isFirstDialog = false;
    } else {
      hintElement.style.display = 'none';
      dialogElement.classList.remove('has-hint');
      dialogElement.classList.add('no-hint');
    }
  }
}



function showError(text) {
  setBackground(""); // не обязательно
  characterController.hide("showError");
  showDialog("Ошибка", text);
}

function showOverlay(opacity) {
  elOverlay.classList.remove("hidden");
  var o = (typeof opacity === "number") ? opacity : 0.35;
  elOverlay.style.background = "rgba(0,0,0," + clamp(o, 0, 1) + ")";
}

function hideOverlay() {
  elOverlay.classList.add("hidden");
}

// =========================================================
//                   ВЫБОР
// =========================================================

// Снимает активный обработчик перерасчёта fit-меню, чтобы закрытое меню не реагировало на resize.
function clearFitChoiceLayout() {
  if (!activeFitChoiceLayout) return;
  window.removeEventListener("resize", activeFitChoiceLayout);
  activeFitChoiceLayout = null;
}

// Планирует первичную и повторную раскладку fit-меню после того, как браузер измерит DOM.
function scheduleFitChoiceLayout(list) {
  clearFitChoiceLayout();

  activeFitChoiceLayout = function () {
    var runLayout = function (fn) {
      if (window.requestAnimationFrame) return window.requestAnimationFrame(fn);
      return window.setTimeout(fn, 0);
    };

    runLayout(function () {
      applyFitChoiceLayout(list);
    });
  };

  activeFitChoiceLayout();
  window.addEventListener("resize", activeFitChoiceLayout);
}

// Возвращает числовой gap списка выбора, чтобы расчёты строк совпадали с CSS-отступами.
function getChoiceGapPx(list) {
  var styles = window.getComputedStyle ? window.getComputedStyle(list) : null;
  if (!styles) return 0;

  var gap = parseFloat(styles.columnGap);
  if (isNaN(gap)) gap = parseFloat(styles.gap);
  if (isNaN(gap)) gap = parseFloat(styles.rowGap);
  return isNaN(gap) ? 0 : gap;
}

// Подбирает переносы для fit-режима: порядок кнопок сохраняется, а строки становятся ближе по заполнению.
function getFitChoiceRows(widths, containerWidth, gap) {
  var count = widths.length;
  var dp = new Array(count + 1);
  var nextBreak = new Array(count + 1);
  dp[count] = 0;

  for (var i = count - 1; i >= 0; i--) {
    dp[i] = Infinity;
    var naturalWidth = 0;

    for (var j = i; j < count; j++) {
      naturalWidth += widths[j];
      var itemCount = j - i + 1;
      var rowWidth = naturalWidth + gap * (itemCount - 1);

      if (rowWidth > containerWidth && itemCount > 1) break;

      var effectiveWidth = Math.min(rowWidth, containerWidth);
      var slack = Math.max(0, containerWidth - effectiveWidth);
      // Штраф за пустое место заставляет переносы выравнивать строки, а не оставлять короткий хвост.
      var cost = slack * slack + dp[j + 1];
      if (cost < dp[i]) {
        dp[i] = cost;
        nextBreak[i] = j + 1;
      }
    }
  }

  var rows = [];
  var cursor = 0;
  while (cursor < count) {
    var next = nextBreak[cursor] || (cursor + 1);
    rows.push({
      start: cursor,
      end: next
    });
    cursor = next;
  }
  return rows;
}

// Измеряет fit-меню, перестраивает строки на всю ширину и сохраняет фокус выбранной кнопки.
function applyFitChoiceLayout(list) {
  if (!list || !list.parentNode || elChoices.classList.contains("hidden")) return;

  var buttons = Array.prototype.slice.call(list.querySelectorAll(".choiceBtn"));
  if (!buttons.length) return;
  // Перестройка DOM не должна сбрасывать клавиатурный фокус с выбранного пункта.
  var focusedChoice = document.activeElement && list.contains(document.activeElement)
    ? document.activeElement
    : null;

  // Перед повторной раскладкой возвращаем кнопки в исходный порядок и убираем старые строки.
  while (list.firstChild) {
    list.removeChild(list.firstChild);
  }

  buttons.forEach(function (btn) {
    btn.style.width = "";
    btn.style.flex = "";
    btn.style.maxWidth = "";
    list.appendChild(btn);
  });

  var containerWidth = Math.floor(list.clientWidth);
  if (containerWidth <= 0) {
    focusUiElement(focusedChoice);
    return;
  }

  var savedDisplay = list.style.display;
  list.style.display = "block";

  var widths = buttons.map(function (btn) {
    btn.style.width = "max-content";
    btn.style.flex = "0 0 auto";
    btn.style.maxWidth = "none";
    return Math.min(Math.ceil(btn.getBoundingClientRect().width), containerWidth);
  });

  list.style.display = savedDisplay;

  buttons.forEach(function (btn) {
    btn.style.width = "";
    btn.style.flex = "";
    btn.style.maxWidth = "";
  });

  var gap = getChoiceGapPx(list);
  var rows = getFitChoiceRows(widths, containerWidth, gap);

  rows.forEach(function (rowInfo) {
    var row = document.createElement("div");
    row.className = "choiceFitRow";

    var rowButtons = buttons.slice(rowInfo.start, rowInfo.end);
    var rowWidths = widths.slice(rowInfo.start, rowInfo.end);
    var totalNatural = rowWidths.reduce(function (sum, width) {
      return sum + width;
    }, 0);
    var availableWidth = Math.max(0, containerWidth - gap * Math.max(0, rowButtons.length - 1));
    var usedWidth = 0;

    rowButtons.forEach(function (btn, index) {
      var targetWidth = rowButtons.length > 0 && index < rowButtons.length - 1
        ? (availableWidth * rowWidths[index] / Math.max(1, totalNatural))
        : (availableWidth - usedWidth);
      var roundedWidth = Math.max(0, Math.floor(targetWidth));
      usedWidth += roundedWidth;

      btn.style.width = roundedWidth + "px";
      btn.style.flex = "0 0 " + roundedWidth + "px";
      btn.style.maxWidth = "100%";
      row.appendChild(btn);
    });

    list.appendChild(row);
  });
  focusUiElement(focusedChoice);
}

function showChoices(choices, choiceAction) {
  // choices: [{ text, goto, set:{...}, sfx:"@audio.xxx" }, ...]
  // choiceAction хранит настройки меню, которые парсер прочитал из строки menu.
  if (!choices || !choices.length) return;

  clearFitChoiceLayout();

  // fit — сбалансированная плотная раскладка; если указан вместе с compact, он сильнее.
  var isFitChoices = !!(choiceAction && choiceAction.fit);
  // compact делает кнопки шириной по тексту и разрешает обычный перенос по строкам.
  var isCompactChoices = !isFitChoices && !!(choiceAction && choiceAction.compact);
  // Номера включены по умолчанию, но плотные режимы всегда скрывают их.
  var showChoiceNumbers = !isCompactChoices && !isFitChoices && !(choiceAction && choiceAction.showNumbers === false);
  // title="" намеренно скрывает заголовок, поэтому отличаем заданный title от значения по умолчанию.
  var choiceTitle = "Выберите действие";
  if (choiceAction && Object.prototype.hasOwnProperty.call(choiceAction, "title")) {
    choiceTitle = String(choiceAction.title || "");
  }
  // Заголовок меню поддерживает те же шаблоны переменных, что и обычный диалоговый текст.
  choiceTitle = renderTextVars(choiceTitle);

  // НЕ очищаем диалог полностью, а только текст
  elText.textContent = ""; // Очищаем только текст, имя оставляем

  // Убираем предыдущее сообщение, чтобы не мешало выбору
  // showDialog(null, "");

  // elChoices.innerHTML = "";
  elDialog.classList.add("hiddenByChoices");
  elChoices.classList.remove("hidden");

  var panel = document.createElement("div");
  panel.className = "choicePanel";
  if (isCompactChoices) {
    panel.classList.add("is-compact");
  } else if (isFitChoices) {
    panel.classList.add("is-fit");
  }

  if (choiceTitle !== "") {
    var title = document.createElement("div");
    title.className = "choiceTitle";
    title.textContent = choiceTitle;
    panel.appendChild(title);
  }

  var list = document.createElement("div");
  list.className = "choiceList";

  for (var i = 0; i < choices.length; i++) {
    (function (choice, index) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choiceBtn";

      if (showChoiceNumbers) {
        var num = document.createElement("span");
        num.className = "choiceNum";
        num.textContent = (index + 1) + ".";
        btn.appendChild(num);
      }

      var text = document.createElement("span");
      text.className = "choiceLabel";
      // Текст пункта выбора может содержать подстановки вида {varName}.
      text.textContent = renderTextVars(String(choice.text || ("Выбор " + (index + 1))));
      btn.appendChild(text);

      btn.addEventListener("click", function (evt) {
        if (evt && typeof evt.preventDefault === "function") evt.preventDefault();
        if (evt && typeof evt.stopPropagation === "function") evt.stopPropagation();
        // Считаем клик по пункту меню «последним next», чтобы защита от двойных кликов
        // отфильтровала только мгновенный сквозной клик (если браузер его сгенерирует).
        lastNextTime = Date.now();

        if (choice.sfx) {
          playSfx(resolveAsset(choice.sfx), 1);
        }

        if (choice.set && typeof choice.set === "object") {
          for (var k in choice.set) {
            if (Object.prototype.hasOwnProperty.call(choice.set, k)) {
              state.vars[k] = choice.set[k];
            }
          }
        }

        hideChoices();
        // После выбора возвращаем управление диалогу; следующая модалка при необходимости заберёт фокус сама.
        focusUiElement(elDialog);

        if (Array.isArray(choice.actions) && choice.actions.length > 0) {
          var clonedChoiceActions = JSON.parse(JSON.stringify(choice.actions));
          if (!Array.isArray(state.pendingActions)) {
            state.pendingActions = [];
          }
          // Выбранные действия выполняем через runtime-очередь, чтобы не копить
          // дубликаты в scene.actions при повторных заходах в ту же сцену.
          state.pendingActions = clonedChoiceActions.concat(state.pendingActions);
        } else if (choice.goto) {
          gotoScene(choice.goto);
        }

        state.waitingNext = false;
        runCurrent();
      });

      list.appendChild(btn);
    })(choices[i], i);
  }

  panel.appendChild(list);
  elChoices.appendChild(panel);
  focusUiElement(list.querySelector(".choiceBtn"));
  if (isFitChoices) {
    scheduleFitChoiceLayout(list);
  }
}

function hideChoices() {
  clearFitChoiceLayout();
  elDialog.classList.remove("hiddenByChoices");
  elChoices.classList.add("hidden");
  elChoices.innerHTML = "";
}

// =========================================================
//                   STORY VIDEO
// =========================================================

// Применяет сценарную громкость ролика через общий аудиоконтроллер.
function setStoryVideoControllerVolume(volume) {
  audio.currentStoryVideoVolume = volume;
  audioController.applySettings();
}

// Пересчитывает ducking после изменения слышимости сюжетного видео.
function updateStoryVideoControllerDucking(reason) {
  audioController.setDuckingForActiveVideos(reason);
}

// Передаёт модулю повторную проверку путей видео и постеров общей политикой ресурсов.
function resolveStoryVideoControllerAssetUrl(src, kind) {
  return resolveRuntimeStoryAssetUrl(src, kind);
}

// Настраивает общий scroll/focus-механизм для выбранного слоя ролика или постера.
function setStoryVideoControllerScrollOptions(action, targetEl) {
  setStoryVideoScrollOptions(
    mergeMediaFocusOptions(action.scroll, action.focusX, action.scale, action.focusY),
    targetEl
  );
}

// Проверяет, принадлежит ли активный scroll переданному слою сюжетного видео.
function isStoryVideoControllerScrollTarget(targetEl) {
  return backgroundScroll.owner === "storyVideo" && backgroundScroll.target === targetEl;
}

// Сообщает модулю, что pointerup должен завершить текущее перетаскивание ролика.
function isStoryVideoControllerScrollDragging() {
  return backgroundScroll.owner === "storyVideo" && backgroundScroll.dragging;
}

// Завершает drag через существующий общий обработчик, сохраняя suppressClick-защиту.
function finishStoryVideoControllerScrollPointer(event) {
  handleBackgroundScrollPointerUp(event);
}

// Однократно потребляет suppressClick после drag, чтобы pointerup не пропустил ролик.
function consumeStoryVideoControllerSuppressedClick() {
  if (!backgroundScroll.suppressClick) return false;
  backgroundScroll.suppressClick = false;
  return true;
}

// Возвращает фактическое runtime-состояние, используемое keyboard и overlay-обработчиками модуля.
function isStoryVideoControllerActive() {
  return !!state.inVideo;
}

// Продолжает сцену, если команда video не имеет обязательного DOM или src.
function handleStoryVideoControllerUnavailable() {
  console.warn("[VIDEO] story video skipped: missing DOM or src", state.sceneId, state.actionIndex - 1);
  state.inVideo = false;
  state.nextLocked = false;
  runCurrent();
}

// Завершает координаторную часть video-команды после очистки media и таймеров внутри модуля.
function handleStoryVideoControllerFinish(reason) {
  state.inVideo = false;
  state.waitingNext = false;
  state.nextLocked = false;
  audioController.setDuckingForActiveVideos("story video finished: " + (reason || "done"));

  autosaveDebugLog("finishStoryVideo:before_runCurrent", {
    reason: reason || "done",
    sceneId: state.sceneId,
    actionIndex: state.actionIndex
  });

  // Продвигаем очередь синхронно, чтобы pagehide не сохранил промежуточное заблокированное состояние.
  runCurrent();

  autosaveDebugLog("finishStoryVideo:after_runCurrent", {
    sceneId: state.sceneId,
    actionIndex: state.actionIndex,
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked,
    elTextLen: elText ? String(elText.textContent || "").length : -1
  });

  autosaveController.flush();
  lastNextTime = 0;
}

// Контроллер владеет DOM-слоями, fallback, таймерами и глобальными событиями сюжетного видео.
var storyVideoController = window.VN_STORY_VIDEO_CONTROLLER.createStoryVideoController({
  overlay: elStoryVideoOverlay,
  video: elStoryVideo,
  poster: elStoryVideoPoster,
  fallbackText: elStoryVideoFallbackText,
  skipHint: elStoryVideoSkipHint,
  eventTarget: document,
  resolveAssetUrl: resolveStoryVideoControllerAssetUrl,
  normalizeUrl: normalizeAssetUrl,
  sanitizeResource: sanitizeDiagnosticResource,
  translate: t,
  renderText: renderTextVars,
  setStoryVideoVolume: setStoryVideoControllerVolume,
  updateAudioDucking: updateStoryVideoControllerDucking,
  setScrollOptions: setStoryVideoControllerScrollOptions,
  switchScrollTarget: switchStoryVideoScrollTarget,
  restoreBackgroundScroll: restoreBackgroundScrollAfterStoryVideo,
  updateScrollAvailability: updateBackgroundScrollAvailability,
  isScrollTarget: isStoryVideoControllerScrollTarget,
  isScrollDragging: isStoryVideoControllerScrollDragging,
  finishScrollPointer: finishStoryVideoControllerScrollPointer,
  consumeSuppressedClick: consumeStoryVideoControllerSuppressedClick,
  swallowEvent: swallowEvent,
  updateBlurBackground: updateBlurBackground,
  syncBlurVideo: syncBlurBackgroundVideo,
  shouldKeepUntilBackgroundVideo: nextActionIsBackgroundVideo,
  isStoryVideoActive: isStoryVideoControllerActive,
  onUnavailable: handleStoryVideoControllerUnavailable,
  onFinish: handleStoryVideoControllerFinish,
  visualTrace: visualTrace,
  writeVerbose: writeRuntimeVerbose,
  warn: console.warn.bind(console),
  clamp: clamp
});
var storyVideoRuntime = storyVideoController.state;
storyVideoController.startLifecycle();

function cleanupStoryVideoVisualOnly() {
  // Restart и смена режима очищают модуль без автоматического продолжения сцены.
  storyVideoController.cleanupVisualOnly();
}

function isTransparentActionBeforeBackground(action) {
  // Скрытие персонажа не меняет фон, поэтому не должно мешать удержанию видео до следующего bg.
  if (!action) return false;
  if (action.type === "char") {
    return !action.src && !action.charId && !action.emotion;
  }
  return false;
}

function nextActionIsBackgroundVideo() {
  // Ищем ближайший следующий bg, пропуская только команды, которые не меняют видимый фон.
  var scene = state.sceneMap[state.sceneId];
  if (!scene || !scene.actions) return false;

  for (var i = state.actionIndex; i < scene.actions.length; i++) {
    var nextAction = scene.actions[i];
    if (!nextAction) return false;

    if (isTransparentActionBeforeBackground(nextAction)) {
      continue;
    }

    if (nextAction.type !== "bg") {
      visualTrace("storyVideo:next-bg-search-stop", {
        actionIndex: i,
        actionType: nextAction.type || ""
      });
      return false;
    }

    var bgAssetInfo = resolveBackgroundAsset(nextAction.src);
    var isNextBgVideo = isVideoAssetPath(bgAssetInfo.file);
    visualTrace("storyVideo:next-bg-found", {
      actionIndex: i,
      src: bgAssetInfo.file,
      isVideo: isNextBgVideo
    });
    return isNextBgVideo;
  }

  return false;
}

function hideKeptStoryVideoAfterBgReady(reason) {
  // Новый видеофон сообщает контроллеру, что удержанный финальный кадр больше не нужен.
  storyVideoController.hideKeptAfterBackgroundReady(reason);
}

// Запускает сюжетное видео после повторной runtime-проверки видео и постера внутри assets.
function startStoryVideo(action) {
  // Координатор фиксирует checkpoint до запуска media, чтобы F5 повторял текущую video-команду.
  var videoStepIdx = state.actionIndex - 1;
  if (videoStepIdx >= 0) {
    var scVid = state.sceneMap[state.sceneId];
    var actVid = scVid && scVid.actions ? scVid.actions[videoStepIdx] : null;
    if (actVid && actVid.type === "video") {
      var vidCheckpoint = buildAutosavePayload({ persistActionIndex: videoStepIdx });
      if (vidCheckpoint) {
        autosaveDebugLog("checkpoint:video_written", { persistActionIndex: videoStepIdx });
        autosaveController.flush(vidCheckpoint);
      } else {
        autosaveDebugLog("checkpoint:video_skipped", { reason: "build_null", videoStepIdx: videoStepIdx });
      }
    } else {
      autosaveDebugLog("checkpoint:video_skipped", {
        reason: "no_video_action_at_index",
        videoStepIdx: videoStepIdx,
        actualType: actVid ? actVid.type : null
      });
    }
  }

  state.inVideo = true;
  storyVideoController.start(action);
}

function handleStoryVideoSkip(e) {
  // Поля stage используют тот же guard/suppressClick-путь, что overlay и клавиатура контроллера.
  storyVideoController.handleSkip(e);
}

// =========================================================
//                   URL-ЗАПУСК НОВЕЛЛЫ
// =========================================================

// Считает nosave включённым при пустом или любом неотрицательном значении; явные false/0/no/off снова разрешают storage.
function parseStoryNoSaveUrlFlag(normalizedParams) {
  if (!normalizedParams || !Object.prototype.hasOwnProperty.call(normalizedParams, "nosave")) return false;
  var raw = String(normalizedParams.nosave || "").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "no" && raw !== "off";
}

// Разбирает scene/novel/nosave без учёта регистра ключей; при конфликте scene получает приоритет.
function parseStoryUrlLaunchFromUrl() {
  var fallback = { mode: "default", requestedId: "", conflict: false, noSave: false };
  if (typeof window === "undefined" || !window.location || !window.location.search) return fallback;

  try {
    var params = new URLSearchParams(window.location.search);
    var normalized = {};
    params.forEach(function(value, key) {
      normalized[String(key || "").trim().toLowerCase()] = value;
    });

    var sceneId = String(normalized.scene || "").trim();
    var novelId = String(normalized.novel || "").trim();
    var noSave = parseStoryNoSaveUrlFlag(normalized);
    if (sceneId && novelId) {
      console.warn("[VN] Both scene and novel are set; scene mode has priority.");
    }
    if (sceneId) {
      return { mode: "scene", requestedId: sceneId, conflict: !!novelId, noSave: noSave };
    }
    if (novelId) {
      return { mode: "novel", requestedId: novelId, conflict: false, noSave: noSave };
    }
    return { mode: "default", requestedId: "", conflict: false, noSave: noSave };
  } catch (e) {
    console.warn("[VN] URL params parse failed:", e);
    return fallback;
  }
}

// Находит канонический id сцены без учёта регистра, чтобы URL Game01 и game01 означали одну точку входа.
function findStorySceneIdCaseInsensitive(requestedId) {
  var requested = String(requestedId || "").trim();
  if (!requested || !state || !state.sceneMap) return null;

  var normalized = requested.toLowerCase();
  var sceneIds = Object.keys(state.sceneMap);
  var foundSceneId = null;
  for (var i = 0; i < sceneIds.length; i++) {
    if (String(sceneIds[i]).toLowerCase() === normalized) {
      // Два id, отличающиеся только регистром, неоднозначны в регистронезависимом URL-режиме.
      if (foundSceneId !== null) {
        console.warn("[VN] Ambiguous case-insensitive scene id:", requested, foundSceneId, sceneIds[i]);
        return null;
      }
      foundSceneId = sceneIds[i];
    }
  }
  return foundSceneId;
}

// Разрешает сырой URL-параметр после построения sceneMap и сохраняет режим даже при ошибочном имени.
function resolveStoryUrlLaunch() {
  var launch = storyUrlLaunch || { mode: "default", requestedId: "", conflict: false, noSave: false };
  if (launch.mode === "default") {
    return {
      mode: "default",
      requestedId: "",
      sceneId: null,
      valid: true,
      conflict: false,
      noSave: !!launch.noSave
    };
  }

  var sceneId = findStorySceneIdCaseInsensitive(launch.requestedId);
  return {
    mode: launch.mode,
    requestedId: launch.requestedId,
    sceneId: sceneId,
    valid: !!sceneId,
    conflict: !!launch.conflict,
    noSave: !!launch.noSave
  };
}

// =========================================================
//                   МИНИ-ИГРЫ
// =========================================================

// Достаёт параметры автономного запуска из адресной строки: game выбирает ресурс, diff задаёт сложность 1..5.
function parseStandaloneGameLaunchFromUrl() {
  if (!window || !window.location || !window.location.search) return null;

  var params;
  try {
    params = new URLSearchParams(window.location.search);
  } catch (e) {
    console.warn("[GAME] URL params parse failed:", e);
    return null;
  }

  var gameId = String(params.get("game") || "").trim();
  if (!gameId) return null;

  var rawDifficulty = params.has("diff") ? params.get("diff") : params.get("difficulty");
  var difficulty = normalizeStandaloneGameDifficulty(rawDifficulty);
  var gameParams = {};

  params.forEach(function(value, key) {
    var normalizedKey = String(key || "").trim();
    if (!normalizedKey || normalizedKey === "game" || normalizedKey === "diff") return;
    gameParams[normalizedKey] = value;
  });

  // Внутренний API игр ожидает difficulty; diff остаётся только коротким параметром адресной строки.
  gameParams.difficulty = difficulty;
  if (!Object.prototype.hasOwnProperty.call(gameParams, "source")) {
    gameParams.source = "urlGame";
  }

  return {
    gameId: gameId,
    difficulty: difficulty,
    params: gameParams
  };
}

// Приводит сложность из URL к диапазону меню 1..5, а любой мусор заменяет обычной сложностью 3.
function normalizeStandaloneGameDifficulty(value) {
  var parsed = parseInt(String(value == null ? "" : value), 10);
  if (!isFinite(parsed) || parsed < 1 || parsed > 5) return 3;
  return parsed;
}

// Делает плоскую копию параметров, чтобы openGame мог безопасно дописать служебные значения без мутации источника.
function copyGameParams(params) {
  var copy = {};
  if (!params || typeof params !== "object") return copy;

  Object.keys(params).forEach(function(key) {
    copy[key] = params[key];
  });

  return copy;
}

// Добавляет параметры запуска в iframe-URL игры: это помогает играм, которые читают настройки до postMessage.
function appendGameParamsToUrl(src, params) {
  var source = String(src || "");
  if (!source || !params || typeof params !== "object") return source;

  var queryParts = [];
  Object.keys(params).forEach(function(key) {
    var value = params[key];
    if (value === undefined || value === null) return;
    queryParts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
  });

  if (!queryParts.length) return source;

  var hash = "";
  var base = source;
  var hashIndex = source.indexOf("#");
  if (hashIndex >= 0) {
    base = source.slice(0, hashIndex);
    hash = source.slice(hashIndex);
  }

  return base + (base.indexOf("?") >= 0 ? "&" : "?") + queryParts.join("&") + hash;
}

// Собирает action для URL-запуска из [game]; изоляция всегда задаётся runtime в строгом режиме.
function createStandaloneGameAction(launch) {
  if (!launch || !launch.gameId) return null;

  var games = (STORY && STORY.assets && STORY.assets.games) ? STORY.assets.games : {};
  var rawGame = games[launch.gameId];
  if (!rawGame) return null;

  var file = "";
  var title = launch.gameId;
  if (typeof rawGame === "string") {
    file = rawGame;
  } else if (rawGame && typeof rawGame === "object") {
    file = String(rawGame.file || "").trim();
    title = rawGame.title || launch.gameId;
  }

  if (!file) return null;

  return {
    type: "game",
    mode: "url",
    gameId: launch.gameId,
    title: title,
    src: file,
    difficulty: launch.difficulty,
    resultVar: null,
    params: copyGameParams(launch.params)
  };
}

// Переключает визуальный режим страницы: в URL-запуске остаётся только чёрный фон и окно игры.
function setStandaloneGameModeEnabled(enabled) {
  if (elStage) {
    elStage.classList.toggle("url-game-mode", !!enabled);
  }
}

// Открывает мини-игру из адресной строки и сообщает caller, нужно ли пропускать обычный запуск новеллы.
function startStandaloneGameFromUrl() {
  if (!standaloneGameLaunch) return false;

  var action = createStandaloneGameAction(standaloneGameLaunch);
  if (!action) {
    console.warn("[GAME] URL game not found or has no file:", standaloneGameLaunch.gameId);
    return false;
  }

  setStandaloneGameModeEnabled(true);
  state.inGame = false;
  state.currentGame = null;
  state.waitingNext = false;
  state.nextLocked = true;
  hideChoices();
  hideOverlay();

  openGame(action);
  return true;
}

// Полностью пересоздаёт iframe URL-игры с теми же параметрами, не возвращаясь в сценарий.
function restartStandaloneGameFromUrl() {
  if (!standaloneGameLaunch) return;

  gameHost.closeFrame("story");
  state.inGame = false;
  state.currentGame = null;
  startStandaloneGameFromUrl();
}

// Проверяет, что сюжетная кнопка модалки сейчас обслуживает автономную игру из URL.
function isCurrentStoryGameUrlMode() {
  return !!(state && state.currentGame && state.currentGame.mode === "url");
}

// Проверяет сюжетную игру, фиксирует checkpoint и делегирует host безопасную навигацию и отправку gameInit.
function openGame(action) {
  if (!action || !action.src) {
    console.warn('[GAME] openGame: missing action.src', state.sceneId, state.actionIndex - 1);
    return;
  }

  var safeGameSrc = resolveRuntimeStoryAssetUrl(action.src, "game");
  if (!safeGameSrc) {
    console.warn("[GAME] Запуск заблокирован политикой локальных ресурсов", sanitizeDiagnosticResource(action.src));
    return;
  }
  if (!gameHost.canOpen("story", true)) return;

  // Пока inGame=true, buildAutosavePayload не пишет слот — фиксируем индекс шага «game» до открытия модалки.
  var gameStepIdx = state.actionIndex - 1;
  if (gameStepIdx >= 0) {
    var scGame = state.sceneMap[state.sceneId];
    var actGame = scGame && scGame.actions ? scGame.actions[gameStepIdx] : null;
    if (actGame && actGame.type === "game") {
      var checkpoint = buildAutosavePayload({ persistActionIndex: gameStepIdx });
      if (checkpoint) {
        autosaveDebugLog("checkpoint:game_written", { persistActionIndex: gameStepIdx });
        autosaveController.flush(checkpoint);
      } else {
        autosaveDebugLog("checkpoint:game_skipped", { reason: "build_null", gameStepIdx: gameStepIdx });
      }
    } else {
      autosaveDebugLog("checkpoint:game_skipped", {
        reason: "no_game_action_at_index",
        gameStepIdx: gameStepIdx,
        actualType: actGame ? actGame.type : null
      });
    }
  }

  var normalizedParams = copyGameParams(action.params || {});
  if (action.difficulty !== undefined) {
    normalizedParams.difficulty = action.difficulty;
  }

  var currentGameId = action.gameId || 'game';
  var gameFrameSrc = action.mode === "url"
    ? appendGameParamsToUrl(safeGameSrc, normalizedParams)
    : safeGameSrc;
  var gameSession = gameHost.open({
    frameKind: "story",
    gameId: currentGameId,
    src: gameFrameSrc,
    params: normalizedParams,
    mode: action.mode || null
  });
  if (!gameSession) return;

  state.inGame = true;
  state.currentGame = {
    mode: action.mode || null,
    gameId: currentGameId,
    title: action.title || currentGameId,
    difficulty: normalizedParams.difficulty,
    src: safeGameSrc,
    sandboxMode: "strict",
    resultVar: action.resultVar || null,
    params: normalizedParams,
    session: gameSession
  };
}

// Нормализует результат, закрывает текущую игру и продолжает соответствующий режим движка.
function closeGame(resultData) {
  var finishedGame = state.currentGame;
  var manualClose = !!(resultData && resultData.manualClose === true);
  var resultValue = window.VN_GAME_PROTOCOL.normalizeGameResult(resultData);

  // Любой способ завершения немедленно инвалидирует сессию, включая ручное закрытие и URL-режим.
  if (finishedGame && finishedGame.session) {
    finishedGame.session.resultAccepted = true;
  }

  if (finishedGame && finishedGame.mode === "url" && !manualClose) {
    // В URL-режиме у новеллы нет точки возврата, поэтому результат только запоминаем и оставляем окно игры открытым.
    finishedGame.result = resultValue;
    finishedGame.finished = true;
    writeRuntimeDebug("[VN DEBUG] Результат URL-игры принят", finishedGame.gameId);
    return;
  }

  if (finishedGame && finishedGame.mode === "stats") {
    gameHost.closeFrame("stats");
  } else {
    gameHost.closeFrame("story");
  }
  state.inGame = false;

  if (!finishedGame) {
    state.waitingNext = false;
    state.nextLocked = false;
    return;
  }

  // Standalone запуск из панели "Игры" не должен влиять на сценарий
  if (finishedGame.mode === "stats") {
    lastStandaloneGameInfo = {
      gameId: finishedGame.gameId,
      title: finishedGame.title || finishedGame.gameId,
      difficulty: finishedGame.difficulty,
      result: resultValue,
      manualClose: manualClose
    };

    state.currentGame = null;
    // ⚠️ НЕ сбрасываем waitingNext и nextLocked – они не относятся к игре из статистики
    // state.waitingNext = false;
    // state.nextLocked = false;

    renderGamesCatalog();
    // Каталог пересоздаёт кнопки уровней, поэтому устойчиво возвращаем фокус на вкладку игр.
    focusUiElement(btnShowGames);
    return;
  }

  // Обычный сюжетный режим игры
  if (finishedGame.resultVar) {
    state.vars[finishedGame.resultVar] = resultValue;
    writeRuntimeDebug("[VN DEBUG] Результат игры сохранён", finishedGame.gameId, "->", finishedGame.resultVar);
  }

  state.currentGame = null;
  state.waitingNext = false;
  state.nextLocked = false;

  autosaveDebugLog("closeGame:before_runCurrent", {
    sceneId: state.sceneId,
    actionIndex: state.actionIndex,
    resultVar: finishedGame.resultVar,
    manualClose: manualClose
  });

  // Нельзя откладывать runCurrent: между closeGame и следующим тиком в storage попадает «мертвое» состояние
  // (nextLocked=true, waitingNext=false), страница после F5 не реагирует на «дальше» и теряет текст.
  runCurrent();

  autosaveDebugLog("closeGame:after_runCurrent", {
    sceneId: state.sceneId,
    actionIndex: state.actionIndex,
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked,
    elTextLen: elText ? String(elText.textContent || "").length : -1
  });

  autosaveController.flush();
  // Закрытие модалки по кнопке задаёт lastNextTime — снимаем охладитель, чтобы первый клик по диалогу прошёл.
  lastNextTime = 0;
}

// =========================================================
//                   АУДИО
// =========================================================

function setAudioFromStoryDefaults() {
  // Координатор передаёт перезапуск настроек контроллеру, который владеет UI и каналами.
  audioController.setFromDefaults();
}

function applyAudioSettings() {
  // Все вычисления master/mute/ducking выполняются внутри единого аудиоконтроллера.
  audioController.applySettings();
}

// ---------- BGM ducking ----------
// Маршрутизирует визуальные переходы к владельцу таймера и громкости BGM.
function setBgmDuckingTarget(targetMultiplier, fadeMs, reason) {
  // Оставляет переходы панорам и фонов координатором, а таймер ducking — владельцу аудиоресурсов.
  audioController.setBgmDuckingTarget(targetMultiplier, fadeMs, reason);
}

function setBgmDuckingForActiveVideos(reason) {
  // Контроллер сам объединяет слышимость сюжетного и фонового видео в один ducking-канал.
  audioController.setDuckingForActiveVideos(reason);
}

// Возобновляет фоновое видео после жеста пользователя, если звук интерфейса уже включен.
function resumeBackgroundVideoIfNeeded(reason) {
  // Пользовательский жест маршрутизируется владельцу настроек и media-элемента.
  audioController.resumeBackgroundVideoIfNeeded(reason);
}

function resumeBgmIfNeeded(reason) {
  // Повторный запуск BGM выполняется контроллером с проверкой mute, src и списка ошибок.
  audioController.resumeBgmIfNeeded(reason);
}

// Воспроизводит BGM только после проверки аудиофайла общей политикой локальных ресурсов.
function playBgm(src, loop, vol, fadeMs) {
  // Команда сценария передаётся модулю вместе с уже внедрённой политикой разрешённых путей.
  audioController.playBgm(src, loop, vol, fadeMs);
}

function stopBgmImmediate() {
  // Немедленная очистка канала остаётся координаторной командой без прямого управления Audio.
  audioController.stopBgmImmediate();
}

// Воспроизводит звуковой эффект только из разрешённого аудиофайла внутри assets.
function playSfx(src, vol) {
  // Эффект использует отдельный канал контроллера и общую политику ресурсов.
  audioController.playSfx(src, vol);
}

// =========================================================
//                   ASSET RESOLVE
// =========================================================

// Разрешает алиасы ресурсов и применяет image-кэш только к растру, не отправляя видео и CSS-панорамы в image-политику.
function resolveAsset(ref, charId, emotion) {
  // СНАЧАЛА проверяем персонажей, если есть charId и emotion
  if (charId && emotion && STORY.assets && STORY.assets.characters) {
    const char = STORY.assets.characters[charId];

    if (char && char.images) {
      const imagePath = characterController.getImagePath(char.images[emotion]);

      if (imagePath) {
        if (areAllImageCandidatesFailed(imagePath)) {
          return "";
        }

        return imagePath;
      }
    }
  }
  
  // ТОЛЬКО ПОТОМ проверяем ref === null
  if (ref === null) {
    return null;
  }
  
  if (!ref) {
    return "";
  }
  
  if (typeof ref !== "string") {
    return "";
  }
  
  // Если это прямой путь (не алиас)
  if (ref.indexOf("@") !== 0) {
    return ref;
  }
  
  // Обработка алиасов @bg.xxx, @audio.xxx
  var parts = ref.substring(1).split(".");
  if (parts.length < 2) {
    return "";
  }

  var group = parts[0];
  var key = parts.slice(1).join(".");

  if (!STORY.assets) {
    return "";
  }

  if (group === "bg") {
    if (!STORY.assets.backgrounds) {
      return "";
    }

    const result = STORY.assets.backgrounds[key];
    var bgPath = getBackgroundAssetPrimaryPath(result);

    if (bgPath && !isVideoAssetPath(bgPath) && !isBg360PackCssPath(bgPath) && areAllImageCandidatesFailed(bgPath)) {
      return "";
    }
    return bgPath || "";
  }
  
  if (group === "audio") {
    if (!STORY.assets.audio) {
      return "";
    }
    const result = STORY.assets.audio[key];
    return getAudioAssetPrimaryPath(result);
  }

  return "";
}

// Собирает путь и базовую громкость аудио-ассета, не меняя поведение прямых путей.
function resolveAudioAsset(ref) {
  var file = resolveAsset(ref);
  var volume = null;

  if (typeof ref === "string" && ref.indexOf("@audio.") === 0 && STORY && STORY.assets && STORY.assets.audio) {
    var audioId = ref.substring(7);
    var audioEntry = STORY.assets.audio[audioId];
    file = getAudioAssetPrimaryPath(audioEntry);
    volume = getAudioAssetVolume(audioEntry);
  }

  return {
    file: file || "",
    volume: volume
  };
}

// Собирает все настройки фонового ассета, чтобы команда bg не знала детали [bg].
function resolveBackgroundAsset(ref) {
  var file = resolveAsset(ref);
  var fallback = "";
  var volume = null;
  var scroll = { enabled: false, start: 0.5, focusX: null, focusY: null, scale: 1 };
  var focusX = null;
  var focusY = null;
  var scale = null;
  var is360 = false;
  var focusZ = null;
  var fov = null;
  var quality = null;
  var userFocus = false;

  if (typeof ref === "string" && ref.indexOf("@bg.") === 0 && STORY && STORY.assets && STORY.assets.backgrounds) {
    var bgId = ref.substring(4);
    var bgEntry = STORY.assets.backgrounds[bgId];
    fallback = getBackgroundAssetFallbackPath(bgEntry);
    volume = getBackgroundAssetVolume(bgEntry);
    scroll = getBackgroundAssetScrollOptions(bgEntry);
    focusX = getBackgroundAssetFocusX(bgEntry);
    focusY = getBackgroundAssetFocusY(bgEntry);
    scale = getBackgroundAssetScale(bgEntry);
    is360 = getBackgroundAssetIs360(bgEntry);
    focusZ = getBackgroundAssetFocusZ(bgEntry);
    fov = getBackgroundAssetFov(bgEntry);
    quality = getBackgroundAssetQuality(bgEntry);
    if (bgEntry && typeof bgEntry === "object" && bgEntry.userFocus === true) {
      userFocus = true;
    }
  }

  return {
    file: file,
    fallback: fallback,
    volume: volume,
    scroll: scroll,
    focusX: focusX,
    focusY: focusY,
    scale: scale,
    is360: is360,
    focusZ: focusZ,
    fov: fov,
    quality: quality,
    userFocus: userFocus
  };
}


// =========================================================
// МАСШТАБ ИНТЕРФЕЙСА
// =========================================================

// Определяет по User-Agent, что клиент — смартфон (не планшет, не ТВ, не десктоп).
// При малейших сомнениях возвращает false, чтобы не включать UI_PHONE_EXTRA_FONT_SCALE на больших экранах.
function detectConfidentPhoneUserAgent() {
  var ua = String(navigator.userAgent || "");
  if (!ua) return false;
  // Типичные ТВ и приставки: даже при узком viewport не усиливаем масштаб как на телефоне.
  if (/SmartTV|SMART-TV|HbbTV|BRAVIA|Philips TV|Tizen|webOS|CrKey|Chromecast|AFTB|AFTM|PlayStation|Xbox/i.test(ua)) {
    return false;
  }
  if (/iPhone/i.test(ua)) {
    return true;
  }
  if (/iPad/i.test(ua)) {
    return false;
  }
  if (/Android/i.test(ua)) {
    return /Mobile/i.test(ua);
  }
  try {
    var uad = navigator.userAgentData;
    if (uad && uad.mobile === true && (/Android/i.test(ua) || /iPhone/i.test(ua))) {
      return true;
    }
  } catch (e) {
    // Недоступный userAgentData оставляет консервативный результат проверки по userAgent.
  }
  return false;
}

// Проверяет, что размер окна похож на удерживаемый в руке экран (узкая короткая сторона, вытянутый формат).
// Без этого узкое окно браузера на ПК с телефонным UA (редко, но возможно) не должно получать буст.
function detectConfidentPhoneViewport() {
  var w = window.innerWidth;
  var h = window.innerHeight;
  if (!(w > 0 && h > 0)) return false;
  var shortSide = Math.min(w, h);
  var longSide = Math.max(w, h);
  if (shortSide > UI_PHONE_VIEWPORT_MAX_SHORT_PX) return false;
  if (longSide / shortSide < UI_PHONE_VIEWPORT_MIN_ASPECT) return false;
  return true;
}

// Консервативное объединение: только одновременно «телефонный» UA и «телефонный» viewport.
function isConfidentPhoneForUiBoost() {
  return detectConfidentPhoneUserAgent() && detectConfidentPhoneViewport();
}

function applyUiScale() {
  // JS считает только корневой масштаб,
  // а размеры конкретных компонентов берутся из CSS-токенов.
  var autoScale = window.innerHeight / UI_REFERENCE_HEIGHT;
  autoScale = clamp(autoScale, 0.25, 10);

  var phoneExtra = isConfidentPhoneForUiBoost() ? UI_PHONE_EXTRA_FONT_SCALE : 1;
  var finalScale = UI_FONT_SCALE * autoScale * phoneExtra;
  finalScale = clamp(finalScale, 0.25, 10);

  document.documentElement.style.setProperty("--uiScale", finalScale);
  document.documentElement.style.setProperty("--uiPhoneExtraScale", String(phoneExtra));

  // Визуальные эффекты считаются отдельно от UI_FONT_SCALE, чтобы blur,
  // бордеры и тени сохраняли привычную силу при ручном масштабе интерфейса.
  var visualReferenceHeight = Math.max(1, UI_VISUAL_REFERENCE_HEIGHT || UI_REFERENCE_HEIGHT);
  var visualMinHeight = Math.max(1, UI_VISUAL_MIN_HEIGHT || 1);
  var visualHeight = Math.max(window.innerHeight, visualMinHeight);
  var visualScale = clamp(visualHeight / visualReferenceHeight, 0.05, 10);
  document.documentElement.style.setProperty("--viewportScale", visualScale);
  document.documentElement.style.setProperty("--visualScale", visualScale);

  // Должно совпадать с --baseFontPx в CSS.
  var baseFontPx = 16;
  var baseFontSize = baseFontPx * finalScale;
  document.documentElement.style.setProperty("--baseFontSize", baseFontSize + 'px');

  if (isExplicitDebugCategoryEnabled("visual")) {
    console.log('[SCALE DEBUG]', {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      referenceHeight: UI_REFERENCE_HEIGHT,
      autoScale: autoScale,
      visualReferenceHeight: visualReferenceHeight,
      visualMinHeight: visualMinHeight,
      visualScale: visualScale,
      uiFontScale: UI_FONT_SCALE,
      uiPhoneExtraFontScale: UI_PHONE_EXTRA_FONT_SCALE,
      phoneBoostApplied: phoneExtra !== 1,
      phoneExtra: phoneExtra,
      finalScale: finalScale,
      baseFontPx: baseFontPx,
      baseFontSize: baseFontSize,
      cssVarBaseFontSize: getComputedStyle(document.documentElement).getPropertyValue('--baseFontSize').trim(),
      htmlFontSize: getComputedStyle(document.documentElement).fontSize
    });
  }
}


// Вызываем при загрузке
setTimeout(function() {
  applyUiScale();
}, 100);

// Также добавляем логи для события resize
window.addEventListener("resize", function() {
  applyUiScale();
  applySpacingSettings();

  if (elStatsGameModal && !elStatsGameModal.classList.contains("hidden")) {
    syncStatsGameFrameWrapToStoryGameWindow();
  }
});


// =========================================================
//                   UTILS
// =========================================================

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function num(x, fallback) {
  return (typeof x === "number" && !isNaN(x)) ? x : fallback;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function endsWith(full, ending) {
  // full может быть "file:///C:/.../assets/bgm.mp3"
  // ending "assets/bgm.mp3"
  // сравнение по хвосту
  try {
    return String(full).slice(-String(ending).length) === String(ending);
  } catch (e) {
    return false;
  }
}









function toggleStatsPanel() {
  if (elStatsPanel.classList.contains("hidden")) showStatsPanel();
  else hideStatsPanel();
}

// Формирует краткую версию движка и по запросу добавляет технические форматы и метаданные только для статистики.
function formatRuntimeCompatibilityInfo(includeFormatVersions) {
  var lines = ["Engine: " + window.APP_VERSION];

  if (includeFormatVersions) {
    var meta = window.STORY && window.STORY.meta ? window.STORY.meta : {};
    var projectId = String(meta.projectId || "").trim() || "(not set)";
    lines.push("Story DSL: " + window.VN_STORY_DSL_VERSION);
    lines.push("STORY360: " + window.VNStorySandboxLoader.STORY360_FORMAT_VERSION);
    lines.push("Panorama CSS: " + window.VN_PANORAMA_PACKAGE_CONTROLLER.CSS_PACK_FORMAT_VERSION);
    lines.push("Game protocol: " + window.VN_GAME_PROTOCOL.GAME_PROTOCOL_VERSION);
    lines.push("Project ID: " + projectId);
    lines.push("Runtime mode: " + getStoryMode());
  }

  return lines.join("\n") + "\n";
}

// Формирует содержимое окна информации: совместимость runtime, лицензия и контакты проекта.
function renderSettingsPanel() {
  if (!elSettingsBody) return;
  var text = "";
  text += formatRuntimeCompatibilityInfo(false) + "\n";
  text += formatLicenseStatsText();
  text += "\n";
  text += "Site of project: https://github.com/IlyaBarilo/vn-vertical-engine\n\n";
  text += "Developer: Ilya Barilo (www.barilo.ru)\n\n";
  elSettingsBody.value = text;
}

function toggleSettingsPanel() {
  if (!elSettingsPanel) return;
  if (elSettingsPanel.classList.contains("hidden")) showSettingsPanel();
  else hideSettingsPanel();
}

// Открывает информацию, запоминает источник и переводит фокус на доступную кнопку закрытия.
function showSettingsPanel() {
  if (!elSettingsPanel) return;
  settingsPanelReturnFocus = getCurrentUiFocusTarget(btnSettings);
  if (elStatsPanel && !elStatsPanel.classList.contains("hidden")) {
    // Окно статистики скрывается без setStatsView, поэтому отдельно отменяем отложенный рендер графа.
    graphRenderSequence++;
    elStatsPanel.classList.add("hidden");
    statsPanelReturnFocus = null;
  }
  renderSettingsPanel();
  elSettingsPanel.classList.remove("hidden");
  focusUiElement(btnCloseSettings);
}

// Закрывает информацию и возвращает фокус элементу, которым пользователь открыл панель.
function hideSettingsPanel() {
  if (!elSettingsPanel) return;
  var returnFocus = settingsPanelReturnFocus;
  settingsPanelReturnFocus = null;
  elSettingsPanel.classList.add("hidden");
  tryResumeNovelAfterStatsClose("hideSettingsPanel");
  focusUiElement(returnFocus || btnSettings);
}

// Открывает статистику, запоминает источник и удерживает начальный фокус внутри панели.
function showStatsPanel() {
  statsPanelReturnFocus = getCurrentUiFocusTarget(btnStats);
  if (elSettingsPanel && !elSettingsPanel.classList.contains("hidden")) {
    elSettingsPanel.classList.add("hidden");
    settingsPanelReturnFocus = null;
  }
  setStatsView("text");

  // Принудительно сбрасываем panzoom состояние
  resetPanzoom();

  renderStats();
  elStatsPanel.classList.remove("hidden");
  focusUiElement(btnCloseStats);
}

// Аккуратно восстанавливает поток новеллы после закрытия статистики, если UI оставил движок в подвешенном состоянии.
function tryResumeNovelAfterStatsClose(reason) {
  if (!state) return;
  if (state.inGame || state.inVideo) return;
  if (elSettingsPanel && !elSettingsPanel.classList.contains("hidden")) return;
  if (elStatsPanel && !elStatsPanel.classList.contains("hidden")) return;
  if (elChoices && !elChoices.classList.contains("hidden")) return;
  if (state.waitingNext) return;

  var scene = state.sceneMap ? state.sceneMap[state.sceneId] : null;
  if (!scene || !Array.isArray(scene.actions)) return;

  var hasPendingActions = Array.isArray(state.pendingActions) && state.pendingActions.length > 0;
  var hasActionsAhead = state.actionIndex < scene.actions.length;
  if (!hasPendingActions && !hasActionsAhead) return;

  // Если блокировка "next" осталась после UI-оверлея, снимаем её и продолжаем выполнение сцены.
  state.nextLocked = false;
  writeRuntimeVerbose("[STATS] resume novel flow after close", {
    reason: reason || "stats_close",
    sceneId: state.sceneId,
    actionIndex: state.actionIndex,
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked
  });
  runCurrent();
}

// Закрывает статистику и возвращает фокус, не изменяя текущий вид диагностического отчёта.
function hideStatsPanel() {
  var returnFocus = statsPanelReturnFocus;
  statsPanelReturnFocus = null;
  // Закрытие панели не меняет currentStatsView, но все отложенные операции графа уже неактуальны.
  graphRenderSequence++;
  elStatsPanel.classList.add("hidden");
  tryResumeNovelAfterStatsClose("hideStatsPanel");
  focusUiElement(returnFocus || btnStats);
}


// Собирает каталог игр без параметров доверия: статистика запускает каждую игру только в строгом sandbox.
function getGamesCatalogItems() {
  var games = (STORY && STORY.assets && STORY.assets.games) ? STORY.assets.games : {};
  var gameIds = Object.keys(games);

  var items = [];
  for (var i = 0; i < gameIds.length; i++) {
    var gameId = gameIds[i];
    var raw = games[gameId];
    var item = {
      id: gameId,
      file: "",
      title: gameId,
      description: "",
      cover: ""
    };

    if (typeof raw === "string") {
      item.file = raw;
    } else if (raw && typeof raw === "object") {
      item.file = typeof raw.file === "string" ? raw.file : "";
      item.title = raw.title || gameId;
      item.description = raw.description || "";
      item.cover = raw.cover || "";
    }

    items.push(item);
  }

  return items;
}

function renderGamesLaunchStatus() {
  if (!gamesStatus) return;

  gamesStatus.classList.remove("ok", "warn");

  if (!lastStandaloneGameInfo) {
    gamesStatus.textContent = t("gamesLastLaunchNone");
    return;
  }

  var text;
  if (lastStandaloneGameInfo.manualClose) {
    text = t("gamesLastLaunchClosed")
      .replace("{title}", lastStandaloneGameInfo.title)
      .replace("{difficulty}", String(lastStandaloneGameInfo.difficulty));
    gamesStatus.classList.add("warn");
  } else {
    text = t("gamesLastLaunchResult")
      .replace("{title}", lastStandaloneGameInfo.title)
      .replace("{difficulty}", String(lastStandaloneGameInfo.difficulty))
      .replace("{result}", String(lastStandaloneGameInfo.result));
    gamesStatus.classList.add("ok");
  }

  gamesStatus.textContent = text;
}

function renderGamesCatalog() {
  if (!gamesGrid) return;

  var items = getGamesCatalogItems();
  gamesGrid.innerHTML = "";
  renderGamesLaunchStatus();

  if (!items.length) {
    var empty = document.createElement("div");
    empty.className = "gameCatalogNoCover";
    empty.textContent = t("gamesNoGames") || "(none)";
    gamesGrid.appendChild(empty);
    return;
  }

  items.forEach(function(item) {
    var card = document.createElement("div");
    card.className = "gameCatalogCard";

    var coverWrap = document.createElement("div");
    coverWrap.className = "gameCatalogCoverWrap";

    if (item.cover) {
      var img = document.createElement("img");
      img.className = "gameCatalogCover";
      img.alt = item.title;
      img.loading = "lazy";
      assignRasterImageToElement(img, item.cover, {
        onAllFailed: function() {
          coverWrap.innerHTML = "";
          var noCover = document.createElement("div");
          noCover.className = "gameCatalogNoCover";
          noCover.textContent = t("gamesNoCover");
          coverWrap.appendChild(noCover);
        }
      });
      coverWrap.appendChild(img);
    } else {
      var noCover = document.createElement("div");
      noCover.className = "gameCatalogNoCover";
      noCover.textContent = t("gamesNoCover");
      coverWrap.appendChild(noCover);
    }

    var body = document.createElement("div");
    body.className = "gameCatalogBody";

    var title = document.createElement("div");
    title.className = "gameCatalogTitle";
    title.textContent = item.title;

    var id = document.createElement("div");
    id.className = "gameCatalogId";
    id.textContent = item.id;

    var desc = document.createElement("div");
    desc.className = "gameCatalogDescription";
    desc.textContent = item.description || "";

    var actions = document.createElement("div");
    actions.className = "gameCatalogActions";

    for (var difficulty = 1; difficulty <= 5; difficulty++) {
      (function(level) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "gameCatalogLaunchBtn";
        btn.textContent = String(level);
        btn.disabled = !item.file;

        if (
          lastStandaloneGameInfo &&
          lastStandaloneGameInfo.gameId === item.id &&
          lastStandaloneGameInfo.difficulty === level
        ) {
          btn.classList.add("is-active");
        }

        btn.addEventListener("click", function() {
          openStatsGame(item, level);
        });

        actions.appendChild(btn);
      })(difficulty);
    }

    body.appendChild(title);
    body.appendChild(id);
    body.appendChild(desc);
    body.appendChild(actions);

    card.appendChild(coverWrap);
    card.appendChild(body);
    gamesGrid.appendChild(card);
  });
}

// Проверяет ресурс игры из статистики и делегирует host отдельную сессию в iframe со строгим sandbox.
function openStatsGame(item, difficulty) {
  if (!item || !item.file) {
    if (gamesStatus) {
      gamesStatus.textContent = t("gamesLaunchFailed");
      gamesStatus.classList.remove("ok");
      gamesStatus.classList.add("warn");
    }
    return;
  }

  var safeGameSrc = resolveRuntimeStoryAssetUrl(item.file, "game");
  if (!safeGameSrc) {
    if (gamesStatus) {
      gamesStatus.textContent = t("gamesLaunchFailed");
      gamesStatus.classList.remove("ok");
      gamesStatus.classList.add("warn");
    }
    return;
  }

  var gameParams = {
    difficulty: difficulty,
    source: "statsGamesPanel"
  };
  var gameSession = gameHost.open({
    frameKind: "stats",
    gameId: item.id,
    src: safeGameSrc,
    params: gameParams,
    mode: "stats"
  });
  if (!gameSession) return;

  state.inGame = true;
  state.currentGame = {
    mode: "stats",
    gameId: item.id,
    title: item.title || item.id,
    difficulty: difficulty,
    sandboxMode: "strict",
    resultVar: null,
    params: gameParams,
    session: gameSession
  };
}


// Вспомогательные функции для статистики и проверки story360.
// Собирает имена переменных, которые сценарий объявляет или может записать во время выполнения.
function collectScenarioVariableNames(story) {
  var names = {};

  function addName(name) {
    var key = String(name || "").trim();
    if (isSafeScenarioVariableName(key)) names[key] = true;
  }

  if (story && story.vars && typeof story.vars === "object") {
    Object.keys(story.vars).forEach(addName);
  }

  function visitActions(actions) {
    if (!Array.isArray(actions)) return;
    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];
      if (!action || typeof action !== "object") continue;

      if (action.type === "set" && typeof action.expression === "string") {
        var eqPos = action.expression.indexOf("=");
        if (eqPos > 0) addName(action.expression.substring(0, eqPos));
      }

      if (action.result) addName(action.result);
      if (action.resultVar) addName(action.resultVar);

      if (action.type === "choice" && Array.isArray(action.choices)) {
        for (var c = 0; c < action.choices.length; c++) {
          var choice = action.choices[c];
          if (!choice || typeof choice !== "object") continue;
          if (choice.set && typeof choice.set === "object") {
            Object.keys(choice.set).forEach(addName);
          }
          visitActions(choice.actions);
        }
      }

      if (action.type === "if_block") {
        if (Array.isArray(action.branches)) {
          for (var b = 0; b < action.branches.length; b++) {
            visitActions(action.branches[b] && action.branches[b].actions);
          }
        }
        visitActions(action.elseActions);
      }
    }
  }

  var scenes = story && story.scenes ? story.scenes : [];
  for (var s = 0; s < scenes.length; s++) {
    visitActions(scenes[s] && scenes[s].actions);
  }

  return names;
}

// Проверяет формат имён переменных и находит написания, различающиеся только регистром.
function analyzeScenarioVariableCaseConflicts(story) {
  var groups = {};
  var invalidNames = Object.create(null);

  // Возвращает причину замечания к имени или пустую строку, если имя соответствует правилам.
  function getNameIssue(name) {
    if (!name) return "The variable name is empty.";
    if (/^[0-9]/.test(name)) {
      return "A variable name cannot start with a digit.";
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      return "Use only English letters, digits and _.";
    }
    if (!isSafeScenarioVariableName(name)) {
      return "This variable name is reserved or unsafe.";
    }
    return "";
  }

  // Сохраняет недопустимое написание и все места, где оно встретилось.
  function addInvalidName(name, ref, issue) {
    if (!invalidNames[name]) {
      invalidNames[name] = {
        name: name,
        issue: issue,
        refs: []
      };
    }
    var reference = String(ref || "").trim();
    if (reference && invalidNames[name].refs.indexOf(reference) === -1) {
      invalidNames[name].refs.push(reference);
    }
  }

  // Добавляет исходное написание имени и место его использования в регистронезависимую группу.
  function addName(name, ref) {
    var originalName = String(name || "").trim();
    var issue = getNameIssue(originalName);
    if (issue) {
      addInvalidName(originalName || "(empty)", ref, issue);
      return;
    }

    var normalizedName = originalName.toLowerCase();
    if (!groups[normalizedName]) {
      groups[normalizedName] = {
        normalizedName: normalizedName,
        variants: {}
      };
    }

    var variants = groups[normalizedName].variants;
    if (!variants[originalName]) variants[originalName] = [];
    var reference = String(ref || "").trim();
    if (reference && variants[originalName].indexOf(reference) === -1) {
      variants[originalName].push(reference);
    }
  }

  // Извлекает имена переменных из безопасного выражения без его выполнения.
  function addExpression(expression, ref) {
    var parsed = validateAndCollectSafeExpressionIdentifiers(expression);
    if (!parsed.ok) return;
    var identifiers = parsed.identifiers || [];
    for (var i = 0; i < identifiers.length; i++) {
      addName(identifiers[i], ref);
    }
  }

  // Находит подстановки переменных вида {name} в отображаемом тексте.
  function addTextVariables(text, ref) {
    if (typeof text !== "string") return;
    text.replace(/\{([^}]+)\}/g, function(match, name) {
      addName(name, ref);
      return match;
    });
  }

  // Учитывает переменные, подставляемые вместо чисел в media-параметры.
  function addMediaVariables(item, ref) {
    if (!item || typeof item !== "object") return;
    var fields = ["scale", "focusX", "focusY", "focusZ", "focusx", "focusy", "focusz", "fov"];
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      var value = item[field];
      if (typeof value === "string" && value.trim()) {
        addName(value, ref + " / " + field);
      }
    }
  }

  // Рекурсивно обходит действия, пункты выбора и условные ветки сценария.
  function visitActions(actions, refPrefix) {
    if (!Array.isArray(actions)) return;

    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];
      if (!action || typeof action !== "object") continue;
      var actionRef = refPrefix + " / action " + (i + 1);

      addTextVariables(action.text, actionRef + " / text");
      addTextVariables(action.button, actionRef + " / button");
      addTextVariables(action.title, actionRef + " / title");
      addTextVariables(action.skipText, actionRef + " / skipText");
      addMediaVariables(action, actionRef);

      if (action.type === "set" && typeof action.expression === "string") {
        var eqPos = action.expression.indexOf("=");
        if (eqPos > 0) {
          addName(action.expression.substring(0, eqPos), actionRef + " / set target");
          addExpression(action.expression.substring(eqPos + 1), actionRef + " / set expression");
        }
      }

      if (action.condition) addExpression(action.condition, actionRef + " / condition");
      if (action.key) addName(action.key, actionRef + " / condition key");
      if (action.result) addName(action.result, actionRef + " / result");
      if (action.resultVar) addName(action.resultVar, actionRef + " / result");

      if (action.type === "choice" && Array.isArray(action.choices)) {
        for (var c = 0; c < action.choices.length; c++) {
          var choice = action.choices[c];
          if (!choice || typeof choice !== "object") continue;
          var choiceRef = actionRef + " / choice " + (c + 1);
          addTextVariables(choice.text, choiceRef + " / text");
          if (choice.set && typeof choice.set === "object") {
            Object.keys(choice.set).forEach(function(name) {
              addName(name, choiceRef + " / set");
            });
          }
          visitActions(choice.actions, choiceRef);
        }
      }

      if (action.type === "if_block") {
        var branches = Array.isArray(action.branches) ? action.branches : [];
        for (var b = 0; b < branches.length; b++) {
          var branch = branches[b];
          var branchRef = actionRef + " / branch " + (b + 1);
          if (branch && branch.condition) addExpression(branch.condition, branchRef + " / condition");
          visitActions(branch && branch.actions, branchRef);
        }
        visitActions(action.elseActions, actionRef + " / else");
      }
    }
  }

  if (story && story.vars && typeof story.vars === "object") {
    Object.keys(story.vars).forEach(function(name) {
      addName(name, "[var] or system variable");
    });
  }

  // Служебные имена добавляем в принятом написании, чтобы ловить опечатки при обращении к ним.
  [
    "__licenseValid",
    "__licenseStatus",
    "__licenseMode",
    "__licenseCustomer",
    "__licenseId",
    "__licenseInstallations"
  ].forEach(function(name) {
    addName(name, "system variable");
  });

  var scenes = story && Array.isArray(story.scenes) ? story.scenes : [];
  for (var s = 0; s < scenes.length; s++) {
    var scene = scenes[s] || {};
    visitActions(scene.actions, "scene " + String(scene.id || (s + 1)));
  }

  var assets = story && story.assets ? story.assets : {};
  ["backgrounds", "characters", "videos"].forEach(function(category) {
    var entries = assets[category];
    if (!entries || typeof entries !== "object") return;
    Object.keys(entries).forEach(function(id) {
      var entry = entries[id];
      var entryRef = "[" + category + "] " + id;
      addMediaVariables(entry, entryRef);
      if (category === "characters" && entry && entry.imageOptions) {
        Object.keys(entry.imageOptions).forEach(function(emotion) {
          addMediaVariables(entry.imageOptions[emotion], entryRef + " / " + emotion);
        });
      }
    });
  });

  var root = getStory360Root();
  if (root && root.spaces && typeof root.spaces === "object") {
    Object.keys(root.spaces).forEach(function(spaceId) {
      var panoramas = getStory360Panoramas(root.spaces[spaceId]);
      if (!panoramas) return;
      Object.keys(panoramas).forEach(function(panoramaId) {
        var panorama = panoramas[panoramaId];
        var marks = panorama && (panorama.marks || panorama.hotspots || panorama.points);
        if (!Array.isArray(marks)) return;
        for (var m = 0; m < marks.length; m++) {
          var mark = marks[m] || {};
          var visibleIf = getStory360MarkVisibleIf(mark);
          if (!visibleIf) continue;
          var markId = String(mark.id || ("mark" + (m + 1)));
          addExpression(
            visibleIf,
            "story360 " + spaceId + "." + panoramaId + "#" + markId + " / visibleIf"
          );
        }
      });
    });
  }

  var conflicts = Object.keys(groups).map(function(normalizedName) {
    return groups[normalizedName];
  }).filter(function(group) {
    return Object.keys(group.variants).length > 1;
  }).sort(function(a, b) {
    return a.normalizedName.localeCompare(b.normalizedName);
  });

  return {
    groups: groups,
    conflicts: conflicts,
    invalidNames: Object.keys(invalidNames).map(function(name) {
      return invalidNames[name];
    }).sort(function(a, b) {
      return a.name.localeCompare(b.name);
    })
  };
}

// Формирует раздел статистики с проверкой допустимых символов и потенциальных опечаток в регистре.
function formatScenarioVariableCaseStats(analysis) {
  var info = analysis || analyzeScenarioVariableCaseConflicts(STORY);
  var conflicts = info.conflicts || [];
  var invalidNames = info.invalidNames || [];
  var text = "=== VARIABLES ===\n\n";
  text += "Name rules:\n";
  text += "Allowed: English letters, digits and _. The first character must be a letter or _.\n";
  if (!invalidNames.length) {
    text += "✅ All variable names match the allowed format.\n\n";
  } else {
    text += "⚠️ Invalid variable names: " + invalidNames.length + ".\n";
    for (var n = 0; n < invalidNames.length; n++) {
      var invalid = invalidNames[n];
      text += "- " + invalid.name + ": " + invalid.issue + "\n";
      if (invalid.refs.length) {
        text += "  Used in: " + invalid.refs.join("; ") + "\n";
      }
    }
    text += "\n";
  }

  text += "Case consistency:\n";
  text += "Variable names are case-sensitive.\n";
  if (!conflicts.length) {
    text += "✅ No names differing only by letter case found.\n\n";
    return text;
  }

  text += "⚠️ Potential case typos: " + conflicts.length + " group(s).\n";
  text += "Each spelling below is currently a different runtime variable.\n\n";

  for (var i = 0; i < conflicts.length; i++) {
    var group = conflicts[i];
    var variants = Object.keys(group.variants).sort();
    text += "- " + group.normalizedName + ": " + variants.join(", ") + "\n";
    for (var v = 0; v < variants.length; v++) {
      var variant = variants[v];
      var refs = group.variants[variant] || [];
      text += "  - " + variant + ": " + (refs.length ? refs.join("; ") : "(location unknown)") + "\n";
    }
  }

  text += "\n";
  return text;
}

// Проверяет идентификаторы сценария и story360, не меняя их и не влияя на поиск ресурсов во время игры.
function analyzeStoryIdentifierNames(story) {
  var checkedIdentifiers = Object.create(null);
  var invalidIdentifiers = Object.create(null);

  // Добавляет идентификатор в общую проверку и сохраняет все места с недопустимым написанием.
  function addIdentifier(kind, value, ref) {
    if (value === undefined || value === null) return;
    var name = String(value).trim();
    if (!name) return;

    var key = String(kind || "Identifier") + "\u0000" + name;
    checkedIdentifiers[key] = true;
    if (/^[A-Za-z0-9_]+$/.test(name)) return;

    if (!invalidIdentifiers[key]) {
      invalidIdentifiers[key] = {
        kind: String(kind || "Identifier"),
        name: name,
        refs: []
      };
    }

    var reference = String(ref || "").trim();
    if (reference && invalidIdentifiers[key].refs.indexOf(reference) === -1) {
      invalidIdentifiers[key].refs.push(reference);
    }
  }

  // Извлекает идентификатор из ссылки вида @bg.name или @audio.name, оставляя обычные пути вне этой проверки.
  function addAssetReference(value, prefix, kind, ref) {
    if (typeof value !== "string" || value.indexOf(prefix) !== 0) return;
    addIdentifier(kind, value.slice(prefix.length), ref);
  }

  // В составной ссылке space.panorama проверяет только пространство; идентификаторы панорам намеренно исключены.
  function addStory360EntryIdentifier(value, ref) {
    if (value === undefined || value === null) return;
    var name = String(value).trim();
    if (!name) return;
    var composite = name.match(/^([^.:]+)[.:]([^.:]+)$/);
    if (composite) {
      addIdentifier("360 space", composite[1], ref + " / space");
      return;
    }
    addIdentifier("360 entry", name, ref);
  }

  // Проверяет идентификаторы во вложенных действиях, пунктах выбора и условных ветках.
  function visitActions(actions, refPrefix) {
    if (!Array.isArray(actions)) return;

    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];
      if (!action || typeof action !== "object") continue;
      var actionRef = refPrefix + " / action " + (i + 1);

      if (action.type === "bg") {
        addIdentifier("Background", action.bgId, actionRef);
        addAssetReference(action.src, "@bg.", "Background", actionRef);
      } else if (action.type === "bgm" || action.type === "sfx") {
        addAssetReference(action.src, "@audio.", "Audio", actionRef);
      } else if (action.type === "char") {
        addIdentifier("Character", action.charId, actionRef);
        addIdentifier("Character emotion", action.emotion, actionRef);
      } else if (action.type === "say") {
        addIdentifier("Character", action.charVar, actionRef);
      } else if (action.type === "game") {
        addIdentifier("Game", action.gameId, actionRef);
      } else if (action.type === "video") {
        addIdentifier("Video", action.videoId, actionRef);
      } else if (action.type === "goto" || action.type === "if_expr") {
        addIdentifier("Scene", action.target, actionRef);
      } else if (action.type === "walk360") {
        addIdentifier("Background", action.bgId, actionRef);
      } else if (action.type === "goto360") {
        addIdentifier("360 space", action.spaceId, actionRef);
        addIdentifier("360 panorama target", action.panoramaId, actionRef + " / target");
        addStory360EntryIdentifier(action.entry, actionRef + " / entry");
      } else if (action.type === "bg360marks") {
        addIdentifier("Background", action.bgId, actionRef);
        var actionMarks = Array.isArray(action.marks) ? action.marks : [];
        for (var m = 0; m < actionMarks.length; m++) {
          var actionMark = actionMarks[m] || {};
          var actionMarkRef = actionRef + " / mark " + (m + 1);
          addIdentifier("Scene", actionMark.targetScene, actionMarkRef);
        }
      }

      if (action.type === "choice" && Array.isArray(action.choices)) {
        for (var c = 0; c < action.choices.length; c++) {
          var choice = action.choices[c];
          if (!choice || typeof choice !== "object") continue;
          var choiceRef = actionRef + " / choice " + (c + 1);
          addIdentifier("Scene", choice.goto, choiceRef);
          addAssetReference(choice.sfx, "@audio.", "Audio", choiceRef);
          visitActions(choice.actions, choiceRef);
        }
      }

      if (action.type === "if_block") {
        var branches = Array.isArray(action.branches) ? action.branches : [];
        for (var b = 0; b < branches.length; b++) {
          visitActions(branches[b] && branches[b].actions, actionRef + " / branch " + (b + 1));
        }
        visitActions(action.elseActions, actionRef + " / else");
      }
    }
  }

  addIdentifier("Scene", story && story.meta ? story.meta.start : null, "[meta] start");

  var scenes = story && Array.isArray(story.scenes) ? story.scenes : [];
  for (var s = 0; s < scenes.length; s++) {
    var scene = scenes[s] || {};
    var sceneRef = "scene " + String(scene.id || (s + 1));
    addIdentifier("Scene", scene.id, sceneRef + " / declaration");
    visitActions(scene.actions, sceneRef);
  }

  var assets = story && story.assets ? story.assets : {};
  [
    { field: "backgrounds", kind: "Background", section: "bg" },
    { field: "characters", kind: "Character", section: "char" },
    { field: "audio", kind: "Audio", section: "audio" },
    { field: "games", kind: "Game", section: "game" },
    { field: "videos", kind: "Video", section: "video" }
  ].forEach(function(category) {
    var entries = assets[category.field];
    if (!entries || typeof entries !== "object") return;

    Object.keys(entries).forEach(function(id) {
      var declarationRef = "[" + category.section + "] " + id;
      addIdentifier(category.kind, id, declarationRef);

      if (category.field !== "characters") return;
      var character = entries[id];
      if (!character || typeof character !== "object") return;
      var emotions = Object.create(null);

      if (character.images && typeof character.images === "object") {
        Object.keys(character.images).forEach(function(emotion) {
          emotions[emotion] = true;
        });
      }
      if (character.imageOptions && typeof character.imageOptions === "object") {
        Object.keys(character.imageOptions).forEach(function(emotion) {
          emotions[emotion] = true;
        });
      }

      Object.keys(emotions).forEach(function(emotion) {
        addIdentifier("Character emotion", emotion, declarationRef + " / emotion");
      });
    });
  });

  var root = getStory360Root();
  if (root && root.spaces && typeof root.spaces === "object") {
    Object.keys(root.spaces).forEach(function(spaceId) {
      var spaceRef = "story360 " + spaceId;
      addIdentifier("360 space", spaceId, spaceRef + " / declaration");

      var panoramas = getStory360Panoramas(root.spaces[spaceId]);
      if (!panoramas) return;
      Object.keys(panoramas).forEach(function(panoramaId) {
        var panorama = panoramas[panoramaId];
        var panoramaRef = spaceRef + "." + panoramaId;
        if (!panorama || typeof panorama !== "object") return;

        addIdentifier(
          "Background",
          readStory360Field(panorama, ["bgId", "bg", "backgroundId"]),
          panoramaRef + " / background"
        );

        var entries = panorama.entries || panorama.entryPoints || panorama.focuses;
        if (entries && typeof entries === "object") {
          Object.keys(entries).forEach(function(entryId) {
            addStory360EntryIdentifier(entryId, panoramaRef + " / entry");
          });
        }

        var marks = panorama.marks || panorama.hotspots || panorama.points;
        if (!Array.isArray(marks)) return;
        for (var m = 0; m < marks.length; m++) {
          var mark = marks[m] || {};
          var markRef = panoramaRef + " / mark " + (m + 1);

          var target = normalizeStory360Target(mark, spaceId);
          if (!target) continue;
          if (target.type === "scene") {
            addIdentifier("Scene", target.sceneId, markRef + " / target");
          } else if (target.type === "360") {
            addIdentifier("360 space", target.spaceId, markRef + " / target");
            addStory360EntryIdentifier(target.entryId, markRef + " / target entry");
          }
        }
      });
    });
  }

  return {
    checkedCount: Object.keys(checkedIdentifiers).length,
    invalidIdentifiers: Object.keys(invalidIdentifiers).map(function(key) {
      return invalidIdentifiers[key];
    }).sort(function(a, b) {
      var kindCompare = a.kind.localeCompare(b.kind);
      return kindCompare || a.name.localeCompare(b.name);
    })
  };
}

// Формирует самостоятельный раздел статистики по допустимым символам во всех идентификаторах.
function formatStoryIdentifierNamesStats(analysis) {
  var info = analysis || analyzeStoryIdentifierNames(STORY);
  var invalid = info.invalidIdentifiers || [];
  var text = "=== IDENTIFIERS ===\n\n";
  text += "Allowed: English letters, digits and _. Digits are allowed as the first character.\n";
  text += "Resource file and folder paths are checked separately in FILE CHECK.\n";
  text += "Checked unique identifiers: " + (info.checkedCount || 0) + ".\n";

  if (!invalid.length) {
    text += "✅ All identifiers match the allowed format.\n\n";
    return text;
  }

  text += "⚠️ Invalid identifiers: " + invalid.length + ".\n";
  for (var i = 0; i < invalid.length; i++) {
    var item = invalid[i];
    text += "- " + item.kind + " \"" + item.name + "\"\n";
    if (item.refs.length) {
      text += "  Used in: " + item.refs.join("; ") + "\n";
    }
  }
  text += "\n";
  return text;
}

// Проверяет условия visibleIf в story360 для статистики; отсутствующие переменные фиксируются как справка, а не как ошибка.
function analyzeStory360VisibilityConditions(story) {
  var analysis = {
    conditionCount: 0,
    variables: {},
    missingVariables: {},
    invalidConditions: []
  };
  var knownVars = collectScenarioVariableNames(story);
  var root = getStory360Root();
  if (!root || !root.spaces || typeof root.spaces !== "object") return analysis;

  var spaceIds = Object.keys(root.spaces).sort();
  for (var si = 0; si < spaceIds.length; si++) {
    var spaceId = spaceIds[si];
    var panoramas = getStory360Panoramas(root.spaces[spaceId]);
    if (!panoramas) continue;

    var panoramaIds = Object.keys(panoramas).sort();
    for (var pi = 0; pi < panoramaIds.length; pi++) {
      var panoramaId = panoramaIds[pi];
      var panorama = panoramas[panoramaId];
      var marks = panorama && (panorama.marks || panorama.hotspots || panorama.points);
      if (!Array.isArray(marks)) continue;

      for (var mi = 0; mi < marks.length; mi++) {
        var mark = marks[mi] || {};
        var visibleIf = getStory360MarkVisibleIf(mark);
        if (!visibleIf) continue;

        analysis.conditionCount++;
        var markId = String(mark.id || ("mark" + (mi + 1)));
        var ref = String(spaceId) + "." + String(panoramaId) + "#" + markId;
        var parsed = validateAndCollectSafeExpressionIdentifiers(visibleIf);
        if (!parsed.ok) {
          analysis.invalidConditions.push({
            ref: ref,
            expression: visibleIf,
            error: parsed.error
          });
          continue;
        }

        var identifiers = parsed.identifiers || [];
        for (var ii = 0; ii < identifiers.length; ii++) {
          var name = identifiers[ii];
          if (!analysis.variables[name]) analysis.variables[name] = [];
          analysis.variables[name].push(ref);
          if (!knownVars[name]) {
            if (!analysis.missingVariables[name]) analysis.missingVariables[name] = [];
            analysis.missingVariables[name].push(ref);
          }
        }
      }
    }
  }

  return analysis;
}

// Формирует текстовый блок статистики по visibleIf: отсутствующие переменные означают показ метки, а не ошибку выполнения.
function formatStory360VisibilityConditionsStats(analysis) {
  var text = "=== STORY360 CONDITIONS ===\n\n";
  var info = analysis || analyzeStory360VisibilityConditions(STORY);
  var variableNames = Object.keys(info.variables || {}).sort();
  var missingNames = Object.keys(info.missingVariables || {}).sort();
  var invalid = info.invalidConditions || [];

  text += "Conditions: " + (info.conditionCount || 0) + "\n";
  text += "Variables used: " + (variableNames.length ? variableNames.join(", ") : "(none)") + "\n";
  text += "Missing variables: " + (missingNames.length ? missingNames.join(", ") : "(none)") + "\n";
  if (missingNames.length) {
    text += "Missing variables are treated as absent scene360 conditions; the corresponding marks stay visible.\n";
  }
  if (invalid.length) {
    text += "\nInvalid conditions:\n";
    for (var i = 0; i < invalid.length; i++) {
      text += "- " + invalid[i].ref + ": " + invalid[i].expression + " (" + invalid[i].error + ")\n";
    }
  }
  text += "\n";
  return text;
}

// Формирует короткую строку итоговых статусов: предупреждение означает, что проверка безопасно отложена до загрузки ресурса.
function formatStatsSummaryCheck(checks) {
  var items = Array.isArray(checks) ? checks : [];
  var text = "=== SUMMARY CHECK ===\n\n";
  text += items.map(function(item) {
    var icon = item && item.warning ? "⚠️ " : (item && item.ok ? "✅ " : "❌ ");
    return icon + String(item && item.label ? item.label : "CHECK");
  }).join("  ");
  return text + "\n\n";
}

// Переводит размер изображения пакета в компактную строку без потери точного числа байтов.
function formatPanoramaPackageByteSize(value) {
  var bytes = Number(value) || 0;
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KiB (" + bytes + " B)";
  return (bytes / (1024 * 1024)).toFixed(1) + " MiB (" + bytes + " B)";
}

// Формирует отдельный раздел по полностью проверяемым CSS-пакетам панорам, не смешивая их с обычными изображениями.
function formatPanoramaPackageStats(packages) {
  var items = Array.isArray(packages) ? packages : [];
  var counts = { loaded: 0, verified: 0, queued: 0, checking: 0, missing: 0, invalid: 0 };
  var text = "=== 360° PANORAMA PACKAGES ===\n\n";

  if (!items.length) {
    return text + "No CSS panorama packages declared.\n\n";
  }

  items.forEach(function(item) {
    var status = item && counts[item.status] !== undefined ? item.status : "queued";
    counts[status]++;
  });

  text += "Packages: " + items.length +
    "; loaded: " + counts.loaded +
    "; verified: " + counts.verified +
    "; checking: " + (counts.queued + counts.checking) +
    "; missing: " + counts.missing +
    "; invalid: " + counts.invalid + ".\n\n";

  items.forEach(function(item) {
    var status = item && item.status ? item.status : "queued";
    var icon = status === "loaded" || status === "verified" ? "✅ " :
      (status === "queued" || status === "checking" ? "⚠️ " : "❌ ");
    text += icon + String(item && item.path ? item.path : "(empty path)") + "\n";
    text += "   Status: " + String(item && item.details ? item.details : "Queued for validation.") + "\n";
    if (item && item.meta && (status === "loaded" || status === "verified")) {
      text += "   Image: " + item.meta.width + "x" + item.meta.height +
        "; " + item.meta.type +
        "; " + formatPanoramaPackageByteSize(item.meta.size) +
        "; mode: " + item.meta.mode + ".\n";
      if (item.meta.chunkCount) {
        text += "   CSS data: " + item.meta.chunkCount + " chunks" +
          (item.meta.encodedLength ? "; Base64: " + formatPanoramaPackageByteSize(item.meta.encodedLength) : "") + ".\n";
      }
    }
    text += "   Used in:\n";
    (item && Array.isArray(item.refs) ? item.refs : []).forEach(function(ref) {
      text += "   - " + ref + "\n";
    });
    text += "\n";
  });

  return text;
}

// Генерация статистики по STORY.
// Сделано так, чтобы потом легко дописывать новые показатели: просто добавляете новые строки в statsLines.
function renderStats() {

  // Показываем индикатор загрузки
  elStatsBody.value = "Сбор информации...";
  writeRuntimeVerbose("[STATS] renderStats:start");

  // Сначала собираем информацию об окружении
  var envInfo = collectEnvironmentInfo();

  // Добавляем информацию профилера
  var profilerInfo = profiler.getReport();

  // Асинхронно проверяем файлы
  checkAssetsFiles()
  .then(function(fileStats) {
    writeRuntimeVerbose("[STATS] checkAssetsFiles done", {
      files: fileStats.files.length,
      missing: fileStats.missing.length,
      sizeErrors: fileStats.sizeErrors.length,
      invalidNames: fileStats.invalidNames.length,
      panoramaPackages: (fileStats.panoramaPackages || []).length
    });
    try {
      var stats = window.VN_STORY_ANALYSIS.computeStoryStats(STORY);
      var errors = validateStory(STORY);
      var textInfo = window.VN_STORY_ANALYSIS.computeTextInfo(STORY);
      var reach = findUnreachableScenes(STORY);
      var cycles = window.VN_STORY_GRAPH.findCyclesSCC(STORY);
      var story360Visibility = analyzeStory360VisibilityConditions(STORY);
      var variableCaseAnalysis = analyzeScenarioVariableCaseConflicts(STORY);
      var identifierNameAnalysis = analyzeStoryIdentifierNames(STORY);
      var panoramaPackages = fileStats.panoramaPackages || [];
      var panoramaErrors = panoramaPackages.filter(function(item) {
        return item && (item.status === "missing" || item.status === "invalid");
      });
      var panoramaPending = panoramaPackages.filter(function(item) {
        return item && (item.status === "queued" || item.status === "checking");
      });

      // Получаем ошибки парсинга
      var parseErrors = window.PARSE_ERRORS || [];
      var summaryChecks = [
        {
          label: "PARSE",
          ok: parseErrors.length === 0
        },
        {
          label: "VARIABLES",
          ok: (variableCaseAnalysis.invalidNames || []).length === 0 &&
            (variableCaseAnalysis.conflicts || []).length === 0
        },
        {
          label: "IDENTIFIERS",
          ok: (identifierNameAnalysis.invalidIdentifiers || []).length === 0
        },
        {
          label: "FILES",
          ok: (fileStats.missing || []).length === 0 &&
            (fileStats.invalidNames || []).length === 0
        },
        {
          label: "IMAGES",
          ok: (fileStats.sizeErrors || []).length === 0
        },
        {
          label: "PANORAMAS",
          ok: panoramaErrors.length === 0,
          warning: panoramaErrors.length === 0 && panoramaPending.length > 0
        },
        {
          label: "SCRIPT",
          ok: errors.length === 0
        },
        {
          label: "STORY360",
          ok: (story360Visibility.invalidConditions || []).length === 0
        },
        {
          label: "REACH",
          ok: (reach.unreachable || []).length === 0
        },
        {
          label: "CYCLES",
          ok: cycles.length === 0
        }
      ];

      var text = "";




      // ===== GAMES: declared / used / unused =====
      var declaredGames = (STORY.assets && STORY.assets.games)
        ? Object.keys(STORY.assets.games).sort()
        : [];

      var gamesMap = (STORY.assets && STORY.assets.games) ? STORY.assets.games : {};
      var allGameIds = Object.keys(gamesMap).sort();

      var usedGamesMap = {};
      if (STORY.scenes && STORY.scenes.length > 0) {
        STORY.scenes.forEach(function(scene) {
          if (!scene.actions) return;
          scene.actions.forEach(function(action) {
            if (action && action.type === "game" && action.gameId) {
              usedGamesMap[action.gameId] = true;
            }
          });
        });
      }

      var usedGameIds = [];
      var unusedGameIds = [];

      for (var i = 0; i < allGameIds.length; i++) {
        var gameId = allGameIds[i];
        if (usedGamesMap[gameId]) usedGameIds.push(gameId);
        else unusedGameIds.push(gameId);
      }

      var orderedGameIds = usedGameIds.concat(unusedGameIds);






      text += formatRuntimeCompatibilityInfo(true);
      text += formatLicenseStatsText() + "\n";
      text += formatStatsSummaryCheck(summaryChecks);

      text += formatCurrentViewportMediaFocusForStats();
      
      text += "\n";
      text += "=== SCRIPT STATISTICS ===\n\n";
      text += "Title: " + (STORY.meta && STORY.meta.title ? STORY.meta.title : "(без названия)") + "\n";
      text += "Scenes: " + stats.sceneCount + "\n";
      text += "Menu: " + stats.choiceCount + "\n";
      text += "Games: " + declaredGames.length + "\n\n";


      // ===== ОШИБКИ ПАРСИНГА =====
      text += "=== PARSE ERRORS ===\n\n";
      
      if (parseErrors.length === 0) {
        text += "✅ No parse errors found\n\n";
      } else {
        text += `❌ Errors found: ${parseErrors.length}\n\n`;
        parseErrors.forEach((error, index) => {
          text += `${index + 1}. Line ${error.lineNumber}: ${error.message}\n`;
          text += `   "${error.line}"\n\n`;
        });
      }

      text += formatScenarioVariableCaseStats(variableCaseAnalysis);
      text += formatStoryIdentifierNamesStats(identifierNameAnalysis);

      text += "=== FILE CHECK ===\n\n";
        
      // Отсутствующие файлы - проверяем ВСЕГДА, независимо от наличия звука
      if (fileStats.missing.length > 0) {
        text += "❌ MISSING FILES:\n\n";
        fileStats.missing.forEach(function(item, index) {
          text += (index + 1) + ". " + item.path + "\n";
          text += "   Used in:\n";
          item.refs.forEach(function(ref) {
            text += "   - " + ref + "\n";
          });
          text += "\n";
        });
      } else {
        text += "✅ All files found\n\n";
      }

      var invalidResourceNames = fileStats.invalidNames || [];
      if (invalidResourceNames.length > 0) {
        text += "❌ INVALID RESOURCE PATH NAMES:\n\n";
        text += "Allowed for file and folder names: English letters, digits, - and _.\n";
        text += "The dot before a file extension is allowed.\n\n";
        invalidResourceNames.forEach(function(item, index) {
          text += (index + 1) + ". " + item.path + "\n";
          text += "   Invalid parts: " + item.issues.map(function(issue) {
            var typeLabel = issue.type === "folder" ? "folder" : "file";
            return typeLabel + " \"" + issue.segment + "\"";
          }).join(", ") + "\n";
          text += "   Used in:\n";
          item.refs.forEach(function(ref) {
            text += "   - " + ref + "\n";
          });
          text += "\n";
        });
      } else {
        text += "✅ All resource file and folder names are valid\n\n";
      }

      var skippedNetworkAssets = fileStats.files.filter(function (f) {
        return f && f.skippedCheck;
      });
      if (skippedNetworkAssets.length > 0) {
        // HTML games and video files are not probed in the browser
        text += "Skipped for check files (html/mp4):\n";
        var skippedByExt = {};
        var skippedExtOrder = [];
        skippedNetworkAssets.map(function (item, index) {
          var path = String(item.path || "");
          var fileName = path.split(/[\\/]/).pop();
          var extMatch = fileName.match(/\.([^.]+)$/);
          return {
            fileName: fileName,
            ext: extMatch ? extMatch[1].toLowerCase() : "",
            index: index
          };
        }).sort(function (a, b) {
          if (a.ext < b.ext) return -1;
          if (a.ext > b.ext) return 1;
          return a.index - b.index;
        }).forEach(function (item) {
          if (!skippedByExt[item.ext]) {
            skippedByExt[item.ext] = [];
            skippedExtOrder.push(item.ext);
          }
          skippedByExt[item.ext].push(item.fileName);
        });
        skippedExtOrder.forEach(function (ext) {
          text += ext + ": " + skippedByExt[ext].join(", ") + "\n";
        });
        text += "\n";
      }
      
      // Ошибки размеров изображений
      if (fileStats.sizeErrors.length > 0) {
        text += "❌ IMAGE SIZE ISSUES:\n\n";
        
        fileStats.sizeErrors.forEach(item => {
          text += `File: ${item.path}\n`;
          text += `  Current size: ${item.width}×${item.height}\n`;
          if (item.category === 'bg') {
            text += `  Required: at least 1080×1920\n`;
          } else if (item.category === 'char') {
            text += `  Required: at least 500×1200\n`;
          }
          text += `  Issues: ${item.errors.join(', ')}\n`;
          if (item.refs) {
            text += `  Used in: ${item.refs.join(', ')}\n`;
          }
          text += "\n";
        });
      } else {
        text += "✅ All images meet the size requirements\n\n";
      }

      text += formatPanoramaPackageStats(panoramaPackages);


      // text += "DEBUG files:\n";
      // fileStats.files.forEach(function(f) {
      //  text += JSON.stringify(f) + "\n";
      // });
      // text += "\n";



      text += "=== FILE STATISTICS ===\n\n";
      text += "Total files: " + fileStats.files.length + "\n";
      
      var imageCount = 0;
      var audioCount = 0;

      fileStats.files.forEach(function(f) {
        if (f.category === 'bg' || f.category === 'char') imageCount++;
        else if (f.category === 'audio') audioCount++;
      });

      var gameCount = (STORY.assets && STORY.assets.games)
        ? Object.keys(STORY.assets.games).length
        : 0;
      var videoCount = (STORY.assets && STORY.assets.videos)
        ? Object.keys(STORY.assets.videos).length
        : 0;
      
      text += "Images: " + imageCount + "\n";
      text += "Audio: " + audioCount + "\n";
      text += "Games: " + gameCount + "\n";
      text += "Videos: " + videoCount + "\n\n";
      


      text += "=== TEXT LENGTH ===\n\n";

      text += "Total characters: " + textInfo.characters + "\n";
      text += "Total words: " + textInfo.words + "\n\n";


      


      text += "=== USED BACKGROUNDS ===\n";

      if (!stats.backgroundsDetailed || !stats.backgroundsDetailed.length) {
        text += "(none)\n\n";
      } else {
        for (var i = 0; i < stats.backgroundsDetailed.length; i++) {
          var bgItem = stats.backgroundsDetailed[i];
          text += bgItem.used ? bgItem.id + "\n" : bgItem.id + "*\n";
        }
        text += "\n";
      }





      text += "=== CHARACTERS USED ===\n";

      if (!stats.usedCharactersDetailed || !stats.usedCharactersDetailed.length) {
        text += "(none)\n\n";
      } else {
        for (var i = 0; i < stats.usedCharactersDetailed.length; i++) {
          var item = stats.usedCharactersDetailed[i];
          var emotionsText = item.emotionsDisplay && item.emotionsDisplay.length
            ? item.emotionsDisplay.join(", ")
            : "-";

          var nameText = item.used ? item.name : (item.name + "*");
          text += nameText + " [" + item.id + "] (" + emotionsText + ")\n";
        }
        text += "\n";
      }



      text += "=== USED GAMES ===\n";
      if (orderedGameIds.length === 0) {
        text += "(none)\n";
      } else {
        for (var i = 0; i < orderedGameIds.length; i++) {
          var gameId = orderedGameIds[i];
          text += gameId + (usedGamesMap[gameId] ? "" : "*") + "\n";
        }
      }
      text += "\n";




      text += "=== SCRIPT REVIEW ===\n";

      if (errors.length === 0) {
        text += "No errors found.\n";
      } else {
        for (var i = 0; i < errors.length; i++) {
          text += "- " + errors[i] + "\n";
        }
      }

      text += "\n";
      text += formatStory360VisibilityConditionsStats(story360Visibility);


      
      text += "\n\n=== ADDITIONAL SCRIPT ANALYSIS ===\n\n";

      text += "Unreachable scenes (" + reach.unreachable.length + "):\n";
      text += (reach.unreachable.length ? reach.unreachable.join("\n") : "(none)") + "\n\n";

      text += "Cycles / SCC (" + cycles.length + "):\n";
      if (!cycles.length) {
        text += "(none)\n";
      } else {
        for (var i = 0; i < cycles.length; i++) {
          text += "- " + cycles[i].join(" -> ") + "\n";
        }
      }

      // ========== ПРОФАЙЛЕР ==========
      text += "=== TIME PROFILER ===\n\n";
      text += profilerInfo;
      text += "\n";

      text += "=== LOADING THE NOVEL ===\n";

      if (profiler.marks['First screen is ready'] !== undefined) {
        text += "  To first screen: " +
          profiler.marks['First screen is ready'] + "ms (" +
          (profiler.marks['First screen is ready'] / 1000).toFixed(2) + "с)\n";
      } else {
        text += "  To first screen: not yet measured\n";
      }

      if (window.LOADER_STATS && window.LOADER_STATS.startTime && profiler.marks['First screen is ready'] !== undefined) {
        var firstScreenFromLoaderStart =
          (profiler.startTime - window.LOADER_STATS.startTime) + profiler.marks['First screen is ready'];

        text += "  From loader start to first screen: " +
          firstScreenFromLoaderStart + "ms (" +
          (firstScreenFromLoaderStart / 1000).toFixed(2) + "с)\n";
      }


      // ========== ВРЕМЯ ЗАГРУЗКИ СЦЕНАРИЯ ==========
      text += "=== SCRIPT LOAD TIME ===\n\n";
      
      if (window.LOADER_STATS) {
        var marks = window.LOADER_STATS.marks;

        // Находим максимальное время (последнюю метку)
        var maxTime = 0;
        for (var key in marks) {
          if (marks[key] > maxTime) {
            maxTime = marks[key];
          }
        }

        var totalLoaderTime = maxTime; // Используем последнюю метку
        // var totalLoaderTime = marks.parsing_end || marks.story_assigned || 0;
        var parsingTime = marks.parsing_end || 0;
        var processingTime = totalLoaderTime - parsingTime;

        text += "Total loader time: " + totalLoaderTime + "ms\n";
        text += "  Parsing: " + parsingTime + "ms\n";
        text += "  Processing and transmission: " + processingTime + "ms\n\n";
        
        text += "Details:\n";
        text += "  Start: 0ms\n";
        
        // Сортируем метки по времени
        var sortedMarks = Object.keys(marks).sort(function(a, b) {
          return marks[a] - marks[b];
        });
        
        var lastTime = 0;
        sortedMarks.forEach(function(name) {
          var time = marks[name];
          text += "  " + name + ": " + time + "ms (+" + (time - lastTime) + "ms)\n";
          lastTime = time;
        });
        
        text += "\n";
        text += "Script size:\n";
        text += "  Scenes: " + window.LOADER_STATS.scenesCount + "\n";
        text += "  Actions: " + window.LOADER_STATS.actionsCount + "\n";
        text += "  Backgrounds: " + window.LOADER_STATS.backgroundsCount + "\n";
        text += "  Characters: " + window.LOADER_STATS.charactersCount + "\n";
        text += "  Audio: " + window.LOADER_STATS.audioCount + "\n";
        text += "  Games: " + (window.LOADER_STATS.gamesCount || 0) + "\n";
        text += "  Videos: " + (window.LOADER_STATS.videosCount || 0) + "\n";
        text += "  Time per scene: " + (totalLoaderTime / Math.max(1, window.LOADER_STATS.scenesCount)).toFixed(2) + "ms\n";
        text += "  Time per action: " + (totalLoaderTime / Math.max(1, window.LOADER_STATS.actionsCount)).toFixed(2) + "ms\n\n";

        // Прогноз для больших сценариев
        var estimatedFor100Scenes = (totalLoaderTime / window.LOADER_STATS.scenesCount) * 100;
        var estimatedFor1000Actions = (totalLoaderTime / window.LOADER_STATS.actionsCount) * 1000;
        
        // Прогноз для больших сценариев
        var estimatedFor100Scenes = (totalLoaderTime / window.LOADER_STATS.scenesCount) * 100;
        var estimatedFor1000Actions = (totalLoaderTime / window.LOADER_STATS.actionsCount) * 1000;

        // Детальный прогноз по типам действий
        var sayCount = stats.sayCount || 0;        // фразы персонажей
        var textCount = stats.textCount || 0;      // авторский текст
        var choiceCount = stats.choiceCount || 0;  // меню выбора
        var bgmCount = stats.bgmActions || 0;                 // смены музыки
        var bgCount = (stats.usedBackgroundIds || []).length; // используемые фоны

        text += "Performance estimate:\n";
        text += "  Per 100 scenes: ~" + Math.round(estimatedFor100Scenes) + "ms (" + (estimatedFor100Scenes/1000).toFixed(1) + "с)\n";
        text += "  Per 1,000 actions: ~" + Math.round(estimatedFor1000Actions) + "ms (" + (estimatedFor1000Actions/1000).toFixed(1) + "с)\n\n";

        text += "Detailed estimate by action type (per 1,000 actions):\n";

        if (sayCount > 0) {
          var timePerSay = totalLoaderTime / sayCount;
          var estimated1000Say = timePerSay * 1000;
          text += "  Character phrases: ~" + Math.round(estimated1000Say) + "ms";
          text += " (по " + timePerSay.toFixed(2) + "ms per phrase)\n";
        }

        if (textCount > 0) {
          var timePerText = totalLoaderTime / textCount;
          var estimated1000Text = timePerText * 1000;
          text += "  Author's text: ~" + Math.round(estimated1000Text) + "ms";
          text += " (at " + timePerText.toFixed(2) + "ms per text)\n";
        }

        if (choiceCount > 0) {
          var timePerChoice = totalLoaderTime / choiceCount;
          var estimated1000Choice = timePerChoice * 1000;
          text += "  Selection menu: ~" + Math.round(estimated1000Choice) + "ms";
          text += " (at " + timePerChoice.toFixed(2) + "ms per menu)\n";
        }

        if (bgmCount > 0) {
          var timePerBgm = totalLoaderTime / bgmCount;
          var estimated1000Bgm = timePerBgm * 1000;
          text += "  Music change: ~" + Math.round(estimated1000Bgm) + "ms";
          text += " (at " + timePerBgm.toFixed(2) + "ms per change)\n";
        }

        if (bgCount > 0) {
          var timePerBg = totalLoaderTime / bgCount;
          var estimated1000Bg = timePerBg * 1000;
          text += "  Background change: ~" + Math.round(estimated1000Bg) + "ms";
          text += " (по " + timePerBg.toFixed(2) + "ms per change)\n";
        }

        text += "\n";


      } else {
          text += "Bootloader data is not available\n\n";
      }


      // ========== ИНФОРМАЦИЯ ОБ ОКРУЖЕНИИ ==========
      text += "=== DEVICE INFORMATION ===\n\n";
      text += envInfo;
      text += "\n";

      // Добавляем JSON сценария для отладки
      text += "\n\n=== SCENARIO JSON ===\n\n";
      try {
        // Убираем циклические ссылки (если есть)
        const storyJson = JSON.stringify(STORY, (key, value) => {
          if (key === 'sceneMap') return undefined; // не сериализуем
          return value;
        }, 2);
        text += storyJson;
      } catch (e) {
        text += "Serialization error: " + e.message;
      }

      


      currentMermaidVariants.full = buildMermaidVariant(STORY, reach.unreachable, {
        scope: "full"
      });

      // Граф ресурсов: всегда полная (не compact) версия, даже если full ушёл в compact —
      // диаграмма маленькая, так читаемее блоки ассетов.
      currentMermaidVariants.resources = buildMermaidVariant(STORY, reach.unreachable, {
        scope: "resources",
        forceFull: true
      });

      // Подстраиваем текущий Mermaid-код под выбранную вкладку статистики
      syncCurrentMermaidCodeWithView();




      
      text += "\n\n=== MERMAID GRAPH INFO ===\n";

      text += "[full]\n";
      text += "full length: " + currentMermaidVariants.full.fullCode.length + "\n";
      if (currentMermaidVariants.full.useCompact && currentMermaidVariants.full.compactCode) {
        text += "compact length: " + currentMermaidVariants.full.compactCode.length + "\n";
      }

      text += "\n[resources]\n";
      text += "full length: " + currentMermaidVariants.resources.fullCode.length + "\n";
      if (currentMermaidVariants.resources.useCompact && currentMermaidVariants.resources.compactCode) {
        text += "compact length: " + currentMermaidVariants.resources.compactCode.length + "\n";
      }

      text += "\n=== MERMAID GRAPH ===\n\n";
      text += currentMermaidCode;






      elStatsBody.value = text;
      elStatsBody.scrollTop = 0;


      if (showingGraph && window.STORY) {
        setTimeout(function() {
          try {
            var statsGraphKey = getPanzoomStateKeyForView(currentStatsView);
            if (statsGraphKey) {
              renderGraphViewWithPanzoomLifecycle(statsGraphKey);
            }
          } catch (e) {
            console.error("[STATS] Mermaid graph rendering error:", e);
          }
        }, 100);
      }

      if (showingGames && window.STORY) {
        setTimeout(function() {
          try {
            renderGamesCatalog();
          } catch (e) {
            console.error("[STATS] Games catalog rendering error:", e);
          }
        }, 100);
      }


    } catch (e) {
      console.error("[STATS] Error generating statistics text:", e);
      elStatsBody.value =
        "Error generating statistics:\n\n" +
        (e && e.stack ? e.stack : String(e));
    }
  })
  .catch(function(e) {
    console.error("[STATS] File verification error:", e);
    elStatsBody.value =
      t("statsFileError") + "\n\n" +
      (e && e.stack ? e.stack : String(e));
  });


}

// Также добавьте обработчик изменения размера для адаптации графа
window.addEventListener("resize", function() {
  if (showingGraph && window.mermaid) {
    // При изменении размера окна перерисовываем с задержкой
    setTimeout(function() {
      if (mermaidGraph) {
        // Не переинициализируем полностью, только обновляем размеры
        var svg = mermaidGraph.querySelector('svg');
        if (svg) {
          var padding = 25;
          var bbox = svg.getBBox();

          var x = bbox.x - padding;
          var y = bbox.y - padding;
          var w = bbox.width + padding * 2;
          var h = bbox.height + padding * 2;

          svg.setAttribute('width', w);
          svg.setAttribute('height', h);
          svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
        }
      }
    }, 100);
  }
});



// Новая функция для сбора информации об окружении
function collectEnvironmentInfo() {
  var info = "";
    
  // Размеры окна
  info += "Window dimensions:\n";
  info += "  window.innerWidth: " + window.innerWidth + "px\n";
  info += "  window.innerHeight: " + window.innerHeight + "px\n";
  info += "  window.outerWidth: " + window.outerWidth + "px\n";
  info += "  window.outerHeight: " + window.outerHeight + "px\n";
  info += "  screen.width: " + screen.width + "px\n";
  info += "  screen.height: " + screen.height + "px\n";
  info += "  screen.availWidth: " + screen.availWidth + "px\n";
  info += "  screen.availHeight: " + screen.availHeight + "px\n";
  info += "  devicePixelRatio: " + window.devicePixelRatio + "\n\n";
  
  // Соотношение сторон
  var aspectRatio = (window.innerWidth / window.innerHeight).toFixed(2);
  info += "Aspect ratio: " + aspectRatio + " (" + aspectRatio + ":1)\n";
  info += "Orientation: " + (window.innerHeight > window.innerWidth ? "вертикальная" : "горизонтальная") + "\n\n";
  
  // CSS переменные
  var rootStyle = getComputedStyle(document.documentElement);
  var uiScale = rootStyle.getPropertyValue('--uiScale').trim();
  var visualScale = rootStyle.getPropertyValue('--visualScale').trim();
  var baseFontPx = rootStyle.getPropertyValue('--baseFontPx').trim();
  var baseFontSize = rootStyle.getPropertyValue('--baseFontSize').trim();
  var uiBottomOffset = rootStyle.getPropertyValue('--uiBottomOffset').trim();
  var topSpacing = rootStyle.getPropertyValue('--topSpacing').trim();
  var bottomSpacing = rootStyle.getPropertyValue('--bottomSpacing').trim();
  
  info += "CSS variables:\n";
  info += "  --uiScale: " + uiScale + "\n";
  info += "  --uiPhoneExtraScale: " + rootStyle.getPropertyValue('--uiPhoneExtraScale').trim() + "\n";
  info += "  --visualScale: " + visualScale + "\n";
  info += "  --baseFontPx: " + baseFontPx + "\n";
  info += "  --baseFontSize: " + baseFontSize + "\n";
  info += "  --uiBottomOffset: " + uiBottomOffset + "\n";
  info += "  --topSpacing: " + topSpacing + "px\n";
  info += "  --bottomSpacing: " + bottomSpacing + "px\n\n";
  
  // JS переменные масштабирования
  info += "JS scaling settings:\n";
  info += "  UI_FONT_SCALE: " + UI_FONT_SCALE + "\n";
  info += "  UI_PHONE_EXTRA_FONT_SCALE: " + UI_PHONE_EXTRA_FONT_SCALE + "\n";
  info += "  UI_PHONE_VIEWPORT_MAX_SHORT_PX: " + UI_PHONE_VIEWPORT_MAX_SHORT_PX + "\n";
  info += "  UI_PHONE_VIEWPORT_MIN_ASPECT: " + UI_PHONE_VIEWPORT_MIN_ASPECT + "\n";
  info += "  confidentPhoneUiBoost: " + isConfidentPhoneForUiBoost() + "\n";
  info += "  UI_REFERENCE_HEIGHT: " + UI_REFERENCE_HEIGHT + "\n";
  info += "  UI_VISUAL_REFERENCE_HEIGHT: " + UI_VISUAL_REFERENCE_HEIGHT + "\n";
  info += "  UI_VISUAL_MIN_HEIGHT: " + UI_VISUAL_MIN_HEIGHT + "\n\n";
  
  // Размеры элементов интерфейса
  var dialog = document.getElementById('dialog');
  if (dialog) {
    var dialogStyle = getComputedStyle(dialog);
    info += "Dialog:\n";
    info += "  width: " + dialogStyle.width + "\n";
    info += "  height: " + dialogStyle.height + "\n";
    info += "  padding: " + dialogStyle.padding + "\n";
    info += "  font-size: " + dialogStyle.fontSize + "\n";
    info += "  bottom: " + dialogStyle.bottom + "\n";
    info += "  classes: " + dialog.className + "\n\n";
  }
  
  var nameBox = document.getElementById('nameBox');
  if (nameBox && !nameBox.classList.contains('hidden')) {
    var nameStyle = getComputedStyle(nameBox);
    info += "Character name:\n";
    info += "  padding: " + nameStyle.padding + "\n";
    info += "  font-size: " + nameStyle.fontSize + "\n";
    info += "  margin-bottom: " + nameStyle.marginBottom + "\n\n";
  }
  
  var choices = document.getElementById('choices');
  if (choices && !choices.classList.contains('hidden')) {
    var choicesStyle = getComputedStyle(choices);
    var choiceBtn = document.querySelector('.choiceBtn');
    info += "Selection menu:\n";
    info += "  container bottom: " + choicesStyle.bottom + "\n";
    info += "  gap: " + choicesStyle.gap + "\n";
    
    if (choiceBtn) {
      var btnStyle = getComputedStyle(choiceBtn);
      info += "  button padding: " + btnStyle.padding + "\n";
      info += "  button font-size: " + btnStyle.fontSize + "\n";
    }
    info += "\n";
  }
  
  var char = document.getElementById('charLayer');
  if (char && !char.classList.contains('hidden')) {
    info += "Character:\n";
    info += "  height (JS): " + char.style.height + "\n";
    info += "  actual height: " + char.offsetHeight + "px\n";
    info += "  max-height (CSS): " + getComputedStyle(char).maxHeight + "\n";
    info += "  bottom: " + getComputedStyle(char).bottom + "\n\n";
  }
  
  // Информация о браузере
  info += "Browser:\n";
  info += "  userAgent: " + navigator.userAgent + "\n";
  info += "  language: " + navigator.language + "\n";
  info += "  platform: " + navigator.platform + "\n";
  
  return info;
}


// Проверка файлов: изображения и аудио через теги <Image>/<Audio>.
// Видео и HTML-игры по сети не проверяем (см. ниже), чтобы не упираться в
// тяжёлый <video> preload и в CSP/смешанный контент при fetch.
var RESOURCE_PATH_SAFE_NAME_RE = /^[A-Za-z0-9_-]+$/;

// Находит сегменты пути ресурса с недопустимыми именами: каталоги проверяются целиком,
// а у файла точка между именем и расширением считается служебным разделителем.
function findInvalidResourcePathNameSegments(path) {
  var raw = String(path || "").trim();
  if (!raw || raw.indexOf("data:") === 0 || raw.indexOf("blob:") === 0) return [];

  var hashIndex = raw.indexOf("#");
  if (hashIndex >= 0) raw = raw.slice(0, hashIndex);

  var queryIndex = raw.indexOf("?");
  if (queryIndex >= 0) raw = raw.slice(0, queryIndex);

  raw = raw.replace(/\\/g, "/");

  var protocolMatch = raw.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//);
  if (protocolMatch) {
    var withoutProtocol = raw.slice(protocolMatch[0].length);
    var firstSlash = withoutProtocol.indexOf("/");
    raw = firstSlash >= 0 ? withoutProtocol.slice(firstSlash + 1) : "";
  }

  raw = raw.replace(/^[A-Za-z]:\//, "").replace(/^\/+/, "");

  var segments = raw.split("/").filter(function(segment) {
    return !!segment;
  });
  var issues = [];

  for (var i = 0; i < segments.length; i++) {
    var segment = segments[i];
    var isFileSegment = i === segments.length - 1;
    var name = segment;
    var extension = "";

    if (isFileSegment) {
      var dotIndex = segment.lastIndexOf(".");
      if (dotIndex > 0) {
        name = segment.slice(0, dotIndex);
        extension = segment.slice(dotIndex + 1);
      }
    }

    var invalidName = !name || !RESOURCE_PATH_SAFE_NAME_RE.test(name);
    var invalidExtension = isFileSegment && extension !== "" && !RESOURCE_PATH_SAFE_NAME_RE.test(extension);
    var missingExtension = isFileSegment && segment.lastIndexOf(".") === segment.length - 1;
    if (invalidName || invalidExtension || missingExtension) {
      issues.push({
        type: isFileSegment ? "file" : "folder",
        segment: segment,
        name: name || segment
      });
    }
  }

  return issues;
}

// Собирает пути обычных ресурсов, story360 и photo-меток, включая дополнительные poster/fallback/cover.
function collectStoryResourcePathRefs(story) {
  var result = [];
  var assets = story && story.assets ? story.assets : {};

  // Добавляет в список только реальные строковые пути, чтобы валидатор имён не дублировал ошибки пустых file=.
  function addPathRef(path, category, ref) {
    if (typeof path !== "string") return;
    var value = path.trim();
    if (!value) return;
    result.push({
      path: value,
      category: category,
      ref: ref
    });
  }

  // Добавляет все изображения photo-метки независимо от строкового или объектного формата записи.
  function addPhotoMarkPaths(mark, category, ref) {
    var images = normalizeBg360PhotoImages(mark);
    for (var i = 0; i < images.length; i++) {
      addPathRef(images[i] && images[i].file, category, ref + " / image " + (i + 1));
    }
  }

  // Обходит вложенные действия сценария, чтобы проверить прямые пути legacy photo-меток.
  function visitActions(actions, refPrefix) {
    if (!Array.isArray(actions)) return;

    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];
      if (!action || typeof action !== "object") continue;
      var actionRef = refPrefix + " / action " + (i + 1);

      if (action.type === "bg360marks" && Array.isArray(action.marks)) {
        for (var m = 0; m < action.marks.length; m++) {
          addPhotoMarkPaths(action.marks[m], "story360-photo", actionRef + " / mark " + (m + 1));
        }
      }

      if (action.type === "choice" && Array.isArray(action.choices)) {
        for (var c = 0; c < action.choices.length; c++) {
          visitActions(action.choices[c] && action.choices[c].actions, actionRef + " / choice " + (c + 1));
        }
      }

      if (action.type === "if_block") {
        var branches = Array.isArray(action.branches) ? action.branches : [];
        for (var b = 0; b < branches.length; b++) {
          visitActions(branches[b] && branches[b].actions, actionRef + " / branch " + (b + 1));
        }
        visitActions(action.elseActions, actionRef + " / else");
      }
    }
  }

  if (assets.backgrounds) {
    Object.entries(assets.backgrounds).forEach(function(entry) {
      var id = entry[0];
      var asset = entry[1];
      addPathRef(getBackgroundAssetPrimaryPath(asset), "background", id);
      addPathRef(getBackgroundAssetFallbackPath(asset), "background-fallback", id);
    });
  }

  if (assets.characters) {
    Object.entries(assets.characters).forEach(function(entry) {
      var charId = entry[0];
      var char = entry[1];
      if (!char || !char.images) return;

      Object.entries(char.images).forEach(function(imageEntry) {
        var emotion = imageEntry[0];
        addPathRef(characterController.getImagePath(imageEntry[1]), "character", charId + " (" + emotion + ")");
      });
    });
  }

  if (assets.audio) {
    Object.entries(assets.audio).forEach(function(entry) {
      addPathRef(getAudioAssetPrimaryPath(entry[1]), "audio", entry[0]);
    });
  }

  if (assets.games) {
    Object.entries(assets.games).forEach(function(entry) {
      var id = entry[0];
      var game = entry[1];
      if (game && typeof game === "object") {
        addPathRef(game.file, "game", id);
        addPathRef(game.cover, "game-cover", id);
      } else {
        addPathRef(game, "game", id);
      }
    });
  }

  if (assets.videos) {
    Object.entries(assets.videos).forEach(function(entry) {
      var id = entry[0];
      var video = entry[1];
      if (video && typeof video === "object") {
        addPathRef(video.file, "video", id);
        addPathRef(video.poster, "video-poster", id);
      } else {
        addPathRef(video, "video", id);
      }
    });
  }

  var scenes = story && Array.isArray(story.scenes) ? story.scenes : [];
  for (var s = 0; s < scenes.length; s++) {
    var scene = scenes[s] || {};
    visitActions(scene.actions, "scene " + String(scene.id || (s + 1)));
  }

  var root = getStory360Root();
  if (root && root.spaces && typeof root.spaces === "object") {
    Object.keys(root.spaces).forEach(function(spaceId) {
      var panoramas = getStory360Panoramas(root.spaces[spaceId]);
      if (!panoramas) return;

      Object.keys(panoramas).forEach(function(panoramaId) {
        var panorama = panoramas[panoramaId];
        if (!panorama || typeof panorama !== "object") return;
        var panoramaRef = String(spaceId) + "." + String(panoramaId);
        addPathRef(readStory360Field(panorama, ["file", "src", "path"]), "story360", panoramaRef);
        addPathRef(readStory360Field(panorama, ["fallback", "poster"]), "story360-fallback", panoramaRef);

        var marks = panorama.marks || panorama.hotspots || panorama.points;
        if (!Array.isArray(marks)) return;
        for (var m = 0; m < marks.length; m++) {
          addPhotoMarkPaths(marks[m], "story360-photo", panoramaRef + " / mark " + (m + 1));
        }
      });
    });
  }

  return result;
}

// Группирует ошибки имён по пути, чтобы один и тот же ресурс показывался один раз со всеми местами использования.
function collectInvalidResourcePathNames(story) {
  var grouped = {};
  var refs = collectStoryResourcePathRefs(story);

  for (var i = 0; i < refs.length; i++) {
    var item = refs[i];
    var issues = findInvalidResourcePathNameSegments(item.path);
    if (!issues.length) continue;

    if (!grouped[item.path]) {
      grouped[item.path] = {
        path: item.path,
        refs: [],
        issues: issues,
        refMap: {}
      };
    }

    var refText = item.category + ": " + item.ref;
    if (!grouped[item.path].refMap[refText]) {
      grouped[item.path].refMap[refText] = true;
      grouped[item.path].refs.push(refText);
    }
  }

  return Object.keys(grouped).sort().map(function(path) {
    return {
      path: grouped[path].path,
      refs: grouped[path].refs,
      issues: grouped[path].issues
    };
  });
}

// Добавляет ссылку на CSS-панораму в группу по пути и качеству, чтобы normal/mobile проверялись как разные фактические пакеты.
function addPanoramaPackageReference(groups, pathValue, qualityValue, ref) {
  var path = typeof pathValue === "string" ? pathValue.trim() : "";
  if (!path || !groups) return;
  var quality = normalizeBg360Quality(qualityValue, "auto");
  var groupKey = path + "\u0000" + quality;
  if (!groups[groupKey]) groups[groupKey] = { path: path, quality: quality, refs: [] };
  if (groups[groupKey].refs.indexOf(ref) === -1) groups[groupKey].refs.push(ref);
}

// Собирает семантические 360-изображения и все явно выбранные качества входов story360; панорамные видео остаются обычными видео.
function collectPanoramaPackageReferences(story) {
  var groups = Object.create(null);
  var backgrounds = story && story.assets && story.assets.backgrounds;
  if (backgrounds && typeof backgrounds === "object") {
    Object.keys(backgrounds).sort().forEach(function(id) {
      var entry = backgrounds[id];
      var path = getBackgroundAssetPrimaryPath(entry);
      if (getBackgroundAssetIs360(entry) && !isVideoAssetPath(path)) {
        addPanoramaPackageReference(groups, path, getBackgroundAssetQuality(entry) || "auto", "background: " + id);
      }
    });
  }

  var root = getStory360Root();
  var spaces = root && root.spaces && typeof root.spaces === "object" ? root.spaces : null;
  if (spaces) {
    Object.keys(spaces).sort().forEach(function(spaceId) {
      var panoramas = getStory360Panoramas(spaces[spaceId]);
      if (!panoramas) return;
      Object.keys(panoramas).sort().forEach(function(panoramaId) {
        var panorama = panoramas[panoramaId];
        if (!panorama || typeof panorama !== "object") return;
        var media = getStory360PanoramaMedia(spaceId, panoramaId, panorama);
        if (media && media.file && !isVideoAssetPath(media.file)) {
          var quality = normalizeBg360Quality(readStory360Field(panorama, ["quality"]), null);
          if (!quality && media.assetInfo) quality = media.assetInfo.quality;
          addPanoramaPackageReference(groups, media.file, quality || "auto", "story360: " + spaceId + "." + panoramaId);
          var entries = panorama.entries || panorama.entryPoints || panorama.focuses;
          if (entries && typeof entries === "object") {
            Object.keys(entries).sort().forEach(function(entryId) {
              var entryQuality = normalizeBg360Quality(readStory360Field(entries[entryId], ["quality"]), null);
              if (entryQuality) {
                addPanoramaPackageReference(
                  groups,
                  media.file,
                  entryQuality,
                  "story360 entry: " + spaceId + "." + panoramaId + "@" + entryId
                );
              }
            });
          }
        }
      });
    });
  }

  return Object.keys(groups).sort().map(function(groupKey) {
    return groups[groupKey];
  });
}

// Проверяет обычные ресурсы и мгновенно присоединяет текущий снимок фоновой полной проверки CSS-панорам.
function checkAssetsFiles() {
  return new Promise((resolve) => {
    const result = {
      missing: [],
      sizeErrors: [], // файлы с неправильными размерами
      invalidNames: [],
      panoramaPackages: [],
      files: []
    };

    const storyAssets = STORY && STORY.assets ? STORY.assets : {};
    const panoramaReferences = collectPanoramaPackageReferences(STORY);
    result.panoramaPackages = checkPanoramaPackageReferences(panoramaReferences);
    let didFinish = false;

    // Возвращает актуальный срез кеша, не задерживая обычную статистику до завершения тяжёлой очереди панорам.
    function finishCheck() {
      if (didFinish) return;
      didFinish = true;
      result.panoramaPackages = checkPanoramaPackageReferences(panoramaReferences);
      resolve(result);
    }

    // Собираем все файлы из ассетов
    const allFiles = [];

    // Фоны
    if (storyAssets.backgrounds) {
      Object.entries(storyAssets.backgrounds).forEach(([id, path]) => {
        var primaryPath = getBackgroundAssetPrimaryPath(path);
        if (primaryPath && (!getBackgroundAssetIs360(path) || isVideoAssetPath(primaryPath))) {
          allFiles.push({ id, path: primaryPath, type: 'bg', category: 'background', ref: id });
        }
      });
    }

    // Персонажи (изображения)
    if (storyAssets.characters) {
      Object.entries(storyAssets.characters).forEach(([charId, char]) => {
        if (char.images) {
          Object.entries(char.images).forEach(([emotion, path]) => {
            allFiles.push({
              id: `${charId}_${emotion}`,
              path,
              type: 'char',
              category: 'character',
              ref: `${charId} (${emotion})`,
              charId: charId,
              emotion: emotion
            });
          });
        }
      });
    }

    // Аудио
    if (storyAssets.audio) {
      Object.entries(storyAssets.audio).forEach(([id, audioAsset]) => {
        // Аудио может быть строкой или объектом с file/volume, поэтому проверяем фактический путь.
        var audioPath = getAudioAssetPrimaryPath(audioAsset);
        if (typeof audioPath !== "string" || audioPath.trim() === "") {
          result.missing.push({
            path: `[invalid path: ${String(audioAsset)}]`,
            refs: [`audio: ${id}`]
          });
          return;
        }

        allFiles.push({
          id: id,
          path: audioPath.trim(),
          type: 'audio',
          category: 'audio',
          ref: id
        });
      });
    }

    // Игры
    if (storyAssets.games) {
      Object.entries(storyAssets.games).forEach(([id, game]) => {
        var gamePath = "";

        if (game && typeof game === "object") {
          gamePath = typeof game.file === "string" ? game.file.trim() : "";
        } else if (typeof game === "string") {
          gamePath = game.trim();
        }

        if (!gamePath) {
          result.missing.push({
            path: `[invalid path: ${String(game)}]`,
            refs: [`game: ${id}`]
          });
          return;
        }

        allFiles.push({
          id: id,
          path: gamePath,
          type: 'game',
          category: 'game',
          ref: id
        });
      });
    }

    if (storyAssets.videos) {
      Object.entries(storyAssets.videos).forEach(([id, video]) => {
        var videoPath = "";
        var posterPath = "";

        if (video && typeof video === "object") {
          videoPath = typeof video.file === "string" ? video.file.trim() : "";
          posterPath = typeof video.poster === "string" ? video.poster.trim() : "";
        } else if (typeof video === "string") {
          videoPath = video.trim();
        }

        if (!videoPath) {
          result.missing.push({
            path: `[invalid path: ${String(video)}]`,
            refs: [`video: ${id}`]
          });
          return;
        }

        allFiles.push({
          id: id,
          path: videoPath,
          type: 'video',
          category: 'video',
          ref: id
        });

        if (posterPath) {
          allFiles.push({
            id: id + '_poster',
            path: posterPath,
            type: 'video-poster',
            category: 'video-poster',
            ref: id
          });
        }
      });
    }

    result.invalidNames = collectInvalidResourcePathNames(STORY);

    if (allFiles.length === 0) {
      finishCheck();
      return;
    }

    // Группируем по пути
    const pathGroups = {};
    allFiles.forEach(file => {
      if (!pathGroups[file.path]) {
        pathGroups[file.path] = [];
      }
      pathGroups[file.path].push(file);
    });

    const uniquePaths = Object.keys(pathGroups);

    let loadedCount = 0;
    let errorCount = 0;
    const totalPaths = uniquePaths.length;

    const fileResults = {};

    function checkComplete() {
      if (isExplicitDebugCategoryEnabled("assets")) {
        console.log("[ASSET CHECK] progress", {
          totalPaths: totalPaths,
          loadedCount: loadedCount,
          errorCount: errorCount,
          done: loadedCount + errorCount
        });
      }

      if (loadedCount + errorCount === totalPaths) {
          // Собираем результаты
          uniquePaths.forEach(path => {

            if (isExplicitDebugCategoryEnabled("assets")) {
              console.log("[ASSET CHECK] checking path:", sanitizeDiagnosticResource(path), {
                refs: pathGroups[path].map(function(file) { return file.category + ": " + file.ref; }),
                isImage: /\.(jpg|jpeg|png|gif|webp)$/i.test(path),
                isVideo: /\.(mp4|webm)$/i.test(path),
                isAudio: /\.(mp3|wav|ogg|flac|m4a)$/i.test(path),
                isGameHtml: /\.(html|htm)$/i.test(path)
              });
            }

            if (fileResults[path] && fileResults[path].success) {
              result.files.push(fileResults[path].data);

              // Проверяем соответствие требованиям
              const fileData = fileResults[path].data;
              if (fileData.width && fileData.height) {
                let required = { width: 0, height: 0 };

                if (fileData.category === 'bg') {
                  required = { width: 1080, height: 1920 };
                } else if (fileData.category === 'char') {
                  required = { width: 500, height: 1200 };
                }

                if (required.width > 0 && required.height > 0) {
                  const errors = [];
                  if (fileData.width < required.width) {
                    errors.push(`width ${fileData.width}px < ${required.width}px`);
                  }
                  if (fileData.height < required.height) {
                    errors.push(`height ${fileData.height}px < ${required.height}px`);
                  }

                  if (errors.length > 0) {
                    result.sizeErrors.push({
                      path: path,
                      refs: pathGroups[path].map(f => `${f.category}: ${f.ref}`),
                      width: fileData.width,
                      height: fileData.height,
                      required: required,
                      errors: errors
                    });
                  }
                }
              }
            } else {
              result.missing.push({
                path: path,
                refs: pathGroups[path].map(f => `${f.category}: ${f.ref}`)
              });
            }
          });

          if (isExplicitDebugCategoryEnabled("assets")) {
            console.log("[ASSET CHECK] complete", {
              totalPaths: totalPaths,
              loadedCount: loadedCount,
              errorCount: errorCount,
              missing: result.missing.length,
              sizeErrors: result.sizeErrors.length,
              invalidNames: result.invalidNames.length,
              files: result.files.length
            });
          }
          finishCheck();
        }
      }

      // Проверяем каждый уникальный файл
      uniquePaths.forEach(path => {
        if (path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          // Проверка изображения: та же цепочка webp→исходник, что и в рантайме новеллы.
          let isResolved = false;

          const timeout = setTimeout(() => {
              if (!isResolved) {
                  isResolved = true;
                  errorCount++;
                  checkComplete();
              }
          }, 5000);

          loadRasterImageResource(path, {
            onLoad: function(img) {
              if (isResolved) return;
              isResolved = true;
              clearTimeout(timeout);

              const firstFile = pathGroups[path][0];
              const category = firstFile.type; // 'bg' или 'char'

              fileResults[path] = {
                  success: true,
                  data: {
                      path: path,
                      width: img.width,
                      height: img.height,
                      category: category,
                      refs: pathGroups[path].map(f => `${f.category}: ${f.ref}`)
                  }
              };

              loadedCount++;
              checkComplete();
            },
            onError: function() {
              if (isResolved) return;
              isResolved = true;
              clearTimeout(timeout);

              errorCount++;
              checkComplete();
            }
          });
        } else if (path.match(/\.(mp4|webm)$/i)) {
          // Видео по сети не проверяем — слишком тяжело и часто даёт ложные таймауты.
          const firstFile = pathGroups[path][0];
          fileResults[path] = {
            success: true,
            data: {
              path: path,
              category: firstFile.category,
              refs: pathGroups[path].map(f => `${f.category}: ${f.ref}`),
              skippedCheck: true
            }
          };

          loadedCount++;
          checkComplete();
        } else if (path.match(/\.(mp3|wav|ogg|flac|m4a)$/i)) {
          // Проверка аудиофайла
          const audio = new Audio();
          let isResolved = false;

          const timeout = setTimeout(() => {
            if (!isResolved) {
              isResolved = true;
              errorCount++;
              checkComplete();
            }
          }, 5000);

          audio.oncanplaythrough = function() {
            if (isResolved) return;
            isResolved = true;
            clearTimeout(timeout);

            fileResults[path] = {
              success: true,
              data: {
                path: path,
                category: 'audio',
                duration: Math.round(audio.duration),
                refs: pathGroups[path].map(f => `${f.category}: ${f.ref}`)
              }
            };

            loadedCount++;
            checkComplete();
          };

          audio.onerror = function() {
            if (isResolved) return;
            isResolved = true;
            clearTimeout(timeout);

            errorCount++;
            checkComplete();
          };

          audio.src = path + '?' + Date.now();

        } else if (path.match(/\.(html|htm)$/i)) {
          // HTML-игры по сети не проверяем (без fetch — CSP/смешанный контент).
          const firstFile = pathGroups[path][0];
          fileResults[path] = {
            success: true,
            data: {
              path: path,
              category: firstFile.category,
              refs: pathGroups[path].map(f => `${f.category}: ${f.ref}`),
              skippedCheck: true
            }
          };

          loadedCount++;
          checkComplete();
        } else {
          console.warn("[ASSET CHECK] unsupported file type:", sanitizeDiagnosticResource(path));
          errorCount++;
          checkComplete();
        }
      });
  });
}








// Обходит команды goto360 в обычных сценах и вложенных ветках, чтобы граф показывал входы в 360-пространства.
function forEachOutgoingStory360Target(actions, cb, currentLabel) {
  if (!Array.isArray(actions)) return;
  var label = currentLabel || "";

  for (var i = 0; i < actions.length; i++) {
    var act = actions[i];
    if (!act || !act.type) continue;

    if (act.type === "goto360" && act.spaceId && act.panoramaId) {
      cb({
        spaceId: String(act.spaceId || "").trim(),
        panoramaId: String(act.panoramaId || "").trim(),
        label: label
      });
      continue;
    }

    if (act.type === "if_block") {
      if (Array.isArray(act.branches)) {
        for (var b = 0; b < act.branches.length; b++) {
          var br = act.branches[b];
          if (br && Array.isArray(br.actions)) {
            forEachOutgoingStory360Target(br.actions, cb, String(br.condition || ""));
          }
        }
      }
      if (Array.isArray(act.elseActions)) {
        forEachOutgoingStory360Target(act.elseActions, cb, "else");
      }
      continue;
    }

    if (act.type === "choice" && Array.isArray(act.choices)) {
      for (var c = 0; c < act.choices.length; c++) {
        var ch = act.choices[c];
        if (!ch || !Array.isArray(ch.actions)) continue;
        forEachOutgoingStory360Target(ch.actions, cb, String(ch.text || ""));
      }
    }
  }
}

// Кодирует пользовательский идентификатор в Mermaid-id только из ASCII и без коллизий от замены спецсимволов.
function getMermaidSafeNodeId(prefix, value) {
  var source = String(value === undefined || value === null ? "" : value);
  var encoded = [];
  for (var index = 0; index < source.length; index++) {
    encoded.push(source.charCodeAt(index).toString(36));
  }
  return String(prefix || "node").replace(/[^A-Za-z0-9_]/g, "_") + "_" + (encoded.length ? encoded.join("_") : "empty");
}

// Создаёт стабильный id узла Mermaid для 360-панорамы, чтобы он не конфликтовал с id обычных сцен.
function getStory360GraphNodeId(spaceId, panoramaId) {
  return getMermaidSafeNodeId("story360", String(spaceId || "") + "\u0000" + String(panoramaId || ""));
}

// Возвращает человекочитаемую ссылку на 360-панораму в формате space.panorama.
function getStory360GraphRef(spaceId, panoramaId) {
  return String(spaceId || "").trim() + "." + String(panoramaId || "").trim();
}

// Подписывает ребро 360-графа именем метки и условием visibleIf, чтобы статистика показывала скрытую логику перехода.
function formatStory360GraphMarkLabel(mark) {
  if (!mark || typeof mark !== "object") return "";
  var base = String(mark.label || mark.id || "").trim();
  var visibleIf = getStory360MarkVisibleIf(mark);
  if (!visibleIf) return base;
  return base ? (base + " if " + visibleIf) : ("if " + visibleIf);
}

// Собирает все 360-панорамы, их превью и связи из story360.js и входы goto360 из обычного сценария.
function buildStory360GraphData(story) {
  var result = {
    nodes: [],
    nodeMap: {},
    edges: []
  };
  var root = getStory360Root();
  if (!root || !root.spaces || typeof root.spaces !== "object") return result;

  // Добавляет связь 360-графа и пропускает неполные переходы без источника или цели.
  function addEdge(from, to, label, kind) {
    if (!from || !to) return;
    result.edges.push({
      from: from,
      to: to,
      label: String(label || ""),
      kind: kind || ""
    });
  }

  var spaces = root.spaces || {};
  var spaceIds = Object.keys(spaces).sort();
  for (var si = 0; si < spaceIds.length; si++) {
    var spaceId = spaceIds[si];
    var space = spaces[spaceId];
    var panoramas = getStory360Panoramas(space);
    if (!panoramas) continue;

    var panoramaIds = Object.keys(panoramas).sort();
    for (var pi = 0; pi < panoramaIds.length; pi++) {
      var panoramaId = panoramaIds[pi];
      var panorama = panoramas[panoramaId];
      if (!panorama || typeof panorama !== "object") continue;

      var media = getStory360PanoramaMedia(spaceId, panoramaId, panorama);
      var quality = normalizeBg360Quality(readStory360Field(panorama, ["quality"]), null);
      if (!quality && media && media.assetInfo) quality = media.assetInfo.quality;
      if (!quality) quality = "auto";

      var node = {
        id: getStory360GraphNodeId(spaceId, panoramaId),
        ref: getStory360GraphRef(spaceId, panoramaId),
        spaceId: String(spaceId || ""),
        panoramaId: String(panoramaId || ""),
        panorama: panorama,
        bgId: media ? media.bgId : "",
        file: media ? media.file : "",
        quality: quality,
        markCount: 0,
        outgoing360Count: 0,
        outgoingSceneCount: 0,
        incomingCount: 0
      };

      result.nodes.push(node);
      result.nodeMap[node.ref] = node;
    }
  }

  var scenes = story && story.scenes ? story.scenes : [];
  for (var s = 0; s < scenes.length; s++) {
    var scene = scenes[s];
    if (!scene || !scene.id) continue;
    forEachOutgoingStory360Target(scene.actions || [], function(edge) {
      var targetRef = getStory360GraphRef(edge.spaceId, edge.panoramaId);
      var targetNode = result.nodeMap[targetRef];
      var targetId = targetNode ? targetNode.id : getStory360GraphNodeId(edge.spaceId, edge.panoramaId);
      if (targetNode) targetNode.incomingCount++;
      addEdge(scene.id, targetId, edge.label, "scene-to-360");
    });
  }

  for (var n = 0; n < result.nodes.length; n++) {
    var node = result.nodes[n];
    var marks = normalizeStory360Marks(node.spaceId, node.panorama);
    node.markCount = marks.length;

    for (var mi = 0; mi < marks.length; mi++) {
      var mark = marks[mi];
      var target = mark && mark.target ? mark.target : null;
      if (!target) continue;

      var markLabel = formatStory360GraphMarkLabel(mark);
      if (target.type === "360") {
        var targetSpace = target.spaceId || node.spaceId;
        var targetPanorama = target.panoramaId || "";
        var target360Ref = getStory360GraphRef(targetSpace, targetPanorama);
        var target360Node = result.nodeMap[target360Ref];
        var target360Id = target360Node ? target360Node.id : getStory360GraphNodeId(targetSpace, targetPanorama);
        if (target360Node) target360Node.incomingCount++;
        node.outgoing360Count++;
        addEdge(node.id, target360Id, markLabel, "360-to-360");
        continue;
      }

      if (target.type === "scene" && target.sceneId) {
        node.outgoingSceneCount++;
        addEdge(node.id, target.sceneId, markLabel, "360-to-scene");
      }
    }
  }

  return result;
}

// Готовит связи 360-графа к отрисовке: взаимные переходы между 360-панорамами схлопывает в одну двустороннюю стрелку.
function buildRenderableStory360Edges(edges) {
  var sourceEdges = Array.isArray(edges) ? edges : [];
  var grouped360 = {};
  var renderable = [];

  for (var i = 0; i < sourceEdges.length; i++) {
    var edge = sourceEdges[i];
    if (!edge || !edge.from || !edge.to || edge.kind !== "360-to-360") continue;

    var a = String(edge.from);
    var b = String(edge.to);
    var pairKey = a < b ? (a + "\u0000" + b) : (b + "\u0000" + a);
    if (!grouped360[pairKey]) {
      grouped360[pairKey] = {
        labels: [],
        lowToHigh: false,
        highToLow: false
      };
    }

    var group = grouped360[pairKey];
    var edgeLabel = String(edge.label || "").trim();
    if (edgeLabel !== "") group.labels.push(edgeLabel);
    if (a <= b) {
      group.lowToHigh = true;
    } else {
      group.highToLow = true;
    }
  }

  var renderedPairs = {};
  for (var r = 0; r < sourceEdges.length; r++) {
    var sourceEdge = sourceEdges[r];
    if (!sourceEdge || !sourceEdge.from || !sourceEdge.to) continue;

    if (sourceEdge.kind === "360-to-360") {
      var from = String(sourceEdge.from);
      var to = String(sourceEdge.to);
      var sourcePairKey = from < to ? (from + "\u0000" + to) : (to + "\u0000" + from);
      var sourceGroup = grouped360[sourcePairKey];
      if (sourceGroup && sourceGroup.lowToHigh && sourceGroup.highToLow) {
        if (renderedPairs[sourcePairKey]) continue;
        renderedPairs[sourcePairKey] = true;
        renderable.push({
          from: sourceEdge.from,
          to: sourceEdge.to,
          label: sourceGroup.labels.join(", "),
          bidirectional: true,
          kind: "360-to-360"
        });
        continue;
      }
    }

    renderable.push({
      from: sourceEdge.from,
      to: sourceEdge.to,
      label: String(sourceEdge.label || ""),
      bidirectional: false,
      kind: sourceEdge.kind || ""
    });
  }

  return renderable;
}

// Считает достижимость по объединённому графу: обычные сцены, входы goto360 и переходы между 360-панорамами.
function buildCombinedStoryGraphReachability(story, story360GraphData) {
  var scenes = story && story.scenes ? story.scenes : [];
  var startId = (story && story.meta && story.meta.start) ? story.meta.start : null;
  var allNodes = {};
  var sceneMap = {};
  var adj = {};

  // Регистрирует узел объединённого графа и заранее готовит список исходящих связей.
  function addNode(id) {
    if (!id) return;
    allNodes[id] = true;
    if (!adj[id]) adj[id] = [];
  }

  // Добавляет направленный переход в объединённый граф, создавая технические узлы при необходимости.
  function addEdge(from, to) {
    if (!from || !to) return;
    addNode(from);
    addNode(to);
    adj[from].push(to);
  }

  for (var i = 0; i < scenes.length; i++) {
    if (scenes[i] && scenes[i].id) {
      sceneMap[scenes[i].id] = true;
      addNode(scenes[i].id);
    }
  }

  for (var s = 0; s < scenes.length; s++) {
    var scene = scenes[s];
    if (!scene || !scene.id) continue;

    window.VN_STORY_GRAPH.forEachOutgoingTarget(scene.actions || [], function(edge) {
      addEdge(scene.id, edge.to);
    });
  }

  var story360 = story360GraphData || buildStory360GraphData(story);
  var story360Nodes = story360.nodes || [];
  for (var n = 0; n < story360Nodes.length; n++) {
    addNode(story360Nodes[n].id);
  }

  var story360Edges = story360.edges || [];
  for (var e = 0; e < story360Edges.length; e++) {
    addEdge(story360Edges[e].from, story360Edges[e].to);
  }

  var visited = window.VN_STORY_GRAPH.findReachableNodes(startId, allNodes, adj);

  var reachableScenes = [];
  var unreachableScenes = [];
  for (var id in sceneMap) {
    if (!Object.prototype.hasOwnProperty.call(sceneMap, id)) continue;
    if (visited[id]) reachableScenes.push(id);
    else unreachableScenes.push(id);
  }

  var unreachableStory360 = {};
  for (var pn = 0; pn < story360Nodes.length; pn++) {
    var panoNode = story360Nodes[pn];
    if (!visited[panoNode.id]) unreachableStory360[panoNode.id] = true;
  }

  reachableScenes.sort();
  unreachableScenes.sort();

  return {
    visited: visited,
    reachableScenes: reachableScenes,
    unreachableScenes: unreachableScenes,
    unreachableStory360: unreachableStory360
  };
}

function findUnreachableScenes(story) {
  var startId = (story.meta && story.meta.start) ? story.meta.start : null;
  var built = window.VN_STORY_GRAPH.buildAdjacency(story);
  var sceneMap = built.sceneMap;

  if (!startId || !sceneMap[startId]) {
    // Если стартовая сцена не задана/не найдена — считаем всё “сомнительным”
    return { unreachable: Object.keys(sceneMap).sort(), reachable: [] };
  }

  var combinedReach = buildCombinedStoryGraphReachability(story, buildStory360GraphData(story));
  return { unreachable: combinedReach.unreachableScenes, reachable: combinedReach.reachableScenes };
}

// Сборка Mermaid-графа сценария.
//
// scope "full" — все сцены и переходы. На больших историях Mermaid может не отрисовать диаграмму;
// тогда buildMermaidVariant переключается на compact (крупнее узлы, меньше деталей в метках).
//
// scope "resources" — компактный граф для обзора ресурсов (в коде и UI раньше назывался «intro»;
// это НЕ «вступительная глава» сюжета). На диаграмме только стартовая сцена и минимум рёбер (Mermaid
// не раздувается). Блоки characters / background / games / audio / video — те же полные списки, что и при scope
// "full" (only*Ids не задаются): пунктир к attachSceneId = meta.start лишь якорит узлы на старте.
// Блоки audio/video берут все объявленные ассеты, как обзор ресурсов, а не только использованные команды.
function buildMermaidGraph(story, unreachableList, options) {
  options = options || {};

  var compact = !!options.compact;
  var scope = options.scope || "full";
  
  var scenes = story.scenes || [];
  var startSceneId = (story.meta && story.meta.start) ? story.meta.start : (scenes[0] ? scenes[0].id : "START");
  var attachSceneId = getMermaidSafeNodeId("scene", startSceneId);

  // Набор недостижимых сцен для подсветки
  var unreachableSet = {};
  if (unreachableList && unreachableList.length) {
    for (var ui = 0; ui < unreachableList.length; ui++) {
      unreachableSet[unreachableList[ui]] = true;
    }
  }
  
  // Карта сцен для проверки существования
  var sceneMap = {};
  for (var i = 0; i < scenes.length; i++) {
    if (scenes[i] && scenes[i].id) sceneMap[scenes[i].id] = scenes[i];
  }
  
  // Сбор информации о вершинах и рёбрах
  var nodes = [];
  var edges = [];
  var incomingEdges = {}; // Словарь для подсчета входящих связей
  var outgoingEdges = {}; // Словарь для подсчета исходящих связей
  // Отдельно считаем исходящие связи в любые сцены, кроме стартовой.
  // Нужно для определения "финальной" сцены: возврат в стартовую сцену
  // не должен лишать сцену статуса финала.
  var outgoingEdgesNonStart = {};
  
  for (var s = 0; s < scenes.length; s++) {
    var scene = scenes[s];
    if (!scene || !scene.id) continue;
    
    var actions = scene.actions || [];
    
    // --- метрики вершины ---
    var charSet = {};
    var sayCount = 0;
    var textCount = 0;
    var bgmCount = 0;
    var bgCount = 0;        // СЧЕТЧИК ФОНОВ
    var sceneBgImageCount = 0; // Счетчик вызовов обычных bg-изображений в сцене
    var sceneBg360Count = 0;   // Счетчик вызовов 360-фонов в сцене
    var uniqueBgs = {};     // Для подсчета уникальных фонов
    var uniqueBgImages = {}; // Уникальные обычные bg-изображения
    var uniqueBg360 = {};    // Уникальные 360-фоны
    var firstBgSrc = null;  // Для первого фона
    var firstBgId = null;   // ID первого фона
    
    // массив для хранения ВСЕХ фонов в сцене (в порядке появления)
    var allBgImages = [];   // Массив объектов {src, id, order}

     // игры, использованные в сцене
    var gameSet = {};

    // Инициализируем счетчики связей
    if (!incomingEdges[scene.id]) incomingEdges[scene.id] = 0;
    if (!outgoingEdges[scene.id]) outgoingEdges[scene.id] = 0;
    
    // Сквозная нумерация нужна, чтобы сохранить порядок первого появления фона
    // даже когда он найден во вложенных ветках choice/if_block.
    var bgVisitOrder = 0;

    // Рекурсивно собирает статистику сцены по всем вложенным действиям:
    // основная лента, меню, if-блоки и их подветки.
    function collectSceneActionStats(nestedActions) {
      if (!Array.isArray(nestedActions)) return;

      for (var ia = 0; ia < nestedActions.length; ia++) {
        var act = nestedActions[ia];
        if (!act || !act.type) continue;

        if (act.type === "char" && act.charId) {
          charSet[act.charId] = true;
        }

        if (act.type === "game" && act.gameId) {
          gameSet[act.gameId] = true;
        }

        if (act.type === "say") sayCount++;
        if (act.type === "text") textCount++;
        if (act.type === "bgm") bgmCount++;

        // Подсчёт фонов и сохранение превью для карточки сцены.
        if (act.type === "bg" && act.src) {
          bgCount++;
          var bgId = window.VN_STORY_ANALYSIS.extractAliasId(act.src, "bg");
          if (bgId) {
            uniqueBgs[bgId] = true;

            // Получаем реальный путь к ассету из [bg].
            var bgSrc = null;
            if (story.assets && story.assets.backgrounds) {
              bgSrc = getBackgroundAssetPrimaryPath(story.assets.backgrounds[bgId]);
            }

            // Разделяем вызовы по типам, чтобы в сцене были отдельные счетчики 🖼️ и 🌐.
            if (bgSrc && isBg360PackPath(bgSrc)) {
              sceneBg360Count++;
              uniqueBg360[bgId] = true;
            } else if (bgSrc && !isVideoAssetPath(bgSrc)) {
              sceneBgImageCount++;
              uniqueBgImages[bgId] = true;
            }

            // Для превью сцены добавляем только первое вхождение каждого bgId.
            if (bgSrc) {
              var isDuplicate = false;
              for (var di = 0; di < allBgImages.length; di++) {
                if (allBgImages[di].id === bgId) {
                  isDuplicate = true;
                  break;
                }
              }

              if (!isDuplicate) {
                allBgImages.push({
                  src: bgSrc,
                  id: bgId,
                  order: bgVisitOrder++
                });
              }
            }

            // Сохраняем первый фон (для обратной совместимости).
            if (firstBgId === null) {
              firstBgId = bgId;
              firstBgSrc = bgSrc;
            }
          }
        }

        if (act.type === "choice" && Array.isArray(act.choices)) {
          for (var ci = 0; ci < act.choices.length; ci++) {
            var ch = act.choices[ci];
            if (ch && Array.isArray(ch.actions)) {
              collectSceneActionStats(ch.actions);
            }
          }
        }

        if (act.type === "if_block") {
          if (Array.isArray(act.branches)) {
            for (var bi = 0; bi < act.branches.length; bi++) {
              var br = act.branches[bi];
              if (br && Array.isArray(br.actions)) {
                collectSceneActionStats(br.actions);
              }
            }
          }
          if (Array.isArray(act.elseActions)) {
            collectSceneActionStats(act.elseActions);
          }
        }
      }
    }

    collectSceneActionStats(actions);

    // Рёбра графа считаем отдельно по верхнему уровню:
    // Общий модуль графа сам рекурсивно обходит вложенные goto в choice/if_block.
    for (var a = 0; a < actions.length; a++) {
      var act = actions[a];
      if (!act || !act.type) continue;
      window.VN_STORY_GRAPH.forEachOutgoingTarget([act], function (edge) {
        var lbl = String(edge.label || "");
        if (lbl.length > 40) lbl = lbl.substring(0, 40) + "...";

        edges.push({
          from: getMermaidSafeNodeId("scene", scene.id),
          to: getMermaidSafeNodeId("scene", edge.to),
          label: lbl
        });

        outgoingEdges[scene.id] = (outgoingEdges[scene.id] || 0) + 1;
        // Учитываем только переходы в "не стартовую" сцену:
        // ссылка обратно в стартовую сцену допускается у финала.
        if (edge.to !== startSceneId) {
          outgoingEdgesNonStart[scene.id] = (outgoingEdgesNonStart[scene.id] || 0) + 1;
        }

        if (!incomingEdges[edge.to]) incomingEdges[edge.to] = 0;
        incomingEdges[edge.to]++;
      });
    }
    
    // СОРТИРУЕМ фоны по порядку появления (на всякий случай)
    allBgImages.sort(function(a, b) {
      return a.order - b.order;
    });

    nodes.push({
      id: getMermaidSafeNodeId("scene", scene.id),
      sceneId: scene.id,
      characters: keysSorted(charSet),
      games: keysSorted(gameSet),
      phraseCount: (sayCount + textCount),
      bgmCount: bgmCount,
      bgCount: bgCount, // Общее количество смен фонов
      uniqueBgCount: Object.keys(uniqueBgs).length, // Количество уникальных фонов
      bgImageCount: sceneBgImageCount, // Количество вызовов обычных bg-изображений
      uniqueBgImageCount: Object.keys(uniqueBgImages).length, // Уникальные обычные bg-изображения
      bg360Count: sceneBg360Count, // Количество вызовов 360-фонов
      uniqueBg360Count: Object.keys(uniqueBg360).length, // Уникальные 360-фоны
      firstBgSrc: firstBgSrc,  // Путь к первому фону
      firstBgId: firstBgId,    // ID первого фона
      allBgImages: allBgImages // добавляем массив всех фонов
    });
    
  } // for






  var story360GraphData = scope === "resources" ? { nodes: [], edges: [] } : buildStory360GraphData(story);
  var combinedReachability = scope === "resources"
    ? null
    : buildCombinedStoryGraphReachability(story, story360GraphData);

  if (story360GraphData.edges && story360GraphData.edges.length) {
    for (var se = 0; se < story360GraphData.edges.length; se++) {
      var story360EdgeForStats = story360GraphData.edges[se];
      if (story360EdgeForStats.kind === "scene-to-360") {
        outgoingEdges[story360EdgeForStats.from] = (outgoingEdges[story360EdgeForStats.from] || 0) + 1;
        outgoingEdgesNonStart[story360EdgeForStats.from] = (outgoingEdgesNonStart[story360EdgeForStats.from] || 0) + 1;
      } else if (story360EdgeForStats.kind === "360-to-scene") {
        if (!incomingEdges[story360EdgeForStats.to]) incomingEdges[story360EdgeForStats.to] = 0;
        incomingEdges[story360EdgeForStats.to]++;
      }
    }
  }



  // Формируем Mermaid граф
  var mermaid = "graph LR;\n";  // LR = Left to Right (как в DOT)

  // Добавляем заголовок
  mermaid += "%% " + escapeMermaidComment((story.meta && story.meta.title) ? story.meta.title : "Visual Novel") + "\n";

  // Стили для узлов. Основные настройки производятся в CSS
  mermaid += "%% Defining styles for scenes\n";
  mermaid += "classDef scene fill:#fff3e0,stroke:#e6d6bc,color:#000,stroke-width:1px,r:12px;\n";
  mermaid += "classDef panorama360 fill:#e7f6f2,stroke:#4f9a8b,color:#000,stroke-width:1px,r:12px;\n";
  mermaid += "classDef start fill:#e1f5e1,stroke:#b6deb6,color:#000,stroke-width:2px,r:15px;\n";
  mermaid += "classDef unreachable fill:#ffebee,stroke:#ff0000,color:#000,stroke-dasharray:5 5,stroke-width:2px,r:12px;\n";
  mermaid += "classDef final fill:#f3e5f5,stroke:#e0bfe2,color:#000,stroke-width:2px,r:14px;\n\n";

  // Стили для специальных узлов (серые тона)
  mermaid += "%% Defining styles for special nodes\n";
  mermaid += "classDef characters-group fill:#e0e0e0,stroke:#808080,color:#333,stroke-width:2px,r:12px;\n";
  mermaid += "classDef character-node fill:#d0d0d0,stroke:#808080,color:#333,stroke-width:1px,r:12px;\n";
  mermaid += "classDef backgrounds-group fill:#c0c0c0,stroke:#606060,color:#333,stroke-width:2px,r:12px;\n\n";
  mermaid += "classDef games-group fill:#c0c0c0,stroke:#606060,color:#333,stroke-width:2px,r:12px;\n";
  mermaid += "classDef game-node fill:#d0d0d0,stroke:#808080,color:#333,stroke-width:1px,r:12px;\n";

  var graphStats = window.VN_STORY_ANALYSIS.computeStoryStats(story);

  var sharedGraphOptions = {
    compact: compact,
    attachTo: attachSceneId,
    characterEmotionCounts: graphStats.characterEmotionCounts || {},
    backgroundCounts: graphStats.backgroundCounts || {}
  };

  var charGraphData = buildCharactersGraph(story, sharedGraphOptions);
  mermaid += charGraphData.mermaid;
  mermaid += "\n";

  mermaid += buildBackgroundsGraph(story, sharedGraphOptions);
  mermaid += "\n";

  mermaid += buildGamesGraph(story, sharedGraphOptions);
  mermaid += "\n";

  mermaid += buildAudioGraph(story, sharedGraphOptions);
  mermaid += "\n";

  mermaid += buildVideoGraph(story, sharedGraphOptions);
  mermaid += "\n";

  // Создаем узлы с многострочными метками
  for (var n = 0; n < nodes.length; n++) {
    var node = nodes[n];
    if (scope === "resources" && node.sceneId !== startSceneId) {
      continue;
    }

    var chars = node.characters.length ? node.characters.map(escapeMermaidLabelText).join(", ") : "(none)";
    var games = (node.games && node.games.length) ? node.games : [];

    // Формируем многострочную метку - ВАЖНО: порядок элементов
    var label = escapeMermaidLabelText(node.sceneId) + "<br/>";

    var sceneVideoBgCount = 0;
    var sceneBgImagesOnly = [];
    var sceneBg360ImagesOnly = [];
    if (node.allBgImages && node.allBgImages.length > 0) {
      for (var b0 = 0; b0 < node.allBgImages.length; b0++) {
        var bg0 = node.allBgImages[b0];
        if (!bg0) continue;
        if (isVideoAssetPath(bg0.src)) {
          if (bg0.id) sceneVideoBgCount++;
        } else if (isBg360PackPath(bg0.src)) {
          sceneBg360ImagesOnly.push(bg0);
        } else {
          sceneBgImagesOnly.push(bg0);
        }
      }
    }

    if (!compact) {
      if (sceneBgImagesOnly.length > 0) {

        var sceneBgCountClass = getImgCountClass(sceneBgImagesOnly.length || 1);

        label += "<div class='scene-bg-images-container " + sceneBgCountClass + "'>";

        for (var b = 0; b < sceneBgImagesOnly.length; b++) {
          var bg = sceneBgImagesOnly[b];
          var imgSrc = getGraphImageSrc(bg.src);
          var safeBgId = escapeMermaidLabelText(bg.id || "");

          // Рамка вынесена в отдельную обёртку, чтобы изображение не перекрывало скруглённый контур.
          label += "<span class='scene-bg-frame " + sceneBgCountClass + "'>" +
                  "<img src='" + imgSrc + "'" + getGraphRasterImgDataAttr(bg.src) + " " +
                  "class='scene-bg-thumbnail " + sceneBgCountClass + "' " +
                  "data-id='" + safeBgId + "' " +
                  "data-index='" + b + "' " +
                  "title='" + safeBgId + "' " +
                  "alt='' />" +
                  "</span> ";
        }

        label += "</div>";
      }

      if (sceneBg360ImagesOnly.length > 0) {
        var sceneBg360CountClass = getImgCountClass(sceneBg360ImagesOnly.length || 1);
        label += "<div class='scene-bg-images-container " + sceneBg360CountClass + "'>";

        for (var b360 = 0; b360 < sceneBg360ImagesOnly.length; b360++) {
          var bg360 = sceneBg360ImagesOnly[b360];
          var safeBg360Id = escapeMermaidLabelText(bg360.id || "");
          var bgAsset = (story.assets && story.assets.backgrounds && bg360.id) ? story.assets.backgrounds[bg360.id] : null;
          var bg360AssetQuality = getBackgroundAssetQuality(bgAsset) || "auto";

          label += "<span class='scene-bg-frame scene-bg360-frame " + sceneBg360CountClass + "'>" +
                  "<img " +
                  "class='scene-bg-thumbnail scene-bg360-thumbnail bg360-graph-thumbnail " + sceneBg360CountClass + "' " +
                  "data-id='" + safeBg360Id + "' " +
                  "data-index='" + b360 + "' " +
                  "data-bg360-src='" + escapeMermaidLabelText(bg360.src || "") + "' " +
                  "data-bg360-quality='" + escapeMermaidLabelText(bg360AssetQuality) + "' " +
                  "title='" + safeBg360Id + "' " +
                  "alt='' />" +
                  "</span> ";
        }

        label += "</div>";
      }
    }

    // Статистика персонажей и счетчики - БЕЗ ЛИШНЕГО ПЕРЕНОСА СТРОКИ
    var statsParts = [];

    if (chars !== '(none)') {
      statsParts.push("<div>👤 " + chars + "</div>");
    }

    if (games.length > 0) {
      statsParts.push("<div>🎮 " + games.map(escapeMermaidLabelText).join(", ") + "</div>");
    }

    // Добавляем счетчики
    var counters = [];
    if (sceneVideoBgCount > 0) {
      counters.push("🎬" + sceneVideoBgCount);
    }
    if (node.bgImageCount !== 0) {
      counters.push("🖼️" + (node.bgImageCount === node.uniqueBgImageCount ? node.uniqueBgImageCount : (node.bgImageCount + "/" + node.uniqueBgImageCount)));
    }
    if (node.bg360Count !== 0) {
      counters.push("🌐" + (node.bg360Count === node.uniqueBg360Count ? node.uniqueBg360Count : (node.bg360Count + "/" + node.uniqueBg360Count)));
    }
    if (node.phraseCount !== 0) {
      counters.push("💬" + node.phraseCount);
    }
    if (node.bgmCount !== 0) {
      counters.push("🎵" + node.bgmCount);
    }

    // Объединяем статистику в одну строку
    var allStats = statsParts.concat(counters).join(" ");
    if (allStats.length > 0) {
      label += "<div>" + allStats + "</div>";
    }
    
    mermaid += '    ' + node.id + '["' + label + '"]\n';
    mermaid += '    class ' + node.id + ' scene;\n';  // Добавляем класс scene
  }

  if (scope !== "resources" && story360GraphData.nodes && story360GraphData.nodes.length) {
    mermaid += "\n    %% Story360 panorama nodes\n";
    for (var panoIndex = 0; panoIndex < story360GraphData.nodes.length; panoIndex++) {
      var panoNode = story360GraphData.nodes[panoIndex];
      var panoSafeTitle = escapeMermaidLabelText(panoNode.ref || panoNode.id);
      // Название 360-панорамы ставим первой строкой, чтобы узел читался так же, как обычная сцена.
      var panoLabel = "\uD83C\uDF10 " + escapeMermaidLabelText(panoNode.ref) + "<br/>";

      if (!compact && panoNode.file) {
        var panoImgClass = "imgcount1";
        panoLabel += "<div class='scene-bg-images-container " + panoImgClass + " story360-graph-preview'>";

        if (isBg360PackPath(panoNode.file)) {
          panoLabel += "<span class='scene-bg-frame scene-bg360-frame " + panoImgClass + "'>" +
            "<img " +
            "class='scene-bg-thumbnail scene-bg360-thumbnail bg360-graph-thumbnail " + panoImgClass + "' " +
            "data-id='" + escapeMermaidLabelText(panoNode.bgId || panoNode.ref || "") + "' " +
            "data-index='0' " +
            "data-bg360-src='" + escapeMermaidLabelText(panoNode.file || "") + "' " +
            "data-bg360-quality='" + escapeMermaidLabelText(panoNode.quality || "auto") + "' " +
            "title='" + panoSafeTitle + "' " +
            "alt='' />" +
            "</span>";
        } else if (!isVideoAssetPath(panoNode.file)) {
          panoLabel += "<span class='scene-bg-frame " + panoImgClass + "'>" +
            "<img src='" + getGraphImageSrc(panoNode.file) + "'" + getGraphRasterImgDataAttr(panoNode.file) + " " +
            "class='scene-bg-thumbnail " + panoImgClass + "' " +
            "data-id='" + escapeMermaidLabelText(panoNode.bgId || panoNode.ref || "") + "' " +
            "data-index='0' " +
            "title='" + panoSafeTitle + "' " +
            "alt='' />" +
            "</span>";
        }

        panoLabel += "</div>";
      }

      mermaid += '    ' + panoNode.id + '["' + panoLabel + '"]\n';
      mermaid += '    class ' + panoNode.id + ' panorama360;\n';
    }
  }

  mermaid += "\n";
    
  // Применяем классы
  mermaid += "%% Applying styles\n";
  for (var n = 0; n < nodes.length; n++) {
    var node = nodes[n];
    var classes = [];
    
    // Проверяем, является ли сцена стартовой
    if (node.sceneId === startSceneId) {
      classes.push("start");
    }
    
    // Проверяем, является ли сцена недостижимой
    if (unreachableSet[node.sceneId]) {
      classes.push("unreachable");
    }
    
    // Проверяем, является ли сцена финальной: есть входящие связи и нет
    // исходящих связей в любые сцены, КРОМЕ стартовой.
    // Допускается возврат в стартовую сцену (например, "Начать заново"),
    // он не лишает сцену статуса финала.
    // Также сцена не должна быть стартовой и не должна быть недостижимой.
    if (!unreachableSet[node.sceneId] &&
      node.sceneId !== startSceneId &&
      incomingEdges[node.sceneId] > 0 &&
      (!outgoingEdgesNonStart[node.sceneId] || outgoingEdgesNonStart[node.sceneId] === 0)) {
      classes.push("final");
    }
    
    if (classes.length > 0) {
      mermaid += '    class ' + node.id + ' ' + classes.join(',') + ';\n';
    }
  }

  if (scope !== "resources" && story360GraphData.nodes && story360GraphData.nodes.length) {
    for (var panoClassIndex = 0; panoClassIndex < story360GraphData.nodes.length; panoClassIndex++) {
      var panoClassNode = story360GraphData.nodes[panoClassIndex];
      if (combinedReachability && combinedReachability.unreachableStory360[panoClassNode.id]) {
        mermaid += '    class ' + panoClassNode.id + ' unreachable;\n';
      }
    }
  }
  
  mermaid += "\n%% Edges\n";
    
  // Создаем связи с подписями (только реальные связи из сценария)
  for (var e = 0; e < edges.length; e++) {
    var ed = edges[e];

    if (scope === "resources") {
      if (ed.from !== attachSceneId || ed.to !== attachSceneId) {
        continue;
      }
    }

    if (ed.label && ed.label.trim() !== "") {
      // Экранируем HTML, кавычки и управляющие символы до вставки в синтаксис Mermaid.
      var label = escapeMermaidLabelText(ed.label);
      mermaid += '    ' + ed.from + ' -->|"' + label + '"| ' + ed.to + ';\n';
    } else {
      mermaid += '    ' + ed.from + ' --> ' + ed.to + ';\n';
    }
  }

  if (scope !== "resources" && story360GraphData.edges && story360GraphData.edges.length) {
    mermaid += "\n%% Story360 Edges\n";
    var renderableStory360Edges = buildRenderableStory360Edges(story360GraphData.edges);
    for (var story360EdgeIndex = 0; story360EdgeIndex < renderableStory360Edges.length; story360EdgeIndex++) {
      var story360Edge = renderableStory360Edges[story360EdgeIndex];
      var story360Label = String(story360Edge.label || "");
      if (story360Label.length > 40) story360Label = story360Label.substring(0, 40) + "...";
      var story360Arrow = story360Edge.bidirectional ? " <--> " : " --> ";
      var story360ArrowWithLabel = story360Edge.bidirectional ? " <-->" : " -->";
      var story360From = story360Edge.kind === "scene-to-360"
        ? getMermaidSafeNodeId("scene", story360Edge.from)
        : story360Edge.from;
      var story360To = story360Edge.kind === "360-to-scene"
        ? getMermaidSafeNodeId("scene", story360Edge.to)
        : story360Edge.to;

      if (story360Label.trim() !== "") {
        var safeStory360Label = escapeMermaidLabelText(story360Label);
        mermaid += '    ' + story360From + story360ArrowWithLabel + '|"' + safeStory360Label + '"| ' + story360To + ';\n';
      } else {
        mermaid += '    ' + story360From + story360Arrow + story360To + ';\n';
      }
    }
  }
    
  if (isExplicitDebugCategoryEnabled("graph")) {
    console.log('[GRAPH DEBUG] Mermaid nodes:', nodes.length);
    nodes.forEach(function(node) {
      if (node.allBgImages && node.allBgImages.length > 0) {
        console.log('  Node', node.sceneId, 'images:', node.allBgImages.map(function(bg) { return bg.id; }).join(', '));
      }
    });
  }

  // ВАЖНО: Добавляем пунктирную связь от узла "Персонажи" к первой сцене
  mermaid += '\n    %% Character connections to the attached scene\n';
  mermaid += '    characters -.-> ' + attachSceneId + ';\n';

  return mermaid;
}
      

function getImgCountClass(count) {
  if (count <= 1) return 'imgcount1';
  if (count <= 4) return 'imgcount2';
  if (count <= 9) return 'imgcount3';
  return 'imgcount4';
}

// Строит блок Characters: общий список персонажей и отдельные узлы с эмоциями.
function buildCharactersGraph(story, options) {
  options = options || {};

// Защита: если нет данных о персонажах, возвращаем пустой результат
  if (!story || !story.assets || !story.assets.characters) {
    return { mermaid: "", charNodes: [] };
  }

  var compact = !!options.compact;
  var characterEmotionCounts = options.characterEmotionCounts || {};

  var mermaid = "";
  var characters = story.assets.characters || {};
  var scenes = story.scenes || [];
  var characterUseCounts = {};
  var characterSceneUseMap = {};
  
  // Создаем узел "Персонажи"
  var charIds = (options.onlyCharIds && options.onlyCharIds.length)
    ? options.onlyCharIds.slice().sort()
    : Object.keys(characters).sort();

  function markCharacterUsage(charId, sceneId) {
    if (!charId || !characters[charId]) return;
    characterUseCounts[charId] = (characterUseCounts[charId] || 0) + 1;
    if (!characterSceneUseMap[charId]) {
      characterSceneUseMap[charId] = {};
    }
    characterSceneUseMap[charId][sceneId] = true;
  }

  function collectCharacterUsageFromActions(actions, sceneId) {
    // Вложенные ветки считаются как дополнительные показы персонажа, а сцена учитывается один раз.
    if (!Array.isArray(actions)) return;

    for (var actionIndex = 0; actionIndex < actions.length; actionIndex++) {
      var action = actions[actionIndex];
      if (!action || !action.type) continue;

      if (action.type === "char" && action.charId) {
        markCharacterUsage(action.charId, sceneId);
      }

      if (action.type === "choice" && Array.isArray(action.choices)) {
        for (var choiceIndex = 0; choiceIndex < action.choices.length; choiceIndex++) {
          var choice = action.choices[choiceIndex];
          if (choice && Array.isArray(choice.actions)) {
            collectCharacterUsageFromActions(choice.actions, sceneId);
          }
        }
      }

      if (action.type === "if_block") {
        if (Array.isArray(action.branches)) {
          for (var branchIndex = 0; branchIndex < action.branches.length; branchIndex++) {
            var branch = action.branches[branchIndex];
            if (branch && Array.isArray(branch.actions)) {
              collectCharacterUsageFromActions(branch.actions, sceneId);
            }
          }
        }

        if (Array.isArray(action.elseActions)) {
          collectCharacterUsageFromActions(action.elseActions, sceneId);
        }
      }
    }
  }

  for (var s = 0; s < scenes.length; s++) {
    var scene = scenes[s];
    if (!scene || !scene.id || !scene.actions) continue;
    collectCharacterUsageFromActions(scene.actions, scene.id);
  }

  // Подсчёт общего количества эмоций (изображений) у всех персонажей
  var totalEmotions = 0;
  for (var i = 0; i < charIds.length; i++) {
    var char = characters[charIds[i]];
    if (char && char.images) {
      totalEmotions += Object.keys(char.images).length;
    }
  }
  
  // Формируем заголовок с динамическим счётчиком
  var groupLabel = '<b>👥 Characters (' + totalEmotions + '/' + charIds.length + ')</b>';
  if (!compact) {
    var charListClass = getImgCountClass(charIds.length || 1);
    var charactersListHtml = "<div class='games-list-box " + charListClass + "'>";

    if (charIds.length > 0) {
      for (var cl = 0; cl < charIds.length; cl++) {
        var listCharId = charIds[cl];
        var characterUseCount = characterUseCounts[listCharId] || 0;
        var characterSceneCount = characterSceneUseMap[listCharId] ? Object.keys(characterSceneUseMap[listCharId]).length : 0;
        var countClass = characterUseCount === 0 ? " game-list-count-zero" : "";
        charactersListHtml += "<span class='game-list-row game-list-row-with-count'>" +
          "<span class='game-list-id'>" + escapeMermaidLabelText(listCharId) + "</span>" +
          "<b class='game-list-count" + countClass + "'>" + characterUseCount + "/" + characterSceneCount + "</b>" +
          "</span>";
      }
    } else {
      charactersListHtml += "<span class='game-list-row games-list-empty-cell'>(none)</span>";
    }

    charactersListHtml += "</div>";
    groupLabel += "<br/>" + charactersListHtml;
  }
  mermaid += '    characters["' + groupLabel + '"]\n';
  mermaid += '    characters:::characters-group\n';
  
  // Создаем узлы для каждого персонажа
  var charNodes = [];
  var charIds = (options.onlyCharIds && options.onlyCharIds.length)
    ? options.onlyCharIds.slice().sort()
    : Object.keys(characters).sort();
  
  for (var i = 0; i < charIds.length; i++) {
    var charId = charIds[i];
    var char = characters[charId];
    var displayName = char.name || charId;
    
    // Формируем HTML для изображений эмоций
    var emotionsHtml = '';
    if (!compact && char.images) {
      var emotionIds = Object.keys(char.images).sort();
      var emotionCountClass = getImgCountClass(emotionIds.length);

      emotionsHtml = "<div class='char-emotions-container " + emotionCountClass + "' style='display:flex; flex-wrap:wrap; gap:4px; justify-content:center; margin-top:4px;'>";

      for (var e = 0; e < emotionIds.length; e++) {
        var emotion = emotionIds[e];
        var imgSrc = getGraphImageSrc(char.images[emotion]);
        var safeEmotion = escapeMermaidLabelText(emotion);
        var emotionUseCount = (characterEmotionCounts[charId] && characterEmotionCounts[charId][emotion])
          ? characterEmotionCounts[charId][emotion]
          : 0;

        emotionsHtml += "<span class='cew " + emotionCountClass + "'>" +
                  "<img src='" + imgSrc + "'" + getGraphRasterImgDataAttr(char.images[emotion]) + " " +
                  "class='char-emotion-thumbnail " + emotionCountClass + "' " +
                  "title='" + safeEmotion + "' alt='' />" +
                  "<b class='cec'>" + emotionUseCount + "</b>" +
                  "</span> ";

      }

      emotionsHtml += '</div>';
    }
    
    // Экранируем имя и id как текст HTML-метки, не позволяя им менять синтаксис Mermaid.
    var escapedDisplayName = escapeMermaidLabelText(displayName);
    var escapedCharacterId = escapeMermaidLabelText(charId);

    // Формируем метку персонажа с правильным экранированием - ИСПРАВЛЕНО
    var label = '<b>' + escapedCharacterId + '</b><br/>';
    if (displayName !== charId) {
      // Используем &quot; вместо кавычек
      label += '<i>&quot;' + escapedDisplayName + '&quot;</i>';
    }
    label += emotionsHtml;
    
    // Добавляем узел персонажа
    var nodeId = getMermaidSafeNodeId('char', charId);
    mermaid += '    ' + nodeId + '["' + label + '"]\n';
    mermaid += '    ' + nodeId + ':::character-node\n';  // Применяем CSS-класс
    
    charNodes.push({
      id: nodeId,
      charId: charId
    });
  } // for
    
    // Добавляем связи пунктирной линией
    mermaid += '\n    %% Character connections from Chapter 1\n';
    
    // Связи от персонажей к "Персонажи"
    for (var j = 0; j < charNodes.length; j++) {
      mermaid += '    ' + charNodes[j].id + ' -.-> characters;\n';
    }
    
    return {
      mermaid: mermaid,
      charNodes: charNodes
    };
}

// Функция для создания блока фонов: родитель background → bg_images (статичные картинки),
// bg_360 (миниатюры 360-паков со счётчиком использований) и bg_video (список id со счётчиком вызовы/сцены),
// затем связь background → стартовая сцена.
function buildBackgroundsGraph(story, options) {
  options = options || {};
  var compact = !!options.compact;
  var backgroundCounts = options.backgroundCounts || {};

  var mermaid = "";
  var backgrounds = story.assets.backgrounds || {};
  var attachTo = options.attachTo || ((story.meta && story.meta.start) ? story.meta.start : (story.scenes[0] ? story.scenes[0].id : "START"));
  var scenes = story.scenes || [];

  var allUniqueBgs = {};
  var backgroundUseCountsForList = {};
  var backgroundSceneUseMap = {};
  var hasOnlyBgFilter = !!(options.onlyBgIds && options.onlyBgIds.length);

  function markBackgroundUsage(bgId, sceneId, addToUniqueList) {
    // Для списка ресурсов вызовы считаются все, а сцена добавляется только один раз на фон.
    if (!bgId || !backgrounds[bgId]) return;

    backgroundUseCountsForList[bgId] = (backgroundUseCountsForList[bgId] || 0) + 1;
    if (!backgroundSceneUseMap[bgId]) {
      backgroundSceneUseMap[bgId] = {};
    }
    backgroundSceneUseMap[bgId][sceneId] = true;

    if (addToUniqueList) {
      allUniqueBgs[bgId] = getBackgroundAssetPrimaryPath(backgrounds[bgId]);
    }
  }

  function collectBackgroundUsageFromActions(actions, sceneId, addToUniqueList) {
    // Вложенные ветки считаются как дополнительные вызовы, но сцена добавляется только один раз.
    if (!Array.isArray(actions)) return;

    for (var actionIndex = 0; actionIndex < actions.length; actionIndex++) {
      var action = actions[actionIndex];
      if (!action || !action.type) continue;

      if (action.type === "bg" && action.src) {
        var bgId = window.VN_STORY_ANALYSIS.extractAliasId(action.src, "bg");
        markBackgroundUsage(bgId, sceneId, addToUniqueList);
      }

      if (action.type === "choice" && Array.isArray(action.choices)) {
        for (var choiceIndex = 0; choiceIndex < action.choices.length; choiceIndex++) {
          var choice = action.choices[choiceIndex];
          if (choice && Array.isArray(choice.actions)) {
            collectBackgroundUsageFromActions(choice.actions, sceneId, addToUniqueList);
          }
        }
      }

      if (action.type === "if_block") {
        if (Array.isArray(action.branches)) {
          for (var branchIndex = 0; branchIndex < action.branches.length; branchIndex++) {
            var branch = action.branches[branchIndex];
            if (branch && Array.isArray(branch.actions)) {
              collectBackgroundUsageFromActions(branch.actions, sceneId, addToUniqueList);
            }
          }
        }

        if (Array.isArray(action.elseActions)) {
          collectBackgroundUsageFromActions(action.elseActions, sceneId, addToUniqueList);
        }
      }
    }
  }

  if (hasOnlyBgFilter) {
    for (var ob = 0; ob < options.onlyBgIds.length; ob++) {
      var onlyBgId = options.onlyBgIds[ob];
      if (onlyBgId && backgrounds[onlyBgId]) {
        allUniqueBgs[onlyBgId] = getBackgroundAssetPrimaryPath(backgrounds[onlyBgId]);
      }
    }
  }

  for (var s = 0; s < scenes.length; s++) {
    var scene = scenes[s];
    if (!scene || !scene.id || !scene.actions) continue;
    collectBackgroundUsageFromActions(scene.actions, scene.id, !hasOnlyBgFilter);
  }

  var bgIds = Object.keys(allUniqueBgs).sort();

  var imageBgIds = [];
  var bg360Ids = [];
  var videoBgIds = [];
  for (var j = 0; j < bgIds.length; j++) {
    var bid = bgIds[j];
    var primary = allUniqueBgs[bid];
    if (isBg360PackPath(primary)) {
      bg360Ids.push(bid);
    } else if (isVideoAssetPath(primary)) {
      videoBgIds.push(bid);
    } else {
      imageBgIds.push(bid);
    }
  }

  var imgCount = imageBgIds.length;
  var bg360Count = bg360Ids.length;
  var vidCount = videoBgIds.length;
  var totalCount = imgCount + bg360Count + vidCount;

  var bgImagesHtml = "";
  if (!compact && imgCount > 0) {
    var imgCountClass = getImgCountClass(imgCount);
    bgImagesHtml = "<div class='bgl " + imgCountClass + "'>";

    for (var i = 0; i < imageBgIds.length; i++) {
      var imgBgId = imageBgIds[i];
      var imgSrc = getGraphImageSrc(allUniqueBgs[imgBgId]);
      var safeImgBgId = escapeMermaidLabelText(imgBgId);
      var bgUseCount = backgroundCounts[imgBgId] || 0;

      if (!imgSrc) continue;

      bgImagesHtml += "<span class='bgw " + getGraphBackgroundFrameClass(backgrounds[imgBgId]) + " " + imgCountClass + "'>" +
        "<img src='" + imgSrc + "'" + getGraphRasterImgDataAttr(allUniqueBgs[imgBgId]) + " " +
        "class='bgi " + imgCountClass + "' " +
        "title='" + safeImgBgId + "' alt='' />" +
        "<b class='bgc'>" + bgUseCount + "</b>" +
        "</span> ";
    }

    bgImagesHtml += "</div>";
  }

  var videoListClass = getImgCountClass(vidCount || 1);
  var videoListHtml = "<div class='games-list-box " + videoListClass + "'>";
  if (vidCount > 0) {
    for (var v = 0; v < videoBgIds.length; v++) {
      var vidId = videoBgIds[v];
      var videoBgUseCount = backgroundUseCountsForList[vidId] || 0;
      var videoBgSceneCount = backgroundSceneUseMap[vidId] ? Object.keys(backgroundSceneUseMap[vidId]).length : 0;
      var countClass = videoBgUseCount === 0 ? " game-list-count-zero" : "";
      videoListHtml += "<span class='game-list-row game-list-row-with-count'>" +
        "<span class='game-list-id'>" + escapeMermaidLabelText(vidId) + "</span>" +
        "<b class='game-list-count" + countClass + "'>" + videoBgUseCount + "/" + videoBgSceneCount + "</b>" +
        "</span>";
    }
  } else {
    videoListHtml += "<span class='game-list-row games-list-empty-cell'>(none)</span>";
  }
  videoListHtml += "</div>";

  var bg360Html = "";
  if (!compact && bg360Count > 0) {
    var bg360CountClass = getImgCountClass(bg360Count);
    bg360Html = "<div class='bgl " + bg360CountClass + "'>";

    for (var b360 = 0; b360 < bg360Ids.length; b360++) {
      var bg360Id = bg360Ids[b360];
      var bg360Src = allUniqueBgs[bg360Id];
      var safeBg360Id = escapeMermaidLabelText(bg360Id);
      var safeBg360Src = escapeMermaidLabelText(bg360Src || "");
      var bg360UseCount = backgroundCounts[bg360Id] || 0;
      var bg360AssetQuality = getBackgroundAssetQuality(backgrounds[bg360Id]) || "auto";

      bg360Html += "<span class='bgw bg360w " + bg360CountClass + "'>" +
        "<img " +
        "class='bgi bg360-graph-thumbnail " + bg360CountClass + "' " +
        "data-bg360-src='" + safeBg360Src + "' " +
        "data-bg360-quality='" + escapeMermaidLabelText(bg360AssetQuality) + "' " +
        "title='" + safeBg360Id + "' alt='' />" +
        "<b class='bgc'>" + bg360UseCount + "</b>" +
        "</span> ";
    }

    bg360Html += "</div>";
  }

  var parentLabel = '<b>📷 Backgrounds (' + totalCount + ')</b>';
  var imagesLabel = '<b>🖼️ bg-images (' + imgCount + ')</b>';
  var bg360Label = '<b>🌐 bg-360 (' + bg360Count + ')</b>';
  var videoLabel = '<b>🎬 bg-video (' + vidCount + ')</b>';

  if (!compact) {
    if (bgImagesHtml) {
      imagesLabel += "<br/>" + bgImagesHtml;
    }
    if (bg360Html) {
      bg360Label += "<br/>" + bg360Html;
    }
    videoLabel += "<br/>" + videoListHtml;
  }

  mermaid += '    background["' + parentLabel + '"]\n';
  mermaid += '    background:::backgrounds-group\n';

  mermaid += '    bg_images["' + imagesLabel + '"]\n';
  mermaid += '    bg_images:::backgrounds-group\n';

  mermaid += '    bg_360["' + bg360Label + '"]\n';
  mermaid += '    bg_360:::backgrounds-group\n';

  mermaid += '    bg_video["' + videoLabel + '"]\n';
  mermaid += '    bg_video:::games-group\n';

  mermaid += "\n    %% Background group: images + 360 + video → background → start scene\n";
  mermaid += "    bg_images -.-> background;\n";
  mermaid += "    bg_360 -.-> background;\n";
  mermaid += "    bg_video -.-> background;\n";
  mermaid += "    background -.-> " + attachTo + ";\n";

  return mermaid;
}

// Проставляет миниатюры для bg-360 на уже отрисованном Mermaid-графе, чтобы не раздувать текст диаграммы data-url строками.
function hydrateBg360GraphThumbnails(root) {
  var host = root || mermaidGraph;
  if (!host) return;

  var thumbs = host.querySelectorAll(".bg360-graph-thumbnail[data-bg360-src]");
  if (!thumbs || !thumbs.length) return;

  function hydrateSingleBg360Thumb(img) {
    if (!img) return;
    var progressToken = registerGraphImageLoad(img);
    var sourceUrl = img.getAttribute("data-bg360-src") || "";
    var quality = img.getAttribute("data-bg360-quality") || "auto";
    if (!sourceUrl) {
      settleGraphImageLoad(progressToken, false);
      return;
    }

    var resource = resolveBg360PackResource(sourceUrl, quality, function() {
      // После загрузки CSS повторно читаем атрибуты: граф мог быть перерисован или закрыт.
      if (img && img.isConnected) hydrateSingleBg360Thumb(img);
    });
    if (!resource || resource.status !== "ready" || !resource.src) {
      if (!resource || resource.status !== "loading") {
        var failedReason = panoramaPackageController.getLoadError(sourceUrl, quality) || "The CSS panorama package could not be loaded.";
        recordBg360PackageInspectionResult(
          sourceUrl,
          quality,
          /Не удалось загрузить CSS-пакет/i.test(failedReason) ? "missing" : "invalid",
          failedReason
        );
        settleGraphImageLoad(progressToken, false);
      }
      return;
    }
    if (resource.kind === "css") {
      // Граф по-прежнему показывает полноразмерное изображение, но его успешное декодирование также заполняет кеш статистики.
      var releaseThumbResource = function(event) {
        img.removeEventListener("load", releaseThumbResource);
        img.removeEventListener("error", releaseThumbResource);
        var validationError = event && event.type === "load" ? validateBg360DecodedImage(img, resource) : "The browser could not decode the panorama image.";
        recordBg360PackageInspectionResultByResource(
          resource,
          sourceUrl,
          validationError ? "invalid" : "verified",
          validationError || "CSS package and image were fully validated and decoded by the resource graph."
        );
        settleGraphImageLoad(progressToken, !validationError);
        releaseBg360PackResource(resource, Boolean(validationError));
      };
      img.addEventListener("load", releaseThumbResource);
      img.addEventListener("error", releaseThumbResource);
    }
    img.src = resource.src;
    // Синхронно завершаем только уже декодированное изображение: complete без размеров ещё не подтверждает готовность нового src.
    if (img.complete && img.naturalWidth && img.naturalHeight && typeof releaseThumbResource === "function") {
      releaseThumbResource({ type: "load" });
    }
  }

  for (var i = 0; i < thumbs.length; i++) {
    hydrateSingleBg360Thumb(thumbs[i]);
  }
}


// Узел Audio: сводный список id из [audio] со счётчиком вызовы/сцены для bgm/sfx.
function buildAudioGraph(story, options) {
  options = options || {};
  var compact = !!options.compact;

  var mermaid = "";
  var audioAssets = (story.assets && story.assets.audio) ? story.assets.audio : {};
  var attachTo = options.attachTo || ((story.meta && story.meta.start) ? story.meta.start : (story.scenes[0] ? story.scenes[0].id : "START"));
  var scenes = story.scenes || [];
  var audioUseCounts = {};
  var audioSceneUseMap = {};

  var audioIds = Object.keys(audioAssets).sort();
  var audioCount = audioIds.length;

  function getAudioAssetPath(audioId) {
    // В [audio] обычно строка, но объект с file тоже поддерживаем для устойчивого сопоставления.
    var audioAsset = audioAssets[audioId];
    if (audioAsset && typeof audioAsset === "object") {
      return typeof audioAsset.file === "string" ? audioAsset.file : "";
    }
    return typeof audioAsset === "string" ? audioAsset : "";
  }

  function getAudioIdFromRef(ref, explicitId) {
    // Парсер может сохранить id, alias @audio.id или уже подставить прямой путь к файлу.
    if (explicitId && audioAssets[explicitId]) return explicitId;

    var aliasId = window.VN_STORY_ANALYSIS.extractAliasId(ref, "audio");
    if (aliasId && audioAssets[aliasId]) return aliasId;

    if (ref) {
      for (var ai = 0; ai < audioIds.length; ai++) {
        var candidateId = audioIds[ai];
        if (getAudioAssetPath(candidateId) === ref) {
          return candidateId;
        }
      }
    }

    return "";
  }

  function markAudioUsage(audioId, sceneId) {
    if (!audioId) return;
    audioUseCounts[audioId] = (audioUseCounts[audioId] || 0) + 1;
    if (!audioSceneUseMap[audioId]) {
      audioSceneUseMap[audioId] = {};
    }
    audioSceneUseMap[audioId][sceneId] = true;
  }

  function collectAudioUsageFromActions(actions, sceneId) {
    // Вложенные ветки считаются как дополнительные вызовы, но сцена добавляется только один раз.
    if (!Array.isArray(actions)) return;

    for (var actionIndex = 0; actionIndex < actions.length; actionIndex++) {
      var action = actions[actionIndex];
      if (!action || !action.type) continue;

      if (action.type === "bgm" || action.type === "sfx") {
        markAudioUsage(getAudioIdFromRef(action.src, action.audioId), sceneId);
      }

      if (action.type === "choice" && Array.isArray(action.choices)) {
        for (var choiceIndex = 0; choiceIndex < action.choices.length; choiceIndex++) {
          var choice = action.choices[choiceIndex];
          if (!choice) continue;

          markAudioUsage(getAudioIdFromRef(choice.sfx, choice.audioId), sceneId);

          if (Array.isArray(choice.actions)) {
            collectAudioUsageFromActions(choice.actions, sceneId);
          }
        }
      }

      if (action.type === "if_block") {
        if (Array.isArray(action.branches)) {
          for (var branchIndex = 0; branchIndex < action.branches.length; branchIndex++) {
            var branch = action.branches[branchIndex];
            if (branch && Array.isArray(branch.actions)) {
              collectAudioUsageFromActions(branch.actions, sceneId);
            }
          }
        }

        if (Array.isArray(action.elseActions)) {
          collectAudioUsageFromActions(action.elseActions, sceneId);
        }
      }
    }
  }

  for (var s = 0; s < scenes.length; s++) {
    var scene = scenes[s];
    if (!scene || !scene.id || !scene.actions) continue;
    collectAudioUsageFromActions(scene.actions, scene.id);
  }

  var listCountClass = getImgCountClass(audioCount || 1);
  var listHtml = "<div class='games-list-box " + listCountClass + "'>";

  if (audioCount > 0) {
    for (var i = 0; i < audioIds.length; i++) {
      var audioId = audioIds[i];
      var audioUseCount = audioUseCounts[audioId] || 0;
      var audioSceneCount = audioSceneUseMap[audioId] ? Object.keys(audioSceneUseMap[audioId]).length : 0;
      var countClass = audioUseCount === 0 ? " game-list-count-zero" : "";
      listHtml += "<span class='game-list-row game-list-row-with-count'>" +
        "<span class='game-list-id'>" + escapeMermaidLabelText(audioId) + "</span>" +
        "<b class='game-list-count" + countClass + "'>" + audioUseCount + "/" + audioSceneCount + "</b>" +
        "</span>";
    }
  } else {
    listHtml += "<span class='game-list-row games-list-empty-cell'>(none)</span>";
  }

  listHtml += "</div>";

  var parentLabel = '<b>🎵 Audio (' + audioCount + ')</b>';
  if (!compact) {
    parentLabel += "<br/>" + listHtml;
  }

  // id не "audio": возможна сцена с тем же id; подпись узла остаётся «Audio».
  var parentNodeId = "story_audio";
  mermaid += '    ' + parentNodeId + '["' + parentLabel + '"]\n';
  mermaid += '    ' + parentNodeId + ':::games-group\n';
  mermaid += '    ' + parentNodeId + ' -.-> ' + attachTo + "\n";

  return mermaid;
}

// Узел Video: сводный список id из [video] с тем же счётчиком вызовы/сцены, что и у Games.
function buildVideoGraph(story, options) {
  options = options || {};
  var compact = !!options.compact;

  var mermaid = "";
  var videoAssets = (story.assets && story.assets.videos) ? story.assets.videos : {};
  var attachTo = options.attachTo || ((story.meta && story.meta.start) ? story.meta.start : (story.scenes[0] ? story.scenes[0].id : "START"));
  var scenes = story.scenes || [];
  var videoUseCounts = {};
  var videoSceneUseMap = {};

  var videoIds = Object.keys(videoAssets).sort();
  var videoCount = videoIds.length;

  function getVideoAssetPath(videoId) {
    // В [video] значение может быть строкой или объектом с file; для сверки нужен основной путь.
    var videoAsset = videoAssets[videoId];
    if (videoAsset && typeof videoAsset === "object") {
      return typeof videoAsset.file === "string" ? videoAsset.file : "";
    }
    return typeof videoAsset === "string" ? videoAsset : "";
  }

  function getVideoIdFromAction(action) {
    // Парсер может оставить id отдельно, alias @video.id или уже подставить прямой путь к файлу.
    if (!action) return "";
    if (action.videoId && videoAssets[action.videoId]) return action.videoId;

    var aliasId = window.VN_STORY_ANALYSIS.extractAliasId(action.src, "video");
    if (aliasId && videoAssets[aliasId]) return aliasId;

    if (action.src) {
      for (var vi = 0; vi < videoIds.length; vi++) {
        var candidateId = videoIds[vi];
        if (getVideoAssetPath(candidateId) === action.src) {
          return candidateId;
        }
      }
    }

    return "";
  }

  function collectVideoUsageFromActions(actions, sceneId) {
    // Вложенные ветки считаются как дополнительные вызовы, но сцена добавляется только один раз.
    if (!Array.isArray(actions)) return;

    for (var actionIndex = 0; actionIndex < actions.length; actionIndex++) {
      var action = actions[actionIndex];
      if (!action || !action.type) continue;

      if (action.type === "video") {
        var usedVideoId = getVideoIdFromAction(action);
        if (usedVideoId) {
          videoUseCounts[usedVideoId] = (videoUseCounts[usedVideoId] || 0) + 1;
          if (!videoSceneUseMap[usedVideoId]) {
            videoSceneUseMap[usedVideoId] = {};
          }
          videoSceneUseMap[usedVideoId][sceneId] = true;
        }
      }

      if (action.type === "choice" && Array.isArray(action.choices)) {
        for (var choiceIndex = 0; choiceIndex < action.choices.length; choiceIndex++) {
          var choice = action.choices[choiceIndex];
          if (choice && Array.isArray(choice.actions)) {
            collectVideoUsageFromActions(choice.actions, sceneId);
          }
        }
      }

      if (action.type === "if_block") {
        if (Array.isArray(action.branches)) {
          for (var branchIndex = 0; branchIndex < action.branches.length; branchIndex++) {
            var branch = action.branches[branchIndex];
            if (branch && Array.isArray(branch.actions)) {
              collectVideoUsageFromActions(branch.actions, sceneId);
            }
          }
        }

        if (Array.isArray(action.elseActions)) {
          collectVideoUsageFromActions(action.elseActions, sceneId);
        }
      }
    }
  }

  for (var s = 0; s < scenes.length; s++) {
    var scene = scenes[s];
    if (!scene || !scene.id || !scene.actions) continue;
    collectVideoUsageFromActions(scene.actions, scene.id);
  }

  var listCountClass = getImgCountClass(videoCount || 1);
  var listHtml = "<div class='games-list-box " + listCountClass + "'>";

  if (videoCount > 0) {
    for (var i = 0; i < videoIds.length; i++) {
      var videoId = videoIds[i];
      var videoUseCount = videoUseCounts[videoId] || 0;
      var videoSceneCount = videoSceneUseMap[videoId] ? Object.keys(videoSceneUseMap[videoId]).length : 0;
      var countClass = videoUseCount === 0 ? " game-list-count-zero" : "";
      listHtml += "<span class='game-list-row game-list-row-with-count'>" +
        "<span class='game-list-id'>" + escapeMermaidLabelText(videoId) + "</span>" +
        "<b class='game-list-count" + countClass + "'>" + videoUseCount + "/" + videoSceneCount + "</b>" +
        "</span>";
    }
  } else {
    listHtml += "<span class='game-list-row games-list-empty-cell'>(none)</span>";
  }

  listHtml += "</div>";

  var parentLabel = '<b>🎬 Video (' + videoCount + ')</b>';
  if (!compact) {
    parentLabel += "<br/>" + listHtml;
  }

  // id не "video": возможна сцена с тем же id; подпись узла остаётся «Video».
  var parentNodeId = "story_video";
  mermaid += '    ' + parentNodeId + '["' + parentLabel + '"]\n';
  mermaid += '    ' + parentNodeId + ':::games-group\n';
  mermaid += '    ' + parentNodeId + ' -.-> ' + attachTo + "\n";

  return mermaid;
}

// Строит блок Games и показывает вызовы/сцены: все команды game и число уникальных сцен с ними.
function buildGamesGraph(story, options) {
  options = options || {};
  var compact = !!options.compact;

  var mermaid = "";
  var games = (story.assets && story.assets.games) ? story.assets.games : {};
  var attachTo = options.attachTo || ((story.meta && story.meta.start) ? story.meta.start : (story.scenes[0] ? story.scenes[0].id : "START"));
  var scenes = story.scenes || [];
  var gameUseCounts = {};
  var gameSceneUseMap = {};

  function collectGameUsageFromActions(actions, sceneId) {
    // Идём рекурсивно по вложенным веткам, но сцену учитываем один раз для каждой игры.
    if (!Array.isArray(actions)) return;

    for (var actionIndex = 0; actionIndex < actions.length; actionIndex++) {
      var action = actions[actionIndex];
      if (!action || !action.type) continue;

      if (action.type === "game" && action.gameId && games[action.gameId]) {
        gameUseCounts[action.gameId] = (gameUseCounts[action.gameId] || 0) + 1;
        if (!gameSceneUseMap[action.gameId]) {
          gameSceneUseMap[action.gameId] = {};
        }
        gameSceneUseMap[action.gameId][sceneId] = true;
      }

      if (action.type === "choice" && Array.isArray(action.choices)) {
        for (var choiceIndex = 0; choiceIndex < action.choices.length; choiceIndex++) {
          var choice = action.choices[choiceIndex];
          if (choice && Array.isArray(choice.actions)) {
            collectGameUsageFromActions(choice.actions, sceneId);
          }
        }
      }

      if (action.type === "if_block") {
        if (Array.isArray(action.branches)) {
          for (var branchIndex = 0; branchIndex < action.branches.length; branchIndex++) {
            var branch = action.branches[branchIndex];
            if (branch && Array.isArray(branch.actions)) {
              collectGameUsageFromActions(branch.actions, sceneId);
            }
          }
        }

        if (Array.isArray(action.elseActions)) {
          collectGameUsageFromActions(action.elseActions, sceneId);
        }
      }
    }
  }

  for (var s = 0; s < scenes.length; s++) {
    var scene = scenes[s];
    if (!scene || !scene.id || !scene.actions) continue;
    collectGameUsageFromActions(scene.actions, scene.id);
  }

  var gameIds = (options.onlyGameIds && options.onlyGameIds.length)
  ? options.onlyGameIds.filter(function(gameId) {
      return !!games[gameId];
    }).slice().sort()
  : Object.keys(games).sort();

  var gamesCount = gameIds.length;

  var gameCountClass = getImgCountClass(gamesCount);
  var gamesListHtml = "<div class='games-list-box " + gameCountClass + "'>";

  if (gamesCount > 0) {
    for (var i = 0; i < gameIds.length; i++) {
      var gameId = gameIds[i];

      var gameUseCount = gameUseCounts[gameId] || 0;
      var gameSceneCount = gameSceneUseMap[gameId] ? Object.keys(gameSceneUseMap[gameId]).length : 0;
      var countClass = gameUseCount === 0 ? " game-list-count-zero" : "";
      var safeGameId = escapeMermaidLabelText(gameId);
      gamesListHtml += "<span class='game-list-row game-list-row-with-count'>" +
        "<span class='game-list-id'>" + safeGameId + "</span>" +
        "<b class='game-list-count" + countClass + "'>" + gameUseCount + "/" + gameSceneCount + "</b>" +
        "</span>";
    }
  } else {
    gamesListHtml += "<span class='game-list-row games-list-empty-cell'>(none)</span>";
  }

  gamesListHtml += "</div>";

  var label = '<b>🎮 Games (' + gamesCount + ')</b>';
  if (!compact) {
    label += '<br/>' + gamesListHtml;
  }

  mermaid += '    games["' + label + '"]\n';
  mermaid += '    games:::games-group\n';
  mermaid += '    games -.-> ' + attachTo + '\n';

  for (var i = 0; i < gameIds.length; i++) {
    var gameId = gameIds[i];
    var game = games[gameId] || {};
    var isUsed = (gameUseCounts[gameId] || 0) > 0;
    if (isExplicitDebugCategoryEnabled("graph")) {
      console.log('[GRAPH GAME]', gameId, 'used=', isUsed);
    }

    var safeGameId = escapeMermaidLabelText(gameId);
    var safeTitle = escapeMermaidLabelText(game.title || gameId);
    var safeCover = getGraphImageSrc(game.cover || "");
    


    var tooltip = escapeMermaidLabelText(game.description || game.title || gameId);
    var titleAttr = compact ? "" : " title='" + tooltip + "'";

    var gameNodeId = getMermaidSafeNodeId('game', gameId);

    var label = "<div class='game-card'" + titleAttr + ">" +
      "<div class='game-card-var'>" + safeGameId + "</div>" +
      "<div class='game-card-title'>" + safeTitle + "</div>";

    if (!compact && safeCover) {
      label += "<div class='game-card-image-wrap'>" +
            "<img src='" + safeCover + "'" + getGraphRasterImgDataAttr(game.cover || "") + " " +
            "class='game-thumbnail " + gameCountClass + "' " +
            "alt='' " +
            "loading='eager' />" +
          "</div>";
    }

    label += "</div>";

    mermaid += '    ' + gameNodeId + '["' + label + '"]\n';
    mermaid += '    ' + gameNodeId + ':::game-node\n';
    if (!isUsed) {
      mermaid += '    class ' + gameNodeId + ' unreachable;\n';
    }
    mermaid += '    ' + gameNodeId + ' -.-> games;\n';
  }

  

  return mermaid;
}


// Собирает дополнительные runtime-ошибки, включая проверки алиасов и условий видимости story360.
function validateStory(story) {

  var errors = [];

  var sceneMap = {};
  var scenes = story.scenes || [];

  for (var i = 0; i < scenes.length; i++) {
    sceneMap[scenes[i].id] = true;
  }

  for (var s = 0; s < scenes.length; s++) {

    var actions = scenes[s].actions || [];

    for (var a = 0; a < actions.length; a++) {

      var act = actions[a];

      if (act.type === "goto") {

        if (!sceneMap[act.target]) {
          errors.push("Jump to a non-existent scene: " + act.target);
        }
      }

      if (act.type === "if_expr") {
        if (!sceneMap[act.target]) {
          errors.push("Conditional transition to a non-existent scene: " + act.target);
        }
      }

      if (act.type === "bg") {

        var id = window.VN_STORY_ANALYSIS.extractAliasId(act.src, "bg");

        if (id && !story.assets.backgrounds[id]) {
          errors.push("Background not found: " + id);
        }
      }

      if (act.type === "char") {
        if (!act.charId || !act.src) continue; // hide all пропускаем

        var id = window.VN_STORY_ANALYSIS.extractAliasId(act.src, "ch");

        if (id && !story.assets.characters[id]) {
          errors.push("Character not found: " + id);
        }
      }

    }

  }

  var story360Visibility = analyzeStory360VisibilityConditions(story);
  var invalidConditions = story360Visibility.invalidConditions || [];
  for (var vi = 0; vi < invalidConditions.length; vi++) {
    var item = invalidConditions[vi];
    errors.push("Invalid story360 visibleIf at " + item.ref + ": " + item.error);
  }

  return errors;
}

function keysSorted(obj) {
  var arr = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) arr.push(k);
  arr.sort();
  return arr;
}

// Экранирует текст перед включением в создаваемые движком HTML-фрагменты.
function escapeHtml(s) {
  s = String(s);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Экранирует пользовательский текст для HTML-метки Mermaid и заменяет управляющие символы, способные разорвать строку DSL.
function escapeMermaidLabelText(value) {
  var singleLine = String(value === undefined || value === null ? "" : value)
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ");
  return escapeHtml(singleLine);
}

// Делает пользовательский заголовок безопасным комментарием Mermaid без перевода строки или новой директивы.
function escapeMermaidComment(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .replace(/%%/g, "% %");
}

// Применяет интерфейсные параметры в CSS variables.
// Приоритет уже должен быть собран заранее в meta.
//
// Значение применяется ТОЛЬКО если оно явно задано в meta (например,
// через [meta] blurStrength=30 в story.js). Если в meta ничего нет,
// inline-стиль очищается и берётся CSS-дефолт из engine.css (:root).
// Так CSS-дефолты остаются единым источником правды для подбора значений.
function applyUIStyleVariables(meta) {
  var root = document.documentElement;

  Object.keys(UI_STYLE_CONFIG).forEach(function(metaKey) {
    var config = UI_STYLE_CONFIG[metaKey];

    var hasMetaValue = hasValidUIConfigProperty(meta, metaKey);

    if (hasMetaValue) {
      root.style.setProperty(
        config.cssVar,
        String(meta[metaKey]) + (config.unit || '')
      );
    } else {
      // Снимаем inline-override, чтобы заработал дефолт из CSS (:root).
      root.style.removeProperty(config.cssVar);
    }
  });
}

// Разбирает URL-значение строго по объявленному типу, не принимая частично числовые строки.
function parseUIParamValue(rawValue, type) {
  if (rawValue === null || rawValue === undefined) return null;

  var value = String(rawValue).trim();
  if (value === '') return null;

  if (type === 'int') {
    if (!/^-?\d+$/.test(value)) return null;
    var intValue = Number(value);
    return Number.isFinite(intValue) && Number.isInteger(intValue) ? intValue : null;
  }

  if (type === 'float') {
    if (!/^-?\d+(\.\d+)?$/.test(value)) return null;
    var floatValue = Number(value);
    return Number.isFinite(floatValue) ? floatValue : null;
  }

  return null;
}

// Проверяет число по типу, объявленным границам и дополнительному правилу UI-схемы.
function isValidUIConfigValue(value, config) {
  if (!config || typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (config.type === 'int' && !Number.isInteger(value)) return false;
  if (config.type !== 'int' && config.type !== 'float') return false;

  if (typeof config.min === 'number' && value < config.min) return false;
  if (typeof config.max === 'number' && value > config.max) return false;
  if (typeof config.validate === 'function' && !config.validate(value)) return false;

  return true;
}

// Проверяет наличие явно заданного и допустимого значения в объекте meta или URL override.
function hasValidUIConfigProperty(values, metaKey) {
  return !!values
    && Object.prototype.hasOwnProperty.call(values, metaKey)
    && isValidUIConfigValue(values[metaKey], UI_STYLE_CONFIG[metaKey]);
}

// Возвращает допустимое значение UI-схемы либо её безопасное значение по умолчанию.
function getUIConfigValueOrDefault(values, metaKey) {
  var config = UI_STYLE_CONFIG[metaKey];
  return hasValidUIConfigProperty(values, metaKey) ? values[metaKey] : config.default;
}

// Читает только разрешённые UI-параметры из URL без учёта регистра и применяет общую схему валидации.
function getUIOverridesFromQuery(search) {
  var querySource = search === undefined ? window.location.search : search;
  var params = new URLSearchParams(querySource);
  var overrides = {};
  var normalized = {};

  params.forEach(function(value, key) {
    normalized[String(key).toLowerCase()] = value;
  });

  Object.keys(UI_STYLE_CONFIG).forEach(function(metaKey) {
    var config = UI_STYLE_CONFIG[metaKey];
    var normalizedKey = metaKey.toLowerCase();
    if (!config.query || !Object.prototype.hasOwnProperty.call(normalized, normalizedKey)) return;

    var parsedValue = parseUIParamValue(normalized[normalizedKey], config.type);
    if (isValidUIConfigValue(parsedValue, config)) overrides[metaKey] = parsedValue;
  });

  return overrides;
}

// Нормализует режим окна из meta: любые неизвестные значения безопасно возвращают старую vertical-компоновку.
function normalizeStoryWindowMode(rawMode) {
  var mode = String(rawMode || STORY_WINDOW_VERTICAL).trim().toLowerCase();
  if (mode === STORY_WINDOW_AUTO) return STORY_WINDOW_AUTO;
  return STORY_WINDOW_VERTICAL;
}

// Обновляет служебные классы, чтобы текущую компоновку было проще проверять и отлаживать в DOM.
function applyWindowLayoutClasses(layoutMode, requestedWindowMode, manualMode) {
  if (!elNovelWindow) return;

  elNovelWindow.classList.toggle("window-horizontal", layoutMode === "horizontal");
  elNovelWindow.classList.toggle("window-vertical", layoutMode === STORY_WINDOW_VERTICAL);
  elNovelWindow.classList.toggle("window-manual", !!manualMode);
  elNovelWindow.dataset.windowMode = requestedWindowMode;
  elNovelWindow.dataset.layoutMode = layoutMode;
}

function applySpacingSettings() {
  var storyMeta = (window.STORY && window.STORY.meta) ? window.STORY.meta : {};
  // URL переопределяет meta только после разбора той же UI-схемой, что используется для CSS.
  var queryOverrides = getUIOverridesFromQuery();

  var finalMeta = Object.assign({}, storyMeta, queryOverrides);

  var hasExplicitTop = hasValidUIConfigProperty(finalMeta, 'topSpacing');
  var hasExplicitRight = hasValidUIConfigProperty(finalMeta, 'rightSpacing');
  var hasExplicitBottom = hasValidUIConfigProperty(finalMeta, 'bottomSpacing');
  var hasExplicitLeft = hasValidUIConfigProperty(finalMeta, 'leftSpacing');

  // Если задан ЛЮБОЙ отступ — ручной режим.
  var manualMode =
    hasExplicitTop || hasExplicitRight || hasExplicitBottom || hasExplicitLeft;

  var requestedWindowMode = normalizeStoryWindowMode(finalMeta.window);
  // Ручные отступы считаются авторской компоновкой и имеют приоритет над window=auto.
  var layoutMode = manualMode
    ? "manual"
    : (requestedWindowMode === STORY_WINDOW_AUTO ? "horizontal" : STORY_WINDOW_VERTICAL);

  var effectiveTop = 0;
  var effectiveRight = 0;
  var effectiveBottom = 0;
  var effectiveLeft = 0;

  if (manualMode) {
    effectiveTop = getUIConfigValueOrDefault(finalMeta, 'topSpacing');
    effectiveRight = getUIConfigValueOrDefault(finalMeta, 'rightSpacing');
    effectiveBottom = getUIConfigValueOrDefault(finalMeta, 'bottomSpacing');
    effectiveLeft = getUIConfigValueOrDefault(finalMeta, 'leftSpacing');
  } else if (requestedWindowMode === STORY_WINDOW_VERTICAL) {
    var availableHeight = Math.max(0, window.innerHeight);
    var maxAllowedWidth = availableHeight * MAX_NOVEL_ASPECT_W / MAX_NOVEL_ASPECT_H;
    var autoSide = 0;

    if (window.innerWidth > maxAllowedWidth) {
      autoSide = (window.innerWidth - maxAllowedWidth) / 2;
    }

    effectiveLeft = autoSide;
    effectiveRight = autoSide;
  }

  var novelWidth = Math.max(0, window.innerWidth - effectiveLeft - effectiveRight);
  var novelHeight = Math.max(0, window.innerHeight - effectiveTop - effectiveBottom);
  var uiFrameWidth = novelWidth;

  if (!manualMode && requestedWindowMode === STORY_WINDOW_AUTO) {
    // В широком режиме визуальная сцена занимает всё окно, а интерфейс остаётся в центральной зоне 10:16.
    uiFrameWidth = Math.min(novelWidth, novelHeight * MAX_NOVEL_ASPECT_W / MAX_NOVEL_ASPECT_H);
  }

  uiFrameWidth = Math.max(0, uiFrameWidth);

  applyUIStyleVariables(finalMeta);

  document.documentElement.style.setProperty('--topSpacing', effectiveTop + 'px');
  document.documentElement.style.setProperty('--rightSpacing', effectiveRight + 'px');
  document.documentElement.style.setProperty('--bottomSpacing', effectiveBottom + 'px');
  document.documentElement.style.setProperty('--leftSpacing', effectiveLeft + 'px');
  document.documentElement.style.setProperty('--uiFrameWidth', uiFrameWidth + 'px');

  if (elNovelWindow) {
    elNovelWindow.style.left = effectiveLeft + 'px';
    elNovelWindow.style.top = effectiveTop + 'px';
    elNovelWindow.style.width = novelWidth + 'px';
    elNovelWindow.style.height = novelHeight + 'px';
  }

  applyWindowLayoutClasses(layoutMode, requestedWindowMode, manualMode);

  var blurBackground = (typeof finalMeta.blurBackground === 'boolean')
    ? finalMeta.blurBackground
    : true;

  if (elBlurBgLayer) {
    elBlurBgLayer.style.display = blurBackground ? 'block' : 'none';
  }

  writeRuntimeVerbose('[Engine] novel window applied:', {
    manualMode: manualMode,
    requestedWindowMode: requestedWindowMode,
    layoutMode: layoutMode,
    effectiveTop: effectiveTop,
    effectiveRight: effectiveRight,
    effectiveBottom: effectiveBottom,
    effectiveLeft: effectiveLeft,
    novelWidth: novelWidth,
    novelHeight: novelHeight,
    uiFrameWidth: uiFrameWidth
  });

  // Первый расчёт spacing выполняется до создания контроллеров; видимого персонажа в этот момент ещё нет.
  if (characterController) {
    characterController.adjustScale("applySpacingSettings");
  }
}

// Управление размытым фоном

/** Переносит object-position и масштаб с основного ролика на blur-дубликат (совпадает с pan/zoom wide-bg). */
function copyBgVideoObjectPositionToBlur(sourceVideo, blurVideo) {
  backgroundMediaController.copyVideoPositionToBlur(sourceVideo, blurVideo);
}

function updateBlurBackground(src) {
  // Обычный и панорамный координаторы используют единый blur API без доступа к его media-обработчикам.
  backgroundMediaController.updateBlurBackground(src);
}

/**
 * Размытый фон для видео: второй <video> с тем же источником, без play(), пауза на кадре 0 после loadeddata.
 * Обходит canvas и data URL — в localStorage не кладётся тяжёлый blurSnapshotSrc.
 */
function syncBlurBackgroundVideo(videoEl, fallbackSrc) {
  // Второй video и поколение асинхронной синхронизации полностью принадлежат background-media controller.
  backgroundMediaController.syncBlurVideo(videoEl, fallbackSrc);
}

// После автосейва runCurrent снова вызывает setBackground с тем же роликом — loadeddata может не прийти,
// и blur-дубликат может отстать. Несколько попыток + подписка на loadeddata подтягивают синхронизацию.
function scheduleBlurRefreshFromBgVideo(fallbackSrc) {
  // Retry-таймеры сохраняются внутри модуля и гарантированно снимаются при dispose.
  backgroundMediaController.scheduleBlurRefreshFromVideo(fallbackSrc);
}




// Элементы и состояние управления panzoom для графиков статистики.
var panzoomWrapper = document.getElementById("panzoomWrapper");
var panzoomContent = document.getElementById("panzoomContent");
var zoomLevelSpan = document.getElementById("zoomLevel");
var zoomInBtn = document.getElementById("zoomInBtn");
var zoomOutBtn = document.getElementById("zoomOutBtn");
var zoomResetBtn = document.getElementById("zoomResetBtn");

// Состояние panzoom
var panzoomState = {
  scale: 1,
  fitScale: 1,
  minScale: 0.005,    // Минимальный масштаб до 0.5% (в 20 раз ниже прежнего лимита)
  maxScale: 500,       // Максимальный масштаб до 50000% (500x)
  translateX: 0,
  translateY: 0,
  isPanning: false,
  panMode: 'none',     // 'none', 'left', 'middle'
  startX: 0,
  startY: 0,
  startTranslateX: 0,
  startTranslateY: 0,
  activePointers: {},
  activePointerId: null,
  isPinching: false,
  pinchStartDistance: 0,
  pinchStartScale: 1,
  pinchStartTranslateX: 0,
  pinchStartTranslateY: 0,
  pinchStartContentX: 0,
  pinchStartContentY: 0
};

var savedPanzoomByView = {
  "graph-full": null,
  "graph-resources": null
};

// Сбрасывает только текущий жест pan/pinch, не трогая уже выбранный масштаб и смещение графа.
function resetPanzoomGestureState() {
  panzoomState.isPanning = false;
  panzoomState.panMode = "none";
  panzoomState.activePointers = {};
  panzoomState.activePointerId = null;
  panzoomState.isPinching = false;
  panzoomState.pinchStartDistance = 0;
  panzoomState.pinchStartScale = panzoomState.scale;
  panzoomState.pinchStartTranslateX = panzoomState.translateX;
  panzoomState.pinchStartTranslateY = panzoomState.translateY;
  panzoomState.pinchStartContentX = 0;
  panzoomState.pinchStartContentY = 0;
}

function getPanzoomStateKeyForView(view) {
  if (view === "graph-full" || view === "full") return "graph-full";
  if (view === "graph-resources") return "graph-resources";
  return null;
}

function isGraphStatsView(view) {
  return getPanzoomStateKeyForView(view) !== null;
}

function clonePanzoomState() {
  return {
    scale: panzoomState.scale,
    fitScale: panzoomState.fitScale,
    translateX: panzoomState.translateX,
    translateY: panzoomState.translateY
  };
}

function applyPanzoomState(savedState) {
  if (!savedState) {
    fitGraphToViewport();
    return;
  }

  panzoomState.fitScale = (typeof savedState.fitScale === "number") ? savedState.fitScale : 1;
  panzoomState.scale = (typeof savedState.scale === "number") ? savedState.scale : panzoomState.fitScale;
  panzoomState.translateX = (typeof savedState.translateX === "number") ? savedState.translateX : 0;
  panzoomState.translateY = (typeof savedState.translateY === "number") ? savedState.translateY : 0;
  resetPanzoomGestureState();

  updatePanzoomTransform();
}

// Восстанавливает panzoom только для актуального рендера: старые таймеры не должны трогать новый SVG.
function restorePanzoomWhenGraphReady(stateKey, attempt, renderSequence) {
  attempt = attempt || 0;

  if (renderSequence !== graphRenderSequence) return;
  if (getPanzoomStateKeyForView(currentStatsView) !== stateKey) return;
  if (elStatsPanel && elStatsPanel.classList.contains("hidden")) return;

  var svg = mermaidGraph ? mermaidGraph.querySelector("svg") : null;
  var images = mermaidGraph ? mermaidGraph.querySelectorAll("img") : [];
  var hasPendingImages = false;
  var i;

  for (i = 0; i < images.length; i++) {
    if (!images[i].complete) {
      hasPendingImages = true;
      break;
    }
  }

  // Немного ждём готовности SVG/картинок,
  // но не блокируем восстановление навсегда
  if ((!svg || hasPendingImages) && attempt < 12) {
    setTimeout(function() {
      restorePanzoomWhenGraphReady(stateKey, attempt + 1, renderSequence);
    }, 50);
    return;
  }

  requestAnimationFrame(function() {
    if (renderSequence !== graphRenderSequence) return;
    requestAnimationFrame(function() {
      if (renderSequence !== graphRenderSequence) return;
      if (getPanzoomStateKeyForView(currentStatsView) !== stateKey) return;

      if (graphContainer) {
        forceRedraw(graphContainer);
      }

      applyPanzoomState(savedPanzoomByView[stateKey]);

      // Контрольный повтор после redraw/layout
      setTimeout(function() {
        if (renderSequence !== graphRenderSequence) return;
        if (getPanzoomStateKeyForView(currentStatsView) !== stateKey) return;
        applyPanzoomState(savedPanzoomByView[stateKey]);
      }, 40);
    });
  });
}

// Функция обновления трансформации
function updatePanzoomTransform() {
  if (!panzoomContent) return;
  
  var transform = `translate(${panzoomState.translateX}px, ${panzoomState.translateY}px) scale(${panzoomState.scale})`;
  panzoomContent.style.transform = transform;
  
  // Обновляем отображение масштаба
  if (zoomLevelSpan) {
    var baseScale = panzoomState.fitScale || 1;
    zoomLevelSpan.textContent = Math.round((panzoomState.scale / baseScale) * 100) + '%';
  }
}

function neutralizePanzoomForRender() {
  panzoomState.scale = 1;
  panzoomState.translateX = 0;
  panzoomState.translateY = 0;
  resetPanzoomGestureState();

  if (panzoomContent) {
    panzoomContent.style.transform = 'translate(0px, 0px) scale(1)';
  }
}

function fitGraphToViewport() {
  var svg, wrapperRect, bbox;
  var padding = 24;
  var availableWidth, availableHeight;
  var fitScale, offsetX, offsetY;

  if (!panzoomWrapper || !panzoomContent) return;

  svg = mermaidGraph ? mermaidGraph.querySelector("svg") : null;
  if (!svg) {
    panzoomState.fitScale = 1;
    panzoomState.scale = 1;
    panzoomState.translateX = 0;
    panzoomState.translateY = 0;
    updatePanzoomTransform();
    return;
  }

  try {
    bbox = svg.getBBox();
  } catch (e) {
    bbox = null;
  }

  wrapperRect = panzoomWrapper.getBoundingClientRect();

  if (!bbox || !bbox.width || !bbox.height || !wrapperRect.width || !wrapperRect.height) {
    panzoomState.fitScale = 1;
    panzoomState.scale = 1;
    panzoomState.translateX = 0;
    panzoomState.translateY = 0;
    updatePanzoomTransform();
    return;
  }

  availableWidth = Math.max(10, wrapperRect.width - padding * 2);
  availableHeight = Math.max(10, wrapperRect.height - padding * 2);

  fitScale = Math.min(
    availableWidth / bbox.width,
    availableHeight / bbox.height
  );

  // Не увеличиваем маленький граф сверх 100%
  fitScale = Math.min(1, fitScale);

  if (!isFinite(fitScale) || fitScale <= 0) {
    fitScale = 1;
  }

  offsetX = padding + (availableWidth - bbox.width * fitScale) / 2;
  offsetY = padding + (availableHeight - bbox.height * fitScale) / 2;

  panzoomState.fitScale = fitScale;
  panzoomState.scale = fitScale;
  panzoomState.translateX = offsetX - bbox.x * fitScale;
  panzoomState.translateY = offsetY - bbox.y * fitScale;
  resetPanzoomGestureState();

  updatePanzoomTransform();

  // Второй проход: центрируем уже по реальным экранным границам SVG,
  // потому что getBBox() у Mermaid/foreignObject может давать неидеальный центр
  requestAnimationFrame(function() {
    var wrapperRect2, svgRect, deltaX, deltaY;

    if (!panzoomWrapper || !svg) return;

    wrapperRect2 = panzoomWrapper.getBoundingClientRect();
    svgRect = svg.getBoundingClientRect();

    deltaX = (wrapperRect2.left + wrapperRect2.width / 2) - (svgRect.left + svgRect.width / 2);
    deltaY = (wrapperRect2.top + wrapperRect2.height / 2) - (svgRect.top + svgRect.height / 2);

    if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
      panzoomState.translateX += deltaX;
      panzoomState.translateY += deltaY;
      updatePanzoomTransform();
    }
  });
}

function resetPanzoom() {
  fitGraphToViewport();
}
// Ограничивает масштаб графа общими пределами panzoom, чтобы wheel, кнопки и pinch вели себя одинаково.
function clampPanzoomScale(scale) {
  return Math.max(panzoomState.minScale, Math.min(panzoomState.maxScale, scale));
}

// Меняет масштаб вокруг экранной точки; если точка не передана, используется центр видимой области графа.
function applyPanzoomScaleAtClientPoint(newScale, clientX, clientY) {
  var oldScale = panzoomState.scale;
  var rect;
  var focusX;
  var focusY;
  var contentX;
  var contentY;

  newScale = clampPanzoomScale(newScale);
  if (newScale === oldScale) return false;

  if (panzoomWrapper) {
    rect = panzoomWrapper.getBoundingClientRect();
    focusX = (typeof clientX === "number") ? clientX : rect.left + rect.width / 2;
    focusY = (typeof clientY === "number") ? clientY : rect.top + rect.height / 2;
    contentX = (focusX - rect.left - panzoomState.translateX) / oldScale;
    contentY = (focusY - rect.top - panzoomState.translateY) / oldScale;

    panzoomState.translateX = focusX - rect.left - contentX * newScale;
    panzoomState.translateY = focusY - rect.top - contentY * newScale;
  }

  panzoomState.scale = newScale;
  updatePanzoomTransform();
  return true;
}

// Возвращает активные указатели panzoom в стабильном порядке, чтобы два пальца давали предсказуемый pinch.
function getPanzoomPointerList() {
  var pointers = panzoomState.activePointers || {};
  return Object.keys(pointers).sort().map(function(pointerId) {
    return pointers[pointerId];
  }).filter(Boolean);
}

// Считает центр и расстояние между первыми двумя активными указателями для жеста pinch-to-zoom.
function getPanzoomPinchMetrics() {
  var pointers = getPanzoomPointerList();
  var first;
  var second;
  var dx;
  var dy;

  if (pointers.length < 2) return null;

  first = pointers[0];
  second = pointers[1];
  dx = second.x - first.x;
  dy = second.y - first.y;

  return {
    distance: Math.sqrt(dx * dx + dy * dy),
    centerX: (first.x + second.x) / 2,
    centerY: (first.y + second.y) / 2
  };
}

// Начинает обычное перемещение графа одним указателем, сохраняя текущий translate как базу жеста.
function startPanzoomDrag(pointer, mode) {
  if (!pointer) return;

  panzoomState.isPanning = true;
  panzoomState.isPinching = false;
  panzoomState.panMode = mode || "touch";
  panzoomState.activePointerId = pointer.id;
  panzoomState.startX = pointer.x;
  panzoomState.startY = pointer.y;
  panzoomState.startTranslateX = panzoomState.translateX;
  panzoomState.startTranslateY = panzoomState.translateY;
}

// Фиксирует начальные параметры pinch: дистанцию пальцев и точку графа под центром жеста.
function startPanzoomPinch(metrics) {
  var rect;
  var centerX;
  var centerY;

  if (!panzoomWrapper || !metrics || metrics.distance <= 0) return;

  rect = panzoomWrapper.getBoundingClientRect();
  if (!rect.width || !rect.height || !panzoomState.scale) return;

  centerX = metrics.centerX - rect.left;
  centerY = metrics.centerY - rect.top;

  panzoomState.isPanning = false;
  panzoomState.isPinching = true;
  panzoomState.panMode = "pinch";
  panzoomState.activePointerId = null;
  panzoomState.pinchStartDistance = metrics.distance;
  panzoomState.pinchStartScale = panzoomState.scale;
  panzoomState.pinchStartTranslateX = panzoomState.translateX;
  panzoomState.pinchStartTranslateY = panzoomState.translateY;
  panzoomState.pinchStartContentX = (centerX - panzoomState.translateX) / panzoomState.scale;
  panzoomState.pinchStartContentY = (centerY - panzoomState.translateY) / panzoomState.scale;
}

// Применяет текущий pinch: масштабирует вокруг начальной точки графа и одновременно следует за центром пальцев.
function updatePanzoomPinch() {
  var metrics = getPanzoomPinchMetrics();
  var rect;
  var centerX;
  var centerY;
  var ratio;
  var newScale;

  if (!metrics || metrics.distance <= 0 || !panzoomWrapper) return;
  if (!panzoomState.isPinching || !panzoomState.pinchStartDistance) {
    startPanzoomPinch(metrics);
  }
  if (!panzoomState.isPinching || !panzoomState.pinchStartDistance) return;

  rect = panzoomWrapper.getBoundingClientRect();
  centerX = metrics.centerX - rect.left;
  centerY = metrics.centerY - rect.top;
  ratio = metrics.distance / panzoomState.pinchStartDistance;
  newScale = clampPanzoomScale(panzoomState.pinchStartScale * ratio);

  panzoomState.scale = newScale;
  panzoomState.translateX = centerX - panzoomState.pinchStartContentX * newScale;
  panzoomState.translateY = centerY - panzoomState.pinchStartContentY * newScale;
  updatePanzoomTransform();
}

function initPanzoom() {
  if (!panzoomWrapper || !panzoomContent) return;

  var container = document.getElementById("graphContainer");

  // Для тача/пера отключаем нативный pan браузера
  // Два пальца обрабатываем сами: системный zoom страницы здесь мешал бы управлению графом.
  panzoomWrapper.style.touchAction = 'none';

  panzoomWrapper.addEventListener('pointerdown', function(e) {
    // Разрешаем мышь: левая (0) и средняя (1)
    // touch/pen тоже разрешаем
    var isMouse = e.pointerType === 'mouse';
    var pointer;
    var pinchMetrics;
    if (isMouse && e.button !== 0 && e.button !== 1) return;

    e.preventDefault();

    pointer = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      pointerType: e.pointerType,
      button: e.button
    };
    panzoomState.activePointers[e.pointerId] = pointer;

    if (panzoomWrapper.setPointerCapture) {
      try { panzoomWrapper.setPointerCapture(e.pointerId); } catch (err) {
        // Pointer capture необязателен: жест продолжает отслеживаться по pointerId.
      }
    }

    if (getPanzoomPointerList().length >= 2) {
      pinchMetrics = getPanzoomPinchMetrics();
      startPanzoomPinch(pinchMetrics);
    } else {
      startPanzoomDrag(pointer, isMouse ? (e.button === 1 ? 'middle' : 'left') : 'touch');
    }

    if (container) container.classList.add('panning');
  });

  // Блокируем стандартное поведение на нажатие колесика
  panzoomWrapper.addEventListener('auxclick', function(e) {
    if (e.button === 1) {
      e.preventDefault();
    }
  });

  panzoomWrapper.addEventListener('mousedown', function(e) {
    if (e.button === 1) {
      e.preventDefault();
    }
  });

  panzoomWrapper.addEventListener('contextmenu', function(e) {
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
    }
  });

  panzoomWrapper.addEventListener('pointermove', function(e) {
    var pointer = panzoomState.activePointers[e.pointerId];
    var dx;
    var dy;

    if (!pointer) return;

    e.preventDefault();

    pointer.x = e.clientX;
    pointer.y = e.clientY;

    if (getPanzoomPointerList().length >= 2) {
      updatePanzoomPinch();
      return;
    }

    if (!panzoomState.isPanning) return;
    if (e.pointerId !== panzoomState.activePointerId) return;

    dx = e.clientX - panzoomState.startX;
    dy = e.clientY - panzoomState.startY;

    panzoomState.translateX = panzoomState.startTranslateX + dx;
    panzoomState.translateY = panzoomState.startTranslateY + dy;

    updatePanzoomTransform();
  });

  // Завершает один указатель; если после pinch остался один палец, сразу переводит его в обычный pan.
  function stopPan(e) {
    var pointer = panzoomState.activePointers[e.pointerId];
    var remainingPointers;
    var remaining;

    if (!pointer) return;

    e.preventDefault();

    if (panzoomWrapper.releasePointerCapture) {
      try { panzoomWrapper.releasePointerCapture(e.pointerId); } catch (err) {
        // Pointer capture мог быть уже снят браузером, состояние жеста очищается ниже.
      }
    }

    delete panzoomState.activePointers[e.pointerId];
    remainingPointers = getPanzoomPointerList();

    if (remainingPointers.length >= 2) {
      startPanzoomPinch(getPanzoomPinchMetrics());
      return;
    }

    if (remainingPointers.length === 1) {
      remaining = remainingPointers[0];
      startPanzoomDrag(remaining, remaining.pointerType === 'mouse' ? 'left' : 'touch');
      return;
    }

    resetPanzoomGestureState();
    if (container) container.classList.remove('panning');
  }

  panzoomWrapper.addEventListener('pointerup', stopPan);
  panzoomWrapper.addEventListener('pointercancel', stopPan);




  // ОСТАВИТЬ ваш существующий wheel-обработчик
  panzoomWrapper.addEventListener('wheel', function(e) {
    e.preventDefault();

    var delta = e.deltaY > 0 ? -1 : 1;
    applyPanzoomScaleAtClientPoint(panzoomState.scale * (delta > 0 ? 1.2 : 0.83), e.clientX, e.clientY);
  }, { passive: false });

  // ОСТАВИТЬ существующие click на кнопках
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', function() {
      var rect = panzoomWrapper.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      var centerY = rect.top + rect.height / 2;
      applyPanzoomScaleAtClientPoint(panzoomState.scale * 1.3, centerX, centerY);
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', function() {
      var rect = panzoomWrapper.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      var centerY = rect.top + rect.height / 2;
      applyPanzoomScaleAtClientPoint(panzoomState.scale / 1.3, centerX, centerY);
    });
  }

  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', function() {
      resetPanzoom();
    });
  }

  resetPanzoom();
}

// options.scope: "full" | "resources" (см. buildMermaidGraph). forceFull — не переходить в compact.
function buildMermaidVariant(story, unreachableList, options) {
  options = options || {};

  var scope = options.scope || "full";
  var forceCompact = options.forceCompact;
  var forceFull = !!options.forceFull;

  var fullCode = buildMermaidGraph(story, unreachableList, {
    compact: false,
    scope: scope
  });

  var useCompact = false;
  if (!forceFull) {
    if (typeof forceCompact === "boolean") {
      useCompact = forceCompact;
    } else {
      useCompact = shouldUseCompactMermaid(fullCode);
    }
  }

  var compactCode = "";
  if (!forceFull) {
    compactCode = buildMermaidGraph(story, unreachableList, {
      compact: true,
      scope: scope
    });
  }

  return {
    fullCode: fullCode,
    compactCode: compactCode,
    code: fullCode,
    useCompact: useCompact
  };
}


function shouldUseCompactMermaid(fullCode, stats) {
  if (!fullCode) return false;

  if (fullCode.length > 49900) return true;
  // 49900

  if (stats && stats.sceneCount > 120) return true;
  if (stats && stats.edgeCount > 400) return true;

  return false;
}

// Разрешает в стилях SVG только локальные fragment-url маркеров и запрещает сетевые или исполняемые CSS-конструкции.
function isSafeMermaidCssText(value) {
  var css = String(value || "");
  if (/@import|expression\s*\(|javascript\s*:|vbscript\s*:|behavior\s*:|-moz-binding/i.test(css)) return false;

  var unsafeUrl = false;
  var withoutSafeUrls = css.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi, function(match, quote, target) {
    if (!/^#[A-Za-z0-9_.:-]+$/.test(String(target || ""))) unsafeUrl = true;
    return "";
  });
  if (unsafeUrl || /url\s*\(/i.test(withoutSafeUrls)) return false;
  return true;
}

// Удаляет из результата Mermaid активные элементы, обработчики событий и URL до переноса SVG в документ новеллы.
function sanitizeMermaidRenderedTree(root) {
  if (!root || !root.querySelectorAll) return null;

  var blockedTags = {
    a: true,
    animate: true,
    animatemotion: true,
    animatetransform: true,
    audio: true,
    base: true,
    button: true,
    canvas: true,
    embed: true,
    form: true,
    iframe: true,
    input: true,
    link: true,
    meta: true,
    mpath: true,
    object: true,
    option: true,
    script: true,
    select: true,
    set: true,
    source: true,
    template: true,
    textarea: true,
    track: true,
    video: true
  };
  var urlAttributes = {
    action: true,
    background: true,
    formaction: true,
    href: true,
    "xlink:href": true,
    ping: true,
    poster: true,
    src: true,
    srcset: true
  };
  var elements = [root].concat(Array.prototype.slice.call(root.querySelectorAll("*")));

  for (var removeIndex = elements.length - 1; removeIndex >= 0; removeIndex--) {
    var candidate = elements[removeIndex];
    var tagName = String(candidate.localName || candidate.nodeName || "").toLowerCase();
    if (blockedTags[tagName] && candidate.parentNode) candidate.parentNode.removeChild(candidate);
  }

  elements = [root].concat(Array.prototype.slice.call(root.querySelectorAll("*")));
  for (var elementIndex = 0; elementIndex < elements.length; elementIndex++) {
    var element = elements[elementIndex];
    var currentTag = String(element.localName || element.nodeName || "").toLowerCase();
    if (currentTag === "style" && !isSafeMermaidCssText(element.textContent || "")) {
      if (element.parentNode) element.parentNode.removeChild(element);
      continue;
    }

    var attributes = Array.prototype.slice.call(element.attributes || []);
    for (var attributeIndex = 0; attributeIndex < attributes.length; attributeIndex++) {
      var attribute = attributes[attributeIndex];
      var attributeName = String(attribute.name || "").toLowerCase();
      var attributeValue = String(attribute.value || "").trim();
      if (/^on/i.test(attributeName) || attributeName === "srcdoc") {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (attributeName === "style" && !isSafeMermaidCssText(attributeValue)) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (urlAttributes[attributeName]) {
        var isLocalFragment = (attributeName === "href" || attributeName === "xlink:href") && /^#[A-Za-z0-9_.:-]+$/.test(attributeValue);
        if (!isLocalFragment) element.removeAttribute(attribute.name);
      }
    }
  }

  return root;
}

// Разбирает SVG в инертном HTML-документе, проверяет корень и возвращает очищенный узел без innerHTML основной страницы.
function createSafeMermaidSvgNode(svgSource) {
  var parser = new DOMParser();
  var parsed = parser.parseFromString(String(svgSource || ""), "text/html");
  var root = parsed.body ? parsed.body.querySelector("svg") : null;
  if (!root || String(root.localName || "").toLowerCase() !== "svg") {
    throw new Error("Mermaid не вернул корневой SVG.");
  }
  sanitizeMermaidRenderedTree(root);
  return document.importNode(root, true);
}

// Рендерит Mermaid в DOM как один атомарный async-проход: старые проходы отбрасываются по graphRenderSequence,
// чтобы при частых входах/выходах из вкладки графа не смешивались размеры старого SVG и нового foreignObject.
function renderMermaidGraph(renderSequence) {
  if (!window.STORY) return Promise.resolve(false);
  if (!currentMermaidCode) return Promise.resolve(false);
  if (!mermaidGraph) return Promise.resolve(false);

  if (!renderSequence) {
    renderSequence = ++graphRenderSequence;
  }

  var variant = getMermaidVariantForStatsView(currentStatsView);
  var renderQueue = [];

  if (currentStatsView === "graph-full" && variant) {
    if (variant.fullCode) renderQueue.push(variant.fullCode);
    if (variant.compactCode && variant.compactCode !== variant.fullCode) {
      renderQueue.push(variant.compactCode);
    }
  } else {
    renderQueue.push(currentMermaidCode);
  }

  if (!renderQueue.length) return Promise.resolve(false);

  function clearMermaidContainer() {
    while (mermaidGraph.firstChild) {
      mermaidGraph.removeChild(mermaidGraph.firstChild);
    }
    mermaidGraph.removeAttribute('data-processed');
    mermaidGraph.removeAttribute('data-mermaid-svg');
    mermaidGraph.removeAttribute('data-mermaid-type');
  }

  // Проверяет, можно ли ещё применять результат текущего async-рендера к DOM.
  function isRenderOutdated() {
    if (renderSequence !== graphRenderSequence) return true;
    if (getPanzoomStateKeyForView(currentStatsView) === null) return true;
    if (elStatsPanel && elStatsPanel.classList.contains("hidden")) return true;
    return false;
  }

  function hasMermaidRenderError() {
    var text = (mermaidGraph.textContent || "").toLowerCase();
    if (text.indexOf("maximum text size in diagram exceeded") !== -1) return true;
    if (text.indexOf("syntax error in text") !== -1) return true;
    return !mermaidGraph.querySelector('svg');
  }

  function tryRenderFromQueue(index) {
    var code = renderQueue[index];
    if (!code || !window.mermaid) return Promise.resolve(false);
    if (isRenderOutdated()) return Promise.resolve(false);

    clearMermaidContainer();
    // Mermaid измеряет getBoundingClientRect во время layout, поэтому временный host должен быть в DOM; strict и экранирование защищают этот промежуточный этап.
    var temporaryRenderHost = document.createElement("div");
    temporaryRenderHost.setAttribute("aria-hidden", "true");
    temporaryRenderHost.style.visibility = "hidden";
    mermaidGraph.appendChild(temporaryRenderHost);

    return window.mermaid.render("vn-graph-" + renderSequence + "-" + index, code, temporaryRenderHost)
      .then(function(result) {
        if (isRenderOutdated()) return false;

        var safeSvg = createSafeMermaidSvgNode(result && result.svg ? result.svg : "");
        clearMermaidContainer();
        mermaidGraph.appendChild(safeSvg);

        if (!hasMermaidRenderError()) {
          beginGraphImageLoadRegistration(renderSequence);
          hydrateBg360GraphThumbnails(mermaidGraph);
          hydrateRasterGraphThumbnails(mermaidGraph);
          hydrateGraphCharacterFrames(mermaidGraph);
          completeGraphImageLoadRegistration();
        }

        if (hasMermaidRenderError() && index + 1 < renderQueue.length) {
          console.warn("[GRAPH] Full render produced Mermaid error, trying compact fallback.");
          return tryRenderFromQueue(index + 1);
        }

        return !hasMermaidRenderError();
      })
      .catch(function(e) {
        console.error("Mermaid render error:", e);
        if (index + 1 < renderQueue.length) {
          console.warn("[GRAPH] Full render failed, trying compact fallback.");
          return tryRenderFromQueue(index + 1);
        }
        if (!isRenderOutdated()) {
          clearMermaidContainer();
          mermaidGraph.textContent =
            (t("mermaidScriptError") || "Mermaid render failed") +
            "\n" +
            (e && e.message ? e.message : String(e));
        }
        return false;
      });
  }

  return ensureMermaidScriptLoaded()
    .then(function() {
      configureMermaidLibrary();
      return tryRenderFromQueue(0);
    })
    .catch(function(err) {
      if (isRenderOutdated()) return false;
      console.error("[GRAPH] " + (t("mermaidScriptError") || "Mermaid load failed"), err);
      clearMermaidContainer();
      mermaidGraph.textContent =
        (t("mermaidScriptError") || "Mermaid load failed") +
        "\n" +
        (err && err.message ? err.message : String(err));
      return false;
    });
}

/**
 * Полный цикл перерисовки графа на вкладке статистики: сброс transform панорамы, Mermaid-render,
 * затем восстановление сохранённого масштаба после появления SVG и догрузки img (см. restorePanzoomWhenGraphReady).
 * Вызов только renderMermaidGraph() из UI оставлял старый scale/translate на .panzoom-content — расходились getBBox,
 * раскладка foreignObject и визуальный размер узлов при повторных рефрешах.
 */
function renderGraphViewWithPanzoomLifecycle(stateKey) {
  if (!stateKey) return Promise.resolve(false);
  var renderSequence = ++graphRenderSequence;
  neutralizePanzoomForRender();
  prepareGraphImageLoadProgress(renderSequence);
  return renderMermaidGraph(renderSequence).then(function(rendered) {
    if (!rendered || renderSequence !== graphRenderSequence) {
      // Пока асинхронная статистика ещё не собрала Mermaid-код, оставляем состояние подготовки: её финальный рендер перезапустит полосу.
      if (renderSequence === graphRenderSequence && window.STORY && currentMermaidCode && mermaidGraph) {
        markGraphImageRenderFailed(renderSequence);
      }
      return false;
    }
    restorePanzoomWhenGraphReady(stateKey, 0, renderSequence);
    return true;
  });
}

// Принудительно пересчитывает SVG после переключения вкладок статистики.
function forceRedraw(element) {
  if (!element) return;
  
  // Принудительный пересчет стилей
  var display = element.style.display;
  element.style.display = 'none';
  element.offsetHeight; // форсируем reflow
  element.style.display = display;
  
  // Находим SVG и обновляем его
  var svg = element.querySelector('svg');
  if (svg) {
    var padding = 25;
    var bbox = svg.getBBox();

    var x = bbox.x - padding;
    var y = bbox.y - padding;
    var w = bbox.width + padding * 2;
    var h = bbox.height + padding * 2;

    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  }
}

// Инициализация panzoom при загрузке
setTimeout(function() {
    initPanzoom();
}, 500);



// Запрет перетаскивания на фоне и карточке панели статистики
var statsPanel = document.getElementById('statsPanel');
var statsCard = document.querySelector('.statsCard');

if (statsPanel) {
  statsPanel.setAttribute('draggable', 'false');
  statsPanel.addEventListener('dragstart', function(e) {
    // Если цель — сам фон или его прямой потомок без особых разрешений
    if (e.target === statsPanel || e.target === statsCard || e.target.closest('.statsCard') === statsCard) {
      e.preventDefault();
      return false;
    }
  });
}

if (statsCard) {
  statsCard.setAttribute('draggable', 'false');
  statsCard.addEventListener('dragstart', function(e) {
    e.preventDefault();
    return false;
  });
}

// Запрет перетаскивания на фоне и карточке окна настроек
var settingsPanel = document.getElementById('settingsPanel');
var settingsCard = document.querySelector('.settingsCard');

if (settingsPanel) {
  settingsPanel.setAttribute('draggable', 'false');
  settingsPanel.addEventListener('dragstart', function(e) {
    if (e.target === settingsPanel || e.target === settingsCard || e.target.closest('.settingsCard') === settingsCard) {
      e.preventDefault();
      return false;
    }
  });
}

if (settingsCard) {
  settingsCard.setAttribute('draggable', 'false');
  settingsCard.addEventListener('dragstart', function(e) {
    e.preventDefault();
    return false;
  });
}

// Подтверждает bootstrap, что обязательный координатор выполнился полностью, а не только был получен браузером.
window.VN_ENGINE_READY = true;

})();
