// Экспортирует аудиоканалы, настройки громкости и lifecycle обработчиков для браузерного runtime.
(function(root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VN_AUDIO_CONTROLLER = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createAudioControllerModule() {
  "use strict";

  var DEFAULT_BGM_VOLUME = 0.2;
  var DEFAULT_BGM_DUCKING_MULTIPLIER = 0;
  var DEFAULT_BGM_DUCKING_ATTACK_MS = 250;
  var DEFAULT_BGM_DUCKING_RELEASE_MS = 450;

  // Ограничивает число заданным диапазоном без зависимости от утилит центрального runtime.
  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // Выполняет линейную интерполяцию, используемую обоими видами аудиопереходов.
  function lerpNumber(start, end, progress) {
    return start + (end - start) * progress;
  }

  // Создаёт контроллер двух аудиоканалов и связывает его только с переданными DOM-элементами и callback-функциями.
  function createAudioController(options) {
    options = options || {};

    var AudioConstructor = options.AudioConstructor;
    if (typeof AudioConstructor !== "function" && typeof Audio === "function") {
      AudioConstructor = Audio;
    }
    if (typeof AudioConstructor !== "function" && (!options.bgm || !options.sfx)) {
      throw new Error("Audio controller requires AudioConstructor or prepared media channels");
    }

    var bgm = options.bgm || new AudioConstructor();
    var sfx = options.sfx || new AudioConstructor();
    var bgVideo = options.bgVideo || null;
    var storyVideo = options.storyVideo || null;
    var muteButton = options.muteButton || null;
    var volumeSlider = options.volumeSlider || null;
    var failedAudio = options.failedAudio || Object.create(null);
    var setIntervalFn = options.setInterval || setInterval;
    var clearIntervalFn = options.clearInterval || clearInterval;
    var started = false;
    var disposed = false;

    var state = {
      bgm: bgm,
      sfx: sfx,
      muted: true,
      masterVolume: 0.2,
      currentBgVideoVolume: 0,
      currentStoryVideoVolume: 0,
      bgmDuckingMultiplier: 1,
      bgmDuckingTimer: null,
      fadeTimer: null
    };

    // Использует внедрённую функцию диапазона, сохраняя возможность изолированного тестирования контроллера.
    function clamp(value, min, max) {
      return typeof options.clamp === "function"
        ? options.clamp(value, min, max)
        : clampNumber(value, min, max);
    }

    // Использует runtime-интерполяцию либо эквивалентную локальную реализацию.
    function lerp(start, end, progress) {
      return typeof options.lerp === "function"
        ? options.lerp(start, end, progress)
        : lerpNumber(start, end, progress);
    }

    // Передаёт подробное сообщение координатору, не включая диагностику самостоятельно.
    function verbose() {
      if (typeof options.writeVerbose === "function") {
        options.writeVerbose.apply(null, arguments);
      }
    }

    // Выводит предупреждение через переданный logger или браузерную консоль.
    function warn() {
      if (typeof options.warn === "function") {
        options.warn.apply(null, arguments);
      } else if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn.apply(console, arguments);
      }
    }

    // Возвращает безопасное диагностическое представление ресурса через политику координатора.
    function sanitizeResource(value) {
      return typeof options.sanitizeResource === "function" ? options.sanitizeResource(value) : String(value || "");
    }

    // Нормализует URL тем же способом, которым центральный runtime сравнивает уже назначенные media.src.
    function normalizeUrl(value) {
      return typeof options.normalizeUrl === "function" ? options.normalizeUrl(value) : String(value || "");
    }

    // Проверяет, что путь сценария разрешён общей политикой локальных ресурсов.
    function resolveAudioUrl(value) {
      return typeof options.resolveAudioUrl === "function" ? options.resolveAudioUrl(value) : String(value || "");
    }

    // Сравнивает хвосты URL совместимо с прежней проверкой того же BGM-трека.
    function urlEndsWith(value, suffix) {
      if (typeof options.endsWith === "function") return options.endsWith(value, suffix);
      return String(value || "").slice(-String(suffix || "").length) === String(suffix || "");
    }

    // Определяет, включена ли подробная аудиодиагностика, не зная о query-параметрах движка.
    function isAudioDebugEnabled() {
      return typeof options.isAudioDebugEnabled === "function" && options.isAudioDebugEnabled();
    }

    // Записывает компактный снимок состояния BGM только по явному запросу аудиодиагностики.
    function logState(label) {
      if (!isAudioDebugEnabled() || typeof console === "undefined") return;
      console.log("[AUDIO STATE]", label, {
        muted: state.muted,
        masterVolume: state.masterVolume,
        currentBgmVolume: state.currentBgmVolume,
        bgmVolume: bgm ? bgm.volume : null,
        bgmSrc: bgm ? sanitizeResource(bgm.src) : null,
        bgmPaused: bgm ? bgm.paused : null,
        bgmEnded: bgm ? bgm.ended : null,
        bgmCurrentTime: bgm ? bgm.currentTime : null,
        bgmReadyState: bgm ? bgm.readyState : null,
        bgmNetworkState: bgm ? bgm.networkState : null
      });
    }

    // Обновляет иконку без предположения, что внутренний span уже присутствует в HTML.
    function updateMuteIcon() {
      if (!muteButton || typeof muteButton.querySelector !== "function") return;
      var icon = muteButton.querySelector(".btn-icon");
      if (!icon) {
        muteButton.innerHTML = "<span class='btn-icon'></span>";
        icon = muteButton.querySelector(".btn-icon");
      }
      if (icon) icon.textContent = state.muted ? "🔇" : "🔊";
    }

    // Применяет master/mute и индивидуальные множители ко всем обычным media-каналам движка.
    function applySettings() {
      var master = state.muted ? 0 : state.masterVolume;
      bgm.volume = clamp(
        (state.currentBgmVolume != null ? state.currentBgmVolume : 0.7) *
          master *
          (state.bgmDuckingMultiplier != null ? state.bgmDuckingMultiplier : 1),
        0,
        1
      );
      sfx.volume = clamp((state.currentSfxVolume != null ? state.currentSfxVolume : 1) * master, 0, 1);

      if (bgVideo) {
        var bgMultiplier = clamp(state.currentBgVideoVolume != null ? state.currentBgVideoVolume : 0, 0, 1);
        var bgVolume = clamp(master * bgMultiplier, 0, 1);
        bgVideo.muted = state.muted || bgVolume <= 0;
        bgVideo.volume = bgVolume;
      }

      if (storyVideo) {
        var storyMultiplier = clamp(state.currentStoryVideoVolume != null ? state.currentStoryVideoVolume : 0, 0, 1);
        var storyVolume = clamp(master * storyMultiplier, 0, 1);
        storyVideo.muted = state.muted || storyVolume <= 0;
        storyVideo.volume = storyVolume;
      }

      logState("applyAudioSettings");
    }

    // Загружает исходные mute/masterVolume из STORY и синхронизирует элементы управления.
    function setFromDefaults() {
      var defaults = typeof options.getDefaults === "function" ? options.getDefaults() : null;
      if (defaults) {
        if (typeof defaults.masterVolume === "number") {
          state.masterVolume = clamp(defaults.masterVolume, 0, 1);
        }
        if (typeof defaults.muted === "boolean") {
          state.muted = defaults.muted;
        }
      }

      if (volumeSlider) volumeSlider.value = Math.round(state.masterVolume * 100);
      applySettings();
      updateMuteIcon();
    }

    // Плавно переводит множитель BGM ducking к цели и отменяет предыдущий незавершённый переход.
    function setBgmDuckingTarget(targetMultiplier, fadeMs, reason) {
      var target = clamp(typeof targetMultiplier === "number" ? targetMultiplier : 1, 0, 1);
      var duration = Math.max(0, Math.floor(typeof fadeMs === "number" ? fadeMs : 0));

      if (state.bgmDuckingTimer) {
        clearIntervalFn(state.bgmDuckingTimer);
        state.bgmDuckingTimer = null;
      }

      var start = clamp(typeof state.bgmDuckingMultiplier === "number" ? state.bgmDuckingMultiplier : 1, 0, 1);
      if (duration === 0 || Math.abs(start - target) < 0.0001) {
        state.bgmDuckingMultiplier = target;
        applySettings();
        verbose("[AUDIO] ducking set immediately", { reason: reason, target: target });
        return;
      }

      var steps = Math.max(1, Math.floor(duration / 25));
      var stepTime = Math.max(20, Math.floor(duration / steps));
      var index = 0;
      state.bgmDuckingTimer = setIntervalFn(function advanceBgmDucking() {
        index++;
        state.bgmDuckingMultiplier = lerp(start, target, index / steps);
        applySettings();

        if (index >= steps) {
          clearIntervalFn(state.bgmDuckingTimer);
          state.bgmDuckingTimer = null;
          state.bgmDuckingMultiplier = target;
          applySettings();
          verbose("[AUDIO] ducking transition completed", { reason: reason, target: target });
        }
      }, stepTime);
    }

    // Проверяет, что видимый обычный видеофон действительно имеет слышимую сценарную громкость.
    function isAudibleBackgroundVideoActive() {
      return !!(
        bgVideo &&
        bgVideo.classList &&
        !bgVideo.classList.contains("hidden") &&
        (state.currentBgVideoVolume || 0) > 0 &&
        (bgVideo.currentSrc || bgVideo.src)
      );
    }

    // Сводит сюжетное и фоновое видео к одному ducking-каналу и не отпускает BGM преждевременно.
    function setDuckingForActiveVideos(reason) {
      var storyActive = typeof options.isStoryVideoActive === "function" && options.isStoryVideoActive();
      var hasAudibleStoryVideo = !!(storyActive && (state.currentStoryVideoVolume || 0) > 0);
      var shouldDuck = hasAudibleStoryVideo || isAudibleBackgroundVideoActive();
      setBgmDuckingTarget(
        shouldDuck ? DEFAULT_BGM_DUCKING_MULTIPLIER : 1,
        shouldDuck ? DEFAULT_BGM_DUCKING_ATTACK_MS : DEFAULT_BGM_DUCKING_RELEASE_MS,
        reason
      );
    }

    // Повторяет play() фонового видео после явного жеста пользователя, когда браузер ранее запретил autoplay со звуком.
    function resumeBackgroundVideoIfNeeded(reason) {
      if (!bgVideo || !bgVideo.src || (bgVideo.classList && bgVideo.classList.contains("hidden"))) return;
      if (state.muted || state.masterVolume <= 0) return;

      applySettings();
      try {
        var playPromise = bgVideo.play();
        if (playPromise && typeof playPromise.then === "function") {
          playPromise.then(function reportBackgroundResumeSuccess() {
            verbose("[VIDEO] background play() success, reason =", reason);
          }).catch(function reportBackgroundResumeFailure(error) {
            verbose("[VIDEO] background play() blocked/failed, reason =", reason, error);
          });
        }
      } catch (error) {
        verbose("[VIDEO] background play() exception, reason =", reason, error);
      }
    }

    // Возобновляет существующий BGM, если он разрешён, не помечен ошибочным и уже имеет src.
    function resumeBgmIfNeeded(reason) {
      logState("before resumeBgmIfNeeded: " + reason);
      if (!bgm) {
        verbose("[AUDIO] resume skipped: no audio.bgm");
        return;
      }
      if (state.muted) {
        verbose("[AUDIO] resume skipped: muted");
        return;
      }
      if (!bgm.src) {
        verbose("[AUDIO] resume skipped: no src");
        return;
      }

      var currentSrc = normalizeUrl(bgm.currentSrc || bgm.src || "");
      if (currentSrc && failedAudio[currentSrc]) {
        verbose("[AUDIO] resume skipped: failed src", sanitizeResource(currentSrc));
        return;
      }

      try {
        var playPromise = bgm.play();
        verbose("[AUDIO] resume play() called, reason =", reason);
        if (playPromise && typeof playPromise.then === "function") {
          playPromise.then(function reportBgmResumeSuccess() {
            verbose("[AUDIO] resume play() success, reason =", reason);
            logState("after resume success: " + reason);
          }).catch(function reportBgmResumeFailure(error) {
            verbose("[AUDIO] resume play() blocked/failed, reason =", reason, error);
            logState("after resume fail: " + reason);
          });
        }
      } catch (error) {
        verbose("[AUDIO] resume play() exception, reason =", reason, error);
      }
    }

    // Поднимает громкость нового BGM после первой половины программного кроссфейда.
    function fadeInBgm(targetVolume, fadeMs) {
      clearIntervalFn(state.fadeTimer);
      var steps = 20;
      var stepTime = Math.max(20, Math.floor(fadeMs / steps));
      var index = 0;
      bgm.volume = 0;

      state.fadeTimer = setIntervalFn(function advanceBgmFadeIn() {
        index++;
        bgm.volume = lerp(0, targetVolume, index / steps);
        if (index >= steps) {
          clearIntervalFn(state.fadeTimer);
          state.fadeTimer = null;
          bgm.volume = targetVolume;
        }
      }, stepTime);
    }

    // Сначала гасит текущий трек, затем меняет src и запускает симметричное нарастание громкости.
    function crossfadeToBgm(newSrc, fadeMs) {
      clearIntervalFn(state.fadeTimer);
      var steps = 20;
      var stepTime = Math.max(20, Math.floor(fadeMs / steps));
      var master = state.muted ? 0 : state.masterVolume;
      var target = clamp(state.currentBgmVolume * master, 0, 1);
      var startVolume = bgm.volume;
      var index = 0;

      state.fadeTimer = setIntervalFn(function advanceBgmFadeOut() {
        index++;
        bgm.volume = lerp(startVolume, 0, index / steps);
        if (index >= steps) {
          clearIntervalFn(state.fadeTimer);
          state.fadeTimer = null;
          try {
            bgm.pause();
            bgm.src = newSrc;
            bgm.currentTime = 0;
            var playPromise = bgm.play();
            if (playPromise && typeof playPromise.catch === "function") playPromise.catch(function ignoreFadePlayFailure() {});
          } catch (error) {}
          fadeInBgm(target, fadeMs);
        }
      }, stepTime);
    }

    // Запускает разрешённый BGM, сохраняя повторное назначение того же трека и необязательный кроссфейд.
    function playBgm(src, loop, volume, fadeMs) {
      if (isAudioDebugEnabled() && typeof console !== "undefined") {
        console.log("[AUDIO] playBgm called", {
          src: sanitizeResource(src),
          loop: loop,
          vol: volume,
          fadeMs: fadeMs
        });
      }
      logState("playBgm start");
      if (!src || disposed) return;

      var normalizedSrc = resolveAudioUrl(src);
      if (!normalizedSrc) return;
      var currentSrc = normalizeUrl(bgm.currentSrc || bgm.src || "");
      if (failedAudio[normalizedSrc] || failedAudio[currentSrc]) {
        warn("[AUDIO] skip failed bgm src:", sanitizeResource(normalizedSrc));
        return;
      }

      bgm.loop = loop !== false;
      state.currentBgmVolume = clamp(typeof volume === "number" ? volume : DEFAULT_BGM_VOLUME, 0, 1);
      verbose("[AUDIO] playBgm currentBgmVolume set to", state.currentBgmVolume);

      if (bgm.src && urlEndsWith(bgm.src, normalizedSrc)) {
        verbose("[AUDIO] playBgm same track detected");
        applySettings();
        if (!state.muted && bgm.paused) resumeBgmIfNeeded("playBgm same track");
        return;
      }

      if (fadeMs && fadeMs > 0 && !state.muted) {
        crossfadeToBgm(normalizedSrc, fadeMs);
        return;
      }

      try {
        bgm.pause();
        bgm.src = normalizedSrc;
        bgm.currentTime = 0;
        applySettings();
        var playPromise = bgm.play();
        verbose("[AUDIO] playBgm quick play() called");
        if (playPromise && typeof playPromise.then === "function") {
          playPromise.then(function reportQuickBgmSuccess() {
            verbose("[AUDIO] playBgm quick play() success");
            logState("playBgm quick success");
          }).catch(function reportQuickBgmFailure(error) {
            verbose("[AUDIO] playBgm quick play() blocked/failed", error);
            logState("playBgm quick fail");
          });
        }
      } catch (error) {}
    }

    // Немедленно останавливает BGM и очищает его источник без запуска следующего трека.
    function stopBgmImmediate() {
      try {
        bgm.pause();
        bgm.src = "";
        bgm.currentTime = 0;
      } catch (error) {}
    }

    // Проигрывает одиночный SFX только после проверки пути общей политикой ресурсов.
    function playSfx(src, volume) {
      if (!src || disposed) return;
      var normalizedSrc = resolveAudioUrl(src);
      if (!normalizedSrc) return;
      state.currentSfxVolume = clamp(volume, 0, 1);
      try {
        sfx.pause();
        sfx.src = normalizedSrc;
        sfx.currentTime = 0;
        applySettings();
        var playPromise = sfx.play();
        if (playPromise && typeof playPromise.catch === "function") playPromise.catch(function ignoreSfxPlayFailure() {});
      } catch (error) {}
    }

    // Обрабатывает явное переключение mute и использует жест для повторного запуска заблокированных media.
    function handleMuteClick() {
      var wasMuted = state.muted;
      verbose("[AUDIO] btnMute click before toggle");
      logState("btnMute before toggle");
      state.muted = !state.muted;
      applySettings();
      updateMuteIcon();
      verbose("[AUDIO] btnMute click after toggle");
      logState("btnMute after toggle");
      if (wasMuted && !state.muted) {
        resumeBgmIfNeeded("btnMute unmute");
        resumeBackgroundVideoIfNeeded("btnMute unmute");
      }
    }

    // Применяет новое значение master volume и повторяет play() после пользовательского input-жеста.
    function handleVolumeInput() {
      var value = parseInt(volumeSlider.value, 10);
      if (isNaN(value)) value = 20;
      verbose("[AUDIO] slider input raw value =", volumeSlider.value);
      state.masterVolume = clamp(value / 100, 0, 1);
      applySettings();
      logState("slider after apply");
      if (!state.muted && state.masterVolume > 0) {
        resumeBgmIfNeeded("slider input");
        resumeBackgroundVideoIfNeeded("slider input");
      }
    }

    // Отмечает ошибочный BGM, останавливает канал и удаляет src, чтобы браузер не повторял загрузку.
    function handleBgmError() {
      var badSrc = normalizeUrl(bgm.currentSrc || bgm.src || "");
      verbose("[AUDIO EVENT] bgm error", bgm.error && bgm.error.code, sanitizeResource(badSrc));
      logState("event: error");
      if (badSrc) failedAudio[badSrc] = true;
      try {
        bgm.pause();
        if (typeof bgm.removeAttribute === "function") bgm.removeAttribute("src");
        if (typeof bgm.load === "function") bgm.load();
      } catch (error) {}
    }

    // Записывает событие play в целевую диагностику без изменения состояния канала.
    function handleBgmPlay() {
      verbose("[AUDIO EVENT] bgm play");
      logState("event: play");
    }

    // Записывает событие pause в целевую диагностику без изменения состояния канала.
    function handleBgmPause() {
      verbose("[AUDIO EVENT] bgm pause");
      logState("event: pause");
    }

    // Записывает событие ended в целевую диагностику без автоматического перехода сцены.
    function handleBgmEnded() {
      verbose("[AUDIO EVENT] bgm ended");
      logState("event: ended");
    }

    // Записывает готовность BGM для диагностики проблем декодирования и autoplay.
    function handleBgmCanPlay() {
      verbose("[AUDIO EVENT] bgm canplay");
      logState("event: canplay");
    }

    // Один раз подключает DOM/media-обработчики и применяет исходные настройки истории.
    function start() {
      if (started || disposed) return;
      started = true;
      bgm.loop = true;
      bgm.addEventListener("play", handleBgmPlay);
      bgm.addEventListener("pause", handleBgmPause);
      bgm.addEventListener("ended", handleBgmEnded);
      bgm.addEventListener("error", handleBgmError);
      bgm.addEventListener("canplay", handleBgmCanPlay);
      if (muteButton) muteButton.addEventListener("click", handleMuteClick);
      if (volumeSlider) volumeSlider.addEventListener("input", handleVolumeInput);
      setFromDefaults();
    }

    // Снимает обработчики, отменяет интервалы и освобождает оба аудиоканала при окончательном уходе со страницы.
    function dispose() {
      if (disposed) return;
      if (started) {
        bgm.removeEventListener("play", handleBgmPlay);
        bgm.removeEventListener("pause", handleBgmPause);
        bgm.removeEventListener("ended", handleBgmEnded);
        bgm.removeEventListener("error", handleBgmError);
        bgm.removeEventListener("canplay", handleBgmCanPlay);
        if (muteButton) muteButton.removeEventListener("click", handleMuteClick);
        if (volumeSlider) volumeSlider.removeEventListener("input", handleVolumeInput);
      }
      if (state.fadeTimer) clearIntervalFn(state.fadeTimer);
      if (state.bgmDuckingTimer) clearIntervalFn(state.bgmDuckingTimer);
      state.fadeTimer = null;
      state.bgmDuckingTimer = null;
      try {
        bgm.pause();
        sfx.pause();
        if (typeof bgm.removeAttribute === "function") bgm.removeAttribute("src");
        if (typeof sfx.removeAttribute === "function") sfx.removeAttribute("src");
      } catch (error) {}
      disposed = true;
    }

    return Object.freeze({
      state: state,
      start: start,
      setFromDefaults: setFromDefaults,
      updateMuteIcon: updateMuteIcon,
      applySettings: applySettings,
      setBgmDuckingTarget: setBgmDuckingTarget,
      setDuckingForActiveVideos: setDuckingForActiveVideos,
      resumeBackgroundVideoIfNeeded: resumeBackgroundVideoIfNeeded,
      resumeBgmIfNeeded: resumeBgmIfNeeded,
      logState: logState,
      playBgm: playBgm,
      stopBgmImmediate: stopBgmImmediate,
      playSfx: playSfx,
      dispose: dispose
    });
  }

  return {
    DEFAULT_BGM_VOLUME: DEFAULT_BGM_VOLUME,
    DEFAULT_BGM_DUCKING_MULTIPLIER: DEFAULT_BGM_DUCKING_MULTIPLIER,
    DEFAULT_BGM_DUCKING_ATTACK_MS: DEFAULT_BGM_DUCKING_ATTACK_MS,
    DEFAULT_BGM_DUCKING_RELEASE_MS: DEFAULT_BGM_DUCKING_RELEASE_MS,
    createAudioController: createAudioController
  };
});
