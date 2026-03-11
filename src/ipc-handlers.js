'use strict';

const db = require('./database');

function registerIpcHandlers(ipcMain) {
  // --- Tasks ---
  ipcMain.handle('task:getAll', (_event, categoryId) => {
    return db.getAllTasks(categoryId != null ? Number(categoryId) : null);
  });

  ipcMain.handle('task:count', () => {
    return db.getTotalTaskCount();
  });

  ipcMain.handle('task:create', (_event, task) => {
    return db.createTask(task);
  });

  ipcMain.handle('task:update', (_event, id, updates) => {
    return db.updateTask(Number(id), updates);
  });

  ipcMain.handle('task:delete', (_event, id) => {
    return db.deleteTask(Number(id));
  });

  // --- Categories ---
  ipcMain.handle('category:getAll', () => {
    return db.getAllCategories();
  });

  ipcMain.handle('category:create', (_event, category) => {
    return db.createCategory(category);
  });

  ipcMain.handle('category:update', (_event, id, updates) => {
    return db.updateCategory(Number(id), updates);
  });

  ipcMain.handle('category:delete', (_event, id) => {
    return db.deleteCategory(Number(id));
  });
}

module.exports = { registerIpcHandlers };
