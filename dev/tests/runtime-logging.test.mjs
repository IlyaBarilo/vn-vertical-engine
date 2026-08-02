import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../../index.html', import.meta.url)));

// Читает runtime-файл относительно корня репозитория для статических проверок опасных диагностических шаблонов.
async function readProjectFile(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

// Защищает от возврата самых дорогих безусловных трассировок при последующих исправлениях runtime.
test('тяжёлая runtime-диагностика не включена по умолчанию', async function() {
  const engineSource = await readProjectFile('engine/engine.js');

  assert.doesNotMatch(engineSource, /console\.trace\s*\(/);
  assert.doesNotMatch(engineSource, /VISUAL_TRACE_ENABLED\s*=\s*true/);
  assert.doesNotMatch(engineSource, /VN_AUTOSAVE_DEBUG\s*===\s*undefined[\s\S]{0,160}VN_AUTOSAVE_DEBUG\s*=\s*true/);
  assert.doesNotMatch(engineSource, /VN_CHAR_DEBUG\s*===\s*false/);
  assert.match(engineSource, /isExplicitDebugCategoryEnabled\("autosave"\)/);
  assert.match(engineSource, /isExplicitDebugCategoryEnabled\("visual"\)/);
  assert.match(engineSource, /isExplicitDebugCategoryEnabled\("character"\)/);
});

// Не позволяет вернуть в консоль полный сценарий, игровые сообщения, переменные и каталоги ассетов.
test('runtime не выводит чувствительные объекты и текст истории', async function() {
  const [engineSource, loaderSource] = await Promise.all([
    readProjectFile('engine/engine.js'),
    readProjectFile('engine/story-loader.js')
  ]);

  assert.doesNotMatch(loaderSource, /ПЕРВЫЕ 500|substring\(0,\s*500\)|JSON\.stringify\(cleanLine\)/);
  assert.doesNotMatch(loaderSource, /ФИНАЛЬНЫЙ STORY\.assets|Текущее состояние \$\{category\}/);
  assert.doesNotMatch(loaderSource, /console\.error\([^\n]*\$\{line\}/);
  assert.doesNotMatch(engineSource, /gameInit sent[^\n]*payload|stats gameInit sent[^\n]*payload/);
  assert.doesNotMatch(engineSource, /set result[^\n]*state\.vars|console\.[a-z]+\([^\n]*VN_LICENSE_KEY/);
  assert.doesNotMatch(engineSource, /writeRuntime(?:Debug|Verbose)\([^\n]*STORY\.assets/);
});

// Фиксирует единый пользовательский параметр Debug и нечувствительное к регистру сравнение его имени.
test('index объявляет единый регистронезависимый параметр Debug', async function() {
  const indexSource = await readProjectFile('index.html');

  assert.match(indexSource, /createDebugCategoryChecker/);
  assert.match(indexSource, /toLowerCase\(\)\s*!==\s*"debug"/);
  assert.match(indexSource, /window\.VN_DEBUG_ENABLED/);
});
