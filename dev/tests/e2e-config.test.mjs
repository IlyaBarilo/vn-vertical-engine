import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../../index.html', import.meta.url)));

// Читает developer-файл относительно корня репозитория для статической проверки E2E-контура.
function readRepositoryFile(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

// Проверяет существование одного файла E2E-контура относительно корня репозитория.
function accessRepositoryFile(relativePath) {
  return access(path.join(repositoryRoot, relativePath));
}

// Исполняет реальную конфигурацию с нейтральным defineConfig, чтобы Node CI не требовал установки Playwright.
async function readEvaluatedConfig(softwareWebGl) {
  const source = await readRepositoryFile('dev/playwright.config.mjs');
  const context = vm.createContext({
    process: { env: { VN_E2E_FIREFOX_SOFTWARE_WEBGL: softwareWebGl } },
    // defineConfig сохраняет заданные поля; проверяем вычисление env и вложенность параметров запуска.
    defineConfig(config) { return config; }
  });
  const executableSource = source
    .replace(/^import \{ defineConfig \} from '@playwright\/test';\r?\n/m, '')
    .replace('export default defineConfig(', 'globalThis.config = defineConfig(');
  new vm.Script(executableSource, { filename: 'dev/playwright.config.mjs' }).runInContext(context, { timeout: 1000 });
  return JSON.parse(JSON.stringify(context.config));
}

// Не позволяет корректному имени Firefox pref скрыть неверный уровень use, на котором браузер его игнорирует.
test('Firefox получает программный WebGL через launchOptions только при явном флаге', async function() {
  for (const flag of ['1', '0', undefined]) {
    const config = await readEvaluatedConfig(flag);
    // Находит проект Firefox для проверки реально вычисленного профиля запуска.
    const firefox = config.projects.find(function findFirefox(project) { return project.name === 'firefox'; });
    // Выбирает Chromium, чтобы Firefox-флаг не затрагивал настройки другого браузера.
    const chromium = config.projects.find(function findChromium(project) { return project.name === 'chromium'; });
    assert.equal(Object.hasOwn(firefox.use, 'firefoxUserPrefs'), false);
    assert.deepEqual(firefox.use.launchOptions.firefoxUserPrefs,
      flag === '1' ? { 'webgl.forbid-software': false } : undefined);
    assert.deepEqual(chromium.use, { browserName: 'chromium' });
  }
});

// Проверяет наличие конфигурации, синтетических fixtures и отдельных npm-команд Playwright.
test('браузерный E2E-набор полностью описан в репозитории', async function() {
  const [packageSource, configSource, engineSpecSource] = await Promise.all([
    readRepositoryFile('dev/package.json'),
    readRepositoryFile('dev/playwright.config.mjs'),
    readRepositoryFile('dev/tests/e2e/engine.spec.mjs')
  ]);
  const packageData = JSON.parse(packageSource);
  const requiredFiles = [
    'dev/playwright.config.mjs',
    'dev/tests/e2e/engine.spec.mjs',
    'dev/tests/e2e/fixtures/story-fixture.js',
    'dev/tests/e2e/fixtures/game.html',
    'dev/tests/e2e/fixtures/legacy-game.html'
  ];

  assert.equal(packageData.scripts['test:e2e'], 'playwright test');
  assert.equal(packageData.scripts['test:e2e:headed'], 'playwright test --headed');
  assert.equal(packageData.scripts['browser:install'], 'playwright install chromium firefox');
  assert.equal(packageData.devDependencies['@playwright/test'], '1.62.1');
  assert.match(configSource, /name:\s*'chromium'[\s\S]+browserName:\s*'chromium'/);
  assert.match(configSource, /name:\s*'firefox'[\s\S]+browserName:\s*'firefox'/);
  assert.match(configSource, /VN_E2E_FIREFOX_SOFTWARE_WEBGL/);
  assert.match(configSource, /'webgl\.forbid-software':\s*false/);
  assert.match(configSource, /baseURL:\s*'http:\/\/127\.0\.0\.1:41739'/);
  assert.match(engineSpecSource, /createServer\(function serveE2eRequest/);
  assert.match(engineSpecSource, /handleEngineHttpRequest\(request, response\)/);
  await Promise.all(requiredFiles.map(accessRepositoryFile));
});

// Защищает обязательные шаги кроссбраузерной проверки и выдачу диагностического отчёта при сбое.
test('GitHub Actions запускает браузерные E2E-тесты', async function() {
  const workflowSource = await readRepositoryFile('.github/workflows/tests.yml');

  assert.ok(workflowSource.includes('name: Browser E2E'));
  assert.ok(workflowSource.includes('fail-fast: false'));
  assert.ok(workflowSource.includes('- chromium'));
  assert.ok(workflowSource.includes('- firefox'));
  assert.ok(workflowSource.includes('run: npm ci'));
  assert.ok(workflowSource.includes('run: npx playwright install --with-deps ${{ matrix.browser }}'));
  assert.ok(workflowSource.includes('run: npm run test:e2e -- --project=chromium'));
  assert.ok(workflowSource.includes('run: xvfb-run --auto-servernum npm run test:e2e -- --project=firefox --headed'));
  assert.ok(workflowSource.includes('LIBGL_ALWAYS_SOFTWARE: "1"'));
  assert.ok(workflowSource.includes('VN_E2E_FIREFOX_SOFTWARE_WEBGL: "1"'));
  assert.ok(workflowSource.includes('cache-dependency-path: dev/package-lock.json'));
  assert.ok(workflowSource.includes('working-directory: dev'));
  assert.ok(workflowSource.includes('browser-e2e-report-${{ matrix.browser }}-${{ github.run_id }}'));
  assert.ok(workflowSource.includes('dev/.playwright/report/'));
  assert.ok(workflowSource.includes('dev/.playwright/test-results/'));
  assert.ok(workflowSource.includes('uses: actions/upload-artifact@v7'));
  assert.ok(workflowSource.includes('if: failure()'));
});
