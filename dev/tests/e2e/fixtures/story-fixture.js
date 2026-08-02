// Синтетическая история проверяет браузерный runtime без пользовательского story.js и демо-ассетов.
window.STORY_TEXT = `

[meta]
title = "E2E-проверка движка"
lang = ru
startScene = intro
mode = debug
autosave = true
transition = none
transitionMs = 0

[game]
testGame file=/__e2e__/game.html title="Синтетическая мини-игра"

[var]
route = ""
gameResult = 0

[scene]
scene intro
"Первый экран E2E"

menu title="Выберите маршрут"
"Левая ветка" -> left
"Правая ветка" -> right

scene left
set route = "left"
"Выбрана левая ветка"
game testGame difficulty=2 result=gameResult token=e2e
"Игра завершена: {gameResult}"
goto ending

scene right
set route = "right"
"Выбрана правая ветка"
goto ending

scene ending
"Финал: {route}, результат: {gameResult}"
`;
