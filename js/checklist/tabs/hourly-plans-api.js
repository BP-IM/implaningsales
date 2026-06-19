(function () {
  const TABLE_NAME = "hourly_plans";

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

  function getSandwichPlan(planGc) {
    return Math.ceil(toNumber(planGc) * 1.2);
  }

  async function getHourlyPlansByDate({ supabase, restaurantId, date }) {
    if (!supabase || typeof supabase.from !== "function") {
      throw new Error("Supabase client не найден для HourlyPlansApi");
    }

    if (!restaurantId) {
      throw new Error("restaurantId не передан в HourlyPlansApi");
    }

    const planDate = normalizeDate(date);

    if (!planDate) {
      throw new Error("date не передан в HourlyPlansApi");
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("hour, plan_to, plan_gc, plan_avg_check")
      .eq("restaurant_id", restaurantId)
      .eq("date", planDate)
      .order("hour", { ascending: true });

    if (error) {
      console.error("Ошибка загрузки hourly_plans:", error);
      throw error;
    }

    return (data || []).map((row) => {
      const planTo = toNumber(row.plan_to);
      const planGc = toNumber(row.plan_gc);
      const planAvgCheck = toNumber(row.plan_avg_check);

      return {
        hour: String(row.hour || "").trim(),
        planTo,
        planGc,
        planAvgCheck,
        sandwichPlan: getSandwichPlan(planGc),
      };
    });
  }

  window.HourlyPlansApi = {
    getHourlyPlansByDate,
  };
})();