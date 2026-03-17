const { asyncHandler } = require("../utils/asyncHandler");
const { resolveUserId, listUsers, createDefaultUserIfNeeded } = require("../services/userService");
const { processTextMessage } = require("../services/telegramMessageProcessor");
const {
  upsertUserProfile,
  getUserProfile,
  createGoal,
  listGoals,
  createBodyMeasurement,
  listBodyMeasurements,
  createBioimpedanceRecord,
  listBioimpedanceRecords,
  createMedicalExam,
  listMedicalExams,
  createHydrationLog,
  listHydrationLogs,
  createWorkoutSession,
  listWorkoutSessions,
  listNutritionEntries,
} = require("../services/trackingDataService");
const { generateAndStoreReport, listReports } = require("../services/reportService");
const { getDashboardOverview } = require("../services/dashboardService");
const { getWorkoutRecommendation } = require("../services/workoutPlannerService");

function toLimit(value, fallback = 30, max = 200) {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

async function resolveRequestUserId(req) {
  return resolveUserId(req.body?.user_id || req.query?.user_id);
}

const usersListController = asyncHandler(async (req, res) => {
  const autoCreate = String(req.query.auto_create || "").toLowerCase();
  let users = await listUsers();

  if (users.length === 0 && (autoCreate === "1" || autoCreate === "true")) {
    await createDefaultUserIfNeeded();
    users = await listUsers();
  }

  return res.json({ ok: true, users });
});

const userProfileUpsertController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const profile = await upsertUserProfile({
    userId,
    ...req.body,
  });

  return res.json({ ok: true, profile });
});

const userProfileGetController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const profile = await getUserProfile(userId);
  return res.json({ ok: true, profile });
});

const userGoalCreateController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const { goal_type } = req.body;

  if (!goal_type) {
    return res.status(400).json({ ok: false, error: "goal_type obrigatorio" });
  }

  const goal = await createGoal({ userId, ...req.body });
  return res.status(201).json({ ok: true, goal });
});

const userGoalListController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const goals = await listGoals(userId);
  return res.json({ ok: true, goals });
});

const bodyMeasurementCreateController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const measurement = await createBodyMeasurement({ userId, ...req.body });
  return res.status(201).json({ ok: true, measurement });
});

const bodyMeasurementListController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const measurements = await listBodyMeasurements(userId, toLimit(req.query.limit, 30, 120));
  return res.json({ ok: true, measurements });
});

const bioimpedanceCreateController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const record = await createBioimpedanceRecord({ userId, ...req.body });
  return res.status(201).json({ ok: true, record });
});

const bioimpedanceListController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const records = await listBioimpedanceRecords(userId, toLimit(req.query.limit, 30, 120));
  return res.json({ ok: true, records });
});

const medicalExamCreateController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  if (!req.body.exam_name) {
    return res.status(400).json({ ok: false, error: "exam_name obrigatorio" });
  }

  const exam = await createMedicalExam({ userId, ...req.body });
  return res.status(201).json({ ok: true, exam });
});

const medicalExamListController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const exams = await listMedicalExams(userId, toLimit(req.query.limit, 30, 120));
  return res.json({ ok: true, exams });
});

const hydrationCreateController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  if (!req.body.amount_ml) {
    return res.status(400).json({ ok: false, error: "amount_ml obrigatorio" });
  }

  const hydration = await createHydrationLog({ userId, ...req.body, source: req.body.source || "web" });
  return res.status(201).json({ ok: true, hydration });
});

const hydrationListController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const hydration = await listHydrationLogs(userId, {
    from: req.query.from,
    to: req.query.to,
    limit: toLimit(req.query.limit, 100, 500),
  });
  return res.json({ ok: true, hydration });
});

const workoutCreateController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  if (!req.body.activity_type) {
    return res.status(400).json({ ok: false, error: "activity_type obrigatorio" });
  }

  const workout = await createWorkoutSession({ userId, ...req.body, source: req.body.source || "web" });
  return res.status(201).json({ ok: true, workout });
});

const workoutListController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const workouts = await listWorkoutSessions(userId, {
    from: req.query.from,
    to: req.query.to,
    limit: toLimit(req.query.limit, 100, 500),
  });
  return res.json({ ok: true, workouts });
});

const nutritionListController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const nutrition = await listNutritionEntries(userId, toLimit(req.query.limit, 50, 300));
  return res.json({ ok: true, nutrition });
});

function normalizeOpenAiError(err) {
  const message = String(err?.message || "").toLowerCase();
  if (message.includes("quota") || message.includes("insufficient_quota")) {
    return "OPENAI_QUOTA";
  }
  if (message.includes("rate limit")) {
    return "OPENAI_RATE_LIMIT";
  }
  return "OPENAI_UNAVAILABLE";
}

const nutritionTextAnalyzeController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const { text } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ ok: false, error: "text obrigatorio" });
  }

  try {
    const result = await processTextMessage({
      appUser: { id: userId },
      messageText: text,
      source: "web",
    });

    return res.json({
      ok: true,
      analyzed: true,
      quality: result.analysis.quality,
      analysis: result.analysis,
      replyText: result.replyText,
    });
  } catch (err) {
    const reason = normalizeOpenAiError(err);
    return res.status(503).json({
      ok: false,
      analyzed: false,
      reason,
      message: "Nao foi possivel analisar com OpenAI no momento.",
      details: err.message,
    });
  }
});

const reportGenerateController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const report = await generateAndStoreReport({
    userId,
    period: req.body.period || "daily",
    reportDate: req.body.report_date,
  });
  return res.json({ ok: true, report });
});

const reportListController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const reports = await listReports({
    userId,
    period: req.query.period,
    limit: toLimit(req.query.limit, 30, 120),
  });
  return res.json({ ok: true, reports });
});

const dashboardOverviewController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const overview = await getDashboardOverview(userId);
  return res.json({ ok: true, overview });
});

const workoutRecommendationController = asyncHandler(async (req, res) => {
  const userId = await resolveRequestUserId(req);
  const overview = await getDashboardOverview(userId);
  const recommendation = getWorkoutRecommendation({
    hydrationTodayMl: overview.today.hydration_total_ml,
    workoutSessionsWeek: overview.week.workout_sessions,
    latestMealQuality: overview.today.latest_nutrition?.meal_quality || null,
  });

  return res.json({
    ok: true,
    user_id: userId,
    recommendation,
  });
});

module.exports = {
  usersListController,
  userProfileUpsertController,
  userProfileGetController,
  userGoalCreateController,
  userGoalListController,
  bodyMeasurementCreateController,
  bodyMeasurementListController,
  bioimpedanceCreateController,
  bioimpedanceListController,
  medicalExamCreateController,
  medicalExamListController,
  hydrationCreateController,
  hydrationListController,
  workoutCreateController,
  workoutListController,
  nutritionListController,
  nutritionTextAnalyzeController,
  reportGenerateController,
  reportListController,
  dashboardOverviewController,
  workoutRecommendationController,
};
