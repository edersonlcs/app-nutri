const { supabase } = require("../integrations/supabaseClient");
const { cfg } = require("../config/env");
const { findOrCreateUserFromAuth } = require("../services/userService");

function extractBearerToken(req) {
  const raw = String(req.get("authorization") || "").trim();
  if (!raw) return "";

  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ? String(match[1]).trim() : "";
}

function assertAllowedEmailOrThrow(user) {
  const allowed = Array.isArray(cfg.webAuthAllowedEmails) ? cfg.webAuthAllowedEmails : [];
  if (!allowed.length) return;

  const email = String(user?.email || "")
    .trim()
    .toLowerCase();
  if (!email || !allowed.includes(email)) {
    throw new Error("E-mail não autorizado para este painel");
  }
}

async function resolveAuthContextFromToken(token) {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new Error(error?.message || "Token invalido");
  }

  assertAllowedEmailOrThrow(data.user);

  const appUser = await findOrCreateUserFromAuth(data.user);
  return {
    token,
    supabaseUser: data.user,
    appUser,
  };
}

async function optionalWebAuth(req, _res, next) {
  if (!cfg.webAuthEnabled) {
    req.auth = null;
    return next();
  }

  const token = extractBearerToken(req);
  if (!token) {
    req.auth = null;
    return next();
  }

  try {
    req.auth = await resolveAuthContextFromToken(token);
    return next();
  } catch {
    req.auth = null;
    return next();
  }
}

async function requireWebAuth(req, res, next) {
  if (!cfg.webAuthEnabled) {
    req.auth = null;
    return next();
  }

  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: "Autenticacao obrigatoria" });
  }

  try {
    req.auth = await resolveAuthContextFromToken(token);
    return next();
  } catch (err) {
    const message = String(err?.message || "");
    const isForbidden = message.toLowerCase().includes("nao autorizado") || message.toLowerCase().includes("não autorizado");
    return res
      .status(isForbidden ? 403 : 401)
      .json({ ok: false, error: isForbidden ? message : `Token invalido: ${message}` });
  }
}

module.exports = {
  optionalWebAuth,
  requireWebAuth,
};
