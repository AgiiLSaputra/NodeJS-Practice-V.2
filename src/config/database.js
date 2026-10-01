// ============================================================
// src/config/database.js - Koneksi PostgreSQL (tanpa ORM)
// pg.Pool = "kumpulan koneksi" yang dipakai ulang tiap query
// ============================================================
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  database: process.env.PGDATABASE || "day6_toko",
  max: 10, // maksimal koneksi simultan di pool
});

// Event penting: tahu kalau ada koneksi yang bocor/rusak
pool.on("error", (err) => {
  console.error("[pg] Pool error tak terduga:", err.message);
});

module.exports = pool;
