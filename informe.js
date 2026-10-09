const CHART_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'];

const reportFromInput = document.getElementById('reportFrom');
const reportToInput = document.getElementById('reportTo');

function computeRange(preset) {
  const today = new Date();
  const toISO = d => d.toISOString().slice(0, 10);
  let from;
  const to = toISO(today);
  if (preset === 'month') {
    from = toISO(new Date(today.getFullYear(), today.getMonth(), 1));
  } else if (preset === 'last30') {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    from = toISO(d);
  } else if (preset === 'last90') {
    const d = new Date(today);
    d.setDate(d.getDate() - 89);
    from = toISO(d);
  } else if (preset === 'year') {
    from = toISO(new Date(today.getFullYear(), 0, 1));
  } else {
    from = '';
  }
  return { from, to };
}

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const { from, to } = computeRange(btn.dataset.preset);
    reportFromInput.value = from;
    reportToInput.value = to;
    renderReport();
  });
});

[reportFromInput, reportToInput].forEach(input => {
  input.addEventListener('change', () => {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    renderReport();
  });
});

document.addEventListener('panel-shown', e => {
  if (e.detail.panel === 'panel-informe') renderReport();
});
document.addEventListener('bank-accounts-changed', () => {
  if (document.getElementById('panel-informe').classList.contains('active')) renderReport();
});
document.addEventListener('prices-updated', () => {
  if (document.getElementById('panel-informe').classList.contains('active')) renderReport();
});

function categoryBreakdown(txs, type) {
  const map = new Map();
  txs.filter(t => t.type === type).forEach(t => {
    map.set(t.category, (map.get(t.category) || 0) + t.amount);
  });
  let entries = [...map.entries()]
    .map(([catId, amount]) => {
      const cat = findCategory(catId);
      return { label: cat.label, icon: cat.icon, amount };
    })
    .sort((a, b) => b.amount - a.amount);

  if (entries.length > 6) {
    const head = entries.slice(0, 5);
    const tail = entries.slice(5).reduce((s, e) => s + e.amount, 0);
    entries = [...head, { label: 'Otros', icon: '📦', amount: tail }];
  }
  return entries;
}

function patrimonioComposition() {
  const bankTotal = bankAccounts.reduce((s, a) => s + a.balance, 0);
  const cryptoTotal = cryptoHoldings.reduce((s, h) => {
    const p = priceCache.crypto[h.coinId];
    return s + (p !== undefined ? p * h.quantity : 0);
  }, 0);
  const stockTotalEur = stockHoldings.reduce((s, h) => {
    const eur = eurValue(priceCache.stocks[h.ticker]);
    return s + (eur !== null ? eur * h.quantity : 0);
  }, 0);

  return [
    { label: 'Cuentas bancarias', icon: '🏦', amount: bankTotal },
    { label: 'Crypto', icon: '🪙', amount: cryptoTotal },
    { label: 'Stocks/ETFs', icon: '📈', amount: stockTotalEur },
  ].filter(e => e.amount > 0);
}

function renderDonut(container, title, entries, opts = {}) {
  container.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'donut-card';

  const h4 = document.createElement('h4');
  h4.className = 'donut-title';
  h4.textContent = title;
  card.appendChild(h4);

  if (opts.note) {
    const note = document.createElement('p');
    note.className = 'donut-note';
    note.textContent = opts.note;
    card.appendChild(note);
  }

  const total = entries.reduce((s, e) => s + e.amount, 0);

  if (entries.length === 0 || total <= 0) {
    const empty = document.createElement('p');
    empty.className = 'donut-empty';
    empty.textContent = 'Sin datos en este período.';
    card.appendChild(empty);
    container.appendChild(card);
    return;
  }

  if (entries.length < 3) {
    const list = buildLegend(entries, total, null);
    card.appendChild(list);
    container.appendChild(card);
    return;
  }

  const svgNS = 'http://www.w3.org/2000/svg';
  const wrap = document.createElement('div');
  wrap.className = 'donut-wrap';

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.classList.add('donut-svg');

  const r = 48;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * r;
  const gap = 3;

  const track = document.createElementNS(svgNS, 'circle');
  track.setAttribute('cx', 60);
  track.setAttribute('cy', 60);
  track.setAttribute('r', r);
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke-width', strokeWidth);
  track.classList.add('donut-track');
  svg.appendChild(track);

  const centerValue = document.createElementNS(svgNS, 'text');
  centerValue.classList.add('donut-center-value');
  centerValue.setAttribute('x', 60);
  centerValue.setAttribute('y', 57);
  centerValue.setAttribute('text-anchor', 'middle');
  centerValue.textContent = formatMoney(total);

  const centerLabel = document.createElementNS(svgNS, 'text');
  centerLabel.classList.add('donut-center-label');
  centerLabel.setAttribute('x', 60);
  centerLabel.setAttribute('y', 71);
  centerLabel.setAttribute('text-anchor', 'middle');
  centerLabel.textContent = opts.centerLabel || 'Total';

  const resetCenter = () => {
    centerValue.textContent = formatMoney(total);
    centerLabel.textContent = opts.centerLabel || 'Total';
  };

  let cumulative = 0;
  const segmentEls = [];

  entries.forEach((e, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const fraction = e.amount / total;
    const segLen = Math.max(fraction * circumference - gap, 0);
    const offset = cumulative * circumference;
    cumulative += fraction;
    const pct = fraction * 100;

    const seg = document.createElementNS(svgNS, 'circle');
    seg.setAttribute('cx', 60);
    seg.setAttribute('cy', 60);
    seg.setAttribute('r', r);
    seg.setAttribute('fill', 'none');
    seg.setAttribute('stroke', color);
    seg.setAttribute('stroke-width', strokeWidth);
    seg.setAttribute('stroke-dasharray', `${segLen} ${circumference - segLen}`);
    seg.setAttribute('stroke-dashoffset', String(-offset));
    seg.setAttribute('transform', 'rotate(-90 60 60)');
    seg.setAttribute('tabindex', '0');
    seg.setAttribute('role', 'img');
    seg.setAttribute('aria-label', `${e.label}: ${formatMoney(e.amount)}, ${pct.toFixed(1)} por ciento`);
    seg.classList.add('donut-segment');

    const titleEl = document.createElementNS(svgNS, 'title');
    titleEl.textContent = `${e.label}: ${formatMoney(e.amount)} (${pct.toFixed(1)}%)`;
    seg.appendChild(titleEl);

    const activate = () => {
      segmentEls.forEach(s => s.classList.remove('active'));
      seg.classList.add('active');
      centerValue.textContent = formatMoney(e.amount);
      centerLabel.textContent = `${e.icon} ${e.label} · ${pct.toFixed(1)}%`;
    };
    const deactivate = () => {
      seg.classList.remove('active');
      resetCenter();
    };
    seg.addEventListener('mouseenter', activate);
    seg.addEventListener('focus', activate);
    seg.addEventListener('mouseleave', deactivate);
    seg.addEventListener('blur', deactivate);

    segmentEls.push(seg);
    svg.appendChild(seg);
  });

  svg.appendChild(centerValue);
  svg.appendChild(centerLabel);
  wrap.appendChild(svg);
  card.appendChild(wrap);
  card.appendChild(buildLegend(entries, total, segmentEls));
  container.appendChild(card);
}

function buildLegend(entries, total, segmentEls) {
  const list = document.createElement('ul');
  list.className = 'donut-legend';
  entries.forEach((e, i) => {
    const pct = (e.amount / total) * 100;
    const li = document.createElement('li');
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = CHART_COLORS[i % CHART_COLORS.length];
    const lbl = document.createElement('span');
    lbl.className = 'legend-label';
    lbl.textContent = `${e.icon} ${e.label}`;
    const val = document.createElement('span');
    val.className = 'legend-value';
    val.textContent = `${formatMoney(e.amount)} · ${pct.toFixed(1)}%`;
    li.append(sw, lbl, val);
    if (segmentEls) {
      li.addEventListener('mouseenter', () => segmentEls[i].dispatchEvent(new Event('mouseenter')));
      li.addEventListener('mouseleave', () => segmentEls[i].dispatchEvent(new Event('mouseleave')));
    }
    list.appendChild(li);
  });
  return list;
}

function monthlySeries(count) {
  const today = new Date();
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, date: d, income: 0, expense: 0 });
  }
  const byKey = new Map(months.map(m => [m.key, m]));
  transactions.forEach(t => {
    if (isTransfer(t)) return;
    const m = byKey.get(t.date.slice(0, 7));
    if (!m) return;
    if (t.type === 'income') m.income += t.amount;
    else m.expense += t.amount;
  });
  const firstWithData = months.findIndex(m => m.income > 0 || m.expense > 0);
  return firstWithData === -1 ? [] : months.slice(firstWithData);
}

function renderMonthlyEvolution(container) {
  container.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'donut-card';

  const h4 = document.createElement('h4');
  h4.className = 'donut-title';
  h4.textContent = 'Evolución mensual';
  card.appendChild(h4);

  const note = document.createElement('p');
  note.className = 'donut-note';
  note.textContent = 'Últimos 12 meses — no depende del rango de fechas seleccionado.';
  card.appendChild(note);

  const series = monthlySeries(12);
  if (series.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'donut-empty';
    empty.textContent = 'Sin movimientos todavía.';
    card.appendChild(empty);
    container.appendChild(card);
    return;
  }

  const max = Math.max(...series.map(m => Math.max(m.income, m.expense)), 1);

  const legend = document.createElement('div');
  legend.className = 'evo-legend';
  legend.innerHTML = '<span><i class="evo-dot income"></i>Ingresos</span><span><i class="evo-dot expense"></i>Gastos</span>';
  card.appendChild(legend);

  const chart = document.createElement('div');
  chart.className = 'evo-chart';
  const scaleLabel = document.createElement('span');
  scaleLabel.className = 'evo-scale';
  scaleLabel.textContent = formatMoney(max);
  chart.appendChild(scaleLabel);

  const detail = document.createElement('div');
  detail.className = 'evo-detail';

  const columns = [];
  const select = (m, col) => {
    columns.forEach(c => c.classList.remove('active'));
    col.classList.add('active');
    const net = m.income - m.expense;
    const monthName = m.date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    detail.innerHTML = `
      <div class="evo-detail-month">${monthName}</div>
      <div class="evo-detail-row"><span>Ingresos</span><span class="income-text">${formatMoney(m.income)}</span></div>
      <div class="evo-detail-row"><span>Gastos</span><span class="expense-text">${formatMoney(m.expense)}</span></div>
      <div class="evo-detail-row"><span>Balance</span><span class="${net >= 0 ? 'income-text' : 'expense-text'}">${net >= 0 ? '+' : ''}${formatMoney(net)}</span></div>
      ${m.income > 0 ? `<div class="evo-detail-row"><span>Tasa de ahorro</span><span>${((net / m.income) * 100).toFixed(0)}%</span></div>` : ''}
    `;
  };

  series.forEach(m => {
    const col = document.createElement('button');
    col.type = 'button';
    col.className = 'evo-col';
    col.setAttribute('aria-label', `${m.date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}: ingresos ${formatMoney(m.income)}, gastos ${formatMoney(m.expense)}`);

    const bars = document.createElement('div');
    bars.className = 'evo-bars';
    const inc = document.createElement('div');
    inc.className = 'evo-bar income';
    inc.style.height = `${(m.income / max) * 100}%`;
    const exp = document.createElement('div');
    exp.className = 'evo-bar expense';
    exp.style.height = `${(m.expense / max) * 100}%`;
    bars.append(inc, exp);

    const label = document.createElement('span');
    label.className = 'evo-label';
    label.textContent = m.date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');

    col.append(bars, label);
    col.addEventListener('click', () => select(m, col));
    col.addEventListener('mouseenter', () => select(m, col));
    columns.push(col);
    chart.appendChild(col);
  });

  card.appendChild(chart);
  card.appendChild(detail);
  container.appendChild(card);

  select(series[series.length - 1], columns[columns.length - 1]);
}

function renderReport() {
  const fromVal = reportFromInput.value || '0001-01-01';
  const toVal = reportToInput.value || '9999-12-31';
  const rangeTx = transactions.filter(t => t.date >= fromVal && t.date <= toVal && !isTransfer(t));

  const income = rangeTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = rangeTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  document.getElementById('reportIncome').textContent = formatMoney(income);
  document.getElementById('reportExpense').textContent = formatMoney(expense);
  document.getElementById('reportBalance').textContent = formatMoney(income - expense);

  renderMonthlyEvolution(document.getElementById('evolutionChart'));
  renderDonut(document.getElementById('donutExpense'),'Gastos por categoría', categoryBreakdown(rangeTx, 'expense'));
  renderDonut(document.getElementById('donutIncome'), 'Ingresos por categoría', categoryBreakdown(rangeTx, 'income'));
  renderDonut(document.getElementById('donutPatrimonio'), 'Composición del patrimonio', patrimonioComposition(), {
    note: 'Valor actual — no depende del rango de fechas seleccionado.',
    centerLabel: 'Patrimonio',
  });
}

(() => {
  const { from, to } = computeRange('month');
  reportFromInput.value = from;
  reportToInput.value = to;
  renderReport();
})();
