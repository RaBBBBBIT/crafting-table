'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getClientSettings: () => ipcRenderer.invoke('settings:getClient'),
  saveClientSettings: (settings) => ipcRenderer.invoke('settings:saveClient', settings),
  testApiConnection: (apiBaseUrl) => ipcRenderer.invoke('api:testConnection', apiBaseUrl),
  getWorkbenchState: () => ipcRenderer.invoke('workbench:getState'),
  saveWorkbenchState: (state) => ipcRenderer.invoke('workbench:saveState', state),
});
