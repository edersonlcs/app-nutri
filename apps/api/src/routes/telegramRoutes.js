const express = require("express");
const {
  telegramWebhookController,
  telegramWebhookInfoController,
} = require("../controllers/telegramController");

const router = express.Router();

router.post("/webhook/telegram", telegramWebhookController);
router.get("/api/telegram/webhook-info", telegramWebhookInfoController);

module.exports = {
  telegramRoutes: router,
};
