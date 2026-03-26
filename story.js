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
startScene=intro_01
# topSpacing: 500        # отступ сверху в пикселях (можно 100, 200 и т.д.)
# bottomSpacing: 800     # отступ снизу в пикселях (поднимает интерфейс вверх)

[bg]
# Формат описания для фона:
# имя_фона = путь_и_название_файла
campusHall file=assets/backgrounds/bg_campus_hall.jpg
libraryEvening file=assets/backgrounds/bg_library_evening.jpg
branchCafe file=assets/backgrounds/bg_campus_cafe.jpg
branchCafe2 file=assets/backgrounds/bg_campus_cafe2.jpg
branchCafe3 file=assets/backgrounds/bg_campus_cafe3.jpg
branchLab file=assets/backgrounds/bg_it_lab.jpg
branchYard file=assets/backgrounds/bg_uni_yard_night.jpg
branchYardTest file=assets/backgrounds/bg_uni_yard_night.jpg

[char]
# Формат описания для персонажа:
# имя_персонажа тип = значение
# типы:
# - image - изображение персонажа
# - name - имя персонажа
# - color - цвет подсветки имени персонажа
anna file=assets/characters/ch_anna_neutral.png name="Анна" color=#0F0  # По умолчанию emotion=neutral
igor emotion=smile file=assets/characters/ch_igor_smile.png
igor emotion=neutral file=assets/characters/ch_igor_neutralTest.png name="Игорь" color=#F00
ivan emotion=neutral file=assets/characters/ch_ivan_smileTest.png name="Иван" color=#060

[audio] 
# Формат описания для музыки:
# название_музыки = путь_и_название_файла
bgmDay file=assets/audio/bgm_campus_day.mp3
# bgmMysteryTest file=assets/audio/bgm_library_mystery.mp3
# sfxClickTest file=assets/audio/sfx_button_click.mp3

[game]
gameCoffeeRush file=assets/games/coffee_rush.html title="Удержи кофейный поток" description="Лови заказы на кофе и не нажимай на мусор. Чем выше сложность, тем быстрее поток и больше лишних объектов." logo=image.png
spaceDebris file=assets/games/space_debris.html title="Космический Мусор" description="Управляйте спутником с помощью кругового контроллера, чтобы пролететь через облако космического мусора."
gameTestMiss file=assets/games/space_debrisTestMiss.html

[var]
x = 10 # объявление переменных
y = 25
z = 0
labStep = 0
spaceResult = 0
coffee = 0

[scene]
# Формат описания сцен:
# scene название_сцены
scene intro_01

# Показ фона:
# bg название_фона
bg campusHall

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
# game gameCoffeeRush difficulty=1 result=coffee x=1 y=100
# anna: "coffee={coffee}"
# if coffee == 1 -> cafeGood
# if coffee == 0 -> cafeBad


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

goto scene_02

scene scene_02

bg libraryEvening

show igor smile

hide all

"Позже, в библиотеке. Экран светится мягко, словно зовёт к новой истории..."

"Страницы шуршат, где-то вдалеке щёлкает клавиатура. Идея почти готова."

show anna neutral

anna: "Есть вопрос: куда ведём посетителя дальше, чтобы он почувствовал атмосферу вуза?"

# bgm bgmMystery


menu
"Зайти в кафе и услышать студенческие байки" -> branch_cafe_01
"Заглянуть в IT-лабораторию и увидеть магию технологий" -> branch_lab_01
"Выйти во двор и поймать ночное настроение университета" -> branch_yard_01

scene branch_cafe_01

bg branchCafe
hide all

"Кафе шумит: кружки звенят, кто-то обсуждает проекты и дедлайны, кто-то — мемы недели."
"В воздухе пахнет кофе и свежими идеями. Кажется, отсюда начинаются лучшие командные истории."

bg branchCafe2

# Диалоги персонажей без показа на экране
anna: "Кофе здесь просто божественный! Особенно тот латте с карамелью."
igor: "Зато какие мемы рождаются после трёх чашек! Помнишь тот с котом-программистом?"

anna: "Ой, не напоминай! Мы потом неделю смеялись."

anna: "Кажется, бариста не справляется с наплывом. Хочешь помочь?"

game gameCoffeeRush difficulty=3 result=coffee

if coffee == 1 -> cafeGood
if coffee == 0 -> cafeBad

goto finale_01



scene cafeGood
bg branchCafe3
"Ты отлично справился с потоком заказов."
goto finale_01

scene cafeBad
bg branchCafe3
"Поток оказался слишком быстрым, но атмосфера всё равно запомнилась."
goto finale_01



scene branch_lab_01

bg branchLab
hide all

"Лаборатория светится мониторами. На экране — прототип, рядом — схема, а в голове — тысяча гипотез."

goto branch_lab_01_repeat



scene branch_lab_01_repeat

bg branchLab
hide all

set labStep = labStep + 1
set x = x + 5
set z = z + x * 2 + 2

"Попытка №{labStep}. Система пересчитала параметры: x = {x}, z = {z}."

show igor smile
igor: "Смотри, я снова запустил модель. Теперь x = {x}."

show anna neutral
anna: "А производный параметр уже равен {z}. Похоже, система постепенно выходит на устойчивый режим."

if labStep > 2 -> finale_01

anna: "Это ещё не финал. Давай прогоним расчёт ещё раз."

goto branch_lab_01_repeat



scene branch_yard_01

bg branchYard
hide all

"Во дворе тихо: фонари рисуют дорожки света, и даже шаги звучат как часть саундтрека."
"Над кампусом — глубокое вечернее небо. Анна вдруг улыбается, будто придумала маленькое испытание."

show anna neutral
anna: "Знаешь, вечер — лучшее время для воображения. Давай представим, что мы проводим маленький спутник сквозь поток космического мусора."

show igor smile
igor: "То есть вместо обычной прогулки — ночной челлендж?"
igor: "Мне нравится. Если пройдём маршрут чисто, вечер точно запомнится."

"Ты сосредотачиваешься на экране и берёшь управление."

game spaceDebris difficulty=3 result=spaceResult

if spaceResult == 1 -> yardGood
if spaceResult == 0 -> yardBad

goto finale_01




scene yardGood

bg branchYard
hide all

"Траектория пройдена идеально — ни одного столкновения."
"Кажется, ночной кампус и правда превращает даже простую прогулку в маленькое приключение."

show anna neutral
anna: "Вот это было красиво. Такой вечер хочется запомнить."

show igor smile
igor: "Пожалуй, лучший маршрут на сегодня мы уже нашли."

goto finale_01




scene yardBad

bg branchYard
hide all

"Маршрут оказался сложнее, чем казалось, и несколько опасных обломков всё-таки сбили темп."
"Но вечер от этого не стал хуже — наоборот, в нём появилось ещё больше азарта и живого ощущения пути."

show anna neutral
anna: "Ничего, не идеальный маршрут тоже остаётся историей."

show igor neutral
igor: "Согласен. Иногда вечер запоминается именно потому, что не идёт по плану."

goto finale_01



scene finale_01

bg libraryEvening
hide all

"Демо завершено. Это пример ветвления: три пути сошлись в одну финальную сцену."
"Нажмите в меню «Повтор», чтобы начать заново и выбрать другой путь."



scene branch_lab_02

bg branchLab
hide all

"Лаборатория светится мониторами. На экране — прототип, рядом — схема, а в голове — тысяча гипотез."
"Тут не боятся ошибок: каждая — шаг к решению. И да, иногда решения выглядят как магия."

`;

