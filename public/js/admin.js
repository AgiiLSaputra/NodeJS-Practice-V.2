/* ============================================================
   public/js/admin.js - Dashboard admin
   Operasi CRUD -> dipetakan ke HTTP method:
   GET (baca), POST (buat), PUT (ubah), DELETE (hapus), PATCH (ubah sebagian)
   ============================================================ */

const API = "/api";
const $ = (id) => document.getElementById(id);
const rupiah = (n) => "Rp " + Number(n).toLocaleString("id-ID");

let categories = [];

function toast(msg, ok = true) {
  const el = $("toast");
  el.textContent = msg;
  el.className = "show " + (ok ? "ok" : "err");
  setTimeout(() => (el.className = ""), 2600);
}

async function api(url, method = "GET", body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

// ---------- TABS ----------
document.querySelectorAll(".tab").forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    $("panel-" + tab.dataset.panel).classList.add("active");
  };
});

// ---------- STATS ----------
async function loadStats() {
  const { data } = await api(`${API}/stats`);
  $("s-products").textContent = data.total_products;
  $("s-stock").textContent = data.total_stock;
  $("s-orders").textContent = data.total_orders;
  $("s-pending").textContent = data.pending_orders;
  $("s-revenue").textContent = rupiah(data.revenue);
}

// ---------- PRODUK ----------
async function loadProducts() {
  const { data } = await api(`${API}/products?limit=50`);
  $("product-rows").innerHTML = data
    .map(
      (p) => `
    <tr>
      <td>${p.id}</td>
      <td>${esc(p.name)}</td>
      <td>${esc(p.category_name)}</td>
      <td>${rupiah(p.price)}</td>
      <td>${p.stock}</td>
      <td><span class="badge ${p.is_active ? "paid" : "cancelled"}">${p.is_active ? "Aktif" : "Nonaktif"}</span></td>
      <td class="row-actions">
        <button class="btn btn-ghost btn-sm" onclick='openProductForm(${JSON.stringify(p).replace(/'/g, "&#39;")})'>Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">Hapus</button>
      </td>
    </tr>`
    )
    .join("");
}

function openProductForm(p = null) {
  const form = $("product-form");
  form.reset();
  $("product-form-title").textContent = p ? "Edit Produk" : "Tambah Produk";
  fillCategoryOptions();
  if (p) {
    form.id.value = p.id;
    form.name.value = p.name;
    form.category_id.value = p.category_id;
    form.price.value = p.price;
    form.stock.value = p.stock;
    form.description.value = p.description || "";
    form.is_active.checked = p.is_active;
  }
  $("product-overlay").classList.add("open");
}

function fillCategoryOptions() {
  $("product-category").innerHTML = categories
    .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
    .join("");
}

$("product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const payload = {
    name: f.name.value,
    category_id: Number(f.category_id.value),
    price: Number(f.price.value),
    stock: Number(f.stock.value),
    description: f.description.value,
    is_active: f.is_active.checked,
  };
  try {
    if (f.id.value) {
      await api(`${API}/products/${f.id.value}`, "PUT", payload);
      toast("Produk diperbarui");
    } else {
      await api(`${API}/products`, "POST", payload);
      toast("Produk ditambahkan");
    }
    closeModal("product-overlay");
    loadProducts();
    loadStats();
  } catch (err) {
    toast(err.message, false);
  }
});

async function deleteProduct(id) {
  if (!confirm("Hapus produk ini?")) return;
  try {
    await api(`${API}/products/${id}`, "DELETE");
    toast("Produk dihapus");
    loadProducts();
    loadStats();
  } catch (err) {
    toast(err.message, false); // contoh: 409 kalau punya riwayat pesanan
  }
}

// ---------- KATEGORI ----------
async function loadCategories() {
  const { data } = await api(`${API}/categories`);
  categories = data;
  $("category-rows").innerHTML = data
    .map(
      (c) => `
    <tr>
      <td>${c.id}</td>
      <td>${esc(c.name)}</td>
      <td>${esc(c.description || "-")}</td>
      <td>${c.product_count}</td>
      <td class="row-actions">
        <button class="btn btn-ghost btn-sm" onclick='openCategoryForm(${JSON.stringify(c).replace(/'/g, "&#39;")})'>Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCategory(${c.id})">Hapus</button>
      </td>
    </tr>`
    )
    .join("");
}

function openCategoryForm(c = null) {
  const form = $("category-form");
  form.reset();
  $("category-form-title").textContent = c ? "Edit Kategori" : "Tambah Kategori";
  if (c) {
    form.id.value = c.id;
    form.name.value = c.name;
    form.description.value = c.description || "";
  }
  $("category-overlay").classList.add("open");
}

$("category-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const payload = { name: f.name.value, description: f.description.value };
  try {
    if (f.id.value) {
      await api(`${API}/categories/${f.id.value}`, "PUT", payload);
      toast("Kategori diperbarui");
    } else {
      await api(`${API}/categories`, "POST", payload);
      toast("Kategori ditambahkan");
    }
    closeModal("category-overlay");
    loadCategories();
  } catch (err) {
    toast(err.message, false);
  }
});

async function deleteCategory(id) {
  if (!confirm("Hapus kategori ini?")) return;
  try {
    await api(`${API}/categories/${id}`, "DELETE");
    toast("Kategori dihapus");
    loadCategories();
  } catch (err) {
    toast(err.message, false); // contoh: 409 kalau masih ada produk
  }
}

// ---------- PESANAN ----------
async function loadOrders() {
  const { data } = await api(`${API}/orders`);
  $("order-rows").innerHTML = data
    .map(
      (o) => `
    <tr>
      <td>#${o.id}</td>
      <td>${esc(o.customer_name)}<br><small style="color:var(--muted)">${esc(o.customer_email)}</small></td>
      <td>${rupiah(o.total_amount)}</td>
      <td>${o.item_count} item (${o.total_qty} pcs)</td>
      <td>
        <select onchange="changeStatus(${o.id}, this.value)" style="width:130px;padding:6px">
          ${["pending", "paid", "shipped", "cancelled"]
            .map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`)
            .join("")}
        </select>
      </td>
      <td>${new Date(o.created_at).toLocaleDateString("id-ID")}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="showOrderDetail(${o.id})">Detail</button></td>
    </tr>`
    )
    .join("");
}

async function changeStatus(id, status) {
  try {
    await api(`${API}/orders/${id}/status`, "PATCH", { status });
    toast(`Pesanan #${id} -> ${status}`);
    loadStats();
  } catch (err) {
    toast(err.message, false);
  }
}

async function showOrderDetail(id) {
  try {
    const { data } = await api(`${API}/orders/${id}`);
    const items = data.items
      .map((i) => `<li>${i.name} × ${i.quantity} @ ${rupiah(i.unit_price)}</li>`)
      .join("");
    alert(
      `Pesanan #${data.id}\nPelanggan: ${data.customer_name}\nStatus: ${data.status}\nTotal: ${rupiah(data.total_amount)}` +
        (data.notes ? `\nCatatan: ${data.notes}` : "") +
        `\n\nItem:\n${data.items.map((i) => ` - ${i.name} x${i.quantity}`).join("\n")}`
    );
  } catch (err) {
    toast(err.message, false);
  }
}

function closeModal(id) {
  $(id).classList.remove("open");
}

document.querySelectorAll(".overlay").forEach((ov) => {
  ov.addEventListener("click", (e) => {
    if (e.target === ov) ov.classList.remove("open");
  });
});

// ---------- Init ----------
(async function init() {
  try {
    await Promise.all([loadStats(), loadCategories(), loadProducts(), loadOrders()]);
  } catch (err) {
    toast(err.message, false);
  }
})();
