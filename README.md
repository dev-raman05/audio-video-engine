# KaleidoSync

Standalone Windows audio-reactive WebGL2 visualizer that listens passively to your system audio (WASAPI loopback) from any application—Spotify, YouTube, browser tabs, VLC, or games—only while the app window is open.

## Features

- **Any-Source System Audio:** Passive WASAPI loopback capture via Electron `getDisplayMedia`. Never modifies audio output or interferes with other apps. Also supports Microphone/Line-In and a silent synthetic Demo Beat mode.
- **20 Genre-Tailored & Symmetric Shaders:**
  - **EDM / Techno / Synthwave:** *Festival Supernova*, *Warehouse Laser Grid*, *Outrun Cyber Sun*, *Kaleido Bloom*
  - **Hip-Hop / Trap / Beats:** *808 Sub Shockwave*, *Boom-Bap Vinyl Vortex*, *Mirror Bars*
  - **Indie / Alternative:** *Indie Dreamscape*, *Vinyl & Prism Waves*
  - **Rock / Metal / Progressive:** *Amp Overdrive*, *Inferno Mosh*, *Polyrhythm Tesseract*, *Tunnel Warp*
  - **Ambient / Classical / Geometry:** *Mandala Rings*, *Radial Spectrum*, *Fractal Kaleido*, *Wave Mandala*, *Liquid Plasma*, *Nebula Starfield*, *Sacred Hex*
- **14 Genre Presets & 13 Color Palettes:** One-click tuning for EDM/Festival, Techno/Rave, Hip-Hop/808, Boom-Bap, Indie/Dream Pop, Indie/Alt Waves, Rock/Overdrive, Heavy Metal, Progressive/Math, Psychedelic, Synthwave, Classical, Jazz/Lo-fi, and Casual Aesthetic.
- **Immersive Post-FX:** Adjustable **Neon Bloom**, **Prism Chromatic Aberration**, **Bass Camera Punch** (subtle zoom kick), **Beat Flash**, and smooth mode-switch trail morphing.
- **Projector & Background Friendly:** Auto-hiding control panel and cursor (3s inactivity), multi-display projector routing (`Next Display`), display sleep prevention (`Keep Screen Awake`), and optional `Always on Top`.
- **On-Demand Only:** No background service, no system tray process, no auto-start, and no global hotkeys. Closing the window exits completely.

## Privacy

All audio analysis runs locally in memory in real time (`AnalyserNode`) and is never recorded, saved to disk, or transmitted over the network.

## One-Click Scripts (Windows)

- `launch-kaleidosync.bat` — Launches the standalone `dist\win-unpacked\KaleidoSync.exe` (or falls back to `npm.cmd start`).
- `deploy-to-github.bat` — Stages all changes, commits (with custom or timestamp message), syncs, and pushes directly to `https://github.com/dev-raman05/audio-video-engine.git`.
- `update-from-github.bat` — Pulls the latest changes from GitHub, installs dependencies, and rebuilds `dist\win-unpacked\KaleidoSync.exe`.

## Running & Building

```powershell
# Run in development
npm.cmd start

# Run automated smoke test + mode screenshots
npm.cmd run smoke

# Build standalone Windows app folder
npm.cmd run dist
```

`npm.cmd run dist` produces `dist/win-unpacked/KaleidoSync.exe` along with its supporting runtime files. Keep the `win-unpacked` folder together; you can create a Desktop or Start Menu shortcut to `KaleidoSync.exe` or use `launch-kaleidosync.bat`.

## Keyboard Shortcuts (Window-Only)

| Key | Action |
| --- | --- |
| `F` / `F11` | Toggle fullscreen |
| `Esc` | Exit fullscreen / close help |
| `H` | Hide / show control panel |
| `Space` / `→` | Next visual mode |
| `←` | Previous visual mode |
| `↑` / `↓` | Adjust intensity |
| `1`–`0` | Apply genre preset (1–10) |
| `P` | Next color palette |
| `R` | Shuffle random mode & palette |
| `A` | Toggle auto-cycle on beat |
| `?` | Toggle keyboard shortcut help |
