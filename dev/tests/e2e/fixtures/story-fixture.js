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
engine.gameSandbox = strict

[game]
testGame file=/__e2e__/game.html title="Синтетическая мини-игра"
legacyGame file=/__e2e__/legacy-game.html title="Legacy-мини-игра" sandbox=legacy

[var]
route = ""
gameResult = 0

[scene]
scene intro
"Первый экран E2E"

menu title="Выберите маршрут"
"Левая ветка" -> left
"Правая ветка" -> right
"Старая мини-игра" -> legacy

scene left
set route = "left"
"Выбрана левая ветка"
game testGame difficulty=2 result=gameResult token=private-token-do-not-log
"Игра завершена: {gameResult}"
goto ending

scene right
set route = "right"
"Выбрана правая ветка"
goto ending

scene legacy
set route = "legacy"
"Выбрана legacy-ветка"
game legacyGame difficulty=1 result=gameResult
"Legacy-игра завершена: {gameResult}"
goto ending

scene ending
"Финал: {route}, результат: {gameResult}"
`;
