# KaleidoSync

Cross-platform (**Windows, macOS, Linux**) audio-reactive WebGL2 kaleidoscope visualizer that listens passively to your music from any source—Spotify, YouTube, Apple Music, browser tabs, VLC, or games—only while the app window is open.

## One-Click Download (No Zip Extraction Required)

> **Just want to run the app?** **Do NOT click GitHub's green `Code → Download ZIP` button** (that only downloads raw developer source code). Click your OS installer below to download and run immediately:

| Platform | Direct Installer Download | How to Run |
| --- | --- | --- |
| **Windows (64-bit)** | **[KaleidoSync-Windows-Setup.exe](https://github.com/dev-raman05/audio-video-engine/releases/latest/download/KaleidoSync-Windows-Setup.exe)** | Double-click to install & launch (creates Desktop & Start Menu shortcuts). If SmartScreen warns about an unsigned app, click **More info → Run anyway**. |
| **macOS (Apple Silicon M1–M5)** | **[KaleidoSync-macOS-arm64.dmg](https://github.com/dev-raman05/audio-video-engine/releases/latest/download/KaleidoSync-macOS-arm64.dmg)** | Open `.dmg`, drag **KaleidoSync** to **Applications**, then open via **System Settings → Privacy & Security → Open Anyway** (or run `xattr -cr /Applications/KaleidoSync.app`). Allow **Screen & System Audio Recording** when prompted. |
| **macOS (Intel)** | **[KaleidoSync-macOS-x64.dmg](https://github.com/dev-raman05/audio-video-engine/releases/latest/download/KaleidoSync-macOS-x64.dmg)** | Open `.dmg`, drag **KaleidoSync** to **Applications**, then open via **System Settings → Privacy & Security → Open Anyway** (or run `xattr -cr /Applications/KaleidoSync.app`). Allow **Screen & System Audio Recording** when prompted. |
| **Linux (Any Distro, x64)** | **[KaleidoSync-Linux-x64.AppImage](https://github.com/dev-raman05/audio-video-engine/releases/latest/download/KaleidoSync-Linux-x64.AppImage)** | `chmod +x KaleidoSync-Linux-x64.AppImage && ./KaleidoSync-Linux-x64.AppImage`. On PulseAudio/PipeWire, pick `Monitor of ...` under **Microphone / Line-In** if loopback isn't listed. |
| **Linux (Ubuntu / Debian, x64)** | **[KaleidoSync-Linux-x64.deb](https://github.com/dev-raman05/audio-video-engine/releases/latest/download/KaleidoSync-Linux-x64.deb)** | `sudo apt install ./KaleidoSync-Linux-x64.deb` then launch **KaleidoSync** from your app menu. |

**macOS Apple Silicon (M1–M5) 1-Line Terminal Install (Zero Gatekeeper Warnings):**
```bash
curl -L -o /tmp/KaleidoSync.dmg https://github.com/dev-raman05/audio-video-engine/releases/latest/download/KaleidoSync-macOS-arm64.dmg && hdiutil attach /tmp/KaleidoSync.dmg -nobrowse -quiet && rm -rf /Applications/KaleidoSync.app && cp -R /Volumes/KaleidoSync*/KaleidoSync.app /Applications/ && hdiutil detach /Volumes/KaleidoSync* -quiet && xattr -cr /Applications/KaleidoSync.app && open /Applications/KaleidoSync.app
```

You can also browse **[All Releases](https://github.com/dev-raman05/audio-video-engine/releases)**.

### 1-Click In-Place Updates (No Reinstall Hassle)
Once installed, KaleidoSync checks GitHub Releases automatically on startup (or anytime via **Check Updates**). When a new version is out, click **Install & Restart** right inside the app—it downloads the matching installer for your OS (Windows `.exe`, macOS `.dmg` `arm64`/`x64`, or Linux `.AppImage`/`.deb`), verifies its **SHA-256 checksum** against `SHA256SUMS.txt`, updates your existing installation **in place** while keeping your settings, and relaunches automatically.

---

## Features

- **Any-Source System Audio + Hot-Swap Guardrail:** Passive system audio loopback via Electron `getDisplayMedia`. Never modifies audio output or interferes with other apps. Also supports Microphone/Line-In and a silent synthetic Demo Beat mode, with automatic `devicechange` hot-swap recovery.
- **21 Genre-Tailored, Beat- & Tune-Reactive Shaders:**
  - **EDM / Techno / Synthwave:** *Festival Supernova*, *Warehouse Laser Grid*, *Outrun Cyber Sun*, *Kaleido Bloom*
  - **Hip-Hop / Trap / Beats:** *808 Sub Shockwave*, *Boom-Bap Vinyl Vortex*, *Mirror Bars*
  - **Indie / Alternative:** *Indie Dreamscape*, *Vinyl & Prism Waves*
  - **Rock / Metal / Progressive:** *Amp Overdrive*, *Inferno Mosh*, *Polyrhythm Tesseract*, *Tunnel Warp*
  - **Hypnotic / Ambient / Classical / Geometry:** *Trance Spiral*, *Mandala Rings*, *Radial Spectrum*, *Fractal Kaleido*, *Wave Mandala*, *Liquid Plasma*, *Nebula Starfield*, *Sacred Hex*
- **Live Audio Mood Auto-Pilot (AI-Free):** Classifies live spectral energy, tempo, and bass pulse in real time (`calm`, `indie`, `hiphop`, `rock`, `edm`) and smoothly transitions into matching visual modes without any external AI dependency.
- **VJ Dual-Layer Blending & True GPU Crossfade:** Blend a secondary overlay shader (`Mix`, `Screen Glow`, or `Prism Difference`) onto the active canvas and transition between modes with zero-glitch GPU crossfades.
- **BPM-Locked Transitions & Drop Detector:** Tracks live tempo (`BPM`) and musical bars (`16-bar` phrase locks), plus detects bass drops to trigger beat-aligned mode switches and subtle zoom punches.
- **Dual-Screen Stage / Projector Mode:** Keep your VJ controls on your laptop screen while pushing a pure, UI-free fullscreen output (`?stage=1`) directly to your connected projector or external display at 1× GPU load.
- **14 Genre Presets & 13 Color Palettes:** One-click tuning for EDM/Festival, Techno/Rave, Hip-Hop/808, Boom-Bap, Indie/Dream Pop, Indie/Alt Waves, Rock/Overdrive, Heavy Metal, Progressive/Math, Psychedelic, Synthwave, Classical, Jazz/Lo-fi, and Casual Aesthetic, dynamically modulated by melodic pitch (`tuneHue`) and spectral centroid.
- **WebGL Recovery & Signing Guardrails:** Automatic `webglcontextlost` / `webglcontextrestored` recovery across sleep/wake, HDMI hot-plug, or GPU resets; keep-screen-awake support; and optional **Code Signing & Apple Notarization** in CI when repository secrets are configured (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` for macOS; `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` for Windows).
- **On-Demand Only:** No background service, no system tray process, no auto-start, and no global hotkeys. Closing the window exits completely.

## Privacy

All audio analysis runs locally in memory in real time (`AnalyserNode`) and is never recorded, saved to disk, or transmitted over the network.

## One-Click Scripts (Windows Developers)

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
npm.cmd run dist:win     # Windows NSIS setup exe
npm.cmd run dist:mac     # macOS arm64 + x64 dmg
npm.cmd run dist:linux   # Linux AppImage + deb
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
