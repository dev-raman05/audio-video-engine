(function () {
  'use strict';
  window.KS = window.KS || {};

  const STORAGE_KEY = 'kaleidosync.settings.v1';

  const DEFAULT_SETTINGS = {
    mode: 'kaleido-bloom',
    palette: 'neon',
    preset: 'edm',
    source: 'system',
    micDeviceId: '',
    segments: 8,
    speed: 1.0,
    intensity: 1.0,
    trails: 0.78,
    sensitivity: 1.2,
    bloom: 0.7,
    chromatic: 0.65,
    renderScale: 1.0,
    fpsCap: 0,
    autoCycle: false,
    cycleInterval: 30,
    beatFlash: true,
    beatShake: true,
    alwaysOnTop: false,
    keepAwake: true,
    showFps: false,
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, DEFAULT_SETTINGS);
      const parsed = JSON.parse(raw);
      return Object.assign({}, DEFAULT_SETTINGS, parsed);
    } catch (_err) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (_err) {
      // Ignore storage quota / private mode issues.
    }
  }

  window.KS.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  window.KS.loadSettings = loadSettings;
  window.KS.saveSettings = saveSettings;
})();
