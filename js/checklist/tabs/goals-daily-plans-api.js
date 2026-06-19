(function () {
  const TABLE_NAME = "daily_plans";

  function toNumber(value) {
    if (value === null || value === undefined || value === "") return 0;

    const normalized = String(value)
      .replace(/\s+/g, "")
      .replace(",", ".");

    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  }

  function normalizeDate(date) {
    if (!date) return "";

    const value = String(date).trim();

    // 2026-06-08
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    // 08.06.2026
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
      const [day, month, year] = value.split(".");
      return `${year}-${month}-${day}`;
    }

    return value;
  }

  function normalizeDailyPlan(row) {
    if (!row) {
      return {
        salesPlan: 0,
        gcPlan: 0,
        avgCheckPlan: 0,
      };
    }

    const salesPlan = toNumber(row.plan_to);
    const gcPlan = toNumber(row.plan_gc);
    let avgCheckPlan = toNumber(row.plan_avg_check);

    // Егер avg_check бос/0 болса, өзіміз есептейміз
    if (!avgCheckPlan && salesPlan && gcPlan) {
      avgCheckPlan = salesPlan / gcPlan;
    }

    return {
      salesPlan,
      gcPlan,
      avgCheckPlan,
    };
  }

  async function getDailyPlanByDate({ supabase, restaurantId, date }) {
    if (!supabase || typeof supabase.from !== "function") {
      throw new Error("Supabase client не найден для GoalsDailyPlansApi");
    }

    if (!restaurantId) {
      throw new Error("restaurantId не передан в GoalsDailyPlansApi");
    }

    const planDate = normalizeDate(date);

    if (!planDate) {
      throw new Error("date не передан в GoalsDailyPlansApi");
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("date, plan_to, plan_gc, plan_avg_check")
      .eq("restaurant_id", restaurantId)
      .eq("date", planDate)
      .maybeSingle();

    if (error) {
      console.error("Ошибка загрузки daily_plans:", error);
      throw error;
    }

    return normalizeDailyPlan(data);
  }

  window.GoalsDailyPlansApi = {
    getDailyPlanByDate,
  };
})();