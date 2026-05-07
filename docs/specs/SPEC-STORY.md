# 🎬 VN Engine — Спецификация сценариев

Документ описывает язык сценариев для VN Engine.

Он нужен для:
- написания сценариев вручную
- генерации сценариев через ИИ
- проверки совместимости сценария с движком

Документ описывает:
- структуру файла `story.js`
- секции сценария
- команды сцен
- переменные и логику ветвления
- вызов мини-игр из сценария

---

## 📌 Общая идея

Сценарий хранится в `story.js` как текстовый блок:

```js
window.STORY_TEXT = `
...содержимое сценария...
`;
```

Сценарий состоит из секций и сцен.

Секции описывают:
- метаданные
- ресурсы
- переменные
- список сцен

Сцены описывают:
- показ фона
- показ персонажей
- диалоги
- выборы
- переходы
- вызов мини-игр

---

## 📁 Общая структура сценария

Поддерживаются следующие секции:

- `[meta]` — метаданные сценария
- `[bg]` — фоновые изображения
- `[char]` — персонажи и их состояния
- `[audio]` — аудио-ресурсы
- `[video]` — сюжетные видео-вставки
- `[game]` — реестр мини-игр
- `[var]` — переменные сценария
- `[scene]` — сцены и команды

Минимальный пример:

```text
[meta]
title = Demo Story
startScene = intro
lang = en

[bg]
hall file=assets/backgrounds/bg_hall.jpg

[char]
anna emotion=neutral file=assets/characters/anna.png name="Анна" color=#0F0

[var]
resultGame = 0

[game]
coffeeRush file=assets/games/coffee_rush.html

[scene]
scene intro
bg hall
show anna neutral
anna: "Привет!"
```

---

## 🔧 Общие правила синтаксиса

- Рекомендуемый формат метаданных — `key = value`
- Идентификаторы (`sceneId`, `bgId`, `charId`, `audioId`, `videoId`, `gameId`, имена переменных) должны быть короткими и понятными
- Один и тот же идентификатор должен использоваться последовательно во всём сценарии
- Пустые строки допустимы
- Комментарии допустимы
- Сценарий должен быть читаемым и человеком, и ИИ

Рекомендуется:
- использовать единый стиль именования
- не смешивать несколько стилей записи в одном файле
- держать сцены короткими и логически цельными

---

## 🧾 Секция `[meta]`

Определяет общие параметры сценария.

Пример:

```text
[meta]
title = Demo Story
startScene = intro
lang = en
bg360Quality = auto
```

Поддерживаемые поля:

### `title`

Название сценария.

```text
title = Demo Story
```

### `startScene`

Идентификатор стартовой сцены.

```text
startScene = intro
```

Значение должно совпадать с существующей командой:

```text
scene intro
```

### `lang`

Язык интерфейса движка.

```text
lang = en
lang = ru
```

### `bg360Quality`

Глобальный режим загрузки JS-пакетов 360-фонов.

```text
bg360Quality = auto
bg360Quality = normal
bg360Quality = mobile
```

`normal` всегда грузит основной `*-360.js`, `mobile` всегда грузит `*-360-mobile.js`, `auto` выбирает mobile только на уверенно определенном телефоне. Если параметр не задан, используется `normal`, чтобы старые истории не меняли поведение.

### Параметры интерфейса

Эти поля не меняют логику сценария, но управляют отображением:

```text
topSpacing = 500
bottomSpacing = 800
blurBackground = true
blurStrength = 50
blurBrightness = 0.9
blurOpacity = 0.95
```

Поддерживаемые поля:
- `topSpacing`
- `bottomSpacing`
- `blurBackground`
- `blurStrength`
- `blurBrightness`
- `blurOpacity`

---

## 🖼 Секция `[bg]`

Описывает фоновые изображения.

Формат:

```text
[bg]
<bgId> file=<path>
```

Пример:

```text
[bg]
campusHall file=assets/backgrounds/bg_campus_hall.jpg
libraryEvening file=assets/backgrounds/bg_library_evening.jpg
```

Использование в сцене:

```text
bg campusHall
```

Для 360-фонов нужно указывать JS-пакет, а не исходное изображение:

```text
[bg]
campus360 file=assets/360/campus-360.js 360 quality=auto

[scene]
bg campus360 quality=mobile
```

`quality` принимает `auto`, `normal` или `mobile`. Если `quality` не задан или равен `auto`, используется глобальный `bg360Quality` из `[meta]`; при итоговом `mobile` движок загрузит соседний пакет `campus-360-mobile.js`. Путь к `.jpg/.png/.webp` в 360-фоне считается ошибкой.

### `goto360`

Команда входит в 360-пространство, описанное в `story360.js`.

```text
goto360 korpusNight.174 entry=default
goto360 korpusNight 174 entry=fromIntro button="Выйти"
```

`story360.js` должен находиться рядом с `story.js` и задавать `window.STORY360`.
Файл сам описывает 360-панорамы через поле `file`; редактор создаёт служебные
`bgId` автоматически и не требует дублировать эти панорамы в секции `[bg]`
обычного сценария.
Минимальный формат:

```js
window.STORY360 = {
  version: 1,
  spaces: {
    korpusNight: {
      panoramas: {
        "174": {
          file: "assets/360/korpusnight/174-360.js",
          entries: {
            default: { focusX: 0.2527, focusY: 0.5628 },
            from175: { focusX: 0.5080, focusY: 0.5000 }
          },
          marks: [
            {
              id: "to175",
              x: 0.5087,
              y: 0.4387,
              type: "walk",
              target: { type: "360", panorama: "175", entry: "from174" }
            },
            {
              id: "exit",
              x: 0.2000,
              y: 0.5000,
              type: "walk",
              target: { type: "scene", scene: "scIntro01" }
            }
          ]
        }
      }
    }
  }
};
```

`entry` выбирает направление камеры при входе в панораму. Это заменяет схемы вида `focusx2/focusx3` и хранит направление движения прямо в переходе.

---

## 🎭 Секция `[char]`

Описывает персонажей, их состояния, имя и цвет.

Рекомендуемый формат:

```text
[char]
<charId> emotion=<state> file=<path> name="Имя" color=#RRGGBB
```

Примеры:

```text
[char]
anna emotion=neutral file=assets/characters/ch_anna_neutral.png name="Анна" color=#0F0
anna emotion=smile file=assets/characters/ch_anna_smile.png
igor emotion=neutral file=assets/characters/ch_igor_neutral.png name="Игорь" color=#F00
```

Допустимо дополнять описание персонажа отдельными строками:

```text
igor name="Игорь" file=assets/characters/ch_igor_smile.png
igor color=#F00
```

### Правила

- Один персонаж может иметь несколько `emotion`
- Если эмоция не указана в команде `show`, используется базовое состояние персонажа
- `name` влияет на подпись в диалоге
- `color` влияет на цвет имени в интерфейсе

---

## 🎵 Секция `[audio]`

Описывает музыкальные и звуковые ресурсы.

Формат:

```text
[audio]
<audioId> file=<path>
```

Пример:

```text
[audio]
bgmDay file=assets/audio/bgm_campus_day.mp3
```

Использование в сцене:

```text
music bgmDay
music bgmDay loop
music bgmDay loop=true
music bgmDay loop=false
music stop
```

---

## 🎬 Секция `[video]`

Описывает полноэкранные сюжетные видео-вставки.

Формат:

```text
[video]
<videoId> file=<path> poster=<path> volume=<0..1>
```

Пример:

```text
[video]
intro file=assets/video/intro.mp4 poster=assets/video/intro.jpg volume=0.8
```

Использование в сцене:

```text
video intro
video intro start=1 stop=10
video intro skip=false skipText="Пропустить" fit=contain
```

- `start` и `stop` задают фрагмент в секундах.
- `skip` по умолчанию `true`; можно писать `skip`, `skip=true` или `skip=false`. Старый параметр `skippable` работает как алиас для совместимости.
- `skipText` меняет текст индикатора пропуска.
- `fit` может быть `cover` или `contain`, по умолчанию `cover`.
- Если видео не загрузилось или не удалось перейти к `start`, показывается `poster` на 5 секунд; такой fallback всегда можно пропустить.

---

## 🎮 Секция `[game]`

Описывает мини-игры, доступные сценарию.

Формат:

```text
[game]
<gameId> file=<path>
```

Расширенный пример:

```text
[game]
coffeeRush file=assets/games/coffee_rush.html
spaceDebris file=assets/games/space_debris.html
```

Игра вызывается в сцене через команду `game`.

---

## 🧮 Секция `[var]`

Описывает переменные сценария.

Формат:

```text
[var]
<varName> = <value>
```

Примеры:

```text
[var]
score = 0
resultGame = 0
playerName = "Alex"
isReady = true
```

Поддерживаемые типы:
- number
- string
- boolean

Переменные используются для:
- ветвления через `if`
- изменения состояния сценария
- хранения результата мини-игр

---

## 🎬 Секция `[scene]`

Содержит сцены и все команды сценария.

Каждая сцена начинается с:

```text
scene <sceneId>
```

Пример:

```text
[scene]
scene intro
bg campusHall
show anna neutral
anna: "Добро пожаловать!"
```

### Правила

- каждая сцена должна иметь уникальный `sceneId`
- `startScene` должен ссылаться на существующую сцену
- переходы должны вести в существующие сцены

---

## 🧱 Основные команды сцены

### `scene`

Начинает новую сцену.

```text
scene intro
```

---

### `bg`

Показывает фон.

```text
bg campusHall
```

---

### `show`

Показывает персонажа.

```text
show anna neutral
show igor smile
show anna
```

Если эмоция не указана, используется базовое состояние персонажа.

---

### `hide all`

Скрывает всех персонажей.

```text
hide all
```

---

### Диалог персонажа

Формат:

```text
<charId>: "Текст"
```

Пример:

```text
anna: "Добро пожаловать в наш вуз!"
```

Имя и цвет берутся из секции `[char]`.

---

### Авторский текст

Формат:

```text
"Текст"
```

Пример:

```text
"Позже, в библиотеке. Экран светится мягко, словно зовёт к новой истории..."
```

Используется для реплик автора или повествовательных вставок.

---

### `menu`

Показывает выбор игроку. Поддерживает два формата — старый (короткие переходы) и новый (блочные пункты с произвольными действиями).

По умолчанию пункты меню выводятся с автоматической нумерацией и заголовком `Выберите действие`. Чтобы явно включить номера для конкретного меню, используйте `menu numbered` или `menu numbered=true`; чтобы отключить номера, используйте `menu numbered=false` или `menu plain`. Для коротких вариантов можно включить плотные раскладки: `menu compact` делает кнопки по ширине текста с обычным переносом, а `menu fit` балансирует строки и растягивает кнопки пропорционально их естественной ширине. Плотные раскладки всегда скрывают номера, даже если вместе с ними указан `numbered`. Заголовок можно заменить через `title="..."`; пустой `title=""` скрывает заголовок. Любая неизвестная опция после `menu` считается ошибкой.

#### Старый формат — только переходы

```text
menu
"Вариант 1" -> scene_a
"Вариант 2" -> scene_b
```

`end` не нужен — меню автоматически закрывается на следующей не-меню команде (`show`, `set`, `goto`, `bg`, `if`, новый `menu` и т.п.), на следующем `scene xxx` или в конце файла.

Пример:

```text
menu numbered=false
"Зайти в кафе" -> branch_cafe_01
"Пойти в лабораторию" -> branch_lab_01
```

Компактный режим:

```text
menu compact title=""
"Да" -> scYes
"Нет" -> scNo
"Позже" -> scLater
```

Сбалансированный плотный режим:

```text
menu fit title=""
"Да" -> scYes
"Нет" -> scNo
"Позже" -> scLater
"Собрать" -> scCollect
```

Свой заголовок:

```text
menu title="Куда пойти?"
"Кафе" -> branch_cafe_01
"Лаборатория" -> branch_lab_01
```

#### Новый формат — `choice` + `end`

Если пункту нужно выполнить несколько действий (изменить переменные, показать реплику, потом перейти на сцену), используется ключевое слово `choice`. В этом режиме `end` обязателен.

```text
menu
choice "Атака"
  set hits = hits + 1
  anna: "В бой!"
  goto scAttack
choice "Бежать" -> scRun
choice "Поговорить"
  igor: "Постой!"
  set hostility = hostility - 1
  goto scTalk
end
```

Краткую (`choice "..." -> scene`) и полную (`choice "..."` + блок действий) форму можно свободно смешивать **внутри одного нового меню** — обе используют ключевое слово `choice`, поэтому это не считается смешением форматов:

```text
menu
choice "Простой переход" -> scA
choice "С действиями"
  set x = x + 1
  goto scB
choice "Снова короткий" -> scC
end
```

Внутри `choice` можно использовать любые сценарные команды, включая блочный `if/elif/else/end`:

```text
menu
choice "Атака"
  if hasSword
    set damage = 20
    goto scWin
  else
    goto scLose
  end
choice "Бежать" -> scRun
end
```

#### Правила

- Ограничения форматов действуют **только в рамках одного блока `menu`**. В одной истории (и даже в одной сцене) разные `menu` могут использовать разные форматы — старый и новый независимо.
- Внутри **одного** `menu` смешивать форматы нельзя: если хотя бы один пункт начинается с `choice`, все остальные тоже должны быть с `choice`.
- В старом формате `end` писать **нельзя**.
- В новом формате `end` **обязателен**.
- Внутри блока `choice` строки в кавычках без `->` трактуются как авторский текст (нарратор) — пункт меню всегда явно начинается со слова `choice`.

Пример смешения двух меню разного формата в одной сцене:

```text
scene scExample

menu
"Старый вариант 1" -> scA
"Старый вариант 2" -> scB

show anna welcome

menu
choice "Новый вариант 1"
  set x = x + 1
  goto scC
choice "Новый вариант 2" -> scD
end
```

---

### `goto`

Безусловный переход в другую сцену.

```text
goto finale_01
```

---

### `if`

Условный переход.

Формат:

```text
if <expression> -> <sceneId>
```

Примеры:

```text
if resultGame == 1 -> good_end
if score >= 10 -> bonus_scene
if isReady == true -> start_now
```

Также поддерживается блочная форма условных действий:

```text
if score >= 10
set coins = coins + 5
anna: "Бонус начислен."
goto bonus_scene
end
```

Расширенная форма с несколькими ветками:

```text
if memoryResult == 1
set wins = wins + 1
goto good_end
elif memoryResult == 0
set losses = losses + 1
goto bad_end
else
goto fallback_end
end
```

Поддерживаемые операторы сравнения:
- `==`
- `!=`
- `>`
- `<`
- `>=`
- `<=`

---

### `music`

Управляет фоновой музыкой. Старая команда `bgm` работает как короткий алиас для совместимости.

Примеры:

```text
music bgmDay
music bgmDay loop
music bgmDay loop=true
music bgmDay loop=false
music stop
```

---

### `video`

Запускает полноэкранную видео-вставку и автоматически продолжает сцену после конца ролика, `stop` или пропуска.

Формат:

```text
video <videoId> start=<seconds> stop=<seconds> skip=<true|false> skipText="<text>" fit=<cover|contain>
```

Примеры:

```text
video intro
video intro start=1 stop=10
video intro skip
video intro skip=false skipText="Пропустить" fit=contain
```

---

### `game`

Запускает мини-игру.

Формат:

```text
game <gameId> difficulty=<number> result=<varName>
```

Примеры:

```text
game gameCoffeeRush difficulty=3 result=resultGame
game spaceDebris difficulty=2 result=spaceResult
```

Допустимы дополнительные параметры:

```text
game gameCoffeeRush difficulty=3 result=resultGame speed=2 targetScore=10
```

### Правила

- `gameId` должен существовать в секции `[game]`
- `result` должен указывать на имя переменной, куда движок запишет итог игры
- результат мини-игры затем можно использовать в `if`

---

## 🔀 Логика и ветвление

Сценарий может изменять ход повествования через:
- `menu`
- `goto`
- `if`
- значения переменных
- результаты мини-игр

Пример:

```text
[var]
coffeeResult = 0

[scene]
scene cafe_scene
game gameCoffeeRush difficulty=3 result=coffeeResult

if coffeeResult == 1 -> cafeGood
if coffeeResult == 0 -> cafeBad
```

---

## ✅ Минимальный пример полного сценария

```js
window.STORY_TEXT = `

[meta]
title = Demo Story
startScene = intro
lang = en

[bg]
hall file=assets/backgrounds/bg_hall.jpg

[char]
anna emotion=neutral file=assets/characters/anna.png name="Анна" color=#0F0

[audio]
bgmDay file=assets/audio/day.mp3

[var]
resultGame = 0

[game]
gameCoffeeRush file=assets/games/coffee_rush.html

[scene]
scene intro
bg hall
music bgmDay loop
show anna neutral
anna: "Welcome to the demo."

menu
"Go to the cafe" -> cafe_scene
"Go to the lab" -> lab_scene

scene cafe_scene
game gameCoffeeRush difficulty=3 result=resultGame
if resultGame == 1 -> good_end
if resultGame == 0 -> bad_end

scene good_end
"You won the mini-game."

goto finish

scene bad_end
"You lost the mini-game."

goto finish

scene lab_scene
"This branch does not contain a mini-game."
goto finish

scene finish
"End of demo."
`;
```

---

## ❌ Типичные ошибки

- `startScene` указывает на несуществующую сцену
- `goto` ведёт в несуществующую сцену
- `if` ведёт в несуществующую сцену
- игра вызывается по `gameId`, которого нет в `[game]`
- используются разные стили записи без необходимости
- идентификаторы трудно читать или они непоследовательны
- сцена слишком длинная и содержит слишком много несвязанных действий
- переменная используется в логике, но не объявлена заранее

---

## ✅ Минимальный чек-лист сценария

- есть секция `[meta]`
- указан `startScene`
- стартовая сцена существует
- все сцены имеют уникальные идентификаторы
- все переходы ведут в существующие сцены
- все используемые `bg`, `char`, `audio`, `video`, `game` объявлены в соответствующих секциях
- все переменные, используемые в логике, объявлены в `[var]`
- сценарий читаем и человеком, и ИИ

---

# 🏁 ИТОГ

Совместимый сценарий должен:
- быть записан в `window.STORY_TEXT`
- использовать поддерживаемые секции
- содержать корректные сцены и переходы
- использовать объявленные ресурсы и переменные
- быть понятным для автора, разработчика и ИИ

Этот файл можно использовать как:
- спецификацию для автора сценария
- чек-лист проверки сценария
- промпт для генерации сценариев через ИИ

