function initDashboardView() {
  const db = window.db;

  const restaurantName = localStorage.getItem("restaurant_name") || "Ресторан";
  const restaurantId = localStorage.getItem("restaurant_id");

  const restaurantNameEl = document.getElementById("dashboardRestaurantName");
  const restaurantIdEl = document.getElementById("dashboardRestaurantId");
  const dateInput = document.getElementById("dashboardDateInput");

  const statusEl = document.getElementById("dashboardPlanStatus");

  const planToEl = document.getElementById("todayPlanTo");
  const planGcEl = document.getElementById("todayPlanGc");
  const avgCheckEl = document.getElementById("todayAvgCheck");

  const hourlyEmpty = document.getElementById("dashboardHourlyEmpty");
  const hourlyTableWrap = document.getElementById("dashboardHourlyTableWrap");
  const hourlyBody = document.getElementById("dashboardHourlyBody");
  const hourlyTable = document.getElementById("dashboardHourlyTable");

  const selectedActions = document.getElementById("selectedActions");
  const clearSelectionBtn = document.getElementById("clearSelectionBtn");

  let currentHourlyPlans = [];
  let vlhRules = [];
  let autoCopyTimer = null;

  let selection = {
    active: false,
    column: null,
    startIndex: null,
    endIndex: null
  };

  if (!dateInput) return;

  if (restaurantNameEl) restaurantNameEl.textContent = restaurantName;
  if (restaurantIdEl) restaurantIdEl.textContent = restaurantId || "-";

  function formatNumber(value) {
    return Math.round(Number(value) || 0).toLocaleString("ru-RU");
  }

  async function loadVlhRules() {
    if (!restaurantId) {
      vlhRules = [];
      return;
    }

    const { data, error } = await db
      .from("vlh_rules")
      .select("gc_threshold, workers_count")
      .eq("restaurant_id", restaurantId)
      .order("gc_threshold", { ascending: true });

    if (error) {
      console.error("Ошибка загрузки VLH:", error);
      vlhRules = [];
      return;
    }

    vlhRules = (data || [])
      .map((rule) => ({
        gc_threshold: Math.round(Number(rule.gc_threshold) || 0),
        workers_count: Math.round(Number(rule.workers_count) || 0)
      }))
      .filter((rule) => rule.gc_threshold > 0 && rule.workers_count > 0)
      .sort((a, b) => a.gc_threshold - b.gc_threshold);
  }

  function getWorkersCountByGc(gcValue) {
  const gc = Math.round(Number(gcValue) || 0);

  if (!vlhRules.length || gc <= 0) {
    return 0;
  }

  const sortedRules = [...vlhRules].sort((a, b) => a.gc_threshold - b.gc_threshold);
  const firstRule = sortedRules[0];

  // Егер GC 0 емес, бірақ ең бірінші порогтан төмен болса:
  // мысалы GC = 1–5, ал бірінші порог = 6 → бәрібір 1 работник көрсетеміз.
  if (gc < firstRule.gc_threshold) {
    return firstRule.workers_count;
  }

  let workers = 0;

  sortedRules.forEach((rule) => {
    if (gc >= rule.gc_threshold) {
      workers = rule.workers_count;
    }
  });

  return workers;
}

  function getTodayInputDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function setStatus(text, type = "") {
    if (!statusEl) return;

    statusEl.textContent = text;
    statusEl.className = type;
  }

  function showCopyToast(text) {
    let toast = document.querySelector(".copy-toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.className = "copy-toast";
      document.body.appendChild(toast);
    }

    toast.textContent = text;
    toast.classList.add("show");

    setTimeout(() => {
      toast.classList.remove("show");
    }, 1800);
  }

  function clearSelectedCells() {
    document.querySelectorAll("#dashboardHourlyTable .selectable-cell.selected").forEach((cell) => {
      cell.classList.remove("selected");
      cell.classList.remove("copy-selected");
    });

    selection = {
      active: false,
      column: null,
      startIndex: null,
      endIndex: null
    };

    if (hourlyTable) {
      hourlyTable.classList.remove("is-selecting");
    }

    if (selectedActions) {
      selectedActions.style.display = "flex";
    }
  }

  function clearDashboard() {
    if (planToEl) planToEl.textContent = "0";
    if (planGcEl) planGcEl.textContent = "0";
    if (avgCheckEl) avgCheckEl.textContent = "0";

    if (hourlyBody) hourlyBody.innerHTML = "";
    if (hourlyEmpty) hourlyEmpty.style.display = "block";
    if (hourlyTableWrap) hourlyTableWrap.style.display = "none";

    currentHourlyPlans = [];
    clearSelectedCells();
  }

  function getSelectedCells() {
    return Array.from(document.querySelectorAll("#dashboardHourlyTable .selectable-cell.selected"))
      .sort((a, b) => {
        const rowDiff = Number(a.dataset.rowIndex) - Number(b.dataset.rowIndex);

        if (rowDiff !== 0) return rowDiff;

        return Number(a.cellIndex) - Number(b.cellIndex);
      });
  }

  function updateSelectedCells() {
    document.querySelectorAll("#dashboardHourlyTable .selectable-cell.selected").forEach((cell) => {
      cell.classList.remove("selected");
      cell.classList.remove("copy-selected");
    });

    if (
      selection.column === null ||
      selection.startIndex === null ||
      selection.endIndex === null
    ) {
      return;
    }

    const start = Math.min(selection.startIndex, selection.endIndex);
    const end = Math.max(selection.startIndex, selection.endIndex);

    const cells = document.querySelectorAll(
      `#dashboardHourlyTable .selectable-cell[data-column="${selection.column}"]`
    );

    cells.forEach((cell) => {
      const index = Number(cell.dataset.rowIndex);

      if (index >= start && index <= end) {
        cell.classList.add("selected");
        cell.classList.add("copy-selected");
      }
    });

    if (selectedActions) {
      selectedActions.style.display = "flex";
    }
  }

  function startCellSelection(cell) {
    const column = cell.dataset.column;
    const rowIndex = Number(cell.dataset.rowIndex);

    selection = {
      active: true,
      column,
      startIndex: rowIndex,
      endIndex: rowIndex
    };

    if (hourlyTable) {
      hourlyTable.classList.add("is-selecting");
    }

    updateSelectedCells();
  }

  function moveCellSelection(cell) {
    if (!selection.active) return;

    const column = cell.dataset.column;

    if (column !== selection.column) return;

    selection.endIndex = Number(cell.dataset.rowIndex);

    updateSelectedCells();
  }

  function stopCellSelection() {
    const wasSelecting = selection.active;

    selection.active = false;

    if (hourlyTable) {
      hourlyTable.classList.remove("is-selecting");
    }

    const selectedCells = getSelectedCells();

    if (!wasSelecting || !selectedCells.length) return;

    clearTimeout(autoCopyTimer);

    autoCopyTimer = setTimeout(() => {
      copySelectedCells();
    }, 80);
  }

  function buildSelectedText() {
    const selectedCells = getSelectedCells();

    return selectedCells
      .map((cell) => cell.dataset.copyValue || cell.textContent.trim())
      .join("\n");
  }

  function getSelectedColumnLabel() {
    const selectedCells = getSelectedCells();

    if (!selectedCells.length) return "Столбец";

    const column = selectedCells[0].dataset.column;

    const labels = {
      hour: "Час",
      plan_to: "ТО",
      plan_gc: "GC",
      plan_avg_check: "Ср. чек",
      workers_count: "Работники"
    };

    return labels[column] || "Столбец";
  }

  function fallbackCopyText(text) {
    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const success = document.execCommand("copy");

    document.body.removeChild(textarea);

    return success;
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    return fallbackCopyText(text);
  }

  async function copySelectedCells() {
    const selectedCells = getSelectedCells();

    if (!selectedCells.length) {
      setStatus("Сначала выделите нужные ячейки.", "error");
      showCopyToast("Сначала выделите ячейки");
      return;
    }

    const text = buildSelectedText();
    const label = getSelectedColumnLabel();

    const firstHour = selectedCells[0]?.dataset.hour || "";
    const lastHour = selectedCells[selectedCells.length - 1]?.dataset.hour || "";

    try {
      await copyText(text);

      setStatus(`${label} скопирован: ${firstHour} — ${lastHour}. Можно вставить в Excel.`, "success");
      showCopyToast("Скопировано. Можно вставлять в Excel");
    } catch (error) {
      console.error(error);
      setStatus("Не удалось скопировать выделенные данные.", "error");
      showCopyToast("Не удалось скопировать");
    }
  }

  async function copySingleCell(cell) {
    if (!cell) return;

    clearSelectedCells();

    cell.classList.add("selected");
    cell.classList.add("copy-selected");

    const value = cell.dataset.copyValue || cell.textContent.trim();

    try {
      await copyText(value);

      setStatus("Ячейка скопирована. Можно вставить в Excel.", "success");
      showCopyToast("Ячейка скопирована");
    } catch (error) {
      console.error(error);
      setStatus("Не удалось скопировать ячейку.", "error");
      showCopyToast("Не удалось скопировать");
    }
  }

  function renderHourlyTable(hourlyPlans) {
    currentHourlyPlans = hourlyPlans;

    if (!hourlyBody) return;

    hourlyBody.innerHTML = hourlyPlans
      .map((row, index) => {
        const planTo = Math.round(Number(row.plan_to) || 0);
        const planGc = Math.round(Number(row.plan_gc) || 0);
        const avgCheck = Math.round(Number(row.plan_avg_check) || 0);
        const workersCount = getWorkersCountByGc(planGc);

        return `
          <tr>
            <td
              class="selectable-cell"
              data-row-index="${index}"
              data-column="hour"
              data-hour="${row.hour}"
              data-copy-value="${row.hour}"
            >
              ${row.hour}
            </td>

            <td
              class="selectable-cell"
              data-row-index="${index}"
              data-column="plan_to"
              data-hour="${row.hour}"
              data-copy-value="${planTo}"
            >
              ${formatNumber(planTo)}
            </td>

            <td
              class="selectable-cell"
              data-row-index="${index}"
              data-column="plan_gc"
              data-hour="${row.hour}"
              data-copy-value="${planGc}"
            >
              ${formatNumber(planGc)}
            </td>

            <td
              class="selectable-cell"
              data-row-index="${index}"
              data-column="plan_avg_check"
              data-hour="${row.hour}"
              data-copy-value="${avgCheck}"
            >
              ${formatNumber(avgCheck)}
            </td>

            <td
              class="selectable-cell"
              data-row-index="${index}"
              data-column="workers_count"
              data-hour="${row.hour}"
              data-copy-value="${workersCount}"
            >
              ${formatNumber(workersCount)}
            </td>
          </tr>
        `;
      })
      .join("");

    if (hourlyEmpty) hourlyEmpty.style.display = "none";
    if (hourlyTableWrap) hourlyTableWrap.style.display = "block";

    clearSelectedCells();
  }

  async function loadDashboardPlan(date) {
    if (!restaurantId) {
      clearDashboard();
      setStatus("ID ресторана не найден. Войдите заново.", "error");
      return;
    }

    clearDashboard();
    setStatus("Загрузка плана...");

    const { data: dailyPlan, error: dailyError } = await db
      .from("daily_plans")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("date", date)
      .maybeSingle();

    if (dailyError) {
      console.error(dailyError);
      setStatus("Ошибка загрузки дневного плана.", "error");
      return;
    }

    if (!dailyPlan) {
      setStatus("На выбранную дату план не найден.", "error");
      return;
    }

    if (planToEl) planToEl.textContent = formatNumber(dailyPlan.plan_to);
    if (planGcEl) planGcEl.textContent = formatNumber(dailyPlan.plan_gc);
    if (avgCheckEl) avgCheckEl.textContent = formatNumber(dailyPlan.plan_avg_check);

    setStatus(`План найден: ${dailyPlan.day_name || date}`, "success");

    await loadVlhRules();

    const { data: hourlyPlans, error: hourlyError } = await db
      .from("hourly_plans")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("date", date)
      .order("hour", { ascending: true });

    if (hourlyError) {
      console.error(hourlyError);
      setStatus("Дневной план найден, но почасовой план не загрузился.", "error");
      return;
    }

    if (!hourlyPlans || hourlyPlans.length === 0) {
      if (hourlyEmpty) hourlyEmpty.style.display = "block";
      if (hourlyTableWrap) hourlyTableWrap.style.display = "none";
      return;
    }

    renderHourlyTable(hourlyPlans);
  }

  if (hourlyTable) {
    hourlyTable.addEventListener("mousedown", (event) => {
      const cell = event.target.closest(".selectable-cell");

      if (!cell) return;

      event.preventDefault();
      startCellSelection(cell);
    });

    hourlyTable.addEventListener("mouseover", (event) => {
      const cell = event.target.closest(".selectable-cell");

      if (!cell) return;

      moveCellSelection(cell);
    });

    // Қаласаң кейін double click copy қайтарып қосамыз.
    // hourlyTable.addEventListener("dblclick", (event) => {
    //   const cell = event.target.closest(".selectable-cell");
    //
    //   if (!cell) return;
    //
    //   event.preventDefault();
    //   copySingleCell(cell);
    // });
  }

  document.addEventListener("mouseup", stopCellSelection);

  document.addEventListener("keydown", (event) => {
    const isCopyCommand = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c";

    if (!isCopyCommand) return;

    const selectedCells = getSelectedCells();

    if (!selectedCells.length) return;

    event.preventDefault();
    copySelectedCells();
  });

  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener("click", () => {
      clearSelectedCells();
      setStatus("Выделение снято.");
      showCopyToast("Выделение снято");
    });
  }

  dateInput.value = getTodayInputDate();

  dateInput.addEventListener("change", () => {
    loadDashboardPlan(dateInput.value);
  });

  loadDashboardPlan(dateInput.value);
}