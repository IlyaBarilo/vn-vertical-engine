import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const policy = require('../../engine/resource-path-policy.js');
const repositoryRoot = path.dirname(fileURLToPath(new URL('../../index.html', import.meta.url)));

// Проверяет канонические пути во вложенных каталогах assets и допустимые расширения по типам.
test('политика принимает локальные ресурсы внутри произвольных подкаталогов assets', function() {
  assert.equal(policy.validate('assets/img/scene.png', 'image').ok, true);
  assert.equal(policy.validate('assets/custom/deep/icon.svg', 'image').ok, true);
  assert.equal(policy.validate('assets/world/hall-360-mobile.css', 'panorama').ok, true);
  assert.equal(policy.validate('assets/interactive/puzzle.html', 'game').ok, true);
  assert.equal(policy.validate('assets/media/intro.webm', 'video').ok, true);
});

// Проверяет отказ до URL-нормализации для всех форм выхода из локальной границы проекта.
test('политика отклоняет URL, абсолютные, traversal и неоднозначно закодированные пути', function() {
  const invalidPaths = [
    'https://example.test/image.png',
    '//example.test/image.png',
    '/assets/image.png',
    'C:/project/assets/image.png',
    '../assets/image.png',
    'assets/../image.png',
    'assets\\img\\image.png',
    'assets//image.png',
    'assets/img/image.png?x=1',
    'assets/img/image.png#part',
    'assets/%2e%2e/image.png',
    'other/image.png'
  ];

  for (const filePath of invalidPaths) {
    assert.equal(policy.validate(filePath, 'image').ok, false, filePath);
  }
});

// Проверяет, что тип ресурса не маскируется безопасным расположением файла.
test('политика ограничивает расширения назначением ресурса', function() {
  assert.equal(policy.validate('assets/img/picture.svg', 'image').ok, true);
  assert.equal(policy.validate('assets/img/picture.svg', 'game').ok, false);
  assert.equal(policy.validate('assets/game/puzzle.html', 'image').ok, false);
  assert.equal(policy.validate('assets/360/panorama.css', 'panorama').ok, false);
  assert.equal(policy.validate('assets/360/panorama-360.js', 'panorama').ok, false);
});

// Проверяет итоговый URL для file:// и HTTP без возможности сменить корень проекта.
test('политика разрешает путь относительно index.html и сохраняет границу проекта', function() {
  const fileResult = policy.resolve('assets/img/image.png', 'file:///E:/Novel/index.html', 'image');
  const httpResult = policy.resolve('assets/img/image.png', 'https://example.test/novel/index.html', 'image');

  assert.equal(fileResult.ok, true);
  assert.equal(fileResult.url, 'file:///E:/Novel/assets/img/image.png');
  assert.equal(httpResult.ok, true);
  assert.equal(httpResult.url, 'https://example.test/novel/assets/img/image.png');
});

// Закрепляет загрузку политики до парсера и повторную проверку в критических runtime-приёмниках.
test('парсер и runtime используют общую политику для всех типов ресурсов', async function() {
  const [indexSource, loaderSource, engineSource, storyVideoSource, backgroundMediaSource] = await Promise.all([
    readFile(path.join(repositoryRoot, 'index.html'), 'utf8'),
    readFile(path.join(repositoryRoot, 'engine', 'story-loader.js'), 'utf8'),
    readFile(path.join(repositoryRoot, 'engine', 'engine.js'), 'utf8'),
    readFile(path.join(repositoryRoot, 'engine', 'story-video-controller.js'), 'utf8'),
    readFile(path.join(repositoryRoot, 'engine', 'background-media-controller.js'), 'utf8')
  ]);
  const policyPosition = indexSource.indexOf('engine/resource-path-policy.js');
  const loaderPosition = indexSource.indexOf('engine/story-loader.js');
  const enginePosition = indexSource.indexOf('engine/engine.js');

  assert.ok(policyPosition >= 0);
  assert.ok(loaderPosition > policyPosition);
  assert.ok(enginePosition > policyPosition);
  assert.match(loaderSource, /var policy = window\.VNResourcePathPolicy/);
  assert.match(loaderSource, /policy\.validate\(String\(pathValue/);
  assert.match(storyVideoSource, /resolveAssetUrl\(action\.src, "video"\)/);
  assert.match(engineSource, /resolveRuntimeStoryAssetUrl\(action\.src, "game"\)/);
  assert.match(engineSource, /resolveRuntimeStoryAssetUrl\(src, "audio"\)/);
  assert.match(backgroundMediaSource, /resolveAssetUrl\(src, sourceKind\)/);
  assert.match(engineSource, /!isVideoAssetPath\(bgPath\) && !isBg360PackCssPath\(bgPath\) && areAllImageCandidatesFailed\(bgPath\)/);
});
