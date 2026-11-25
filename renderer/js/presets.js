(function () {
  'use strict';
  window.KS = window.KS || {};

  const PALETTES = [
    {
      id: 'neon',
      name: 'Neon',
      a: [0.5, 0.5, 0.5],
      b: [0.5, 0.5, 0.5],
      c: [1.0, 1.0, 1.0],
      d: [0.0, 0.33, 0.67],
    },
    {
      id: 'sunset',
      name: 'Sunset',
      a: [0.55, 0.42, 0.45],
      b: [0.45, 0.38, 0.35],
      c: [1.0, 1.0, 0.5],
      d: [0.8, 0.9, 0.3],
    },
    {
      id: 'ocean',
      name: 'Ocean',
      a: [0.25, 0.5, 0.65],
      b: [0.25, 0.4, 0.35],
      c: [1.0, 1.0, 1.0],
      d: [0.45, 0.25, 0.1],
    },
    {
      id: 'aurora',
      name: 'Aurora',
      a: [0.35, 0.58, 0.55],
      b: [0.35, 0.4, 0.45],
      c: [1.0, 1.0, 1.0],
      d: [0.25, 0.55, 0.75],
    },
    {
      id: 'fire',
      name: 'Fire',
      a: [0.55, 0.25, 0.1],
      b: [0.45, 0.35, 0.2],
      c: [1.0, 0.8, 0.5],
      d: [0.0, 0.15, 0.35],
    },
    {
      id: 'mono-ice',
      name: 'Mono Ice',
      a: [0.55, 0.65, 0.78],
      b: [0.35, 0.32, 0.22],
      c: [1.0, 1.0, 1.0],
      d: [0.1, 0.15, 0.2],
    },
    {
      id: 'rainbow',
      name: 'Rainbow',
      a: [0.5, 0.5, 0.5],
      b: [0.5, 0.5, 0.5],
      c: [1.5, 1.5, 1.5],
      d: [0.1, 0.43, 0.77],
    },
    {
      id: 'pastel',
      name: 'Pastel',
      a: [0.72, 0.68, 0.76],
      b: [0.26, 0.26, 0.24],
      c: [1.0, 1.0, 1.0],
      d: [0.15, 0.45, 0.75],
    },
    {
      id: 'synthwave',
      name: 'Synthwave',
      a: [0.55, 0.32, 0.65],
      b: [0.45, 0.38, 0.35],
      c: [1.0, 0.7, 1.0],
      d: [0.85, 0.1, 0.45],
    },
    {
      id: 'blood-metal',
      name: 'Blood Metal',
      a: [0.45, 0.12, 0.12],
      b: [0.5, 0.28, 0.18],
      c: [1.0, 0.7, 0.4],
      d: [0.0, 0.12, 0.28],
    },
    {
      id: 'indie-tape',
      name: 'Indie Tape',
      a: [0.62, 0.52, 0.46],
      b: [0.36, 0.34, 0.35],
      c: [0.9, 0.85, 0.8],
      d: [0.08, 0.28, 0.52],
    },
    {
      id: 'techno-acid',
      name: 'Techno Acid',
      a: [0.35, 0.55, 0.38],
      b: [0.45, 0.45, 0.42],
      c: [1.0, 1.0, 0.8],
      d: [0.25, 0.05, 0.55],
    },
    {
      id: 'gold-cipher',
      name: '808 Gold',
      a: [0.56, 0.44, 0.52],
      b: [0.44, 0.38, 0.42],
      c: [1.0, 0.85, 1.0],
      d: [0.1, 0.22, 0.62],
    },
  ];

  const GENRE_PRESETS = [
    {
      id: 'edm',
      name: 'EDM / Festival',
      mode: 'edm-supernova',
      palette: 'neon',
      segments: 10,
      speed: 1.4,
      intensity: 1.35,
      trails: 0.82,
      sensitivity: 1.3,
    },
    {
      id: 'techno',
      name: 'Techno / Rave',
      mode: 'techno-warehouse',
      palette: 'techno-acid',
      segments: 8,
      speed: 1.45,
      intensity: 1.35,
      trails: 0.78,
      sensitivity: 1.35,
    },
    {
      id: 'hiphop',
      name: 'Hip-Hop / 808',
      mode: 'sub-808-shockwave',
      palette: 'gold-cipher',
      segments: 8,
      speed: 1.15,
      intensity: 1.4,
      trails: 0.76,
      sensitivity: 1.45,
    },
    {
      id: 'boombap',
      name: 'Boom-Bap / Beats',
      mode: 'boom-bap-vortex',
      palette: 'synthwave',
      segments: 6,
      speed: 1.05,
      intensity: 1.25,
      trails: 0.75,
      sensitivity: 1.35,
    },
    {
      id: 'indie',
      name: 'Indie / Dream Pop',
      mode: 'indie-dreamscape',
      palette: 'indie-tape',
      segments: 6,
      speed: 0.8,
      intensity: 1.05,
      trails: 0.88,
      sensitivity: 1.15,
    },
    {
      id: 'indierock',
      name: 'Indie / Alt Waves',
      mode: 'indie-prism-waves',
      palette: 'pastel',
      segments: 4,
      speed: 0.95,
      intensity: 1.15,
      trails: 0.82,
      sensitivity: 1.2,
    },
    {
      id: 'rock',
      name: 'Rock / Overdrive',
      mode: 'rock-overdrive',
      palette: 'sunset',
      segments: 6,
      speed: 1.35,
      intensity: 1.3,
      trails: 0.76,
      sensitivity: 1.3,
    },
    {
      id: 'metal',
      name: 'Heavy Metal',
      mode: 'metal-inferno',
      palette: 'blood-metal',
      segments: 10,
      speed: 1.65,
      intensity: 1.45,
      trails: 0.74,
      sensitivity: 1.45,
    },
    {
      id: 'prog',
      name: 'Progressive / Math',
      mode: 'prog-tesseract',
      palette: 'aurora',
      segments: 14,
      speed: 1.2,
      intensity: 1.25,
      trails: 0.85,
      sensitivity: 1.25,
    },
    {
      id: 'psychedelic',
      name: 'Psychedelic / Trance',
      mode: 'fractal-kaleido',
      palette: 'rainbow',
      segments: 12,
      speed: 1.3,
      intensity: 1.3,
      trails: 0.84,
      sensitivity: 1.25,
    },
    {
      id: 'synthwave',
      name: 'Synthwave / Outrun',
      mode: 'synthwave-outrun',
      palette: 'synthwave',
      segments: 6,
      speed: 1.15,
      intensity: 1.2,
      trails: 0.80,
      sensitivity: 1.25,
    },
    {
      id: 'classical',
      name: 'Classical',
      mode: 'mandala-rings',
      palette: 'ocean',
      segments: 12,
      speed: 0.75,
      intensity: 0.95,
      trails: 0.86,
      sensitivity: 1.15,
    },
    {
      id: 'jazz',
      name: 'Jazz / Lo-fi',
      mode: 'liquid-plasma',
      palette: 'sunset',
      segments: 6,
      speed: 0.65,
      intensity: 0.9,
      trails: 0.88,
      sensitivity: 1.1,
    },
    {
      id: 'casual',
      name: 'Casual Aesthetic',
      mode: 'sacred-hex',
      palette: 'pastel',
      segments: 6,
      speed: 0.55,
      intensity: 0.75,
      trails: 0.86,
      sensitivity: 1.0,
    },
  ];

  function getPalette(id) {
    return PALETTES.find((p) => p.id === id) || PALETTES[0];
  }

  function evalPalette(pal, t) {
    const twoPi = Math.PI * 2;
    const out = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const v = pal.a[i] + pal.b[i] * Math.cos(twoPi * (pal.c[i] * t + pal.d[i]));
      out[i] = Math.max(0, Math.min(255, Math.round(v * 255)));
    }
    return `rgb(${out[0]},${out[1]},${out[2]})`;
  }

  function paletteGradientCss(pal) {
    const stops = [0.0, 0.25, 0.5, 0.75, 1.0].map(
      (t, idx) => `${evalPalette(pal, t)} ${idx * 25}%`
    );
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }

  window.KS.PALETTES = PALETTES;
  window.KS.GENRE_PRESETS = GENRE_PRESETS;
  window.KS.getPalette = getPalette;
  window.KS.evalPalette = evalPalette;
  window.KS.paletteGradientCss = paletteGradientCss;
})();
