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
    { id: 'inversion', label: 'Inversión', icon: '📈' },
    { id: 'otros', label: 'Otros', icon: '📦' },
  ],
  income: [
    { id: 'salario', label: 'Salario', icon: '💼' },
    { id: 'freelance', label: 'Freelance', icon: '💻' },
    { id: 'ventas', label: 'Ventas', icon: '🏷️' },
    { id: 'regalo', label: 'Regalo', icon: '🎁' },
    { id: 'inversion_ing', label: 'Inversión', icon: '📈' },
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
const accountSelect = document.getElementById('account');
const submitBtn = form.querySelector('.submit-btn');
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

document.addEventListener('bank-accounts-changed', populateAccountSelect);

form.addEventListener('submit', e => {
  e.preventDefault();
  if (!accountSelect.value) return;
  const tx = {
    id: crypto.randomUUID(),
    type: currentType,
    amount: parseFloat(amountInput.value),
    description: descriptionInput.value.trim(),
    category: categorySelect.value,
    accountId: accountSelect.value,
    date: dateInput.value,
  };
  transactions.push(tx);
  saveTransactions();
  adjustBankBalance(tx.accountId, tx.type === 'income' ? tx.amount : -tx.amount);
  form.reset();
  dateInput.value = todayISO();
  populateCategorySelect();
  render();
});

function loadTransactions() {
  return loadJSON(STORAGE_KEY, []);
}

function saveTransactions() {
  saveJSON(STORAGE_KEY, transactions);
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

function populateAccountSelect() {
  const prevValue = accountSelect.value;
  accountSelect.innerHTML = '';
  if (bankAccounts.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Añade una cuenta bancaria primero (pestaña Patrimonio)';
    accountSelect.appendChild(opt);
    accountSelect.disabled = true;
    submitBtn.disabled = true;
    return;
  }
  accountSelect.disabled = false;
  submitBtn.disabled = false;
  bankAccounts.forEach(acc => {
    const opt = document.createElement('option');
    opt.value = acc.id;
    opt.textContent = acc.name;
    accountSelect.appendChild(opt);
  });
  if (bankAccounts.some(a => a.id === prevValue)) accountSelect.value = prevValue;
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

function computeRunningBalances() {
  const balanceAfter = {};
  const byAccount = {};
  transactions.forEach(t => {
    if (!t.accountId) return;
    (byAccount[t.accountId] = byAccount[t.accountId] || []).push(t);
  });
  Object.keys(byAccount).forEach(accountId => {
    const acc = bankAccounts.find(a => a.id === accountId);
    if (!acc) return;
    const accTx = byAccount[accountId];
    const totalDelta = accTx.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
    let running = acc.balance - totalDelta;
    accTx
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(t => {
        running += t.type === 'income' ? t.amount : -t.amount;
        balanceAfter[t.id] = running;
      });
  });
  return balanceAfter;
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

  const balances = computeRunningBalances();

  filtered.forEach(tx => {
    const cat = findCategory(tx.category);
    const accName = getAccountName(tx.accountId);
    const balanceAfter = balances[tx.id];
    const li = document.createElement('li');
    li.className = `tx-item ${tx.type}`;
    li.innerHTML = `
      <div class="tx-icon">${cat.icon}</div>
      <div class="tx-info">
        <div class="tx-desc">${escapeHtml(tx.description)}</div>
        <div class="tx-meta">${cat.label} · ${formatDate(tx.date)}${accName ? ' · ' + escapeHtml(accName) : ''}</div>
        ${balanceAfter !== undefined ? `<div class="tx-balance">Saldo en cuenta: ${formatMoney(balanceAfter)}</div>` : ''}
      </div>
      <div class="tx-amount">${tx.type === 'income' ? '+' : '-'}${formatMoney(tx.amount)}</div>
      <button class="tx-delete" data-id="${tx.id}" aria-label="Eliminar">✕</button>
    `;
    txList.appendChild(li);
  });

  txList.querySelectorAll('.tx-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const tx = transactions.find(t => t.id === btn.dataset.id);
      transactions = transactions.filter(t => t.id !== btn.dataset.id);
      saveTransactions();
      if (tx && tx.accountId) {
        adjustBankBalance(tx.accountId, tx.type === 'income' ? -tx.amount : tx.amount);
      }
      render();
    });
  });
}

populateCategorySelect();
populateAccountSelect();
populateFilterCategories();
dateInput.value = todayISO();
render();
