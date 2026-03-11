'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = path.join(__dirname, '..', 'backend-data');
const DATA_FILE = path.join(DATA_DIR, 'workbench-state.json');

const DEFAULT_STATE = {
  theme: {
    mode: 'system',
  },
  today: {
    mainFocus: '',
    secondaryFocus: '',
    todayNotes: '',
  },
  inbox: [
    { id: 'seed-inbox-1', text: '补一下接口埋点' },
    { id: 'seed-inbox-2', text: '看一眼评审评论' },
  ],
  projects: [
    {
      id: 'seed-project-1',
      title: '项目一',
      content: '这里写当前项目的自由记事内容。\n可以记录思路、待办、命令、链接、检查结果。',
    },
    {
      id: 'seed-project-2',
      title: '项目二',
      content: '这里写另一个项目的自由记事内容。\n不限制格式，按你自己的习惯写就行。',
    },
    {
      id: 'seed-project-3',
      title: '项目三',
      content: '这里写第三个项目的自由记事内容。\n拖拽卡片可以调整顺序。',
    },
  ],
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizeId(value, prefix) {
  return typeof value === 'string' && value.trim() ? value.trim() : createId(prefix);
}

function normalizeState(input) {
  const base = deepClone(DEFAULT_STATE);
  const source = input && typeof input === 'object' ? input : {};
  const theme = source.theme && typeof source.theme === 'object' ? source.theme : {};
  const today = source.today && typeof source.today === 'object' ? source.today : {};

  return {
    theme: {
      mode: ['system', 'light', 'dark'].includes(theme.mode) ? theme.mode : base.theme.mode,
    },
    today: {
      mainFocus: normalizeText(today.mainFocus),
      secondaryFocus: normalizeText(today.secondaryFocus),
      todayNotes: normalizeText(today.todayNotes),
    },
    inbox: Array.isArray(source.inbox)
      ? source.inbox.map((item) => ({
          id: normalizeId(item && item.id, 'inbox'),
          text: normalizeText(item && item.text),
        }))
      : base.inbox,
    projects: Array.isArray(source.projects)
      ? source.projects.map((project, index) => ({
          id: normalizeId(project && project.id, 'project'),
          title: normalizeText(project && project.title, `项目${index + 1}`),
          content: normalizeText(project && project.content),
        }))
      : base.projects,
  };
}

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
  }
}

function readState() {
  ensureDataFile();

  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return normalizeState(JSON.parse(raw));
  } catch (_error) {
    const fallback = deepClone(DEFAULT_STATE);
    fs.writeFileSync(DATA_FILE, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

function writeState(state) {
  const normalized = normalizeState(state);
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(normalized, null, 2));
  return normalized;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(message);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendText(res, 400, 'Invalid request');
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      message: 'backend ready',
      apiBaseUrl: `http://${HOST}:${PORT}`,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/workbench-state') {
    sendJson(res, 200, readState());
    return;
  }

  if (req.method === 'PUT' && url.pathname === '/api/workbench-state') {
    try {
      const body = await readRequestBody(req);
      sendJson(res, 200, writeState(body));
    } catch (_error) {
      sendJson(res, 400, { message: '请求体不是合法 JSON' });
    }
    return;
  }

  sendJson(res, 404, { message: '接口不存在' });
});

server.listen(PORT, HOST, () => {
  ensureDataFile();
  console.log(`Crafting Table backend listening on http://${HOST}:${PORT}`);
  console.log(`State file: ${DATA_FILE}`);
});
