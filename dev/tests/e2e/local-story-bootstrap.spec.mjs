import { expect, test } from '@playwright/test';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const fixtureParent = path.join(repositoryRoot, 'dev/.playwright/local-story');
let fixtureRoot;
let indexSource;

// Установленный Firefox иначе ослабляет локальные origin и скрывает несовместимость автономного запуска.
test.use({ launchOptions: { firefoxUserPrefs: { 'security.fileuri.strict_origin_policy': true } } });

// Создаёт небольшой полноценный сценарий без медиа, чтобы проверить настоящий bootstrap и переходы.
function createStory(text) {
  const story = '[meta]\ntitle = Local story\nlang = ru\nstartScene = intro\nautosave = false\ntransition = none\n[scene]\nscene intro\n"' + text + '"\n"Дальше"';
  return 'window.STORY_TEXT = ' + JSON.stringify(story) + ';\n';
}

// Записывает только синтетические файлы внутри тестовой копии с обязательными окончаниями CRLF.
async function writeFixture(name, text) {
  await writeFile(path.join(fixtureRoot, name), text.replace(/\r?\n/g, '\r\n'), 'utf8');
}

// Копирует настоящий runtime без пользовательских сценариев; запросы file:// не перехватываются.
test.beforeAll(async function prepareLocalStory() {
  await mkdir(fixtureParent, { recursive: true });
  fixtureRoot = await mkdtemp(path.join(fixtureParent, 'project-'));
  for (const name of ['index.html', 'engine', 'lib']) {
    await cp(path.join(repositoryRoot, name), path.join(fixtureRoot, name), { recursive: true });
  }
  indexSource = await readFile(path.join(fixtureRoot, 'index.html'), 'utf8');
});

// Каждый тест получает исходный bootstrap, исправный основной сценарий и узнаваемый пример.
test.beforeEach(async function resetLocalStory() {
  await writeFixture('index.html', indexSource);
  await writeFixture('story.js', createStory('Основной сценарий'));
  await writeFixture('story-example.js', createStory('Демонстрационный пример'));
  await rm(path.join(fixtureRoot, 'story360.js'), { force: true });
});

// Удаляет только созданную тестом копию внутри заранее известного каталога.
test.afterAll(async function cleanLocalStory() {
  if (fixtureRoot && path.dirname(fixtureRoot) === fixtureParent && path.basename(fixtureRoot).startsWith('project-')) {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

// Открывает тестовую копию двойным кликом по смыслу протокола, без локального сервера.
async function openLocalStory(page) {
  await page.goto(pathToFileURL(path.join(fixtureRoot, 'index.html')).href);
}

// Доказывает обычное выполнение обоих JS в странице, работу перехода, перезапуска и чтение правок после F5.
test('file://: обычные story.js и story360.js, переход, перезапуск и F5', async function({ page }) {
  await writeFixture('story.js', 'document.body.dataset.storyMode = "direct";\n' + createStory('Основной сценарий'));
  await writeFixture('story360.js', 'document.body.dataset.mapMode = "direct"; window.STORY360 = { version: 1, spaces: { room: { panoramas: {} } } };');
  const errors = [];
  page.on('pageerror', function recordPageError(error) { errors.push(error.message); });
  await openLocalStory(page);
  await expect(page.locator('#textBox')).toHaveText('Основной сценарий');
  expect(await page.evaluate(function readDirectState() {
    return {
      story: document.body.dataset.storyMode,
      map: document.body.dataset.mapMode,
      source: window.STORY_SCRIPT_SOURCE,
      mapSource: window.STORY360_SCRIPT_SOURCE,
      nullPrototype: Object.getPrototypeOf(window.STORY360.spaces) === null,
      workerRetained: typeof window.VNStorySandboxLoader.loadStoryText === 'function'
    };
  })).toEqual({ story: 'direct', map: 'direct', source: 'story.js', mapSource: 'story360.js', nullPrototype: true, workerRetained: true });
  await page.waitForTimeout(350);
  await page.locator('#dialog').click();
  await expect(page.locator('#textBox')).toHaveText('Дальше');
  await page.locator('#btnRestart').click();
  await expect(page.locator('#textBox')).toHaveText('Основной сценарий');
  await writeFixture('story.js', createStory('Сценарий после изменения'));
  await writeFixture('story360.js', 'window.STORY360 = { version: 1, spaces: { updated: { panoramas: {} } } };');
  await page.reload();
  await expect(page.locator('#textBox')).toHaveText('Сценарий после изменения');
  expect(await page.evaluate(function readUpdatedMap() { return Object.keys(window.STORY360.spaces); })).toEqual(['updated']);
  expect(errors).toEqual([]);
});

// Отсутствующий основной файл допускает пример, а отсутствие необязательной карты не мешает запуску.
test('file://: отсутствующий story.js запускает пример без story360.js', async function({ page }) {
  await rm(path.join(fixtureRoot, 'story.js'));
  await openLocalStory(page);
  await expect(page.locator('#textBox')).toHaveText('Демонстрационный пример');
  expect(await page.evaluate(function readFallbackSource() { return window.STORY_SCRIPT_SOURCE; })).toBe('story-example.js');
});

for (const [label, source] of [
  ['не создал строку', 'window.STORY_TEXT = 42;'],
  ['синтаксическая ошибка', 'window.STORY_TEXT = ;'],
  ['исключение после присваивания', createStory('Частично загружен') + 'throw new Error("ошибка сценария");']
]) {
  // Повреждённый существующий файл никогда не заменяется корректным примером.
  test(`file://: story.js ${label}`, async function({ page }) {
    await writeFixture('story.js', source);
    await openLocalStory(page);
    await expect(page.locator('#textBox')).toContainText('файл story.js отсутствует или содержит ошибку');
    expect(await page.evaluate(function readFailedStory() {
      return { source: window.STORY_SCRIPT_SOURCE || '', ready: window.VN_ENGINE_READY === true, partial: typeof window.STORY_TEXT === 'string' };
    })).toEqual({ source: '', ready: false, partial: false });
  });
}

// Ошибка резервного сценария должна указывать именно его, когда основной файл недоступен.
test('file://: отсутствующие сценарий и пример дают имя story-example.js', async function({ page }) {
  await rm(path.join(fixtureRoot, 'story.js'));
  await rm(path.join(fixtureRoot, 'story-example.js'));
  await openLocalStory(page);
  await expect(page.locator('#textBox')).toContainText('файл story-example.js отсутствует или содержит ошибку');
});

for (const [label, source] of [
  ['неизвестная версия', 'window.STORY360 = { version: 2, spaces: {} };'],
  ['опасный ключ', 'window.STORY360 = JSON.parse(\'{"version":1,"spaces":{"__proto__":{}}}\');'],
  ['исключение после присваивания', 'window.STORY360 = { version: 1, spaces: {} }; throw new Error("ошибка карты");']
]) {
  // Некорректная необязательная карта очищается и не блокирует обычные сцены.
  test(`file://: story360.js ${label}`, async function({ page }) {
    const warnings = [];
    page.on('console', function recordWarning(message) {
      if (message.type() === 'warning') warnings.push(message.text());
    });
    await writeFixture('story360.js', source);
    await openLocalStory(page);
    await expect(page.locator('#textBox')).toHaveText('Основной сценарий');
    expect(await page.evaluate(function readInvalidMap() { return Boolean(window.STORY360); })).toBe(false);
    expect(warnings.some(function isMapWarning(message) { return message.includes('[Bootstrap] story360.js отключён:'); })).toBe(true);
  });
}

// Режим direct не зависит от наличия Worker, а явно выбранный worker не переключается на исполнение в странице при ошибке.
test('file://: direct работает без Worker, сохранённый worker не делает неявный fallback', async function({ page }) {
  await page.addInitScript(function rejectWorkerCreation() {
    window.Worker = function unavailableWorker() { throw new Error('Worker недоступен для проверки'); };
  });
  await openLocalStory(page);
  await expect(page.locator('#textBox')).toHaveText('Основной сценарий');
  await writeFixture('index.html', indexSource.replace('var STORY_SCRIPT_LOAD_MODE = "direct";', 'var STORY_SCRIPT_LOAD_MODE = "worker";'));
  await page.reload();
  await expect(page.locator('#textBox')).toHaveText('Не удалось запустить новеллу. Проверьте файлы проекта.');
  expect(await page.evaluate(function readWorkerFailure() { return typeof window.STORY_TEXT; })).toBe('undefined');
});
