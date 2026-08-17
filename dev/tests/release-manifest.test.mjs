import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  RELEASE_FORMAT_VERSIONS,
  RELEASE_MANIFEST_SCHEMA_VERSION,
  createReleaseManifest,
  verifyReleaseManifest
} from '../scripts/release-manifest.mjs';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../../index.html', import.meta.url)));

/**
 * Создаёт временный релизный runtime и удаляет его после теста.
 */
async function createTemporaryRelease(testContext) {
  const releaseRoot = await mkdtemp(path.join(tmpdir(), 'vn-release-manifest-'));
  testContext.after(async function() {
    await rm(releaseRoot, { recursive: true, force: true });
  });

  await mkdir(path.join(releaseRoot, 'engine'), { recursive: true });
  await mkdir(path.join(releaseRoot, 'lib'), { recursive: true });
  await writeFile(path.join(releaseRoot, 'index.html'), '<!doctype html>\n', 'utf8');
  await writeFile(path.join(releaseRoot, 'engine', 'engine.js'), 'window.APP_VERSION = "v1.2.3";\n', 'utf8');
  await writeFile(path.join(releaseRoot, 'engine', 'engine.css'), ':root {}\n', 'utf8');
  await writeFile(path.join(releaseRoot, 'lib', 'runtime.js'), 'window.RUNTIME = true;\n', 'utf8');
  return releaseRoot;
}

/**
 * Возвращает одинаковые параметры синтетической сборки для создания и проверки.
 */
function createManifestOptions(releaseRoot, overrides = {}) {
  return {
    releaseRoot,
    engineVersion: 'v1.2.3',
    commit: 'a'.repeat(40),
    nodeTests: true,
    windowsSmoke: true,
    ...overrides
  };
}

/**
 * Вычисляет независимый SHA-256 небольшого fixture для проверки результата helper.
 */
function calculateFixtureSha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Извлекает числовую версию из runtime-источника, чтобы константы генератора не расходились с кодом.
 */
function extractRuntimeVersion(source, pattern, description) {
  const match = source.match(pattern);
  assert.ok(match, `Не найдена версия ${description}.`);
  return Number(match[1]);
}

// Проверяет метаданные, профиль релиза и хеши общего runtime без включения пользовательских ассетов.
test('release-manifest описывает готовый runtime и версии форматов', async function(testContext) {
  const releaseRoot = await createTemporaryRelease(testContext);
  const options = createManifestOptions(releaseRoot);
  const { manifest, manifestPath } = await createReleaseManifest(options);

  assert.equal(manifest.schemaVersion, RELEASE_MANIFEST_SCHEMA_VERSION);
  assert.equal(manifest.engineVersion, 'v1.2.3');
  assert.equal(manifest.commit, 'a'.repeat(40));
  assert.deepEqual(manifest.formats, RELEASE_FORMAT_VERSIONS);
  assert.deepEqual(manifest.verification, {
    nodeTests: true,
    windowsReleaseSmoke: true,
    browsers: ['Microsoft Edge', 'Firefox']
  });
  assert.deepEqual(Object.keys(manifest.files), [
    'engine/engine.css',
    'engine/engine.js',
    'index.html',
    'lib/runtime.js'
  ]);
  assert.deepEqual(manifest.files['engine/engine.js'], {
    sha256: calculateFixtureSha256('window.APP_VERSION = "v1.2.3";\n'),
    size: Buffer.byteLength('window.APP_VERSION = "v1.2.3";\n')
  });
  assert.deepEqual(JSON.parse(await readFile(manifestPath, 'utf8')), manifest);
  assert.deepEqual(await verifyReleaseManifest(options), manifest);
});

// Подтверждает, что изменение runtime после создания манифеста обнаруживается до упаковки ZIP.
test('release-manifest отклоняет изменённый runtime-файл', async function(testContext) {
  const releaseRoot = await createTemporaryRelease(testContext);
  const options = createManifestOptions(releaseRoot);
  await createReleaseManifest(options);
  await writeFile(path.join(releaseRoot, 'engine', 'engine.js'), 'tampered\n', 'utf8');

  await assert.rejects(
    verifyReleaseManifest(options),
    /не соответствует готовому runtime/
  );
});

// Защищает манифест от ложной отметки проверки и сокращённого Git hash.
test('release-manifest требует явный профиль и полный commit', async function(testContext) {
  const releaseRoot = await createTemporaryRelease(testContext);

  await assert.rejects(
    createReleaseManifest(createManifestOptions(releaseRoot, { nodeTests: 'yes' })),
    /node-tests должен быть true или false/
  );
  await assert.rejects(
    createReleaseManifest(createManifestOptions(releaseRoot, { commit: 'abcdef1' })),
    /полным Git hash/
  );
});

// Сверяет публичные версии форматов с их фактическими константами и схемой CSS-пакета.
test('версии форматов release-manifest соответствуют runtime', async function() {
  const [storyLoaderSource, storySandboxSource, gameProtocolSource, panoramaSource] = await Promise.all([
    readFile(path.join(repositoryRoot, 'engine', 'story-loader.js'), 'utf8'),
    readFile(path.join(repositoryRoot, 'engine', 'story-sandbox-loader.js'), 'utf8'),
    readFile(path.join(repositoryRoot, 'engine', 'game-protocol.js'), 'utf8'),
    readFile(path.join(repositoryRoot, 'engine', 'panorama-package-controller.js'), 'utf8')
  ]);

  assert.equal(
    RELEASE_FORMAT_VERSIONS.storyDsl,
    extractRuntimeVersion(storyLoaderSource, /VN_STORY_DSL_VERSION\s*=\s*(\d+)/, 'Story DSL')
  );
  assert.equal(
    RELEASE_FORMAT_VERSIONS.story360,
    extractRuntimeVersion(storySandboxSource, /STORY360_FORMAT_VERSION\s*=\s*(\d+)/, 'STORY360')
  );
  assert.equal(
    RELEASE_FORMAT_VERSIONS.gameProtocol,
    extractRuntimeVersion(gameProtocolSource, /GAME_PROTOCOL_VERSION\s*=\s*(\d+)/, 'игрового протокола')
  );
  assert.equal(
    RELEASE_FORMAT_VERSIONS.panoramaCss,
    extractRuntimeVersion(panoramaSource, /CSS_PACK_FORMAT_VERSION\s*=\s*(\d+)/, 'Panorama CSS')
  );
  assert.ok(panoramaSource.includes('"vn360-css-pack-v" + CSS_PACK_FORMAT_VERSION'));
});
