# 📖 PENJELASAN PROJECT — Day 6: Toko Online (Node.js + PostgreSQL)

> File ini bukan kode, tapi **peta pemahaman**: apa yang dibuat, kenapa dibuat,
> dan bagaimana semuanya mengalir dari klik tombol sampai data masuk database.

---

## 1. Project Ini Apa? Kenapa Ada?

**NodeMart** adalah toko online sederhana dengan 2 bagian:

| Bagian | URL | Fungsi |
|---|---|---|
| **Toko (Katalog)** | `/` (index.html) | Pelanggan lihat produk, cari, masukkan keranjang, checkout |
| **Admin** | `/admin.html` | Penjual lihat statistik, kelola produk/kategori, ubah status pesanan |

**Tujuan pembelajaran Day 6** — memahami 3 hal yang di hari sebelumnya (Day 2–5)
dikerjakan "diam-diam" oleh Prisma:

1. **SQL asli** — query yang benar-benar dikirim ke PostgreSQL.
2. **Relasi tabel** — data dipecah jadi banyak tabel yang saling terhubung.
3. **Transaksi** — many step yang harus "semua berhasil atau semua batal".

---

## 2. Alur Besar (Big Picture)

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER (public/)                                              │
│  index.html / admin.html + app.js / admin.js                    │
│  RENDer tampilan, simpan keranjang di localStorage              │
└───────────────┬─────────────────────────────────────────────────┘
                │  fetch("/api/products")   ← HTTP request (JSON)
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  EXPRESS (src/server.js)                                        │
│  1. express.json()      → ubah body JSON jadi req.body          │
│  2. express.static()    → sajikan file UI                       │
│  3. /api routes         → arahkan ke controller yang benar      │
│  4. errorHandler        → ubah error jadi JSON rapi             │
└───────────────┬─────────────────────────────────────────────────┘
                │  pool.query("SELECT ... $1", [parameter])
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  POSTGRESQL (database: day6_toko)                               │
│  categories │ products │ orders │ order_items  + index          │
│  Eksekusi SQL, kembalikan baris (rows)                          │
└───────────────┬─────────────────────────────────────────────────┘
                │  rows
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  CONTROLLER → res.json({ success: true, data: ... })            │
│  Browser menerima JSON → app.js ubah jadi tampilan HTML         │
└─────────────────────────────────────────────────────────────────┘
```

**Kata kuncinya:** browser tidak pernah menyentuh database langsung.
Browser hanya bicara **HTTP + JSON** ke Express; hanya Express yang bicara **SQL** ke PostgreSQL.

---

## 3. Glosarium — Semua Istilah & Guna-nya

### 🔌 REST API — *guna: standar komunikasi antar program*

**REST** = gaya desain memakai HTTP sebagai "bahasa" untuk CRUD:

| Aksi | Method HTTP | Endpoint | Contoh di project ini |
|---|---|---|---|
| **Baca** data | `GET` | `/api/products` | Katalog memuat daftar produk |
| **Buat** data | `POST` | `/api/orders` | Checkout → buat pesanan baru |
| **Ubah** data | `PUT` | `/api/products/1` | Edit produk di admin |
| **Ubah sebagian** | `PATCH` | `/api/orders/1/status` | Ubah status saja (pending→paid) |
| **Hapus** data | `DELETE` | `/api/categories/1` | Hapus kategori |

**Kenapa perlu?** Karena UI (browser) dan backend bisa dibuat/diganti terpisah.
Hari ini UI-nya HTML biasa; besok bisa diganti React/Android tanpa mengubah backend,
selama "kontrak" endpoint-nya sama. REST = kontrak itu.

**Bentuk response (kontrak project ini):**
```json
{ "success": true,  "data": [...], "meta": { "page": 1, "total": 12 } }
{ "success": false, "message": "Stok tidak cukup" }
```

**Status code** (kode singkat hasil):
- `200` OK · `201` Created · `400` Input salah · `404` Tidak ada
- `409` Konflik (stok kurang / data masih dipakai) · `500` Error server

---

### 🗄️ Database & PostgreSQL — *guna: penyimpanan data permanen*

Database = gudang data yang tersimpan walau server mati (berbeda dengan
`localStorage` yang cuma ada di browser). **PostgreSQL** = jenis database yang
kita pakai — kuat, gratis, mendukung relasi & transaksi.

**4 tabel di project ini:**

```
categories (1) ──────< products (banyak)          ← satu kategori punya banyak produk
orders     (1) ──────< order_items (banyak)       ← satu pesanan punya banyak item
products   (1) ──────< order_items (banyak)       ← satu produk bisa di banyak pesanan
```

| Tabel | Isi | Kolom penting |
|---|---|---|
| `categories` | Jenis produk | `name`, `description` |
| `products` | Barang dagangan | `price`, `stock`, `category_id` (FK) |
| `orders` | Header pesanan | `customer_name`, `status`, `total_amount` |
| `order_items` | Detail tiap pesanan | `quantity`, `unit_price` (harga saat dibeli) |

**Istilah kunci:**
- **PRIMARY KEY** (`id`) — nomor unik tiap baris, tidak boleh sama.
- **FOREIGN KEY** (`category_id`) — "tali" penghubung ke tabel lain.
  Di sini ada 2 perilaku:
  - `ON DELETE RESTRICT` (products→categories): kategori **tidak bisa dihapus**
    kalau masih ada produknya → server balas `409`. (Diuji: berhasil ✅)
  - `ON DELETE CASCADE` (order_items→orders): hapus pesanan → item-nya ikut hilang.
- **CHECK** — aturan di dalam DB, mis. `stock >= 0`, `price >= 0`.
  Ini "penjaga terakhir" meski validasi sudah ada di aplikasi.
- **INDEX** — "daftar isi" supaya pencarian/filter cepat tanpa memindai seluruh tabel.

---

### 🧰 ORM vs Raw SQL — *guna: 2 cara menulis query*

| | **ORM** (Prisma di Day 2–5) | **Raw SQL** (pg di Day 6) |
|---|---|---|
| Cara kerja | Tulis kode JS/TS → library menerjemahkan jadi SQL | Kamu menulis SQL sendiri |
| Contoh | `prisma.product.findMany({ where: { stock: { gt: 0 } } })` | `SELECT * FROM products WHERE stock > 0` |
| Kelebihan | Cepat, type-safe, migrasi otomatis, tidak perlu tahu SQL | Kontrol penuh, query optimal, bisa fitur SQL lanjutan |
| Kekurangan | Query kompleks susah dioptimasi, "magic" tersembunyi | Kode lebih manual, rawan salah ketik SQL |
| Cocok untuk | Aplikasi CRUD biasa, tim yang ingin cepat | Query report/analytics, butuh performa maksimal |

> **Kesimpulan belajar:** Prisma dan `pg` bukan saingan — banyak tim pakai keduanya.
> Yang penting kamu **paham SQL-nya** (Day 6), baru ORM terasa "membantu"
> bukan "menyembunyikan".

**`pg` (node-postgres)** = driver resmi: penerjemah antara kode Node.js ↔ PostgreSQL.
Inti-nya hanya satu fungsi:

```js
await pool.query("SELECT * FROM products WHERE id = $1", [1]);
//                  ↑ SQL dengan placeholder      ↑ parameter
```

- **`$1`, `$2`...** = placeholder. Nilai **tidak** disisipkan ke string SQL,
  tapi dikirim terpisah → inilah cara mencegah **SQL injection**
  (serangan menyisipkan `' OR '1'='1` lewat input). ❌ Jangan pernah
  menyusun SQL lewat interpolasi string `` `... ${name}` ``.
- **`pool`** = kumpulan koneksi yang dipakai ulang (connection pool),
  supaya tidak buka-tutup koneksi tiap request (hemat waktu & resource).

---

### 🧮 Membaca 4 Pola Query di Project

**1. JOIN** — menggabungkan tabel terkait (di `GET /api/products`):
```sql
SELECT p.*, c.name AS category_name
FROM products p
JOIN categories c ON c.id = p.category_id
```
→ Satu produk tampil lengkap dengan nama kategorinya, tanpa perlu 2 request.

**2. Parameterized query + filter dinamis** (list produk):
```sql
WHERE (p.name ILIKE '%' || $1 || '%')     -- $1 = kata kunci pencarian
  AND ($2::int IS NULL OR p.category_id = $2)  -- $2 = filter kategori (null = semua)
```
→ 1 query bisa dipakai untuk banyak kasus, pencarian pakai `ILIKE` (case-insensitive).

**3. Window function** — hitung total tanpa query kedua:
```sql
COUNT(*) OVER()::int AS total_rows
```
→ untuk pagination (tahu total halaman) hanya 1 kali query.

**4. Agregasi** — merangkum jadi 1 angka (dashboard stats):
```sql
SELECT (SELECT COUNT(*) FROM products),
       (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status IN ('paid','shipped'))
```

---

### 💥 TRANSAKSI — *guna: menjaga data tetap konsisten*

**Masalah tanpa transaksi:** saat checkout, program melakukan 3 langkah:
1. Insert pesanan
2. Insert item
3. Kurangi stok

Kalau langkah 3 gagal (server mati di tengah jalan), pesanan sudah tercatat
tapi stok tidak berkurang → **data rusak**.

**Solusi — 2 perintah database:**
```js
await client.query("BEGIN");   // mulai "semua atau tidak sama sekali"
try {
  // ... semua langkah ...
  await client.query("COMMIT"); // sahkan semua
} catch (err) {
  await client.query("ROLLBACK"); // batalkan SEMUA, kembali seperti semula
}
```

**Yang istimewa di checkout (`orderController.js`):**
```sql
SELECT ... FROM products WHERE id = $1 FOR UPDATE
```
`FOR UPDATE` = **mengunci baris** itu sampai transaksi selesai.
Dua pembeli bersamaan yang menghabiskan stok terakhir tidak akan saling
"menyundul" → mencegah **race condition** (stok bisa jadi minus).

**Bukti sudah bekerja (diuji):**
- Checkout 2 produk sukses → stok berkurang tepat ✅
- Minta 999 padahal stok 6 → ditolak `409`, stok tetap 6 (ROLLBACK) ✅

---

### 🧱 Bagian Lain yang Penting

| Istilah | Guna | Di mana? |
|---|---|---|
| **Middleware** | Fungsi yang jalan **sebelum** controller (urutan: validasi → controller → error handler) | `validate.js`, `errorHandler.js` |
| **Validasi input** | Tolak data aneh (field kosong, angka negatif) dengan `400` sebelum menyentuh DB | `src/middleware/validate.js` |
| **Error handler** | Penangkap akhir → semua error jadi JSON rapi, bukan halaman 500 HTML | `src/middleware/errorHandler.js` |
| **Migrasi/Schema** | Mendefinisikan struktur tabel (versi SQL dari Prisma schema) | `db/schema.sql` |
| **Seed** | Data dummy biar langsung bisa dicoba | `db/seed.js` |
| **RESTRICT error code** | PG 18 memakai kode `23001` (bukan `23503`) untuk pelanggaran FK RESTRICT → dikonversi jadi response `409` | `categoryController.js`, `productController.js` |
| **localStorage** | Keranjang belanja disimpan di browser (bukan database, karena belum login) | `public/js/app.js` |

---

## 4. Peta File — Apa Guna Setiap File

```
Day6/
├── penjelasan.md            ← file ini (peta pemahaman)
├── package.json             ← dependensi: express, pg, dotenv
├── .env                     ← kredensial database (RAHASIA, tidak di-commit)
│
├── db/
│   ├── schema.sql           ← DDL: membuat 4 tabel + index
│   ├── init.js              ← bikin database + jalankan schema.sql
│   └── seed.js              ← isi data dummy (1 transaksi contoh)
│
├── src/
│   ├── server.js            ← titik masuk: middleware → routes → listen
│   ├── config/database.js   ← pg.Pool (koneksi ke PostgreSQL)
│   ├── routes/api.js        ← peta URL → controller + aturan validasi
│   ├── controllers/
│   │   ├── categoryController.js  ← CRUD kategori (JOIN, tangani FK)
│   │   ├── productController.js   ← CRUD produk + search/pagination
│   │   ├── orderController.js     ← ★ checkout dengan TRANSAKSI + FOR UPDATE
│   │   └── statsController.js     ← agregasi untuk dashboard admin
│   └── middleware/
│       ├── validate.js            ← cek input sebelum masuk controller
│       └── errorHandler.js        ← 404 & error → JSON
│
└── public/                  ← UI (dilayani langsung oleh Express)
    ├── index.html           ← katalog toko
    ├── admin.html           ← dashboard admin
    ├── css/style.css        ← tema Liquid Glass
    └── js/
        ├── app.js           ← render produk, keranjang, checkout
        └── admin.js         ← stats, CRUD, ubah status pesanan
```

---

## 5. Alur 1 Aksi Lengkap: Checkout

Ketika pelanggan klik **"Buat Pesanan"**:

1. **`app.js`** kumpulkan data keranjang → `fetch POST /api/orders` (JSON body).
2. **`server.js`** terima → `express.json()` ubah jadi `req.body`.
3. **`routes/api.js`** cocokkan `POST /api/orders` → jalankan **`validate`** dulu
   (nama & email wajib ada → kalau kosong, balas `400` dan berhenti di sini).
4. **`orderController.checkout`** buat **transaksi**:
   - `BEGIN`
   - Tiap item: `SELECT ... FOR UPDATE` → cek stok cukup?
     - Tidak cukup → lempar error `409` → **`ROLLBACK`** → semua batal.
   - `INSERT orders` → `INSERT order_items` → `UPDATE products SET stock = stock - qty`
   - `COMMIT`
5. Balasan JSON `{ success: true, data: { id: 4, total_amount: 285000 } }`.
6. **`app.js`** kosongkan keranjang, tampilkan toast sukses, refresh daftar produk
   (stok terbaru tampil karena diambil ulang dari database).

Urutan serupa untuk aksi lain: **route → validate → controller → SQL → JSON → render**.

---

## 6. Cara Menjalankan

```bash
npm install          # sekali saja
npm run db:init      # buat database day6_toko + tabel
npm run db:seed      # isi data dummy
npm run dev          # jalankan server

# Buka:
#   Toko  -> http://localhost:3000/
#   Admin -> http://localhost:3000/admin.html
```

Reset total (hapus database + buat ulang): `npm run db:reset && npm run db:seed`

---

## 7. Langkah Belajar Selanjutnya

1. **JWT Auth** — halaman admin dilindungi login (kamu sudah bisa di Day 2/4).
2. **Full-text search** — `tsvector` + GIN index untuk pencarian lebih pintar dari `ILIKE`.
3. **Prisma kembali** — bandingkan menulis ulang 1 endpoint pakai Prisma, rasakan bedanya.
4. **Testing** — unit test controller pakai database test terisolasi.
5. **Pagination di admin** — produk ditampilkan >50, pakai meta.total_pages.
