const { supabase } = require("../integrations/supabaseClient");

async function storeTelegramUpdate(update) {
  const { error } = await supabase.from("telegram_updates").insert({
    update_id: update.update_id,
    payload: update,
  });

  if (!error) return { stored: true, duplicate: false };
  if (error.code === "23505") return { stored: false, duplicate: true };

  throw new Error(`Erro ao persistir telegram update: ${error.message}`);
}

module.exports = {
  storeTelegramUpdate,
};
