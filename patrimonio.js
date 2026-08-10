const CRYPTO_KEY = 'finanzas.crypto';
const STOCK_KEY = 'finanzas.stocks';
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
let stockHoldings = loadJSON(STOCK_KEY, []);
let priceCache = loadJSON(PRICE_CACHE_KEY, { crypto: {}, stocks: {}, usdToEur: null, updatedAt: null });

const bankList = document.getElementById('bankList');
const bankForm = document.getElementById('bankForm');
const bankTotalEl = document.getElementById('bankTotal');

const cryptoList = document.getElementById('cryptoList');
const cryptoForm = document.getElementById('cryptoForm');
const cryptoCoinSelect = document.getElementById('cryptoCoin');
const cryptoTotalEl = document.getElementById('cryptoTotal');
const cryptoErrorEl = document.getElementById('cryptoError');

const stockList = document.getElementById('stockList');
const stockForm = document.getElementById('stockForm');
const stockTotalEl = document.getElementById('stockTotal');
const stockErrorEl = document.getElementById('stockError');

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

stockForm.addEventListener('submit', e => {
  e.preventDefault();
  stockHoldings.push({
    id: crypto.randomUUID(),
    ticker: document.getElementById('stockTicker').value.trim().toUpperCase(),
    quantity: parseFloat(document.getElementById('stockQty').value),
  });
  saveJSON(STOCK_KEY, stockHoldings);
  stockForm.reset();
  renderStocks();
  fetchStockPrices();
});

refreshPricesBtn.addEventListener('click', () => {
  fetchCryptoPrices();
  fetchStockPrices();
});

document.addEventListener('panel-shown', e => {
  if (e.detail.panel === 'panel-patrimonio') {
    fetchCryptoPrices();
    fetchStockPrices();
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

function renderStocks() {
  stockList.innerHTML = '';
  stockHoldings.forEach(h => {
    const entry = priceCache.stocks[h.ticker];
    const symbol = entry ? (entry.currency === 'EUR' ? '€' : entry.currency === 'USD' ? '$' : entry.currency) : '';
    const value = entry ? entry.price * h.quantity : null;
    const li = document.createElement('li');
    li.className = 'asset-item';
    li.innerHTML = `
      <div class="asset-icon">📈</div>
      <div class="asset-info">
        <div class="asset-name">${h.ticker} <span class="asset-qty">${h.quantity}</span></div>
        <div class="asset-meta">${entry ? formatCurrency(entry.price, symbol) + ' / unidad' : 'precio no disponible'}</div>
      </div>
      <div class="asset-value">${entry ? formatCurrency(value, symbol) : '—'}</div>
      <button class="tx-delete" data-id="${h.id}" aria-label="Eliminar">✕</button>
    `;
    stockList.appendChild(li);
  });
  stockList.querySelectorAll('.tx-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      stockHoldings = stockHoldings.filter(h => h.id !== btn.dataset.id);
      saveJSON(STOCK_KEY, stockHoldings);
      renderStocks();
    });
  });
  const totalEur = stockHoldings.reduce((s, h) => {
    const eur = eurValue(priceCache.stocks[h.ticker]);
    return s + (eur !== null ? eur * h.quantity : 0);
  }, 0);
  stockTotalEl.textContent = formatCurrency(totalEur, '€');
  renderTotalPatrimonio();
}

function getPatrimonioTotal() {
  const bankTotal = bankAccounts.reduce((s, a) => s + a.balance, 0);
  const cryptoTotal = cryptoHoldings.reduce((s, h) => {
    const price = priceCache.crypto[h.coinId];
    return s + (price !== undefined ? price * h.quantity : 0);
  }, 0);
  const stockTotalEur = stockHoldings.reduce((s, h) => {
    const eur = eurValue(priceCache.stocks[h.ticker]);
    return s + (eur !== null ? eur * h.quantity : 0);
  }, 0);
  return bankTotal + cryptoTotal + stockTotalEur;
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

function eurValue(priceEntry) {
  if (!priceEntry) return null;
  if (priceEntry.currency === 'EUR') return priceEntry.price;
  if (priceEntry.currency === 'USD') return priceCache.usdToEur ? priceEntry.price * priceCache.usdToEur : null;
  return null;
}

async function fetchStockPrices() {
  if (stockHoldings.length === 0) return;
  stockErrorEl.textContent = '';
  try {
    const tickers = [...new Set(stockHoldings.map(h => h.ticker))];
    let anyUnsupportedCurrency = false;
    for (const ticker of tickers) {
      const res = await fetch(`/api/quote?symbol=${encodeURIComponent(ticker)}`);
      const data = await res.json();
      if (!res.ok || typeof data.price !== 'number') continue;
      priceCache.stocks[ticker] = { price: data.price, currency: data.currency };
      if (data.currency !== 'EUR' && data.currency !== 'USD') anyUnsupportedCurrency = true;
    }
    try {
      const fx = await fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=EUR');
      if (fx.ok) {
        const fxData = await fx.json();
        priceCache.usdToEur = fxData.rates.EUR;
      }
    } catch (fxErr) {
      // El tipo de cambio es opcional para el total; los precios ya obtenidos se guardan igual.
    }
    priceCache.updatedAt = new Date().toISOString();
    savePriceCache();
    renderStocks();
    document.dispatchEvent(new CustomEvent('prices-updated'));
    if (anyUnsupportedCurrency) {
      stockErrorEl.textContent = 'Alguno de tus tickers cotiza en una divisa no soportada (solo EUR/USD) y no entra en el total.';
    }
  } catch (err) {
    stockErrorEl.textContent = 'No se pudieron actualizar los precios de stocks ahora mismo.';
  }
}

renderBanks();
renderCrypto();
renderStocks();
renderTotalPatrimonio();
