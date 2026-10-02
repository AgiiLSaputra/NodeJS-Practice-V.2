// ============================================================
// src/middleware/errorHandler.js
// Penangkap SEMUA error -> response JSON rapi (klien tidak pernah 500 HTML)
// ============================================================
function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`,
  });
}

function errorHandler(err, req, res, next) {
  console.error("[error]", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.expose ? err.message : "Terjadi kesalahan di server",
    ...(process.env.NODE_ENV !== "production" && !err.expose
      ? { detail: err.message }
      : {}),
  });
}

module.exports = { notFound, errorHandler };
