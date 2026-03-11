'use strict';

const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

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

const THEME_LABELS = {
  system: '跟随系统',
  dark: '深色',
  light: '浅色',
};

let state = deepClone(DEFAULT_STATE);
let clientSettings = {
  apiBaseUrl: '',
};
let dragProjectId = null;
let mediaQueryList = null;
let persistTimer = null;
let persistToken = 0;

const els = {
  projectList: document.getElementById('projectList'),
  inboxList: document.getElementById('inboxList'),
  summaryRow: document.getElementById('summaryRow'),
  addProjectBtn: document.getElementById('addProjectBtn'),
  addInboxBtn: document.getElementById('addInboxBtn'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  confirmSettingsBtn: document.getElementById('confirmSettingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  themeSelect: document.getElementById('themeSelect'),
  themeSelectButton: document.getElementById('themeSelectButton'),
  themeSelectMenu: document.getElementById('themeSelectMenu'),
  themeSelectLabel: document.getElementById('themeSelectLabel'),
  resetBtn: document.getElementById('resetBtn'),
  saveStatus: document.getElementById('saveStatus'),
  mainFocus: document.getElementById('mainFocus'),
  secondaryFocus: document.getElementById('secondaryFocus'),
  todayNotes: document.getElementById('todayNotes'),
  apiStatusBadge: document.getElementById('apiStatusBadge'),
  apiSummary: document.getElementById('apiSummary'),
  apiBaseUrlInput: document.getElementById('apiBaseUrlInput'),
  apiTestResult: document.getElementById('apiTestResult'),
  testApiBtn: document.getElementById('testApiBtn'),
  saveApiBtn: document.getElementById('saveApiBtn'),
};

void init();

async function init() {
  render();
  bindTopLevelEvents();
  bindSystemThemeWatcher();

  if (!window.electronAPI) {
    setConnectionState('error');
    setStatus('缺少 Electron 接口，无法连接后台服务');
    return;
  }

  try {
    clientSettings = await window.electronAPI.getClientSettings();
    syncApiUi();
    await loadRemoteState('正在从远端加载工作台数据...');
  } catch (error) {
    console.error('init failed', error);
    handleRemoteError(error, '初始化失败，请检查接口配置');
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeId(value, prefix) {
  return typeof value === 'string' && value.trim() ? value.trim() : createId(prefix);
}

function normalizeText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
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
      mainFocus: normalizeText(today.mainFocus, base.today.mainFocus),
      secondaryFocus: normalizeText(today.secondaryFocus, base.today.secondaryFocus),
      todayNotes: normalizeText(today.todayNotes, base.today.todayNotes),
    },
    inbox: Array.isArray(source.inbox)
      ? source.inbox.map((item) => ({
          id: normalizeId(item && item.id, 'inbox'),
          text: normalizeText(item && item.text, ''),
        }))
      : base.inbox,
    projects: Array.isArray(source.projects)
      ? source.projects.map((project, index) => ({
          id: normalizeId(project && project.id, 'project'),
          title: normalizeText(project && project.title, `项目${index + 1}`),
          content: normalizeText(project && project.content, ''),
        }))
      : base.projects,
  };
}

async function loadRemoteState(statusText) {
  setStatus(statusText);
  setConnectionState('disconnected');

  const nextState = await window.electronAPI.getWorkbenchState();
  state = normalizeState(nextState);
  render();
  setConnectionState('connected');
  setSavedStatus('已从远端同步');
}

function handleRemoteError(error, fallbackMessage) {
  console.error(error);
  render();
  setConnectionState('error');
  setStatus(fallbackMessage || error.message || '远端接口请求失败');
  setApiTestMessage(error.message || fallbackMessage || '连接失败', 'error');
}

function bindTopLevelEvents() {
  els.addProjectBtn.addEventListener('click', () => {
    updateState((draft) => {
      draft.projects.push({ id: createId('project'), title: '新项目', content: '' });
    });
  });

  els.addInboxBtn.addEventListener('click', () => {
    updateState((draft) => {
      draft.inbox.unshift({ id: createId('inbox'), text: '' });
    });
  });

  els.mainFocus.addEventListener('input', (event) => {
    updateState((draft) => {
      draft.today.mainFocus = event.target.value;
    }, { render: false });
  });

  els.secondaryFocus.addEventListener('input', (event) => {
    updateState((draft) => {
      draft.today.secondaryFocus = event.target.value;
    }, { render: false });
  });

  els.todayNotes.addEventListener('input', (event) => {
    updateState((draft) => {
      draft.today.todayNotes = event.target.value;
    }, { render: false });
  });

  els.openSettingsBtn.addEventListener('click', openSettingsModal);
  els.closeSettingsBtn.addEventListener('click', closeSettingsModal);
  els.confirmSettingsBtn.addEventListener('click', closeSettingsModal);
  els.testApiBtn.addEventListener('click', () => {
    void testApiConnection();
  });
  els.saveApiBtn.addEventListener('click', () => {
    void saveApiConfiguration();
  });

  els.settingsModal.addEventListener('click', (event) => {
    if (event.target === els.settingsModal) {
      closeSettingsModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    if (els.themeSelect.classList.contains('open')) {
      closeThemeSelect();
      return;
    }

    if (els.settingsModal.classList.contains('open')) {
      closeSettingsModal();
    }
  });

  els.themeSelectButton.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleThemeSelect();
  });

  els.themeSelectMenu.querySelectorAll('[data-value]').forEach((option) => {
    option.addEventListener('click', () => {
      const value = option.getAttribute('data-value');
      updateState((draft) => {
        draft.theme.mode = ['system', 'light', 'dark'].includes(value) ? value : 'system';
      });
      closeThemeSelect();
    });
  });

  document.addEventListener('click', (event) => {
    if (!els.themeSelect.contains(event.target)) {
      closeThemeSelect();
    }
  });

  els.resetBtn.addEventListener('click', async () => {
    const ok = window.confirm('确定要把远端工作台数据恢复为默认示例吗？');
    if (!ok) return;

    state = deepClone(DEFAULT_STATE);
    render();
    await persistState(true);
  });
}

function bindSystemThemeWatcher() {
  if (!window.matchMedia) return;

  mediaQueryList = window.matchMedia(THEME_MEDIA_QUERY);
  const handler = () => {
    if (state.theme.mode === 'system') {
      applyTheme();
    }
  };

  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', handler);
  } else if (typeof mediaQueryList.addListener === 'function') {
    mediaQueryList.addListener(handler);
  }
}

function updateState(mutator, options) {
  const settings = {
    render: true,
    persist: true,
    immediate: false,
    ...(options || {}),
  };

  mutator(state);

  if (settings.render) {
    render();
  }

  if (settings.persist) {
    if (settings.immediate) {
      void persistState(true);
    } else {
      schedulePersist();
    }
  }
}

function schedulePersist() {
  if (persistTimer) {
    window.clearTimeout(persistTimer);
  }

  setStatus(`正在同步到 ${clientSettings.apiBaseUrl || '远端接口'}...`);
  persistTimer = window.setTimeout(() => {
    void persistState();
  }, 180);
}

async function persistState(immediate) {
  if (persistTimer) {
    window.clearTimeout(persistTimer);
    persistTimer = null;
  }

  const currentToken = ++persistToken;
  const snapshot = normalizeState(state);

  if (immediate) {
    setStatus(`正在同步到 ${clientSettings.apiBaseUrl || '远端接口'}...`);
  }

  try {
    await window.electronAPI.saveWorkbenchState(snapshot);
    if (currentToken !== persistToken) return;
    setConnectionState('connected');
    setSavedStatus('已同步远端');
  } catch (error) {
    if (currentToken !== persistToken) return;
    console.error('save state failed', error);
    setConnectionState('error');
    setStatus(error.message || '同步失败，请检查后台接口');
  }
}

function setStatus(text) {
  els.saveStatus.textContent = text;
}

function setSavedStatus(prefix) {
  const head = prefix || '已保存';
  els.saveStatus.textContent = `${head} ${new Date().toLocaleString()}`;
}

function syncApiUi() {
  els.apiBaseUrlInput.value = clientSettings.apiBaseUrl || '';
  els.apiSummary.textContent = clientSettings.apiBaseUrl
    ? `当前接口：${clientSettings.apiBaseUrl}`
    : '请先配置后台接口地址。';
}

function setConnectionState(status) {
  els.apiStatusBadge.classList.remove('connected', 'disconnected', 'error');
  els.apiStatusBadge.classList.add(status);

  if (status === 'connected') {
    els.apiStatusBadge.textContent = '接口已连接';
    return;
  }

  if (status === 'error') {
    els.apiStatusBadge.textContent = '接口异常';
    return;
  }

  els.apiStatusBadge.textContent = '接口未连接';
}

function setApiTestMessage(message, type) {
  els.apiTestResult.textContent = message;
  els.apiTestResult.classList.remove('success', 'error');
  if (type) {
    els.apiTestResult.classList.add(type);
  }
}

async function testApiConnection() {
  const apiBaseUrl = els.apiBaseUrlInput.value.trim();
  setApiTestMessage('正在测试接口连接...', '');

  try {
    const result = await window.electronAPI.testApiConnection(apiBaseUrl);
    setApiTestMessage(result.message || '测试完成', result.ok ? 'success' : 'error');
  } catch (error) {
    console.error('test api failed', error);
    setApiTestMessage(error.message || '接口测试失败', 'error');
  }
}

async function saveApiConfiguration() {
  const apiBaseUrl = els.apiBaseUrlInput.value.trim();
  setApiTestMessage('正在保存接口配置...', '');

  try {
    clientSettings = await window.electronAPI.saveClientSettings({ apiBaseUrl });
    syncApiUi();

    const result = await window.electronAPI.testApiConnection(clientSettings.apiBaseUrl);
    if (!result.ok) {
      setConnectionState('error');
      setStatus(`接口已保存，但连接失败：${result.message}`);
      setApiTestMessage(`接口已保存，但连接失败：${result.message}`, 'error');
      return;
    }

    setApiTestMessage(`接口已保存：${clientSettings.apiBaseUrl}`, 'success');
    await loadRemoteState('正在从新接口拉取工作台数据...');
  } catch (error) {
    console.error('save api config failed', error);
    setConnectionState('error');
    setStatus(error.message || '接口配置保存失败');
    setApiTestMessage(error.message || '接口配置保存失败', 'error');
  }
}

function render() {
  applyTheme();
  syncApiUi();
  els.mainFocus.value = state.today.mainFocus;
  els.secondaryFocus.value = state.today.secondaryFocus;
  els.todayNotes.value = state.today.todayNotes;
  syncThemeControls();
  renderSummary();
  renderInbox();
  renderProjects();
}

function syncThemeControls() {
  els.themeSelectLabel.textContent = THEME_LABELS[state.theme.mode] || THEME_LABELS.system;
  els.themeSelectMenu.querySelectorAll('.custom-option').forEach((option) => {
    option.classList.toggle('active', option.getAttribute('data-value') === state.theme.mode);
  });
}

function getResolvedThemeMode() {
  if (state.theme.mode === 'system') {
    return window.matchMedia && window.matchMedia(THEME_MEDIA_QUERY).matches ? 'dark' : 'light';
  }

  return state.theme.mode;
}

function applyTheme() {
  document.body.classList.toggle('theme-light', getResolvedThemeMode() === 'light');
}

function openSettingsModal() {
  syncThemeControls();
  syncApiUi();
  setApiTestMessage('保存后会从新地址重新拉取工作台数据。', '');
  els.settingsModal.classList.add('open');
  els.settingsModal.setAttribute('aria-hidden', 'false');
}

function closeSettingsModal() {
  closeThemeSelect();
  els.settingsModal.classList.remove('open');
  els.settingsModal.setAttribute('aria-hidden', 'true');
}

function toggleThemeSelect() {
  const isOpen = els.themeSelect.classList.contains('open');
  els.themeSelect.classList.toggle('open', !isOpen);
  els.themeSelectButton.setAttribute('aria-expanded', String(!isOpen));
}

function closeThemeSelect() {
  els.themeSelect.classList.remove('open');
  els.themeSelectButton.setAttribute('aria-expanded', 'false');
}

function renderSummary() {
  const totalProjects = state.projects.length;
  const notes = state.projects.reduce((sum, project) => sum + (project.content.trim() ? 1 : 0), 0);
  const inboxCount = state.inbox.filter((item) => item.text.trim()).length;
  const filledToday = [
    state.today.mainFocus,
    state.today.secondaryFocus,
    state.today.todayNotes,
  ].filter(Boolean).length;

  els.summaryRow.innerHTML = [
    statHtml('项目数', totalProjects),
    statHtml('已写记事', notes),
    statHtml('临时收集', inboxCount),
    statHtml('今日填写', filledToday),
  ].join('');
}

function statHtml(label, value) {
  return `
    <div class="mini-stat">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(String(value))}</div>
    </div>
  `;
}

function renderProjects() {
  if (!state.projects.length) {
    els.projectList.innerHTML = '<div class="empty">当前没有项目，点击“新增项目”开始。</div>';
    return;
  }

  els.projectList.innerHTML = state.projects.map((project, index) => projectCardHtml(project, index)).join('');
  bindProjectEvents();
  bindDragEvents();
}

function projectCardHtml(project, index) {
  return `
    <article class="project-card project-color-${index % 4}" draggable="true" data-project-id="${escapeAttr(project.id)}">
      <div class="project-top">
        <div class="drag-handle" title="拖拽排序">
          <span class="drag-dots">⋮⋮</span>
          <span>拖拽</span>
        </div>
      </div>

      <div class="project-main">
        <div class="project-block">
          <label>标题</label>
          <input class="project-title-input" type="text" data-field="title" value="${escapeAttr(project.title)}" placeholder="输入项目标题" />
        </div>

        <div class="project-block" style="flex:1 1 auto; display:flex; flex-direction:column; min-height:0;">
          <label>记事板</label>
          <textarea class="project-textarea" data-field="content" placeholder="在这里自由编辑内容，支持随手记录任何信息">${escapeHtml(project.content)}</textarea>
        </div>

        <div class="card-actions">
          <button class="small-btn" type="button" data-action="duplicate">复制</button>
          <button class="small-btn danger" type="button" data-action="delete">删除</button>
        </div>
      </div>
    </article>
  `;
}

function bindProjectEvents() {
  document.querySelectorAll('[data-project-id]').forEach((card) => {
    const projectId = card.getAttribute('data-project-id');

    card.querySelectorAll('[data-field]').forEach((input) => {
      input.addEventListener('input', (event) => {
        const field = event.target.getAttribute('data-field');
        updateState((draft) => {
          const project = draft.projects.find((item) => item.id === projectId);
          if (!project) return;
          project[field] = event.target.value;
        }, { render: false });
      });
    });

    card.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', (event) => {
        const action = event.currentTarget.getAttribute('data-action');

        if (action === 'delete') {
          const ok = window.confirm('删除这个项目？');
          if (!ok) return;
          updateState((draft) => {
            draft.projects = draft.projects.filter((item) => item.id !== projectId);
          });
          return;
        }

        if (action === 'duplicate') {
          updateState((draft) => {
            const target = draft.projects.find((item) => item.id === projectId);
            if (!target) return;
            draft.projects.push({
              id: createId('project'),
              title: `${target.title}（副本）`,
              content: target.content,
            });
          });
        }
      });
    });
  });
}

function bindDragEvents() {
  const cards = Array.from(document.querySelectorAll('.project-card'));

  cards.forEach((card) => {
    const projectId = card.getAttribute('data-project-id');

    card.addEventListener('dragstart', () => {
      dragProjectId = projectId;
      card.dataset.dragging = 'true';
    });

    card.addEventListener('dragend', () => {
      dragProjectId = null;
      card.dataset.dragging = 'false';
      cards.forEach((item) => item.classList.remove('drag-over'));
    });

    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (!dragProjectId || dragProjectId === projectId) return;
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (event) => {
      event.preventDefault();
      card.classList.remove('drag-over');
      if (!dragProjectId || dragProjectId === projectId) return;
      reorderProjects(dragProjectId, projectId);
    });
  });
}

function reorderProjects(fromId, toId) {
  updateState((draft) => {
    const fromIndex = draft.projects.findIndex((project) => project.id === fromId);
    const toIndex = draft.projects.findIndex((project) => project.id === toId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const moved = draft.projects.splice(fromIndex, 1)[0];
    draft.projects.splice(toIndex, 0, moved);
  });
}

function renderInbox() {
  if (!state.inbox.length) {
    els.inboxList.innerHTML = '<div class="empty">当前没有临时收集项。</div>';
    return;
  }

  els.inboxList.innerHTML = state.inbox.map((item) => `
    <div class="item-row" data-inbox-id="${escapeAttr(item.id)}">
      <textarea placeholder="想到但暂不处理">${escapeHtml(item.text)}</textarea>
      <button class="small-btn danger" type="button" data-action="delete-inbox">删除</button>
    </div>
  `).join('');

  document.querySelectorAll('[data-inbox-id]').forEach((row) => {
    const id = row.getAttribute('data-inbox-id');
    const textarea = row.querySelector('textarea');
    const button = row.querySelector('button');

    textarea.addEventListener('input', (event) => {
      updateState((draft) => {
        const item = draft.inbox.find((candidate) => candidate.id === id);
        if (!item) return;
        item.text = event.target.value;
      }, { render: false });
    });

    button.addEventListener('click', () => {
      updateState((draft) => {
        draft.inbox = draft.inbox.filter((candidate) => candidate.id !== id);
      });
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}
