const GOALS_KEY = 'finanzas.goals';
let goals = loadJSON(GOALS_KEY, []);

const goalForm = document.getElementById('goalForm');
const goalNameInput = document.getElementById('goalName');
const goalTargetInput = document.getElementById('goalTarget');
const goalDateInput = document.getElementById('goalDate');
const goalSourceSelect = document.getElementById('goalSource');
const goalBankAccountSelect = document.getElementById('goalBankAccount');
const goalList = document.getElementById('goalList');
const patrimonioGoalList = document.getElementById('patrimonioGoalList');

function saveGoals() {
  saveJSON(GOALS_KEY, goals);
}

function populateGoalBankSelect() {
  const prevValue = goalBankAccountSelect.value;
  goalBankAccountSelect.innerHTML = '';
  bankAccounts.forEach(acc => {
    const opt = document.createElement('option');
    opt.value = acc.id;
    opt.textContent = acc.name;
    goalBankAccountSelect.appendChild(opt);
  });
  if (bankAccounts.some(a => a.id === prevValue)) goalBankAccountSelect.value = prevValue;
}
populateGoalBankSelect();

document.addEventListener('bank-accounts-changed', () => {
  populateGoalBankSelect();
  if (document.getElementById('panel-objetivo').classList.contains('active')) renderGoals();
  renderPatrimonioGoals();
});

goalSourceSelect.addEventListener('change', () => {
  goalBankAccountSelect.style.display = goalSourceSelect.value === 'bank' ? '' : 'none';
});

goalForm.addEventListener('submit', e => {
  e.preventDefault();
  const source = goalSourceSelect.value;
  if (source === 'bank' && bankAccounts.length === 0) return;
  goals.push({
    id: crypto.randomUUID(),
    name: goalNameInput.value.trim(),
    targetAmount: parseFloat(goalTargetInput.value),
    targetDate: goalDateInput.value || null,
    source,
    bankAccountId: source === 'bank' ? goalBankAccountSelect.value : null,
    manualAmount: 0,
  });
  saveGoals();
  goalForm.reset();
  goalBankAccountSelect.style.display = 'none';
  refreshAllGoalViews();
});

function getGoalCurrentAmount(goal) {
  if (goal.source === 'bank') {
    const acc = bankAccounts.find(a => a.id === goal.bankAccountId);
    return acc ? acc.balance : 0;
  }
  if (goal.source === 'patrimonio') {
    return getPatrimonioTotal();
  }
  return goal.manualAmount || 0;
}

function averageMonthlyNet() {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  const recent = transactions.filter(t => t.date >= cutoffISO);
  if (recent.length === 0) return null;
  const net = recent.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
  return net / 3;
}

function monthsBetween(from, to) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) - (to.getDate() < from.getDate() ? 1 : 0);
}

function buildGoalCard(goal, pace, today, compact = false) {
  const current = getGoalCurrentAmount(goal);
  const target = goal.targetAmount;
  const remaining = Math.max(target - current, 0);
  const progress = target > 0 ? Math.min(current / target, 1) : 0;
  const pct = progress * 100;
  const achieved = current >= target;

  let dateInfo = null;
  if (goal.targetDate) {
    const targetDateObj = new Date(goal.targetDate + 'T00:00:00');
    const monthsLeft = monthsBetween(today, targetDateObj);
    const overdue = targetDateObj < today;
    const requiredMonthly = !overdue && monthsLeft > 0 ? remaining / monthsLeft : remaining;
    dateInfo = { targetDateObj, monthsLeft, overdue, requiredMonthly };
  }

  let meterColor = 'var(--accent)';
  if (achieved) meterColor = 'var(--income)';
  else if (dateInfo && dateInfo.overdue) meterColor = 'var(--expense)';

  const card = document.createElement('div');
  card.className = 'goal-card';

  const header = document.createElement('div');
  header.className = 'goal-header';
  const title = document.createElement('h4');
  title.className = 'goal-name';
  title.textContent = goal.name;
  const delBtn = document.createElement('button');
  delBtn.className = 'tx-delete';
  delBtn.setAttribute('aria-label', 'Eliminar');
  delBtn.textContent = '✕';
  delBtn.addEventListener('click', () => {
    goals = goals.filter(g => g.id !== goal.id);
    saveGoals();
    refreshAllGoalViews();
  });
  header.append(title, delBtn);
  card.appendChild(header);

  const meterTrack = document.createElement('div');
  meterTrack.className = 'goal-meter-track';
  const meterFill = document.createElement('div');
  meterFill.className = 'goal-meter-fill';
  meterFill.style.width = `${Math.min(pct, 100)}%`;
  meterFill.style.background = meterColor;
  meterTrack.appendChild(meterFill);
  card.appendChild(meterTrack);

  const pctRow = document.createElement('div');
  pctRow.className = 'goal-pct-row';
  const pctLabel = document.createElement('span');
  pctLabel.className = 'goal-pct';
  pctLabel.textContent = `${pct.toFixed(1)}%`;
  pctRow.appendChild(pctLabel);
  if (!compact) {
    const amountsLabel = document.createElement('span');
    amountsLabel.className = 'goal-amounts';
    amountsLabel.textContent = `${formatMoney(current)} de ${formatMoney(target)}`;
    pctRow.appendChild(amountsLabel);
  }
  card.appendChild(pctRow);

  if (compact) return card;

  const status = document.createElement('p');
  status.className = 'goal-status';
  if (achieved) {
    status.textContent = '🎉 Objetivo alcanzado.';
    status.classList.add('goal-status-good');
  } else {
    status.textContent = `Te faltan ${formatMoney(remaining)} para llegar.`;
  }
  card.appendChild(status);

  if (!achieved && dateInfo) {
    const dateP = document.createElement('p');
    dateP.className = 'goal-detail';
    const dateStr = dateInfo.targetDateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    if (dateInfo.overdue) {
      dateP.textContent = `La fecha objetivo (${dateStr}) ya pasó.`;
      dateP.classList.add('goal-detail-warn');
    } else if (dateInfo.monthsLeft <= 0) {
      dateP.textContent = `Fecha objetivo: ${dateStr} (este mes). Necesitas reunir ${formatMoney(remaining)} antes de esa fecha.`;
    } else {
      dateP.textContent = `Fecha objetivo: ${dateStr} (${dateInfo.monthsLeft} ${dateInfo.monthsLeft === 1 ? 'mes' : 'meses'}). Necesitas ahorrar ${formatMoney(dateInfo.requiredMonthly)}/mes para llegar a tiempo.`;
    }
    card.appendChild(dateP);
  }

  if (!achieved) {
    const paceP = document.createElement('p');
    paceP.className = 'goal-detail';
    if (pace === null) {
      paceP.textContent = 'Aún no hay suficientes movimientos para estimar tu ritmo de ahorro.';
    } else if (pace <= 0) {
      paceP.textContent = `A tu ritmo actual (${formatMoney(pace)}/mes de media, últimos 3 meses) no estás ahorrando: revisa tus gastos para acercarte a este objetivo.`;
      paceP.classList.add('goal-detail-warn');
    } else {
      const monthsAtPace = Math.ceil(remaining / pace);
      const eta = new Date(today.getFullYear(), today.getMonth() + monthsAtPace, 1);
      const etaStr = eta.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      paceP.textContent = `A tu ritmo actual de ahorro (${formatMoney(pace)}/mes de media, últimos 3 meses), lo alcanzarías en ${monthsAtPace} ${monthsAtPace === 1 ? 'mes' : 'meses'} (${etaStr}).`;
    }
    card.appendChild(paceP);
  }

  if (goal.source === 'manual' && !achieved) {
    const updateForm = document.createElement('form');
    updateForm.className = 'inline-form goal-update-form';
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.01';
    input.min = '0';
    input.placeholder = 'Actualizar ahorrado €';
    input.value = goal.manualAmount || '';
    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.textContent = 'Actualizar';
    updateForm.append(input, btn);
    updateForm.addEventListener('submit', e => {
      e.preventDefault();
      goal.manualAmount = parseFloat(input.value) || 0;
      saveGoals();
      refreshAllGoalViews();
    });
    card.appendChild(updateForm);
  } else if (goal.source === 'bank') {
    const srcP = document.createElement('p');
    srcP.className = 'goal-source-note';
    const accName = getAccountName(goal.bankAccountId);
    srcP.textContent = accName ? `Vinculado a la cuenta: ${accName}` : 'La cuenta vinculada ya no existe — el progreso muestra 0 €.';
    card.appendChild(srcP);
  } else if (goal.source === 'patrimonio') {
    const srcP = document.createElement('p');
    srcP.className = 'goal-source-note';
    srcP.textContent = 'Vinculado al patrimonio total (cuentas + crypto + stocks).';
    card.appendChild(srcP);
  }

  return card;
}

function renderGoals() {
  goalList.innerHTML = '';

  if (goals.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.style.display = 'block';
    p.textContent = 'Aún no tienes objetivos. Crea el primero arriba.';
    goalList.appendChild(p);
    return;
  }

  const pace = averageMonthlyNet();
  const today = new Date();
  goals.forEach(goal => goalList.appendChild(buildGoalCard(goal, pace, today)));
}

function renderPatrimonioGoals() {
  if (!patrimonioGoalList) return;
  patrimonioGoalList.innerHTML = '';
  const linked = goals.filter(g => g.source === 'patrimonio');
  if (linked.length === 0) return;
  const pace = averageMonthlyNet();
  const today = new Date();
  linked.forEach(goal => patrimonioGoalList.appendChild(buildGoalCard(goal, pace, today, true)));
}

function refreshAllGoalViews() {
  renderGoals();
  renderPatrimonioGoals();
}

document.addEventListener('panel-shown', e => {
  if (e.detail.panel === 'panel-objetivo') renderGoals();
  if (e.detail.panel === 'panel-patrimonio') renderPatrimonioGoals();
});
document.addEventListener('prices-updated', () => {
  if (document.getElementById('panel-objetivo').classList.contains('active')) renderGoals();
  renderPatrimonioGoals();
});

renderGoals();
renderPatrimonioGoals();
