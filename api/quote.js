module.exports = async function handler(req, res) {
  const symbol = req.query.symbol;
  if (!symbol) {
    res.status(400).json({ error: 'Falta el parámetro symbol' });
    return;
  }

  try {
    const upstream = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await upstream.json();
    const meta = data && data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') {
      res.status(404).json({ error: 'Símbolo no encontrado' });
      return;
    }
    res.status(200).json({ price: meta.regularMarketPrice, currency: meta.currency });
  } catch (err) {
    res.status(502).json({ error: 'Error consultando la cotización' });
  }
};
