const express = require("express");
const { healthRoutes } = require("./healthRoutes");
const { telegramRoutes } = require("./telegramRoutes");
const { trackingRoutes } = require("./trackingRoutes");

const router = express.Router();

router.use(healthRoutes);
router.use(telegramRoutes);
router.use(trackingRoutes);

module.exports = {
  apiRoutes: router,
};
