const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 6100;
const DEFAULT_FILE = 'index.html';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function sendJSON(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

async function handleQuote(req, res) {
  const symbol = new URL(req.url, `http://${req.headers.host}`).searchParams.get('symbol');
  if (!symbol) return sendJSON(res, 400, { error: 'Falta el parámetro symbol' });

  try {
    const upstream = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await upstream.json();
    const meta = data && data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') {
      return sendJSON(res, 404, { error: 'Símbolo no encontrado' });
    }
    sendJSON(res, 200, { price: meta.regularMarketPrice, currency: meta.currency });
  } catch (err) {
    sendJSON(res, 502, { error: 'Error consultando la cotización' });
  }
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/api/quote') {
    handleQuote(req, res);
    return;
  }

  if (urlPath === '/') urlPath = '/' + DEFAULT_FILE;

  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor local activo en http://localhost:${PORT}`);
});
