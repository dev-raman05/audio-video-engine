(function () {
  'use strict';
  window.KS = window.KS || {};

  const SPECTRUM_BINS = 512;
  const BEAT_HISTORY_LEN = 43;
  const MAX_BEAT_TIMES = 16;

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.analyser = null;
      this.sourceNode = null;
      this.stream = null;
      this.demoTimer = null;
      this.demoNodes = [];

      this.freqData = null;
      this.timeData = null;
      this.logMap = null;
      this.bandBins = null;
      this.spectrum = new Float32Array(SPECTRUM_BINS);
      this.prevSpectrum = new Float32Array(SPECTRUM_BINS);
      this.waveform = new Float32Array(SPECTRUM_BINS);
      this.audioTex = new Uint8Array(SPECTRUM_BINS * 2);

      this.bands = { subBass: 0, bass: 0, lowMid: 0, mid: 0, high: 0 };
      this.spectralFlux = 0;
      this.spectralCentroid = 0;
      this.tuneHue = 0;
      this.level = 0;
      this.beatPulse = 0;
      this.beatCount = 0;
      this.barCount = 0;
      this.bpm = 0;
      this.dropPulse = 0;
      this.dropCount = 0;
      this.mood = 'calm';
      this._moodCandidate = 'calm';
      this._moodCandTime = 0;
      this._moodFeat = { subBass: 0, bass: 0, mid: 0, high: 0, level: 0, centroid: 0, flux: 0 };

      this.silent = true;
      this.silentTime = 0;
      this.autoGainPeak = 0.25;
      this.slowEnergy = 0.15;
      this.fastEnergy = 0.0;
      this.lastDropMs = 0;

      this.bassHistory = new Float32Array(BEAT_HISTORY_LEN);
      this.bassHistIdx = 0;
      this.bassHistCount = 0;
      this.beatTimes = [];
      this.lastBeatMs = 0;

      this.sourceType = 'system';
      this.micDeviceId = '';
      this.status = 'idle';
      this.statusMessage = 'Initializing audio...';
      this.trackState = 'none';
      this.onStatusChange = null;
      this.onDeviceHotSwap = null;

      this.autoReconnectEnabled = false;
      this._hotSwapTimer = null;
      this._reconnecting = false;

      if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
        navigator.mediaDevices.addEventListener('devicechange', () => {
          if (!this.autoReconnectEnabled) return;
          if (this.sourceType !== 'system' && this.sourceType !== 'mic') return;
          if (this._hotSwapTimer) clearTimeout(this._hotSwapTimer);
          this._hotSwapTimer = setTimeout(() => {
            this._handleHotSwap();
          }, 800);
        });
      }
    }

    setAutoReconnect(enabled) {
      this.autoReconnectEnabled = !!enabled;
    }

    async _handleHotSwap() {
      if (this._reconnecting) return;
      this._reconnecting = true;
      try {
        const res = await this.connectSource(this.sourceType, this.micDeviceId);
        if (res && res.ok) {
          this.statusMessage = 'Audio device changed — reconnected';
          this._emitStatus();
          if (typeof this.onDeviceHotSwap === 'function') {
            this.onDeviceHotSwap();
          }
        }
      } finally {
        this._reconnecting = false;
      }
    }

    _emitStatus() {
      if (typeof this.onStatusChange === 'function') {
        this.onStatusChange({
          status: this.status,
          message: this.statusMessage,
          sourceType: this.sourceType,
          trackState: this.trackState,
        });
      }
    }

    _ensureContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (!this.analyser) {
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 4096;
        this.analyser.smoothingTimeConstant = 0.52;
        this.freqData = new Float32Array(this.analyser.frequencyBinCount);
        this.timeData = new Float32Array(this.analyser.fftSize);
        this._buildLogMap();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    _buildLogMap() {
      const sampleRate = this.ctx ? this.ctx.sampleRate : 48000;
      const binCount = this.analyser.frequencyBinCount;
      const nyquist = sampleRate * 0.5;
      const fMin = 30;
      const fMax = Math.min(16000, nyquist);
      const map = new Int32Array(SPECTRUM_BINS * 2);

      for (let i = 0; i < SPECTRUM_BINS; i++) {
        const t0 = i / SPECTRUM_BINS;
        const t1 = (i + 1) / SPECTRUM_BINS;
        const f0 = fMin * Math.pow(fMax / fMin, t0);
        const f1 = fMin * Math.pow(fMax / fMin, t1);
        const b0 = Math.max(0, Math.min(binCount - 1, Math.floor((f0 / nyquist) * binCount)));
        const b1 = Math.max(b0, Math.min(binCount - 1, Math.ceil((f1 / nyquist) * binCount)));
        map[i * 2] = b0;
        map[i * 2 + 1] = b1;
      }
      this.logMap = map;

      const bandRange = (fLow, fHigh) => [
        Math.max(1, Math.floor((fLow / nyquist) * binCount)),
        Math.min(binCount - 1, Math.ceil((fHigh / nyquist) * binCount)),
      ];
      this.bandBins = {
        subBass: bandRange(20, 70),
        bass: bandRange(20, 150),
        lowMid: bandRange(150, 500),
        mid: bandRange(500, 2000),
        high: bandRange(2000, 12000),
      };
    }

    _avgBand(range, minDb, dbSpan, sens, gainScale) {
      const b0 = range[0];
      const b1 = range[1];
      let sum = 0;
      let count = 0;
      for (let b = b0; b <= b1; b++) {
        const db = this.freqData[b];
        const norm = Math.max(0, Math.min(1, ((db - minDb) / dbSpan) * sens));
        sum += norm;
        count++;
      }
      return count > 0 ? Math.min(1, (sum / count) * gainScale) : 0;
    }

    _stopCurrentSource() {
      if (this.demoTimer) {
        clearInterval(this.demoTimer);
        this.demoTimer = null;
      }
      for (const node of this.demoNodes) {
        try {
          if (typeof node.stop === 'function') node.stop();
          node.disconnect();
        } catch (_err) {}
      }
      this.demoNodes = [];

      if (this.sourceNode) {
        try {
          this.sourceNode.disconnect();
        } catch (_err) {}
        this.sourceNode = null;
      }

      if (this.stream) {
        for (const track of this.stream.getTracks()) {
          try {
            track.onended = null;
            track.stop();
          } catch (_err) {}
        }
        this.stream = null;
      }
      this.trackState = 'none';
    }

    async listAudioInputs() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter((d) => d.kind === 'audioinput');
      } catch (_err) {
        return [];
      }
    }

    async connectSystemAudio() {
      this._stopCurrentSource();
      this.sourceType = 'system';
      this.status = 'connecting';
      this.statusMessage = 'Connecting system loopback...';
      this._emitStatus();

      this._ensureContext();

      const requestLoopback = async (stopVideoTrack) => {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1, height: 1, frameRate: 1 },
          audio: true,
        });
        const videoTracks = stream.getVideoTracks();
        for (const vt of videoTracks) {
          if (stopVideoTrack) {
            vt.stop();
          } else {
            vt.enabled = false;
          }
        }
        return stream;
      };

      try {
        let stream = await requestLoopback(true);
        let audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          throw new Error('No system loopback audio track returned');
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
        if (audioTracks[0].readyState !== 'live') {
          for (const t of stream.getTracks()) t.stop();
          stream = await requestLoopback(false);
          audioTracks = stream.getAudioTracks();
        }

        this.stream = stream;
        this.trackState = audioTracks[0] ? audioTracks[0].readyState : 'none';
        if (audioTracks[0]) {
          audioTracks[0].onended = () => {
            this.trackState = 'ended';
            if (this.sourceType === 'system') {
              if (this.autoReconnectEnabled && !this._reconnecting) {
                this.status = 'connecting';
                this.statusMessage = 'Reconnecting system audio...';
                this._emitStatus();
                setTimeout(() => {
                  if (this.sourceType === 'system') this._handleHotSwap();
                }, 600);
              } else {
                this.status = 'error';
                this.statusMessage = 'System audio stream ended — click Reconnect';
                this._emitStatus();
              }
            }
          };
        }

        const audioOnlyStream = new MediaStream(audioTracks);
        this.sourceNode = this.ctx.createMediaStreamSource(audioOnlyStream);
        this.sourceNode.connect(this.analyser);

        this.status = 'live';
        this.statusMessage = 'System audio loopback active';
        this._emitStatus();
        return { ok: true, trackState: this.trackState };
      } catch (err) {
        this.status = 'error';
        this.statusMessage = err && err.message ? err.message : 'Loopback unavailable';
        this.trackState = 'error';
        this._emitStatus();
        return { ok: false, error: this.statusMessage, trackState: this.trackState };
      }
    }

    async connectMic(deviceId) {
      this._stopCurrentSource();
      this.sourceType = 'mic';
      this.micDeviceId = deviceId || '';
      this.status = 'connecting';
      this.statusMessage = 'Connecting audio input...';
      this._emitStatus();

      this._ensureContext();

      try {
        const audioConstraint = deviceId
          ? {
              deviceId: { exact: deviceId },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            }
          : {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            };

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraint,
          video: false,
        });
        this.stream = stream;
        const tracks = stream.getAudioTracks();
        this.trackState = tracks[0] ? tracks[0].readyState : 'none';

        this.sourceNode = this.ctx.createMediaStreamSource(stream);
        this.sourceNode.connect(this.analyser);

        this.status = 'live';
        this.statusMessage = (tracks[0] && tracks[0].label) || 'Audio input active';
        this._emitStatus();
        return { ok: true, trackState: this.trackState };
      } catch (err) {
        this.status = 'error';
        this.statusMessage = err && err.message ? err.message : 'Mic access failed';
        this.trackState = 'error';
        this._emitStatus();
        return { ok: false, error: this.statusMessage };
      }
    }

    startDemo() {
      this._stopCurrentSource();
      this.sourceType = 'demo';
      this._ensureContext();

      const master = this.ctx.createGain();
      master.gain.value = 0.85;
      master.connect(this.analyser);
      this.sourceNode = master;

      const freqs = [110, 164.81, 220, 277.18, 329.63];
      const padGain = this.ctx.createGain();
      padGain.gain.value = 0.12;
      const padFilter = this.ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 900;
      padGain.connect(padFilter);
      padFilter.connect(master);

      for (const f of freqs) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        osc.connect(padGain);
        osc.start();
        this.demoNodes.push(osc);
      }
      this.demoNodes.push(padGain, padFilter);

      const noiseLen = Math.floor(this.ctx.sampleRate * 0.08);
      const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        ch[i] = Math.random() * 2 - 1;
      }

      let step = 0;
      const triggerBeat = () => {
        if (!this.ctx || this.sourceType !== 'demo') return;
        const now = this.ctx.currentTime;

        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(145, now);
        kickOsc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
        kickGain.gain.setValueAtTime(0.95, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        kickOsc.connect(kickGain);
        kickGain.connect(master);
        kickOsc.start(now);
        kickOsc.stop(now + 0.26);

        const hatSrc = this.ctx.createBufferSource();
        hatSrc.buffer = noiseBuf;
        const hatFilter = this.ctx.createBiquadFilter();
        hatFilter.type = 'highpass';
        hatFilter.frequency.value = step % 2 === 0 ? 5500 : 8000;
        const hatGain = this.ctx.createGain();
        hatGain.gain.setValueAtTime(step % 2 === 0 ? 0.35 : 0.22, now + 0.25);
        hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        hatSrc.connect(hatFilter);
        hatFilter.connect(hatGain);
        hatGain.connect(master);
        hatSrc.start(now + 0.25);

        const cutoff = 600 + ((step % 4) * 450);
        padFilter.frequency.setTargetAtTime(cutoff, now, 0.08);
        step++;
      };

      triggerBeat();
      this.demoTimer = setInterval(triggerBeat, 500);

      this.status = 'demo';
      this.statusMessage = 'Silent demo synth active (120 BPM)';
      this.trackState = 'demo';
      this._emitStatus();
      return { ok: true };
    }

    async connectSource(type, micDeviceId) {
      if (type === 'demo') return this.startDemo();
      if (type === 'mic') return this.connectMic(micDeviceId);
      return this.connectSystemAudio();
    }

    suspend() {
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    }

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    _updateBpm(nowMs) {
      this.beatTimes.push(nowMs);
      if (this.beatTimes.length > MAX_BEAT_TIMES) {
        this.beatTimes.shift();
      }
      if (this.beatTimes.length < 4) return;

      const intervals = [];
      for (let i = 1; i < this.beatTimes.length; i++) {
        let dt = this.beatTimes[i] - this.beatTimes[i - 1];
        if (dt < 220 || dt > 2000) continue;
        while (dt < 320) dt *= 2;
        while (dt > 920) dt *= 0.5;
        intervals.push(dt);
      }
      if (intervals.length < 3) return;
      intervals.sort((a, b) => a - b);
      const median = intervals[Math.floor(intervals.length / 2)];
      const instBpm = 60000 / median;
      this.bpm = this.bpm > 0 ? this.bpm * 0.78 + instBpm * 0.22 : instBpm;
    }

    _updateMood(dt) {
      const alpha = Math.min(1, dt / 5.0);
      const mf = this._moodFeat;
      mf.subBass += (this.bands.subBass - mf.subBass) * alpha;
      mf.bass += (this.bands.bass - mf.bass) * alpha;
      mf.mid += (this.bands.mid - mf.mid) * alpha;
      mf.high += (this.bands.high - mf.high) * alpha;
      mf.level += (this.level - mf.level) * alpha;
      mf.centroid += (this.spectralCentroid - mf.centroid) * alpha;
      mf.flux += (this.spectralFlux - mf.flux) * alpha;

      let candidate = 'indie';
      if (mf.level < 0.14 || (this.bpm > 0 && this.bpm < 84 && mf.flux < 0.12)) {
        candidate = 'calm';
      } else if (mf.subBass > mf.bass * 0.85 && mf.subBass > 0.34 && (this.bpm === 0 || this.bpm < 118)) {
        candidate = 'hiphop';
      } else if (this.bpm >= 118 && (mf.bass > 0.35 || mf.flux > 0.22)) {
        candidate = 'edm';
      } else if (mf.mid > mf.high * 1.15 && mf.flux > 0.16 && mf.centroid < 0.48) {
        candidate = 'rock';
      }

      if (candidate === this._moodCandidate) {
        this._moodCandTime += dt;
        if (this._moodCandTime >= 4.0) {
          this.mood = candidate;
        }
      } else {
        this._moodCandidate = candidate;
        this._moodCandTime = 0;
      }
    }

    getSnapshot() {
      return {
        bands: {
          subBass: this.bands.subBass,
          bass: this.bands.bass,
          lowMid: this.bands.lowMid,
          mid: this.bands.mid,
          high: this.bands.high,
        },
        spectralFlux: this.spectralFlux,
        spectralCentroid: this.spectralCentroid,
        tuneHue: this.tuneHue,
        level: this.level,
        beatPulse: this.beatPulse,
        beatCount: this.beatCount,
        dropPulse: this.dropPulse,
        dropCount: this.dropCount,
        bpm: this.bpm,
        barCount: this.barCount,
        mood: this.mood,
        silent: this.silent,
        audioTex: this.audioTex,
      };
    }

    update(dt, sensitivity) {
      const clampedDt = Math.min(0.1, Math.max(0.001, dt || 0.016));
      const sens = Math.max(0.2, sensitivity || 1.0);

      if (!this.analyser || !this.freqData || !this.timeData) {
        return;
      }

      this.analyser.getFloatFrequencyData(this.freqData);
      this.analyser.getFloatTimeDomainData(this.timeData);

      const minDb = -90;
      const maxDb = -28;
      const dbSpan = maxDb - minDb;

      let sumSq = 0;
      const timeLen = this.timeData.length;
      for (let i = 0; i < SPECTRUM_BINS; i++) {
        const idx = Math.floor((i / SPECTRUM_BINS) * timeLen);
        const s = this.timeData[idx] || 0;
        const clamped = Math.max(-1, Math.min(1, s * sens));
        this.waveform[i] = clamped;
        sumSq += s * s;
      }
      const rawRms = Math.sqrt(sumSq / SPECTRUM_BINS);

      const map = this.logMap;

      let rawMaxSpec = 0;
      let fluxSum = 0;
      let weightedSum = 0;
      let totalSpec = 0;
      let peakBin = 0;
      let peakBinVal = 0;

      for (let i = 0; i < SPECTRUM_BINS; i++) {
        const b0 = map[i * 2];
        const b1 = map[i * 2 + 1];
        let peakDb = -160;
        for (let b = b0; b <= b1; b++) {
          const db = this.freqData[b];
          if (db > peakDb) peakDb = db;
        }
        const norm = Math.max(0, Math.min(1, ((peakDb - minDb) / dbSpan) * sens));
        const prev = this.spectrum[i];
        const coeff = norm > prev ? 0.78 : 0.16;
        const val = prev + (norm - prev) * coeff;
        const diff = val - this.prevSpectrum[i];
        if (diff > 0) fluxSum += diff;
        this.prevSpectrum[i] = val;
        this.spectrum[i] = val;
        if (val > rawMaxSpec) rawMaxSpec = val;
        weightedSum += (i / 511) * val;
        totalSpec += val;
        if (i >= 90 && i <= 360 && val > peakBinVal) {
          peakBinVal = val;
          peakBin = i;
        }
      }

      const rawFlux = Math.min(1, (fluxSum / SPECTRUM_BINS) * 16.0);
      this.spectralFlux = this.spectralFlux * 0.5 + rawFlux * 0.5;
      const centroid = totalSpec > 0.01 ? weightedSum / totalSpec : 0;
      this.spectralCentroid = this.spectralCentroid * 0.85 + centroid * 0.15;

      if (peakBinVal > 0.04) {
        const targetHue = ((peakBin / 512) * 3.5) % 1;
        this.tuneHue = this.tuneHue * 0.9 + targetHue * 0.1;
      }

      const instantEnergy = Math.max(rawRms * 3.4 * sens, rawMaxSpec * 0.8);
      this.autoGainPeak = Math.max(
        instantEnergy,
        this.autoGainPeak * Math.exp(-0.26 * clampedDt),
        0.14
      );
      const gainScale = Math.min(2.6, 0.9 / this.autoGainPeak);

      const bb = this.bandBins;
      const subBass = this._avgBand(bb.subBass, minDb, dbSpan, sens, gainScale);
      const bass = this._avgBand(bb.bass, minDb, dbSpan, sens, gainScale);
      const lowMid = this._avgBand(bb.lowMid, minDb, dbSpan, sens, gainScale);
      const mid = this._avgBand(bb.mid, minDb, dbSpan, sens, gainScale);
      const high = this._avgBand(bb.high, minDb, dbSpan, sens, gainScale);

      this.bands.subBass = this.bands.subBass * 0.45 + subBass * 0.55;
      this.bands.bass = this.bands.bass * 0.5 + bass * 0.5;
      this.bands.lowMid = this.bands.lowMid * 0.55 + lowMid * 0.45;
      this.bands.mid = this.bands.mid * 0.55 + mid * 0.45;
      this.bands.high = this.bands.high * 0.5 + high * 0.5;

      const scaledLevel = Math.min(1, Math.max(rawRms * 4.2 * sens * gainScale, bass * 0.6 + mid * 0.4));
      this.level = this.level * 0.55 + scaledLevel * 0.45;

      const rawActivity = Math.max(rawRms * 2.5, rawMaxSpec * 0.35);
      if (rawActivity < 0.01) {
        this.silentTime += clampedDt;
        if (this.silentTime > 2.0) {
          this.silent = true;
        }
        if (this.silentTime > 4.0) {
          this.bpm = 0;
        }
      } else {
        this.silentTime = 0;
        this.silent = false;
      }

      this.bassHistory[this.bassHistIdx] = bass;
      this.bassHistIdx = (this.bassHistIdx + 1) % BEAT_HISTORY_LEN;
      if (this.bassHistCount < BEAT_HISTORY_LEN) this.bassHistCount++;

      let mean = 0;
      for (let i = 0; i < this.bassHistCount; i++) {
        mean += this.bassHistory[i];
      }
      mean /= this.bassHistCount;

      let variance = 0;
      for (let i = 0; i < this.bassHistCount; i++) {
        const diff = this.bassHistory[i] - mean;
        variance += diff * diff;
      }
      const std = Math.sqrt(variance / this.bassHistCount);
      const k = Math.max(1.05, Math.min(1.75, 1.85 - (sens - 0.4) * 0.42));
      const nowMs = performance.now();

      if (
        this.bassHistCount >= 12 &&
        bass > mean + k * std &&
        bass > 0.08 &&
        nowMs - this.lastBeatMs >= 180
      ) {
        this.beatPulse = 1.0;
        this.beatCount += 1;
        this.barCount = Math.floor(this.beatCount / 4);
        this.lastBeatMs = nowMs;
        this._updateBpm(nowMs);
      } else {
        this.beatPulse *= Math.exp(-6.5 * clampedDt);
      }

      const slowAlpha = Math.min(1, clampedDt / 3.0);
      const fastAlpha = Math.min(1, clampedDt / 0.12);
      this.slowEnergy += (this.level - this.slowEnergy) * slowAlpha;
      this.fastEnergy += (this.level - this.fastEnergy) * fastAlpha;

      if (
        this.fastEnergy > this.slowEnergy * 1.5 &&
        this.fastEnergy > 0.26 &&
        this.spectralFlux > 0.2 &&
        nowMs - this.lastDropMs > 4000
      ) {
        this.dropPulse = 1.0;
        this.dropCount += 1;
        this.lastDropMs = nowMs;
      } else {
        this.dropPulse *= Math.exp(-1.8 * clampedDt);
      }

      this._updateMood(clampedDt);

      for (let i = 0; i < SPECTRUM_BINS; i++) {
        const sVal = Math.max(0, Math.min(1, this.spectrum[i] * gainScale));
        this.audioTex[i] = Math.round(sVal * 255);
        const wVal = Math.max(0, Math.min(1, this.waveform[i] * 0.5 + 0.5));
        this.audioTex[SPECTRUM_BINS + i] = Math.round(wVal * 255);
      }
    }
  }

  window.KS.AudioEngine = AudioEngine;
})();
