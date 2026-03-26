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
    audioCount: 0
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
        games: {}
      },
      audioSettings: {
        masterVolume: 0.2,
        muted: true
      },
      vars: {},
      scenes: []
    };

    let currentScene = null;
    let currentSection = null; // 'meta', 'bg', 'char', 'audio', 'game', 'var', 'scene'
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
        case 'var':
          parseVarLine(lineNumber, line, story);
          break;
        case 'scene':
          parseSceneLine(line, story, currentScene, (scene) => { currentScene = scene; }, lineNumber);
          break;
        default:
          // Если секция не определена, но строка начинается с 'scene'
          if (line.startsWith('scene ')) {
            currentSection = 'scene';
            parseSceneLine(line, story, currentScene, (scene) => { currentScene = scene; }, lineNumber);
          }
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
    }

    loaderMark('stats_collected');
    console.log('[Loader] Статистика собрана:', {
      scenes: window.LOADER_STATS.scenesCount,
      actions: window.LOADER_STATS.actionsCount,
      backgrounds: window.LOADER_STATS.backgroundsCount,
      characters: window.LOADER_STATS.charactersCount,
      audio: window.LOADER_STATS.audioCount,
      games: window.LOADER_STATS.gamesCount
    });





    // Сохраняем JSON для отладки
    try {
      localStorage.setItem('story_debug', JSON.stringify(story, null, 2));
      console.log('[Loader] JSON сохранён в localStorage.story_debug');
    } catch (e) {}
    
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

function parseGameAction(lineNumber, line, cleanLine, story, currentScene) {
  var tokens = cleanLine.split(/\s+/);
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
    var cleanLine = line.trim();
    if (!cleanLine) return false;

    // убираем комментарий, но не трогаем color=#...
    if (cleanLine.includes('#') && !cleanLine.match(/=\s*#/)) {
      cleanLine = cleanLine.split('#')[0].trim();
    }

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
      if (key === 'coverimage' || key === 'thumbnail') key = 'cover';

      args[key] = value;
    }

    if (Object.keys(args).length === 0) return false;

    
    
    if (category === 'backgrounds' || category === 'audio') {
      if (!args.file) {
        addParseError(lineNumber, line, `The "${assetId}" entry must contain file=...`, true);
        return true;
      }

      story.assets[category][assetId] = args.file;
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

    // Удаляем комментарии
    // Удаляем комментарии, но сохраняем # если это цвет (после =)
    if (line.includes('#') && !line.match(/=\s*#/)) {
      line = line.split('#')[0].trim();
    } else if (line.includes('#') && line.match(/=\s*#/)) {
      // Это цвет - оставляем как есть
      console.log('[Loader] Обнаружен цвет:', line);
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
      





    // ========== запрещаем пробелы в ключах для bg / audio / games ==========
    if (category === 'backgrounds' || category === 'audio' || category === 'games') {
      // Проверяем, есть ли пробелы в ключе
      if (key.includes(' ')) {
        addParseError(
          lineNumber, 
          line, 
          `The key name "${key}" contains spaces. In the section [${category === 'backgrounds' ? 'bg' : category === 'audio' ? 'audio' : 'game'}] names cannot contain spaces. Use camelCase (bgDay) or hyphens (bg-day).`, 
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

  // Парсинг сцен
  function parseSceneLine(line, story, currentScene, setCurrentScene, lineNumber) {
    // Удаляем комментарии, но сохраняем оригинал для вывода ошибок
    const cleanLine = line.split('#')[0].trim();
    if (!cleanLine) return; // если строка была только комментарием
    
    // Используем cleanLine для парсинга, но line для вывода ошибок

    // Логируем ВСЕ строки
    console.log(`[PARSER LINE ${lineNumber}] Clean:`, JSON.stringify(cleanLine));

    // Новая сцена
    if (cleanLine.startsWith('scene ')) {
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
    
    const actions = currentScene.actions;
    
    // bg [имя]
    if (cleanLine.startsWith('bg ')) {
      const bgName = cleanLine.substring(3).trim();
      if (!bgName) {
        addParseError(lineNumber, line, "No background name specified after ‘bg’", true);
      }
      actions.push({
        type: 'bg',
        src: `@bg.${bgName || "unknown"}`
      });
      return;
    }
    
    // bgm [имя] [loop]
    // Примеры:
    //   bgm bgmDay
    //   bgm bgmDay loop
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

      const hasLoop = bgmArgs.includes('loop');

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
    
    // menu (игнорируем)
    if (cleanLine === 'menu') {
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

      parseGameAction(lineNumber, line, cleanLine, story, currentScene);
      return;
    }

    // if expression -> sceneId
    if (cleanLine.startsWith('if ')) {
      const ifBody = cleanLine.substring(3).trim();
      const parts = ifBody.split('->');

      if (parts.length !== 2) {
        addParseError(lineNumber, line, 'Invalid if syntax. Use: if x > 0 -> nextScene', true);
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
    
    // Выбор: Текст -> сцена
    const choiceMatch = cleanLine.match(/^"(.+)"\s*->\s*(.+)$/);
    if (choiceMatch) {
      console.log(`[PARSER LINE ${lineNumber}] MATCH: choice`);
      const text = choiceMatch[1].trim();
      const target = choiceMatch[2].trim();
      
      if (!text) {
        addParseError(lineNumber, line, "Empty text in menu item", true);
      }
      if (!target) {
        addParseError(lineNumber, line, "No target scene specified in menu item", true);
      }

      // ========== НОВАЯ ПРОВЕРКА ==========
      if (target.includes(' ')) {
        addParseError(
          lineNumber, 
          line, 
          `The target scene "${target}" in the menu item contains spaces. Scene IDs cannot contain spaces.`, 
          true
        );
        return;
      }
      // ====================

      // Ищем последний action типа choice
      let choiceAction = null;
      for (let i = actions.length - 1; i >= 0; i--) {
        if (actions[i].type === 'choice') {
          choiceAction = actions[i];
          break;
        }
      }
      
      // Если нет choice action, создаём новый
      if (!choiceAction) {
        choiceAction = {
          type: 'choice',
          choices: []
        };
        actions.push(choiceAction);
      }
      
      choiceAction.choices.push({
        text: text || "Выбор",
        goto: target || "unknown"
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
    
    story.scenes.forEach(scene => {
      scene.actions.forEach((action, actionIndex) => {
        // Проверка goto
        if (action.type === 'goto' && action.target) {
          linkCount++;
          if (!sceneIds.has(action.target)) {
            errorCount++;
            addParseError(
              0, 
              `Сцена ${scene.id}`, 
              `Navigating to a non-existent scene "${action.target}"`, true
            );
          }
        }
        
        // Проверка choice
        if (action.type === 'choice' && action.choices) {
          action.choices.forEach((choice, choiceIndex) => {
            if (choice.goto) {
              linkCount++;
              if (!sceneIds.has(choice.goto)) {
                errorCount++;
                addParseError(
                  0, 
                  `Scene ${scene.id}`, 
                  `The menu item "${choice.text || 'no text'}" leads to the non-existent scene "${choice.goto}"`, true
                );
              }
            }
          });
        }

        if (action.type === 'if_expr') {
          if (!sceneIds.has(action.target)) {
            addParseError(
              0,
              `scene ${scene.id}`,
              `The conditional transition leads to the non-existent scene "${action.target}"`
            );
          }
        }
      });
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
        games: {}
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