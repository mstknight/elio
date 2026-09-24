import "./style.css";

const STORAGE_KEY = "elio.tasks";

const form = document.querySelector("#task-form");
const input = document.querySelector("#task-input");
const list = document.querySelector("#task-list");
const stats = document.querySelector("#task-stats");
const emptyState = document.querySelector("#empty-state");
const filterButtons = document.querySelectorAll("[data-filter]");
const storageStatus = document.querySelector('#storage-status');

let tasks = loadTasks();
let currentFilter = "all";
let editingId = null;

function loadTasks() {
  try {
    const savedTasks = localStorage.getItem(STORAGE_KEY);
    const parsedTasks = savedTasks ? JSON.parse(savedTasks) : [];
    if (!Array.isArray(parsedTasks)) throw new Error('Invalid task data');
    const ids = new Set();
    const valid = parsedTasks.filter(task => {
      if (!task || typeof task.id !== 'string' || !task.id || ids.has(task.id) ||
          typeof task.title !== 'string' || !task.title.trim() || task.title.length > 100 ||
          typeof task.completed !== 'boolean') return false;
      ids.add(task.id);
      return true;
    });
    if (valid.length !== parsedTasks.length) {
      showStorageMessage('部分本地任务格式异常，已跳过无效记录。');
    }
    return valid;
  } catch {
    showStorageMessage('无法读取本地任务。请检查浏览器存储设置；原始数据未被主动删除。');
    return [];
  }
}

function showStorageMessage(message) {
  storageStatus.textContent = message;
  storageStatus.hidden = !message;
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    showStorageMessage('');
  } catch {
    showStorageMessage('保存失败：当前修改仅保留在此页面，刷新可能丢失。请检查浏览器存储权限或空间。');
  }
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createTask(title) {
  return {
    id: createId(),
    title,
    completed: false,
    createdAt: new Date().toISOString(),
  };
}

function addTask(title) {
  tasks.unshift(createTask(title));
  saveTasks();
  render();
}

function toggleTask(id) {
  tasks = tasks.map((task) =>
    task.id === id ? { ...task, completed: !task.completed } : task,
  );

  saveTasks();
  render();
}

function deleteTask(id) {
  tasks = tasks.filter((task) => task.id !== id);
  if (editingId === id) {
    editingId = null;
  }
  saveTasks();
  render();
}

function renameTask(id, title, redraw = true) {
  const trimmed = title.trim();

  if (!trimmed) {
    editingId = null;
    if (redraw) render();
    return;
  }

  tasks = tasks.map((task) =>
    task.id === id ? { ...task, title: trimmed } : task,
  );

  editingId = null;
  saveTasks();
  if (redraw) render();
}

function startEditing(id) {
  editingId = id;
  render();

  const editInput = list.querySelector(".task-edit-input");

  if (editInput) {
    editInput.focus();
    editInput.select();
  }
}

function stopEditing() {
  editingId = null;
  render();
}

function getVisibleTasks() {
  if (currentFilter === "active") {
    return tasks.filter((task) => !task.completed);
  }

  if (currentFilter === "completed") {
    return tasks.filter((task) => task.completed);
  }

  return tasks;
}

function createTaskElement(task) {
  const item = document.createElement("li");
  item.className = `task-item${task.completed ? " completed" : ""}`;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  checkbox.setAttribute(
    "aria-label",
    task.completed
      ? `将“${task.title}”标记为待完成`
      : `完成“${task.title}”`,
  );
  checkbox.addEventListener("change", () => toggleTask(task.id));

  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = task.title;
  title.title = "双击编辑任务";
  title.tabIndex = 0;
  title.setAttribute('role', 'button');
  title.setAttribute('aria-label', `编辑任务“${task.title}”`);
  title.addEventListener('dblclick', () => startEditing(task.id));
  title.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      startEditing(task.id);
    }
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-button";
  deleteButton.textContent = "删除";
  deleteButton.setAttribute("aria-label", `删除“${task.title}”`);
  deleteButton.addEventListener("click", () => deleteTask(task.id));

  if (task.id === editingId) {
    const editInput = document.createElement("input");
    editInput.type = "text";
    editInput.className = "task-edit-input";
    editInput.value = task.title;
    editInput.maxLength = 100;
    editInput.setAttribute("aria-label", `编辑任务“${task.title}”`);
    editInput.addEventListener("keydown", (event) => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === "Enter") {
        event.preventDefault();
        renameTask(task.id, editInput.value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        stopEditing();
      }
    });
    editInput.addEventListener("blur", () => {
      if (editingId === task.id) {
        // Keep the clicked controls attached until their click is delivered.
        renameTask(task.id, editInput.value, false);
        title.textContent = tasks.find(entry => entry.id === task.id)?.title ?? task.title;
        title.setAttribute('aria-label', `编辑任务“${title.textContent}”`);
        editInput.replaceWith(title);
      }
    });

    item.append(checkbox, editInput, deleteButton);
    return item;
  }


  item.append(checkbox, title, deleteButton);
  return item;
}

function render() {
  const visibleTasks = getVisibleTasks();
  const activeCount = tasks.filter((task) => !task.completed).length;

  list.replaceChildren(...visibleTasks.map(createTaskElement));
  stats.textContent = `${activeCount} 项待完成`;
  emptyState.hidden = visibleTasks.length > 0;
  emptyState.textContent = currentFilter === 'active' ? '没有待完成任务。' :
    currentFilter === 'completed' ? '还没有已完成任务。' : '还没有任务，先添加一项吧。';

  filterButtons.forEach((button) => {
    const isActive = button.dataset.filter === currentFilter;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = input.value.trim();

  if (!title) {
    input.focus();
    return;
  }

  addTask(title);
  form.reset();
  input.focus();
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    render();
  });
});

render();
