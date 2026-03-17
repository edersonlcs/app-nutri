const { cfg } = require("../config/env");
const { asyncHandler } = require("../utils/asyncHandler");
const { logInfo } = require("../utils/logger");
const { getWebhookInfo, sendMessage } = require("../integrations/telegramClient");
const { storeTelegramUpdate } = require("../services/telegramUpdateService");
const { findOrCreateUserFromTelegram } = require("../services/userService");

const telegramWebhookController = asyncHandler(async (req, res) => {
  const secretHeader = req.headers["x-telegram-bot-api-secret-token"];

  if (cfg.telegramWebhookSecret && secretHeader !== cfg.telegramWebhookSecret) {
    return res.status(401).json({
      ok: false,
      error: "UNAUTHORIZED_TELEGRAM_SECRET",
    });
  }

  const update = req.body;
  if (!update || typeof update.update_id !== "number") {
    return res.status(400).json({
      ok: false,
      error: "INVALID_TELEGRAM_UPDATE",
    });
  }

  const persisted = await storeTelegramUpdate(update);
  if (persisted.duplicate) {
    return res.json({ ok: true, duplicate: true });
  }

  const message = update.message || update.edited_message;
  if (!message || !message.chat || !message.from) {
    return res.json({ ok: true, ignored: true });
  }

  const appUser = await findOrCreateUserFromTelegram(message.from);
  logInfo("telegram_message_received", {
    updateId: update.update_id,
    appUserId: appUser.id,
    chatId: message.chat.id,
    hasText: Boolean(message.text),
  });

  if (message.text) {
    await sendMessage(
      message.chat.id,
      "Recebi sua mensagem no EdeVida. Nas proximas etapas vou analisar alimentacao, agua e progresso automaticamente.",
      { reply_to_message_id: message.message_id }
    );
  }

  return res.json({ ok: true });
});

const telegramWebhookInfoController = asyncHandler(async (_req, res) => {
  const info = await getWebhookInfo();
  res.json({ ok: true, info });
});

module.exports = {
  telegramWebhookController,
  telegramWebhookInfoController,
};
