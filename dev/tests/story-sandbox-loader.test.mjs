import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../../index.html', import.meta.url)));

// Читает runtime-файл относительно корня репозитория для статической проверки границы sandbox.
function readRuntimeFile(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

// Извлекает bootstrap из runtime-файла, чтобы тестировать ту же функцию, которая сериализуется в настоящий Worker.
function extractWorkerBootstrap(source) {
  const start = source.indexOf('  function workerBootstrap() {');
  const end = source.indexOf('  // Выполняет один пользовательский файл', start);

  assert.ok(start >= 0 && end > start, 'Не удалось извлечь workerBootstrap из загрузчика.');
  return source.slice(start, end);
}

// Выполняет bootstrap в отдельном VM-контексте и перехватывает данные до имитации structured clone.
async function runWorkerFixture(userSource, kind = 'story360') {
  const loaderSource = await readRuntimeFile('engine/story-sandbox-loader.js');
  const listeners = new Map();
  const messages = [];
  const sandbox = {};
  const context = vm.createContext(sandbox);

  sandbox.self = sandbox;
  sandbox.addEventListener = function addEventListener(type, listener) {
    listeners.set(type, listener);
  };
  sandbox.removeEventListener = function removeEventListener(type, listener) {
    if (listeners.get(type) === listener) listeners.delete(type);
  };
  sandbox.importScripts = function importScripts() {
    vm.runInContext(userSource, context, { filename: 'fixture-story.js' });
  };

  vm.runInContext(`${extractWorkerBootstrap(loaderSource)}\nworkerBootstrap();`, context, {
    filename: 'story-sandbox-worker-bootstrap.js'
  });

  const messageListener = listeners.get('message');
  assert.equal(typeof messageListener, 'function', 'Bootstrap не зарегистрировал обработчик message.');
  messageListener({
    data: { type: 'vnv-story-worker-init', source: 'fixture-story.js', kind, story360FormatVersion: 1 },
    ports: [{
      close() {},
      postMessage(payload) { messages.push(payload); }
    }]
  });

  return messages;
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
  assert.ok(source.includes('var STORY360_FORMAT_VERSION = 1'));
  assert.ok(source.includes('STORY360_FORMAT_VERSION: STORY360_FORMAT_VERSION'));
});

// Проверяет, что исходный объект валидируется в Worker и в канал попадает уже безопасная копия.
test('story360 проходит проверку до отправки через MessagePort', async function() {
  const messages = await runWorkerFixture(`
    window.STORY360 = {
      version: 1,
      spaces: { room: { panoramas: {} } }
    };
  `);

  assert.equal(messages.length, 1);
  assert.equal(messages[0].status, 'loaded');
  assert.equal(messages[0].kind, 'story360');
  assert.equal(messages[0].value.version, 1);
  assert.notEqual(Object.getPrototypeOf(messages[0].value), Object.prototype);
});

// Не позволяет отсутствующей или будущей версии конфигурации молча интерпретироваться как текущий формат.
test('story360 отклоняет отсутствующую и неподдерживаемую версию', async function() {
  const missingVersion = await runWorkerFixture('window.STORY360 = { spaces: {} };');
  const futureVersion = await runWorkerFixture('window.STORY360 = { version: 2, spaces: {} };');

  assert.equal(missingVersion[0].status, 'invalid');
  assert.match(missingVersion[0].message, /верс[ию]/i);
  assert.equal(futureVersion[0].status, 'invalid');
  assert.match(futureVersion[0].message, /верс[ию]/i);
});

// Закрепляет такую же проверку версии при ручном импорте файла в редактор 360°.
test('редактор 360 проверяет версию импортируемой конфигурации', async function() {
  const source = await readRuntimeFile('tools/scene360-editor.html');

  assert.ok(source.includes('var STORY360_FORMAT_VERSION = 1'));
  assert.ok(source.includes('function validateImportedStory360Version(data)'));
  assert.ok(source.includes('validateImportedStory360Version(JSON.parse(objectText))'));
});

// Закрепляет общий лимит узлов: большой массив чисел отклоняется до создания и отправки второй копии.
test('story360 отклоняет большой массив примитивов до structured clone', async function() {
  const messages = await runWorkerFixture(`
    window.STORY360 = {
      version: 1,
      spaces: { room: { values: new Array(250001).fill(0) } }
    };
  `);

  assert.equal(messages.length, 1);
  assert.equal(messages[0].status, 'invalid');
  assert.equal(Object.hasOwn(messages[0], 'value'), false);
  assert.match(messages[0].message, /слишком много элементов массива/);
});

// Проверяет, что пользовательский файл не может ослабить проверку подменой глобальных встроенных функций.
test('story360 использует сохранённые встроенные функции валидатора', async function() {
  const messages = await runWorkerFixture(`
    window.STORY360 = { version: 1, spaces: { room: { value: NaN } } };
    Array.isArray = function() { return false; };
    Number.isFinite = function() { return true; };
    Object.keys = function() { return []; };
    WeakSet.prototype.has = function() { return false; };
    WeakSet.prototype.add = function() { return this; };
  `);

  assert.equal(messages.length, 1);
  assert.equal(messages[0].status, 'invalid');
  assert.match(messages[0].message, /некорректное число/);
});

// Проверяет сохранение совместимости: fallback разрешён только для действительно отсутствующего story.js.
test('повреждённый story.js не маскируется демонстрационной историей', async function() {
  const source = await readRuntimeFile('index.html');
  const loadFunction = source.match(/function loadStoryScript\(\) \{([\s\S]*?)\n      \}/);

  assert.ok(loadFunction, 'В index.html не найдена функция loadStoryScript.');
  assert.ok(loadFunction[1].includes('result.status !== "missing"'));
  assert.ok(loadFunction[1].includes('loader.loadStoryText(STORY_EXAMPLE_SCRIPT)'));
});
