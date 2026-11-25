(function () {
  'use strict';
  window.KS = window.KS || {};

  const SPECTRUM_BINS = 512;
  const BEAT_HISTORY_LEN = 43;

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
      this.spectrum = new Float32Array(SPECTRUM_BINS);
      this.waveform = new Float32Array(SPECTRUM_BINS);
      this.audioTex = new Uint8Array(SPECTRUM_BINS * 2);

      this.bands = { bass: 0, lowMid: 0, mid: 0, high: 0 };
      this.level = 0;
      this.beatPulse = 0;
      this.beatCount = 0;
      this.silent = true;
      this.silentTime = 0;
      this.autoGainPeak = 0.25;

      this.bassHistory = new Float32Array(BEAT_HISTORY_LEN);
      this.bassHistIdx = 0;
      this.bassHistCount = 0;
      this.lastBeatMs = 0;

      this.sourceType = 'system';
      this.status = 'idle';
      this.statusMessage = 'Initializing audio...';
      this.trackState = 'none';
      this.onStatusChange = null;
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
        this.analyser.smoothingTimeConstant = 0.6;
        // Never connect analyser to ctx.destination to avoid feedback/echo.
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

        // Wait 500ms and verify the audio track stayed live after stopping video
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
              this.status = 'error';
              this.statusMessage = 'System audio stream ended — click Reconnect';
              this._emitStatus();
            }
          };
        }

        // MediaStreamAudioSourceNode feeds ONLY the analyser (never destination)
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
      // Demo audio is silent to speakers (connected only to analyser).
      this.sourceNode = master;

      // Ambient pad chord oscillators
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

      // Prebuild short noise buffer for hi-hats
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

        // Kick every 0.5s
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

        // Off-beat / 8th hi-hat burst + filter sweep
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

    update(dt, sensitivity) {
      const clampedDt = Math.min(0.1, Math.max(0.001, dt || 0.016));
      const sens = Math.max(0.2, sensitivity || 1.0);

      if (!this.analyser || !this.freqData || !this.timeData) {
        return;
      }

      this.analyser.getFloatFrequencyData(this.freqData);
      this.analyser.getFloatTimeDomainData(this.timeData);

      const minDb = -85;
      const maxDb = -25;
      const dbSpan = maxDb - minDb;

      // Resample waveform to 512 and compute RMS level
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

      // Build log-spaced 512-bin spectrum (30 Hz - 16 kHz)
      const map = this.logMap;
      const binCount = this.analyser.frequencyBinCount;
      const nyquist = (this.ctx ? this.ctx.sampleRate : 48000) * 0.5;

      let rawMaxSpec = 0;
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
        const coeff = norm > prev ? 0.6 : 0.15;
        const val = prev + (norm - prev) * coeff;
        this.spectrum[i] = val;
        if (val > rawMaxSpec) rawMaxSpec = val;
      }

      // Auto-gain peak tracker so quiet tracks stay expressive
      const instantEnergy = Math.max(rawRms * 3.2 * sens, rawMaxSpec * 0.75);
      this.autoGainPeak = Math.max(
        instantEnergy,
        this.autoGainPeak * Math.exp(-0.22 * clampedDt),
        0.18
      );
      const gainScale = Math.min(2.2, 0.85 / this.autoGainPeak);

      // Compute frequency bands (20-150, 150-500, 500-2000, 2000-12000 Hz)
      const bandAvg = (fLow, fHigh) => {
        const b0 = Math.max(1, Math.floor((fLow / nyquist) * binCount));
        const b1 = Math.min(binCount - 1, Math.ceil((fHigh / nyquist) * binCount));
        let sum = 0;
        let count = 0;
        for (let b = b0; b <= b1; b++) {
          const db = this.freqData[b];
          const norm = Math.max(0, Math.min(1, ((db - minDb) / dbSpan) * sens));
          sum += norm;
          count++;
        }
        return count > 0 ? Math.min(1, (sum / count) * gainScale) : 0;
      };

      const bass = bandAvg(20, 150);
      const lowMid = bandAvg(150, 500);
      const mid = bandAvg(500, 2000);
      const high = bandAvg(2000, 12000);

      this.bands.bass = this.bands.bass * 0.55 + bass * 0.45;
      this.bands.lowMid = this.bands.lowMid * 0.6 + lowMid * 0.4;
      this.bands.mid = this.bands.mid * 0.6 + mid * 0.4;
      this.bands.high = this.bands.high * 0.55 + high * 0.45;

      const scaledLevel = Math.min(1, Math.max(rawRms * 4.0 * sens * gainScale, bass * 0.6 + mid * 0.4));
      this.level = this.level * 0.6 + scaledLevel * 0.4;

      // Silence check (raw energy before auto-gain inflation)
      const rawActivity = Math.max(rawRms * 2.5, rawMaxSpec * 0.35);
      if (rawActivity < 0.01) {
        this.silentTime += clampedDt;
        if (this.silentTime > 2.0) {
          this.silent = true;
        }
      } else {
        this.silentTime = 0;
        this.silent = false;
      }

      // Beat detection on bass energy
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
      const k = Math.max(1.2, Math.min(2.0, 2.1 - (sens - 0.4) * 0.45));
      const nowMs = performance.now();

      if (
        this.bassHistCount >= 12 &&
        bass > mean + k * std &&
        bass > 0.12 &&
        nowMs - this.lastBeatMs >= 220
      ) {
        this.beatPulse = 1.0;
        this.beatCount += 1;
        this.lastBeatMs = nowMs;
      } else {
        this.beatPulse *= Math.exp(-6.0 * clampedDt);
      }

      // Pack 512x2 R8 texture: row 0 = spectrum, row 1 = waveform * 0.5 + 0.5
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
