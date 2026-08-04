import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../../index.html', import.meta.url)));

// Перечисляет пользовательские инструменты, которые должны быть доступны в полном и update-архивах.
const requiredAuthoringTools = [
  'tools/student-project-auditor.html',
  'tools/game-tester.html',
  'tools/media-focus-editor.html',
  'tools/convert-360-img-to-css.html',
  'tools/panorama-cleaner.html',
  'tools/scene360-editor.html'
];

// Перечисляет преподавательские документы, которые должны сохраняться в полном и update-архивах.
const requiredReviewDocuments = [
  'docs/student-project-review.md'
];

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

// Извлекает статические runtime-скрипты, которые index.html должен получить до запуска inline-bootstrap.
function collectRequiredStaticScripts(indexSource) {
  const requiredScripts = [];
  const scriptPattern = /<script\s+[^>]*src="([^"]+)"[^>]*><\/script>/g;
  let match;

  while ((match = scriptPattern.exec(indexSource)) !== null) {
    requiredScripts.push(match[1]);
  }

  return requiredScripts;
}

// Проверяет существование обязательных runtime-файлов без чтения story.js и каталогов с ассетами.
test('обязательные runtime-файлы из index.html существуют', async function() {
  const indexSource = await readRepositoryFile('index.html');
  const requiredPaths = [
    'index.html',
    'engine/engine.css',
    ...collectRequiredStaticScripts(indexSource),
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
    ...collectRequiredStaticScripts(indexSource),
    ...collectRequiredEngineScripts(indexSource)
  ];

  requiredPaths.forEach(function(relativePath) {
    assert.ok(
      releaseSource.includes('[ -f ' + relativePath + ' ] && cp ' + relativePath),
      'В release.yml отсутствует копирование ' + relativePath
    );
  });
});

// Проверяет, что релизный workflow не теряет локальные инструменты подготовки проекта.
test('релизная сборка включает пользовательские инструменты', async function() {
  const releaseSource = await readRepositoryFile('.github/workflows/release.yml');

  requiredAuthoringTools.forEach(function(relativePath) {
    assert.ok(
      releaseSource.includes('[ -f ' + relativePath + ' ] && cp ' + relativePath),
      'В release.yml отсутствует копирование ' + relativePath
    );
  });
});

// Проверяет доставку инструкции преподавателя вместе с автономным аудитором.
test('релизная сборка включает документы проверки студенческих проектов', async function() {
  const releaseSource = await readRepositoryFile('.github/workflows/release.yml');

  requiredReviewDocuments.forEach(function(relativePath) {
    assert.ok(
      releaseSource.includes('[ -f ' + relativePath + ' ] && cp ' + relativePath),
      'В release.yml отсутствует копирование ' + relativePath
    );
  });
});

// Закрепляет единый helper, который сохраняет вложенные пути вместо плоского копирования файлов через shell.
test('релизная сборка сохраняет структуру каталогов ассетов', async function() {
  const releaseSource = await readRepositoryFile('.github/workflows/release.yml');

  assert.ok(releaseSource.includes('node dev/scripts/copy-release-assets.mjs'));
  assert.ok(releaseSource.includes('--source assets'));
  assert.ok(releaseSource.includes('--destination "build/$APP_NAME/assets"'));
  [
    'find assets/backgrounds',
    'find assets/characters',
    'find assets/audio',
    'find assets/games',
    'find assets/video',
    'cp -a assets/360'
  ].forEach(function(flatCopyCommand) {
    assert.equal(
      releaseSource.includes(flatCopyCommand),
      false,
      `В release.yml осталось прямое копирование без helper: ${flatCopyCommand}`
    );
  });
});

// Защищает ручную проверку сборки от случайной публикации релиза или обновления GitHub Pages.
test('ручная релизная сборка безопасна по умолчанию', async function() {
  const releaseSource = await readRepositoryFile('.github/workflows/release.yml');

  assert.match(
    releaseSource,
    /      upload_to_release:\r?\n        description:[^\r\n]+\r?\n        required: true\r?\n        default: false\r?\n        type: boolean/
  );
  assert.match(
    releaseSource,
    /      deploy_pages:\r?\n        description:[^\r\n]+\r?\n        required: true\r?\n        default: false\r?\n        type: boolean/
  );
});

// Проверяет, что пользовательский artifact появляется только после Windows smoke, а внутренняя копия живёт один день.
test('релизная сборка выдаёт проверенный artifact с ZIP и SHA-256', async function() {
  const releaseSource = await readRepositoryFile('.github/workflows/release.yml');

  assert.ok(releaseSource.includes('uses: actions/upload-artifact@v7'));
  assert.ok(releaseSource.includes('name: release-candidate-${{ github.run_id }}'));
  assert.ok(releaseSource.includes('retention-days: 1'));
  assert.ok(releaseSource.includes('name: release-zips-${{ github.run_id }}'));
  assert.ok(releaseSource.includes('${{ github.event.repository.name }}-${{ steps.version.outputs.version }}.zip'));
  assert.ok(releaseSource.includes('${{ github.event.repository.name }}-${{ steps.version.outputs.version }}.zip.sha256'));
  assert.ok(releaseSource.includes('${{ github.event.repository.name }}-${{ steps.version.outputs.version }}-update.zip'));
  assert.ok(releaseSource.includes('${{ github.event.repository.name }}-${{ steps.version.outputs.version }}-update.zip.sha256'));
  assert.ok(releaseSource.includes('if-no-files-found: error'));
  assert.ok(releaseSource.includes('retention-days: 7'));
});

// Закрепляет создание, повторную проверку и публикацию SHA-256 для всех имён релизных архивов.
test('релизный workflow создаёт и проверяет SHA-256 архивов', async function() {
  const [releaseSource, packageSource] = await Promise.all([
    readRepositoryFile('.github/workflows/release.yml'),
    readRepositoryFile('dev/package.json')
  ]);
  const packageData = JSON.parse(packageSource);
  const createPosition = releaseSource.indexOf('node dev/scripts/release-checksums.mjs create');
  const verifyPosition = releaseSource.indexOf('node dev/scripts/release-checksums.mjs verify');
  const uploadPosition = releaseSource.indexOf('- name: Upload ZIP artifacts');

  assert.ok(packageData.scripts['test:release'].includes('tests/release-checksums.test.mjs'));
  await Promise.all([
    access(path.join(repositoryRoot, 'dev/scripts/release-checksums.mjs')),
    access(path.join(repositoryRoot, 'dev/tests/release-checksums.test.mjs'))
  ]);
  assert.ok(createPosition >= 0 && verifyPosition > createPosition);
  assert.ok(uploadPosition > verifyPosition);
  assert.ok(releaseSource.includes('${APP_NAME}-latest.zip.sha256'));
  assert.ok(releaseSource.includes('${APP_NAME}-latest-update.zip.sha256'));
  assert.ok(releaseSource.includes('${{ github.event.repository.name }}-latest.zip.sha256'));
  assert.ok(releaseSource.includes('${{ github.event.repository.name }}-latest-update.zip.sha256'));
});

// Проверяет наличие проверки целостности и ключевых различий полного и update-архивов.
test('релизный workflow проверяет фактический состав ZIP', async function() {
  const releaseSource = await readRepositoryFile('.github/workflows/release.yml');

  assert.ok(releaseSource.includes('unzip -tq "${APP_NAME}-${VERSION}.zip"'));
  assert.ok(releaseSource.includes('unzip -tq "${APP_NAME}-${VERSION}-update.zip"'));
  assert.ok(releaseSource.includes('grep -Fxq "${APP_NAME}/engine/expression.js" build/full-zip-contents.txt'));
  assert.ok(releaseSource.includes('grep -Fxq "${APP_NAME}-update/engine/expression.js" build/update-zip-contents.txt'));
  assert.ok(releaseSource.includes('grep -Fxq "${APP_NAME}/engine/story-sandbox-loader.js" build/full-zip-contents.txt'));
  assert.ok(releaseSource.includes('grep -Fxq "${APP_NAME}-update/engine/story-sandbox-loader.js" build/update-zip-contents.txt'));
  assert.ok(releaseSource.includes('${APP_NAME}/tools/panorama-cleaner.html'));
  assert.ok(releaseSource.includes('${APP_NAME}-update/tools/panorama-cleaner.html'));
  assert.ok(releaseSource.includes('${APP_NAME}/tools/student-project-auditor.html'));
  assert.ok(releaseSource.includes('${APP_NAME}-update/tools/student-project-auditor.html'));
  assert.ok(releaseSource.includes('${APP_NAME}/docs/student-project-review.md'));
  assert.ok(releaseSource.includes('${APP_NAME}-update/docs/student-project-review.md'));
  assert.ok(releaseSource.includes('Полный архив содержит запрещённый панорамный JS-пакет.'));
  assert.ok(releaseSource.includes('${APP_NAME}/(dev/|tests/'));
  assert.ok(releaseSource.includes('${APP_NAME}-update/(assets/|story\\\\.js$|story-example\\\\.js$|dev/'));
  assert.ok(releaseSource.includes('node_modules/|playwright-report/|test-results/|package(-lock)?\\\\.json$|playwright\\\\.config\\\\.mjs$|docs/TESTING\\\\.md$)'));
});

// Закрепляет Windows smoke настоящего Edge и Firefox после упаковки полного ZIP и до выдачи artifact пользователю.
test('релизный workflow запускает распакованный ZIP в Edge и Firefox через HTTP и file://', async function() {
  const [releaseSource, packageSource, smokeSource] = await Promise.all([
    readRepositoryFile('.github/workflows/release.yml'),
    readRepositoryFile('dev/package.json'),
    readRepositoryFile('dev/tests/release-smoke.mjs')
  ]);
  const packageData = JSON.parse(packageSource);
  const createArchivePosition = releaseSource.indexOf('- name: Create ZIP archives');
  const edgeSmokePosition = releaseSource.indexOf('- name: Run unpacked release smoke in Microsoft Edge');
  const firefoxSmokePosition = releaseSource.indexOf('- name: Run unpacked release smoke in Firefox');
  const uploadPosition = releaseSource.indexOf('- name: Upload ZIP artifacts');
  const publishPosition = releaseSource.indexOf('- name: Upload to release');

  assert.equal(packageData.scripts['test:release:smoke'], 'node tests/release-smoke.mjs');
  await access(path.join(repositoryRoot, 'dev/tests/release-smoke.mjs'));
  assert.ok(releaseSource.includes('run: npm ci'));
  assert.ok(releaseSource.includes('runs-on: windows-latest'));
  assert.ok(releaseSource.includes('run: npx playwright install firefox'));
  assert.ok(releaseSource.includes('--browser=msedge'));
  assert.ok(releaseSource.includes('--browser=firefox'));
  assert.ok(releaseSource.includes('needs: [build, smoke-windows]'));
  assert.ok(releaseSource.includes('dev/.playwright/release-smoke/'));
  assert.ok(smokeSource.includes('pathToFileURL'));
  assert.ok(smokeSource.includes("new Set(['chromium', 'firefox', 'msedge'])"));
  assert.ok(smokeSource.includes("channel: 'msedge'"));
  assert.ok(smokeSource.includes('runFileBrowserSmoke'));
  assert.ok(smokeSource.includes('fileSmokePanoramaRelativePath'));
  assert.ok(smokeSource.includes("path.join(releaseRoot, 'tools', 'scene360-editor.html')"));
  assert.ok(smokeSource.includes("await page.reload({ waitUntil: 'domcontentloaded' })"));
  assert.ok(createArchivePosition >= 0 && edgeSmokePosition > createArchivePosition);
  assert.ok(firefoxSmokePosition > edgeSmokePosition);
  assert.ok(uploadPosition > firefoxSmokePosition);
  assert.ok(publishPosition > uploadPosition);
});

// Защищает пользовательский ZIP от каталога разработки, браузеров, отчётов и конфигурации.
test('релизная сборка не копирует каталог dev', async function() {
  const releaseSource = await readRepositoryFile('.github/workflows/release.yml');

  assert.equal(releaseSource.includes('[ -d dev ]'), false);
  assert.equal(releaseSource.includes('cp -r dev'), false);
  assert.equal(releaseSource.includes('cp -a dev'), false);
  assert.equal(releaseSource.includes('[ -d tests ]'), false);
  assert.equal(releaseSource.includes('cp -r tests'), false);
  assert.equal(releaseSource.includes('cp -a tests'), false);
  assert.equal(releaseSource.includes('cp package.json'), false);
  assert.equal(releaseSource.includes('cp package-lock.json'), false);
  assert.equal(releaseSource.includes('cp playwright.config.mjs'), false);
  assert.equal(releaseSource.includes('cp -r node_modules'), false);
  assert.equal(releaseSource.includes('cp -r playwright-report'), false);
  assert.equal(releaseSource.includes('cp -r test-results'), false);
  assert.equal(releaseSource.includes('cp docs/TESTING.md'), false);
});
