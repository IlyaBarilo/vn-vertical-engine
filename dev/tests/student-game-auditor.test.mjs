import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../../index.html', import.meta.url)));
const auditorPath = path.join(repositoryRoot, 'tools', 'student-game-auditor.html');

// Загружает чистое ядро аудитора из single-file HTML без выполнения DOM-интерфейса.
async function loadAuditorCore() {
  const html = await readFile(auditorPath, 'utf8');
  const match = html.match(/\/\* STUDENT_GAME_AUDITOR_CORE_START \*\/([\s\S]*?)\/\* STUDENT_GAME_AUDITOR_CORE_END \*\//);
  assert.ok(match, 'В HTML-аудиторе не найдены маркеры тестируемого ядра.');

  const context = vm.createContext({});
  vm.runInContext(match[1], context, { filename: 'student-game-auditor-core.js' });
  assert.ok(context.VNStudentGameAuditorCore, 'Ядро аудитора не экспортировано в globalThis.');
  return { core: context.VNStudentGameAuditorCore, html };
}

// Читает файл репозитория в UTF-8 для проверки реального демонстрационного комплекта.
function readRepositoryFile(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

// Подтверждает автономность инструмента и наличие обоих способов явного выбора каталога.
test('HTML-аудитор остаётся одним автономным файлом с выбором и переносом каталога', async function() {
  const { html } = await loadAuditorCore();

  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /type="file" webkitdirectory multiple/);
  assert.match(html, /addEventListener\('drop', handleDrop\)/);
  assert.match(html, /student-game-audit\.txt/);
  assert.doesNotMatch(html, /<script\s+[^>]*src=/i);
  assert.doesNotMatch(html, /<link\s+[^>]*rel=["']stylesheet/i);
});

// Закрепляет безусловный запрет старых JS-пакетов панорам при сохранении корневого story360.js.
test('аудитор отличает story360.js от запрещённых панорамных JS-пакетов', async function() {
  const { core } = await loadAuditorCore();

  assert.equal(core.isPanoramaJavaScript('story360.js'), false);
  assert.equal(core.isPanoramaJavaScript('assets/360/hall-360.js'), true);
  assert.equal(core.isPanoramaJavaScript('assets/360/hall-360-mobile.js'), true);
  assert.equal(core.isPanoramaJavaScript('assets/360/hall-360-tablet.js'), true);
  assert.equal(core.isPanoramaJavaScript('assets/360/hall-360.css'), false);
});

// Проверяет пассивное извлечение DSL и отказ от интерполяции или дополнительного JavaScript.
test('аудитор принимает только декларативную обёртку story.js', async function() {
  const { core } = await loadAuditorCore();
  const safe = core.inspectStorySource('window.STORY_TEXT = `\n[scene]\nscene intro\n"Текст"\n`;');
  const interpolation = core.inspectStorySource('window.STORY_TEXT = `Значение: ${dangerous()}`;');
  const extraCode = core.inspectStorySource('window.STORY_TEXT = `Текст`;\nfetch("https://example.invalid");');

  assert.equal(Array.from(safe.issues).length, 0);
  assert.match(safe.storyText, /scene intro/);
  assert.ok(Array.from(interpolation.issues).some(function(issue) {
    return issue.code === 'STORY_INTERPOLATION';
  }));
  assert.ok(Array.from(extraCode.issues).some(function(issue) {
    return issue.code === 'STORY_EXTRA_CODE';
  }));
});

// Проверяет извлечение реестра игр и обязательный локальный HTML-путь.
test('аудитор извлекает только допустимые пути мини-игр из story.js', async function() {
  const { core } = await loadAuditorCore();
  const result = core.collectRegisteredGames([
    '[game]',
    'first file=assets/games/first.html',
    'second file="assets/games/second.html"',
    'remote file=https://example.invalid/game.html',
    'script file=assets/games/game.js',
    '',
    '[scene]',
    'scene intro'
  ].join('\n'));
  const gamePaths = Array.from(result.games, function(game) { return game.path; });
  const issueCodes = Array.from(result.issues, function(issue) { return issue.code; });

  assert.deepEqual(gamePaths, ['assets/games/first.html', 'assets/games/second.html']);
  assert.ok(issueCodes.includes('GAME_PATH_UNSAFE'));
  assert.ok(issueCodes.includes('GAME_EXTENSION'));
});

// Фиксирует основные сетевые и исполняемые конструкции, запрещённые для HTML-мини-игры.
test('аудитор обнаруживает внешние зависимости и сетевые API мини-игры', async function() {
  const { core } = await loadAuditorCore();
  const source = [
    '<!doctype html>',
    '<link rel="stylesheet" href="https://cdn.example.invalid/game.css">',
    '<script src="extra.js"></script>',
    '<script>',
    'fetch("https://api.example.invalid/result");',
    'window.open("https://example.invalid");',
    '</script>'
  ].join('\n');
  const issueCodes = Array.from(core.inspectMiniGameSource('assets/games/unsafe.html', source), function(issue) {
    return issue.code;
  });

  assert.ok(issueCodes.includes('GAME_SCRIPT_SRC'));
  assert.ok(issueCodes.includes('GAME_EXTERNAL_STYLE'));
  assert.ok(issueCodes.includes('GAME_NETWORK'));
  assert.ok(issueCodes.includes('GAME_OPEN'));
  assert.ok(issueCodes.includes('GAME_EXTERNAL_URL'));
  assert.ok(Array.from(core.inspectMiniGameSource('assets/games/empty.html', '')).some(function(issue) {
    return issue.code === 'GAME_EMPTY' && issue.level === 'incomplete';
  }));
});

// Проверяет дополнительные JS, старые панорамные пакеты и незарегистрированный HTML по дереву проекта.
test('аудитор обнаруживает опасные файлы в полном перечне проекта', async function() {
  const { core } = await loadAuditorCore();
  const requiredPaths = [
    'index.html',
    'engine/engine.css',
    'engine/engine.js',
    'engine/expression.js',
    'engine/game-protocol.js',
    'engine/story-loader.js',
    'engine/story-sandbox-loader.js',
    'lib/mermaid.min.js',
    'lib/jsrsasign-all-min.js',
    'lib/three.min.js',
    'story.js',
    'docs/examples/story-example.js',
    'tools/convert-360-img-to-css.html',
    'tools/convert-360-img-to-js.html',
    'assets/games/registered.html',
    'assets/games/hidden.html',
    'assets/360/hall-360-mobile.js',
    'assets/scripts/custom.js'
  ];
  const records = requiredPaths.map(function(filePath) {
    return { path: filePath, size: 1 };
  });
  const issues = Array.from(core.inspectInventory(records, ['assets/games/registered.html']));
  const issueCodes = issues.map(function(issue) {
    return issue.code;
  });

  assert.ok(issueCodes.includes('PANORAMA_JS_FILE'));
  assert.ok(issueCodes.includes('UNEXPECTED_JAVASCRIPT'));
  assert.ok(issueCodes.includes('UNREGISTERED_HTML'));
  assert.equal(issueCodes.includes('RUNTIME_MISSING'), false);
  assert.equal(issues.some(function(issue) {
    return issue.path === 'docs/examples/story-example.js' && issue.code === 'UNEXPECTED_JAVASCRIPT';
  }), false);
  assert.equal(issues.some(function(issue) {
    return issue.path === 'tools/convert-360-img-to-css.html' && issue.code === 'UNREGISTERED_HTML';
  }), false);
  assert.equal(issues.some(function(issue) {
    return issue.path === 'tools/convert-360-img-to-js.html' && issue.code === 'UNREGISTERED_HTML';
  }), false);
});

// Проверяет реальный пример, доступность всех зарегистрированных файлов и безопасную штатную игру.
test('аудитор читает демонстрационный story.js и все зарегистрированные мини-игры', async function() {
  const { core } = await loadAuditorCore();
  const storySource = await readRepositoryFile('story-example.js');
  const storyInspection = core.inspectStorySource(storySource);
  const storyIssues = Array.from(storyInspection.issues);

  assert.equal(storyIssues.length, 0);
  const registration = core.collectRegisteredGames(storyInspection.storyText);
  assert.equal(Array.from(registration.issues).length, 0);
  assert.ok(Array.from(registration.games).length >= 1);

  let safeGameChecked = false;
  for (const game of Array.from(registration.games)) {
    const source = await readRepositoryFile(game.path);
    const criticalIssues = Array.from(core.inspectMiniGameSource(game.path, source)).filter(function(issue) {
      return issue.level === 'error' || issue.level === 'incomplete';
    });
    if (game.path === 'assets/games/coffee-rush.html') {
      assert.deepEqual(criticalIssues, [], game.path + ' не должен давать ложное критическое срабатывание.');
      safeGameChecked = true;
    }
  }
  assert.equal(safeGameChecked, true);
});
