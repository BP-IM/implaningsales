(function () {
  let afterShiftTemplate = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadAfterShiftTemplate() {
    if (afterShiftTemplate) return afterShiftTemplate;

    const response = await fetch("../data/checklist/after-shift.json");

    if (!response.ok) {
      throw new Error("Не удалось загрузить after-shift.json");
    }

    afterShiftTemplate = await response.json();
    return afterShiftTemplate;
  }

  function toBool(value) {
    return value === true || value === "Да" || value === "true";
  }

  function renderCheckCell(field, checked) {
    return `
      <td
        class="after-check-cell ${checked ? "checked" : ""}"
        data-field="${field}"
        data-checked="${checked ? "true" : "false"}"
        title="Нажмите, чтобы отметить"
      ></td>
    `;
  }

  function renderAfterShiftTable(template, savedData = {}) {
    const body = document.getElementById("afterShiftBody");
    if (!body) return;

    const items = template.items || [];

    body.innerHTML = items
      .map((item, index) => {
        const taskKey = `task_${index}`;
        const taskResult = savedData.tasks?.[taskKey] || {};

        return `
          <tr data-after-task-key="${taskKey}">
            ${renderCheckCell("morning", toBool(taskResult.morning))}
            ${renderCheckCell("evening", toBool(taskResult.evening))}

            <td class="after-task-text ${item.important ? "important" : ""}">
              ${escapeHtml(item.text)}
            </td>
          </tr>
        `;
      })
      .join("");

    document.getElementById("afterPriority1").value = savedData.priorities?.priority1 || "";
    document.getElementById("afterPriority2").value = savedData.priorities?.priority2 || "";
    document.getElementById("afterPriority3").value = savedData.priorities?.priority3 || "";
  }

  function toggleCheckCell(cell) {
    const isChecked = cell.dataset.checked === "true";
    const nextValue = !isChecked;

    cell.dataset.checked = nextValue ? "true" : "false";
    cell.classList.toggle("checked", nextValue);

    updateProgress();
  }

  function setAllChecks(value) {
    document.querySelectorAll("#afterShiftTable .after-check-cell").forEach((cell) => {
      cell.dataset.checked = value ? "true" : "false";
      cell.classList.toggle("checked", value);
    });

    updateProgress();
  }

  function updateProgress() {
    const progressText = document.getElementById("checklistProgressText");
    if (!progressText) return;

    const rows = Array.from(document.querySelectorAll("[data-after-task-key]"));

    const doneRows = rows.filter((row) => {
      const morning = row.querySelector(".after-check-cell[data-field='morning']")?.dataset.checked === "true";
      const evening = row.querySelector(".after-check-cell[data-field='evening']")?.dataset.checked === "true";

      return morning || evening;
    });

    progressText.textContent = `${doneRows.length} / ${rows.length}`;
  }

  function bindEvents() {
    document.querySelectorAll("#afterShiftTable .after-check-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        toggleCheckCell(cell);
      });
    });

    document.getElementById("afterShiftSelectAllBtn")?.addEventListener("click", () => {
      setAllChecks(true);
    });

    document.getElementById("afterShiftClearAllBtn")?.addEventListener("click", () => {
      setAllChecks(false);
    });
  }

  window.initChecklistAfterShiftTab = async function initChecklistAfterShiftTab(context = {}) {
    const body = document.getElementById("afterShiftBody");

    if (body) {
      body.innerHTML = `
        <tr>
          <td colspan="3">Загрузка...</td>
        </tr>
      `;
    }

    try {
      const template = await loadAfterShiftTemplate();

      renderAfterShiftTable(template, context.data || {});
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

  window.saveChecklistAfterShiftTab = function saveChecklistAfterShiftTab() {
    const result = {
      tasks: {},
      priorities: {
        priority1: document.getElementById("afterPriority1")?.value || "",
        priority2: document.getElementById("afterPriority2")?.value || "",
        priority3: document.getElementById("afterPriority3")?.value || ""
      }
    };

    document.querySelectorAll("[data-after-task-key]").forEach((row) => {
      const key = row.dataset.afterTaskKey;

      result.tasks[key] = {
        morning: row.querySelector(".after-check-cell[data-field='morning']")?.dataset.checked === "true",
        evening: row.querySelector(".after-check-cell[data-field='evening']")?.dataset.checked === "true"
      };
    });

    return result;
  };
})();