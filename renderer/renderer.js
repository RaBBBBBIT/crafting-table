'use strict';

/* ===== State ===== */
const state = {
  categories: [],
  tasks: [],
  totalTaskCount: 0,
  activeCategoryId: null, // null = all
  activeFilter: 'all',
};

/* ===== DOM references ===== */
const categoryList = document.getElementById('category-list');
const taskListEl = document.getElementById('task-list');
const currentCategoryTitle = document.getElementById('current-category-title');
const countAll = document.getElementById('count-all');

// Task modal
const modalTask = document.getElementById('modal-task');
const modalTaskTitle = document.getElementById('modal-task-title');
const formTask = document.getElementById('form-task');
const taskIdInput = document.getElementById('task-id');
const taskTitleInput = document.getElementById('task-title');
const taskDescInput = document.getElementById('task-desc');
const taskStatusInput = document.getElementById('task-status');
const taskPriorityInput = document.getElementById('task-priority');
const taskCategoryInput = document.getElementById('task-category');

// Category modal
const modalCategory = document.getElementById('modal-category');
const modalCategoryTitle = document.getElementById('modal-category-title');
const formCategory = document.getElementById('form-category');
const categoryIdInput = document.getElementById('category-id');
const categoryNameInput = document.getElementById('category-name');
const categoryColorInput = document.getElementById('category-color');

/* ===== Init ===== */
async function init() {
  await loadCategories();
  await loadTasks();
  bindEvents();
}

/* ===== Data loading ===== */
async function loadCategories() {
  state.categories = await window.electronAPI.getCategories();
  renderCategoryList();
}

async function loadTasks() {
  state.tasks = await window.electronAPI.getTasks(state.activeCategoryId);
  state.totalTaskCount = await window.electronAPI.getTaskCount();
  renderTaskList();
}

/* ===== Rendering ===== */
function renderCategoryList() {
  // Update total count
  countAll.textContent = state.totalTaskCount;

  // Remove all except the "all" item
  const items = categoryList.querySelectorAll('.category-item[data-id]');
  items.forEach((el) => {
    if (el.dataset.id !== 'all') el.remove();
  });

  for (const cat of state.categories) {
    const li = document.createElement('li');
    li.className = 'category-item' + (state.activeCategoryId === cat.id ? ' active' : '');
    li.dataset.id = cat.id;
    li.innerHTML = `
      <span class="category-dot" style="background:${escHtml(cat.color)};"></span>
      <span class="category-name">${escHtml(cat.name)}</span>
      <span class="category-count">${cat.task_count || 0}</span>
      <span class="category-actions">
        <button class="cat-action-btn" data-action="edit-cat" data-id="${cat.id}" title="编辑">✏</button>
        <button class="cat-action-btn danger" data-action="delete-cat" data-id="${cat.id}" title="删除">✕</button>
      </span>
    `;
    categoryList.appendChild(li);
  }

  // Update "all" active state
  const allItem = categoryList.querySelector('[data-id="all"]');
  allItem.classList.toggle('active', state.activeCategoryId === null);
}

function renderTaskList() {
  const filtered = state.tasks.filter((t) => {
    if (state.activeFilter === 'all') return true;
    return t.status === state.activeFilter;
  });

  if (filtered.length === 0) {
    taskListEl.innerHTML = '<p class="empty-hint">暂无任务，点击「新建任务」开始吧 🚀</p>';
    return;
  }

  taskListEl.innerHTML = filtered
    .map((task) => renderTaskCard(task))
    .join('');
}

function renderTaskCard(task) {
  const isDone = task.status === 'done';
  const priorityLabel = ['', '高优先级', '紧急'][task.priority] || '';
  const statusLabel = { pending: '', in_progress: '进行中', done: '已完成' }[task.status] || '';
  const catTag = task.category_name
    ? `<span class="tag" style="border-color:${escHtml(task.category_color)};color:${escHtml(task.category_color)};">${escHtml(task.category_name)}</span>`
    : '';

  return `
    <div class="task-card status-${escHtml(task.status)} priority-${task.priority}" data-id="${task.id}">
      <div class="task-check ${isDone ? 'checked' : ''}" data-action="toggle-status" data-id="${task.id}" data-status="${escHtml(task.status)}"></div>
      <div class="task-body">
        <div class="task-title">${escHtml(task.title)}</div>
        ${task.description ? `<div class="task-desc">${escHtml(task.description)}</div>` : ''}
        <div class="task-meta">
          ${catTag}
          ${statusLabel ? `<span class="tag tag-status-${escHtml(task.status)}">${statusLabel}</span>` : ''}
          ${priorityLabel ? `<span class="tag tag-priority-${task.priority}">${priorityLabel}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="task-action-btn" data-action="edit-task" data-id="${task.id}" title="编辑">✏</button>
        <button class="task-action-btn danger" data-action="delete-task" data-id="${task.id}" title="删除">✕</button>
      </div>
    </div>
  `;
}

/* ===== Event binding ===== */
function bindEvents() {
  // Add task button
  document.getElementById('btn-add-task').addEventListener('click', () => openTaskModal());

  // Add category button
  document.getElementById('btn-add-category').addEventListener('click', () => openCategoryModal());

  // Category list click (delegation)
  categoryList.addEventListener('click', (e) => {
    const item = e.target.closest('.category-item');
    const actionEl = e.target.closest('[data-action]');

    if (actionEl) {
      e.stopPropagation();
      const { action, id } = actionEl.dataset;
      if (action === 'edit-cat') openCategoryModal(Number(id));
      if (action === 'delete-cat') deleteCategory(Number(id));
      return;
    }

    if (item) {
      const id = item.dataset.id === 'all' ? null : Number(item.dataset.id);
      state.activeCategoryId = id;
      currentCategoryTitle.textContent =
        id === null ? '全部任务' : (state.categories.find((c) => c.id === id)?.name || '');
      loadTasks().then(renderCategoryList);
    }
  });

  // Task list click (delegation)
  taskListEl.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const { action, id, status } = actionEl.dataset;
    if (action === 'toggle-status') toggleTaskStatus(Number(id), status);
    if (action === 'edit-task') openTaskModal(Number(id));
    if (action === 'delete-task') deleteTask(Number(id));
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFilter = btn.dataset.status;
      renderTaskList();
    });
  });

  // Task form submit
  formTask.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = taskIdInput.value ? Number(taskIdInput.value) : null;
    const payload = {
      title: taskTitleInput.value.trim(),
      description: taskDescInput.value.trim(),
      status: taskStatusInput.value,
      priority: Number(taskPriorityInput.value),
      category_id: taskCategoryInput.value ? Number(taskCategoryInput.value) : null,
    };
    if (!payload.title) return;
    if (id) {
      await window.electronAPI.updateTask(id, payload);
    } else {
      await window.electronAPI.createTask(payload);
    }
    closeModal(modalTask);
    await loadCategories();
    await loadTasks();
  });

  // Category form submit
  formCategory.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = categoryIdInput.value ? Number(categoryIdInput.value) : null;
    const payload = {
      name: categoryNameInput.value.trim(),
      color: categoryColorInput.value,
    };
    if (!payload.name) return;
    if (id) {
      await window.electronAPI.updateCategory(id, payload);
    } else {
      await window.electronAPI.createCategory(payload);
    }
    closeModal(modalCategory);
    await loadCategories();
    await loadTasks();
  });

  // Cancel buttons
  document.getElementById('btn-cancel-task').addEventListener('click', () => closeModal(modalTask));
  document.getElementById('btn-cancel-category').addEventListener('click', () => closeModal(modalCategory));

  // Click overlay to close
  modalTask.querySelector('.modal-overlay').addEventListener('click', () => closeModal(modalTask));
  modalCategory.querySelector('.modal-overlay').addEventListener('click', () => closeModal(modalCategory));
}

/* ===== Modal helpers ===== */
function openTaskModal(taskId) {
  modalTaskTitle.textContent = taskId ? '编辑任务' : '新建任务';
  formTask.reset();
  taskIdInput.value = '';

  // Populate category select
  taskCategoryInput.innerHTML = '<option value="">无分类</option>' +
    state.categories.map((c) => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');

  if (taskId) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (task) {
      taskIdInput.value = task.id;
      taskTitleInput.value = task.title;
      taskDescInput.value = task.description || '';
      taskStatusInput.value = task.status;
      taskPriorityInput.value = task.priority;
      taskCategoryInput.value = task.category_id || '';
    }
  }

  openModal(modalTask);
}

function openCategoryModal(catId) {
  modalCategoryTitle.textContent = catId ? '编辑分类' : '新建分类';
  formCategory.reset();
  categoryIdInput.value = '';
  categoryColorInput.value = '#4CAF50';

  if (catId) {
    const cat = state.categories.find((c) => c.id === catId);
    if (cat) {
      categoryIdInput.value = cat.id;
      categoryNameInput.value = cat.name;
      categoryColorInput.value = cat.color;
    }
  }

  openModal(modalCategory);
}

function openModal(modal) { modal.classList.remove('hidden'); }
function closeModal(modal) { modal.classList.add('hidden'); }

/* ===== Task actions ===== */
async function toggleTaskStatus(id, currentStatus) {
  const nextStatus = currentStatus === 'done' ? 'pending' : 'done';
  await window.electronAPI.updateTask(id, { status: nextStatus });
  await loadCategories();
  await loadTasks();
}

async function deleteTask(id) {
  if (!confirm('确定要删除此任务吗？')) return;
  await window.electronAPI.deleteTask(id);
  await loadCategories();
  await loadTasks();
}

async function deleteCategory(id) {
  if (!confirm('确定要删除此分类吗？（分类内任务不会被删除）')) return;
  await window.electronAPI.deleteCategory(id);
  if (state.activeCategoryId === id) {
    state.activeCategoryId = null;
    currentCategoryTitle.textContent = '全部任务';
  }
  await loadCategories();
  await loadTasks();
}

/* ===== Utils ===== */
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ===== Start ===== */
init();
