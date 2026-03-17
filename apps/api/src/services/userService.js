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

async function listUsers() {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, telegram_user_id, telegram_username, display_name, timezone, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Erro ao listar usuarios: ${error.message}`);
  }

  return data || [];
}

async function createDefaultUserIfNeeded() {
  const { data: existing, error: existingError } = await supabase
    .from("app_users")
    .select("id, telegram_user_id, telegram_username, display_name, timezone, created_at")
    .is("telegram_user_id", null)
    .eq("display_name", "Usuario EdeVida")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Erro ao buscar usuario padrao: ${existingError.message}`);
  }

  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from("app_users")
    .insert({
      display_name: "Usuario EdeVida",
      timezone: "America/Sao_Paulo",
    })
    .select("id, telegram_user_id, telegram_username, display_name, timezone, created_at")
    .single();

  if (error) {
    throw new Error(`Erro ao criar usuario padrao: ${error.message}`);
  }

  return data;
}

async function resolveUserId(optionalUserId) {
  if (optionalUserId) {
    return optionalUserId;
  }

  const users = await listUsers();
  if (users.length > 0) {
    return users[0].id;
  }

  const defaultUser = await createDefaultUserIfNeeded();
  return defaultUser.id;
}

module.exports = {
  findOrCreateUserFromTelegram,
  listUsers,
  createDefaultUserIfNeeded,
  resolveUserId,
};
