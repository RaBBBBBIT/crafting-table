'use strict';

const db = require('./database');

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

const DEFAULT_WORKBENCH_STATE = {
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

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizeItemId(value, prefix) {
  return typeof value === 'string' && value.trim() ? value.trim() : createId(prefix);
}

function normalizeWorkbenchState(input) {
  const base = deepClone(DEFAULT_WORKBENCH_STATE);
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
          id: normalizeItemId(item && item.id, 'inbox'),
          text: normalizeText(item && item.text),
        }))
      : base.inbox,
    projects: Array.isArray(source.projects)
      ? source.projects.map((project, index) => ({
          id: normalizeItemId(project && project.id, 'project'),
          title: normalizeText(project && project.title, `项目${index + 1}`),
          content: normalizeText(project && project.content),
        }))
      : base.projects,
  };
}

function buildApiUrl(baseUrl, pathname) {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(pathname.replace(/^\//, ''), normalizedBaseUrl).toString();
}

async function requestApi({ baseUrl, pathname, method = 'GET', body }) {
  const response = await fetch(buildApiUrl(baseUrl, pathname), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'string'
      ? payload
      : payload && typeof payload.message === 'string'
        ? payload.message
        : `请求失败（${response.status}）`;
    throw new Error(message);
  }

  return payload;
}

async function getWorkbenchStateFromApi() {
  const settings = db.getClientSettings();
  const data = await requestApi({
    baseUrl: settings.apiBaseUrl,
    pathname: '/api/workbench-state',
  });
  return normalizeWorkbenchState(data);
}

async function saveWorkbenchStateToApi(state) {
  const settings = db.getClientSettings();
  const normalized = normalizeWorkbenchState(state);
  const data = await requestApi({
    baseUrl: settings.apiBaseUrl,
    pathname: '/api/workbench-state',
    method: 'PUT',
    body: normalized,
  });
  return normalizeWorkbenchState(data);
}

async function testApiConnection(apiBaseUrl) {
  const normalizedApiBaseUrl = db.normalizeApiBaseUrl(apiBaseUrl);

  try {
    const data = await requestApi({
      baseUrl: normalizedApiBaseUrl,
      pathname: '/api/health',
    });

    return {
      ok: true,
      apiBaseUrl: normalizedApiBaseUrl,
      message: data && typeof data.message === 'string' ? data.message : '连接成功',
    };
  } catch (error) {
    return {
      ok: false,
      apiBaseUrl: normalizedApiBaseUrl,
      message: error.message || '连接失败',
    };
  }
}

function registerIpcHandlers(ipcMain) {
  ipcMain.handle('settings:getClient', () => {
    return db.getClientSettings();
  });

  ipcMain.handle('settings:saveClient', (_event, settings) => {
    return db.saveClientSettings(settings);
  });

  ipcMain.handle('api:testConnection', (_event, apiBaseUrl) => {
    return testApiConnection(apiBaseUrl);
  });

  ipcMain.handle('workbench:getState', async () => {
    return getWorkbenchStateFromApi();
  });

  ipcMain.handle('workbench:saveState', async (_event, state) => {
    return saveWorkbenchStateToApi(state);
  });
}

module.exports = {
  registerIpcHandlers,
};
