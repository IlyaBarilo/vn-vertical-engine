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
    loaderMark('Ошибка: нет STORY_TEXT');
    createFallbackStory('Не найден story-content.js');
    return;
  }

  // Парсим текст
  parseStory(window.STORY_TEXT);

  // ========================================
  // ПАРСЕР
  // ========================================

  function parseStory(text) {
    console.log('[Loader] Начинаем парсинг, длина:', text.length);
    console.log('[Loader] ПЕРВЫЕ 500 символов текста:');
    console.log(text.substring(0, 500));
    loaderMark('Начало парсинга');

    // Структура для результата
    const story = {
      meta: {
        title: "Без названия",
        start: null,
        blurBackground: true
      },
      assets: {
        backgrounds: {},
        characters: {},
        audio: {}
      },
      audioSettings: {
        masterVolume: 0.2,
        muted: true
      },
      scenes: []
    };

    let currentScene = null;
    let currentSection = null; // 'meta', 'bg', 'char', 'audio', 'scenes'
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
      if (line.startsWith('# МЕТАДАННЫЕ')) {
        currentSection = 'meta';
        continue;
      }
      
      if (line.startsWith('[bg]')) {
        currentSection = 'bg';
        continue;
      }
      
      if (line.startsWith('[char]')) {
        currentSection = 'char';
        continue;
      }
      
      if (line.startsWith('[audio]')) {
        currentSection = 'audio';
        continue;
      }
      
      if (line.startsWith('# СЦЕНЫ')) {
        currentSection = 'scenes';
        continue;
      }
      
      // Парсим в зависимости от секции
      switch (currentSection) {
        case 'meta':
          parseMetaLine(line, story);
          break;
        case 'bg':
          parseAssetLine(line, 'backgrounds', story);
          break;
        case 'char':
          console.log('[Loader CHAR] Processing line:', line);
          parseAssetLine(line, 'characters', story);
          break;
        case 'audio':
          parseAssetLine(line, 'audio', story);
          break;
        case 'scenes':
          parseSceneLine(line, story, currentScene, (scene) => { currentScene = scene; }, lineNumber);
          break;
        default:
          // Если секция не определена, но строка начинается с 'scene'
          if (line.startsWith('scene ')) {
            currentSection = 'scenes';
            parseSceneLine(line, story, currentScene, (scene) => { currentScene = scene; }, lineNumber);
          }
      }
    }
    
    // Добавляем последнюю сцену
    if (currentScene) {
      story.scenes.push(currentScene);
    }
    
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
          "Метаданные", 
          `Стартовая сцена "${story.meta.start}" не существует`
        );
        
        // Автоматически исправляем на первую сцену
        if (story.scenes.length > 0) {
          const oldStart = story.meta.start;
          story.meta.start = story.scenes[0].id;
          console.log(`[Loader] Стартовая сцена "${oldStart}" не найдена, исправлено на "${story.meta.start}"`);
        }
      } else {
        console.log('[Loader] Стартовая сцена существует:', story.meta.start);
      }
    } else {
      addParseError(0, "Метаданные", "Не задана стартовая сцена (startScene)");
      if (story.scenes.length > 0) {
        story.meta.start = story.scenes[0].id;
        console.log('[Loader] Установлена первая сцена как стартовая:', story.meta.start);
      }
    }






    // ===== ВАЖНО: проверяем ссылки на сцены =====
    validateSceneReferences(story);

    loaderMark('Парсинг завершен');
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
    }

    loaderMark('stats_collected');
    console.log('[Loader] Статистика собрана:', {
      scenes: window.LOADER_STATS.scenesCount,
      actions: window.LOADER_STATS.actionsCount,
      backgrounds: window.LOADER_STATS.backgroundsCount,
      characters: window.LOADER_STATS.charactersCount,
      audio: window.LOADER_STATS.audioCount
    });





    // Сохраняем JSON для отладки
    try {
      localStorage.setItem('story_debug', JSON.stringify(story, null, 2));
      console.log('[Loader] JSON сохранён в localStorage.story_debug');
    } catch (e) {}
    
    // Передаём в движок
    window.STORY = story;
    
    loaderMark('STORY передан в window');
    console.log('[Loader] ФИНАЛЬНЫЙ STORY.assets:', story.assets);
    console.log('[Loader] ФИНАЛЬНЫЙ backgrounds:', story.assets.backgrounds);
    console.log('[Loader] ФИНАЛЬНЫЙ audio:', story.assets.audio);

    // Уведомляем движок
    if (window.__onStoryLoaded) {
      console.log('[Loader] Уведомляем движок');
      window.__onStoryLoaded(story);
      loaderMark('Движок уведомлен');
    } else {
      console.log('[Loader] Движок ещё не загружен, он подхватит window.STORY позже');
      loaderMark('Ожидание движка');
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

  // Парсинг метаданных
  function parseMetaLine(line, story) {
    // Удаляем комментарий после #
    line = line.split('#')[0].trim();
    if (!line) return;

    if (!line.includes(':')) return;

    const parts = line.split(':');
    const key = parts[0].trim();
    let value = parts.slice(1).join(':').trim();

    // Базовые служебные параметры истории
    if (key === 'title') {
      story.meta.title = value;
      return;
    }

    if (key === 'startScene') {
      story.meta.start = value;

      // Проверяем, что startScene не пустой
      if (!value || value.trim() === '') {
        addParseError(lineNumber, line, "startScene не может быть пустым", true);
      }
      
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

  // Парсинг ресурсов (bg, char, audio)
  function parseAssetLine(line, category, story) {
    console.log('[Loader] parseAssetLine:', line, 'category:', category);
    
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
            const propType = keyParts[1]; // image, name, color
            
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
        addParseError(lineNumber, line, "ID сцены не может быть пустым", true);
      }
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
        addParseError(lineNumber, line, "Не указано имя фона после bg", true);
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
        addParseError(lineNumber, line, "Не указано имя музыки после bgm", true);
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
        addParseError(lineNumber, line, "Не указано имя персонажа после show", true);
      }
      
      const emotion = parts[1] || 'neutral'; // neutral, smile и т.д.
      
      // Проверяем, существует ли персонаж в ассетах
      if (charId && story.assets && story.assets.characters && !story.assets.characters[charId]) {
        addParseError(lineNumber, line, `Персонаж "${charId}" не определен в секции [char]`, true);
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
    
    // goto [сцена]
    if (cleanLine.startsWith('goto ')) {
      const target = cleanLine.substring(5).trim();
      if (!target) {
        addParseError(lineNumber, line, "Не указана целевая сцена после goto", true);
      }
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
        addParseError(lineNumber, line, `Персонаж "${charVar}" не определен в секции [char]`, true);
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
        addParseError(lineNumber, line, "Пустой текст в пункте меню", true);
      }
      if (!target) {
        addParseError(lineNumber, line, "Не указана целевая сцена в пункте меню", true);
      }

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
        addParseError(lineNumber, line, "Пустой текст в кавычках", true);
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
      addParseError(lineNumber, line, "Неизвестный формат строки", true);
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
        addParseError(0, "Сцена без ID", "Обнаружена сцена без идентификатора", true);
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
              `Переход в несуществующую сцену "${action.target}"`, true
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
                  `Сцена ${scene.id}`, 
                  `Пункт меню "${choice.text || 'без текста'}" ведёт в несуществующую сцену "${choice.goto}"`, true
                );
              }
            }
          });
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
        title: "Ошибка загрузки",
        start: "error_scene"
      },
      assets: {
        backgrounds: {},
        characters: {},
        audio: {}
      },
      scenes: [{
        id: "error_scene",
        actions: [
          {
            type: "text",
            text: "Ошибка загрузки сценария: " + errorMsg
          },
          {
            type: "text",
            text: "Проверьте, что файл story-content.js подключен и содержит window.STORY_TEXT"
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
    let errorText = "❌ ОШИБКА ПАРСИНГА СЦЕНАРИЯ:\n\n";
    
    window.PARSE_ERRORS.forEach((error, index) => {
      errorText += `${index + 1}. Строка ${error.lineNumber}: ${error.message}\n`;
      errorText += `   "${error.line}"\n\n`;
    });
    
    errorText += "\nПожалуйста, исправьте ошибки в файле story.js";
    
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