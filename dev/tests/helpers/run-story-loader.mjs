import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const helperDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(helperDirectory, '..', '..', '..');
const resourcePathPolicyPath = path.join(repositoryRoot, 'engine', 'resource-path-policy.js');
const expressionPath = path.join(repositoryRoot, 'engine', 'expression.js');
const loaderPath = path.join(repositoryRoot, 'engine', 'story-loader.js');
let runtimeSourcesPromise = null;

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

// Копирует счётчики загрузчика из VM, исключая временные метки профилирования.
function normalizeLoaderStats(stats) {
  const source = stats || {};
  return {
    scenesCount: source.scenesCount || 0,
    actionsCount: source.actionsCount || 0,
    charactersCount: source.charactersCount || 0,
    backgroundsCount: source.backgroundsCount || 0,
    audioCount: source.audioCount || 0,
    gamesCount: source.gamesCount || 0,
    videosCount: source.videosCount || 0
  };
}

// Лениво читает общий expression-модуль и загрузчик в том же порядке, что используется браузером.
async function getLoaderRuntimeSources() {
  if (!runtimeSourcesPromise) {
    runtimeSourcesPromise = Promise.all([
      readFile(resourcePathPolicyPath, 'utf8'),
      readFile(expressionPath, 'utf8'),
      readFile(loaderPath, 'utf8')
    ]);
  }
  return runtimeSourcesPromise;
}

// Возвращает абсолютный путь корня репозитория для тестов документации и fixtures.
export function getRepositoryRoot() {
  return repositoryRoot;
}

// Запускает настоящий story-loader.js и возвращает STORY, версию DSL, ошибки и стабильные счётчики.
export async function runStoryLoader(storyText, options = {}) {
  const sources = await getLoaderRuntimeSources();
  const windowObject = {
    STORY_TEXT: String(storyText || ''),
    STORY_SCRIPT_SOURCE: options.sourceName || 'test-story.js'
  };
  const context = vm.createContext({
    window: windowObject,
    document: createDocumentStub(),
    console: createSilentConsole()
  });
  const resourcePathPolicyScript = new vm.Script(sources[0], { filename: resourcePathPolicyPath });
  const expressionScript = new vm.Script(sources[1], { filename: expressionPath });
  const loaderScript = new vm.Script(sources[2], { filename: loaderPath });

  resourcePathPolicyScript.runInContext(context, { timeout: 5000 });
  expressionScript.runInContext(context, { timeout: 5000 });
  loaderScript.runInContext(context, { timeout: 5000 });

  return {
    story: windowObject.STORY || null,
    dslVersion: windowObject.VN_STORY_DSL_VERSION,
    errors: normalizeErrors(windowObject.PARSE_ERRORS),
    stats: normalizeLoaderStats(windowObject.LOADER_STATS)
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

// Читает текстовый fixture относительно каталога dev/tests/fixtures.
export async function loadStoryFixture(fileName) {
  const fixturePath = path.join(repositoryRoot, 'dev', 'tests', 'fixtures', fileName);
  return readFile(fixturePath, 'utf8');
}
