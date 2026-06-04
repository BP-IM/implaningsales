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

function initSettingsForm() {
  const db = window.db;

  const restaurantName = localStorage.getItem("restaurant_name") || "Ресторан";
  const restaurantId = localStorage.getItem("restaurant_id");

  const nameEl = document.getElementById("settingsRestaurantName");
  const idEl = document.getElementById("settingsRestaurantId");

  const dayBody = document.getElementById("dayCoefficientsBody");
  const holidayBody = document.getElementById("holidayBody");
  const workingHoursBody = document.getElementById("workingHoursBody");

  const addHolidayBtn = document.getElementById("addHolidayBtn");
  const saveBtn = document.getElementById("saveSettingsBtn");
  const resetBtn = document.getElementById("resetSettingsBtn");
  const message = document.getElementById("settingsMessage");

  const tabButtons = document.querySelectorAll(".settings-tab");
  const panels = document.querySelectorAll(".settings-panel");

  if (!dayBody || !holidayBody || !workingHoursBody) return;

  if (nameEl) nameEl.textContent = restaurantName;
  if (idEl) idEl.textContent = restaurantId || "-";

  function showMessage(text, type = "success") {
    message.textContent = text;
    message.className = type === "error" ? "settings-message error" : "settings-message";
  }

  function normalizeNumber(value) {
    const number = Number(String(value).replace(",", "."));
    return Number.isFinite(number) ? number : 0;
  }

  function initTabs() {
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const tab = button.dataset.settingsTab;

        tabButtons.forEach((btn) => btn.classList.remove("active"));
        panels.forEach((panel) => panel.classList.remove("active"));

        button.classList.add("active");

        if (tab === "worktime") {
          document.getElementById("worktimePanel").classList.add("active");
        } else {
          document.getElementById("coefficientsPanel").classList.add("active");
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

    tr.querySelector(".delete-row-btn").addEventListener("click", () => {
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
        const date = row.querySelector(".holiday-date").value;
        const name = row.querySelector(".holiday-name").value.trim();
        const coefficient = normalizeNumber(row.querySelector(".holiday-coeff").value);

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

  async function loadSettings() {
    if (!restaurantId) {
      showMessage("ID ресторана не найден. Войдите заново.", "error");
      renderDayCoefficients(DEFAULT_DAY_COEFFICIENTS);
      renderHolidays([]);
      renderWorkingHours(DEFAULT_WORKING_HOURS);
      return;
    }

    const { data, error } = await db
      .from("restaurant_settings")
      .select("day_coefficients, holiday_coefficients, working_hours")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (error) {
      console.error(error);
      showMessage("Ошибка загрузки настроек.", "error");
    }

    renderDayCoefficients(data?.day_coefficients || DEFAULT_DAY_COEFFICIENTS);
    renderHolidays(data?.holiday_coefficients || []);
    renderWorkingHours(data?.working_hours || DEFAULT_WORKING_HOURS);
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

    try {
      const { error } = await db
        .from("restaurant_settings")
        .upsert(
          {
            restaurant_id: restaurantId,
            day_coefficients: dayCoefficients,
            holiday_coefficients: holidayCoefficients,
            working_hours: workingHours,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: "restaurant_id"
          }
        );

      if (error) throw error;

      showMessage("Настройки сохранены.");
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
    showMessage("Значения сброшены. Нажмите “Сохранить настройки”.");
  }

  initTabs();

  addHolidayBtn.addEventListener("click", () => {
    createHolidayRow({
      date: "",
      name: "",
      coefficient: 1.00
    });
  });

  saveBtn.addEventListener("click", saveSettings);
  resetBtn.addEventListener("click", resetSettings);

  loadSettings();
}