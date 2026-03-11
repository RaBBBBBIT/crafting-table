'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const { app } = require('electron');

const DB_PATH = path.join(app.getPath('userData'), 'crafting-table.db');
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL;');
    initSchema();
  }

  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      api_base_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TRIGGER IF NOT EXISTS client_settings_updated_at
    AFTER UPDATE ON client_settings
    BEGIN
      UPDATE client_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);

  const row = db.prepare('SELECT id FROM client_settings WHERE id = 1').get();
  if (!row) {
    db.prepare('INSERT INTO client_settings (id, api_base_url) VALUES (1, ?)').run(DEFAULT_API_BASE_URL);
  }
}

function normalizeApiBaseUrl(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  const raw = text || DEFAULT_API_BASE_URL;

  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('unsupported protocol');
    }

    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch (_error) {
    throw new Error('接口地址格式不正确，请输入完整的 http(s) 地址');
  }
}

function getClientSettings() {
  const database = getDb();
  const row = database.prepare('SELECT api_base_url FROM client_settings WHERE id = 1').get();

  if (!row) {
    return { apiBaseUrl: DEFAULT_API_BASE_URL };
  }

  return {
    apiBaseUrl: normalizeApiBaseUrl(row.api_base_url),
  };
}

function saveClientSettings(settings) {
  const database = getDb();
  const apiBaseUrl = normalizeApiBaseUrl(settings && settings.apiBaseUrl);

  database
    .prepare(
      `INSERT INTO client_settings (id, api_base_url)
       VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET api_base_url = excluded.api_base_url`
    )
    .run(apiBaseUrl);

  return { apiBaseUrl };
}

module.exports = {
  DEFAULT_API_BASE_URL,
  normalizeApiBaseUrl,
  getClientSettings,
  saveClientSettings,
};
