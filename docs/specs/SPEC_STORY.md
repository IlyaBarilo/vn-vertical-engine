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
- Идентификаторы (`sceneId`, `bgId`, `charId`, `audioId`, `gameId`, имена переменных) должны быть короткими и понятными
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
bgm bgmDay
bgm bgmDay loop
bgm stop
```

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

Показывает выбор игроку.

Формат:

```text
menu
"Вариант 1" -> scene_a
"Вариант 2" -> scene_b
```

Пример:

```text
menu
"Зайти в кафе" -> branch_cafe_01
"Пойти в лабораторию" -> branch_lab_01
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

Поддерживаемые операторы сравнения:
- `==`
- `!=`
- `>`
- `<`
- `>=`
- `<=`

---

### `bgm`

Управляет фоновой музыкой.

Примеры:

```text
bgm bgmDay
bgm bgmDay loop
bgm stop
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
bgm bgmDay loop
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
- все используемые `bg`, `char`, `audio`, `game` объявлены в соответствующих секциях
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

