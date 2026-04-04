// ===========================================
// This file contains a demo story.
// You can completely replace it with your own script.
//
// Этот файл содержит демонстрационную историю.
// Вы можете полностью заменить его своим сценарием.
// ===========================================

window.STORY_TEXT = `

[meta]
title=Вуз: демо-новелла с выбором
lang=ru                  # Язык инфтерфейса программы. Возможны значения: en, ru
startScene=scIntro01
# topSpacing=500        # отступ сверху в пикселях (можно 100, 200 и т.д.)
# bottomSpacing=800     # отступ снизу в пикселях (поднимает интерфейс вверх)

[bg]
# Формат описания для фона:
# имя-фона = путь_и_название_файла
bgCampusHall file=assets/backgrounds/bg-campus-hall.jpg
bgLibraryEvening file=assets/backgrounds/bg-library-evening.jpg
bgBranchCafe file=assets/backgrounds/bg-campus-cafe.jpg
bgBranchCafe2 file=assets/backgrounds/bg-campus-cafe2.jpg
bgBranchCafe3 file=assets/backgrounds/bg-campus-cafe3.jpg
bgBranchLab file=assets/backgrounds/bg-it-lab.jpg
bgBranchYard file=assets/backgrounds/bg-uni-yard-night.jpg
bgBranchYardTest file=assets/backgrounds/bg-uni-yard-night.jpg

[char]
# Формат описания для персонажа:
# имя_персонажа тип = значение
# типы:
# - image - изображение персонажа
# - name - имя персонажа
# - color - цвет подсветки имени персонажа
anna file=assets/characters/ch-anna-neutral.png name="Анна" color=#0F0  # По умолчанию emotion=neutral
igor emotion=smile file=assets/characters/ch-igor-smile.png
igor emotion=neutral file=assets/characters/ch-igor-neutral-test.png name="Игорь" color=#F00
ivan emotion=neutral file=assets/characters/ch-ivan-smile-test.png name="Иван" color=#060

[audio] 
# Формат описания для музыки:
# название_музыки = путь_и_название_файла
bgmDay file=assets/audio/bgm-campus-day.mp3
# bgmMysteryTest file=assets/audio/bgm-library-mystery.mp3
# sfxClickTest file=assets/audio/sfx-button-click.mp3

[game]
gmCoffeeRush file=assets/games/coffee-rush.html title="Удержи кофейный поток" description="Лови заказы на кофе и не нажимай на мусор. Чем выше сложность, тем быстрее поток и больше лишних объектов." cover=assets/games/coffee-rush.jpg
gmSpaceDebris file=assets/games/space-debris.html title="Космический Мусор" description="Управляйте спутником с помощью кругового контроллера, чтобы пролететь через облако космического мусора." cover=assets/games/space-debris.jpg
gmScreenBenchmark file=assets/games/interactive-screen-benchmark.html title="Калибровка Системы" description="Проверьте отклик, multitouch, FPS и точность управления." cover=assets/games/interactive-screen-benchmark.jpg
gmTestMiss file=assets/games/space-debris-test-miss.html

[var]
x = 10 # объявление переменных
y = 25
z = 0
labStep = 0
spaceResult = 0
coffeeResult = 0
benchmarkResult = 0

[scene]
# Формат описания сцен:
# scene названиеCцены
scene scIntro01

# Показ фона:
# bg название_фона
bg bgCampusHall

# Проигрывание музыки:
# bgm название_музыки
# bgm название_музыки loop
# Примечание: loop для постоянного проигрывания с повтором
# Примеры:
# bgm bgmDay - музыка без повтора
# bgm bgmDay loop - музыка с повтором
# bgm stop - остановить музыку

bgm bgmDay loop


# Проверка работы игры
# game gmCoffeeRush difficulty=1 result=coffeeResult x=1 y=100
# anna: "coffee={coffeeResult}"
# if coffeeResult == 1 -> cafeGood
# if coffeeResult == 0 -> cafeBad


show anna  # если не указана эмоция, то используется neutral
anna: "Добро пожаловать в наш вуз! Это демо визуальной новеллы для вертикального экрана."

show igor smile
igor: "Круто. И всё это — один HTML-файл, без сервера?"

show anna neutral
anna: "Да. Фон подстраивается под 7×16 и всегда центрируется."

show igor smile
igor: "А персонаж один за раз — это даже удобно: меньше путаницы на экране."

show anna neutral
anna: "Плюс можно добавлять мини-игры и возвращать результат — для ветвлений."

show igor smile
igor: "Тогда давай сделаем выбор: пусть посетитель решит, куда пойдём дальше!"

goto scScene02

scene scScene02

bg bgLibraryEvening

show igor smile

hide all

"Позже, в библиотеке. Экран светится мягко, словно зовёт к новой истории..."

"Страницы шуршат, где-то вдалеке щёлкает клавиатура. Идея почти готова."

show anna neutral

anna: "Есть вопрос: куда ведём посетителя дальше, чтобы он почувствовал атмосферу вуза?"

# bgm bgmMystery


menu
"Зайти в кафе и услышать студенческие байки" -> scBranchCafe01
"Заглянуть в IT-лабораторию и увидеть магию технологий" -> scBranchLab01
"Выйти во двор и поймать ночное настроение университета" -> scBranchYard01

scene scBranchCafe01

bg bgBranchCafe
hide all

"Кафе шумит: кружки звенят, кто-то обсуждает проекты и дедлайны, кто-то — мемы недели."
"В воздухе пахнет кофе и свежими идеями. Кажется, отсюда начинаются лучшие командные истории."

bg bgBranchCafe2

# Диалоги персонажей без показа на экране
anna: "Кофе здесь просто божественный! Особенно тот латте с карамелью."
igor: "Зато какие мемы рождаются после трёх чашек! Помнишь тот с котом-программистом?"

anna: "Ой, не напоминай! Мы потом неделю смеялись."

anna: "Кажется, бариста не справляется с наплывом. Хочешь помочь?"

game gmCoffeeRush difficulty=3 result=coffeeResult

if coffeeResult == 1 -> scCafeGood
if coffeeResult == 0 -> scCafeBad

goto scFinale01



scene scCafeGood
bg bgBranchCafe3
"Ты отлично справился с потоком заказов."
goto scFinale01

scene scCafeBad
bg bgBranchCafe3
"Поток оказался слишком быстрым, но атмосфера всё равно запомнилась."
goto scFinale01



scene scBranchLab01

bg bgBranchLab
hide all

"Лаборатория светится мониторами. На экране — прототип, рядом — схема, а в голове — тысяча гипотез."
"Здесь можно не только запускать расчёты, но и проверять, как система ведёт себя в интерактивных сценариях."

show anna neutral
anna: "Похоже, лаборатория сегодня свободна. Чем займёмся?"

show igor smile
igor: "Можно прогнать расчёт, как раньше. А можно проверить сенсорный экран и понять, готов ли он для игровых сцен."

menu
"Запустить расчёт и посмотреть, как система выходит на устойчивый режим" -> scBranchLabCalc
"Провести калибровку сенсорной панели" -> scBranchLabBenchmark






scene scBranchLabCalc

bg bgBranchLab
hide all

set labStep = labStep + 1
set x = x + 5
set z = z + x * 2 + 2

"Попытка №{labStep}. Система пересчитала параметры: x = {x}, z = {z}."

show igor smile
igor: "Смотри, я снова запустил модель. Теперь x = {x}."

show anna neutral
anna: "А производный параметр уже равен {z}. Похоже, система постепенно выходит на устойчивый режим."

if labStep > 2 -> scFinale01

anna: "Это ещё не финал. Давай прогоним расчёт ещё раз."

goto scBranchLabCalc






scene scBranchLabBenchmark


bg bgBranchLab
hide all

"На одном из стендов уже открыт режим калибровки. Система предлагает проверить, насколько быстро экран реагирует на касания и как держит нагрузку."
"Если всё работает стабильно, такую панель можно использовать для интерактивных игровых сцен и совместного управления."

show anna neutral
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

show anna neutral
anna: "Отлично. Значит, такие механики можно смело встраивать в историю."

show igor smile
igor: "Вот теперь лаборатория выглядит не просто как декорация, а как место, где рождаются игровые идеи."

goto scFinale01



scene scBranchLabBenchmarkBad

bg bgbranchLab
hide all

"Диагностика показала, что системе ещё есть куда расти: часть проверок оказалась нестабильной."

show anna neutral
anna: "Ничего страшного. Зато теперь понятно, что именно нужно доработать."

show igor neutral
igor: "Это тоже полезный результат. Любая хорошая система начинается с честной проверки."

goto scFinale01





scene scBranchYard01

bg bgBranchYard
hide all

"Во дворе тихо: фонари рисуют дорожки света, и даже шаги звучат как часть саундтрека."
"Над кампусом — глубокое вечернее небо. Анна вдруг улыбается, будто придумала маленькое испытание."

show anna neutral
anna: "Знаешь, вечер — лучшее время для воображения. Давай представим, что мы проводим маленький спутник сквозь поток космического мусора."

show igor smile
igor: "То есть вместо обычной прогулки — ночной челлендж?"
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

show anna neutral
anna: "Вот это было красиво. Такой вечер хочется запомнить."

show igor smile
igor: "Пожалуй, лучший маршрут на сегодня мы уже нашли."

goto scFinale01




scene scYardBad

bg bgBranchYard
hide all

"Маршрут оказался сложнее, чем казалось, и несколько опасных обломков всё-таки сбили темп."
"Но вечер от этого не стал хуже — наоборот, в нём появилось ещё больше азарта и живого ощущения пути."

show anna neutral
anna: "Ничего, не идеальный маршрут тоже остаётся историей."

show igor neutral
igor: "Согласен. Иногда вечер запоминается именно потому, что не идёт по плану."

goto scFinale01



scene scFinale01

bg bgLibraryEvening
hide all

"Демо завершено. Это пример ветвления: три пути сошлись в одну финальную сцену."
"Нажмите в меню «Повтор», чтобы начать заново и выбрать другой путь."



scene scBranchLab02

bg bgBranchLab
hide all

"Лаборатория светится мониторами. На экране — прототип, рядом — схема, а в голове — тысяча гипотез."
"Тут не боятся ошибок: каждая — шаг к решению. И да, иногда решения выглядят как магия."

`;

