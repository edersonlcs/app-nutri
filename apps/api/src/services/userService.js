const { supabase } = require("../integrations/supabaseClient");

async function findOrCreateUserFromTelegram(from) {
  const payload = {
    telegram_user_id: from.id,
    telegram_username: from.username || null,
    display_name: [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || `telegram_${from.id}`,
  };

  const { data, error } = await supabase
    .from("app_users")
    .upsert(payload, { onConflict: "telegram_user_id" })
    .select("id, telegram_user_id, telegram_username, display_name, timezone")
    .single();

  if (error) {
    throw new Error(`Erro ao criar/obter usuario Telegram: ${error.message}`);
  }

  return data;
}

module.exports = {
  findOrCreateUserFromTelegram,
};
