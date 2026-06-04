let parsedExportData = null;

function initExportPage() {
  const db = window.db;

  const fileInput = document.getElementById("exportFileInput");
  const previewCard = document.getElementById("exportPreviewCard");
  const message = document.getElementById("exportMessage");
  const saveBtn = document.getElementById("saveExportBtn");

  const fileNameEl = document.getElementById("exportFileName");
  const periodEl = document.getElementById("exportPeriod");
  const planPeriodEl = document.getElementById("exportPlanPeriod");
  const totalToEl = document.getElementById("exportTotalTo");
  const totalGcEl = document.getElementById("exportTotalGc");
  const totalAvgEl = document.getElementById("exportTotalAvg");

  const dailyBody = document.getElementById("dailyExportBody");
  const hourlyBody = document.getElementById("hourlyExportBody");

  const exportsList = document.getElementById("exportsList");
  const exportsListEmpty = document.getElementById("exportsListEmpty");
  const refreshExportsBtn = document.getElementById("refreshExportsBtn");

  if (!fileInput) return;

  function showMessage(text, type = "success") {
    message.textContent = text;
    message.className = type === "error" ? "export-message error" : "export-message";
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

  function getPlanPeriodByExport(weekEnd) {
    const planStart = addDays(weekEnd, 1);
    const planEnd = addDays(planStart, 6);

    return {
      plan_start: planStart,
      plan_end: planEnd
    };
  }

  function excelSerialToISO(serial) {
    const utcDays = Math.floor(Number(serial) - 25569);
    const utcValue = utcDays * 86400;
    const date = new Date(utcValue * 1000);

    return date.toISOString().slice(0, 10);
  }

  function parseDateCell(value) {
    if (!value) return null;

    if (typeof value === "number") {
      return excelSerialToISO(value);
    }

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    const text = String(value).trim();
    const match = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);

    if (!match) return null;

    const day = match[1];
    const month = match[2];
    const year = match[3];

    return `${year}-${month}-${day}`;
  }

  function getRussianDayName(isoDate) {
    const date = parseIsoDate(isoDate);

    const days = [
      "Воскресенье",
      "Понедельник",
      "Вторник",
      "Среда",
      "Четверг",
      "Пятница",
      "Суббота"
    ];

    return days[date.getUTCDay()];
  }

  function parseHour(value) {
    if (value === null || value === undefined || value === "") return null;

    let text = String(value).trim();

    if (text.includes(":")) {
      text = text.split(":")[0];
    }

    const hourNumber = Number(text);

    if (Number.isNaN(hourNumber)) return null;

    return String(hourNumber).padStart(2, "0") + ":00";
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === "") return 0;

    if (typeof value === "number") return value;

    return Number(String(value).replace(/\s/g, "").replace(",", ".")) || 0;
  }

  function findColumnIndex(headers, searchText) {
    return headers.findIndex((header) =>
      String(header || "").toLowerCase().includes(searchText.toLowerCase())
    );
  }

  function parseWorkbook(workbook, fileName) {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: null
    });

    const headerIndex = rows.findIndex((row) =>
      row.some((cell) => String(cell || "").includes("Учетный день")) &&
      row.some((cell) => String(cell || "").includes("Час закрытия"))
    );

    if (headerIndex === -1) {
      throw new Error("Не найдены нужные колонки в Excel файле.");
    }

    const headers = rows[headerIndex];

    const dateIndex = findColumnIndex(headers, "Учетный день");
    const hourIndex = findColumnIndex(headers, "Час закрытия");
    const gcIndex = findColumnIndex(headers, "Количество гостей");
    const toIndex = findColumnIndex(headers, "Сумма со скидкой");

    if (dateIndex === -1 || hourIndex === -1 || gcIndex === -1 || toIndex === -1) {
      throw new Error("В файле нет одной из нужных колонок: дата, час, GC, ТО.");
    }

    const dailyMap = new Map();
    const hourlyMap = new Map();

    let currentDate = null;

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];

      if (!row || row.length === 0) continue;

      const dateCell = row[dateIndex];
      const dateText = String(dateCell || "");

      if (dateText.includes("Total")) continue;

      const parsedDate = parseDateCell(dateCell);

      if (parsedDate) {
        currentDate = parsedDate;
      }

      if (!currentDate) continue;

      const hour = parseHour(row[hourIndex]);

      if (!hour) continue;

      const factTo = toNumber(row[toIndex]);
      const factGc = toNumber(row[gcIndex]);

      if (factTo <= 0 && factGc <= 0) continue;

      if (!dailyMap.has(currentDate)) {
        dailyMap.set(currentDate, {
          date: currentDate,
          day_name: getRussianDayName(currentDate),
          fact_to: 0,
          fact_gc: 0,
          avg_check: 0
        });
      }

      const daily = dailyMap.get(currentDate);
      daily.fact_to += factTo;
      daily.fact_gc += factGc;
      daily.avg_check = daily.fact_to > 0 && daily.fact_gc > 0
        ? Math.round(daily.fact_to / daily.fact_gc)
        : 0;

      const hourlyKey = `${currentDate}_${hour}`;

      if (!hourlyMap.has(hourlyKey)) {
        hourlyMap.set(hourlyKey, {
          date: currentDate,
          hour,
          fact_to: 0,
          fact_gc: 0,
          avg_check: 0
        });
      }

      const hourly = hourlyMap.get(hourlyKey);
      hourly.fact_to += factTo;
      hourly.fact_gc += factGc;
      hourly.avg_check = hourly.fact_to > 0 && hourly.fact_gc > 0
        ? Math.round(hourly.fact_to / hourly.fact_gc)
        : 0;
    }

    const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const hourly = Array.from(hourlyMap.values()).sort((a, b) => {
      if (a.date === b.date) return a.hour.localeCompare(b.hour);
      return a.date.localeCompare(b.date);
    });

    if (daily.length === 0) {
      throw new Error("Файл оқылды, бірақ күндік данные табылмады.");
    }

    const totalTo = daily.reduce((sum, day) => sum + day.fact_to, 0);
    const totalGc = daily.reduce((sum, day) => sum + day.fact_gc, 0);

    const weekStart = daily[0].date;
    const weekEnd = daily[daily.length - 1].date;
    const planPeriod = getPlanPeriodByExport(weekEnd);

    return {
      restaurant_id: localStorage.getItem("restaurant_id"),
      source_file_name: fileName,
      week_start: weekStart,
      week_end: weekEnd,
      plan_start: planPeriod.plan_start,
      plan_end: planPeriod.plan_end,
      total_to: Math.round(totalTo),
      total_gc: Math.round(totalGc),
      avg_check: totalTo > 0 && totalGc > 0 ? Math.round(totalTo / totalGc) : 0,
      daily,
      hourly
    };
  }

  function renderPreview(data) {
    previewCard.style.display = "block";

    fileNameEl.textContent = data.source_file_name || "-";
    periodEl.textContent = `${formatDateView(data.week_start)} — ${formatDateView(data.week_end)}`;
    planPeriodEl.textContent = `${formatDateView(data.plan_start)} — ${formatDateView(data.plan_end)}`;
    totalToEl.textContent = formatNumber(data.total_to);
    totalGcEl.textContent = formatNumber(data.total_gc);
    totalAvgEl.textContent = formatNumber(data.avg_check);

    dailyBody.innerHTML = data.daily
      .map((day) => `
        <tr>
          <td>${day.day_name}</td>
          <td>${formatDateView(day.date)}</td>
          <td>${formatNumber(day.fact_to)}</td>
          <td>${formatNumber(day.fact_gc)}</td>
          <td>${formatNumber(day.avg_check)}</td>
        </tr>
      `)
      .join("");

    hourlyBody.innerHTML = data.hourly
      .map((hour) => `
        <tr>
          <td>${formatDateView(hour.date)}</td>
          <td>${hour.hour}</td>
          <td>${formatNumber(hour.fact_to)}</td>
          <td>${formatNumber(hour.fact_gc)}</td>
          <td>${formatNumber(hour.avg_check)}</td>
        </tr>
      `)
      .join("");
  }

  async function handleFileUpload(file) {
    showMessage("Файл оқылып жатыр...");

    const buffer = await file.arrayBuffer();

    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: false
    });

    parsedExportData = parseWorkbook(workbook, file.name);

    localStorage.setItem("last_week_export", JSON.stringify(parsedExportData));

    renderPreview(parsedExportData);

    showMessage("Файл успешно прочитан. Проверьте данные и сохраните в базу.");
  }

  async function saveExportToDatabase() {
    if (!parsedExportData) {
      showMessage("Сначала загрузите Excel файл.", "error");
      return;
    }

    const restaurantId = localStorage.getItem("restaurant_id");

    if (!restaurantId) {
      showMessage("ID ресторана не найден. Войдите заново.", "error");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Сохраняем...";

    try {
      const { data: weeklyExport, error: weeklyError } = await db
        .from("weekly_exports")
        .upsert(
          {
            restaurant_id: restaurantId,
            week_start: parsedExportData.week_start,
            week_end: parsedExportData.week_end,
            total_to: parsedExportData.total_to,
            total_gc: parsedExportData.total_gc,
            avg_check: parsedExportData.avg_check,
            source_file_name: parsedExportData.source_file_name
          },
          {
            onConflict: "restaurant_id,week_start"
          }
        )
        .select("id")
        .single();

      if (weeklyError) throw weeklyError;

      const exportId = weeklyExport.id;

      await db
        .from("daily_exports")
        .delete()
        .eq("restaurant_id", restaurantId)
        .gte("date", parsedExportData.week_start)
        .lte("date", parsedExportData.week_end);

      await db
        .from("hourly_exports")
        .delete()
        .eq("restaurant_id", restaurantId)
        .gte("date", parsedExportData.week_start)
        .lte("date", parsedExportData.week_end);

      const dailyRows = parsedExportData.daily.map((day) => ({
        export_id: exportId,
        restaurant_id: restaurantId,
        date: day.date,
        day_name: day.day_name,
        fact_to: Math.round(day.fact_to),
        fact_gc: Math.round(day.fact_gc),
        avg_check: Math.round(day.avg_check)
      }));

      const hourlyRows = parsedExportData.hourly.map((hour) => ({
        export_id: exportId,
        restaurant_id: restaurantId,
        date: hour.date,
        hour: hour.hour,
        fact_to: Math.round(hour.fact_to),
        fact_gc: Math.round(hour.fact_gc),
        avg_check: Math.round(hour.avg_check)
      }));

      const { error: dailyError } = await db
        .from("daily_exports")
        .insert(dailyRows);

      if (dailyError) throw dailyError;

      const { error: hourlyError } = await db
        .from("hourly_exports")
        .insert(hourlyRows);

      if (hourlyError) throw hourlyError;

      showMessage("Экспорт прошлой недели сохранен в базу.");
      await loadExportsList();
    } catch (error) {
      console.error(error);
      showMessage(error.message || "Ошибка при сохранении в базу.", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Сохранить в базу";
    }
  }

  function renderExportsList(exports) {
    if (!exports || exports.length === 0) {
      exportsList.innerHTML = "";
      exportsListEmpty.style.display = "block";
      return;
    }

    exportsListEmpty.style.display = "none";

    exportsList.innerHTML = exports
      .map((item, index) => {
        const planPeriod = getPlanPeriodByExport(item.week_end);
        const isActual = index === 0;

        return `
          <div class="export-item" data-export-id="${item.id}">
            <div class="export-item-main">
              <div class="export-item-title">
                <h3>Факт: ${formatDateView(item.week_start)} — ${formatDateView(item.week_end)}</h3>
                ${isActual ? `<span class="actual-badge">Актуальный</span>` : ""}
              </div>

              <div class="export-file-name">
                Файл: ${item.source_file_name || "Не указан"}
              </div>

              <div class="export-meta">
                <div>
                  <span>Для планирования</span>
                  <strong>${formatDateView(planPeriod.plan_start)} — ${formatDateView(planPeriod.plan_end)}</strong>
                </div>

                <div>
                  <span>ТО / GC</span>
                  <strong>${formatNumber(item.total_to)} / ${formatNumber(item.total_gc)}</strong>
                </div>

                <div>
                  <span>Средний чек</span>
                  <strong>${formatNumber(item.avg_check)}</strong>
                </div>
              </div>
            </div>

            <button class="delete-export-btn" type="button" data-export-id="${item.id}">
              Удалить
            </button>
          </div>
        `;
      })
      .join("");
  }

  async function loadExportsList() {
    const restaurantId = localStorage.getItem("restaurant_id");

    if (!restaurantId) {
      exportsList.innerHTML = "";
      exportsListEmpty.style.display = "block";
      return;
    }

    const { data, error } = await db
      .from("weekly_exports")
      .select("id, week_start, week_end, total_to, total_gc, avg_check, source_file_name, created_at")
      .eq("restaurant_id", restaurantId)
      .order("week_start", { ascending: false });

    if (error) {
      console.error(error);
      exportsList.innerHTML = "";
      exportsListEmpty.style.display = "block";
      showMessage("Ошибка загрузки списка экспортов.", "error");
      return;
    }

    renderExportsList(data || []);
  }

  async function deleteExport(exportId) {
    if (!exportId) return;

    const confirmed = window.confirm(
      "Удалить этот экспорт? Дневные и почасовые данные этого экспорта тоже будут удалены."
    );

    if (!confirmed) return;

    try {
      await db.from("daily_exports").delete().eq("export_id", exportId);
      await db.from("hourly_exports").delete().eq("export_id", exportId);

      const { error } = await db
        .from("weekly_exports")
        .delete()
        .eq("id", exportId);

      if (error) throw error;

      showMessage("Экспорт удален.");
      await loadExportsList();
    } catch (error) {
      console.error(error);
      showMessage(error.message || "Ошибка при удалении экспорта.", "error");
    }
  }

  fileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    try {
      await handleFileUpload(file);
    } catch (error) {
      console.error(error);
      showMessage(error.message || "Ошибка при чтении файла.", "error");
    }
  });

  saveBtn.addEventListener("click", saveExportToDatabase);

  if (refreshExportsBtn) {
    refreshExportsBtn.addEventListener("click", loadExportsList);
  }

  if (exportsList) {
    exportsList.addEventListener("click", (event) => {
      const deleteBtn = event.target.closest(".delete-export-btn");

      if (!deleteBtn) return;

      deleteExport(deleteBtn.dataset.exportId);
    });
  }

  loadExportsList();
}