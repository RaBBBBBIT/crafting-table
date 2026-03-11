'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Tasks
  getTasks: (categoryId) => ipcRenderer.invoke('task:getAll', categoryId),
  getTaskCount: () => ipcRenderer.invoke('task:count'),
  createTask: (task) => ipcRenderer.invoke('task:create', task),
  updateTask: (id, updates) => ipcRenderer.invoke('task:update', id, updates),
  deleteTask: (id) => ipcRenderer.invoke('task:delete', id),

  // Categories
  getCategories: () => ipcRenderer.invoke('category:getAll'),
  createCategory: (category) => ipcRenderer.invoke('category:create', category),
  updateCategory: (id, updates) => ipcRenderer.invoke('category:update', id, updates),
  deleteCategory: (id) => ipcRenderer.invoke('category:delete', id),
});
