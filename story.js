// story-content.js
// Содержит текст сценария в виде строки

window.STORY_TEXT = `# МЕТАДАННЫЕ
title: Вуз: демо-новелла с выбором
startScene: intro_01
# topSpacing: 500        # отступ сверху в пикселях (можно 100, 200 и т.д.)
# bottomSpacing: 800     # отступ снизу в пикселях (поднимает интерфейс вверх)

# РЕСУРСЫ
[bg]
# Формат описания для фона:
# имя_фона = путь_и_название_файла
campusHall = assets/backgrounds/bg_campus_hall.jpg
libraryEvening = assets/backgrounds/bg_library_evening.jpg
branchCafe = assets/backgrounds/bg_campus_cafe.jpg
branchLab = assets/backgrounds/bg_it_lab.jpg
branchYard = assets/backgrounds/bg_uni_yard_night.jpg
branchYardTest = assets/backgrounds/bg_uni_yard_night.jpg

[char]
# Формат описания для персонажа:
# имя_персонажа тип = значение
# типы:
# - image - изображение персонажа
# - name - имя персонажа
# - color - цвет подсветки имени персонажа
anna image neutral = assets/characters/ch_anna_neutral.png
anna name = "Анна"
anna color = #0F0
igor image smile = assets/characters/ch_igor_smile.png
igor image neutral = assets/characters/ch_igor_neutralTest.png
igor name = "Игорь"
igor color = #F00
ivan image neutral = assets/characters/ch_ivan_smileTest.png
ivan name = "Иван"
ivan color = #060

[audio]
# Формат описания для музыки:
# название_музыки = путь_и_название_файла
bgmDay = assets/audio/bgm_campus_day.mp3
# bgmMysteryTest = assets/audio/bgm_library_mystery.mp3
# sfxClickTest = assets/audio/sfx_button_click.mp3

# СЦЕНЫ
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

show anna neutral
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
hide all

"Позже, в библиотеке. Экран светится мягко, словно зовёт к новой истории…"
"Страницы шуршат, где-то вдалеке щёлкает клавиатура. Идея почти готова."

# bgm bgmMystery

show anna neutral
anna: "Есть вопрос: куда ведём посетителя дальше, чтобы он почувствовал атмосферу вуза?"

menu
"Зайти в кафе и услышать студенческие байки" -> branch_cafe_01
"Заглянуть в IT-лабораторию и увидеть магию технологий" -> branch_lab_01
"Выйти во двор и поймать ночное настроение университета" -> branch_yard_01

scene branch_cafe_01

bg branchCafe
hide all

"Кафе шумит: кружки звенят, кто-то обсуждает проекты и дедлайны, кто-то — мемы недели."
"В воздухе пахнет кофе и свежими идеями. Кажется, отсюда начинаются лучшие командные истории."

goto finale_01

scene branch_lab_01

bg branchLab
hide all

"Лаборатория светится мониторами. На экране — прототип, рядом — схема, а в голове — тысяча гипотез."
"Тут не боятся ошибок: каждая — шаг к решению. И да, иногда решения выглядят как магия."

goto finale_01

scene branch_yard_01

bg branchYard
hide all

"Во дворе тихо: фонари рисуют дорожки света, и даже шаги звучат как часть саундтрека."
"Именно в такие моменты появляются самые смелые задумки — когда вокруг спокойно, а внутри бурлит сюжет."

goto finale_01

scene finale_01

bg libraryEvening
hide all

"Демо завершено. Это пример ветвления: три пути сошлись в одну финальную сцену."
"Нажмите «Домой», чтобы начать заново и выбрать другой путь."



scene branch_lab_02

bg branchLab
hide all

"Лаборатория светится мониторами. На экране — прототип, рядом — схема, а в голове — тысяча гипотез."
"Тут не боятся ошибок: каждая — шаг к решению. И да, иногда решения выглядят как магия."

`;

