// Audit log: mencatat setiap keputusan akses ke database dan terminal
const db = require('../db/database');

const simpan = db.prepare(
  'INSERT INTO audit_log (waktu, subjek, endpoint, device, hasil, alasan) VALUES (?, ?, ?, ?, ?, ?)'
);

function catat({ subjek, endpoint, device, hasil, alasan }) {
  const waktu = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' });
  simpan.run(waktu, subjek, endpoint, device || '-', hasil, alasan);
  console.log(`[AUDIT] ${hasil.toUpperCase()} | ${subjek} | ${endpoint} | ${alasan}`);
}

// Middleware khusus endpoint /auth: mencatat hasil login, refresh, logout, service
function auditAuth(req, res, next) {
  const asliJson = res.json.bind(res);
  res.json = (body) => {
    res.locals.pesan = (body && (body.error || body.message)) || '';
    return asliJson(body);
  };

  res.on('finish', () => {
    const b = req.body || {};
    catat({
      subjek: b.username || b.client_id || (b.refresh_token ? 'pemegang-refresh-token' : 'anonim'),
      endpoint: `${req.method} ${req.originalUrl}`,
      device: req.headers['x-device-id'],
      hasil: res.statusCode < 400 ? 'allow' : 'deny',
      alasan: res.locals.pesan || `HTTP ${res.statusCode}`,
    });
  });

  next();
}

module.exports = { catat, auditAuth };