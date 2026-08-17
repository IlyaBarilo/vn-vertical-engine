import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const backgroundMediaModule = require('../../engine/background-media-controller.js');

// Имитирует classList обычных и blur media-слоёв.
function createClassList(initial = ['hidden']) {
  const values = new Set(initial);
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); }
  };
}

// Создаёт media/image элемент с управляемыми событиями и счётчиками освобождения ресурсов.
function createElementStub(initial = ['hidden']) {
  const listeners = new Map();
  return {
    src: '',
    currentSrc: '',
    currentTime: 0,
    readyState: 0,
    videoWidth: 0,
    videoHeight: 0,
    style: {},
    classList: createClassList(initial),
    playCalls: 0,
    pauseCalls: 0,
    loadCalls: 0,
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      if (listeners.has(type)) listeners.get(type).delete(callback);
    },
    dispatch(type) { for (const callback of listeners.get(type) || []) callback({ type }); },
    listenerCount(type) { return (listeners.get(type) || new Set()).size; },
    play() { this.playCalls += 1; return Promise.resolve(); },
    pause() { this.pauseCalls += 1; },
    load() { this.loadCalls += 1; },
    removeAttribute(name) { if (name === 'src') { this.src = ''; this.currentSrc = ''; } },
    setAttribute() {}
  };
}

// Собирает background controller и журналы его координаторных callback-вызовов.
function createFixture(overrides = {}) {
  const image = createElementStub();
  const video = createElementStub();
  const blurLayer = createElementStub();
  const blurImage = createElementStub();
  const blurVideo = createElementStub();
  const assignedImages = [];
  const panoramas = [];
  const hiddenStoryReasons = [];
  const duckingReasons = [];
  const volumes = [];

  const controller = backgroundMediaModule.createBackgroundMediaController({
    image,
    video,
    container: {},
    blurLayer,
    blurImage,
    blurVideo,
    failedImages: Object.create(null),
    normalizeScrollOptions(value) { return value || { is360: false }; },
    resolveAssetUrl(src, kind) { return src.startsWith('assets/') ? `file:///project/${kind}/${src}` : src.startsWith('file:///project/') ? src : ''; },
    normalizeUrl(src) { return src; },
    isVideoPath(src) { return /\.mp4$/i.test(src); },
    areAllImageCandidatesFailed() { return false; },
    assignRasterImage(element, src, callbacks) {
      element.src = src;
      assignedImages.push({ element, src });
      if (callbacks.onLoad) callbacks.onLoad(src);
    },
    isBlurEnabled() { return false; },
    showPanorama(src, fallback, scroll) { panoramas.push({ src, fallback, scroll }); },
    setBackgroundVideoVolume(value) { volumes.push(value); },
    releaseBackgroundDucking(reason) { duckingReasons.push(reason); },
    hideKeptStoryVideo(reason) { hiddenStoryReasons.push(reason); },
    // Не выводит ожидаемые ошибки синтетического video fallback в общий журнал тестов.
    warn() {},
    ...overrides
  });

  return {
    controller,
    image,
    video,
    blurLayer,
    blurImage,
    blurVideo,
    assignedImages,
    panoramas,
    hiddenStoryReasons,
    duckingReasons,
    volumes
  };
}

// Назначает обычное изображение, показывает его и обновляет blur через один controller API.
test('background media controller показывает обычный image-фон', function() {
  const fixture = createFixture({ isBlurEnabled() { return true; } });
  fixture.controller.setBackground('assets/hall.jpg', '', null, { is360: false });

  assert.equal(fixture.image.src, 'assets/hall.jpg');
  assert.equal(fixture.image.classList.contains('hidden'), false);
  assert.equal(fixture.assignedImages.length, 2);
  assert.equal(fixture.assignedImages[1].element, fixture.blurImage);
});

// Показывает видео только после loadeddata и синхронно убирает удержанный сюжетный кадр.
test('видеофон становится видимым после первого готового кадра', async function() {
  let duckingUpdated = 0;
  const fixture = createFixture({ setDuckingForActiveVideos() { duckingUpdated += 1; } });
  fixture.controller.setBackground('assets/bg.mp4', '', 0.35, { is360: false });

  assert.equal(fixture.video.classList.contains('hidden'), true);
  fixture.video.currentSrc = fixture.video.src;
  fixture.video.onloadeddata();
  await Promise.resolve();

  assert.equal(fixture.video.classList.contains('hidden'), false);
  assert.equal(fixture.image.classList.contains('hidden'), true);
  assert.equal(fixture.volumes.at(-1), 0.35);
  assert.deepEqual(fixture.hiddenStoryReasons, ['bg video loaded']);
  assert.equal(duckingUpdated, 1);
});

// При ошибке видео освобождает его и рекурсивно назначает проверенный fallback image.
test('ошибка видео переключает фон на fallback image', function() {
  const fixture = createFixture();
  fixture.controller.setBackground('assets/broken.mp4', 'assets/fallback.jpg', 0.5, { is360: false });
  fixture.video.currentSrc = fixture.video.src;
  fixture.video.onerror();

  assert.equal(fixture.image.src, 'file:///project/image/assets/fallback.jpg');
  assert.equal(fixture.video.src, '');
  assert.deepEqual(fixture.hiddenStoryReasons, ['bg video fallback image']);
  assert.ok(fixture.duckingReasons.includes('bg video load error'));
});

// Не смешивает обычные media с панорамами и передаёт 360-запрос отдельной подсистеме.
test('360-фон маршрутизируется без назначения обычных DOM-слоёв', function() {
  const fixture = createFixture();
  fixture.controller.setBackground('assets/room-360.css', 'assets/room.jpg', null, { is360: true });

  assert.equal(fixture.panoramas.length, 1);
  assert.match(fixture.panoramas[0].src, /panorama\/assets\/room-360\.css$/);
  assert.equal(fixture.image.src, '');
  assert.equal(fixture.video.src, '');
});

// Копирует позиционирование и фиксирует blur-video на первом кадре без запуска playback.
test('blur-video наследует pan/zoom основного ролика', function() {
  const fixture = createFixture({ isBlurEnabled() { return true; } });
  fixture.video.src = 'file:///project/background/assets/bg.mp4';
  fixture.video.currentSrc = fixture.video.src;
  fixture.video.style.objectPosition = '30% 40%';
  fixture.video.style.transform = 'scale(1.2)';
  fixture.blurVideo.readyState = 2;
  fixture.blurVideo.src = fixture.video.src;
  fixture.blurVideo.currentSrc = fixture.video.src;

  fixture.controller.syncBlurVideo(fixture.video, 'assets/poster.jpg');
  assert.equal(fixture.blurVideo.style.objectPosition, '30% 40%');
  assert.equal(fixture.blurVideo.style.transform, 'scale(1.2)');
  assert.equal(fixture.blurVideo.currentTime, 0);
  assert.equal(fixture.blurVideo.playCalls, 0);
});

// Снимает обработчики и освобождает оба video src при dispose.
test('dispose очищает основной и blur video lifecycle', function() {
  const fixture = createFixture({ isBlurEnabled() { return true; } });
  fixture.controller.setBackground('assets/bg.mp4', '', 0, { is360: false });
  fixture.blurVideo.src = 'file:///project/background/assets/bg.mp4';
  fixture.controller.scheduleBlurRefreshFromVideo('assets/poster.jpg');
  fixture.controller.dispose();

  assert.equal(fixture.video.src, '');
  assert.equal(fixture.blurVideo.src, '');
  assert.equal(fixture.video.onloadeddata, null);
  assert.equal(fixture.video.onerror, null);
  assert.equal(fixture.video.listenerCount('loadeddata'), 0);
});

// Имитирует синхронные сбои Media API и проверяет независимую очистку обоих video-слоёв.
test('dispose продолжает очистку после ошибок pause и load', function() {
  const fixture = createFixture({ isBlurEnabled() { return true; } });
  fixture.video.src = 'file:///project/background/assets/bg.mp4';
  fixture.blurVideo.src = fixture.video.src;
  fixture.video.pause = function throwMainPauseFailure() {
    throw new Error('main pause failed');
  };
  fixture.video.load = function throwMainLoadFailure() {
    throw new Error('main load failed');
  };
  fixture.blurVideo.pause = function throwBlurPauseFailure() {
    throw new Error('blur pause failed');
  };
  fixture.blurVideo.load = function throwBlurLoadFailure() {
    throw new Error('blur load failed');
  };

  assert.doesNotThrow(function disposeFaultedBackgroundMedia() {
    fixture.controller.dispose();
  });
  assert.equal(fixture.video.src, '');
  assert.equal(fixture.blurVideo.src, '');
  assert.equal(fixture.video.classList.contains('hidden'), true);
  assert.equal(fixture.blurVideo.classList.contains('hidden'), true);
});

// Защищает bootstrap-порядок и сохранение setBackground как тонкой координаторной функции.
test('runtime подключает background media controller до engine.js', async function() {
  const [indexSource, engineSource] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../engine/engine.js', import.meta.url), 'utf8')
  ]);

  assert.ok(indexSource.indexOf('engine/background-media-controller.js') < indexSource.indexOf('engine/engine.js'));
  assert.ok(engineSource.includes('VN_BACKGROUND_MEDIA_CONTROLLER.createBackgroundMediaController'));
  assert.ok(engineSource.includes('backgroundMediaController.setBackground(src, fallbackSrc, videoVolume, scrollOptions)'));
  assert.ok(engineSource.includes('backgroundMediaController.dispose()'));
  assert.equal(engineSource.includes('var blurBgVideoSyncSeq'), false);
});
