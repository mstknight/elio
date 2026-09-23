import "./style.css";

const STORAGE_KEY = "elio.tasks";

const form = document.querySelector("#task-form");
const input = document.querySelector("#task-input");
const list = document.querySelector("#task-list");
const stats = document.querySelector("#task-stats");
const emptyState = document.querySelector("#empty-state");
const filterButtons = document.querySelectorAll("[data-filter]");

let tasks = loadTasks();
let currentFilter = "all";
let editingId = null;

function loadTasks() {
  try {
    const savedTasks = localStorage.getItem(STORAGE_KEY);
    const parsedTasks = savedTasks ? JSON.parse(savedTasks) : [];
    return Array.isArray(parsedTasks) ? parsedTasks : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Storage can be unavailable in private browsing or when its quota is full.
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

function renameTask(id, title) {
  const trimmed = title.trim();

  if (!trimmed) {
    editingId = null;
    render();
    return;
  }

  tasks = tasks.map((task) =>
    task.id === id ? { ...task, title: trimmed } : task,
  );

  editingId = null;
  saveTasks();
  render();
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
        renameTask(task.id, editInput.value);
      }
    });

    title.replaceWith(editInput);
    item.append(checkbox, editInput, deleteButton);
    return item;
  }

  title.addEventListener("dblclick", () => startEditing(task.id));

  item.append(checkbox, title, deleteButton);
  return item;
}

function render() {
  const visibleTasks = getVisibleTasks();
  const activeCount = tasks.filter((task) => !task.completed).length;

  list.replaceChildren(...visibleTasks.map(createTaskElement));
  stats.textContent = `${activeCount} 项待完成`;
  emptyState.hidden = visibleTasks.length > 0;

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
