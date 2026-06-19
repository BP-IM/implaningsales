(function () {
  const CHANNEL_FACT_FIELDS = [
    "counterFact",
    "driveFact",
    "kioskFact",
    "deliveryFact",
  ];

  const SUM_TOTAL_FIELDS = [
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

  const EDITABLE_TOTAL_FIELDS = new Set([
    "gcpch",
  ]);

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

  function getRowInput(row, field) {
    return row.querySelector(`[data-field="${field}"]`);
  }

  function getTotalInput(block, field) {
    return block.querySelector(`[data-total-field="${field}"]`);
  }

  function makeReadonlyCalculatedFields() {
    document.querySelectorAll("[data-hourly-row-key]").forEach((row) => {
      const totalFactInput = getRowInput(row, "totalFact");
      const avgCheckInput = getRowInput(row, "avgCheck");

      if (totalFactInput) {
        totalFactInput.readOnly = true;
        totalFactInput.title = "Автоматически: C + Drive + Киоски + Delivery";
      }

      if (avgCheckInput) {
        avgCheckInput.readOnly = true;
        avgCheckInput.title = "Автоматически: Sales факт / Общее факт";
      }
    });

    document.querySelectorAll("[data-total-field]").forEach((input) => {
      const field = input.dataset.totalField;

      if (EDITABLE_TOTAL_FIELDS.has(field)) {
        input.readOnly = false;
        input.title = "Заполняется вручную";
        return;
      }

      input.readOnly = true;
    });
  }

  function calculateRowFacts(row) {
    let totalFact = 0;
    let hasChannelFact = false;

    CHANNEL_FACT_FIELDS.forEach((field) => {
      const input = getRowInput(row, field);
      const rawValue = input?.value || "";

      if (String(rawValue).trim() !== "") {
        hasChannelFact = true;
      }

      totalFact += toNumber(rawValue);
    });

    const totalFactInput = getRowInput(row, "totalFact");

    if (totalFactInput) {
      totalFactInput.value = hasChannelFact ? formatNumber(totalFact) : "";
    }

    const salesFact = toNumber(getRowInput(row, "salesFact")?.value || "");
    const avgCheckInput = getRowInput(row, "avgCheck");

    if (avgCheckInput) {
      if (salesFact && totalFact) {
        avgCheckInput.value = formatNumber(salesFact / totalFact);
      } else {
        avgCheckInput.value = "";
      }
    }
  }

  function calculateBlockTotals(block) {
    SUM_TOTAL_FIELDS.forEach((field) => {
      let sum = 0;
      let hasValue = false;

      block.querySelectorAll(`[data-hourly-row-key] [data-field="${field}"]`).forEach((input) => {
        const rawValue = input.value || "";

        if (String(rawValue).trim() === "") return;

        sum += toNumber(rawValue);
        hasValue = true;
      });

      const totalInput = getTotalInput(block, field);

      if (totalInput) {
        totalInput.value = hasValue ? formatNumber(sum) : "";
      }
    });

    calculateAvgCheckTotal(block);
    calculateOepeTotal(block);

    // GCPCH итог НЕ очищаем и НЕ считаем.
    // Он заполняется вручную.
  }

  function calculateAvgCheckTotal(block) {
    const salesTotal = toNumber(getTotalInput(block, "salesFact")?.value || "");
    const gcTotal = toNumber(getTotalInput(block, "totalFact")?.value || "");
    const avgTotalInput = getTotalInput(block, "avgCheck");

    if (!avgTotalInput) return;

    if (salesTotal && gcTotal) {
      avgTotalInput.value = formatNumber(salesTotal / gcTotal);
    } else {
      avgTotalInput.value = "";
    }
  }

  function calculateOepeTotal(block) {
    const oepeTotalInput = getTotalInput(block, "oepe");
    if (!oepeTotalInput) return;

    let lastValue = "";

    block.querySelectorAll(`[data-hourly-row-key] [data-field="oepe"]`).forEach((input) => {
      const value = String(input.value || "").trim();

      if (value !== "") {
        lastValue = value;
      }
    });

    oepeTotalInput.value = lastValue;
  }

  function restoreEditableTotals(savedData = {}) {
    document.querySelectorAll(".hourly-block").forEach((block) => {
      const blockKey = block.dataset.hourlyBlock;
      if (!blockKey) return;

      const savedBlockTotals = savedData?.totals?.[blockKey] || {};

      EDITABLE_TOTAL_FIELDS.forEach((field) => {
        const input = getTotalInput(block, field);
        if (!input) return;

        input.value = savedBlockTotals[field] || "";
      });
    });
  }

  function recalculateAll() {
    document.querySelectorAll("[data-hourly-row-key]").forEach((row) => {
      calculateRowFacts(row);
    });

    document.querySelectorAll(".hourly-block").forEach((block) => {
      calculateBlockTotals(block);
    });

    makeReadonlyCalculatedFields();
  }

  function shouldRecalculateByField(field) {
    return [
      "counterFact",
      "driveFact",
      "kioskFact",
      "deliveryFact",
      "sandwichFact",
      "salesFact",
      "gcpch",
      "oepe",
    ].includes(field);
  }

  function bindEvents() {
    if (window.__hourlyCalculationsBound) return;
    window.__hourlyCalculationsBound = true;

    document.addEventListener("input", (event) => {
      const input = event.target;

      if (!input.matches("[data-field]")) return;

      const field = input.dataset.field;

      if (!shouldRecalculateByField(field)) return;

      recalculateAll();
    });

    window.addEventListener("checklist:date-changed", () => {
      setTimeout(recalculateAll, 100);
    });
  }

  function patchHourlyInit() {
    if (window.__hourlyCalculationsInitPatched) return;
    window.__hourlyCalculationsInitPatched = true;

    const originalInit = window.initChecklistHourlyTab;

    if (typeof originalInit !== "function") {
      return;
    }

    window.initChecklistHourlyTab = async function patchedInitChecklistHourlyTab(context = {}) {
      const result = await originalInit(context);

      setTimeout(() => {
        recalculateAll();
        restoreEditableTotals(context.data || {});
      }, 100);

      setTimeout(() => {
        recalculateAll();
        restoreEditableTotals(context.data || {});
      }, 500);

      return result;
    };
  }

  function patchHourlySave() {
    if (window.__hourlyCalculationsSavePatched) return;
    window.__hourlyCalculationsSavePatched = true;

    const originalSave = window.saveChecklistHourlyTab;

    if (typeof originalSave !== "function") {
      return;
    }

    window.saveChecklistHourlyTab = function patchedSaveChecklistHourlyTab() {
      const result = originalSave();

      result.totals = result.totals || {};

      document.querySelectorAll(".hourly-block").forEach((block) => {
        const blockKey = block.dataset.hourlyBlock;
        if (!blockKey) return;

        result.totals[blockKey] = result.totals[blockKey] || {};

        EDITABLE_TOTAL_FIELDS.forEach((field) => {
          const input = getTotalInput(block, field);
          result.totals[blockKey][field] = input?.value || "";
        });
      });

      return result;
    };
  }

  function patchHourly() {
    patchHourlyInit();
    patchHourlySave();
  }

  bindEvents();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", patchHourly);
  } else {
    patchHourly();
  }

  window.ChecklistHourlyCalculations = {
    recalculateAll,
    restoreEditableTotals,
  };
})();