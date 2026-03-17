const { logInfo } = require("../utils/logger");

const DEFAULT_TEXT_FALLBACK_MODELS = ["gpt-4.1-mini", "gpt-4o-mini"];
const DEFAULT_VISION_FALLBACK_MODELS = ["gpt-4.1-mini", "gpt-4o-mini"];
const DEFAULT_TRANSCRIBE_FALLBACK_MODELS = ["gpt-4o-mini-transcribe", "gpt-4o-transcribe"];

function uniqueModels(models) {
  return [...new Set((models || []).filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];
}

function getErrorMessage(err) {
  const nested =
    err?.response?.data?.error?.message ||
    err?.error?.message ||
    err?.message ||
    "";

  return String(nested);
}

function isNonRetryableModelError(err) {
  const message = getErrorMessage(err).toLowerCase();
  if (!message) return false;

  return (
    message.includes("insufficient_quota") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("billing")
  );
}

function isRetryableModelError(err) {
  const message = getErrorMessage(err).toLowerCase();
  if (!message) return false;

  return (
    message.includes("must be verified") ||
    message.includes("not found") ||
    message.includes("invalid model") ||
    message.includes("does not support") ||
    message.includes("unsupported") ||
    message.includes("not available") ||
    message.includes("no access") ||
    message.includes("permission")
  );
}

async function runWithModelFallback({ primaryModel, fallbackModels = [], context, runner }) {
  const models = uniqueModels([primaryModel, ...fallbackModels]);
  let lastError = null;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];

    try {
      if (index > 0) {
        logInfo("openai_model_fallback_try", { context, model });
      }

      return await runner(model);
    } catch (err) {
      lastError = err;
      const errorMessage = getErrorMessage(err);
      const hasNext = index < models.length - 1;
      const shouldFallback =
        hasNext && !isNonRetryableModelError(err) && isRetryableModelError(err);

      logInfo("openai_model_attempt_failed", {
        context,
        model,
        shouldFallback,
        error: errorMessage.slice(0, 400),
      });

      if (!shouldFallback) {
        throw err;
      }
    }
  }

  throw lastError || new Error("Falha ao chamar OpenAI com fallback de modelos");
}

module.exports = {
  DEFAULT_TEXT_FALLBACK_MODELS,
  DEFAULT_VISION_FALLBACK_MODELS,
  DEFAULT_TRANSCRIBE_FALLBACK_MODELS,
  runWithModelFallback,
};
