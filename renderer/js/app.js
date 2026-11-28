(function () {
  'use strict';

  const MOOD_POOLS = {
    calm: {
      modes: ['liquid-plasma', 'nebula-starfield', 'indie-dreamscape', 'sacred-hex', 'mandala-rings'],
      palettes: ['aurora', 'ocean', 'indie-tape', 'pastel'],
    },
    indie: {
      modes: ['indie-dreamscape', 'indie-prism-waves', 'wave-mandala', 'radial-spectrum'],
      palettes: ['indie-tape', 'pastel', 'sunset', 'mono-ice'],
    },
    hiphop: {
      modes: ['sub-808-shockwave', 'boom-bap-vortex', 'mirror-bars'],
      palettes: ['gold-cipher', 'synthwave', 'neon'],
    },
    rock: {
      modes: ['rock-overdrive', 'metal-inferno', 'tunnel-warp', 'prog-tesseract'],
      palettes: ['blood-metal', 'fire', 'sunset'],
    },
    edm: {
      modes: ['edm-supernova', 'techno-warehouse', 'kaleido-bloom', 'synthwave-outrun', 'fractal-kaleido', 'hypnotic-vortex'],
      palettes: ['neon', 'techno-acid', 'rainbow', 'synthwave'],
    },
  };

  async function bootstrap() {
    const params = new URLSearchParams(window.location.search);
    const isStage = params.get('stage') === '1';

    const canvas = document.getElementById('gl-canvas');
    const gl = new window.KS.GLRenderer(canvas);

    if (isStage) {
      document.body.classList.add('stage-output');
      let lastMode = null;
      window.kaleido.onStageFrame(({ settings, audio, dt }) => {
        if (!settings || !audio) return;
        if (lastMode && lastMode !== settings.mode) {
          gl.startCrossfade(lastMode, settings.mode, 1.8);
        }
        lastMode = settings.mode;
        gl.uploadAudio(audio.audioTex);
        gl.render(settings, audio, dt || 0.016);
      });
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          window.close();
        } else if (e.key === 'f' || e.key === 'F' || e.key === 'F11') {
          e.preventDefault();
          window.kaleido.toggleFullscreen();
        }
      });
      window.addEventListener('beforeunload', () => gl.dispose());
      return;
    }

    const settings = window.KS.loadSettings();
    const audio = new window.KS.AudioEngine();

    if (gl.compiledModes.length > 0 && !gl.modeMap.has(settings.mode)) {
      settings.mode = gl.compiledModes[0].id;
    }

    let stageActive = false;

    const applyPreset = (presetId) => {
      const preset = window.KS.GENRE_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const prevMode = settings.mode;
      settings.preset = preset.id;
      if (gl.modeMap.has(preset.mode)) {
        if (prevMode !== preset.mode) {
          gl.startCrossfade(prevMode, preset.mode, 1.8);
        }
        settings.mode = preset.mode;
      }
      settings.palette = preset.palette;
      settings.segments = preset.segments;
      settings.speed = preset.speed;
      settings.intensity = preset.intensity;
      settings.trails = preset.trails;
      settings.sensitivity = preset.sensitivity;
      window.KS.saveSettings(settings);
      ui.syncFromSettings();
      ui.showToast(`Preset: ${preset.name}`);
    };

    const onSettingChange = (key, val, prevVal) => {
      if (key === 'mode') {
        if (prevVal && prevVal !== val) {
          gl.startCrossfade(prevVal, val, 1.8);
        } else {
          gl.triggerModeMorph();
        }
      } else if (key === 'alwaysOnTop') {
        window.kaleido.setAlwaysOnTop(val);
      } else if (key === 'keepAwake') {
        window.kaleido.setKeepAwake(val);
      } else if (key === 'autoQuality' && !val) {
        gl.setDynamicScale(1.0);
      }
      window.KS.saveSettings(settings);
    };

    const connectAudio = async () => {
      const res = await audio.connectSource(settings.source, settings.micDeviceId);
      if (settings.source === 'mic') {
        const devs = await audio.listAudioInputs();
        ui.populateMicDevices(devs);
      }
      return res;
    };

    const toggleStageMode = async () => {
      const res = await window.kaleido.toggleStageMode();
      stageActive = !!(res && res.active);
      ui.setStageActive(stageActive);
      if (stageActive) {
        ui.showToast(res.external ? 'Stage Mode active on 2nd display' : 'Stage Mode window opened');
      }
    };

    const ui = new window.KS.UIController({
      settings,
      compiledModes: gl.compiledModes,
      onSettingChange,
      onConnectAudio: connectAudio,
      onApplyPreset: applyPreset,
      onRefreshMics: async () => {
        const devs = await audio.listAudioInputs();
        ui.populateMicDevices(devs);
      },
      onMouseMove: (nx, ny) => gl.setMouse(nx, ny),
      onToggleStageMode: toggleStageMode,
    });

    audio.onStatusChange = (info) => ui.updateAudioStatus(info);
    audio.onDeviceHotSwap = async () => {
      if (settings.source === 'mic') {
        const devs = await audio.listAudioInputs();
        ui.populateMicDevices(devs);
      }
      ui.showToast('Audio device changed — reconnected', 2200);
    };
    gl.onContextRestored = () => {
      ui.showToast('Graphics context restored', 2000);
    };
    window.kaleido.onStageState((state) => {
      stageActive = !!(state && state.active);
      ui.setStageActive(stageActive);
    });

    window.kaleido.setAlwaysOnTop(!!settings.alwaysOnTop);
    window.kaleido.setKeepAwake(settings.keepAwake !== false);

    let rafId = null;
    let lastRenderTime = performance.now();
    let smoothedDt = 0.016;
    let fpsSmoothed = 60;
    let frameMsEma = 16.6;
    let slowAccum = 0;
    let fastAccum = 0;
    let dynScale = 1.0;
    let cycleElapsed = 0;
    let cycleWaitingBeat = false;
    let cycleBeatMark = 0;
    let cycleStartBar = 0;
    let moodElapsed = 0;
    let lastMood = 'calm';
    let lastDropSeen = 0;

    const switchWithMood = (moodKey) => {
      const pool = MOOD_POOLS[moodKey] || MOOD_POOLS.indie;
      const available = pool.modes.filter((id) => gl.modeMap.has(id));
      const candidates = available.length > 0 ? available : gl.compiledModes.map((m) => m.id);
      const prevMode = settings.mode;
      let nextMode = candidates[Math.floor(Math.random() * candidates.length)];
      if (candidates.length > 1 && nextMode === prevMode) {
        const idx = candidates.indexOf(nextMode);
        nextMode = candidates[(idx + 1) % candidates.length];
      }
      const nextPal = pool.palettes[Math.floor(Math.random() * pool.palettes.length)];
      settings.mode = nextMode;
      settings.palette = nextPal;
      settings.preset = '';
      gl.startCrossfade(prevMode, nextMode, 2.0);
      window.KS.saveSettings(settings);
      ui.syncFromSettings();
      const entry = gl.modeMap.get(nextMode);
      ui.showToast(`Mood: ${moodKey.toUpperCase()} · ${entry ? entry.name : nextMode}`, 2400);
    };

    const frame = (now) => {
      rafId = requestAnimationFrame(frame);

      if (settings.fpsCap > 0) {
        const minInterval = 1000 / settings.fpsCap;
        if (now - lastRenderTime < minInterval * 0.92) {
          return;
        }
      }

      const rawDt = Math.min(0.05, Math.max(0.001, (now - lastRenderTime) / 1000));
      lastRenderTime = now;
      smoothedDt = smoothedDt * 0.82 + rawDt * 0.18;

      const rawMs = rawDt * 1000;
      frameMsEma = frameMsEma * 0.9 + rawMs * 0.1;
      const instantFps = 1 / rawDt;
      fpsSmoothed = fpsSmoothed * 0.9 + instantFps * 0.1;

      if (!stageActive && settings.autoQuality !== false && !window.__KS_KEEP_UI_VISIBLE) {
        if (frameMsEma > 22) {
          slowAccum += rawDt;
          fastAccum = 0;
          if (slowAccum >= 1.5 && dynScale > 0.6) {
            dynScale = Math.max(0.6, +(dynScale - 0.1).toFixed(2));
            gl.setDynamicScale(dynScale);
            slowAccum = 0;
          }
        } else if (frameMsEma < 11) {
          fastAccum += rawDt;
          slowAccum = 0;
          if (fastAccum >= 3.5 && dynScale < 1.0) {
            dynScale = Math.min(1.0, +(dynScale + 0.08).toFixed(2));
            gl.setDynamicScale(dynScale);
            fastAccum = 0;
          }
        } else {
          slowAccum = 0;
          fastAccum = 0;
        }
      }

      audio.update(smoothedDt, settings.sensitivity);
      if (stageActive) {
        window.kaleido.sendStageFrame({
          settings,
          audio: audio.getSnapshot(),
          dt: smoothedDt,
        });
      } else {
        gl.uploadAudio(audio.audioTex);
        gl.render(settings, audio, smoothedDt);
      }
      ui.updateRuntimeIndicators(audio, fpsSmoothed, now);

      const dropTriggered = audio.dropCount > lastDropSeen;
      if (dropTriggered) lastDropSeen = audio.dropCount;

      if (settings.moodAutopilot && !audio.silent) {
        moodElapsed += rawDt;
        if (audio.mood !== lastMood && (moodElapsed >= 10.0 || (dropTriggered && moodElapsed >= 4.0))) {
          lastMood = audio.mood;
          moodElapsed = 0;
          cycleElapsed = 0;
          cycleStartBar = audio.barCount;
          switchWithMood(audio.mood);
        }
      } else {
        moodElapsed = 0;
      }

      if (settings.autoCycle) {
        cycleElapsed += rawDt;
        if (settings.bpmSync !== false && audio.bpm >= 60) {
          const phraseBars = settings.cycleInterval <= 15 ? 8 : settings.cycleInterval <= 30 ? 16 : 32;
          const barsPassed = audio.barCount - cycleStartBar;
          if (barsPassed >= phraseBars || (dropTriggered && barsPassed >= phraseBars * 0.5)) {
            cycleStartBar = audio.barCount;
            cycleElapsed = 0;
            cycleWaitingBeat = false;
            ui.stepMode(1);
          }
        } else {
          if (!cycleWaitingBeat && cycleElapsed >= settings.cycleInterval) {
            cycleWaitingBeat = true;
            cycleBeatMark = audio.beatCount;
          }
          if (
            cycleWaitingBeat &&
            (audio.beatCount > cycleBeatMark || cycleElapsed >= settings.cycleInterval + 3.0)
          ) {
            cycleElapsed = 0;
            cycleWaitingBeat = false;
            cycleStartBar = audio.barCount;
            ui.stepMode(1);
          }
        }
      } else {
        cycleElapsed = 0;
        cycleWaitingBeat = false;
        cycleStartBar = audio.barCount;
      }
    };

    const startLoop = () => {
      if (rafId === null) {
        lastRenderTime = performance.now();
        rafId = requestAnimationFrame(frame);
      }
    };

    const stopLoop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !stageActive) {
        stopLoop();
        audio.suspend();
      } else {
        audio.resume();
        startLoop();
      }
    });

    window.addEventListener('beforeunload', () => {
      stopLoop();
      gl.dispose();
    });

    startLoop();

    const isSmoke = await window.kaleido.isSmoke();

    if (isSmoke) {
      window.__KS_KEEP_UI_VISIBLE = true;
      document.body.classList.remove('idle-hidden');

      const sysRes = await audio.connectSystemAudio();
      const systemAudioState = sysRes.trackState || audio.trackState || 'unknown';

      audio.startDemo();
      await new Promise((r) => setTimeout(r, 600));

      for (const mode of gl.compiledModes) {
        settings.mode = mode.id;
        gl.triggerModeMorph();
        ui.syncFromSettings();
        await new Promise((r) => setTimeout(r, 450));
        await window.kaleido.capture(`mode-${mode.id}`);
      }

      const report = {
        ok: gl.ok && gl.failedModes.length === 0 && gl.compiledModes.length === window.KS.MODES.length,
        webgl: gl.ok,
        modesCompiled: gl.compiledModes.length,
        failed: gl.failedModes,
        systemAudio: systemAudioState,
      };
      await window.kaleido.smokeDone(report);
      return;
    }

    audio.setAutoReconnect(true);
    const ver = await window.kaleido.getVersion();
    ui.setVersion(ver);

    const connRes = await connectAudio();
    if (!connRes.ok && settings.source === 'system') {
      ui.showStartOverlay();
    }

    setTimeout(async () => {
      try {
        const upd = await window.kaleido.checkForUpdates();
        if (upd && upd.ok && upd.updateAvailable) {
          ui.showUpdateBanner(upd);
          ui.showToast(`Update v${upd.latestVersion} available — click Install & Restart`, 3200);
        }
      } catch (_err) {}
    }, 3000);
  }

  window.addEventListener('DOMContentLoaded', bootstrap);
})();
