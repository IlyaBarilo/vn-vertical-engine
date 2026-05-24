// ===========================================
// Этот файл содержит демонстрационную историю.
// Чтобы создать свою новеллу, скопируйте этот файл в story.js и редактируйте копию.
// ===========================================

window.STORY_TEXT = `

[meta]
title=Вуз: демо-новелла с выбором
lang=ru                  # Язык инфтерфейса программы. Возможны значения: en, ru
startScene=scIntro01
mode=debug              # Режим: release и debug. По умолчанию debug
bg360Quality=auto       # auto: mobile только на телефоне; normal/mobile — ручной режим для всех устройств
engine.optimized=auto  # false | true | auto: webp --vnv-optimized(-mobile), затем исходный файл
# topSpacing=500        # отступ сверху в пикселях (можно 100, 200 и т.д.)
# bottomSpacing=800     # отступ снизу в пикселях (поднимает интерфейс вверх)
transition = fade       # fade, black, white, instant или none
transitionMs = 180

[bg]
# Формат описания для фона:
# имя-фона = путь_и_название_файла
bgCampusHall file=assets/backgrounds/bg-campus-hall.jpg scale=1 focusy=0.5
bgLibraryEvening file=assets/backgrounds/bg-library-evening.jpg
bgLibraryEveningWide file=assets/backgrounds/bg-library-evening-wide.jpg scroll
bgBranchCafe file=assets/backgrounds/bg-campus-cafe.jpg
bgBranchCafeWide file=assets/backgrounds/bg-campus-cafe-wide.jpg scroll
bgBranchCafeVideoWide file=assets/backgrounds/bg-campus-cafe-wide.mp4 volume=0.0 scroll focusx=0.4748
bgBranchCafe2 file=assets/backgrounds/bg-campus-cafe2.jpg
bgBranchCafe2Wide file=assets/backgrounds/bg-campus-cafe2-wide.jpg scroll focusx=0.4684
bgBranchCafe3 file=assets/backgrounds/bg-campus-cafe3.jpg
bgBranchCafe3Wide file=assets/backgrounds/bg-campus-cafe3-wide.jpg scroll focusx=0.4801
bgBranchLab file=assets/backgrounds/bg-it-lab.jpg
bgBranchLabWide file=assets/backgrounds/bg-it-lab.jpg scroll
bgBranchLabVideo file=assets/backgrounds/bg-it-lab.mp4 fallbackimage=assets/backgrounds/bg-it-lab.jpg volume=0.0
bgBranchYard file=assets/backgrounds/bg-uni-yard-night.jpg
bgBranchYardWide file=assets/backgrounds/bg-uni-yard-night-wide.jpg scroll focusx=0.4207
bgBranchYardTest file=assets/backgrounds/bg-uni-yard-night.jpg

bg360_B101 file=assets/360/B101/b101-360.js scale=1 focusx=0.5 focusy=0.5 360 focusx=0.2503 focusy=0.4344 focusz=0
bg360_solar file=assets/360/B101/solar-360.js scale=1 focusx=0.5 focusy=0.5 360 quality=normal focusx=0.2503 focusy=0.4344 focusz=0
bg360_japan file=assets/360/B101/japan-360.js scale=1 focusx=0.5 focusy=0.5 360 quality=normal focusx=0.2503 focusy=0.4344 focusz=0
bg360_artdecoluxury file=assets/360/B101/art-deco-luxury-360.js scale=1 focusx=0.5 focusy=0.5 360 quality=normal focusx=0.2503 focusy=0.4344 focusz=0
bg360_arcticcrystallaboratory file=assets/360/B101/arctic-crystal-laboratory-360.js scale=1 focusx=0.5 focusy=0.5 360 quality=normal focusx=0.2503 focusy=0.4344 focusz=0
bg360_aquaticfuturism file=assets/360/B101/aquatic-futurism-360.js scale=1 focusx=0.5 focusy=0.5 360 quality=normal focusx=0.2503 focusy=0.4344 focusz=0
bg360_80ssynthwaveretrofuturism file=assets/360/B101/80s-synthwave-retro-futurism-360.js scale=1 focusx=0.5 focusy=0.5 360 quality=normal focusx=0.2503 focusy=0.4344 focusz=0

[char]
# Формат описания для персонажа:
# имя_персонажа тип = значение
# типы:
# - image - изображение персонажа
# - name - имя персонажа
# - color - цвет подсветки имени персонажа
anna file=assets/characters/ch-anna-calm.png name="Анна" color=#0F0 # По умолчанию emotion=calm
anna emotion=calm file=assets/characters/ch-anna-calm.png
anna emotion=welcome file=assets/characters/ch-anna-welcome.png
anna emotion=explain file=assets/characters/ch-anna-explain.png
anna emotion=thinking file=assets/characters/ch-anna-thinking.png
anna emotion=laugh file=assets/characters/ch-anna-laugh.png
anna emotion=support file=assets/characters/ch-anna-support.png
anna emotion=excited file=assets/characters/ch-anna-excited.png
igor file=assets/characters/ch-igor-calm.png name="Игорь" color=#F00
igor emotion=welcome file=assets/characters/ch-igor-welcome.png
igor emotion=explain file=assets/characters/ch-igor-explain.png
igor emotion=thinking file=assets/characters/ch-igor-thinking.png
igor emotion=laugh file=assets/characters/ch-igor-laugh.png
igor emotion=support file=assets/characters/ch-igor-support.png
igor emotion=excited file=assets/characters/ch-igor-excited.png
igor emotion=calm file=assets/characters/ch-igor-calm.png
igor emotion=neutral file=assets/characters/ch-igor-neutral.png
igor emotion=smile file=assets/characters/ch-igor-smile.png

ivan emotion=neutral file=assets/characters/ch-ivan-smile-test.png name="Иван" color=#060

[video]
videoLab file=assets/backgrounds/bg-it-lab.mp4 poster=assets/backgrounds/bg-it-lab.jpg volume=0.0

[audio] 
# Формат описания для музыки:
# название_музыки = путь_и_название_файла
bgmDay file=assets/audio/bgm-campus-day.mp3 volume=0.7
# bgmMysteryTest file=assets/audio/bgm-library-mystery.mp3
# sfxClickTest file=assets/audio/sfx-button-click.mp3

[game]
gmCoffeeRush file=assets/games/coffee-rush.html title="Удержи кофейный поток" description="Лови заказы на кофе и не нажимай на мусор. Чем выше сложность, тем быстрее поток и больше лишних объектов." cover=assets/games/coffee-rush.jpg
gmSpaceDebris file=assets/games/space-debris.html title="Космические обломки" description="Управляйте спутником с помощью кругового контроллера, чтобы пролететь через облако космических обломков." cover=assets/games/space-debris.jpg
gmScreenBenchmark file=assets/games/interactive-screen-benchmark.html title="Калибровка Системы" description="Проверьте отклик, multitouch, FPS и точность управления." cover=assets/games/interactive-screen-benchmark.jpg
gmCircuitRouting file=assets/games/snake-iso-game.html title="Маршрутизация контура" description="Проведи сигнал по плате через активные узлы. Чем выше сложность, тем быстрее поток и плотнее схема." cover=assets/games/snake-iso-game.jpg
gmMemoryProtocol file=assets/games/memory-game.html title="Лабораторный протокол: Импульс" description="Повтори последовательность световых импульсов. В нагруженном режиме сигналы идут быстрее, а серия становится длиннее." cover=assets/games/memory-game.jpg
gmComputeSpace file=assets/games/compute-space.html title="Тестирование 3D-полета" description="Тестирование 3D-полета"
gmBoardUnderVoltage file=assets/games/board-under-voltage.html title="Тестирование 3D-платы" description="Тестирование 3D-платы"
gmWordSearchAlgo file=assets/games/word-search-game.html title="Поиск слов" description="Найди все слова на поле." cover=assets/games/word-search-game-algo.jpg data="fmt=wsg-text-b64xor;v=1;id=algo;title_b64=pvHhjKzPoub+1UK3/buCgcTn3w==;theme_b64=pv7hiazEo9n/77Lerenp7au8;size=15x8;grid_b64=pvDhqKzko/X+zbL4rMvpwwbn8Zzg4s6iyuXsidboxJ7QTuCU5uu+peLUp9q3sb/8tuoX6cmqrb3coKKI4YSVo8enpSOe5uKr4pGmzeGUrOmjxv7NHrbuu5iB6ufxnOXi+aL15d8lp6CP76an4Krm5L6T4t2n6hv+zrLFrPPpxKqYvdSgpojnKOXoienozZ7W4qXil6b74aMAp+e3vr//tum7kYHa5/Wc006I54Soo8GnrY/uppHgoObXEuGZrOqj/f76svOs8enPqqwRnOXi8KLK5eeJ7+jFnuTiqE7m0r6g4tyn3Le9v/K247ujLaqavdOgrIjphKujwqevj9s=;words_b64=psbhoqzkSURoKSMiPS8DI0oNX2BDDGteZwtAdUNEj+imquCo5u1UEnQ6M0UmG1UQVkZZFWFEBEF8TgF0Q2oBX2gL6Pye1+Kr4qim/OGqrOJJRGgrJCA+XQMjSg1aYEEMb15kC0t1RwZnYkcMCB4ESFkdAEJAX1RSv/a27LukgefnxpzlCHsxFXM1GzECLX9MAwAeBkhfAB5MSUJWAl5cV0xHCG9DG1xySR5oDoSvo8enpI/epq/gpubmVBILPjFFIWhVEFZGWxVgRAdBfE4DdEJqBF9oSQpzf0gAHAAIRUIDTqzso/n+/LL+rPHpwUAULHwzBh40bkdCY0YLc3tIAwIeA0hfAx5ISUJUAltcV0hHDW9LA0F5DOLHosrl04nY6Mue6OKqCBU0KnMAOjFJFR5VU1JQWgdgThtfckEBdEBqBEB1RAZufFoBDgMEWlwPA01bQRv+8LLGrPXp96qive2gk2JREnMwbzF+ZTxHCAUeAEhbHQdCQl9TEFtOUkJfFWREBEF5TgB0Ryjl54ni6Mae1+KS4qSm9uGnRlQ2V2wtJ1JGGQlrTRtbckceb0xiGURnQRRpcEAeBQwAWloPBFBETVECXR623LusgdLn+Jzt4sCiwQ9QHzF6bHpBCEICDE5CAgxEW0dZF0NWWEVHCm9DG19yQQJ0QGoEQ3VERI/RpqzgoObUvq/i3E1QJBYqVCVFUUthQAZBeE4DdEFqBV9qSQhzekgCHAcIRkIHTqzUo8b+9LL4rPnpyaqiV28yABw0EHdJK0YCZ2JADAkeAEhfAR5KSUJWAllcV01HDm9LB0F7Tgt0RSjl74nn6P6e1+Ko4qRMTXUDP0M2XhQdUlxJRwpvTxtfckUeaUxiGUJnQRRvcEMeAE7m1r6k4uan0LeOv8O25LuWa1lxKwkzcGtIJgVJaEcUa3BHAxwGCEdfHQdCRkNLG1FbSklVAX1PCVpgRQxvXmBJo/ino4/QpqTgr+bovpDi3qffXQ0uVSA6LntrCAdXfVwHZkN4A01rWw5hfFoFDgEaQVACHkpJR0sYUVZKS1UMfU0=;sourceWords_b64=psbhoqzkD7eIv/q25ruiLaqUve2gqYjshKejwaetI57i4qDiq6bz4Zms4g+3tL/8tuC7qYHn5/mc4E6I6YSro8qnoI/UpqJM4qmm8OGSrNij8/7xsvwAu6aB2ufznNbizaL15dIlp6yP26ar4JPm1L6j4uSn5hv+z7LzrMPpxKqqvdSgpySiy+XtieXo/Z7o4pBO5tW+kOLnp+23vL/6tukX6c2qp73toJOI6oSnD4nX6Mqe7OKT4pamz+GqrNgPt4+/+bbiu6+B5+fznNHi+qL4"

[var]
x = 10 # объявление переменных
y = 25
z = 0
labStep = 0
walkResult = ""
spaceResult = 0
coffeeResult = 0
benchmarkResult = 0
circuitResult = 0
memoryResult = 0
memoryDifficulty = 1
searchResult = 0

[scene]
# Формат описания сцен:
# scene названиеCцены
scene scIntro01

# Показ фона:
# bg название_фона


bg bgCampusHall

# Проигрывание музыки:
# music название_музыки
# music название_музыки loop
# music название_музыки loop=true
# music название_музыки loop=false
# Примечание: loop без значения работает как loop=true и включает постоянный повтор.
# Примеры:
# music bgmDay - музыка без повтора
# music bgmDay loop - музыка с повтором
# music stop - остановить музыку

music bgmDay loop


# Проверка работы игры
# game gmCoffeeRush difficulty=1 result=coffeeResult x=1 y=100
# game gmWordSearch difficulty=3 result=searchResult data="fmt=wsg-text;v=1;id=tech_01;title=Поиск слов;theme=Компьютеры, устройства и интернет;size=5x5;grid=ЯАННИ|ПЕМЕА|ЕРАЛЛ|МТОГД|ШИРКО;words=КОД:#FFADAD:r1:3,4>4,4>4,3|АЛГОРИТМ:#FFD6A5:r1:3,0>3,1>4,1>4,2>3,2>3,3>2,3>2,2|ПЕРЕМЕННАЯ:#FDFFB6:r1:0,0>0,1>0,2>0,3>1,3>1,2>1,1>2,1>2,0>1,0"
# anna: "res={searchResult}"
# if searchResult == 1 -> cafeGood
# if searchResult == 0 -> cafeBad

show anna welcome # если не указана эмоция, то используется neutral
anna: "Добро пожаловать в наш вуз! Это демо визуальной новеллы для вертикального экрана."

show igor smile
igor: "Круто. И всё это — один HTML-файл, без сервера?"

show anna explain
anna: "Да. Фон подстраивается под 7×16 и всегда центрируется."

show igor explain
igor: "А персонаж один за раз — это даже удобно: меньше путаницы на экране."

show anna welcome focusx=0.3480 focusy=0.4510 scale=2.0000
anna: "Можно настраивать расположение персонажа на экране и приближать его."

show anna explain
anna: "Плюс можно добавлять мини-игры и возвращать результат — для ветвлений."

show igor excited
igor: "Тогда давай сделаем выбор: пусть посетитель решит, куда пойдём дальше!"

goto scScene02

scene scScene02

# Параметр scroll можно применять при объявлении фона либо при отображении
bg bgLibraryEveningWide scroll

show igor smile

hide all

"Позже, в библиотеке. Экран светится мягко, словно зовёт к новой истории... Можно осмотреться по сторонам перемещая фон."

"Страницы шуршат, где-то вдалеке щёлкает клавиатура. Идея почти готова."

# Параметр scroll можно переопределять если настроили его при объявлении фона
bg bgLibraryEveningWide scroll=false

show anna thinking
anna: "Есть вопрос: куда ведём посетителя дальше, чтобы он почувствовал атмосферу вуза?"

# music bgmMystery


menu
"Зайти в кафе и услышать студенческие байки" -> scBranchCafe01
"Заглянуть в IT-лабораторию и увидеть магию технологий" -> scBranchLab01
"Выйти во двор и поймать ночное настроение университета" -> scBranchYard01
"Зайти в современную аудиторию вуза" -> sc360_B101

scene scBranchCafe01

bg bgBranchCafeVideoWide
hide all

"Кафе шумит: кружки звенят, кто-то обсуждает проекты и дедлайны, кто-то — мемы недели."
"В воздухе пахнет кофе и свежими идеями. Кажется, отсюда начинаются лучшие командные истории."

bg bgBranchCafe2Wide

# Диалоги персонажей без показа на экране
anna: "Кофе здесь просто восхитительный! Особенно тот латте с карамелью."
igor: "Зато какие мемы рождаются после трёх чашек! Помнишь тот с котом-программистом?"

bg bgBranchCafe3Wide

anna: "Ой, не напоминай! Мы потом неделю смеялись."
anna: "Кажется, бариста не справляется с наплывом. Хочешь помочь?"

game gmCoffeeRush difficulty=3 result=coffeeResult


# Пример ветвления условия

if coffeeResult == 1
  "Ты отлично справился с потоком заказов."
  goto scFinale01
elif coffeeResult == 0
  "Поток оказался слишком быстрым, но атмосфера всё равно запомнилась."
  goto scFinale01
else
  # Просто как пример. Такого не должно быть
  "Результат игры не ясен."
  goto scFinale01
end


scene scBranchLab01

video videoLab skip
# video videoLab skip=false fit=contain skipText="Далее"

hide all

# Применение фона с видео
bg bgBranchLabVideo

"Лаборатория светится мониторами. На экране — прототип, рядом — схема, а в голове — тысяча гипотез. "
"Здесь можно не только запускать расчёты, но и проверять, как система ведёт себя в интерактивных сценариях."



# Применение фона с изображением, чтобы не отвлекало от персонажа
bg bgBranchLab

show anna neutral
anna: "Похоже, лаборатория сегодня свободна. Чем займёмся?"

show igor smile
igor: "Можно прогнать расчёт, как раньше. А можно проверить сенсорный экран и понять, готов ли он для игровых сцен."

menu
"Запустить расчёт и посмотреть, как система выходит на устойчивый режим" -> scBranchLabCalc
"Провести калибровку сенсорной панели" -> scBranchLabBenchmark
"Собрать словарь алгоритма" -> scBranchLabWordSearchIntro
"Открыть стенд маршрутизации контура" -> scBranchLabRoutingIntro
"Пройти тест памяти световых импульсов" -> scBranchLabMemoryIntro



scene scBranchLabWordSearchIntro

bg bgBranchLab
hide all

"На боковом экране открыт учебный модуль: система перемешала ключевые термины и ждёт, когда их соберут обратно."

show anna explain
anna: "Это не тест реакции, а проверка внимания. Нужно найти слова, из которых собирается логика программы."

show igor thinking
igor: "То есть сначала приводим в порядок словарь, а потом уже запускаем сложные стенды?"

goto scBranchLabWordSearchRun


scene scBranchLabWordSearchRun

bg bgBranchLab
hide all

"Ты запускаешь модуль поиска терминов."

game gmWordSearchAlgo difficulty=2 result=searchResult

if searchResult == 1 -> scBranchLabWordSearchGood
if searchResult == 0 -> scBranchLabWordSearchBad


scene scBranchLabWordSearchGood

bg bgBranchLab
hide all

"Термины собраны, и система подсветила связанный маршрут: код, цикл, массив, функция, алгоритм."

show anna calm
anna: "Отлично. Даже простая словесная задача может работать как часть лабораторной сцены."

goto scFinale01


scene scBranchLabWordSearchBad

bg bgBranchLab
hide all

"Часть терминов осталась несобранной, но модуль всё равно показал, где логика распалась."

show igor support
igor: "Ничего страшного. Для прототипа это тоже полезно: сразу видно, какие подсказки нужны игроку."

goto scFinale01




scene scBranchLabCalc

bg bgBranchLab
hide all

set labStep = labStep + 1
set x = x + 5
set z = z + x * 2 + 2

"Попытка №{labStep}. Система пересчитала параметры: x = {x}, z = {z}."

show igor explain
igor: "Смотри, я снова запустил модель. Теперь x = {x}."

show anna explain
anna: "А производный параметр уже равен {z}. Похоже, система постепенно выходит на устойчивый режим."

if labStep > 2 -> scFinale01

show anna excited
anna: "Это ещё не финал. Давай прогоним расчёт ещё раз."

goto scBranchLabCalc






scene scBranchLabBenchmark


bg bgBranchLab
hide all

"На одном из стендов уже открыт режим калибровки. Система предлагает проверить, насколько быстро экран реагирует на касания и как держит нагрузку."
"Если всё работает стабильно, такую панель можно использовать для интерактивных игровых сцен и совместного управления."

show anna explain
anna: "Это как раз то, что нужно для нашей истории. Проверим отклик, multitouch и точность?"

show igor smile
igor: "Отлично. Если панель справится, потом сюда можно встроить и другие игровые эпизоды."

"Ты подходишь к экрану и запускаешь диагностику."

game gmScreenBenchmark difficulty=3 result=benchmarkResult

if benchmarkResult == 1 -> scBranchLabBenchmarkGood
if benchmarkResult == 0 -> scBranchLabBenchmarkBad



scene scBranchLabBenchmarkGood
bg bgBranchLab
hide all

"Диагностика завершена успешно. Экран уверенно реагирует на касания, поддерживает multitouch и подходит для интерактивных сцен."

show anna excited
anna: "Отлично. Значит, такие механики можно смело встраивать в историю."

show igor excited
igor: "Вот теперь лаборатория выглядит не просто как декорация, а как место, где рождаются игровые идеи."

goto scFinale01



scene scBranchLabBenchmarkBad

bg bgbranchLab
hide all

"Диагностика показала, что системе ещё есть куда расти: часть проверок оказалась нестабильной."

show anna support
anna: "Ничего страшного. Зато теперь понятно, что именно нужно доработать."

show igor support
igor: "Это тоже полезный результат. Любая хорошая система начинается с честной проверки."

goto scFinale01





scene scBranchYard01

bg bgBranchYardWide
hide all

"Во дворе тихо: фонари рисуют дорожки света, и даже шаги звучат как часть саундтрека."
"Над кампусом — глубокое вечернее небо. Анна вдруг улыбается, будто придумала маленькое испытание."

bg bgBranchYard

show anna excited
anna: "Знаешь, вечер — лучшее время для воображения. Давай представим, что мы проводим маленький спутник сквозь поток космическких обломков."

show igor smile
igor: "То есть вместо обычной прогулки — ночной челлендж?"

show igor excited
igor: "Мне нравится. Если пройдём маршрут чисто, вечер точно запомнится."

"Ты сосредотачиваешься на экране и берёшь управление."

game gmSpaceDebris difficulty=3 result=spaceResult

if spaceResult == 1 -> scYardGood
if spaceResult == 0 -> scYardBad

goto scFinale01




scene scYardGood

bg bgBranchYard
hide all

"Траектория пройдена идеально — ни одного столкновения."
"Кажется, ночной кампус и правда превращает даже простую прогулку в маленькое приключение."

show anna excited
anna: "Вот это было красиво. Такой вечер хочется запомнить."

show igor calm
igor: "Пожалуй, лучший маршрут на сегодня мы уже нашли."

goto scFinale01




scene scYardBad

bg bgBranchYard
hide all

"Маршрут оказался сложнее, чем казалось, и несколько опасных обломков всё-таки сбили темп."
"Но вечер от этого не стал хуже — наоборот, в нём появилось ещё больше азарта и живого ощущения пути."

show anna support
anna: "Ничего, не идеальный маршрут тоже остаётся историей."

show igor support
igor: "Согласен. Иногда вечер запоминается именно потому, что не идёт по плану."

goto scFinale01



scene scFinale01

bg bgLibraryEvening
hide all

"Демо завершено. Это пример ветвления: три пути сошлись в одну финальную сцену."

# Вариант меню: без нумерации, компактный
menu numbered=false compact
choice "Вернуться к началу истории" -> scIntro01
end






scene scBranchLabRoutingIntro

bg bgBranchLab
hide all

"На дальнем столе собран отдельный стенд: прозрачная плата, активные дорожки и контур, который нужно провести через узлы без перегрузки."
"Это уже не просто диагностика, а практическое испытание реакции и точности."

show anna excited
anna: "Вот это уже интересно. Здесь мы не просто смотрим на систему, а ведём сигнал по реальной схеме."

show igor explain
igor: "Давай выберем режим: простой и напряжённый."

goto scBranchLabRoutingDifficulty


scene scBranchLabRoutingDifficulty

bg bgBranchLab
hide all

show anna thinking
anna: "Какой режим запускаем?"

menu
"Простой режим" -> scBranchLabRoutingRunSimple
"Нагруженный режим" -> scBranchLabRoutingRunHard
"Вернуться к выбору в лаборатории" -> scBranchLab01


scene scBranchLabRoutingRunSimple

bg bgBranchLab
hide all

"Ты запускаешь стенд в базовом режиме."

game gmCircuitRouting difficulty=1 result=circuitResult

if circuitResult == 1 -> scBranchLabRoutingGood
if circuitResult == 0 -> scBranchLabRoutingBad


scene scBranchLabRoutingRunHard

bg bgBranchLab
hide all

"Ты запускаешь стенд в нагруженном режиме."

game gmCircuitRouting difficulty=3 result=circuitResult

if circuitResult == 1 -> scBranchLabRoutingGood
if circuitResult == 0 -> scBranchLabRoutingBad


scene scBranchLabRoutingGood

bg bgBranchLab
hide all

"Контур проведён чисто. Сигнал прошёл по плате без критических потерь, и стенд подтвердил устойчивость маршрута."

goto scFinale01


scene scBranchLabRoutingBad

bg bgBranchLab
hide all

"На одном из участков сигнал сорвался, и стенд остановил прогон."

show anna support
anna: "Ничего страшного. Даже сбой здесь выглядит как часть эксперимента."

show igor support
igor: "Зато напряжение в сцене чувствуется сразу. Для истории это тоже работает."

goto scFinale01





scene scBranchLabMemoryIntro

bg bgBranchLab
hide all

"На соседнем стенде открыт режим памяти: световые импульсы проходят по панели сериями, а система проверяет, насколько точно оператор удерживает последовательность."
"Это испытание нужно для сценариев, где важны внимание, ритм и устойчивость к нагрузке."

show anna neutral
anna: "Вот это уже ближе к игровому эпизоду. Не просто касание, а проверка памяти и темпа."

show igor explain
igor: "Давай оставим два режима: обычный и напряжённый. Для новеллы этого вполне достаточно."

goto scBranchLabMemoryDifficulty


scene scBranchLabMemoryDifficulty

bg bgBranchLab
hide all

show anna thinking
anna: "Какой режим теста запускаем?"

menu
"Базовый режим" -> scBranchLabMemorySetEasy
"Нагруженный режим" -> scBranchLabMemorySetHard
"Вернуться к выбору в лаборатории" -> scBranchLab01


scene scBranchLabMemorySetEasy
set memoryDifficulty = 1

hide all

"Ты запускаешь тест памяти в базовом режиме."

game gmMemoryProtocol difficulty=1 result=memoryResult

goto scBranchLabMemoryFinal




scene scBranchLabMemorySetHard
set memoryDifficulty = 3

hide all

"Ты запускаешь тест памяти в нагруженном режиме."

game gmMemoryProtocol difficulty=3 result=memoryResult

goto scBranchLabMemoryFinal


scene scBranchLabMemoryFinal

hide all

if memoryResult == 1 -> scBranchLabMemoryGood
if memoryResult == 0 -> scBranchLabMemoryBad

scene scBranchLabMemoryGood

bg bgBranchLab
hide all

"Серия световых импульсов воспроизведена без ошибок. Стенд подтвердил, что память и темп удерживаются стабильно."

show anna excited
anna: "Отлично. Такой тест хорошо дополняет лабораторию: здесь важна не только реакция, но и концентрация."

show igor excited
igor: "Да, это уже другой тип мини-игры, и он ощущается очень к месту."

goto scFinale01



scene scBranchLabMemoryBad

bg bgBranchLab
hide all

"На одной из серий ты сбиваешься, и стенд останавливает испытание."

show anna support
anna: "Ничего страшного. Даже ошибка здесь работает как часть эксперимента."

show igor thinking
igor: "Зато сразу видно, как меняется напряжение, когда на память идёт реальная нагрузка."

goto scFinale01



scene sc360_B101

show anna support
anna: "Сейчас посмотрим современную аудиторию университета в режиме 360."

anna: "В начале в максимальном качестве."

hide all

bg bg360_B101 360 scroll quality=normal
walk360 bg360_B101 text="Вы сидите за компьютером, но можно оглянуться." button="Продолжить в низком качестве" result=walkResult

bg bg360_B101 360 scroll quality=mobile
walk360 bg360_B101 text="Качество понизили для скорости обработки устройством." button="Продолжить" result=walkResult

bg bg360_B101 360

show anna welcome
anna: "Можно  переоформить панорамы в раличных стилях."

goto sc360multi101

scene sc360multi101

menu title="Выберите стиль"
choice "80s synthwave retro futurism"
  bg bg360_80ssynthwaveretrofuturism 360 scroll
  walk360 bg360_80ssynthwaveretrofuturism button="Продолжить"
  

choice "Art Deco luxury"
  bg bg360_artdecoluxury 360 scroll
  walk360 bg360_artdecoluxury button="Продолжить"
  

choice "Арктическая кристаллическая лаборатория"
  bg bg360_arcticcrystallaboratory 360 scroll
  walk360 bg360_arcticcrystallaboratory button="Продолжить"
  

choice "Подводный Атлантис"
  bg bg360_aquaticfuturism 360 scroll
  walk360 bg360_aquaticfuturism button="Продолжить"
  

choice "Соларпанк эко-футуризм"
  bg bg360_solar 360 scroll
  walk360 bg360_solar button="Продолжить"
  

choice "Японский дзен-минимализм"
  bg bg360_japan 360 scroll
  walk360 bg360_japan button="Продолжить"
  

choice "Завершить просмотр"
  goto scFinale01

end

goto sc360multi101


# # Test
# scene scBranchLab02
# bg bgBranchLab
# hide all
# "Лаборатория светится мониторами. На экране — прототип, рядом — схема, а в голове — тысяча гипотез."
# "Тут не боятся ошибок: каждая — шаг к решению. И да, иногда решения выглядят как магия."

`;

