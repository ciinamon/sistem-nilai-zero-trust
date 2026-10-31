// API Gateway (PEP) - port 3000. Satu-satunya pintu masuk.
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('../config');
const authRouter = require('./auth');
const pep = require('./pep');
const { auditAuth } = require('./audit');

const app = express();

// 1. Endpoint /auth ditangani langsung oleh gateway
app.use('/auth', express.json(), auditAuth, authRouter);

// 2. Endpoint lain: wajib lewat pemeriksaan PEP dulu
app.use(['/nilai', '/kelas', '/transkrip'], pep);

// 3. Setelah lolos, request diteruskan ke service dengan menambah X-Gateway-Secret
function proxyKe(target, filter) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathFilter: filter,
    on: {
      proxyReq: (proxyReq) => proxyReq.setHeader('X-Gateway-Secret', config.GATEWAY_SECRET),
    },
  });
}

app.use(proxyKe(`http://127.0.0.1:${config.PORT.nilai}`, ['/nilai', '/kelas']));
app.use(proxyKe(`http://127.0.0.1:${config.PORT.transkrip}`, '/transkrip'));

// Jalur lain tidak dikenal
app.use((req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

app.listen(config.PORT.gateway, () => {
  console.log(`Gateway berjalan di http://localhost:${config.PORT.gateway}`);
});