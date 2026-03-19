const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const {
  analyzeTextNutrition,
  analyzeImageNutrition,
  transcribeAudioFile,
  formatNutritionReply,
} = require("./nutritionAiService");
const { getUserContext } = require("./userContextService");
const { saveAiInteraction, saveHydrationLog, saveNutritionEntry } = require("./nutritionEntryService");
const { downloadFileBuffer } = require("../integrations/telegramClient");

function getLargestPhoto(photoList) {
  if (!Array.isArray(photoList) || photoList.length === 0) return null;

  return photoList.reduce((current, item) => {
    const currentSize = current?.file_size || 0;
    const nextSize = item?.file_size || 0;
    return nextSize > currentSize ? item : current;
  });
}

function inferExtension(filePathValue, contentType) {
  const fromPath = path.extname(filePathValue || "").toLowerCase();
  if (fromPath) {
    if (fromPath === ".oga" || fromPath === ".opus") return ".ogg";
    return fromPath;
  }

  const normalizedType = String(contentType || "").toLowerCase();
  if (normalizedType.includes("ogg")) return ".ogg";
  if (normalizedType.includes("mpeg")) return ".mp3";
  if (normalizedType.includes("mp4")) return ".mp4";
  if (normalizedType.includes("wav")) return ".wav";
  if (normalizedType.includes("webm")) return ".webm";
  return ".bin";
}

function detectImageMimeFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  const riff = buffer.toString("ascii", 0, 4);
  const webp = buffer.toString("ascii", 8, 12);
  if (riff === "RIFF" && webp === "WEBP") {
    return "image/webp";
  }

  const gif = buffer.toString("ascii", 0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") {
    return "image/gif";
  }

  return null;
}

function normalizeImageMimeType(filePathValue, contentType, buffer) {
  const normalizedType = String(contentType || "")
    .toLowerCase()
    .split(";")[0]
    .trim();

  if (normalizedType === "image/jpg") return "image/jpeg";
  if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(normalizedType)) {
    return normalizedType;
  }

  const extension = path.extname(filePathValue || "").toLowerCase();
  const byExtension = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };

  if (byExtension[extension]) return byExtension[extension];

  const byBuffer = detectImageMimeFromBuffer(buffer);
  if (byBuffer) return byBuffer;

  return "image/jpeg";
}

function sanitizeWaterIntakePerMessage(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  if (parsed > 1500) return 0;
  return Math.round(parsed);
}

const PT_NUMBER_WORDS = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezasseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
};

function parsePtNumericToken(rawToken) {
  const token = String(rawToken || "")
    .trim()
    .toLowerCase();
  if (!token) return null;

  const numeric = Number(token.replace(",", "."));
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  return PT_NUMBER_WORDS[token] || null;
}

function extractWaterAmountMlFromText(text) {
  const value = String(text || "").toLowerCase();
  if (!value) return 0;

  const hasWaterWord = value.includes("agua") || value.includes("água");
  if (!hasWaterWord) return 0;

  const explicitMatch = value.match(/\b(\d+(?:[.,]\d+)?)\s?(ml|l|litro|litros)\b/);
  if (explicitMatch) {
    const amount = Number(explicitMatch[1].replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    return explicitMatch[2] === "ml" ? Math.round(amount) : Math.round(amount * 1000);
  }

  const cupMatch = value.match(/\b([\p{L}\d.,]+)\s+(copo|copos|xicara|xicaras|xícara|xícaras)\b/u);
  if (cupMatch) {
    const qty = parsePtNumericToken(cupMatch[1]);
    if (!qty || !Number.isFinite(qty)) return 0;
    return Math.round(qty * 250);
  }

  return 0;
}

function hasExplicitWaterAmount(text) {
  return extractWaterAmountMlFromText(text) > 0;
}

function normalizeSimpleText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isPureWaterFoodName(name) {
  const normalized = normalizeSimpleText(name).replace(/\s+/g, " ");
  return ["agua", "agua mineral", "water"].includes(normalized);
}

function isWaterOnlyAnalysis(parsed, rawInputText) {
  const waterMlFromText = extractWaterAmountMlFromText(rawInputText);
  if (waterMlFromText <= 0) return false;

  const calories = Number(parsed?.estimated_calories || 0);
  const items = Array.isArray(parsed?.food_items) ? parsed.food_items : [];
  const hasNonWaterItem = items.some((item) => {
    const name = normalizeSimpleText(item?.food_name || "");
    if (!name) return false;
    return !isPureWaterFoodName(name);
  });

  const waterFromAnalysis = Number(parsed?.water_intake_ml || 0);
  const effectiveWater = Math.max(waterMlFromText, Number.isFinite(waterFromAnalysis) ? waterFromAnalysis : 0);
  if (!effectiveWater) return false;

  return calories <= 80 && !hasNonWaterItem;
}

async function ensureRuntimeTempDir() {
  const runtimeDir = path.resolve(__dirname, "../../../../temp/runtime");
  await fs.mkdir(runtimeDir, { recursive: true });
  return runtimeDir;
}

async function persistAnalysis({
  appUser,
  source,
  inputType,
  modality,
  rawInputText,
  parsed,
  modelUsed,
  rawResponse,
  extraAiPayload,
  persist = true,
}) {
  const mergedAiPayload = {
    ...parsed,
    ...(extraAiPayload || {}),
  };

  if (!persist) {
    return {
      analysis: parsed,
      replyText: formatNutritionReply(parsed),
      modelUsed,
      rawResponse,
      mergedAiPayload,
      inputType,
      rawInputText,
    };
  }

  const waterOnly = isWaterOnlyAnalysis(parsed, rawInputText);
  mergedAiPayload.water_only = waterOnly;

  if (!waterOnly) {
    await saveNutritionEntry({
      user_id: appUser.id,
      input_type: inputType,
      source,
      raw_input_text: rawInputText,
      analyzed_summary: parsed.summary,
      meal_quality: parsed.quality,
      recommended_action: parsed.action_now,
      estimated_calories: parsed.estimated_calories,
      estimated_protein_g: parsed.protein_g,
      estimated_carbs_g: parsed.carbs_g,
      estimated_fat_g: parsed.fat_g,
      water_ml_recommended: parsed.water_recommended_ml,
      ai_payload: mergedAiPayload,
    });
  }

  await saveAiInteraction({
    user_id: appUser.id,
    modality,
    model_used: modelUsed,
    input_excerpt: String(rawInputText || "").slice(0, 3000),
    response_text: rawResponse,
    response_json: mergedAiPayload,
  });

  let safeWaterIntakeMl = sanitizeWaterIntakePerMessage(parsed.water_intake_ml);
  if (inputType === "text" || inputType === "audio") {
    const parsedWaterMl = extractWaterAmountMlFromText(rawInputText);
    if (parsedWaterMl > 0) {
      safeWaterIntakeMl = sanitizeWaterIntakePerMessage(parsedWaterMl);
    } else if (!hasExplicitWaterAmount(rawInputText)) {
      safeWaterIntakeMl = 0;
    }
  }
  if (safeWaterIntakeMl > 0) {
    await saveHydrationLog({
      user_id: appUser.id,
      amount_ml: safeWaterIntakeMl,
      source,
      notes: `Registro automatico extraido de mensagem ${inputType}`,
    });
  }

  return {
    analysis: parsed,
    replyText: formatNutritionReply(parsed),
    waterOnly,
    waterLoggedMl: safeWaterIntakeMl,
    nutritionSaved: !waterOnly,
  };
}

async function processTextMessage({ appUser, messageText, source = "telegram", persist = true }) {
  const userContext = await getUserContext(appUser.id);
  const { parsed, modelUsed, rawResponse } = await analyzeTextNutrition(messageText, userContext);

  return persistAnalysis({
    appUser,
    source,
    inputType: "text",
    modality: "text",
    rawInputText: messageText,
    parsed,
    modelUsed,
    rawResponse,
    persist,
  });
}

async function processImageBufferInput({
  appUser,
  imageBuffer,
  mimeType,
  caption = "",
  source = "web",
  inputType = "photo",
  extraAiPayload = {},
  persist = true,
}) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    throw new Error("Imagem invalida");
  }

  const userContext = await getUserContext(appUser.id);
  const { parsed, modelUsed, rawResponse } = await analyzeImageNutrition({
    imageBuffer,
    mimeType,
    caption,
    userContext,
  });

  const rawInputText = caption || "[foto sem legenda]";

  return persistAnalysis({
    appUser,
    source,
    inputType,
    modality: "vision",
    rawInputText,
    parsed,
    modelUsed,
    rawResponse,
    extraAiPayload,
    persist,
  });
}

async function processAudioBufferInput({
  appUser,
  audioBuffer,
  mimeType,
  filePathHint = "",
  source = "web",
  inputType = "audio",
  extraAiPayload = {},
  persist = true,
}) {
  if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
    throw new Error("Audio invalido");
  }

  const runtimeTempDir = await ensureRuntimeTempDir();
  const extension = inferExtension(filePathHint, mimeType);
  const tempFilePath = path.join(runtimeTempDir, `${randomUUID()}${extension}`);
  await fs.writeFile(tempFilePath, audioBuffer);

  try {
    const userContext = await getUserContext(appUser.id);
    let transcription = null;
    try {
      transcription = await transcribeAudioFile({ filePath: tempFilePath });
    } catch (err) {
      const errorText = String(err?.message || "").toLowerCase();
      const shouldRetryAsOgg =
        extension !== ".ogg" &&
        (errorText.includes("unsupported") ||
          errorText.includes("invalid file format") ||
          errorText.includes("audio format"));

      if (!shouldRetryAsOgg) throw err;

      const retryFilePath = path.join(runtimeTempDir, `${randomUUID()}.ogg`);
      await fs.copyFile(tempFilePath, retryFilePath);
      try {
        transcription = await transcribeAudioFile({ filePath: retryFilePath });
      } finally {
        await fs.unlink(retryFilePath).catch(() => {});
      }
    }

    const { parsed, modelUsed, rawResponse } = await analyzeTextNutrition(
      transcription.transcriptText,
      userContext
    );

    return persistAnalysis({
      appUser,
      source,
      inputType,
      modality: "audio",
      rawInputText: transcription.transcriptText,
      parsed,
      modelUsed: `${transcription.modelUsed}+${modelUsed}`,
      rawResponse,
      extraAiPayload: {
        ...extraAiPayload,
        transcript_text: transcription.transcriptText,
      },
      persist,
    });
  } finally {
    await fs.unlink(tempFilePath).catch(() => {});
  }
}

async function processPhotoMessage({ appUser, message, source = "telegram", persist = true }) {
  const selectedPhoto = getLargestPhoto(message.photo || []);
  if (!selectedPhoto?.file_id) {
    throw new Error("Foto nao encontrada na mensagem");
  }

  const downloaded = await downloadFileBuffer(selectedPhoto.file_id);
  const normalizedMimeType = normalizeImageMimeType(
    downloaded.filePath,
    downloaded.contentType,
    downloaded.buffer
  );

  return processImageBufferInput({
    appUser,
    imageBuffer: downloaded.buffer,
    mimeType: normalizedMimeType,
    caption: message.caption || "",
    source,
    inputType: "photo",
    extraAiPayload: {
      telegram_file_path: downloaded.filePath,
      telegram_content_type: downloaded.contentType,
      telegram_content_type_normalized: normalizedMimeType,
    },
    persist,
  });
}

async function processAudioMessage({ appUser, message, source = "telegram", persist = true }) {
  const fileInfo = message.voice || message.audio;
  if (!fileInfo?.file_id) {
    throw new Error("Audio nao encontrado na mensagem");
  }

  const downloaded = await downloadFileBuffer(fileInfo.file_id);
  return processAudioBufferInput({
    appUser,
    audioBuffer: downloaded.buffer,
    mimeType: downloaded.contentType,
    filePathHint: downloaded.filePath,
    source,
    inputType: "audio",
    extraAiPayload: {
      telegram_file_path: downloaded.filePath,
      telegram_content_type: downloaded.contentType,
    },
    persist,
  });
}

module.exports = {
  processTextMessage,
  processPhotoMessage,
  processAudioMessage,
  processImageBufferInput,
  processAudioBufferInput,
};
