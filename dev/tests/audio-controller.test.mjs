import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const audioModule = require('../../engine/audio-controller.js');

// Имитирует classList media-элементов без браузерного DOM.
function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); }
  };
}

// Имитирует Audio/Video с событиями и счётчиками play/pause/load для проверки lifecycle.
function createMediaStub() {
  const listeners = new Map();
  return {
    src: '',
    currentSrc: '',
    currentTime: 0,
    volume: 1,
    muted: false,
    paused: true,
    ended: false,
    readyState: 0,
    networkState: 0,
    classList: createClassList(),
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
    dispatch(type) {
      for (const callback of listeners.get(type) || []) callback({ type });
    },
    listenerCount(type) { return (listeners.get(type) || new Set()).size; },
    play() { this.playCalls += 1; this.paused = false; return Promise.resolve(); },
    pause() { this.pauseCalls += 1; this.paused = true; },
    load() { this.loadCalls += 1; },
    removeAttribute(name) { if (name === 'src') { this.src = ''; this.currentSrc = ''; } }
  };
}

// Имитирует кнопку с единственным внутренним span и управляемым click-событием.
function createMuteButton() {
  const listeners = new Map();
  const icon = { textContent: '' };
  return {
    icon,
    innerHTML: '',
    querySelector() { return icon; },
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
    click() { if (listeners.has('click')) listeners.get('click')({ type: 'click' }); },
    listenerCount() { return listeners.size; }
  };
}

// Имитирует range input и позволяет вручную отправлять событие input.
function createVolumeSlider() {
  const listeners = new Map();
  return {
    value: '20',
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
    input() { if (listeners.has('input')) listeners.get('input')({ type: 'input' }); },
    listenerCount() { return listeners.size; }
  };
}

// Создаёт контроллер с локальными media/UI-заглушками и разрешённым assets URL.
function createFixture(overrides = {}) {
  const bgm = createMediaStub();
  const sfx = createMediaStub();
  const bgVideo = createMediaStub();
  const storyVideo = createMediaStub();
  const muteButton = createMuteButton();
  const volumeSlider = createVolumeSlider();
  const failedAudio = Object.create(null);
  const controller = audioModule.createAudioController({
    bgm,
    sfx,
    bgVideo,
    storyVideo,
    muteButton,
    volumeSlider,
    failedAudio,
    getDefaults() { return { masterVolume: 0.5, muted: false }; },
    resolveAudioUrl(src) { return src.startsWith('assets/') ? `file:///project/${src}` : ''; },
    normalizeUrl(src) { return src; },
    endsWith(value, suffix) { return value.endsWith(suffix); },
    isStoryVideoActive() { return false; },
    ...overrides
  });
  return { controller, bgm, sfx, bgVideo, storyVideo, muteButton, volumeSlider, failedAudio };
}

// Применяет defaults ко всем каналам и синхронизирует UI без прямой логики в engine.js.
test('audio controller применяет master volume, mute и индивидуальные множители', function() {
  const fixture = createFixture();
  fixture.controller.state.currentBgmVolume = 0.4;
  fixture.controller.state.currentSfxVolume = 0.8;
  fixture.controller.state.currentBgVideoVolume = 0.2;
  fixture.controller.state.currentStoryVideoVolume = 0.6;
  fixture.controller.start();
  fixture.controller.applySettings();

  assert.equal(fixture.volumeSlider.value, 50);
  assert.equal(fixture.muteButton.icon.textContent, '🔊');
  assert.equal(fixture.bgm.volume, 0.2);
  assert.equal(fixture.sfx.volume, 0.4);
  assert.equal(fixture.bgVideo.volume, 0.1);
  assert.equal(fixture.storyVideo.volume, 0.3);
});

// Использует click/input как пользовательские жесты для повторного запуска BGM и фонового видео.
test('mute и slider возобновляют media только при слышимой настройке', function() {
  const fixture = createFixture({ getDefaults() { return { masterVolume: 0.2, muted: true }; } });
  fixture.bgm.src = 'file:///project/assets/theme.ogg';
  fixture.bgVideo.src = 'file:///project/assets/bg.mp4';
  fixture.controller.start();

  fixture.muteButton.click();
  assert.equal(fixture.controller.state.muted, false);
  assert.equal(fixture.bgm.playCalls, 1);
  assert.equal(fixture.bgVideo.playCalls, 1);

  fixture.volumeSlider.value = '60';
  fixture.volumeSlider.input();
  assert.equal(fixture.controller.state.masterVolume, 0.6);
  assert.equal(fixture.bgm.playCalls, 2);
  assert.equal(fixture.bgVideo.playCalls, 2);
});

// Не назначает внешний путь и повторно использует уже активный разрешённый BGM.
test('BGM проходит ресурсную политику и не перезапускает тот же трек без необходимости', function() {
  const fixture = createFixture();
  fixture.controller.start();

  fixture.controller.playBgm('https://example.com/theme.ogg', true, 0.7, 0);
  assert.equal(fixture.bgm.src, '');

  fixture.controller.playBgm('assets/theme.ogg', true, 0.4, 0);
  assert.equal(fixture.bgm.src, 'file:///project/assets/theme.ogg');
  assert.equal(fixture.bgm.playCalls, 1);

  fixture.bgm.paused = false;
  fixture.controller.playBgm('assets/theme.ogg', false, 0.3, 0);
  assert.equal(fixture.bgm.playCalls, 1);
  assert.equal(fixture.bgm.loop, false);
});

// Помечает ошибочный BGM и исключает его из дальнейшего автоматического возобновления.
test('ошибка BGM очищает канал и сохраняет failed-cache', function() {
  const fixture = createFixture();
  fixture.controller.start();
  fixture.bgm.src = 'file:///project/assets/broken.ogg';
  fixture.bgm.currentSrc = fixture.bgm.src;
  fixture.bgm.dispatch('error');

  assert.equal(fixture.failedAudio['file:///project/assets/broken.ogg'], true);
  assert.equal(fixture.bgm.src, '');
  fixture.controller.resumeBgmIfNeeded('test');
  assert.equal(fixture.bgm.playCalls, 0);
});

// Проверяет, что исключение pause не скрывает обязательную очистку ошибочного BGM.
test('ошибка pause не прерывает очистку BGM после media error', function() {
  const fixture = createFixture();
  fixture.controller.start();
  fixture.bgm.src = 'file:///project/assets/broken.ogg';
  fixture.bgm.currentSrc = fixture.bgm.src;
  fixture.bgm.pause = function throwPauseFailure() {
    throw new Error('pause failed');
  };

  assert.doesNotThrow(function dispatchMediaError() {
    fixture.bgm.dispatch('error');
  });
  assert.equal(fixture.failedAudio['file:///project/assets/broken.ogg'], true);
  assert.equal(fixture.bgm.src, '');
  assert.equal(fixture.bgm.loadCalls, 1);
});

// Снимает все долгоживущие обработчики и останавливает оба канала при dispose.
test('dispose очищает аудиообработчики, интервалы и media-источники', function() {
  const fixture = createFixture();
  fixture.controller.start();
  fixture.bgm.src = 'file:///project/assets/theme.ogg';
  fixture.sfx.src = 'file:///project/assets/click.ogg';
  fixture.controller.dispose();

  assert.equal(fixture.bgm.listenerCount('error'), 0);
  assert.equal(fixture.muteButton.listenerCount(), 0);
  assert.equal(fixture.volumeSlider.listenerCount(), 0);
  assert.equal(fixture.bgm.src, '');
  assert.equal(fixture.sfx.src, '');
});

// Имитирует отказ одного канала и доказывает независимую очистку оставшихся media-ресурсов.
test('dispose продолжает очистку после ошибки одного media-канала', function() {
  const fixture = createFixture();
  fixture.controller.start();
  fixture.bgm.src = 'file:///project/assets/theme.ogg';
  fixture.sfx.src = 'file:///project/assets/click.ogg';
  fixture.bgm.pause = function throwPauseFailure() {
    throw new Error('pause failed');
  };

  assert.doesNotThrow(function disposeFaultedAudio() {
    fixture.controller.dispose();
  });
  assert.equal(fixture.sfx.pauseCalls, 1);
  assert.equal(fixture.bgm.src, '');
  assert.equal(fixture.sfx.src, '');
  assert.equal(fixture.muteButton.listenerCount(), 0);
});

// Защищает порядок bootstrap и отсутствие прежнего непосредственного создания основных Audio-каналов в монолите.
test('runtime подключает audio controller до engine.js и делегирует ему lifecycle', async function() {
  const [indexSource, engineSource] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../engine/engine.js', import.meta.url), 'utf8')
  ]);

  assert.ok(indexSource.indexOf('engine/audio-controller.js') < indexSource.indexOf('engine/engine.js'));
  assert.ok(engineSource.includes('VN_AUDIO_CONTROLLER.createAudioController'));
  assert.ok(engineSource.includes('audioController.dispose()'));
  assert.equal(engineSource.includes('bgm: new Audio()'), false);
  assert.equal(engineSource.includes('function crossfadeToBgm('), false);
});
