const router = require("express").Router();
const validate = require("../middleware/validate");
const categories = require("../controllers/categoryController");
const products = require("../controllers/productController");
const orders = require("../controllers/orderController");
const { stats } = require("../controllers/statsController");

// ---- KATEGORI ----
router.get("/categories", categories.list);
router.post("/categories", validate([
  { field: "name", required: true, max: 100 },
]), categories.create);
router.put("/categories/:id", validate([
  { field: "name", required: true, max: 100 },
]), categories.update);
router.delete("/categories/:id", categories.remove);

// ---- PRODUK ----
router.get("/products", products.list);
router.get("/products/:id", products.detail);
router.post("/products", validate([
  { field: "name", required: true, max: 200 },
  { field: "category_id", required: true, type: "number" },
  { field: "price", required: true, type: "number", min: 0 },
  { field: "stock", type: "number", min: 0 },
]), products.create);
router.put("/products/:id", validate([
  { field: "name", required: true, max: 200 },
  { field: "category_id", required: true, type: "number" },
  { field: "price", required: true, type: "number", min: 0 },
  { field: "stock", required: true, type: "number", min: 0 },
]), products.update);
router.delete("/products/:id", products.remove);

// ---- PESANAN ----
router.get("/orders", orders.list);
router.get("/orders/:id", orders.detail);
router.post("/orders", validate([
  { field: "customer_name", required: true, max: 150 },
  { field: "customer_email", required: true, max: 200 },
]), orders.checkout);
router.patch("/orders/:id/status", validate([
  { field: "status", required: true },
]), orders.updateStatus);

// ---- STATISTIK ----
router.get("/stats", stats);

module.exports = router;
