'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kaleido', {
  toggleFullscreen: () => ipcRenderer.invoke('ks:toggleFullscreen'),
  setFullscreen: (enabled) => ipcRenderer.invoke('ks:setFullscreen', enabled),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('ks:setAlwaysOnTop', enabled),
  setKeepAwake: (enabled) => ipcRenderer.invoke('ks:setKeepAwake', enabled),
  nextDisplay: () => ipcRenderer.invoke('ks:nextDisplay'),
  isSmoke: () => ipcRenderer.invoke('ks:isSmoke'),
  capture: (name) => ipcRenderer.invoke('ks:capture', name),
  smokeDone: (report) => ipcRenderer.invoke('ks:smokeDone', report),
});
