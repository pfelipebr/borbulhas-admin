'use strict';

// ── State ──────────────────────────────────────────────────────
let currentPage   = 1;
let currentLimit  = 20;
let totalPages    = 1;
let editingId     = null;
let searchTimeout = null;

// ── DOM References ─────────────────────────────────────────────
const productsBody       = document.getElementById('productsBody');
const pagination         = document.getElementById('pagination');
const paginationInfo     = document.getElementById('paginationInfo');
const paginationControls = document.getElementById('paginationControls');
const searchInput        = document.getElementById('searchInput');
const categoriaFilter    = document.getElementById('categoriaFilter');
const apenasAtivos       = document.getElementById('apenasAtivos');
const clearFiltersBtn    = document.getElementById('clearFiltersBtn');
const newProductBtn      = document.getElementById('newProductBtn');
const productModal       = document.getElementById('productModal');
const modalTitle         = document.getElementById('modalTitle');
const modalClose         = document.getElementById('modalClose');
const modalCancelBtn     = document.getElementById('modalCancelBtn');
const modalSaveBtn       = document.getElementById('modalSaveBtn');
const productForm        = document.getElementById('productForm');

// ── Formatters ─────────────────────────────────────────────────
function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function categoryBadge(cat) {
  const map = {
    vinhos:      { cls: 'badge-vinho',     label: '🍷 Vinhos' },
    chocolates:  { cls: 'badge-chocolate', label: '🍫 Chocolates' },
    presentes:   { cls: 'badge-presente',  label: '🎁 Presentes' },
  };
  const info = map[cat] || { cls: 'badge-default', label: cat };
  return `<span class="badge ${info.cls}">${info.label}</span>`;
}

// ── Toast Notifications ────────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', warning: '⚠️' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '💬'}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Fechar">×</button>
  `;

  container.appendChild(toast);

  const remove = () => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove());
  };

  toast.querySelector('.toast-close').addEventListener('click', remove);
  setTimeout(remove, 4000);
}

// ── API Helper ─────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    clearAuth();
    window.location.href = 'index.html';
    return null;
  }

  return res;
}

// ── Load Products ──────────────────────────────────────────────
async function loadProducts(page = 1) {
  currentPage = page;

  const params = new URLSearchParams();
  params.set('page', page);
  params.set('limit', currentLimit);

  const search    = searchInput.value.trim();
  const categoria = categoriaFilter.value;
  const soAtivos  = apenasAtivos.checked;

  if (search)    params.set('search', search);
  if (categoria) params.set('categoria', categoria);
  if (soAtivos)  params.set('ativo', 'true');

  productsBody.innerHTML = `
    <tr class="loading-row">
      <td colspan="7"><span class="spinner"></span> Carregando…</td>
    </tr>
  `;
  pagination.style.display = 'none';

  try {
    const res = await apiFetch(`/api/products?${params}`);
    if (!res) return;

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao carregar produtos.', 'error');
      productsBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--gray-500)">Erro ao carregar produtos.</td></tr>';
      return;
    }

    renderProducts(data.products);
    renderStats(data.stats);
    renderPagination(data.pagination);

  } catch (err) {
    console.error('Load products error:', err);
    showToast('Não foi possível carregar os produtos.', 'error');
    productsBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--gray-500)">Erro de conexão.</td></tr>';
  }
}

// ── Render Products Table ──────────────────────────────────────
function renderProducts(products) {
  if (!products || products.length === 0) {
    productsBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <span class="empty-icon">📦</span>
            <h3>Nenhum produto encontrado</h3>
            <p class="text-muted">Tente ajustar os filtros ou crie um novo produto.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  productsBody.innerHTML = products.map(p => `
    <tr>
      <td>
        <div class="product-name" title="${escHtml(p.nome)}">${escHtml(p.nome)}</div>
        <div class="product-id">${escHtml(p.id)}</div>
      </td>
      <td>${categoryBadge(p.categoria)}</td>
      <td>${p.subcategoria ? escHtml(p.subcategoria) : '<span class="text-muted">—</span>'}</td>
      <td><span class="price">${formatBRL(p.preco)}</span></td>
      <td>${p.destaque ? '<span class="star-icon" title="Em destaque">⭐</span>' : '<span class="text-muted">—</span>'}</td>
      <td>
        <span class="badge ${p.ativo ? 'badge-ativo' : 'badge-inativo'}">
          ${p.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        <div class="actions">
          <button class="btn btn-ghost btn-sm" title="Editar" onclick="openEditModal('${escHtml(p.id)}')">✏️</button>
          <button class="btn btn-ghost btn-sm" title="${p.ativo ? 'Desativar' : 'Ativar'}" onclick="toggleProduct('${escHtml(p.id)}', ${p.ativo})">
            ${p.ativo ? '🔴' : '🟢'}
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Render Stats ───────────────────────────────────────────────
function renderStats(stats) {
  if (!stats) return;
  document.getElementById('statTotal').textContent      = stats.total || 0;
  document.getElementById('statAtivo').textContent      = stats.total_ativo || 0;
  document.getElementById('statVinhos').textContent     = stats.total_vinhos || 0;
  document.getElementById('statChocolates').textContent = stats.total_chocolates || 0;
  document.getElementById('statPresentes').textContent  = stats.total_presentes || 0;
}

// ── Render Pagination ──────────────────────────────────────────
function renderPagination(pag) {
  totalPages = pag.totalPages;

  if (pag.total === 0) {
    pagination.style.display = 'none';
    return;
  }

  pagination.style.display = 'flex';

  const start = (pag.page - 1) * pag.limit + 1;
  const end   = Math.min(pag.page * pag.limit, pag.total);
  paginationInfo.textContent = `Exibindo ${start}–${end} de ${pag.total} produtos`;

  const controls = [];

  // Prev button
  controls.push(`
    <button class="page-btn" onclick="loadProducts(${pag.page - 1})"
      ${pag.page <= 1 ? 'disabled' : ''}>‹</button>
  `);

  // Page numbers
  const range = pageRange(pag.page, pag.totalPages);
  range.forEach(p => {
    if (p === '…') {
      controls.push('<span style="padding:0 0.25rem;color:var(--gray-500)">…</span>');
    } else {
      controls.push(`
        <button class="page-btn ${p === pag.page ? 'active' : ''}" onclick="loadProducts(${p})">${p}</button>
      `);
    }
  });

  // Next button
  controls.push(`
    <button class="page-btn" onclick="loadProducts(${pag.page + 1})"
      ${pag.page >= pag.totalPages ? 'disabled' : ''}>›</button>
  `);

  paginationControls.innerHTML = controls.join('');
}

function pageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = [];
  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, '…', total);
  } else if (current >= total - 3) {
    pages.push(1, '…', total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, '…', current - 1, current, current + 1, '…', total);
  }
  return pages;
}

// ── Toggle Product Active ──────────────────────────────────────
async function toggleProduct(id, currentlyActive) {
  try {
    const res = await apiFetch(`/api/products/${encodeURIComponent(id)}/toggle`, { method: 'PATCH' });
    if (!res) return;

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao alternar status.', 'error');
      return;
    }

    showToast(data.message, 'success');
    loadProducts(currentPage);
  } catch (err) {
    console.error('Toggle error:', err);
    showToast('Erro de conexão.', 'error');
  }
}

// ── Modal: Open for New Product ────────────────────────────────
function openNewModal() {
  editingId = null;
  modalTitle.textContent = 'Novo Produto';
  productForm.reset();
  document.getElementById('productIdOriginal').value = '';
  document.getElementById('fAtivo').checked = true;
  document.getElementById('fDestaque').checked = false;
  document.querySelectorAll('.alergeno-check').forEach(c => c.checked = false);
  updateCategoryFields('');
  openModal();
}

// ── Modal: Open for Edit ───────────────────────────────────────
async function openEditModal(id) {
  modalTitle.textContent = 'Carregando…';
  openModal();

  try {
    const res = await apiFetch(`/api/products/${encodeURIComponent(id)}`);
    if (!res) return;

    const data = await res.json();

    if (!res.ok) {
      closeModal();
      showToast(data.error || 'Produto não encontrado.', 'error');
      return;
    }

    fillForm(data.product);
    editingId = id;
    modalTitle.textContent = 'Editar Produto';

  } catch (err) {
    console.error('Load product error:', err);
    closeModal();
    showToast('Erro ao carregar produto.', 'error');
  }
}

function fillForm(p) {
  document.getElementById('productIdOriginal').value = p.id;
  document.getElementById('fSlug').value        = p.id || '';
  document.getElementById('fNome').value        = p.nome || '';
  document.getElementById('fCategoria').value   = p.categoria || '';
  document.getElementById('fSubcategoria').value = p.subcategoria || '';
  document.getElementById('fOrdem').value       = p.ordem != null ? p.ordem : '';
  document.getElementById('fPreco').value       = p.preco || '';
  document.getElementById('fProdutor').value    = p.produtor || '';
  document.getElementById('fDescricao').value   = p.descricao || '';
  document.getElementById('fNotas').value       = p.notas || '';
  document.getElementById('fHarmonizacao').value = p.harmonizacao || '';
  document.getElementById('fImagem').value      = p.imagem || '';
  document.getElementById('fDestaque').checked  = !!p.destaque;
  document.getElementById('fAtivo').checked     = p.ativo !== false;

  // Wine fields
  document.getElementById('fUva').value         = p.uva || '';
  document.getElementById('fSafra').value       = p.safra || '';
  document.getElementById('fTeor').value        = p.teor || '';
  document.getElementById('fVolume').value      = p.volume || '';
  document.getElementById('fRegiao').value      = p.regiao || '';
  document.getElementById('fTemperatura').value = p.temperatura || '';
  document.getElementById('fGuarda').value      = p.guarda || '';

  // Chocolate fields
  document.getElementById('fPeso').value        = p.peso || '';
  document.getElementById('fCacau').value       = p.cacau || '';
  document.getElementById('fOrigem').value      = p.origem || '';
  document.getElementById('fAlcool').checked    = !!p.alcool;

  const alergenos = p.alergenos || [];
  document.querySelectorAll('.alergeno-check').forEach(c => {
    c.checked = alergenos.includes(c.value);
  });

  updateCategoryFields(p.categoria);
}

// ── Slug auto-generation ───────────────────────────────────────
document.getElementById('fNome').addEventListener('input', (e) => {
  if (!editingId) {
    const slug = slugify(e.target.value);
    document.getElementById('fSlug').value = slug;
  }
});

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ── Category fields show/hide ──────────────────────────────────
document.getElementById('fCategoria').addEventListener('change', (e) => {
  updateCategoryFields(e.target.value);
});

function updateCategoryFields(categoria) {
  const wineFields      = document.getElementById('wineFields');
  const chocolateFields = document.getElementById('chocolateFields');

  wineFields.classList.remove('visible');
  chocolateFields.classList.remove('visible');

  if (categoria === 'vinhos') {
    wineFields.classList.add('visible');
  } else if (categoria === 'chocolates') {
    chocolateFields.classList.add('visible');
  }
}

// ── Modal Open/Close ───────────────────────────────────────────
function openModal() {
  productModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  productModal.classList.remove('open');
  document.body.style.overflow = '';
  editingId = null;
}

modalClose.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);

productModal.addEventListener('click', (e) => {
  if (e.target === productModal) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && productModal.classList.contains('open')) {
    closeModal();
  }
});

// ── Form Submit ────────────────────────────────────────────────
modalSaveBtn.addEventListener('click', async () => {
  await submitProduct();
});

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  await submitProduct();
});

async function submitProduct() {
  const nome      = document.getElementById('fNome').value.trim();
  const categoria = document.getElementById('fCategoria').value;
  const preco     = document.getElementById('fPreco').value;
  const slug      = document.getElementById('fSlug').value.trim();

  if (!nome || !categoria || !preco) {
    showToast('Preencha os campos obrigatórios: Nome, Categoria e Preço.', 'warning');
    return;
  }

  const alergenos = [];
  document.querySelectorAll('.alergeno-check:checked').forEach(c => {
    alergenos.push(c.value);
  });

  const ordemVal = document.getElementById('fOrdem').value;

  const payload = {
    id:           slug || slugify(nome),
    nome,
    categoria,
    subcategoria: document.getElementById('fSubcategoria').value.trim() || null,
    ordem:        ordemVal !== '' ? parseInt(ordemVal, 10) : null,
    preco:        parseFloat(preco),
    produtor:     document.getElementById('fProdutor').value.trim() || null,
    descricao:    document.getElementById('fDescricao').value.trim() || null,
    notas:        document.getElementById('fNotas').value.trim() || null,
    harmonizacao: document.getElementById('fHarmonizacao').value.trim() || null,
    imagem:       document.getElementById('fImagem').value.trim() || null,
    destaque:     document.getElementById('fDestaque').checked,
    ativo:        document.getElementById('fAtivo').checked,
    // Wine
    uva:          document.getElementById('fUva').value.trim() || null,
    safra:        document.getElementById('fSafra').value.trim() || null,
    teor:         document.getElementById('fTeor').value.trim() || null,
    volume:       document.getElementById('fVolume').value.trim() || null,
    regiao:       document.getElementById('fRegiao').value.trim() || null,
    temperatura:  document.getElementById('fTemperatura').value.trim() || null,
    guarda:       document.getElementById('fGuarda').value.trim() || null,
    // Chocolate
    peso:         document.getElementById('fPeso').value.trim() || null,
    cacau:        document.getElementById('fCacau').value.trim() || null,
    origem:       document.getElementById('fOrigem').value.trim() || null,
    alcool:       document.getElementById('fAlcool').checked,
    alergenos,
  };

  modalSaveBtn.disabled = true;
  modalSaveBtn.innerHTML = '<span class="spinner"></span> Salvando…';

  try {
    let res;

    if (editingId) {
      res = await apiFetch(`/api/products/${encodeURIComponent(editingId)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      res = await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    if (!res) return;

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao salvar produto.', 'error');
      return;
    }

    showToast(
      editingId ? 'Produto atualizado com sucesso!' : 'Produto criado com sucesso!',
      'success'
    );
    closeModal();
    loadProducts(currentPage);

  } catch (err) {
    console.error('Save product error:', err);
    showToast('Erro de conexão ao salvar produto.', 'error');
  } finally {
    modalSaveBtn.disabled = false;
    modalSaveBtn.textContent = 'Salvar Produto';
  }
}

// ── Filters ────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadProducts(1), 400);
});

categoriaFilter.addEventListener('change', () => loadProducts(1));

apenasAtivos.addEventListener('change', () => loadProducts(1));

clearFiltersBtn.addEventListener('click', () => {
  searchInput.value       = '';
  categoriaFilter.value   = '';
  apenasAtivos.checked    = false;
  loadProducts(1);
});

// ── New Product Button ─────────────────────────────────────────
newProductBtn.addEventListener('click', openNewModal);

// ── Init ───────────────────────────────────────────────────────
if (requireAuth()) {
  loadProducts(1);
}
