(function () {
  let currentPreparationData = {};
  let preparationTemplate = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadPreparationTemplate() {
    if (preparationTemplate) return preparationTemplate;

    const response = await fetch("../data/checklist/preparation.json");

    if (!response.ok) {
      throw new Error("Не удалось загрузить preparation.json");
    }

    preparationTemplate = await response.json();
    return preparationTemplate;
  }

  function toBool(value) {
    return value === true || value === "Да" || value === "true";
  }

  function renderCheckCell(field, checked) {
    return `
      <td
        class="prep-check-cell ${checked ? "checked" : ""}"
        data-field="${field}"
        data-checked="${checked ? "true" : "false"}"
        title="Нажмите, чтобы отметить"
      ></td>
    `;
  }

  function flattenLeftRows(template) {
    const rows = [];

    template.sections.forEach((section) => {
      if (section.title) {
        rows.push({
          type: "category",
          title: section.title
        });
      }

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

  function renderPreparationTable(template, savedData) {
    const body = document.getElementById("preparationBody");
    if (!body) return;

    const leftRows = flattenLeftRows(template);
    const shelfRows = template.shelfLife || [];
    const totalRows = Math.max(leftRows.length, shelfRows.length);

    let html = "";

    for (let index = 0; index < totalRows; index += 1) {
      const left = leftRows[index];
      const shelfName = shelfRows[index] || "";

      const taskKey = `task_${index}`;
      const shelfKey = `shelf_${index}`;

      const taskResult = savedData.tasks?.[taskKey] || {};
      const shelfResult = savedData.shelfLife?.[shelfKey] || {};

      if (left?.type === "category") {
        html += `
          <tr>
            <td class="prep-category" colspan="3">${escapeHtml(left.title)}</td>
            ${renderShelfCells(shelfName, shelfResult, shelfKey)}
          </tr>
        `;
        continue;
      }

      if (left?.type === "task") {
        html += `
          <tr data-prep-task-key="${taskKey}">
            ${renderCheckCell("morning", toBool(taskResult.morning))}
            ${renderCheckCell("evening", toBool(taskResult.evening))}

            <td class="prep-task-text ${left.important ? "important" : ""}">
              ${escapeHtml(left.text)}
            </td>

            ${renderShelfCells(shelfName, shelfResult, shelfKey)}
          </tr>
        `;
        continue;
      }

      html += `
        <tr>
          <td class="prep-empty-cell"></td>
          <td class="prep-empty-cell"></td>
          <td class="prep-empty-cell"></td>
          ${renderShelfCells(shelfName, shelfResult, shelfKey)}
        </tr>
      `;
    }

    body.innerHTML = html;
  }

  function renderShelfCells(shelfName, shelfResult, shelfKey) {
    if (!shelfName) {
      return `
        <td class="prep-empty-cell"></td>
        <td class="prep-empty-cell"></td>
        <td class="prep-empty-cell"></td>
      `;
    }

    return `
      <td class="prep-shelf-name" data-prep-shelf-key="${shelfKey}">
        ${escapeHtml(shelfName)}
      </td>

      <td>
        <input
          class="prep-shelf-input"
          data-shelf-key="${shelfKey}"
          data-field="morning"
          type="text"
          inputmode="numeric"
          value="${escapeHtml(shelfResult.morning || "")}"
          placeholder=""
        />
      </td>

      <td>
        <input
          class="prep-shelf-input"
          data-shelf-key="${shelfKey}"
          data-field="evening"
          type="text"
          inputmode="numeric"
          value="${escapeHtml(shelfResult.evening || "")}"
          placeholder=""
        />
      </td>
    `;
  }

  function toggleCheckCell(cell) {
    const isChecked = cell.dataset.checked === "true";
    const nextValue = !isChecked;

    cell.dataset.checked = nextValue ? "true" : "false";
    cell.classList.toggle("checked", nextValue);

    updateProgress();
  }

  function setAllChecks(value) {
    document.querySelectorAll("#preparationTable .prep-check-cell").forEach((cell) => {
      cell.dataset.checked = value ? "true" : "false";
      cell.classList.toggle("checked", value);
    });

    updateProgress();
  }

  function updateProgress() {
    const progressText = document.getElementById("checklistProgressText");
    if (!progressText) return;

    const rows = Array.from(document.querySelectorAll("[data-prep-task-key]"));
    const doneRows = rows.filter((row) => {
      const morning = row.querySelector(".prep-check-cell[data-field='morning']")?.dataset.checked === "true";
      const evening = row.querySelector(".prep-check-cell[data-field='evening']")?.dataset.checked === "true";

      return morning || evening;
    });

    progressText.textContent = `${doneRows.length} / ${rows.length}`;
  }

  function formatShelfValue(value) {
    const raw = String(value || "").trim();

    if (!raw) return "";

    const digits = raw.replace(/\D/g, "");

    // 1536 -> 15:36
    if (digits.length === 4) {
      return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
    }

    // 120101 -> 12.01.01
    if (digits.length === 6) {
      return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}`;
    }

    // 1201011536 -> 12.01.01 15:36
    if (digits.length === 10) {
      return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)} ${digits.slice(6, 8)}:${digits.slice(8, 10)}`;
    }

    // Егер қолданушы 12.01.01 1536 сияқты аралас жазса
    if (digits.length > 10) {
      return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)} ${digits.slice(6, 8)}:${digits.slice(8, 10)}`;
    }

    return raw;
  }

  function bindEvents() {
    document.querySelectorAll("#preparationTable .prep-check-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        toggleCheckCell(cell);
      });
    });

    document.querySelectorAll("#preparationTable .prep-shelf-input").forEach((input) => {
      input.addEventListener("blur", () => {
        input.value = formatShelfValue(input.value);
      });

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.value = formatShelfValue(input.value);
          input.blur();
        }
      });
    });

    document.getElementById("prepSelectAllBtn")?.addEventListener("click", () => {
      setAllChecks(true);
    });

    document.getElementById("prepClearAllBtn")?.addEventListener("click", () => {
      setAllChecks(false);
    });
  }

  window.initChecklistPreparationTab = async function initChecklistPreparationTab(context = {}) {
    currentPreparationData = context.data || {};

    const body = document.getElementById("preparationBody");
    if (body) {
      body.innerHTML = `
        <tr>
          <td colspan="6">Загрузка...</td>
        </tr>
      `;
    }

    try {
      const template = await loadPreparationTemplate();
      renderPreparationTable(template, currentPreparationData);
      bindEvents();
      updateProgress();
    } catch (error) {
      console.error(error);

      if (body) {
        body.innerHTML = `
          <tr>
            <td colspan="6">Ошибка загрузки данных вкладки.</td>
          </tr>
        `;
      }
    }
  };

  window.saveChecklistPreparationTab = function saveChecklistPreparationTab() {
    const result = {
      tasks: {},
      shelfLife: {}
    };

    document.querySelectorAll("[data-prep-task-key]").forEach((row) => {
      const key = row.dataset.prepTaskKey;

      result.tasks[key] = {
        morning: row.querySelector(".prep-check-cell[data-field='morning']")?.dataset.checked === "true",
        evening: row.querySelector(".prep-check-cell[data-field='evening']")?.dataset.checked === "true"
      };
    });

    document.querySelectorAll("[data-shelf-key]").forEach((input) => {
      const key = input.dataset.shelfKey;
      const field = input.dataset.field;

      if (!result.shelfLife[key]) {
        result.shelfLife[key] = {};
      }

      result.shelfLife[key][field] = formatShelfValue(input.value || "");
    });

    return result;
  };
})();