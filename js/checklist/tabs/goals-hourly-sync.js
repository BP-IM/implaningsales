(function () {
  const PERCENT_RESULT_KEYS = new Set([
    "dt_percent",
    "kiosks_percent",
    "dlv_percent",
    "c_percent",
  ]);

  let syncToken = 0;
  let isApplyingGoalsValues = false;

  function toNumber(value) {
    if (value === null || value === undefined || value === "") return 0;

    const normalized = String(value)
      .replace("%", "")
      .replace(/\s+/g, "")
      .replace(",", ".");

    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  }

  function hasValue(value) {
    return String(value ?? "").trim() !== "";
  }

  function normalizeDate(date) {
    if (!date) return "";

    const value = String(date).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
      const [day, month, year] = value.split(".");
      return `${year}-${month}-${day}`;
    }

    return value;
  }

  function formatInteger(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "";

    return String(Math.round(num));
  }

  function formatPercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "";

    const rounded = Math.round(num * 10) / 10;

    if (Number.isInteger(rounded)) {
      return `${rounded}%`;
    }

    return `${String(rounded).replace(".", ",")}%`;
  }

  function normalizeMetricName(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[.\-_]/g, "");
  }

  function getMetricName(row) {
    return row.querySelector(".goals-metric-name")?.textContent || "";
  }

  function isTextMetric(row) {
    return row?.dataset?.goalTextRow === "true";
  }

  function isOepeMetric(row) {
    const metric = normalizeMetricName(getMetricName(row));

    return metric.includes("oepe");
  }

  function isZeroBestMetric(row) {
    const metric = normalizeMetricName(getMetricName(row));

    return (
      metric.includes("1&2") ||
      metric.includes("1и2") ||
      metric.includes("неточно") ||
      metric.includes("неточныхзаказов")
    );
  }

  function isLowerBetterMetric(row) {
    return isOepeMetric(row) || isZeroBestMetric(row);
  }

  function calculatePercentByMetric(row, targetRaw, currentRaw) {
    if (isTextMetric(row)) return "";

    const targetFilled = hasValue(targetRaw);
    const currentFilled = hasValue(currentRaw);

    if (!targetFilled || !currentFilled) {
      return "";
    }

    const target = toNumber(targetRaw);
    const current = toNumber(currentRaw);

    if (isZeroBestMetric(row)) {
      if (target === 0 && current === 0) return 100;
      if (target === 0 && current > 0) return 0;
      if (target > 0 && current === 0) return 100;
      if (current <= target) return 100;

      return (target / current) * 100;
    }

    if (isOepeMetric(row)) {
      if (target === 0 && current === 0) return 100;
      if (target === 0 && current > 0) return 0;
      if (target > 0 && current === 0) return 100;

      return (target / current) * 100;
    }

    if (isLowerBetterMetric(row)) {
      if (target === 0 && current === 0) return 100;
      if (target === 0 && current > 0) return 0;
      if (target > 0 && current === 0) return 100;

      return (target / current) * 100;
    }

    if (target === 0 && current === 0) {
      return "";
    }

    if (target === 0 && current > 0) {
      return "";
    }

    if (target > 0 && current === 0) {
      return 0;
    }

    return (current / target) * 100;
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

  function getRowInput(row, field) {
    return row.querySelector(`[data-field="${field}"]`);
  }

  function getGoalRow(planKey) {
    return document.querySelector(`[data-goal-plan-key="${planKey}"]`);
  }

  function calculateHourlySummaryFromRows(rows = []) {
    const summary = {
      sales: 0,
      gc: 0,
      avgCheck: 0,

      counterFact: 0,
      driveFact: 0,
      kioskFact: 0,
      deliveryFact: 0,

      cPercent: 0,
      dtPercent: 0,
      kiosksPercent: 0,
      dlvPercent: 0,
    };

    rows.forEach((row) => {
      const counterFact = toNumber(row.counterFact);
      const driveFact = toNumber(row.driveFact);
      const kioskFact = toNumber(row.kioskFact);
      const deliveryFact = toNumber(row.deliveryFact);

      let totalFact = toNumber(row.totalFact);

      if (!totalFact) {
        totalFact = counterFact + driveFact + kioskFact + deliveryFact;
      }

      summary.counterFact += counterFact;
      summary.driveFact += driveFact;
      summary.kioskFact += kioskFact;
      summary.deliveryFact += deliveryFact;

      summary.gc += totalFact;
      summary.sales += toNumber(row.salesFact);
    });

    if (summary.sales && summary.gc) {
      summary.avgCheck = summary.sales / summary.gc;
    }

    if (summary.gc) {
      summary.cPercent = (summary.counterFact / summary.gc) * 100;
      summary.dtPercent = (summary.driveFact / summary.gc) * 100;
      summary.kiosksPercent = (summary.kioskFact / summary.gc) * 100;
      summary.dlvPercent = (summary.deliveryFact / summary.gc) * 100;
    }

    return summary;
  }

  function getHourlyRowsFromDom() {
    const rows = [];

    document.querySelectorAll("[data-hourly-row-key]").forEach((row) => {
      rows.push({
        totalFact: getRowInput(row, "totalFact")?.value || "",
        counterFact: getRowInput(row, "counterFact")?.value || "",
        driveFact: getRowInput(row, "driveFact")?.value || "",
        kioskFact: getRowInput(row, "kioskFact")?.value || "",
        deliveryFact: getRowInput(row, "deliveryFact")?.value || "",
        salesFact: getRowInput(row, "salesFact")?.value || "",
      });
    });

    return rows;
  }

  function getHourlyRowsFromSavedData(savedData = {}) {
    return Object.values(savedData.rows || {});
  }

  function updateHourlySummaryCacheFromDom(context = {}) {
    const rows = getHourlyRowsFromDom();

    if (!rows.length) return null;

    const summary = calculateHourlySummaryFromRows(rows);
    const date = normalizeDate(getChecklistDate(context));

    window.ChecklistHourlySummaryCache = {
      date,
      summary,
      updatedAt: Date.now(),
    };

    window.dispatchEvent(
      new CustomEvent("checklist:hourly-summary-changed", {
        detail: {
          date,
          summary,
        },
      })
    );

    return summary;
  }

  async function loadHourlyDataFromSupabase(context = {}) {
    const supabase = getSupabaseClient(context);
    const restaurantId = getRestaurantId(context);
    const date = normalizeDate(getChecklistDate(context));

    if (!supabase || !restaurantId || !date) {
      return null;
    }

    const { data: session, error: sessionError } = await supabase
      .from("checklist_sessions")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("checklist_date", date)
      .maybeSingle();

    if (sessionError) {
      console.error("Ошибка загрузки checklist_sessions для goals sync:", sessionError);
      return null;
    }

    if (!session?.id) {
      return null;
    }

    const { data: tabResult, error: tabError } = await supabase
      .from("checklist_tab_results")
      .select("data")
      .eq("session_id", session.id)
      .eq("tab_key", "hourly")
      .maybeSingle();

    if (tabError) {
      console.error("Ошибка загрузки hourly tab data для goals sync:", tabError);
      return null;
    }

    return tabResult?.data || null;
  }

  async function getHourlySummary(context = {}) {
    const currentDate = normalizeDate(getChecklistDate(context));
    const cache = window.ChecklistHourlySummaryCache;

    if (cache?.summary && (!cache.date || cache.date === currentDate)) {
      return cache.summary;
    }

    const domSummary = updateHourlySummaryCacheFromDom(context);

    if (domSummary) {
      return domSummary;
    }

    const savedHourlyData = await loadHourlyDataFromSupabase(context);

    if (!savedHourlyData) {
      return null;
    }

    const rows = getHourlyRowsFromSavedData(savedHourlyData);
    const summary = calculateHourlySummaryFromRows(rows);

    window.ChecklistHourlySummaryCache = {
      date: currentDate,
      summary,
      updatedAt: Date.now(),
    };

    return summary;
  }

  function setInputValue(input, value) {
    if (!input) return false;

    const nextValue = String(value ?? "");

    if (input.value === nextValue) {
      return false;
    }

    input.value = nextValue;
    return true;
  }

  function setAutoCurrentValue(planKey, value) {
    const row = getGoalRow(planKey);
    if (!row) return false;

    const input = getRowInput(row, "current");
    if (!input) return false;

    input.readOnly = true;
    input.dataset.autoCurrentField = "true";
    input.title = "Автоматически из Почасовой";

    if (PERCENT_RESULT_KEYS.has(planKey)) {
      return setInputValue(input, formatPercent(value));
    }

    return setInputValue(input, formatInteger(value));
  }

  function makePercentColumnReadonly() {
    document.querySelectorAll("#goalsBody [data-field='percent']").forEach((input) => {
      const row = input.closest("[data-goal-metric-key]");

      if (row?.dataset.goalTextRow === "true") {
        input.readOnly = false;
        input.title = "Текстовое поле";
        return;
      }

      input.readOnly = true;
      input.title = "Автоматически: выполнение цели";
    });
  }

  function calculateGoalRowPercent(row) {
    const targetInput = getRowInput(row, "target");
    const currentInput = getRowInput(row, "current");
    const percentInput = getRowInput(row, "percent");

    if (!targetInput || !currentInput || !percentInput) return false;

    if (row.dataset.goalTextRow === "true") {
      return false;
    }

    const percent = calculatePercentByMetric(
      row,
      targetInput.value,
      currentInput.value
    );

    if (percent === "") {
      return setInputValue(percentInput, "");
    }

    return setInputValue(percentInput, formatPercent(percent));
  }

  function recalculateAllGoalPercents() {
    let changed = false;

    document.querySelectorAll("[data-goal-metric-key]").forEach((row) => {
      if (calculateGoalRowPercent(row)) {
        changed = true;
      }
    });

    makePercentColumnReadonly();

    return changed;
  }

  function applyHourlySummaryToGoals(summary) {
    if (!summary) return false;

    isApplyingGoalsValues = true;

    let changed = false;

    changed = setAutoCurrentValue("sales", summary.sales) || changed;
    changed = setAutoCurrentValue("gc", summary.gc) || changed;
    changed = setAutoCurrentValue("avg_check", summary.avgCheck) || changed;

    changed = setAutoCurrentValue("dt_percent", summary.dtPercent) || changed;
    changed = setAutoCurrentValue("kiosks_percent", summary.kiosksPercent) || changed;
    changed = setAutoCurrentValue("dlv_percent", summary.dlvPercent) || changed;
    changed = setAutoCurrentValue("c_percent", summary.cPercent) || changed;

    changed = recalculateAllGoalPercents() || changed;

    isApplyingGoalsValues = false;

    return changed;
  }

  function triggerGoalsAutosave() {
    const firstInput =
      document.querySelector("#goalsBody [data-field='current']") ||
      document.querySelector("#goalsBody [data-field='percent']");

    if (!firstInput) return;

    firstInput.dispatchEvent(
      new Event("input", {
        bubbles: true,
      })
    );
  }

  async function syncGoalsWithHourly(context = {}) {
    const currentToken = ++syncToken;

    const summary = await getHourlySummary(context);

    if (currentToken !== syncToken) return;

    const changed = applyHourlySummaryToGoals(summary);

    if (changed) {
      triggerGoalsAutosave();
    }
  }

  function bindGoalsPercentEvents() {
    if (window.__goalsHourlySyncEventsBound) return;
    window.__goalsHourlySyncEventsBound = true;

    document.addEventListener("input", (event) => {
      const input = event.target;

      if (
        !input.matches(
          "#goalsBody [data-field='target'], #goalsBody [data-field='current']"
        )
      ) {
        return;
      }

      if (isApplyingGoalsValues) return;

      const row = input.closest("[data-goal-metric-key]");
      if (!row) return;

      recalculateAllGoalPercents();
    });

    document.addEventListener("input", (event) => {
      const input = event.target;

      if (!input.matches("[data-hourly-row-key] [data-field]")) return;

      const field = input.dataset.field;

      if (
        field !== "counterFact" &&
        field !== "driveFact" &&
        field !== "kioskFact" &&
        field !== "deliveryFact" &&
        field !== "totalFact" &&
        field !== "salesFact"
      ) {
        return;
      }

      setTimeout(() => {
        updateHourlySummaryCacheFromDom();

        if (document.getElementById("goalsBody")) {
          const summary = window.ChecklistHourlySummaryCache?.summary;
          const changed = applyHourlySummaryToGoals(summary);

          if (changed) {
            triggerGoalsAutosave();
          }
        }
      }, 0);
    });

    window.addEventListener("checklist:hourly-summary-changed", (event) => {
      if (!document.getElementById("goalsBody")) return;

      const changed = applyHourlySummaryToGoals(event.detail?.summary);

      if (changed) {
        triggerGoalsAutosave();
      }
    });

    window.addEventListener("checklist:date-changed", () => {
      window.ChecklistHourlySummaryCache = null;
    });
  }

  function patchGoalsInit() {
    if (window.__goalsHourlySyncInitPatched) return;
    window.__goalsHourlySyncInitPatched = true;

    const originalInit = window.initChecklistGoalsTab;

    if (typeof originalInit !== "function") {
      return;
    }

    window.initChecklistGoalsTab = async function patchedInitChecklistGoalsTab(context = {}) {
      const result = await originalInit(context);

      await syncGoalsWithHourly(context);
      recalculateAllGoalPercents();

      return result;
    };
  }

  function patchGoalsSave() {
    if (window.__goalsHourlySyncSavePatched) return;
    window.__goalsHourlySyncSavePatched = true;

    const originalSave = window.saveChecklistGoalsTab;

    if (typeof originalSave !== "function") {
      return;
    }

    window.saveChecklistGoalsTab = function patchedSaveChecklistGoalsTab() {
      recalculateAllGoalPercents();
      return originalSave();
    };
  }

  function patchGoals() {
    bindGoalsPercentEvents();
    patchGoalsInit();
    patchGoalsSave();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", patchGoals);
  } else {
    patchGoals();
  }

  window.ChecklistGoalsHourlySync = {
    syncGoalsWithHourly,
    updateHourlySummaryCacheFromDom,
    recalculateAllGoalPercents,
  };
})();