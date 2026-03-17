function getWorkoutRecommendation({ hydrationTodayMl = 0, workoutSessionsWeek = 0, latestMealQuality = null }) {
  let intensity = "moderate";
  let durationMinutes = 40;
  const notes = [];

  if (hydrationTodayMl < 1200) {
    intensity = "low";
    durationMinutes = 25;
    notes.push("Hidratacao baixa hoje. Priorize agua e treino leve.");
  }

  if (workoutSessionsWeek >= 5) {
    intensity = "low";
    durationMinutes = 20;
    notes.push("Semana com carga alta. Fazer recuperacao ativa.");
  }

  if (latestMealQuality === "ruim" || latestMealQuality === "nunca coma") {
    notes.push("Ultima refeicao com qualidade baixa. Ajustar pre-treino antes de alta intensidade.");
  }

  if (notes.length === 0) {
    notes.push("Condicao geral favoravel para treino moderado.");
  }

  return {
    recommendation: {
      intensity,
      duration_minutes: durationMinutes,
      type: intensity === "low" ? "caminhada + mobilidade" : "forca + cardio leve",
    },
    notes,
  };
}

module.exports = {
  getWorkoutRecommendation,
};
