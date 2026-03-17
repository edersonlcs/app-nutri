const { cfg } = require("../config/env");

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${cfg.telegramBotToken}`;
const TELEGRAM_FILE_BASE = `https://api.telegram.org/file/bot${cfg.telegramBotToken}`;

async function telegramRequest(method, payload = {}) {
  const res = await fetch(`${TELEGRAM_API_BASE}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error (${method}): ${data.description || "unknown"}`);
  }

  return data.result;
}

async function sendMessage(chatId, text, extra = {}) {
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    ...extra,
  });
}

async function getWebhookInfo() {
  return telegramRequest("getWebhookInfo");
}

async function setWebhook(url, secretToken) {
  return telegramRequest("setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message", "edited_message"],
  });
}

async function getFile(fileId) {
  return telegramRequest("getFile", { file_id: fileId });
}

function getFileDownloadUrl(filePath) {
  return `${TELEGRAM_FILE_BASE}/${filePath}`;
}

async function downloadFileBuffer(fileId) {
  const fileMeta = await getFile(fileId);
  const downloadUrl = getFileDownloadUrl(fileMeta.file_path);
  const res = await fetch(downloadUrl);

  if (!res.ok) {
    throw new Error(`Falha ao baixar arquivo do Telegram: HTTP ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    filePath: fileMeta.file_path,
    contentType: res.headers.get("content-type") || "application/octet-stream",
  };
}

module.exports = {
  sendMessage,
  getWebhookInfo,
  setWebhook,
  getFile,
  getFileDownloadUrl,
  downloadFileBuffer,
};
