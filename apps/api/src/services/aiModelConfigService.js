const { cfg } = require("../config/env");

const MODEL_KEYS = [
  "food_text",
  "food_vision",
  "chat",
  "draft_revision",
  "exam_upload_text",
  "exam_upload_vision",
  "exam_followup",
  "transcribe",
];

const MODEL_LABELS = {
  food_text: "Texto alimento",
  food_vision: "Foto alimento",
  chat: "Conversa IA",
  draft_revision: "Motivo/alternativas",
  exam_upload_text: "Exame upload (PDF/texto)",
  exam_upload_vision: "Exame upload (imagem)",
  exam_followup: "Exames no dia a dia",
  transcribe: "Transcrição de áudio",
};

const PROFILE_PRESETS = {
  economico: {
    label: "Econômico",
    description: "Menor custo para uso diário.",
    models: {
      food_text: "gpt-4.1-mini",
      food_vision: "gpt-4.1-mini",
      chat: "gpt-4.1-mini",
      draft_revision: "gpt-4.1-mini",
      exam_upload_text: "gpt-4.1",
      exam_upload_vision: "gpt-4.1",
      exam_followup: "gpt-4.1-mini",
      transcribe: cfg.openaiModelTranscribe || "gpt-4o-mini-transcribe",
    },
  },
  recomendado: {
    label: "Recomendado",
    description: "Equilíbrio para seu uso: exame forte, dia a dia eficiente.",
    models: {
      food_text: "gpt-4.1-mini",
      food_vision: "gpt-4.1-mini",
      chat: "gpt-5.4-mini",
      draft_revision: "gpt-5.4-mini",
      exam_upload_text: "gpt-5.4",
      exam_upload_vision: "gpt-5.4",
      exam_followup: "gpt-5.4-mini",
      transcribe: cfg.openaiModelTranscribe || "gpt-4o-mini-transcribe",
    },
  },
  clinico: {
    label: "Clínico",
    description: "Maior precisão, com foco em leitura clínica.",
    models: {
      food_text: "gpt-4.1-mini",
      food_vision: "gpt-4.1-mini",
      chat: "gpt-5.4",
      draft_revision: "gpt-5.4-mini",
      exam_upload_text: "gpt-5.4",
      exam_upload_vision: "gpt-5.4",
      exam_followup: "gpt-5.4",
      transcribe: cfg.openaiModelTranscribe || "gpt-4o-mini-transcribe",
    },
  },
};

const FALLBACK_BASELINE = {
  food_text: cfg.openaiModelText || "gpt-4.1-mini",
  food_vision: cfg.openaiModelVision || "gpt-4.1-mini",
  chat: cfg.openaiModelChat || "gpt-4o-mini",
  draft_revision: cfg.openaiModelChat || cfg.openaiModelText || "gpt-4.1-mini",
  exam_upload_text: cfg.openaiModelExamText || "gpt-4.1",
  exam_upload_vision: cfg.openaiModelExamVision || "gpt-4.1",
  exam_followup: cfg.openaiModelExamText || cfg.openaiModelText || "gpt-4.1",
  transcribe: cfg.openaiModelTranscribe || "gpt-4o-mini-transcribe",
};

function normalizeProfile(profile) {
  const normalized = String(profile || "").trim().toLowerCase();
  if (normalized && PROFILE_PRESETS[normalized]) return normalized;
  return "recomendado";
}

function safeObject(input) {
  if (!input) return {};
  if (typeof input === "object") return input;
  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function sanitizeModelMap(input) {
  const base = safeObject(input);
  const output = {};

  for (const key of MODEL_KEYS) {
    const value = String(base[key] || "").trim();
    if (!value) continue;
    output[key] = value;
  }

  return output;
}

function resolveAiSettings(rawSettings = {}) {
  const source = safeObject(rawSettings);
  const profile = normalizeProfile(source.profile);
  const preset = PROFILE_PRESETS[profile];
  const customModels = sanitizeModelMap(source.custom_models || source.models);
  const models = {
    ...FALLBACK_BASELINE,
    ...preset.models,
    ...customModels,
  };

  return {
    profile,
    profile_label: preset.label,
    profile_description: preset.description,
    models,
    custom_models: customModels,
    updated_at: source.updated_at || null,
  };
}

function resolveAiSettingsFromProfile(profile) {
  const medicalHistory = safeObject(profile?.medical_history);
  return resolveAiSettings(medicalHistory.ai_settings || {});
}

function resolveAiSettingsFromUserContext(userContext) {
  const medicalHistory = safeObject(userContext?.profile?.medical_history);
  return resolveAiSettings(medicalHistory.ai_settings || {});
}

function buildAiSettingsForStorage(input) {
  const base = safeObject(input);
  const profile = normalizeProfile(base.profile);
  const customModels = sanitizeModelMap(base.custom_models || base.models);

  return {
    profile,
    custom_models: customModels,
    updated_at: new Date().toISOString(),
  };
}

function listAiProfiles() {
  return Object.entries(PROFILE_PRESETS).map(([key, value]) => ({
    key,
    label: value.label,
    description: value.description,
    models: value.models,
  }));
}

module.exports = {
  MODEL_KEYS,
  MODEL_LABELS,
  PROFILE_PRESETS,
  resolveAiSettings,
  resolveAiSettingsFromProfile,
  resolveAiSettingsFromUserContext,
  buildAiSettingsForStorage,
  listAiProfiles,
};
