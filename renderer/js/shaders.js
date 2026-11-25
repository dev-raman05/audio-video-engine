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
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uLevel;
uniform float uBeat;
uniform float uBeatCount;
uniform float uSegments;
uniform float uSpeed;
uniform float uIntensity;
uniform float uHueShift;
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
      // Streak radially on beats
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

  // Flower-of-life pulsing circle overlay
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

void main() {
  vec3 scene = texture(uScene, vUv).rgb;

  vec2 centered = vUv - 0.5;
  float zoom = 1.0 - 0.012 * uBass;
  float a = 0.0025 * sin(uTime * 0.5) * uSpeed;
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
uniform float uBeat;
uniform float uBeatFlash;

void main() {
  vec2 dir = vUv - 0.5;
  float dist = length(dir);
  float ca = uBeat * uBeatFlash * 0.0045;

  float r = texture(uInput, vUv + dir * ca).r;
  float g = texture(uInput, vUv).g;
  float b = texture(uInput, vUv - dir * ca).b;
  vec3 col = vec3(r, g, b);

  // Subtle beat flash + soft vignette + tone map + gamma
  col *= 1.0 + uBeat * uBeatFlash * 0.18;
  float vig = smoothstep(1.05, 0.25, dist);
  col *= mix(0.68, 1.0, vig);

  col = col / (1.0 + col * 0.35);
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
