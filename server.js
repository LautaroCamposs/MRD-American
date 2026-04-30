const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');

const app = express();

const STORE_ID     = process.env.STORE_ID     || '';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
const PORT         = process.env.PORT         || 8080;

if (!STORE_ID || !ACCESS_TOKEN) {
  console.error('ERROR: STORE_ID y ACCESS_TOKEN son requeridos como variables de entorno.');
  process.exit(1);
}

const TN_BASE    = `https://api.tiendanube.com/v1/${STORE_ID}`;
const TN_HEADERS = {
  Authentication: `bearer ${ACCESS_TOKEN}`,
  'User-Agent':   'MRD American (lautarocampos02@gmail.com)',
};

// ── Cache en memoria (TTL 2 min) ───────────────────────────────
const cache   = new Map();
const CACHE_TTL = 2 * 60 * 1000;

function getCached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL) { cache.delete(key); return null; }
  return hit;
}

function setCached(key, body, total) {
  cache.set(key, { body, total, ts: Date.now() });
}

// ── Proxy helper ───────────────────────────────────────────────
async function proxyTN(endpoint, query, res) {
  const url = new URL(`${TN_BASE}/${endpoint}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v != null && v !== '') url.searchParams.set(k, v);
  });

  const cacheKey = url.toString();
  const cached   = getCached(cacheKey);

  if (cached) {
    res.set('X-Cache', 'HIT');
    if (cached.total) res.set('x-total-count', cached.total);
    return res.json(cached.body);
  }

  const upstream = await fetch(url.toString(), { headers: TN_HEADERS });
  if (!upstream.ok) {
    return res.status(upstream.status).json({ error: `Upstream error ${upstream.status}` });
  }

  const body  = await upstream.json();
  const total = upstream.headers.get('x-total-count') || '0';

  setCached(cacheKey, body, total);

  res.set('X-Cache', 'MISS');
  if (total) res.set('x-total-count', total);
  res.json(body);
}

// ── Rutas API ──────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    await proxyTN('products', req.query, res);
  } catch (err) {
    console.error('products:', err.message);
    res.status(502).json({ error: 'Proxy error' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    await proxyTN('categories', req.query, res);
  } catch (err) {
    console.error('categories:', err.message);
    res.status(502).json({ error: 'Proxy error' });
  }
});

// ── Archivos estáticos ─────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`MRD American corriendo en puerto ${PORT}`);
});
