(function () {
  'use strict';

  async function bootstrap() {
    const settings = window.KS.loadSettings();
    const canvas = document.getElementById('gl-canvas');
    const gl = new window.KS.GLRenderer(canvas);
    const audio = new window.KS.AudioEngine();

    if (gl.compiledModes.length > 0 && !gl.modeMap.has(settings.mode)) {
      settings.mode = gl.compiledModes[0].id;
    }

    const applyPreset = (presetId) => {
      const preset = window.KS.GENRE_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      settings.preset = preset.id;
      if (gl.modeMap.has(preset.mode)) {
        if (settings.mode !== preset.mode) gl.triggerModeMorph();
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

    const onSettingChange = (key, val) => {
      if (key === 'mode') {
        gl.triggerModeMorph();
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
    });

    audio.onStatusChange = (info) => ui.updateAudioStatus(info);

    // Sync initial native window states
    window.kaleido.setAlwaysOnTop(!!settings.alwaysOnTop);
    window.kaleido.setKeepAwake(settings.keepAwake !== false);

    // Animation loop with smoothed dt, adaptive quality, FPS cap & visibility pause
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

      if (settings.autoQuality !== false && !window.__KS_KEEP_UI_VISIBLE) {
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
      gl.uploadAudio(audio.audioTex);
      gl.render(settings, audio, smoothedDt);
      ui.updateRuntimeIndicators(audio, fpsSmoothed, now);

      // Auto-cycle on beat after interval elapses
      if (settings.autoCycle) {
        cycleElapsed += rawDt;
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
          ui.stepMode(1);
        }
      } else {
        cycleElapsed = 0;
        cycleWaitingBeat = false;
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
      if (document.hidden) {
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

      // Switch to silent demo synth for deterministic visual verification
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

    // Normal mode: auto-connect selected source
    const connRes = await connectAudio();
    if (!connRes.ok && settings.source === 'system') {
      ui.showStartOverlay();
    }
  }

  window.addEventListener('DOMContentLoaded', bootstrap);
})();
