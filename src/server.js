// ============================================================
// src/server.js - Titik masuk aplikasi
// Alur: HTTP masuk -> middleware -> router API / file statis -> response
// ============================================================
require("dotenv").config();
const path = require("path");
const express = require("express");
const apiRoutes = require("./routes/api");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json()); // middleware: ubah body JSON -> req.body

// File UI (HTML/CSS/JS) dilayani langsung oleh Express
app.use(express.static(path.join(__dirname, "..", "public")));

// Semua endpoint API di bawah /api
app.use("/api", apiRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Toko Online jalan -> http://localhost:${PORT}`);
});
