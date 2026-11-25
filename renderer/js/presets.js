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
      c: [1.0, 1.0, 1.0],
      d: [0.0, 0.33, 0.67],
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
  ];

  // Adjust rainbow vs neon slightly so they feel distinct
  PALETTES[6].c = [1.5, 1.5, 1.5];
  PALETTES[6].d = [0.1, 0.43, 0.77];

  const GENRE_PRESETS = [
    {
      id: 'edm',
      name: 'EDM / House',
      mode: 'kaleido-bloom',
      palette: 'neon',
      segments: 8,
      speed: 1.35,
      intensity: 1.25,
      trails: 0.80,
      sensitivity: 1.3,
    },
    {
      id: 'hiphop',
      name: 'Hip-Hop / Trap',
      mode: 'mirror-bars',
      palette: 'synthwave',
      segments: 6,
      speed: 1.1,
      intensity: 1.3,
      trails: 0.72,
      sensitivity: 1.4,
    },
    {
      id: 'rock',
      name: 'Rock / Metal',
      mode: 'tunnel-warp',
      palette: 'fire',
      segments: 6,
      speed: 1.5,
      intensity: 1.35,
      trails: 0.76,
      sensitivity: 1.35,
    },
    {
      id: 'pop',
      name: 'Pop',
      mode: 'radial-spectrum',
      palette: 'pastel',
      segments: 10,
      speed: 1.15,
      intensity: 1.1,
      trails: 0.74,
      sensitivity: 1.2,
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
      id: 'ambient',
      name: 'Ambient / Chill',
      mode: 'nebula-starfield',
      palette: 'aurora',
      segments: 4,
      speed: 0.5,
      intensity: 0.85,
      trails: 0.90,
      sensitivity: 1.05,
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
      id: 'casual',
      name: 'Casual Aesthetic',
      mode: 'sacred-hex',
      palette: 'pastel',
      segments: 6,
      speed: 0.55,
      intensity: 0.7,
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
