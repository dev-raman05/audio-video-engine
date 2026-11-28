'use strict';

const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  desktopCapturer,
  powerSaveBlocker,
  screen,
  shell,
} = require('electron');
const fs = require('fs');
const path = require('path');
const updater = require('./updater');

const isSmoke = process.argv.includes('--smoke-test');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let stageWindow = null;
let powerBlockerId = null;
let smokeWatchdog = null;

function startKeepAwake() {
  if (powerBlockerId === null || !powerSaveBlocker.isStarted(powerBlockerId)) {
    powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  }
}

function stopKeepAwake() {
  if (powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)) {
    powerSaveBlocker.stop(powerBlockerId);
  }
  powerBlockerId = null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 640,
    minHeight: 360,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    title: 'KaleidoSync — Audio Visualizer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (stageWindow && !stageWindow.isDestroyed()) {
      stageWindow.close();
    }
  });
}

function toggleStageWindow() {
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.close();
    stageWindow = null;
    return { active: false };
  }

  const displays = screen.getAllDisplays();
  const winBounds = mainWindow ? mainWindow.getBounds() : { x: 0, y: 0, width: 1280, height: 760 };
  const currentDisplay = screen.getDisplayMatching(winBounds);
  const external = displays.find((d) => d.id !== currentDisplay.id) || null;
  const target = external || currentDisplay;

  stageWindow = new BrowserWindow({
    x: external ? target.bounds.x : target.bounds.x + 60,
    y: external ? target.bounds.y : target.bounds.y + 60,
    width: external ? target.bounds.width : Math.min(1280, target.workArea.width - 120),
    height: external ? target.bounds.height : Math.min(720, target.workArea.height - 120),
    fullscreen: !!external,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    title: 'KaleidoSync — Stage Output',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  stageWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
    query: { stage: '1' },
  });

  stageWindow.on('closed', () => {
    stageWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ks:stageState', { active: false });
    }
  });

  return { active: true, external: !!external, displays: displays.length };
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  startKeepAwake();

  const displayMediaHandler = async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      if (sources && sources.length > 0) {
        callback({ video: sources[0], audio: 'loopback' });
      } else {
        callback({});
      }
    } catch (_err) {
      callback({});
    }
  };

  try {
    session.defaultSession.setDisplayMediaRequestHandler(displayMediaHandler, {
      useSystemPicker: false,
    });
  } catch (_err) {
    session.defaultSession.setDisplayMediaRequestHandler(displayMediaHandler);
  }

  ipcMain.handle('ks:toggleFullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!win) return false;
    const next = !win.isFullScreen();
    win.setFullScreen(next);
    return next;
  });

  ipcMain.handle('ks:setFullscreen', (event, enabled) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (!win) return false;
    win.setFullScreen(!!enabled);
    return win.isFullScreen();
  });

  ipcMain.handle('ks:setAlwaysOnTop', (_event, enabled) => {
    if (!mainWindow) return false;
    mainWindow.setAlwaysOnTop(!!enabled);
    return mainWindow.isAlwaysOnTop();
  });

  ipcMain.handle('ks:setKeepAwake', (_event, enabled) => {
    if (enabled) {
      startKeepAwake();
      return true;
    }
    stopKeepAwake();
    return false;
  });

  ipcMain.handle('ks:nextDisplay', () => {
    if (!mainWindow) return { index: 0, count: 1 };
    const displays = screen.getAllDisplays();
    if (displays.length === 0) return { index: 0, count: 0 };

    const winBounds = mainWindow.getBounds();
    const currentDisplay = screen.getDisplayMatching(winBounds);
    const currentIdx = displays.findIndex((d) => d.id === currentDisplay.id);
    const nextIdx = (currentIdx + 1) % displays.length;
    const target = displays[nextIdx];

    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
    mainWindow.setBounds({
      x: target.bounds.x + 40,
      y: target.bounds.y + 40,
      width: Math.min(1280, target.workArea.width - 80),
      height: Math.min(760, target.workArea.height - 80),
    });
    mainWindow.setFullScreen(true);
    return { index: nextIdx, count: displays.length };
  });

  ipcMain.handle('ks:toggleStageMode', () => toggleStageWindow());

  ipcMain.on('ks:stageFrame', (_event, payload) => {
    if (stageWindow && !stageWindow.isDestroyed() && !stageWindow.webContents.isLoading()) {
      stageWindow.webContents.send('ks:stageFrame', payload);
    }
  });

  ipcMain.handle('ks:isSmoke', () => isSmoke);

  ipcMain.handle('ks:getVersion', () => app.getVersion());

  ipcMain.handle('ks:checkForUpdates', () => updater.checkForUpdates(app.getVersion()));

  ipcMain.handle('ks:installUpdate', () =>
    updater.downloadAndInstallUpdate({
      currentVersion: app.getVersion(),
      isPackaged: app.isPackaged,
      exePath: app.getPath('exe'),
      onProgress: (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ks:updateProgress', data);
        }
      },
      onQuit: () => {
        stopKeepAwake();
        app.quit();
      },
    })
  );

  ipcMain.handle('ks:openExternal', (_event, url) => {
    if (typeof url === 'string' && url.startsWith('https://github.com/dev-raman05/audio-video-engine')) {
      return shell.openExternal(url);
    }
    return false;
  });

  ipcMain.handle('ks:capture', async (_event, name) => {
    if (!mainWindow) return null;
    const safeName = String(name || 'capture').replace(/[^a-zA-Z0-9._-]/g, '_');
    const outDir = path.join(process.cwd(), 'smoke');
    fs.mkdirSync(outDir, { recursive: true });
    const image = await mainWindow.webContents.capturePage();
    const outPath = path.join(outDir, `${safeName}.png`);
    fs.writeFileSync(outPath, image.toPNG());
    return outPath;
  });

  ipcMain.handle('ks:smokeDone', (_event, report) => {
    if (smokeWatchdog) {
      clearTimeout(smokeWatchdog);
      smokeWatchdog = null;
    }
    console.log('SMOKE_RESULT ' + JSON.stringify(report));
    stopKeepAwake();
    app.exit(report && report.ok ? 0 : 1);
  });

  if (isSmoke) {
    smokeWatchdog = setTimeout(() => {
      console.log('SMOKE_RESULT {"ok":false,"error":"timeout"}');
      stopKeepAwake();
      app.exit(1);
    }, 60000);
  }

  createWindow();
});

app.on('before-quit', () => {
  stopKeepAwake();
});

app.on('window-all-closed', () => {
  stopKeepAwake();
  app.quit();
});
