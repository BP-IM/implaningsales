(function () {
  let syncToken = 0;

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

  function getPreviousDate(date) {
    const normalized = normalizeDate(date);
    if (!normalized) return "";

    const current = new Date(`${normalized}T00:00:00`);
    current.setDate(current.getDate() - 1);

    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
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

  function setPreviousStatus(text, type = "default") {
    const table = document.getElementById("goalsTable");
    if (!table) return;

    let status = document.getElementById("goalsPreviousDayStatus");

    if (!status) {
      table.insertAdjacentHTML(
        "beforebegin",
        `
          <div class="goals-previous-sync" id="goalsPreviousDayStatus" data-status="${type}">
            ${text}
          </div>
        `
      );

      return;
    }

    status.textContent = text;
    status.dataset.status = type;
  }

  function makePreviousColumnReadonly() {
    document.querySelectorAll("#goalsBody [data-field='previous']").forEach((input) => {
      input.readOnly = true;
      input.title = "Автоматически из результата предыдущего дня";
    });
  }

  function clearPreviousColumn() {
    document.querySelectorAll("[data-goal-metric-key]").forEach((row) => {
      const input = getRowInput(row, "previous");
      if (!input) return;

      input.value = "";
      input.dataset.previousDayLoaded = "false";
    });

    makePreviousColumnReadonly();
  }

  async function loadPreviousGoalsData(context = {}) {
    const supabase = getSupabaseClient(context);
    const restaurantId = getRestaurantId(context);
    const currentDate = normalizeDate(getChecklistDate(context));
    const previousDate = getPreviousDate(currentDate);

    if (!supabase || !restaurantId || !currentDate || !previousDate) {
      return {
        previousDate,
        data: null,
        reason: "missing_context",
      };
    }

    const { data: session, error: sessionError } = await supabase
      .from("checklist_sessions")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("checklist_date", previousDate)
      .maybeSingle();

    if (sessionError) {
      console.error("Ошибка загрузки previous checklist session:", sessionError);
      return {
        previousDate,
        data: null,
        reason: "session_error",
      };
    }

    if (!session?.id) {
      return {
        previousDate,
        data: null,
        reason: "no_previous_session",
      };
    }

    const { data: tabResult, error: tabError } = await supabase
      .from("checklist_tab_results")
      .select("data")
      .eq("session_id", session.id)
      .eq("tab_key", "goals")
      .maybeSingle();

    if (tabError) {
      console.error("Ошибка загрузки previous goals data:", tabError);
      return {
        previousDate,
        data: null,
        reason: "tab_error",
      };
    }

    return {
      previousDate,
      data: tabResult?.data || null,
      reason: tabResult?.data ? "ok" : "no_previous_goals",
    };
  }

  function applyPreviousGoalsData(previousData) {
    clearPreviousColumn();

    const metrics = previousData?.metrics || {};
    let appliedCount = 0;

    document.querySelectorAll("[data-goal-metric-key]").forEach((row) => {
      const key = row.dataset.goalMetricKey;
      const previousMetric = metrics[key];

      if (!previousMetric) return;

      const currentValue = previousMetric.current || "";
      const input = getRowInput(row, "previous");

      if (!input) return;

      input.value = currentValue;
      input.dataset.previousDayLoaded = "true";

      if (String(currentValue).trim() !== "") {
        appliedCount += 1;
      }
    });

    makePreviousColumnReadonly();

    return appliedCount;
  }

  function triggerGoalsAutosave() {
    const firstInput =
      document.querySelector("#goalsBody [data-field='previous']") ||
      document.querySelector("#goalsBody [data-field='current']");

    if (!firstInput) return;

    firstInput.dispatchEvent(
      new Event("input", {
        bubbles: true,
      })
    );
  }

  async function syncPreviousDayGoals(context = {}) {
    const currentToken = ++syncToken;

    clearPreviousColumn();

    const result = await loadPreviousGoalsData(context);

    if (currentToken !== syncToken) return;

    if (!result.data) {
      setPreviousStatus(
        `Предыдущий день: данных за ${result.previousDate || "прошлый день"} нет`,
        "empty"
      );
      return;
    }

    const appliedCount = applyPreviousGoalsData(result.data);

    setPreviousStatus(
      `Предыдущий день: загружено ${appliedCount} результатов за ${result.previousDate}`,
      "success"
    );

    triggerGoalsAutosave();

    if (
      window.ChecklistGoalsHourlySync &&
      typeof window.ChecklistGoalsHourlySync.recalculateAllGoalPercents === "function"
    ) {
      window.ChecklistGoalsHourlySync.recalculateAllGoalPercents();
    }
  }

  function patchGoalsInit() {
    if (window.__goalsPreviousDayInitPatched) return;
    window.__goalsPreviousDayInitPatched = true;

    const originalInit = window.initChecklistGoalsTab;

    if (typeof originalInit !== "function") {
      return;
    }

    window.initChecklistGoalsTab = async function patchedInitChecklistGoalsTab(context = {}) {
      const result = await originalInit(context);

      await syncPreviousDayGoals(context);

      return result;
    };
  }

  function bindDateChange() {
    if (window.__goalsPreviousDayDateChangeBound) return;
    window.__goalsPreviousDayDateChangeBound = true;

    window.addEventListener("checklist:date-changed", (event) => {
      const nextDate =
        event.detail?.date ||
        event.detail?.checklistDate ||
        event.detail?.checklist_date ||
        "";

      if (!nextDate) return;

      setTimeout(() => {
        syncPreviousDayGoals({
          date: nextDate,
          checklistDate: nextDate,
        });
      }, 300);
    });
  }

  function init() {
    patchGoalsInit();
    bindDateChange();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.ChecklistGoalsPreviousDaySync = {
    syncPreviousDayGoals,
  };
})();