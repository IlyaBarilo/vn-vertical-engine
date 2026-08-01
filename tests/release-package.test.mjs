import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

// Читает отслеживаемый файл относительно корня репозитория для проверки состава runtime и релиза.
function readRepositoryFile(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

// Извлекает из массива ENGINE_SCRIPTS только обязательные записи, которые должны попасть в сборку.
function collectRequiredEngineScripts(indexSource) {
  const scriptsBlock = indexSource.match(/var\s+ENGINE_SCRIPTS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(scriptsBlock, 'В index.html не найден массив ENGINE_SCRIPTS.');

  const requiredScripts = [];
  const entryPattern = /\{\s*src:\s*"([^"]+)"([^}]*)\}/g;
  let match;

  while ((match = entryPattern.exec(scriptsBlock[1])) !== null) {
    if (!/optional\s*:\s*true/.test(match[2])) {
      requiredScripts.push(match[1]);
    }
  }

  return requiredScripts;
}

// Проверяет существование обязательных runtime-файлов без чтения story.js и каталогов с ассетами.
test('обязательные runtime-файлы из index.html существуют', async function() {
  const indexSource = await readRepositoryFile('index.html');
  const requiredPaths = [
    'index.html',
    'engine/engine.css',
    ...collectRequiredEngineScripts(indexSource)
  ];

  await Promise.all(requiredPaths.map(function(relativePath) {
    return access(path.join(repositoryRoot, relativePath));
  }));
});

// Проверяет, что workflow копирует каждый обязательный runtime-файл в релизный каталог.
test('релизная сборка включает обязательные runtime-файлы', async function() {
  const [indexSource, releaseSource] = await Promise.all([
    readRepositoryFile('index.html'),
    readRepositoryFile('.github/workflows/release.yml')
  ]);
  const requiredPaths = [
    'index.html',
    'engine/engine.css',
    ...collectRequiredEngineScripts(indexSource)
  ];

  requiredPaths.forEach(function(relativePath) {
    assert.ok(
      releaseSource.includes('[ -f ' + relativePath + ' ] && cp ' + relativePath),
      'В release.yml отсутствует копирование ' + relativePath
    );
  });
});
