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

async function findOrCreateUserFromAuth(authUser) {
  const authUserId = String(authUser?.id || "").trim();
  if (!authUserId) {
    throw new Error("Usuario auth invalido");
  }

  const email = String(authUser?.email || "").trim() || null;
  const metadata = authUser?.user_metadata || {};
  const fullName = String(metadata.full_name || metadata.name || "").trim();
  const displayName = fullName || email || `auth_${authUserId.slice(0, 8)}`;

  const payload = {
    auth_user_id: authUserId,
    auth_email: email,
    display_name: displayName,
  };

  const { data, error } = await supabase
    .from("app_users")
    .upsert(payload, { onConflict: "auth_user_id" })
    .select("id, auth_user_id, auth_email, telegram_user_id, telegram_username, display_name, timezone")
    .single();

  if (error) {
    throw new Error(`Erro ao criar/obter usuario Auth: ${error.message}`);
  }

  return data;
}

async function listUsers() {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, auth_user_id, auth_email, telegram_user_id, telegram_username, display_name, timezone, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Erro ao listar usuarios: ${error.message}`);
  }

  return data || [];
}

async function createDefaultUserIfNeeded() {
  const { data: existing, error: existingError } = await supabase
    .from("app_users")
    .select("id, auth_user_id, auth_email, telegram_user_id, telegram_username, display_name, timezone, created_at")
    .is("telegram_user_id", null)
    .is("auth_user_id", null)
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
    .select("id, auth_user_id, auth_email, telegram_user_id, telegram_username, display_name, timezone, created_at")
    .single();

  if (error) {
    throw new Error(`Erro ao criar usuario padrao: ${error.message}`);
  }

  return data;
}

async function resolveUserId(optionalUserId, authAppUserId = null) {
  if (authAppUserId) {
    return authAppUserId;
  }

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
  findOrCreateUserFromAuth,
  listUsers,
  createDefaultUserIfNeeded,
  resolveUserId,
};
