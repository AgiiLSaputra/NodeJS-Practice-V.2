const pool = require("../config/database");

// GET /api/stats - dashboard admin: agregasi (COUNT/SUM) dalam 1 query
async function stats(req, res, next) {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM products WHERE is_active)::int                    AS total_products,
        (SELECT COALESCE(SUM(stock), 0) FROM products)::int                     AS total_stock,
        (SELECT COUNT(*) FROM orders)::int                                      AS total_orders,
        (SELECT COUNT(*) FROM orders WHERE status = 'pending')::int             AS pending_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders
          WHERE status IN ('paid', 'shipped'))::numeric                         AS revenue,
        (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi
          JOIN orders o ON o.id = oi.order_id WHERE o.status <> 'cancelled')::int AS items_sold
    `);
    const topProducts = await pool.query(`
      SELECT p.name, COALESCE(SUM(oi.quantity), 0)::int AS sold
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      GROUP BY p.id ORDER BY sold DESC LIMIT 5
    `);
    res.json({ success: true, data: { ...rows[0], top_products: topProducts.rows } });
  } catch (err) {
    next(err);
  }
}

module.exports = { stats };
