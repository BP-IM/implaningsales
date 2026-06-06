let latestExportData = null;
let latestSettingsData = null;
let calculatedPlanningData = null;

const PLANNING_DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

const PLANNING_DAY_LABELS = {
  monday: "Понедельник",
  tuesday: "Вторник",
  wednesday: "Среда",
  thursday: "Четверг",
  friday: "Пятница",
  saturday: "Суббота",
  sunday: "Воскресенье"
};

const PLANNING_DEFAULT_DAY_COEFFICIENTS = {
  monday: 1.00,
  tuesday: 1.00,
  wednesday: 1.00,
  thursday: 1.00,
  friday: 1.10,
  saturday: 1.20,
  sunday: 1.10
};

const PLANNING_DEFAULT_WORKING_HOURS = {
  "00:00": true,
  "01:00": true,
  "02:00": true,
  "03:00": true,
  "04:00": false,
  "05:00": true,
  "06:00": true,
  "07:00": true,
  "08:00": true,
  "09:00": true,
  "10:00": true,
  "11:00": true,
  "12:00": true,
  "13:00": true,
  "14:00": true,
  "15:00": true,
  "16:00": true,
  "17:00": true,
  "18:00": true,
  "19:00": true,
  "20:00": true,
  "21:00": true,
  "22:00": true,
  "23:00": true
};

function initPlanningForm() {
  const db = window.db;
  const restaurantId = localStorage.getItem("restaurant_id");

  const exportStatus = document.getElementById("planningExportStatus");
  const exportSourceSelect = document.getElementById("planningExportSource");
  const refreshExportsBtn = document.getElementById("refreshPlanningExportsBtn");
  const message = document.getElementById("planningMessage");

  let planningWeeklyExports = [];

  const weekStartInput = document.getElementById("planWeekStart");
  const weekEndInput = document.getElementById("planWeekEnd");
  const weeklyToInput = document.getElementById("planWeeklyTo");
  const weeklyGcInput = document.getElementById("planWeeklyGc");
  const weeklyAvgInput = document.getElementById("planWeeklyAvg");

  const recommendBtn = document.getElementById("recommendPlanBtn");
  const calculateBtn = document.getElementById("calculatePlanningBtn");
  const saveBtn = document.getElementById("savePlanningBtn");

  const dailyCard = document.getElementById("dailyPlanCard");
  const hourlyCard = document.getElementById("hourlyPlanCard");
  const dailyBody = document.getElementById("dailyPlanBody");
  const hourlyBody = document.getElementById("hourlyPlanBody");

  if (!weekStartInput) return;

  function showMessage(text, type = "success") {
    message.textContent = text;
    message.className = type === "error" ? "planning-message error" : "planning-message";
  }

  function setExportStatus(text, type = "") {
    exportStatus.textContent = text;
    exportStatus.className = type ? `export-status ${type}` : "export-status";
  }

  function formatNumber(value) {
    return Math.round(Number(value) || 0).toLocaleString("ru-RU");
  }

  function parseIsoDate(isoDate) {
    const [year, month, day] = isoDate.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  function formatDateInput(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function addDays(isoDate, days) {
    const date = parseIsoDate(isoDate);
    date.setUTCDate(date.getUTCDate() + days);

    return formatDateInput(date);
  }

  function formatDateView(isoDate) {
    if (!isoDate) return "-";

    const date = parseIsoDate(isoDate);

    return date.toLocaleDateString("ru-RU", {
      timeZone: "UTC"
    });
  }

  function buildExportOptionText(weeklyExport) {
  const avgCheck = Number(weeklyExport.total_gc) > 0
    ? Math.round(Number(weeklyExport.total_to) / Number(weeklyExport.total_gc))
    : 0;

  return `${formatDateView(weeklyExport.week_start)} — ${formatDateView(weeklyExport.week_end)} | ТО: ${formatNumber(weeklyExport.total_to)} | GC: ${formatNumber(weeklyExport.total_gc)} | Ср. чек: ${formatNumber(avgCheck)}`;
}

function renderExportSourceOptions(selectedExportId = "") {
  if (!exportSourceSelect) return;

  exportSourceSelect.innerHTML = "";

  if (!planningWeeklyExports.length) {
    exportSourceSelect.innerHTML = `<option value="">Нет загруженных экспортов</option>`;
    return;
  }

  planningWeeklyExports.forEach((weeklyExport) => {
    const option = document.createElement("option");
    option.value = weeklyExport.id;
    option.textContent = buildExportOptionText(weeklyExport);
    exportSourceSelect.appendChild(option);
  });

  const hasSelected = planningWeeklyExports.some((weeklyExport) => {
    return String(weeklyExport.id) === String(selectedExportId);
  });

  exportSourceSelect.value = hasSelected
    ? String(selectedExportId)
    : String(planningWeeklyExports[0].id);
}

  function getDayKeyByIndex(index) {
    return PLANNING_DAY_KEYS[index] || "monday";
  }

  function updateWeekEnd() {
    if (!weekStartInput.value) {
      weekEndInput.value = "";
      return;
    }

    weekEndInput.value = addDays(weekStartInput.value, 6);
  }

  function updateWeeklyAvg() {
    const weeklyTo = Number(weeklyToInput.value) || 0;
    const weeklyGc = Number(weeklyGcInput.value) || 0;

    if (weeklyTo > 0 && weeklyGc > 0) {
      weeklyAvgInput.value = formatNumber(weeklyTo / weeklyGc);
    } else {
      weeklyAvgInput.value = "";
    }
  }

  function resetCalculatedState() {
    calculatedPlanningData = null;
    saveBtn.disabled = true;

    if (dailyCard) dailyCard.style.display = "none";
    if (hourlyCard) hourlyCard.style.display = "none";

    if (dailyBody) dailyBody.innerHTML = "";
    if (hourlyBody) hourlyBody.innerHTML = "";
  }

  function getHolidayForDate(date) {
    const holidays = latestSettingsData?.holiday_coefficients || [];
    return holidays.find((holiday) => holiday.date === date);
  }

  function getHolidayCoefficient(date) {
    const holiday = getHolidayForDate(date);
    return holiday ? Number(holiday.coefficient) || 1 : 1;
  }

  function getWorkingHours() {
    return latestSettingsData?.working_hours || PLANNING_DEFAULT_WORKING_HOURS;
  }

  function distributeIntegerByWeight(rows, totalValue, weightKey, targetKey, forceMinOne = false) {
    const total = Math.round(Number(totalValue) || 0);

    rows.forEach((row) => {
      row[targetKey] = 0;
    });

    if (total <= 0 || rows.length === 0) return;

    let remainingTotal = total;

    if (forceMinOne && total >= rows.length) {
      rows.forEach((row) => {
        row[targetKey] = 1;
      });

      remainingTotal = total - rows.length;
    }

    if (remainingTotal <= 0) return;

    const totalWeight = rows.reduce((sum, row) => {
      return sum + (Number(row[weightKey]) || 0);
    }, 0);

    const preparedRows = rows.map((row) => {
      const weight = Number(row[weightKey]) || 0;
      const exactValue = totalWeight > 0
        ? remainingTotal * weight / totalWeight
        : remainingTotal / rows.length;

      const floorValue = Math.floor(exactValue);

      return {
        row,
        floorValue,
        fraction: exactValue - floorValue
      };
    });

    let used = 0;

    preparedRows.forEach((item) => {
      item.row[targetKey] += item.floorValue;
      used += item.floorValue;
    });

    let leftover = remainingTotal - used;

    preparedRows
      .sort((a, b) => b.fraction - a.fraction)
      .forEach((item) => {
        if (leftover <= 0) return;

        item.row[targetKey] += 1;
        leftover -= 1;
      });
  }

  function getBaseHourlyAvgCheck(row, dayPlan) {
    const lastTo = Number(row.last_week_to) || 0;
    const lastGc = Number(row.last_week_gc) || 0;

    if (lastTo > 0 && lastGc > 0) {
      return lastTo / lastGc;
    }

    const dayTo = Number(dayPlan.plan_to) || 0;
    const dayGc = Number(dayPlan.plan_gc) || 0;

    if (dayTo > 0 && dayGc > 0) {
      return dayTo / dayGc;
    }

    return 1;
  }

  async function getNextAvailableWeekStart(exportWeekEnd) {
    const firstWeekStart = addDays(exportWeekEnd, 1);

    const { data: lastPlan, error } = await db
      .from("weekly_plans")
      .select("week_end")
      .eq("restaurant_id", restaurantId)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      return firstWeekStart;
    }

    if (!lastPlan?.week_end) {
      return firstWeekStart;
    }

    const nextAfterLastPlan = addDays(lastPlan.week_end, 1);

    return nextAfterLastPlan > firstWeekStart ? nextAfterLastPlan : firstWeekStart;
  }

  function recommendWeeklyPlan() {
    if (!latestExportData?.weekly) {
      showMessage("Сначала загрузите экспорт прошлой недели.", "error");
      return;
    }

    weeklyToInput.value = Math.round(Number(latestExportData.weekly.total_to) || 0);
    weeklyGcInput.value = Math.round(Number(latestExportData.weekly.total_gc) || 0);

    updateWeeklyAvg();
    resetCalculatedState();

    showMessage("Рекомендация заполнена по факту прошлой недели. При необходимости можно изменить вручную.");
  }

  async function loadSettings() {
    if (!restaurantId) return;

    const { data, error } = await db
      .from("restaurant_settings")
      .select("day_coefficients, holiday_coefficients, working_hours")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (error) {
      console.error(error);
    }

    latestSettingsData = {
      day_coefficients: data?.day_coefficients || PLANNING_DEFAULT_DAY_COEFFICIENTS,
      holiday_coefficients: data?.holiday_coefficients || [],
      working_hours: data?.working_hours || PLANNING_DEFAULT_WORKING_HOURS
    };
  }

  async function loadExportDetails(weeklyExport, options = {}) {
  const {
    useLatestSavedPlan = false,
    applyFollowingWeek = true,
    clearPlanInputs = true
  } = options;

  if (!weeklyExport) return false;

  resetCalculatedState();
  showMessage("");
  setExportStatus("Загрузка данных выбранного экспорта...");

  const { data: dailyExports, error: dailyError } = await db
    .from("daily_exports")
    .select("*")
    .eq("export_id", weeklyExport.id)
    .order("date", { ascending: true });

  if (dailyError) {
    console.error(dailyError);
    setExportStatus("Ошибка загрузки дневного экспорта.", "error");
    return false;
  }

  const { data: hourlyExports, error: hourlyError } = await db
    .from("hourly_exports")
    .select("*")
    .eq("export_id", weeklyExport.id)
    .order("date", { ascending: true })
    .order("hour", { ascending: true });

  if (hourlyError) {
    console.error(hourlyError);
    setExportStatus("Ошибка загрузки почасового экспорта.", "error");
    return false;
  }

  latestExportData = {
    weekly: weeklyExport,
    daily: dailyExports || [],
    hourly: hourlyExports || []
  };

  if (exportSourceSelect) {
    exportSourceSelect.value = String(weeklyExport.id);
  }

  setExportStatus(
    `Загружен экспорт: ${formatDateView(weeklyExport.week_start)} — ${formatDateView(weeklyExport.week_end)} | ТО: ${formatNumber(weeklyExport.total_to)} | GC: ${formatNumber(weeklyExport.total_gc)}`,
    "success"
  );

  if (useLatestSavedPlan) {
    const hasSavedPlan = await loadLatestSavedPlan();

    if (!hasSavedPlan && applyFollowingWeek) {
      const recommendedWeekStart = addDays(weeklyExport.week_end, 1);

      weekStartInput.value = recommendedWeekStart;
      updateWeekEnd();

      showMessage("Выбран последний экспорт. На эту неделю сохраненного плана нет. Можно рассчитать новый.");
    }

    return true;
  }

  if (applyFollowingWeek) {
    const planWeekStart = addDays(weeklyExport.week_end, 1);

    weekStartInput.value = planWeekStart;
    updateWeekEnd();

    if (clearPlanInputs) {
      weeklyToInput.value = "";
      weeklyGcInput.value = "";
      weeklyAvgInput.value = "";
    }

    const loaded = await loadSavedPlanByWeek(planWeekStart);

    if (!loaded) {
      showMessage("Источник выбран. Можно нажать “Рекомендовать по прошлой неделе” или ввести план вручную.");
    }
  }

  return true;
}

async function loadPlanningExports(options = {}) {
  const {
    selectedExportId = "",
    useLatestSavedPlan = false
  } = options;

  if (!restaurantId) {
    setExportStatus("ID ресторана не найден. Войдите заново.", "error");
    return;
  }

  if (exportSourceSelect) {
    exportSourceSelect.disabled = true;
    exportSourceSelect.innerHTML = `<option value="">Загрузка экспортов...</option>`;
  }

  if (refreshExportsBtn) {
    refreshExportsBtn.disabled = true;
  }

  setExportStatus("Загрузка списка экспортов...");

  const { data: weeklyExports, error: weeklyError } = await db
    .from("weekly_exports")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("week_start", { ascending: false });

  if (weeklyError) {
    console.error(weeklyError);
    setExportStatus("Ошибка загрузки экспортов.", "error");

    if (exportSourceSelect) {
      exportSourceSelect.disabled = false;
    }

    if (refreshExportsBtn) {
      refreshExportsBtn.disabled = false;
    }

    return;
  }

  planningWeeklyExports = weeklyExports || [];

  if (!planningWeeklyExports.length) {
    renderExportSourceOptions();
    setExportStatus("Нет экспорта. Сначала загрузите Excel в разделе “Экспорт прошлой недели”.", "error");

    if (exportSourceSelect) {
      exportSourceSelect.disabled = false;
    }

    if (refreshExportsBtn) {
      refreshExportsBtn.disabled = false;
    }

    return;
  }

  const currentExportId =
    selectedExportId ||
    latestExportData?.weekly?.id ||
    planningWeeklyExports[0].id;

  renderExportSourceOptions(currentExportId);

  const selectedWeeklyExport = planningWeeklyExports.find((weeklyExport) => {
    return String(weeklyExport.id) === String(exportSourceSelect?.value || currentExportId);
  }) || planningWeeklyExports[0];

  await loadExportDetails(selectedWeeklyExport, {
    useLatestSavedPlan,
    applyFollowingWeek: true,
    clearPlanInputs: !useLatestSavedPlan
  });

  if (exportSourceSelect) {
    exportSourceSelect.disabled = false;
  }

  if (refreshExportsBtn) {
    refreshExportsBtn.disabled = false;
  }
}

async function handleExportSourceChange() {
  const selectedExportId = exportSourceSelect?.value;

  if (!selectedExportId) return;

  const selectedWeeklyExport = planningWeeklyExports.find((weeklyExport) => {
    return String(weeklyExport.id) === String(selectedExportId);
  });

  if (!selectedWeeklyExport) {
    showMessage("Выбранный экспорт не найден. Обновите список.", "error");
    return;
  }

  if (exportSourceSelect) exportSourceSelect.disabled = true;
  if (refreshExportsBtn) refreshExportsBtn.disabled = true;

  await loadExportDetails(selectedWeeklyExport, {
    useLatestSavedPlan: false,
    applyFollowingWeek: true,
    clearPlanInputs: true
  });

  if (exportSourceSelect) exportSourceSelect.disabled = false;
  if (refreshExportsBtn) refreshExportsBtn.disabled = false;
}

  async function loadSavedPlanByWeek(weekStart) {
    if (!restaurantId || !weekStart) return false;

    const { data: weeklyPlan, error: weeklyError } = await db
      .from("weekly_plans")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (weeklyError) {
      console.error(weeklyError);
      showMessage("Ошибка загрузки сохраненного плана.", "error");
      return false;
    }

    if (!weeklyPlan) {
      return false;
    }

    const { data: dailyPlans, error: dailyError } = await db
      .from("daily_plans")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("weekly_plan_id", weeklyPlan.id)
      .order("date", { ascending: true });

    if (dailyError) {
      console.error(dailyError);
      showMessage("Ошибка загрузки дневного плана.", "error");
      return false;
    }

    const { data: hourlyPlans, error: hourlyError } = await db
      .from("hourly_plans")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("weekly_plan_id", weeklyPlan.id)
      .order("date", { ascending: true })
      .order("hour", { ascending: true });

    if (hourlyError) {
      console.error(hourlyError);
      showMessage("Ошибка загрузки почасового плана.", "error");
      return false;
    }

    weekStartInput.value = weeklyPlan.week_start;
    weekEndInput.value = weeklyPlan.week_end;
    weeklyToInput.value = Math.round(Number(weeklyPlan.weekly_to) || 0);
    weeklyGcInput.value = Math.round(Number(weeklyPlan.weekly_gc) || 0);
    weeklyAvgInput.value = formatNumber(weeklyPlan.avg_check);

    const workingHours = getWorkingHours();

    const dailyForRender = (dailyPlans || []).map((day) => ({
      date: day.date,
      day_name: day.day_name,
      last_week_to: Number(day.last_week_to) || 0,
      last_week_gc: Number(day.last_week_gc) || 0,
      coefficient: Number(day.coefficient) || 1,
      plan_to: Number(day.plan_to) || 0,
      plan_gc: Number(day.plan_gc) || 0,
      plan_avg_check: Number(day.plan_avg_check) || 0,
      holiday: getHolidayForDate(day.date)
    }));

    const dayNameMap = new Map(
      dailyForRender.map((day) => [day.date, day.day_name])
    );

    const hourlyForRender = (hourlyPlans || []).map((hour) => ({
      date: hour.date,
      day_name: dayNameMap.get(hour.date) || "",
      hour: hour.hour,
      is_working: workingHours[hour.hour] ?? true,
      plan_to: Number(hour.plan_to) || 0,
      plan_gc: Number(hour.plan_gc) || 0,
      plan_avg_check: Number(hour.plan_avg_check) || 0
    }));

    calculatedPlanningData = {
      restaurant_id: restaurantId,
      week_start: weeklyPlan.week_start,
      week_end: weeklyPlan.week_end,
      weekly_to: Number(weeklyPlan.weekly_to) || 0,
      weekly_gc: Number(weeklyPlan.weekly_gc) || 0,
      avg_check: Number(weeklyPlan.avg_check) || 0,
      daily: dailyForRender,
      hourly: hourlyForRender
    };

    renderDailyPlans(dailyForRender);
    renderHourlyPlans(hourlyForRender);

    dailyCard.style.display = "block";
    hourlyCard.style.display = "block";
    saveBtn.disabled = false;

    showMessage("Сохраненный план загружен из базы.");

    return true;
  }

  async function loadLatestSavedPlan() {
    if (!restaurantId) return false;

    const { data: latestPlan, error } = await db
      .from("weekly_plans")
      .select("week_start")
      .eq("restaurant_id", restaurantId)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      return false;
    }

    if (!latestPlan?.week_start) {
      return false;
    }

    return await loadSavedPlanByWeek(latestPlan.week_start);
  }

  async function handleWeekStartChange() {
    updateWeekEnd();
    resetCalculatedState();
    showMessage("");

    const loaded = await loadSavedPlanByWeek(weekStartInput.value);

    if (!loaded) {
      showMessage("На эту неделю сохраненного плана нет. Можно рассчитать новый.");
    }
  }

  function buildHourlyMap() {
    const map = new Map();

    latestExportData.hourly.forEach((row) => {
      map.set(`${row.date}_${row.hour}`, row);
    });

    return map;
  }

  function renderDailyPlans(days) {
    dailyBody.innerHTML = days
      .map((day) => {
        const holidayText = day.holiday ? ` (${day.holiday.name || "особый день"})` : "";

        return `
          <tr>
            <td>${day.day_name}${holidayText}</td>
            <td>${formatDateView(day.date)}</td>
            <td>${formatNumber(day.last_week_to)}</td>
            <td>${Number(day.coefficient).toFixed(2)}</td>
            <td>${formatNumber(day.plan_to)}</td>
            <td>${formatNumber(day.plan_gc)}</td>
            <td>${formatNumber(day.plan_avg_check)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderHourlyPlans(hours) {
    hourlyBody.innerHTML = hours
      .map((row) => {
        const status = row.is_working
          ? `<span class="open-hour">Работает</span>`
          : `<span class="closed-hour">Закрыто</span>`;

        return `
          <tr>
            <td>${formatDateView(row.date)}</td>
            <td>${row.day_name}</td>
            <td>${row.hour}</td>
            <td>${status}</td>
            <td>${formatNumber(row.plan_to)}</td>
            <td>${formatNumber(row.plan_gc)}</td>
            <td>${formatNumber(row.plan_avg_check)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function calculatePlanning() {
    if (!latestExportData || !latestExportData.daily.length) {
      showMessage("Сначала загрузите экспорт прошлой недели.", "error");
      return;
    }

    const weeklyTo = Number(weeklyToInput.value) || 0;
    const weeklyGc = Number(weeklyGcInput.value) || 0;

    if (!weekStartInput.value || !weekEndInput.value) {
      showMessage("Выберите начало недели.", "error");
      return;
    }

    if (weeklyTo <= 0 || weeklyGc <= 0) {
      showMessage("Введите недельный ТО и GC.", "error");
      return;
    }

    const dayCoefficients = latestSettingsData?.day_coefficients || PLANNING_DEFAULT_DAY_COEFFICIENTS;

    const dailyBase = latestExportData.daily.slice(0, 7).map((pastDay, index) => {
      const dayKey = getDayKeyByIndex(index);
      const planDate = addDays(weekStartInput.value, index);

      const dayCoefficient = Number(dayCoefficients[dayKey]) || 1;
      const holidayCoefficient = getHolidayCoefficient(planDate);
      const totalCoefficient = dayCoefficient * holidayCoefficient;

      const weight = (Number(pastDay.fact_to) || 0) * totalCoefficient;

      return {
        past_date: pastDay.date,
        date: planDate,
        day_key: dayKey,
        day_name: PLANNING_DAY_LABELS[dayKey],
        last_week_to: Number(pastDay.fact_to) || 0,
        last_week_gc: Number(pastDay.fact_gc) || 0,
        coefficient: totalCoefficient,
        holiday: getHolidayForDate(planDate),
        weight,
        gc_weight: weight,
        plan_to: 0,
        plan_gc: 0,
        plan_avg_check: 0
      };
    });

    let totalWeight = dailyBase.reduce((sum, day) => sum + day.weight, 0);

    if (totalWeight <= 0) {
      dailyBase.forEach((day) => {
        day.weight = day.coefficient;
        day.gc_weight = day.coefficient;
      });
    }

    distributeIntegerByWeight(dailyBase, weeklyTo, "weight", "plan_to", false);
    distributeIntegerByWeight(dailyBase, weeklyGc, "gc_weight", "plan_gc", false);

    const dailyPlans = dailyBase.map((day) => ({
      ...day,
      plan_avg_check: day.plan_to > 0 && day.plan_gc > 0
        ? Math.round(day.plan_to / day.plan_gc)
        : 0
    }));

    const hourlyMap = buildHourlyMap();
    const workingHours = getWorkingHours();
    const allHours = Object.keys(PLANNING_DEFAULT_WORKING_HOURS);

    const hourlyPlans = [];

    dailyPlans.forEach((dayPlan) => {
      const hourRows = allHours.map((hour) => {
        const isWorking = workingHours[hour] ?? true;
        const pastHour = hourlyMap.get(`${dayPlan.past_date}_${hour}`);

        const lastWeekTo = Number(pastHour?.fact_to) || 0;
        const lastWeekGc = Number(pastHour?.fact_gc) || 0;

        return {
          date: dayPlan.date,
          day_name: dayPlan.day_name,
          hour,
          is_working: isWorking,
          last_week_to: lastWeekTo,
          last_week_gc: lastWeekGc,
          to_weight: lastWeekTo,
          gc_weight: 0,
          plan_to: 0,
          plan_gc: 0,
          plan_avg_check: 0
        };
      });

      const openRows = hourRows.filter((row) => row.is_working);

      let workingToWeight = openRows.reduce((sum, row) => sum + row.to_weight, 0);

      if (workingToWeight <= 0) {
        openRows.forEach((row) => {
          row.to_weight = 1;
        });
      }

      distributeIntegerByWeight(openRows, dayPlan.plan_to, "to_weight", "plan_to", false);

      const rowsWithTo = openRows.filter((row) => row.plan_to > 0);

      rowsWithTo.forEach((row) => {
        const baseAvgCheck = getBaseHourlyAvgCheck(row, dayPlan);

        row.gc_weight = baseAvgCheck > 0
          ? row.plan_to / baseAvgCheck
          : row.plan_to;
      });

      const canGiveMinimumGuest = dayPlan.plan_gc >= rowsWithTo.length;

      distributeIntegerByWeight(
        rowsWithTo,
        dayPlan.plan_gc,
        "gc_weight",
        "plan_gc",
        canGiveMinimumGuest
      );

      hourRows.forEach((row) => {
        if (!row.is_working) {
          row.plan_to = 0;
          row.plan_gc = 0;
          row.plan_avg_check = 0;
          hourlyPlans.push(row);
          return;
        }

        row.plan_avg_check = row.plan_to > 0 && row.plan_gc > 0
          ? Math.round(row.plan_to / row.plan_gc)
          : 0;

        hourlyPlans.push(row);
      });
    });

    calculatedPlanningData = {
      restaurant_id: restaurantId,
      week_start: weekStartInput.value,
      week_end: weekEndInput.value,
      weekly_to: Math.round(weeklyTo),
      weekly_gc: Math.round(weeklyGc),
      avg_check: Math.round(weeklyTo / weeklyGc),
      daily: dailyPlans,
      hourly: hourlyPlans
    };

    renderDailyPlans(dailyPlans);
    renderHourlyPlans(hourlyPlans);

    dailyCard.style.display = "block";
    hourlyCard.style.display = "block";
    saveBtn.disabled = false;

    showMessage("План рассчитан. Проверьте данные и сохраните.");
  }

  async function savePlanning() {
    if (!calculatedPlanningData) {
      showMessage("Сначала рассчитайте план.", "error");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Сохраняем...";

    try {
      const { data: weeklyPlan, error: weeklyError } = await db
        .from("weekly_plans")
        .upsert(
          {
            restaurant_id: restaurantId,
            week_start: calculatedPlanningData.week_start,
            week_end: calculatedPlanningData.week_end,
            weekly_to: calculatedPlanningData.weekly_to,
            weekly_gc: calculatedPlanningData.weekly_gc,
            avg_check: calculatedPlanningData.avg_check
          },
          {
            onConflict: "restaurant_id,week_start"
          }
        )
        .select("id")
        .single();

      if (weeklyError) throw weeklyError;

      const weeklyPlanId = weeklyPlan.id;

      const dailyRows = calculatedPlanningData.daily.map((day) => ({
        restaurant_id: restaurantId,
        weekly_plan_id: weeklyPlanId,
        date: day.date,
        day_name: day.day_name,
        last_week_to: day.last_week_to,
        last_week_gc: day.last_week_gc,
        coefficient: day.coefficient,
        plan_to: day.plan_to,
        plan_gc: day.plan_gc,
        plan_avg_check: day.plan_avg_check
      }));

      const hourlyRows = calculatedPlanningData.hourly.map((hour) => ({
        restaurant_id: restaurantId,
        weekly_plan_id: weeklyPlanId,
        date: hour.date,
        hour: hour.hour,
        plan_to: hour.plan_to,
        plan_gc: hour.plan_gc,
        plan_avg_check: hour.plan_avg_check
      }));

      const { error: dailyError } = await db
        .from("daily_plans")
        .upsert(dailyRows, {
          onConflict: "restaurant_id,date"
        });

      if (dailyError) throw dailyError;

      const { error: hourlyError } = await db
        .from("hourly_plans")
        .upsert(hourlyRows, {
          onConflict: "restaurant_id,date,hour"
        });

      if (hourlyError) throw hourlyError;

      showMessage("План успешно сохранен.");
    } catch (error) {
      console.error(error);
      showMessage(error.message || "Ошибка при сохранении плана.", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Сохранить план";
    }
  }

  if (exportSourceSelect) {
  exportSourceSelect.addEventListener("change", handleExportSourceChange);
}

if (refreshExportsBtn) {
  refreshExportsBtn.addEventListener("click", () => {
    loadPlanningExports({
      selectedExportId: exportSourceSelect?.value || "",
      useLatestSavedPlan: false
    });
  });
}

weekStartInput.addEventListener("change", handleWeekStartChange);

weeklyToInput.addEventListener("input", () => {
  updateWeeklyAvg();
  resetCalculatedState();
});

weeklyGcInput.addEventListener("input", () => {
  updateWeeklyAvg();
  resetCalculatedState();
});

if (recommendBtn) {
  recommendBtn.addEventListener("click", recommendWeeklyPlan);
}

calculateBtn.addEventListener("click", calculatePlanning);
saveBtn.addEventListener("click", savePlanning);

(async () => {
  await loadSettings();
  await loadPlanningExports({ useLatestSavedPlan: true });
})();
}