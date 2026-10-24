# 🎮 VN Engine — Спецификация мини-игр

Документ предназначен для разработчика HTML-мини-игры и ИИ-ассистента.
Он содержит контракт интеграции, требования к реализации, полный каркас
и способы самостоятельной проверки. Для обычного ИИ-чата достаточно
приложить этот файл и описать игру.

## Как пользоваться

При ручной работе начните с каркаса, добавьте механику и выполните проверки.
В запросе ИИ задайте механику, сложность, смысл результата и повторные попытки.
Если задание достаточно определено, можно сразу реализовывать игру.
Уточнять нужно существенные неизвестные; не требуется отдельно согласовывать
план или подбирать идеи, если пользователь уже описал нужную механику.

| Запрос | Формат результата |
| --- | --- |
| Создать игру | Полный HTML со встроенными CSS и JavaScript и реализованной механикой. |
| Изменить игру | Полный обновлённый файл или изменения согласно запросу. |
| Объяснить конструкцию | Объяснение и короткий пример, без обязательной генерации новой игры. |
| Проверить игру | Замечания с основаниями и способами исправления. |

Если запрошен готовый HTML или только код, не добавляйте обязательные пояснения
вне кода. Код должен быть структурированным и пригодным для редактирования.
Перед ответом сверьте его с требованиями документа. Не утверждайте,
что игра запускалась или тесты прошли, если фактического запуска не было.

Оглавление:

- [Подключение игры](#game-integration)
- [Обмен и безопасность](#game-protocol)
- [Состояния игры и результат](#game-lifecycle)
- [Интерфейс, масштабирование и ввод](#game-ui)
- [Рекомендации по непрерывному управлению](#game-controls)
- [Рабочий HTML-каркас](#game-skeleton)
- [Проверка совместимости](#game-checks)

---

<a id="game-integration"></a>

## Подключение игры

Мини-игра вызывается движком из сценария.

Пример вызова:

```text
game coffeeRush difficulty=3 result=resultCoffee
```

Смысл полей:
- `gameId` — идентификатор игры
- `difficulty` — уровень сложности
- `result` — имя переменной, в которую движок запишет итог игры
- дополнительные параметры передаются за исключением `result` и служебных
  `type`, `gameId`, `protocolVersion`, `sessionId`: последние задаёт движок

### Регистрация игры в проекте

Игра должна быть зарегистрирована в сценарии как HTML-файл.

Рекомендуемый формат регистрации:

```text
[game]
coffeeRush file=assets/games/coffeeRush.html
```

Игры всегда запускаются в строгой изоляции; значение можно оставить в сценарии
явно для читаемости:

```text
[meta]
engine.gameSandbox = strict
```

Режим `legacy` и переопределение `sandbox` у отдельной игры не поддерживаются.
Старую игру необходимо перевести на протокол версии 2.

Данный документ не описывает язык сценариев целиком; здесь этот пример приведён только как минимальный контекст интеграции мини-игры в проект.

---

<a id="game-protocol"></a>

## Обмен и безопасность

### Версия протокола

Версия относится к HTML мини-игры и не указывается в `story.js`. В `<head>`
игры обязателен один машиночитаемый маркер:

```html
<meta name="vn-game-protocol" content="2">
```

Текущая спецификация описывает протокол версии 2. Маркер явно объявляет контракт
HTML-файла и позволяет тестеру определить его без выполнения JavaScript игры.
Номер меняется только при несовместимом изменении обмена или его требований
безопасности, а не при каждом выпуске движка. Обновление движка поэтому не требует
правки сценария.

Игра должна принимать `gameInit` только с совпадающим `protocolVersion` и
возвращать этот номер в `gameResult`. До версии 1.0 движок временно принимает
результат существующей игры v2 без возвращаемого номера, если совпадают
`gameId` и `sessionId`, и выводит предупреждение в консоль разработчика. Начиная
с версии 1.0 такой результат будет отклоняться. Новые и проверяемые по этой
спецификации файлы обязаны передавать номер явно.

---

### Входные данные от движка (`gameInit`)

После запуска игра получает от движка сообщение формата:

```json
{
  "type": "gameInit",
  "gameId": "coffeeRush",
  "protocolVersion": 2,
  "sessionId": "game-7f34a1...",
  "difficulty": 3
}
```

Дополнительно:
- могут передаваться любые другие параметры (например: speed, time, targetScore)
- `protocolVersion` задаёт версию служебного обмена между движком и игрой
- `protocolVersion` должен совпадать со значением `vn-game-protocol` в HTML
- `sessionId` уникален для каждого запуска игры и должен быть возвращён без изменений

---

#### Стандартная сложность новых игр

Новые игры используют целый уровень `difficulty` от `1` до `5`:
`1` — самый простой, `5` — самый сложный, по умолчанию `3`.
Игра должна явно описывать, как уровень влияет на её механику.
Каркас и тестер принимают число либо числовую строку; отсутствие значения,
дробное число, ноль, выход за диапазон, boolean и прочие некорректные значения
заменяются на `3`, без округления и ограничения к ближайшей границе.
Например: `"2"` → `2`, `2.5` → `3`, `0` → `3`, `6` → `3`.

Это правило создания новых игр. Существующие авторские HTML-файлы
автоматически не переписываются; движок сохраняет передачу параметров команды
сценария. Дополнительную настройку механики передавайте отдельными параметрами.

### Сообщение результата

Игра взаимодействует с родителем только через `postMessage`: принимает
`gameInit` от `parent`, сохраняет параметры сессии и возвращает `gameResult`.
Используйте полученный `difficulty` в механике по описанным выше правилам.

| Поле `gameResult` | Тип | Требование |
| --- | --- | --- |
| `type` | string | Ровно `"gameResult"`. |
| `protocolVersion` | number | `2`, как в принятом `gameInit`. |
| `gameId` | string | Полученный идентификатор игры без изменения. |
| `sessionId` | string | Полученный идентификатор сессии без изменения. |
| `result` | number | Обязательное конечное число по шкале игры. |

Пример, где `gameInit` — сохранённые параметры текущей сессии:

```js
parent.postMessage({
  type: "gameResult",
  protocolVersion: 2,
  gameId: gameInit.gameId,
  sessionId: gameInit.sessionId,
  result: resultValue
}, "*");
```

Движок проверяет источник сообщения, версию и идентификаторы сессии.
Неизвестная явная версия и отсутствие идентификаторов отклоняются;
миграционная совместимость номера версии описана выше.

### Изоляция игрового документа

Движок использует iframe с `sandbox="allow-scripts"`, минимальным разрешением
autoplay, запретом чувствительных браузерных API через Permissions Policy и
политикой `no-referrer`. Одновременно движок поддерживает только одну активную
мини-игру: новый запуск отклоняется, пока текущая сессия не закрыта. Игра может
выполнять собственные скрипты и обмениваться сообщениями с движком, но не получает доступ к DOM и
хранилищу родителя, навигации верхнего окна, popup и загрузкам. `allow-same-origin`,
`allow-popups`, `allow-downloads` и `allow-top-navigation` намеренно не включаются.

### Один документ на запуск

Движок отправляет `gameInit` один раз после первой загрузки игрового iframe.
Самостоятельная повторная загрузка или переход на другой документ прекращает
сессию: iframe очищается, повторный `gameInit` не отправляется, прежние ответы
больше не принимаются. Это действует и после результата в URL-режиме.
Сюжетная игра закрывается с результатом `0`, как при ручном закрытии; игра из
статистики возвращает каталог без продвижения сюжета. При URL-запуске появляется
сообщение об остановке и остаётся ручной перезапуск через движок.

Внутренняя кнопка «Ещё раз» должна сбрасывать состояние игры в текущем документе.
Запрещены `location.reload()`, переходы через `location`, ссылки, формы или meta
refresh, заменяющие документ игры. Встроенные экраны меняются средствами DOM или
canvas. Повторный запуск через кнопки движка создаёт новую сессию. Тестер также
блокирует самостоятельную навигацию; его кнопка загрузки разрешает новый документ,
а ручная отправка `gameInit` может начать новую тестовую сессию в уже загруженном.

Родительский `index.html` ограничивает документы iframe политикой
`frame-src 'self' file: blob: data:`. Внешние сайты в игровых iframe не поддерживаются.
Это дополнительный барьер, который не заменяет обязательный CSP внутри HTML игры.
`gameInit` не должен содержать пароли, ключи или другие секреты: код игры получает
все его параметры. Протокол подтверждает сессию, но не честность игрового счёта.

Номер протокола остаётся `2`: формат сообщений не изменился, запрет перезагрузки
и навигации уже входил в контракт. Совместимым играм менять код не требуется.

`story.js` и `story360.js` по умолчанию подключаются обычными script с правами
основной страницы для совместимого `file://`. Их данные проверяются после
выполнения; Worker-изоляция сохранена в коде, но по умолчанию не включена.
Изоляция HTML-мини-игр действует независимо от способа загрузки сценариев.
Пакеты панорамных изображений `*-360.js` движок не загружает и принимает для
них только декларативный формат `*-360.css`. Для полностью недоверенной
студенческой новеллы с защитой также от уязвимостей браузера необходима внешняя
граница: guest-процесс или отдельный untrusted origin без native bridge и
секретов.

### Требования к автономности и безопасности

При разработке студенческой мини-игры соблюдайте дополнительные ограничения:

- игра должна быть зарегистрирована в секции `[game]` файла `story.js`;
- путь HTML должен быть каноническим относительным `assets/...` с прямыми
  слешами, без URL, абсолютного пути, `..`, query/hash и percent-encoding;
- весь CSS и JavaScript должны находиться внутри одного HTML-файла игры;
- запрещены `<script src>`, внешние таблицы стилей, модули и динамический import;
- запрещены CDN, API и обязательные сетевые ресурсы;
- запрещены `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
  `navigator.sendBeacon` и другие каналы произвольного сетевого обмена;
- запрещены вложенные `iframe`, `object`, `embed`, открытие окон, загрузки и
  попытки изменить `location` или навигацию верхнего окна;
- содержимое файла не должно требовать расширения штатного
  `sandbox="allow-scripts"`.

В `<head>` до первого `<script>`, `<style>` или ресурса обязателен один meta CSP:

```html
<meta name="vn-game-protocol" content="2">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; worker-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none'">
```

Политика оставляет встроенному коду ровно необходимые возможности: inline CSS
и JavaScript, а также встроенные `data:`/созданные самой игрой `blob:` медиа.
Запросы через сетевые API, внешние скрипты, Worker, вложенные документы, плагины,
manifest, `<base>` и отправка форм ограничиваются браузером. CSP дополняет
`sandbox="allow-scripts"`, а не заменяет его. CSP игры не запрещает все способы
навигации её собственного окна; контроль повторной загрузки и политика iframe
родителя описаны выше.

Sandbox и CSP не заменяют корректную реализацию игры. Разбивайте длительные
вычисления на ограниченные шаги и возвращайте управление браузеру между ними.
В Firefox длительный цикл игры может задержать и родительскую страницу, поэтому
таймаут движка не защищает от зависания такого кода.

<a id="game-lifecycle"></a>

## Состояния игры и результат

### Попытки и окончательная фиксация

Сессия — один запуск с полученными `gameId` и `sessionId`. Внутри сессии
может быть несколько попыток. Локальная победа или поражение одной попытки
ещё не означают окончательного завершения: допустимы экран оценки и кнопка
«Повторить», сбрасывающая состояние в текущем документе.

В одной сессии игра отправляет `gameResult` ровно один раз — после
окончательного подтверждения результата, отказа от дальнейших попыток
или досрочного завершения. Результаты промежуточных попыток не отправляются;
при повторениях итогом становится результат последней зафиксированной попытки.
При выходе, ошибке или прерывании игра передаёт `result: 0` с теми же
служебными полями, что в примере сообщения.

### Завершение и блокировка ввода

После отправки результата нужно показать явный итог и прекратить все действия,
способные изменить состояние игры: игровой ввод, UI-кнопки, панели,
drag, joystick, жесты и повторные попытки. Зафиксированный итог не меняется.
Это относится к победе, поражению, досрочному выходу и обработке ошибок.
Таймеры, анимации, удержания и аудио, если они созданы механикой,
останавливаются; отложенные callback старой сессии не должны менять новую.

### Повторная инициализация

Внутренняя попытка до результата остаётся частью одной сессии. Повтор уже
принятого `gameInit` с той же парой `gameId`/`sessionId` ничего не сбрасывает,
включая состояние после отправки результата. Новый идентификатор от родителя
начинает чистую сессию в текущем документе: сбрасываются результат, ввод,
оверлеи и состояние механики. Старый init уже использованной сессии игнорируется.
При обычном запуске движок создаёт новый документ; повторный init в том же
документе нужен для ручного тестирования.

### Требования к типу и шкале результата

Новая игра обязана отправлять поле `result` типа number с конечным значением:
`typeof result === 'number' && Number.isFinite(result)`. `NaN`, бесконечность,
строка, boolean, массив и `null` не являются корректным результатом новой игры.

Для бинарной шкалы `0` означает неуспех, `1` — успех. Для очков, времени или
другой расширенной шкалы явно определите единицы, диапазон и порог успеха.
Значение `1` в такой шкале может быть одним очком и не обязано означать победу.
Итоговый экран и условия сценария должны использовать одну договорённость:
например, при цели 10 очков условие успеха — `if score >= 10`, а не `score == 1`.

Поведение принимающей стороны для совместимости не разрешает новой игре
нарушать контракт. Runtime преобразует старые значения через `Number(...)`,
а отсутствующий или неконечный результат заменяет нулём.
Тестер проверяет исходный тип без преобразования: строка, boolean,
массив, null, отсутствующее поле, NaN и бесконечности отклоняются.
Отклонённое сообщение не завершает сессию: игра может отправить корректный итог.

### Финальный статус игры

- при бинарной шкале `result = 1` финальный экран должен явно показывать успех
- при бинарной шкале `result = 0` финальный экран не должен визуально выглядеть как победа
- промежуточные оценки допустимы, но не должны подменять итоговый success/fail
- если игра использует явный порог (`targetScore`, `targetTime` и т.п.), итоговый статус должен определяться именно этим порогом
- текст, цвет, иконки и общий визуальный тон финального экрана не должны противоречить значению `result`

---

<a id="game-ui"></a>

## Интерфейс, масштабирование и ввод

### Старт и автономный запуск

- игра должна запускаться сразу после получения параметров
- игра должна поддерживать автономный запуск прямым открытием HTML-файла для локальной разработки и тестирования
- если `gameInit` не получен в течение короткого времени после загрузки страницы, игра может выполнить локальную инициализацию с параметрами по умолчанию
- локальная инициализация не должна мешать обычному запуску через движок и не должна выполняться повторно после получения `gameInit`
- если перед началом нужен экран с пояснением, он должен быть коротким, не содержать искусственной задержки и вести к началу игры одним явным действием пользователя
- интерфейс должен быть оптимизирован под вертикальную ориентацию экрана
- старт не должен зависеть от асинхронной загрузки ресурсов

### Читаемость и темп

Игроку должны быть понятны цель и действия. Нужны визуальная обратная связь
при нажатии, кнопки с достаточной для пальца областью и сгруппированное управление.
Не размещайте управление только сверху или у самого нижнего края экрана.
Игра помещается в вертикальное окно без внутреннего скролла и выхода элементов
за его границы. Нельзя использовать `alert`, `confirm`, `prompt` как основной UI.

Избегайте ожидания более 1–2 секунд без интерактива и резкого старта без контекста;
рекомендуемая продолжительность — до 60 секунд. Обводки, псевдоконтуры и тени
текста недопустимы, если ухудшают читаемость или имитируют интерактивный элемент.
Долгое нажатие не должно открывать системное меню, выделение текста или лупу.

### Движение и время

Если есть движущиеся или управляемые объекты, явно задавайте скорости,
ускорения и пределы отдельными переменными или конфигурацией. Они могут зависеть
от сложности. Перемещение, ускорение, замедление и прочие изменения во времени
вычисляются через delta time / dt и не зависят от FPS или частоты экрана.
Смена разрешения или размеров canvas не должна менять время прохождения
одинаковой относительной дистанции, если это не часть явно заданной механики.

### HUD и игровые индикаторы

- если элемент выглядит как прогрессбар, он обязан показывать реальное значение
- шкалы должны отражать счёт, прогресс до цели, время или другой настоящий ресурс
- при превышении цели шкала остаётся заполненной на 100%; игра может завершиться успешно сразу или продолжить работу без визуального переполнения шкалы
- игрок должен понимать, что показывает каждый важный элемент HUD

### 🖐 Обработка ввода и совместимость устройств (ОБЯЗАТЕЛЬНО)

Одна и та же игра ОБЯЗАНА корректно работать на всех целевых типах устройств:
- компьютеры и ноутбуки с мышью / тачпадом
- смартфоны
- планшеты
- интерактивные экраны / touch panels / kiosk screens
- иные совместимые устройства с pointer-, mouse- или touch-вводом

Недопустима реализация, которая корректно работает только на одном классе устройств и нестабильна или неработоспособна на остальных.

Требования:
- игра обязана поддерживать mouse-ввод
- игра обязана поддерживать touch-ввод
- игра обязана корректно работать в средах, где touch может приходить через Pointer Events, Touch Events или иную браузерно-совместимую модель
- если среда поддерживает Pointer Events, они должны считаться основным каналом игрового ввода
- Mouse Events и Touch Events в среде с поддержкой Pointer Events должны использоваться только как fallback при явном отсутствии нужного поведения через Pointer Events либо при наличии явной дедупликации одного физического ввода.
- запрещено одновременно обрабатывать один и тот же физический ввод через Pointer Events и через Touch/Mouse Events без явной защиты от двойного срабатывания
- реализация должна явно определять стратегию маршрутизации ввода: `Pointer Events first`, либо `fallback-only`, либо эквивалентную схему без дублей
- если механика использует удержание, drag, multitouch, joystick, непрерывное движение, ведение по траектории или быстрые касания, такая механика обязана корректно работать на всех перечисленных выше типах устройств
- если механика использует drag, удержание или непрерывное ведение указателя, реализация должна обеспечивать сохранение управления до завершения взаимодействия (например, через Pointer Capture или эквивалентную fallback-логику)
- запрещено проектировать игру только под мышь
- запрещено проектировать игру только под телефонный touch
- запрещено проектировать игру только под интерактивный экран
- запрещено полагаться на единственный тип событий, если это приводит к неработоспособности на части целевых устройств
- запрещено использовать `click` как единственный механизм ввода там, где требуется мгновенная реакция, удержание или непрерывное движение
- обязательно должна обрабатываться отмена ввода (`pointercancel`, `touchcancel` или эквивалентное завершение взаимодействия)
- управление должно ощущаться сопоставимо на всех целевых устройствах и не должно заметно ломаться из-за различий в модели ввода, FPS, частоте обновления экрана или производительности устройства

### 🔒 Изоляция UI от игровой логики (ОБЯЗАТЕЛЬНО)

Все UI-элементы (кнопки, панели, контролы, overlay-экраны, модальные окна, drag-handle, служебные панели и др.) должны быть полностью изолированы от игровой механики.

1. Проверка цели событий
- Все обработчики игровой логики (`pointerdown`, `pointermove`, `pointerup`, `touchstart`, `touchmove`, `touchend`, `mousedown`, `mousemove`, `mouseup` и др.) должны начинаться с проверки `event.target`
- Если `event.target` или его родитель относится к UI, обработчик игровой логики должен немедленно завершаться
- Рекомендуется использовать проверку вида:
  `event.target.closest('.button, .panel, .overlay, .ui-control, [data-ui="true"]')`

2. Блокировка всплытия
- Все интерактивные UI-элементы должны вызывать `event.stopPropagation()` в своих обработчиках
- Для кнопок и других интерактивных элементов обязательно блокировать всплытие как минимум в:
  - `click`
  - `pointerdown`
  - `pointerup`
  - `touchstart`
  - `touchend`
  - `mousedown`
  - `mouseup`
- Если UI-элемент поддерживает перетаскивание, должны быть изолированы и его move-события

3. Слои и приоритет
- UI должен находиться выше игрового слоя и визуально, и по приоритету ввода
- UI-слой должен иметь z-index, гарантированно больший, чем у canvas и игрового контейнера
- Для активного UI рекомендуется отдельный верхний слой; рекомендуется использовать z-index не ниже 100 для интерактивного UI-слоя
- При наложении UI на игровую область приоритет ввода всегда должен быть у UI

4. Pointer events
- Запрещено использовать `pointer-events: none` на контейнерах, через которые должен приниматься ввод интерактивных UI-элементов
- `pointer-events: none` допустим только на чисто декоративных элементах, не участвующих в обработке пользовательского ввода
- Если нужен прозрачный контейнер поверх игры, интерактивные дочерние элементы должны быть вынесены в слой, гарантированно принимающий ввод

5. Глобальные fallback-обработчики
- Обработчики mouse на window включаются только при отсутствии основного pointer-канала либо логически изолируются от него; не допускайте двойного ввода.

### 📐 Масштабирование интерфейса (ОБЯЗАТЕЛЬНО)

Игра должна использовать единый коэффициент масштабирования UI, рассчитанный от базового портретного макета.

Рекомендуемый базовый размер:
- width = 810
- height = 1440

Коэффициент масштаба:
scale = min(viewportWidth / 810, viewportHeight / 1440)

Требования:
- все ключевые размеры интерфейса должны зависеть от scale:
  - размеры шрифтов
  - размеры кнопок
  - размеры интерактивных объектов
  - отступы
  - радиусы
  - размеры HUD
- запрещено задавать основной UI только фиксированными px без общего scale
- запрещено ограничивать основной игровой контейнер жёстким max-width / max-height, если это делает игру визуально слишком мелкой на больших экранах
- игровые объекты должны масштабироваться тем же scale, что и UI
- базовые размеры визуальных игровых объектов должны быть заданы централизованно в конфигурационном блоке; итоговые размеры должны вычисляться через эти базовые значения и общий scale
- итоговый интерфейс должен сохранять читаемость и удобство на малых и больших вертикальных экранах
- текст внутри кнопок, карточек, HUD и модальных окон должен масштабироваться тем же scale, что и контейнер
- любой видимый текстовый UI-элемент, включая служебные подписи, ярлыки, хинты, подписи к контролам, drag-handle и аналогичные элементы, должен масштабироваться тем же scale, что и соответствующий контейнер
- общему scale должны подчиняться не только контейнеры и шрифты, но и связанные с ними отступы, радиусы, рамки, hit area, декоративные подложки, ярлыки, ручки перетаскивания и другие вспомогательные UI-элементы

---

<a id="game-controls"></a>

## Рекомендации для игр с непрерывным управлением

### 📱 Расположение элементов управления

- элементы управления не должны располагаться только в верхней или нижней части экрана (зоны, куда сложно дотянуться на мобильных устройствах)

- рекомендуется размещать элементы управления:
  - в центральной части экрана
  - справа или слева от центра
  - либо по центру, если это не мешает игровому процессу

---

### 🎛 Группировка и перемещение

- элементы управления должны быть сгруппированы:
  - компактно
  - в одном блоке

- рекомендуется использовать перемещаемую панель управления:
  - панель должна иметь область (например, "ручку" или "ярлык") для перетаскивания
  - пользователь должен иметь возможность перемещать панель в удобное место на экране

---

### 🕹 Тип управления

- для управления направлением рекомендуется использовать круговой контрол (virtual joystick), а не отдельные кнопки

- круговой контрол:
  - представляет собой область (обычно круг), в которой пользователь задаёт направление движением пальца
  - обеспечивает плавное и естественное управление
  - должен поддерживать непрерывное направление (не только 4 стороны)

---

### ❌ Не рекомендуется

- использовать отдельные кнопки:
  - "вверх / вниз / влево / вправо"
- размещать кнопки управления разнесённо по экрану

---

### ✅ Допустимые исключения

- кнопки допустимы, если:
  - управление дискретное (например: выбор, прыжок, действие)
  - механика не требует направления движения

---

<a id="game-skeleton"></a>

## Рабочий HTML-каркас

Каркас иллюстрирует интеграцию, масштабирование и маршрутизацию ввода.
Добавьте конкретную механику в отмеченные места; готовая игра по запросу
должна содержать её реализацию, а не только комментарий-заглушку.

```html
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="vn-game-protocol" content="2">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; worker-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  :root { --scale: 1; }

  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    touch-action: none;
  }

  #gameRoot {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 810px;
    height: 1440px;
    transform: translate(-50%, -50%) scale(var(--scale));
    touch-action: none;
    font: 32px/1.4 sans-serif;
  }

  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }

  .panel {
    padding: 32px;
    border-radius: 24px;
    background: #fff;
    color: #222;
  }

  .button {
    font: inherit;
    min-height: 96px;
    padding: 20px 32px;
    border: 2px solid currentColor;
    border-radius: 16px;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
  }

  #uiRoot {
    position: absolute;
    inset: 0;
    z-index: 100;
  }

  .overlay,
  .panel,
  .button,
  .ui-control,
  [data-ui="true"] {
    pointer-events: auto;
  }

  .hidden {
    display: none !important;
  }
</style>
</head>
<body>
<div id="gameRoot">
  <canvas id="gameCanvas" width="810" height="1440"></canvas>

  <div id="uiRoot">
    <div id="startOverlay" class="overlay" data-ui="true">
      <div class="panel" data-ui="true">
        <button id="startButton" class="button">Начать</button>
      </div>
    </div>

    <div id="finishOverlay" class="overlay hidden" data-ui="true">
      <div class="panel" data-ui="true">
        <button id="finishButton" class="button">Подтвердить результат</button>
      </div>
    </div>
  </div>
</div>

<script>
let difficulty = 3;
let resultSent = false;
let gameStarted = false;
let initReceived = false;
let activeGameInit = null;
const acceptedSessions = new Set();
let mouseActive = false;
let activeTouchId = null;

const BASE_W = 810;
const BASE_H = 1440;

const gameRoot = document.getElementById('gameRoot');
const uiRoot = document.getElementById('uiRoot');
const startOverlay = document.getElementById('startOverlay');
const finishOverlay = document.getElementById('finishOverlay');
const startButton = document.getElementById('startButton');
const finishButton = document.getElementById('finishButton');

// Принимает стандартную сложность 1..5; неверное значение заменяет обычным уровнем 3.
function normalizeDifficulty(value) {
  const numeric = typeof value === 'number' || typeof value === 'string'
    ? Number(value) : NaN;
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 5 ? numeric : 3;
}

// Масштабирует весь базовый макет, сохраняя пропорции и области ввода.
function applyScale() {
  const scale = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H);
  document.documentElement.style.setProperty('--scale', scale.toFixed(5));
}

// Отделяет интерфейс от игровых действий по цели события и её родителям.
function isUiTarget(target) {
  return !!(
    target &&
    target.closest('.button, .panel, .overlay, .ui-control, [data-ui="true"]')
  );
}

// Скрывает экраны перед переключением состояния.
function hideAllOverlays() {
  startOverlay.classList.add('hidden');
  finishOverlay.classList.add('hidden');
}

// Освобождает удержание перед завершением попытки, новой сессией или потерей фокуса.
function cancelGameInput() {
  if (pointerCaptureTarget && activePointerId !== null) {
    tryReleasePointer({ target: pointerCaptureTarget, pointerId: activePointerId });
  }
  mouseActive = false;
  activeTouchId = null;
  // Добавленная механика здесь останавливает своё непрерывное действие.
}

// Возвращает документ в начальное состояние новой сессии без перезагрузки.
function resetSession() {
  cancelGameInput();
  resultSent = false;
  gameStarted = false;
  gameRoot.style.pointerEvents = 'auto';
  uiRoot.style.pointerEvents = 'auto';
  startButton.disabled = false;
  finishButton.disabled = false;
  delete finishButton.dataset.result;
  hideAllOverlays();
  startOverlay.classList.remove('hidden');
  // Добавленная механика здесь отменяет свои таймеры/анимации и сбрасывает счёт.
}

// Переводит экранные координаты в единые координаты базового макета 810×1440.
function toGamePoint(x, y) {
  const rect = gameRoot.getBoundingClientRect();
  return { x: (x - rect.left) * BASE_W / rect.width,
           y: (y - rect.top) * BASE_H / rect.height };
}

// Начинает попытку, пока результат текущей сессии не зафиксирован.
function startGame() {
  if (resultSent) return;
  hideAllOverlays();
  gameStarted = true;
}

// Показывает локальный итог попытки без отправки результата движку.
function showFinish(result) {
  if (resultSent) return;
  gameStarted = false;
  cancelGameInput();
  finishButton.dataset.result = String(Number(result) || 0);
  hideAllOverlays();
  finishOverlay.classList.remove('hidden');
}

// Отключает указатель и клавиатурную активацию кнопок после результата.
function blockAllInteraction() {
  gameRoot.style.pointerEvents = 'none';
  uiRoot.style.pointerEvents = 'none';
  startButton.disabled = true;
  finishButton.disabled = true;
}

// Единожды фиксирует итог текущей сессии и блокирует дальнейший ввод.
function finishGame(result) {
  if (resultSent) return;
  resultSent = true;
  gameStarted = false;
  cancelGameInput();

  blockAllInteraction();

  const resultMessage = {
    type: "gameResult",
    protocolVersion: 2,
    result: Number.isFinite(result) ? result : 0
  };

  // При запуске из движка возвращаем его служебные id; локальный HTML остаётся автономным.
  if (activeGameInit) {
    resultMessage.gameId = activeGameInit.gameId;
    resultMessage.sessionId = activeGameInit.sessionId;
  }

  parent.postMessage(resultMessage, "*");
}

// Начинает игровой ввод вне UI и переводит координаты в базовый макет.
function onGameInputStart(event, x, y) {
  if (!gameStarted || resultSent) return;
  if (isUiTarget(event.target)) return;
  if (event.cancelable) event.preventDefault();

  if (HAS_POINTER_EVENTS && event.pointerId != null && activePointerId !== null) return;
  // Для drag/hold-механик сохраняем управление до завершения или отмены.
  tryCapturePointer(event);

  const point = toGamePoint(x, y);
  // Игровая логика начала ввода использует point.x и point.y.
}

// Обрабатывает движение вне UI в координатах базового макета.
function onGameInputMove(event, x, y) {
  if (!gameStarted || resultSent) return;
  if (HAS_POINTER_EVENTS && event.pointerId !== activePointerId) return;
  if (isUiTarget(event.target)) return;
  if (event.cancelable) event.preventDefault();

  const point = toGamePoint(x, y);
  // Игровая логика движения использует point.x и point.y.
}

// Завершает или отменяет ввод и освобождает захват указателя.
function onGameInputEnd(event) {
  if (HAS_POINTER_EVENTS && event.pointerId !== activePointerId) return;
  if (!HAS_POINTER_EVENTS && !mouseActive && activeTouchId === null) return;
  if (event.cancelable) event.preventDefault();

  cancelGameInput();

  // игровая логика завершения ввода
}

// Сохраняет нативный click для мыши, касания и клавиатуры, изолируя UI от игры.
function bindUiButton(button, handler) {
  // Отмена touchstart подавляет будущий click, поэтому здесь блокируется только всплытие.
  const stop = (event) => event.stopPropagation();
  ['pointerdown', 'pointermove', 'pointerup', 'pointercancel',
   'touchstart', 'touchmove', 'touchend', 'touchcancel',
   'mousedown', 'mousemove', 'mouseup']
    .forEach(type => button.addEventListener(type, stop));

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!resultSent && !button.disabled) handler();
  });
}

const HAS_POINTER_EVENTS = 'PointerEvent' in window;

let activePointerId = null;
let pointerCaptureTarget = null;

// Сохраняет доставку pointer-событий при удержании или перетаскивании.
function tryCapturePointer(event) {
  if (!HAS_POINTER_EVENTS) return;
  if (!event || event.pointerId == null) return;
  if (!event.target || !event.target.setPointerCapture) return;

  try {
    event.target.setPointerCapture(event.pointerId);
    activePointerId = event.pointerId;
    pointerCaptureTarget = event.target;
  } catch (_) {}
}

// Освобождает захват указателя и очищает связанные ссылки.
function tryReleasePointer(event) {
  if (!HAS_POINTER_EVENTS) return;
  if (!event || event.pointerId == null) return;
  if (!event.target || !event.target.releasePointerCapture) return;

  try {
    if (event.target.hasPointerCapture && event.target.hasPointerCapture(event.pointerId)) {
      event.target.releasePointerCapture(event.pointerId);
    }
  } catch (_) {}

  if (activePointerId === event.pointerId) {
    activePointerId = null;
    pointerCaptureTarget = null;
  }
}

// Выбирает Pointer Events или fallback для сред без их поддержки.
function bindInput() {
  if (HAS_POINTER_EVENTS) {
    gameRoot.addEventListener('pointerdown', (event) => {
      onGameInputStart(event, event.clientX, event.clientY);
    }, { passive: false });

    gameRoot.addEventListener('pointermove', (event) => {
      onGameInputMove(event, event.clientX, event.clientY);
    }, { passive: false });

    gameRoot.addEventListener('pointerup', (event) => {
      onGameInputEnd(event);
    }, { passive: false });

    gameRoot.addEventListener('pointercancel', (event) => {
      onGameInputEnd(event);
    }, { passive: false });

    return;
  }

  // Резервный ввод мышью при отсутствии Pointer Events.
  gameRoot.addEventListener('mousedown', (event) => {
    if (isUiTarget(event.target) || !gameStarted || resultSent || activeTouchId !== null) return;
    mouseActive = true;
    onGameInputStart(event, event.clientX, event.clientY);
  }, { passive: false });

  window.addEventListener('mousemove', (event) => {
    if (!mouseActive) return;
    onGameInputMove(event, event.clientX, event.clientY);
  }, { passive: false });

  window.addEventListener('mouseup', (event) => {
    if (!mouseActive) return;
    onGameInputEnd(event);
  }, { passive: false });

  // Один активный touch не смешивается с синтетическими mouse-событиями.
  gameRoot.addEventListener('touchstart', (event) => {
    if (isUiTarget(event.target) || !gameStarted || resultSent) return;
    if (event.cancelable) event.preventDefault();
    if (activeTouchId !== null || !event.changedTouches.length) return;
    const touch = event.changedTouches[0];
    activeTouchId = touch.identifier;
    onGameInputStart(event, touch.clientX, touch.clientY);
  }, { passive: false });

  gameRoot.addEventListener('touchmove', (event) => {
    if (activeTouchId === null) return;
    for (const touch of event.changedTouches) {
      if (touch.identifier === activeTouchId) {
        onGameInputMove(event, touch.clientX, touch.clientY);
      }
    }
  }, { passive: false });

  // Обычное завершение и отмена одинаково прекращают удержание выбранного touch.
  const endTouch = (event) => {
    for (const touch of event.changedTouches) {
      if (touch.identifier === activeTouchId) {
        onGameInputEnd(event);
        return;
      }
    }
  };
  gameRoot.addEventListener('touchend', endTouch, { passive: false });
  gameRoot.addEventListener('touchcancel', endTouch, { passive: false });
}

// Принимает только родительский init; использованная пара id не сбрасывает прогресс или итог.
window.addEventListener('message', (event) => {
  if (event.source !== parent) return;
  const data = event.data;
  if (!data || data.type !== 'gameInit' || Number(data.protocolVersion) !== 2) return;
  if (typeof data.gameId !== 'string' || !data.gameId.trim()) return;
  if (typeof data.sessionId !== 'string' || !data.sessionId.trim()) return;
  const key = JSON.stringify([data.gameId, data.sessionId]);
  if (acceptedSessions.has(key)) return;

  acceptedSessions.add(key);
  initReceived = true;
  activeGameInit = { ...data };
  difficulty = normalizeDifficulty(data.difficulty);
  resetSession();
  applyScale();

  // Здесь применяются параметры механики новой сессии.
});

setTimeout(() => {
  if (initReceived) return;

  difficulty = 3;
  applyScale();

  // локальная инициализация для автономного запуска HTML-файла
}, 300);

window.addEventListener('resize', applyScale);
window.addEventListener('blur', cancelGameInput);
// Скрытая вкладка не должна сохранять зажатое игровое действие.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelGameInput();
});

bindUiButton(startButton, startGame);
bindUiButton(finishButton, () => {
  finishGame(Number(finishButton.dataset.result) || 0);
});

applyScale();

// Pointer Events имеют приоритет как основной канал ввода.
// Mouse/Touch используются только как fallback при отсутствии Pointer Events.
bindInput();

</script>
</body>
</html>
```

### Координаты и расширение каркаса

Каркас использует логические координаты 810×1440 и масштабирует весь
`gameRoot` через CSS transform: вместе с ним изменяются шрифты, кнопки,
игровые объекты и области нажатия. `toGamePoint()` переводит экранный ввод
обратно в логические координаты. При добавлении canvas-рисования задайте его
внутренний размер 810×1440 и рисуйте в той же системе координат; для повышенной
чёткости можно отдельно учитывать плотность пикселей, сохраняя логические размеры.
Поля по краям окна допустимы: макет сохраняет пропорции и полностью помещается
в доступную область.

Каркас показывает одно активное удержание: Pointer Capture сохраняет его за
пределами объекта, а pointercancel/touchcancel, потеря фокуса, скрытие вкладки
и завершение попытки освобождают ввод. Для механики с несколькими одновременными
касаниями расширьте состояние до карты pointerId/touch identifier.

<a id="game-checks"></a>

## Проверка совместимости

1. Откройте HTML напрямую: проверьте автономный старт, цель и локальную
   инициализацию без `gameInit`.
2. Загрузите игру в `tools/game-tester.html`: проверьте сложность, служебные
   поля сессии и исходный числовой тип результата. Ошибочное сообщение
   не должно фиксировать сессию. После корректного итога ввод блокируется.
3. Проверьте повтор попытки до результата и новую сессию через тестер.
   Повтор init текущей сессии не должен сбрасывать прогресс или итог.
4. Подключите игру к истории и проверьте ветвление по её шкале результата.
   Список игр во встроенной статистике также подходит для пробного запуска.
5. Проверьте мышь и touch, отмену удержания/drag и малый/большой портретный
   экран. Для заявленной поддержки смартфонов и интерактивных панелей
   нужна проверка на соответствующих устройствах.

### Минимальный чек-лист

- Один HTML, встроенные CSS/JS, корректные протокол v2 и CSP в `head`.
- Корректный путь, отсутствие внешних зависимостей и запрещённых каналов.
- Верные `protocolVersion`, `gameId` и `sessionId` в ответе.
- Один итог на сессию, исходный `result` — конечное число.
- Итоговый экран и ветвление соответствуют шкале результата.
- Автономный старт, повтор попытки и новая сессия работают.
- Ввод не дублируется, UI изолирован, отмена и финиш освобождают удержание.
- Масштаб, HUD, читаемость и временная логика соответствуют требованиям.

Чтение кода не подтверждает его выполнение. Тестер проверяет обмен и исходный
тип результата, но не доказывает честность счёта, качество механики или работу
на всех устройствах. Браузерный запуск подтверждает только проверенное
окружение; отдельно указывайте непроверенные устройства и сценарии.
