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
        var report = "Время загрузки и выполнения:\n";
        report += "  Старт: 0ms\n";
        
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
        report += "\n  Общее время: " + totalTime + "ms (" + (totalTime/1000).toFixed(2) + "с)\n";
        




        if (this.marks['Первый экран готов'] !== undefined) {
            report += "  До первого экрана: " + this.marks['Первый экран готов'] + "ms (" +
              (this.marks['Первый экран готов']/1000).toFixed(2) + "с)\n";
        }

        if (window.LOADER_STATS && window.LOADER_STATS.startTime) {
            var totalFromLoaderStart = Date.now() - window.LOADER_STATS.startTime;
            report += "  От старта загрузчика до открытия статистики: " + totalFromLoaderStart + "ms (" +
              (totalFromLoaderStart/1000).toFixed(2) + "с)\n";

            if (this.marks['Первый экран готов'] !== undefined) {
                var firstScreenFromLoaderStart =
                  (profiler.startTime - window.LOADER_STATS.startTime) + this.marks['Первый экран готов'];

                report += "  От старта загрузчика до первого экрана: " + firstScreenFromLoaderStart + "ms (" +
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
            
            report += "\nСложность сценария:\n";
            report += "  Сцен: " + sceneCount + "\n";
            report += "  Действий: " + actionCount + "\n";
            report += "  Среднее время на сцену: " + (totalTime / Math.max(1, sceneCount)).toFixed(2) + "ms\n";
            report += "  Среднее время на действие: " + (totalTime / Math.max(1, actionCount)).toFixed(2) + "ms\n";
        }
        
        return report;
    }
};

// Ставим первую метку
profiler.mark('Скрипт начал загрузку');

let __charSeq = 0;
let __activeCharSeq = 0;




var firstScreenMetrics = {
  waitingForCharacter: false,
  firstScreenShown: false
};

function markFirstScreenReady(reason) {
  if (firstScreenMetrics.firstScreenShown) return;

  firstScreenMetrics.firstScreenShown = true;
  profiler.mark('Первый экран готов');

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
      nodeSpacing: 30,       // Расстояние между узлами (было 50)
      rankSpacing: 40,       // Расстояние между уровнями (было 50)
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
    bottomSpacing: {
      cssVar: '--bottomSpacing',
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


  // ---------- DOM ----------
  var elTitle = document.getElementById("title");
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
      target.closest("#choices") ||
      target.closest("#gameModal")));
  }

  elStage.addEventListener("click", function (e) {
    if (isUiClick(e.target)) return;
    onNext();
  });

  


  profiler.mark('DOM загружен');










// Добавьте в engine.js после объявления переменных

// Элементы управления графиком
var btnToggleGraph = document.getElementById("btnToggleGraph");
var graphContainer = document.getElementById("graphContainer");
var graphControls = document.getElementById("graphControls");
var btnCopyMermaid = document.getElementById("btnCopyMermaid");
var btnRefreshGraph = document.getElementById("btnRefreshGraph");
var mermaidGraph = document.getElementById("mermaidGraph");

// Состояние отображения (текст или график)
var showingGraph = false;

// Переменная для хранения текущего кода графа
var currentMermaidCode = "";

// Обработчик кнопки переключения
if (btnToggleGraph) {
  btnToggleGraph.addEventListener("click", function() {
    toggleGraphView();
  });
}

// Обработчик кнопки копирования
if (btnCopyMermaid) {
  btnCopyMermaid.addEventListener("click", function() {
    if (currentMermaidCode) {
      navigator.clipboard.writeText(currentMermaidCode).then(function() {
        // Временная индикация успеха
        var originalText = btnCopyMermaid.textContent;
        btnCopyMermaid.textContent = "✅ Скопировано!";
        setTimeout(function() {
          btnCopyMermaid.textContent = originalText;
        }, 2000);
      }).catch(function(err) {
        console.error("Ошибка копирования:", err);
        alert("Не удалось скопировать код");
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
function toggleGraphView() {
    var statsBody = document.getElementById("statsBody");
    
    if (!showingGraph) {
        // Переключаемся на график
        statsBody.classList.add("hidden");
        graphContainer.classList.remove("hidden");
        graphControls.classList.remove("hidden");
        btnToggleGraph.textContent = "📄 Текст";
        btnToggleGraph.title = "Показать текстовую статистику";
        showingGraph = true;
        
        // Генерируем и отображаем граф
        renderMermaidGraph();
        
        // Сбрасываем масштаб
        setTimeout(resetPanzoom, 200);
    } else {
        // Переключаемся на текст
        statsBody.classList.remove("hidden");
        graphContainer.classList.add("hidden");
        graphControls.classList.add("hidden");
        btnToggleGraph.textContent = "📊 Граф";
        btnToggleGraph.title = "Показать граф сценария";
        showingGraph = false;
    }
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
    elText.textContent = "Загрузка сценария...";
    
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
      
      // Применяем настройки аудио
      setAudioFromStoryDefaults();
      
      profiler.mark('Запускаем сценарий');
      // Запускаем сценарий
      restart();
    };
    
    return;
  }

  var STORY = window.STORY;
  console.log('[Engine] Сценарий найден сразу:', STORY.meta.title);
  profiler.mark('Сценарий найден сразу');

  // ========== ЗАМЕНИТЕ НА ЭТОТ КОД ==========
  console.log('[Engine] STORY.assets:', STORY.assets);
  if (STORY.assets) {
    console.log('[Engine] STORY.assets.backgrounds:', STORY.assets.backgrounds);
    console.log('[Engine] STORY.assets.characters:', STORY.assets.characters);
    console.log('[Engine] STORY.assets.audio:', STORY.assets.audio);
  } else {
    console.log('[Engine] STORY.assets is undefined!');
  }
  // ===========================================

  
  // Применяем настройки отступов
  applySpacingSettings();
  profiler.mark('Настройки отступов применены');

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
    vars: {},
    // Флаг: ждём ли клика "дальше"
    waitingNext: false,
    // Флаг: открыта ли мини-игра
    inGame: false,
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
    console.log('[AUDIO EVENT] bgm error', audio.bgm.error);
    logAudioState('event: error');
  });

  audio.bgm.addEventListener('canplay', function () {
    console.log('[AUDIO EVENT] bgm canplay');
    logAudioState('event: canplay');
  });


  setAudioFromStoryDefaults();
  profiler.mark('Аудио настроено');

  applyUiScale();
  window.addEventListener("resize", applyUiScale);

  // ---------- Подготовка сцен ----------
  buildSceneMap();
  profiler.mark('Карта сцен построена');

  // Заголовок
  if (STORY.meta && STORY.meta.title) {
    if (elTitle) elTitle.textContent = STORY.meta.title;
    document.title = STORY.meta.title;
  }

  // ---------- UI события ----------
  // основной обработчик перехода (один!)
  elDialog.addEventListener("pointerup", function(e){

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

  btnCloseGame.addEventListener("click", function () {
    // Закрытие игры без результата
    closeGame(null);
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

    // Никаких сохранений: просто сбрасываем переменные и идём в start.
    state.vars = {};
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

  function onNext(e) {
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

          // Восстанавливаем индекс только если это был первый показ
          // и мы не в состоянии ожидания
          //if (state.actionIndex === currentActionIndex + 1 && !state.waitingNext) {
          //  console.log('[FLOW] Восстанавливаем индекс до', currentActionIndex);
          //  state.actionIndex = currentActionIndex;
          //}

          state.nextLocked = false;
          state.waitingNext = false;

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
          showDialog(null, action.text || "");
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
        showDialog(displayName, action.text, nameColor);

        if (!firstScreenMetrics.firstScreenShown && !firstScreenMetrics.waitingForCharacter) {
          markFirstScreenReady('say');
        }

        return true;

      case "text":
        console.log('[ENGINE TEXT] Показываю текст, возвращаю true');
        showDialog(null, action.text);

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

      case "set":
        // set: { key: "...", value: ... }
        if (action.key) state.vars[action.key] = action.value;
        return false;

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
    elBg.src = src;
    
    // Обновляем размытый фон тем же изображением
    if (typeof updateBlurBackground === 'function') {
      updateBlurBackground(src);
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
      if (currentSrc === src && !elChar.classList.contains('hidden')) {
        console.log('[Engine setCharacter] Same image already visible, skipping');
        if (done) done();
        return;
      }

      // Если это тот же персонаж, но с другой эмоцией - показываем новую эмоцию без перезагрузки
      if (currentCharId === charId && currentSrc !== src && !elChar.classList.contains('hidden')) {
        console.log('[Engine setCharacter] Same character, changing emotion');
        
        // Просто меняем src, не скрывая персонажа
        elChar.onload = function() {

          console.log('[Engine setCharacter] Emotion changed successfully:', src);
          console.log('[setCharacter] onload - ИНДЕКС ДО ВЫЗОВА callback:', state.actionIndex);
          adjustCharacterScale();
          if (done) {
            console.log('[setCharacter] onload - ВЫЗЫВАЕМ done callback');
            done();
            console.log('[setCharacter] onload - ИНДЕКС ПОСЛЕ callback:', state.actionIndex);
          }
        };
        
        elChar.onerror = function() {
          console.log('[Engine setCharacter] Failed to load new emotion:', src);
          console.log('[Engine setCharacter] Full URL:', elChar.src);
          console.log('[Engine setCharacter] Error event:', arguments);
          if (done) done();
        };
        
        elChar.src = src;
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
          console.log('[Engine setCharacter] Image failed to load:', src);
          console.log('[Engine setCharacter] Full URL:', elChar.src);
          console.log('[Engine setCharacter] Error event:', arguments);
          
          console.log('[Engine setCharacter] Image failed to load:', src);

          console.log('[CHAR FLOW] onerror', {
            seq,
            activeSeq: __activeCharSeq,
            src,
            domSrc: elChar.currentSrc || elChar.src
          });

          if (seq !== __activeCharSeq) {
            return;
          }
          
           // В случае ошибки всё равно пытаемся показать (может быть битая ссылка)
          elChar.classList.remove("hidden");
          adjustCharacterScale();
          if (done) done();
          
      };

      if (seq !== __activeCharSeq) {
        console.warn('[CHAR FLOW] stale onload ignored', {
          seq,
          activeSeq: __activeCharSeq,
          src
        });
      }

      console.log('[Engine setCharacter] Setting src:', src);
      elChar.src = src;
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
    elText.textContent = text ? String(text) : "";

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
    // action: { id, src, onResult }
    if (!action || !action.src) return;

    state.inGame = true;
    elGameModal.classList.remove("hidden");

    // Загружаем игру в iframe
    elGameFrame.src = action.src;

    // Сохраним "обработчик" результата в state
    state.currentGame = {
      id: action.id || "game",
      onResult: action.onResult || null
    };
  }

  function closeGame(resultData) {
    // resultData может быть null или объектом { type:'gameResult', gameId, score, ... }

    // закрываем iframe и модалку
    closeGameFrameVisualOnly();
    state.inGame = false;

    // если результат пришёл — обработаем
    if (resultData && state.currentGame && state.currentGame.onResult) {
      var onResult = state.currentGame.onResult;

      // Пример onResult:
      // { setKey:"quizScore", from:"score", goto:"afterQuiz" }
      if (onResult.setKey) {
        var fromKey = onResult.from || "score";
        state.vars[onResult.setKey] = resultData[fromKey];
      }
      if (onResult.goto) {
        gotoScene(onResult.goto);
      }
    }

    state.currentGame = null;

    // продолжаем выполнение
    state.waitingNext = false;
    runCurrent();
  }

  function closeGameFrameVisualOnly() {
    elGameModal.classList.add("hidden");
    // "глушим" iframe (чтобы игра остановилась)
    elGameFrame.src = "about:blank";
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
    btnMute.textContent = audio.muted ? "🔇" : "🔊";
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

  function resumeBgmIfNeeded() {
    if (!audio || !audio.bgm) return;
    if (audio.muted) return;
    if (!audio.bgm.src) return;

    try {
      var p = audio.bgm.play();
      if (p && typeof p.catch === "function") {
        p.catch(function (err) {
          console.log("[AUDIO] resumeBgmIfNeeded blocked:", err);
        });
      }
    } catch (e) {
      console.log("[AUDIO] resumeBgmIfNeeded exception:", e);
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

    audio.bgm.loop = loop !== false; // по умолчанию true
    audio.currentBgmVolume = clamp((typeof vol === "number" ? vol : DEFAULT_BGM_VOLUME), 0, 1);
    console.log('[AUDIO] playBgm currentBgmVolume set to', audio.currentBgmVolume);

    // Если тот же трек — просто обновим громкость/loop
    if (audio.bgm.src && endsWith(audio.bgm.src, src)) {
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
      crossfadeToBgm(src, fadeMs);
      return;
    }

    // Быстрая смена
    try {
      audio.bgm.pause();
      audio.bgm.src = src;
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
    adjustCharacterScale();
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
    
    var topSpacing = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topSpacing')) || 0;
    var bottomSpacing = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bottomSpacing')) || 0;
    
    // Высота доступная для персонажа (с учетом отступов)
    var availableHeight = window.innerHeight - topSpacing - bottomSpacing;
    
    // Максимальная высота персонажа (не более 85% экрана)
    var targetCharHeight = Math.min(availableHeight * 0.85, window.innerHeight * 0.85);
    
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
      topSpacing: topSpacing,
      bottomSpacing: bottomSpacing,
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
window.addEventListener("resize", adjustCharacterScale);

  
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
    // Сбрасываем состояние на текстовое при каждом открытии
    if (showingGraph) {
      // Если был показан график, переключаем обратно на текст
      var statsBody = document.getElementById("statsBody");
      if (statsBody) {
        statsBody.classList.remove("hidden");
        graphContainer.classList.add("hidden");
        graphControls.classList.add("hidden");
        btnToggleGraph.textContent = "📊 Граф";
        btnToggleGraph.title = "Показать граф сценария";
        showingGraph = false;
      }
    }
    // если открыта игра — не мешаем, можно запретить или просто показывать
    // здесь оставим показывать (по вашему желанию можно блокировать)
    renderStats();
    elStatsPanel.classList.remove("hidden");
  }

  function hideStatsPanel() {
    elStatsPanel.classList.add("hidden");
  }

  // Генерация статистики по STORY.
  // Сделано так, чтобы потом легко дописывать новые показатели: просто добавляете новые строки в statsLines.
  function renderStats() {

    // Показываем индикатор загрузки
    elStatsBody.value = "Сбор информации...";

    // Сначала собираем информацию об окружении
    var envInfo = collectEnvironmentInfo();

    // Добавляем информацию профилера
    var profilerInfo = profiler.getReport();
    
    // Асинхронно проверяем файлы
    checkAssetsFiles().then(fileStats => {
      var stats = computeStoryStats(STORY);
      var errors = validateStory(STORY);
      var textInfo = computeTextInfo(STORY);
      var reach = findUnreachableScenes(STORY);
      var cycles = findCyclesSCC(STORY);

      // Получаем ошибки парсинга
      var parseErrors = window.PARSE_ERRORS || [];

      var text = "";

      text += `Версия программы: ${window.APP_VERSION}\n\n`; // Важно использовать кавычки `` чтобы применялись вставки ${}. В "" не применяются вставки

      text += "=== СТАТИСТИКА СЦЕНАРИЯ ===\n\n";
      text += "Название: " + (STORY.meta && STORY.meta.title ? STORY.meta.title : "(без названия)") + "\n";
      text += "Сцен: " + stats.sceneCount + "\n";
      text += "Меню выбора: " + stats.choiceCount + "\n\n";


       // ===== ОШИБКИ ПАРСИНГА =====
      text += "=== ОШИБКИ ПАРСИНГА ===\n\n";
      
      if (parseErrors.length === 0) {
        text += "✅ Ошибок парсинга не найдено\n\n";
      } else {
        text += `❌ Найдено ошибок: ${parseErrors.length}\n\n`;
        parseErrors.forEach((error, index) => {
          text += `${index + 1}. Строка ${error.lineNumber}: ${error.message}\n`;
          text += `   "${error.line}"\n\n`;
        });
      }


      text += "=== ПРОВЕРКА ФАЙЛОВ ===\n\n";
        
      // Отсутствующие файлы - проверяем ВСЕГДА, независимо от наличия звука
      if (fileStats.missing.length > 0) {
        text += "❌ ОТСУТСТВУЮТ ФАЙЛЫ:\n";
        fileStats.missing.forEach(item => {
          text += `  ${item.path}\n`;
          if (item.refs) {
            item.refs.forEach(ref => text += `    используется в: ${ref}\n`);
          }
        });
        text += "\n";
      } else {
        text += "✅ Все файлы найдены\n\n";
      }
      
      // Ошибки размеров изображений
      if (fileStats.sizeErrors.length > 0) {
        text += "❌ ПРОБЛЕМЫ С РАЗМЕРАМИ ИЗОБРАЖЕНИЙ:\n\n";
        
        fileStats.sizeErrors.forEach(item => {
          text += `Файл: ${item.path}\n`;
          text += `  Текущий размер: ${item.width}×${item.height}\n`;
          if (item.category === 'bg') {
            text += `  Требуется: не менее 1080×1920\n`;
          } else if (item.category === 'char') {
            text += `  Требуется: не менее 500×1200\n`;
          }
          text += `  Проблемы: ${item.errors.join(', ')}\n`;
          if (item.refs) {
            text += `  Используется в: ${item.refs.join(', ')}\n`;
          }
          text += "\n";
        });
      } else {
        text += "✅ Все изображения соответствуют требованиям по размеру\n\n";
      }
      

      text += "=== СТАТИСТИКА ФАЙЛОВ ===\n\n";
      text += "Всего файлов: " + fileStats.files.length + "\n";
      
      // Подсчет изображений и аудио
      var imageCount = 0;
      var audioCount = 0;
      fileStats.files.forEach(f => {
        if (f.path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) imageCount++;
        else if (f.path.match(/\.(mp3|wav|ogg|flac|m4a)$/i)) audioCount++;
      });
      
      text += "  Изображения: " + imageCount + "\n";
      text += "  Аудио: " + audioCount + "\n\n";

      


      text += "=== ОБЪЁМ ТЕКСТА ===\n\n";

      text += "Всего символов: " + textInfo.characters + "\n";
      text += "Всего слов: " + textInfo.words + "\n\n";


      


      text += "=== ИСПОЛЬЗОВАННЫЕ ФОНЫ ===\n";

      if (!stats.backgroundsDetailed || !stats.backgroundsDetailed.length) {
        text += "(нет)\n\n";
      } else {
        for (var i = 0; i < stats.backgroundsDetailed.length; i++) {
          var bgItem = stats.backgroundsDetailed[i];
          text += bgItem.used ? bgItem.id + "\n" : bgItem.id + "*\n";
        }
        text += "\n";
      }





      text += "=== ИСПОЛЬЗОВАННЫЕ ПЕРСОНАЖИ ===\n";

      if (!stats.usedCharactersDetailed || !stats.usedCharactersDetailed.length) {
        text += "(нет)\n\n";
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




      text += "=== ПРОВЕРКА СЦЕНАРИЯ ===\n";

      if (errors.length === 0) {
        text += "Ошибок не найдено.\n";
      } else {
        for (var i = 0; i < errors.length; i++) {
          text += "- " + errors[i] + "\n";
        }
      }


      
      text += "\n\n=== ДОП. АНАЛИЗ СЦЕНАРИЯ ===\n\n";

      text += "Недостижимые сцены (" + reach.unreachable.length + "):\n";
      text += (reach.unreachable.length ? reach.unreachable.join("\n") : "(нет)") + "\n\n";

      text += "Циклы / SCC (" + cycles.length + "):\n";
      if (!cycles.length) {
        text += "(нет)\n";
      } else {
        for (var i = 0; i < cycles.length; i++) {
          text += "- " + cycles[i].join(" -> ") + "\n";
        }
      }

      // ========== ПРОФАЙЛЕР ==========
      text += "=== ПРОФАЙЛЕР ВРЕМЕНИ ===\n\n";
      text += profilerInfo;
      text += "\n";

        text += "=== ЗАГРУЗКА НОВЕЛЛЫ ===\n";

        if (profiler.marks['Первый экран готов'] !== undefined) {
          text += "  До первого экрана: " +
            profiler.marks['Первый экран готов'] + "ms (" +
            (profiler.marks['Первый экран готов'] / 1000).toFixed(2) + "с)\n";
        } else {
          text += "  До первого экрана: ещё не измерено\n";
        }

        if (window.LOADER_STATS && window.LOADER_STATS.startTime && profiler.marks['Первый экран готов'] !== undefined) {
          var firstScreenFromLoaderStart =
            (profiler.startTime - window.LOADER_STATS.startTime) + profiler.marks['Первый экран готов'];

          text += "  От старта загрузчика до первого экрана: " +
            firstScreenFromLoaderStart + "ms (" +
            (firstScreenFromLoaderStart / 1000).toFixed(2) + "с)\n";
        }


      // ========== ВРЕМЯ ЗАГРУЗКИ СЦЕНАРИЯ ==========
      text += "=== ВРЕМЯ ЗАГРУЗКИ СЦЕНАРИЯ ===\n\n";
      
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

          text += "Общее время загрузчика: " + totalLoaderTime + "ms\n";
          text += "  Парсинг: " + parsingTime + "ms\n";
          text += "  Обработка и передача: " + processingTime + "ms\n\n";
          
          text += "Детализация:\n";
          text += "  Старт: 0ms\n";
          
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
          text += "Размер сценария:\n";
          text += "  Сцен: " + window.LOADER_STATS.scenesCount + "\n";
          text += "  Действий: " + window.LOADER_STATS.actionsCount + "\n";
          text += "  Фонов: " + window.LOADER_STATS.backgroundsCount + "\n";
          text += "  Персонажей: " + window.LOADER_STATS.charactersCount + "\n";
          text += "  Аудио: " + window.LOADER_STATS.audioCount + "\n";
          text += "  Время на сцену: " + (totalLoaderTime / Math.max(1, window.LOADER_STATS.scenesCount)).toFixed(2) + "ms\n";
          text += "  Время на действие: " + (totalLoaderTime / Math.max(1, window.LOADER_STATS.actionsCount)).toFixed(2) + "ms\n\n";

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

          text += "Прогноз производительности:\n";
          text += "  На 100 сцен: ~" + Math.round(estimatedFor100Scenes) + "ms (" + (estimatedFor100Scenes/1000).toFixed(1) + "с)\n";
          text += "  На 1000 действий: ~" + Math.round(estimatedFor1000Actions) + "ms (" + (estimatedFor1000Actions/1000).toFixed(1) + "с)\n\n";

          text += "Детальный прогноз по типам действий (на 1000 шт):\n";

          if (sayCount > 0) {
              var timePerSay = totalLoaderTime / sayCount;
              var estimated1000Say = timePerSay * 1000;
              text += "  Фразы персонажей: ~" + Math.round(estimated1000Say) + "ms";
              text += " (по " + timePerSay.toFixed(2) + "ms на фразу)\n";
          }

          if (textCount > 0) {
              var timePerText = totalLoaderTime / textCount;
              var estimated1000Text = timePerText * 1000;
              text += "  Авторский текст: ~" + Math.round(estimated1000Text) + "ms";
              text += " (по " + timePerText.toFixed(2) + "ms на текст)\n";
          }

          if (choiceCount > 0) {
              var timePerChoice = totalLoaderTime / choiceCount;
              var estimated1000Choice = timePerChoice * 1000;
              text += "  Меню выбора: ~" + Math.round(estimated1000Choice) + "ms";
              text += " (по " + timePerChoice.toFixed(2) + "ms на меню)\n";
          }

          if (bgmCount > 0) {
              var timePerBgm = totalLoaderTime / bgmCount;
              var estimated1000Bgm = timePerBgm * 1000;
              text += "  Смена музыки: ~" + Math.round(estimated1000Bgm) + "ms";
              text += " (по " + timePerBgm.toFixed(2) + "ms на смену)\n";
          }

          if (bgCount > 0) {
              var timePerBg = totalLoaderTime / bgCount;
              var estimated1000Bg = timePerBg * 1000;
              text += "  Смена фона: ~" + Math.round(estimated1000Bg) + "ms";
              text += " (по " + timePerBg.toFixed(2) + "ms на смену)\n";
          }

          text += "\n";


      } else {
          text += "Данные загрузчика недоступны\n\n";
      }


      // ========== ИНФОРМАЦИЯ ОБ ОКРУЖЕНИИ ==========
      text += "=== ИНФОРМАЦИЯ ОБ УСТРОЙСТВЕ ===\n\n";
      text += envInfo;
      text += "\n";

      // Добавляем JSON сценария для отладки
      text += "\n\n=== JSON СЦЕНАРИЯ ===\n\n";
      try {
        // Убираем циклические ссылки (если есть)
        const storyJson = JSON.stringify(STORY, (key, value) => {
          if (key === 'sceneMap') return undefined; // не сериализуем
          return value;
        }, 2);
        text += storyJson;
      } catch (e) {
        text += "Ошибка сериализации: " + e.message;
      }


      text += "\n\n=== MERMAID GRAPH ===\n\n";
      text += buildMermaidGraph(STORY, reach.unreachable);



      elStatsBody.value = text;
      elStatsBody.scrollTop = 0;


      // Модифицируем существующую функцию renderStats для обновления графа при переключении
      // Добавьте ЭТИ строки в конец функции renderStats:
      // Если сейчас показывается граф, обновляем его
      if (showingGraph && window.STORY) {
        // Небольшая задержка, чтобы дать время обновиться DOM
        setTimeout(function() {
          renderMermaidGraph();
        }, 100);
      }

    });

  }

  // Также добавьте обработчик изменения размера для адаптации графа
  window.addEventListener("resize", function() {
    if (showingGraph && window.mermaid) {
      // Перерисовываем граф при изменении размера окна
      setTimeout(renderMermaidGraph, 100);
    }
  });



// Новая функция для сбора информации об окружении
function collectEnvironmentInfo() {
  var info = "";
    
    // Размеры окна
    info += "Размеры окна:\n";
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
    info += "Соотношение сторон: " + aspectRatio + " (" + aspectRatio + ":1)\n";
    info += "Ориентация: " + (window.innerHeight > window.innerWidth ? "вертикальная" : "горизонтальная") + "\n\n";
    
    // CSS переменные
    var rootStyle = getComputedStyle(document.documentElement);
    var uiScale = rootStyle.getPropertyValue('--uiScale').trim();
    var baseFontPx = rootStyle.getPropertyValue('--baseFontPx').trim();
    var baseFontSize = rootStyle.getPropertyValue('--baseFontSize').trim();
    var uiBottomOffset = rootStyle.getPropertyValue('--uiBottomOffset').trim();
    var topSpacing = rootStyle.getPropertyValue('--topSpacing').trim();
    var bottomSpacing = rootStyle.getPropertyValue('--bottomSpacing').trim();
    
    info += "CSS переменные:\n";
    info += "  --uiScale: " + uiScale + "\n";
    info += "  --baseFontPx: " + baseFontPx + "\n";
    info += "  --baseFontSize: " + baseFontSize + "\n";
    info += "  --uiBottomOffset: " + uiBottomOffset + "\n";
    info += "  --topSpacing: " + topSpacing + "px\n";
    info += "  --bottomSpacing: " + bottomSpacing + "px\n\n";
    
    // JS переменные масштабирования
    info += "JS настройки масштаба:\n";
    info += "  UI_FONT_SCALE: " + UI_FONT_SCALE + "\n";
    info += "  UI_REFERENCE_HEIGHT: " + UI_REFERENCE_HEIGHT + "\n\n";
    
    // Размеры элементов интерфейса
    var dialog = document.getElementById('dialog');
    if (dialog) {
        var dialogStyle = getComputedStyle(dialog);
        info += "Диалог:\n";
        info += "  width: " + dialogStyle.width + "\n";
        info += "  height: " + dialogStyle.height + "\n";
        info += "  padding: " + dialogStyle.padding + "\n";
        info += "  font-size: " + dialogStyle.fontSize + "\n";
        info += "  bottom: " + dialogStyle.bottom + "\n";
        info += "  классы: " + dialog.className + "\n\n";
    }
    
    var nameBox = document.getElementById('nameBox');
    if (nameBox && !nameBox.classList.contains('hidden')) {
        var nameStyle = getComputedStyle(nameBox);
        info += "Имя персонажа:\n";
        info += "  padding: " + nameStyle.padding + "\n";
        info += "  font-size: " + nameStyle.fontSize + "\n";
        info += "  margin-bottom: " + nameStyle.marginBottom + "\n\n";
    }
    
    var choices = document.getElementById('choices');
    if (choices && !choices.classList.contains('hidden')) {
        var choicesStyle = getComputedStyle(choices);
        var choiceBtn = document.querySelector('.choiceBtn');
        info += "Меню выбора:\n";
        info += "  контейнер bottom: " + choicesStyle.bottom + "\n";
        info += "  gap: " + choicesStyle.gap + "\n";
        
        if (choiceBtn) {
            var btnStyle = getComputedStyle(choiceBtn);
            info += "  кнопка padding: " + btnStyle.padding + "\n";
            info += "  кнопка font-size: " + btnStyle.fontSize + "\n";
        }
        info += "\n";
    }
    
    var char = document.getElementById('charLayer');
    if (char && !char.classList.contains('hidden')) {
        info += "Персонаж:\n";
        info += "  высота (JS): " + char.style.height + "\n";
        info += "  фактическая высота: " + char.offsetHeight + "px\n";
        info += "  max-height (CSS): " + getComputedStyle(char).maxHeight + "\n";
        info += "  bottom: " + getComputedStyle(char).bottom + "\n\n";
    }
    
    // Информация о браузере
    info += "Браузер:\n";
    info += "  userAgent: " + navigator.userAgent + "\n";
    info += "  язык: " + navigator.language + "\n";
    info += "  платформа: " + navigator.platform + "\n";
    
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
            allFiles.push({ 
              id: id, 
              path: path, 
              type: 'audio', 
              category: 'audio', 
              ref: id 
            });
          });
        }

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
        
        const uniquePaths = Object.keys(pathGroups);
        let loadedCount = 0;
        let errorCount = 0;
        const totalPaths = uniquePaths.length;
        
        const fileResults = {};
        
        function checkComplete() {
            if (loadedCount + errorCount === totalPaths) {
                // Собираем результаты
                uniquePaths.forEach(path => {
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
                                    errors.push(`ширина ${fileData.width}px < ${required.width}px`);
                                }
                                if (fileData.height < required.height) {
                                    errors.push(`высота ${fileData.height}px < ${required.height}px`);
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
        
        // Инициализируем счетчики связей
        if (!incomingEdges[scene.id]) incomingEdges[scene.id] = 0;
        if (!outgoingEdges[scene.id]) outgoingEdges[scene.id] = 0;
        
        for (var a = 0; a < actions.length; a++) {
            var act = actions[a];
            if (!act || !act.type) continue;
            
            if (act.type === "char" && act.charId) {
                charSet[act.charId] = true;
            }
            
            if (act.type === "say") sayCount++;
            if (act.type === "text") textCount++;
            if (act.type === "bgm") bgmCount++;
            
            // ПОДСЧЕТ ФОНОВ И СОХРАНЕНИЕ ПЕРВОГО
            if (act.type === "bg" && act.src) {
                bgCount++;
                var bgId = extractAliasId(act.src, "bg");
                if (bgId) {
                    uniqueBgs[bgId] = true;
                    
                    // Сохраняем первый фон
                    if (firstBgId === null) {
                        firstBgId = bgId;
                        // Получаем реальный путь к изображению
                        if (story.assets && story.assets.backgrounds) {
                            firstBgSrc = story.assets.backgrounds[bgId];
                        }
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
        
        nodes.push({
            id: scene.id,
            characters: keysSorted(charSet),
            phraseCount: (sayCount + textCount),
            bgmCount: bgmCount,
            bgCount: bgCount, // Общее количество смен фонов
            uniqueBgCount: Object.keys(uniqueBgs).length, // Количество уникальных фонов
            firstBgSrc: firstBgSrc,  // Путь к первому фону
            firstBgId: firstBgId      // ID первого фона
        });
    }
    
    // Формируем Mermaid граф
    var mermaid = "graph LR;\n";  // LR = Left to Right (как в DOT)
    
    // Добавляем заголовок
    mermaid += "%% " + ((story.meta && story.meta.title) ? story.meta.title : "Visual Novel") + "\n";
    
    // Стили для узлов. Основные настройки производятся в CSS
    mermaid += "%% Определение стилей\n";
    mermaid += "classDef default fill:#fff3e0,stroke:#e6d6bc,color:#000,stroke-width:1px,r:12px;\n";
    mermaid += "classDef start fill:#e1f5e1,stroke:#b6deb6,color:#000,stroke-width:2px,r:15px;\n";
    mermaid += "classDef unreachable fill:#ffebee,stroke:#ff0000,color:#000,stroke-dasharray:5 5,stroke-width:2px,r:12px;\n";
    mermaid += "classDef final fill:#f3e5f5,stroke:#e0bfe2,color:#000,stroke-width:2px,r:14px;\n\n";
    
    // Создаем узлы с многострочными метками
    for (var n = 0; n < nodes.length; n++) {
        var node = nodes[n];
        var chars = node.characters.length ? node.characters.join(", ") : "(нет)";
        
        // Формируем многострочную метку
        var label = 
            node.id + "<br/>";

            // Добавляем маленькое изображение фона, если оно есть
            if (node.firstBgSrc) {
                // Экранируем спецсимволы в пути
                var imgSrc = node.firstBgSrc.replace(/"/g, '&quot;');
                label += '<img src="' + imgSrc + '" width="40" height="40" style="object-fit: cover; border-radius: 0px; margin: 2px;" /> ';
            }

            if (chars != '(нет)')
              { label+= "👤" + chars + "<br/>"; }
            if (node.bgCount != 0) {
              label += " 🖼️" + node.uniqueBgCount; //node.bgCount;
            }
            if (node.phraseCount != 0)
              { label+= " 💬" + node.phraseCount; }
            if (node.bgmCount != 0)
              { label+= " 🎵" + node.bgmCount; }
        
        mermaid += '    ' + node.id + '["' + label + '"]\n';
    }
    
    mermaid += "\n";
    
    // Применяем классы
    mermaid += "%% Применение стилей\n";
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
    
    mermaid += "\n%% Связи\n";
    
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
            errors.push("Переход в несуществующую сцену: " + act.target);
          }
        }

        if (act.type === "bg") {

          var id = extractAliasId(act.src, "bg");

          if (id && !story.assets.backgrounds[id]) {
            errors.push("Не найден фон: " + id);
          }
        }

        if (act.type === "char") {

          var id = extractAliasId(act.src, "ch");

          if (id && !story.assets.characters[id]) {
            errors.push("Не найден персонаж: " + id);
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
  }


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

    if (Object.prototype.hasOwnProperty.call(normalizedUrlParams, 'topspacing')) {
      var topSpacingRaw = normalizedUrlParams.topspacing;
      

      if (/^\d+$/.test(String(topSpacingRaw).trim())) {
        queryOverrides.topSpacing = parseInt(topSpacingRaw, 10);
      } else {
        console.log('[URL DIRECT] ignored invalid topSpacing =', topSpacingRaw);
      }
    }

    if (Object.prototype.hasOwnProperty.call(normalizedUrlParams, 'bottomspacing')) {
      var bottomSpacingRaw = normalizedUrlParams.bottomspacing;

      if (/^\d+$/.test(String(bottomSpacingRaw).trim())) {
        queryOverrides.bottomSpacing = parseInt(bottomSpacingRaw, 10);
      } else {
        console.log('[URL DIRECT] ignored invalid bottomSpacing =', bottomSpacingRaw);
      }
    }

    // URL имеет приоритет над story.js
    var finalMeta = Object.assign({}, storyMeta, queryOverrides);

    // Важно: записываем финальные значения обратно в STORY.meta,
    // чтобы их использовали все остальные расчёты движка
    if (window.STORY && window.STORY.meta) {
      if (finalMeta.topSpacing !== undefined) {
        window.STORY.meta.topSpacing = finalMeta.topSpacing;
      }
      if (finalMeta.bottomSpacing !== undefined) {
        window.STORY.meta.bottomSpacing = finalMeta.bottomSpacing;
      }
    }

    applyUIStyleVariables(finalMeta);

    // blur_background — отдельный логический флаг
    var blurBackground = (typeof finalMeta.blurBackground === 'boolean')
      ? finalMeta.blurBackground
      : true;

    if (elBlurBgLayer) {
      elBlurBgLayer.style.display = blurBackground ? 'block' : 'none';
    }

    console.log('[Engine] UI settings applied:', {
      storyMeta: storyMeta,
      queryOverrides: queryOverrides,
      finalTopSpacing: getComputedStyle(document.documentElement).getPropertyValue('--topSpacing').trim(),
      finalBottomSpacing: getComputedStyle(document.documentElement).getPropertyValue('--bottomSpacing').trim()
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
    minScale: 0.5,      // Минимальный масштаб до 50%
    maxScale: 50,       // Максимальный масштаб до 5000% (10x)
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
    updatePanzoomTransform();
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

// Инициализация обработчиков panzoom
// Инициализация обработчиков panzoom
function initPanzoom() {
    if (!panzoomWrapper || !panzoomContent) return;
    
    var container = document.getElementById("graphContainer");
    
    // Обработчик начала панорамирования (левая кнопка)
    panzoomWrapper.addEventListener('mousedown', function(e) {
        // Не на кнопках управления
        if (e.target.closest('.graph-zoom-controls')) return;
        
        // Левая кнопка (0)
        if (e.button === 0) {
            e.preventDefault();
            
            panzoomState.isPanning = true;
            panzoomState.panMode = 'left';
            panzoomState.startX = e.clientX;
            panzoomState.startY = e.clientY;
            panzoomState.startTranslateX = panzoomState.translateX;
            panzoomState.startTranslateY = panzoomState.translateY;
            
            container.classList.add('panning');
        }
        
        // Средняя кнопка (колесико) - тоже для панорамирования
        if (e.button === 1) {
            e.preventDefault();
            
            panzoomState.isPanning = true;
            panzoomState.panMode = 'middle';
            panzoomState.startX = e.clientX;
            panzoomState.startY = e.clientY;
            panzoomState.startTranslateX = panzoomState.translateX;
            panzoomState.startTranslateY = panzoomState.translateY;
            
            container.classList.add('panning');
        }
    });
    
    // Обработчик движения мыши
    window.addEventListener('mousemove', function(e) {
        if (!panzoomState.isPanning) return;
        
        e.preventDefault();
        
        var dx = e.clientX - panzoomState.startX;
        var dy = e.clientY - panzoomState.startY;
        
        panzoomState.translateX = panzoomState.startTranslateX + dx;
        panzoomState.translateY = panzoomState.startTranslateY + dy;
        
        updatePanzoomTransform();
    });
    
    // Обработчик окончания панорамирования
    window.addEventListener('mouseup', function(e) {
        if (panzoomState.isPanning) {
            panzoomState.isPanning = false;
            panzoomState.panMode = 'none';
            container.classList.remove('panning');
        }
    });
    
    // Предотвращаем появление контекстного меню при отпускании средней кнопки
    panzoomWrapper.addEventListener('contextmenu', function(e) {
        if (e.button === 1 || e.button === 2) {
            e.preventDefault();
        }
    });
    
    // Обработчик колесика мыши для зума с увеличенным шагом
    panzoomWrapper.addEventListener('wheel', function(e) {
        e.preventDefault();
        
        // Увеличил шаг зума для более быстрого масштабирования
        var delta = e.deltaY > 0 ? -1 : 1;
        
        // Более агрессивный зум (умножаем на 1.2 вместо 1.1)
        var oldScale = panzoomState.scale;
        var newScale = panzoomState.scale * (delta > 0 ? 1.2 : 0.83);
        newScale = Math.max(panzoomState.minScale, Math.min(panzoomState.maxScale, newScale));
        
        if (newScale === oldScale) return;
        
        // Зум относительно позиции мыши
        var rect = panzoomWrapper.getBoundingClientRect();
        var mouseXRatio = (e.clientX - rect.left - panzoomState.translateX) / oldScale;
        var mouseYRatio = (e.clientY - rect.top - panzoomState.translateY) / oldScale;
        
        panzoomState.translateX = e.clientX - rect.left - mouseXRatio * newScale;
        panzoomState.translateY = e.clientY - rect.top - mouseYRatio * newScale;
        panzoomState.scale = newScale;
        
        updatePanzoomTransform();
    }, { passive: false });
    
    // Кнопки зума с увеличенным шагом
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', function() {
            var oldScale = panzoomState.scale;
            var newScale = oldScale * 1.3; // Увеличил шаг с 1.2 до 1.3
            newScale = Math.min(panzoomState.maxScale, newScale);
            
            if (newScale === oldScale) return;
            
            // Центрированный зум
            if (panzoomWrapper) {
                var rect = panzoomWrapper.getBoundingClientRect();
                var centerX = rect.left + rect.width / 2;
                var centerY = rect.top + rect.height / 2;
                
                var mouseXRatio = (centerX - rect.left - panzoomState.translateX) / oldScale;
                var mouseYRatio = (centerY - rect.top - panzoomState.translateY) / oldScale;
                
                panzoomState.translateX = centerX - rect.left - mouseXRatio * newScale;
                panzoomState.translateY = centerY - rect.top - mouseYRatio * newScale;
            }
            
            panzoomState.scale = newScale;
            updatePanzoomTransform();
        });
    }
    
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', function() {
            var oldScale = panzoomState.scale;
            var newScale = oldScale / 1.3; // Увеличил шаг
            newScale = Math.max(panzoomState.minScale, newScale);
            
            if (newScale === oldScale) return;
            
            // Центрированный зум
            if (panzoomWrapper) {
                var rect = panzoomWrapper.getBoundingClientRect();
                var centerX = rect.left + rect.width / 2;
                var centerY = rect.top + rect.height / 2;
                
                var mouseXRatio = (centerX - rect.left - panzoomState.translateX) / oldScale;
                var mouseYRatio = (centerY - rect.top - panzoomState.translateY) / oldScale;
                
                panzoomState.translateX = centerX - rect.left - mouseXRatio * newScale;
                panzoomState.translateY = centerY - rect.top - mouseYRatio * newScale;
            }
            
            panzoomState.scale = newScale;
            updatePanzoomTransform();
        });
    }
    
    if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', function() {
            resetPanzoom();
        });
    }
    
    // Сброс при переключении графа
    resetPanzoom();
}

// Модифицируйте функцию renderMermaidGraph для сброса масштаба при новой загрузке

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
                
                // Сбрасываем масштаб после загрузки нового графа
                setTimeout(function() {
                    resetPanzoom();
                }, 100);
            } catch (e) {
                console.error("Ошибка инициализации Mermaid:", e);
                mermaidGraph.innerHTML = '<div style="color: red; padding: 1rem;">Ошибка отображения графа. Проверьте консоль.</div>';
            }
        } else {
            mermaidGraph.innerHTML = '<div style="color: orange; padding: 1rem;">Библиотека Mermaid не загружена</div>';
        }
    }
}

// Инициализация panzoom при загрузке
setTimeout(function() {
    initPanzoom();
}, 500);



})();