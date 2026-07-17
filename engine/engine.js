/* engine.js
   Минимальный VN-движок: офлайн, без fetch, без модулей, максимум совместимости.
*/
(function () {
  "use strict";

// =========================================================
// ПРОФАЙЛЕР ВРЕМЕНИ
// =========================================================
var profiler = {
  startTime: Date.now(),
  marks: {},
  
  mark: function(name) {
    this.marks[name] = Date.now() - this.startTime;
    console.log('[PROFILER]', name, ':', this.marks[name] + 'ms');
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






let __charSeq = 0;
let __activeCharSeq = 0;
let __visualTransitionSeq = 0;

var VISUAL_TRANSITION_OUT_MS = 80;
var VISUAL_TRANSITION_IN_MS = 100;
var VISUAL_TRANSITION_TOTAL_MS = VISUAL_TRANSITION_OUT_MS + VISUAL_TRANSITION_IN_MS;
var elVisualTransitionCover = null;
var elVisualBgCrossfade = null;
var elVisualBgVideoCrossfade = null;
var elVisualBlurBgCrossfade = null;
var elVisualBlurBgVideoCrossfade = null;

const UI_I18N = {
  en: {
    mute: "Mute",
    settings: "About app",
    stats: "Stats",
    next: "Next",
    choices: "Choices",
    game: "Game",
    closeGame: "Close Game",
    restartGame: "Restart Game",
    hintContinue: "Click to continue",
    statsTitle: "Script Statistics",
    fullGraphButton: "📊 Full Graph",
    resourcesGraphButton: "📦 Resources graph",
    gamesButton: "🎮 Games",
    textButton: "📄 Text",
    fullGraphButtonTitle: "Show full graph",
    resourcesGraphButtonTitle: "Compact resources graph: start scene only, same full asset blocks as the main graph",
    gamesButtonTitle: "Show games catalog",
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
    settings: "Информация о программе",
    stats: "Статистика",
    next: "Далее",
    choices: "Выбор",
    game: "Игра",
    closeGame: "Закрыть игру",
    restartGame: "Перезапустить",
    hintContinue: "Нажмите, чтобы продолжить",
    statsTitle: "Статистика сценария",
    fullGraphButton: "📊 Граф полный",
    resourcesGraphButton: "📦 Граф ресурсов",
    gamesButton: "🎮 Игры",
    textButton: "📄 Текст",
    fullGraphButtonTitle: "Показать полный граф",
    resourcesGraphButtonTitle: "Компактный граф ресурсов: на схеме только стартовая сцена, блоки ассетов — полные, как на основном графе",
    gamesButtonTitle: "Показать каталог игр",
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

  var btnSettings = document.getElementById("btnSettings");
  if (btnSettings) {
    btnSettings.setAttribute("aria-label", t("settings"));
    btnSettings.title = t("settings");
  }

  var btnStats = document.getElementById("btnStats");
  if (btnStats) btnStats.setAttribute("aria-label", t("stats"));

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

  console.log('[FIRST SCREEN]', {
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
    securityLevel: "loose",
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

// Кодирует байты подписи в hex-строку, потому что jsrsasign принимает подписи в hex.
function bytesToHex(bytes) {
  var hex = "";
  for (var i = 0; i < bytes.length; i++) {
    hex += ("0" + bytes[i].toString(16)).slice(-2);
  }

  return hex;
}

// Проверяет наличие локально подключённой MIT-библиотеки jsrsasign; без неё лицензии не валидируются.
function isJsrsasignAvailable() {
  return !!(
    window.KJUR &&
    window.KJUR.crypto &&
    window.KJUR.crypto.Signature &&
    window.KEYUTIL
  );
}

// Проверяет RSA-PSS подпись через локальный jsrsasign, чтобы на всех устройствах был один путь проверки.
function verifyLicenseSignature(dataToVerify, signatureBytes) {
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
      return createLicenseState("missing-verifier", false, parsed.payload, "The local jsrsasign signature verifier is missing.");
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
    console.log("[LICENSE]", license.status, license.mode, license.message);
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
// validate — дополнительная проверка значения
const UI_STYLE_CONFIG = {
  topSpacing: {
    cssVar: '--topSpacing',
    default: 0,
    unit: 'px',
    type: 'int',
    min: 0
  },
  rightSpacing: {
    cssVar: '--rightSpacing',
    default: 0,
    unit: 'px',
    type: 'int',
    min: 0
  },
  bottomSpacing: {
    cssVar: '--bottomSpacing',
    default: 0,
    unit: 'px',
    type: 'int',
    min: 0
  },
  leftSpacing: {
    cssVar: '--leftSpacing',
    default: 0,
    unit: 'px',
    type: 'int',
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
var elUiFrame = document.getElementById("uiFrame");
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
var elBg360PhotoPrev = null;
var elBg360PhotoNext = null;
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

  console.log("[GAME] syncStatsGameFrameWrapToStoryGameWindow", {
    left: left,
    top: top,
    width: width,
    height: height
  });
}

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

// Новые DOM-элементы
var elBlurBgLayer = document.getElementById("blurBgLayer");
var elBlurBgImage = document.getElementById("blurBgImage");
var elBlurBgVideo = document.getElementById("blurBgVideo");
/** Счётчик вызовов syncBlurBackgroundVideo: отменяет устаревшие обработчики при быстрой смене сцен. */
var blurBgVideoSyncSeq = 0;

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
console.log('[Engine] blurBgLayer:', elBlurBgLayer);
console.log('[Engine] blurBgImage:', elBlurBgImage);
console.log('[Engine] blurBgVideo:', elBlurBgVideo);

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

  console.log("[LOG] stage click", {
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










// Добавьте в engine.js после объявления переменных

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





// Функция для скрытия всех персонажей
function hideAllCharacters() {
  console.log('[Engine] hideAllCharacters START ==========');

  // Увеличиваем счётчик, чтобы отменить все старые загрузки
  __activeCharSeq++;


  console.log('[Engine] hideAllCharacters START ==========');
  console.log('[Engine] hideAllCharacters - DOM элемент elChar:', elChar);
  
  if (elChar) {
    // Логируем состояние ДО
    console.log('[Engine] hideAllCharacters - ДО скрытия:', {
      классы: elChar.classList.toString(),
      src: elChar.src,
      'data-char-id': elChar.dataset.charId,
      стиль: {
        display: elChar.style.display,
        opacity: elChar.style.opacity,
        visibility: elChar.style.visibility,
        height: elChar.style.height
      },
      offsetHeight: elChar.offsetHeight,
      видим_ли: !elChar.classList.contains('hidden')
    });

    // Принудительное скрытие
    elChar.classList.add("hidden");
    elChar.src = "";
    elChar.removeAttribute('data-char-id');
    resetCharacterVisualLayout();
    
    // Логируем состояние ПОСЛЕ
    console.log('[Engine] hideAllCharacters - ПОСЛЕ скрытия:', {
      классы: elChar.classList.toString(),
      src: elChar.src,
      'data-char-id': elChar.dataset.charId,
      стиль: {
        display: elChar.style.display,
        opacity: elChar.style.opacity,
        visibility: elChar.style.visibility,
        height: elChar.style.height
      },
      offsetHeight: elChar.offsetHeight,
      скрыт_ли: elChar.classList.contains('hidden')
    });
    
    // Проверяем через 100мс, что персонаж действительно скрыт
    setTimeout(() => {
      console.log('[Engine] hideAllCharacters - ПРОВЕРКА через 100мс:', {
        классы: elChar.classList.toString(),
        src: elChar.src,
        'data-char-id': elChar.dataset.charId,
        стиль: {
          display: elChar.style.display,
          height: elChar.style.height
        },
        offsetHeight: elChar.offsetHeight,
        скрыт_ли: elChar.classList.contains('hidden'),
        computedStyle: {
          display: window.getComputedStyle(elChar).display,
          opacity: window.getComputedStyle(elChar).opacity,
          visibility: window.getComputedStyle(elChar).visibility
        }
      });
    }, 100);
  } else {
    console.log('[Engine] hideAllCharacters - ОШИБКА: elChar не найден!');
  }
  console.log('[Engine] hideAllCharacters END ==========');
}

// Проверяем, есть ли ошибки парсинга
if (window.PARSE_ERRORS && window.PARSE_ERRORS.length > 0) {
  console.log('[Engine] Обнаружены ошибки парсинга, движок не запускается');
  
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
  console.log('[Engine] Ожидание window.STORY...');
  elText.textContent = t("loadingStory"); // "Загрузка сценария..."
  
  // Ждём загрузки от story-loader.js
  window.__onStoryLoaded = function(story) {
    console.log('[Engine] Сценарий загружен, перезапускаем');
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
console.log('[Engine] Script found immediately:', STORY.meta.title);
profiler.mark('Script found immediately');
updateStatsButtonByStoryMode();

console.log('[Engine] STORY.assets:', STORY.assets);
if (STORY.assets) {
  console.log('[Engine] STORY.assets.backgrounds:', STORY.assets.backgrounds);
  console.log('[Engine] STORY.assets.characters:', STORY.assets.characters);
  console.log('[Engine] STORY.assets.audio:', STORY.assets.audio);
} else {
  console.log('[Engine] STORY.assets is undefined!');
}


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
console.log('[SCALE] UI_FONT_SCALE initialized:', UI_FONT_SCALE);

// Дополнительный множитель масштаба интерфейса только при уверенном определении смартфона.
// В applyUiScale итог: UI_FONT_SCALE * autoScale * (телефон ? UI_PHONE_EXTRA_FONT_SCALE : 1).
// Значение 1.0 отключает эффект; >1 укрупняет текст и UI на телефонах поверх обычной формулы.
var UI_PHONE_EXTRA_FONT_SCALE = 1.45;
console.log('[SCALE] UI_PHONE_EXTRA_FONT_SCALE initialized:', UI_PHONE_EXTRA_FONT_SCALE);

// Верхняя граница меньшей стороны viewport (CSS px) для «карманного» экрана; выше — не считаем телефоном.
var UI_PHONE_VIEWPORT_MAX_SHORT_PX = 560;
// Минимум отношения длинной стороны к короткой (отсекает почти квадратные окна на ПК).
var UI_PHONE_VIEWPORT_MIN_ASPECT = 1.35;

// Высота экрана, под которую делался дизайн
// используется для автоадаптации
var UI_REFERENCE_HEIGHT = 1440;
console.log('[SCALE] UI_REFERENCE_HEIGHT initialized:', UI_REFERENCE_HEIGHT);

// Высота, от которой считаются визуальные эффекты: blur, тонкие бордеры и тени.
// Минимум не даёт эффектам стать слишком тонкими на очень низком окне.
var UI_VISUAL_REFERENCE_HEIGHT = UI_REFERENCE_HEIGHT;
var UI_VISUAL_MIN_HEIGHT = 400;
console.log('[SCALE] UI_VISUAL_REFERENCE_HEIGHT initialized:', UI_VISUAL_REFERENCE_HEIGHT);
console.log('[SCALE] UI_VISUAL_MIN_HEIGHT initialized:', UI_VISUAL_MIN_HEIGHT);

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
// Персонаж по умолчанию живет в нижних 85% кадра; верхние 15% остаются служебной зоной композиции.
var CHARACTER_WORK_HEIGHT_RATIO = 0.85;
var CHARACTER_FOCUS_DEFAULTS = {
  pos: "center",
  focusX: 0.5,
  focusY: 0.5,
  scale: 1
};
var currentCharacterVisualOptions = {
  pos: CHARACTER_FOCUS_DEFAULTS.pos,
  focusX: CHARACTER_FOCUS_DEFAULTS.focusX,
  focusY: CHARACTER_FOCUS_DEFAULTS.focusY,
  scale: CHARACTER_FOCUS_DEFAULTS.scale
};
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

// Runtime меток 360: хранит список меток и управляет интерактивностью до следующего bg.
var bg360MarksRuntime = {
  bgId: null,
  marks: [],
  lines: false,
  locked: false,
  interactive: false
};

// Runtime просмотра изображений с photo-меток: одно фото, zoom/pan только кадра, заморозка 360.
var bg360PhotoViewerRuntime = {
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
  photoViewerReady: false,
  /** Блокирует click сразу после pan, чтобы жест не сработал как клик по кнопке. */
  suppressUiClickUntil: 0
};

var BG360_PHOTO_ZOOM_MIN = 1;
var BG360_PHOTO_ZOOM_MAX = 4;

// Инициализация обработчиков viewer — только после объявления bg360PhotoViewerRuntime.
setupBg360PhotoViewer();

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

// Отладка автосейва: в консоли фильтр [AUTOSAVE_DEBUG]. Выключить: window.VN_AUTOSAVE_DEBUG = false
// Объявлено до startLicensedEngine/pagehide, чтобы не было ReferenceError при синхронном restart().
if (typeof window !== "undefined" && window.VN_AUTOSAVE_DEBUG === undefined) {
  window.VN_AUTOSAVE_DEBUG = true;
}

/** Укороченный стек для логов (кто вызвал flush/build). */
function autosaveDebugShortStack() {
  try {
    var s = new Error().stack;
    if (!s) return "";
    var lines = s.split("\n");
    return lines.slice(2, 7).join(" <- ");
  } catch (err) {
    return "";
  }
}

/** Единая точка логов автосейва; не спамит, если window.VN_AUTOSAVE_DEBUG === false. */
function autosaveDebugLog(tag, detail) {
  if (typeof window !== "undefined" && window.VN_AUTOSAVE_DEBUG === false) return;
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
      } catch (captureError) {}
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
      } catch (captureError) {}
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

// ---------- Аудио ----------
// Один канал для фоновой музыки и отдельный для эффектов.
var audio = {
  bgm: new Audio(),
  sfx: new Audio(),
  muted: true,
  masterVolume: 0.2,
  // Громкость фонового видео как доля от master (0..1). По умолчанию 0 = без звука.
  currentBgVideoVolume: 0,
  // Громкость сюжетного видео отделена от фонового видео и сбрасывается после каждой вставки.
  currentStoryVideoVolume: 0,
  // Множитель приглушения BGM (ducking): 1 = без приглушения.
  bgmDuckingMultiplier: 1,
  bgmDuckingTimer: null,
  // для плавного затухания (если понадобится)
  fadeTimer: null
};
// Глобальные дефолты ducking объявляем рядом с аудио-состоянием,
// чтобы они были инициализированы до любых вызовов setBackground().
var DEFAULT_BGM_DUCKING_MULTIPLIER = 0.0; // 0% громкости BGM во время фонового видео
var DEFAULT_BGM_DUCKING_ATTACK_MS = 250;  // скорость приглушения
var DEFAULT_BGM_DUCKING_RELEASE_MS = 450; // скорость возврата громкости

var failedAssets = {
  audio: Object.create(null),
  images: Object.create(null)
};

function normalizeAssetUrl(url) {
  if (!url) return "";
  try {
    return new URL(url, window.location.href).href;
  } catch (e) {
    return String(url);
  }
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
  if (!isEngineImageOptimizationEnabled() || !isRasterImagePathForOptimization(original)) {
    return [original];
  }

  var cacheKey = normalizeAssetUrl(original);
  var cachedWinner = imageOptimizeResolvedCache[cacheKey];
  if (cachedWinner) {
    return [cachedWinner];
  }

  if (areImageOptimizeWebpVariantsExhausted(original)) {
    return [original];
  }

  var parts = splitStoryImagePathForOptimize(original);
  var desktopPath = buildVnvOptimizedImagePath(parts.basePath, "desktop", parts.suffix);
  var mobilePath = buildVnvOptimizedImagePath(parts.basePath, "mobile", parts.suffix);
  if (isConfidentPhoneForUiBoost()) {
    return [mobilePath, desktopPath, original];
  }
  return [desktopPath, mobilePath, original];
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

  function shouldAbort() {
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
  return " data-vnv-story-img='" + escapeHtml(story) + "'";
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
      assignRasterImageToElement(img, story, {});
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

// Для персонажа focusY инвертирован относительно фона: 0 — низ рабочей зоны, 1 — верхняя красная граница.
function normalizeCharacterFocusY(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  var rawValue = typeof value === "string" ? value.trim() : value;
  var textValue = typeof rawValue === "string" ? rawValue.toLowerCase() : rawValue;
  if (textValue === "bottom" || textValue === "end") return 0;
  if (textValue === "top" || textValue === "start") return 1;
  if (textValue === "center" || textValue === "middle") return 0.5;

  var numeric = Number(resolveMediaVariableValue(rawValue, "character focusY"));
  if (!isFinite(numeric)) return fallback;
  if (numeric > 1 && numeric <= 100) numeric = numeric / 100;
  return clamp(numeric, 0, 1);
}

// Возвращает безопасные дефолты даже при раннем вызове до полной инициализации runtime-переменных.
function getCharacterFocusDefaults() {
  if (CHARACTER_FOCUS_DEFAULTS && typeof CHARACTER_FOCUS_DEFAULTS === "object") {
    return CHARACTER_FOCUS_DEFAULTS;
  }
  return {
    pos: "center",
    focusX: 0.5,
    focusY: 0.5,
    scale: 1
  };
}

// Приводит позицию персонажа к одному из трех слотов, чтобы расчет фокуса не зависел от CSS-строки left.
function normalizeCharacterPosition(pos) {
  var value = String(pos || "").trim().toLowerCase();
  if (value === "left" || value === "right" || value === "center") return value;
  return getCharacterFocusDefaults().pos;
}

// Собирает валидные настройки персонажа и подставляет прежние значения как fallback при частичном override.
function normalizeCharacterFocusOptions(options, fallback) {
  var base = fallback || getCharacterFocusDefaults();
  var source = options || {};
  var normalizedScale = normalizeMediaScale(source.scale, base.scale);

  return {
    pos: normalizeCharacterPosition(source.pos !== undefined ? source.pos : base.pos),
    focusX: normalizeMediaFocus(source.focusX, base.focusX),
    focusY: normalizeCharacterFocusY(source.focusY, base.focusY),
    scale: normalizedScale === null ? base.scale : normalizedScale
  };
}

// Сливает настройки так, чтобы show мог переопределить только нужные поля из описания персонажа.
function mergeCharacterFocusOptions(baseOptions, overrideOptions) {
  var merged = {};
  var copyOption = function(source, key) {
    if (source && source[key] !== undefined && source[key] !== null && source[key] !== "") {
      merged[key] = source[key];
    }
  };

  ["pos", "focusX", "focusY", "scale"].forEach(function(key) {
    copyOption(baseOptions, key);
  });
  ["pos", "focusX", "focusY", "scale"].forEach(function(key) {
    copyOption(overrideOptions, key);
  });

  return merged;
}

// Небольшая проверка нужна, чтобы visual-batch понимал: смена focus/scale тоже меняет видимый кадр.
function areCharacterFocusOptionsEqual(a, b) {
  if (!a || !b) return false;
  return (
    normalizeCharacterPosition(a.pos) === normalizeCharacterPosition(b.pos) &&
    Math.abs(num(a.focusX, 0.5) - num(b.focusX, 0.5)) < 0.0001 &&
    Math.abs(num(a.focusY, 0.5) - num(b.focusY, 0.5)) < 0.0001 &&
    Math.abs(num(a.scale, 1) - num(b.scale, 1)) < 0.0001
  );
}

// Округляет числа в диагностике, чтобы координаты читались в консоли без длинных дробей.
function roundCharacterDebugNumber(value) {
  return typeof value === "number" && isFinite(value) ? Math.round(value * 1000) / 1000 : value;
}

// Снимает DOMRect в простой объект; так браузерная консоль не покажет уже изменившийся live-объект.
function getCharacterDebugRect(el) {
  if (!el || typeof el.getBoundingClientRect !== "function") return null;
  var rect = el.getBoundingClientRect();
  return {
    left: roundCharacterDebugNumber(rect.left),
    top: roundCharacterDebugNumber(rect.top),
    right: roundCharacterDebugNumber(rect.right),
    bottom: roundCharacterDebugNumber(rect.bottom),
    width: roundCharacterDebugNumber(rect.width),
    height: roundCharacterDebugNumber(rect.height)
  };
}

// Собирает полный снимок позиционирования персонажа для поиска редких гонок загрузки и неверного pos/focus.
function getCharacterDebugSnapshot(extra) {
  var frame = elCharFrame || document.getElementById("charFrame");
  var char = elChar || document.getElementById("charLayer");
  var frameComputed = frame && typeof window !== "undefined" && typeof window.getComputedStyle === "function"
    ? window.getComputedStyle(frame)
    : null;
  var computed = char && typeof window !== "undefined" && typeof window.getComputedStyle === "function"
    ? window.getComputedStyle(char)
    : null;
  var options = normalizeCharacterFocusOptions(
    currentCharacterVisualOptions || CHARACTER_FOCUS_DEFAULTS,
    CHARACTER_FOCUS_DEFAULTS
  );

  return {
    timeMs: Date.now(),
    perfMs: typeof performance !== "undefined" && performance.now ? roundCharacterDebugNumber(performance.now()) : null,
    sceneId: typeof state !== "undefined" && state ? state.sceneId : null,
    actionIndex: typeof state !== "undefined" && state ? state.actionIndex : null,
    currentSceneId: typeof currentSceneId !== "undefined" ? currentSceneId : null,
    charSeq: typeof __charSeq !== "undefined" ? __charSeq : null,
    activeCharSeq: typeof __activeCharSeq !== "undefined" ? __activeCharSeq : null,
    focusOptions: options,
    extra: extra || {},
    viewport: {
      width: typeof window !== "undefined" ? window.innerWidth : null,
      height: typeof window !== "undefined" ? window.innerHeight : null
    },
    novelWindow: elNovelWindow ? {
      clientWidth: elNovelWindow.clientWidth,
      clientHeight: elNovelWindow.clientHeight,
      rect: getCharacterDebugRect(elNovelWindow)
    } : null,
    frame: frame ? {
      hidden: frame.classList.contains("hidden"),
      rect: getCharacterDebugRect(frame),
      inlineStyle: {
        left: frame.style.left,
        top: frame.style.top,
        right: frame.style.right,
        bottom: frame.style.bottom,
        width: frame.style.width,
        height: frame.style.height,
        transform: frame.style.transform,
        overflow: frame.style.overflow
      },
      computedStyle: frameComputed ? {
        left: frameComputed.left,
        top: frameComputed.top,
        right: frameComputed.right,
        bottom: frameComputed.bottom,
        width: frameComputed.width,
        height: frameComputed.height,
        transform: frameComputed.transform,
        overflow: frameComputed.overflow,
        display: frameComputed.display,
        opacity: frameComputed.opacity
      } : null
    } : null,
    char: char ? {
      hidden: char.classList.contains("hidden"),
      complete: !!char.complete,
      naturalWidth: char.naturalWidth || 0,
      naturalHeight: char.naturalHeight || 0,
      offsetWidth: char.offsetWidth,
      offsetHeight: char.offsetHeight,
      datasetCharId: char.dataset ? char.dataset.charId || "" : "",
      attrSrc: char.getAttribute("src") || "",
      currentSrc: char.currentSrc || char.src || "",
      rect: getCharacterDebugRect(char),
      inlineStyle: {
        left: char.style.left,
        top: char.style.top,
        right: char.style.right,
        bottom: char.style.bottom,
        width: char.style.width,
        height: char.style.height,
        maxHeight: char.style.maxHeight,
        transform: char.style.transform
      },
      computedStyle: computed ? {
        left: computed.left,
        top: computed.top,
        right: computed.right,
        bottom: computed.bottom,
        width: computed.width,
        height: computed.height,
        maxHeight: computed.maxHeight,
        transform: computed.transform,
        display: computed.display,
        opacity: computed.opacity
      } : null
    } : null
  };
}

// Единый лог персонажа: фильтруй консоль по "[CHAR DEBUG]" и присылай блоки вокруг неверного кадра.
function logCharacterFocusDebug(label, extra) {
  if (typeof window !== "undefined" && window.VN_CHAR_DEBUG === false) return;
  console.log("[CHAR DEBUG] " + label, getCharacterDebugSnapshot(extra));
}

// Плоская строка нужна для копирования из консоли без раскрытия вложенных объектов Chrome.
function logCharacterFrameLine(label, values) {
  if (typeof window !== "undefined" && window.VN_CHAR_DEBUG === false) return;
  var data = values || {};
  var parts = [];
  Object.keys(data).forEach(function(key) {
    var value = data[key];
    if (typeof value === "number" && isFinite(value)) {
      value = roundCharacterDebugNumber(value);
    }
    parts.push(key + "=" + value);
  });
  console.log("[CHAR FRAME] " + label + " " + parts.join(" "));
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

// Возвращает режим истории из [meta] с дефолтом debug.
function getStoryMode() {
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

// Переводит локальный quality и настройку истории в фактический вариант JS-пакета для загрузки.
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

var VISUAL_TRACE_ENABLED = true;

function visualTraceMediaState(el) {
  // Собирает только диагностическое состояние слоя, не меняя DOM и порядок отрисовки.
  if (!el) return null;

  var isMedia = typeof el.currentTime === "number";
  return {
    id: el.id || "",
    hidden: el.classList ? el.classList.contains("hidden") : null,
    display: window.getComputedStyle ? window.getComputedStyle(el).display : "",
    src: normalizeAssetUrl(el.currentSrc || el.src || ""),
    currentTime: isMedia ? Number(el.currentTime.toFixed(3)) : null,
    readyState: isMedia ? el.readyState : null,
    paused: isMedia ? el.paused : null
  };
}

function visualTrace(label, data) {
  // Диагностический лог порядка показа слоев; после отладки можно выключить VISUAL_TRACE_ENABLED.
  if (!VISUAL_TRACE_ENABLED) return;

  var now = (window.performance && typeof window.performance.now === "function")
    ? window.performance.now()
    : Date.now();

  console.log("[VISUAL TRACE]", now.toFixed(1) + "ms", label, {
    sceneId: state && state.sceneId,
    actionIndex: state && state.actionIndex,
    extra: data || null,
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
  return escapeHtml(pick);
}

// Чтобы музыка не включалась слишком громко при старте
audio.bgm.loop = true;

audio.bgm.addEventListener('play', function () {
  console.log('[AUDIO EVENT] bgm play');
  logAudioState('event: play');
});

audio.bgm.addEventListener('pause', function () {
  console.log('[AUDIO EVENT] bgm pause');
  logAudioState('event: pause');
});

audio.bgm.addEventListener('ended', function () {
  console.log('[AUDIO EVENT] bgm ended');
  logAudioState('event: ended');
});

audio.bgm.addEventListener('error', function () {
  var badSrc = normalizeAssetUrl(audio.bgm.currentSrc || audio.bgm.src || "");

  console.log('[AUDIO EVENT] bgm error', audio.bgm.error, badSrc);
  logAudioState('event: error');

  if (badSrc) {
    failedAssets.audio[badSrc] = true;
  }

  try {
    audio.bgm.pause();
    audio.bgm.removeAttribute('src');
    audio.bgm.load();
  } catch (e) {}
});

audio.bgm.addEventListener('canplay', function () {
  console.log('[AUDIO EVENT] bgm canplay');
  logAudioState('event: canplay');
});


setAudioFromStoryDefaults();
profiler.mark('Audio is set up');

applyUiScale();
window.addEventListener("resize", applyUiScale);
window.addEventListener("resize", updateBackgroundScrollAvailability);
window.addEventListener("resize", resizeBg360Renderer);

window.addEventListener("pagehide", function () {
  autosaveDebugLog("lifecycle:pagehide", {
    sceneId: state && state.sceneId,
    actionIndex: state && state.actionIndex,
    inGame: state && state.inGame,
    waitingNext: state && state.waitingNext,
    nextLocked: state && state.nextLocked
  });
  if (vnAutosaveTimer) {
    clearTimeout(vnAutosaveTimer);
    vnAutosaveTimer = null;
  }
  flushAutosaveToStorageSync();
});
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") {
    autosaveDebugLog("lifecycle:visibilityhidden", {
      sceneId: state && state.sceneId,
      actionIndex: state && state.actionIndex
    });
    if (vnAutosaveTimer) {
      clearTimeout(vnAutosaveTimer);
      vnAutosaveTimer = null;
    }
    flushAutosaveToStorageSync();
  }
});
window.addEventListener("beforeunload", function () {
  autosaveDebugLog("lifecycle:beforeunload", {
    sceneId: state && state.sceneId,
    actionIndex: state && state.actionIndex
  });
  if (vnAutosaveTimer) {
    clearTimeout(vnAutosaveTimer);
    vnAutosaveTimer = null;
  }
  flushAutosaveToStorageSync();
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

  console.log("[LOG] dialog pointerup", {
    targetId: e.target && e.target.id,
    modalHidden: elGameModal.classList.contains("hidden"),
    inGame: state.inGame,
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked
  });

  console.log(
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
    console.log("[VN] двойной клик проигнорирован");
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

btnMute.addEventListener("click", function () {
  var wasMuted = audio.muted;

  console.log('[AUDIO] btnMute click before toggle');
  logAudioState('btnMute before toggle');

  audio.muted = !audio.muted;

  applyAudioSettings();
  updateMuteIcon();

  console.log('[AUDIO] btnMute click after toggle');
  logAudioState('btnMute after toggle');

  if (wasMuted && !audio.muted) {
    resumeBgmIfNeeded('btnMute unmute');
    // После явного анмута пользователем пробуем запустить и фоновое видео со звуком.
    resumeBackgroundVideoIfNeeded('btnMute unmute');
  }
});

sliderVolume.addEventListener("input", function () {
  var v = parseInt(sliderVolume.value, 10);
  if (isNaN(v)) v = 20;

  console.log('[AUDIO] slider input raw value =', sliderVolume.value);

  audio.masterVolume = clamp(v / 100, 0, 1);
  applyAudioSettings();

  logAudioState('slider after apply');

  if (!audio.muted && audio.masterVolume > 0) {
    resumeBgmIfNeeded('slider input');
    // Слайдер громкости — тоже пользовательское действие: используем его для возобновления видео-аудио.
    resumeBackgroundVideoIfNeeded('slider input');
  }
});

btnCloseGame.addEventListener("pointerup", function (e) {
  console.log("[LOG] close pointerup", {
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
    console.log("[LOG] after restartStandaloneGameFromUrl", {
      inGame: state.inGame,
      modalHidden: elGameModal.classList.contains("hidden"),
      waitingNext: state.waitingNext,
      nextLocked: state.nextLocked
    });
    return;
  }

  closeGame({ manualClose: true, result: 0 });

  console.log("[LOG] after closeGame", {
    inGame: state.inGame,
    modalHidden: elGameModal.classList.contains("hidden"),
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked
  });
});

btnCloseGame.addEventListener("click", function (e) {
  swallowEvent(e);
});

btnCloseStatsGame.addEventListener("pointerup", function (e) {
  swallowEvent(e);
  lastNextTime = Date.now();
  closeGame({ manualClose: true, result: 0 });
});

btnCloseStatsGame.addEventListener("click", function (e) {
  swallowEvent(e);
});

// Слушаем результаты мини-игр через postMessage
window.addEventListener("message", function (event) {
  // В офлайн-режиме origin может быть "null".
  // Поэтому здесь делаем проверку максимально простую:
  // ждём объект с type === 'gameResult'
  if (!event || !event.data) return;
  var data = event.data;
  if (data.type === "gameResult") {
    closeGame(data);
  }
});

// ---------- Старт ----------
startLicensedEngine();

// =========================================================
//                   ОСНОВНЫЕ ФУНКЦИИ
// =========================================================

// ---------- Автосейв (localStorage, стандартный или именованный novel-слот) ----------
// Состояние сценария живёт в памяти движка; в localStorage пишем с дебаунсом (редко перезаписываем диск),
// плюс сразу при pagehide, входе в game/video и после продолжения сюжета из игры/сюжетного видео.
var VN_AUTOSAVE_STORAGE_KEY = "vn_engine_autosave_v1";
// Версия поднята после смены модели позиционирования персонажей:
// старые autosave-слоты могли восстановить прежний pos/focus и снова сдвинуть персонажа.
var VN_AUTOSAVE_PAYLOAD_VERSION = 3;
var VN_AUTOSAVE_DEBOUNCE_MS = 2000;
var vnAutosaveTimer = null;
var vnAutosaveBgScrollRestorePending = null;
var vnAutosaveStory360RestorePending = null;
// Активная 360-команда нужна автосейву, чтобы отличать обычный шаг сцены от временного шага из menu/if.
var vnAutosaveActive360Action = null;
// Последний успешно показанный фон/видео для восстановления «унаследованного» визуала
// в сценах, где нет собственного bg (например, menu/text после перехода).
var vnAutosaveLastVisualSnapshot = null;

// Снимает отложенную запись, чтобы после ручного сброса старый таймер не вернул прежний слот.
function cancelPendingAutosaveTimer(reason) {
  if (!vnAutosaveTimer) return;
  clearTimeout(vnAutosaveTimer);
  vnAutosaveTimer = null;
  autosaveDebugLog("debounce:cancelled", { reason: reason || "" });
}

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

// Выбирает стандартный ключ или отдельный ключ новеллы, не меняя совместимость старого запуска без параметров.
function getAutosaveStorageKey() {
  var novelSaveId = getActiveNovelSaveId();
  if (!novelSaveId) return VN_AUTOSAVE_STORAGE_KEY;
  return VN_AUTOSAVE_STORAGE_KEY + ":novel:" + encodeURIComponent(novelSaveId);
}

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

/** То же правило для сериализации: не записываем в слот блокировку без ожидания клика при незаконченной сцене. */
function normalizeVNInteractionFlagsForPersist(scene, runtimeActionIndex, waitingNext, nextLocked) {
  var wn = !!waitingNext;
  var nl = !!nextLocked;
  if (
    scene &&
    Array.isArray(scene.actions) &&
    typeof runtimeActionIndex === "number" &&
    runtimeActionIndex >= 0 &&
    runtimeActionIndex < scene.actions.length &&
    !wn &&
    nl
  ) {
    nl = false;
  }
  return { waitingNext: wn, nextLocked: nl };
}

function computeStoryTextFingerprint() {
  var text = typeof window.STORY_TEXT === "string" ? window.STORY_TEXT : "";
  var len = text.length;
  var hash = 5381;
  for (var i = 0; i < len; i++) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i);
    hash = hash | 0;
  }
  return {
    hashUnsigned: hash >>> 0,
    hashHex: (hash >>> 0).toString(16),
    textLength: len
  };
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
  if (bg360Runtime.sourceSrc && /-360-mobile\.js(\?.*)?$/i.test(bg360Runtime.sourceSrc)) q = "mobile";
  else if (bg360Runtime.sourceSrc && /-360\.js(\?.*)?$/i.test(bg360Runtime.sourceSrc)) q = "normal";

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

// Возвращает слот персонажа из runtime-состояния; inline left теперь хранит px и не подходит для автосейва.
function inferCharPositionForAutosave(el) {
  if (currentCharacterVisualOptions && currentCharacterVisualOptions.pos) {
    return normalizeCharacterPosition(currentCharacterVisualOptions.pos);
  }
  if (!el || !el.style) return "center";
  var left = String(el.style.left || "").trim();
  if (left.indexOf("35") !== -1) return "left";
  if (left.indexOf("65") !== -1) return "right";
  return "center";
}

// Снимок видимого персонажа для автосейва (один слой elChar).
function captureCharacterSnapshotForAutosave() {
  if (!elChar) return { hidden: true };
  if (elChar.classList.contains("hidden")) return { hidden: true };
  var srcRaw = elChar.currentSrc || elChar.src || "";
  if (!String(srcRaw).trim()) return { hidden: true };
  return {
    hidden: false,
    src: normalizeAssetUrl(srcRaw),
    charId: elChar.dataset && elChar.dataset.charId ? String(elChar.dataset.charId) : "",
    pos: inferCharPositionForAutosave(elChar),
    focusX: currentCharacterVisualOptions && typeof currentCharacterVisualOptions.focusX === "number" ? currentCharacterVisualOptions.focusX : 0.5,
    focusY: currentCharacterVisualOptions && typeof currentCharacterVisualOptions.focusY === "number" ? currentCharacterVisualOptions.focusY : 0.5,
    scale: currentCharacterVisualOptions && typeof currentCharacterVisualOptions.scale === "number" ? currentCharacterVisualOptions.scale : 1
  };
}

// Показывает или скрывает персонажа после восстановления автосейва (до runCurrent).
function applyAutosaveCharacterSnapshot(ch) {
  logCharacterFocusDebug("autosave:applyCharacterSnapshot:start", {
    snapshot: ch
  });
  if (!ch || typeof ch !== "object") return;
  if (ch.hidden) {
    hideAllCharacters();
    logCharacterFocusDebug("autosave:applyCharacterSnapshot:hidden", {
      snapshot: ch
    });
    return;
  }
  var src = typeof ch.src === "string" ? ch.src.trim() : "";
  if (!src) {
    hideAllCharacters();
    logCharacterFocusDebug("autosave:applyCharacterSnapshot:noSrc", {
      snapshot: ch
    });
    return;
  }
  var pos = ch.pos === "left" || ch.pos === "right" || ch.pos === "center" ? ch.pos : "center";
  var cid = typeof ch.charId === "string" && ch.charId ? ch.charId : null;
  logCharacterFocusDebug("autosave:applyCharacterSnapshot:setCharacter", {
    snapshot: ch,
    normalizedPos: pos,
    charId: cid
  });
  setCharacter(src, pos, cid, null, {
    pos: pos,
    focusX: typeof ch.focusX === "number" ? ch.focusX : 0.5,
    focusY: typeof ch.focusY === "number" ? ch.focusY : 0.5,
    scale: typeof ch.scale === "number" ? ch.scale : 1
  });
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

// Восстанавливает BGM без принудительного включения звука: если UI в mute, трек только подготавливается.
function applyAutosaveBgmSnapshot(bgmSnap) {
  if (!audio || !audio.bgm) return false;
  if (!bgmSnap || typeof bgmSnap !== "object" || !bgmSnap.src) {
    stopBgmImmediate();
    return false;
  }

  var src = normalizeAssetUrl(bgmSnap.src);
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
          try { audio.bgm.currentTime = resumeAt; } catch (e) {}
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
  var charSnap = captureCharacterSnapshotForAutosave();
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

  var flagsForDisk = normalizeVNInteractionFlagsForPersist(
    scene,
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
    optsPersistOverride: typeof opts.persistActionIndex === "number",
    stack: autosaveDebugShortStack()
  });

  return {
    v: VN_AUTOSAVE_PAYLOAD_VERSION,
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

// Проверяет структуру, отпечаток сценария и принадлежность payload текущему стандартному или novel-слоту.
function validateAutosavePayload(data) {
  if (!data || data.v !== VN_AUTOSAVE_PAYLOAD_VERSION) return false;
  var activeNovelSaveId = getActiveNovelSaveId();
  if (activeNovelSaveId && String(data.novelId || "") !== activeNovelSaveId) return false;
  if (!activeNovelSaveId && data.novelId) return false;
  // Слоты, сохранённые до переименования focus → focusX в bgScroll, отклоняем (сброс через tryApplyAutosave).
  if (
    data.bgScroll &&
    typeof data.bgScroll === "object" &&
    Object.prototype.hasOwnProperty.call(data.bgScroll, "focus")
  ) {
    autosaveDebugLog("restore:reject_legacy_bgScroll_focus", {});
    return false;
  }
  if (isStoryLoadsafeEnabled()) {
    var fp = computeStoryTextFingerprint();
    if (String(data.hashHex || "") !== fp.hashHex) return false;
    if (Number(data.textLength) !== fp.textLength) return false;
  } else {
    // В dev-режиме engine.loadsafe=false пропускает только проверку fingerprint, но не структуру слота.
    autosaveDebugLog("restore:loadsafe_disabled_skip_fingerprint", {
      slotHashHex: data.hashHex || "",
      slotTextLength: data.textLength || 0
    });
  }
  if (!data.sceneId) return false;
  var scene = state.sceneMap[data.sceneId];
  if (!scene || !Array.isArray(scene.actions)) return false;
  var idx = parseInt(data.actionIndex, 10);
  if (!isFinite(idx) || idx < 0 || idx > scene.actions.length) return false;
  return true;
}

/**
 * Немедленно пишет автосейв в выбранный стандартный или novel-слот.
 * Если передан готовый payload (например точка входа в game/video), записывает его как есть.
 */
function flushAutosaveToStorageSync(prebuiltPayload) {
  if (!STORY || !isStoryAutosaveEnabled()) {
    autosaveDebugLog("flush:skip", { reason: "no_story_or_disabled" });
    return;
  }
  try {
    var usesPrebuilt =
      arguments.length >= 1 && prebuiltPayload !== undefined && prebuiltPayload !== null;
    var payload = usesPrebuilt ? prebuiltPayload : buildAutosavePayload();
    if (!payload) {
      autosaveDebugLog("flush:no_payload", {
        usesPrebuilt: usesPrebuilt,
        inGame: state.inGame,
        inVideo: state.inVideo,
        sceneId: state.sceneId,
        actionIndex: state.actionIndex,
        stack: autosaveDebugShortStack()
      });
      return;
    }
    var storageKey = getAutosaveStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(payload));
    autosaveDebugLog("flush:written", {
      storageKey: storageKey,
      usesPrebuilt: usesPrebuilt,
      sceneId: payload.sceneId,
      actionIndex: payload.actionIndex,
      waitingNext: payload.waitingNext,
      nextLocked: payload.nextLocked,
      stack: autosaveDebugShortStack()
    });
  } catch (err) {
    console.warn("[AUTOSAVE] flush failed:", err);
    autosaveDebugLog("flush:error", String(err && err.message ? err.message : err));
  }
}

// Очищает только активный слот; в scene/nosave-режиме намеренно не удаляет никаких данных.
function clearAutosaveStorage() {
  cancelPendingAutosaveTimer("clear_storage");
  vnAutosaveStory360RestorePending = null;
  // Режимы scene/nosave не должны удалять даже существующий стандартный или novel-слот.
  if (isStoryUrlAutosaveStorageBlocked()) {
    autosaveDebugLog("clear:skip", { reason: "url_storage_blocked" });
    return;
  }
  try {
    var storageKey = getAutosaveStorageKey();
    localStorage.removeItem(storageKey);
    autosaveDebugLog("clear:removed", { storageKey: storageKey });
  } catch (err) {
    console.warn("[AUTOSAVE] clear failed:", err);
    autosaveDebugLog("clear:error", String(err && err.message ? err.message : err));
  }
}

/**
 * Откладывает запись автосейва: снимок всегда берётся из актуального state при срабатывании таймера,
 * чтобы не дергать localStorage на каждом шаге, но не терять прогресс при паузе > 2 с.
 */
function scheduleAutosave() {
  if (!STORY || !isStoryAutosaveEnabled()) return;
  cancelPendingAutosaveTimer("reschedule");
  vnAutosaveTimer = setTimeout(function () {
    vnAutosaveTimer = null;
    autosaveDebugLog("debounce:fired", {
      sceneId: state.sceneId,
      actionIndex: state.actionIndex,
      waitingNext: state.waitingNext,
      nextLocked: state.nextLocked
    });
    flushAutosaveToStorageSync();
  }, VN_AUTOSAVE_DEBOUNCE_MS);
  autosaveDebugLog("debounce:scheduled", { ms: VN_AUTOSAVE_DEBOUNCE_MS });
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

// Загружает только активный стандартный или novel-слот; scene-режим отсекается до обращения к localStorage.
function tryApplyAutosave() {
  function isUsableAutosaveBgSrc(src) {
    var normalized = normalizeAssetUrl(src || "");
    if (!normalized) return false;
    var currentPage = normalizeAssetUrl((window && window.location && window.location.href) ? window.location.href : "");
    if (currentPage && urlsMatchForAutosaveRestore(normalized, currentPage)) return false;
    return true;
  }

  if (!STORY || !isStoryAutosaveEnabled()) return false;
  vnAutosaveStory360RestorePending = null;
  var raw = null;
  try {
    raw = localStorage.getItem(getAutosaveStorageKey());
  } catch (err) {
    return false;
  }
  if (!raw) return false;

  var data = null;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    autosaveDebugLog("restore:parse_failed", String(err && err.message ? err.message : err));
    clearAutosaveStorage();
    return false;
  }

  if (!validateAutosavePayload(data)) {
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
    clearAutosaveStorage();
    return false;
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
    clearAutosaveStorage();
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
  closeGameFrameVisualOnly();

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
    // Для 360-пакетов (file=...-360.js) при восстановлении явно включаем 360-режим,
    // иначе setBackground пойдёт в обычный image-слой и попытается загрузить JS как картинку.
    var restoreIs360 = isBg360PackScriptPath(restoreBgSnapshot.src);
    if (!restoreIs360 && state.currentBgId) {
      try {
        var restoreBgAsset = resolveBackgroundAsset("@bg." + state.currentBgId);
        restoreIs360 = !!(restoreBgAsset && restoreBgAsset.is360);
      } catch (e) {}
    }
    if (restoreIs360) {
      mergedScroll = mergeMediaFocusOptions(mergedScroll, null, undefined, null, true);
    }
    var blurFb =
      restoreBgSnapshot && typeof restoreBgSnapshot.blurFallback === "string" ? restoreBgSnapshot.blurFallback : "";
    if (restoreIs360 && !blurFb && state.currentBgId) {
      // Для 360 без явного blurFallback пытаемся взять fallback из ассета, чтобы blur-слой
      // не получал JS-путь вида *-360.js.
      try {
        var blurAsset = resolveBackgroundAsset("@bg." + state.currentBgId);
        if (blurAsset && blurAsset.fallback && !isBg360PackScriptPath(blurAsset.fallback)) {
          blurFb = blurAsset.fallback;
        }
      } catch (e) {}
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
    applyAutosaveCharacterSnapshot(data.char);
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

  console.log("[AUTOSAVE] restored", data.sceneId, data.actionIndex);
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
  __visualTransitionSeq++;
  clearVisualTransitionClasses();

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
    clearAutosaveStorage();
  }

  setStandaloneGameModeEnabled(false);
  suppressAutoRunOnce = false;
  lastNextTime = 0;
  // На рестарте инвалидируем старые асинхронные загрузки персонажа,
  // чтобы callback из предыдущего состояния не «вернул» старый спрайт.
  __activeCharSeq++;
  state.currentGame = null;
  state.waitingNext = false;
  state.nextLocked = false;
  state.inVideo = false;
  // При рестарте временные ветки menu/if пересобираются заново из сценария, старую очередь нельзя переносить.
  state.pendingActions = [];

  hideChoices();
  reset360InteractionStateForRestart("restart");
  cleanupStoryVideoVisualOnly();
  closeGameFrameVisualOnly();
  hideOverlay();
  // Явно сбрасываем персонажа до запуска стартовой сцены.
  hideAllCharacters();

  // URL-игра обходит сюжет, scene блокирует storage через isStoryAutosaveEnabled, а novel читает только свой слот.
  if (
    !shouldRunStandaloneGame &&
    !restartOptions.clearAutosave &&
    isStoryAutosaveEnabled() &&
    tryApplyAutosave()
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
    console.log('[Engine] Обнаружены ошибки парсинга, показываем сообщение');
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
    flushAutosaveToStorageSync();
  }
}

function runCurrent() {
  try {
  console.log("[VN] runCurrent ВЫЗВАНА!", "Timestamp:", Date.now(), "ms");
  console.log(
    "[VN] runCurrent",
    "scene:", state.sceneId,
    "index:", state.actionIndex
  );

  console.log("[DEBUG] runCurrent - сцена:", state.sceneId, "индекс:", state.actionIndex);
if (state.sceneId === 'scene_02') {
  const scene = state.sceneMap[state.sceneId];
  if (scene && scene.actions) {
    console.log("[DEBUG] scene_02 actions:", scene.actions.map(a => a.type).join(', '));
    if (scene.actions[0]) console.log("[DEBUG] action 0:", scene.actions[0]);
    if (scene.actions[1]) console.log("[DEBUG] action 1:", scene.actions[1]);
    if (scene.actions[2]) console.log("[DEBUG] action 2:", scene.actions[2]);
  }
}

  console.log('[FLOW] runCurrent:start', {
    sceneId: state.sceneId,
    actionIndex: state.actionIndex,
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked,
    inGame: state.inGame
  });

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
      console.log('[VN] Достигнут конец сцены', state.sceneId);
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
      if (isVisualBatchCandidate(action)) {
        var visualBatchActions = collectVisualBatchActions(scene, actionIndexBeforeInc);
        action = {
          type: "visual_batch",
          actions: visualBatchActions
        };
        state.actionIndex += visualBatchActions.length;
      } else {
        state.actionIndex++;
      }
    }
    console.log('[FLOW] runCurrent:action picked', {
      sceneId: state.sceneId,
      actionIndexBeforeInc: actionIndexBeforeInc,
      action: action,
      waitingNext: state.waitingNext,
      nextLocked: state.nextLocked
    });

    if (!action || !action.type) continue;

    var shouldWait = executeAction(action);
    if (shouldWait === "async" && (action.type === "walk360" || action.type === "goto360")) {
      rememberActive360ActionForAutosave(action, actionFromPending, actionFromPending ? -1 : actionIndexBeforeInc, state.actionIndex);
    }

    console.log('[FLOW] runCurrent:after executeAction', {
      sceneId: state.sceneId,
      actionIndexAfterInc: state.actionIndex,
      actionType: action && action.type,
      shouldWait: shouldWait,
      waitingNext: state.waitingNext,
      nextLocked: state.nextLocked
    });

    if (shouldWait === "async") {

      console.log('[FLOW] runCurrent:enter async wait', {
        sceneId: state.sceneId,
        actionIndex: state.actionIndex,
        actionType: action && action.type,
        waitingNextBefore: state.waitingNext,
        nextLockedBefore: state.nextLocked
      });


      // Ждём внутреннего завершения действия (например, загрузки персонажа),
      // но НЕ разрешаем пользовательский клик "дальше".
      state.waitingNext = false;
      state.nextLocked = true;
      return;
    }

    if (shouldWait === true) {
      console.log('[FLOW] runCurrent:enter user wait', {
        sceneId: state.sceneId,
        actionIndex: state.actionIndex,
        actionType: action && action.type,
        waitingNextBefore: state.waitingNext,
        nextLockedBefore: state.nextLocked
      });

      // Обычное ожидание пользовательского next
      state.waitingNext = true;
      state.nextLocked = false;
      return;
    }
    
  }
  } finally {
    scheduleAutosave();
  }
}


// Добавьте в начало файла переменную
var lastNextTime = 0;
var NEXT_COOLDOWN = 300; // миллисекунд
var suppressAutoRunOnce = false;

function onNext(e) {
  console.log("[LOG] onNext enter", {
    eventType: e && e.type,
    targetId: e && e.target && e.target.id,
    modalHidden: elGameModal.classList.contains("hidden"),
    inGame: state.inGame,
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked,
    dt: Date.now() - lastNextTime
  });

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

  console.log("[VN] onNext ВЫЗВАНА!", "Timestamp:", Date.now(), "ms");
  console.trace(); // <-- Добавьте это! Покажет стек вызовов

  // Защита от двойных кликов
  var now = Date.now();
  if (now - lastNextTime < NEXT_COOLDOWN) {
    console.log("[VN] onNext проигнорирован (защита от двойного клика)");
    autosaveDebugLog("onNext:blocked", { reason: "cooldown_ms", dt: now - lastNextTime, NEXT_COOLDOWN: NEXT_COOLDOWN });
    return;
  }
  console.log('[TIMING] Время между кликами:', now - lastNextTime, 'ms');
  
  lastNextTime = now;

  console.log("[VN] onNext ВЫЗВАНА!", "Timestamp:", Date.now(), "ms");
  console.log("[VN] onNext состояние:", {
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked,
    sceneId: state.sceneId,
    actionIndex: state.actionIndex,
    choicesHidden: elChoices.classList.contains("hidden"),
    inGame: state.inGame
  });

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
    console.log('[VN] onNext ignored - not waiting for next');
    autosaveDebugLog("onNext:blocked", { reason: "not_waitingNext" });
    return;
  }

  // Конец основной сцены не всегда означает конец выполнения: menu/if/goto360 могут держать продолжение в runtime-очереди.
  var scene = state.sceneMap[state.sceneId];
  var pendingActionsLen = Array.isArray(state.pendingActions) ? state.pendingActions.length : 0;
  if (!scene || !Array.isArray(scene.actions)) {
    console.log('[VN] Текущая сцена недоступна, игнорируем клик');
    autosaveDebugLog("onNext:blocked", {
      reason: "bad_scene",
      sceneId: state.sceneId
    });
    return;
  }
  if (pendingActionsLen === 0 && state.actionIndex >= scene.actions.length) {
    console.log('[VN] Достигнут конец сценария, игнорируем клик');
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

  console.log("[VN] onNext ВЫПОЛНЯЕТСЯ, запускаем runCurrent()");

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
  if (typeof expression !== "string") {
    throw new Error("Expression must be a string");
  }

  var tokens = tokenizeSafeExpression(expression);
  var cursor = 0;

  function current() {
    return tokens[cursor];
  }

  function consume(type, value) {
    var token = current();
    if (!token || token.type !== type || (value !== undefined && token.value !== value)) {
      var actual = token ? (token.type + ":" + token.value) : "EOF";
      throw new Error("Unexpected token: " + actual);
    }
    cursor += 1;
    return token;
  }

  function match(type, value) {
    var token = current();
    if (!token || token.type !== type) return false;
    if (value !== undefined && token.value !== value) return false;
    cursor += 1;
    return true;
  }

  function parseExpression() {
    return parseLogicalOr();
  }

  function parseLogicalOr() {
    var left = parseLogicalAnd();
    while (match("operator", "||")) {
      var right = parseLogicalAnd();
      left = isTruthyValue(left) ? left : right;
    }
    return left;
  }

  function parseLogicalAnd() {
    var left = parseEquality();
    while (match("operator", "&&")) {
      var right = parseEquality();
      left = isTruthyValue(left) ? right : left;
    }
    return left;
  }

  function parseEquality() {
    var left = parseComparison();
    while (true) {
      if (match("operator", "==")) {
        var rightEq = parseComparison();
        left = left == rightEq; // eslint-disable-line eqeqeq
      } else if (match("operator", "!=")) {
        var rightNeq = parseComparison();
        left = left != rightNeq; // eslint-disable-line eqeqeq
      } else if (match("operator", "===")) {
        var rightSeq = parseComparison();
        left = left === rightSeq;
      } else if (match("operator", "!==")) {
        var rightSneq = parseComparison();
        left = left !== rightSneq;
      } else {
        break;
      }
    }
    return left;
  }

  function parseComparison() {
    var left = parseTerm();
    while (true) {
      if (match("operator", ">")) {
        left = left > parseTerm();
      } else if (match("operator", ">=")) {
        left = left >= parseTerm();
      } else if (match("operator", "<")) {
        left = left < parseTerm();
      } else if (match("operator", "<=")) {
        left = left <= parseTerm();
      } else {
        break;
      }
    }
    return left;
  }

  function parseTerm() {
    var left = parseFactor();
    while (true) {
      if (match("operator", "+")) {
        var rightAdd = parseFactor();
        if (typeof left === "string" || typeof rightAdd === "string") {
          left = String(left) + String(rightAdd);
        } else {
          left = toFiniteNumber(left, "Left side of +") + toFiniteNumber(rightAdd, "Right side of +");
        }
      } else if (match("operator", "-")) {
        left = toFiniteNumber(left, "Left side of -") - toFiniteNumber(parseFactor(), "Right side of -");
      } else {
        break;
      }
    }
    return left;
  }

  function parseFactor() {
    var left = parseUnary();
    while (true) {
      if (match("operator", "*")) {
        left = toFiniteNumber(left, "Left side of *") * toFiniteNumber(parseUnary(), "Right side of *");
      } else if (match("operator", "/")) {
        var divisor = toFiniteNumber(parseUnary(), "Right side of /");
        if (divisor === 0) throw new Error("Division by zero is not allowed");
        left = toFiniteNumber(left, "Left side of /") / divisor;
      } else if (match("operator", "%")) {
        var mod = toFiniteNumber(parseUnary(), "Right side of %");
        if (mod === 0) throw new Error("Modulo by zero is not allowed");
        left = toFiniteNumber(left, "Left side of %") % mod;
      } else {
        break;
      }
    }
    return left;
  }

  function parseUnary() {
    if (match("operator", "!")) {
      return !isTruthyValue(parseUnary());
    }
    if (match("operator", "-")) {
      return -toFiniteNumber(parseUnary(), "Unary - operand");
    }
    return parsePrimary();
  }

  function parsePrimary() {
    var token = current();
    if (!token) throw new Error("Unexpected end of expression");

    if (match("paren", "(")) {
      var inner = parseExpression();
      consume("paren", ")");
      return inner;
    }

    if (token.type === "number") {
      cursor += 1;
      return token.value;
    }

    if (token.type === "string") {
      cursor += 1;
      return token.value;
    }

    if (token.type === "identifier") {
      cursor += 1;
      return resolveSafeIdentifier(token.value, vars);
    }

    throw new Error("Unexpected token: " + token.type + ":" + token.value);
  }

  var result = parseExpression();
  consume("eof");
  return result;
}

// Разбирает строку выражения в безопасные токены и отсекает любые неподдерживаемые символы.
function tokenizeSafeExpression(expression) {
  var tokens = [];
  var i = 0;
  var source = String(expression || "");
  var operators3 = { "===": true, "!==": true };
  var operators2 = { "&&": true, "||": true, "==": true, "!=": true, ">=": true, "<=": true };
  var operators1 = { "+": true, "-": true, "*": true, "/": true, "%": true, ">": true, "<": true, "!": true };

  while (i < source.length) {
    var ch = source.charAt(i);

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    var op3 = source.substring(i, i + 3);
    if (operators3[op3]) {
      tokens.push({ type: "operator", value: op3 });
      i += 3;
      continue;
    }

    var op2 = source.substring(i, i + 2);
    if (operators2[op2]) {
      tokens.push({ type: "operator", value: op2 });
      i += 2;
      continue;
    }

    if (operators1[ch]) {
      tokens.push({ type: "operator", value: ch });
      i += 1;
      continue;
    }

    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"') {
      var quote = ch;
      var value = "";
      var escaped = false;
      i += 1;
      while (i < source.length) {
        var c = source.charAt(i);
        if (escaped) {
          if (c === "n") value += "\n";
          else if (c === "t") value += "\t";
          else if (c === "r") value += "\r";
          else value += c;
          escaped = false;
          i += 1;
          continue;
        }
        if (c === "\\") {
          escaped = true;
          i += 1;
          continue;
        }
        if (c === quote) {
          i += 1;
          break;
        }
        value += c;
        i += 1;
      }
      if (i > source.length || source.charAt(i - 1) !== quote) {
        throw new Error("Unclosed string literal");
      }
      tokens.push({ type: "string", value: value });
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(source.charAt(i + 1)))) {
      var numberStart = i;
      var hasDot = (ch === ".");
      i += 1;
      while (i < source.length) {
        var nc = source.charAt(i);
        if (/[0-9]/.test(nc)) {
          i += 1;
          continue;
        }
        if (nc === "." && !hasDot) {
          hasDot = true;
          i += 1;
          continue;
        }
        break;
      }
      var numberRaw = source.substring(numberStart, i);
      var parsed = Number(numberRaw);
      if (!isFinite(parsed)) throw new Error("Invalid number literal: " + numberRaw);
      tokens.push({ type: "number", value: parsed });
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      var idStart = i;
      i += 1;
      while (i < source.length && /[A-Za-z0-9_]/.test(source.charAt(i))) {
        i += 1;
      }
      tokens.push({ type: "identifier", value: source.substring(idStart, i) });
      continue;
    }

    throw new Error("Unsupported symbol: " + ch);
  }

  tokens.push({ type: "eof", value: "" });
  return tokens;
}

// Разрешает доступ только к безопасным литералам и переменным из vars.
function resolveSafeIdentifier(name, vars) {
  if (name === "true") return true;
  if (name === "false") return false;
  if (name === "null") return null;
  if (name === "undefined") return undefined;

  if (isUnsafeSafeExpressionIdentifier(name)) {
    throw new Error("Unsafe identifier is not allowed: " + name);
  }

  if (!vars || !Object.prototype.hasOwnProperty.call(vars, name)) {
    throw new Error("Unknown identifier: " + name);
  }
  return vars[name];
}

// Приводит значение к конечному числу и даёт понятную ошибку для неподходящих типов.
function toFiniteNumber(value, context) {
  var n = Number(value);
  if (!isFinite(n)) {
    throw new Error((context || "Value") + " must be a finite number");
  }
  return n;
}

// Отдельная функция упрощает единые правила truthy/falsy для логических операторов.
function isTruthyValue(value) {
  return !!value;
}

// Служебные литералы безопасного выражения не являются переменными сценария и не участвуют в проверке наличия vars.
function isSafeExpressionLiteralIdentifier(name) {
  return name === "true" || name === "false" || name === "null" || name === "undefined";
}

// Глобальные и прототипные имена запрещены в условиях так же, как в основном evaluator без eval.
function isUnsafeSafeExpressionIdentifier(name) {
  return (
    name === "window" ||
    name === "document" ||
    name === "globalThis" ||
    name === "this" ||
    name === "__proto__" ||
    name === "prototype" ||
    name === "constructor"
  );
}

// Проверяет грамматику безопасного выражения и собирает имена переменных без вычисления выражения.
function validateAndCollectSafeExpressionIdentifiers(expression) {
  var expr = String(expression || "").trim();
  var identifiers = {};
  if (!expr) {
    return { ok: false, identifiers: [], error: "Empty expression" };
  }

  try {
    var tokens = tokenizeSafeExpression(expr);
    var cursor = 0;

    function current() {
      return tokens[cursor];
    }

    function consume(type, value) {
      var token = current();
      if (!token || token.type !== type || (value !== undefined && token.value !== value)) {
        var actual = token ? (token.type + ":" + token.value) : "EOF";
        throw new Error("Unexpected token: " + actual);
      }
      cursor += 1;
      return token;
    }

    function match(type, value) {
      var token = current();
      if (!token || token.type !== type) return false;
      if (value !== undefined && token.value !== value) return false;
      cursor += 1;
      return true;
    }

    function parseExpression() { parseLogicalOr(); }
    function parseLogicalOr() {
      parseLogicalAnd();
      while (match("operator", "||")) parseLogicalAnd();
    }
    function parseLogicalAnd() {
      parseEquality();
      while (match("operator", "&&")) parseEquality();
    }
    function parseEquality() {
      parseComparison();
      while (true) {
        if (match("operator", "==") || match("operator", "!=") || match("operator", "===") || match("operator", "!==")) {
          parseComparison();
        } else {
          break;
        }
      }
    }
    function parseComparison() {
      parseTerm();
      while (true) {
        if (match("operator", ">") || match("operator", ">=") || match("operator", "<") || match("operator", "<=")) {
          parseTerm();
        } else {
          break;
        }
      }
    }
    function parseTerm() {
      parseFactor();
      while (true) {
        if (match("operator", "+") || match("operator", "-")) {
          parseFactor();
        } else {
          break;
        }
      }
    }
    function parseFactor() {
      parseUnary();
      while (true) {
        if (match("operator", "*") || match("operator", "/") || match("operator", "%")) {
          parseUnary();
        } else {
          break;
        }
      }
    }
    function parseUnary() {
      if (match("operator", "!") || match("operator", "-")) {
        parseUnary();
        return;
      }
      parsePrimary();
    }
    function parsePrimary() {
      var token = current();
      if (!token) throw new Error("Unexpected end of expression");

      if (match("paren", "(")) {
        parseExpression();
        consume("paren", ")");
        return;
      }

      if (token.type === "number" || token.type === "string") {
        cursor += 1;
        return;
      }

      if (token.type === "identifier") {
        if (isUnsafeSafeExpressionIdentifier(token.value)) {
          throw new Error("Unsafe identifier is not allowed: " + token.value);
        }
        if (!isSafeExpressionLiteralIdentifier(token.value)) {
          identifiers[token.value] = true;
        }
        cursor += 1;
        return;
      }

      throw new Error("Unexpected token: " + token.type + ":" + token.value);
    }

    parseExpression();
    consume("eof");
    return { ok: true, identifiers: Object.keys(identifiers).sort(), error: "" };
  } catch (e) {
    return {
      ok: false,
      identifiers: [],
      error: e && e.message ? e.message : String(e)
    };
  }
}

// =========================================================
//                   ACTION EXECUTION
// =========================================================

// Эти действия можно собрать в один визуальный переход до ближайшей реплики/выбора.
function isVisualBatchCandidate(action) {
  return !!(action && (
    action.type === "bg" ||
    action.type === "char" ||
    action.type === "bg360marks"
  ));
}

// Забирает подряд идущие визуальные действия, чтобы фон и персонаж менялись синхронно.
function collectVisualBatchActions(scene, startIndex) {
  var actions = [];
  if (!scene || !Array.isArray(scene.actions)) return actions;
  for (var i = startIndex; i < scene.actions.length; i++) {
    var action = scene.actions[i];
    if (!isVisualBatchCandidate(action)) break;
    actions.push(action);
  }
  return actions;
}

function delayVisualTransition(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, Math.max(0, ms || 0));
  });
}

function waitVisualTransitionFrame() {
  return new Promise(function(resolve) {
    requestAnimationFrame(function() {
      requestAnimationFrame(resolve);
    });
  });
}

// Читает transition/transitionMs с учетом [meta] и локального override в команде bg.
function getVisualTransitionSettings(override) {
  var meta = STORY && STORY.meta ? STORY.meta : {};
  var modeSource = override && override.transition !== undefined && override.transition !== null
    ? override.transition
    : meta.transition;
  var rawMode = String(modeSource === undefined || modeSource === null ? "fade" : modeSource).trim().toLowerCase();
  var enabled = !(rawMode === "none" || rawMode === "instant" || rawMode === "off" || rawMode === "false" || rawMode === "0");
  var mode = rawMode === "black" || rawMode === "white" ? "cover" : "fade";
  var coverColor = rawMode === "white" ? "#fff" : "#000";
  var durationSource = override && override.transitionMs !== undefined && override.transitionMs !== null
    ? override.transitionMs
    : meta.transitionMs;
  var totalMs = typeof durationSource === "number" && isFinite(durationSource)
    ? clamp(durationSource, 0, 2000)
    : VISUAL_TRANSITION_TOTAL_MS;
  var outRatio = VISUAL_TRANSITION_OUT_MS / VISUAL_TRANSITION_TOTAL_MS;
  var outMs = Math.round(totalMs * outRatio);
  var inMs = Math.max(0, totalMs - outMs);

  return {
    enabled: enabled && totalMs > 0,
    mode: mode,
    coverColor: coverColor,
    outMs: outMs,
    inMs: inMs
  };
}

// CSS-переход берёт длительность из переменной, поэтому для fade-out и fade-in можно задавать разные части.
function setVisualTransitionDuration(ms) {
  document.documentElement.style.setProperty("--visualTransitionMs", Math.max(0, Math.round(ms || 0)) + "ms");
}

// Создаёт отдельную завесу перехода поверх сцены, не затрагивая сюжетный overlay.
function ensureVisualTransitionCover() {
  if (elVisualTransitionCover) return elVisualTransitionCover;
  if (!elNovelWindow) return null;

  var cover = document.createElement("div");
  cover.className = "visual-transition-cover hidden";
  cover.setAttribute("aria-hidden", "true");
  elNovelWindow.appendChild(cover);
  elVisualTransitionCover = cover;
  return cover;
}

function showVisualTransitionCover(color, visible) {
  var cover = ensureVisualTransitionCover();
  if (!cover) return;
  cover.style.background = color || "#000";
  cover.classList.remove("hidden");
  cover.classList.toggle("is-visible", !!visible);
}

function hideVisualTransitionCover() {
  if (!elVisualTransitionCover) return;
  elVisualTransitionCover.classList.remove("is-visible");
  elVisualTransitionCover.classList.add("hidden");
}

// Временный слой нужен только для fade обычных изображений: новый фон проявляется поверх старого.
function ensureVisualBgCrossfadeLayer() {
  if (elVisualBgCrossfade) return elVisualBgCrossfade;
  if (!elNovelWindow) return null;

  var layer = document.createElement("img");
  layer.className = "visual-bg-crossfade hidden";
  layer.alt = "";
  layer.draggable = false;
  layer.setAttribute("aria-hidden", "true");
  elNovelWindow.appendChild(layer);
  elVisualBgCrossfade = layer;
  return layer;
}

function hideVisualBgCrossfadeLayer() {
  if (!elVisualBgCrossfade) return;
  elVisualBgCrossfade.classList.remove("is-visible");
  elVisualBgCrossfade.classList.add("hidden");
  elVisualBgCrossfade.removeAttribute("src");
}

// Видео-crossfade использует отдельный немой video-слой, чтобы старый bgVideo не терял кадр до проявления нового.
function ensureVisualBgVideoCrossfadeLayer() {
  if (elVisualBgVideoCrossfade) return elVisualBgVideoCrossfade;
  if (!elNovelWindow) return null;

  var layer = document.createElement("video");
  layer.className = "visual-bg-crossfade hidden";
  layer.muted = true;
  layer.defaultMuted = true;
  layer.loop = true;
  layer.preload = "auto";
  if ("playsInline" in layer) layer.playsInline = true;
  layer.setAttribute("playsinline", "");
  layer.setAttribute("aria-hidden", "true");
  elNovelWindow.appendChild(layer);
  elVisualBgVideoCrossfade = layer;
  return layer;
}

function hideVisualBgVideoCrossfadeLayer() {
  if (!elVisualBgVideoCrossfade) return;
  elVisualBgVideoCrossfade.classList.remove("is-visible");
  elVisualBgVideoCrossfade.classList.add("hidden");
  try {
    elVisualBgVideoCrossfade.pause();
  } catch (e) {}
  elVisualBgVideoCrossfade.removeAttribute("src");
  try {
    elVisualBgVideoCrossfade.load();
  } catch (e2) {}
}

// Размытый фон имеет отдельный DOM-слой, поэтому для него нужен свой временный overlay.
function ensureVisualBlurBgCrossfadeLayer() {
  if (elVisualBlurBgCrossfade) return elVisualBlurBgCrossfade;
  if (!elBlurBgLayer) return null;

  var layer = document.createElement("img");
  layer.className = "blur-bg-image blur-bg-crossfade hidden";
  layer.alt = "";
  layer.draggable = false;
  layer.setAttribute("aria-hidden", "true");
  elBlurBgLayer.appendChild(layer);
  elVisualBlurBgCrossfade = layer;
  return layer;
}

function hideVisualBlurBgCrossfadeLayer() {
  if (!elVisualBlurBgCrossfade) return;
  elVisualBlurBgCrossfade.classList.remove("is-visible");
  elVisualBlurBgCrossfade.classList.add("hidden");
  elVisualBlurBgCrossfade.removeAttribute("src");
}

// Размытый video-overlay показывает первый кадр нового ролика под тем же blur-фильтром.
function ensureVisualBlurBgVideoCrossfadeLayer() {
  if (elVisualBlurBgVideoCrossfade) return elVisualBlurBgVideoCrossfade;
  if (!elBlurBgLayer) return null;

  var layer = document.createElement("video");
  layer.className = "blur-bg-video blur-bg-crossfade hidden";
  layer.muted = true;
  layer.defaultMuted = true;
  layer.loop = false;
  layer.autoplay = false;
  layer.preload = "auto";
  if ("playsInline" in layer) layer.playsInline = true;
  layer.setAttribute("playsinline", "");
  layer.setAttribute("aria-hidden", "true");
  elBlurBgLayer.appendChild(layer);
  elVisualBlurBgVideoCrossfade = layer;
  return layer;
}

function hideVisualBlurBgVideoCrossfadeLayer() {
  if (!elVisualBlurBgVideoCrossfade) return;
  elVisualBlurBgVideoCrossfade.classList.remove("is-visible");
  elVisualBlurBgVideoCrossfade.classList.add("hidden");
  try {
    elVisualBlurBgVideoCrossfade.pause();
  } catch (e) {}
  elVisualBlurBgVideoCrossfade.removeAttribute("src");
  try {
    elVisualBlurBgVideoCrossfade.load();
  } catch (e2) {}
}

// Загружает картинку до старта fade-out, чтобы после исчезновения старого кадра не было пустой паузы.
function preloadImageForVisualTransition(src) {
  var storyPath = String(src || "").trim();
  if (!storyPath) return Promise.resolve(false);
  if (areAllImageCandidatesFailed(storyPath)) return Promise.resolve(false);

  return new Promise(function(resolve) {
    loadRasterImageResource(storyPath, {
      onLoad: function() {
        resolve(true);
      },
      onError: function() {
        resolve(false);
      }
    });
  });
}

function setVisualTransitionTransparent(el, transparent) {
  if (!el) return;
  el.classList.toggle("visual-transition-transparent", !!transparent);
}

function clearVisualTransitionClasses() {
  [elBg, elBgVideo, elBg360, elChar].forEach(function(el) {
    setVisualTransitionTransparent(el, false);
  });
  hideVisualTransitionCover();
  hideVisualBgCrossfadeLayer();
  hideVisualBgVideoCrossfadeLayer();
  hideVisualBlurBgCrossfadeLayer();
  hideVisualBlurBgVideoCrossfadeLayer();
}

function isElementVisibleForVisualTransition(el) {
  return !!(el && !el.classList.contains("hidden"));
}

function getVisibleBackgroundTransitionElements() {
  return [elBg, elBgVideo, elBg360].filter(function(el) {
    return isElementVisibleForVisualTransition(el);
  });
}

function getPreparedBackgroundTargetElement(preparedBg) {
  if (!preparedBg || !preparedBg.file) return null;
  if (preparedBg.mediaOptions && preparedBg.mediaOptions.is360 === true) return elBg360;
  if (isVideoAssetPath(preparedBg.file)) return elBgVideo;
  return elBg;
}

// Crossfade безопасен для обычных фоновых media; 360 остаётся на отдельной схеме рендера.
function canCrossfadePreparedBackground(preparedBg) {
  return !!(
    preparedBg &&
    preparedBg.changesVisual &&
    preparedBg.file &&
    !(preparedBg.mediaOptions && preparedBg.mediaOptions.is360 === true)
  );
}

function getCharacterSlotRatio(pos) {
  var normalizedPos = normalizeCharacterPosition(pos);
  if (normalizedPos === "left") return 0.35;
  if (normalizedPos === "right") return 0.65;
  return 0.5;
}

// Применяет только слот персонажа; итоговые px-координаты пересчитываются общей функцией focus/scale.
function applyCharacterVisualPosition(pos) {
  currentCharacterVisualOptions = normalizeCharacterFocusOptions(
    { pos: pos },
    currentCharacterVisualOptions
  );
  logCharacterFocusDebug("applyVisualPosition", {
    inputPos: pos,
    normalizedOptions: currentCharacterVisualOptions
  });
  adjustCharacterScale("applyVisualPosition");
}

// Применяет focusX/focusY/scale и сохраняет нормализованное состояние для автосейва и resize.
function applyCharacterFocusOptions(options, reason) {
  var beforeOptions = currentCharacterVisualOptions;
  currentCharacterVisualOptions = normalizeCharacterFocusOptions(
    options || {},
    currentCharacterVisualOptions || CHARACTER_FOCUS_DEFAULTS
  );
  logCharacterFocusDebug("applyFocusOptions", {
    reason: reason || "",
    inputOptions: options || {},
    beforeOptions: beforeOptions,
    normalizedOptions: currentCharacterVisualOptions
  });
  adjustCharacterScale(reason || "applyFocusOptions");
}

// Сбрасывает inline-позиционирование персонажа при hide, чтобы старые px-координаты не мигали при следующей загрузке.
function resetCharacterVisualLayout(reason) {
  currentCharacterVisualOptions = normalizeCharacterFocusOptions(CHARACTER_FOCUS_DEFAULTS, CHARACTER_FOCUS_DEFAULTS);
  if (elCharFrame) {
    elCharFrame.classList.add("hidden");
    elCharFrame.style.left = "50%";
    elCharFrame.style.top = "";
    elCharFrame.style.bottom = "0";
    elCharFrame.style.width = "0px";
    elCharFrame.style.height = "0px";
    elCharFrame.style.transform = "translateX(-50%)";
    elCharFrame.style.overflow = "visible";
  }
  if (!elChar) return;
  elChar.classList.add("hidden");
  elChar.style.left = "0";
  elChar.style.top = "0";
  elChar.style.bottom = "auto";
  elChar.style.width = "100%";
  elChar.style.height = "0px";
  elChar.style.maxHeight = "none";
  elChar.style.transform = "";
  logCharacterFocusDebug("resetLayout", { reason: reason || "" });
}

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

// Готовит финальное состояние персонажа: show с картинкой, hide all или пропуск, если ассет не найден.
function prepareCharacterVisualAction(action) {
  if (!action) return null;

  if ((!action.charId || action.charId === null) && action.src === null) {
    return {
      kind: "hide",
      changesVisual: isElementVisibleForVisualTransition(elChar)
    };
  }

  if (!action.charId) {
    return {
      kind: "hide",
      changesVisual: isElementVisibleForVisualTransition(elChar)
    };
  }

  var charAssetInfo = resolveCharacterAssetInfo(action.charId, action.emotion);
  var src = charAssetInfo.file;
  if (!src) {
    console.log('[VISUAL BATCH] char skipped: image not found', action);
    return { kind: "skip", changesVisual: false };
  }

  if (areAllImageCandidatesFailed(src)) {
    console.log('[VISUAL BATCH] char skipped: image marked failed', src);
    return { kind: "skip", changesVisual: false };
  }

  var normalizedSrc = normalizeAssetUrl(src);
  var currentSrc = normalizeAssetUrl(elChar ? (elChar.getAttribute("src") || elChar.currentSrc || elChar.src || "") : "");
  var currentCharId = elChar && elChar.dataset ? elChar.dataset.charId : "";
  var hidden = !isElementVisibleForVisualTransition(elChar);
  var focusOptions = mergeCharacterFocusOptions(charAssetInfo.focusOptions, action);
  var normalizedFocusOptions = normalizeCharacterFocusOptions(focusOptions, CHARACTER_FOCUS_DEFAULTS);
  var changesVisual =
    hidden ||
    !currentSrc ||
    !imageUrlMatchesStoryCandidates(currentSrc, src) ||
    currentCharId !== action.charId ||
    !areCharacterFocusOptionsEqual(normalizedFocusOptions, currentCharacterVisualOptions);

  logCharacterFocusDebug("prepareVisualAction", {
    action: action,
    resolvedSrc: src,
    assetFocusOptions: charAssetInfo.focusOptions,
    actionFocusOptions: focusOptions,
    normalizedFocusOptions: normalizedFocusOptions,
    currentSrc: currentSrc,
    currentCharId: currentCharId,
    hidden: hidden,
    changesVisual: changesVisual
  });

  return {
    kind: "show",
    src: src,
    normalizedSrc: normalizedSrc,
    pos: action.pos,
    charId: action.charId,
    focusOptions: normalizedFocusOptions,
    changesVisual: changesVisual
  };
}

// Из набора подряд идущих визуальных команд оставляет финальный фон, финального персонажа и все метки 360.
function buildVisualBatchPlan(actions) {
  var plan = {
    bg: null,
    char: null,
    marks: []
  };

  actions.forEach(function(action) {
    if (!action) return;
    if (action.type === "bg") {
      plan.bg = prepareBackgroundVisualAction(action);
    } else if (action.type === "char") {
      plan.char = prepareCharacterVisualAction(action);
    } else if (action.type === "bg360marks") {
      plan.marks.push(action);
    }
  });

  return plan;
}

function preloadVisualBatchPlan(plan) {
  var waits = [];
  if (plan && plan.bg && plan.bg.file && !isVideoAssetPath(plan.bg.file)) {
    waits.push(preloadImageForVisualTransition(plan.bg.file));
  }
  if (plan && plan.char && plan.char.kind === "show" && plan.char.changesVisual) {
    waits.push(preloadImageForVisualTransition(plan.char.normalizedSrc));
  }
  return Promise.all(waits);
}

function planHasVisualTransition(plan) {
  return !!(plan && (
    (plan.bg && plan.bg.changesVisual) ||
    (plan.char && plan.char.changesVisual)
  ));
}

function getVisualBatchFadeOutElements(plan) {
  var elements = [];
  if (plan && plan.bg && plan.bg.changesVisual && !canCrossfadePreparedBackground(plan.bg)) {
    elements = elements.concat(getVisibleBackgroundTransitionElements());
  }
  if (plan && plan.char && plan.char.changesVisual && isElementVisibleForVisualTransition(elChar)) {
    elements.push(elChar);
  }
  return elements;
}

function getVisualBatchFadeInElements(plan) {
  var elements = [];
  if (plan && plan.bg && plan.bg.changesVisual && !canCrossfadePreparedBackground(plan.bg)) {
    var bgTarget = getPreparedBackgroundTargetElement(plan.bg);
    if (bgTarget) elements.push(bgTarget);
  }
  if (plan && plan.char && plan.char.kind === "show" && plan.char.changesVisual && elChar) {
    elements.push(elChar);
  }
  return elements;
}

function applyPreparedBackgroundVisualState(preparedBg) {
  if (!preparedBg) return;
  setBackground(preparedBg.file, preparedBg.fallback, preparedBg.volume, preparedBg.mediaOptions);
}

function applyPreparedCharacterVisualState(preparedChar) {
  if (!preparedChar || !elChar) return;

  logCharacterFocusDebug("visualBatch:apply:start", {
    preparedChar: preparedChar
  });

  __activeCharSeq++;
  elChar.onload = null;
  elChar.onerror = null;

  if (preparedChar.kind === "hide") {
    elChar.classList.add("hidden");
    elChar.src = "";
    elChar.removeAttribute("data-char-id");
    resetCharacterVisualLayout("visualBatch:hide");
    return;
  }

  if (preparedChar.kind !== "show") return;
  if (areAllImageCandidatesFailed(preparedChar.src)) return;

  applyCharacterFocusOptions(
    mergeCharacterFocusOptions({ pos: preparedChar.pos }, preparedChar.focusOptions),
    "visualBatch:applyFocus"
  );
  if (preparedChar.charId) {
    elChar.dataset.charId = preparedChar.charId;
  }
  elChar.style.maxHeight = "none";
  assignRasterImageToElement(elChar, preparedChar.src, {
    onLoad: function(loadedUrl) {
      logCharacterFocusDebug("visualBatch:onLoad", {
        preparedChar: preparedChar,
        loadedUrl: loadedUrl
      });
      // Финальный пересчет после фактической загрузки нужен, если первый RAF сработал раньше natural-размеров.
      adjustCharacterScale("visualBatch:onLoad");
      requestAnimationFrame(function() {
        adjustCharacterScale("visualBatch:onLoad:raf");
      });
    },
    onAllFailed: function(failedSrc) {
      logCharacterFocusDebug("visualBatch:onAllFailed", {
        preparedChar: preparedChar,
        failedSrc: failedSrc
      });
    }
  });
  if (elCharFrame) {
    elCharFrame.classList.remove("hidden");
  }
  elChar.classList.remove("hidden");
  logCharacterFocusDebug("visualBatch:afterSrcVisible", {
    preparedChar: preparedChar
  });
  adjustCharacterScale("visualBatch:afterSrcVisible");
  requestAnimationFrame(function() {
    adjustCharacterScale("visualBatch:raf");
  });
}

function applyVisualBatchPlan(plan) {
  if (!plan) return;
  applyPreparedBackgroundVisualState(plan.bg);
  plan.marks.forEach(function(action) {
    applyBg360Marks(action);
  });
  applyPreparedCharacterVisualState(plan.char);
}

// Применяет батч без фона: фон для crossfade фиксируется после проявления временного слоя.
function applyVisualBatchPlanWithoutBackground(plan) {
  if (!plan) return;
  plan.marks.forEach(function(action) {
    applyBg360Marks(action);
  });
  applyPreparedCharacterVisualState(plan.char);
}

function copyBackgroundCrossfadePosition(layer) {
  var source = null;
  if (elBgVideo && !elBgVideo.classList.contains("hidden")) {
    source = elBgVideo;
  } else if (elBg && !elBg.classList.contains("hidden")) {
    source = elBg;
  } else {
    source = elBg || elBgVideo;
  }
  if (!layer || !source) return;
  layer.style.objectFit = source.style.objectFit || "";
  layer.style.objectPosition = source.style.objectPosition || "";
  layer.style.transform = source.style.transform || "";
  layer.style.transformOrigin = source.style.transformOrigin || "";
}

// Применяет к временному overlay финальные scroll/focus/scale, чтобы после swap не было горизонтального рывка.
function applyMediaScrollOptionsToTemporaryLayer(layer, options, containerEl) {
  if (!layer) return;
  var normalized = normalizeBackgroundScrollOptions(options);
  var container = containerEl || elNovelWindow;
  var mediaScale = normalizeMediaScale(normalized.scale, 1);
  var hasTransform =
    normalized.enabled ||
    typeof normalized.focusX === "number" ||
    typeof normalized.focusY === "number" ||
    Math.abs(mediaScale - 1) > 1e-6;

  if (!hasTransform) {
    resetScrollableMediaPosition(layer);
    return;
  }

  var position = typeof normalized.focusX === "number"
    ? computeFocusedMediaPosition(layer, container, normalized.focusX, mediaScale)
    : normalizeBackgroundScrollStart(normalized.start, 0.5);
  var x = clamp(position, 0, 1) * 100;
  var yCss = "center";
  var yOrigin = "50%";
  if (typeof normalized.focusY === "number") {
    var yFrac = clamp(normalized.focusY, 0, 1);
    yCss = (yFrac * 100).toFixed(3) + "%";
    yOrigin = yCss;
  }
  layer.style.objectPosition = x.toFixed(3) + "% " + yCss;
  layer.style.transformOrigin = x.toFixed(3) + "% " + yOrigin;
  layer.style.transform = Math.abs(mediaScale - 1) > 1e-6 ? "scale(" + mediaScale + ")" : "";
}

// Дожидается размеров картинки overlay: focusX нельзя корректно посчитать до naturalWidth/naturalHeight.
function loadVisualCrossfadeImage(imageEl, src) {
  var storyPath = String(src || "").trim();
  if (!imageEl || !storyPath) return Promise.resolve(false);

  return new Promise(function(resolve) {
    var done = false;
    function finish(ok) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(!!ok);
    }

    var timer = setTimeout(function() {
      finish(!!(imageEl.naturalWidth && imageEl.naturalHeight));
    }, 5000);

    assignRasterImageToElement(imageEl, storyPath, {
      onLoad: function() {
        finish(true);
      },
      onAllFailed: function() {
        finish(false);
      }
    });
  });
}

// Загружает временный video-слой до проявления, чтобы зритель не видел пустой кадр.
function loadVisualCrossfadeVideo(videoEl, src, shouldPlay) {
  var normalizedSrc = normalizeAssetUrl(src || "");
  if (!videoEl || !normalizedSrc) return Promise.resolve(false);

  return new Promise(function(resolve) {
    var done = false;
    function finish(ok) {
      if (done) return;
      done = true;
      videoEl.onloadeddata = null;
      videoEl.onerror = null;
      clearTimeout(timer);
      resolve(!!ok);
    }

    var timer = setTimeout(function() {
      finish(false);
    }, 5000);

    videoEl.onloadeddata = function() {
      if (normalizeAssetUrl(videoEl.currentSrc || videoEl.src || "") !== normalizedSrc) return;
      if (shouldPlay) {
        var playPromise = videoEl.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(function() {});
        }
      } else {
        try {
          videoEl.pause();
          videoEl.currentTime = 0;
        } catch (e) {}
      }
      finish(true);
    };
    videoEl.onerror = function() {
      finish(false);
    };
    videoEl.src = normalizedSrc;
    try {
      videoEl.load();
    } catch (e2) {}
  });
}

// Ждёт, пока основной bgVideo примет новый src; overlay остаётся видимым и закрывает перезагрузку.
function waitForBackgroundVideoReady(normalizedSrc) {
  if (!elBgVideo || !normalizedSrc) return Promise.resolve(false);
  if (
    normalizeAssetUrl(elBgVideo.currentSrc || elBgVideo.src || "") === normalizedSrc &&
    elBgVideo.readyState >= 2 &&
    !elBgVideo.classList.contains("hidden")
  ) {
    return Promise.resolve(true);
  }

  return new Promise(function(resolve) {
    var done = false;
    function finish(ok) {
      if (done) return;
      done = true;
      elBgVideo.removeEventListener("loadeddata", onLoaded);
      elBgVideo.removeEventListener("error", onError);
      clearTimeout(timer);
      resolve(!!ok);
    }
    function onLoaded() {
      if (normalizeAssetUrl(elBgVideo.currentSrc || elBgVideo.src || "") !== normalizedSrc) return;
      finish(true);
    }
    function onError() {
      finish(false);
    }

    var timer = setTimeout(function() {
      finish(false);
    }, 5000);
    elBgVideo.addEventListener("loadeddata", onLoaded);
    elBgVideo.addEventListener("error", onError);
  });
}

// Ждёт финальный blur-дубликат видео, чтобы временный blur-overlay не исчезал раньше готового кадра.
function waitForBlurBackgroundVideoReady(normalizedSrc) {
  if (!STORY || !STORY.meta || !STORY.meta.blurBackground) return Promise.resolve(true);
  if (!elBlurBgVideo || !normalizedSrc) return Promise.resolve(true);
  if (
    normalizeAssetUrl(elBlurBgVideo.currentSrc || elBlurBgVideo.src || "") === normalizedSrc &&
    elBlurBgVideo.readyState >= 2 &&
    !elBlurBgVideo.classList.contains("hidden")
  ) {
    return Promise.resolve(true);
  }

  return new Promise(function(resolve) {
    var done = false;
    function finish(ok) {
      if (done) return;
      done = true;
      elBlurBgVideo.removeEventListener("loadeddata", onLoaded);
      elBlurBgVideo.removeEventListener("error", onError);
      clearTimeout(timer);
      resolve(!!ok);
    }
    function onLoaded() {
      if (normalizeAssetUrl(elBlurBgVideo.currentSrc || elBlurBgVideo.src || "") !== normalizedSrc) return;
      finish(true);
    }
    function onError() {
      finish(false);
    }

    var timer = setTimeout(function() {
      finish(false);
    }, 5000);
    elBlurBgVideo.addEventListener("loadeddata", onLoaded);
    elBlurBgVideo.addEventListener("error", onError);
  });
}

// Готовит верхний blur-слой только когда размытие включено: он проявляется вместе с основным фоном.
function prepareBlurBackgroundImageCrossfade(src) {
  if (!src) return null;
  if (!STORY || !STORY.meta || !STORY.meta.blurBackground) return null;
  if (!elBlurBgLayer || !elBlurBgImage) return null;

  var layer = ensureVisualBlurBgCrossfadeLayer();
  if (!layer) return null;

  // Старый blur-слой не трогаем до конца fade, иначе он исчезнет раньше основного фона.
  elBlurBgLayer.classList.remove("hidden");
  elBlurBgLayer.style.display = "block";
  layer.classList.remove("is-visible");
  layer.classList.remove("hidden");
  assignRasterImageToElement(layer, src, {});
  return layer;
}

// Для video-blur готовим первый кадр нового ролика, а при наличии fallback можем проявить статичную картинку.
function prepareBlurBackgroundVideoCrossfade(preparedBg) {
  if (!preparedBg || !preparedBg.normalizedSrc) return Promise.resolve(null);
  if (!STORY || !STORY.meta || !STORY.meta.blurBackground) return Promise.resolve(null);
  if (!elBlurBgLayer) return Promise.resolve(null);

  var fallbackSrc = normalizeAssetUrl(preparedBg.fallback || "");
  if (fallbackSrc && !isVideoAssetPath(fallbackSrc)) {
    return Promise.resolve(prepareBlurBackgroundImageCrossfade(fallbackSrc));
  }

  var layer = ensureVisualBlurBgVideoCrossfadeLayer();
  if (!layer) return Promise.resolve(null);

  // Старый blur-video остаётся под временным слоем, пока новый кадр не проявится полностью.
  elBlurBgLayer.classList.remove("hidden");
  elBlurBgLayer.style.display = "block";
  layer.classList.remove("is-visible");
  layer.classList.remove("hidden");
  return loadVisualCrossfadeVideo(layer, preparedBg.normalizedSrc, false).then(function(ok) {
    if (!ok) {
      hideVisualBlurBgVideoCrossfadeLayer();
      return null;
    }
    return layer;
  });
}

// Новый фон и его blur-дубликат проявляются поверх старых слоев, затем становятся основными.
function runBackgroundMediaCrossfade(preparedBg, transitionSettings) {
  if (!canCrossfadePreparedBackground(preparedBg)) {
    return Promise.resolve(false);
  }

  var isVideo = isVideoAssetPath(preparedBg.file);
  var layer = isVideo ? ensureVisualBgVideoCrossfadeLayer() : ensureVisualBgCrossfadeLayer();
  if (!layer) return Promise.resolve(false);

  copyBackgroundCrossfadePosition(layer);
  setVisualTransitionDuration(transitionSettings.inMs);
  layer.classList.remove("is-visible");
  layer.classList.remove("hidden");

  var mediaReady = isVideo
    ? loadVisualCrossfadeVideo(layer, preparedBg.normalizedSrc, true)
    : loadVisualCrossfadeImage(layer, preparedBg.file || preparedBg.normalizedSrc);
  var blurReady = isVideo
    ? prepareBlurBackgroundVideoCrossfade(preparedBg)
    : Promise.resolve(prepareBlurBackgroundImageCrossfade(preparedBg.file || preparedBg.normalizedSrc));

  return Promise.all([mediaReady, blurReady]).then(function(results) {
    if (!results[0]) {
      if (isVideo) hideVisualBgVideoCrossfadeLayer();
      else hideVisualBgCrossfadeLayer();
      applyPreparedBackgroundVisualState(preparedBg);
      return false;
    }
    var blurLayer = results[1];
    applyMediaScrollOptionsToTemporaryLayer(layer, preparedBg.mediaOptions, elNovelWindow);
    if (isVideo && blurLayer && String(blurLayer.tagName || "").toLowerCase() === "video") {
      applyMediaScrollOptionsToTemporaryLayer(blurLayer, preparedBg.mediaOptions, elNovelWindow);
    }
    return waitVisualTransitionFrame().then(function() {
      layer.classList.add("is-visible");
      if (blurLayer) blurLayer.classList.add("is-visible");
      return delayVisualTransition(transitionSettings.inMs);
    }).then(function() {
      var finalVideoReady = isVideo ? waitForBackgroundVideoReady(preparedBg.normalizedSrc) : Promise.resolve(true);
      applyPreparedBackgroundVisualState(preparedBg);
      return finalVideoReady;
    }).then(function() {
      if (!isVideo || (preparedBg.fallback && !isVideoAssetPath(preparedBg.fallback))) return true;
      return waitForBlurBackgroundVideoReady(preparedBg.normalizedSrc);
    }).then(function() {
      return waitVisualTransitionFrame();
    }).then(function() {
      if (isVideo) hideVisualBgVideoCrossfadeLayer();
      else hideVisualBgCrossfadeLayer();
      hideVisualBlurBgCrossfadeLayer();
      hideVisualBlurBgVideoCrossfadeLayer();
      return true;
    });
  });
}

// Переход через завесу: кадр меняется, пока экран полностью закрыт чёрным/белым цветом.
function runCoverVisualTransition(plan, transitionSettings, seq) {
  return preloadVisualBatchPlan(plan).then(function() {
    if (seq !== __visualTransitionSeq) return;

    setVisualTransitionDuration(transitionSettings.outMs);
    showVisualTransitionCover(transitionSettings.coverColor, false);
    return waitVisualTransitionFrame();
  }).then(function() {
    if (seq !== __visualTransitionSeq) return;

    showVisualTransitionCover(transitionSettings.coverColor, true);
    return delayVisualTransition(transitionSettings.outMs);
  }).then(function() {
    if (seq !== __visualTransitionSeq) return;

    applyVisualBatchPlan(plan);
    setVisualTransitionDuration(transitionSettings.inMs);
    return waitVisualTransitionFrame();
  }).then(function() {
    if (seq !== __visualTransitionSeq) return;

    showVisualTransitionCover(transitionSettings.coverColor, false);
    return delayVisualTransition(transitionSettings.inMs);
  }).then(function() {
    if (seq !== __visualTransitionSeq) return;
    hideVisualTransitionCover();
  });
}

// Обычный fade-through: старые изменившиеся слои исчезают, затем новые появляются.
function runFadeVisualTransition(plan, transitionSettings, seq) {
  var hasBgCrossfade = canCrossfadePreparedBackground(plan && plan.bg);
  return preloadVisualBatchPlan(plan).then(function() {
    if (seq !== __visualTransitionSeq) return;

    var fadeOutElements = getVisualBatchFadeOutElements(plan);
    setVisualTransitionDuration(transitionSettings.outMs);
    fadeOutElements.forEach(function(el) {
      setVisualTransitionTransparent(el, true);
    });

    return delayVisualTransition(fadeOutElements.length > 0 ? transitionSettings.outMs : 0);
  }).then(function() {
    if (seq !== __visualTransitionSeq) return;

    var fadeInElements = getVisualBatchFadeInElements(plan);
    setVisualTransitionDuration(transitionSettings.inMs);
    fadeInElements.forEach(function(el) {
      setVisualTransitionTransparent(el, true);
    });

    if (hasBgCrossfade) {
      applyVisualBatchPlanWithoutBackground(plan);
    } else {
      applyVisualBatchPlan(plan);
    }

    return waitVisualTransitionFrame().then(function() {
      if (seq !== __visualTransitionSeq) return;
      fadeInElements.forEach(function(el) {
        setVisualTransitionTransparent(el, false);
      });
      var waits = [];
      if (fadeInElements.length > 0) {
        waits.push(delayVisualTransition(transitionSettings.inMs));
      }
      if (hasBgCrossfade) {
        waits.push(runBackgroundMediaCrossfade(plan.bg, transitionSettings));
      }
      return Promise.all(waits);
    });
  });
}

// Выполняет общий короткий переход для финального фона и персонажа, затем продолжает сценарий.
function executeVisualBatch(actions) {
  if (!actions || actions.length === 0) return false;

  var plan = buildVisualBatchPlan(actions);
  var bgAction = plan && plan.bg && plan.bg.action ? plan.bg.action : null;
  var hasBgTransitionOverride = !!(bgAction && (bgAction.transition !== undefined || bgAction.transitionMs !== undefined));
  var transitionSettings = getVisualTransitionSettings(bgAction);
  // Для переходов с 360 по умолчанию используем резкую смену (none), но не ломаем явный override в bg.
  var currentIs360 = !!(backgroundScroll && backgroundScroll.backgroundOptions && backgroundScroll.backgroundOptions.is360 === true);
  var nextIs360 = !!(plan && plan.bg && plan.bg.mediaOptions && plan.bg.mediaOptions.is360 === true);
  var has360InSwap = currentIs360 || nextIs360;
  if (has360InSwap && !hasBgTransitionOverride) {
    transitionSettings.enabled = false;
  }
  var hasTransition = planHasVisualTransition(plan) && transitionSettings.enabled;
  var hasCharacterShow = !!(plan.char && plan.char.kind === "show");

  if (hasCharacterShow && !firstScreenMetrics.firstScreenShown) {
    firstScreenMetrics.waitingForCharacter = true;
  }

  if (!hasTransition) {
    applyVisualBatchPlan(plan);
    if (hasCharacterShow) firstScreenMetrics.waitingForCharacter = false;
    return false;
  }

  var seq = ++__visualTransitionSeq;
  var transitionPromise = transitionSettings.mode === "cover"
    ? runCoverVisualTransition(plan, transitionSettings, seq)
    : runFadeVisualTransition(plan, transitionSettings, seq);

  transitionPromise.then(function() {
    if (seq !== __visualTransitionSeq) return;
    clearVisualTransitionClasses();
    if (hasCharacterShow) firstScreenMetrics.waitingForCharacter = false;
    state.nextLocked = false;
    state.waitingNext = false;
    runCurrent();
  }).catch(function(err) {
    console.warn("[VISUAL BATCH] transition failed:", err);
    clearVisualTransitionClasses();
    if (hasCharacterShow) firstScreenMetrics.waitingForCharacter = false;
    state.nextLocked = false;
    state.waitingNext = false;
    runCurrent();
  });

  return "async";
}

// Возвращает true, если надо "ждать" (клик дальше/выбор/игра)
function executeAction(action) {
  console.log(
    "[VN] action",
    action.type,
    "scene:", state.sceneId,
    "index:", state.actionIndex - 1,
    action
  );

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
      console.log('[ENGINE] ПОЛУЧЕН CHAR ACTION:', JSON.stringify(action));
      console.log('[ENGINE] Текущая сцена:', state.sceneId, 'индекс:', state.actionIndex-1);

      console.log('[Engine CHAR] Processing char action:', action);
      console.log('[Engine executeAction] CHAR action received:', JSON.stringify(action));

      // Любая команда без charId и без src - это скрытие
      if ((!action.charId || action.charId === null) && action.src === null) {
        console.log('[ENGINE] ВЫПОЛНЯЕТСЯ HIDE ALL!');
        hideAllCharacters();
        console.log('[ENGINE] HIDE ALL ВЫПОЛНЕН, возвращаем false');
        return false;
      }
      
      // Только новый формат:
      // { type: "char", charId: "anna", emotion: "neutral", pos: "center" }
      console.log('[Engine CHAR] New format - charId:', action.charId, 'emotion:', action.emotion);

      if (!action.charId) {
        console.warn('[Engine CHAR] charId is missing in new format action:', action);
        setCharacter(null, action.pos, null);
        return false;
      }

      console.log('[Engine CHAR] STORY.assets:', STORY.assets);
      console.log('[Engine CHAR] STORY.assets.characters:', STORY.assets?.characters);

      if (STORY.assets?.characters) {
        const char = STORY.assets.characters[action.charId];
        console.log('[Engine CHAR] Character data for', action.charId, ':', char);

        if (char?.images) {
          console.log('[Engine CHAR] Available emotions:', Object.keys(char.images));
          console.log('[Engine CHAR] Requested emotion:', action.emotion);
          console.log('[Engine CHAR] Image path:', getCharacterImagePath(char.images[action.emotion]));
        }
      }

      const charAssetInfo = resolveCharacterAssetInfo(action.charId, action.emotion);
      const src = charAssetInfo.file;
      const charFocusOptions = normalizeCharacterFocusOptions(
        mergeCharacterFocusOptions(charAssetInfo.focusOptions, action),
        CHARACTER_FOCUS_DEFAULTS
      );
      console.log('[Engine CHAR] Resolved src:', src);

      console.log('[SCRIPT FLOW] char action -> setCharacter', {
        actionIndex: state.actionIndex - 1,
        action: action,
        resolvedSrc: src,
        pos: action.pos,
        charId: action.charId,
        focusOptions: charFocusOptions
      });

      // Если картинка не найдена — не показываем, но и не скрываем
      if (!src) {
        console.log('[SCRIPT FLOW] char action(new) -> no image found, skipping', {
          sceneId: state.sceneId,
          actionIndex: state.actionIndex - 1,
          action: action
        });

        // Просто пропускаем, не меняем видимость
        return false;
      }

      if (!firstScreenMetrics.firstScreenShown) {
        firstScreenMetrics.waitingForCharacter = true;
      }

      // Сохраняем индекс перед асинхронной загрузкой
      var currentActionIndex = state.actionIndex - 1; // потому что мы уже увеличили индекс

      // Проверяем, нужно ли реально загружать изображение
      const currentSrc = elChar.getAttribute('src');
      const currentCharId = elChar.dataset.charId;
      const isHidden = elChar.classList.contains('hidden');
      const focusAlreadyApplied = areCharacterFocusOptionsEqual(charFocusOptions, currentCharacterVisualOptions);

      // Если персонаж уже видим с тем же src и теми же focus/scale, загрузка и пересчет не нужны.
      if (imageUrlMatchesStoryCandidates(currentSrc, src) && !isHidden && focusAlreadyApplied) {
        console.log('[Engine CHAR] Character already visible, continuing');
        firstScreenMetrics.waitingForCharacter = false;
        return false;
      }

      setCharacter(src, action.pos, action.charId, function() {
        console.log('[FLOW] char(new):done callback start', {
          sceneId: state.sceneId,
          actionIndex: state.actionIndex,
          savedIndex: currentActionIndex,
          waitingNextBefore: state.waitingNext,
          nextLockedBefore: state.nextLocked
        });

        firstScreenMetrics.waitingForCharacter = false;

        // ✅ Если ожидаем клик пользователя – не продолжаем автоматически
        if (state.waitingNext) {
          console.log('[FLOW] char(new):done callback but waiting for user click, skipping runCurrent');
          state.nextLocked = false;      // снимаем блокировку, если была
          return;
        }

        state.nextLocked = false;
        state.waitingNext = false;

        if (suppressAutoRunOnce) {
          console.log('[FLOW] char(new):done callback suppressed after manual game close');
          suppressAutoRunOnce = false;
          state.nextLocked = false;
          state.waitingNext = true;
          return;
        }

        console.log('[FLOW] char(new):done callback before runCurrent', {
          sceneId: state.sceneId,
          actionIndex: state.actionIndex,
          waitingNextAfterReset: state.waitingNext,
          nextLockedAfterReset: state.nextLocked
        });

        runCurrent();
      }, charFocusOptions);

      console.log('[SCRIPT FLOW] char action(new) paused until image load', {
        sceneId: state.sceneId,
        actionIndex: state.actionIndex - 1,
        action: action
      });

      return "async";

    case "say":
      console.log('[ENGINE SAY] Показываю диалог, возвращаю true');
      // Только новый формат:
      // { type: "say", charVar: "anna", text: "..." }

      if (!action.charVar) {
        console.warn('[Engine] say: charVar is missing in new format action:', action);
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
      console.log('[ENGINE TEXT] Показываю текст, возвращаю true');
      showDialog(null, renderTextVars(action.text));

      // ВАЖНО: принудительно устанавливаем ожидание
      state.waitingNext = true;
      state.nextLocked = false;

      console.log('[VN] text action - waitingNext установлен в true');

      return true;

    case "choice":
      showChoices(action.choices || [], action);
      return true;

    case "goto":
      console.log('[ENGINE GOTO] Переход, возвращаю false');
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
        console.error("[VN] set: неверное выражение", action.expression);
        return false;
      }

      var varName = action.expression.substring(0, eqPos).trim();
      var expr = action.expression.substring(eqPos + 1).trim();

      if (!varName) {
        console.error("[VN] set: пустое имя переменной", action.expression);
        return false;
      }

      try {
        // set вычисляет только безопасное выражение без запуска JavaScript-кода из сценария.
        state.vars[varName] = evaluateSafeExpression(expr, state.vars);
        console.log("[VN] set result:", varName, "=", state.vars[varName], "vars:", state.vars);
      } catch (e) {
        console.error("[VN] set error:", action.expression, e);
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
        console.error("[VN] if_expr error:", action.condition, e);
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
  console.log("[walk360] reset interaction state", reason || "");
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
      visibleIf: expression,
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
      visibleIf: expression,
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

// Включает подробные логи цепочки фокуса goto360: в консоли window.STORY360_DEBUG_FOCUS = true или GET ?debug360focus=1.
function story360DebugFocusLogEnabled() {
  if (typeof window === "undefined") return false;
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

// Проверяет, что метка выводит из 360-пространства в обычную сцену, а значит должна быть DOM-точкой без WebGL-стрелки.
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
  return !!(mark && typeof mark === "object" && String(mark.kind || "").toLowerCase() === "photo");
}

// Нормализует список изображений photo-метки в массив { file, caption }.
function normalizeBg360PhotoImages(mark) {
  if (!mark || typeof mark !== "object") return [];
  var raw = readStory360Field(mark, ["images", "image", "photos", "photo"]);
  var list = [];
  if (Array.isArray(raw)) {
    for (var i = 0; i < raw.length; i++) {
      var item = raw[i];
      if (typeof item === "string") {
        var onlyFile = String(item || "").trim();
        if (onlyFile) list.push({ file: onlyFile, caption: "" });
      } else if (item && typeof item === "object") {
        var file = String(readStory360Field(item, ["file", "src", "path", "url"]) || "").trim();
        var cap = String(readStory360Field(item, ["caption", "text"]) || "").trim();
        if (file) list.push({ file: file, caption: cap });
      }
    }
  } else if (typeof raw === "string") {
    var one = String(raw || "").trim();
    if (one) list.push({ file: one, caption: "" });
  }
  return list;
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

// Подпись под изображением в viewer: только caption элемента images[].
function getBg360PhotoViewerCaption(mark, imageIndex) {
  if (!mark || typeof mark !== "object") return "";
  var images = normalizeBg360PhotoImages(mark);
  var idx = Math.max(0, Math.min(images.length - 1, Number(imageIndex) || 0));
  if (!images[idx]) return "";
  return String(images[idx].caption || "").trim();
}

// Название photo-метки на сцене 360 (рядом с превью); пустое — подпись не рисуется.
function bg360GetPhotoMarkLabel(mark) {
  if (!mark || typeof mark !== "object") return "";
  return String(mark.label || "").trim();
}

// Создаёт пустое состояние zoom/pan: 100% = базовая рамка при открытии, zoom 1..4.
function createBg360PhotoSlideState() {
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

// Возвращает DOM-элементы области изображения viewer.
function getBg360PhotoViewerElements() {
  if (!elBg360PhotoViewport || !elBg360PhotoInner || !elBg360PhotoImg) return null;
  return {
    media: elBg360PhotoViewport.parentElement,
    viewport: elBg360PhotoViewport,
    inner: elBg360PhotoInner,
    img: elBg360PhotoImg
  };
}

// Синхронизирует ширину области фото и подписи: подпись не раздувает карточку шире кадра.
function applyBg360PhotoViewerFrameWidth(vpW) {
  var wPx = Math.max(1, Math.round(Number(vpW) || 1)) + "px";
  var parts = getBg360PhotoViewerElements();
  if (parts && parts.viewport) {
    parts.viewport.style.width = wPx;
    parts.viewport.style.maxWidth = wPx;
  }
  if (parts && parts.media) {
    parts.media.style.width = wPx;
    parts.media.style.maxWidth = wPx;
  }
  if (elBg360PhotoViewerCaption) {
    if (elBg360PhotoViewerCaption.classList.contains("hidden")) {
      elBg360PhotoViewerCaption.style.width = "";
      elBg360PhotoViewerCaption.style.maxWidth = "";
    } else {
      elBg360PhotoViewerCaption.style.width = wPx;
      elBg360PhotoViewerCaption.style.maxWidth = wPx;
    }
  }
}

// Текущий CSS-scale изображения: базовое вписывание × zoom (1 = 100%).
function getBg360PhotoImageScale(st) {
  if (!st) return 1;
  var base = st.baseFitScale > 0 ? st.baseFitScale : 1;
  var z = st.zoom > 0 ? st.zoom : 1;
  return base * z;
}

// Доступное на stage место под область фото (без подписи).
function getBg360PhotoStageImageLimits() {
  var stage = elBg360PhotoViewer ? elBg360PhotoViewer.querySelector(".bg360-photo-viewer-stage") : null;
  if (!stage) return { maxW: 1, maxH: 1 };
  var stageRect = stage.getBoundingClientRect();
  var hasCaption = !!(elBg360PhotoViewerCaption && !elBg360PhotoViewerCaption.classList.contains("hidden"));
  var captionH = hasCaption ? (elBg360PhotoViewerCaption.offsetHeight || 0) : 0;
  return {
    maxW: stageRect.width * 0.92,
    maxH: Math.max(64, stageRect.height * 0.9 - 12 - captionH)
  };
}

// Сбрасывает inline-размеры карточки viewer при закрытии.
function clearBg360PhotoViewerFrameSizes() {
  var parts = getBg360PhotoViewerElements();
  if (parts && parts.viewport) {
    parts.viewport.style.width = "";
    parts.viewport.style.height = "";
    parts.viewport.style.maxWidth = "";
  }
  if (parts && parts.media) {
    parts.media.style.width = "";
    parts.media.style.maxWidth = "";
  }
  if (elBg360PhotoViewerCaption) {
    elBg360PhotoViewerCaption.style.width = "";
    elBg360PhotoViewerCaption.style.maxWidth = "";
  }
}

// Применяет transform zoom/pan только к слою изображения (кнопки и подпись не масштабируются).
function applyBg360PhotoSlideTransform() {
  var parts = getBg360PhotoViewerElements();
  var st = bg360PhotoViewerRuntime.slideState;
  if (!parts || !parts.inner || !st) return;
  var scale = getBg360PhotoImageScale(st);
  parts.inner.style.transform =
    "translate(calc(-50% + " + st.tx + "px), calc(-50% + " + st.ty + "px)) scale(" + scale + ")";
}

// Ограничивает смещение увеличенного кадра относительно viewport.
function clampBg360PhotoSlidePan() {
  var parts = getBg360PhotoViewerElements();
  var st = bg360PhotoViewerRuntime.slideState;
  if (!parts || !parts.viewport || !st || !st.naturalW || !st.naturalH) return;
  var rect = parts.viewport.getBoundingClientRect();
  var scale = getBg360PhotoImageScale(st);
  var imgW = st.naturalW * scale;
  var imgH = st.naturalH * scale;
  var maxTx = Math.max(0, (imgW - rect.width) * 0.5);
  var maxTy = Math.max(0, (imgH - rect.height) * 0.5);
  st.tx = clamp(st.tx, -maxTx, maxTx);
  st.ty = clamp(st.ty, -maxTy, maxTy);
}

// Применяет zoom к размеру рамки (viewport): растёт до экрана, не меньше 100% базы.
function applyBg360PhotoViewerZoomLayout() {
  var st = bg360PhotoViewerRuntime.slideState;
  var parts = getBg360PhotoViewerElements();
  if (!st || !parts || !parts.viewport || !st.baseViewportW || !st.baseViewportH) return;

  st.zoom = clamp(st.zoom, BG360_PHOTO_ZOOM_MIN, BG360_PHOTO_ZOOM_MAX);
  var limits = getBg360PhotoStageImageLimits();
  var imgW = st.naturalW * st.baseFitScale * st.zoom;
  var imgH = st.naturalH * st.baseFitScale * st.zoom;

  var vpW = Math.min(Math.max(st.baseViewportW, imgW), limits.maxW);
  var vpH = Math.min(Math.max(st.baseViewportH, imgH), limits.maxH);

  applyBg360PhotoViewerFrameWidth(vpW);
  parts.viewport.style.height = Math.round(vpH) + "px";
  applyBg360PhotoSlideTransform();
  clampBg360PhotoSlidePan();
}

// Обновляет подпись под фото внутри общей рамки карточки.
function updateBg360PhotoViewerCaption(mark, imageIndex) {
  if (!elBg360PhotoViewerCaption) return;
  var text = getBg360PhotoViewerCaption(mark, imageIndex);
  if (!text) {
    elBg360PhotoViewerCaption.textContent = "";
    elBg360PhotoViewerCaption.classList.add("hidden");
    elBg360PhotoViewerCaption.style.width = "";
    elBg360PhotoViewerCaption.style.maxWidth = "";
    if (bg360PhotoViewerRuntime.active && bg360PhotoViewerRuntime.slideState && bg360PhotoViewerRuntime.slideState.loaded) {
      requestAnimationFrame(function () {
        layoutBg360PhotoViewerCard(false);
      });
    }
    return;
  }
  elBg360PhotoViewerCaption.textContent = text;
  elBg360PhotoViewerCaption.classList.remove("hidden");
  if (bg360PhotoViewerRuntime.active && bg360PhotoViewerRuntime.slideState && bg360PhotoViewerRuntime.slideState.loaded) {
    requestAnimationFrame(function () {
      layoutBg360PhotoViewerCard(false);
    });
  }
}

// Показывает/скрывает кнопки «пред» и «след» по индексу в наборе.
function updateBg360PhotoViewerNavButtons() {
  var idx = bg360PhotoViewerRuntime.index;
  var count = bg360PhotoViewerRuntime.images.length;
  if (elBg360PhotoPrev) {
    elBg360PhotoPrev.classList.toggle("hidden", idx <= 0 || count <= 1);
  }
  if (elBg360PhotoNext) {
    elBg360PhotoNext.classList.toggle("hidden", idx >= count - 1 || count <= 1);
  }
}

// Считает базовую рамку (100%) и применяет текущий zoom к viewport.
function layoutBg360PhotoViewerCard(resetZoom) {
  if (!bg360PhotoViewerRuntime.active || !elBg360PhotoViewer) return;
  var stage = elBg360PhotoViewer.querySelector(".bg360-photo-viewer-stage");
  var st = bg360PhotoViewerRuntime.slideState;
  var parts = getBg360PhotoViewerElements();
  if (!stage || !st || !parts || !parts.viewport || !st.naturalW || !st.naturalH) return;

  var stageRect = stage.getBoundingClientRect();
  var maxW = stageRect.width * 0.92;
  var maxH = stageRect.height * 0.9 - 12;
  var hasCaption = !!(elBg360PhotoViewerCaption && !elBg360PhotoViewerCaption.classList.contains("hidden"));
  var aspect = st.naturalW / st.naturalH;
  var vpW;
  var vpH;

  function computeBaseViewportSize(availH) {
    var h = Math.max(64, availH);
    if (maxW / h > aspect) {
      vpH = h;
      vpW = vpH * aspect;
    } else {
      vpW = maxW;
      vpH = vpW / aspect;
    }
  }

  computeBaseViewportSize(maxH);

  if (hasCaption) {
    applyBg360PhotoViewerFrameWidth(vpW);
    var captionH = elBg360PhotoViewerCaption.offsetHeight || 0;
    if (captionH > 0) {
      computeBaseViewportSize(stageRect.height * 0.9 - captionH - 12);
    }
  }

  st.baseViewportW = vpW;
  st.baseViewportH = vpH;
  st.baseFitScale = Math.min(vpW / st.naturalW, vpH / st.naturalH);
  if (!isFinite(st.baseFitScale) || st.baseFitScale <= 0) st.baseFitScale = 1;

  if (resetZoom) {
    st.zoom = 1;
    st.tx = 0;
    st.ty = 0;
  }

  applyBg360PhotoViewerZoomLayout();
}

// Загружает одно изображение по индексу в единственный слой просмотра.
function renderBg360PhotoViewerImage(imageIndex) {
  var images = bg360PhotoViewerRuntime.images;
  if (!images.length || !elBg360PhotoImg) return;
  var idx = clamp(Math.round(Number(imageIndex) || 0), 0, images.length - 1);
  bg360PhotoViewerRuntime.index = idx;
  var src = String((images[idx] && images[idx].file) || "").trim();
  var st = bg360PhotoViewerRuntime.slideState;
  if (!st) {
    st = createBg360PhotoSlideState();
    bg360PhotoViewerRuntime.slideState = st;
  }
  st.loaded = false;
  st.naturalW = 0;
  st.naturalH = 0;
  st.zoom = 1;
  st.tx = 0;
  st.ty = 0;
  applyBg360PhotoSlideTransform();

  if (!src) {
    elBg360PhotoImg.removeAttribute("src");
    return;
  }

  assignRasterImageToElement(elBg360PhotoImg, src, {
    onLoad: function () {
      if (!bg360PhotoViewerRuntime.active) return;
      if (bg360PhotoViewerRuntime.index !== idx) return;
      st.naturalW = elBg360PhotoImg.naturalWidth || elBg360PhotoImg.width || 0;
      st.naturalH = elBg360PhotoImg.naturalHeight || elBg360PhotoImg.height || 0;
      st.loaded = true;
      layoutBg360PhotoViewerCard(true);
    }
  });
}

// Переключает текущий кадр в наборе (без карусели — подмена одного img).
function setBg360PhotoViewerIndex(nextIndex) {
  var count = bg360PhotoViewerRuntime.images.length;
  if (!count) return;
  var idx = clamp(Math.round(Number(nextIndex) || 0), 0, count - 1);
  if (idx === bg360PhotoViewerRuntime.index && bg360PhotoViewerRuntime.slideState && bg360PhotoViewerRuntime.slideState.loaded) {
    updateBg360PhotoViewerNavButtons();
    return;
  }
  renderBg360PhotoViewerImage(idx);
  var mark = findBg360MarkById(bg360PhotoViewerRuntime.markId);
  updateBg360PhotoViewerCaption(mark, idx);
  updateBg360PhotoViewerNavButtons();
}

// Замораживает 360 и показывает viewer с одним кадром.
function openBg360PhotoViewer(mark) {
  if (!mark || !bg360IsPhotoMark(mark)) return false;
  if (!elBg360PhotoViewer || !elBg360PhotoImg) return false;
  if (!bg360Runtime.active) return false;
  if (bg360MarksRuntime.locked) return false;

  var images = normalizeBg360PhotoImages(mark);
  if (!images.length) {
    console.warn("[bg360-photo] mark has no images", mark.id);
    return false;
  }

  bg360PhotoViewerRuntime.active = true;
  bg360PhotoViewerRuntime.markId = String(mark.id || "");
  bg360PhotoViewerRuntime.images = images;
  bg360PhotoViewerRuntime.index = 0;
  bg360PhotoViewerRuntime.slideState = createBg360PhotoSlideState();
  bg360PhotoViewerRuntime.slideGesture = null;

  bg360PhotoViewerRuntime.was360Interactive = !!bg360Runtime.interactive;
  bg360Runtime.interactive = false;
  if (elBg360) elBg360.classList.add("is-photo-viewer-open");

  updateBg360PhotoViewerCaption(mark, 0);
  updateBg360PhotoViewerNavButtons();
  renderBg360PhotoViewerImage(0);

  elBg360PhotoViewer.classList.remove("hidden");
  elBg360PhotoViewer.setAttribute("aria-hidden", "false");
  if (elBg360Marks) elBg360Marks.classList.add("is-photo-viewer-open");

  requestAnimationFrame(function () {
    layoutBg360PhotoViewerCard(true);
  });
  return true;
}

// Закрывает viewer и возвращает управление 360 без завершения walk360/goto360.
function closeBg360PhotoViewer(reason) {
  if (!bg360PhotoViewerRuntime.active) return;
  bg360PhotoViewerRuntime.active = false;
  bg360PhotoViewerRuntime.markId = "";
  bg360PhotoViewerRuntime.images = [];
  bg360PhotoViewerRuntime.index = 0;
  bg360PhotoViewerRuntime.slideState = null;
  bg360PhotoViewerRuntime.slideGesture = null;
  bg360PhotoViewerRuntime.pinchPointers = {};
  bg360PhotoViewerRuntime.pinchStartDistance = null;

  if (elBg360PhotoViewer) {
    elBg360PhotoViewer.classList.add("hidden");
    elBg360PhotoViewer.setAttribute("aria-hidden", "true");
  }
  if (elBg360PhotoImg) {
    elBg360PhotoImg.removeAttribute("src");
  }
  if (elBg360PhotoInner) {
    elBg360PhotoInner.style.transform = "";
  }
  clearBg360PhotoViewerFrameSizes();
  if (elBg360PhotoViewerCaption) {
    elBg360PhotoViewerCaption.textContent = "";
    elBg360PhotoViewerCaption.classList.add("hidden");
  }
  if (elBg360Marks) elBg360Marks.classList.remove("is-photo-viewer-open");

  if (bg360Runtime.active) {
    bg360Runtime.interactive = bg360PhotoViewerRuntime.was360Interactive;
  }
  if (elBg360) elBg360.classList.remove("is-photo-viewer-open");

  if (reason) {
    // Причина только для отладки; на геймплей не влияет.
  }
}

// Проверяет, выходит ли изображение за границы viewport по ширине или высоте.
function bg360PhotoSlideOverflowsViewport() {
  var parts = getBg360PhotoViewerElements();
  var st = bg360PhotoViewerRuntime.slideState;
  if (!parts || !parts.viewport || !st || !st.loaded || !st.naturalW || !st.naturalH) return false;
  var rect = parts.viewport.getBoundingClientRect();
  var scale = getBg360PhotoImageScale(st);
  var imgW = st.naturalW * scale;
  var imgH = st.naturalH * scale;
  return imgW > rect.width + 0.5 || imgH > rect.height + 0.5;
}

// True, если кадр можно перетаскивать после zoom.
function bg360PhotoSlideAllowsPan() {
  return bg360PhotoSlideOverflowsViewport();
}

// Меняет zoom (1 = 100%, до 400%); рамка растёт/сжимается в пределах экрана, изображение обрезается при необходимости.
function applyBg360PhotoZoomAt(nextZoom, focalX, focalY) {
  var parts = getBg360PhotoViewerElements();
  var st = bg360PhotoViewerRuntime.slideState;
  if (!parts || !parts.viewport || !st) return;
  var prevZoom = st.zoom;
  var zoom = clamp(nextZoom, BG360_PHOTO_ZOOM_MIN, BG360_PHOTO_ZOOM_MAX);

  var rect = parts.viewport.getBoundingClientRect();
  var cx = rect.left + rect.width * 0.5;
  var cy = rect.top + rect.height * 0.5;
  var fx = isFinite(focalX) ? focalX : cx;
  var fy = isFinite(focalY) ? focalY : cy;
  var prevScale = st.baseFitScale * prevZoom;
  var newScale = st.baseFitScale * zoom;
  var ratio = prevScale > 0 ? newScale / prevScale : 1;
  st.tx = (st.tx + (fx - cx)) * ratio - (fx - cx);
  st.ty = (st.ty + (fy - cy)) * ratio - (fy - cy);
  st.zoom = zoom;

  applyBg360PhotoViewerZoomLayout();
}

// Обработчик resize: пересчитать базовую рамку 100% и применить текущий zoom.
function handleBg360PhotoViewerResize() {
  if (!bg360PhotoViewerRuntime.active) return;
  layoutBg360PhotoViewerCard(false);
}

// Клики: закрытие по backdrop (вне карточки), кнопки ✕ и листания.
function handleBg360PhotoViewerUiClick(e) {
  if (!bg360PhotoViewerRuntime.active) return;
  if (Date.now() < (bg360PhotoViewerRuntime.suppressUiClickUntil || 0)) return;
  var t = e.target;
  if (!t || !t.closest) return;
  if (t.closest("[data-bg360-photo-close]")) {
    e.preventDefault();
    e.stopPropagation();
    closeBg360PhotoViewer("ui");
    return;
  }
  if (t.closest("[data-bg360-photo-prev]")) {
    e.preventDefault();
    e.stopPropagation();
    setBg360PhotoViewerIndex(bg360PhotoViewerRuntime.index - 1);
    return;
  }
  if (t.closest("[data-bg360-photo-next]")) {
    e.preventDefault();
    e.stopPropagation();
    setBg360PhotoViewerIndex(bg360PhotoViewerRuntime.index + 1);
    return;
  }
  if (t.closest(".bg360-photo-card")) {
    return;
  }
  if (t.getAttribute && t.getAttribute("data-bg360-photo-dismiss") === "1") {
    e.preventDefault();
    e.stopPropagation();
    closeBg360PhotoViewer("ui");
    return;
  }
  if (t.classList && t.classList.contains("bg360-photo-viewer-backdrop")) {
    e.preventDefault();
    e.stopPropagation();
    closeBg360PhotoViewer("ui");
  }
}

// Считает число активных указателей pinch-трекера viewer.
function getBg360PhotoPinchPointerCount() {
  var n = 0;
  var map = bg360PhotoViewerRuntime.pinchPointers;
  for (var key in map) {
    if (Object.prototype.hasOwnProperty.call(map, key)) n++;
  }
  return n;
}

// Дистанция между двумя указателями для pinch-zoom слайда.
function getBg360PhotoPinchDistance() {
  var pts = [];
  var map = bg360PhotoViewerRuntime.pinchPointers;
  for (var key in map) {
    if (Object.prototype.hasOwnProperty.call(map, key)) pts.push(map[key]);
  }
  if (pts.length < 2) return null;
  var dx = pts[0].x - pts[1].x;
  var dy = pts[0].y - pts[1].y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Pointer-жесты: pan/zoom только слоя изображения (не кнопок и подписи).
function handleBg360PhotoViewerPointerDown(e) {
  if (!bg360PhotoViewerRuntime.active) return;
  var t = e.target;
  if (t && t.closest && t.closest("[data-bg360-photo-close], [data-bg360-photo-prev], [data-bg360-photo-next]")) {
    return;
  }
  var parts = getBg360PhotoViewerElements();
  if (!parts || !parts.viewport) return;
  if (!parts.viewport.contains(e.target) && e.target !== parts.viewport) {
    return;
  }

  bg360PhotoViewerRuntime.pinchPointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  if (getBg360PhotoPinchPointerCount() >= 2) {
    bg360PhotoViewerRuntime.pinchStartDistance = getBg360PhotoPinchDistance();
    var stPinch = bg360PhotoViewerRuntime.slideState;
    bg360PhotoViewerRuntime.pinchStartZoom = stPinch ? stPinch.zoom : 1;
    bg360PhotoViewerRuntime.slideGesture = null;
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  var st = bg360PhotoViewerRuntime.slideState;
  if (!st) return;

  if (bg360PhotoSlideAllowsPan()) {
    bg360PhotoViewerRuntime.slideGesture = {
      mode: "pan",
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTx: st.tx,
      startTy: st.ty
    };
    parts.viewport.classList.add("is-panning");
    if (parts.viewport.setPointerCapture) {
      try { parts.viewport.setPointerCapture(e.pointerId); } catch (err) {}
    }
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  e.preventDefault();
  e.stopPropagation();
}

function handleBg360PhotoViewerPointerMove(e) {
  if (!bg360PhotoViewerRuntime.active) return;

  if (bg360PhotoViewerRuntime.pinchPointers[e.pointerId]) {
    bg360PhotoViewerRuntime.pinchPointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  }

  if (getBg360PhotoPinchPointerCount() >= 2 && bg360PhotoViewerRuntime.pinchStartDistance) {
    var dist = getBg360PhotoPinchDistance();
    if (dist && dist > 0) {
      var st = bg360PhotoViewerRuntime.slideState;
      if (st) {
        var midX = 0;
        var midY = 0;
        var count = 0;
        for (var key in bg360PhotoViewerRuntime.pinchPointers) {
          if (!Object.prototype.hasOwnProperty.call(bg360PhotoViewerRuntime.pinchPointers, key)) continue;
          midX += bg360PhotoViewerRuntime.pinchPointers[key].x;
          midY += bg360PhotoViewerRuntime.pinchPointers[key].y;
          count++;
        }
        midX /= count;
        midY /= count;
        var scaleFactor = dist / bg360PhotoViewerRuntime.pinchStartDistance;
        applyBg360PhotoZoomAt(bg360PhotoViewerRuntime.pinchStartZoom * scaleFactor, midX, midY);
      }
    }
    e.preventDefault();
    return;
  }

  var pan = bg360PhotoViewerRuntime.slideGesture;
  if (pan && pan.mode === "pan" && pan.pointerId === e.pointerId) {
    var stPan = bg360PhotoViewerRuntime.slideState;
    if (!stPan) return;
    stPan.tx = pan.startTx + (e.clientX - pan.startX);
    stPan.ty = pan.startTy + (e.clientY - pan.startY);
    clampBg360PhotoSlidePan();
    applyBg360PhotoSlideTransform();
    e.preventDefault();
  }
}

function handleBg360PhotoViewerPointerUp(e) {
  if (!bg360PhotoViewerRuntime.active) return;

  delete bg360PhotoViewerRuntime.pinchPointers[e.pointerId];
  if (getBg360PhotoPinchPointerCount() < 2) {
    bg360PhotoViewerRuntime.pinchStartDistance = null;
  }

  var pan = bg360PhotoViewerRuntime.slideGesture;
  if (pan && pan.pointerId === e.pointerId) {
    var parts = getBg360PhotoViewerElements();
    if (parts && parts.viewport && parts.viewport.releasePointerCapture) {
      try { parts.viewport.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    if (parts && parts.viewport) parts.viewport.classList.remove("is-panning");
    var panTravel = Math.abs(e.clientX - pan.startX) + Math.abs(e.clientY - pan.startY);
    if (panTravel > 6) {
      bg360PhotoViewerRuntime.suppressUiClickUntil = Date.now() + 400;
    }
    bg360PhotoViewerRuntime.slideGesture = null;
    e.preventDefault();
  }
}

// Колесо мыши меняет масштаб кадра (только над областью фото).
function handleBg360PhotoViewerWheel(e) {
  if (!bg360PhotoViewerRuntime.active) return;
  var parts = getBg360PhotoViewerElements();
  if (!parts || !parts.viewport || !parts.viewport.contains(e.target)) return;
  var st = bg360PhotoViewerRuntime.slideState;
  if (!st) return;
  var factor = e.deltaY > 0 ? 0.92 : 1.08;
  applyBg360PhotoZoomAt(st.zoom * factor, e.clientX, e.clientY);
  e.preventDefault();
}

// Escape закрывает; стрелки листают набор.
function handleBg360PhotoViewerKeydown(e) {
  if (!bg360PhotoViewerRuntime.active) return;
  var key = e.key || "";
  if (key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeBg360PhotoViewer("escape");
    return;
  }
  if (key === "ArrowLeft") {
    e.preventDefault();
    setBg360PhotoViewerIndex(bg360PhotoViewerRuntime.index - 1);
    return;
  }
  if (key === "ArrowRight") {
    e.preventDefault();
    setBg360PhotoViewerIndex(bg360PhotoViewerRuntime.index + 1);
  }
}

// Один раз вешает обработчики viewer.
function setupBg360PhotoViewer() {
  if (!bg360PhotoViewerRuntime || bg360PhotoViewerRuntime.photoViewerReady) return;
  if (!elBg360PhotoViewer) return;
  bg360PhotoViewerRuntime.photoViewerReady = true;

  elBg360PhotoPrev = elBg360PhotoViewer.querySelector("[data-bg360-photo-prev]");
  elBg360PhotoNext = elBg360PhotoViewer.querySelector("[data-bg360-photo-next]");

  elBg360PhotoViewer.addEventListener("click", handleBg360PhotoViewerUiClick);
  elBg360PhotoViewer.addEventListener("pointerdown", handleBg360PhotoViewerPointerDown);
  elBg360PhotoViewer.addEventListener("pointermove", handleBg360PhotoViewerPointerMove);
  elBg360PhotoViewer.addEventListener("pointerup", handleBg360PhotoViewerPointerUp);
  elBg360PhotoViewer.addEventListener("pointercancel", handleBg360PhotoViewerPointerUp);
  elBg360PhotoViewer.addEventListener("wheel", handleBg360PhotoViewerWheel, { passive: false });

  window.addEventListener("resize", handleBg360PhotoViewerResize);
  document.addEventListener("keydown", handleBg360PhotoViewerKeydown, true);
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
  if (!id) return false;
  if (bg360MarksRuntime.locked) return false;

  var markEarly = findBg360MarkById(id);
  if (markEarly && bg360IsPhotoMark(markEarly)) {
    return openBg360PhotoViewer(markEarly);
  }

  if (!bg360MarksRuntime.interactive) return false;

  if (goto360Runtime.active) {
    if (goto360Runtime.done) return false;
    onGoto360SelectMark(id);
    return true;
  }

  if (walk360Runtime.active) {
    if (walk360Runtime.done) return false;
    onWalk360SelectMark(id);
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
        assignRasterImageToElement(thumbImg, thumbSrc, {});
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

  var U = clamp(Number(u), 0, 1);
  var V = clamp(Number(v), 0, 1);

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
    var raw = getComputedStyle(document.documentElement).getPropertyValue("--bg360-under-camera-depth");
    var value = Number(String(raw || "").trim());
    return isFinite(value) && value > 0 ? value : fallbackDepth;
  } catch (err) {
    return fallbackDepth;
  }
}

// Читает базовый px-размер из CSS и умножает на visualScale; это повторяет --bg360-origin-cover-size в CSS.
function getBg360ScaledBaseCssPixel(baseVarName, fallbackPx) {
  try {
    var rootStyle = getComputedStyle(document.documentElement);
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
    var style = getComputedStyle(document.documentElement);
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

// Читает числовую CSS-настройку без единиц; используется для FOV, который не является CSS-длиной.
function getBg360CssNumber(varName, fallbackValue) {
  try {
    var raw = readBg360CssCustomPropertyValue(varName);
    var value = Number(String(raw || "").trim());
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
    var r = clamp(Number(parts[0]), 0, 255);
    var g = clamp(Number(parts[1]), 0, 255);
    var b = clamp(Number(parts[2]), 0, 255);
    var a = parts.length > 3 ? clamp(Number(parts[3]), 0, 1) : opacityFallback;
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
  var referenceFov = normalizeMediaFov(getBg360CssNumber("--bg360-origin-cover-reference-fov", 70), 70);
  var referenceTan = Math.tan(window.THREE.MathUtils.degToRad(referenceFov) * 0.5);
  if (!isFinite(referenceTan) || referenceTan <= 0) referenceTan = Math.tan(window.THREE.MathUtils.degToRad(70) * 0.5);
  // Угловой радиус сохраняет заплатку привязанной к панораме и даёт зуму менять её экранный размер естественно.
  return clamp(Math.atan((diameterPx * 0.5) / (safeHeight * 0.5) * referenceTan), 0.002, Math.PI * 0.45);
}

// Переводит толщину обводки из базовых px в угловую ширину кольца на 360-сфере.
function getBg360OriginCoverStrokeAngularWidth(viewHeight) {
  var safeHeight = Math.max(1, Number(viewHeight) || 1);
  var strokePx = getBg360ScaledBaseCssPixel("--bg360-origin-cover-stroke-width-base", 2);
  var referenceFov = normalizeMediaFov(getBg360CssNumber("--bg360-origin-cover-reference-fov", 70), 70);
  var referenceTan = Math.tan(window.THREE.MathUtils.degToRad(referenceFov) * 0.5);
  if (!isFinite(referenceTan) || referenceTan <= 0) referenceTan = Math.tan(window.THREE.MathUtils.degToRad(70) * 0.5);
  return clamp(Math.atan(strokePx / (safeHeight * 0.5) * referenceTan), 0, Math.PI * 0.08);
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
    y: clamp(projectedY, -height * depthMultiplier, height * depthMultiplier)
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
    anchorU: clamp(getBg360CssNumber("--bg360-nav-anchor-u", 0), 0, 1),
    anchorV: clamp(getBg360CssNumber("--bg360-nav-anchor-v", 0), 0, 1),
    chordMarginStart: Math.max(0, getBg360CssNumber("--bg360-nav-chord-margin-start", 12)),
    chordMarginEnd: Math.max(0, getBg360CssNumber("--bg360-nav-chord-margin-end", 18)),
    arrowSteps: Math.max(4, Math.min(32, Math.round(getBg360CssNumber("--bg360-nav-arrow-steps", 22)))),
    startInsetPx: Math.max(0, getBg360CssNumber("--bg360-nav-start-inset-px", 0)),
    markGapPx: Math.max(0, getBg360CssNumber("--bg360-nav-mark-gap-px", 80)),
    minChordPx: Math.max(0, getBg360CssNumber("--bg360-nav-min-chord-px", 28)),
    hitBandPx: Math.max(8, getBg360CssNumber("--bg360-nav-hit-band-px", 38)),
    hitBandMul: clamp(getBg360CssNumber("--bg360-nav-hit-band-width-mul", 2), 0.25, 8),
    hitChordLenMul: clamp(getBg360CssNumber("--bg360-nav-hit-chord-length-mul", 2), 1, 6),
    ribbonHalfW: Math.max(1, getBg360CssNumber("--bg360-nav-ribbon-half-w", 14)),
    headDepth: Math.max(2, getBg360CssNumber("--bg360-nav-head-depth", 28)),
    headHalfW: Math.max(1, getBg360CssNumber("--bg360-nav-head-half-w", 10)),
    lineOpacity: clamp(getBg360CssNumber("--bg360-nav-line-opacity", 0.55), 0.05, 1),
    nadirArrowEnabled: getBg360CssNumber("--bg360-nav-nadir-arrow-enabled", 1) !== 0,
    /* Цвет стрелки на круге: rgb/rgba/#hex; альфа из rgba дополнительно умножается на nadirArrowOpacity. */
    nadirArrowPaint: nadirArrowPaint,
    nadirArrowOpacity: clamp(getBg360CssNumber("--bg360-nav-nadir-arrow-opacity", 0.72), 0.05, 1),
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
    chordT: clamp(getBg360CssNumber("--bg360-nav-edge-hint-chord-t", 0.22), 0, 1)
  };
}

// Преобразует результат parseBg360CssColor в rgb + opacity для SVG-атрибутов.
function bg360PaintToSvgColorOpacity(paint) {
  var hex = paint && typeof paint.color === "number" ? paint.color : 0xffffff;
  var a = paint && isFinite(paint.opacity) ? clamp(paint.opacity, 0, 1) : 1;
  var r = (hex >> 16) & 255;
  var g = (hex >> 8) & 255;
  var b = hex & 255;
  return { rgb: "rgb(" + r + "," + g + "," + b + ")", opacity: a };
}

// Читает CSS-настройки SVG-компаса; длины заданы в координатах viewBox, а размер на экране задаёт CSS.
function readBg360CompassConfig() {
  var minLen = Math.max(1, getBg360CssNumber("--bg360-compass-arrow-min-length", 25));
  var maxLen = Math.max(minLen, getBg360CssNumber("--bg360-compass-arrow-max-length", 47));
  var compassOpacity = clamp(getBg360CssNumber("--bg360-compass-opacity", 0.62), 0.05, 1);
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
    labelSideBias: clamp(getBg360CssNumber("--bg360-compass-label-side-bias", 0.28), 0, 0.95),
    labelWrapChars: Math.max(1, Math.round(getBg360CssNumber("--bg360-compass-label-wrap-chars", 6))),
    labelLineHeightMul: Math.max(0.8, getBg360CssNumber("--bg360-compass-label-line-height", 1.08)),
    labelOpacity: clamp(getBg360CssNumber("--bg360-compass-label-opacity", compassOpacity), 0.05, 1),
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
    arrows[a].drawLen = clamp(proportionalLen, compassCfg.arrowMinLength, compassCfg.arrowMaxLength);
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
    var sideBias = clamp(Number(label.dataset.labelSideBias) || 0, 0, 0.95);
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
    var u = clamp(Number(t), 0, 1);
    bg360HintChordP.set(
      A.x + (B.x - A.x) * u,
      A.y + (B.y - A.y) * u,
      A.z + (B.z - A.z) * u
    );
    return bg360ProjectWorldToMarksPx(bg360HintChordP.x, bg360HintChordP.y, bg360HintChordP.z);
  }

  var t0 = clamp(Number(tPrefer), 0, 1);
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

    var ex = clamp(tpEdge.x, minX, maxX);
    var ey = clamp(tpEdge.y, minY, maxY);
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

// Возвращает true, пока для текущего loadSeq ещё не применена текстура к сфере (асинхронная загрузка или догрузка *-360.js).
function bg360ShouldDeferMarksUntilTextureReady() {
  if (!ensureBg360Renderer()) return false;
  var src = String(bg360Runtime.sourceSrc || "");
  if (!src) return false;
  if (!isBg360PackScriptPath(src) && !bg360Runtime.isVideoSource) return false;
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
    var nvOpacityCombined = clamp(cfg.nadirArrowOpacity * nvPaint.opacity, 0.05, 1);
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

  console.log("[bg360-nav] arrows rebuilt: meshes=" + navGroup.children.length +
    " marks=" + (Array.isArray(bg360MarksRuntime.marks) ? bg360MarksRuntime.marks.length : 0) +
    " anchorUV=" + cfg.anchorU.toFixed(3) + "," + cfg.anchorV.toFixed(3) +
    " nadirArrow=" + (cfg.nadirArrowEnabled ? "on" : "off"));
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
      console.log("[walk360] targetScene jump ->", target, "(goto + runCurrent)");
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
      console.error("[VN] if_block condition error:", branch.condition, e);
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
  console.log("[VN] goto scene ->", sceneId);
  
  // ДОБАВЬТЕ ЭТОТ БЛОК
  console.log("[DEBUG] ДО перехода - состояние:", {
    sceneId: state.sceneId,
    actionIndex: state.actionIndex,
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked
  });
  
  if (!sceneId) return;
  
  // ПОВЫШАЕМ СЧЁТЧИК, чтобы отменить все ожидающие загрузки
  __activeCharSeq++;
  __visualTransitionSeq++;
  clearVisualTransitionClasses();

  state.sceneId = sceneId;
  currentSceneId = sceneId;
  state.actionIndex = 0;
  state.waitingNext = false;
  state.nextLocked = false;  // ← ВАЖНО!
  
  // В функции gotoScene, после установки state.sceneId:
  currentSceneId = sceneId;

  // Скрываем персонажа по умолчанию при смене сцены
  hideAllCharacters();

  console.log("[DEBUG] ПОСЛЕ перехода - состояние:", {
    sceneId: state.sceneId,
    actionIndex: state.actionIndex,
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked
  });
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
    try { elBg360.setPointerCapture(e.pointerId); } catch (err) {}
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
    try { elBg360.releasePointerCapture(e.pointerId); } catch (err) {}
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
  console.log("[BG360 HOLD] layer created");
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
    console.log("[BG360 HOLD] hide immediate");
    elBg360Hold.classList.add("hidden");
    elBg360Hold.removeAttribute("src");
    elBg360Hold.style.opacity = "1";
    elBg360Hold.style.zIndex = "3";
    elBg360Hold.style.transition = "opacity 0.14s ease-out";
    elBg360Hold.style.transform = "";
    elBg360Hold.style.transformOrigin = "";
    return;
  }
  console.log("[BG360 HOLD] hide (fade)");
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
    console.log("[BG360 HOLD] skip capture: no canvas");
    return false;
  }
  // Не требуем active: при первом включении 360 после 2D-фона снимок может быть пустым/тёмным,
  // но hold всё равно даёт плавное растворение вместо мгновенного cut (ветка revealMs && holdOk).
  var hold = ensureBg360HoldLayer();
  if (!hold) {
    console.log("[BG360 HOLD] skip capture: no hold layer");
    return false;
  }
  try {
    if (bg360Runtime.holdFadeTimer) {
      clearTimeout(bg360Runtime.holdFadeTimer);
      bg360Runtime.holdFadeTimer = null;
    }
    console.log("[BG360 HOLD] capture start", {
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
    console.log("[BG360 HOLD] capture success: hold shown", {
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
    try { bg360Runtime.video.pause(); } catch (e) {}
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

// Проверяет, что путь указывает на JS-пакет 360, а не на исходную картинку.
function isBg360PackScriptPath(path) {
  return /-360(?:-[a-z0-9_-]+)?\.js(\?.*)?$/i.test(String(path || ""));
}

// Собирает варианты ключа для поиска: абсолютный URL, декодированный URL и путь от index.html.
function getBg360PackLookupKeys(sourceUrl) {
  var result = [];
  function addKey(value) {
    var key = String(value || "");
    if (key && result.indexOf(key) === -1) result.push(key);
  }

  var source = String(sourceUrl || "");
  addKey(source);
  var normalizedSource = normalizeAssetUrl(source);
  addKey(normalizedSource);

  try {
    var decodedSource = decodeURIComponent(normalizedSource);
    addKey(decodedSource);
  } catch (e) {
    addKey(normalizedSource);
  }

  // Пакет регистрирует и абсолютный URL, и путь от index.html, чтобы перенос папки проекта не ломал ключи.
  var baseHref = window.location.href;
  var slashIndex = baseHref.lastIndexOf("/");
  var baseDirHref = slashIndex >= 0 ? baseHref.slice(0, slashIndex + 1) : baseHref;
  if (normalizedSource.indexOf(baseDirHref) === 0) {
    var rel = normalizedSource.slice(baseDirHref.length);
    addKey(rel);
    addKey("./" + rel);
    addKey("/" + rel);
  }

  return result;
}

// Возвращает зарегистрированные хранилища 360-паков: новое variant-хранилище и legacy-карту старых пакетов, если она есть.
function getBg360PackStores() {
  var stores = [];
  if (window.VN360_PACKS_VARIANTS && typeof window.VN360_PACKS_VARIANTS === "object") {
    stores.push(window.VN360_PACKS_VARIANTS);
  }
  if (window.VN360_PACKS && typeof window.VN360_PACKS === "object") {
    stores.push(window.VN360_PACKS);
  }
  return stores;
}

// Достаёт data-url из записи пака; для нового формата качество строгое, legacy-записи могут быть одной строкой без normal/mobile.
function readBg360PackDataUrlFromEntry(entry, normalizedQuality, strictQuality) {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object") return "";

  if (normalizedQuality && typeof entry[normalizedQuality] === "string") {
    return entry[normalizedQuality];
  }
  if (typeof entry.dataUrl === "string") return entry.dataUrl;

  if (!strictQuality) {
    if (typeof entry.normal === "string") return entry.normal;
    if (typeof entry.mobile === "string") return entry.mobile;
    var keys = Object.keys(entry);
    for (var i = 0; i < keys.length; i++) {
      if (typeof entry[keys[i]] === "string") return entry[keys[i]];
    }
  }
  return "";
}

// Достаёт data-url из нового variant-хранилища или legacy-карты; meta-поля не обязательны для работы старых пакетов.
function readBg360PackDataUrlByKey(key, quality) {
  var normalizedQuality = resolveBg360EffectiveQuality(quality);
  var variants = window.VN360_PACKS_VARIANTS;
  var found = variants && typeof variants === "object"
    ? readBg360PackDataUrlFromEntry(variants[key], normalizedQuality, true)
    : "";
  if (found) return found;

  var legacy = window.VN360_PACKS;
  return legacy && typeof legacy === "object"
    ? readBg360PackDataUrlFromEntry(legacy[key], normalizedQuality, false)
    : "";
}

// Пытается найти data-url 360-пакета по JS-пути из file=... и выбранному normal/mobile.
function resolveBg360PackDataUrl(sourceUrl, quality) {
  var packStores = getBg360PackStores();
  if (!packStores.length) return "";

  var lookupKeys = getBg360PackLookupKeys(sourceUrl);
  for (var i = 0; i < lookupKeys.length; i++) {
    var found = readBg360PackDataUrlByKey(lookupKeys[i], quality);
    if (found) return found;
  }

  // Последний шанс: нормализуем ключи из всех известных хранилищ пака и сравниваем с целевым URL.
  var normalizedSource = normalizeAssetUrl(sourceUrl);
  for (var s = 0; s < packStores.length; s++) {
    var allKeys = Object.keys(packStores[s]);
    for (var j = 0; j < allKeys.length; j++) {
      var key = allKeys[j];
      if (normalizeAssetUrl(key) === normalizedSource) {
        var value = readBg360PackDataUrlByKey(key, quality);
        if (value) return value;
      }
    }
  }

  return "";
}

// Хранит состояние динамической загрузки *-360.js, чтобы не дублировать <script> и колбэки.
var bg360PackScriptState = Object.create(null);

// По пути из file=... выбирает JS-пакет: scene-360.js или scene-360-mobile.js, даже если в истории указан конкретный вариант.
function getBg360PackScriptUrl(sourceUrl, quality) {
  var normalized = normalizeAssetUrl(sourceUrl);
  var normalizedQuality = resolveBg360EffectiveQuality(quality);
  if (!isBg360PackScriptPath(normalized)) {
    return "";
  }
  if (normalizedQuality === "normal" && /-360-mobile\.js(\?.*)?$/i.test(normalized)) {
    return normalized.replace(/-360-mobile\.js(\?.*)?$/i, "-360.js$1");
  }
  if (normalizedQuality === "mobile" && /-360\.js(\?.*)?$/i.test(normalized)) {
    return normalized.replace(/-360\.js(\?.*)?$/i, "-360-mobile.js$1");
  }
  return normalized;
}

// Запрашивает js-пакет для 360-фона и сообщает, нужно ли подождать перед рендером.
// Возвращает:
// - "ready": данные уже есть;
// - "loading": пакет грузится, рендер нужно отложить;
// - "none": грузить нечего (или уже была ошибка).
function ensureBg360PackLoaded(sourceUrl, quality, onReady) {
  if (resolveBg360PackDataUrl(sourceUrl, quality)) return "ready";

  var packScriptUrl = getBg360PackScriptUrl(sourceUrl, quality);
  if (!packScriptUrl) return "none";
  if (resolveBg360PackDataUrl(packScriptUrl, quality)) return "ready";

  var state = bg360PackScriptState[packScriptUrl];
  if (state && state.status === "loaded") {
    return (resolveBg360PackDataUrl(sourceUrl, quality) || resolveBg360PackDataUrl(packScriptUrl, quality)) ? "ready" : "none";
  }
  if (state && state.status === "loading") {
    if (typeof onReady === "function") state.waiters.push(onReady);
    return "loading";
  }
  if (state && state.status === "error") {
    return "none";
  }

  bg360PackScriptState[packScriptUrl] = {
    status: "loading",
    waiters: typeof onReady === "function" ? [onReady] : []
  };

  var script = document.createElement("script");
  script.src = packScriptUrl;
  script.async = true;
  script.onload = function() {
    var entry = bg360PackScriptState[packScriptUrl];
    if (!entry) return;
    entry.status = "loaded";
    var waiters = entry.waiters.slice();
    entry.waiters.length = 0;
    for (var i = 0; i < waiters.length; i++) {
      try { waiters[i](true); } catch (e) {}
    }
  };
  script.onerror = function() {
    var entry = bg360PackScriptState[packScriptUrl];
    if (!entry) return;
    entry.status = "error";
    var waiters = entry.waiters.slice();
    entry.waiters.length = 0;
    for (var i = 0; i < waiters.length; i++) {
      try { waiters[i](false); } catch (e) {}
    }
  };
  document.body.appendChild(script);
  return "loading";
}

// Включает 360-рендер для equirectangular-фона из JS-пакета или видео и применяет стартовые focus/fov.
function setBackground360(src, fallbackSrc, scrollOptions) {
  if (!src) {
    disableBg360Renderer();
    return;
  }

  var normalized = normalizeBackgroundScrollOptions(scrollOptions);
  var normalizedSrc = normalizeAssetUrl(src);
  var normalizedFallback = normalizeAssetUrl(fallbackSrc || "");
  var isVideo = isVideoAssetPath(normalizedSrc);
  // Сохраняем текущий 360-источник для автосейва, чтобы после F5 не подставлялся
  // «последний обычный» фон из 2D-слоёв.
  bg360Runtime.sourceSrc = normalizedSrc;
  bg360Runtime.blurFallbackSrc = normalizedFallback;
  bg360Runtime.isVideoSource = !!isVideo;
  // На этом шаге auto превращается в normal/mobile с учетом [meta] и текущего устройства.
  var bg360Quality = resolveBg360EffectiveQuality(normalized.quality);
  var selectedPackScriptUrl = getBg360PackScriptUrl(normalizedSrc, bg360Quality);
  var isPackScriptSource = isBg360PackScriptPath(normalizedSrc);
  // Поколение загрузки защищает рестарт и смену фона от старых image/video callbacks.
  var bg360LoadSeq = ++bg360Runtime.loadSeq;
  function isCurrentBg360Load() {
    return bg360LoadSeq === bg360Runtime.loadSeq;
  }
  var deferSwapUntilTexture = bg360Runtime.goto360ParallelZoomActive === true;
  if (deferSwapUntilTexture) {
    bg360Runtime.goto360ParallelZoomActive = false;
  }
  var packedDataUrl = "";
  console.log("[BG360 HOLD] setBackground360 start", {
    src: normalizedSrc,
    fallback: normalizedFallback,
    hadActive360: !!bg360Runtime.active
  });
  if (!isVideo) {
    if (!isPackScriptSource) {
      if (deferSwapUntilTexture) {
        bg360Runtime.goto360ParallelZoomActive = true;
      }
      console.warn("[BG360] 360-фон должен ссылаться на JS-пакет *-360.js:", normalizedSrc);
      return;
    }
    var packState = ensureBg360PackLoaded(normalizedSrc, bg360Quality, function(ok) {
      if (ok && isCurrentBg360Load()) {
        setBackground360(src, fallbackSrc, scrollOptions);
      }
    });
    // Важно: пока пакет подгружается, не трогаем текущие слои, иначе при restore возможен «черный экран».
    if (packState === "loading") {
      if (deferSwapUntilTexture) {
        bg360Runtime.goto360ParallelZoomActive = true;
      }
      return;
    }
    packedDataUrl = resolveBg360PackDataUrl(normalizedSrc, bg360Quality) || resolveBg360PackDataUrl(selectedPackScriptUrl, bg360Quality);
    if (isPackScriptSource && !packedDataUrl) {
      if (deferSwapUntilTexture) {
        bg360Runtime.goto360ParallelZoomActive = true;
      }
      console.warn("[BG360] JS-пакет загружен, но data-url не зарегистрирован:", selectedPackScriptUrl || normalizedSrc);
      return;
    }
  }
  var textureSource = packedDataUrl || normalizedSrc;

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
      console.log("[BG360 HOLD] reuse snapshot after goto360 zoom (skip duplicate capture)");
    } else {
      showBg360HoldFromCurrentFrame();
      console.log("[BG360 HOLD] capture requested before swap");
    }
    disableBackgroundScroll();
    if (elBg) elBg.classList.add("hidden");
    if (elBgVideo) {
      try { elBgVideo.pause(); } catch (e) {}
      elBgVideo.onloadeddata = null;
      elBgVideo.onerror = null;
      elBgVideo.removeAttribute("src");
      elBgVideo.load();
      elBgVideo.classList.add("hidden");
    }
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

  if (packedDataUrl) {
    console.log("[BG360] Используется data-пакет для:", normalizedSrc);
  }

  function onLoadTexture(texture) {
    if (!isCurrentBg360Load()) {
      // Если пользователь успел сделать сброс или включился другой фон, старую текстуру только освобождаем.
      if (texture && typeof texture.dispose === "function") texture.dispose();
      return;
    }
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
      if (elBgVideo) {
        try { elBgVideo.pause(); } catch (e) {}
        elBgVideo.onloadeddata = null;
        elBgVideo.onerror = null;
        elBgVideo.removeAttribute("src");
        elBgVideo.load();
        elBgVideo.classList.add("hidden");
      }
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
    console.log("[BG360 HOLD] reveal decision", {
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
          console.log("[BG360 HOLD] reveal start", {
            revealMs: revealMs,
            computedTransition: window.getComputedStyle(holdEl).transition,
            computedOpacity: window.getComputedStyle(holdEl).opacity
          });
          holdEl.style.opacity = "0";
        });
      });
      bg360Runtime.revealFallbackTimer = setTimeout(function() {
        bg360Runtime.revealFallbackTimer = null;
        if (swapSeqForReveal !== bg360Runtime.loadSeq) {
          resetBg360CanvasRevealStyles();
          return;
        }
        console.log("[BG360 HOLD] reveal fallback fire (cleanup)");
        hideBg360HoldLayer(true);
        resetBg360CanvasRevealStyles();
      }, revealMs + 120);
    }
    if (bg360Runtime.frameId) cancelAnimationFrame(bg360Runtime.frameId);
    bg360Runtime.frameId = requestAnimationFrame(renderBg360Frame);
    if (typeof updateBlurBackground === "function") {
      // Для 360-пакета sourceSrc указывает на JS; blur-слой должен получать только изображение/видео fallback.
      var blurSource = normalizedFallback || "";
      if (!blurSource && !isPackScriptSource) {
        blurSource = normalizedSrc;
      }
      if (blurSource) updateBlurBackground(blurSource);
    }
  }

  function onLoadError() {
    if (!isCurrentBg360Load()) return;
    console.warn("[BG360] Не удалось загрузить ресурс:", normalizedSrc);
    console.warn("[BG360 HOLD] texture load error: hide hold and fallback", {
      src: normalizedSrc,
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
        try { video.pause(); } catch (e) {}
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
        playPromise.catch(function() {});
      }
    };
    video.onerror = onLoadError;
    video.load();
    return;
  }

  // Для file:// TextureLoader может падать из-за CORS (origin null).
  // В этом режиме грузим картинку через HTMLImageElement без crossOrigin и оборачиваем в THREE.Texture вручную.
  if (window.location && window.location.protocol === "file:") {
    if (packedDataUrl) {
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
  if (!packedDataUrl && isEngineImageOptimizationEnabled() && isRasterImagePathForOptimization(src)) {
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
  var normalizedScrollOptions = normalizeBackgroundScrollOptions(scrollOptions);
  var use360 = normalizedScrollOptions.is360 === true;
  if (!src) {
    visualTrace("setBackground:empty-src", { fallbackSrc: fallbackSrc || "" });
    disableBg360Renderer();
    disableBackgroundScroll();
    // Если фоновое видео больше не задано, возвращаем BGM к обычной громкости.
    setBgmDuckingTarget(1, DEFAULT_BGM_DUCKING_RELEASE_MS, 'setBackground empty src');
    // Без фонового видео громкость его канала всегда 0.
    audio.currentBgVideoVolume = 0;
    if (fallbackSrc) {
      setBackground(fallbackSrc, "", null, normalizedScrollOptions);
    }
    return;
  }
  
  var normalizedSrc = normalizeAssetUrl(src);
  var normalizedFallbackSrc = normalizeAssetUrl(fallbackSrc || "");
  var isVideo = isVideoAssetPath(normalizedSrc);

  if (use360) {
    console.log("[BG360 HOLD] setBackground route -> 360");
    setBackground360(normalizedSrc, normalizedFallbackSrc, normalizedScrollOptions);
    return;
  }

  disableBg360Renderer();
  console.log("[BG360 HOLD] setBackground route -> non-360, hide hold");
  hideBg360HoldLayer();
  visualTrace("setBackground:start", {
    src: normalizedSrc,
    fallbackSrc: normalizedFallbackSrc,
    isVideo: isVideo,
    videoVolume: videoVolume
  });

  if (areAllImageCandidatesFailed(src)) {
    if (!failedAssets.images[normalizeAssetUrl(src) + "_logged"]) {
      console.warn('[IMG] skip failed background src:', src);
      failedAssets.images[normalizeAssetUrl(src) + "_logged"] = true;
    }
    disableBackgroundScroll();
    if (isVideo && normalizedFallbackSrc) {
      console.warn('[VIDEO] primary marked as failed, using fallback:', normalizedFallbackSrc);
      visualTrace("bgVideo:already-failed:fallback", {
        src: normalizedSrc,
        fallbackSrc: normalizedFallbackSrc
      });
      hideKeptStoryVideoAfterBgReady("bg video already failed");
      setBackground(normalizedFallbackSrc, "", null, normalizedScrollOptions);
    }
    return;
  }

  if (isVideo) {
    setBackgroundScrollOptions(normalizedScrollOptions, elBgVideo, elNovelWindow);
    if (elBgVideo) {
      elBgVideo.onerror = null;
      elBgVideo.onloadeddata = null;
      // Если volume не задан в [bg], по умолчанию не озвучиваем фоновое видео.
      var resolvedVideoVolume = (typeof videoVolume === "number") ? clamp(videoVolume, 0, 1) : 0;
      visualTrace("bgVideo:set", {
        src: normalizedSrc,
        fallbackSrc: normalizedFallbackSrc,
        volume: resolvedVideoVolume
      });
      audio.currentBgVideoVolume = resolvedVideoVolume;
      elBgVideo.onerror = function() {
        var badVideoSrc = normalizeAssetUrl(elBgVideo.currentSrc || elBgVideo.src || normalizedSrc);
        console.warn('[VIDEO] background load error:', badVideoSrc);
        visualTrace("bgVideo:error", {
          src: badVideoSrc,
          fallbackSrc: normalizedFallbackSrc
        });
        // Ошибка видео: сразу отпускаем ducking, чтобы BGM не оставался приглушённым.
        setBgmDuckingTarget(1, DEFAULT_BGM_DUCKING_RELEASE_MS, 'bg video load error');

        if (badVideoSrc) {
          failedAssets.images[badVideoSrc] = true;
        }

        if (normalizedFallbackSrc) {
          console.warn('[VIDEO] fallback image used:', normalizedFallbackSrc);
          visualTrace("bgVideo:error:fallback-image", {
            fallbackSrc: normalizedFallbackSrc
          });
          hideKeptStoryVideoAfterBgReady("bg video fallback image");
          setBackground(normalizedFallbackSrc, "", null, normalizedScrollOptions);
          return;
        }

        try {
          elBgVideo.pause();
        } catch (e) {}
        elBgVideo.removeAttribute('src');
        elBgVideo.load();
        elBgVideo.classList.add("hidden");
        disableBackgroundScroll();
        visualTrace("bgVideo:error:hidden", { src: badVideoSrc });
        hideKeptStoryVideoAfterBgReady("bg video load error");
      };
      elBgVideo.onloadeddata = function() {
        var currentVideoSrc = normalizeAssetUrl(elBgVideo.currentSrc || elBgVideo.src || "");
        if (currentVideoSrc !== normalizedSrc) return;
        visualTrace("bgVideo:loadeddata", { src: currentVideoSrc });
        // Переключаемся на видео только после успешной загрузки первого кадра.
        if (elBg) {
          elBg.classList.add("hidden");
          visualTrace("bgImage:hidden-before-bgVideo", { nextVideoSrc: currentVideoSrc });
        }
        elBgVideo.classList.remove("hidden");
        visualTrace("bgVideo:shown", { src: currentVideoSrc });
        hideKeptStoryVideoAfterBgReady("bg video loaded");
        syncBlurBackgroundVideo(elBgVideo, normalizedFallbackSrc);
        updateBackgroundScrollAvailability();
        flushAutosaveBgScrollRestorePending();
        // Когда видео реально показано в фоне, пересчитываем ducking с учетом его громкости.
        // Немое фоновое видео не должно приглушать музыку.
        setBgmDuckingForActiveVideos('bg video shown');
      };
      elBgVideo.src = normalizedSrc;
      elBgVideo.addEventListener(
        "loadedmetadata",
        function () {
          flushAutosaveBgScrollRestorePending();
        },
        { once: true }
      );
      visualTrace("bgVideo:src-set", { src: normalizedSrc });
      elBgVideo.loop = true;
      elBgVideo.playsInline = true;
      // Синхронизируем звук bg-video с общими аудио-настройками движка.
      applyAudioSettings();
      var playPromise = elBgVideo.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function (e) {
          console.warn('[VIDEO] background autoplay blocked or failed:', normalizedSrc, e);
          visualTrace("bgVideo:play-failed", { src: normalizedSrc, error: e && e.name ? e.name : String(e) });
        });
      }
    }

    if (typeof updateBlurBackground === 'function') {
      // Пока видео грузится, для blur используем fallback (если задан).
      if (normalizedFallbackSrc) {
        updateBlurBackground(normalizedFallbackSrc);
      }
    }
    return;
  }

  if (elBgVideo) {
    // Переходим с видео на изображение/другой слой: возвращаем BGM к нормальному уровню.
    setBgmDuckingTarget(1, DEFAULT_BGM_DUCKING_RELEASE_MS, 'bg image shown');
    audio.currentBgVideoVolume = 0;
    try {
      elBgVideo.pause();
    } catch (e) {}
    elBgVideo.onloadeddata = null;
    elBgVideo.onerror = null;
    elBgVideo.removeAttribute('src');
    elBgVideo.load();
    elBgVideo.classList.add("hidden");
    visualTrace("bgVideo:hidden-before-bgImage", { imageSrc: normalizedSrc });
  }

  if (elBg) {
    elBg.classList.remove("hidden");
    elBg.onerror = null;
    elBg.onload = null;
    setBackgroundScrollOptions(normalizedScrollOptions, elBg, elNovelWindow);

    visualTrace("bgImage:set", { src: src });
    assignRasterImageToElement(elBg, src, {
      onLoad: function(loadedUrl) {
        visualTrace("bgImage:load", { src: loadedUrl });
        updateBackgroundScrollAvailability();
        flushAutosaveBgScrollRestorePending();
      },
      onAllFailed: function() {
        console.warn('[IMG] background load error:', src);
        visualTrace("bgImage:error", { src: src });
        disableBackgroundScroll();
        elBg.removeAttribute('src');
        elBg.src = "";
      }
    });
    updateBackgroundScrollAvailability();
    visualTrace("bgImage:src-set", { src: src });
  }

  // Обновляем размытый фон тем же изображением
  if (typeof updateBlurBackground === 'function') {
    updateBlurBackground(src);
  }
  
  // Убираем принудительное применение стилей через JS
  // CSS должен работать сам через переменные
}

function setCharacter(src, pos, charId, done, focusOptions) {
  
  // В функции setCharacter, в самом начале добавьте:
  console.log('[setCharacter] ТЕКУЩИЙ ИНДЕКС В НАЧАЛЕ:', state.actionIndex);

  console.log('[Engine setCharacter] START - src:', src, 'charId:', charId);

  console.log('[Engine setCharacter] START ==========');
  console.log('[Engine setCharacter] Параметры:', { src, pos, charId, focusOptions });
  console.log('[Engine setCharacter] elChar ДО:', {
    классы: elChar.classList.toString(),
    src: elChar.src,
    'data-char-id': elChar.dataset.charId,
    скрыт: elChar.classList.contains('hidden')
  });


  // Если это команда скрыть
  if (src === null || src === "" || src === undefined) {
    console.log('[Engine setCharacter] HIDE command received');
    hideAllCharacters();
    if (done) done();
    console.log('[Engine setCharacter] END ==========');
    return;
  }


  console.log('[Engine setCharacter] Called with:', { src, pos, charId, focusOptions });
  console.log('[Engine setCharacter] elChar element:', elChar);

  const seq = ++__charSeq;
  __activeCharSeq = seq;

  var normalizedSrc = normalizeAssetUrl(src);

  if (areAllImageCandidatesFailed(src)) {
    if (!failedAssets.images[normalizeAssetUrl(src) + "_logged"]) {
      console.warn('[CHAR FLOW] skip failed character src', {
        src: src,
        charId: charId
      });
      failedAssets.images[normalizeAssetUrl(src) + "_logged"] = true;
    }

    if (done) {
      setTimeout(done, 0);
    }
    return;
  }

  console.log('[CHAR FLOW] setCharacter:start', {
    seq,
    src,
    pos,
    charId,
    currentSrc: elChar ? elChar.getAttribute('src') : null,
    hidden: elChar ? elChar.classList.contains('hidden') : null,
    currentHeight: elChar ? elChar.style.height : null,
    focusOptions: focusOptions
  });
  logCharacterFocusDebug("setCharacter:start", {
    seq: seq,
    src: src,
    pos: pos,
    charId: charId,
    focusOptions: focusOptions,
    normalizedSrc: normalizedSrc
  });


  if (!src) {
    console.warn('[CHAR FLOW] hide character', {
      src,
      currentDomSrc: elChar.currentSrc || elChar.src,
      hiddenBeforeHide: elChar.classList.contains('hidden'),
      currentHeight: elChar.style.height,
      currentOffsetHeight: elChar.offsetHeight,
      charId: elChar.dataset ? elChar.dataset.charId : null
    });

    console.log('[Engine setCharacter] No src, hiding character');
    elChar.classList.add("hidden");
    elChar.src = "";
    elChar.removeAttribute('data-char-id'); // очищаем ID персонажа
    resetCharacterVisualLayout();

    if (done) done();
    return;
  }

  // Позиция, focus и scale применяются от дефолта, чтобы новый show не наследовал частичные параметры прошлого персонажа.
  var normalizedCharacterFocusOptions = normalizeCharacterFocusOptions(
    mergeCharacterFocusOptions({ pos: pos }, focusOptions),
    CHARACTER_FOCUS_DEFAULTS
  );
  logCharacterFocusDebug("setCharacter:beforeApplyFocus", {
    seq: seq,
    src: src,
    pos: pos,
    charId: charId,
    focusOptions: focusOptions,
    normalizedFocusOptions: normalizedCharacterFocusOptions
  });
  applyCharacterFocusOptions(normalizedCharacterFocusOptions, "setCharacter");




  // ===== проверка на уже видимого персонажа =====
  const currentSrc = elChar.getAttribute('src');
  const currentCharId = elChar.dataset.charId;

  // Если это тот же персонаж с той же эмоцией и он уже видим
  if (imageUrlMatchesStoryCandidates(currentSrc, src) && !elChar.classList.contains('hidden')) {
    console.log('[Engine setCharacter] Same image already visible, scheduling done asynchronously');
    if (elCharFrame) {
      elCharFrame.classList.remove("hidden");
    }
    logCharacterFocusDebug("setCharacter:sameImageVisible", {
      seq: seq,
      src: src,
      currentSrc: currentSrc,
      charId: charId,
      currentCharId: currentCharId,
      normalizedFocusOptions: normalizedCharacterFocusOptions
    });
    if (done) setTimeout(done, 0);  // ← асинхронный вызов
    return;
  }

  // Если это тот же персонаж, но с другой эмоцией - показываем новую эмоцию без перезагрузки
  if (currentCharId === charId && !imageUrlMatchesStoryCandidates(currentSrc, src) && !elChar.classList.contains('hidden')) {
    console.log('[Engine setCharacter] Same character, changing emotion');

    assignRasterImageToElement(elChar, src, {
      seq: seq,
      activeSeq: __activeCharSeq,
      onLoad: function() {
        console.log('[Engine setCharacter] Emotion changed successfully:', src);
        console.log('[setCharacter] onload - ИНДЕКС ДО ВЫЗОВА callback:', state.actionIndex);
        logCharacterFocusDebug("setCharacter:emotionOnLoad", {
          seq: seq,
          src: src,
          charId: charId,
          normalizedFocusOptions: normalizedCharacterFocusOptions
        });
        if (elCharFrame) {
          elCharFrame.classList.remove("hidden");
        }
        elChar.classList.remove("hidden");
        adjustCharacterScale("setCharacter:emotionOnLoad");
        if (done) {
          console.log('[setCharacter] onload - ВЫЗЫВАЕМ done callback');
          done();
          console.log('[setCharacter] onload - ИНДЕКС ПОСЛЕ callback:', state.actionIndex);
        }
      },
      onAllFailed: function() {
        console.log('[Engine setCharacter] Failed to load new emotion:', src);
        if (done) done();
      }
    });
    return; // Не продолжаем в основной код, так как уже обработали
  }
  // ===== =====









  if (charId) {
    elChar.dataset.charId = charId;
  }

  // Скрываем до полной подготовки (только для нового персонажа)
  if (elCharFrame) {
    elCharFrame.classList.add("hidden");
  }
  elChar.classList.add("hidden");
  elChar.style.height = "0px";
  elChar.style.maxHeight = "none";

  elChar.onload = null;
  elChar.onerror = null;

  console.log('[Engine setCharacter] Setting src:', src);
  assignRasterImageToElement(elChar, src, {
    seq: seq,
    activeSeq: __activeCharSeq,
    onLoad: function() {
      console.log('[Engine setCharacter] Image loaded successfully:', src);

      console.log('[CHAR FLOW] onload', {
        seq,
        activeSeq: __activeCharSeq,
        src,
        domSrc: elChar.currentSrc || elChar.src,
        hiddenBeforeShow: elChar.classList.contains('hidden'),
        heightBeforeScale: elChar.style.height
      });
      logCharacterFocusDebug("setCharacter:onLoad:beforeGuards", {
        seq: seq,
        activeSeq: __activeCharSeq,
        src: src,
        charId: charId,
        normalizedFocusOptions: normalizedCharacterFocusOptions
      });

      if (seq !== __activeCharSeq) {
        console.warn('[CHAR FLOW] stale onload ignored', {
          seq,
          activeSeq: __activeCharSeq,
          src
        });
        return;
      }

      if (state.sceneId !== currentSceneId) {
        console.log('[setCharacter] Сцена изменилась с', currentSceneId, 'на', state.sceneId, '- не восстанавливаем индекс');
        if (done) done();
        return;
      }

      if (elCharFrame) {
        elCharFrame.classList.remove("hidden");
      }
      elChar.classList.remove("hidden");
      adjustCharacterScale("setCharacter:onLoad");
      requestAnimationFrame(function() {
        adjustCharacterScale("setCharacter:onLoad:raf");
        logCharacterFocusDebug("setCharacter:onLoad:afterRaf", {
          seq: seq,
          src: src,
          charId: charId,
          normalizedFocusOptions: normalizedCharacterFocusOptions
        });
        if (done) done();
      });
    },
    onAllFailed: function() {
      console.log('[Engine setCharacter] Image failed to load:', src);
      console.log('[CHAR FLOW] onerror', {
        seq,
        activeSeq: __activeCharSeq,
        src: src,
        domSrc: elChar.currentSrc || elChar.src
      });

      if (seq !== __activeCharSeq) {
        return;
      }

      elChar.classList.add("hidden");
      elChar.removeAttribute('src');
      elChar.removeAttribute('data-char-id');
      resetCharacterVisualLayout();

      if (done) done();
    }
  });
}

function showDialog(name, text, color) {
  console.log('[showDialog] НАЧАЛО - waitingNext ДО:', state.waitingNext);
  console.log(
    "[VN] dialog",
    name ? name : "(text)",
    text
  );
  console.log("[VN] dialog display check:", { 
    name: name, 
    text: text, 
    isFirstDialog: isFirstDialog,
    elNameHidden: elName.classList.contains('hidden'),
    elTextContent: elText.textContent
  });

  // ДОБАВЛЯЕМ ВРЕМЕННУЮ МЕТКУ
  console.log("[VN] TIMESTAMP:", Date.now(), "ms - Показ диалога:", text.substring(0, 30) + "...");

  var dialogElement = document.getElementById('dialog');

  // Имя показываем ВСЕГДА, если оно есть
  if (name && String(name).trim() !== "") {
    console.log('[showDialog] ПОКАЗЫВАЕМ ИМЯ:', name);
    console.log('[showDialog] До применения классов:', elName.classList.toString());

    



    elName.textContent = name;
    elName.classList.remove("hidden");

    // Добавляем защиту от скрытия
    elName.setAttribute('data-protected', 'true');

    console.log('[showDialog] После применения классов:', elName.classList.toString());
    console.log('[showDialog] display CSS:', window.getComputedStyle(elName).display);

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
            console.log('[showDialog] КЛАСС ИЗМЕНИЛСЯ НА:', elName.className);
            
            // Если имя должно быть видимо, но его скрыли - восстанавливаем
            if (elName.hasAttribute('data-protected') && elName.classList.contains('hidden')) {
              console.log('[showDialog] ВОССТАНАВЛИВАЕМ имя от скрытия!');
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
  console.log('[showDialog] КОНЕЦ - waitingNext ПОСЛЕ:', state.waitingNext);
}



function showError(text) {
  setBackground(""); // не обязательно
  setCharacter(null);
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

// Измеряет кнопки fit-меню, разбивает их на строки и растягивает каждую строку на всю ширину списка.
function applyFitChoiceLayout(list) {
  if (!list || !list.parentNode || elChoices.classList.contains("hidden")) return;

  var buttons = Array.prototype.slice.call(list.querySelectorAll(".choiceBtn"));
  if (!buttons.length) return;

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
  if (containerWidth <= 0) return;

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

var STORY_VIDEO_DEFAULT_FALLBACK_DURATION = 5;
var STORY_VIDEO_SEEK_TIMEOUT_MS = 2500;
var STORY_VIDEO_SKIP_GUARD_MS = 450;
var storyVideoRuntime = {
  action: null,
  done: false,
  fallback: false,
  skipAllowed: true,
  skipEnabledAt: 0,
  keepUntilBgVideoReady: false,
  seekTimer: null,
  stopTimer: null,
  fallbackTimer: null
};

function clearStoryVideoTimers() {
  // Все варианты выхода чистят таймеры одинаково, чтобы старые события не продвинули новое видео.
  if (storyVideoRuntime.seekTimer) {
    clearTimeout(storyVideoRuntime.seekTimer);
    storyVideoRuntime.seekTimer = null;
  }
  if (storyVideoRuntime.stopTimer) {
    clearTimeout(storyVideoRuntime.stopTimer);
    storyVideoRuntime.stopTimer = null;
  }
  if (storyVideoRuntime.fallbackTimer) {
    clearTimeout(storyVideoRuntime.fallbackTimer);
    storyVideoRuntime.fallbackTimer = null;
  }
}

function resetStoryVideoMediaHandlers() {
  // Обработчики очищаются перед повторным использованием одного video-элемента.
  if (!elStoryVideo) return;
  elStoryVideo.onloadedmetadata = null;
  elStoryVideo.onloadeddata = null;
  elStoryVideo.onseeked = null;
  elStoryVideo.ontimeupdate = null;
  elStoryVideo.onended = null;
  elStoryVideo.onerror = null;
}

function normalizeStoryVideoFit(fit) {
  var value = String(fit || "cover").toLowerCase();
  return value === "contain" ? "contain" : "cover";
}

function applyStoryVideoFit(fit) {
  // Один и тот же fit применяется к видео и постеру, чтобы fallback не менял композицию.
  var objectFit = normalizeStoryVideoFit(fit);
  if (elStoryVideo) elStoryVideo.style.objectFit = objectFit;
  if (elStoryVideoPoster) elStoryVideoPoster.style.objectFit = objectFit;
}

function setStoryVideoSkipHint(text, visible) {
  if (!elStoryVideoSkipHint) return;
  // Подстановка переменных в skipText делает подсказку синхронной с состоянием сценарных vars.
  elStoryVideoSkipHint.textContent = renderTextVars(String(text || t("videoSkipHint") || "Click to skip"));
  elStoryVideoSkipHint.classList.toggle("hidden", !visible);
}

function showStoryVideoPoster(posterSrc, fit) {
  // Постер используется и во время подготовки ролика, и как fallback-картинка.
  if (!elStoryVideoPoster) return;
  applyStoryVideoFit(fit);
  elStoryVideoPoster.onload = null;
  if (posterSrc) {
    elStoryVideoPoster.onload = function () {
      if (backgroundScroll.owner === "storyVideo" && backgroundScroll.target === elStoryVideoPoster) {
        updateBackgroundScrollAvailability();
      }
    };
    elStoryVideoPoster.src = posterSrc;
    elStoryVideoPoster.classList.remove("hidden");
    switchStoryVideoScrollTarget(elStoryVideoPoster);
    if (typeof updateBlurBackground === "function") updateBlurBackground(posterSrc);
  } else {
    elStoryVideoPoster.removeAttribute("src");
    elStoryVideoPoster.classList.add("hidden");
  }
}

function cleanupStoryVideoVisualOnly() {
  visualTrace("storyVideo:cleanup:start", {});
  storyVideoRuntime.keepUntilBgVideoReady = false;
  // Визуальная очистка отделена от finishStoryVideo(), чтобы рестарт не продолжал сцену.
  clearStoryVideoTimers();
  resetStoryVideoMediaHandlers();

  if (elStoryVideo) {
    try {
      elStoryVideo.pause();
    } catch (e) {}
    elStoryVideo.removeAttribute("src");
    elStoryVideo.load();
    elStoryVideo.classList.add("hidden");
  }

  if (elStoryVideoPoster) {
    elStoryVideoPoster.onload = null;
    elStoryVideoPoster.removeAttribute("src");
    elStoryVideoPoster.classList.add("hidden");
  }

  if (elStoryVideoFallbackText) {
    elStoryVideoFallbackText.classList.add("hidden");
  }

  setStoryVideoSkipHint("", false);
  if (elStoryVideoOverlay) elStoryVideoOverlay.classList.add("hidden");
  restoreBackgroundScrollAfterStoryVideo();

  audio.currentStoryVideoVolume = 0;
  applyAudioSettings();
  visualTrace("storyVideo:cleanup:end", {});
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
  // Новый видео-фон уже готов, поэтому можно убрать слой сюжетного видео без вспышки старой картинки.
  if (!storyVideoRuntime.keepUntilBgVideoReady) return;
  visualTrace("storyVideo:kept-layer-hide", { reason: reason || "bg ready" });
  cleanupStoryVideoVisualOnly();
  console.log("[VIDEO] kept story video layer hidden:", reason || "bg ready");
}

function finishStoryVideo(reason) {
  // Сюжетное видео автоматически продолжает список команд после ended, stop, skip или fallback-таймаута.
  if (storyVideoRuntime.done) return;
  storyVideoRuntime.done = true;

  var keepUntilBgVideoReady = nextActionIsBackgroundVideo();
  visualTrace("storyVideo:finish", {
    reason: reason || "done",
    keepUntilBgVideoReady: keepUntilBgVideoReady
  });
  if (keepUntilBgVideoReady) {
    clearStoryVideoTimers();
    resetStoryVideoMediaHandlers();
    storyVideoRuntime.keepUntilBgVideoReady = true;
    visualTrace("storyVideo:keep-until-bg-video", { reason: reason || "done" });
    setStoryVideoSkipHint("", false);
    if (elStoryVideoFallbackText) elStoryVideoFallbackText.classList.add("hidden");
    if (elStoryVideo) {
      try {
        elStoryVideo.pause();
      } catch (e) {}
    }
    audio.currentStoryVideoVolume = 0;
    applyAudioSettings();
  } else {
    cleanupStoryVideoVisualOnly();
  }
  state.inVideo = false;
  state.waitingNext = false;
  state.nextLocked = false;
  setBgmDuckingForActiveVideos("story video finished: " + (reason || "done"));

  autosaveDebugLog("finishStoryVideo:before_runCurrent", {
    reason: reason || "done",
    sceneId: state.sceneId,
    actionIndex: state.actionIndex
  });

  // Синхронно, как после closeGame: иначе pagehide между тиками сохраняет неконсистентный next/waiting.
  runCurrent();

  autosaveDebugLog("finishStoryVideo:after_runCurrent", {
    sceneId: state.sceneId,
    actionIndex: state.actionIndex,
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked,
    elTextLen: elText ? String(elText.textContent || "").length : -1
  });

  flushAutosaveToStorageSync();
  lastNextTime = 0;
}

function showStoryVideoFallback(action, reason) {
  // Аварийный показ всегда ограничен по времени и пропускается, даже если исходное видео нельзя пропустить.
  if (storyVideoRuntime.done) return;
  clearStoryVideoTimers();
  resetStoryVideoMediaHandlers();

  var fallbackDuration = Math.max(
    0.1,
    Number(action && action.fallbackDuration !== undefined ? action.fallbackDuration : STORY_VIDEO_DEFAULT_FALLBACK_DURATION)
  );
  var posterSrc = normalizeAssetUrl((action && action.poster) || "");
  var skipText = (action && action.skipText) || t("videoSkipHint") || "Click to skip";
  visualTrace("storyVideo:fallback", {
    reason: reason || "fallback",
    posterSrc: posterSrc,
    fallbackDuration: fallbackDuration
  });

  storyVideoRuntime.fallback = true;
  storyVideoRuntime.skipAllowed = true;
  storyVideoRuntime.skipEnabledAt = Date.now();
  audio.currentStoryVideoVolume = 0;
  applyAudioSettings();
  setBgmDuckingForActiveVideos("story video fallback: " + (reason || "fallback"));

  if (elStoryVideo) {
    try {
      elStoryVideo.pause();
    } catch (e) {}
    elStoryVideo.classList.add("hidden");
  }

  if (elStoryVideoOverlay) elStoryVideoOverlay.classList.remove("hidden");
  showStoryVideoPoster(posterSrc, action && action.fit);

  if (elStoryVideoFallbackText) {
    elStoryVideoFallbackText.textContent = posterSrc ? "" : (t("videoUnavailable") || "Video unavailable");
    elStoryVideoFallbackText.classList.toggle("hidden", !!posterSrc);
  }

  setStoryVideoSkipHint(skipText, true);
  storyVideoRuntime.fallbackTimer = setTimeout(function () {
    finishStoryVideo("fallback timeout");
  }, fallbackDuration * 1000);
}

function startStoryVideoPlayback(action) {
  // Проигрывание начинается только после metadata/seek, иначе фрагменты start были бы ненадежны.
  if (!elStoryVideo || storyVideoRuntime.done) return;

  var volume = clamp(typeof action.volume === "number" ? action.volume : 0, 0, 1);
  var stopAt = typeof action.stop === "number" ? action.stop : null;

  storyVideoRuntime.fallback = false;
  audio.currentStoryVideoVolume = volume;
  applyAudioSettings();
  if (volume > 0) setBgmDuckingForActiveVideos("story video shown");

  if (elStoryVideoPoster) elStoryVideoPoster.classList.add("hidden");
  if (elStoryVideoFallbackText) elStoryVideoFallbackText.classList.add("hidden");
  elStoryVideo.classList.remove("hidden");
  switchStoryVideoScrollTarget(elStoryVideo);
  updateBackgroundScrollAvailability();
  visualTrace("storyVideo:playback-start", {
    src: normalizeAssetUrl(elStoryVideo.currentSrc || elStoryVideo.src || ""),
    currentTime: Number(elStoryVideo.currentTime.toFixed(3)),
    stopAt: stopAt,
    volume: volume
  });

  if (stopAt !== null) {
    var msLeft = Math.max(0, (stopAt - elStoryVideo.currentTime) * 1000);
    storyVideoRuntime.stopTimer = setTimeout(function () {
      finishStoryVideo("stop reached");
    }, msLeft + 80);
  }

  elStoryVideo.ontimeupdate = function () {
    if (stopAt !== null && elStoryVideo.currentTime >= stopAt) {
      finishStoryVideo("stop reached");
    }
  };

  var playPromise = elStoryVideo.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.then(function () {
      visualTrace("storyVideo:play-resolved", {
        src: normalizeAssetUrl(elStoryVideo.currentSrc || elStoryVideo.src || "")
      });
    }).catch(function (err) {
      console.warn("[VIDEO] story video play failed:", err);
      visualTrace("storyVideo:play-failed", { error: err && err.name ? err.name : String(err) });
      showStoryVideoFallback(action, "play failed");
    });
  }
}

function prepareStoryVideoSeek(action) {
  // Браузеры разрешают seek только после metadata; таймаут переводит зависший seek в poster-fallback.
  if (!elStoryVideo || storyVideoRuntime.done) return;

  var startAt = typeof action.start === "number" ? action.start : 0;
  var duration = elStoryVideo.duration;
  visualTrace("storyVideo:metadata", {
    startAt: startAt,
    stop: typeof action.stop === "number" ? action.stop : null,
    duration: isFinite(duration) ? Number(duration.toFixed(3)) : null
  });

  if (startAt > 0 && isFinite(duration) && startAt >= duration) {
    showStoryVideoFallback(action, "start beyond duration");
    return;
  }

  if (startAt <= 0) {
    startStoryVideoPlayback(action);
    return;
  }

  storyVideoRuntime.seekTimer = setTimeout(function () {
    visualTrace("storyVideo:seek-timeout", { startAt: startAt });
    showStoryVideoFallback(action, "seek timeout");
  }, STORY_VIDEO_SEEK_TIMEOUT_MS);

  elStoryVideo.onseeked = function () {
    if (storyVideoRuntime.seekTimer) {
      clearTimeout(storyVideoRuntime.seekTimer);
      storyVideoRuntime.seekTimer = null;
    }
    visualTrace("storyVideo:seeked", {
      currentTime: Number(elStoryVideo.currentTime.toFixed(3))
    });
    startStoryVideoPlayback(action);
  };

  try {
    visualTrace("storyVideo:seek-start", { startAt: startAt });
    elStoryVideo.currentTime = startAt;
  } catch (e) {
    console.warn("[VIDEO] story video seek failed:", e);
    visualTrace("storyVideo:seek-failed", { error: e && e.name ? e.name : String(e) });
    showStoryVideoFallback(action, "seek failed");
  }
}

function startStoryVideo(action) {
  // Команда video показывает полноэкранную вставку; при scroll разрешает двигать ролик/постер по горизонтали.
  if (!action || !action.src || !elStoryVideoOverlay || !elStoryVideo) {
    console.warn("[VIDEO] story video skipped: missing DOM or src", action);
    state.inVideo = false;
    state.nextLocked = false;
    runCurrent();
    return;
  }

  cleanupStoryVideoVisualOnly();

  var videoStepIdx = state.actionIndex - 1;
  if (videoStepIdx >= 0) {
    var scVid = state.sceneMap[state.sceneId];
    var actVid = scVid && scVid.actions ? scVid.actions[videoStepIdx] : null;
    if (actVid && actVid.type === "video") {
      var vidCheckpoint = buildAutosavePayload({ persistActionIndex: videoStepIdx });
      if (vidCheckpoint) {
        autosaveDebugLog("checkpoint:video_written", { persistActionIndex: videoStepIdx });
        flushAutosaveToStorageSync(vidCheckpoint);
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
  storyVideoRuntime.action = action;
  storyVideoRuntime.done = false;
  storyVideoRuntime.fallback = false;
  storyVideoRuntime.skipAllowed = action.skippable !== false;
  storyVideoRuntime.skipEnabledAt = Date.now() + STORY_VIDEO_SKIP_GUARD_MS;

  var src = normalizeAssetUrl(action.src);
  var posterSrc = normalizeAssetUrl(action.poster || "");
  var fit = normalizeStoryVideoFit(action.fit);
  var skipText = action.skipText || t("videoSkipHint") || "Click to skip";
  visualTrace("storyVideo:start", {
    src: src,
    posterSrc: posterSrc,
    fit: fit,
    skippable: storyVideoRuntime.skipAllowed,
    skipEnabledAt: storyVideoRuntime.skipEnabledAt
  });

  applyStoryVideoFit(fit);
  elStoryVideoOverlay.classList.remove("hidden");
  setStoryVideoScrollOptions(
    mergeMediaFocusOptions(action.scroll, action.focusX, action.scale, action.focusY),
    posterSrc ? elStoryVideoPoster : elStoryVideo
  );
  showStoryVideoPoster(posterSrc, fit);
  setStoryVideoSkipHint(skipText, storyVideoRuntime.skipAllowed);

  resetStoryVideoMediaHandlers();
  elStoryVideo.loop = false;
  elStoryVideo.playsInline = true;
  elStoryVideo.preload = "auto";
  elStoryVideo.classList.add("hidden");

  elStoryVideo.onerror = function () {
    console.warn("[VIDEO] story video load error:", src);
    visualTrace("storyVideo:error", { src: src });
    showStoryVideoFallback(action, "load error");
  };
  elStoryVideo.onended = function () {
    visualTrace("storyVideo:ended", {
      currentTime: Number(elStoryVideo.currentTime.toFixed(3))
    });
    finishStoryVideo("ended");
  };
  elStoryVideo.onloadeddata = function () {
    visualTrace("storyVideo:loadeddata", {
      currentTime: Number(elStoryVideo.currentTime.toFixed(3)),
      readyState: elStoryVideo.readyState
    });
    if (typeof syncBlurBackgroundVideo === "function") {
      syncBlurBackgroundVideo(elStoryVideo, posterSrc);
    }
    if (backgroundScroll.owner === "storyVideo" && backgroundScroll.target === elStoryVideo) {
      updateBackgroundScrollAvailability();
    }
  };
  elStoryVideo.onloadedmetadata = function () {
    prepareStoryVideoSeek(action);
  };

  audio.currentStoryVideoVolume = 0;
  applyAudioSettings();
  elStoryVideo.src = src;
  visualTrace("storyVideo:src-set", { src: src });
  elStoryVideo.load();
}

function handleStoryVideoSkip(e) {
  if (!state.inVideo) return;
  if (backgroundScroll.owner === "storyVideo" && backgroundScroll.dragging && e && e.type === "pointerup") {
    handleBackgroundScrollPointerUp(e);
  }
  if (backgroundScroll.suppressClick) {
    backgroundScroll.suppressClick = false;
    swallowEvent(e);
    return;
  }
  if (Date.now() < (storyVideoRuntime.skipEnabledAt || 0)) {
    visualTrace("storyVideo:skip-guard", {
      now: Date.now(),
      skipEnabledAt: storyVideoRuntime.skipEnabledAt
    });
    swallowEvent(e);
    return;
  }
  if (!storyVideoRuntime.skipAllowed && !storyVideoRuntime.fallback) return;
  swallowEvent(e);
  visualTrace("storyVideo:skip", { fallback: storyVideoRuntime.fallback });
  finishStoryVideo("skip");
}

if (elStoryVideoOverlay) {
  ["pointerup", "click", "touchend"].forEach(function (type) {
    elStoryVideoOverlay.addEventListener(type, handleStoryVideoSkip, true);
  });
}

document.addEventListener("keydown", function (e) {
  if (!state.inVideo) return;
  var key = e.key || "";
  if (key === "Escape" || key === "Enter" || key === " ") {
    handleStoryVideoSkip(e);
  }
}, true);

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

// Собирает action для URL-запуска из [game], сохраняя тот же контракт, что у сценарной команды game.
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

  closeGameFrameVisualOnly();
  state.inGame = false;
  state.currentGame = null;
  startStandaloneGameFromUrl();
}

// Проверяет, что сюжетная кнопка модалки сейчас обслуживает автономную игру из URL.
function isCurrentStoryGameUrlMode() {
  return !!(state && state.currentGame && state.currentGame.mode === "url");
}

function openGame(action) {
  if (!action || !action.src) {
    console.warn('[GAME] openGame: missing action.src', action);
    return;
  }

  // Пока inGame=true, buildAutosavePayload не пишет слот — фиксируем индекс шага «game» до открытия модалки.
  var gameStepIdx = state.actionIndex - 1;
  if (gameStepIdx >= 0) {
    var scGame = state.sceneMap[state.sceneId];
    var actGame = scGame && scGame.actions ? scGame.actions[gameStepIdx] : null;
    if (actGame && actGame.type === "game") {
      var checkpoint = buildAutosavePayload({ persistActionIndex: gameStepIdx });
      if (checkpoint) {
        autosaveDebugLog("checkpoint:game_written", { persistActionIndex: gameStepIdx });
        flushAutosaveToStorageSync(checkpoint);
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

  state.inGame = true;
  state.currentGame = {
    mode: action.mode || null,
    gameId: action.gameId || 'game',
    title: action.title || action.gameId || 'game',
    difficulty: normalizedParams.difficulty,
    src: action.src,
    resultVar: action.resultVar || null,
    params: normalizedParams
  };

  updateStoryGameControlButtonLabel(state.currentGame.mode);
  elGameModal.classList.remove("hidden");

  // Загружаем игру в iframe
  elGameFrame.src = action.mode === "url"
    ? appendGameParamsToUrl(action.src, normalizedParams)
    : action.src;

  // После загрузки iframe отправляем в игру все named params
  elGameFrame.onload = function () {
    if (!state.currentGame) return;

    var payload = {
      type: 'gameInit',
      gameId: state.currentGame.gameId
    };

    var params = state.currentGame.params || {};
    for (var key in params) {
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        payload[key] = params[key];
      }
    }

    try {
      elGameFrame.contentWindow.postMessage(payload, '*');
      console.log('[GAME] gameInit sent:', payload);
    } catch (e) {
      console.error('[GAME] failed to send gameInit', e);
    }
  };
}

function closeGame(resultData) {
  var finishedGame = state.currentGame;
  var manualClose = !!(resultData && resultData.manualClose === true);
  var resultValue = 0;

  if (resultData) {
    if (typeof resultData.result === "number") {
      resultValue = resultData.result;
    } else if (!isNaN(Number(resultData.result))) {
      resultValue = Number(resultData.result);
    }
  }

  if (finishedGame && finishedGame.mode === "url" && !manualClose) {
    // В URL-режиме у новеллы нет точки возврата, поэтому результат только запоминаем и оставляем окно игры открытым.
    finishedGame.result = resultValue;
    finishedGame.finished = true;
    console.log("[GAME] url game result received:", {
      gameId: finishedGame.gameId,
      difficulty: finishedGame.difficulty,
      result: resultValue
    });
    return;
  }

  if (finishedGame && finishedGame.mode === "stats") {
    closeStatsGameFrameVisualOnly();
  } else {
    closeGameFrameVisualOnly();
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
    return;
  }

  // Обычный сюжетный режим игры
  if (finishedGame.resultVar) {
    state.vars[finishedGame.resultVar] = resultValue;
    console.log("[GAME] result saved:", finishedGame.resultVar, "=", resultValue);
  }

  state.currentGame = null;
  state.waitingNext = false;
  state.nextLocked = false;

  autosaveDebugLog("closeGame:before_runCurrent", {
    sceneId: state.sceneId,
    actionIndex: state.actionIndex,
    resultVar: finishedGame.resultVar,
    resultValue: finishedGame.resultVar ? state.vars[finishedGame.resultVar] : undefined,
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

  flushAutosaveToStorageSync();
  // Закрытие модалки по кнопке задаёт lastNextTime — снимаем охладитель, чтобы первый клик по диалогу прошёл.
  lastNextTime = 0;
}

function closeGameFrameVisualOnly() {
  elGameModal.classList.add("hidden");
  elGameFrame.onload = null;
  elGameFrame.src = "about:blank";
  updateStoryGameControlButtonLabel(null);
}

function closeStatsGameFrameVisualOnly() {
  elStatsGameModal.classList.add("hidden");

  if (elStatsGameFrameWrap) {
    elStatsGameFrameWrap.style.left = "";
    elStatsGameFrameWrap.style.top = "";
    elStatsGameFrameWrap.style.width = "";
    elStatsGameFrameWrap.style.height = "";
  }

  elStatsGameFrame.onload = null;
  elStatsGameFrame.src = "about:blank";
}

// =========================================================
//                   АУДИО
// =========================================================

function setAudioFromStoryDefaults() {

  if (STORY.audioSettings) {

    if (typeof STORY.audioSettings.masterVolume === "number") {
      audio.masterVolume = clamp(STORY.audioSettings.masterVolume, 0, 1);
    }

    if (typeof STORY.audioSettings.muted === "boolean") {
      audio.muted = STORY.audioSettings.muted;
    }

  }

  // установить положение слайдера
  sliderVolume.value = Math.round(audio.masterVolume * 100);

  // применить громкость
  applyAudioSettings();

  // обновить кнопку
  updateMuteIcon();
}

function updateMuteIcon() {
  let icon = btnMute.querySelector('.btn-icon');

  if (!icon) {
    btnMute.innerHTML = "<span class='btn-icon'></span>";
    icon = btnMute.querySelector('.btn-icon');
  }

  icon.textContent = audio.muted ? "🔇" : "🔊";
}

function applyAudioSettings() {
  // общий volume применяется к обоим каналам
  var v = audio.muted ? 0 : audio.masterVolume;

  // ВАЖНО: индивидуальная громкость треков умножается на master
  // Поэтому тут ставим базово master, а конкретную громкость задаём в playBgm/playSfx.
  // Но чтобы не усложнять, мы держим "currentBgmVolume" отдельно.
  // Ducking применяется только к BGM и плавно меняется отдельной функцией.
  audio.bgm.volume = clamp((audio.currentBgmVolume != null ? audio.currentBgmVolume : 0.7) * v * (audio.bgmDuckingMultiplier != null ? audio.bgmDuckingMultiplier : 1), 0, 1);
  audio.sfx.volume = clamp((audio.currentSfxVolume != null ? audio.currentSfxVolume : 1) * v, 0, 1);
  // Фоновое видео имеет собственный множитель volume (из [bg]) относительно master.
  if (elBgVideo) {
    var videoMultiplier = clamp((audio.currentBgVideoVolume != null ? audio.currentBgVideoVolume : 0), 0, 1);
    var effectiveVideoVolume = clamp(v * videoMultiplier, 0, 1);
    elBgVideo.muted = audio.muted || effectiveVideoVolume <= 0;
    elBgVideo.volume = effectiveVideoVolume;
  }

  if (elStoryVideo) {
    // Сюжетное видео имеет громкость команды, но все равно подчиняется master/mute.
    var storyVideoMultiplier = clamp((audio.currentStoryVideoVolume != null ? audio.currentStoryVideoVolume : 0), 0, 1);
    var effectiveStoryVideoVolume = clamp(v * storyVideoMultiplier, 0, 1);
    elStoryVideo.muted = audio.muted || effectiveStoryVideoVolume <= 0;
    elStoryVideo.volume = effectiveStoryVideoVolume;
  }

  logAudioState('applyAudioSettings');
}

// ---------- BGM ducking ----------
// Константы ducking вынесены в начало аудио-блока, чтобы не попасть в TDZ при раннем вызове bg.
// Плавно переводит множитель ducking к целевому значению.
function setBgmDuckingTarget(targetMultiplier, fadeMs, reason) {
  var target = clamp(typeof targetMultiplier === "number" ? targetMultiplier : 1, 0, 1);
  var duration = Math.max(0, Math.floor(typeof fadeMs === "number" ? fadeMs : 0));

  if (audio.bgmDuckingTimer) {
    clearInterval(audio.bgmDuckingTimer);
    audio.bgmDuckingTimer = null;
  }

  var start = clamp(typeof audio.bgmDuckingMultiplier === "number" ? audio.bgmDuckingMultiplier : 1, 0, 1);
  if (duration === 0 || Math.abs(start - target) < 0.0001) {
    audio.bgmDuckingMultiplier = target;
    applyAudioSettings();
    console.log('[AUDIO] ducking set immediately', { reason: reason, target: target });
    return;
  }

  var steps = Math.max(1, Math.floor(duration / 25));
  var stepTime = Math.max(20, Math.floor(duration / steps));
  var i = 0;

  audio.bgmDuckingTimer = setInterval(function () {
    i++;
    var t = i / steps;
    audio.bgmDuckingMultiplier = lerp(start, target, t);
    applyAudioSettings();

    if (i >= steps) {
      clearInterval(audio.bgmDuckingTimer);
      audio.bgmDuckingTimer = null;
      audio.bgmDuckingMultiplier = target;
      applyAudioSettings();
      console.log('[AUDIO] ducking transition completed', { reason: reason, target: target });
    }
  }, stepTime);
}

// ---------- Помощники ducking для активных видео ----------
function isAudibleBackgroundVideoActive() {
  // Ducking фонового видео активен, пока видимый видео-фон имеет ненулевую громкость.
  return !!(
    elBgVideo &&
    !elBgVideo.classList.contains("hidden") &&
    (audio.currentBgVideoVolume || 0) > 0 &&
    (elBgVideo.currentSrc || elBgVideo.src)
  );
}

function setBgmDuckingForActiveVideos(reason) {
  // Сюжетные и фоновые видео делят ducking-канал, поэтому отпускаем BGM только когда нет звучащих видео.
  var hasAudibleStoryVideo = !!(state.inVideo && (audio.currentStoryVideoVolume || 0) > 0);
  var shouldDuck = hasAudibleStoryVideo || isAudibleBackgroundVideoActive();
  setBgmDuckingTarget(
    shouldDuck ? DEFAULT_BGM_DUCKING_MULTIPLIER : 1,
    shouldDuck ? DEFAULT_BGM_DUCKING_ATTACK_MS : DEFAULT_BGM_DUCKING_RELEASE_MS,
    reason
  );
}

// Возобновляет фоновое видео после жеста пользователя, если звук интерфейса уже включен.
function resumeBackgroundVideoIfNeeded(reason) {
  if (!elBgVideo) return;
  if (!elBgVideo.src) return;
  if (elBgVideo.classList.contains("hidden")) return;
  if (audio.muted || audio.masterVolume <= 0) return;

  applyAudioSettings();

  try {
    var p = elBgVideo.play();
    if (p && typeof p.then === "function") {
      p.then(function () {
        console.log('[VIDEO] background play() success, reason =', reason);
      }).catch(function (err) {
        console.log('[VIDEO] background play() blocked/failed, reason =', reason, err);
      });
    }
  } catch (e) {
    console.log('[VIDEO] background play() exception, reason =', reason, e);
  }
}

function logAudioState(label) {
  console.log('[AUDIO STATE]', label, {
    muted: audio.muted,
    masterVolume: audio.masterVolume,
    currentBgmVolume: audio.currentBgmVolume,
    bgmVolume: audio.bgm ? audio.bgm.volume : null,
    bgmSrc: audio.bgm ? audio.bgm.src : null,
    bgmPaused: audio.bgm ? audio.bgm.paused : null,
    bgmEnded: audio.bgm ? audio.bgm.ended : null,
    bgmCurrentTime: audio.bgm ? audio.bgm.currentTime : null,
    bgmReadyState: audio.bgm ? audio.bgm.readyState : null,
    bgmNetworkState: audio.bgm ? audio.bgm.networkState : null
  });
}

function resumeBgmIfNeeded(reason) {
  logAudioState('before resumeBgmIfNeeded: ' + reason);

  if (!audio || !audio.bgm) {
    console.log('[AUDIO] resume skipped: no audio.bgm');
    return;
  }
  if (audio.muted) {
    console.log('[AUDIO] resume skipped: muted');
    return;
  }
  if (!audio.bgm.src) {
    console.log('[AUDIO] resume skipped: no src');
    return;
  }

  var currentSrc = normalizeAssetUrl(audio.bgm.currentSrc || audio.bgm.src || "");
  if (currentSrc && failedAssets.audio[currentSrc]) {
    console.log('[AUDIO] resume skipped: failed src', currentSrc);
    return;
  }

  try {
    var p = audio.bgm.play();
    console.log('[AUDIO] resume play() called, reason =', reason);

    if (p && typeof p.then === "function") {
      p.then(function () {
        console.log('[AUDIO] resume play() success, reason =', reason);
        logAudioState('after resume success: ' + reason);
      }).catch(function (err) {
        console.log('[AUDIO] resume play() blocked/failed, reason =', reason, err);
        logAudioState('after resume fail: ' + reason);
      });
    }
  } catch (e) {
    console.log('[AUDIO] resume play() exception, reason =', reason, e);
  }
}

const DEFAULT_BGM_VOLUME = 0.2;

function playBgm(src, loop, vol, fadeMs) {

  console.log('[AUDIO] playBgm called', {
    src: src,
    loop: loop,
    vol: vol,
    fadeMs: fadeMs
  });
  logAudioState('playBgm start');

  if (!src) return;

  var normalizedSrc = normalizeAssetUrl(src);

  var currentSrc = normalizeAssetUrl(audio.bgm.currentSrc || audio.bgm.src || "");

  if (failedAssets.audio[normalizedSrc] || failedAssets.audio[currentSrc]) { 
    console.warn('[AUDIO] skip failed bgm src:', normalizedSrc);
    return;
  }

  audio.bgm.loop = loop !== false; // по умолчанию true
  audio.currentBgmVolume = clamp((typeof vol === "number" ? vol : DEFAULT_BGM_VOLUME), 0, 1);
  console.log('[AUDIO] playBgm currentBgmVolume set to', audio.currentBgmVolume);

  // Если тот же трек — просто обновим громкость/loop
  if (audio.bgm.src && endsWith(audio.bgm.src, normalizedSrc)) {
    console.log('[AUDIO] playBgm same track detected');
    applyAudioSettings();


    // Если это тот же трек, но он по какой-то причине не играет,
    // пробуем возобновить воспроизведение.
    if (!audio.muted && audio.bgm.paused) {
      resumeBgmIfNeeded('playBgm same track');
    }

    return;
  }

  // Плавная смена (по желанию)
  if (fadeMs && fadeMs > 0 && !audio.muted) {
    crossfadeToBgm(normalizedSrc, fadeMs);
    return;
  }

  // Быстрая смена
  try {
    audio.bgm.pause();
    audio.bgm.src = normalizedSrc;
    audio.bgm.currentTime = 0;
    applyAudioSettings();
    // В некоторых окружениях автозапуск может быть заблокирован до первого клика.
    // Но на интерактивном экране обычно пользователь кликает — после клика заведётся.
    var p = audio.bgm.play();
    console.log('[AUDIO] playBgm quick play() called');

    if (p && typeof p.then === "function") {
      p.then(function () {
        console.log('[AUDIO] playBgm quick play() success');
        logAudioState('playBgm quick success');
      }).catch(function (err) {
        console.log('[AUDIO] playBgm quick play() blocked/failed', err);
        logAudioState('playBgm quick fail');
      });
    }

  } catch (e) {
    // игнор
  }
}

function stopBgmImmediate() {
  try {
    audio.bgm.pause();
    audio.bgm.src = "";
    audio.bgm.currentTime = 0;
  } catch (e) {}
}

function crossfadeToBgm(newSrc, fadeMs) {
  // Простой кроссфейд без WebAudio:
  // 1) приглушаем текущую BGM до 0
  // 2) переключаем src и поднимаем громкость
  clearInterval(audio.fadeTimer);

  var steps = 20;
  var stepTime = Math.max(20, Math.floor(fadeMs / steps));

  var master = audio.muted ? 0 : audio.masterVolume;
  var target = clamp(audio.currentBgmVolume * master, 0, 1);
  var i = 0;

  // текущая громкость
  var startVol = audio.bgm.volume;

  audio.fadeTimer = setInterval(function () {
    i++;
    var t = i / steps;
    audio.bgm.volume = lerp(startVol, 0, t);

    if (i >= steps) {
      clearInterval(audio.fadeTimer);
      audio.fadeTimer = null;

      // смена трека
      try {
        audio.bgm.pause();
        audio.bgm.src = newSrc;
        audio.bgm.currentTime = 0;
        audio.bgm.play().catch(function () {});
      } catch (e) {}

      // поднимаем громкость до target
      fadeInBgm(target, fadeMs);
    }
  }, stepTime);
}

function fadeInBgm(targetVol, fadeMs) {
  clearInterval(audio.fadeTimer);

  var steps = 20;
  var stepTime = Math.max(20, Math.floor(fadeMs / steps));
  var i = 0;

  audio.bgm.volume = 0;

  audio.fadeTimer = setInterval(function () {
    i++;
    var t = i / steps;
    audio.bgm.volume = lerp(0, targetVol, t);

    if (i >= steps) {
      clearInterval(audio.fadeTimer);
      audio.fadeTimer = null;
      audio.bgm.volume = targetVol;
    }
  }, stepTime);
}

function playSfx(src, vol) {
  if (!src) return;

  audio.currentSfxVolume = clamp(vol, 0, 1);

  try {
    audio.sfx.pause();
    audio.sfx.src = src;
    audio.sfx.currentTime = 0;
    applyAudioSettings();
    audio.sfx.play().catch(function () {});
  } catch (e) {
    // игнор
  }
}

// =========================================================
//                   ASSET RESOLVE
// =========================================================

// Достает путь картинки персонажа из старого string-формата и из возможного object-формата ассета.
function getCharacterImagePath(imageEntry) {
  if (typeof imageEntry === "string") return imageEntry;
  if (imageEntry && typeof imageEntry === "object") {
    return imageEntry.file || imageEntry.src || imageEntry.image || "";
  }
  return "";
}

// Собирает путь и настройки фокуса персонажа из [char]: общие поля, параметры эмоции и object-запись картинки.
function resolveCharacterAssetInfo(charId, emotion) {
  var result = {
    file: "",
    focusOptions: {}
  };

  if (!charId || !STORY || !STORY.assets || !STORY.assets.characters) return result;

  var char = STORY.assets.characters[charId];
  var emotionKey = emotion || "neutral";
  if (!char || !char.images) return result;

  var imageEntry = char.images[emotionKey];
  result.file = getCharacterImagePath(imageEntry);
  result.focusOptions = mergeCharacterFocusOptions(result.focusOptions, char);
  result.focusOptions = mergeCharacterFocusOptions(result.focusOptions, imageEntry);

  if (char.imageOptions && char.imageOptions[emotionKey]) {
    result.focusOptions = mergeCharacterFocusOptions(result.focusOptions, char.imageOptions[emotionKey]);
  }

  return result;
}

function resolveAsset(ref, charId, emotion) {
  console.log('[Engine resolveAsset] Called with:', { ref, charId, emotion });
  
  // СНАЧАЛА проверяем персонажей, если есть charId и emotion
  if (charId && emotion && STORY.assets && STORY.assets.characters) {
    console.log('[Engine resolveAsset] Looking for character:', charId, 'emotion:', emotion);
    
    const char = STORY.assets.characters[charId];
    console.log('[Engine resolveAsset] Character object:', char);
    
    if (char && char.images) {
      console.log('[Engine resolveAsset] Available emotions:', Object.keys(char.images));
      const imagePath = getCharacterImagePath(char.images[emotion]);
      console.log('[Engine resolveAsset] Found image path:', imagePath);
      
      if (imagePath) {
        if (areAllImageCandidatesFailed(imagePath)) {
          console.log('[Engine resolveAsset] Character image marked as failed:', imagePath);
          return "";
        }

        console.log('[Engine resolveAsset] Returning character path:', imagePath);
        return imagePath;
      } else {
        console.log('[Engine resolveAsset] Emotion not found:', emotion);
      }
    } else {
      console.log('[Engine resolveAsset] Character or images not found');
    }
  }
  
  // ТОЛЬКО ПОТОМ проверяем ref === null
  if (ref === null) {
    console.log('[Engine resolveAsset] ref is null, returning null');
    return null;
  }
  
  if (!ref) {
    console.log('[Engine resolveAsset] ref is empty, returning empty string');
    return "";
  }
  
  if (typeof ref !== "string") {
    console.log('[Engine resolveAsset] ref is not a string:', ref);
    return "";
  }
  
  // Если это прямой путь (не алиас)
  if (ref.indexOf("@") !== 0) {
    console.log('[Engine resolveAsset] ref is direct path:', ref);
    return ref;
  }
  
  // Обработка алиасов @bg.xxx, @audio.xxx
  var parts = ref.substring(1).split(".");
  if (parts.length < 2) {
    console.log('[Engine resolveAsset] Invalid alias format:', ref);
    return "";
  }

  var group = parts[0];
  var key = parts.slice(1).join(".");
  
  console.log('[Engine resolveAsset] Alias - group:', group, 'key:', key);
  
  if (!STORY.assets) {
    console.log('[Engine resolveAsset] STORY.assets is missing');
    return "";
  }

  if (group === "bg") {
    if (!STORY.assets.backgrounds) {
      console.log('[Engine resolveAsset] STORY.assets.backgrounds is missing');
      return "";
    }
    console.log('[Engine resolveAsset] Available backgrounds:', Object.keys(STORY.assets.backgrounds));
    
    const result = STORY.assets.backgrounds[key];
    console.log('[Engine resolveAsset] Found background:', result);
    var bgPath = getBackgroundAssetPrimaryPath(result);

    if (bgPath && areAllImageCandidatesFailed(bgPath)) {
      console.log('[Engine resolveAsset] Background marked as failed:', bgPath);
      return "";
    }
    return bgPath || "";
  }
  
  if (group === "audio") {
    if (!STORY.assets.audio) {
      console.log('[Engine resolveAsset] STORY.assets.audio is missing');
      return "";
    }
    console.log('[Engine resolveAsset] Available audio:', Object.keys(STORY.assets.audio));
    const result = STORY.assets.audio[key];
    console.log('[Engine resolveAsset] Found audio:', result);
    return getAudioAssetPrimaryPath(result);
  }
  
  console.log('[Engine resolveAsset] No match found for group:', group);
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
  } catch (e) {}
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
// ДИНАМИЧЕСКОЕ МАСШТАБИРОВАНИЕ ПЕРСОНАЖЕЙ
// =========================================================
function adjustCharacterScale(reason) {

  console.log('[CHAR SCALE] start', {
    reason: reason || "",
    src: elChar ? (elChar.currentSrc || elChar.src) : null,
    hidden: elChar ? elChar.classList.contains('hidden') : null,
    styleHeightBefore: elChar ? elChar.style.height : null,
    naturalWidth: elChar ? elChar.naturalWidth : null,
    naturalHeight: elChar ? elChar.naturalHeight : null,
    windowHeight: window.innerHeight
  });

  var frame = elCharFrame || document.getElementById('charFrame');
  var char = document.getElementById('charLayer');
  if (!char) return;
  
  var availableHeight = elNovelWindow ? elNovelWindow.clientHeight : window.innerHeight;
  var availableWidth = elNovelWindow ? elNovelWindow.clientWidth : window.innerWidth;
  var focusOptions = normalizeCharacterFocusOptions(
    currentCharacterVisualOptions || CHARACTER_FOCUS_DEFAULTS,
    CHARACTER_FOCUS_DEFAULTS
  );
  currentCharacterVisualOptions = focusOptions;

  // Базовая рамка персонажа равна нижним 85% кадра; scale умножает уже эту рамку.
  var baseCharHeight = Math.max(0, availableHeight * CHARACTER_WORK_HEIGHT_RATIO);
  var targetCharHeight = baseCharHeight * focusOptions.scale;
  var naturalWidth = char.naturalWidth || 0;
  var naturalHeight = char.naturalHeight || 0;
  logCharacterFocusDebug("scale:start", {
    reason: reason || "",
    availableWidth: availableWidth,
    availableHeight: availableHeight,
    baseCharHeight: baseCharHeight,
    targetCharHeight: targetCharHeight,
    naturalWidth: naturalWidth,
    naturalHeight: naturalHeight
  });
  
  if (!naturalWidth || !naturalHeight || !availableWidth || !availableHeight) {
    // До загрузки natural-размеров держим стабильную рамку в слоте; onload пересчитает точную ширину по aspect ratio.
    if (frame) {
      frame.style.left = (getCharacterSlotRatio(focusOptions.pos) * 100) + "%";
      frame.style.top = Math.max(0, availableHeight - baseCharHeight) + "px";
      frame.style.bottom = "auto";
      frame.style.width = "0px";
      frame.style.height = targetCharHeight + "px";
      frame.style.transform = "translateX(-50%)";
      frame.style.overflow = "visible";
    }
    char.style.left = "0";
    char.style.top = "0";
    char.style.bottom = "auto";
    char.style.width = "100%";
    char.style.height = "100%";
    char.style.transform = "";
    char.style.maxHeight = "none";
    logCharacterFocusDebug("scale:fallbackNoNaturalSize", {
      reason: reason || "",
      availableWidth: availableWidth,
      availableHeight: availableHeight,
      focusOptions: focusOptions,
      frame: frame ? {
        left: frame.style.left,
        top: frame.style.top,
        width: frame.style.width,
        height: frame.style.height
      } : null,
      baseCharHeight: baseCharHeight,
      targetCharHeight: targetCharHeight
    });
    logCharacterFrameLine("fallbackNoNaturalSize", {
      reason: reason || "",
      scene: state ? state.sceneId : "",
      index: state ? state.actionIndex : "",
      pos: focusOptions.pos,
      focusX: focusOptions.focusX,
      focusY: focusOptions.focusY,
      scale: focusOptions.scale,
      availableWidth: availableWidth,
      availableHeight: availableHeight,
      frameLeft: frame ? frame.style.left : "",
      frameTop: frame ? frame.style.top : "",
      frameWidth: frame ? frame.style.width : "",
      frameHeight: frame ? frame.style.height : "",
      naturalWidth: naturalWidth,
      naturalHeight: naturalHeight
    });
    return;
  }

  var baseCharWidth = naturalWidth * (baseCharHeight / naturalHeight);
  var targetCharWidth = baseCharWidth * focusOptions.scale;
  var targetScale = targetCharHeight / naturalHeight;
  var slotCenterX = availableWidth * getCharacterSlotRatio(focusOptions.pos);
  var workCenterY = availableHeight - baseCharHeight / 2;
  var frameLeft = slotCenterX - targetCharWidth / 2;
  var frameTop = workCenterY - targetCharHeight / 2;
  var innerLeft = (0.5 - focusOptions.focusX) * targetCharWidth;
  var innerTop = (0.5 - focusOptions.focusY) * baseCharHeight;
  var imageViewportLeft = frameLeft + innerLeft;
  var imageViewportTop = frameTop + innerTop;

  // Рамка всегда считается по полным габаритам файла; focus двигает только изображение внутри этой рамки.
  if (frame) {
    frame.style.left = frameLeft + 'px';
    frame.style.top = frameTop + 'px';
    frame.style.bottom = 'auto';
    frame.style.width = targetCharWidth + 'px';
    frame.style.height = targetCharHeight + 'px';
    // В px-режиме рамка уже получает точный left; CSS translateX(-50%) нужен только для стартового percent-fallback.
    frame.style.transform = 'none';
    // Рамка — только координатная система; focus может вывести изображение за её пределы без обрезки.
    frame.style.overflow = 'visible';
    char.style.left = innerLeft + 'px';
    char.style.top = innerTop + 'px';
  } else {
    // Fallback для старой разметки без charFrame: картинка получает абсолютные координаты сразу в окне.
    char.style.left = imageViewportLeft + 'px';
    char.style.top = imageViewportTop + 'px';
  }
  char.style.bottom = 'auto';
  char.style.width = targetCharWidth + 'px';
  char.style.height = targetCharHeight + 'px';
  char.style.transform = '';

  console.log('[CHAR SCALE] applied', {
    reason: reason || "",
    src: char.currentSrc || char.src,
    baseCharHeight: baseCharHeight,
    targetCharWidth: targetCharWidth,
    targetCharHeight: targetCharHeight,
    focusOptions: focusOptions,
    frameLeft: frameLeft,
    frameTop: frameTop,
    innerLeft: innerLeft,
    innerTop: innerTop,
    imageViewportLeft: imageViewportLeft,
    imageViewportTop: imageViewportTop,
    styleHeightAfter: char.style.height,
    offsetHeight: char.offsetHeight
  });
  logCharacterFocusDebug("scale:applied", {
    reason: reason || "",
    availableWidth: availableWidth,
    availableHeight: availableHeight,
    baseCharHeight: baseCharHeight,
    targetCharWidth: targetCharWidth,
    targetCharHeight: targetCharHeight,
    frame: {
      left: frameLeft,
      top: frameTop,
      width: targetCharWidth,
      height: targetCharHeight,
      slotCenterX: slotCenterX,
      workCenterY: workCenterY
    },
    innerImage: {
      left: innerLeft,
      top: innerTop,
      width: targetCharWidth,
      height: targetCharHeight,
      viewportLeft: imageViewportLeft,
      viewportTop: imageViewportTop
    },
    slotCenterX: slotCenterX,
    workCenterY: workCenterY,
    targetScale: targetScale
  });
  logCharacterFrameLine("applied", {
    reason: reason || "",
    scene: state ? state.sceneId : "",
    index: state ? state.actionIndex : "",
    src: char.currentSrc || char.src || "",
    pos: focusOptions.pos,
    focusX: focusOptions.focusX,
    focusY: focusOptions.focusY,
    scale: focusOptions.scale,
    availableWidth: availableWidth,
    availableHeight: availableHeight,
    naturalWidth: naturalWidth,
    naturalHeight: naturalHeight,
    frameLeft: frameLeft,
    frameTop: frameTop,
    frameWidth: targetCharWidth,
    frameHeight: targetCharHeight,
    innerLeft: innerLeft,
    innerTop: innerTop,
    imageViewportLeft: imageViewportLeft,
    imageViewportTop: imageViewportTop,
    charRectLeft: getCharacterDebugRect(char) ? getCharacterDebugRect(char).left : "",
    charRectTop: getCharacterDebugRect(char) ? getCharacterDebugRect(char).top : "",
    frameRectLeft: frame && getCharacterDebugRect(frame) ? getCharacterDebugRect(frame).left : "",
    frameRectTop: frame && getCharacterDebugRect(frame) ? getCharacterDebugRect(frame).top : ""
  });

  // Сбрасываем max-height, чтобы не было конфликтов
  char.style.maxHeight = 'none';
  
  console.log('[Engine] Character scale applied:', {
    windowHeight: window.innerHeight,
    novelWindowHeight: elNovelWindow ? elNovelWindow.clientHeight : null,
    availableHeight: availableHeight,
    targetCharHeight: targetCharHeight,
    actualHeight: char.offsetHeight
  });

  // Проверяем фактическую высоту после загрузки изображения
  setTimeout(function() {
    console.log('[Engine] Character actual height after load:', char.offsetHeight);
  }, 200);
}

// Также вызываем при изменении размера
// adjustCharacterScale() вызывается из applySpacingSettings()

  
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

// Формирует содержимое окна настроек: версия сборки и текущий статус лицензии.
function renderSettingsPanel() {
  if (!elSettingsBody) return;
  var text = "";
  text += "Software version: " + window.APP_VERSION + "\n\n";
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

function showSettingsPanel() {
  if (!elSettingsPanel) return;
  if (elStatsPanel && !elStatsPanel.classList.contains("hidden")) {
    // Окно статистики скрывается без setStatsView, поэтому отдельно отменяем отложенный рендер графа.
    graphRenderSequence++;
    elStatsPanel.classList.add("hidden");
  }
  renderSettingsPanel();
  elSettingsPanel.classList.remove("hidden");
}

function hideSettingsPanel() {
  if (!elSettingsPanel) return;
  elSettingsPanel.classList.add("hidden");
  tryResumeNovelAfterStatsClose("hideSettingsPanel");
}

function showStatsPanel() {
  if (elSettingsPanel && !elSettingsPanel.classList.contains("hidden")) {
    elSettingsPanel.classList.add("hidden");
  }
  setStatsView("text");

  // Принудительно сбрасываем panzoom состояние
  resetPanzoom();

  renderStats();
  elStatsPanel.classList.remove("hidden");
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
  console.log("[STATS] resume novel flow after close", {
    reason: reason || "stats_close",
    sceneId: state.sceneId,
    actionIndex: state.actionIndex,
    waitingNext: state.waitingNext,
    nextLocked: state.nextLocked
  });
  runCurrent();
}

function hideStatsPanel() {
  // Закрытие панели не меняет currentStatsView, но все отложенные операции графа уже неактуальны.
  graphRenderSequence++;
  elStatsPanel.classList.add("hidden");
  tryResumeNovelAfterStatsClose("hideStatsPanel");
}


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

function openStatsGame(item, difficulty) {
  if (!item || !item.file) {
    if (gamesStatus) {
      gamesStatus.textContent = t("gamesLaunchFailed");
      gamesStatus.classList.remove("ok");
      gamesStatus.classList.add("warn");
    }
    return;
  }

  state.inGame = true;
  state.currentGame = {
    mode: "stats",
    gameId: item.id,
    title: item.title || item.id,
    difficulty: difficulty,
    resultVar: null,
    params: {
      difficulty: difficulty,
      source: "statsGamesPanel"
    }
  };

  elStatsGameModal.classList.remove("hidden");
  syncStatsGameFrameWrapToStoryGameWindow();

  elStatsGameFrame.onload = function () {
    if (!state.currentGame) return;

    var payload = {
      type: "gameInit",
      gameId: state.currentGame.gameId,
      difficulty: state.currentGame.difficulty,
      source: "statsGamesPanel"
    };

    try {
      elStatsGameFrame.contentWindow.postMessage(payload, "*");
      console.log("[GAME] stats gameInit sent:", payload);
    } catch (e) {
      console.error("[GAME] failed to send stats gameInit", e);
    }
  };

  elStatsGameFrame.src = item.file;
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

// Формирует короткую строку итоговых статусов без подробностей: расшифровка остаётся в разделах ниже.
function formatStatsSummaryCheck(checks) {
  var items = Array.isArray(checks) ? checks : [];
  var text = "=== SUMMARY CHECK ===\n\n";
  text += items.map(function(item) {
    return (item && item.ok ? "✅ " : "❌ ") + String(item && item.label ? item.label : "CHECK");
  }).join("  ");
  return text + "\n\n";
}

// Генерация статистики по STORY.
// Сделано так, чтобы потом легко дописывать новые показатели: просто добавляете новые строки в statsLines.
function renderStats() {

  // Показываем индикатор загрузки
  elStatsBody.value = "Сбор информации...";
  console.log("[STATS] renderStats:start");

  // Сначала собираем информацию об окружении
  var envInfo = collectEnvironmentInfo();

  // Добавляем информацию профилера
  var profilerInfo = profiler.getReport();

  // Асинхронно проверяем файлы
  checkAssetsFiles()
  .then(function(fileStats) {
    console.log("[STATS] checkAssetsFiles done", fileStats);
    try {
      var stats = computeStoryStats(STORY);
      var errors = validateStory(STORY);
      var textInfo = computeTextInfo(STORY);
      var reach = findUnreachableScenes(STORY);
      var cycles = findCyclesSCC(STORY);
      var story360Visibility = analyzeStory360VisibilityConditions(STORY);
      var variableCaseAnalysis = analyzeScenarioVariableCaseConflicts(STORY);
      var identifierNameAnalysis = analyzeStoryIdentifierNames(STORY);

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






      text += `Software version: ${window.APP_VERSION}\n`; // Важно использовать кавычки `` чтобы применялись вставки ${}. В "" не применяются вставки
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

        var totalDialogActions = sayCount + textCount;
        var totalInteractiveActions = choiceCount;

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
        addPathRef(getCharacterImagePath(imageEntry[1]), "character", charId + " (" + emotion + ")");
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

function checkAssetsFiles() {
  return new Promise((resolve) => {
    const result = {
      missing: [],
      sizeErrors: [], // файлы с неправильными размерами
      invalidNames: [],
      files: []
    };

    if (!STORY.assets) {
      resolve(result);
      return;
    }

    // Собираем все файлы из ассетов
    const allFiles = [];

    // Фоны
    if (STORY.assets.backgrounds) {
      Object.entries(STORY.assets.backgrounds).forEach(([id, path]) => {
        var primaryPath = getBackgroundAssetPrimaryPath(path);
        if (primaryPath) {
          allFiles.push({ id, path: primaryPath, type: 'bg', category: 'background', ref: id });
        }
      });
    }

    // Персонажи (изображения)
    if (STORY.assets.characters) {
      Object.entries(STORY.assets.characters).forEach(([charId, char]) => {
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
    if (STORY.assets.audio) {
      Object.entries(STORY.assets.audio).forEach(([id, audioAsset]) => {
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
    if (STORY.assets.games) {
      Object.entries(STORY.assets.games).forEach(([id, game]) => {
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

    if (STORY.assets.videos) {
      Object.entries(STORY.assets.videos).forEach(([id, video]) => {
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

    console.log("[ASSET CHECK] STORY.assets.games =", STORY.assets.games);
    console.log("[ASSET CHECK] allFiles after games =", allFiles);

    if (allFiles.length === 0) {
      resolve(result);
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

    console.log("[ASSET CHECK] pathGroups =", pathGroups);

    const uniquePaths = Object.keys(pathGroups);

    console.log("[ASSET CHECK] uniquePaths =", uniquePaths);

    let loadedCount = 0;
    let errorCount = 0;
    const totalPaths = uniquePaths.length;

    const fileResults = {};

    function checkComplete() {
      console.log("[ASSET CHECK] progress", {
        totalPaths: totalPaths,
        loadedCount: loadedCount,
        errorCount: errorCount,
        done: loadedCount + errorCount
      });

      if (loadedCount + errorCount === totalPaths) {
          // Собираем результаты
          uniquePaths.forEach(path => {

            console.log("[ASSET CHECK] checking path:", path, {
              group: pathGroups[path],
              isImage: /\.(jpg|jpeg|png|gif|webp)$/i.test(path),
              isVideo: /\.(mp4|webm)$/i.test(path),
              isAudio: /\.(mp3|wav|ogg|flac|m4a)$/i.test(path),
              isGameHtml: /\.(html|htm)$/i.test(path)
            });

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

          console.log("[ASSET CHECK] complete", {
            totalPaths: totalPaths,
            loadedCount: loadedCount,
            errorCount: errorCount,
            missing: result.missing.length,
            sizeErrors: result.sizeErrors.length,
            invalidNames: result.invalidNames.length,
            files: result.files.length
          });
          resolve(result);
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
          console.warn("[ASSET CHECK] unsupported file type:", path);
          errorCount++;
          checkComplete();
        }
      });
  });
}








function forEachOutgoingTarget(actions, cb, currentLabel) {
  if (!Array.isArray(actions)) return;
  var label = currentLabel || "";

  for (var i = 0; i < actions.length; i++) {
    var act = actions[i];
    if (!act || !act.type) continue;

    if (act.type === "goto" && act.target) {
      cb({ to: act.target, label: label });
      continue;
    }

    if (act.type === "if_expr" && act.target) {
      cb({ to: act.target, label: String(act.condition || "") });
      continue;
    }

    if (act.type === "if_block") {
      if (Array.isArray(act.branches)) {
        for (var b = 0; b < act.branches.length; b++) {
          var br = act.branches[b];
          if (br && Array.isArray(br.actions)) {
            forEachOutgoingTarget(br.actions, cb, String(br.condition || ""));
          }
        }
      }
      if (Array.isArray(act.elseActions)) {
        forEachOutgoingTarget(act.elseActions, cb, "else");
      }
      continue;
    }

    if (act.type === "choice" && Array.isArray(act.choices)) {
      for (var c = 0; c < act.choices.length; c++) {
        var ch = act.choices[c];
        if (!ch) continue;
        var chLabel = String(ch.text || "");
        if (ch.goto) {
          cb({ to: ch.goto, label: chLabel });
        }
        if (Array.isArray(ch.actions)) {
          forEachOutgoingTarget(ch.actions, cb, chLabel);
        }
      }
    }
  }
}

function buildAdjacency(story) {
  var scenes = story.scenes || [];
  var sceneMap = {};
  var adj = {}; // from -> array of { to, label }

  for (var i = 0; i < scenes.length; i++) {
    if (scenes[i] && scenes[i].id) {
      sceneMap[scenes[i].id] = true;
      adj[scenes[i].id] = [];
    }
  }

  for (var s = 0; s < scenes.length; s++) {
    var sc = scenes[s];
    if (!sc || !sc.id) continue;

    forEachOutgoingTarget(sc.actions || [], function (edge) {
      adj[sc.id].push({ to: edge.to, label: edge.label });
    });
  }

  return { sceneMap: sceneMap, adj: adj };
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

// Превращает id 360-пространства или панорамы в безопасную часть Mermaid-id без потери читаемой привязки.
function sanitizeStory360GraphIdPart(value) {
  var safe = String(value || "").trim().replace(/[^A-Za-z0-9_]/g, "_");
  return safe || "id";
}

// Создаёт стабильный id узла Mermaid для 360-панорамы, чтобы он не конфликтовал с id обычных сцен.
function getStory360GraphNodeId(spaceId, panoramaId) {
  return "story360_" + sanitizeStory360GraphIdPart(spaceId) + "__" + sanitizeStory360GraphIdPart(panoramaId);
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
          bidirectional: true
        });
        continue;
      }
    }

    renderable.push({
      from: sourceEdge.from,
      to: sourceEdge.to,
      label: String(sourceEdge.label || ""),
      bidirectional: false
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

    forEachOutgoingTarget(scene.actions || [], function(edge) {
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

  var visited = {};
  if (startId && allNodes[startId]) {
    var stack = [startId];
    visited[startId] = true;
    while (stack.length) {
      var current = stack.pop();
      var edges = adj[current] || [];
      for (var ai = 0; ai < edges.length; ai++) {
        var to = edges[ai];
        if (!visited[to] && allNodes[to]) {
          visited[to] = true;
          stack.push(to);
        }
      }
    }
  }

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
  var built = buildAdjacency(story);
  var sceneMap = built.sceneMap;

  if (!startId || !sceneMap[startId]) {
    // Если стартовая сцена не задана/не найдена — считаем всё “сомнительным”
    return { unreachable: Object.keys(sceneMap).sort(), reachable: [] };
  }

  var combinedReach = buildCombinedStoryGraphReachability(story, buildStory360GraphData(story));
  return { unreachable: combinedReach.unreachableScenes, reachable: combinedReach.reachableScenes };
}


function findCyclesSCC(story) {
  var built = buildAdjacency(story);
  var sceneMap = built.sceneMap;
  var adj = built.adj;

  var index = 0;
  var stack = [];
  var onStack = {};
  var idx = {};
  var low = {};
  var sccs = [];

  function strongconnect(v) {
    idx[v] = index;
    low[v] = index;
    index++;

    stack.push(v);
    onStack[v] = true;

    var edges = adj[v] || [];
    for (var i = 0; i < edges.length; i++) {
      var w = edges[i].to;
      if (!sceneMap[w]) continue; // игнорируем переходы в несуществующие

      if (idx[w] === undefined) {
        strongconnect(w);
        low[v] = Math.min(low[v], low[w]);
      } else if (onStack[w]) {
        low[v] = Math.min(low[v], idx[w]);
      }
    }

    // root SCC
    if (low[v] === idx[v]) {
      var comp = [];
      while (true) {
        var w2 = stack.pop();
        onStack[w2] = false;
        comp.push(w2);
        if (w2 === v) break;
      }
      sccs.push(comp);
    }
  }

  // Запускаем для всех вершин
  for (var v in sceneMap) {
    if (!Object.prototype.hasOwnProperty.call(sceneMap, v)) continue;
    if (idx[v] === undefined) strongconnect(v);
  }

  // Оставляем только “циклические” SCC:
  // - размер > 1
  // - или самопетля (v -> v)
  var cycles = [];
  for (var i = 0; i < sccs.length; i++) {
    var comp = sccs[i];
    if (comp.length > 1) {
      comp.sort();
      cycles.push(comp);
    } else {
      var single = comp[0];
      var edges = adj[single] || [];
      for (var e = 0; e < edges.length; e++) {
        if (edges[e].to === single) {
          cycles.push([single]);
          break;
        }
      }
    }
  }

  // Стабильный порядок
  cycles.sort(function (a, b) {
    return a[0].localeCompare(b[0]);
  });

  return cycles;
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
  var startId = (story.meta && story.meta.start) ? story.meta.start : (scenes[0] ? scenes[0].id : "START");
  var attachSceneId = startId;

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
          var bgId = extractAliasId(act.src, "bg");
          if (bgId) {
            uniqueBgs[bgId] = true;

            // Получаем реальный путь к ассету из [bg].
            var bgSrc = null;
            if (story.assets && story.assets.backgrounds) {
              bgSrc = getBackgroundAssetPrimaryPath(story.assets.backgrounds[bgId]);
            }

            // Разделяем вызовы по типам, чтобы в сцене были отдельные счетчики 🖼️ и 🌐.
            if (bgSrc && isBg360PackScriptPath(bgSrc)) {
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
    // forEachOutgoingTarget сам рекурсивно обходит вложенные goto в choice/if_block.
    for (var a = 0; a < actions.length; a++) {
      var act = actions[a];
      if (!act || !act.type) continue;
      forEachOutgoingTarget([act], function (edge) {
        var lbl = String(edge.label || "");
        if (lbl.length > 40) lbl = lbl.substring(0, 40) + "...";

        edges.push({
          from: scene.id,
          to: edge.to,
          label: lbl
        });

        outgoingEdges[scene.id] = (outgoingEdges[scene.id] || 0) + 1;
        // Учитываем только переходы в "не стартовую" сцену:
        // ссылка обратно в стартовую сцену допускается у финала.
        if (edge.to !== startId) {
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
      id: scene.id,
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






  var nodesById = {};
  for (var ni = 0; ni < nodes.length; ni++) {
    nodesById[nodes[ni].id] = nodes[ni];
  }

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
  mermaid += "%% " + ((story.meta && story.meta.title) ? story.meta.title : "Visual Novel") + "\n";

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

  var graphStats = computeStoryStats(story);

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
    if (scope === "resources" && node.id !== startId) {
      continue;
    }

    var chars = node.characters.length ? node.characters.join(", ") : "(none)";
    var games = (node.games && node.games.length) ? node.games : [];

    // Формируем многострочную метку - ВАЖНО: порядок элементов
    var label = node.id + "<br/>";

    // Параметры настройки
    var imageSize = 80;           // Размер миниатюр
    var imageGap = 2;             // Расстояние между миниатюрами
    var containerPadding = 8;     // Внутренние отступы контейнера

    var sceneVideoBgCount = 0;
    var sceneBgImagesOnly = [];
    var sceneBg360ImagesOnly = [];
    if (node.allBgImages && node.allBgImages.length > 0) {
      for (var b0 = 0; b0 < node.allBgImages.length; b0++) {
        var bg0 = node.allBgImages[b0];
        if (!bg0) continue;
        if (isVideoAssetPath(bg0.src)) {
          if (bg0.id) sceneVideoBgCount++;
        } else if (isBg360PackScriptPath(bg0.src)) {
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
          var safeBgId = escapeHtml(bg.id || "");

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
          var safeBg360Id = escapeHtml(bg360.id || "");
          var bgAsset = (story.assets && story.assets.backgrounds && bg360.id) ? story.assets.backgrounds[bg360.id] : null;
          var bg360AssetQuality = getBackgroundAssetQuality(bgAsset) || "auto";

          label += "<span class='scene-bg-frame scene-bg360-frame " + sceneBg360CountClass + "'>" +
                  "<img " +
                  "class='scene-bg-thumbnail scene-bg360-thumbnail bg360-graph-thumbnail " + sceneBg360CountClass + "' " +
                  "data-id='" + safeBg360Id + "' " +
                  "data-index='" + b360 + "' " +
                  "data-bg360-src='" + escapeHtml(bg360.src || "") + "' " +
                  "data-bg360-quality='" + escapeHtml(bg360AssetQuality) + "' " +
                  "title='" + safeBg360Id + "' " +
                  "alt='' />" +
                  "</span> ";
        }

        label += "</div>";
      }
    }

    // Статистика персонажей и счетчики - БЕЗ ЛИШНЕГО ПЕРЕНОСА СТРОКИ
    var statsParts = [];

    if (chars != '(none)') {
      statsParts.push("<div>👤 " + chars + "</div>");
    }

    if (games.length > 0) {
      statsParts.push("<div>🎮 " + games.join(", ") + "</div>");
    }

    // Добавляем счетчики
    var counters = [];
    if (sceneVideoBgCount > 0) {
      counters.push("🎬" + sceneVideoBgCount);
    }
    if (node.bgImageCount != 0) {
      counters.push("🖼️" + (node.bgImageCount === node.uniqueBgImageCount ? node.uniqueBgImageCount : (node.bgImageCount + "/" + node.uniqueBgImageCount)));
    }
    if (node.bg360Count != 0) {
      counters.push("🌐" + (node.bg360Count === node.uniqueBg360Count ? node.uniqueBg360Count : (node.bg360Count + "/" + node.uniqueBg360Count)));
    }
    if (node.phraseCount != 0) {
      counters.push("💬" + node.phraseCount);
    }
    if (node.bgmCount != 0) {
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
      var panoSafeTitle = escapeHtml(panoNode.ref || panoNode.id);
      // Название 360-панорамы ставим первой строкой, чтобы узел читался так же, как обычная сцена.
      var panoLabel = "\uD83C\uDF10 " + escapeHtml(panoNode.ref) + "<br/>";

      if (!compact && panoNode.file) {
        var panoImgClass = "imgcount1";
        panoLabel += "<div class='scene-bg-images-container " + panoImgClass + " story360-graph-preview'>";

        if (isBg360PackScriptPath(panoNode.file)) {
          panoLabel += "<span class='scene-bg-frame scene-bg360-frame " + panoImgClass + "'>" +
            "<img " +
            "class='scene-bg-thumbnail scene-bg360-thumbnail bg360-graph-thumbnail " + panoImgClass + "' " +
            "data-id='" + escapeHtml(panoNode.bgId || panoNode.ref || "") + "' " +
            "data-index='0' " +
            "data-bg360-src='" + escapeHtml(panoNode.file || "") + "' " +
            "data-bg360-quality='" + escapeHtml(panoNode.quality || "auto") + "' " +
            "title='" + panoSafeTitle + "' " +
            "alt='' />" +
            "</span>";
        } else if (!isVideoAssetPath(panoNode.file)) {
          panoLabel += "<span class='scene-bg-frame " + panoImgClass + "'>" +
            "<img src='" + getGraphImageSrc(panoNode.file) + "'" + getGraphRasterImgDataAttr(panoNode.file) + " " +
            "class='scene-bg-thumbnail " + panoImgClass + "' " +
            "data-id='" + escapeHtml(panoNode.bgId || panoNode.ref || "") + "' " +
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
    if (node.id === startId) {
      classes.push("start");
    }
    
    // Проверяем, является ли сцена недостижимой
    if (unreachableSet[node.id]) {
      classes.push("unreachable");
    }
    
    // Проверяем, является ли сцена финальной: есть входящие связи и нет
    // исходящих связей в любые сцены, КРОМЕ стартовой.
    // Допускается возврат в стартовую сцену (например, "Начать заново"),
    // он не лишает сцену статуса финала.
    // Также сцена не должна быть стартовой и не должна быть недостижимой.
    if (!unreachableSet[node.id] &&
      node.id !== startId &&
      incomingEdges[node.id] > 0 &&
      (!outgoingEdgesNonStart[node.id] || outgoingEdgesNonStart[node.id] === 0)) {
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
      if (ed.from !== startId || ed.to !== startId) {
        continue;
      }
    }

    if (ed.label && ed.label.trim() !== "") {
      // Экранируем кавычки и спецсимволы в метках
      var label = ed.label.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

      if (story360Label.trim() !== "") {
        var safeStory360Label = story360Label.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        mermaid += '    ' + story360Edge.from + story360ArrowWithLabel + '|"' + safeStory360Label + '"| ' + story360Edge.to + ';\n';
      } else {
        mermaid += '    ' + story360Edge.from + story360Arrow + story360Edge.to + ';\n';
      }
    }
  }
    
  console.log('[DEBUG] Mermaid graph generated for nodes:');
  nodes.forEach(function(node) {
    if (node.allBgImages && node.allBgImages.length > 0) {
      console.log('  Node', node.id, 'images:', node.allBgImages.map(function(bg) { return bg.id; }).join(', '));
    }
  });

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

// Добавьте после функции buildMermaidGraph или в любое место перед ее вызовом

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
  var startId = (story.meta && story.meta.start) ? story.meta.start : (scenes[0] ? scenes[0].id : "START");
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
          "<span class='game-list-id'>" + escapeHtml(listCharId) + "</span>" +
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
        var safeEmotion = escapeHtml(emotion);
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
    
    // Экранируем кавычки в displayName
    var escapedDisplayName = displayName.replace(/"/g, '&quot;');

    // Формируем метку персонажа с правильным экранированием - ИСПРАВЛЕНО
    var label = '<b>' + charId + '</b><br/>';
    if (displayName !== charId) {
      // Используем &quot; вместо кавычек
      label += '<i>&quot;' + escapedDisplayName + '&quot;</i>';
    }
    label += emotionsHtml;
    
    // Добавляем узел персонажа
    var nodeId = 'char_' + charId;
    mermaid += '    ' + nodeId + '["' + label + '"]\n';
    mermaid += '    ' + nodeId + ':::character-node\n';  // Применяем CSS-класс
    
    charNodes.push({
      id: nodeId,
      charId: charId
    });
  } // for
    
    // Добавляем связи пунктирной линией
    mermaid += '\n    %% Character connections from Chapter 1\n';
    
    // Связь от "Персонажи" к первому узлу (опционально)
    // mermaid += '    characters -.-> ' + startId + ';\n';
    
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
        var bgId = extractAliasId(action.src, "bg");
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
    if (isBg360PackScriptPath(primary)) {
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
      var safeImgBgId = escapeHtml(imgBgId);
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
        "<span class='game-list-id'>" + escapeHtml(vidId) + "</span>" +
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
      var safeBg360Id = escapeHtml(bg360Id);
      var safeBg360Src = escapeHtml(bg360Src || "");
      var bg360UseCount = backgroundCounts[bg360Id] || 0;
      var bg360AssetQuality = getBackgroundAssetQuality(backgrounds[bg360Id]) || "auto";

      bg360Html += "<span class='bgw bg360w " + bg360CountClass + "'>" +
        "<img " +
        "class='bgi bg360-graph-thumbnail " + bg360CountClass + "' " +
        "data-bg360-src='" + safeBg360Src + "' " +
        "data-bg360-quality='" + escapeHtml(bg360AssetQuality) + "' " +
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
    var sourceUrl = img.getAttribute("data-bg360-src") || "";
    var quality = img.getAttribute("data-bg360-quality") || "auto";
    if (!sourceUrl) return;

    var readyDataUrl = resolveBg360PackDataUrl(sourceUrl, quality);
    if (readyDataUrl) {
      img.src = readyDataUrl;
      return;
    }

    ensureBg360PackLoaded(sourceUrl, quality, function(ok) {
      // После асинхронной загрузки повторно читаем атрибуты конкретной миниатюры.
      if (!img || !img.isConnected) return;
      var cbSourceUrl = img.getAttribute("data-bg360-src") || "";
      var cbQuality = img.getAttribute("data-bg360-quality") || "auto";
      if (!cbSourceUrl) return;
      var cbDataUrl = ok ? resolveBg360PackDataUrl(cbSourceUrl, cbQuality) : "";
      if (cbDataUrl) {
        img.src = cbDataUrl;
      }
    });
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

    var aliasId = extractAliasId(ref, "audio");
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
        "<span class='game-list-id'>" + escapeHtml(audioId) + "</span>" +
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

    var aliasId = extractAliasId(action.src, "video");
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
        "<span class='game-list-id'>" + escapeHtml(videoId) + "</span>" +
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
      var safeGameId = escapeHtml(gameId);
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
    console.log('[GRAPH GAME]', gameId, game, 'used=', isUsed);

    var safeGameId = escapeHtml(gameId);
    var safeTitle = escapeHtml(game.title || gameId);
    var safeDescription = escapeHtml(game.description || "");
    var safeCover = getGraphImageSrc(game.cover || "");
    


    var tooltip = escapeHtml(game.description || game.title || gameId);
    var titleAttr = compact ? "" : " title='" + tooltip + "'";

    var gameNodeId = 'game_' + gameId.replace(/[^a-zA-Z0-9_]/g, '_');

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


function computeTextInfo(story) {

  var characters = 0;
  var words = 0;

  var scenes = story.scenes || [];

  for (var s = 0; s < scenes.length; s++) {

    var actions = scenes[s].actions || [];

    for (var a = 0; a < actions.length; a++) {

      var act = actions[a];

      if (act.type === "say" || act.type === "text") {

        var t = act.text || "";

        characters += t.length;

        var w = t.trim().split(/\s+/);

        if (t.trim() !== "") words += w.length;
      }
    }
  }

  return {
    characters: characters,
    words: words
  };
}

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

        var id = extractAliasId(act.src, "bg");

        if (id && !story.assets.backgrounds[id]) {
          errors.push("Background not found: " + id);
        }
      }

      if (act.type === "char") {
        if (!act.charId || !act.src) continue; // hide all пропускаем

        var id = extractAliasId(act.src, "ch");

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

// Подсчёт статистики.
function computeStoryStats(story) {
  var scenes = story.scenes || [];

  var usedBg = {};                 // bgId -> true
  var backgroundCounts = {};       // bgId -> count
  var usedCh = {};                 // charId -> true
  var usedCharacterEmotions = {};  // charId -> { emotion: true }
  var characterEmotionCounts = {}; // charId -> { emotion: count }

  var sayCount = 0;
  var textCount = 0;
  var choiceCount = 0;
  var bgmActions = 0;
  var sfxActions = 0;
  var videoActions = 0;
  var audioCounts = {};

  // Рекурсивно обходит все вложенные ветки (choice/if_block), чтобы статистика по фонам и другим действиям
  // включала меню и условные подветки, а не только верхний уровень сцен.
  function collectStatsFromActions(actions) {
    if (!Array.isArray(actions)) return;

    for (var a = 0; a < actions.length; a++) {
      var act = actions[a];
      if (!act || !act.type) continue;

      if (act.type === "bg") {
        var bgId = extractAliasId(act.src, "bg");
        if (bgId) {
          usedBg[bgId] = true;
          backgroundCounts[bgId] = (backgroundCounts[bgId] || 0) + 1;
        }
      }

      if (act.type === "char") {
        if (act.charId) {
          usedCh[act.charId] = true;

          if (!usedCharacterEmotions[act.charId]) {
            usedCharacterEmotions[act.charId] = {};
          }
          if (!characterEmotionCounts[act.charId]) {
            characterEmotionCounts[act.charId] = {};
          }

          if (act.emotion) {
            usedCharacterEmotions[act.charId][act.emotion] = true;
            characterEmotionCounts[act.charId][act.emotion] = (characterEmotionCounts[act.charId][act.emotion] || 0) + 1;
          }
        }
      }

      if (act.type === "say") sayCount++;
      if (act.type === "text") textCount++;
      if (act.type === "choice") {
        choiceCount++;
        if (Array.isArray(act.choices)) {
          for (var c = 0; c < act.choices.length; c++) {
            var choice = act.choices[c];
            if (choice && Array.isArray(choice.actions)) {
              collectStatsFromActions(choice.actions);
            }
          }
        }
      }
      if (act.type === "if_block") {
        if (Array.isArray(act.branches)) {
          for (var b = 0; b < act.branches.length; b++) {
            var branch = act.branches[b];
            if (branch && Array.isArray(branch.actions)) {
              collectStatsFromActions(branch.actions);
            }
          }
        }
        if (Array.isArray(act.elseActions)) {
          collectStatsFromActions(act.elseActions);
        }
      }
      if (act.type === "bgm") {
        bgmActions++;
        if (act.src) {
          var audioIdFromBgm = extractAliasId(act.src, "audio");
          if (audioIdFromBgm) {
            audioCounts[audioIdFromBgm] = (audioCounts[audioIdFromBgm] || 0) + 1;
          }
        }
      }
      if (act.type === "sfx") sfxActions++;
      if (act.type === "video") videoActions++;
    }
  }

  for (var s = 0; s < scenes.length; s++) {
    collectStatsFromActions(scenes[s].actions || []);
  }

  


  var backgroundsMap = (story.assets && story.assets.backgrounds) ? story.assets.backgrounds : {};
  var allBackgroundIds = Object.keys(backgroundsMap).sort();

  var usedBackgroundIds = [];
  var unusedBackgroundIds = [];

  for (var i = 0; i < allBackgroundIds.length; i++) {
    var bgId = allBackgroundIds[i];
    if (usedBg[bgId]) usedBackgroundIds.push(bgId);
    else unusedBackgroundIds.push(bgId);
  }

  var backgroundsDetailed = [];

  for (var j = 0; j < usedBackgroundIds.length; j++) {
    backgroundsDetailed.push({
      id: usedBackgroundIds[j],
      used: true
    });
  }

  for (var k = 0; k < unusedBackgroundIds.length; k++) {
    backgroundsDetailed.push({
      id: unusedBackgroundIds[k],
      used: false
    });
  }




  var charactersMap = (story.assets && story.assets.characters) ? story.assets.characters : {};
  var allCharacterIds = Object.keys(charactersMap).sort();

  var usedCharacterIds = [];
  var unusedCharacterIds = [];

  for (var i = 0; i < allCharacterIds.length; i++) {
    var charId = allCharacterIds[i];
    if (usedCh[charId]) usedCharacterIds.push(charId);
    else unusedCharacterIds.push(charId);
  }

  var orderedCharacterIds = usedCharacterIds.concat(unusedCharacterIds);

  var usedCharactersDetailed = [];

  for (var j = 0; j < orderedCharacterIds.length; j++) {
    var currentCharId = orderedCharacterIds[j];
    var charData = charactersMap[currentCharId] || {};
    var displayName = charData.name || currentCharId;
    var allEmotions = charData.images ? Object.keys(charData.images).sort() : [];
    var usedEmotionsMap = usedCharacterEmotions[currentCharId] || {};

    var usedEmotions = [];
    var unusedEmotions = [];

    for (var k = 0; k < allEmotions.length; k++) {
      var emotion = allEmotions[k];
      if (usedEmotionsMap[emotion]) usedEmotions.push(emotion);
      else unusedEmotions.push(emotion + "*");
    }

    usedCharactersDetailed.push({
      id: currentCharId,
      name: displayName,
      used: !!usedCh[currentCharId],
      emotionsDisplay: usedEmotions.concat(unusedEmotions)
    });
  }

  return {
    sceneCount: scenes.length,
    usedBackgroundIds: usedBackgroundIds,
    unusedBackgroundIds: unusedBackgroundIds,
    backgroundCounts: backgroundCounts,
    backgroundsDetailed: backgroundsDetailed,
    usedCharacterIds: usedCharacterIds,
    unusedCharacterIds: unusedCharacterIds,
    characterEmotionCounts: characterEmotionCounts,
    usedCharactersDetailed: usedCharactersDetailed,
    sayCount: sayCount,
    textCount: textCount,
    choiceCount: choiceCount,
    bgmActions: bgmActions,
    sfxActions: sfxActions,
    videoActions: videoActions,
    audioCounts: audioCounts
  };
} // function


function extractAliasId(ref, group) {
  // ref вида "@bg.campusHall" или "@ch.annaNeutral"
  if (!ref || typeof ref !== "string") return "";
  if (ref.indexOf("@") !== 0) return "";         // если прямой путь — не трогаем
  var parts = ref.substring(1).split(".");
  if (parts.length < 2) return "";
  if (parts[0] !== group) return "";
  return parts.slice(1).join(".");
}

function countKeys(obj) {
  var n = 0;
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) n++;
  return n;
}

function keysSorted(obj) {
  var arr = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) arr.push(k);
  arr.sort();
  return arr;
}

// минимальный экранизатор для вставки в innerHTML (если будете добавлять “детали”)
function escapeHtml(s) {
  s = String(s);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

    var hasMetaValue = meta
      && meta[metaKey] !== undefined
      && meta[metaKey] !== null
      && isValidUIConfigValue(meta[metaKey], config);

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

// Безопасный парсинг чисел из строки.
// Если значение кривое, возвращаем null.
function parseUIParamValue(rawValue, type) {
  console.log('[parseUIParamValue] raw=', rawValue, 'type=', type);
  if (rawValue === null || rawValue === undefined) return null;

  var value = String(rawValue).trim();
  if (value === '') return null;

  if (type === 'int') {
    if (!/^-?\d+$/.test(value)) {
      console.log('[parseUIParamValue] invalid int =', value);
      return null;
    }
    var intValue = parseInt(value, 10);
    console.log('[parseUIParamValue] intValue =', intValue);
    return isNaN(intValue) ? null : intValue;
  }

  if (type === 'float') {
    if (!/^-?\d+(\.\d+)?$/.test(value)) {
      console.log('[parseUIParamValue] invalid float =', value);
      return null;
    }
    var floatValue = parseFloat(value);
    console.log('[parseUIParamValue] floatValue =', floatValue);
    return isNaN(floatValue) ? null : floatValue;
  }

  return null;
}

// Читает параметры интерфейса из URL без учета регистра ключей.
// topSpacing, TOPSPACING, topspacing, TopSpacing — всё работает одинаково.
// Некорректные значения игнорируются.
function getUIOverridesFromQuery() {
  var params = new URLSearchParams(window.location.search);
  console.log('[URL] search raw =', window.location.search);
  var overrides = {};
  var normalized = {};

  // Нормализуем все ключи в нижний регистр
  params.forEach(function(value, key) {
    normalized[String(key).toLowerCase()] = value;
  });

  console.log('[URL] normalized =', JSON.stringify(normalized));

  Object.keys(UI_STYLE_CONFIG).forEach(function(metaKey) {
    var config = UI_STYLE_CONFIG[metaKey];
    var queryKey = metaKey.toLowerCase();
    console.log('[URL] check metaKey=' + metaKey + ', queryKey=' + queryKey + ', raw=' + normalized[queryKey]);

    console.log('[URL] checking key:', {
      metaKey: metaKey,
      queryKey: queryKey,
      hasParam: Object.prototype.hasOwnProperty.call(normalized, queryKey),
      rawValue: normalized[queryKey]
    });

    if (!Object.prototype.hasOwnProperty.call(normalized, queryKey)) {
      return;
    }

    var parsedValue = parseUIParamValue(normalized[queryKey], config.type);
    console.log('[URL] parsed value for', metaKey, '=', parsedValue);
    if (parsedValue === null) {
      return;
    }

    if (!isValidUIConfigValue(parsedValue, config)) {
      return;
    }

    // Явно записываем в правильное имя поля meta
    if (metaKey === 'topSpacing') {
      overrides.topSpacing = parsedValue;
    }

    if (metaKey === 'bottomSpacing') {
      overrides.bottomSpacing = parsedValue;
    }
  });

  return overrides;
}

// Проверка диапазонов из конфига
function isValidUIConfigValue(value, config) {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'number' || isNaN(value)) return false;

  if (typeof config.min === 'number' && value < config.min) return false;
  if (typeof config.max === 'number' && value > config.max) return false;

  return true;
}

// Проверяет, допустимо ли значение по правилам конфига
function isValidUIConfigValue(value, config) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof config.validate === 'function') {
    return !!config.validate(value);
  }

  return true;
}

// Читает параметры интерфейса из адресной строки.
// Параметры не зависят от регистра.
// Некорректные значения игнорируются.
function getUIOverridesFromQuery() {
  var params = new URLSearchParams(window.location.search);
  console.log('[URL] window.location.search =', window.location.search);
  var overrides = {};
  var normalized = {};

  // Нормализуем ключи: topSpacing, TOPSPACING, topspacing -> topspacing
  params.forEach(function(value, key) {
    normalized[String(key).toLowerCase()] = value;
  });
  console.log('[URL] normalized params =', normalized);

  // Проходим по конфигу и ищем соответствующие параметры в URL
  Object.keys(UI_STYLE_CONFIG).forEach(function(metaKey) {
    var config = UI_STYLE_CONFIG[metaKey];
    var normalizedKey = metaKey.toLowerCase();

    if (!normalized.hasOwnProperty(normalizedKey)) {
      return;
    }

    var parsedValue = parseUIParamValue(normalized[normalizedKey], config.type);

    // Если значение не распарсилось — просто игнорируем
    if (parsedValue === null) {
      return;
    }

    // Если значение не прошло validate — тоже игнорируем
    if (!isValidUIConfigValue(parsedValue, config)) {
      return;
    }

    console.log('[URL] apply override:', metaKey, '=', parsedValue);
    overrides[metaKey] = parsedValue;
  });

  console.log('[URL] final overrides =', overrides);
  return overrides;
}


function getUIOverridesFromQuery() {
  var params = new URLSearchParams(window.location.search);
  var overrides = {};

  // topSpacing
  if (params.has('topSpacing')) {
    var topSpacing = parseInt(params.get('topSpacing'), 10);
    if (!isNaN(topSpacing)) {
      overrides.topSpacing = topSpacing;
    }
  }

  // bottomSpacing
  if (params.has('bottomSpacing')) {
    var bottomSpacing = parseInt(params.get('bottomSpacing'), 10);
    if (!isNaN(bottomSpacing)) {
      overrides.bottomSpacing = bottomSpacing;
    }
  }

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
  var queryOverrides = {};
  var urlParams = new URLSearchParams(window.location.search);
  var normalizedUrlParams = {};

  urlParams.forEach(function(value, key) {
    normalizedUrlParams[String(key).toLowerCase()] = value;
  });

  ['topSpacing', 'rightSpacing', 'bottomSpacing', 'leftSpacing'].forEach(function(key) {
    var raw = normalizedUrlParams[key.toLowerCase()];
    if (raw === undefined) return;

    if (/^\d+$/.test(String(raw).trim())) {
      queryOverrides[key] = parseInt(raw, 10);
    } else {
      console.log('[URL DIRECT] ignored invalid ' + key + ' =', raw);
    }
  });

  var finalMeta = Object.assign({}, storyMeta, queryOverrides);

  var hasExplicitTop =
    Object.prototype.hasOwnProperty.call(storyMeta, 'topSpacing') ||
    Object.prototype.hasOwnProperty.call(queryOverrides, 'topSpacing');

  var hasExplicitRight =
    Object.prototype.hasOwnProperty.call(storyMeta, 'rightSpacing') ||
    Object.prototype.hasOwnProperty.call(queryOverrides, 'rightSpacing');

  var hasExplicitBottom =
    Object.prototype.hasOwnProperty.call(storyMeta, 'bottomSpacing') ||
    Object.prototype.hasOwnProperty.call(queryOverrides, 'bottomSpacing');

  var hasExplicitLeft =
    Object.prototype.hasOwnProperty.call(storyMeta, 'leftSpacing') ||
    Object.prototype.hasOwnProperty.call(queryOverrides, 'leftSpacing');

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
    effectiveTop = num(finalMeta.topSpacing, 0);
    effectiveRight = num(finalMeta.rightSpacing, 0);
    effectiveBottom = num(finalMeta.bottomSpacing, 0);
    effectiveLeft = num(finalMeta.leftSpacing, 0);
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

  console.log('[Engine] novel window applied:', {
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

  adjustCharacterScale();
}

// Управление размытым фоном

/** Сбрасывает второй видеоэлемент blur-слоя: без воспроизведения, чтобы не держать лишний декодинг. */
function hideBlurBackgroundVideo() {
  if (!elBlurBgVideo) return;
  elBlurBgVideo.onerror = null;
  try {
    elBlurBgVideo.pause();
  } catch (e) {}
  elBlurBgVideo.removeAttribute("src");
  try {
    elBlurBgVideo.load();
  } catch (e2) {}
  elBlurBgVideo.classList.add("hidden");
}

/** Переносит object-position и масштаб с основного ролика на blur-дубликат (совпадает с pan/zoom wide-bg). */
function copyBgVideoObjectPositionToBlur(sourceVideo, blurVideo) {
  if (!sourceVideo || !blurVideo || !sourceVideo.style) return;
  var op = sourceVideo.style.objectPosition;
  if (op) blurVideo.style.objectPosition = op;
  else blurVideo.style.objectPosition = "";
  var tf = sourceVideo.style.transform;
  if (tf) blurVideo.style.transform = tf;
  else blurVideo.style.transform = "";
  var tfo = sourceVideo.style.transformOrigin;
  if (tfo) blurVideo.style.transformOrigin = tfo;
  else blurVideo.style.transformOrigin = "";
}

function updateBlurBackground(src) {
  console.log('[Engine] updateBlurBackground called with src:', src);
  console.log('[Engine] elBlurBgLayer:', elBlurBgLayer);
  console.log('[Engine] elBlurBgImage:', elBlurBgImage);
  console.log('[Engine] STORY.meta:', STORY.meta);
  console.log('[Engine] STORY.meta.blurBackground:', STORY.meta?.blurBackground);

  if (!elBlurBgLayer || !elBlurBgImage) {
    console.warn('[Engine] Элементы размытого фона не найдены');
    return;
  }

  if (!STORY.meta || !STORY.meta.blurBackground) {
    console.log('[Engine] Размытый фон отключен в метаданных');
    elBlurBgLayer.classList.add("hidden");
    hideBlurBackgroundVideo();
    return;
  }

  if (src && src !== "") {
    console.log('[Engine] Устанавливаем размытый фон:', src);
    hideBlurBackgroundVideo();
    elBlurBgImage.classList.remove("hidden");
    assignRasterImageToElement(elBlurBgImage, src, {});
    elBlurBgLayer.classList.remove("hidden");
    // applySpacingSettings мог выставить display:none — без явного block слой остаётся невидимым.
    elBlurBgLayer.style.display = "block";

    // Принудительно применяем стили
    elBlurBgImage.style.objectFit = 'cover';
    elBlurBgImage.style.width = '100%';
    elBlurBgImage.style.height = '100%';
  } else {
    console.log('[Engine] src пустой, скрываем размытый фон');
    elBlurBgLayer.classList.add("hidden");
    hideBlurBackgroundVideo();
  }
}

/**
 * Размытый фон для видео: второй <video> с тем же источником, без play(), пауза на кадре 0 после loadeddata.
 * Обходит canvas и data URL — в localStorage не кладётся тяжёлый blurSnapshotSrc.
 */
function syncBlurBackgroundVideo(videoEl, fallbackSrc) {
  if (!elBlurBgLayer || !elBlurBgImage) return;
  if (!STORY.meta || !STORY.meta.blurBackground) return;

  var fallbackTrim = typeof fallbackSrc === "string" ? fallbackSrc.trim() : "";
  var vidNormForFb = videoEl ? normalizeAssetUrl(videoEl.currentSrc || videoEl.src || "") : "";
  var imageFallback = fallbackTrim || findBlurFallbackImageForBgVideoUrl(vidNormForFb);

  function applyImageFallback() {
    hideBlurBackgroundVideo();
    if (imageFallback) updateBlurBackground(imageFallback);
    else elBlurBgLayer.classList.add("hidden");
  }

  if (!elBlurBgVideo) {
    if (imageFallback) updateBlurBackground(imageFallback);
    return;
  }

  var seq = ++blurBgVideoSyncSeq;

  if (!videoEl) {
    applyImageFallback();
    return;
  }

  var targetNorm = normalizeAssetUrl(videoEl.currentSrc || videoEl.src || "");
  visualTrace("blurVideoSync:start", {
    fallbackSrc: imageFallback,
    videoSrc: targetNorm
  });

  if (!targetNorm) {
    visualTrace("blurVideoSync:no-src", {});
    applyImageFallback();
    return;
  }

  elBlurBgImage.removeAttribute("src");
  elBlurBgImage.classList.add("hidden");
  elBlurBgVideo.classList.remove("hidden");

  elBlurBgVideo.muted = true;
  elBlurBgVideo.defaultMuted = true;
  elBlurBgVideo.loop = false;
  elBlurBgVideo.autoplay = false;
  if ("playsInline" in elBlurBgVideo) elBlurBgVideo.playsInline = true;
  elBlurBgVideo.setAttribute("playsinline", "");
  elBlurBgVideo.preload = "auto";

  function finalizeBlurVideoFrame() {
    if (seq !== blurBgVideoSyncSeq) return;
    try {
      elBlurBgVideo.pause();
      elBlurBgVideo.currentTime = 0;
    } catch (e) {}
    copyBgVideoObjectPositionToBlur(videoEl, elBlurBgVideo);
    elBlurBgVideo.style.objectFit = "cover";
    elBlurBgVideo.style.width = "100%";
    elBlurBgVideo.style.height = "100%";
    elBlurBgLayer.classList.remove("hidden");
    elBlurBgLayer.style.display = "block";
    visualTrace("blurVideoSync:ready", {
      videoWidth: elBlurBgVideo.videoWidth,
      videoHeight: elBlurBgVideo.videoHeight
    });
  }

  elBlurBgVideo.onerror = function () {
    if (seq !== blurBgVideoSyncSeq) return;
    visualTrace("blurVideoSync:error", { videoSrc: targetNorm });
    hideBlurBackgroundVideo();
    if (imageFallback) updateBlurBackground(imageFallback);
    else elBlurBgLayer.classList.add("hidden");
  };

  var sameSrc =
    normalizeAssetUrl(elBlurBgVideo.currentSrc || elBlurBgVideo.src || "") === targetNorm &&
    !!(elBlurBgVideo.currentSrc || elBlurBgVideo.src);

  if (sameSrc && elBlurBgVideo.readyState >= 2) {
    finalizeBlurVideoFrame();
    return;
  }

  elBlurBgVideo.addEventListener(
    "loadeddata",
    function () {
      if (seq !== blurBgVideoSyncSeq) return;
      finalizeBlurVideoFrame();
    },
    { once: true }
  );

  var rawAssign = videoEl.currentSrc || videoEl.src || "";
  elBlurBgVideo.src = rawAssign;
  try {
    elBlurBgVideo.load();
  } catch (e3) {}

  setTimeout(function () {
    if (seq !== blurBgVideoSyncSeq) return;
    if (!elBlurBgVideo.videoWidth && imageFallback) {
      visualTrace("blurVideoSync:timeout-fallback", { videoSrc: targetNorm });
      applyImageFallback();
    }
  }, 600);
}

// После автосейва runCurrent снова вызывает setBackground с тем же роликом — loadeddata может не прийти,
// и blur-дубликат может отстать. Несколько попыток + подписка на loadeddata подтягивают синхронизацию.
function scheduleBlurRefreshFromBgVideo(fallbackSrc) {
  if (!STORY.meta || !STORY.meta.blurBackground) return;
  var fb = typeof fallbackSrc === "string" ? fallbackSrc : "";

  function tick() {
    if (!elBgVideo || elBgVideo.classList.contains("hidden")) return;
    var vsrc = elBgVideo.currentSrc || elBgVideo.src || "";
    if (!vsrc) return;
    syncBlurBackgroundVideo(elBgVideo, fb);
  }

  if (elBgVideo) {
    elBgVideo.addEventListener(
      "loadeddata",
      function () {
        tick();
      },
      { once: true }
    );
  }

  tick();
  setTimeout(tick, 0);
  setTimeout(tick, 60);
  setTimeout(tick, 200);
  setTimeout(tick, 600);
}




// Добавьте после объявления переменных для графиков

// Переменные для panzoom
var panzoomWrapper = document.getElementById("panzoomWrapper");
var panzoomContent = document.getElementById("panzoomContent");
var mermaidWrapper = document.getElementById("mermaidWrapper");
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



// Переменные для обработчиков событий
var panzoomHandlers = {};

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



// Функция зумирования
function zoom(delta, mouseX, mouseY) {
  var oldScale = panzoomState.scale;
  var newScale = panzoomState.scale * (1 + delta * 0.1);
  newScale = clampPanzoomScale(newScale);
  
  if (newScale === oldScale) return;
  
  // Если есть координаты мыши, зумируем относительно них
  if (mouseX !== undefined && mouseY !== undefined && panzoomWrapper) {
    var rect = panzoomWrapper.getBoundingClientRect();
    var mouseXRatio = (mouseX - rect.left - panzoomState.translateX) / oldScale;
    var mouseYRatio = (mouseY - rect.top - panzoomState.translateY) / oldScale;
    
    panzoomState.translateX = mouseX - rect.left - mouseXRatio * newScale;
    panzoomState.translateY = mouseY - rect.top - mouseYRatio * newScale;
  }
  
  panzoomState.scale = newScale;
  updatePanzoomTransform();
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
      try { panzoomWrapper.setPointerCapture(e.pointerId); } catch (err) {}
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
      try { panzoomWrapper.releasePointerCapture(e.pointerId); } catch (err) {}
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

    return window.mermaid.render("vn-graph-" + renderSequence + "-" + index, code, mermaidGraph)
      .then(function(result) {
        if (isRenderOutdated()) return false;

        clearMermaidContainer();
        mermaidGraph.innerHTML = result && result.svg ? result.svg : "";

        if (result && typeof result.bindFunctions === "function") {
          result.bindFunctions(mermaidGraph);
        }

        if (!hasMermaidRenderError()) {
          hydrateBg360GraphThumbnails(mermaidGraph);
          hydrateRasterGraphThumbnails(mermaidGraph);
          hydrateGraphCharacterFrames(mermaidGraph);
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
  return renderMermaidGraph(renderSequence).then(function(rendered) {
    if (!rendered || renderSequence !== graphRenderSequence) return false;
    restorePanzoomWhenGraphReady(stateKey, 0, renderSequence);
    return true;
  });
}

function debugCharacterGraphLayout() {
  try {
    var svg = mermaidGraph && mermaidGraph.querySelector('svg');
    if (!svg) {
      console.log('[GRAPH DEBUG] svg not found');
      return;
    }

    var nodes = svg.querySelectorAll('g.node');
    console.log('[GRAPH DEBUG] total nodes:', nodes.length);

    nodes.forEach(function(node, index) {
      var fo = node.querySelector('foreignObject');
      var container = node.querySelector('.char-emotions-container');
      var thumbs = node.querySelectorAll('.char-emotion-thumbnail');
      var labelText = (node.textContent || '').replace(/\s+/g, ' ').trim();

      if (!container && !thumbs.length) return;

      var nodeBox = (typeof node.getBBox === 'function') ? node.getBBox() : null;
      var foRect = fo ? fo.getBoundingClientRect() : null;
      var containerRect = container ? container.getBoundingClientRect() : null;

      console.group('[GRAPH DEBUG NODE] ' + labelText);
      console.log('index =', index);
      console.log('thumbCount =', thumbs.length);

      if (nodeBox) {
        console.log(
          'nodeBBox width =', Math.round(nodeBox.width),
          'height =', Math.round(nodeBox.height)
        );
      } else {
        console.log('nodeBBox = unavailable');
      }

      if (fo) {
        console.log(
          'foreignObject attr width =', fo.getAttribute('width'),
          'attr height =', fo.getAttribute('height')
        );
      } else {
        console.log('foreignObject = not found');
      }

      if (foRect) {
        console.log(
          'foreignObject rect width =', Math.round(foRect.width),
          'height =', Math.round(foRect.height)
        );
      }

      if (container && containerRect) {
        var ccs = window.getComputedStyle(container);
        console.log(
          'container rect width =', Math.round(containerRect.width),
          'height =', Math.round(containerRect.height)
        );
        console.log(
          'container computed width =', ccs.width,
          'maxWidth =', ccs.maxWidth,
          'display =', ccs.display,
          'flexWrap =', ccs.flexWrap,
          'gap =', ccs.gap,
          'overflow =', ccs.overflow
        );
      } else {
        console.log('char-emotions-container = not found');
      }

      thumbs.forEach(function(img, i) {
        var r = img.getBoundingClientRect();
        var cs = window.getComputedStyle(img);
        console.log(
          'thumb[' + i + '] rect width =', Math.round(r.width),
          'height =', Math.round(r.height),
          'computed width =', cs.width,
          'computed height =', cs.height
        );
      });

      console.groupEnd();
    });
  } catch (err) {
    console.error('[GRAPH DEBUG ERROR]', err);
  }
}


// Добавьте эту функцию для принудительного пересчета при переключении вкладок

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

})();
