const fs = require("fs");
const path = require("path");
const { openai } = require("../integrations/openaiClient");
const { cfg } = require("../config/env");
const { FOOD_QUALITY_SCALE } = require("../config/constants");
const { getPersonaDocument } = require("./personaService");
const {
  DEFAULT_TEXT_FALLBACK_MODELS,
  DEFAULT_VISION_FALLBACK_MODELS,
  DEFAULT_TRANSCRIBE_FALLBACK_MODELS,
  runWithModelFallback,
} = require("./openaiModelFallbackService");

const responseSchema = {
  name: "nutrition_analysis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      quality: { type: "string", enum: FOOD_QUALITY_SCALE },
      impact: { type: "string" },
      action_now: { type: "string" },
      next_step: { type: "string" },
      hydration_tip: { type: "string" },
      water_intake_ml: { type: "integer", minimum: 0 },
      water_recommended_ml: { type: "integer", minimum: 0 },
      estimated_calories: { type: "number", minimum: 0 },
      protein_g: { type: "number", minimum: 0 },
      carbs_g: { type: "number", minimum: 0 },
      fat_g: { type: "number", minimum: 0 },
    },
    required: [
      "summary",
      "quality",
      "impact",
      "action_now",
      "next_step",
      "hydration_tip",
      "water_intake_ml",
      "water_recommended_ml",
      "estimated_calories",
      "protein_g",
      "carbs_g",
      "fat_g",
    ],
  },
};

function buildSystemPrompt() {
  const personaDoc = getPersonaDocument();
  return [
    "Siga rigorosamente a persona e regras abaixo:",
    personaDoc,
    "",
    "Regras complementares de formato para esta API:",
    "Retorne exclusivamente JSON valido no schema solicitado.",
    "Nao inclua markdown, explicacoes extras nem texto fora do JSON.",
  ].join(" ");
}

function buildUserPrompt(messageText, userContext) {
  return [
    "Entrada principal do usuario:",
    messageText,
    "",
    "Contexto atual do usuario (JSON):",
    JSON.stringify(userContext),
    "",
    "Retorne somente JSON no schema solicitado.",
  ].join("\n");
}

async function parseStructuredNutrition(messages, model, fallbackModels = []) {
  const completion = await runWithModelFallback({
    primaryModel: model,
    fallbackModels,
    context: "nutrition_structured",
    runner: async (currentModel) =>
      openai.chat.completions.create({
        model: currentModel,
        messages,
        response_format: {
          type: "json_schema",
          json_schema: responseSchema,
        },
      }),
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Resposta vazia do modelo OpenAI");
  }

  return {
    parsed: JSON.parse(content),
    modelUsed: completion.model || model,
    rawResponse: content,
  };
}

async function analyzeTextNutrition(messageText, userContext) {
  return parseStructuredNutrition(
    [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(messageText, userContext) },
    ],
    cfg.openaiModelText,
    DEFAULT_TEXT_FALLBACK_MODELS
  );
}

async function analyzeImageNutrition({ imageBuffer, mimeType, caption, userContext }) {
  const base64 = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType || "image/jpeg"};base64,${base64}`;

  const userText = buildUserPrompt(
    caption || "Analise esta imagem de refeicao e identifique alimentos/bebidas.",
    userContext
  );

  return parseStructuredNutrition(
    [
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    cfg.openaiModelVision,
    DEFAULT_VISION_FALLBACK_MODELS
  );
}

async function transcribeAudioFile({ filePath }) {
  const absolutePath = path.resolve(filePath);
  const transcription = await runWithModelFallback({
    primaryModel: cfg.openaiModelTranscribe,
    fallbackModels: DEFAULT_TRANSCRIBE_FALLBACK_MODELS,
    context: "nutrition_transcribe",
    runner: async (currentModel) =>
      openai.audio.transcriptions.create({
        model: currentModel,
        file: fs.createReadStream(absolutePath),
      }),
  });

  const transcriptText = transcription.text || "";
  if (!transcriptText) {
    throw new Error("Transcricao vazia do audio");
  }

  return {
    transcriptText,
    modelUsed: cfg.openaiModelTranscribe,
  };
}

function formatNutritionReply(analysis) {
  return [
    `Qualidade: ${analysis.quality}`,
    `Resumo: ${analysis.summary}`,
    `Impacto: ${analysis.impact}`,
    `Acao agora: ${analysis.action_now}`,
    `Proximo passo: ${analysis.next_step}`,
    `Agua: ${analysis.hydration_tip}`,
  ].join("\n");
}

module.exports = {
  analyzeTextNutrition,
  analyzeImageNutrition,
  transcribeAudioFile,
  formatNutritionReply,
};
