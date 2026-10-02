// ============================================================
// src/middleware/validate.js - Validasi input SEHARUSNYA masuk ke DB
// Membuat error 400 rapi sebelum query SQL dijalankan.
// ============================================================
function validate(rules) {
  return (req, res, next) => {
    const errors = [];
    for (const rule of rules) {
      const value = req.body[rule.field];
      if (rule.required && (value === undefined || value === null || value === "")) {
        errors.push(`"${rule.field}" wajib diisi`);
        continue;
      }
      if (value === undefined || value === null || value === "") continue;
      if (rule.type === "number" && isNaN(Number(value))) {
        errors.push(`"${rule.field}" harus angka`);
      }
      if (rule.min !== undefined && Number(value) < rule.min) {
        errors.push(`"${rule.field}" minimal ${rule.min}`);
      }
      if (rule.max !== undefined && String(value).length > rule.max) {
        errors.push(`"${rule.field}" maksimal ${rule.max} karakter`);
      }
    }
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(", ") });
    }
    next();
  };
}

module.exports = validate;
