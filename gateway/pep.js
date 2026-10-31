// Policy Enforcement Point: memeriksa SETIAP request sebelum diteruskan ke service
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const config = require('../config');
const { catat } = require('./audit');
const { putuskan } = require('./policy');

module.exports = function pep(req, res, next) {
  const endpoint = `${req.method} ${req.originalUrl}`;
  const device = req.headers['x-device-id'] || null;

  // Fungsi bantu: catat deny lalu hentikan request
  function tolak(status, subjek, alasan) {
    catat({ subjek, endpoint, device, hasil: 'deny', alasan });
    return res.status(status).json({ error: alasan });
  }

  // 1. Access token wajib ada dan valid
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return tolak(401, 'anonim', 'Access token tidak ada');

  let payload;
  try {
    payload = jwt.verify(token, config.JWT_SECRET);
  } catch (err) {
    const alasan = err.name === 'TokenExpiredError' ? 'Access token kedaluwarsa' : 'Access token tidak valid';
    return tolak(401, 'anonim', alasan);
  }

  const subjek = payload.role === 'service' ? `service:${payload.sub}` : `user:${payload.sub}`;

  // 2. Device harus terdaftar (hanya untuk user, service tidak punya device)
  if (payload.role !== 'service') {
    const terdaftar = db
      .prepare('SELECT 1 FROM devices WHERE user_id = ? AND device_id = ?')
      .get(payload.sub, device);
    if (!terdaftar) return tolak(403, subjek, 'Device tidak terdaftar untuk user ini');
  }

  // 3. Minta keputusan ke Policy Engine
  const keputusan = putuskan({ user: payload, req });
  if (!keputusan.allow) return tolak(403, subjek, keputusan.alasan);

  // 4. Lolos: catat allow, lanjut ke proxy
  catat({ subjek, endpoint, device, hasil: 'allow', alasan: keputusan.alasan });
  next();
};