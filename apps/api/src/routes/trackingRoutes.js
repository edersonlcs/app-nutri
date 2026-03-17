const express = require("express");
const {
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
} = require("../controllers/trackingController");

const router = express.Router();

router.get("/api/users", usersListController);

router.get("/api/profile", userProfileGetController);
router.post("/api/profile", userProfileUpsertController);

router.get("/api/goals", userGoalListController);
router.post("/api/goals", userGoalCreateController);

router.get("/api/measurements", bodyMeasurementListController);
router.post("/api/measurements", bodyMeasurementCreateController);

router.get("/api/bioimpedance", bioimpedanceListController);
router.post("/api/bioimpedance", bioimpedanceCreateController);

router.get("/api/medical-exams", medicalExamListController);
router.post("/api/medical-exams", medicalExamCreateController);

router.get("/api/hydration", hydrationListController);
router.post("/api/hydration", hydrationCreateController);

router.get("/api/workouts", workoutListController);
router.post("/api/workouts", workoutCreateController);
router.get("/api/workouts/recommendation", workoutRecommendationController);

router.get("/api/nutrition", nutritionListController);
router.post("/api/nutrition/analyze-text", nutritionTextAnalyzeController);

router.get("/api/reports", reportListController);
router.post("/api/reports/generate", reportGenerateController);

router.get("/api/dashboard/overview", dashboardOverviewController);

module.exports = {
  trackingRoutes: router,
};
