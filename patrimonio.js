const CRYPTO_KEY = 'finanzas.crypto';
const FUND_KEY = 'finanzas.funds';
const PRICE_CACHE_KEY = 'finanzas.priceCache';

const CRYPTO_OPTIONS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'tether', symbol: 'USDT', name: 'Tether' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { id: 'matic-network', symbol: 'MATIC', name: 'Polygon' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
  { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu' },
  { id: 'tron', symbol: 'TRX', name: 'Tron' },
  { id: 'uniswap', symbol: 'UNI', name: 'Uniswap' },
  { id: 'stellar', symbol: 'XLM', name: 'Stellar' },
  { id: 'monero', symbol: 'XMR', name: 'Monero' },
  { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos' },
  { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol' },
  { id: 'aptos', symbol: 'APT', name: 'Aptos' },
  { id: 'arbitrum', symbol: 'ARB', name: 'Arbitrum' },
  { id: 'optimism', symbol: 'OP', name: 'Optimism' },
  { id: 'filecoin', symbol: 'FIL', name: 'Filecoin' },
  { id: 'internet-computer', symbol: 'ICP', name: 'Internet Computer' },
  { id: 'hedera-hashgraph', symbol: 'HBAR', name: 'Hedera' },
  { id: 'vechain', symbol: 'VET', name: 'VeChain' },
  { id: 'algorand', symbol: 'ALGO', name: 'Algorand' },
  { id: 'the-graph', symbol: 'GRT', name: 'The Graph' },
  { id: 'kucoin-shares', symbol: 'KCS', name: 'KuCoin Token' },
];

let cryptoHoldings = loadJSON(CRYPTO_KEY, []);
let fundHoldings = loadJSON(FUND_KEY, []);
let priceCache = loadJSON(PRICE_CACHE_KEY, { crypto: {}, stocks: {}, usdToEur: null, updatedAt: null });

const bankList = document.getElementById('bankList');
const bankForm = document.getElementById('bankForm');
const bankTotalEl = document.getElementById('bankTotal');

const cryptoList = document.getElementById('cryptoList');
const cryptoForm = document.getElementById('cryptoForm');
const cryptoCoinSelect = document.getElementById('cryptoCoin');
const cryptoTotalEl = document.getElementById('cryptoTotal');
const cryptoErrorEl = document.getElementById('cryptoError');

const fundList = document.getElementById('fundList');
const fundForm = document.getElementById('fundForm');
const fundTotalEl = document.getElementById('fundTotal');

const patrimonioTotalEl = document.getElementById('patrimonioTotal');
const patrimonioUpdatedEl = document.getElementById('patrimonioUpdated');
const refreshPricesBtn = document.getElementById('refreshPrices');

function savePriceCache() {
  saveJSON(PRICE_CACHE_KEY, priceCache);
}

populateCryptoSelect();

bankForm.addEventListener('submit', e => {
  e.preventDefault();
  bankAccounts.push({
    id: crypto.randomUUID(),
    name: document.getElementById('bankName').value.trim(),
    balance: parseFloat(document.getElementById('bankBalance').value),
  });
  saveBankAccounts();
  bankForm.reset();
});

document.addEventListener('bank-accounts-changed', renderBanks);

cryptoForm.addEventListener('submit', e => {
  e.preventDefault();
  const opt = CRYPTO_OPTIONS.find(c => c.id === cryptoCoinSelect.value);
  cryptoHoldings.push({
    id: crypto.randomUUID(),
    coinId: opt.id,
    symbol: opt.symbol,
    name: opt.name,
    quantity: parseFloat(document.getElementById('cryptoQty').value),
  });
  saveJSON(CRYPTO_KEY, cryptoHoldings);
  cryptoForm.reset();
  renderCrypto();
  fetchCryptoPrices();
});

fundForm.addEventListener('submit', e => {
  e.preventDefault();
  fundHoldings.push({
    id: crypto.randomUUID(),
    name: document.getElementById('fundName').value.trim(),
    invested: parseFloat(document.getElementById('fundInvested').value),
    value: parseFloat(document.getElementById('fundValue').value),
    updatedAt: new Date().toISOString(),
  });
  saveJSON(FUND_KEY, fundHoldings);
  fundForm.reset();
  renderFunds();
});

refreshPricesBtn.addEventListener('click', () => {
  fetchCryptoPrices();
});

document.addEventListener('panel-shown', e => {
  if (e.detail.panel === 'panel-patrimonio') {
    fetchCryptoPrices();
  }
});

function populateCryptoSelect() {
  cryptoCoinSelect.innerHTML = '';
  CRYPTO_OPTIONS.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.symbol} · ${c.name}`;
    cryptoCoinSelect.appendChild(opt);
  });
}

function formatCurrency(n, symbol) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + symbol;
}

function renderBanks() {
  bankList.innerHTML = '';
  bankAccounts.forEach(acc => {
    const li = document.createElement('li');
    li.className = 'asset-item';
    li.innerHTML = `
      <div class="asset-icon">🏦</div>
      <div class="asset-info">
        <div class="asset-name">${escapeHtml(acc.name)}</div>
      </div>
      <div class="asset-value">${formatCurrency(acc.balance, '€')}</div>
      <button class="tx-delete" data-id="${acc.id}" aria-label="Eliminar">✕</button>
    `;
    bankList.appendChild(li);
  });
  bankList.querySelectorAll('.tx-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      bankAccounts = bankAccounts.filter(a => a.id !== btn.dataset.id);
      saveBankAccounts();
    });
  });
  const total = bankAccounts.reduce((s, a) => s + a.balance, 0);
  bankTotalEl.textContent = formatCurrency(total, '€');
  renderTotalPatrimonio();
}

function renderCrypto() {
  cryptoList.innerHTML = '';
  cryptoHoldings.forEach(h => {
    const priceEur = priceCache.crypto[h.coinId];
    const value = priceEur !== undefined ? priceEur * h.quantity : null;
    const li = document.createElement('li');
    li.className = 'asset-item';
    li.innerHTML = `
      <div class="asset-icon">🪙</div>
      <div class="asset-info">
        <div class="asset-name">${h.symbol} <span class="asset-qty">${h.quantity}</span></div>
        <div class="asset-meta">${priceEur !== undefined ? formatCurrency(priceEur, '€') + ' / unidad' : 'precio no disponible'}</div>
      </div>
      <div class="asset-value">${formatCurrency(value, '€')}</div>
      <button class="tx-delete" data-id="${h.id}" aria-label="Eliminar">✕</button>
    `;
    cryptoList.appendChild(li);
  });
  cryptoList.querySelectorAll('.tx-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      cryptoHoldings = cryptoHoldings.filter(h => h.id !== btn.dataset.id);
      saveJSON(CRYPTO_KEY, cryptoHoldings);
      renderCrypto();
    });
  });
  const total = cryptoHoldings.reduce((s, h) => {
    const price = priceCache.crypto[h.coinId];
    return s + (price !== undefined ? price * h.quantity : 0);
  }, 0);
  cryptoTotalEl.textContent = formatCurrency(total, '€');
  renderTotalPatrimonio();
}

function renderFunds() {
  fundList.innerHTML = '';
  fundHoldings.forEach(f => {
    const gain = f.value - f.invested;
    const gainPct = f.invested > 0 ? (gain / f.invested) * 100 : 0;
    const sign = gain >= 0 ? '+' : '';
    const updated = f.updatedAt ? new Date(f.updatedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';
    const li = document.createElement('li');
    li.className = 'asset-item';
    li.innerHTML = `
      <div class="asset-icon">📊</div>
      <div class="asset-info">
        <div class="asset-name">${escapeHtml(f.name)}</div>
        <div class="asset-meta">Aportado ${formatCurrency(f.invested, '€')} · <span class="${gain >= 0 ? 'gain-pos' : 'gain-neg'}">${sign}${formatCurrency(gain, '€')} (${sign}${gainPct.toFixed(2)}%)</span></div>
        ${updated ? `<div class="asset-meta">Actualizado ${updated}</div>` : ''}
      </div>
      <div class="asset-value">${formatCurrency(f.value, '€')}</div>
      <button class="tx-edit" data-id="${f.id}" aria-label="Actualizar valor">✎</button>
      <button class="tx-delete" data-id="${f.id}" aria-label="Eliminar">✕</button>
    `;
    fundList.appendChild(li);
  });
  fundList.querySelectorAll('.tx-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = fundHoldings.find(x => x.id === btn.dataset.id);
      if (!f) return;
      const valueStr = prompt(`Valor actual de "${f.name}" (€):`, f.value);
      if (valueStr === null) return;
      const value = parseFloat(valueStr.replace(',', '.'));
      if (isNaN(value) || value < 0) return;
      const investedStr = prompt(`Total aportado a "${f.name}" (€):`, f.invested);
      if (investedStr !== null) {
        const invested = parseFloat(investedStr.replace(',', '.'));
        if (!isNaN(invested) && invested >= 0) f.invested = invested;
      }
      f.value = value;
      f.updatedAt = new Date().toISOString();
      saveJSON(FUND_KEY, fundHoldings);
      renderFunds();
      document.dispatchEvent(new CustomEvent('prices-updated'));
    });
  });
  fundList.querySelectorAll('.tx-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = fundHoldings.find(x => x.id === btn.dataset.id);
      if (!f || !confirm(`¿Eliminar "${f.name}"?`)) return;
      fundHoldings = fundHoldings.filter(x => x.id !== btn.dataset.id);
      saveJSON(FUND_KEY, fundHoldings);
      renderFunds();
      document.dispatchEvent(new CustomEvent('prices-updated'));
    });
  });
  fundTotalEl.textContent = formatCurrency(getFundsTotal(), '€');
  renderTotalPatrimonio();
}

function getFundsTotal() {
  return fundHoldings.reduce((s, f) => s + f.value, 0);
}

function getPatrimonioTotal() {
  const bankTotal = bankAccounts.reduce((s, a) => s + a.balance, 0);
  const cryptoTotal = cryptoHoldings.reduce((s, h) => {
    const price = priceCache.crypto[h.coinId];
    return s + (price !== undefined ? price * h.quantity : 0);
  }, 0);
  return bankTotal + cryptoTotal + getFundsTotal();
}

function renderTotalPatrimonio() {
  const total = getPatrimonioTotal();
  patrimonioTotalEl.textContent = formatCurrency(total, '€');

  const heroMov = document.getElementById('heroPatrimonioMov');
  const heroInforme = document.getElementById('heroPatrimonioInforme');
  if (heroMov) heroMov.textContent = formatCurrency(total, '€');
  if (heroInforme) heroInforme.textContent = formatCurrency(total, '€');

  if (priceCache.updatedAt) {
    const d = new Date(priceCache.updatedAt);
    patrimonioUpdatedEl.textContent = 'Actualizado ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
}

async function fetchCryptoPrices() {
  if (cryptoHoldings.length === 0) return;
  const ids = [...new Set(cryptoHoldings.map(h => h.coinId))].join(',');
  cryptoErrorEl.textContent = '';
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur`);
    if (!res.ok) throw new Error('Respuesta no válida de CoinGecko');
    const data = await res.json();
    Object.keys(data).forEach(id => {
      priceCache.crypto[id] = data[id].eur;
    });
    priceCache.updatedAt = new Date().toISOString();
    savePriceCache();
    renderCrypto();
    document.dispatchEvent(new CustomEvent('prices-updated'));
  } catch (err) {
    cryptoErrorEl.textContent = 'No se pudieron actualizar los precios de crypto ahora mismo.';
  }
}

renderBanks();
renderCrypto();
renderFunds();
renderTotalPatrimonio();
