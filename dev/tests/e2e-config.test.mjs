import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
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
  assert.match(configSource, /baseURL:\s*'http:\/\/127\.0\.0\.1:41739'/);
  assert.match(engineSpecSource, /createServer\(function serveE2eRequest/);
  assert.match(engineSpecSource, /handleEngineHttpRequest\(request, response\)/);
  await Promise.all(requiredFiles.map(accessRepositoryFile));
});

// Защищает обязательные шаги кроссбраузерной проверки и выдачу диагностического отчёта при сбое.
test('GitHub Actions запускает браузерные E2E-тесты', async function() {
  const workflowSource = await readRepositoryFile('.github/workflows/tests.yml');

  assert.ok(workflowSource.includes('name: Browser E2E'));
  assert.ok(workflowSource.includes('run: npm ci'));
  assert.ok(workflowSource.includes('run: npx playwright install --with-deps chromium firefox'));
  assert.ok(workflowSource.includes('run: npm run test:e2e'));
  assert.ok(workflowSource.includes('cache-dependency-path: dev/package-lock.json'));
  assert.ok(workflowSource.includes('working-directory: dev'));
  assert.ok(workflowSource.includes('dev/.playwright/report/'));
  assert.ok(workflowSource.includes('dev/.playwright/test-results/'));
  assert.ok(workflowSource.includes('uses: actions/upload-artifact@v7'));
  assert.ok(workflowSource.includes('if: failure()'));
});
