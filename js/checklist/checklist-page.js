async function initChecklistPage() {
  const restaurantId = localStorage.getItem("restaurant_id") || "-";

  const dateInput = document.getElementById("checklistDateInput");
  const morningManagerInput = document.getElementById("checklistMorningManager");
  const eveningManagerInput = document.getElementById("checklistEveningManager");
  const nightManagerInput = document.getElementById("checklistNightManager");

  const tabs = document.querySelectorAll(".checklist-tab");
  const tabContent = document.getElementById("checklistTabContent");

  const saveBtn = document.getElementById("saveChecklistBtn");
  const resetBtn = document.getElementById("resetChecklistBtn");
  const messageEl = document.getElementById("checklistMessage");

  let activeTab = null;
  let isTabLoaded = false;
  let currentChecklistDate = null;

  let tabSaveTimer = null;
  let metaSaveTimer = null;

  const tabConfig = {
    preparation: {
      html: "../components/checklist/tabs/preparation.html",
      init: "initChecklistPreparationTab"
    },
    goals: {
      html: "../components/checklist/tabs/goals.html",
      init: "initChecklistGoalsTab"
    },
    "during-shift": {
      html: "../components/checklist/tabs/during-shift.html",
      init: "initChecklistDuringShiftTab"
    },
    hourly: {
      html: "../components/checklist/tabs/hourly.html",
      init: "initChecklistHourlyTab"
    },
    "after-shift": {
      html: "../components/checklist/tabs/after-shift.html",
      init: "initChecklistAfterShiftTab"
    }
  };

  if (!dateInput || !tabContent) return;

  if (!window.ChecklistStore) {
    console.error("ChecklistStore не найден. Проверь подключение checklist-store.js");

    tabContent.innerHTML = `
      <div class="card">
        <h2>Ошибка</h2>
        <p>Не подключен файл checklist-store.js</p>
      </div>
    `;

    return;
  }

  function getTodayInputDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function showMessage(text, type = "success") {
    if (!messageEl) {
      console.log(`[checklist] ${text}`);
      return;
    }

    messageEl.textContent = text;
    messageEl.className = type === "error" ? "settings-message error" : "settings-message";
  }

  function toPascalCase(value) {
    return value
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }

  function collectMeta(date = currentChecklistDate) {
    return {
      date,
      managers: {
        morning: morningManagerInput?.value || "",
        evening: eveningManagerInput?.value || "",
        night: nightManagerInput?.value || ""
      }
    };
  }

  function collectActiveTabData() {
    if (!activeTab) return {};

    const tabSaveFnName = `saveChecklist${toPascalCase(activeTab)}Tab`;

    if (typeof window[tabSaveFnName] === "function") {
      return window[tabSaveFnName]() || {};
    }

    return {};
  }

  function cancelPendingSaves() {
    clearTimeout(tabSaveTimer);
    clearTimeout(metaSaveTimer);

    tabSaveTimer = null;
    metaSaveTimer = null;
  }

  async function loadMetaFromSupabase(date = currentChecklistDate) {
    const meta = await window.ChecklistStore.loadMeta({
      date
    });

    if (morningManagerInput) {
      morningManagerInput.value = meta.managers?.morning || "";
    }

    if (eveningManagerInput) {
      eveningManagerInput.value = meta.managers?.evening || "";
    }

    if (nightManagerInput) {
      nightManagerInput.value = meta.managers?.night || "";
    }
  }

  async function saveMetaToSupabase(date = currentChecklistDate, options = {}) {
    const meta = collectMeta(date);

    return await window.ChecklistStore.saveMeta(meta, {
      date,
      silent: options.silent ?? false
    });
  }

  async function saveActiveTab(options = {}) {
    const date = options.date || currentChecklistDate;

    if (!date) return false;

    const meta = collectMeta(date);

    showMessage("Сохраняем...");

    const metaSaved = await window.ChecklistStore.saveMeta(meta, {
      date,
      silent: true
    });

    let tabSaved = true;

    if (activeTab && isTabLoaded) {
      const tabData = collectActiveTabData();

      tabSaved = await window.ChecklistStore.saveTab(activeTab, tabData, {
        date,
        meta,
        silent: true
      });
    }

    if (metaSaved && tabSaved) {
      if (!options.silent) {
        showMessage("Сохранено.");
      } else {
        showMessage("Сохранено.");
      }

      return true;
    }

    showMessage("Ошибка сохранения.", "error");
    return false;
  }

  function scheduleMetaSave(delay = 700) {
    const saveDate = currentChecklistDate;

    if (!saveDate) return;

    clearTimeout(metaSaveTimer);
    showMessage("Сохраняем...");

    metaSaveTimer = setTimeout(async () => {
      if (currentChecklistDate !== saveDate) return;

      await saveMetaToSupabase(saveDate);
    }, delay);
  }

  function scheduleActiveTabSave(delay = 700) {
    const saveDate = currentChecklistDate;
    const tabKey = activeTab;

    if (!saveDate || !tabKey || !isTabLoaded) return;

    clearTimeout(tabSaveTimer);
    showMessage("Сохраняем...");

    tabSaveTimer = setTimeout(async () => {
      if (currentChecklistDate !== saveDate) return;
      if (activeTab !== tabKey) return;
      if (!isTabLoaded) return;

      await saveActiveTab({
        date: saveDate
      });
    }, delay);
  }

  async function loadTab(tabKey, options = {}) {
    const config = tabConfig[tabKey];
    const date = options.date || currentChecklistDate;

    if (!config || !date) return;

    if (!options.skipSave && activeTab && isTabLoaded) {
      await saveActiveTab({
        date: currentChecklistDate,
        silent: true
      });
    }

    activeTab = tabKey;
    isTabLoaded = false;

    tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.checklistTab === tabKey);
    });

    tabContent.innerHTML = `
      <div class="card">
        <p>Загрузка вкладки...</p>
      </div>
    `;

    try {
      const htmlPromise = fetch(config.html).then((response) => {
        if (!response.ok) {
          throw new Error("Не удалось загрузить HTML вкладки.");
        }

        return response.text();
      });

      const tabDataPromise = window.ChecklistStore.loadTab(tabKey, {
        date
      });

      const [html, tabData] = await Promise.all([
        htmlPromise,
        tabDataPromise
      ]);

      tabContent.innerHTML = html;

      if (typeof window[config.init] === "function") {
        await window[config.init]({
          date,
          restaurantId,
          data: tabData,
          save: async (saveOptions = {}) => {
            if (saveOptions.immediate) {
              return await saveActiveTab({
                date: currentChecklistDate
              });
            }

            scheduleActiveTabSave(saveOptions.delay ?? 700);
            return true;
          }
        });
      }

      isTabLoaded = true;
    } catch (error) {
      console.error(error);

      tabContent.innerHTML = `
        <div class="card">
          <h2>Ошибка загрузки</h2>
          <p>Не удалось открыть вкладку чек-листа.</p>
        </div>
      `;

      showMessage("Ошибка загрузки вкладки.", "error");
    }
  }

  async function resetChecklist() {
    const confirmed = confirm("Очистить чек-лист за выбранную дату?");

    if (!confirmed) return;

    cancelPendingSaves();

    const date = currentChecklistDate;

    await window.ChecklistStore.deleteDate({
      date
    });

    if (morningManagerInput) morningManagerInput.value = "";
    if (eveningManagerInput) eveningManagerInput.value = "";
    if (nightManagerInput) nightManagerInput.value = "";

    await loadTab(activeTab || "preparation", {
      skipSave: true,
      date
    });

    showMessage("Чек-лист очищен.");
  }

  function bindTabAutosave() {
    tabContent.addEventListener("input", () => {
      scheduleActiveTabSave(700);
    });

    tabContent.addEventListener("change", () => {
      scheduleActiveTabSave(400);
    });

    tabContent.addEventListener("click", (event) => {
      const autosaveTarget = event.target.closest(
        ".prep-check-cell, .during-check-cell, .after-check-cell, #prepSelectAllBtn, #prepClearAllBtn, #duringShiftSelectAllBtn, #duringShiftClearAllBtn, #afterShiftSelectAllBtn, #afterShiftClearAllBtn"
      );

      if (!autosaveTarget) return;

      setTimeout(() => {
        saveActiveTab({
          date: currentChecklistDate,
          silent: true
        });
      }, 0);
    });
  }

  function bindMetaAutosave() {
    [morningManagerInput, eveningManagerInput, nightManagerInput].forEach((input) => {
      if (!input) return;

      input.addEventListener("input", () => {
        scheduleMetaSave(700);
      });

      input.addEventListener("change", () => {
        saveMetaToSupabase(currentChecklistDate);
      });
    });
  }

  if (!dateInput.value) {
    dateInput.value = getTodayInputDate();
  }

  currentChecklistDate = dateInput.value;

  await window.ChecklistStore.init({
    restaurantId,
    date: currentChecklistDate,
    setStatus: showMessage
  });

  await loadMetaFromSupabase(currentChecklistDate);

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      loadTab(tab.dataset.checklistTab);
    });
  });

  dateInput.addEventListener("change", async () => {
    const nextDate = dateInput.value;
    const previousDate = currentChecklistDate;

    if (!nextDate || nextDate === previousDate) {
      return;
    }

    cancelPendingSaves();

    dateInput.disabled = true;
    showMessage("Сохраняем текущую дату...");

    try {
      await saveActiveTab({
        date: previousDate,
        silent: true
      });

      currentChecklistDate = nextDate;

      window.ChecklistStore.setDate(currentChecklistDate);

      await loadMetaFromSupabase(currentChecklistDate);

      await loadTab(activeTab || "preparation", {
        skipSave: true,
        date: currentChecklistDate
      });

      showMessage(`Открыт чек-лист за ${currentChecklistDate}.`);
    } catch (error) {
      console.error(error);

      currentChecklistDate = previousDate;
      dateInput.value = previousDate;

      window.ChecklistStore.setDate(previousDate);

      showMessage("Ошибка смены даты. Вернули прежнюю дату.", "error");
    } finally {
      dateInput.disabled = false;
    }
  });

  saveBtn?.addEventListener("click", () => {
    cancelPendingSaves();

    saveActiveTab({
      date: currentChecklistDate
    });
  });

  resetBtn?.addEventListener("click", resetChecklist);

  bindTabAutosave();
  bindMetaAutosave();

  await loadTab("preparation", {
    skipSave: true,
    date: currentChecklistDate
  });
}