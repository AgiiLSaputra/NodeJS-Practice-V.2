const pool = require("../config/database");

// GET /api/orders - header + jumlah item (agregasi GROUP BY)
async function list(req, res, next) {
  try {
    const { rows } = await pool.query(`
      SELECT o.*,
             COUNT(oi.id)::int AS item_count,
             COALESCE(SUM(oi.quantity), 0)::int AS total_qty
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders/:id - header + detail item (JOIN)
async function detail(req, res, next) {
  try {
    const order = await pool.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    if (!order.rows.length) {
      return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan" });
    }
    const items = await pool.query(
      `SELECT oi.quantity, oi.unit_price, p.id AS product_id, p.name
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...order.rows[0], items: items.rows } });
  } catch (err) {
    next(err);
  }
}

// POST /api/orders  ===>  CONTOH TRANSAKSI (bagian paling penting di Day 6)
// Alur: BEGIN -> cek stok (SELECT ... FOR UPDATE) -> insert order -> insert items
//       -> kurangi stok -> COMMIT.  Ada 1 langkah gagal? -> ROLLBACK (semua batal).
async function checkout(req, res, next) {
  const { customer_name, customer_email, notes, items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "Keranjang kosong" });
  }

  const client = await pool.connect(); // ambil 1 koneksi KHUSUS dari pool
  try {
    await client.query("BEGIN");

    let total = 0;
    const snapshot = [];

    for (const item of items) {
      const qty = Number(item.quantity);
      // FOR UPDATE = mengunci baris ini sampai COMMIT/ROLLBACK,
      // mencegah 2 transaksi bersamaan menghabiskan stok yang sama (race condition)
      const { rows } = await client.query(
        "SELECT id, name, price, stock FROM products WHERE id = $1 FOR UPDATE",
        [item.product_id]
      );
      if (!rows.length) {
        throw Object.assign(new Error(`Produk #${item.product_id} tidak ditemukan`), { status: 400, expose: true });
      }
      const product = rows[0];
      if (product.stock < qty) {
        throw Object.assign(
          new Error(`Stok "${product.name}" tidak cukup (sisa ${product.stock})`),
          { status: 409, expose: true }
        );
      }
      total += Number(product.price) * qty;
      snapshot.push({ product, qty });
    }

    const order = await client.query(
      `INSERT INTO orders (customer_name, customer_email, notes, total_amount)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [customer_name, customer_email, notes || null, total]
    );

    for (const { product, qty } of snapshot) {
      await client.query(
        "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)",
        [order.rows[0].id, product.id, qty, product.price]
      );
      await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [qty, product.id]);
    }

    await client.query("COMMIT");
    res.status(201).json({ success: true, data: order.rows[0], message: "Pesanan berhasil!" });
  } catch (err) {
    await client.query("ROLLBACK"); // batalkan SEMUA perubahan
    next(err);
  } finally {
    client.release(); // kembalikan koneksi ke pool (wajib!)
  }
}

// PATCH /api/orders/:id/status
async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const { rows } = await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan" });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === "23514") {
      return res.status(400).json({ success: false, message: "Status tidak valid" });
    }
    next(err);
  }
}

module.exports = { list, detail, checkout, updateStatus };
