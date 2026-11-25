# KaleidoSync

Standalone Windows audio-reactive WebGL2 visualizer that listens passively to your system audio (WASAPI loopback) from any application—Spotify, YouTube, browser tabs, VLC, or games—only while the app window is open.

## Features

- **Any-Source System Audio:** Passive WASAPI loopback capture via Electron `getDisplayMedia`. Never modifies audio output or interferes with other apps. Also supports Microphone/Line-In and a silent synthetic Demo Beat mode.
- **10 Symmetric & Frequency-Reactive Shaders:** Kaleido Bloom, Mandala Rings, Radial Spectrum, Tunnel Warp, Fractal Kaleido, Wave Mandala, Liquid Plasma, Nebula Starfield, Sacred Hex, and Mirror Bars.
- **9 Genre Presets:** Instant tuning for EDM/House, Hip-Hop/Trap, Rock/Metal, Pop, Classical, Jazz/Lo-fi, Ambient/Chill, Psychedelic/Trance, and Casual Aesthetic.
- **Projector & Background Friendly:** Auto-hiding control panel and cursor (3s inactivity), multi-display projector routing (`Next Display`), display sleep prevention (`Keep Screen Awake`), and optional `Always on Top`.
- **On-Demand Only:** No background service, no system tray process, no auto-start, and no global hotkeys. Closing the window exits completely.

## Privacy

All audio analysis runs locally in memory in real time (`AnalyserNode`) and is never recorded, saved to disk, or transmitted over the network.

## Running & Building

```powershell
# Run in development
npm.cmd start

# Run automated smoke test + mode screenshots
npm.cmd run smoke

# Build standalone Windows app folder
npm.cmd run dist
```

`npm.cmd run dist` produces `dist/win-unpacked/KaleidoSync.exe` along with its supporting runtime files. Keep the `win-unpacked` folder together; you can create a Desktop or Start Menu shortcut to `KaleidoSync.exe` (right-click `KaleidoSync.exe` → **Send to** → **Desktop (create shortcut)**) or pin it to the taskbar.

## Keyboard Shortcuts (Window-Only)

| Key | Action |
| --- | --- |
| `F` / `F11` | Toggle fullscreen |
| `Esc` | Exit fullscreen / close help |
| `H` | Hide / show control panel |
| `Space` / `→` | Next visual mode |
| `←` | Previous visual mode |
| `↑` / `↓` | Adjust intensity |
| `1`–`9` | Apply genre preset |
| `P` | Next color palette |
| `A` | Toggle auto-cycle on beat |
| `?` | Toggle keyboard shortcut help |
