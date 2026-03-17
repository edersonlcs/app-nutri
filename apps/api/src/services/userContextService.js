const { supabase } = require("../integrations/supabaseClient");

function startOfTodayUtcISOString() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  return start.toISOString();
}

async function getUserContext(userId) {
  const [goalRes, profileRes, measurementRes, hydrationRes] = await Promise.all([
    supabase
      .from("user_goals")
      .select("goal_type,target_weight_kg,target_date,priority,status")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("height_cm,baseline_weight_kg,routine_notes,medical_history")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("body_measurements")
      .select("weight_kg,body_fat_pct,recorded_at")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("hydration_logs")
      .select("amount_ml, recorded_at")
      .eq("user_id", userId)
      .gte("recorded_at", startOfTodayUtcISOString())
      .order("recorded_at", { ascending: false }),
  ]);

  const hydrationTodayMl = (hydrationRes.data || []).reduce((acc, item) => acc + (item.amount_ml || 0), 0);

  return {
    activeGoal: goalRes.data || null,
    profile: profileRes.data || null,
    latestMeasurement: measurementRes.data || null,
    hydrationTodayMl,
  };
}

module.exports = {
  getUserContext,
};
