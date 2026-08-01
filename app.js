document.querySelectorAll('.main-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.panel).classList.add('active');
    document.dispatchEvent(new CustomEvent('panel-shown', { detail: { panel: btn.dataset.panel } }));
  });
});

const STORAGE_KEY = 'finanzas.transactions';

const CATEGORIES = {
  expense: [
    { id: 'comida', label: 'Comida', icon: '🍔' },
    { id: 'transporte', label: 'Transporte', icon: '🚗' },
    { id: 'vivienda', label: 'Vivienda', icon: '🏠' },
    { id: 'ocio', label: 'Ocio', icon: '🎬' },
    { id: 'salud', label: 'Salud', icon: '💊' },
    { id: 'compras', label: 'Compras', icon: '🛍️' },
    { id: 'facturas', label: 'Facturas', icon: '🧾' },
    { id: 'otros', label: 'Otros', icon: '📦' },
  ],
  income: [
    { id: 'salario', label: 'Salario', icon: '💼' },
    { id: 'freelance', label: 'Freelance', icon: '💻' },
    { id: 'ventas', label: 'Ventas', icon: '🏷️' },
    { id: 'regalo', label: 'Regalo', icon: '🎁' },
    { id: 'otros_ing', label: 'Otros', icon: '📦' },
  ],
};

let transactions = loadTransactions();
let currentType = 'expense';
let viewDate = new Date();
viewDate.setDate(1);

const form = document.getElementById('txForm');
const amountInput = document.getElementById('amount');
const descriptionInput = document.getElementById('description');
const categorySelect = document.getElementById('category');
const dateInput = document.getElementById('date');
const filterCategory = document.getElementById('filterCategory');
const filterType = document.getElementById('filterType');
const txList = document.getElementById('txList');
const emptyState = document.getElementById('emptyState');
const currentMonthLabel = document.getElementById('currentMonthLabel');

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentType = btn.dataset.type;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    populateCategorySelect();
  });
});

document.getElementById('prevMonth').addEventListener('click', () => {
  viewDate.setMonth(viewDate.getMonth() - 1);
  render();
});

document.getElementById('nextMonth').addEventListener('click', () => {
  viewDate.setMonth(viewDate.getMonth() + 1);
  render();
});

filterCategory.addEventListener('change', render);
filterType.addEventListener('change', render);

form.addEventListener('submit', e => {
  e.preventDefault();
  const tx = {
    id: crypto.randomUUID(),
    type: currentType,
    amount: parseFloat(amountInput.value),
    description: descriptionInput.value.trim(),
    category: categorySelect.value,
    date: dateInput.value,
  };
  transactions.push(tx);
  saveTransactions();
  form.reset();
  dateInput.value = todayISO();
  populateCategorySelect();
  render();
});

function loadTransactions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function populateCategorySelect() {
  categorySelect.innerHTML = '';
  CATEGORIES[currentType].forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${cat.label}`;
    categorySelect.appendChild(opt);
  });
}

function populateFilterCategories() {
  const allCats = [...CATEGORIES.expense, ...CATEGORIES.income];
  filterCategory.innerHTML = '<option value="all">Todas las categorías</option>';
  allCats.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${cat.label}`;
    filterCategory.appendChild(opt);
  });
}

function findCategory(id) {
  return [...CATEGORIES.expense, ...CATEGORIES.income].find(c => c.id === id)
    || { icon: '📦', label: id };
}

function formatMoney(n) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function isInViewMonth(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.getFullYear() === viewDate.getFullYear() && d.getMonth() === viewDate.getMonth();
}

function render() {
  currentMonthLabel.textContent = viewDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  const monthTx = transactions.filter(t => isInViewMonth(t.date));

  const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  document.getElementById('totalIncome').textContent = formatMoney(income);
  document.getElementById('totalExpense').textContent = formatMoney(expense);
  document.getElementById('totalBalance').textContent = formatMoney(income - expense);

  let filtered = monthTx;
  if (filterCategory.value !== 'all') {
    filtered = filtered.filter(t => t.category === filterCategory.value);
  }
  if (filterType.value !== 'all') {
    filtered = filtered.filter(t => t.type === filterType.value);
  }
  filtered = filtered.slice().sort((a, b) => b.date.localeCompare(a.date));

  txList.innerHTML = '';
  emptyState.style.display = filtered.length === 0 ? 'block' : 'none';

  filtered.forEach(tx => {
    const cat = findCategory(tx.category);
    const li = document.createElement('li');
    li.className = `tx-item ${tx.type}`;
    li.innerHTML = `
      <div class="tx-icon">${cat.icon}</div>
      <div class="tx-info">
        <div class="tx-desc">${escapeHtml(tx.description)}</div>
        <div class="tx-meta">${cat.label} · ${formatDate(tx.date)}</div>
      </div>
      <div class="tx-amount">${tx.type === 'income' ? '+' : '-'}${formatMoney(tx.amount)}</div>
      <button class="tx-delete" data-id="${tx.id}" aria-label="Eliminar">✕</button>
    `;
    txList.appendChild(li);
  });

  txList.querySelectorAll('.tx-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      transactions = transactions.filter(t => t.id !== btn.dataset.id);
      saveTransactions();
      render();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

populateCategorySelect();
populateFilterCategories();
dateInput.value = todayISO();
render();
