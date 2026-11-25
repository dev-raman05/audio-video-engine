# KaleidoSync

Cross-platform (**Windows, macOS, Linux**) audio-reactive WebGL2 kaleidoscope visualizer that listens passively to your music from any source—Spotify, YouTube, Apple Music, browser tabs, VLC, or games—only while the app window is open.

## Download & Install (Windows, macOS, Linux)

Download the pre-built app for your operating system from the **[Latest GitHub Release](https://github.com/dev-raman05/audio-video-engine/releases/latest)**:

- **Windows (`x64`):** Run `KaleidoSync-Setup-x.y.z-x64.exe` (installer with Desktop & Start Menu shortcuts) or extract `KaleidoSync-x.y.z-win-x64.zip` and run `KaleidoSync.exe`.
- **macOS (Apple Silicon `arm64` & Intel `x64`):** Open the matching `.dmg` (or `.zip`) and drag **KaleidoSync.app** to **Applications**.
  - *First-launch note:* Because the app is not Apple-notarized, **right-click → Open** on first launch (or run `xattr -cr /Applications/KaleidoSync.app`). When prompted, grant **Screen & System Audio Recording** permission for system loopback audio (or choose Microphone / virtual audio).
- **Linux (`x64`):**
  - **AppImage:** `chmod +x KaleidoSync-*.AppImage && ./KaleidoSync-*.AppImage`
  - **Debian / Ubuntu:** `sudo apt install ./KaleidoSync-*.deb`
  - **Tarball:** Extract `KaleidoSync-*.tar.gz` and run `./kaleidosync`
  - *Audio note:* On PulseAudio/PipeWire, if System Audio loopback is unavailable on your desktop environment, pick your `Monitor of ...` device under **Microphone / Line-In**.

---

## Features

- **Any-Source System Audio:** Passive system audio loopback via Electron `getDisplayMedia`. Never modifies audio output or interferes with other apps. Also supports Microphone/Line-In and a silent synthetic Demo Beat mode.
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

- `launch-kaleidosync.bat` — Launches the local standalone `dist\win-unpacked\KaleidoSync.exe` (or falls back to `npm.cmd start`).
- `deploy-to-github.bat` — Stages all changes, commits (with custom or timestamp message), syncs, and pushes directly to `https://github.com/dev-raman05/audio-video-engine.git`.
- `release-to-github.bat` — Bumps version, commits, creates a `vX.Y.Z` tag, and pushes to trigger the cross-platform GitHub Actions release build (Windows + macOS + Linux).
- `update-from-github.bat` — Pulls the latest changes from GitHub, installs dependencies, and rebuilds `dist\win-unpacked\KaleidoSync.exe`.

## Running & Building from Source

```powershell
# Run in development
npm.cmd start

# Run automated smoke test + mode screenshots
npm.cmd run smoke

# Fast local Windows unpacked build (uses local node_modules/electron/dist)
npm.cmd run dist:local

# Build installers for your current OS
npm.cmd run dist:win     # Windows NSIS installer + zip
npm.cmd run dist:mac     # macOS arm64 + x64 dmg & zip
npm.cmd run dist:linux   # Linux AppImage + deb + tar.gz
```

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
