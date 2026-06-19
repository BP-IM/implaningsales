(function () {
  const db = window.db;

  const state = {
    restaurantId: null,
    currentDate: null,
    setStatus: null,
    sessionCache: new Map()
  };

  function setStatus(text, type = "success") {
    if (typeof state.setStatus === "function") {
      state.setStatus(text, type);
    }
  }

  function requireDb(date) {
    if (!db) {
      throw new Error("Supabase client window.db не найден.");
    }

    if (!state.restaurantId || state.restaurantId === "-") {
      throw new Error("restaurant_id не найден.");
    }

    if (!date) {
      throw new Error("Дата чек-листа не выбрана.");
    }
  }

  function normalizeMeta(meta = {}) {
    const managers = meta.managers || {};

    return {
      morning_manager: managers.morning || "",
      evening_manager: managers.evening || "",
      night_manager: managers.night || ""
    };
  }

  function getDate(optionsDate) {
    return optionsDate || state.currentDate;
  }

  function cacheKey(date) {
    return `${state.restaurantId}_${date}`;
  }

  async function findSession(options = {}) {
    const date = getDate(options.date);

    requireDb(date);

    const key = cacheKey(date);

    if (!options.force && state.sessionCache.has(key)) {
      return state.sessionCache.get(key);
    }

    const { data, error } = await db
      .from("checklist_sessions")
      .select("*")
      .eq("restaurant_id", state.restaurantId)
      .eq("checklist_date", date)
      .maybeSingle();

    if (error) {
      throw error;
    }

    state.sessionCache.set(key, data || null);

    return data || null;
  }

  async function getOrCreateSession(options = {}) {
    const date = getDate(options.date);
    const meta = options.meta || null;

    requireDb(date);

    const payload = {
      restaurant_id: state.restaurantId,
      checklist_date: date,
      updated_at: new Date().toISOString()
    };

    if (meta) {
      Object.assign(payload, normalizeMeta(meta));
    }

    const { data, error } = await db
      .from("checklist_sessions")
      .upsert(payload, {
        onConflict: "restaurant_id,checklist_date"
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    state.sessionCache.set(cacheKey(date), data);

    return data;
  }

  async function init(options = {}) {
    state.restaurantId = options.restaurantId || localStorage.getItem("restaurant_id") || "-";
    state.currentDate = options.date || null;
    state.setStatus = options.setStatus || null;

    if (!state.currentDate) return;

    findSession({
      date: state.currentDate
    }).catch((error) => {
      console.error(error);
      setStatus("Ошибка подключения к чек-листу.", "error");
    });
  }

  function setDate(date) {
    state.currentDate = date;
  }

  async function loadMeta(options = {}) {
    const date = getDate(options.date);

    try {
      const session = await findSession({
        date
      });

      if (!session) {
        return {
          managers: {
            morning: "",
            evening: "",
            night: ""
          }
        };
      }

      return {
        managers: {
          morning: session.morning_manager || "",
          evening: session.evening_manager || "",
          night: session.night_manager || ""
        }
      };
    } catch (error) {
      console.error(error);
      setStatus("Не удалось загрузить менеджеров.", "error");

      return {
        managers: {
          morning: "",
          evening: "",
          night: ""
        }
      };
    }
  }

  async function saveMeta(meta = {}, options = {}) {
    const date = getDate(options.date || meta.date);

    try {
      if (!options.silent) {
        setStatus("Сохраняем...");
      }

      await getOrCreateSession({
        date,
        meta
      });

      if (!options.silent) {
        setStatus("Сохранено.");
      }

      return true;
    } catch (error) {
      console.error(error);
      setStatus("Ошибка сохранения менеджеров.", "error");
      return false;
    }
  }

  async function loadTab(tabKey, options = {}) {
    const date = getDate(options.date);

    try {
      const session = await findSession({
        date
      });

      if (!session) {
        return {};
      }

      const { data, error } = await db
        .from("checklist_tab_results")
        .select("data")
        .eq("session_id", session.id)
        .eq("tab_key", tabKey)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data?.data || {};
    } catch (error) {
      console.error(error);
      setStatus(`Не удалось загрузить вкладку ${tabKey}.`, "error");
      return {};
    }
  }

  async function saveTab(tabKey, tabData = {}, options = {}) {
    const date = getDate(options.date);
    const meta = options.meta || null;

    try {
      if (!options.silent) {
        setStatus("Сохраняем...");
      }

      const session = await getOrCreateSession({
        date,
        meta
      });

      const payload = {
        session_id: session.id,
        tab_key: tabKey,
        data: tabData || {},
        updated_at: new Date().toISOString()
      };

      const { error } = await db
        .from("checklist_tab_results")
        .upsert(payload, {
          onConflict: "session_id,tab_key"
        });

      if (error) {
        throw error;
      }

      if (!options.silent) {
        setStatus("Сохранено.");
      }

      return true;
    } catch (error) {
      console.error(error);
      setStatus(`Ошибка сохранения вкладки ${tabKey}.`, "error");
      return false;
    }
  }

  async function deleteDate(options = {}) {
    const date = getDate(options.date);

    try {
      const session = await findSession({
        date
      });

      if (!session) {
        return true;
      }

      const { error } = await db
        .from("checklist_sessions")
        .delete()
        .eq("id", session.id);

      if (error) {
        throw error;
      }

      state.sessionCache.delete(cacheKey(date));

      setStatus("Чек-лист очищен.");
      return true;
    } catch (error) {
      console.error(error);
      setStatus("Ошибка очистки чек-листа.", "error");
      return false;
    }
  }

  window.ChecklistStore = {
    init,
    setDate,
    findSession,
    getOrCreateSession,
    loadMeta,
    saveMeta,
    loadTab,
    saveTab,
    deleteDate
  };
})();