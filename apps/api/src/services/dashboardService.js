const { supabase } = require("../integrations/supabaseClient");
const { listReports } = require("./reportService");
const { buildClinicalOverview } = require("./clinicalInsightService");

function startOfTodayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function startOfWeekUtc() {
  const now = new Date();
  const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffToMonday = (ref.getUTCDay() + 6) % 7;
  ref.setUTCDate(ref.getUTCDate() - diffToMonday);
  return ref.toISOString();
}

async function getDashboardOverview(userId) {
  const todayStart = startOfTodayUtc();
  const weekStart = startOfWeekUtc();

  const [
    userRes,
    profileRes,
    measurementRes,
    bioRes,
    examListRes,
    hydrationRes,
    nutritionRes,
    workoutRes,
    reports,
  ] = await Promise.all([
    supabase.from("app_users").select("id, display_name, telegram_username, created_at").eq("id", userId).single(),
    supabase
      .from("user_profiles")
      .select("height_cm, baseline_weight_kg, routine_notes, medical_history")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("body_measurements")
      .select("weight_kg, bmi, body_fat_pct, recorded_at")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bioimpedance_records")
      .select("body_fat_pct, muscle_mass_kg, body_water_pct, bmr_kcal, recorded_at")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("medical_exams")
      .select("id, exam_name, exam_type, exam_date, markers, created_at")
      .eq("user_id", userId)
      .order("exam_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("hydration_logs")
      .select("amount_ml")
      .eq("user_id", userId)
      .gte("recorded_at", todayStart),
    supabase
      .from("nutrition_entries")
      .select("meal_quality, analyzed_summary, recorded_at")
      .eq("user_id", userId)
      .gte("recorded_at", todayStart)
      .order("recorded_at", { ascending: false })
      .limit(20),
    supabase
      .from("workout_sessions")
      .select("activity_type, duration_minutes, started_at")
      .eq("user_id", userId)
      .gte("started_at", weekStart),
    listReports({ userId, period: "daily", limit: 7 }),
  ]);

  const responses = [userRes, profileRes, measurementRes, bioRes, examListRes, hydrationRes, nutritionRes, workoutRes];
  const failed = responses.find((item) => item.error);

  if (failed?.error) {
    throw new Error(`Erro ao carregar dashboard: ${failed.error.message}`);
  }

  const hydrationTodayMl = (hydrationRes.data || []).reduce((acc, item) => acc + (item.amount_ml || 0), 0);
  const recentExams = examListRes.data || [];
  const latestExam = recentExams[0] || null;
  const latestExamWithMarkers =
    recentExams.find((exam) => exam?.markers && Object.keys(exam.markers).length > 0) || latestExam;
  const clinical = buildClinicalOverview({
    profile: profileRes.data || null,
    latestBio: bioRes.data || null,
    latestExam: latestExamWithMarkers,
  });

  return {
    user: userRes.data,
    profile: profileRes.data || null,
    latest_measurement: measurementRes.data || null,
    latest_bioimpedance: bioRes.data || null,
    latest_exam: latestExam,
    clinical,
    today: {
      hydration_total_ml: hydrationTodayMl,
      hydration_goal_ml: 3000,
      hydration_progress_pct: Number(((hydrationTodayMl / 3000) * 100).toFixed(1)),
      nutrition_count: nutritionRes.data?.length || 0,
      latest_nutrition: nutritionRes.data?.[0] || null,
    },
    week: {
      workout_sessions: workoutRes.data?.length || 0,
      total_workout_minutes: (workoutRes.data || []).reduce((acc, item) => acc + (item.duration_minutes || 0), 0),
    },
    latest_reports: reports,
  };
}

module.exports = {
  getDashboardOverview,
};
