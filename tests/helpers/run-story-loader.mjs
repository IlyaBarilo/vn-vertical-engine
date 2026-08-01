import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const helperDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(helperDirectory, '..', '..');
const loaderPath = path.join(repositoryRoot, 'engine', 'story-loader.js');
let loaderSourcePromise = null;

// Используется для подавления диагностического вывода браузерного загрузчика в тестах.
function noop() {}

// Возвращает отсутствие DOM-элемента, чтобы вывод ошибки парсера не требовал настоящей страницы.
function returnNull() {
  return null;
}

// Создаёт минимальную консоль без вывода, сохраняя ожидаемые загрузчиком методы.
function createSilentConsole() {
  return {
    log: noop,
    info: noop,
    warn: noop,
    error: noop,
    debug: noop
  };
}

// Создаёт DOM-заглушку для ветки показа ошибок; успешный парсинг DOM не использует.
function createDocumentStub() {
  return {
    getElementById: returnNull,
    querySelector: returnNull
  };
}

// Копирует ошибки из VM в обычные объекты Node, чтобы сравнения не зависели от другого контекста.
function normalizeErrors(errors) {
  return Array.from(errors || []).map(function(error) {
    return {
      lineNumber: error.lineNumber,
      line: error.line,
      message: error.message,
      isCritical: error.isCritical
    };
  });
}

// Лениво читает исходник загрузчика один раз для всего набора тестов.
async function getLoaderSource() {
  if (!loaderSourcePromise) {
    loaderSourcePromise = readFile(loaderPath, 'utf8');
  }
  return loaderSourcePromise;
}

// Возвращает абсолютный путь корня репозитория для тестов документации и fixtures.
export function getRepositoryRoot() {
  return repositoryRoot;
}

// Запускает настоящий story-loader.js в изолированном окружении и возвращает STORY вместе с ошибками.
export async function runStoryLoader(storyText, options = {}) {
  const source = await getLoaderSource();
  const windowObject = {
    STORY_TEXT: String(storyText || ''),
    STORY_SCRIPT_SOURCE: options.sourceName || 'test-story.js'
  };
  const context = vm.createContext({
    window: windowObject,
    document: createDocumentStub(),
    console: createSilentConsole()
  });
  const script = new vm.Script(source, { filename: loaderPath });

  script.runInContext(context, { timeout: 5000 });

  return {
    story: windowObject.STORY || null,
    errors: normalizeErrors(windowObject.PARSE_ERRORS)
  };
}

// Извлекает STORY_TEXT из сценарного JS-файла без выполнения движка или доступа к браузеру.
export async function loadStoryTextFromScript(relativePath) {
  const scriptPath = path.resolve(repositoryRoot, relativePath);
  const source = await readFile(scriptPath, 'utf8');
  const windowObject = {};
  const script = new vm.Script(source, { filename: scriptPath });

  script.runInNewContext({ window: windowObject }, { timeout: 5000 });

  if (typeof windowObject.STORY_TEXT !== 'string') {
    throw new Error('Файл ' + relativePath + ' не записал строку в window.STORY_TEXT.');
  }

  return windowObject.STORY_TEXT;
}

// Читает текстовый fixture относительно каталога tests/fixtures.
export async function loadStoryFixture(fileName) {
  const fixturePath = path.join(repositoryRoot, 'tests', 'fixtures', fileName);
  return readFile(fixturePath, 'utf8');
}
