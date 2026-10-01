/* ============================================================
   public/js/app.js - Logic katalog, keranjang, checkout
   Semua data diambil dari REST API (/api/...) lalu dirender ke DOM
   ============================================================ */

const API = "/api";
const state = {
  products: [],
  categories: [],
  page: 1,
  totalPages: 1,
  search: "",
  category: "",
  sort: "newest",
};

// ---------- Keranjang disimpan di localStorage (di browser) ----------
let cart = JSON.parse(localStorage.getItem("nodemart_cart") || "[]");

const rupiah = (n) => "Rp " + Number(n).toLocaleString("id-ID");
const $ = (id) => document.getElementById(id);

function toast(msg, ok = true) {
  const el = $("toast");
  el.textContent = msg;
  el.className = "show " + (ok ? "ok" : "err");
  setTimeout(() => (el.className = ""), 2600);
}

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.message || `HTTP ${res.status}`);
  }
  return json;
}

// ---------- KATEGORI ----------
async function loadCategories() {
  const { data } = await fetchJSON(`${API}/categories`);
  state.categories = data;
  $("chips").innerHTML =
    `<button class="chip ${state.category === "" ? "active" : ""}" data-id="">Semua</button>` +
    data
      .map(
        (c) =>
          `<button class="chip ${String(state.category) === String(c.id) ? "active" : ""}" data-id="${c.id}">${c.name} (${c.product_count})</button>`
      )
      .join("");

  document.querySelectorAll("#chips .chip").forEach((chip) => {
    chip.onclick = () => {
      state.category = chip.dataset.id;
      state.page = 1;
      loadCategories();
      loadProducts();
    };
  });
}

// ---------- PRODUK ----------
async function loadProducts() {
  const params = new URLSearchParams({
    page: state.page,
    limit: 12,
    sort: state.sort,
    search: state.search,
  });
  if (state.category) params.set("category", state.category);

  const { data, meta } = await fetchJSON(`${API}/products?${params}`);
  state.products = data;
  state.totalPages = meta.total_pages || 1;

  const grid = $("product-grid");
  if (!data.length) {
    grid.innerHTML = `<div class="empty">Tidak ada produk ditemukan.</div>`;
  } else {
    grid.innerHTML = data.map(cardHTML).join("");
  }
  renderPagination(meta);
}

function cardHTML(p) {
  const emoji = emojiFor(p.category_name);
  const stockClass = p.stock === 0 ? "out" : p.stock <= 5 ? "low" : "";
  const stockText = p.stock === 0 ? "Habis" : `Stok ${p.stock}`;
  const inCart = cart.find((i) => i.product_id === p.id);
  return `
    <div class="card">
      <div class="emoji">${emoji}</div>
      <span class="cat">${p.category_name}</span>
      <h3>${escapeHTML(p.name)}</h3>
      <p class="desc">${escapeHTML(p.description || "")}</p>
      <div class="price-row">
        <span class="price">${rupiah(p.price)}</span>
        <span class="stock ${stockClass}">${stockText}</span>
      </div>
      <button class="btn btn-primary" ${p.stock === 0 ? "disabled" : ""} onclick="addToCart(${p.id})">
        ${p.stock === 0 ? "Stok Habis" : inCart ? `In keranjang (${inCart.quantity})` : "+ Keranjang"}
      </button>
    </div>`;
}

function emojiFor(cat) {
  const map = {
    Elektronik: "🎧",
    Fashion: "👕",
    "Rumah Tangga": "🏠",
    Kesehatan: "💊",
  };
  return map[cat] || "📦";
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function renderPagination(meta) {
  const el = $("pagination");
  el.innerHTML = `
    <button ${meta.page <= 1 ? "disabled" : ""} onclick="goPage(${meta.page - 1})">‹ Prev</button>
    <span class="page-info">Hal ${meta.page} / ${meta.total_pages || 1} (${meta.total} produk)</span>
    <button ${meta.page >= meta.total_pages ? "disabled" : ""} onclick="goPage(${meta.page + 1})">Next ›</button>`;
}

function goPage(p) {
  state.page = p;
  loadProducts();
}

// ---------- KERANJANG ----------
function addToCart(productId) {
  const p = state.products.find((x) => x.id === productId);
  if (!p) return;
  const item = cart.find((i) => i.product_id === productId);
  if (item) {
    if (item.quantity >= p.stock) return toast(`Stok "${p.name}" tinggal ${p.stock}`, false);
    item.quantity++;
  } else {
    cart.push({ product_id: p.id, name: p.name, price: p.price, quantity: 1 });
  }
  saveCart();
  loadProducts();
  toast(`"${p.name}" masuk keranjang`);
}

function changeQty(productId, delta) {
  const item = cart.find((i) => i.product_id === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart = cart.filter((i) => i.product_id !== productId);
  saveCart();
  renderCart();
}

function saveCart() {
  localStorage.setItem("nodemart_cart", JSON.stringify(cart));
  $("cart-badge").textContent = cart.reduce((s, i) => s + i.quantity, 0);
}

function cartTotal() {
  return cart.reduce((s, i) => s + i.price * i.quantity, 0);
}

function openCart() {
  renderCart();
  $("cart-overlay").classList.add("open");
}

function renderCart() {
  const box = $("cart-items");
  if (!cart.length) {
    box.innerHTML = `<div class="empty">Keranjang kosong 🛒</div>`;
  } else {
    box.innerHTML = cart
      .map(
        (i) => `
      <div class="cart-item">
        <div class="info">
          <div class="name">${escapeHTML(i.name)}</div>
          <div class="sub">${rupiah(i.price)} / pcs</div>
        </div>
        <div class="qty-control">
          <button onclick="changeQty(${i.product_id}, -1)">−</button>
          <span>${i.quantity}</span>
          <button onclick="changeQty(${i.product_id}, 1)">+</button>
        </div>
        <strong>${rupiah(i.price * i.quantity)}</strong>
      </div>`
      )
      .join("");
  }
  $("cart-total").textContent = rupiah(cartTotal());
  $("checkout-btn").disabled = !cart.length;
}

function openCheckout() {
  if (!cart.length) return;
  closeModal("cart-overlay");
  $("checkout-total").textContent = rupiah(cartTotal());
  $("checkout-overlay").classList.add("open");
}

function closeModal(id) {
  $(id).classList.remove("open");
}

// ---------- CHECKOUT -> POST /api/orders (transaksi di server) ----------
$("checkout-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const payload = {
    customer_name: form.get("customer_name"),
    customer_email: form.get("customer_email"),
    notes: form.get("notes"),
    items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
  };
  try {
    const { data } = await fetchJSON(`${API}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    cart = [];
    saveCart();
    e.target.reset();
    closeModal("checkout-overlay");
    toast(`Pesanan #${data.id} berhasil! Total ${rupiah(data.total_amount)}`);
    loadProducts();
  } catch (err) {
    toast(err.message, false);
  }
});

// ---------- Debounce search ----------
let searchTimer;
$("search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = e.target.value.trim();
    state.page = 1;
    loadProducts();
  }, 350);
});

$("sort").addEventListener("change", (e) => {
  state.sort = e.target.value;
  state.page = 1;
  loadProducts();
});

// ---------- Klik overlay untuk menutup ----------
document.querySelectorAll(".overlay").forEach((ov) => {
  ov.addEventListener("click", (e) => {
    if (e.target === ov) ov.classList.remove("open");
  });
});

// ---------- Init ----------
saveCart();
loadCategories().then(loadProducts).catch((e) => toast(e.message, false));
