(function () {
  let duringShiftTemplate = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadDuringShiftTemplate() {
    if (duringShiftTemplate) return duringShiftTemplate;

    const response = await fetch("../data/checklist/during-shift.json");

    if (!response.ok) {
      throw new Error("Не удалось загрузить during-shift.json");
    }

    duringShiftTemplate = await response.json();
    return duringShiftTemplate;
  }

  function toBool(value) {
    return value === true || value === "Да" || value === "true";
  }

  function renderCheckCell(field, checked) {
    return `
      <td
        class="during-check-cell ${checked ? "checked" : ""}"
        data-field="${field}"
        data-checked="${checked ? "true" : "false"}"
        title="Нажмите, чтобы отметить"
      ></td>
    `;
  }

  function flattenRows(template) {
    const rows = [];

    template.sections.forEach((section) => {
      rows.push({
        type: "category",
        title: section.title,
        warning: Boolean(section.warning)
      });

      section.items.forEach((item) => {
        rows.push({
          type: "task",
          text: item.text,
          important: Boolean(item.important)
        });
      });
    });

    return rows;
  }

  function renderDuringShiftTable(template, savedData = {}) {
    const body = document.getElementById("duringShiftBody");
    if (!body) return;

    const rows = flattenRows(template);

    body.innerHTML = rows
      .map((row, index) => {
        if (row.type === "category") {
          return `
            <tr>
              <td
                class="during-category ${row.warning ? "warning" : ""}"
                colspan="3"
              >
                ${escapeHtml(row.title)}
              </td>
            </tr>
          `;
        }

        const taskKey = `task_${index}`;
        const taskResult = savedData.tasks?.[taskKey] || {};

        return `
          <tr data-during-task-key="${taskKey}">
            ${renderCheckCell("morning", toBool(taskResult.morning))}
            ${renderCheckCell("evening", toBool(taskResult.evening))}

            <td class="during-task-text ${row.important ? "important" : ""}">
              ${escapeHtml(row.text)}
            </td>
          </tr>
        `;
      })
      .join("");

    const todoInput = document.getElementById("duringShiftTodoInput");
    if (todoInput) {
      todoInput.value = savedData.todo || "";
    }
  }

  function toggleCheckCell(cell) {
    const isChecked = cell.dataset.checked === "true";
    const nextValue = !isChecked;

    cell.dataset.checked = nextValue ? "true" : "false";
    cell.classList.toggle("checked", nextValue);

    updateProgress();
  }

  function setAllChecks(value) {
    document.querySelectorAll("#duringShiftTable .during-check-cell").forEach((cell) => {
      cell.dataset.checked = value ? "true" : "false";
      cell.classList.toggle("checked", value);
    });

    updateProgress();
  }

  function updateProgress() {
    const progressText = document.getElementById("checklistProgressText");
    if (!progressText) return;

    const rows = Array.from(document.querySelectorAll("[data-during-task-key]"));

    const doneRows = rows.filter((row) => {
      const morning = row.querySelector(".during-check-cell[data-field='morning']")?.dataset.checked === "true";
      const evening = row.querySelector(".during-check-cell[data-field='evening']")?.dataset.checked === "true";

      return morning || evening;
    });

    progressText.textContent = `${doneRows.length} / ${rows.length}`;
  }

  function bindEvents() {
    document.querySelectorAll("#duringShiftTable .during-check-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        toggleCheckCell(cell);
      });
    });

    document.getElementById("duringShiftSelectAllBtn")?.addEventListener("click", () => {
      setAllChecks(true);
    });

    document.getElementById("duringShiftClearAllBtn")?.addEventListener("click", () => {
      setAllChecks(false);
    });
  }

  window.initChecklistDuringShiftTab = async function initChecklistDuringShiftTab(context = {}) {
    const body = document.getElementById("duringShiftBody");

    if (body) {
      body.innerHTML = `
        <tr>
          <td colspan="3">Загрузка...</td>
        </tr>
      `;
    }

    try {
      const template = await loadDuringShiftTemplate();

      renderDuringShiftTable(template, context.data || {});
      bindEvents();
      updateProgress();
    } catch (error) {
      console.error(error);

      if (body) {
        body.innerHTML = `
          <tr>
            <td colspan="3">Ошибка загрузки данных вкладки.</td>
          </tr>
        `;
      }
    }
  };

  window.saveChecklistDuringShiftTab = function saveChecklistDuringShiftTab() {
    const result = {
      tasks: {},
      todo: document.getElementById("duringShiftTodoInput")?.value || ""
    };

    document.querySelectorAll("[data-during-task-key]").forEach((row) => {
      const key = row.dataset.duringTaskKey;

      result.tasks[key] = {
        morning: row.querySelector(".during-check-cell[data-field='morning']")?.dataset.checked === "true",
        evening: row.querySelector(".during-check-cell[data-field='evening']")?.dataset.checked === "true"
      };
    });

    return result;
  };
})();