import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(new URL('../../index.html', import.meta.url)));
const require = createRequire(import.meta.url);
const panoramaModule = require(path.join(repositoryRoot, 'engine/panorama-package-controller.js'));

// Даёт Promise-очереди контроллера завершить текущие микрозадачи и короткие lifecycle-таймеры.
function waitForController(delay) {
  return new Promise(function(resolve) {
    setTimeout(resolve, delay === undefined ? 0 : delay);
  });
}

// Создаёт небольшой валидный результат строгого загрузчика без повторной проверки парсера из security-набора.
function createTestPack(mode) {
  return {
    blob: { size: 24, type: 'image/png' },
    meta: {
      schema: 'vn360-css-pack-v1',
      mode: mode || 'normal',
      type: 'image/png',
      size: 24,
      width: 2,
      height: 1,
      quality: '1',
      chunkCount: 1,
      encodedLength: 32
    }
  };
}

// Проверяет только разрешённый CSS-формат и симметричный выбор normal/mobile варианта.
test('контроллер выбирает вариант качества только после общей политики пути', function() {
  const resolvedKinds = [];
  const controller = panoramaModule.createPanoramaPackageController({
    resolveAssetUrl: function(source, kind) {
      resolvedKinds.push(kind);
      return source;
    },
    resolveEffectiveQuality: function(quality) {
      return quality === 'mobile' ? 'mobile' : 'normal';
    }
  });

  assert.equal(controller.isPackPath('assets/360/hall-360.css'), true);
  assert.equal(controller.isPackPath('assets/360/hall-360.js'), false);
  assert.equal(controller.getCssUrl('assets/360/hall-360.css', 'mobile'), 'assets/360/hall-360-mobile.css');
  assert.equal(controller.getCssUrl('assets/360/hall-360-mobile.css', 'normal'), 'assets/360/hall-360.css');
  assert.deepEqual(resolvedKinds, ['panorama', 'panorama']);
  controller.dispose();
});

// Доказывает, что параллельные потребители делят одну загрузку, а каждый Blob URL отзывается отдельно.
test('контроллер объединяет загрузку и освобождает выданный Blob URL', async function() {
  let resolvePack;
  let readCount = 0;
  let createCount = 0;
  const revoked = [];
  let readyResource = null;
  const packPromise = new Promise(function(resolve) {
    resolvePack = resolve;
  });
  const controller = panoramaModule.createPanoramaPackageController({
    resolveAssetUrl: function(source) { return source; },
    resolveEffectiveQuality: function() { return 'normal'; },
    readCssPack: function() {
      readCount++;
      return packPromise;
    },
    URL: {
      createObjectURL: function() {
        createCount++;
        return 'blob:test-' + createCount;
      },
      revokeObjectURL: function(url) {
        revoked.push(url);
      }
    }
  });

  assert.equal(controller.resolveResource('assets/360/hall-360.css', 'normal', function() {
    readyResource = controller.resolveResource('assets/360/hall-360.css', 'normal');
  }).status, 'loading');
  assert.equal(controller.resolveResource('assets/360/hall-360.css', 'normal', function() {}).status, 'loading');
  assert.equal(readCount, 1);

  resolvePack(createTestPack('normal'));
  await waitForController();
  assert.equal(readyResource.status, 'ready');
  assert.equal(readyResource.src, 'blob:test-1');
  assert.equal(createCount, 1);
  controller.releaseResource(readyResource, false);
  controller.releaseResource(readyResource, false);
  assert.deepEqual(revoked, ['blob:test-1']);
  controller.dispose();
});

// Проверяет, что dispose снимает ещё удерживаемый потребителем object URL и остаётся идемпотентным.
test('dispose освобождает незавершённый ресурс контроллера', async function() {
  const revoked = [];
  let readyResource = null;
  const controller = panoramaModule.createPanoramaPackageController({
    resolveAssetUrl: function(source) { return source; },
    resolveEffectiveQuality: function() { return 'normal'; },
    readCssPack: function() { return Promise.resolve(createTestPack('normal')); },
    URL: {
      createObjectURL: function() { return 'blob:dispose'; },
      revokeObjectURL: function(url) { revoked.push(url); }
    }
  });

  controller.resolveResource('assets/360/hall-360.css', 'normal', function() {
    readyResource = controller.resolveResource('assets/360/hall-360.css', 'normal');
  });
  await waitForController();
  assert.equal(readyResource.status, 'ready');
  controller.dispose();
  controller.dispose();
  assert.deepEqual(revoked, ['blob:dispose']);
});

// Имитирует отказ revokeObjectURL и проверяет, что dispose освобождает каждый выданный ресурс независимо.
test('dispose продолжает освобождение Blob URL после ошибки revoke', async function() {
  let createCount = 0;
  let revokeCount = 0;
  const readyResources = [];
  const controller = panoramaModule.createPanoramaPackageController({
    resolveAssetUrl: function(source) { return source; },
    resolveEffectiveQuality: function() { return 'normal'; },
    readCssPack: function() { return Promise.resolve(createTestPack('normal')); },
    URL: {
      createObjectURL: function() {
        createCount++;
        return 'blob:fault-' + createCount;
      },
      revokeObjectURL: function() {
        revokeCount++;
        throw new Error('revoke failed');
      }
    }
  });

  ['hall', 'cafe'].forEach(function resolveTestResource(name) {
    const path = `assets/360/${name}-360.css`;
    controller.resolveResource(path, 'normal', function collectReadyResource() {
      readyResources.push(controller.resolveResource(path, 'normal'));
    });
  });
  await waitForController();
  assert.equal(readyResources.length, 2);

  assert.doesNotThrow(function disposeFaultedResources() {
    controller.dispose();
  });
  assert.equal(revokeCount, 2);
  controller.releaseResource(readyResources[0], false);
  assert.equal(revokeCount, 2);
});

// Проверяет фоновую полную проверку, дедупликацию ссылок и отсутствие тяжёлого ресурса в повторном снимке.
test('очередь инспекции декодирует пакет один раз и сохраняет только результат', async function() {
  let imageCount = 0;
  const revoked = [];
  const progress = [];

  class TestImage {
    // Имитирует успешный браузерный декодер с фактическими размерами из метаданных.
    constructor() {
      imageCount++;
      this.naturalWidth = 2;
      this.naturalHeight = 1;
      this.onload = null;
      this.onerror = null;
    }

    // Запускает успешный callback асинхронно, как настоящий элемент Image.
    set src(value) {
      this.currentSrc = value;
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 0);
    }

    // Очищает тестовый источник так же, как контроллер очищает настоящий Image.
    removeAttribute(name) {
      if (name === 'src') this.currentSrc = '';
    }
  }

  const controller = panoramaModule.createPanoramaPackageController({
    window: { location: { protocol: 'file:' } },
    resolveAssetUrl: function(source) { return source; },
    resolveEffectiveQuality: function() { return 'normal'; },
    normalizeUrl: function(source) { return source; },
    readCssPack: function() { return Promise.resolve(createTestPack('normal')); },
    Image: TestImage,
    URL: {
      createObjectURL: function() { return 'blob:inspection'; },
      revokeObjectURL: function(url) { revoked.push(url); }
    },
    onInspectionProgress: function(value) {
      progress.push({ completed: value.completed, total: value.total });
    }
  });
  const references = [{
    path: 'assets/360/hall-360.css',
    quality: 'normal',
    refs: ['scene:a', 'scene:a', 'scene:b']
  }];

  const queued = controller.checkReferences(references);
  assert.equal(queued.length, 1);
  assert.deepEqual(queued[0].refs, ['scene:a', 'scene:b']);
  await waitForController(120);
  const verified = controller.checkReferences(references);
  assert.equal(verified[0].status, 'verified');
  assert.equal(verified[0].meta.width, 2);
  assert.equal(imageCount, 1);
  assert.deepEqual(revoked, ['blob:inspection']);
  assert.ok(progress.some(function(item) { return item.completed === 1 && item.total === 1; }));
  controller.dispose();
});
