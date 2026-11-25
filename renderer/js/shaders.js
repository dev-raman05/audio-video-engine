(function () {
  'use strict';
  window.KS = window.KS || {};

  const VERT_SRC = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
  vUv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

  const COMMON_HEADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform float uTime;
uniform vec2 uRes;
uniform float uSubBass;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uFlux;
uniform float uLevel;
uniform float uBeat;
uniform float uBeatCount;
uniform float uSegments;
uniform float uSpeed;
uniform float uIntensity;
uniform float uHueShift;
uniform vec2 uMouse;
uniform vec3 uPalA;
uniform vec3 uPalB;
uniform vec3 uPalC;
uniform vec3 uPalD;
uniform sampler2D uAudio;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

vec2 kaleido(vec2 p, float n) {
  float seg = max(2.0, floor(n + 0.5));
  float angle = atan(p.y, p.x);
  float r = length(p);
  float sector = TAU / seg;
  float a = mod(angle + TAU, sector);
  a = abs(a - sector * 0.5);
  return vec2(cos(a), sin(a)) * r;
}

float spec(float x) {
  return texture(uAudio, vec2(clamp(x, 0.001, 0.999), 0.25)).r;
}

float wave(float x) {
  return texture(uAudio, vec2(clamp(x, 0.001, 0.999), 0.75)).r * 2.0 - 1.0;
}

vec3 pal(float t) {
  return clamp(uPalA + uPalB * cos(TAU * (uPalC * (t + uHueShift) + uPalD)), 0.0, 1.0);
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  mat2 m = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += amp * noise(p);
    p = m * p * 2.02 + 1.37;
    amp *= 0.5;
  }
  return v;
}

vec2 normUv() {
  vec2 p = (vUv - 0.5) * 2.0;
  p.x *= uRes.x / max(1.0, uRes.y);
  p += uMouse * 0.08;
  return p;
}
`;

  const MODES = [
    {
      id: 'kaleido-bloom',
      name: 'Kaleido Bloom',
      tags: ['Kaleidoscope', 'EDM'],
      frag: `
void main() {
  vec2 p = normUv();
  float zoom = 1.0 - 0.14 * uBass - 0.08 * uBeat;
  p *= zoom;
  p *= rot(uTime * 0.16);
  vec2 k = kaleido(p, uSegments);
  float r = length(k);
  float s = spec(clamp(r * 0.55, 0.02, 0.92));

  vec2 q = vec2(fbm(k * 2.2 + uTime * 0.25), fbm(k * 2.2 - uTime * 0.2 + vec2(4.1, 1.7)));
  float f = fbm(k * 3.0 + q * (1.3 + uMid * 1.4) + vec2(uTime * 0.18, -uTime * 0.12));

  float petals = sin(atan(k.y, k.x) * 6.0 + r * 8.0 - uTime * 2.0) * 0.5 + 0.5;
  float glow = smoothstep(0.95, 0.15, abs(r - 0.42 - s * 0.45)) * (0.4 + s * 1.2);
  float core = exp(-r * (2.6 - uBass * 1.1)) * (0.6 + uBeat * 0.8);

  vec3 col = pal(f * 0.9 + r * 0.45 - uTime * 0.08);
  col *= (0.45 + 1.1 * f * petals) * uIntensity;
  col += pal(s + 0.35) * glow * 1.15 * uIntensity;
  col += pal(0.15 + uBeat * 0.2) * core * uIntensity;
  fragColor = vec4(col, 1.0);
}
`,
    },
    {
      id: 'mandala-rings',
      name: 'Mandala Rings',
      tags: ['Sacred', 'Classical'],
      frag: `
void main() {
  vec2 p = normUv();
  p *= rot(uTime * 0.12);
  vec2 k = kaleido(p, uSegments);
  float r = length(k);
  float a = atan(k.y, k.x);

  vec3 col = vec3(0.01, 0.015, 0.03);
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float normI = fi / 8.0;
    float s = spec(0.05 + normI * 0.8);
    float ringR = 0.14 + fi * 0.11 + s * 0.09 * uIntensity;
    float petal = cos(a * (4.0 + fi) + uTime * (0.5 + normI) * (mod(fi, 2.0) < 0.5 ? 1.0 : -1.0));
    float d = abs(r - ringR + petal * 0.028 * (0.5 + uMid));
    float line = 0.008 / (d + 0.005);
    vec3 ringCol = pal(normI * 0.85 + s * 0.35 + uTime * 0.04);
    col += ringCol * line * (0.35 + s * 0.9 + uBeat * 0.35);
  }
  float center = exp(-r * 6.0) * (0.5 + uBass * 1.1);
  col += pal(0.2) * center;
  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
    {
      id: 'radial-spectrum',
      name: 'Radial Spectrum',
      tags: ['Spectrum', 'Pop'],
      frag: `
void main() {
  vec2 p = normUv();
  p *= rot(uTime * 0.14);
  float r = length(p);
  float seg = max(2.0, floor(uSegments + 0.5));
  float sector = TAU / seg;
  float ang = mod(atan(p.y, p.x) + TAU, sector);
  float fold = abs(ang - sector * 0.5) / (sector * 0.5);

  float bins = 10.0;
  float binIdx = floor(fold * bins) / bins;
  float binFrac = fract(fold * bins);
  float barMask = smoothstep(0.08, 0.22, binFrac) * smoothstep(0.92, 0.78, binFrac);

  float s = spec(0.04 + binIdx * 0.85);
  float innerR = 0.22 + 0.06 * uBass;
  float outerR = innerR + (0.1 + s * 0.78) * uIntensity;

  float inBar = smoothstep(innerR - 0.015, innerR, r) * smoothstep(outerR + 0.015, outerR, r);
  float tip = exp(-abs(r - outerR) * 45.0) * (0.4 + s);
  float coreRing = exp(-abs(r - innerR) * 35.0) * (0.7 + uBeat * 0.9);

  vec3 col = pal(binIdx * 0.75 + s * 0.4 + uTime * 0.06) * inBar * barMask * (0.6 + s * 1.1);
  col += pal(binIdx + 0.3) * tip * barMask;
  col += pal(0.1 + uMid * 0.3) * coreRing;
  col += pal(r * 0.5) * exp(-r * 3.8) * (0.35 + uBass * 0.75);
  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
    {
      id: 'tunnel-warp',
      name: 'Tunnel Warp',
      tags: ['3D', 'Rock'],
      frag: `
void main() {
  vec2 p = normUv();
  float r = max(0.03, length(p));
  vec2 k = kaleido(p, uSegments);
  float ka = atan(k.y, k.x);

  float depth = 0.75 / r + uTime * (1.1 + uBass * 1.6);
  float ring = fract(depth * 0.55);
  float s = spec(clamp(fract(depth * 0.12), 0.02, 0.95));

  float ribs = cos(ka * 10.0 + depth * 0.8) * 0.5 + 0.5;
  float stripe = smoothstep(0.45, 0.05, abs(ring - 0.5)) * (0.4 + s * 1.3);
  float grid = smoothstep(0.3, 0.95, ribs) * 0.45 + 0.55;

  vec3 col = pal(depth * 0.12 + s * 0.35);
  col *= (stripe * grid + 0.18 * fbm(vec2(ka * 3.0, depth * 0.6)));
  col *= smoothstep(0.03, 0.28, r);
  col += pal(0.05) * exp(-r * 5.0) * (0.3 + uBeat * 0.9);
  fragColor = vec4(col * uIntensity * 1.15, 1.0);
}
`,
    },
    {
      id: 'fractal-kaleido',
      name: 'Fractal Kaleido',
      tags: ['Fractal', 'Psychedelic'],
      frag: `
void main() {
  vec2 p = normUv();
  p *= rot(uTime * 0.11);
  vec2 z = kaleido(p, uSegments) * (1.25 - 0.2 * uBass);
  vec2 c = vec2(0.32 + 0.18 * sin(uTime * 0.31) + uMid * 0.12, 0.44 + 0.16 * cos(uTime * 0.27) + uHigh * 0.1);

  float trap = 1e5;
  float accum = 0.0;
  for (int i = 0; i < 10; i++) {
    z = abs(z) / max(0.18, dot(z, z)) - c;
    z *= rot(0.35 + uMid * 0.25);
    float d = length(z);
    trap = min(trap, d);
    accum += exp(-d * 1.6);
  }

  float s = spec(clamp(trap * 0.4, 0.02, 0.95));
  vec3 col = pal(accum * 0.18 + trap * 0.4 - uTime * 0.07);
  col *= smoothstep(0.0, 2.5, accum) * (0.55 + s * 0.85 + uBeat * 0.4);
  col += pal(0.6 + s * 0.3) * exp(-trap * 4.5) * 0.7;
  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
    {
      id: 'wave-mandala',
      name: 'Wave Mandala',
      tags: ['Waveform', 'Symmetric'],
      frag: `
void main() {
  vec2 p = normUv();
  p *= rot(uTime * 0.1);
  vec2 k = kaleido(p, uSegments);
  float r = length(k);
  float seg = max(2.0, floor(uSegments + 0.5));
  float sector = TAU / seg;
  float aNorm = atan(k.y, k.x) / (sector * 0.5);

  vec3 col = vec3(0.008, 0.012, 0.024);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float x = fract(abs(aNorm) * 0.85 + fi * 0.17 + uTime * 0.05);
    float w = wave(x) * (0.16 + 0.26 * uLevel) * uIntensity;
    float targetR = 0.2 + fi * 0.14 + w;
    float d = abs(r - targetR);
    float glow = 0.011 / (d + 0.004);
    col += pal(fi * 0.2 + abs(w) * 1.4 + uTime * 0.04) * glow * 0.52;
  }
  float halo = exp(-abs(r - (0.35 + uBass * 0.2)) * 18.0) * (0.4 + uBeat * 0.8);
  col += pal(0.1) * halo;
  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
    {
      id: 'liquid-plasma',
      name: 'Liquid Plasma',
      tags: ['Ambient', 'Jazz / Lo-fi'],
      frag: `
void main() {
  vec2 p = normUv();
  vec2 k = mix(p, kaleido(p, uSegments), 0.72);
  float t = uTime * 0.35;

  vec2 q = vec2(
    fbm(k * 1.6 + vec2(t * 0.4, -t * 0.3)),
    fbm(k * 1.6 + vec2(-t * 0.35, t * 0.45) + 3.2)
  );
  vec2 w = vec2(
    fbm(k * 2.1 + q * (1.8 + uMid * 1.2) + vec2(1.7, 9.2)),
    fbm(k * 2.1 + q * (1.8 + uBass * 1.2) + vec2(8.3, 2.8))
  );
  float f = fbm(k * 1.9 + w * 2.1);

  float s = spec(clamp(f, 0.02, 0.95));
  vec3 col = pal(f * 1.15 + length(q) * 0.35 + uTime * 0.03);
  col *= 0.45 + 0.85 * f + s * 0.55;
  col += pal(w.x + 0.4) * smoothstep(0.55, 0.95, w.y) * (0.4 + uHigh * 0.7);
  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
    {
      id: 'nebula-starfield',
      name: 'Nebula Starfield',
      tags: ['Space', 'Ambient'],
      frag: `
void main() {
  vec2 p = normUv();
  p *= rot(uTime * 0.05);
  vec2 k = kaleido(p, uSegments);
  float r = length(k);
  float a = atan(k.y, k.x);

  float neb = fbm(k * 2.5 - vec2(uTime * 0.12, uTime * 0.08));
  vec3 col = pal(neb * 0.9 + r * 0.35) * neb * (0.55 + uMid * 0.7);

  for (int layer = 0; layer < 4; layer++) {
    float fl = float(layer);
    float z = fract(fl * 0.25 + uTime * (0.14 + uBass * 0.15));
    float scale = mix(14.0, 2.5, z);
    vec2 uv = vec2(a * 2.2, log(max(0.05, r)) * 1.8) * scale + vec2(fl * 7.3, -z * 6.0);
    vec2 gv = fract(uv) - 0.5;
    vec2 id = floor(uv);
    float h = hash(id);
    if (h > 0.68) {
      vec2 starPos = (vec2(fract(h * 31.7), fract(h * 73.1)) - 0.5) * 0.55;
      vec2 dVec = gv - starPos;
      dVec.y /= 1.0 + uBeat * 2.5 + uHigh * 1.2;
      float d = length(dVec);
      float star = (0.018 / (d + 0.012)) * smoothstep(0.45, 0.05, d);
      float fade = smoothstep(0.0, 0.2, z) * smoothstep(1.0, 0.65, z);
      col += pal(h + fl * 0.2) * star * fade * (0.7 + uHigh * 0.9);
    }
  }
  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
    {
      id: 'sacred-hex',
      name: 'Sacred Hex',
      tags: ['Geometry', 'Casual'],
      frag: `
float hexDist(vec2 p) {
  p = abs(p);
  return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
}

void main() {
  vec2 p = normUv();
  p *= rot(uTime * 0.07);
  vec2 k = kaleido(p, uSegments);
  float r = length(k);

  vec2 rStep = vec2(1.0, 1.7320508);
  vec2 h = rStep * 0.5;
  vec2 sp = k * (3.2 - uBass * 0.35);
  vec2 a = mod(sp, rStep) - h;
  vec2 b = mod(sp - h, rStep) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = sp - gv;

  float hd = hexDist(gv);
  float cellBand = spec(clamp(fract(length(id) * 0.19), 0.05, 0.9));
  float hexLine = exp(-abs(hd - (0.44 - cellBand * 0.14)) * 32.0);

  float flower = 0.0;
  for (int i = 0; i < 6; i++) {
    float ang = float(i) * TAU / 6.0 + uTime * 0.18;
    vec2 c = vec2(cos(ang), sin(ang)) * (0.34 + uBass * 0.08);
    flower += exp(-abs(length(k - c) - 0.34) * 38.0);
  }

  vec3 col = pal(length(id) * 0.15 + uTime * 0.04) * hexLine * (0.5 + cellBand * 1.1);
  col += pal(r * 0.6 + 0.35) * flower * (0.28 + uMid * 0.55 + uBeat * 0.35);
  col += pal(0.1) * exp(-r * 4.5) * 0.35;
  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
    {
      id: 'mirror-bars',
      name: 'Mirror Bars',
      tags: ['EQ', 'Hip-Hop'],
      frag: `
void main() {
  vec2 p = normUv();
  vec2 k = kaleido(p, max(4.0, floor(uSegments * 0.5) * 2.0));
  float x = abs(k.x);
  float y = abs(k.y);

  float cols = 16.0;
  float colIdx = floor(clamp(x, 0.0, 1.35) * cols) / cols;
  float colFrac = fract(x * cols);
  float barMask = smoothstep(0.1, 0.25, colFrac) * smoothstep(0.9, 0.75, colFrac);

  float s = spec(clamp(colIdx * 0.65 + 0.03, 0.02, 0.95));
  float h = (0.06 + s * 0.85) * uIntensity;

  float fill = smoothstep(h + 0.015, h - 0.015, y) * barMask;
  float cap = exp(-abs(y - h) * 55.0) * barMask * (0.5 + s);
  float refl = exp(-abs(y - h * 0.5) * 8.0) * 0.18;

  vec3 col = pal(colIdx * 0.7 + y * 0.5 + uTime * 0.06) * fill * (0.65 + s * 0.9);
  col += pal(colIdx + 0.35) * cap * 1.25;
  col += pal(0.15 + uBass * 0.2) * refl * (0.4 + uBeat * 0.9);
  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
    {
      id: 'sub-808-shockwave',
      name: '808 Sub Shockwave',
      tags: ['Hip-Hop', '808 Trap'],
      frag: `
void main() {
  vec2 p = normUv();
  float rRaw = length(p);
  float subKick = uSubBass * 0.22 + uBeat * 0.16;
  // Sub-bass gravity lens pinch
  vec2 lensP = p * (1.0 - subKick * exp(-rRaw * 2.2));
  lensP *= rot(uTime * 0.09);
  vec2 k = kaleido(lensP, uSegments);
  float r = length(k);
  float a = atan(k.y, k.x);

  vec3 col = vec3(0.015, 0.008, 0.025);

  // Expanding concentric 808 shockwave rings
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float phase = fract(uTime * 0.42 - fi * 0.166);
    float ringR = phase * 1.45;
    float s = spec(0.02 + fi * 0.12);
    float thick = 0.012 + uSubBass * 0.025;
    float d = abs(r - ringR);
    float waveRing = thick / (d + 0.006);
    float fade = (1.0 - phase) * (0.45 + s * 0.9 + uBeat * 0.7);
    col += pal(phase * 0.65 + fi * 0.12) * waveRing * fade * 0.55;
  }

  // Sharp radial 808 EQ spokes
  float spokeCount = 16.0;
  float spokeAng = fract((a / TAU) * spokeCount + 0.5) - 0.5;
  float spokeMask = smoothstep(0.28, 0.04, abs(spokeAng));
  float eqVal = spec(clamp(fract(a * 1.5), 0.04, 0.88));
  float spokeLen = 0.22 + eqVal * 0.75 * uIntensity;
  float inSpoke = smoothstep(0.16, 0.2, r) * smoothstep(spokeLen + 0.02, spokeLen - 0.02, r);
  col += pal(eqVal * 0.8 + 0.2) * spokeMask * inSpoke * (0.6 + uMid * 0.8);

  // Hi-hat gold sparks in outer field
  float sparkGrid = hash(floor(k * 14.0 + floor(uTime * 6.0)));
  float sparks = smoothstep(0.95, 0.995, sparkGrid) * uHigh * smoothstep(0.2, 0.9, r);
  col += pal(0.85) * sparks * 2.2;

  // Heavy core pulse
  float core = exp(-r * (4.5 - uSubBass * 2.0)) * (0.7 + uBeat * 1.2);
  col += pal(0.1) * core;

  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
    {
      id: 'boom-bap-vortex',
      name: 'Boom-Bap Vinyl Vortex',
      tags: ['Hip-Hop', 'Beats'],
      frag: `
void main() {
  vec2 p = normUv();
  float scratch = sin(uBeatCount * 1.9 + uTime * 3.0) * uBeat * 0.45;
  p *= rot(uTime * 0.45 + scratch);
  vec2 k = mix(p, kaleido(p, max(4.0, uSegments)), 0.45);
  float r = length(k);
  float a = atan(k.y, k.x);

  // Vinyl groove rings modulated by live waveform
  float w = wave(fract(a / TAU + 0.5));
  float grooveR = r + w * 0.035 * (0.4 + uLevel);
  float grooves = sin(grooveR * 120.0) * 0.5 + 0.5;
  float discMask = smoothstep(0.92, 0.88, r) * smoothstep(0.18, 0.21, r);

  float s = spec(clamp((r - 0.18) / 0.72, 0.02, 0.95));
  float specGlow = pow(s, 1.4) * 1.3;

  // Anisotropic vinyl sheen across 2 diagonal highlights
  float sheen = pow(abs(cos(a * 2.0 + uTime * 0.3)), 6.0) * 0.55;

  vec3 col = pal(r * 0.75 + s * 0.45 + uTime * 0.04) * discMask * (0.28 + 0.55 * grooves + specGlow + sheen);

  // Crossfader angular slices flashing on beat
  float slice = smoothstep(0.06, 0.0, abs(sin(a * 4.0 + uBeatCount * 0.7))) * uBeat * discMask;
  col += pal(0.65) * slice * 0.9;

  // Center vinyl label + spindle
  float label = smoothstep(0.2, 0.17, r) * smoothstep(0.03, 0.045, r);
  col += pal(0.25 + uBass * 0.3) * label * (0.85 + uBass * 0.8);
  col += pal(0.05) * exp(-abs(r - 0.9) * 35.0) * (0.5 + uBass);

  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
    {
      id: 'indie-dreamscape',
      name: 'Indie Dreamscape',
      tags: ['Indie', 'Dream Pop'],
      frag: `
void main() {
  vec2 p = normUv();
  vec2 k = mix(p, kaleido(p, uSegments), 0.35);

  // Warm analog sky gradient
  float skyT = clamp(p.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = pal(skyT * 0.45 + uTime * 0.02) * (0.22 + 0.25 * uLevel);

  // Layered dreamy waveform horizon ribbons
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float normI = fi / 6.0;
    float wx = fract(k.x * 0.35 + fi * 0.13 + uTime * 0.04);
    float wv = wave(wx) * (0.14 + uMid * 0.22);
    float sp = spec(0.08 + normI * 0.7) * 0.16;
    float yLine = -0.32 + fi * 0.12 + sin(k.x * 2.2 + uTime * 0.4 + fi) * 0.08 + wv + sp;
    float d = abs(k.y - yLine);
    float ribbon = 0.012 / (d + 0.008);
    float fill = smoothstep(yLine + 0.02, yLine - 0.35, k.y) * 0.16;
    vec3 rCol = pal(normI * 0.75 + 0.15 + uTime * 0.03);
    col += rCol * (ribbon * 0.48 + fill) * (0.65 + uMid * 0.6);
  }

  // Soft floating bokeh light orbs
  for (int j = 0; j < 8; j++) {
    float fj = float(j);
    vec2 center = vec2(
      sin(uTime * 0.28 + fj * 1.7) * 0.95,
      cos(uTime * 0.23 + fj * 2.3) * 0.55
    );
    float radius = 0.11 + 0.06 * sin(fj + uTime * 0.6) + uHigh * 0.08;
    float d = length(k - center);
    float orb = smoothstep(radius, radius * 0.25, d) * 0.35 + exp(-d * 10.0) * 0.45;
    col += pal(fj * 0.14 + 0.5) * orb * (0.45 + uHigh * 0.8 + uBeat * 0.3);
  }

  // Analog tape shimmer
  float grain = (hash(vUv * 400.0 + uTime * 20.0) - 0.5) * 0.04;
  col += grain;

  fragColor = vec4(max(col, 0.0) * uIntensity, 1.0);
}
`,
    },
    {
      id: 'indie-prism-waves',
      name: 'Vinyl & Prism Waves',
      tags: ['Indie', 'Alt Rock'],
      frag: `
void main() {
  vec2 p = normUv();
  vec2 k = mix(p, kaleido(p, max(2.0, min(8.0, uSegments))), 0.4);
  vec3 col = vec3(0.01, 0.012, 0.022);

  // 9 stacked Joy-Division / Unknown Pleasures perspective ridges with prism dispersion
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float normI = fi / 9.0;
    float baseY = -0.58 + fi * 0.145;

    float xNorm = clamp(abs(k.x) * 0.65, 0.0, 1.0);
    float env = exp(-xNorm * xNorm * 3.8);
    float freqSample = spec(clamp(0.04 + xNorm * 0.65 + normI * 0.25, 0.02, 0.96));
    float wSample = wave(fract(k.x * 0.4 + normI * 0.2 + uTime * 0.06));

    float ridge = baseY + (freqSample * 0.34 + wSample * 0.09) * env * (0.65 + uMid * 0.9);
    float d = abs(k.y - ridge);
    float line = 0.0085 / (d + 0.004);

    // Subtle prism RGB dispersion across ridge crest
    vec3 prism = vec3(
      0.007 / (abs(k.y - ridge - 0.008 * (0.5 + uHigh)) + 0.005),
      line,
      0.007 / (abs(k.y - ridge + 0.008 * (0.5 + uHigh)) + 0.005)
    );
    vec3 tint = pal(normI * 0.85 + freqSample * 0.35 + uTime * 0.04);
    col += mix(tint * line, prism * tint, 0.55) * (0.45 + freqSample * 0.9);
  }

  // Subtle prism diagonal flare on beats
  float flare = exp(-abs(k.x - k.y * 0.6) * 8.0) * (0.15 + uBeat * 0.55);
  col += pal(0.45) * flare;

  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
    {
      id: 'rock-overdrive',
      name: 'Amp Overdrive',
      tags: ['Rock', 'Arena'],
      frag: `
void main() {
  vec2 p = normUv();
  vec2 k = kaleido(p, uSegments);
  float r = length(k);
  float a = atan(k.y, k.x);

  vec3 col = vec3(0.015, 0.01, 0.012);

  // 6 vibrating guitar strings across symmetric space
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float normI = fi / 6.0;
    float s = spec(0.08 + normI * 0.72);
    float amp = (0.04 + s * 0.16 + uMid * 0.09) * uIntensity;
    float stringPos = -0.35 + fi * 0.14;
    float vib = sin(k.x * (18.0 + fi * 5.0) + uTime * (12.0 + fi * 2.5)) * amp * exp(-abs(k.x) * 0.45);
    float d = abs(k.y - (stringPos + vib));
    float glow = 0.009 / (d + 0.004);
    col += pal(normI * 0.7 + s * 0.4) * glow * (0.55 + s * 1.1);
  }

  // Arena spotlight beams flaring on power chords
  float powerChord = clamp(uBass * 0.6 + uMid * 0.7 + uBeat * 0.5, 0.0, 1.5);
  float beam = pow(abs(cos(a * 3.0 + uTime * 0.55)), 10.0) * exp(-r * 0.9);
  col += pal(0.15 + uTime * 0.05) * beam * powerChord * 1.6;

  // Overdrive tube plasma core
  float plasma = fbm(k * 3.2 - vec2(uTime * 0.8, 0.0));
  col += pal(plasma * 0.9) * plasma * exp(-r * 1.5) * (0.4 + uFlux * 1.4);

  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
    {
      id: 'metal-inferno',
      name: 'Inferno Mosh',
      tags: ['Metal', 'Heavy'],
      frag: `
void main() {
  vec2 p = normUv();
  p *= 1.0 - uBeat * 0.16;
  p *= rot(uTime * 0.24);
  vec2 k = kaleido(p, max(6.0, uSegments));
  float r = length(k);
  float a = atan(k.y, k.x);

  // Sharp gothic / metal blade geometry
  float blade = abs(sin(a * 4.0 + r * 6.0 - uTime * 1.6));
  float edge = exp(-abs(blade - 0.5) * (18.0 - uBass * 8.0));

  // Branching electric lightning arcs on double-kick & spectral flux
  float boltNoise = fbm(vec2(k.x * 6.0 + uTime * 3.5, k.y * 6.0 - uTime * 2.5));
  float bolt = exp(-abs(boltNoise - 0.5) * 32.0) * (0.35 + uFlux * 2.2 + uBeat * 1.3);

  // Molten magma floor cracks
  float cracks = abs(fbm(k * 4.2 + uTime * 0.35) - 0.5);
  float magma = smoothstep(0.09, 0.005, cracks) * (0.5 + uSubBass * 1.4);

  float s = spec(clamp(r * 0.5, 0.02, 0.95));
  vec3 col = pal(r * 0.5 + s * 0.4) * edge * (0.55 + s * 1.2);
  col += pal(0.25 + uFlux * 0.3) * bolt * 1.25;
  col += pal(0.05) * magma * 1.5;

  // Strobe kick core
  col += pal(0.8) * exp(-r * 5.0) * (0.4 + uBeat * 1.4);
  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
    {
      id: 'prog-tesseract',
      name: 'Polyrhythm Tesseract',
      tags: ['Progressive', 'Math'],
      frag: `
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(1e-5, dot(ba, ba)), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 p = normUv();
  vec2 k = mix(p, kaleido(p, uSegments), 0.65);
  float r = length(k);
  float a = atan(k.y, k.x);

  vec3 col = vec3(0.008, 0.012, 0.025);

  // Counter-rotating 5:7 polyrhythmic polygons
  for (int layer = 0; layer < 4; layer++) {
    float fl = float(layer);
    float sides = mod(fl, 2.0) < 0.5 ? 5.0 : 7.0;
    float spin = uTime * (mod(fl, 2.0) < 0.5 ? 0.5 : -0.7) * (1.0 + fl * 0.15);
    float s = spec(0.08 + fl * 0.22);
    float polyR = 0.22 + fl * 0.17 + s * 0.11;

    float ang = mod(a + spin + TAU, TAU / sides) - (PI / sides);
    float polyD = abs(cos(ang) * r - polyR * cos(PI / sides));
    float line = 0.007 / (polyD + 0.004);
    col += pal(fl * 0.25 + s * 0.3 + uTime * 0.05) * line * (0.45 + s * 0.9 + uBeat * 0.4);
  }

  // Projected rotating cube/tesseract diagonals
  vec2 q = p * rot(uTime * 0.35);
  float scale = 0.42 + uBass * 0.14;
  float dBox = 1e5;
  for (int i = 0; i < 4; i++) {
    float ang0 = float(i) * TAU / 4.0 + uTime * 0.4;
    float ang1 = ang0 + TAU / 4.0;
    float ang2 = ang0 + 0.45 * sin(uTime * 0.6 + uMid);
    vec2 v0 = vec2(cos(ang0), sin(ang0)) * scale;
    vec2 v1 = vec2(cos(ang1), sin(ang1)) * scale;
    vec2 v2 = vec2(cos(ang2), sin(ang2)) * (scale * 0.58);
    dBox = min(dBox, segDist(q, v0, v1));
    dBox = min(dBox, segDist(q, v0, v2));
  }
  col += pal(0.55 + uMid * 0.3) * (0.009 / (dBox + 0.005)) * (0.6 + uHigh * 0.8);

  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
    {
      id: 'techno-warehouse',
      name: 'Warehouse Laser Grid',
      tags: ['Techno', 'Rave'],
      frag: `
void main() {
  vec2 p = normUv();
  float tilt = sin(uTime * 0.25) * 0.12;
  p *= rot(tilt);
  vec2 k = mix(p, kaleido(p, max(2.0, min(6.0, uSegments))), 0.35);

  float horizonY = max(0.05, abs(k.y));
  float depth = 1.0 / horizonY;
  float worldX = k.x * depth;
  float worldZ = depth + uTime * (3.2 + uBass * 2.5);

  // Endless 3D cybernetic floor & ceiling grid
  vec2 gridUv = fract(vec2(worldX * 0.65, worldZ * 0.65)) - 0.5;
  float gridLine = min(abs(gridUv.x), abs(gridUv.y));
  float gridGlow = smoothstep(0.08, 0.005, gridLine) * smoothstep(0.03, 0.35, horizonY);

  float s = spec(clamp(fract(worldZ * 0.06), 0.02, 0.94));
  vec3 col = pal(worldZ * 0.05 + s * 0.35) * gridGlow * (0.55 + s * 1.15);

  // Sweeping club laser beams from vanishing point
  float beamAng = atan(k.y, k.x);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float targetA = sin(uTime * (0.9 + fi * 0.22) + fi * 1.1) * 1.3;
    float dA = abs(sin(beamAng - targetA));
    float beam = (0.012 / (dA + 0.008)) * exp(-length(k) * 0.7);
    col += pal(fi * 0.18 + uHigh * 0.3) * beam * (0.35 + uHigh * 0.9 + uBeat * 0.6);
  }

  // Horizon strobe band
  float horizonStrobe = exp(-abs(k.y) * 26.0) * (0.4 + uBeat * 1.3);
  col += pal(0.1) * horizonStrobe;

  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
    {
      id: 'edm-supernova',
      name: 'Festival Supernova',
      tags: ['EDM', 'Big Room'],
      frag: `
void main() {
  vec2 p = normUv();
  p *= 1.0 - uBeat * 0.12;
  p *= rot(uTime * 0.18);
  vec2 k = kaleido(p, uSegments);
  float r = length(k);
  float a = atan(k.y, k.x);

  // Euphoric radial laser fan
  float rays = pow(abs(cos(a * 8.0 - uTime * 1.4)), 6.0);
  float raySpec = spec(clamp(r * 0.5, 0.02, 0.92));
  vec3 col = pal(r * 0.6 - uTime * 0.1 + raySpec * 0.3) * rays * exp(-r * 0.85) * (0.6 + raySpec * 1.4 + uMid);

  // Drop shockwave rings
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float waveT = fract(uTime * 0.55 + fi * 0.2);
    float ringD = abs(r - waveT * 1.5);
    float ring = (0.014 / (ringD + 0.007)) * (1.0 - waveT);
    col += pal(waveT + fi * 0.15) * ring * (0.4 + uBass * 0.9 + uBeat * 0.6);
  }

  // Warp-speed festival star streaks
  vec2 streakUv = vec2(a * 6.0, r * 5.0 - uTime * (2.5 + uBass * 2.0));
  vec2 cell = floor(streakUv);
  vec2 gv = fract(streakUv) - 0.5;
  float h = hash(cell);
  if (h > 0.72) {
    float d = length(vec2(gv.x * 2.5, gv.y * 0.45));
    col += pal(h) * (0.025 / (d + 0.015)) * (0.4 + uHigh * 1.1);
  }

  // Supernova core flash
  float core = exp(-r * (3.2 - uBass * 1.3)) * (0.85 + uBeat * 1.2);
  col += pal(0.2 + uTime * 0.06) * core;

  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
    {
      id: 'synthwave-outrun',
      name: 'Outrun Cyber Sun',
      tags: ['Synthwave', 'Electro'],
      frag: `
void main() {
  vec2 p = normUv();
  vec3 col = vec3(0.02, 0.008, 0.045);

  // Segmented retro neon sun in upper half
  vec2 sunPos = p - vec2(0.0, 0.18 + uBass * 0.04);
  float sunD = length(sunPos);
  float sunR = 0.44 + uBeat * 0.03;
  if (sunD < sunR) {
    float scan = sin(sunPos.y * 46.0 - uTime * 2.5);
    float cut = sunPos.y < 0.04 ? smoothstep(-0.25, 0.25, scan + sunPos.y * 2.2) : 1.0;
    float gradT = clamp((sunPos.y + sunR) / (2.0 * sunR), 0.0, 1.0);
    col += pal(0.85 - gradT * 0.5) * cut * 1.35;
  }
  col += pal(0.75) * exp(-abs(sunD - sunR) * 16.0) * (0.45 + uBass * 0.8);

  // Mirrored spectrum mountain skyline along horizon
  float symX = abs(p.x);
  float mountainH = spec(clamp(symX * 0.55 + 0.04, 0.02, 0.92)) * 0.36 * uIntensity;
  float horizon = -0.06;
  if (p.y > horizon && p.y < horizon + mountainH) {
    col = mix(col * 0.25, pal(0.35 + (p.y - horizon) * 2.0) * 0.9, 0.85);
  }
  col += pal(0.3) * exp(-abs(p.y - (horizon + mountainH)) * 45.0) * 0.85;

  // Perspective neon grid below horizon
  if (p.y < horizon) {
    float depth = 1.0 / max(0.02, horizon - p.y);
    float gx = p.x * depth * 0.75;
    float gz = depth * 0.65 + uTime * (2.2 + uBass * 1.8);
    vec2 g = fract(vec2(gx, gz)) - 0.5;
    float line = min(abs(g.x), abs(g.y));
    float gridGlow = smoothstep(0.07, 0.005, line) * smoothstep(0.0, 0.25, horizon - p.y);
    col += pal(0.15 + gz * 0.04) * gridGlow * (0.7 + uMid * 0.8 + uBeat * 0.4);
  }

  fragColor = vec4(col * uIntensity, 1.0);
}
`,
    },
  ];

  const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uScene;
uniform sampler2D uHistory;
uniform float uTrails;
uniform float uBass;
uniform float uSpeed;
uniform float uTime;
uniform float uBeatShake;
uniform vec2 uMouse;

void main() {
  vec3 scene = texture(uScene, vUv).rgb;

  vec2 centered = vUv - 0.5;
  float zoom = 1.0 - (0.012 + 0.012 * uBeatShake) * uBass;
  float a = 0.0028 * sin(uTime * 0.5) * uSpeed + uMouse.x * 0.002;
  float c = cos(a);
  float s = sin(a);
  vec2 histUv = mat2(c, -s, s, c) * (centered * zoom) + 0.5;

  vec3 prev = vec3(0.0);
  if (histUv.x >= 0.0 && histUv.x <= 1.0 && histUv.y >= 0.0 && histUv.y <= 1.0) {
    prev = texture(uHistory, histUv).rgb * clamp(uTrails, 0.0, 0.96);
  }

  fragColor = vec4(max(scene, prev), 1.0);
}
`;

  const PRESENT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uInput;
uniform vec2 uRes;
uniform float uBeat;
uniform float uBass;
uniform float uBeatFlash;
uniform float uBeatShake;
uniform float uBloom;
uniform float uChromatic;

vec3 sampleChroma(vec2 uv, vec2 dir, float ca) {
  float r = texture(uInput, clamp(uv + dir * ca, 0.001, 0.999)).r;
  float g = texture(uInput, clamp(uv, 0.001, 0.999)).g;
  float b = texture(uInput, clamp(uv - dir * ca, 0.001, 0.999)).b;
  return vec3(r, g, b);
}

void main() {
  vec2 centered = vUv - 0.5;
  float punch = 1.0 - uBeatShake * (uBeat * 0.025 + uBass * 0.015);
  vec2 uv = centered * punch + 0.5;
  vec2 dir = uv - 0.5;
  float dist = length(dir);

  float ca = uChromatic * (0.0018 + uBeat * 0.006);
  vec3 col = sampleChroma(uv, dir, ca);

  // 9-tap tent/box wide bloom on bright areas
  if (uBloom > 0.01) {
    vec2 px = (1.0 / max(uRes, vec2(1.0))) * 3.5;
    vec3 glow = vec3(0.0);
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        vec2 off = vec2(float(x), float(y)) * px;
        vec3 s = texture(uInput, clamp(uv + off, 0.001, 0.999)).rgb;
        float lum = dot(s, vec3(0.299, 0.587, 0.114));
        glow += s * smoothstep(0.28, 1.0, lum);
      }
    }
    glow /= 9.0;
    col += glow * uBloom * (0.7 + 0.55 * uBeat);
  }

  // Beat flash + soft vignette
  col *= 1.0 + uBeat * uBeatFlash * 0.2;
  float vig = smoothstep(1.05, 0.24, dist);
  col *= mix(0.66, 1.0, vig);

  // ACES-like vibrant filmic tone mapping + gamma
  vec3 a = col * (col + 0.0245786) - 0.000090537;
  vec3 b = col * (0.983729 * col + 0.4329510) + 0.238081;
  col = clamp(a / b, 0.0, 1.0);
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  fragColor = vec4(col, 1.0);
}
`;

  window.KS.VERT_SRC = VERT_SRC;
  window.KS.COMMON_HEADER = COMMON_HEADER;
  window.KS.MODES = MODES;
  window.KS.COMPOSITE_FRAG = COMPOSITE_FRAG;
  window.KS.PRESENT_FRAG = PRESENT_FRAG;
})();
