const { supabase } = require("../integrations/supabaseClient");

async function saveNutritionEntry(payload) {
  const { data, error } = await supabase
    .from("nutrition_entries")
    .insert(payload)
    .select("id, meal_quality, recorded_at")
    .single();

  if (error) {
    throw new Error(`Erro ao salvar nutrition entry: ${error.message}`);
  }

  return data;
}

async function saveHydrationLog(payload) {
  const { error } = await supabase.from("hydration_logs").insert(payload);
  if (error) {
    throw new Error(`Erro ao salvar hydration log: ${error.message}`);
  }
}

async function saveAiInteraction(payload) {
  const { error } = await supabase.from("ai_interactions").insert(payload);
  if (error) {
    throw new Error(`Erro ao salvar ai interaction: ${error.message}`);
  }
}

module.exports = {
  saveNutritionEntry,
  saveHydrationLog,
  saveAiInteraction,
};
