const express = require("express");
const { healthRoutes } = require("./healthRoutes");
const { telegramRoutes } = require("./telegramRoutes");

const router = express.Router();

router.use(healthRoutes);
router.use(telegramRoutes);

module.exports = {
  apiRoutes: router,
};
