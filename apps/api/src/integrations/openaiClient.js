const OpenAI = require("openai");
const { cfg } = require("../config/env");

const openai = new OpenAI({
  apiKey: cfg.openaiApiKey,
});

module.exports = {
  openai,
};
