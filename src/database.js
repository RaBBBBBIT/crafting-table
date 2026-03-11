'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const DB_PATH = path.join(app.getPath('userData'), 'crafting-table.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#4CAF50',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done')),
      priority INTEGER NOT NULL DEFAULT 0,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TRIGGER IF NOT EXISTS tasks_updated_at
    AFTER UPDATE ON tasks
    BEGIN
      UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);
}

// --- Task operations ---

function getAllTasks(categoryId) {
  const database = getDb();
  if (categoryId != null) {
    return database
      .prepare(
        `SELECT t.*, c.name AS category_name, c.color AS category_color
         FROM tasks t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.category_id = ?
         ORDER BY t.priority DESC, t.created_at DESC`
      )
      .all(categoryId);
  }
  return database
    .prepare(
      `SELECT t.*, c.name AS category_name, c.color AS category_color
       FROM tasks t
       LEFT JOIN categories c ON t.category_id = c.id
       ORDER BY t.priority DESC, t.created_at DESC`
    )
    .all();
}

function createTask({ title, description = '', status = 'pending', priority = 0, category_id = null }) {
  const database = getDb();
  const stmt = database.prepare(
    `INSERT INTO tasks (title, description, status, priority, category_id)
     VALUES (?, ?, ?, ?, ?)`
  );
  const result = stmt.run(title, description, status, priority, category_id);
  return database.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
}

const TASK_ALLOWED_FIELDS = ['title', 'description', 'status', 'priority', 'category_id'];

function updateTask(id, updates) {
  const database = getDb();
  const fields = [];
  const values = [];

  for (const field of TASK_ALLOWED_FIELDS) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(updates[field]);
    }
  }

  if (fields.length === 0) return database.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

  values.push(id);
  database.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return database.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

function deleteTask(id) {
  const database = getDb();
  database.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return { success: true };
}

// --- Category operations ---

function getAllCategories() {
  const database = getDb();
  return database
    .prepare(
      `SELECT c.*, COUNT(t.id) AS task_count
       FROM categories c
       LEFT JOIN tasks t ON t.category_id = c.id
       GROUP BY c.id
       ORDER BY c.name`
    )
    .all();
}

function createCategory({ name, color = '#4CAF50' }) {
  const database = getDb();
  const stmt = database.prepare('INSERT INTO categories (name, color) VALUES (?, ?)');
  const result = stmt.run(name, color);
  return database.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
}

const CATEGORY_ALLOWED_FIELDS = ['name', 'color'];

function updateCategory(id, updates) {
  const database = getDb();
  const fields = [];
  const values = [];

  for (const field of CATEGORY_ALLOWED_FIELDS) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(updates[field]);
    }
  }

  if (fields.length === 0) return database.prepare('SELECT * FROM categories WHERE id = ?').get(id);

  values.push(id);
  database.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return database.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

function deleteCategory(id) {
  const database = getDb();
  database.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return { success: true };
}

function getTotalTaskCount() {
  return getDb().prepare('SELECT COUNT(*) AS count FROM tasks').get().count;
}

module.exports = {
  getAllTasks,
  createTask,
  updateTask,
  deleteTask,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getTotalTaskCount,
};
