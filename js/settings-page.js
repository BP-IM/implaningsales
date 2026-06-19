const DEFAULT_DAY_COEFFICIENTS = {
  monday: 1.00,
  tuesday: 1.00,
  wednesday: 1.00,
  thursday: 1.00,
  friday: 1.10,
  saturday: 1.20,
  sunday: 1.10
};

const DAYS_LABELS = {
  monday: "Понедельник",
  tuesday: "Вторник",
  wednesday: "Среда",
  thursday: "Четверг",
  friday: "Пятница",
  saturday: "Суббота",
  sunday: "Воскресенье"
};

const DEFAULT_WORKING_HOURS = {
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

const CHANNEL_HOURS = [
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
  "23-00"
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
    "03-04"
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
    "03-04"
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
    "23-00"
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
    "00-01"
  ]
};

const CHANNEL_LABELS = {
  drive: "Drive",
  delivery: "Delivery",
  kiosk: "Киоски",
  counter: "C / Касса"
};

const DEFAULT_VLH_RULES = [
  { gc_threshold: 6, workers_count: 1 },
  { gc_threshold: 11, workers_count: 2 },
  { gc_threshold: 17, workers_count: 3 },
  { gc_threshold: 22, workers_count: 4 },
  { gc_threshold: 25, workers_count: 5 },
  { gc_threshold: 30, workers_count: 6 },
  { gc_threshold: 35, workers_count: 7 },
  { gc_threshold: 41, workers_count: 8 },
  { gc_threshold: 45, workers_count: 9 },
  { gc_threshold: 55, workers_count: 10 },
  { gc_threshold: 60, workers_count: 12 },
  { gc_threshold: 66, workers_count: 13 },
  { gc_threshold: 71, workers_count: 14 },
  { gc_threshold: 75, workers_count: 16 },
  { gc_threshold: 83, workers_count: 17 },
  { gc_threshold: 90, workers_count: 18 },
  { gc_threshold: 97, workers_count: 19 },
  { gc_threshold: 103, workers_count: 20 },
  { gc_threshold: 109, workers_count: 21 },
  { gc_threshold: 114, workers_count: 22 },
  { gc_threshold: 119, workers_count: 23 },
  { gc_threshold: 125, workers_count: 25 },
  { gc_threshold: 134, workers_count: 27 },
  { gc_threshold: 144, workers_count: 28 },
  { gc_threshold: 154, workers_count: 29 },
  { gc_threshold: 160, workers_count: 31 },
  { gc_threshold: 167, workers_count: 32 },
  { gc_threshold: 176, workers_count: 33 },
  { gc_threshold: 182, workers_count: 35 },
  { gc_threshold: 191, workers_count: 37 },
  { gc_threshold: 221, workers_count: 38 }
];

function initSettingsForm() {
  const db = window.db;

  const restaurantName = localStorage.getItem("restaurant_name") || "Ресторан";
  const restaurantId = localStorage.getItem("restaurant_id");

  const nameEl = document.getElementById("settingsRestaurantName");
  const idEl = document.getElementById("settingsRestaurantId");

  const dayBody = document.getElementById("dayCoefficientsBody");
  const holidayBody = document.getElementById("holidayBody");
  const workingHoursBody = document.getElementById("workingHoursBody");
  const vlhRulesBody = document.getElementById("vlhRulesBody");
  const channelHoursGrid = document.getElementById("channelHoursGrid");
  const channelHoursStatus = document.getElementById("channelHoursStatus");
  const channelTabButtons = document.querySelectorAll("[data-channel-tab]");

  const addHolidayBtn = document.getElementById("addHolidayBtn");
  const addVlhRowBtn = document.getElementById("addVlhRowBtn");
  const loadDefaultVlhBtn = document.getElementById("loadDefaultVlhBtn");
  const saveBtn = document.getElementById("saveSettingsBtn");
  const resetBtn = document.getElementById("resetSettingsBtn");
  const channelSelectAllBtn = document.getElementById("channelSelectAllBtn");
  const channelClearAllBtn = document.getElementById("channelClearAllBtn");
  const channelResetDefaultBtn = document.getElementById("channelResetDefaultBtn");
  const message = document.getElementById("settingsMessage");

  const tabButtons = document.querySelectorAll(".settings-tab");
  const panels = document.querySelectorAll(".settings-panel");

  if (!dayBody || !holidayBody || !workingHoursBody) return;

  if (nameEl) nameEl.textContent = restaurantName;
  if (idEl) idEl.textContent = restaurantId || "-";

  let vlhRules = [];
  let activeChannel = "drive";
  let channelWorkHours = cloneJson(DEFAULT_CHANNEL_WORK_HOURS);

  function showMessage(text, type = "success") {
    if (!message) return;

    message.textContent = text;
    message.className = type === "error" ? "settings-message error" : "settings-message";
  }

  function normalizeNumber(value) {
    const number = Number(String(value).replace(",", "."));
    return Number.isFinite(number) ? number : 0;
  }

  function cloneVlhRules(rules) {
    return rules.map((rule) => ({
      gc_threshold: Number(rule.gc_threshold) || 0,
      workers_count: Number(rule.workers_count) || 0
    }));
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getChannelLocalStorageKey() {
    return restaurantId
      ? `channel_work_hours_${restaurantId}`
      : "channel_work_hours";
  }

  function normalizeChannelWorkHours(value = {}) {
    const source = value && typeof value === "object" ? value : {};

    return {
      drive: Array.isArray(source.drive)
        ? source.drive.filter((hour) => CHANNEL_HOURS.includes(hour))
        : [...DEFAULT_CHANNEL_WORK_HOURS.drive],
      delivery: Array.isArray(source.delivery)
        ? source.delivery.filter((hour) => CHANNEL_HOURS.includes(hour))
        : [...DEFAULT_CHANNEL_WORK_HOURS.delivery],
      kiosk: Array.isArray(source.kiosk)
        ? source.kiosk.filter((hour) => CHANNEL_HOURS.includes(hour))
        : [...DEFAULT_CHANNEL_WORK_HOURS.kiosk],
      counter: Array.isArray(source.counter)
        ? source.counter.filter((hour) => CHANNEL_HOURS.includes(hour))
        : [...DEFAULT_CHANNEL_WORK_HOURS.counter]
    };
  }

  function loadChannelWorkHoursFromLocalStorage() {
    try {
      const scopedSaved = localStorage.getItem(getChannelLocalStorageKey());
      const commonSaved = localStorage.getItem("channel_work_hours");
      const saved = scopedSaved || commonSaved;

      if (!saved) {
        return cloneJson(DEFAULT_CHANNEL_WORK_HOURS);
      }

      return normalizeChannelWorkHours(JSON.parse(saved));
    } catch (error) {
      console.warn("Ошибка загрузки channel_work_hours:", error);
      return cloneJson(DEFAULT_CHANNEL_WORK_HOURS);
    }
  }

  function saveChannelWorkHoursToLocalStorage() {
    const value = JSON.stringify(channelWorkHours);

    localStorage.setItem("channel_work_hours", value);

    if (restaurantId) {
      localStorage.setItem(getChannelLocalStorageKey(), value);
    }

    window.dispatchEvent(
      new CustomEvent("checklist:channel-hours-changed", {
        detail: {
          channelHours: channelWorkHours
        }
      })
    );
  }

  function setChannelHoursStatus(text = "") {
    if (!channelHoursStatus) return;

    channelHoursStatus.textContent = text;

    if (text) {
      setTimeout(() => {
        if (channelHoursStatus.textContent === text) {
          channelHoursStatus.textContent = "";
        }
      }, 1800);
    }
  }

  function updateChannelTabs() {
    channelTabButtons.forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.channelTab === activeChannel
      );
    });
  }

  function renderChannelHoursGrid() {
    if (!channelHoursGrid) return;

    const activeHours = channelWorkHours[activeChannel] || [];

    channelHoursGrid.innerHTML = CHANNEL_HOURS
      .map((hour) => {
        const isActive = activeHours.includes(hour);

        return `
          <button
            class="channel-hour-btn ${isActive ? "active" : ""}"
            type="button"
            data-channel-hour="${hour}"
          >
            ${hour}
          </button>
        `;
      })
      .join("");
  }

  function renderChannelHoursControls() {
    updateChannelTabs();
    renderChannelHoursGrid();
  }

  function toggleChannelHour(hour) {
    const currentHours = new Set(channelWorkHours[activeChannel] || []);

    if (currentHours.has(hour)) {
      currentHours.delete(hour);
    } else {
      currentHours.add(hour);
    }

    channelWorkHours[activeChannel] = CHANNEL_HOURS.filter((item) =>
      currentHours.has(item)
    );

    renderChannelHoursGrid();
  }

  function bindChannelHoursEvents() {
    channelTabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeChannel = button.dataset.channelTab || "drive";
        renderChannelHoursControls();
      });
    });

    channelHoursGrid?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-channel-hour]");

      if (!button) return;

      toggleChannelHour(button.dataset.channelHour);
    });

    channelSelectAllBtn?.addEventListener("click", () => {
      channelWorkHours[activeChannel] = [...CHANNEL_HOURS];
      renderChannelHoursGrid();
      setChannelHoursStatus(`${CHANNEL_LABELS[activeChannel]}: все часы выбраны`);
    });

    channelClearAllBtn?.addEventListener("click", () => {
      channelWorkHours[activeChannel] = [];
      renderChannelHoursGrid();
      setChannelHoursStatus(`${CHANNEL_LABELS[activeChannel]}: часы сняты`);
    });

    channelResetDefaultBtn?.addEventListener("click", () => {
      channelWorkHours = cloneJson(DEFAULT_CHANNEL_WORK_HOURS);
      renderChannelHoursControls();
      setChannelHoursStatus("График каналов сброшен по умолчанию");
    });
  }

  function isMissingChannelHoursColumnError(error) {
    const text = String(error?.message || error?.details || "").toLowerCase();

    return text.includes("channel_work_hours") ||
      text.includes("schema cache") ||
      text.includes("could not find");
  }

  function initTabs() {
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const tab = button.dataset.settingsTab;
        const panel = document.getElementById(`${tab}Panel`);

        tabButtons.forEach((btn) => btn.classList.remove("active"));
        panels.forEach((item) => item.classList.remove("active"));

        button.classList.add("active");

        if (panel) {
          panel.classList.add("active");
        }
      });
    });
  }

  function renderDayCoefficients(coefficients) {
    dayBody.innerHTML = Object.entries(DAYS_LABELS)
      .map(([key, label]) => {
        const value = coefficients?.[key] ?? DEFAULT_DAY_COEFFICIENTS[key];

        return `
          <tr>
            <td>${label}</td>
            <td>
              <input
                type="number"
                class="day-setting-input"
                data-key="${key}"
                value="${Number(value).toFixed(2)}"
                step="0.01"
              />
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function createHolidayRow(holiday = {}) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>
        <input
          type="date"
          class="holiday-date"
          value="${holiday.date || ""}"
        />
      </td>

      <td>
        <input
          type="text"
          class="holiday-name"
          placeholder="Например: Праздник"
          value="${holiday.name || ""}"
        />
      </td>

      <td>
        <input
          type="number"
          class="holiday-coeff"
          value="${Number(holiday.coefficient || 1).toFixed(2)}"
          step="0.01"
        />
      </td>

      <td>
        <button class="delete-row-btn" type="button">
          Удалить
        </button>
      </td>
    `;

    tr.querySelector(".delete-row-btn")?.addEventListener("click", () => {
      tr.remove();
    });

    holidayBody.appendChild(tr);
  }

  function renderHolidays(holidays = []) {
    holidayBody.innerHTML = "";

    if (!Array.isArray(holidays) || holidays.length === 0) {
      createHolidayRow({
        date: "",
        name: "",
        coefficient: 1.00
      });

      return;
    }

    holidays.forEach((holiday) => createHolidayRow(holiday));
  }

  function renderWorkingHours(workingHours = DEFAULT_WORKING_HOURS) {
    workingHoursBody.innerHTML = Object.keys(DEFAULT_WORKING_HOURS)
      .map((hour) => {
        const isWorking = workingHours?.[hour] ?? DEFAULT_WORKING_HOURS[hour];
        const closedClass = isWorking ? "" : "closed";

        return `
          <div class="worktime-item ${closedClass}" data-hour-card="${hour}">
            <strong>${hour}</strong>

            <label>
              <input
                type="checkbox"
                class="working-hour-input"
                data-hour="${hour}"
                ${isWorking ? "checked" : ""}
              />
              Работает
            </label>
          </div>
        `;
      })
      .join("");

    document.querySelectorAll(".working-hour-input").forEach((input) => {
      input.addEventListener("change", () => {
        const card = document.querySelector(`[data-hour-card="${input.dataset.hour}"]`);

        if (card) {
          card.classList.toggle("closed", !input.checked);
        }
      });
    });
  }

  function renderVlhRules(rules = []) {
    if (!vlhRulesBody) return;

    vlhRules = cloneVlhRules(rules).sort((a, b) => a.gc_threshold - b.gc_threshold);

    vlhRulesBody.innerHTML = "";

    if (vlhRules.length === 0) {
      vlhRules.push({ gc_threshold: 0, workers_count: 0 });
    }

    vlhRules.forEach((rule, index) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>
          <input
            type="number"
            class="vlh-input vlh-gc-input"
            data-field="gc_threshold"
            value="${rule.gc_threshold || ""}"
            min="0"
            step="1"
            placeholder="6"
          />
        </td>

        <td>
          <input
            type="number"
            class="vlh-input vlh-workers-input"
            data-field="workers_count"
            value="${rule.workers_count || ""}"
            min="0"
            step="1"
            placeholder="1"
          />
        </td>

        <td>
          <button class="delete-row-btn vlh-delete-btn" type="button" data-index="${index}">
            Удалить
          </button>
        </td>
      `;

      vlhRulesBody.appendChild(tr);
    });
  }

  function collectDayCoefficients() {
    const result = {};

    document.querySelectorAll(".day-setting-input").forEach((input) => {
      result[input.dataset.key] = normalizeNumber(input.value);
    });

    return result;
  }

  function collectHolidays() {
    const rows = Array.from(holidayBody.querySelectorAll("tr"));

    return rows
      .map((row) => {
        const date = row.querySelector(".holiday-date")?.value;
        const name = row.querySelector(".holiday-name")?.value.trim();
        const coefficient = normalizeNumber(row.querySelector(".holiday-coeff")?.value);

        return {
          date,
          name,
          coefficient: coefficient || 1
        };
      })
      .filter((holiday) => holiday.date);
  }

  function collectWorkingHours() {
    const result = {};

    document.querySelectorAll(".working-hour-input").forEach((input) => {
      result[input.dataset.hour] = input.checked;
    });

    return result;
  }

  function collectVlhRules() {
    if (!vlhRulesBody) return [];

    const rows = Array.from(vlhRulesBody.querySelectorAll("tr"));
    const rulesMap = new Map();

    rows.forEach((row) => {
      const gc = Math.round(normalizeNumber(row.querySelector(".vlh-gc-input")?.value));
      const workers = Math.round(normalizeNumber(row.querySelector(".vlh-workers-input")?.value));

      if (gc > 0 && workers > 0) {
        rulesMap.set(gc, workers);
      }
    });

    return Array.from(rulesMap.entries())
      .map(([gc_threshold, workers_count]) => ({
        restaurant_id: restaurantId,
        gc_threshold,
        workers_count
      }))
      .sort((a, b) => a.gc_threshold - b.gc_threshold);
  }

  async function loadSettings() {
    if (!restaurantId) {
      showMessage("ID ресторана не найден. Войдите заново.", "error");
      renderDayCoefficients(DEFAULT_DAY_COEFFICIENTS);
      renderHolidays([]);
      renderWorkingHours(DEFAULT_WORKING_HOURS);
      channelWorkHours = loadChannelWorkHoursFromLocalStorage();
      renderChannelHoursControls();
      renderVlhRules([]);
      return;
    }

    const { data, error } = await db
      .from("restaurant_settings")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (error) {
      console.error(error);
      showMessage("Ошибка загрузки настроек.", "error");
    }

    renderDayCoefficients(data?.day_coefficients || DEFAULT_DAY_COEFFICIENTS);
    renderHolidays(data?.holiday_coefficients || []);
    renderWorkingHours(data?.working_hours || DEFAULT_WORKING_HOURS);

    channelWorkHours = normalizeChannelWorkHours(
      data?.channel_work_hours || loadChannelWorkHoursFromLocalStorage()
    );
    saveChannelWorkHoursToLocalStorage();
    renderChannelHoursControls();

    await loadVlhRules();
  }

  async function loadVlhRules() {
    if (!vlhRulesBody || !restaurantId) return;

    const { data, error } = await db
      .from("vlh_rules")
      .select("gc_threshold, workers_count")
      .eq("restaurant_id", restaurantId)
      .order("gc_threshold", { ascending: true });

    if (error) {
      console.error(error);
      showMessage("Ошибка загрузки VLH.", "error");
      renderVlhRules([]);
      return;
    }

    renderVlhRules(data || []);
  }

  async function saveVlhRules() {
    if (!vlhRulesBody || !restaurantId) return;

    const rules = collectVlhRules();

    if (rules.length === 0) {
      return;
    }

    const { error: deleteError } = await db
      .from("vlh_rules")
      .delete()
      .eq("restaurant_id", restaurantId);

    if (deleteError) {
      throw deleteError;
    }

    const { error: insertError } = await db
      .from("vlh_rules")
      .insert(rules);

    if (insertError) {
      throw insertError;
    }

    renderVlhRules(rules);
  }

  async function saveSettings() {
    if (!restaurantId) {
      showMessage("ID ресторана не найден. Войдите заново.", "error");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Сохраняем...";

    const dayCoefficients = collectDayCoefficients();
    const holidayCoefficients = collectHolidays();
    const workingHours = collectWorkingHours();

    channelWorkHours = normalizeChannelWorkHours(channelWorkHours);
    saveChannelWorkHoursToLocalStorage();

    const payload = {
      restaurant_id: restaurantId,
      day_coefficients: dayCoefficients,
      holiday_coefficients: holidayCoefficients,
      working_hours: workingHours,
      channel_work_hours: channelWorkHours,
      updated_at: new Date().toISOString()
    };

    const fallbackPayload = {
      restaurant_id: restaurantId,
      day_coefficients: dayCoefficients,
      holiday_coefficients: holidayCoefficients,
      working_hours: workingHours,
      updated_at: payload.updated_at
    };

    let channelHoursSavedToDb = true;

    try {
      const { error } = await db
        .from("restaurant_settings")
        .upsert(payload, {
          onConflict: "restaurant_id"
        });

      if (error) {
        if (!isMissingChannelHoursColumnError(error)) {
          throw error;
        }

        channelHoursSavedToDb = false;

        const { error: fallbackError } = await db
          .from("restaurant_settings")
          .upsert(fallbackPayload, {
            onConflict: "restaurant_id"
          });

        if (fallbackError) throw fallbackError;
      }

      await saveVlhRules();

      showMessage(
        channelHoursSavedToDb
          ? "Настройки сохранены. График каналов сохранён."
          : "Настройки сохранены. График каналов пока сохранён в браузере. Добавьте channel_work_hours в Supabase."
      );
    } catch (error) {
      console.error(error);
      showMessage(error.message || "Ошибка при сохранении настроек.", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Сохранить настройки";
    }
  }

  function resetSettings() {
    renderDayCoefficients(DEFAULT_DAY_COEFFICIENTS);
    renderHolidays([]);
    renderWorkingHours(DEFAULT_WORKING_HOURS);
    channelWorkHours = cloneJson(DEFAULT_CHANNEL_WORK_HOURS);
    renderChannelHoursControls();
    renderVlhRules(DEFAULT_VLH_RULES);
    showMessage("Значения сброшены. Нажмите “Сохранить настройки”.");
  }

  initTabs();
  bindChannelHoursEvents();
  renderChannelHoursControls();

  addHolidayBtn?.addEventListener("click", () => {
    createHolidayRow({
      date: "",
      name: "",
      coefficient: 1.00
    });
  });

  addVlhRowBtn?.addEventListener("click", () => {
    const currentRules = collectVlhRules();

    currentRules.push({
      restaurant_id: restaurantId,
      gc_threshold: 0,
      workers_count: 0
    });

    renderVlhRules(currentRules);
  });

  loadDefaultVlhBtn?.addEventListener("click", () => {
    renderVlhRules(DEFAULT_VLH_RULES);
    showMessage("Стандартный VLH загружен. Нажмите “Сохранить настройки”.");
  });

  vlhRulesBody?.addEventListener("click", (event) => {
    const button = event.target.closest(".vlh-delete-btn");

    if (!button) return;

    const rows = Array.from(vlhRulesBody.querySelectorAll("tr"));
    const row = button.closest("tr");
    const index = rows.indexOf(row);

    if (index >= 0) {
      const currentRules = collectVlhRules();
      currentRules.splice(index, 1);
      renderVlhRules(currentRules);
    }
  });

  saveBtn?.addEventListener("click", saveSettings);
  resetBtn?.addEventListener("click", resetSettings);

  loadSettings();
}