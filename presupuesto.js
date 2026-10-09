const BUDGETS_KEY = 'finanzas.budgets';
let budgets = loadJSON(BUDGETS_KEY, {});

let budgetViewDate = new Date();
budgetViewDate.setDate(1);

const budgetForm = document.getElementById('budgetForm');
const budgetCategorySelect = document.getElementById('budgetCategory');
const budgetAmountInput = document.getElementById('budgetAmount');
const budgetList = document.getElementById('budgetList');
const budgetMonthLabel = document.getElementById('budgetMonthLabel');

function saveBudgets() {
  saveJSON(BUDGETS_KEY, budgets);
}

function populateBudgetCategorySelect() {
  budgetCategorySelect.innerHTML = '';
  CATEGORIES.expense.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${cat.label}${budgets[cat.id] ? ' (editar)' : ''}`;
    budgetCategorySelect.appendChild(opt);
  });
}

budgetCategorySelect.addEventListener('change', () => {
  const current = budgets[budgetCategorySelect.value];
  budgetAmountInput.value = current ? current : '';
});

budgetForm.addEventListener('submit', e => {
  e.preventDefault();
  const amount = parseFloat(budgetAmountInput.value);
  if (!(amount > 0)) return;
  budgets[budgetCategorySelect.value] = amount;
  saveBudgets();
  budgetAmountInput.value = '';
  const selected = budgetCategorySelect.value;
  populateBudgetCategorySelect();
  budgetCategorySelect.value = selected;
  renderBudgets();
});

document.getElementById('budgetPrevMonth').addEventListener('click', () => {
  budgetViewDate.setMonth(budgetViewDate.getMonth() - 1);
  renderBudgets();
});

document.getElementById('budgetNextMonth').addEventListener('click', () => {
  budgetViewDate.setMonth(budgetViewDate.getMonth() + 1);
  renderBudgets();
});

document.addEventListener('panel-shown', e => {
  if (e.detail.panel === 'panel-presupuestos') renderBudgets();
});

function budgetMonthProgress() {
  const today = new Date();
  const y = budgetViewDate.getFullYear();
  const m = budgetViewDate.getMonth();
  if (today.getFullYear() === y && today.getMonth() === m) {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    return today.getDate() / daysInMonth;
  }
  return budgetViewDate < today ? 1 : 0;
}

function renderBudgets() {
  budgetMonthLabel.textContent = budgetViewDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  const y = budgetViewDate.getFullYear();
  const m = budgetViewDate.getMonth();
  const spentByCat = {};
  transactions
    .filter(t => {
      if (t.type !== 'expense' || isTransfer(t)) return false;
      const d = new Date(t.date + 'T00:00:00');
      return d.getFullYear() === y && d.getMonth() === m;
    })
    .forEach(t => { spentByCat[t.category] = (spentByCat[t.category] || 0) + t.amount; });

  const monthProgress = budgetMonthProgress();
  const budgetedIds = CATEGORIES.expense.map(c => c.id).filter(id => budgets[id] > 0);

  const totalBudget = budgetedIds.reduce((s, id) => s + budgets[id], 0);
  const totalSpentBudgeted = budgetedIds.reduce((s, id) => s + (spentByCat[id] || 0), 0);
  const unbudgetedSpent = Object.keys(spentByCat)
    .filter(id => !budgetedIds.includes(id))
    .reduce((s, id) => s + spentByCat[id], 0);

  budgetList.innerHTML = '';

  if (budgetedIds.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.style.display = 'block';
    empty.textContent = 'Aún no tienes presupuestos. Añade uno arriba.';
    budgetList.appendChild(empty);
    return;
  }

  budgetList.appendChild(buildBudgetCard({
    title: 'Total presupuestado',
    limit: totalBudget,
    spent: totalSpentBudgeted,
    monthProgress,
    extra: unbudgetedSpent > 0 ? `Además has gastado ${formatMoney(unbudgetedSpent)} en categorías sin presupuesto.` : null,
    isTotal: true,
  }));

  budgetedIds
    .map(id => ({ id, cat: findCategory(id), limit: budgets[id], spent: spentByCat[id] || 0 }))
    .sort((a, b) => (b.spent / b.limit) - (a.spent / a.limit))
    .forEach(({ id, cat, limit, spent }) => {
      budgetList.appendChild(buildBudgetCard({
        title: `${cat.icon} ${cat.label}`,
        limit,
        spent,
        monthProgress,
        onDelete: () => {
          delete budgets[id];
          saveBudgets();
          populateBudgetCategorySelect();
          renderBudgets();
        },
      }));
    });
}

function buildBudgetCard({ title, limit, spent, monthProgress, extra, onDelete, isTotal }) {
  const ratio = limit > 0 ? spent / limit : 0;
  const over = spent > limit;
  const aheadOfPace = !over && monthProgress > 0 && monthProgress < 1 && ratio > monthProgress + 0.1;

  let color = 'var(--income)';
  if (over) color = 'var(--expense)';
  else if (ratio >= 0.8 || aheadOfPace) color = 'var(--warn)';

  const card = document.createElement('div');
  card.className = 'goal-card' + (isTotal ? ' budget-total' : '');

  const header = document.createElement('div');
  header.className = 'goal-header';
  const h4 = document.createElement('h4');
  h4.className = 'goal-name';
  h4.textContent = title;
  header.appendChild(h4);
  if (onDelete) {
    const delBtn = document.createElement('button');
    delBtn.className = 'tx-delete';
    delBtn.setAttribute('aria-label', 'Eliminar presupuesto');
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => {
      if (confirm(`¿Eliminar el presupuesto de ${title}?`)) onDelete();
    });
    header.appendChild(delBtn);
  }
  card.appendChild(header);

  const track = document.createElement('div');
  track.className = 'goal-meter-track budget-track';
  const fill = document.createElement('div');
  fill.className = 'goal-meter-fill';
  fill.style.width = `${Math.min(ratio, 1) * 100}%`;
  fill.style.background = color;
  track.appendChild(fill);
  if (monthProgress > 0 && monthProgress < 1) {
    const marker = document.createElement('div');
    marker.className = 'budget-pace-marker';
    marker.style.left = `${monthProgress * 100}%`;
    marker.title = 'Día del mes en el que estás';
    track.appendChild(marker);
  }
  card.appendChild(track);

  const row = document.createElement('div');
  row.className = 'goal-pct-row';
  const pct = document.createElement('span');
  pct.className = 'goal-pct';
  pct.textContent = `${formatMoney(spent)} de ${formatMoney(limit)}`;
  const pctNum = document.createElement('span');
  pctNum.className = 'goal-amounts';
  pctNum.textContent = `${(ratio * 100).toFixed(0)}%`;
  row.append(pct, pctNum);
  card.appendChild(row);

  const status = document.createElement('p');
  status.className = 'goal-detail';
  if (over) {
    status.classList.add('goal-detail-warn');
    status.textContent = `Te has pasado ${formatMoney(spent - limit)}.`;
  } else if (aheadOfPace) {
    status.style.color = 'var(--warn)';
    status.textContent = `Te quedan ${formatMoney(limit - spent)}. Vas más rápido de lo previsto para esta altura del mes.`;
  } else {
    status.textContent = `Te quedan ${formatMoney(limit - spent)}.`;
  }
  card.appendChild(status);

  if (extra) {
    const p = document.createElement('p');
    p.className = 'goal-source-note';
    p.textContent = extra;
    card.appendChild(p);
  }
  return card;
}

populateBudgetCategorySelect();
renderBudgets();
