(function () {
  'use strict';
  window.KS = window.KS || {};

  class UIController {
    constructor(opts) {
      this.settings = opts.settings;
      this.compiledModes = opts.compiledModes;
      this.onSettingChange = opts.onSettingChange;
      this.onConnectAudio = opts.onConnectAudio;
      this.onApplyPreset = opts.onApplyPreset;
      this.onRefreshMics = opts.onRefreshMics;
      this.onMouseMove = opts.onMouseMove;

      this.panel = document.getElementById('control-panel');
      this.statusDot = document.getElementById('audio-dot');
      this.statusText = document.getElementById('audio-status-text');
      this.levelFill = document.getElementById('level-meter-fill');
      this.sourceSelect = document.getElementById('source-select');
      this.micRow = document.getElementById('mic-row');
      this.micSelect = document.getElementById('mic-select');
      this.connectBtn = document.getElementById('connect-btn');

      this.presetGrid = document.getElementById('preset-grid');
      this.modeGrid = document.getElementById('mode-grid');
      this.paletteGrid = document.getElementById('palette-grid');

      this.startOverlay = document.getElementById('start-overlay');
      this.startBtn = document.getElementById('start-overlay-btn');
      this.silenceHint = document.getElementById('silence-hint');
      this.fpsBadge = document.getElementById('fps-badge');
      this.toastEl = document.getElementById('toast-badge');
      this.helpOverlay = document.getElementById('help-overlay');

      this.uiHidden = false;
      this.isFullscreen = false;
      this.isPointerDown = false;
      this.idleTimer = null;
      this.toastTimer = null;

      this._buildLists();
      this._bindSlidersAndToggles();
      this._bindButtonsAndKeys();
      this._bindAutoHide();
      this.syncFromSettings();
    }

    _buildLists() {
      // Genre Presets
      this.presetGrid.innerHTML = '';
      window.KS.GENRE_PRESETS.forEach((preset, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip-btn';
        btn.dataset.preset = preset.id;
        const badgeHtml = idx < 10 ? `<span class="chip-key">${(idx + 1) % 10}</span>` : '';
        btn.innerHTML = `${badgeHtml}<span>${preset.name}</span>`;
        btn.addEventListener('click', () => this.onApplyPreset(preset.id));
        this.presetGrid.appendChild(btn);
      });

      // Compiled Modes
      this.modeGrid.innerHTML = '';
      this.compiledModes.forEach((mode) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mode-tile';
        btn.dataset.mode = mode.id;
        const tagsHtml = (mode.tags || [])
          .map((t) => `<span class="mode-tag">${t}</span>`)
          .join('');
        btn.innerHTML = `<div class="mode-name">${mode.name}</div><div class="mode-tags">${tagsHtml}</div>`;
        btn.addEventListener('click', () => {
          this.settings.mode = mode.id;
          this.settings.preset = '';
          this.onSettingChange('mode', mode.id);
          this.syncFromSettings();
        });
        this.modeGrid.appendChild(btn);
      });

      // Palettes
      this.paletteGrid.innerHTML = '';
      window.KS.PALETTES.forEach((pal) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'palette-chip';
        btn.dataset.palette = pal.id;
        const grad = window.KS.paletteGradientCss(pal);
        btn.innerHTML = `<span class="palette-swatch" style="background:${grad}"></span><span class="palette-label">${pal.name}</span>`;
        btn.addEventListener('click', () => {
          this.settings.palette = pal.id;
          this.settings.preset = '';
          this.onSettingChange('palette', pal.id);
          this.syncFromSettings();
        });
        this.paletteGrid.appendChild(btn);
      });
    }

    _bindSlidersAndToggles() {
      const bindRange = (id, key, fmt) => {
        const input = document.getElementById(id);
        const valEl = document.getElementById(`${id}-val`);
        input.addEventListener('input', () => {
          const val = parseFloat(input.value);
          this.settings[key] = val;
          this.settings.preset = '';
          if (valEl) valEl.textContent = fmt(val);
          this.onSettingChange(key, val);
        });
      };

      bindRange('slider-segments', 'segments', (v) => `${Math.round(v)}x`);
      bindRange('slider-speed', 'speed', (v) => `${v.toFixed(2)}x`);
      bindRange('slider-intensity', 'intensity', (v) => `${Math.round(v * 100)}%`);
      bindRange('slider-trails', 'trails', (v) => `${Math.round(v * 100)}%`);
      bindRange('slider-sensitivity', 'sensitivity', (v) => `${v.toFixed(2)}x`);
      bindRange('slider-bloom', 'bloom', (v) => `${Math.round(v * 100)}%`);
      bindRange('slider-chromatic', 'chromatic', (v) => `${Math.round(v * 100)}%`);

      const scaleSel = document.getElementById('render-scale-select');
      scaleSel.addEventListener('change', () => {
        this.settings.renderScale = parseFloat(scaleSel.value);
        this.onSettingChange('renderScale', this.settings.renderScale);
      });

      const fpsSel = document.getElementById('fps-cap-select');
      fpsSel.addEventListener('change', () => {
        this.settings.fpsCap = parseInt(fpsSel.value, 10);
        this.onSettingChange('fpsCap', this.settings.fpsCap);
      });

      const cycleIntSel = document.getElementById('cycle-interval-select');
      cycleIntSel.addEventListener('change', () => {
        this.settings.cycleInterval = parseInt(cycleIntSel.value, 10);
        this.onSettingChange('cycleInterval', this.settings.cycleInterval);
      });

      const bindToggle = (id, key) => {
        const el = document.getElementById(id);
        el.addEventListener('change', () => {
          this.settings[key] = !!el.checked;
          this.onSettingChange(key, this.settings[key]);
        });
      };

      bindToggle('toggle-auto-cycle', 'autoCycle');
      bindToggle('toggle-beat-flash', 'beatFlash');
      bindToggle('toggle-beat-shake', 'beatShake');
      bindToggle('toggle-always-top', 'alwaysOnTop');
      bindToggle('toggle-keep-awake', 'keepAwake');
      bindToggle('toggle-show-fps', 'showFps');

      this.sourceSelect.addEventListener('change', async () => {
        this.settings.source = this.sourceSelect.value;
        this.micRow.style.display = this.settings.source === 'mic' ? 'flex' : 'none';
        if (this.settings.source === 'mic') {
          await this.onRefreshMics();
        }
        this.onSettingChange('source', this.settings.source);
        this.onConnectAudio();
      });

      this.micSelect.addEventListener('change', () => {
        this.settings.micDeviceId = this.micSelect.value;
        this.onSettingChange('micDeviceId', this.settings.micDeviceId);
        if (this.settings.source === 'mic') {
          this.onConnectAudio();
        }
      });

      this.connectBtn.addEventListener('click', () => this.onConnectAudio());
      this.startBtn.addEventListener('click', () => {
        this.hideStartOverlay();
        this.onConnectAudio();
      });
    }

    _bindButtonsAndKeys() {
      document.getElementById('btn-fullscreen').addEventListener('click', () => this.toggleFullscreen());
      document.getElementById('btn-next-display').addEventListener('click', async () => {
        const res = await window.kaleido.nextDisplay();
        this.isFullscreen = true;
        this.showToast(`Display ${res.index + 1} / ${res.count}`);
      });
      document.getElementById('btn-hide-ui').addEventListener('click', () => this.setUiHidden(true));
      document.getElementById('btn-shuffle').addEventListener('click', () => this.shuffleModeAndPalette());
      document.getElementById('btn-help').addEventListener('click', () => this.toggleHelp());
      document.getElementById('help-close-btn').addEventListener('click', () => this.toggleHelp(false));
      this.helpOverlay.addEventListener('click', (e) => {
        if (e.target === this.helpOverlay) this.toggleHelp(false);
      });

      window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
          if (e.target.type !== 'range') return;
        }
        const key = e.key;
        if (key === '?' || (e.shiftKey && key === '/')) {
          e.preventDefault();
          this.toggleHelp();
          return;
        }
        if (key === 'Escape') {
          if (!this.helpOverlay.classList.contains('hidden')) {
            this.toggleHelp(false);
            return;
          }
          if (this.isFullscreen) {
            window.kaleido.setFullscreen(false).then((fs) => {
              this.isFullscreen = fs;
            });
            return;
          }
        }
        if (key === 'f' || key === 'F' || key === 'F11') {
          e.preventDefault();
          this.toggleFullscreen();
        } else if (key === 'h' || key === 'H') {
          e.preventDefault();
          this.setUiHidden(!this.uiHidden);
        } else if (key === ' ' || key === 'ArrowRight') {
          e.preventDefault();
          this.stepMode(1);
        } else if (key === 'ArrowLeft') {
          e.preventDefault();
          this.stepMode(-1);
        } else if (key === 'ArrowUp') {
          e.preventDefault();
          this.adjustIntensity(0.1);
        } else if (key === 'ArrowDown') {
          e.preventDefault();
          this.adjustIntensity(-0.1);
        } else if (key === 'p' || key === 'P') {
          e.preventDefault();
          this.stepPalette(1);
        } else if (key === 'r' || key === 'R') {
          e.preventDefault();
          this.shuffleModeAndPalette();
        } else if (key === 'a' || key === 'A') {
          e.preventDefault();
          this.settings.autoCycle = !this.settings.autoCycle;
          this.onSettingChange('autoCycle', this.settings.autoCycle);
          this.syncFromSettings();
          this.showToast(`Auto-cycle: ${this.settings.autoCycle ? 'ON' : 'OFF'}`);
        } else if (/^[0-9]$/.test(key)) {
          const idx = key === '0' ? 9 : parseInt(key, 10) - 1;
          const preset = window.KS.GENRE_PRESETS[idx];
          if (preset) {
            this.onApplyPreset(preset.id);
          }
        }
      });
    }

    _bindAutoHide() {
      const wake = (e) => {
        document.body.classList.remove('idle-hidden');
        this._resetIdleTimer();
        if (e && typeof this.onMouseMove === 'function') {
          const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
          const ny = -((e.clientY / Math.max(1, window.innerHeight)) * 2 - 1);
          this.onMouseMove(nx, ny);
        }
      };
      window.addEventListener('mousemove', wake);
      window.addEventListener('pointerdown', (e) => {
        this.isPointerDown = true;
        wake(e);
      });
      window.addEventListener('pointerup', () => {
        this.isPointerDown = false;
        this._resetIdleTimer();
      });
      this._resetIdleTimer();
    }

    _resetIdleTimer() {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => {
        const helpOpen = !this.helpOverlay.classList.contains('hidden');
        if (!this.isPointerDown && !helpOpen && !window.__KS_KEEP_UI_VISIBLE) {
          document.body.classList.add('idle-hidden');
        }
      }, 3000);
    }

    async toggleFullscreen() {
      this.isFullscreen = await window.kaleido.toggleFullscreen();
      this.showToast(this.isFullscreen ? 'Fullscreen' : 'Windowed');
    }

    setUiHidden(hidden) {
      this.uiHidden = !!hidden;
      document.body.classList.toggle('ui-manually-hidden', this.uiHidden);
      if (this.uiHidden) {
        this.showToast('UI hidden (press H to show)');
      }
    }

    toggleHelp(force) {
      const show = typeof force === 'boolean' ? force : this.helpOverlay.classList.contains('hidden');
      this.helpOverlay.classList.toggle('hidden', !show);
      if (show) document.body.classList.remove('idle-hidden');
    }

    stepMode(delta) {
      if (this.compiledModes.length === 0) return;
      const idx = this.compiledModes.findIndex((m) => m.id === this.settings.mode);
      const next = (idx + delta + this.compiledModes.length) % this.compiledModes.length;
      const mode = this.compiledModes[next];
      this.settings.mode = mode.id;
      this.settings.preset = '';
      this.onSettingChange('mode', mode.id);
      this.syncFromSettings();
      this.showToast(mode.name);
    }

    stepPalette(delta) {
      const pals = window.KS.PALETTES;
      const idx = pals.findIndex((p) => p.id === this.settings.palette);
      const next = (idx + delta + pals.length) % pals.length;
      const pal = pals[next];
      this.settings.palette = pal.id;
      this.settings.preset = '';
      this.onSettingChange('palette', pal.id);
      this.syncFromSettings();
      this.showToast(`Palette: ${pal.name}`);
    }

    shuffleModeAndPalette() {
      if (this.compiledModes.length === 0) return;
      const pals = window.KS.PALETTES;
      let nextMode = this.compiledModes[Math.floor(Math.random() * this.compiledModes.length)];
      if (this.compiledModes.length > 1 && nextMode.id === this.settings.mode) {
        const idx = this.compiledModes.indexOf(nextMode);
        nextMode = this.compiledModes[(idx + 1) % this.compiledModes.length];
      }
      const nextPal = pals[Math.floor(Math.random() * pals.length)];
      this.settings.mode = nextMode.id;
      this.settings.palette = nextPal.id;
      this.settings.preset = '';
      this.onSettingChange('mode', nextMode.id);
      this.onSettingChange('palette', nextPal.id);
      this.syncFromSettings();
      this.showToast(`${nextMode.name} · ${nextPal.name}`);
    }

    adjustIntensity(delta) {
      const next = Math.max(0.2, Math.min(2.0, +(this.settings.intensity + delta).toFixed(2)));
      this.settings.intensity = next;
      this.onSettingChange('intensity', next);
      this.syncFromSettings();
      this.showToast(`Intensity: ${Math.round(next * 100)}%`);
    }

    showToast(text) {
      this.toastEl.textContent = text;
      this.toastEl.classList.remove('hidden');
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        this.toastEl.classList.add('hidden');
      }, 1800);
    }

    showStartOverlay() {
      this.startOverlay.classList.remove('hidden');
    }

    hideStartOverlay() {
      this.startOverlay.classList.add('hidden');
    }

    populateMicDevices(devices) {
      this.micSelect.innerHTML = '';
      if (devices.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Default audio input';
        this.micSelect.appendChild(opt);
        return;
      }
      devices.forEach((d, idx) => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = d.label || `Audio Input ${idx + 1}`;
        if (d.deviceId === this.settings.micDeviceId) opt.selected = true;
        this.micSelect.appendChild(opt);
      });
    }

    updateAudioStatus(info) {
      this.statusDot.dataset.state = info.status;
      this.statusText.textContent = info.message;
    }

    updateRuntimeIndicators(audio, fps) {
      this.levelFill.style.width = `${Math.round(Math.min(1, audio.level) * 100)}%`;
      const showSilence = audio.silent && audio.sourceType !== 'demo' && audio.status === 'live';
      this.silenceHint.classList.toggle('hidden', !showSilence);

      this.fpsBadge.classList.toggle('hidden', !this.settings.showFps);
      if (this.settings.showFps) {
        this.fpsBadge.textContent = `${Math.round(fps)} FPS`;
      }
    }

    syncFromSettings() {
      this.sourceSelect.value = this.settings.source;
      this.micRow.style.display = this.settings.source === 'mic' ? 'flex' : 'none';

      document.getElementById('slider-segments').value = this.settings.segments;
      document.getElementById('slider-segments-val').textContent = `${Math.round(this.settings.segments)}x`;

      document.getElementById('slider-speed').value = this.settings.speed;
      document.getElementById('slider-speed-val').textContent = `${this.settings.speed.toFixed(2)}x`;

      document.getElementById('slider-intensity').value = this.settings.intensity;
      document.getElementById('slider-intensity-val').textContent = `${Math.round(this.settings.intensity * 100)}%`;

      document.getElementById('slider-trails').value = this.settings.trails;
      document.getElementById('slider-trails-val').textContent = `${Math.round(this.settings.trails * 100)}%`;

      document.getElementById('slider-sensitivity').value = this.settings.sensitivity;
      document.getElementById('slider-sensitivity-val').textContent = `${this.settings.sensitivity.toFixed(2)}x`;

      const bloomVal = this.settings.bloom != null ? this.settings.bloom : 0.7;
      document.getElementById('slider-bloom').value = bloomVal;
      document.getElementById('slider-bloom-val').textContent = `${Math.round(bloomVal * 100)}%`;

      const chromVal = this.settings.chromatic != null ? this.settings.chromatic : 0.65;
      document.getElementById('slider-chromatic').value = chromVal;
      document.getElementById('slider-chromatic-val').textContent = `${Math.round(chromVal * 100)}%`;

      document.getElementById('render-scale-select').value = String(this.settings.renderScale);
      document.getElementById('fps-cap-select').value = String(this.settings.fpsCap);
      document.getElementById('cycle-interval-select').value = String(this.settings.cycleInterval);

      document.getElementById('toggle-auto-cycle').checked = !!this.settings.autoCycle;
      document.getElementById('toggle-beat-flash').checked = !!this.settings.beatFlash;
      document.getElementById('toggle-beat-shake').checked = this.settings.beatShake !== false;
      document.getElementById('toggle-always-top').checked = !!this.settings.alwaysOnTop;
      document.getElementById('toggle-keep-awake').checked = !!this.settings.keepAwake;
      document.getElementById('toggle-show-fps').checked = !!this.settings.showFps;

      for (const el of this.presetGrid.querySelectorAll('.chip-btn')) {
        el.classList.toggle('active', el.dataset.preset === this.settings.preset);
      }
      for (const el of this.modeGrid.querySelectorAll('.mode-tile')) {
        el.classList.toggle('active', el.dataset.mode === this.settings.mode);
      }
      for (const el of this.paletteGrid.querySelectorAll('.palette-chip')) {
        el.classList.toggle('active', el.dataset.palette === this.settings.palette);
      }
    }
  }

  window.KS.UIController = UIController;
})();
