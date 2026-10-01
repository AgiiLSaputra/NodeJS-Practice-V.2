const pool = require("../config/database");

// GET /api/categories - JOIN menghitung jumlah produk per kategori
async function list(req, res, next) {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.description, c.created_at,
             COUNT(p.id)::int AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// POST /api/categories
async function create(req, res, next) {
  try {
    const { name, description } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *",
      [name, description || null]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ success: false, message: "Kategori sudah ada" });
    }
    next(err);
  }
}

// PUT /api/categories/:id
async function update(req, res, next) {
  try {
    const { name, description } = req.body;
    const { rows } = await pool.query(
      "UPDATE categories SET name = $1, description = $2 WHERE id = $3 RETURNING *",
      [name, description || null, req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Kategori tidak ditemukan" });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ success: false, message: "Kategori sudah ada" });
    }
    next(err);
  }
}

// DELETE /api/categories/:id - ditolak (409) kalau masih ada produk (ON DELETE RESTRICT)
async function remove(req, res, next) {
  try {
    const { rowCount } = await pool.query("DELETE FROM categories WHERE id = $1", [req.params.id]);
    if (!rowCount) {
      return res.status(404).json({ success: false, message: "Kategori tidak ditemukan" });
    }
    res.json({ success: true, message: "Kategori dihapus" });
  } catch (err) {
    if (["23503", "23001"].includes(err.code)) {
      return res
        .status(409)
        .json({ success: false, message: "Masih ada produk di kategori ini" });
    }
    next(err);
  }
}

module.exports = { list, create, update, remove };
