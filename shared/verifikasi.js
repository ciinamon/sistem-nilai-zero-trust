// Pemeriksaan di sisi service (verifikasi ulang, tidak percaya gateway begitu saja)
const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = function verifikasi(req, res, next) {
  // 1. Cek gateway secret: service tidak boleh diakses langsung
  if (req.headers['x-gateway-secret'] !== config.GATEWAY_SECRET) {
    return res.status(403).json({ error: 'Akses langsung ditolak: gateway secret tidak ada atau salah' });
  }

  // 2. Cek token: tanda tangan dan masa berlaku diverifikasi ulang
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Token tidak ada' });
  }

  try {
    req.user = jwt.verify(token, config.JWT_SECRET); // berisi sub dan role
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa' });
  }

  next();
};