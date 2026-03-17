const { logError } = require("../utils/logger");

function notFoundHandler(req, res) {
  res.status(404).json({
    error: "NOT_FOUND",
    message: `Rota nao encontrada: ${req.method} ${req.originalUrl}`,
  });
}

function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || "INTERNAL_ERROR";
  let message = err.message || "Erro interno";

  if (err?.name === "MulterError") {
    statusCode = 400;
    code = err.code || "UPLOAD_ERROR";

    if (err.code === "LIMIT_FILE_SIZE") {
      statusCode = 413;
      message = "Arquivo acima do limite permitido (max 25 MB).";
    }
  }

  logError("request_failed", {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    error: message,
  });

  res.status(statusCode).json({
    error: code,
    message,
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
