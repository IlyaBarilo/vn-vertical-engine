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

const UI_I18N = {
  en: {
    mute: "Mute",
    stats: "Stats",
    next: "Next",
    choices: "Choices",
    game: "Game",
    closeGame: "Close Game",
    hintContinue: "Click to continue",
    statsTitle: "Script Statistics",
    graphButton: "📊 Graph",
    textButton: "📄 Text",
    graphButtonTitle: "Show/hide graph",
    textButtonTitle: "Show text statistics",
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
    gamesButton: "🎮 Games",
    gamesButtonTitle: "Show/hide games",
    gamesNoCover: "No preview",
    gamesLastLaunchNone: "Last launch: —",
    gamesLastLaunchClosed: "Last launch: {title}, difficulty {difficulty}, closed manually",
    gamesLastLaunchResult: "Last launch: {title}, difficulty {difficulty}, result {result}",
    gamesLaunchFailed: "Unable to launch the game",
    gamesNoGames: "No games found"
  },
  ru: {
    mute: "Звук",
    stats: "Статистика",
    next: "Далее",
    choices: "Выбор",
    game: "Игра",
    closeGame: "Закрыть игру",
    hintContinue: "Нажмите, чтобы продолжить",
    statsTitle: "Статистика сценария",
    graphButton: "📊 Граф",
    textButton: "📄 Текст",
    graphButtonTitle: "Показать/скрыть граф",
    textButtonTitle: "Показать текстовую статистику",
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
    gamesButton: "🎮 Игры",
    gamesButtonTitle: "Показать/скрыть игры",
    gamesNoCover: "Нет превью",
    gamesLastLaunchNone: "Последний запуск: —",
    gamesLastLaunchClosed: "Последний запуск: {title}, сложность {difficulty}, игра закрыта вручную",
    gamesLastLaunchResult: "Последний запуск: {title}, сложность {difficulty}, результат {result}",
    gamesLaunchFailed: "Не удалось запустить игру",
    gamesNoGames: "Игры не найдены"
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
  if (btnCloseGame) btnCloseGame.textContent = t("closeGame");

  var btnCloseStatsGame = document.getElementById("btnCloseStatsGame");
  if (btnCloseStatsGame) btnCloseStatsGame.textContent = t("closeGame");

  var hint = document.querySelector(".hint");
  if (hint) hint.textContent = t("hintContinue");

  var statsTitle = document.querySelector(".statsTitle");
  if (statsTitle) statsTitle.textContent = t("statsTitle");

  var btnToggleGraph = document.getElementById("btnToggleGraph");
  if (btnToggleGraph) {
    if (window.showingGraph) {
      btnToggleGraph.textContent = t("textButton");
      btnToggleGraph.title = t("textButtonTitle");
    } else {
      btnToggleGraph.textContent = t("graphButton");
      btnToggleGraph.title = t("graphButtonTitle");
    }
  }

  var btnCloseStats = document.getElementById("btnCloseStats");
  if (btnCloseStats) btnCloseStats.setAttribute("aria-label", t("closeStats"));

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

  var btnShowGames = document.getElementById("btnShowGames");
  if (btnShowGames) {
    if (window.showingGames) {
      btnShowGames.textContent = t("textButton");
      btnShowGames.title = t("textButtonTitle");
    } else {
      btnShowGames.textContent = t("gamesButton");
      btnShowGames.title = t("gamesButtonTitle");
    }
  }

}

window.showingGraph = false;



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





// Инициализация Mermaid с правильными настройками для текста над линиями
// Упрощенная инициализация Mermaid
if (window.mermaid) {
  window.mermaid.initialize({
    theme: 'default',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis',
      padding: 4,           // Внутренние отступы в узлах (было 15)
      nodeSpacing: 60,       // Расстояние между узлами (было 50)
      rankSpacing: 100,       // Расстояние между уровнями (было 50)
      borderRadius: 10
    },
    securityLevel: 'loose',
    startOnLoad: false
  });
}




// Для получения версии из GitHub. Заменяется только первая найденная метка версии (см. ниже)
window.APP_VERSION = "__VERSION__";

if (window.APP_VERSION === "__VERSION__") {
  window.APP_VERSION = "0.0.0.0dev";
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

// ---------- DOM ----------
var elTitle = document.getElementById("title");
var elNovelWindow = document.getElementById("novelWindow");
var elBg = document.getElementById("bgLayer");
var elChar = document.getElementById("charLayer");

// Жёстко скрываем персонажа на старте, чтобы не было первого "всплеска" когда появляется большого размера
if (elChar) {
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

var btnStats = document.getElementById("btnStats");
var elStatsPanel = document.getElementById("statsPanel");
var btnCloseStats = document.getElementById("btnCloseStats");
var elStatsBody = document.getElementById("statsBody");

// Новые DOM-элементы
var elBlurBgLayer = document.getElementById("blurBgLayer");
var elBlurBgImage = document.getElementById("blurBgImage");

// Глобальный наблюдатель за именем
var nameObserver = null;

// В начале файла, после других переменных:
let currentSceneId = null;

// Для отладки
console.log('[Engine] blurBgLayer:', elBlurBgLayer);
console.log('[Engine] blurBgImage:', elBlurBgImage);

btnStats.addEventListener("click", function () {
  toggleStatsPanel();
});

btnCloseStats.addEventListener("click", function () {
  hideStatsPanel();
});

// клик по затемнению (вне карточки) — закрывает
elStatsPanel.addEventListener("click", function (e) {
  if (e.target === elStatsPanel) hideStatsPanel();
});

// Клик по фону/персонажу/сцене тоже листает дальше
var elStage = document.getElementById("stage");

// чтобы клик по кнопкам/слайдеру/меню НЕ листал
function isUiClick(target) {
  return !!(target.closest &&
    (target.closest(".topbar") ||
    target.closest("#dialog") ||
    target.closest("#choices") ||
    target.closest("#gameModal") ||
    target.closest("#statsGameModal")));
}

elStage.addEventListener("click", function (e) {
  console.log("[LOG] stage click", {
    targetId: e.target && e.target.id,
    modalHidden: elGameModal.classList.contains("hidden"),
    inGame: state.inGame
  });
  
  if (isUiClick(e.target)) return;
  onNext();
});




profiler.mark('DOM has been loaded');










// Добавьте в engine.js после объявления переменных

// Элементы управления графиком
var btnToggleGraph = document.getElementById("btnToggleGraph");
var btnShowGames = document.getElementById("btnShowGames");
var graphContainer = document.getElementById("graphContainer");
var gamesContainer = document.getElementById("gamesContainer");
var gamesGrid = document.getElementById("gamesGrid");
var gamesStatus = document.getElementById("gamesStatus");
var graphControls = document.getElementById("graphControls");
var btnCopyMermaid = document.getElementById("btnCopyMermaid");
var btnRefreshGraph = document.getElementById("btnRefreshGraph");
var mermaidGraph = document.getElementById("mermaidGraph");

// Состояние отображения
var showingGraph = false;
var showingGames = false;

// Переменная для хранения текущего кода графа
var currentMermaidCode = "";
var lastStandaloneGameInfo = null;

// Обработчик кнопки переключения
if (btnToggleGraph) {
  btnToggleGraph.addEventListener("click", function() {
    toggleGraphView();
  });
}

if (btnShowGames) {
  btnShowGames.addEventListener("click", function() {
    toggleGamesView();
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
    if (showingGraph) {
      renderMermaidGraph();
    }
  });
}

// Функция переключения между текстом и графиком
function setStatsView(view) {
  var statsBody = document.getElementById("statsBody");

  showingGraph = (view === "graph");
  showingGames = (view === "games");
  window.showingGraph = showingGraph;
  window.showingGames = showingGames;

  if (statsBody) {
    statsBody.classList.toggle("hidden", view !== "text");
  }

  if (graphContainer) {
    graphContainer.classList.toggle("hidden", view !== "graph");
  }

  if (graphControls) {
    graphControls.classList.toggle("hidden", view !== "graph");
  }

  if (gamesContainer) {
    gamesContainer.classList.toggle("hidden", view !== "games");
  }

  if (view === "graph") {
    renderMermaidGraph();
    setTimeout(resetPanzoom, 200);
    setTimeout(function() {
      resetPanzoom();
    }, 500);
  }

  if (view === "games") {
    renderGamesCatalog();
  }

  applyUiLanguage();
}

function toggleGraphView() {
  setStatsView(showingGraph ? "text" : "graph");
}

function toggleGamesView() {
  setStatsView(showingGames ? "text" : "games");
}

// Функция рендеринга графа Mermaid
function renderMermaidGraph() {
  if (!window.STORY) return;
  
  // Получаем данные о недостижимых сценах
  var reach = findUnreachableScenes(window.STORY);
  
  // Генерируем код Mermaid
  currentMermaidCode = buildMermaidGraph(window.STORY, reach.unreachable);
  
  // Вставляем код в контейнер
  if (mermaidGraph) {
    mermaidGraph.innerHTML = currentMermaidCode;
    
    // Инициализируем Mermaid
    if (window.mermaid) {
      try {
        // Очищаем предыдущую инициализацию
        mermaidGraph.removeAttribute('data-processed');
        window.mermaid.init(undefined, mermaidGraph);

        // ВАЖНО: сбрасываем масштаб ПОСЛЕ полной отрисовки
        setTimeout(function() {
          resetPanzoom();
          console.log('[Panzoom] Сброс после рендера');
        }, 300);

      } catch (e) {
        console.error("Ошибка инициализации Mermaid:", e);
        mermaidGraph.innerHTML = '<div style="color: red; padding: 1rem;">Ошибка отображения графа. Проверьте консоль.</div>';
      }
    } else {
      mermaidGraph.innerHTML = '<div style="color: orange; padding: 1rem;">Библиотека Mermaid не загружена</div>';
    }
  }
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
    elChar.style.height = "0px";
    
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

// Высота экрана, под которую делался дизайн
// используется для автоадаптации
var UI_REFERENCE_HEIGHT = 1440;
console.log('[SCALE] UI_REFERENCE_HEIGHT initialized:', UI_REFERENCE_HEIGHT);

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
  // Флаг: ждём ли клика "дальше"
  waitingNext: false,
  // Флаг: открыта ли мини-игра
  inGame: false,
  currentGame: null,
  lastNextAt: 0,
  nextLocked: false
};

// Флаг для отслеживания первого диалога
var isFirstDialog = true;

// ---------- Аудио ----------
// Один канал для фоновой музыки и отдельный для эффектов.
var audio = {
  bgm: new Audio(),
  sfx: new Audio(),
  muted: true,
  masterVolume: 0.2,
  // для плавного затухания (если понадобится)
  fadeTimer: null
};

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
  restart();
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
restart();

// =========================================================
//                   ОСНОВНЫЕ ФУНКЦИИ
// =========================================================

function restart() {
  // Сбрасываем ошибки парсинга
  window.PARSE_ERRORS = [];

  suppressAutoRunOnce = false;
  lastNextTime = 0;
  state.currentGame = null;
  state.waitingNext = false;
  state.nextLocked = false;

  // Никаких сохранений: просто сбрасываем переменные и идём в start.
  state.vars = JSON.parse(JSON.stringify((STORY && STORY.vars) ? STORY.vars : {}));
  state.inGame = false;
  hideChoices();
  closeGameFrameVisualOnly();
  hideOverlay();

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



  // сброс к стартовой сцене
  state.sceneId = STORY.meta && STORY.meta.start ? STORY.meta.start : null;
  currentSceneId = state.sceneId;
  state.actionIndex = 0;
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

  runCurrent();
}

function runCurrent() {
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
    // если открыта игра — не продолжаем
    if (state.inGame) return;

    var scene = state.sceneMap[state.sceneId];
    if (!scene) {
      showError("Не найдена сцена: " + state.sceneId);
      return;
    }

    // если дошли до конца сцены — останавливаемся
    if (state.actionIndex >= scene.actions.length) {
      console.log('[VN] Достигнут конец сцены', state.sceneId);
      state.waitingNext = false;
      state.nextLocked = true; // Блокируем дальнейшие клики
      return;
    }


    var action = scene.actions[state.actionIndex];
    console.log('[FLOW] runCurrent:action picked', {
      sceneId: state.sceneId,
      actionIndexBeforeInc: state.actionIndex,
      action: action,
      waitingNext: state.waitingNext,
      nextLocked: state.nextLocked
    });
    state.actionIndex++;

    if (!action || !action.type) continue;

    var shouldWait = executeAction(action);

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

  if (state.inGame) return;
  if (elGameModal && !elGameModal.classList.contains("hidden")) return;

  console.log("[VN] onNext ВЫЗВАНА!", "Timestamp:", Date.now(), "ms");
  console.trace(); // <-- Добавьте это! Покажет стек вызовов

  // Защита от двойных кликов
  var now = Date.now();
  if (now - lastNextTime < NEXT_COOLDOWN) {
    console.log("[VN] onNext проигнорирован (защита от двойного клика)");
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
  
  if (!elChoices.classList.contains("hidden")) return;
  if (state.inGame) return;

  // ВАЖНО: проверяем, ждём ли мы следующего действия
  if (!state.waitingNext) {
    console.log('[VN] onNext ignored - not waiting for next');
    return;
  }

  // Проверяем, не дошли ли мы до конца сценария
  var scene = state.sceneMap[state.sceneId];
  if (state.actionIndex >= scene.actions.length) {
    console.log('[VN] Достигнут конец сценария, игнорируем клик');
    return;
  }

  // Разрешаем только один "next" до следующего say/text
  if (state.nextLocked) return;
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
}

function renderTextVars(text) {
  if (typeof text !== "string") return text;

  return text.replace(/\{([^}]+)\}/g, function(_, varName) {
    var key = varName.trim();
    var value = state.vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

// =========================================================
//                   ACTION EXECUTION
// =========================================================

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
    case "bg":
      setBackground(resolveAsset(action.src));
      return false;

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
          console.log('[Engine CHAR] Image path:', char.images[action.emotion]);
        }
      }

      const src = resolveAsset(null, action.charId, action.emotion);
      console.log('[Engine CHAR] Resolved src:', src);

      console.log('[SCRIPT FLOW] char action -> setCharacter', {
        actionIndex: state.actionIndex - 1,
        action: action,
        resolvedSrc: src,
        pos: action.pos,
        charId: action.charId
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

      // Если персонаж уже видим с той же эмоцией - не нужно асинхронно ждать
      if (currentSrc === src && !isHidden) {
        console.log('[Engine CHAR] Character already visible, continuing');
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
      });

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
      showChoices(action.choices || []);
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
      playBgm(resolveAsset(action.src), !!action.loop, num(action.volume, 0.7), num(action.fadeMs, 0));
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
        var fn = new Function("vars", "with(vars){ return (" + expr + "); }");
        state.vars[varName] = fn(state.vars);
        console.log("[VN] set result:", varName, "=", state.vars[varName], "vars:", state.vars);
      } catch (e) {
        console.error("[VN] set error:", action.expression, e);
      }

      return false;
    }
   case "if_expr": {
      try {
        var fn = new Function("vars", "with(vars){ return (" + action.condition + "); }");
        var ok = !!fn(state.vars);

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
    case "if":
      // if: { cond: "vars.score >= 3", then: "a", else: "b" }
      // ВНИМАНИЕ: без eval для безопасности. Поддержим только простую форму:
      // { key: "score", op: ">=", value: 3, then: "...", else: "..." }
      return executeIfSafe(action);

    case "game":
      // game: { id: "quiz1", src: "games/quiz1/index.html", onResult: { setKey: "quizScore", goto: "..." } }
      openGame(action);
      return true;

    default:
      // неизвестный action — пропускаем
      return false;
  }
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

function setBackground(src) {
  if (!src) return;
  
  var normalizedSrc = normalizeAssetUrl(src);

  if (failedAssets.images[normalizedSrc]) {
    if (!failedAssets.images[normalizedSrc + "_logged"]) {
      console.warn('[IMG] skip failed background src:', normalizedSrc);
      failedAssets.images[normalizedSrc + "_logged"] = true;
    }
  return;
}

  elBg.onerror = null;

  elBg.onerror = function() {
    var badSrc = elBg.currentSrc || elBg.src || normalizedSrc;
    badSrc = normalizeAssetUrl(badSrc);

    console.warn('[IMG] background load error:', badSrc);

    if (badSrc) {
      failedAssets.images[badSrc] = true;
    }

    elBg.onerror = null;
    elBg.removeAttribute('src');

    // ДОБАВИТЬ:
    elBg.src = ""; // ← сброс окончательный
  };

  elBg.src = normalizedSrc;
  
  // Обновляем размытый фон тем же изображением
  if (typeof updateBlurBackground === 'function') {
    updateBlurBackground(normalizedSrc);
  }
  
  // Убираем принудительное применение стилей через JS
  // CSS должен работать сам через переменные
}

function setCharacter(src, pos, charId, done) {
  
  // В функции setCharacter, в самом начале добавьте:
  console.log('[setCharacter] ТЕКУЩИЙ ИНДЕКС В НАЧАЛЕ:', state.actionIndex);

  console.log('[Engine setCharacter] START - src:', src, 'charId:', charId);

  console.log('[Engine setCharacter] START ==========');
  console.log('[Engine setCharacter] Параметры:', { src, pos, charId });
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


  console.log('[Engine setCharacter] Called with:', { src, pos, charId });
  console.log('[Engine setCharacter] elChar element:', elChar);

  const seq = ++__charSeq;
  __activeCharSeq = seq;

  var normalizedSrc = normalizeAssetUrl(src);

  if (failedAssets.images[normalizedSrc]) {
    if (!failedAssets.images[normalizedSrc + "_logged"]) {
      console.warn('[CHAR FLOW] skip failed character src', {
        src: normalizedSrc,
        charId: charId
      });
      failedAssets.images[normalizedSrc + "_logged"] = true;
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
    currentHeight: elChar ? elChar.style.height : null
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

    if (done) done();
    return;
  }

  // Это команда show - показываем персонажа
  // Позиционирование можно применить заранее
  if (pos === "left") {
    elChar.style.left = "35%";
    elChar.style.transform = "translateX(-50%)";
  } else if (pos === "right") {
    elChar.style.left = "65%";
    elChar.style.transform = "translateX(-50%)";
  } else {
    elChar.style.left = "50%";
    elChar.style.transform = "translateX(-50%)";
  }




  // ===== проверка на уже видимого персонажа =====
  const currentSrc = elChar.getAttribute('src');
  const currentCharId = elChar.dataset.charId;

  // Если это тот же персонаж с той же эмоцией и он уже видим
  if (currentSrc === normalizedSrc && !elChar.classList.contains('hidden')) {
    console.log('[Engine setCharacter] Same image already visible, skipping');
    if (done) done();
    return;
  }

  // Если это тот же персонаж, но с другой эмоцией - показываем новую эмоцию без перезагрузки
  if (currentCharId === charId && currentSrc !== normalizedSrc && !elChar.classList.contains('hidden')) {
    console.log('[Engine setCharacter] Same character, changing emotion');
    
    // Просто меняем src, не скрывая персонажа
    elChar.onload = function() {

      console.log('[Engine setCharacter] Emotion changed successfully:', normalizedSrc);
      console.log('[setCharacter] onload - ИНДЕКС ДО ВЫЗОВА callback:', state.actionIndex);
      adjustCharacterScale();
      if (done) {
        console.log('[setCharacter] onload - ВЫЗЫВАЕМ done callback');
        done();
        console.log('[setCharacter] onload - ИНДЕКС ПОСЛЕ callback:', state.actionIndex);
      }
    };
    
    elChar.onerror = function() {
      var badSrc = normalizeAssetUrl(elChar.currentSrc || elChar.src || normalizedSrc);

      console.log('[Engine setCharacter] Failed to load new emotion:', normalizedSrc);
      console.log('[Engine setCharacter] Full URL:', elChar.src);
      console.log('[Engine setCharacter] Error event:', arguments);

      if (badSrc) {
        failedAssets.images[badSrc] = true;
      }

      if (done) done();
    };
    
    elChar.src = normalizedSrc;
    return; // Не продолжаем в основной код, так как уже обработали
  }
  // ===== =====









  if (charId) {
    elChar.dataset.charId = charId;
  }

  // Скрываем до полной подготовки (только для нового персонажа)
  elChar.classList.add("hidden");
  elChar.style.height = "0px";
  elChar.style.maxHeight = "none";

  elChar.onload = null;
  elChar.onerror = null;

  elChar.onload = function() {
    console.log('[Engine setCharacter] Image loaded successfully:', src);

    console.log('[CHAR FLOW] onload', {
      seq,
      activeSeq: __activeCharSeq,
      src,
      domSrc: elChar.currentSrc || elChar.src,
      hiddenBeforeShow: elChar.classList.contains('hidden'),
      heightBeforeScale: elChar.style.height
    });

    // Проверяем, не устарел ли этот load
    if (seq !== __activeCharSeq) {
      console.warn('[CHAR FLOW] stale onload ignored', {
        seq,
        activeSeq: __activeCharSeq,
        src
      });
      return;
    }


    // Проверяем, не переключилась ли сцена
    if (state.sceneId !== currentSceneId) {
      console.log('[setCharacter] Сцена изменилась с', currentSceneId, 'на', state.sceneId, '- не восстанавливаем индекс');
      if (done) done();
      return;
    }


    // Сначала показываем, чтобы adjustCharacterScale не вышел по hidden
    elChar.classList.remove("hidden");

    // Потом применяем правильный размер
    adjustCharacterScale();

    // И даём браузеру кадр закрепить layout
    requestAnimationFrame(function() {
      adjustCharacterScale();
      if (done) done();
    });
  };

  elChar.onerror = function() {
    var badSrc = normalizeAssetUrl(elChar.currentSrc || elChar.src || normalizedSrc);

    console.log('[Engine setCharacter] Image failed to load:', normalizedSrc);
    console.log('[Engine setCharacter] Full URL:', elChar.src);
    console.log('[Engine setCharacter] Error event:', arguments);

    console.log('[CHAR FLOW] onerror', {
      seq,
      activeSeq: __activeCharSeq,
      src: normalizedSrc,
      domSrc: elChar.currentSrc || elChar.src
    });

    if (badSrc) {
      failedAssets.images[badSrc] = true;
    }

    if (seq !== __activeCharSeq) {
      return;
    }

    elChar.classList.add("hidden");
    elChar.removeAttribute('src');
    elChar.removeAttribute('data-char-id');

    if (done) done();
  };

  if (seq !== __activeCharSeq) {
    console.warn('[CHAR FLOW] stale onload ignored', {
      seq,
      activeSeq: __activeCharSeq,
      src
    });
  }

  console.log('[Engine setCharacter] Setting src:', normalizedSrc);
  elChar.src = normalizedSrc;
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

function showChoices(choices) {
  // choices: [{ text, goto, set:{...}, sfx:"@audio.xxx" }, ...]
  if (!choices || !choices.length) return;

  // Настройка: показывать номера вариантов или нет.
  // Чтобы отключить номера, замените true на false.
  var SHOW_CHOICE_NUMBERS = true;

  // НЕ очищаем диалог полностью, а только текст
  elText.textContent = ""; // Очищаем только текст, имя оставляем

  // Убираем предыдущее сообщение, чтобы не мешало выбору
  // showDialog(null, "");

  // elChoices.innerHTML = "";
  elDialog.classList.add("hiddenByChoices");
  elChoices.classList.remove("hidden");

  var panel = document.createElement("div");
  panel.className = "choicePanel";

  var title = document.createElement("div");
  title.className = "choiceTitle";
  title.textContent = "Выберите действие";
  panel.appendChild(title);

  var list = document.createElement("div");
  list.className = "choiceList";

  for (var i = 0; i < choices.length; i++) {
    (function (choice, index) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choiceBtn";

      if (SHOW_CHOICE_NUMBERS) {
        var num = document.createElement("span");
        num.className = "choiceNum";
        num.textContent = (index + 1) + ".";
        btn.appendChild(num);
      }

      var text = document.createElement("span");
      text.className = "choiceLabel";
      text.textContent = choice.text || ("Выбор " + (index + 1));
      btn.appendChild(text);

      btn.addEventListener("click", function () {
        // звук на кнопку (если задан)
        if (choice.sfx) {
          playSfx(resolveAsset(choice.sfx), 1);
        }

        // применить set
        if (choice.set && typeof choice.set === "object") {
          for (var k in choice.set) {
            if (Object.prototype.hasOwnProperty.call(choice.set, k)) {
              state.vars[k] = choice.set[k];
            }
          }
        }

        hideChoices();

        // переход
        if (choice.goto) {
          gotoScene(choice.goto);
        }

        // продолжить выполнение
        state.waitingNext = false;
        runCurrent();
      });

      list.appendChild(btn);
    })(choices[i], i);
  }

  panel.appendChild(list);
  elChoices.appendChild(panel);
}

function hideChoices() {
  elDialog.classList.remove("hiddenByChoices");
  elChoices.classList.add("hidden");
  elChoices.innerHTML = "";
}

// =========================================================
//                   МИНИ-ИГРЫ
// =========================================================

function openGame(action) {
  if (!action || !action.src) {
    console.warn('[GAME] openGame: missing action.src', action);
    return;
  }

  state.inGame = true;
  state.currentGame = {
    gameId: action.gameId || 'game',
    resultVar: action.resultVar || null,
    params: action.params || {}
  };

  elGameModal.classList.remove("hidden");

  // Загружаем игру в iframe
  elGameFrame.src = action.src;

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
    state.waitingNext = false;
    state.nextLocked = false;

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
  state.nextLocked = true;

  setTimeout(function() {
    state.nextLocked = false;
    runCurrent();
  }, 0);
}

function closeGameFrameVisualOnly() {
  elGameModal.classList.add("hidden");
  elGameFrame.onload = null;
  elGameFrame.src = "about:blank";
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
    btnMute.innerHTML = '<span class="btn-icon"></span>';
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
  audio.bgm.volume = clamp((audio.currentBgmVolume != null ? audio.currentBgmVolume : 0.7) * v, 0, 1);
  audio.sfx.volume = clamp((audio.currentSfxVolume != null ? audio.currentSfxVolume : 1) * v, 0, 1);

  logAudioState('applyAudioSettings');
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

function resolveAsset(ref, charId, emotion) {
  console.log('[Engine resolveAsset] Called with:', { ref, charId, emotion });
  
  // СНАЧАЛА проверяем персонажей, если есть charId и emotion
  if (charId && emotion && STORY.assets && STORY.assets.characters) {
    console.log('[Engine resolveAsset] Looking for character:', charId, 'emotion:', emotion);
    
    const char = STORY.assets.characters[charId];
    console.log('[Engine resolveAsset] Character object:', char);
    
    if (char && char.images) {
      console.log('[Engine resolveAsset] Available emotions:', Object.keys(char.images));
      const imagePath = char.images[emotion];
      console.log('[Engine resolveAsset] Found image path:', imagePath);
      
      if (imagePath) {
        var normalizedImagePath = normalizeAssetUrl(imagePath);
        if (failedAssets.images[normalizedImagePath]) {
          console.log('[Engine resolveAsset] Character image marked as failed:', normalizedImagePath);
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

    if (result) {
      var normalizedBg = normalizeAssetUrl(result);
      if (failedAssets.images[normalizedBg]) {
        console.log('[Engine resolveAsset] Background marked as failed:', normalizedBg);
        return "";
      }
    }
    return result || "";
  }
  
  if (group === "audio") {
    if (!STORY.assets.audio) {
      console.log('[Engine resolveAsset] STORY.assets.audio is missing');
      return "";
    }
    console.log('[Engine resolveAsset] Available audio:', Object.keys(STORY.assets.audio));
    const result = STORY.assets.audio[key];
    console.log('[Engine resolveAsset] Found audio:', result);
    return result || "";
  }
  
  console.log('[Engine resolveAsset] No match found for group:', group);
  return "";
}


// =========================================================
// МАСШТАБ ИНТЕРФЕЙСА
// =========================================================

function applyUiScale() {
  // JS считает только корневой масштаб,
  // а размеры конкретных компонентов берутся из CSS-токенов.
  var autoScale = window.innerHeight / UI_REFERENCE_HEIGHT;
  autoScale = clamp(autoScale, 0.25, 10);

  var finalScale = UI_FONT_SCALE * autoScale;
  finalScale = clamp(finalScale, 0.25, 10);

  document.documentElement.style.setProperty("--uiScale", finalScale);

  // Должно совпадать с --baseFontPx в CSS.
  var baseFontPx = 16;
  var baseFontSize = baseFontPx * finalScale;
  document.documentElement.style.setProperty("--baseFontSize", baseFontSize + 'px');

  console.log('[SCALE DEBUG]', {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    referenceHeight: UI_REFERENCE_HEIGHT,
    autoScale: autoScale,
    uiFontScale: UI_FONT_SCALE,
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
function adjustCharacterScale() {

  console.log('[CHAR SCALE] start', {
    src: elChar ? (elChar.currentSrc || elChar.src) : null,
    hidden: elChar ? elChar.classList.contains('hidden') : null,
    styleHeightBefore: elChar ? elChar.style.height : null,
    naturalWidth: elChar ? elChar.naturalWidth : null,
    naturalHeight: elChar ? elChar.naturalHeight : null,
    windowHeight: window.innerHeight
  });

  var char = document.getElementById('charLayer');
  if (!char) return;
  
  var availableHeight = elNovelWindow ? elNovelWindow.clientHeight : window.innerHeight;

  // Максимальная высота персонажа внутри окна новеллы
  var targetCharHeight = Math.max(0, availableHeight * 0.85);
  
  // Применяем к персонажу
  char.style.height = targetCharHeight + 'px';

  console.log('[CHAR SCALE] applied', {
    src: char.currentSrc || char.src,
    targetCharHeight,
    styleHeightAfter: char.style.height,
    offsetHeight: char.offsetHeight
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

function showStatsPanel() {
  setStatsView("text");

  // Принудительно сбрасываем panzoom состояние
  resetPanzoom();

  renderStats();
  elStatsPanel.classList.remove("hidden");
}

function hideStatsPanel() {
  elStatsPanel.classList.add("hidden");
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
      img.src = item.cover;
      img.alt = item.title;
      img.loading = "lazy";
      img.onerror = function() {
        coverWrap.innerHTML = "";
        var noCover = document.createElement("div");
        noCover.className = "gameCatalogNoCover";
        noCover.textContent = t("gamesNoCover");
        coverWrap.appendChild(noCover);
      };
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

      // Получаем ошибки парсинга
      var parseErrors = window.PARSE_ERRORS || [];

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






      text += `Software version: ${window.APP_VERSION}\n\n`; // Важно использовать кавычки `` чтобы применялись вставки ${}. В "" не применяются вставки

      text += "=== SCRIPT STATISTICS ===\n\n";
      text += "Title: " + (STORY.meta && STORY.meta.title ? STORY.meta.title : "(без названия)") + "\n";
      text += "Scenes: " + stats.sceneCount + "\n";
      text += "Choice menu: " + stats.choiceCount + "\n";
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
      
      text += "Images: " + imageCount + "\n";
      text += "Audio: " + audioCount + "\n";
      text += "Games: " + gameCount + "\n\n";
      


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

      if (profiler.marks['First screen ready'] !== undefined) {
        text += "  To first screen: " +
          profiler.marks['First Screen Ready'] + "ms (" +
          (profiler.marks['First Screen Ready'] / 1000).toFixed(2) + "с)\n";
      } else {
        text += "  To first screen: not yet measured\n";
      }

      if (window.LOADER_STATS && window.LOADER_STATS.startTime && profiler.marks['First screen ready'] !== undefined) {
        var firstScreenFromLoaderStart =
          (profiler.startTime - window.LOADER_STATS.startTime) + profiler.marks['First screen ready'];

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

      text += "\n\n=== MERMAID GRAPH ===\n\n";
      text += buildMermaidGraph(STORY, reach.unreachable);

      elStatsBody.value = text;
      elStatsBody.scrollTop = 0;


      if (showingGraph && window.STORY) {
        setTimeout(function() {
          try {
            renderMermaidGraph();
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
          var bbox = svg.getBBox();
          svg.setAttribute('width', bbox.width + 50);
          svg.setAttribute('height', bbox.height + 50);
          svg.setAttribute('viewBox', `0 0 ${bbox.width + 50} ${bbox.height + 50}`);
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
  var baseFontPx = rootStyle.getPropertyValue('--baseFontPx').trim();
  var baseFontSize = rootStyle.getPropertyValue('--baseFontSize').trim();
  var uiBottomOffset = rootStyle.getPropertyValue('--uiBottomOffset').trim();
  var topSpacing = rootStyle.getPropertyValue('--topSpacing').trim();
  var bottomSpacing = rootStyle.getPropertyValue('--bottomSpacing').trim();
  
  info += "CSS variables:\n";
  info += "  --uiScale: " + uiScale + "\n";
  info += "  --baseFontPx: " + baseFontPx + "\n";
  info += "  --baseFontSize: " + baseFontSize + "\n";
  info += "  --uiBottomOffset: " + uiBottomOffset + "\n";
  info += "  --topSpacing: " + topSpacing + "px\n";
  info += "  --bottomSpacing: " + bottomSpacing + "px\n\n";
  
  // JS переменные масштабирования
  info += "JS scaling settings:\n";
  info += "  UI_FONT_SCALE: " + UI_FONT_SCALE + "\n";
  info += "  UI_REFERENCE_HEIGHT: " + UI_REFERENCE_HEIGHT + "\n\n";
  
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


// Проверка файлов через fetch с HEAD запросом (работает в file:// ограниченно)
// Проверка файлов на соответствие требованиям
function checkAssetsFiles() {
  return new Promise((resolve) => {
    const result = {
      missing: [],
      sizeErrors: [], // файлы с неправильными размерами
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
        allFiles.push({ id, path, type: 'bg', category: 'background', ref: id });
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
      Object.entries(STORY.assets.audio).forEach(([id, path]) => {
        if (typeof path !== "string" || path.trim() === "") {
          result.missing.push({
            path: `[invalid path: ${String(path)}]`,
            refs: [`audio: ${id}`]
          });
          return;
        }

        allFiles.push({
          id: id,
          path: path.trim(),
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

        // Новый формат: объект { file, title, description, cover }
        if (game && typeof game === "object") {
          gamePath = typeof game.file === "string" ? game.file.trim() : "";
        }
        // На всякий случай поддержка старого формата, если где-то остался
        else if (typeof game === "string") {
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
            files: result.files.length
          });
          resolve(result);
        }
      }
      
      // Проверяем каждый уникальный файл через Image объект
      uniquePaths.forEach(path => {
        if (path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          // Проверка изображения
          const img = new Image();
          let isResolved = false;
          
          const timeout = setTimeout(() => {
              if (!isResolved) {
                  isResolved = true;
                  errorCount++;
                  checkComplete();
              }
          }, 5000);
          
          img.onload = function() {
              if (isResolved) return;
              isResolved = true;
              clearTimeout(timeout);
              
              // Определяем категорию по первому файлу в группе
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
          };
          
          img.onerror = function() {
              if (isResolved) return;
              isResolved = true;
              clearTimeout(timeout);
              
              errorCount++;
              checkComplete();
          };
          
          img.src = path + '?' + Date.now(); // добавляем timestamp чтобы избежать кэша
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
          // Проверка HTML-файла игры
          const firstFile = pathGroups[path][0];
          const isFileProtocol = window.location.protocol === 'file:';

          if (isFileProtocol) {
            console.warn("[ASSET CHECK][GAME] skip verification on file://", path);

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
            const requestUrl = path + '?' + Date.now();

            fetch(requestUrl, { method: 'GET' })
              .then(function(response) {
                if (!response.ok) {
                  throw new Error('HTTP ' + response.status);
                }

                fileResults[path] = {
                  success: true,
                  data: {
                    path: path,
                    category: firstFile.category,
                    refs: pathGroups[path].map(f => `${f.category}: ${f.ref}`)
                  }
                };

                loadedCount++;
                checkComplete();
              })
              .catch(function() {
                errorCount++;
                checkComplete();
              });
          }
        } else {
          console.warn("[ASSET CHECK] unsupported file type:", path);
          errorCount++;
          checkComplete();
        }
      });
  });
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

    var actions = sc.actions || [];
    for (var a = 0; a < actions.length; a++) {
      var act = actions[a];
      if (!act || !act.type) continue;

      if (act.type === "goto" && act.target) {
        adj[sc.id].push({ to: act.target, label: "" });
      }

      if (act.type === "if_expr" && act.target) {
        adj[sc.id].push({ to: act.target, label: String(act.condition || "") });
      }

      if (act.type === "choice" && act.choices && act.choices.length) {
        for (var c = 0; c < act.choices.length; c++) {
          var ch = act.choices[c];
          if (ch && ch.goto) {
            adj[sc.id].push({ to: ch.goto, label: String(ch.text || "") });
          }
        }
      }
    }
  }

  return { sceneMap: sceneMap, adj: adj };
}

function findUnreachableScenes(story) {
  var startId = (story.meta && story.meta.start) ? story.meta.start : null;
  var built = buildAdjacency(story);
  var sceneMap = built.sceneMap;
  var adj = built.adj;

  if (!startId || !sceneMap[startId]) {
    // Если стартовая сцена не задана/не найдена — считаем всё “сомнительным”
    return { unreachable: Object.keys(sceneMap).sort(), reachable: [] };
  }

  var visited = {};
  var stack = [startId];
  visited[startId] = true;

  while (stack.length) {
    var v = stack.pop();
    var edges = adj[v] || [];
    for (var i = 0; i < edges.length; i++) {
      var to = edges[i].to;
      if (!visited[to] && sceneMap[to]) {
        visited[to] = true;
        stack.push(to);
      }
    }
  }

  var reachable = [];
  var unreachable = [];

  for (var id in sceneMap) {
    if (!Object.prototype.hasOwnProperty.call(sceneMap, id)) continue;
    if (visited[id]) reachable.push(id);
    else unreachable.push(id);
  }

  reachable.sort();
  unreachable.sort();

  return { unreachable: unreachable, reachable: reachable };
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


// engine.js - обновленная функция buildMermaidGraph

function buildMermaidGraph(story, unreachableList) {
  var scenes = story.scenes || [];
  var startId = (story.meta && story.meta.start) ? story.meta.start : (scenes[0] ? scenes[0].id : "START");
  
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
    var uniqueBgs = {};     // Для подсчета уникальных фонов
    var firstBgSrc = null;  // Для первого фона
    var firstBgId = null;   // ID первого фона
    
    // массив для хранения ВСЕХ фонов в сцене (в порядке появления)
    var allBgImages = [];   // Массив объектов {src, id, order}

     // игры, использованные в сцене
    var gameSet = {};

    // Инициализируем счетчики связей
    if (!incomingEdges[scene.id]) incomingEdges[scene.id] = 0;
    if (!outgoingEdges[scene.id]) outgoingEdges[scene.id] = 0;
    
    for (var a = 0; a < actions.length; a++) {
      var act = actions[a];
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
      
      
      // ПОДСЧЕТ ФОНОВ И СОХРАНЕНИЕ ВСЕХ ИЗОБРАЖЕНИЙ
      if (act.type === "bg" && act.src) {
        bgCount++;
        var bgId = extractAliasId(act.src, "bg");
        if (bgId) {
          uniqueBgs[bgId] = true;
          
          // Получаем реальный путь к изображению
          var bgSrc = null;
          if (story.assets && story.assets.backgrounds) {
            bgSrc = story.assets.backgrounds[bgId];
          }
          
          // ИСПРАВЛЕНО: проверяем, есть ли уже такой фон в массиве
          if (bgSrc) {
            // Проверяем, не добавлен ли уже такой же фон
            var isDuplicate = false;
            for (var i = 0; i < allBgImages.length; i++) {
              if (allBgImages[i].id === bgId) {
                isDuplicate = true;
                break;
              }
            }
                    
            // Если не дубликат, добавляем
            if (!isDuplicate) {
              allBgImages.push({
                src: bgSrc,
                id: bgId,
                order: a  // сохраняем порядковый номер для сортировки
              });
            }
          }
                
          // Сохраняем первый фон (для обратной совместимости)
          if (firstBgId === null) {
            firstBgId = bgId;
            firstBgSrc = bgSrc;
          }
        }
      }

      // goto -> ребро
      if (act.type === "goto" && act.target) {
        edges.push({ from: scene.id, to: act.target, label: "" });
        outgoingEdges[scene.id]++;
        
        if (!incomingEdges[act.target]) incomingEdges[act.target] = 0;
        incomingEdges[act.target]++;
      }
      
      if (act.type === "if_expr" && act.target) {
        edges.push({
          from: scene.id,
          to: act.target,
          label: String(act.condition || "")
        });

        outgoingEdges[scene.id] = (outgoingEdges[scene.id] || 0) + 1;

        if (!incomingEdges[act.target]) incomingEdges[act.target] = 0;
        incomingEdges[act.target]++;
      }

      // choice -> ребро с текстом пункта меню
      if (act.type === "choice" && act.choices && act.choices.length) {
        for (var c = 0; c < act.choices.length; c++) {
          var ch = act.choices[c];
          if (ch && ch.goto) {
            edges.push({ 
              from: scene.id, 
              to: ch.goto, 
              label: String(ch.text || "").substring(0, 40) + (ch.text.length > 40 ? "..." : "")
            });
            outgoingEdges[scene.id]++;
            
            if (!incomingEdges[ch.goto]) incomingEdges[ch.goto] = 0;
            incomingEdges[ch.goto]++;
          }
        }
      }
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
      firstBgSrc: firstBgSrc,  // Путь к первому фону
      firstBgId: firstBgId,    // ID первого фона
      allBgImages: allBgImages // добавляем массив всех фонов
    });
    
  } // for











  // Формируем Mermaid граф
  var mermaid = "graph LR;\n";  // LR = Left to Right (как в DOT)

  // Добавляем заголовок
  mermaid += "%% " + ((story.meta && story.meta.title) ? story.meta.title : "Visual Novel") + "\n";

  // Стили для узлов. Основные настройки производятся в CSS
  mermaid += "%% Defining styles for scenes\n";
  mermaid += "classDef scene fill:#fff3e0,stroke:#e6d6bc,color:#000,stroke-width:1px,r:12px;\n";
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

  // СОЗДАЕМ УЗЛЫ ПЕРСОНАЖЕЙ
  var charGraphData = buildCharactersGraph(story);
  mermaid += charGraphData.mermaid;
  mermaid += "\n";

  // ДОБАВЛЯЕМ УЗЕЛ "ФОНЫ"
  mermaid += buildBackgroundsGraph(story);
  mermaid += "\n";

  // ДОБАВЛЯЕМ УЗЕЛ "ИГРЫ"
  mermaid += buildGamesGraph(story);
  mermaid += "\n";

  // Создаем узлы с многострочными метками
  for (var n = 0; n < nodes.length; n++) {
    var node = nodes[n];
    var chars = node.characters.length ? node.characters.join(", ") : "(none)";
    var games = (node.games && node.games.length) ? node.games : [];

    // Формируем многострочную метку - ВАЖНО: порядок элементов
    var label = node.id + "<br/>";

    // Параметры настройки
    var imageSize = 80;           // Размер миниатюр
    var imageGap = 2;             // Расстояние между миниатюрами
    var containerPadding = 8;     // Внутренние отступы контейнера

    if (node.allBgImages && node.allBgImages.length > 0) {
      var sceneBgCountClass = getImgCountClass(node.allBgImages.length);

      label += '<div class="bg-images-container ' + sceneBgCountClass + '" style="padding: 4px;">';
      
      for (var b = 0; b < node.allBgImages.length; b++) {
        var bg = node.allBgImages[b];
        var imgSrc = bg.src.replace(/"/g, '&quot;');
        
        label += '<img src="' + imgSrc + '" ' +
                'class="bg-thumbnail ' + sceneBgCountClass + '" ' +
                'data-id="' + bg.id + '" ' +
                'data-index="' + b + '" ' +
                'title="' + bg.id + '" ' +
                'alt="" /> ';
      }
      
      label += '</div>';
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
    if (node.bgCount != 0) {
      counters.push("🖼️" + node.uniqueBgCount + (node.bgCount > node.uniqueBgCount ? "(" + node.bgCount + ")" : ""));
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
      label += "<div style='line-height: 1.4; margin-top: 2px;'>" + allStats + "</div>";
    }
    
    mermaid += '    ' + node.id + '["' + label + '"]\n';
    mermaid += '    class ' + node.id + ' scene;\n';  // Добавляем класс scene
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
    
    // Проверяем, является ли сцена финальной (есть входящие, нет исходящих)
    // И при этом не стартовая и не недостижимая
    if (!unreachableSet[node.id] && 
      node.id !== startId && 
      incomingEdges[node.id] > 0 && 
      (!outgoingEdges[node.id] || outgoingEdges[node.id] === 0)) {
      classes.push("final");
    }
    
    if (classes.length > 0) {
      mermaid += '    class ' + node.id + ' ' + classes.join(',') + ';\n';
    }
  }
  
  mermaid += "\n%% Edges\n";
    
  // Создаем связи с подписями (только реальные связи из сценария)
  for (var e = 0; e < edges.length; e++) {
    var ed = edges[e];
    if (ed.label && ed.label.trim() !== "") {
      // Экранируем кавычки и спецсимволы в метках
      var label = ed.label.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      mermaid += '    ' + ed.from + ' -->|"' + label + '"| ' + ed.to + ';\n';
    } else {
      mermaid += '    ' + ed.from + ' --> ' + ed.to + ';\n';
    }
  }
    
  console.log('[DEBUG] Mermaid graph generated for nodes:');
  nodes.forEach(function(node) {
    if (node.allBgImages && node.allBgImages.length > 0) {
      console.log('  Node', node.id, 'images:', node.allBgImages.map(function(bg) { return bg.id; }).join(', '));
    }
  });

  // ВАЖНО: Добавляем пунктирную связь от узла "Персонажи" к первой сцене
  var startId = (story.meta && story.meta.start) ? story.meta.start : (scenes[0] ? scenes[0].id : "START");
  mermaid += '\n    %% Character connections to the first chapter\n';
  mermaid += '    characters -.-> ' + startId + ';\n';

  return mermaid;
}
      

function getImgCountClass(count) {
  if (count <= 1) return 'imgcount1';
  if (count <= 4) return 'imgcount2';
  if (count <= 9) return 'imgcount3';
  return 'imgcount4';
}

// Добавьте после функции buildMermaidGraph или в любое место перед ее вызовом

function buildCharactersGraph(story) {
  var mermaid = "";
  var characters = story.assets.characters || {};
  var startId = (story.meta && story.meta.start) ? story.meta.start : (story.scenes[0] ? story.scenes[0].id : "START");
  
  // Создаем узел "Персонажи"
  mermaid += '    characters["<b>👥 Characters</b>"]\n';
  mermaid += '    characters:::characters-group\n';  // Применяем CSS-класс
  
  // Создаем узлы для каждого персонажа
  var charNodes = [];
  var charIds = Object.keys(characters).sort();
  
  for (var i = 0; i < charIds.length; i++) {
    var charId = charIds[i];
    var char = characters[charId];
    var displayName = char.name || charId;
    
    // Формируем HTML для изображений эмоций
    var emotionsHtml = '';
    if (char.images) {
      var emotionIds = Object.keys(char.images).sort();
      var emotionCountClass = getImgCountClass(emotionIds.length);

      emotionsHtml = '<div class="char-emotions-container ' + emotionCountClass + '" style="display:flex; flex-wrap:wrap; gap:4px; justify-content:center; margin-top:4px;">';

      for (var e = 0; e < emotionIds.length; e++) {
        var emotion = emotionIds[e];
        var imgSrc = char.images[emotion].replace(/"/g, '&quot;');

        emotionsHtml += '<img src="' + imgSrc + '" ' +
                        'class="char-emotion-thumbnail ' + emotionCountClass + '" ' +
                        'style="object-fit: contain; background-color: #f0f0f0; border-radius: 8px; border: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.2s ease; cursor: zoom-in;" ' +
                        'onmouseover="this.style.transform=&apos;scale(3.5)&apos;; this.style.zIndex=&apos;9999&apos;; this.style.boxShadow=&apos;0 8px 24px rgba(0,0,0,0.3)&apos;;" ' +
                        'onmouseout="this.style.transform=&apos;scale(1)&apos;; this.style.zIndex=&apos;1&apos;; this.style.boxShadow=&apos;0 2px 4px rgba(0,0,0,0.1)&apos;;" ' +
                        'title="' + emotion + '" alt="" /> ';
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

// Функция для создания элемента "Фоны" со всеми уникальными фонами
function buildBackgroundsGraph(story) {
  var mermaid = "";
  var backgrounds = story.assets.backgrounds || {};
  var startId = (story.meta && story.meta.start) ? story.meta.start : (story.scenes[0] ? story.scenes[0].id : "START");
  
  // Собираем все уникальные фоны из всех сцен
  var allUniqueBgs = {};
  var scenes = story.scenes || [];
  
  for (var s = 0; s < scenes.length; s++) {
    var scene = scenes[s];
    if (!scene || !scene.actions) continue;
    
    var actions = scene.actions;
    for (var a = 0; a < actions.length; a++) {
      var act = actions[a];
      if (act.type === "bg" && act.src) {
        var bgId = extractAliasId(act.src, "bg");
        if (bgId && backgrounds[bgId]) {
          allUniqueBgs[bgId] = backgrounds[bgId];
        }
      }
    }
  }
    
  // Формируем HTML для изображений фонов
  var bgIds = Object.keys(allUniqueBgs).sort();

  var bgCountClass = getImgCountClass(bgIds.length);

  var bgImagesHtml = '<div class="bg-images-container ' + bgCountClass + '" style="display:flex; flex-wrap:wrap; gap:4px; justify-content:center; align-items:flex-start; padding:4px;">';
  
  for (var i = 0; i < bgIds.length; i++) {
    var bgId = bgIds[i];
    var imgSrc = allUniqueBgs[bgId].replace(/"/g, '&quot;');
    
    bgImagesHtml += '<img src="' + imgSrc + '" ' +
                'class="bg-thumbnail ' + bgCountClass + '" ' +
                'title="' + bgId + '" alt="" /> ';
  }
    
  bgImagesHtml += '</div>';
  
  // Подсчитываем количество фонов
  var bgCount = bgIds.length;
  
  // Формируем метку элемента
  var label = '<b>🖼️ Backgrounds (' + bgCount + ')</b><br/>' + bgImagesHtml;
  
  // Добавляем узел "Фоны" с серым фоном
  mermaid += '    backgrounds["' + label + '"]\n';
  mermaid += '    backgrounds:::backgrounds-group\n';  // Исправлено: используем :::

  // Добавляем пунктирную связь с первой главой
  mermaid += '\n    %% Connection between backgrounds and the first chapter\n';
  mermaid += '    backgrounds -.-> ' + startId + ';\n';
  
  return mermaid;
}

function buildGamesGraph(story) {
  var mermaid = "";
  var games = (story.assets && story.assets.games) ? story.assets.games : {};
  var startId = (story.meta && story.meta.start) ? story.meta.start : (story.scenes[0] ? story.scenes[0].id : "START");
  var scenes = story.scenes || [];
  var usedGames = {};

  for (var s = 0; s < scenes.length; s++) {
    var scene = scenes[s];
    if (!scene || !scene.actions) continue;

    var actions = scene.actions;
    for (var a = 0; a < actions.length; a++) {
      var act = actions[a];
      if (act && act.type === "game" && act.gameId && games[act.gameId]) {
        usedGames[act.gameId] = true;
      }
    }
  }

  var gameIds = Object.keys(usedGames).sort();
  var gamesCount = gameIds.length;
  var gameCountClass = getImgCountClass(gamesCount);
  var gamesListHtml = '<div class="games-list-container ' + gameCountClass + '">';

  if (gamesCount > 0) {
    for (var i = 0; i < gameIds.length; i++) {
      var gameId = gameIds[i];
      var safeGameId = gameId
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

      gamesListHtml += '<div class="game-list-item">' + safeGameId + '</div>';
    }
  } else {
    gamesListHtml += '<div class="game-list-empty">(none)</div>';
  }

  gamesListHtml += '</div>';

  var label = '<b>🎮 Games (' + gamesCount + ')</b><br/>' + gamesListHtml;

  mermaid += '    games["' + label + '"]\n';
  mermaid += '    games:::games-group\n';

  for (var i = 0; i < gameIds.length; i++) {
    var gameId = gameIds[i];
    var game = games[gameId] || {};
    console.log('[GRAPH GAME]', gameId, game);

    var safeGameId = escapeHtml(gameId);
    var safeTitle = escapeHtml(game.title || gameId);
    var safeDescription = escapeHtml(game.description || "");
    var safeCover = escapeHtml(game.cover || "");
    var tooltip = escapeHtml(game.description || game.title || gameId);

    var gameNodeId = 'game_' + gameId.replace(/[^a-zA-Z0-9_]/g, '_');

    var label = '<div class="game-card" title="' + tooltip + '">' +
      '<div class="game-card-var">' + safeGameId + '</div>' +
      '<div class="game-card-title">' + safeTitle + '</div>' +
      (safeCover
        ? '<div class="game-card-image-wrap">' +
            '<img src="' + safeCover + '" ' +
            'class="game-thumbnail ' + gameCountClass + '" ' +
            'alt="" ' +
            'loading="eager" />' +
          '</div>'
        : '') +
      '</div>';

    mermaid += '    ' + gameNodeId + '["' + label + '"]\n';
    mermaid += '    ' + gameNodeId + ':::game-node\n';
    mermaid += '    games -.-> ' + gameNodeId + '\n';
  }

  mermaid += '\n    %% Connection between games and the first chapter\n';
  mermaid += '    games -.-> ' + startId + ';\n';

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

  return errors;
}

// Подсчёт статистики.
function computeStoryStats(story) {
  var scenes = story.scenes || [];

  var usedBg = {};                 // bgId -> true
  var usedCh = {};                 // charId -> true
  var usedCharacterEmotions = {};  // charId -> { emotion: true }

  var sayCount = 0;
  var textCount = 0;
  var choiceCount = 0;
  var bgmActions = 0;
  var sfxActions = 0;

  for (var s = 0; s < scenes.length; s++) {
    var actions = scenes[s].actions || [];

    for (var a = 0; a < actions.length; a++) {
      var act = actions[a];
      if (!act || !act.type) continue;

      if (act.type === "bg") {
        var bgId = extractAliasId(act.src, "bg");
        if (bgId) usedBg[bgId] = true;
      }

      if (act.type === "char") {
        if (act.charId) {
          usedCh[act.charId] = true;

          if (!usedCharacterEmotions[act.charId]) {
            usedCharacterEmotions[act.charId] = {};
          }

          if (act.emotion) {
            usedCharacterEmotions[act.charId][act.emotion] = true;
          }
        }
      }

      if (act.type === "say") sayCount++;
      if (act.type === "text") textCount++;
      if (act.type === "choice") choiceCount++;
      if (act.type === "bgm") bgmActions++;
      if (act.type === "sfx") sfxActions++;
    }
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
    backgroundsDetailed: backgroundsDetailed,
    usedCharacterIds: usedCharacterIds,
    unusedCharacterIds: unusedCharacterIds,
    usedCharactersDetailed: usedCharactersDetailed,
    sayCount: sayCount,
    textCount: textCount,
    choiceCount: choiceCount,
    bgmActions: bgmActions,
    sfxActions: sfxActions
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
function applyUIStyleVariables(meta) {
  var root = document.documentElement;

  Object.keys(UI_STYLE_CONFIG).forEach(function(metaKey) {
    var config = UI_STYLE_CONFIG[metaKey];
    var value = config.default;

    if (meta && meta[metaKey] !== undefined && meta[metaKey] !== null) {
      if (isValidUIConfigValue(meta[metaKey], config)) {
        value = meta[metaKey];
      }
    }

    root.style.setProperty(
      config.cssVar,
      String(value) + (config.unit || '')
    );
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

  var effectiveTop = 0;
  var effectiveRight = 0;
  var effectiveBottom = 0;
  var effectiveLeft = 0;

  if (manualMode) {
    effectiveTop = num(finalMeta.topSpacing, 0);
    effectiveRight = num(finalMeta.rightSpacing, 0);
    effectiveBottom = num(finalMeta.bottomSpacing, 0);
    effectiveLeft = num(finalMeta.leftSpacing, 0);
  } else {
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

  applyUIStyleVariables(finalMeta);

  document.documentElement.style.setProperty('--topSpacing', effectiveTop + 'px');
  document.documentElement.style.setProperty('--rightSpacing', effectiveRight + 'px');
  document.documentElement.style.setProperty('--bottomSpacing', effectiveBottom + 'px');
  document.documentElement.style.setProperty('--leftSpacing', effectiveLeft + 'px');

  if (elNovelWindow) {
    elNovelWindow.style.left = effectiveLeft + 'px';
    elNovelWindow.style.top = effectiveTop + 'px';
    elNovelWindow.style.width = novelWidth + 'px';
    elNovelWindow.style.height = novelHeight + 'px';
  }

  var blurBackground = (typeof finalMeta.blurBackground === 'boolean')
    ? finalMeta.blurBackground
    : true;

  if (elBlurBgLayer) {
    elBlurBgLayer.style.display = blurBackground ? 'block' : 'none';
  }

  console.log('[Engine] novel window applied:', {
    manualMode: manualMode,
    effectiveTop: effectiveTop,
    effectiveRight: effectiveRight,
    effectiveBottom: effectiveBottom,
    effectiveLeft: effectiveLeft,
    novelWidth: novelWidth,
    novelHeight: novelHeight
  });

  adjustCharacterScale();
}

// Управление размытым фоном
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
    return;
  }
  
  if (src && src !== "") {
    console.log('[Engine] Устанавливаем размытый фон:', src);
    elBlurBgImage.src = src;
    elBlurBgLayer.classList.remove("hidden");
    
    // Принудительно применяем стили
    elBlurBgImage.style.objectFit = 'cover';
    elBlurBgImage.style.width = '100%';
    elBlurBgImage.style.height = '100%';
  } else {
    console.log('[Engine] src пустой, скрываем размытый фон');
    elBlurBgLayer.classList.add("hidden");
  }
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
  minScale: 0.1,      // Минимальный масштаб до 10%
  maxScale: 500,       // Максимальный масштаб до 50000% (500x)
  translateX: 0,
  translateY: 0,
  isPanning: false,
  panMode: 'none',     // 'none', 'left', 'middle'
  startX: 0,
  startY: 0,
  startTranslateX: 0,
  startTranslateY: 0
};

// Переменные для обработчиков событий
var panzoomHandlers = {};

// Функция обновления трансформации
function updatePanzoomTransform() {
  if (!panzoomContent) return;
  
  var transform = `translate(${panzoomState.translateX}px, ${panzoomState.translateY}px) scale(${panzoomState.scale})`;
  panzoomContent.style.transform = transform;
  
  // Обновляем отображение масштаба
  if (zoomLevelSpan) {
    zoomLevelSpan.textContent = Math.round(panzoomState.scale * 100) + '%';
  }
}

// Функция сброса panzoom
function resetPanzoom() {
  panzoomState.scale = 1;
  panzoomState.translateX = 0;
  panzoomState.translateY = 0;
  panzoomState.isPanning = false;
  panzoomState.panMode = 'none';
  
  // Принудительно применяем трансформацию
  if (panzoomContent) {
    panzoomContent.style.transform = 'translate(0px, 0px) scale(1)';
  }
  
  // Обновляем отображение масштаба
  if (zoomLevelSpan) {
    zoomLevelSpan.textContent = '100%';
  }
  
  console.log('[Panzoom] Сброшен до 100%'); // для отладки
}

// Функция зумирования
function zoom(delta, mouseX, mouseY) {
  var oldScale = panzoomState.scale;
  var newScale = panzoomState.scale * (1 + delta * 0.1);
  newScale = Math.max(panzoomState.minScale, Math.min(panzoomState.maxScale, newScale));
  
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

function initPanzoom() {
  if (!panzoomWrapper || !panzoomContent) return;

  var container = document.getElementById("graphContainer");
  var activePointerId = null;

  // Для тача/пера отключаем нативный pan браузера
  panzoomWrapper.style.touchAction = 'none';

  panzoomWrapper.addEventListener('pointerdown', function(e) {
    if (!e.isPrimary) return;

    // Разрешаем мышь: левая (0) и средняя (1)
    // touch/pen тоже разрешаем
    var isMouse = e.pointerType === 'mouse';
    if (isMouse && e.button !== 0 && e.button !== 1) return;

    e.preventDefault();

    activePointerId = e.pointerId;
    panzoomState.isPanning = true;
    panzoomState.panMode = isMouse ? (e.button === 1 ? 'middle' : 'left') : 'touch';
    panzoomState.startX = e.clientX;
    panzoomState.startY = e.clientY;
    panzoomState.startTranslateX = panzoomState.translateX;
    panzoomState.startTranslateY = panzoomState.translateY;

    if (panzoomWrapper.setPointerCapture) {
      panzoomWrapper.setPointerCapture(e.pointerId);
    }

    container.classList.add('panning');
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
    if (!panzoomState.isPanning) return;
    if (e.pointerId !== activePointerId) return;

    e.preventDefault();

    var dx = e.clientX - panzoomState.startX;
    var dy = e.clientY - panzoomState.startY;

    panzoomState.translateX = panzoomState.startTranslateX + dx;
    panzoomState.translateY = panzoomState.startTranslateY + dy;

    updatePanzoomTransform();
  });

  function stopPan(e) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;

    panzoomState.isPanning = false;
    panzoomState.panMode = 'none';
    activePointerId = null;
    container.classList.remove('panning');
  }

  panzoomWrapper.addEventListener('pointerup', stopPan);
  panzoomWrapper.addEventListener('pointercancel', stopPan);




  // ОСТАВИТЬ ваш существующий wheel-обработчик
  panzoomWrapper.addEventListener('wheel', function(e) {
    e.preventDefault();

    var delta = e.deltaY > 0 ? -1 : 1;
    var oldScale = panzoomState.scale;
    var newScale = panzoomState.scale * (delta > 0 ? 1.2 : 0.83);
    newScale = Math.max(panzoomState.minScale, Math.min(panzoomState.maxScale, newScale));

    if (newScale === oldScale) return;

    var rect = panzoomWrapper.getBoundingClientRect();
    var mouseXRatio = (e.clientX - rect.left - panzoomState.translateX) / oldScale;
    var mouseYRatio = (e.clientY - rect.top - panzoomState.translateY) / oldScale;

    panzoomState.translateX = e.clientX - rect.left - mouseXRatio * newScale;
    panzoomState.translateY = e.clientY - rect.top - mouseYRatio * newScale;
    panzoomState.scale = newScale;

    updatePanzoomTransform();
  }, { passive: false });

  // ОСТАВИТЬ существующие click на кнопках
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', function() {
      var oldScale = panzoomState.scale;
      var newScale = Math.min(panzoomState.maxScale, oldScale * 1.3);
      if (newScale === oldScale) return;

      var rect = panzoomWrapper.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      var centerY = rect.top + rect.height / 2;

      var mouseXRatio = (centerX - rect.left - panzoomState.translateX) / oldScale;
      var mouseYRatio = (centerY - rect.top - panzoomState.translateY) / oldScale;

      panzoomState.translateX = centerX - rect.left - mouseXRatio * newScale;
      panzoomState.translateY = centerY - rect.top - mouseYRatio * newScale;
      panzoomState.scale = newScale;

      updatePanzoomTransform();
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', function() {
      var oldScale = panzoomState.scale;
      var newScale = Math.max(panzoomState.minScale, oldScale / 1.3);
      if (newScale === oldScale) return;

      var rect = panzoomWrapper.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      var centerY = rect.top + rect.height / 2;

      var mouseXRatio = (centerX - rect.left - panzoomState.translateX) / oldScale;
      var mouseYRatio = (centerY - rect.top - panzoomState.translateY) / oldScale;

      panzoomState.translateX = centerX - rect.left - mouseXRatio * newScale;
      panzoomState.translateY = centerY - rect.top - mouseYRatio * newScale;
      panzoomState.scale = newScale;

      updatePanzoomTransform();
    });
  }

  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', function() {
      resetPanzoom();
    });
  }

  resetPanzoom();
}

// Модифицируйте функцию renderMermaidGraph для сброса масштаба при новой загрузке

function renderMermaidGraph() {
  if (!window.STORY) return;
  
  // Получаем данные о недостижимых сценах
  var reach = findUnreachableScenes(window.STORY);
  
  // Генерируем код Mermaid
  currentMermaidCode = buildMermaidGraph(window.STORY, reach.unreachable);
  console.log('[IMGCOUNT PRE-RENDER SNIPPETS]', {
    chars: currentMermaidCode.match(/char-emotions-container[^>]*imgcount[1-4][\s\S]{0,300}/g),
    bgs: currentMermaidCode.match(/bg-images-container[^>]*imgcount[1-4][\s\S]{0,300}/g),
    games: currentMermaidCode.match(/game-thumbnail[^>]*imgcount[1-4][\s\S]{0,200}/g)
  });
  
  // Вставляем код в контейнер
  if (mermaidGraph) {
    // ПОЛНАЯ ОЧИСТКА: удаляем все дочерние элементы
    while (mermaidGraph.firstChild) {
      mermaidGraph.removeChild(mermaidGraph.firstChild);
    }
    
    // Удаляем все возможные атрибуты Mermaid
    mermaidGraph.removeAttribute('data-processed');
    mermaidGraph.removeAttribute('data-mermaid-svg');
    mermaidGraph.removeAttribute('data-mermaid-type');
    
    // Вставляем новый код как текст (не как HTML)
    mermaidGraph.textContent = currentMermaidCode;
      
    // Принудительно запускаем Mermaid с задержкой для полной очистки
    setTimeout(function() {
      if (window.mermaid) {
        try {
          // Явно указываем контейнер для инициализации
          window.mermaid.init({
            theme: 'default',
            flowchart: {
              useMaxWidth: true,
              htmlLabels: true,
              curve: 'basis',
              padding: 4,
              nodeSpacing: 60,
              rankSpacing: 100,
              borderRadius: 10
            },
            securityLevel: 'loose',
            startOnLoad: false
          }, mermaidGraph);
          
          // Принудительно перерисовываем после загрузки шрифтов
          setTimeout(function() {
            // Получаем SVG элемент
            var svg = mermaidGraph.querySelector('svg');
            if (svg) {
                // Принудительно обновляем размеры
                var bbox = svg.getBBox();
                svg.setAttribute('width', bbox.width + 50);
                svg.setAttribute('height', bbox.height + 50);
                svg.setAttribute('viewBox', `0 0 ${bbox.width + 50} ${bbox.height + 50}`);
            }
            
            debugCharacterGraphLayout();

            // Сбрасываем масштаб
            resetPanzoom();
          }, 100);
            
        } catch (e) {
          console.error("Ошибка инициализации Mermaid:", e);
          mermaidGraph.innerHTML = '<div style="color: red; padding: 1rem;">Error rendering the graph. Check the console.</div>';
        }
      } else {
          mermaidGraph.innerHTML = '<div style="color: orange; padding: 1rem;">The Mermaid library has not been loaded</div>';
      }
    }, 50);
  }
} // function



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
    var bbox = svg.getBBox();
    svg.setAttribute('width', bbox.width + 50);
    svg.setAttribute('height', bbox.height + 50);
    svg.setAttribute('viewBox', `0 0 ${bbox.width + 50} ${bbox.height + 50}`);
  }
}

// Инициализация panzoom при загрузке
setTimeout(function() {
    initPanzoom();
}, 500);



})();