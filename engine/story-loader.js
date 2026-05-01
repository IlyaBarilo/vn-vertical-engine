// story-loader.js
// Парсит STORY_TEXT в window.STORY

(function() {
  "use strict";


  // ========== СОБСТВЕННЫЙ ПРОФАЙЛЕР ЗАГРУЗЧИКА ==========
  window.LOADER_STATS = {
    startTime: Date.now(),
    marks: {},
    scenesCount: 0,
    actionsCount: 0,
    charactersCount: 0,
    backgroundsCount: 0,
    audioCount: 0,
    videosCount: 0
  };
  
  function loaderMark(name) {
    var time = Date.now() - window.LOADER_STATS.startTime;
    window.LOADER_STATS.marks[name] = time;
    console.log('[LOADER TIME]', name + ':', time + 'ms');
    return time;
  }

  loaderMark('loader_start');
  console.log('[Loader] Запуск парсера...');

  window.STORY_LANG = 'en';



  // Массив для сбора ошибок парсинга
  window.PARSE_ERRORS = [];

  // Флаг для остановки парсинга при ошибке
  window.PARSE_ERROR_STOP = false;


  // ЗАМЕНИТЬ существующую функцию addParseError на эту:
  function addParseError(lineNumber, line, message, isCritical = true) {
    const error = {
      lineNumber: lineNumber,
      line: line,
      message: message,
      timestamp: Date.now(),
      isCritical: isCritical
    };
    window.PARSE_ERRORS.push(error);
    console.error(`[PARSE ERROR] Строка ${lineNumber}: ${message} - "${line}"`);
    
    // Устанавливаем флаг остановки для критических ошибок
    if (isCritical) {
      window.PARSE_ERROR_STOP = true;
      console.error('[PARSE ERROR] Критическая ошибка - парсинг остановлен');
    }
  }







  // Конфиг параметров интерфейса, которые можно задавать в story.js
  // key        — как параметр называется в story.js
  // target     — как он будет храниться в story.meta
  // type       — тип значения для преобразования
  const UI_META_CONFIG = {
    topSpacing: {
      target: 'topSpacing',
      type: 'int'
    },
    bottomSpacing: {
      target: 'bottomSpacing',
      type: 'int'
    },
    leftSpacing: {
      target: 'leftSpacing',
      type: 'int'
    },
    rightSpacing: {
      target: 'rightSpacing',
      type: 'int'
    },
    blurBackground: {
      target: 'blurBackground',
      type: 'bool'
    },
    blurStrength: {
      target: 'blurStrength',
      type: 'float'
    },
    blurBrightness: {
      target: 'blurBrightness',
      type: 'float'
    },
    blurOpacity: {
      target: 'blurOpacity',
      type: 'float'
    }
  };



  // Проверяем наличие текста
  if (!window.STORY_TEXT) {
    console.error('[Loader] window.STORY_TEXT не найден!');
    loaderMark('Error: STORY_TEXT is missing');
    createFallbackStory('Не найден story.js');
    return;
  }

  // Парсим текст
  parseStory(window.STORY_TEXT);

  // ========================================
  // ПАРСЕР
  // ========================================

    function normalizeAssetsAfterParse(story) {
    if (!story || !story.assets) return;

    if (!story.assets.backgrounds) story.assets.backgrounds = {};
    if (!story.assets.characters) story.assets.characters = {};
    if (!story.assets.audio) story.assets.audio = {};
    if (!story.assets.games) story.assets.games = {};
    if (!story.assets.videos) story.assets.videos = {};

    Object.keys(story.assets.characters).forEach(function(charId) {
      var char = story.assets.characters[charId];
      if (!char.images) {
        char.images = {};
      }
    });

    Object.keys(story.assets.games).forEach(function(gameId) {
      var game = story.assets.games[gameId];

      if (!game || typeof game !== 'object') {
        story.assets.games[gameId] = {
          file: ''
        };
        return;
      }

      if (!Object.prototype.hasOwnProperty.call(game, 'file')) {
        game.file = '';
      }
    });
  }

  function parseStory(text) {
    console.log('[Loader] Начинаем парсинг, длина:', text.length);
    console.log('[Loader] ПЕРВЫЕ 500 символов текста:');
    console.log(text.substring(0, 500));
    loaderMark('Start parsing');

    // Структура для результата
    const story = {
      meta: {
        title: "Без названия",
        start: null,
        lang: 'en',
        blurBackground: true
      },
      assets: {
        backgrounds: {},
        characters: {},
        audio: {},
        games: {},
        videos: {}
      },
      audioSettings: {
        masterVolume: 0.2,
        muted: true
      },
      vars: {},
      scenes: []
    };

    let currentScene = null;
    const sceneParseState = {
      blockStack: []
    };
    let currentSection = null; // 'meta', 'bg', 'char', 'audio', 'game', 'video', 'var', 'scene'
    let lineNumber = 0;

    const lines = text.split(/\r?\n/);
    console.log('[Loader] Всего строк:', lines.length);

    for (let i = 0; i < lines.length; i++) {
      lineNumber = i + 1;
      let line = lines[i].trim();
      
      // Проверяем, не было ли критической ошибки
      if (window.PARSE_ERROR_STOP) {
        console.log('[Loader] Парсинг остановлен из-за критической ошибки');
        break;
      }

      // Пропускаем пустые строки
      if (line === '') continue;
      
      // Определяем секции

      //Подсказка про устаревшее название
      if (/^\s*#\s*МЕТАДАННЫЕ\s*$/i.test(line)) {
        currentSection = 'meta';
        continue;
        //addParseError(0, "Раздел Метаданные", "Замените #МЕТАДАННЫЕ на [meta]");
      }

      if (/^\s*\[meta\]\s*$/i.test(line)) {
        currentSection = 'meta';
        continue;
      }

      if (/^\s*\[bg\]\s*$/i.test(line)) {
        currentSection = 'bg';
        continue;
      }
      
      if (/^\s*\[char\]\s*$/i.test(line)) {
        currentSection = 'char';
        continue;
      }
      
      if (/^\s*\[audio\]\s*$/i.test(line)) {
        currentSection = 'audio';
        continue;
      }

      if (/^\s*\[game\]\s*$/i.test(line)) {
        currentSection = 'game';
        continue;
      }

      if (/^\s*\[video\]\s*$/i.test(line)) {
        currentSection = 'video';
        continue;
      }

      if (/^\s*\[var\]\s*$/i.test(line)) {
        currentSection = 'var';
        continue;
      }

      //Подсказка про устаревшее название
      if (/^\s*#\s*СЦЕНЫ\s*$/i.test(line)) {
        currentSection = 'scene';
        // addParseError(line, "Раздел Сцены", "Замените #СЦЕНЫ на [scene]");
      }

      if (/^\s*\[scene\]\s*$/i.test(line)) {
        currentSection = 'scene';
        continue;
      }
      
      // Парсим в зависимости от секции
      switch (currentSection) {
        case 'meta':
          parseMetaLine(line, story);
          break;
        case 'bg':
          parseAssetLine(lineNumber, line, 'backgrounds', story);
          break;
        case 'char':
          console.log('[Loader CHAR] Processing line:', line);
          parseAssetLine(lineNumber, line, 'characters', story);
          break;
        case 'audio':
          parseAssetLine(lineNumber, line, 'audio', story);
          break;
        case 'game':
          parseAssetLine(lineNumber, line, 'games', story);
          break;
        case 'video':
          parseAssetLine(lineNumber, line, 'videos', story);
          break;
        case 'var':
          parseVarLine(lineNumber, line, story);
          break;
        case 'scene':
          parseSceneLine(line, story, currentScene, (scene) => { currentScene = scene; }, lineNumber, sceneParseState);
          break;
        default:
          // Если секция не определена, но строка начинается с 'scene'
          if (line.startsWith('scene ')) {
            currentSection = 'scene';
            parseSceneLine(line, story, currentScene, (scene) => { currentScene = scene; }, lineNumber, sceneParseState);
          }
      }
    }

    if (sceneParseState.blockStack.length > 0) {
      // Автозакрытие старых меню (без "choice") в конце файла
      var topEofBlk = sceneParseState.blockStack[sceneParseState.blockStack.length - 1];
      while (topEofBlk && topEofBlk.type === 'menu' && topEofBlk.menuAction && !topEofBlk.menuAction.hasChoiceKw) {
        sceneParseState.blockStack.pop();
        topEofBlk = sceneParseState.blockStack.length > 0
          ? sceneParseState.blockStack[sceneParseState.blockStack.length - 1]
          : null;
      }

      if (sceneParseState.blockStack.length > 0) {
        var unclosedBlock = sceneParseState.blockStack[sceneParseState.blockStack.length - 1];
        var unclosedKind = unclosedBlock && unclosedBlock.type === 'menu' ? 'menu' : 'if';
        var unclosedMsg = unclosedKind === 'menu'
          ? 'Unclosed menu block: missing "end"'
          : 'Unclosed conditional block: missing "end"';
        addParseError(
          unclosedBlock.lineNumber || 0,
          unclosedKind,
          unclosedMsg,
          true
        );
      }
    }
    
    // Добавляем последнюю сцену
    if (currentScene) {
      story.scenes.push(currentScene);
    }
    
    normalizeAssetsAfterParse(story);
    
    window.STORY_LANG = (story.meta && story.meta.lang ? story.meta.lang : 'en');

    // Устанавливаем стартовую сцену, если не задана
    if (!story.meta.start && story.scenes.length > 0) {
      story.meta.start = story.scenes[0].id;
    }
    




    // ===== ПРОВЕРКА СТАРТОВОЙ СЦЕНЫ =====
    if (story.meta.start) {
      const sceneIds = new Set();
      story.scenes.forEach(scene => {
        if (scene.id) sceneIds.add(scene.id);
      });
      
      if (!sceneIds.has(story.meta.start)) {
        addParseError(
          0, 
          "Metadata", 
          `The start scene "${story.meta.start}" does not exist`
        );
        
        // Автоматически исправляем на первую сцену
        if (story.scenes.length > 0) {
          const oldStart = story.meta.start;
          story.meta.start = story.scenes[0].id;
          console.log(`[Loader] Start scene "${oldStart}" not found, corrected to "${story.meta.start}"`);
        }
      } else {
        console.log('[Loader] Start scene exists:', story.meta.start);
      }
    } else {
      addParseError(0, "Metadata", "Start scene (startScene) not specified");
      if (story.scenes.length > 0) {
        story.meta.start = story.scenes[0].id;
        console.log('[Loader] Установлена первая сцена как стартовая:', story.meta.start);
      }
    }






    // ===== ВАЖНО: проверяем ссылки на сцены =====
    validateSceneReferences(story);

    loaderMark('Parsing complete');
    console.log('[Loader] Парсинг завершён!');
    console.log('[Loader] Найдено сцен:', story.scenes.length);
    console.log('[Loader] Стартовая сцена:', story.meta.start);






    // Проверяем, были ли критические ошибки
    if (window.PARSE_ERRORS.length > 0) {
      console.error('[Loader] Обнаружены ошибки парсинга:', window.PARSE_ERRORS.length);
      
      // Вместо нормального сценария создаём сцену с ошибкой
      showParseError();
      return; // Выходим из функции, не сохраняя обычный сценарий
    }







    // Сохраняем статистику сценария ТОЛЬКО ПОСЛЕ ПОЛНОГО ПАРСИНГА
    window.LOADER_STATS.scenesCount = story.scenes.length;

    // Подсчет действий
    var actionCount = 0;
    if (story.scenes && story.scenes.length > 0) {
      story.scenes.forEach(function(scene) {
        if (scene.actions && scene.actions.length > 0) {
          actionCount += scene.actions.length;
        }
      });
    }
    window.LOADER_STATS.actionsCount = actionCount;

    // Подсчет ресурсов
    if (story.assets) {
      window.LOADER_STATS.backgroundsCount = story.assets.backgrounds ? Object.keys(story.assets.backgrounds).length : 0;
      
      // Подсчет персонажей (учитывая, что у каждого могут быть несколько эмоций)
      var characterCount = 0;
      if (story.assets.characters) {
        characterCount = Object.keys(story.assets.characters).length;
      }
      window.LOADER_STATS.charactersCount = characterCount;
      
      window.LOADER_STATS.audioCount = story.assets.audio ? Object.keys(story.assets.audio).length : 0;
      window.LOADER_STATS.gamesCount = story.assets.games ? Object.keys(story.assets.games).length : 0;
      window.LOADER_STATS.videosCount = story.assets.videos ? Object.keys(story.assets.videos).length : 0;
    }

    loaderMark('stats_collected');
    console.log('[Loader] Статистика собрана:', {
      scenes: window.LOADER_STATS.scenesCount,
      actions: window.LOADER_STATS.actionsCount,
      backgrounds: window.LOADER_STATS.backgroundsCount,
      characters: window.LOADER_STATS.charactersCount,
      audio: window.LOADER_STATS.audioCount,
      games: window.LOADER_STATS.gamesCount,
      videos: window.LOADER_STATS.videosCount
    });



    // Передаём в движок
    window.STORY = story;
    
    loaderMark('STORY has been transferred to the window');
    console.log('[Loader] ФИНАЛЬНЫЙ STORY.assets:', story.assets);
    console.log('[Loader] ФИНАЛЬНЫЙ backgrounds:', story.assets.backgrounds);
    console.log('[Loader] ФИНАЛЬНЫЙ audio:', story.assets.audio);

    // Уведомляем движок
    if (window.__onStoryLoaded) {
      console.log('[Loader] Уведомляем движок');
      window.__onStoryLoaded(story);
      loaderMark('The engine has been notified');
    } else {
      console.log('[Loader] Движок ещё не загружен, он подхватит window.STORY позже');
      loaderMark('Waiting for the engine');
    }
  }


  // Универсально преобразует строку из story.js в нужный тип
  function parseMetaValueByType(value, type) {
    if (type === 'int') {
      var intValue = parseInt(value, 10);
      return isNaN(intValue) ? null : intValue;
    }

    if (type === 'float') {
      var floatValue = parseFloat(value);
      return isNaN(floatValue) ? null : floatValue;
    }

    if (type === 'bool') {
      return value === 'true' || value === '1';
    }

    // Если тип неизвестен — возвращаем строку как есть
    return value;
  }

  function parseVarLine(lineNumber, line, story) {
    line = line.split('#')[0].trim();
    if (!line) return;

    if (!line.includes('=')) return;

    var parts = line.split('=');
    var key = parts[0].trim();
    var rawValue = parts.slice(1).join('=').trim();

    if (!key) {
      addParseError(lineNumber, line, "The variable name in [var] cannot be empty", true);
      return;
    }

    if (rawValue === '') {
      addParseError(lineNumber, line, "The value of the variable in [var] cannot be empty", true);
      return;
    }

    if (rawValue === 'true') {
      story.vars[key] = true;
      return;
    }

    if (rawValue === 'false') {
      story.vars[key] = false;
      return;
    }

    if (!isNaN(Number(rawValue))) {
      story.vars[key] = Number(rawValue);
      return;
    }

    if (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    ) {
      story.vars[key] = rawValue.slice(1, -1);
      return;
    }

    story.vars[key] = rawValue;
  }




function parseActionParams(paramTokens) {
  var params = {};

  for (var i = 0; i < paramTokens.length; i++) {
    var token = String(paramTokens[i] || "").trim();
    if (!token) continue;

    var eqIndex = token.indexOf('=');
    if (eqIndex <= 0) continue;

    var key = token.slice(0, eqIndex).trim();
    var rawValue = token.slice(eqIndex + 1).trim();

    if (!key) continue;

    if (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    ) {
      rawValue = rawValue.slice(1, -1);
    }

    if (rawValue === 'true') {
      params[key] = true;
      continue;
    }

    if (rawValue === 'false') {
      params[key] = false;
      continue;
    }

    if (rawValue !== '' && !isNaN(Number(rawValue))) {
      params[key] = Number(rawValue);
      continue;
    }

    params[key] = rawValue;
  }

  return params;
}

// Разбирает настройку горизонтального скролла для фоновых и видео-медиа из сценария.
function parseBackgroundScrollOption(rawValue, lineNumber, line) {
  var value = String(rawValue === undefined ? "true" : rawValue).trim().toLowerCase();

  if (value === "true" || value === "1" || value === "yes" || value === "on") {
    return { enabled: true };
  }

  if (value === "false" || value === "0" || value === "no" || value === "off") {
    return { enabled: false };
  }

  if (value === "left" || value === "start") {
    return { enabled: true, start: 0 };
  }

  if (value === "center" || value === "middle") {
    return { enabled: true, start: 0.5 };
  }

  if (value === "right" || value === "end") {
    return { enabled: true, start: 1 };
  }

  if (value !== "" && !isNaN(Number(value))) {
    var numeric = Number(value);
    if (numeric >= 0 && numeric <= 1) {
      return { enabled: true, start: numeric };
    }
    if (numeric >= 0 && numeric <= 100) {
      return { enabled: true, start: numeric / 100 };
    }
  }

  addParseError(lineNumber, line, `Invalid scroll value "${rawValue}". Use true/false, left/center/right, 0..1 or 0..100.`, true);
  return null;
}

// Проверяет bare-флаг вида "scroll" без значения, не путая его с "scroll=false".
function hasBareToken(text, tokenName) {
  var re = new RegExp("(^|\\s)" + tokenName + "(?=\\s|$)", "i");
  return re.test(String(text || ""));
}

function stripInlineComment(line) {
  var text = String(line || '');
  var quote = null;
  var escaped = false;

  for (var i = 0; i < text.length; i++) {
    var ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (ch === '#') {
      return text.slice(0, i).trim();
    }
  }

  return text.trim();
}

function stripAssetInlineComment(line) {
  var text = String(line || '');
  var quote = null;
  var escaped = false;

  if (/^\s*#/.test(text)) return '';

  for (var i = 0; i < text.length; i++) {
    var ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (ch === '#' && (i === 0 || /\s/.test(text.charAt(i - 1)))) {
      return text.slice(0, i).trim();
    }
  }

  return text.trim();
}

function splitQuotedTokens(text) {
  var tokens = [];
  var current = '';
  var quote = null;
  var escaped = false;

  String(text || '').trim().split('').forEach(function(ch) {
    if (escaped) {
      current += ch;
      escaped = false;
      return;
    }

    if (ch === '\\') {
      current += ch;
      escaped = true;
      return;
    }

    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      return;
    }

    if (ch === '"' || ch === "'") {
      current += ch;
      quote = ch;
      return;
    }

    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      return;
    }

    current += ch;
  });

  if (current) tokens.push(current);
  return tokens;
}

function parseGameAction(lineNumber, line, cleanLine, story, currentScene) {
  var tokens = splitQuotedTokens(cleanLine);
  if (tokens.length < 2) {
    addParseError(lineNumber, line, 'The game command must contain the game ID', true);
    return;
  }

  var gameId = tokens[1];

  if (!story.assets.games || !story.assets.games[gameId]) {
    addParseError(lineNumber, line, 'Game "' + gameId + '" is not declared in [game]', true);
    return;
  }

  var params = parseActionParams(tokens.slice(2));

  if (!Object.prototype.hasOwnProperty.call(params, 'result')) {
    addParseError(lineNumber, line, 'The game command must contain result=<varName>', true);
    return;
  }

  var resultVar = String(params.result || '').trim();
  if (!resultVar) {
    addParseError(lineNumber, line, 'The result variable in game command cannot be empty', true);
    return;
  }

  delete params.result;





  var gameAsset = story.assets.games[gameId];
  var gameSrc = gameAsset && typeof gameAsset === 'object'
    ? String(gameAsset.file || '').trim()
    : '';

  if (!gameSrc) {
    addParseError(lineNumber, line, 'Game "' + gameId + '" does not contain file=... in [game]', true);
    return;
  }

  currentScene.actions.push({
    type: 'game',
    gameId: gameId,
    src: gameSrc,
    resultVar: resultVar,
    params: params
  });
}

function parseVideoAction(lineNumber, line, cleanLine, story, currentScene) {
  // Сюжетное видео блокирует поток команд, пока не завершится, не дойдет до stop или не будет пропущено.
  var tokens = splitQuotedTokens(cleanLine);
  if (tokens.length < 2) {
    addParseError(lineNumber, line, 'The video command must contain the video ID', true);
    return;
  }

  var videoId = tokens[1];

  if (!story.assets.videos || !story.assets.videos[videoId]) {
    addParseError(lineNumber, line, 'Video "' + videoId + '" is not declared in [video]', true);
    return;
  }

  var params = parseActionParams(tokens.slice(2));
  if (params.scroll === undefined && tokens.slice(2).some(function(token) {
    return String(token || "").toLowerCase() === "scroll";
  })) {
    params.scroll = true;
  }

  var videoAsset = story.assets.videos[videoId];
  var videoSrc = videoAsset && typeof videoAsset === 'object'
    ? String(videoAsset.file || '').trim()
    : '';

  if (!videoSrc) {
    addParseError(lineNumber, line, 'Video "' + videoId + '" does not contain file=... in [video]', true);
    return;
  }

  var action = {
    type: 'video',
    videoId: videoId,
    src: videoSrc,
    poster: videoAsset.poster || '',
    volume: typeof videoAsset.volume === 'number' ? videoAsset.volume : 0,
    scroll: videoAsset.scroll !== undefined ? videoAsset.scroll : false
  };

  if (params.start !== undefined) {
    if (typeof params.start !== 'number' || params.start < 0) {
      addParseError(lineNumber, line, 'The video start= value must be a number from 0', true);
      return;
    }
    action.start = params.start;
  }

  if (params.stop !== undefined) {
    if (typeof params.stop !== 'number' || params.stop <= 0) {
      addParseError(lineNumber, line, 'The video stop= value must be a positive number', true);
      return;
    }
    action.stop = params.stop;
  }

  if (action.stop !== undefined && action.stop <= (action.start || 0)) {
    addParseError(lineNumber, line, 'The video stop= value must be greater than start=', true);
    return;
  }

  if (params.skippable !== undefined) {
    if (typeof params.skippable !== 'boolean') {
      addParseError(lineNumber, line, 'The video skippable= value must be true or false', true);
      return;
    }
    action.skippable = params.skippable;
  }

  if (params.skipText !== undefined) {
    action.skipText = String(params.skipText);
  }

  if (params.fit !== undefined) {
    var fit = String(params.fit || '').toLowerCase();
    if (fit !== 'cover' && fit !== 'contain') {
      addParseError(lineNumber, line, 'The video fit= value must be cover or contain', true);
      return;
    }
    action.fit = fit;
  }

  if (params.fallbackDuration !== undefined) {
    if (typeof params.fallbackDuration !== 'number' || params.fallbackDuration <= 0) {
      addParseError(lineNumber, line, 'The video fallbackDuration= value must be a positive number', true);
      return;
    }
    action.fallbackDuration = params.fallbackDuration;
  }

  if (params.volume !== undefined) {
    if (typeof params.volume !== 'number' || params.volume < 0 || params.volume > 1) {
      addParseError(lineNumber, line, 'The video volume= value must be a number from 0 to 1', true);
      return;
    }
    action.volume = params.volume;
  }

  if (params.scroll !== undefined) {
    var parsedScroll = parseBackgroundScrollOption(params.scroll, lineNumber, line);
    if (parsedScroll === null) return;
    action.scroll = parsedScroll.enabled ? parsedScroll : false;
  }

  currentScene.actions.push(action);
}




  // Парсинг метаданных
  function parseMetaLine(line, story) {
    var originalLine = line;

    // Удаляем комментарий после #
    line = line.split('#')[0].trim();
    if (!line) return;

    // Поддерживаем и key: value, и key=value
    var separatorIndex = line.indexOf(':');
    var eqIndex = line.indexOf('=');

    if (separatorIndex === -1 || (eqIndex !== -1 && eqIndex < separatorIndex)) {
      separatorIndex = eqIndex;
    }

    if (separatorIndex === -1) return;

    var key = line.slice(0, separatorIndex).trim();
    var value = line.slice(separatorIndex + 1).trim();

    if (!key) return;

    // Базовые служебные параметры истории
    if (key === 'title') {
      story.meta.title = value;
      return;
    }

    if (key === 'startScene') {
      story.meta.start = value;

      if (!value || value.trim() === '') {
        addParseError(0, originalLine, "startScene cannot be empty", true);
      }

      return;
    }

    if (key === 'lang') {
      var lang = (value || 'en').trim().toLowerCase();
      if (!lang) lang = 'en';

      story.meta.lang = lang;
      window.STORY_LANG = lang;
      return;
    }

    // Универсальная обработка параметров интерфейса по конфигу
    if (UI_META_CONFIG[key]) {
      var config = UI_META_CONFIG[key];
      var parsedValue = parseMetaValueByType(value, config.type);

      // null означает, что число не удалось распарсить
      if (parsedValue !== null) {
        story.meta[config.target] = parsedValue;
      }
    }
  }








 

 







  function parseNewStyleAssetLine(lineNumber, line, category, story) {
    var cleanLine = stripAssetInlineComment(line);
    if (!cleanLine) return false;

    // Новый формат: id arg=value arg=value
    // Должен быть хотя бы один пробел после id и хотя бы один arg=value
    var m = cleanLine.match(/^([^\s=]+)\s+(.+)$/);
    if (!m) return false;

    var assetId = m[1].trim();
    var rest = m[2].trim();

    // Если справа нет key=value, это не новый формат
    if (rest.indexOf('=') === -1) return false;

    // Если справа просто путь без key=value, это старый формат вида key = value
    // Например: campusHall = assets/...
    if (!/\b[a-zA-Z_][a-zA-Z0-9_-]*\s*=/.test(rest)) return false;

    var args = {};
    var re = /([a-zA-Z_][a-zA-Z0-9_-]*)\s*=\s*("([^"]*)"|[^\s]+)/g;
    var match;

    while ((match = re.exec(rest)) !== null) {
      var key = match[1].toLowerCase();
      var value = match[3] !== undefined ? match[3] : match[2];

      if (key === 'image' || key === 'src') key = 'file';
      if (key === 'emo') key = 'emotion';
      if (key === 'coverimage' || key === 'thumbnail' || key === 'logo') key = 'cover';
      if (key === 'fallbackimage') key = 'fallback';

      args[key] = value;
    }

    if ((category === 'backgrounds' || category === 'videos') && args.scroll === undefined && hasBareToken(rest, 'scroll')) {
      args.scroll = 'true';
    }

    if (Object.keys(args).length === 0) return false;

    
    
    if (category === 'backgrounds' || category === 'audio') {
      if (!args.file) {
        addParseError(lineNumber, line, `The "${assetId}" entry must contain file=...`, true);
        return true;
      }

      if (category === 'backgrounds') {
        // Для фонов поддерживаем расширенный объект:
        // file=..., fallback=..., volume=..., scroll=...
        // volume — доля от master (0..1), по умолчанию в движке для видео = 0.
        var bgEntry = {
          file: args.file
        };

        if (args.fallback || args.poster) {
          bgEntry.fallback = args.fallback || args.poster;
        }

        if (args.volume !== undefined) {
          var parsedVolume = parseFloat(String(args.volume));
          if (!isFinite(parsedVolume)) {
            addParseError(lineNumber, line, `Invalid background volume "${args.volume}". Use a number from 0 to 1.`, true);
            return true;
          }
          if (parsedVolume < 0 || parsedVolume > 1) {
            addParseError(lineNumber, line, `Background volume "${args.volume}" is out of range. Use 0..1.`, true);
            return true;
          }
          bgEntry.volume = parsedVolume;
        }

        if (args.scroll !== undefined) {
          var parsedScroll = parseBackgroundScrollOption(args.scroll, lineNumber, line);
          if (parsedScroll === null) return true;
          bgEntry.scroll = parsedScroll.enabled ? parsedScroll : false;
        }

        // Для простых строк без fallback/volume сохраняем старый формат (string),
        // чтобы не ломать обратную совместимость.
        if (bgEntry.fallback === undefined && bgEntry.volume === undefined && bgEntry.scroll === undefined) {
          story.assets.backgrounds[assetId] = args.file;
        } else {
          story.assets.backgrounds[assetId] = bgEntry;
        }
      } else {
        story.assets[category][assetId] = args.file;
      }
      return true;
    }

    if (category === 'games') {
      if (!args.file) {
        addParseError(lineNumber, line, `The "${assetId}" entry must contain file=...`, true);
        return true;
      }

      var game = story.assets.games[assetId];
      if (!game || typeof game !== 'object') {
        game = {};
      }

      game.file = args.file;

      if (args.title !== undefined) game.title = args.title;
      if (args.description !== undefined) game.description = args.description;
      if (args.cover !== undefined) game.cover = args.cover;

      story.assets.games[assetId] = game;
      return true;
    }

    if (category === 'videos') {
      if (!args.file) {
        addParseError(lineNumber, line, `The "${assetId}" entry must contain file=...`, true);
        return true;
      }

      var video = story.assets.videos[assetId];
      if (!video || typeof video !== 'object') {
        video = {};
      }

      video.file = args.file;

      if (args.poster !== undefined) video.poster = args.poster;
      if (args.fallback !== undefined && video.poster === undefined) video.poster = args.fallback;

      if (args.volume !== undefined) {
        var parsedVideoVolume = parseFloat(String(args.volume));
        if (!isFinite(parsedVideoVolume)) {
          addParseError(lineNumber, line, `Invalid video volume "${args.volume}". Use a number from 0 to 1.`, true);
          return true;
        }
        if (parsedVideoVolume < 0 || parsedVideoVolume > 1) {
          addParseError(lineNumber, line, `Video volume "${args.volume}" is out of range. Use 0..1.`, true);
          return true;
        }
        video.volume = parsedVideoVolume;
      }

      if (args.scroll !== undefined) {
        var parsedVideoScroll = parseBackgroundScrollOption(args.scroll, lineNumber, line);
        if (parsedVideoScroll === null) return true;
        video.scroll = parsedVideoScroll.enabled ? parsedVideoScroll : false;
      }

      story.assets.videos[assetId] = video;
      return true;
    }





    if (category === 'characters') {
      if (!story.assets.characters[assetId]) {
        story.assets.characters[assetId] = { images: {} };
      }

      var char = story.assets.characters[assetId];
      if (!char.images) char.images = {};

      if (args.name !== undefined) char.name = args.name;
      if (args.color !== undefined) char.color = args.color;

      if (args.file !== undefined) {
        var emotion = args.emotion || 'neutral';
        char.images[emotion] = args.file;
      }

      return true;
    }

    return false;
  }



  // Парсинг ресурсов (bg, char, audio)
  function parseAssetLine(lineNumber, line, category, story) {
    line = stripAssetInlineComment(line);
    if (!line) return;
    console.log('[Loader] parseAssetLine:', line, 'category:', category);
    
    // Сначала пробуем новый формат:
    // campusHall file=assets/...
    // anna emotion=smile file=... name="Анна"
    if (parseNewStyleAssetLine(lineNumber, line, category, story)) {
      console.log('[Loader] parsed by new-style asset parser:', line);
      return;
    }

    if (category === 'games') {
      addParseError(
        lineNumber,
        line,
        'In [game], use only the new format: gameId file=... title="..." description="..." cover=...',
        true
      );
      return;
    }

    if (category === 'videos') {
      addParseError(
        lineNumber,
        line,
        'In [video], use only the new format: videoId file=... poster=... volume=... scroll=...',
        true
      );
      return;
    }

    console.log('[Loader] after comment removal:', line);
    
    if (!line) return;
    
    // Более гибкое регулярное выражение - допускает пробелы вокруг =
    const match = line.match(/^(.+?)\s*=\s*(.+)$/);
    console.log('[Loader] match:', match);
    
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      console.log('[Loader] key:', key, 'value:', value);
      





    // ========== запрещаем пробелы в ключах для bg / audio / games / video ==========
    if (category === 'backgrounds' || category === 'audio' || category === 'games' || category === 'videos') {
      // Проверяем, есть ли пробелы в ключе
      if (key.includes(' ')) {
        addParseError(
          lineNumber, 
          line, 
          `The key name "${key}" contains spaces. In the section [${category === 'backgrounds' ? 'bg' : category === 'audio' ? 'audio' : category === 'videos' ? 'video' : 'game'}] names cannot contain spaces. Use camelCase (bgDay) or hyphens (bg-day).`,
          true
        );
        return; // Прерываем обработку этой строки
      }
      
      // Дополнительная проверка на пустой ключ
      if (key.length === 0) {
        addParseError(
          lineNumber, 
          line, 
          `An empty key name in the section [${category === 'backgrounds' ? 'bg' : category === 'audio' ? 'audio' : 'game'}]`, 
          true
        );
        return;
      }
    }
    // ====================








      // Убираем кавычки из значений, если они есть
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
        console.log('[Loader] after quote removal:', value);
      }
      
      if (category === 'characters') {
        console.log('[Loader CHAR] processing character line:', line);
        // Формат: "имя тип = значение" (anna image neutral, anna name, anna color)
        const keyParts = key.split(' ');
        console.log('[Loader CHAR] keyParts:', keyParts);
        
        if (keyParts.length >= 2) {
            const charId = keyParts[0]; // anna, igor
            let propType = keyParts[1]; // image, name, color
            
            if (propType === 'file' || propType === 'src') {
              propType = 'image';
            }

            if (propType === 'emo') {
              propType = 'emotion';
            }


            
            console.log('[Loader CHAR] charId:', charId, 'propType:', propType);
            
            if (!story.assets.characters[charId]) {
                story.assets.characters[charId] = {};
                console.log('[Loader CHAR] Created new character object for:', charId);
            }
            
            if (propType === 'image') {
                // Для image нужна эмоция (третий параметр)
                const emotion = keyParts[2] || 'neutral';
                if (!story.assets.characters[charId].images) {
                    story.assets.characters[charId].images = {};
                }
                story.assets.characters[charId].images[emotion] = value;
                console.log(`[Loader CHAR] Added image for ${charId} (${emotion}): ${value}`);
                console.log('[Loader CHAR] Current character data:', story.assets.characters[charId]);
            } else if (propType === 'name') {
                story.assets.characters[charId].name = value;
                console.log(`[Loader CHAR] Added name for ${charId}: ${value}`);
            } else if (propType === 'color') {
                story.assets.characters[charId].color = value;
                console.log(`[Loader CHAR] Added color for ${charId}: ${value}`);
            }
        } else {
            console.warn(`[Loader CHAR] Invalid character format: ${key}`);
        }
      } else {
        // Для bg и audio оставляем как есть
        story.assets[category][key] = value;
        console.log(`[Loader] Добавлен ${category}: ${key} = ${value}`);
        
        // ========== ДОБАВЬТЕ ЭТОТ КОД ==========
        console.log(`[Loader] Текущее состояние ${category}:`, story.assets[category]);
        // =======================================
      }
    }
  }

  function getTopBlock(parseState) {
    if (!parseState || !parseState.blockStack || parseState.blockStack.length === 0) return null;
    return parseState.blockStack[parseState.blockStack.length - 1];
  }

  function getCurrentBlockActions(parseState) {
    var block = getTopBlock(parseState);
    if (!block) return null;
    if (block.type === 'if') {
      if (block.inElse) return block.ifAction.elseActions;
      return block.currentBranch.actions;
    }
    if (block.type === 'menu') {
      if (block.currentChoice) return block.currentChoice.actions;
      return null;
    }
    return null;
  }

  function getSceneTargetActions(currentScene, parseState) {
    var nestedActions = getCurrentBlockActions(parseState);
    if (nestedActions) return nestedActions;
    if (getTopBlock(parseState) && getTopBlock(parseState).type === 'menu') {
      // внутри меню без открытого choice-блока обычные команды запрещены
      return null;
    }
    return currentScene.actions;
  }

  function findOpenMenuBlock(parseState) {
    if (!parseState || !parseState.blockStack) return null;
    for (var i = parseState.blockStack.length - 1; i >= 0; i--) {
      var b = parseState.blockStack[i];
      if (b && b.type === 'menu') return b;
    }
    return null;
  }

  // Старый формат меню (без "choice") не имеет "end" и должен
  // автоматически закрываться при первой не-choice команде.
  function autoCloseOldStyleMenu(parseState) {
    if (!parseState || !parseState.blockStack) return;
    var top = parseState.blockStack[parseState.blockStack.length - 1];
    while (top && top.type === 'menu' && top.menuAction && !top.menuAction.hasChoiceKw) {
      parseState.blockStack.pop();
      top = parseState.blockStack.length > 0
        ? parseState.blockStack[parseState.blockStack.length - 1]
        : null;
    }
  }

  // Разбирает флаги после команды menu и возвращает настройки конкретного меню.
  // По умолчанию меню нумеруется; compact/fit используют плотные режимы и всегда скрывают номера.
  function parseMenuOptions(optionText, lineNumber, line) {
    var options = {
      showNumbers: true,
      compact: false,
      fit: false,
      title: '',
      titleSet: false
    };

    if (!optionText) return options;

    var cursor = 0;
    while (cursor < optionText.length) {
      while (cursor < optionText.length && /\s/.test(optionText.charAt(cursor))) {
        cursor++;
      }
      if (cursor >= optionText.length) break;

      if (optionText.substring(cursor, cursor + 6) === 'title=') {
        if (options.titleSet) {
          addParseError(lineNumber, line, 'Duplicate menu option "title".', true);
          return null;
        }

        cursor += 6;
        if (optionText.charAt(cursor) !== '"') {
          addParseError(lineNumber, line, 'Invalid menu title syntax. Use: title="text".', true);
          return null;
        }

        cursor++;
        var titleValue = '';
        var escapedTitleChar = false;
        var titleClosed = false;
        while (cursor < optionText.length) {
          var titleChar = optionText.charAt(cursor);
          if (escapedTitleChar) {
            titleValue += titleChar;
            escapedTitleChar = false;
            cursor++;
            continue;
          }
          if (titleChar === '\\') {
            escapedTitleChar = true;
            cursor++;
            continue;
          }
          if (titleChar === '"') {
            titleClosed = true;
            cursor++;
            break;
          }
          titleValue += titleChar;
          cursor++;
        }

        if (!titleClosed || escapedTitleChar) {
          addParseError(lineNumber, line, 'Unclosed menu title. Use: title="text".', true);
          return null;
        }

        if (cursor < optionText.length && !/\s/.test(optionText.charAt(cursor))) {
          addParseError(lineNumber, line, 'Invalid menu title syntax. Add a space after title="...".', true);
          return null;
        }

        options.title = titleValue;
        options.titleSet = true;
        continue;
      }

      var optionStart = cursor;
      while (cursor < optionText.length && !/\s/.test(optionText.charAt(cursor))) {
        cursor++;
      }

      var option = optionText.substring(optionStart, cursor);
      if (option === 'numbered' || option.indexOf('numbered=') === 0) {
        // numbered без значения считается включением; numbered=false явно скрывает номера.
        var numberedValue = option === 'numbered'
          ? 'true'
          : option.substring('numbered='.length).toLowerCase();
        if (numberedValue === 'true') {
          options.showNumbers = true;
          continue;
        }
        if (numberedValue === 'false') {
          options.showNumbers = false;
          continue;
        }
        addParseError(lineNumber, line, 'Invalid menu numbered value "' + numberedValue + '". Use numbered, numbered=true or numbered=false.', true);
        return null;
      }

      if (option === 'plain') {
        options.showNumbers = false;
        continue;
      }

      if (option === 'compact') {
        options.compact = true;
        continue;
      }

      if (option === 'fit') {
        options.fit = true;
        continue;
      }

      addParseError(
        lineNumber,
        line,
        'Unknown menu option "' + option + '". Available options: numbered, numbered=true, numbered=false, plain, compact, fit, title="...".',
        true
      );
      return null;
    }

    if (options.compact || options.fit) {
      // Плотные раскладки всегда скрывают номера, даже если вместе с ними указан numbered.
      options.showNumbers = false;
    }

    return options;
  }

  // Парсинг сцен
  function parseSceneLine(line, story, currentScene, setCurrentScene, lineNumber, parseState) {
    // Удаляем комментарии, но сохраняем оригинал для вывода ошибок
    const cleanLine = stripInlineComment(line);
    if (!cleanLine) return; // если строка была только комментарием
    
    // Используем cleanLine для парсинга, но line для вывода ошибок

    // Логируем ВСЕ строки
    console.log(`[PARSER LINE ${lineNumber}] Clean:`, JSON.stringify(cleanLine));

    // Новая сцена
    if (cleanLine.startsWith('scene ')) {
      if (parseState && parseState.blockStack && parseState.blockStack.length > 0) {
        // Автозакрытие старого меню (без ключевого слова choice) при начале новой сцены
        var topBlk = parseState.blockStack[parseState.blockStack.length - 1];
        while (topBlk && topBlk.type === 'menu' && topBlk.menuAction && !topBlk.menuAction.hasChoiceKw) {
          parseState.blockStack.pop();
          topBlk = parseState.blockStack.length > 0 ? parseState.blockStack[parseState.blockStack.length - 1] : null;
        }

        if (parseState.blockStack.length > 0) {
          var stillOpen = parseState.blockStack[parseState.blockStack.length - 1];
          var openKind = stillOpen && stillOpen.type === 'menu' ? 'menu' : 'if';
          var openMsg = openKind === 'menu'
            ? 'Unclosed menu block before new scene. Add "end".'
            : 'Unclosed conditional block before new scene. Add "end".';
          addParseError(lineNumber, line, openMsg, true);
          return;
        }
      }

      // Сохраняем предыдущую сцену
      if (currentScene) {
        story.scenes.push(currentScene);
      }
      
      const sceneId = cleanLine.substring(6).trim();
      if (!sceneId) {
        addParseError(lineNumber, line, "The scene ID cannot be empty", true);
      }

      // ========== ПРОВЕРКА: запрещаем пробелы в ID сцен ==========
      if (sceneId.includes(' ')) {
        addParseError(
          lineNumber, 
          line, 
          `The ID of scene "${sceneId}" contains spaces. Scene IDs cannot contain spaces. Use camelCase (intro_01, scene02) or hyphens (intro-01).`, 
          true
        );
        // Всё равно создаём сцену с очищенным ID, но с ошибкой
        sceneId = sceneId.replace(/\s+/g, '_'); // заменяем пробелы на подчёркивания
      }
      // ====================


      currentScene = {
        id: sceneId || "unknown_" + lineNumber,
        actions: []
      };
      setCurrentScene(currentScene);
      return;
    }
    
    if (!currentScene) {
      console.warn(`[Loader] Строка вне сцены: ${cleanLine}`);
      return;
    }
    
    if (cleanLine === 'end') {
      var topEnd = getTopBlock(parseState);
      if (!topEnd) {
        addParseError(lineNumber, line, 'Unexpected "end" without opened block', true);
        return;
      }

      if (topEnd.type === 'menu') {
        if (!topEnd.menuAction || !topEnd.menuAction.hasChoiceKw) {
          addParseError(lineNumber, line, '"end" is not used for old-style menu (with "->"). Add "end" only when menu items use "choice".', true);
          return;
        }
      }

      parseState.blockStack.pop();
      return;
    }

    if (cleanLine.startsWith('elif ')) {
      var elifTop = getTopBlock(parseState);
      if (!elifTop || elifTop.type !== 'if') {
        addParseError(lineNumber, line, 'Unexpected "elif" without opened if-block', true);
        return;
      }

      var elifCondition = cleanLine.substring(5).trim();
      if (!elifCondition) {
        addParseError(lineNumber, line, 'The condition in "elif" cannot be empty', true);
        return;
      }

      if (elifCondition.indexOf('->') !== -1) {
        addParseError(lineNumber, line, '"elif" supports block syntax only. Use: elif condition', true);
        return;
      }

      if (elifTop.inElse) {
        addParseError(lineNumber, line, '"elif" cannot be used after "else"', true);
        return;
      }

      var elifBranch = {
        condition: elifCondition,
        actions: []
      };
      elifTop.ifAction.branches.push(elifBranch);
      elifTop.currentBranch = elifBranch;
      elifTop.inElse = false;
      return;
    }

    if (cleanLine === 'else') {
      var elseTop = getTopBlock(parseState);
      if (!elseTop || elseTop.type !== 'if') {
        addParseError(lineNumber, line, 'Unexpected "else" without opened if-block', true);
        return;
      }

      if (elseTop.inElse) {
        addParseError(lineNumber, line, 'Duplicate "else" in the same if-block', true);
        return;
      }

      elseTop.ifAction.elseActions = [];
      elseTop.inElse = true;
      return;
    }

    // menu [опции]: открывает блок меню и применяет известные флаги оформления.
    var menuMatch = cleanLine.match(/^menu(?:\s+(.+))?$/);
    if (menuMatch) {
      var menuOptions = parseMenuOptions(menuMatch[1] ? menuMatch[1].trim() : '', lineNumber, line);
      if (!menuOptions) return;

      // Если на вершине старое меню (без "choice") — автозакрываем
      autoCloseOldStyleMenu(parseState);

      var menuAction = {
        type: 'choice',
        choices: [],
        hasChoiceKw: false,
        showNumbers: menuOptions.showNumbers,
        compact: menuOptions.compact,
        fit: menuOptions.fit
      };
      if (menuOptions.titleSet) {
        menuAction.title = menuOptions.title;
      }

      var enclosingActions = getSceneTargetActions(currentScene, parseState);
      if (enclosingActions === null) {
        addParseError(lineNumber, line, 'Nested "menu" must be inside an opened "choice" block', true);
        return;
      }
      enclosingActions.push(menuAction);

      parseState.blockStack.push({
        type: 'menu',
        menuAction: menuAction,
        currentChoice: null,
        lineNumber: lineNumber
      });
      return;
    }

    // choice "Текст" или choice "Текст" -> scene
    if (cleanLine.startsWith('choice ') || cleanLine === 'choice') {
      var menuBlock = getTopBlock(parseState);
      if (!menuBlock || menuBlock.type !== 'menu') {
        addParseError(lineNumber, line, '"choice" can be used only inside "menu" block', true);
        return;
      }

      // Проверка смешения форматов: до этого уже были старые пункты "..." -> sc
      if (!menuBlock.menuAction.hasChoiceKw && menuBlock.menuAction.choices.length > 0) {
        addParseError(
          lineNumber,
          line,
          'Mixed menu formats: cannot mix "..." -> scene with "choice".',
          true
        );
        return;
      }

      var choiceBody = cleanLine.substring(6).trim();
      var choiceMatchKw = choiceBody.match(/^"([^"]+)"\s*(?:->\s*(.+))?$/);
      if (!choiceMatchKw) {
        addParseError(lineNumber, line, 'Invalid "choice" syntax. Use: choice "text" or choice "text" -> sceneId', true);
        return;
      }

      var choiceText = choiceMatchKw[1].trim();
      var choiceTarget = choiceMatchKw[2] ? choiceMatchKw[2].trim() : '';

      if (!choiceText) {
        addParseError(lineNumber, line, 'Empty text in "choice"', true);
        return;
      }

      if (choiceTarget && choiceTarget.includes(' ')) {
        addParseError(lineNumber, line, `The target scene "${choiceTarget}" in the choice contains spaces. Scene IDs cannot contain spaces.`, true);
        return;
      }

      menuBlock.menuAction.hasChoiceKw = true;

      var newChoice = {
        text: choiceText,
        actions: []
      };

      if (choiceTarget) {
        newChoice.actions.push({
          type: 'goto',
          target: choiceTarget
        });
      }

      menuBlock.menuAction.choices.push(newChoice);
      menuBlock.currentChoice = newChoice;
      return;
    }

    // Выбор: "Текст" -> сцена (старый формат)
    // Обрабатывается ДО проверки actions===null, потому что не использует общий actions
    // (пишет напрямую в menuAction.choices)
    const oldChoiceMatch = cleanLine.match(/^"(.+)"\s*->\s*(.+)$/);
    if (oldChoiceMatch) {
      console.log(`[PARSER LINE ${lineNumber}] MATCH: choice (old)`);
      const choiceText = oldChoiceMatch[1].trim();
      const choiceTarget = oldChoiceMatch[2].trim();

      if (!choiceText) {
        addParseError(lineNumber, line, "Empty text in menu item", true);
      }
      if (!choiceTarget) {
        addParseError(lineNumber, line, "No target scene specified in menu item", true);
      }

      if (choiceTarget.includes(' ')) {
        addParseError(
          lineNumber,
          line,
          `The target scene "${choiceTarget}" in the menu item contains spaces. Scene IDs cannot contain spaces.`,
          true
        );
        return;
      }

      var openMenuOld = findOpenMenuBlock(parseState);
      if (openMenuOld && openMenuOld.menuAction.hasChoiceKw) {
        addParseError(
          lineNumber,
          line,
          'Mixed menu formats: if you use "choice", all items must use "choice".',
          true
        );
        return;
      }

      var targetMenuActionOld = openMenuOld ? openMenuOld.menuAction : null;

      if (!targetMenuActionOld) {
        // Нет открытого menu блока — старая логика fallback:
        // ищем последний choice action в actions сцены / текущей if-ветки
        const fallbackActions = getSceneTargetActions(currentScene, parseState);
        if (fallbackActions === null) {
          // Этого не должно случиться: openMenuOld бы уже нашёлся
          addParseError(lineNumber, line, 'Commands inside "menu" must be placed inside a "choice" block', true);
          return;
        }
        for (let i = fallbackActions.length - 1; i >= 0; i--) {
          if (fallbackActions[i].type === 'choice') {
            targetMenuActionOld = fallbackActions[i];
            break;
          }
        }
        if (!targetMenuActionOld) {
          targetMenuActionOld = {
            type: 'choice',
            choices: [],
            hasChoiceKw: false
          };
          fallbackActions.push(targetMenuActionOld);
        }
      }

      targetMenuActionOld.choices.push({
        text: choiceText || "Выбор",
        goto: choiceTarget || "unknown"
      });
      return;
    }

    // Любая другая команда (show, set, goto, bg, if и т.д.) автозакрывает
    // открытое старое меню (без "choice"). Старый формат не имеет "end".
    autoCloseOldStyleMenu(parseState);

    const actions = getSceneTargetActions(currentScene, parseState);

    if (actions === null) {
      addParseError(lineNumber, line, 'Commands inside "menu" must be placed inside a "choice" block', true);
      return;
    }
    
    // bg [имя]
    if (cleanLine.startsWith('bg ')) {
      const bgTokens = cleanLine.substring(3).trim().split(/\s+/);
      const bgName = bgTokens[0] || "";
      if (!bgName) {
        addParseError(lineNumber, line, "No background name specified after ‘bg’", true);
      }
      const bgAction = {
        type: 'bg',
        src: `@bg.${bgName || "unknown"}`
      };

      const bgParams = parseActionParams(bgTokens.slice(1));
      if (bgParams.scroll === undefined && bgTokens.slice(1).some(function(token) {
        return String(token || "").toLowerCase() === "scroll";
      })) {
        bgParams.scroll = true;
      }
      if (bgParams.scroll !== undefined) {
        const parsedScroll = parseBackgroundScrollOption(bgParams.scroll, lineNumber, line);
        if (parsedScroll === null) return;
        bgAction.scroll = parsedScroll.enabled ? parsedScroll : false;
      }

      actions.push(bgAction);
      return;
    }
    
    // bgm [имя] [loop|loop=true|loop=false]
    // Примеры:
    //   bgm bgmDay
    //   bgm bgmDay loop
    //   bgm bgmDay loop=false
    //   bgm stop
    if (cleanLine.startsWith('bgm ')) {
      const bgmArgs = cleanLine.substring(4).trim().split(/\s+/);
      const bgmName = bgmArgs[0];

      if (!bgmName) {
        addParseError(lineNumber, line, "No music name specified after bgm", true);
      }

      if (bgmName === 'stop') {
        actions.push({
          type: 'bgm',
          src: null,
          loop: false
        });
        return;
      }

      const bgmParams = parseActionParams(bgmArgs.slice(1));
      if (bgmParams.loop === undefined && bgmArgs.slice(1).some(function(token) {
        return String(token || "").toLowerCase() === "loop";
      })) {
        bgmParams.loop = true;
      }

      // loop без значения считается включением, а loop=false явно отключает повтор музыки.
      let hasLoop = false;
      if (bgmParams.loop !== undefined) {
        if (typeof bgmParams.loop !== 'boolean') {
          addParseError(lineNumber, line, 'Invalid bgm loop value "' + bgmParams.loop + '". Use loop, loop=true or loop=false.', true);
          return;
        }
        hasLoop = bgmParams.loop;
      }

      actions.push({
        type: 'bgm',
        src: `@audio.${bgmName || "unknown"}`,
        loop: hasLoop,
        volume: 0.7,
        fadeMs: 400
      });
      return;
    }
    
    // show [имя] [эмоция]
    if (cleanLine.startsWith('show ')) {
      const parts = cleanLine.substring(5).trim().split(' ');
      const charId = parts[0]; // anna, igor

      if (!charId) {
        addParseError(lineNumber, line, "No character name specified after 'show'", true);
      }
      
      const emotion = parts[1] || 'neutral'; // neutral, smile и т.д.
      
      // Проверяем, существует ли персонаж в ассетах
      if (charId && story.assets && story.assets.characters && !story.assets.characters[charId]) {
        addParseError(lineNumber, line, `The character "${charId}" is not defined in the [char] section`, true);
      }

      actions.push({
        type: 'char',
        charId: charId || "unknown",
        emotion: emotion,
        src: null, // будет заполнено в executeAction через resolveAsset
        pos: 'center'
      });
      return;
    }
    
    // hide all
    if (cleanLine === 'hide all') {
      console.log('[PARSER] НАЙДЕНА КОМАНДА hide all на строке', lineNumber);
      console.log('[PARSER] Текущая сцена:', currentScene?.id);
      actions.push({
        type: 'char',
        charId: null,  // Явно указываем null
        src: null,
        emotion: null,
        pos: null
      });
  
      console.log('[PARSER] hide all action добавлен. Теперь в сцене', 
        currentScene.id, 'actions:', actions.map(a => a.type).join(', '));
      return;
    }
    
    // calc varName = expression
    if (cleanLine.startsWith('set ')) {
      const expression = cleanLine.substring(4).trim();

      if (!expression || expression.indexOf('=') === -1) {
        addParseError(lineNumber, line, 'Invalid set syntax. Use: set x = 1 + 2', true);
        return;
      }

      actions.push({
        type: 'set',
        expression: expression
      });
      return;
    }

    if (cleanLine.startsWith('game ')) {
      if (!currentScene) {
        addParseError(lineNumber, line, 'The game command is used outside of a scene', true);
        return;
      }

      var targetSceneForGame = (actions === currentScene.actions)
        ? currentScene
        : { actions: actions };

      parseGameAction(lineNumber, line, cleanLine, story, targetSceneForGame);
      return;
    }

    if (cleanLine.startsWith('video ')) {
      if (!currentScene) {
        addParseError(lineNumber, line, 'The video command is used outside of a scene', true);
        return;
      }

      var targetSceneForVideo = (actions === currentScene.actions)
        ? currentScene
        : { actions: actions };

      parseVideoAction(lineNumber, line, cleanLine, story, targetSceneForVideo);
      return;
    }

    // if expression -> sceneId (совместимость)
    // if expression / elif expression / else / end (новый блочный синтаксис)
    if (cleanLine.startsWith('if ')) {
      const ifBody = cleanLine.substring(3).trim();
      const parts = ifBody.split('->');

      if (parts.length === 1) {
        const condition = ifBody.trim();
        if (!condition) {
          addParseError(lineNumber, line, 'The condition in the if statement cannot be empty', true);
          return;
        }

        const ifAction = {
          type: 'if_block',
          branches: [
            {
              condition: condition,
              actions: []
            }
          ],
          elseActions: null
        };

        actions.push(ifAction);

        if (parseState && parseState.blockStack) {
          parseState.blockStack.push({
            type: 'if',
            ifAction: ifAction,
            currentBranch: ifAction.branches[0],
            inElse: false,
            lineNumber: lineNumber
          });
        }
        return;
      }

      if (parts.length !== 2) {
        addParseError(lineNumber, line, 'Invalid if syntax. Use: if x > 0 -> nextScene or if x > 0 ... end', true);
        return;
      }

      const condition = parts[0].trim();
      const target = parts[1].trim();

      if (!condition) {
        addParseError(lineNumber, line, 'The condition in the if statement cannot be empty', true);
        return;
      }

      if (!target) {
        addParseError(lineNumber, line, 'The target scene in the if statement cannot be empty', true);
        return;
      }

      if (target.includes(' ')) {
        addParseError(lineNumber, line, `The target scene "${target}" contains spaces. Scene IDs cannot contain spaces.`, true);
        return;
      }

      actions.push({
        type: 'if_expr',
        condition: condition,
        target: target
      });
      return;
    }

    // goto [сцена]
    if (cleanLine.startsWith('goto ')) {
      const target = cleanLine.substring(5).trim();
      if (!target) {
        addParseError(lineNumber, line, "No target scene specified after goto", true);
      }

      // ========== НОВАЯ ПРОВЕРКА ==========
      if (target.includes(' ')) {
        addParseError(
          lineNumber, 
          line, 
          `The target scene "${target}" contains spaces. Scene IDs cannot contain spaces.`, 
          true
        );
        return;
      }
      // ====================

      actions.push({
        type: 'goto',
        target: target || "unknown"
      });
      return;
    }
    
    // Диалог: переменная: "текст"
    const dialogMatch = cleanLine.match(/^([a-zA-Z0-9_]+):\s*"(.+)"$/);
    if (dialogMatch) {
      console.log(`[PARSER LINE ${lineNumber}] MATCH: dialog`);
      const charVar = dialogMatch[1].trim(); // anna, igor
      let text = dialogMatch[2].trim();
      
      // Проверяем, существует ли персонаж в ассетах
      if (charVar && story.assets && story.assets.characters && !story.assets.characters[charVar]) {
        addParseError(lineNumber, line, `The character "${charVar}" is not defined in the [char] section`, true);
      }

      // Экранируем спецсимволы в тексте
      text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      
      actions.push({
        type: 'say',
        charVar: charVar, // переменная персонажа
        text: text
      });
      return;
    }
    
    // Текст в кавычках (авторский)
    const textMatch = cleanLine.match(/^"(.+)"$/);
    if (textMatch) {
      console.log(`[PARSER LINE ${lineNumber}] MATCH: text`);
      let text = textMatch[1].trim();
      if (!text) {
        addParseError(lineNumber, line, "Empty text in quotes", true);
      }
      // Экранируем спецсимволы
      text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      
      actions.push({
        type: 'text',
        text: text || "..."
      });
      return;
    }
    
    // Если ничего не подошло и это не комментарий
    if (cleanLine && !cleanLine.startsWith('#')) {
      console.log(`[PARSER LINE ${lineNumber}] UNKNOWN FORMAT - добавляем ошибку`);
      addParseError(lineNumber, line, "Unrecognized string format", true);
      return false;
    }
  }

  // Проверка всех ссылок на сцены (goto и choice)
  function validateSceneReferences(story) {
    console.log('[Loader] Проверка ссылок на сцены...');
    
    // Собираем все существующие ID сцен
    const sceneIds = new Set();
    story.scenes.forEach(scene => {
      if (scene.id) {
        sceneIds.add(scene.id);
      } else {
        addParseError(0, "Scene without ID", "A scene without an identifier was detected", true);
      }
    });
    
    console.log('[Loader] Найдено сцен:', sceneIds.size);
    console.log('[Loader] ID сцен:', Array.from(sceneIds).join(', '));
    
    // Проверяем каждый переход
    let linkCount = 0;
    let errorCount = 0;
    
    function validateActionList(actionList, sceneId) {
      if (!Array.isArray(actionList)) return;

      actionList.forEach((action) => {
        // Проверка goto
        if (action.type === 'goto' && action.target) {
          linkCount++;
          if (!sceneIds.has(action.target)) {
            errorCount++;
            addParseError(
              0, 
              `Сцена ${sceneId}`, 
              `Navigating to a non-existent scene "${action.target}"`, true
            );
          }
        }
        
        // Проверка choice
        if (action.type === 'choice' && action.choices) {
          action.choices.forEach((choice) => {
            if (choice.goto) {
              linkCount++;
              if (!sceneIds.has(choice.goto)) {
                errorCount++;
                addParseError(
                  0,
                  `Scene ${sceneId}`,
                  `The menu item "${choice.text || 'no text'}" leads to the non-existent scene "${choice.goto}"`, true
                );
              }
            }
            if (Array.isArray(choice.actions)) {
              validateActionList(choice.actions, sceneId);
            }
          });
        }

        if (action.type === 'if_expr') {
          if (!sceneIds.has(action.target)) {
            addParseError(
              0,
              `scene ${sceneId}`,
              `The conditional transition leads to the non-existent scene "${action.target}"`
            );
          }
        }

        if (action.type === 'if_block') {
          if (Array.isArray(action.branches)) {
            action.branches.forEach(function(branch) {
              validateActionList(branch && branch.actions ? branch.actions : [], sceneId);
            });
          }
          validateActionList(action.elseActions || [], sceneId);
        }
      });
    }

    story.scenes.forEach(scene => {
      validateActionList(scene.actions || [], scene.id);
    });
    
    console.log('[Loader] Проверено ссылок:', linkCount);
    if (errorCount > 0) {
      console.warn('[Loader] Найдено ошибок в ссылках:', errorCount);
    } else {
      console.log('[Loader] Все ссылки на сцены корректны');
    }
    
    return { linkCount, errorCount };
  }

  // Создание заглушки при ошибке
  function createFallbackStory(errorMsg) {
    console.error('[Loader] Создаём fallback сценарий:', errorMsg);
    
    window.STORY = {
      meta: {
        title: "Loading error",
        start: "error_scene",
        lang: "en"
      },
      assets: {
        backgrounds: {},
        characters: {},
        audio: {},
        games: {},
        videos: {}
      },
      scenes: [{
        id: "error_scene",
        actions: [
          {
            type: "text",
            text: "Script loading error: " + errorMsg
          },
          {
            type: "text",
            text: "Check that the story.js file is included and contains window.STORY_TEXT"
          }
        ]
      }]
    };
    
    if (window.__onStoryLoaded) {
      window.__onStoryLoaded(window.STORY);
    }
  }


  function showParseError() {
    console.log('[Loader] Показываю ошибку парсинга');
    
    // Формируем текст ошибки
    let errorText = "❌ SCRIPT PARSE ERROR:\n\n";
    
    window.PARSE_ERRORS.forEach((error, index) => {
      errorText += `${index + 1}. Line ${error.lineNumber}: ${error.message}\n`;
      errorText += `   "${error.line}"\n\n`;
    });
    
    errorText += "\nPlease fix the errors in the story.js file";
    
    // Находим элементы интерфейса
    const dialog = document.getElementById('dialog');
    const nameBox = document.getElementById('nameBox');
    const textBox = document.getElementById('textBox');
    const choices = document.getElementById('choices');
    const topbar = document.querySelector('.topbar');
    
    if (dialog && textBox) {
      // Прячем всё лишнее
      if (nameBox) nameBox.classList.add('hidden');
      if (choices) choices.classList.add('hidden');
      if (topbar) topbar.style.opacity = '0.5';
      
      // Показываем ошибку
      dialog.classList.remove('hiddenByChoices', 'has-name', 'no-name');
      dialog.classList.add('no-hint');
      textBox.textContent = errorText;
      textBox.style.whiteSpace = 'pre-wrap';
      textBox.style.fontFamily = 'monospace';
      textBox.style.fontSize = '14px';
      textBox.style.color = '#ff6b6b';
      
      // Убираем подсказку
      const hint = document.querySelector('.hint');
      if (hint) hint.style.display = 'none';
    }
  }


})();
