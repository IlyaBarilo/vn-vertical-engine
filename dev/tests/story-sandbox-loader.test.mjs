import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../../index.html', import.meta.url)));

// Читает runtime-файл относительно корня репозитория для статической проверки границы sandbox.
function readRuntimeFile(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

// Закрепляет новый порядок bootstrap: пользовательские файлы не должны снова попасть в основной document как script.
test('index.html получает story.js и story360.js только через sandbox-загрузчик', async function() {
  const source = await readRuntimeFile('index.html');
  const sandboxLoaderPosition = source.indexOf('<script src="engine/story-sandbox-loader.js"></script>');
  const inlineBootstrapPosition = source.indexOf('<script>', sandboxLoaderPosition);

  assert.ok(sandboxLoaderPosition >= 0, 'Не подключён story-sandbox-loader.js.');
  assert.ok(inlineBootstrapPosition > sandboxLoaderPosition, 'Sandbox-загрузчик должен выполняться до bootstrap.');
  assert.equal(source.includes('{ src: "story360.js", optional: true }'), false);
  assert.ok(source.includes('loader.loadStoryText(STORY_SCRIPT)'));
  assert.ok(source.includes('loader.loadStory360(STORY360_SCRIPT)'));
});

// Закрепляет отдельный поток, приватный канал и блокировку побочных API до выполнения пользовательского файла.
test('story sandbox работает в Worker и общается через приватный MessageChannel', async function() {
  const source = await readRuntimeFile('engine/story-sandbox-loader.js');

  assert.ok(source.includes('new Worker(workerUrl'));
  assert.ok(source.includes('new MessageChannel()'));
  assert.ok(source.includes('event.ports[0]'));
  assert.ok(source.includes('var loadScript = self.importScripts.bind(self)'));
  assert.ok(source.includes('blockWorkerGlobal("fetch", undefined)'));
  assert.ok(source.includes('blockWorkerGlobal("indexedDB", undefined)'));
  assert.ok(source.includes('worker.terminate()'));
});

// Проверяет сохранение совместимости: fallback разрешён только для действительно отсутствующего story.js.
test('повреждённый story.js не маскируется демонстрационной историей', async function() {
  const source = await readRuntimeFile('index.html');
  const loadFunction = source.match(/function loadStoryScript\(\) \{([\s\S]*?)\n      \}/);

  assert.ok(loadFunction, 'В index.html не найдена функция loadStoryScript.');
  assert.ok(loadFunction[1].includes('result.status !== "missing"'));
  assert.ok(loadFunction[1].includes('loader.loadStoryText(STORY_EXAMPLE_SCRIPT)'));
});
