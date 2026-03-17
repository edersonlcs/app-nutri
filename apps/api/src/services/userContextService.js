const { supabase } = require("../integrations/supabaseClient");
const { buildClinicalOverview } = require("./clinicalInsightService");

function startOfTodayUtcISOString() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  return start.toISOString();
}

async function getUserContext(userId) {
  const [goalRes, profileRes, measurementRes, bioRes, examListRes, hydrationRes] = await Promise.all([
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
      .from("bioimpedance_records")
      .select("body_fat_pct,muscle_mass_kg,body_water_pct,visceral_fat_level,recorded_at")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("medical_exams")
      .select("id,exam_name,exam_type,exam_date,markers,created_at")
      .eq("user_id", userId)
      .order("exam_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("hydration_logs")
      .select("amount_ml, recorded_at")
      .eq("user_id", userId)
      .gte("recorded_at", startOfTodayUtcISOString())
      .order("recorded_at", { ascending: false }),
  ]);

  const hydrationTodayMl = (hydrationRes.data || []).reduce((acc, item) => acc + (item.amount_ml || 0), 0);
  const latestBio = bioRes.data || null;
  const recentExams = examListRes.data || [];
  const latestExam = recentExams[0] || null;
  const latestExamWithMarkers =
    recentExams.find((exam) => exam?.markers && Object.keys(exam.markers).length > 0) || latestExam;
  const clinical = buildClinicalOverview({
    profile: profileRes.data || null,
    latestBio,
    latestExam: latestExamWithMarkers,
  });

  return {
    activeGoal: goalRes.data || null,
    profile: profileRes.data || null,
    latestMeasurement: measurementRes.data || null,
    latestBioimpedance: latestBio,
    latestExam: latestExam
      ? {
          exam_name: latestExam.exam_name,
          exam_type: latestExam.exam_type,
          exam_date: latestExam.exam_date || latestExam.created_at,
        }
      : null,
    clinicalOverview: {
      overall_level: clinical.overall_level,
      overall_label: clinical.overall_label,
      overall_score: clinical.overall_score,
      highlights: clinical.highlights,
      insights: clinical.insights,
    },
    hydrationTodayMl,
  };
}

module.exports = {
  getUserContext,
};
