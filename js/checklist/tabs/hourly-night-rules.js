(function () {
  const HOURS = [
    "00-01",
    "01-02",
    "02-03",
    "03-04",
    "04-05",
    "05-06",
    "06-07",
    "07-08",
    "08-09",
    "09-10",
    "10-11",
    "11-12",
    "12-13",
    "13-14",
    "14-15",
    "15-16",
    "16-17",
    "17-18",
    "18-19",
    "19-20",
    "20-21",
    "21-22",
    "22-23",
    "23-00",
  ];

  const DEFAULT_CHANNEL_WORK_HOURS = {
    drive: [
      "05-06",
      "06-07",
      "07-08",
      "08-09",
      "09-10",
      "10-11",
      "11-12",
      "12-13",
      "13-14",
      "14-15",
      "15-16",
      "16-17",
      "17-18",
      "18-19",
      "19-20",
      "20-21",
      "21-22",
      "22-23",
      "23-00",
      "00-01",
      "01-02",
      "02-03",
      "03-04",
    ],

    delivery: [
      "07-08",
      "08-09",
      "09-10",
      "10-11",
      "11-12",
      "12-13",
      "13-14",
      "14-15",
      "15-16",
      "16-17",
      "17-18",
      "18-19",
      "19-20",
      "20-21",
      "21-22",
      "22-23",
      "23-00",
      "00-01",
      "01-02",
      "02-03",
      "03-04",
    ],

    kiosk: [
      "07-08",
      "08-09",
      "09-10",
      "10-11",
      "11-12",
      "12-13",
      "13-14",
      "14-15",
      "15-16",
      "16-17",
      "17-18",
      "18-19",
      "19-20",
      "20-21",
      "21-22",
      "22-23",
      "23-00",
    ],

    counter: [
      "07-08",
      "08-09",
      "09-10",
      "10-11",
      "11-12",
      "12-13",
      "13-14",
      "14-15",
      "15-16",
      "16-17",
      "17-18",
      "18-19",
      "19-20",
      "20-21",
      "21-22",
      "22-23",
      "23-00",
      "00-01",
    ],
  };

  const CHANNELS = {
    counter: {
      planField: "counterPlan",
      factField: "counterFact",
      percentKey: "cPercent",
      title: "C / касса не работает в это время",
    },
    drive: {
      planField: "drivePlan",
      factField: "driveFact",
      percentKey: "dtPercent",
      title: "Drive не работает в это время",
    },
    kiosk: {
      planField: "kioskPlan",
      factField: "kioskFact",
      percentKey: "kiosksPercent",
      title: "Киоски не работают в это время",
    },
    delivery: {
      planField: "deliveryPlan",
      factField: "deliveryFact",
      percentKey: "dlvPercent",
      title: "Delivery не работает в это время",
    },
  };

  const AUTO_READONLY_FIELDS = new Set([
    "totalPlan",
    "totalFact",
    "sandwichPlan",
    "salesPlan",
    "avgCheck",
  ]);

  const EDITABLE_FIELDS_WHEN_OPEN = new Set([
    "sandwichFact",
    "salesFact",
    "gcpch",
    "oepe",
  ]);

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

  function getRestaurantId() {
    return (
      window.currentRestaurantId ||
      window.restaurantId ||
      window.APP_RESTAURANT_ID ||
      localStorage.getItem("restaurant_id") ||
      localStorage.getItem("restaurantId") ||
      ""
    );
  }

  function getScopedLocalStorageKey() {
    const restaurantId = getRestaurantId();
    return restaurantId ? `channel_work_hours_${restaurantId}` : "";
  }

  function cloneDefaultChannelWorkHours() {
    return JSON.parse(JSON.stringify(DEFAULT_CHANNEL_WORK_HOURS));
  }

  function normalizeChannelWorkHours(value = {}) {
    const source = value && typeof value === "object" ? value : {};

    return {
      counter: Array.isArray(source.counter)
        ? source.counter.filter((hour) => HOURS.includes(hour))
        : [...DEFAULT_CHANNEL_WORK_HOURS.counter],
      drive: Array.isArray(source.drive)
        ? source.drive.filter((hour) => HOURS.includes(hour))
        : [...DEFAULT_CHANNEL_WORK_HOURS.drive],
      kiosk: Array.isArray(source.kiosk)
        ? source.kiosk.filter((hour) => HOURS.includes(hour))
        : [...DEFAULT_CHANNEL_WORK_HOURS.kiosk],
      delivery: Array.isArray(source.delivery)
        ? source.delivery.filter((hour) => HOURS.includes(hour))
        : [...DEFAULT_CHANNEL_WORK_HOURS.delivery],
    };
  }

  function getChannelWorkHours() {
    try {
      const scopedKey = getScopedLocalStorageKey();
      const scopedSaved = scopedKey ? localStorage.getItem(scopedKey) : "";
      const commonSaved = localStorage.getItem("channel_work_hours");
      const saved = scopedSaved || commonSaved;

      if (!saved) {
        return cloneDefaultChannelWorkHours();
      }

      return normalizeChannelWorkHours(JSON.parse(saved));
    } catch (error) {
      console.warn("Ошибка чтения channel_work_hours:", error);
      return cloneDefaultChannelWorkHours();
    }
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

  function rememberValueBeforeRule(input) {
    if (!input) return;

    if (input.dataset.ruleHasOriginal === "true") return;

    input.dataset.ruleHasOriginal = "true";
    input.dataset.ruleOriginalValue = input.value || "";
  }

  function restoreValueAfterRule(input) {
    if (!input) return;

    if (input.dataset.ruleHasOriginal !== "true") return;

    if (!input.value) {
      input.value = input.dataset.ruleOriginalValue || "";
    }

    delete input.dataset.ruleHasOriginal;
    delete input.dataset.ruleOriginalValue;
  }

  function disableCell(input, title = "") {
    if (!input) return;

    rememberValueBeforeRule(input);

    input.disabled = false;
    input.readOnly = true;
    input.classList.add("hourly-disabled-by-rule");
    input.value = "";
    input.placeholder = "N/A";
    input.title = title || "Не работает в это время";
    input.tabIndex = -1;
  }

  function enableCell(input, options = {}) {
    if (!input) return;

    const readOnly = Boolean(options.readOnly);
    const title = options.title || "";

    input.disabled = false;
    input.readOnly = readOnly;
    input.classList.remove("hourly-disabled-by-rule");
    input.placeholder = "";
    input.title = title;
    input.removeAttribute("tabindex");

    restoreValueAfterRule(input);
  }

  function isChannelActive(channelKey, hour, settings) {
    return settings[channelKey]?.includes(hour);
  }

  function getActiveChannelsForHour(hour, settings) {
    return Object.keys(CHANNELS).filter((channelKey) =>
      isChannelActive(channelKey, hour, settings)
    );
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

    if (!activePercentSum) {
      return totalGc / activeChannels.length;
    }

    const channelPercent = toNumber(percents[CHANNELS[channelKey].percentKey]);

    if (!channelPercent) {
      return 0;
    }

    return (totalGc * channelPercent) / activePercentSum;
  }

  function setWholeRowClosed(row, isClosed) {
    row.classList.toggle("hourly-row-closed", isClosed);

    [
      "totalPlan",
      "totalFact",
      "sandwichPlan",
      "sandwichFact",
      "salesPlan",
      "salesFact",
      "avgCheck",
      "gcpch",
      "oepe",
    ].forEach((field) => {
      const input = getInput(row, field);

      if (!input) return;

      if (isClosed) {
        disableCell(input, "Ресторан закрыт в это время");
        return;
      }

      if (AUTO_READONLY_FIELDS.has(field)) {
        enableCell(input, {
          readOnly: true,
          title: "Автоматически рассчитывается",
        });
        return;
      }

      if (EDITABLE_FIELDS_WHEN_OPEN.has(field)) {
        enableCell(input, {
          readOnly: false,
        });
      }
    });
  }

  function applyChannelHoursToRow(row, settings, percents) {
    const hour = normalizeHour(
      row.querySelector(".hourly-time-cell")?.textContent || ""
    );

    const activeChannels = getActiveChannelsForHour(hour, settings);
    const isClosed = activeChannels.length === 0;
    const totalGc = toNumber(getInput(row, "totalPlan")?.value || "");

    setWholeRowClosed(row, isClosed);

    Object.entries(CHANNELS).forEach(([channelKey, config]) => {
      const isActive = activeChannels.includes(channelKey);

      const planInput = getInput(row, config.planField);
      const factInput = getInput(row, config.factField);

      if (!isActive) {
        disableCell(planInput, config.title);
        disableCell(factInput, config.title);
        return;
      }

      enableCell(planInput, {
        readOnly: true,
        title: "План автоматически рассчитан",
      });

      enableCell(factInput, {
        readOnly: false,
      });

      const planValue = calculateChannelPlan(
        totalGc,
        activeChannels,
        channelKey,
        percents
      );

      setValue(planInput, planValue === "" ? "" : formatNumber(planValue));
    });
  }

  function hideNightPriorityRows() {
    const nightBlock = document.querySelector('[data-hourly-block="night"]');

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

  function applyChannelHours() {
    if (applying) return;

    applying = true;

    const settings = getChannelWorkHours();
    const percents = getGoalsPercents();

    hideNightPriorityRows();

    document.querySelectorAll("[data-hourly-row-key]").forEach((row) => {
      applyChannelHoursToRow(row, settings, percents);
    });

    triggerRecalculate();

    applying = false;
  }

  function patchHourlyInit() {
    if (window.__hourlyChannelHoursInitPatched) return;
    window.__hourlyChannelHoursInitPatched = true;

    const originalInit = window.initChecklistHourlyTab;

    if (typeof originalInit !== "function") return;

    window.initChecklistHourlyTab = async function patchedHourlyInit(context = {}) {
      const result = await originalInit(context);

      setTimeout(applyChannelHours, 100);
      setTimeout(applyChannelHours, 500);
      setTimeout(applyChannelHours, 1000);

      return result;
    };
  }

  function bindEvents() {
    if (window.__hourlyChannelHoursEventsBound) return;
    window.__hourlyChannelHoursEventsBound = true;

    window.addEventListener("checklist:goals-percent-changed", () => {
      setTimeout(applyChannelHours, 0);
    });

    window.addEventListener("checklist:date-changed", () => {
      setTimeout(applyChannelHours, 500);
    });

    window.addEventListener("checklist:channel-hours-changed", () => {
      setTimeout(applyChannelHours, 0);
    });

    document.addEventListener("input", (event) => {
      const input = event.target;

      if (!input.matches("[data-hourly-row-key] [data-field]")) return;
      if (input.classList.contains("hourly-disabled-by-rule")) return;

      setTimeout(applyChannelHours, 0);
    });
  }

  function init() {
    patchHourlyInit();
    bindEvents();
    setTimeout(applyChannelHours, 300);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.ChecklistHourlyChannelHours = {
    HOURS,
    DEFAULT_CHANNEL_WORK_HOURS,
    getChannelWorkHours,
    applyChannelHours,
  };

  window.ChecklistHourlyNightRules = {
    applyNightRules: applyChannelHours,
  };
})();