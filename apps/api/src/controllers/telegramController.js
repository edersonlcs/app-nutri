const { cfg } = require("../config/env");
const { asyncHandler } = require("../utils/asyncHandler");
const { logInfo } = require("../utils/logger");
const { getWebhookInfo, sendMessage } = require("../integrations/telegramClient");
const { storeTelegramUpdate } = require("../services/telegramUpdateService");
const { findOrCreateUserFromTelegram } = require("../services/userService");
const {
  processTextMessage,
  processPhotoMessage,
  processAudioMessage,
} = require("../services/telegramMessageProcessor");
const { saveAiInteraction } = require("../services/nutritionEntryService");

async function safeReply(chatId, text, replyToMessageId) {
  try {
    await sendMessage(chatId, text, { reply_to_message_id: replyToMessageId });
  } catch (err) {
    logInfo("telegram_send_message_failed", { chatId, error: err.message });
  }
}

function detectModality(message) {
  if (message?.text) return "text";
  if (Array.isArray(message?.photo) && message.photo.length > 0) return "vision";
  if (message?.voice || message?.audio) return "audio";
  return "chat";
}

function normalizeOpenAiError(err) {
  const message = String(err?.message || "");
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("insufficient_quota") || lowerMessage.includes("quota")) {
    return {
      code: "OPENAI_QUOTA",
      userMessage:
        "Nao consegui analisar com IA agora por falta de credito/quota da OpenAI. Assim que regularizar os creditos, volto a responder com analise completa.",
    };
  }

  if (lowerMessage.includes("rate limit")) {
    return {
      code: "OPENAI_RATE_LIMIT",
      userMessage:
        "A OpenAI esta com limite temporario de requisicoes. Tente novamente em alguns instantes.",
    };
  }

  return {
    code: "OPENAI_UNAVAILABLE",
    userMessage: "Nao consegui analisar com IA agora. Tente novamente em alguns minutos.",
  };
}

function getTelegramHelpText() {
  return [
    "EdeVida ativo. Como usar:",
    "",
    "1) Texto: descreva refeicao/bebida",
    "Ex.: Almoco: arroz, feijao, frango e 400 ml de agua.",
    "",
    "2) Foto: envie foto do prato",
    "3) Audio: envie audio descrevendo o que comeu",
    "",
    "Comandos:",
    "/start ou /help - mostra este guia",
    "/painel - abre o painel web",
  ].join("\n");
}

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
  const modality = detectModality(message);

  logInfo("telegram_message_received", {
    updateId: update.update_id,
    appUserId: appUser.id,
    chatId: message.chat.id,
    hasText: Boolean(message.text),
    hasPhoto: Array.isArray(message.photo) && message.photo.length > 0,
    hasAudio: Boolean(message.voice || message.audio),
  });

  if (message.text) {
    const normalizedText = String(message.text || "").trim().toLowerCase();
    if (normalizedText === "/start" || normalizedText === "/help") {
      await safeReply(message.chat.id, getTelegramHelpText(), message.message_id);
      return res.json({ ok: true, handled: "help" });
    }

    if (normalizedText === "/painel") {
      await safeReply(
        message.chat.id,
        `Painel web: ${cfg.appBaseUrl}/painel`,
        message.message_id
      );
      return res.json({ ok: true, handled: "painel" });
    }
  }

  if (message.text || (Array.isArray(message.photo) && message.photo.length > 0) || message.voice || message.audio) {
    try {
      let result = null;

      if (message.text) {
        result = await processTextMessage({
          appUser,
          messageText: message.text,
          source: "telegram",
        });
      } else if (Array.isArray(message.photo) && message.photo.length > 0) {
        result = await processPhotoMessage({
          appUser,
          message,
          source: "telegram",
        });
      } else {
        result = await processAudioMessage({
          appUser,
          message,
          source: "telegram",
        });
      }

      const replyPrefix =
        message.voice || message.audio
          ? "Transcrevi seu audio e fiz a analise.\n\n"
          : Array.isArray(message.photo) && message.photo.length > 0
            ? "Analisei sua foto.\n\n"
            : "";

      await safeReply(message.chat.id, `${replyPrefix}${result.replyText}`, message.message_id);

      return res.json({ ok: true, analyzed: true, quality: result.analysis.quality });
    } catch (err) {
      const aiError = normalizeOpenAiError(err);

      await saveAiInteraction({
        user_id: appUser.id,
        modality,
        model_used: aiError.code,
        input_excerpt: (message.text || message.caption || "[media]").slice(0, 3000),
        response_text: err.message,
        response_json: { error: err.message, code: aiError.code },
      }).catch(() => {});

      await safeReply(message.chat.id, aiError.userMessage, message.message_id);

      logInfo("telegram_analysis_failed", {
        appUserId: appUser.id,
        modality,
        errorCode: aiError.code,
        error: err.message,
      });

      return res.json({ ok: true, analyzed: false, reason: aiError.code });
    }
  }

  await safeReply(
    message.chat.id,
    "Formato recebido. Para esta etapa atual, envie texto da refeicao ou bebida para analise.",
    message.message_id
  );

  return res.json({ ok: true, analyzed: false });
});

const telegramWebhookInfoController = asyncHandler(async (_req, res) => {
  const info = await getWebhookInfo();
  res.json({ ok: true, info });
});

module.exports = {
  telegramWebhookController,
  telegramWebhookInfoController,
};
