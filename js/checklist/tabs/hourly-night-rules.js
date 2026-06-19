(function () {
  const NIGHT_RULES = {
    "00-01": ["counter", "drive", "kiosk", "delivery"],

    "01-02": ["drive", "delivery"],
    "02-03": ["drive", "delivery"],
    "03-04": ["drive", "delivery"],

    "04-05": [],

    "05-06": ["drive"],
    "06-07": ["drive"],
  };

  const CHANNELS = {
    counter: {
      planField: "counterPlan",
      factField: "counterFact",
      percentKey: "cPercent",
      title: "C / касса закрыта в это время",
    },
    drive: {
      planField: "drivePlan",
      factField: "driveFact",
      percentKey: "dtPercent",
      title: "Drive",
    },
    kiosk: {
      planField: "kioskPlan",
      factField: "kioskFact",
      percentKey: "kiosksPercent",
      title: "Киоски закрыты в это время",
    },
    delivery: {
      planField: "deliveryPlan",
      factField: "deliveryFact",
      percentKey: "dlvPercent",
      title: "Delivery",
    },
  };

  let applying = false;

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

    return String(Math.round(num));
  }

  function normalizeHour(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/[–—]/g, "-");
  }

  function getInput(row, field) {
    return row.querySelector(`[data-field="${field}"]`);
  }

  function getNightBlock() {
    return document.querySelector('[data-hourly-block="night"]');
  }

  function getGoalsPercents() {
    if (
      window.ChecklistGoals &&
      typeof window.ChecklistGoals.getPercentTargets === "function"
    ) {
      return window.ChecklistGoals.getPercentTargets();
    }

    return {
      dtPercent: 0,
      kiosksPercent: 0,
      dlvPercent: 0,
      cPercent: 0,
    };
  }

  function setValue(input, value) {
    if (!input) return false;

    const nextValue = String(value ?? "");

    if (input.value === nextValue) return false;

    input.value = nextValue;
    return true;
  }

  function setDisabled(input, disabled, title = "") {
    if (!input) return;

    input.readOnly = disabled;
    input.disabled = false;

    input.classList.toggle("hourly-disabled-by-rule", disabled);

    if (disabled) {
      input.title = title || "Не работает в это время";
      input.tabIndex = -1;
    } else {
      input.title = "";
      input.removeAttribute("tabindex");
    }
  }

  function getActiveChannelsForHour(hour) {
    return NIGHT_RULES[hour] || ["counter", "drive", "kiosk", "delivery"];
  }

  function calculateChannelPlan(totalGc, activeChannels, channelKey, percents) {
    if (!activeChannels.includes(channelKey)) return "";

    if (!totalGc) return "";

    if (activeChannels.length === 1) {
      return totalGc;
    }

    const activePercentSum = activeChannels.reduce((sum, key) => {
      const config = CHANNELS[key];
      return sum + toNumber(percents[config.percentKey]);
    }, 0);

    if (!activePercentSum) return "";

    const channelPercent = toNumber(percents[CHANNELS[channelKey].percentKey]);

    return (totalGc * channelPercent) / activePercentSum;
  }

  function applyNightRulesToRow(row, percents) {
    const hour = normalizeHour(
      row.querySelector(".hourly-time-cell")?.textContent || ""
    );

    const activeChannels = getActiveChannelsForHour(hour);
    const totalGc = toNumber(getInput(row, "totalPlan")?.value || "");

    let changed = false;

    Object.entries(CHANNELS).forEach(([channelKey, config]) => {
      const isActive = activeChannels.includes(channelKey);

      const planInput = getInput(row, config.planField);
      const factInput = getInput(row, config.factField);

      if (!isActive) {
        changed = setValue(planInput, "") || changed;
        changed = setValue(factInput, "") || changed;

        setDisabled(planInput, true, config.title);
        setDisabled(factInput, true, config.title);

        return;
      }

      setDisabled(planInput, true, "План автоматически рассчитан");
      setDisabled(factInput, false);

      const planValue = calculateChannelPlan(
        totalGc,
        activeChannels,
        channelKey,
        percents
      );

      changed = setValue(planInput, planValue === "" ? "" : formatNumber(planValue)) || changed;
    });

    if (activeChannels.length === 0) {
      [
        "totalFact",
        "sandwichFact",
        "salesFact",
        "avgCheck",
        "gcpch",
        "oepe",
      ].forEach((field) => {
        const input = getInput(row, field);
        changed = setValue(input, "") || changed;
        setDisabled(input, true, "Ресторан закрыт в это время");
      });
    } else {
      [
        "sandwichFact",
        "salesFact",
        "gcpch",
        "oepe",
      ].forEach((field) => {
        const input = getInput(row, field);
        setDisabled(input, false);
      });
    }

    return changed;
  }

  function hideNightPriorityRows() {
    const nightBlock = getNightBlock();
    if (!nightBlock) return;

    const statusTitle = nightBlock.querySelector(".hourly-status-title");
    if (statusTitle) statusTitle.remove();

    nightBlock.querySelectorAll(".hourly-priority-row").forEach((row) => {
      row.remove();
    });
  }

  function triggerRecalculate() {
    if (
      window.ChecklistHourlyCalculations &&
      typeof window.ChecklistHourlyCalculations.recalculateAll === "function"
    ) {
      window.ChecklistHourlyCalculations.recalculateAll();
    }
  }

  function triggerAutosave() {
    const firstInput =
      getNightBlock()?.querySelector("[data-field]") ||
      document.querySelector("[data-field]");

    if (!firstInput) return;

    firstInput.dispatchEvent(
      new Event("input", {
        bubbles: true,
      })
    );
  }

  function applyNightRules() {
    if (applying) return;

    applying = true;

    const nightBlock = getNightBlock();
    if (!nightBlock) {
      applying = false;
      return;
    }

    hideNightPriorityRows();

    const percents = getGoalsPercents();
    let changed = false;

    nightBlock.querySelectorAll("[data-hourly-row-key]").forEach((row) => {
      changed = applyNightRulesToRow(row, percents) || changed;
    });

    triggerRecalculate();

    if (changed) {
      triggerAutosave();
    }

    applying = false;
  }

  function patchHourlyInit() {
    if (window.__hourlyNightRulesInitPatched) return;
    window.__hourlyNightRulesInitPatched = true;

    const originalInit = window.initChecklistHourlyTab;

    if (typeof originalInit !== "function") return;

    window.initChecklistHourlyTab = async function patchedHourlyInit(context = {}) {
      const result = await originalInit(context);

      setTimeout(applyNightRules, 100);
      setTimeout(applyNightRules, 500);
      setTimeout(applyNightRules, 1000);

      return result;
    };
  }

  function bindEvents() {
    if (window.__hourlyNightRulesEventsBound) return;
    window.__hourlyNightRulesEventsBound = true;

    window.addEventListener("checklist:goals-percent-changed", () => {
      setTimeout(applyNightRules, 0);
    });

    window.addEventListener("checklist:date-changed", () => {
      setTimeout(applyNightRules, 500);
    });

    document.addEventListener("input", (event) => {
      const input = event.target;

      if (!input.matches('[data-hourly-block="night"] [data-field]')) return;
      if (input.classList.contains("hourly-disabled-by-rule")) return;

      setTimeout(applyNightRules, 0);
    });
  }

  function init() {
    patchHourlyInit();
    bindEvents();
    setTimeout(applyNightRules, 300);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.ChecklistHourlyNightRules = {
    applyNightRules,
  };
})();