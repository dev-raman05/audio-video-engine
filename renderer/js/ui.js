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
      this.showUiBtn = document.getElementById('btn-show-ui');
      this.helpOverlay = document.getElementById('help-overlay');
      this.riskyOverlay = document.getElementById('risky-overlay');
      this.appVersionEl = document.getElementById('app-version');
      this.updateBanner = document.getElementById('update-banner');
      this.updateTitle = document.getElementById('update-title');
      this.updateStatus = document.getElementById('update-status');
      this.updateProgress = document.getElementById('update-progress');
      this.updateProgressFill = document.getElementById('update-progress-fill');
      this.installUpdateBtn = document.getElementById('btn-install-update');
      this.checkUpdateBtn = document.getElementById('btn-check-update');

      this.uiHidden = false;
      this.isFullscreen = false;
      this.isPointerDown = false;
      this.panelHovered = false;
      this.riskyConfirmed = false;
      this.pendingRiskyModeId = null;
      this.updating = false;
      this.idleTimer = null;
      this.toastTimer = null;
      this.lastLevelQ = -1;
      this.lastFpsUpdateMs = 0;
      this.lastFpsText = '';
      this.lastSilenceShown = null;

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
        btn.className = mode.risky ? 'mode-tile risky' : 'mode-tile';
        btn.dataset.mode = mode.id;
        const tagsHtml = (mode.tags || [])
          .map((t) =>
            mode.risky && t === 'Risky'
              ? '<span class="mode-tag mode-tag-risky">&#9888; RISKY</span>'
              : `<span class="mode-tag">${t}</span>`
          )
          .join('');
        btn.innerHTML = `<div class="mode-name">${mode.name}</div><div class="mode-tags">${tagsHtml}</div>`;
        btn.addEventListener('click', () => {
          if (mode.risky && !this.riskyConfirmed) {
            this.openRiskyWarning(mode.id);
            return;
          }
          this.settings.mode = mode.id;
          this.settings.preset = '';
          this.onSettingChange('mode', mode.id);
          this.syncFromSettings();
          if (mode.risky) {
            this.showToast(`⚠ ${mode.name} (Hypnotic)`, 2400);
          }
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
      bindToggle('toggle-auto-quality', 'autoQuality');
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
      this.showUiBtn.addEventListener('click', () => this.setUiHidden(false));
      this.checkUpdateBtn.addEventListener('click', () => this.checkForUpdatesManual());
      this.installUpdateBtn.addEventListener('click', () => this.installUpdate());
      document.getElementById('btn-shuffle').addEventListener('click', () => this.shuffleModeAndPalette());
      document.getElementById('btn-help').addEventListener('click', () => this.toggleHelp());
      document.getElementById('help-close-btn').addEventListener('click', () => this.toggleHelp(false));
      this.helpOverlay.addEventListener('click', (e) => {
        if (e.target === this.helpOverlay) this.toggleHelp(false);
      });
      document.getElementById('risky-cancel-btn').addEventListener('click', () => this.closeRiskyWarning());
      document.getElementById('risky-confirm-btn').addEventListener('click', () => this.confirmRiskyMode());
      this.riskyOverlay.addEventListener('click', (e) => {
        if (e.target === this.riskyOverlay) this.closeRiskyWarning();
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
          if (!this.riskyOverlay.classList.contains('hidden')) {
            this.closeRiskyWarning();
            return;
          }
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
      this.panel.addEventListener('mouseenter', () => {
        this.panelHovered = true;
        if (this.idleTimer) clearTimeout(this.idleTimer);
      });
      this.panel.addEventListener('mouseleave', () => {
        this.panelHovered = false;
        this._resetIdleTimer();
      });
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
      const delay = this.uiHidden ? 2500 : 3000;
      this.idleTimer = setTimeout(() => {
        const helpOpen = !this.helpOverlay.classList.contains('hidden');
        const riskyOpen = !this.riskyOverlay.classList.contains('hidden');
        if (!this.isPointerDown && !this.panelHovered && !helpOpen && !riskyOpen && !window.__KS_KEEP_UI_VISIBLE) {
          document.body.classList.add('idle-hidden');
        }
      }, delay);
    }

    async toggleFullscreen() {
      this.isFullscreen = await window.kaleido.toggleFullscreen();
      this.showToast(this.isFullscreen ? 'Fullscreen' : 'Windowed');
    }

    setUiHidden(hidden) {
      this.uiHidden = !!hidden;
      document.body.classList.toggle('ui-manually-hidden', this.uiHidden);
      this.showUiBtn.classList.toggle('hidden', !this.uiHidden);
      document.body.classList.remove('idle-hidden');
      this._resetIdleTimer();
      if (this.uiHidden) {
        this.showToast('Controls hidden — press H or click top-right pill to show', 2800);
      } else {
        this.showToast('Controls shown', 1400);
      }
    }

    toggleHelp(force) {
      const show = typeof force === 'boolean' ? force : this.helpOverlay.classList.contains('hidden');
      this.helpOverlay.classList.toggle('hidden', !show);
      if (show) document.body.classList.remove('idle-hidden');
    }

    openRiskyWarning(modeId) {
      this.pendingRiskyModeId = modeId;
      this.riskyOverlay.classList.remove('hidden');
      document.body.classList.remove('idle-hidden');
    }

    closeRiskyWarning() {
      this.pendingRiskyModeId = null;
      this.riskyOverlay.classList.add('hidden');
    }

    confirmRiskyMode() {
      const modeId = this.pendingRiskyModeId;
      this.riskyConfirmed = true;
      this.closeRiskyWarning();
      if (!modeId) return;
      const mode = this.compiledModes.find((m) => m.id === modeId);
      this.settings.mode = modeId;
      this.settings.preset = '';
      this.onSettingChange('mode', modeId);
      this.syncFromSettings();
      this.showToast(`⚠ ${mode ? mode.name : modeId} (Hypnotic)`, 2400);
    }

    stepMode(delta) {
      const safeModes = this.compiledModes.filter((m) => !m.risky);
      const list = safeModes.length > 0 ? safeModes : this.compiledModes;
      if (list.length === 0) return;
      const idx = list.findIndex((m) => m.id === this.settings.mode);
      const next = idx === -1 ? 0 : (idx + delta + list.length) % list.length;
      const mode = list[next];
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
      const safeModes = this.compiledModes.filter((m) => !m.risky);
      const list = safeModes.length > 0 ? safeModes : this.compiledModes;
      if (list.length === 0) return;
      const pals = window.KS.PALETTES;
      let nextMode = list[Math.floor(Math.random() * list.length)];
      if (list.length > 1 && nextMode.id === this.settings.mode) {
        const idx = list.indexOf(nextMode);
        nextMode = list[(idx + 1) % list.length];
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

    showToast(text, durationMs) {
      this.toastEl.textContent = text;
      this.toastEl.classList.remove('hidden');
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        this.toastEl.classList.add('hidden');
      }, durationMs || 1800);
    }

    setVersion(version) {
      if (this.appVersionEl && version) {
        this.appVersionEl.textContent = `· v${version}`;
      }
    }

    showUpdateBanner(info) {
      if (!info || !info.updateAvailable) return;
      const mb = info.assetSize ? `${(info.assetSize / 1048576).toFixed(0)} MB · ` : '';
      this.updateTitle.textContent = `Update v${info.latestVersion}`;
      this.updateStatus.textContent = `${mb}Replaces app in place`;
      this.updateBanner.classList.remove('hidden');
    }

    async checkForUpdatesManual() {
      if (this.updating) return;
      this.checkUpdateBtn.disabled = true;
      this.checkUpdateBtn.textContent = 'Checking…';
      try {
        const res = await window.kaleido.checkForUpdates();
        if (!res || !res.ok) {
          this.showToast(res && res.error ? res.error : 'Update check failed', 2600);
        } else if (res.updateAvailable) {
          this.showUpdateBanner(res);
          this.showToast(`Update v${res.latestVersion} available`, 2400);
        } else {
          this.showToast(`Up to date (v${res.currentVersion})`);
        }
      } finally {
        this.checkUpdateBtn.disabled = false;
        this.checkUpdateBtn.textContent = 'Check Updates';
      }
    }

    async installUpdate() {
      if (this.updating) return;
      this.updating = true;
      this.installUpdateBtn.disabled = true;
      this.installUpdateBtn.textContent = 'Downloading…';
      this.updateProgress.classList.remove('hidden');
      this.updateProgressFill.style.transform = 'scaleX(0)';

      const off = window.kaleido.onUpdateProgress((p) => {
        if (!p) return;
        const pct = Math.max(0, Math.min(100, p.percent || 0));
        this.updateProgressFill.style.transform = `scaleX(${pct / 100})`;
        if (p.phase === 'installing') {
          this.installUpdateBtn.textContent = 'Restarting…';
          this.updateStatus.textContent = 'Replacing app & restarting…';
        } else {
          this.updateStatus.textContent = `Downloading ${pct}%`;
        }
      });

      try {
        const res = await window.kaleido.installUpdate();
        if (!res || !res.ok) {
          this.updating = false;
          this.installUpdateBtn.disabled = false;
          this.installUpdateBtn.textContent = 'Install & Restart';
          this.updateProgress.classList.add('hidden');
          this.updateStatus.textContent = (res && res.error) || 'Update failed';
          this.showToast(this.updateStatus.textContent, 3000);
          if (res && res.devMode && res.releaseUrl) {
            window.kaleido.openExternal(res.releaseUrl);
          }
        }
      } finally {
        if (typeof off === 'function') off();
      }
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

    updateRuntimeIndicators(audio, fps, now) {
      if (!this.uiHidden && !document.body.classList.contains('idle-hidden')) {
        const q = Math.round(Math.min(1, audio.level) * 100) / 100;
        if (q !== this.lastLevelQ) {
          this.lastLevelQ = q;
          this.levelFill.style.transform = `scaleX(${q})`;
        }
      }

      const showSilence = audio.silent && audio.sourceType !== 'demo' && audio.status === 'live';
      if (showSilence !== this.lastSilenceShown) {
        this.lastSilenceShown = showSilence;
        this.silenceHint.classList.toggle('hidden', !showSilence);
      }

      const showFps = !!this.settings.showFps;
      this.fpsBadge.classList.toggle('hidden', !showFps);
      if (showFps) {
        const ts = now || performance.now();
        if (ts - this.lastFpsUpdateMs >= 250) {
          this.lastFpsUpdateMs = ts;
          const text = `${Math.round(fps)} FPS`;
          if (text !== this.lastFpsText) {
            this.lastFpsText = text;
            this.fpsBadge.textContent = text;
          }
        }
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
      document.getElementById('toggle-auto-quality').checked = this.settings.autoQuality !== false;
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
