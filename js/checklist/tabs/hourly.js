(function () {
  let hourlyTemplate = null;
  let activeContext = {};
  let planLoadToken = 0;

  const AUTO_PLAN_FIELDS = new Set([
    "totalPlan",
    "counterPlan",
    "drivePlan",
    "kioskPlan",
    "deliveryPlan",
    "sandwichPlan",
    "salesPlan",
  ]);

  const SUM_FIELDS = [
    "totalPlan",
    "totalFact",
    "counterPlan",
    "counterFact",
    "drivePlan",
    "driveFact",
    "kioskPlan",
    "kioskFact",
    "deliveryPlan",
    "deliveryFact",
    "sandwichPlan",
    "sandwichFact",
    "salesPlan",
    "salesFact",
  ];

  const CHANNEL_PLAN_FIELDS = [
    {
      percentKey: "cPercent",
      field: "counterPlan",
    },
    {
      percentKey: "dtPercent",
      field: "drivePlan",
    },
    {
      percentKey: "kiosksPercent",
      field: "kioskPlan",
    },
    {
      percentKey: "dlvPercent",
      field: "deliveryPlan",
    },
  ];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === "") return 0;

    const normalized = String(value)
      .replace("%", "")
      .replace(/\s+/g, "")
      .replace(",", ".");

    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  }

  function formatNumber(value) {
    const num = Number(value);

    if (!Number.isFinite(num)) return "";

    if (Number.isInteger(num)) {
      return String(num);
    }

    return String(Math.round(num * 100) / 100);
  }

  function isEmpty(value) {
    return value === null || value === undefined || value === "";
  }

  function roundChannelPlan(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;

    return Math.round(num);
  }

  async function loadHourlyTemplate() {
    if (hourlyTemplate) return hourlyTemplate;

    const response = await fetch("../data/checklist/hourly.json");

    if (!response.ok) {
      throw new Error("Не удалось загрузить hourly.json");
    }

    hourlyTemplate = await response.json();
    return hourlyTemplate;
  }

  function getValue(savedData, key, field) {
    const value = savedData?.rows?.[key]?.[field];

    if (isEmpty(value)) return "";

    return value;
  }

  function getPriorityValue(savedData, blockKey, priorityKey) {
    const value = savedData?.priorities?.[blockKey]?.[priorityKey];

    if (isEmpty(value)) return "";

    return value;
  }

  function getInputHtml({ field, value = "", isAutoPlan = false }) {
    const autoAttrs = isAutoPlan
      ? 'data-auto-plan-field="true" readonly title="Автоматически из Planning / Goals"'
      : "";

    return `<input type="text" data-field="${escapeHtml(field)}" value="${escapeHtml(value)}" ${autoAttrs} />`;
  }

  function getTotalInputHtml(field) {
    return `<input type="text" data-total-field="${escapeHtml(field)}" readonly />`;
  }

  function renderHourlyBlock(block, savedData = {}) {
    const rows = block.hours
      .map((hour) => {
        const key = `${block.key}_${hour}`;

        return `
          <tr data-hourly-row-key="${escapeHtml(key)}">
            <td class="hourly-time-cell">${escapeHtml(hour)}</td>

            <td class="hourly-plan-cell">
              ${getInputHtml({ field: "totalPlan", value: "", isAutoPlan: true })}
            </td>
            <td class="hourly-fact-cell">
              ${getInputHtml({ field: "totalFact", value: getValue(savedData, key, "totalFact") })}
            </td>

            <td class="hourly-plan-cell">
              ${getInputHtml({ field: "counterPlan", value: "", isAutoPlan: true })}
            </td>
            <td class="hourly-fact-cell">
              ${getInputHtml({ field: "counterFact", value: getValue(savedData, key, "counterFact") })}
            </td>

            <td class="hourly-plan-cell">
              ${getInputHtml({ field: "drivePlan", value: "", isAutoPlan: true })}
            </td>
            <td class="hourly-fact-cell">
              ${getInputHtml({ field: "driveFact", value: getValue(savedData, key, "driveFact") })}
            </td>

            <td class="hourly-plan-cell">
              ${getInputHtml({ field: "kioskPlan", value: "", isAutoPlan: true })}
            </td>
            <td class="hourly-fact-cell">
              ${getInputHtml({ field: "kioskFact", value: getValue(savedData, key, "kioskFact") })}
            </td>

            <td class="hourly-plan-cell">
              ${getInputHtml({ field: "deliveryPlan", value: "", isAutoPlan: true })}
            </td>
            <td class="hourly-fact-cell">
              ${getInputHtml({ field: "deliveryFact", value: getValue(savedData, key, "deliveryFact") })}
            </td>

            <td class="hourly-plan-cell">
              ${getInputHtml({ field: "sandwichPlan", value: "", isAutoPlan: true })}
            </td>
            <td class="hourly-fact-cell">
              ${getInputHtml({ field: "sandwichFact", value: getValue(savedData, key, "sandwichFact") })}
            </td>

            <td class="hourly-plan-cell">
              ${getInputHtml({ field: "salesPlan", value: "", isAutoPlan: true })}
            </td>
            <td class="hourly-fact-cell">
              ${getInputHtml({ field: "salesFact", value: getValue(savedData, key, "salesFact") })}
            </td>

            <td class="hourly-avcheck-cell">
              ${getInputHtml({ field: "avgCheck", value: getValue(savedData, key, "avgCheck") })}
            </td>

            <td class="hourly-gcpch-cell">
              ${getInputHtml({ field: "gcpch", value: getValue(savedData, key, "gcpch") })}
            </td>

            <td class="hourly-oepe-cell">
              ${getInputHtml({ field: "oepe", value: getValue(savedData, key, "oepe") })}
            </td>
          </tr>
        `;
      })
      .join("");

    const shiftName =
      block.key === "morning"
        ? "утро"
        : block.key === "evening"
          ? "вечер"
          : "ночь";

    return `
      <div class="hourly-block" data-hourly-block="${escapeHtml(block.key)}">
        <table class="hourly-excel-table">
          <colgroup>
            <col class="hourly-time-col" />

            <col class="hourly-small-col" />
            <col class="hourly-small-col" />

            <col class="hourly-small-col" />
            <col class="hourly-small-col" />

            <col class="hourly-small-col" />
            <col class="hourly-small-col" />

            <col class="hourly-small-col" />
            <col class="hourly-small-col" />

            <col class="hourly-small-col" />
            <col class="hourly-small-col" />

            <col class="hourly-small-col" />
            <col class="hourly-small-col" />

            <col class="hourly-medium-col" />
            <col class="hourly-medium-col" />

            <col class="hourly-wide-col" />
            <col class="hourly-wide-col" />
            <col class="hourly-wide-col" />
          </colgroup>

          <thead>
            <tr>
              <th class="hourly-main-title" colspan="18">${escapeHtml(block.title)}</th>
            </tr>

            <tr>
              <th></th>
              <th class="hourly-group-title" colspan="10">GC ( C планирования за ${escapeHtml(shiftName)} )</th>
              <th class="hourly-group-title" colspan="2">Кол-во сандвичей</th>
              <th class="hourly-group-title" colspan="2">Sales (ежечасно)</th>
              <th class="hourly-group-title">Av. Check</th>
              <th class="hourly-group-title">GCPCH с ТТ</th>
              <th class="hourly-group-title">OEPE</th>
            </tr>

            <tr>
              <th class="hourly-sub-title">Время</th>

              <th class="hourly-sub-title" colspan="2">Общее<br />План/факт</th>
              <th class="hourly-sub-title" colspan="2">C<br />План/факт</th>
              <th class="hourly-sub-title" colspan="2">Drive<br />План/факт</th>
              <th class="hourly-sub-title" colspan="2">Киоски<br />План/факт</th>
              <th class="hourly-sub-title" colspan="2">Delivery<br />План/факт</th>

              <th class="hourly-sub-title">План</th>
              <th class="hourly-sub-title">Факт</th>

              <th class="hourly-sub-title">План</th>
              <th class="hourly-sub-title">Факт</th>

              <th class="hourly-sub-title">Ежечасно\\По<br />накоплению</th>
              <th class="hourly-sub-title">Ежечасно\\По<br />накоплению</th>
              <th class="hourly-sub-title">Ежечасно\\По<br />накоплению</th>
            </tr>
          </thead>

          <tbody>
            ${rows}

            <tr class="hourly-total-row">
              <td>ИТОГ</td>

              <td>${getTotalInputHtml("totalPlan")}</td>
              <td>${getTotalInputHtml("totalFact")}</td>

              <td>${getTotalInputHtml("counterPlan")}</td>
              <td>${getTotalInputHtml("counterFact")}</td>

              <td>${getTotalInputHtml("drivePlan")}</td>
              <td>${getTotalInputHtml("driveFact")}</td>

              <td>${getTotalInputHtml("kioskPlan")}</td>
              <td>${getTotalInputHtml("kioskFact")}</td>

              <td>${getTotalInputHtml("deliveryPlan")}</td>
              <td>${getTotalInputHtml("deliveryFact")}</td>

              <td>${getTotalInputHtml("sandwichPlan")}</td>
              <td>${getTotalInputHtml("sandwichFact")}</td>

              <td>${getTotalInputHtml("salesPlan")}</td>
              <td>${getTotalInputHtml("salesFact")}</td>

              <td>${getTotalInputHtml("avgCheck")}</td>
              <td>${getTotalInputHtml("gcpch")}</td>
              <td>${getTotalInputHtml("oepe")}</td>
            </tr>
          </tbody>
        </table>

        <div class="hourly-status-title">${escapeHtml(block.statusTitle)}</div>

        <div class="hourly-priority-row">
          <div class="hourly-priority-label">Приоритет 1</div>
          <textarea class="hourly-priority-input" data-block="${escapeHtml(block.key)}" data-priority="priority1">${escapeHtml(getPriorityValue(savedData, block.key, "priority1"))}</textarea>
        </div>

        <div class="hourly-priority-row">
          <div class="hourly-priority-label">Приоритет 2</div>
          <textarea class="hourly-priority-input" data-block="${escapeHtml(block.key)}" data-priority="priority2">${escapeHtml(getPriorityValue(savedData, block.key, "priority2"))}</textarea>
        </div>

        <div class="hourly-priority-row">
          <div class="hourly-priority-label">Приоритет 3</div>
          <textarea class="hourly-priority-input" data-block="${escapeHtml(block.key)}" data-priority="priority3">${escapeHtml(getPriorityValue(savedData, block.key, "priority3"))}</textarea>
        </div>
      </div>
    `;
  }

  function renderHourly(template, savedData = {}) {
    const container = document.getElementById("hourlyBlocks");
    if (!container) return;

    container.innerHTML = `
      <div class="hourly-plan-sync" id="hourlyPlanSyncStatus">
        План из Planning: загрузка...
      </div>
      ${(template.blocks || [])
        .map((block) => renderHourlyBlock(block, savedData))
        .join("")}
    `;

    bindHourlyInputEvents(container);
    calculateAllTotals();

    const progressText = document.getElementById("checklistProgressText");
    if (progressText) progressText.textContent = "Почасовая";
  }

  function setPlanStatus(text, type = "default") {
    const status = document.getElementById("hourlyPlanSyncStatus");
    if (!status) return;

    status.textContent = text;
    status.dataset.status = type;
  }

  function getSupabaseClient(context = {}) {
    const candidates = [
      context.supabase,
      context.supabaseClient,
      context.client,
      window.supabaseClient,
      window.SupabaseClient,
      window.APP_SUPABASE_CLIENT,
      window.db,
      window.supabase,
    ];

    return candidates.find((client) => client && typeof client.from === "function") || null;
  }

  function getRestaurantId(context = {}) {
    return (
      context.restaurantId ||
      context.restaurant_id ||
      context.session?.restaurant_id ||
      context.profile?.restaurant_id ||
      window.currentRestaurantId ||
      window.restaurantId ||
      window.APP_RESTAURANT_ID ||
      localStorage.getItem("restaurant_id") ||
      localStorage.getItem("restaurantId") ||
      ""
    );
  }

  function getChecklistDate(context = {}) {
    const fromContext =
      context.date ||
      context.currentDate ||
      context.checklistDate ||
      context.checklist_date ||
      context.session?.checklist_date ||
      window.currentChecklistDate ||
      window.checklistDate;

    if (fromContext) return fromContext;

    const selectors = [
      "#checklistDateInput",
      "#checklistDate",
      "[data-checklist-date]",
      ".checklist-date-input",
      'input[type="date"]',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);

      if (element?.value) {
        return element.value;
      }
    }

    return "";
  }

  function normalizeHourValue(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/[–—]/g, "-");
  }

  function padHour(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value || "");
    return String(num).padStart(2, "0");
  }

  function getHourCandidates(value) {
    const source = normalizeHourValue(value);
    const candidates = new Set();

    if (!source) return candidates;

    candidates.add(source);
    candidates.add(source.replace(":00", ""));

    const rangeMatch = source.match(/^(\d{1,2})(?::00)?-(\d{1,2})(?::00)?$/);
    if (rangeMatch) {
      const start = rangeMatch[1];
      const end = rangeMatch[2];

      candidates.add(`${padHour(start)}-${padHour(end)}`);
      candidates.add(`${Number(start)}-${Number(end)}`);
      candidates.add(padHour(start));
      candidates.add(String(Number(start)));
      candidates.add(`${padHour(start)}:00`);
      candidates.add(`${String(Number(start))}:00`);

      return candidates;
    }

    const hourMatch = source.match(/^(\d{1,2})(?::00)?$/);
    if (hourMatch) {
      const start = hourMatch[1];
      const end = Number(start) + 1;

      candidates.add(padHour(start));
      candidates.add(String(Number(start)));
      candidates.add(`${padHour(start)}:00`);
      candidates.add(`${String(Number(start))}:00`);
      candidates.add(`${padHour(start)}-${padHour(end)}`);
      candidates.add(`${Number(start)}-${end}`);
    }

    return candidates;
  }

  function createPlansLookup(plans) {
    const lookup = new Map();

    (plans || []).forEach((plan) => {
      getHourCandidates(plan.hour).forEach((key) => {
        lookup.set(key, plan);
      });
    });

    return lookup;
  }

  function findPlanForHour(lookup, hour) {
    const candidates = getHourCandidates(hour);

    for (const key of candidates) {
      if (lookup.has(key)) {
        return lookup.get(key);
      }
    }

    return null;
  }

  function setRowFieldValue(row, field, value) {
    const input = row.querySelector(`[data-field="${field}"]`);
    if (!input) return;

    input.value = formatNumber(value);
    input.dataset.autoPlanLoaded = "true";
  }

  function clearRowFieldValue(row, field) {
    const input = row.querySelector(`[data-field="${field}"]`);
    if (!input) return;

    input.value = "";
    delete input.dataset.autoPlanLoaded;
  }

  function clearAutoPlanCells() {
    document.querySelectorAll("[data-hourly-row-key]").forEach((row) => {
      AUTO_PLAN_FIELDS.forEach((field) => {
        clearRowFieldValue(row, field);
      });
    });

    calculateAllTotals();
  }

  function getPercentTargetsFromGoals() {
    if (
      window.ChecklistGoals &&
      typeof window.ChecklistGoals.getPercentTargets === "function"
    ) {
      return window.ChecklistGoals.getPercentTargets();
    }

    const result = {
      dtPercent: 0,
      kiosksPercent: 0,
      dlvPercent: 0,
      cPercent: 0,
    };

    document.querySelectorAll("[data-goal-plan-key]").forEach((row) => {
      const planKey = row.dataset.goalPlanKey;
      const target = row.querySelector("[data-field='target']")?.value || "";
      const value = toNumber(target);

      if (planKey === "dt_percent") result.dtPercent = value;
      if (planKey === "kiosks_percent") result.kiosksPercent = value;
      if (planKey === "dlv_percent") result.dlvPercent = value;
      if (planKey === "c_percent") result.cPercent = value;
    });

    return result;
  }

  function applyChannelPlansFromGoals() {
    const percents = getPercentTargetsFromGoals();

    document.querySelectorAll("[data-hourly-row-key]").forEach((row) => {
      const totalPlanValue = row.querySelector("[data-field='totalPlan']")?.value || "";
      const totalGc = toNumber(totalPlanValue);

      CHANNEL_PLAN_FIELDS.forEach((item) => {
        const percent = toNumber(percents[item.percentKey]);

        if (!totalGc || !percent) {
          clearRowFieldValue(row, item.field);
          return;
        }

        const channelValue = roundChannelPlan((totalGc * percent) / 100);
        setRowFieldValue(row, item.field, channelValue);
      });
    });

    calculateAllTotals();
  }

  function applyPlansToTable(plans) {
    const lookup = createPlansLookup(plans);
    let appliedCount = 0;

    document.querySelectorAll("[data-hourly-row-key]").forEach((row) => {
      const hour = row.querySelector(".hourly-time-cell")?.textContent || "";
      const plan = findPlanForHour(lookup, hour);

      if (!plan) return;

      setRowFieldValue(row, "totalPlan", plan.planGc);
      setRowFieldValue(row, "salesPlan", plan.planTo);
      setRowFieldValue(row, "sandwichPlan", plan.sandwichPlan);

      appliedCount += 1;
    });

    applyChannelPlansFromGoals();
    calculateAllTotals();

    return appliedCount;
  }

  async function loadAndApplyHourlyPlans(context = {}) {
    const currentToken = ++planLoadToken;

    clearAutoPlanCells();

    if (!window.HourlyPlansApi) {
      setPlanStatus("План из Planning: hourly-plans-api.js не подключен", "error");
      return;
    }

    const supabase = getSupabaseClient(context);
    const restaurantId = getRestaurantId(context);
    const date = getChecklistDate(context);

    if (!supabase) {
      setPlanStatus("План из Planning: Supabase client не найден", "error");
      return;
    }

    if (!restaurantId) {
      setPlanStatus("План из Planning: restaurant_id не найден", "error");
      return;
    }

    if (!date) {
      setPlanStatus("План из Planning: дата не выбрана", "error");
      return;
    }

    try {
      setPlanStatus("План из Planning: загружается...", "loading");

      const plans = await window.HourlyPlansApi.getHourlyPlansByDate({
        supabase,
        restaurantId,
        date,
      });

      if (currentToken !== planLoadToken) return;

      const appliedCount = applyPlansToTable(plans);

      if (!plans.length) {
        setPlanStatus(`План из Planning: на ${date} данных нет`, "empty");
        return;
      }

      setPlanStatus(
        `План из Planning: загружено ${appliedCount} строк`,
        "success"
      );
    } catch (error) {
      if (currentToken !== planLoadToken) return;

      console.error("Ошибка применения hourly_plans:", error);
      setPlanStatus("План из Planning: ошибка загрузки", "error");
    }
  }

  function calculateBlockTotals(block) {
    SUM_FIELDS.forEach((field) => {
      let sum = 0;
      let hasValue = false;

      block.querySelectorAll(`[data-hourly-row-key] [data-field="${field}"]`).forEach((input) => {
        if (String(input.value || "").trim() === "") return;

        sum += toNumber(input.value);
        hasValue = true;
      });

      const totalInput = block.querySelector(`[data-total-field="${field}"]`);
      if (!totalInput) return;

      totalInput.value = hasValue ? formatNumber(sum) : "";
    });

    ["avgCheck", "gcpch", "oepe"].forEach((field) => {
      const totalInput = block.querySelector(`[data-total-field="${field}"]`);
      if (totalInput) totalInput.value = "";
    });
  }

  function calculateAllTotals() {
    document.querySelectorAll(".hourly-block").forEach((block) => {
      calculateBlockTotals(block);
    });
  }

  function bindHourlyInputEvents(container) {
    if (container.dataset.hourlyEventsBound === "true") return;

    container.dataset.hourlyEventsBound = "true";

    container.addEventListener("input", (event) => {
      if (!event.target.matches("[data-field]")) return;
      calculateAllTotals();
    });
  }

  function bindGoalsPercentWatcher() {
  if (window.__hourlyGoalsPercentWatcherBound) return;

  window.__hourlyGoalsPercentWatcherBound = true;

  window.addEventListener("checklist:goals-percent-changed", () => {
    applyChannelPlansFromGoals();
  });

  document.addEventListener("input", (event) => {
    const input = event.target;

    if (!input.matches("[data-field='target']")) return;

    const row = input.closest("[data-goal-plan-key]");
    if (!row) return;

    const planKey = row.dataset.goalPlanKey;

    if (
      planKey !== "dt_percent" &&
      planKey !== "kiosks_percent" &&
      planKey !== "dlv_percent" &&
      planKey !== "c_percent"
    ) {
      return;
    }

    if (
      window.ChecklistGoals &&
      typeof window.ChecklistGoals.updatePercentCache === "function"
    ) {
      window.ChecklistGoals.updatePercentCache();
    }

    applyChannelPlansFromGoals();
  });

  document.addEventListener("blur", (event) => {
    const input = event.target;

    if (!input.matches("[data-field='target']")) return;

    const row = input.closest("[data-goal-plan-key]");
    if (!row) return;

    const planKey = row.dataset.goalPlanKey;

    if (
      planKey !== "dt_percent" &&
      planKey !== "kiosks_percent" &&
      planKey !== "dlv_percent" &&
      planKey !== "c_percent"
    ) {
      return;
    }

    if (
      window.ChecklistGoals &&
      typeof window.ChecklistGoals.updatePercentCache === "function"
    ) {
      window.ChecklistGoals.updatePercentCache();
    }

    applyChannelPlansFromGoals();
  }, true);
}

  window.initChecklistHourlyTab = async function initChecklistHourlyTab(context = {}) {
    const container = document.getElementById("hourlyBlocks");

    activeContext = {
      ...activeContext,
      ...context,
    };

    if (container) {
      container.innerHTML = `<div class="hourly-loading">Загрузка...</div>`;
    }

    try {
      const template = await loadHourlyTemplate();

      renderHourly(template, context.data || {});
      bindGoalsPercentWatcher();

      await loadAndApplyHourlyPlans(activeContext);
    } catch (error) {
      console.error(error);

      if (container) {
        container.innerHTML = `
          <div class="hourly-loading">
            Ошибка загрузки данных вкладки.
          </div>
        `;
      }
    }
  };

  window.saveChecklistHourlyTab = function saveChecklistHourlyTab() {
    const result = {
      rows: {},
      priorities: {},
    };

    document.querySelectorAll("[data-hourly-row-key]").forEach((row) => {
      const key = row.dataset.hourlyRowKey;
      result.rows[key] = {};

      row.querySelectorAll("[data-field]").forEach((input) => {
        result.rows[key][input.dataset.field] = input.value || "";
      });
    });

    document.querySelectorAll(".hourly-priority-input").forEach((textarea) => {
      const block = textarea.dataset.block;
      const priority = textarea.dataset.priority;

      if (!result.priorities[block]) {
        result.priorities[block] = {};
      }

      result.priorities[block][priority] = textarea.value || "";
    });

    return result;
  };

  window.ChecklistHourly = {
    reloadPlans(context = {}) {
      activeContext = {
        ...activeContext,
        ...context,
      };

      return loadAndApplyHourlyPlans(activeContext);
    },

    recalculateChannelPlans() {
      applyChannelPlansFromGoals();
    },
  };

  if (!window.__checklistHourlyDateListenerBound) {
    window.__checklistHourlyDateListenerBound = true;

    window.addEventListener("checklist:date-changed", (event) => {
      const nextDate =
        event.detail?.date ||
        event.detail?.checklistDate ||
        event.detail?.checklist_date ||
        "";

      if (!nextDate) return;

      activeContext = {
        ...activeContext,
        date: nextDate,
        checklistDate: nextDate,
      };

      loadAndApplyHourlyPlans(activeContext);
    });
  }
})();