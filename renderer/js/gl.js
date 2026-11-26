(function () {
  'use strict';
  window.KS = window.KS || {};

  class GLRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        desynchronized: true,
        powerPreference: 'high-performance',
      });

      this.ok = !!this.gl;
      this.compiledModes = [];
      this.failedModes = [];
      this.modeMap = new Map();

      this.width = 0;
      this.height = 0;
      this.bloomW = 0;
      this.bloomH = 0;
      this.dynamicScale = 1.0;
      this.lastResizeMs = 0;
      this.time = 0;
      this.morphRemaining = 0;
      this.histIdx = 0;
      this.mouse = [0, 0];
      this.targetMouse = [0, 0];

      if (!this.gl) return;

      const gl = this.gl;
      this.floatExt = gl.getExtension('EXT_color_buffer_float');
      const fmt = this._pickColorFormat();
      this.texInternalFormat = fmt.internalFormat;
      this.texFormat = fmt.format;
      this.texType = fmt.type;

      // Empty VAO for gl_VertexID fullscreen triangle
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);

      this.vertShader = this._compileShader(gl.VERTEX_SHADER, window.KS.VERT_SRC, 'vertex');
      this._initPrograms();
      this._initAudioTexture();
      this.sceneFbo = null;
      this.historyFbos = [null, null];
      this.bloomFbo = null;
    }

    _pickColorFormat() {
      const gl = this.gl;
      const candidates = this.floatExt
        ? [
            { internalFormat: gl.R11F_G11F_B10F, format: gl.RGB, type: gl.HALF_FLOAT },
            { internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT },
            { internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE },
          ]
        : [{ internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE }];

      for (const c of candidates) {
        const tex = gl.createTexture();
        const fbo = gl.createFramebuffer();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, c.internalFormat, 16, 16, 0, c.format, c.type, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(fbo);
        gl.deleteTexture(tex);
        if (status === gl.FRAMEBUFFER_COMPLETE) {
          return c;
        }
      }
      return { internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
    }

    setDynamicScale(scale) {
      this.dynamicScale = Math.max(0.6, Math.min(1.0, scale || 1.0));
    }

    setMouse(nx, ny) {
      this.targetMouse[0] = Math.max(-1, Math.min(1, nx || 0));
      this.targetMouse[1] = Math.max(-1, Math.min(1, ny || 0));
    }

    _compileShader(type, source, label) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
        gl.deleteShader(shader);
        return { error: `[${label}] ${log}` };
      }
      return { shader };
    }

    _linkProgram(fragSrc, label) {
      const gl = this.gl;
      if (this.vertShader.error) {
        return { error: this.vertShader.error };
      }
      const fragRes = this._compileShader(gl.FRAGMENT_SHADER, fragSrc, label);
      if (fragRes.error) {
        return { error: fragRes.error };
      }
      const prog = gl.createProgram();
      gl.attachShader(prog, this.vertShader.shader);
      gl.attachShader(prog, fragRes.shader);
      gl.linkProgram(prog);
      gl.deleteShader(fragRes.shader);

      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(prog) || 'Unknown link error';
        gl.deleteProgram(prog);
        return { error: `[${label}] ${log}` };
      }
      return { program: prog };
    }

    _getUniforms(prog, names) {
      const gl = this.gl;
      const map = {};
      for (const n of names) {
        map[n] = gl.getUniformLocation(prog, n);
      }
      return map;
    }

    _initPrograms() {
      const modeUniforms = [
        'uTime',
        'uRes',
        'uSubBass',
        'uBass',
        'uMid',
        'uHigh',
        'uFlux',
        'uLevel',
        'uBeat',
        'uBeatCount',
        'uSegments',
        'uSpeed',
        'uIntensity',
        'uHueShift',
        'uMouse',
        'uPalA',
        'uPalB',
        'uPalC',
        'uPalD',
        'uAudio',
      ];

      for (const mode of window.KS.MODES) {
        const src = window.KS.COMMON_HEADER + mode.frag;
        const res = this._linkProgram(src, mode.id);
        if (res.error) {
          this.failedModes.push({ id: mode.id, name: mode.name, error: res.error });
        } else {
          const entry = {
            id: mode.id,
            name: mode.name,
            tags: mode.tags,
            program: res.program,
            u: this._getUniforms(res.program, modeUniforms),
          };
          this.compiledModes.push(entry);
          this.modeMap.set(mode.id, entry);
        }
      }

      const compRes = this._linkProgram(window.KS.COMPOSITE_FRAG, 'composite');
      if (compRes.error) {
        this.ok = false;
        this.failedModes.push({ id: 'composite', name: 'Composite', error: compRes.error });
      } else {
        this.compProg = compRes.program;
        this.compU = this._getUniforms(this.compProg, [
          'uScene',
          'uHistory',
          'uTrails',
          'uBass',
          'uSpeed',
          'uTime',
          'uBeatShake',
          'uMouse',
        ]);
      }

      const bloomRes = this._linkProgram(window.KS.BLOOM_FRAG, 'bloom');
      if (bloomRes.error) {
        this.ok = false;
        this.failedModes.push({ id: 'bloom', name: 'Bloom', error: bloomRes.error });
      } else {
        this.bloomProg = bloomRes.program;
        this.bloomU = this._getUniforms(this.bloomProg, ['uInput', 'uTexel']);
      }

      const presRes = this._linkProgram(window.KS.PRESENT_FRAG, 'present');
      if (presRes.error) {
        this.ok = false;
        this.failedModes.push({ id: 'present', name: 'Present', error: presRes.error });
      } else {
        this.presProg = presRes.program;
        this.presU = this._getUniforms(this.presProg, [
          'uInput',
          'uBloomTex',
          'uBeat',
          'uBass',
          'uBeatFlash',
          'uBeatShake',
          'uBloom',
          'uChromatic',
        ]);
      }
    }

    _initAudioTexture() {
      const gl = this.gl;
      this.audioTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.audioTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      const zero = new Uint8Array(512 * 2);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 512, 2, 0, gl.RED, gl.UNSIGNED_BYTE, zero);
    }

    _createFbo(w, h) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        this.texInternalFormat,
        w,
        h,
        0,
        this.texFormat,
        this.texType,
        null
      );

      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      return { fbo, tex };
    }

    _destroyFbo(obj) {
      if (!obj) return;
      const gl = this.gl;
      gl.deleteFramebuffer(obj.fbo);
      gl.deleteTexture(obj.tex);
    }

    ensureSize(renderScale) {
      if (!this.ok) return;
      const scale = Math.max(0.25, Math.min(1.0, renderScale || 1.0)) * this.dynamicScale;
      const dpr = Math.min(1.25, window.devicePixelRatio || 1);
      const cw = this.canvas.clientWidth || window.innerWidth;
      const ch = this.canvas.clientHeight || window.innerHeight;
      const targetW = Math.max(64, Math.floor(cw * dpr * scale));
      const targetH = Math.max(64, Math.floor(ch * dpr * scale));

      if (targetW === this.width && targetH === this.height && this.sceneFbo) {
        return;
      }

      const nowMs = performance.now();
      if (this.sceneFbo && nowMs - this.lastResizeMs < 250) {
        return;
      }
      this.lastResizeMs = nowMs;

      this.width = targetW;
      this.height = targetH;
      this.bloomW = Math.max(32, targetW >> 2);
      this.bloomH = Math.max(32, targetH >> 2);
      this.canvas.width = targetW;
      this.canvas.height = targetH;

      this._destroyFbo(this.sceneFbo);
      this._destroyFbo(this.historyFbos[0]);
      this._destroyFbo(this.historyFbos[1]);
      this._destroyFbo(this.bloomFbo);

      this.sceneFbo = this._createFbo(targetW, targetH);
      this.historyFbos[0] = this._createFbo(targetW, targetH);
      this.historyFbos[1] = this._createFbo(targetW, targetH);
      this.bloomFbo = this._createFbo(this.bloomW, this.bloomH);
      this.histIdx = 0;
    }

    triggerModeMorph() {
      this.morphRemaining = 0.8;
    }

    uploadAudio(audioTexBytes) {
      if (!this.ok || !audioTexBytes) return;
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.audioTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 2, gl.RED, gl.UNSIGNED_BYTE, audioTexBytes);
    }

    render(settings, audio, dt) {
      if (!this.ok || this.compiledModes.length === 0) return;

      this.ensureSize(settings.renderScale);

      const gl = this.gl;
      const modeEntry = this.modeMap.get(settings.mode) || this.compiledModes[0];
      const pal = window.KS.getPalette(settings.palette);

      const clampedDt = Math.min(0.05, Math.max(0.001, dt || 0.016));
      this.time += clampedDt * settings.speed * (0.6 + audio.bands.bass);

      this.mouse[0] += (this.targetMouse[0] - this.mouse[0]) * Math.min(1, clampedDt * 5.0);
      this.mouse[1] += (this.targetMouse[1] - this.mouse[1]) * Math.min(1, clampedDt * 5.0);

      if (this.morphRemaining > 0) {
        this.morphRemaining = Math.max(0, this.morphRemaining - clampedDt);
      }

      gl.bindVertexArray(this.vao);
      gl.viewport(0, 0, this.width, this.height);

      // Pass 1: Mode shader -> sceneFbo
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo.fbo);
      gl.useProgram(modeEntry.program);
      const u = modeEntry.u;
      gl.uniform1f(u.uTime, this.time);
      gl.uniform2f(u.uRes, this.width, this.height);
      gl.uniform1f(u.uSubBass, audio.bands.subBass || audio.bands.bass);
      gl.uniform1f(u.uBass, audio.bands.bass);
      gl.uniform1f(u.uMid, audio.bands.mid);
      gl.uniform1f(u.uHigh, audio.bands.high);
      gl.uniform1f(u.uFlux, audio.spectralFlux || 0);
      gl.uniform1f(u.uLevel, audio.level);
      gl.uniform1f(u.uBeat, audio.beatPulse);
      gl.uniform1f(u.uBeatCount, audio.beatCount);
      gl.uniform1f(u.uSegments, settings.segments);
      gl.uniform1f(u.uSpeed, settings.speed);
      gl.uniform1f(u.uIntensity, settings.intensity);
      gl.uniform1f(u.uHueShift, (audio.beatCount % 16) * 0.02);
      gl.uniform2f(u.uMouse, this.mouse[0], this.mouse[1]);
      gl.uniform3fv(u.uPalA, pal.a);
      gl.uniform3fv(u.uPalB, pal.b);
      gl.uniform3fv(u.uPalC, pal.c);
      gl.uniform3fv(u.uPalD, pal.d);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.audioTex);
      gl.uniform1i(u.uAudio, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Pass 2: Composite -> historyFbos[next]
      const prevIdx = this.histIdx;
      const nextIdx = 1 - prevIdx;
      const effectiveTrails = this.morphRemaining > 0 ? Math.max(settings.trails, 0.95) : settings.trails;
      const beatShakeFlag = settings.beatShake !== false ? 1.0 : 0.0;

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.historyFbos[nextIdx].fbo);
      gl.useProgram(this.compProg);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sceneFbo.tex);
      gl.uniform1i(this.compU.uScene, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.historyFbos[prevIdx].tex);
      gl.uniform1i(this.compU.uHistory, 1);

      gl.uniform1f(this.compU.uTrails, effectiveTrails);
      gl.uniform1f(this.compU.uBass, audio.bands.bass);
      gl.uniform1f(this.compU.uSpeed, settings.speed);
      gl.uniform1f(this.compU.uTime, this.time);
      gl.uniform1f(this.compU.uBeatShake, beatShakeFlag);
      gl.uniform2f(this.compU.uMouse, this.mouse[0], this.mouse[1]);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Pass 3: Quarter-res bloom -> bloomFbo
      const bloomVal = settings.bloom != null ? settings.bloom : 0.7;
      if (bloomVal > 0.01 && this.bloomFbo) {
        gl.viewport(0, 0, this.bloomW, this.bloomH);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFbo.fbo);
        gl.useProgram(this.bloomProg);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.historyFbos[nextIdx].tex);
        gl.uniform1i(this.bloomU.uInput, 0);
        gl.uniform2f(this.bloomU.uTexel, 1 / this.width, 1 / this.height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.viewport(0, 0, this.width, this.height);
      }

      // Pass 4: Present -> screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(this.presProg);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.historyFbos[nextIdx].tex);
      gl.uniform1i(this.presU.uInput, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.bloomFbo ? this.bloomFbo.tex : this.historyFbos[nextIdx].tex);
      gl.uniform1i(this.presU.uBloomTex, 1);

      gl.uniform1f(this.presU.uBeat, audio.beatPulse);
      gl.uniform1f(this.presU.uBass, audio.bands.bass);
      gl.uniform1f(this.presU.uBeatFlash, settings.beatFlash ? 1.0 : 0.0);
      gl.uniform1f(this.presU.uBeatShake, beatShakeFlag);
      gl.uniform1f(this.presU.uBloom, bloomVal);
      gl.uniform1f(this.presU.uChromatic, settings.chromatic != null ? settings.chromatic : 0.65);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      this.histIdx = nextIdx;
    }

    dispose() {
      if (!this.gl) return;
      const gl = this.gl;
      this._destroyFbo(this.sceneFbo);
      this._destroyFbo(this.historyFbos[0]);
      this._destroyFbo(this.historyFbos[1]);
      this._destroyFbo(this.bloomFbo);
      if (this.audioTex) gl.deleteTexture(this.audioTex);
      if (this.vao) gl.deleteVertexArray(this.vao);
      for (const m of this.compiledModes) {
        if (m.program) gl.deleteProgram(m.program);
      }
      if (this.compProg) gl.deleteProgram(this.compProg);
      if (this.bloomProg) gl.deleteProgram(this.bloomProg);
      if (this.presProg) gl.deleteProgram(this.presProg);
      if (this.vertShader && this.vertShader.shader) gl.deleteShader(this.vertShader.shader);
      this.ok = false;
    }
  }

  window.KS.GLRenderer = GLRenderer;
})();
