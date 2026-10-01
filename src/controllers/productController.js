const pool = require("../config/database");

// GET /api/products?search=&category=&page=&limit=&sort=
// PAGINATION + SEARCH + FILTER, semuanya lewat 1 query parameterized
async function list(req, res, next) {
  try {
    const search = (req.query.search || "").trim();
    const category = req.query.category ? Number(req.query.category) : null;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const offset = (page - 1) * limit;
    const sortMap = {
      newest: "p.created_at DESC",
      price_asc: "p.price ASC",
      price_desc: "p.price DESC",
      name: "p.name ASC",
    };
    const orderBy = sortMap[req.query.sort] || sortMap.newest;

    const { rows } = await pool.query(
      `SELECT p.*, c.name AS category_name,
              COUNT(*) OVER()::int AS total_rows   -- window function: total tanpa query kedua
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE (p.name ILIKE '%' || $1 || '%' OR p.description ILIKE '%' || $1 || '%')
         AND ($2::int IS NULL OR p.category_id = $2)
         AND p.is_active = TRUE
       ORDER BY ${orderBy}
       LIMIT $3 OFFSET $4`,
      [search, category, limit, offset]
    );

    const total = rows.length ? rows[0].total_rows : 0;
    res.json({
      success: true,
      data: rows.map(({ total_rows, ...r }) => r),
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/products/:id - ambil produk + 5 produk sejenis (subquery)
async function detail(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Produk tidak ditemukan" });
    }
    const related = await pool.query(
      `SELECT id, name, price FROM products
       WHERE category_id = $1 AND id <> $2 AND is_active = TRUE
       ORDER BY RANDOM() LIMIT 5`,
      [rows[0].category_id, req.params.id]
    );
    res.json({ success: true, data: { ...rows[0], related: related.rows } });
  } catch (err) {
    next(err);
  }
}

// POST /api/products
async function create(req, res, next) {
  try {
    const { category_id, name, price, stock, description } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO products (category_id, name, price, stock, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [category_id, name, price, stock || 0, description || null]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (["23503", "23001"].includes(err.code)) {
      return res.status(400).json({ success: false, message: "Kategori tidak valid" });
    }
    next(err);
  }
}

// PUT /api/products/:id
async function update(req, res, next) {
  try {
    const { category_id, name, price, stock, description, is_active } = req.body;
    const { rows } = await pool.query(
      `UPDATE products
       SET category_id = $1, name = $2, price = $3, stock = $4,
           description = $5, is_active = $6, updated_at = now()
       WHERE id = $7 RETURNING *`,
      [category_id, name, price, stock, description || null, is_active !== false, req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Produk tidak ditemukan" });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (["23503", "23001"].includes(err.code)) {
      return res.status(400).json({ success: false, message: "Kategori tidak valid" });
    }
    next(err);
  }
}

// DELETE /api/products/:id - RESTRICT: gagal (409) kalau pernah dipesan
async function remove(req, res, next) {
  try {
    const { rowCount } = await pool.query("DELETE FROM products WHERE id = $1", [req.params.id]);
    if (!rowCount) {
      return res.status(404).json({ success: false, message: "Produk tidak ditemukan" });
    }
    res.json({ success: true, message: "Produk dihapus" });
  } catch (err) {
    if (["23503", "23001"].includes(err.code)) {
      return res.status(409).json({
        success: false,
        message: "Produk punya riwayat pesanan, nonaktifkan saja (is_active=false)",
      });
    }
    next(err);
  }
}

module.exports = { list, detail, create, update, remove };
