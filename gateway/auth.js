// Modul login dan token (bagian dari Policy Administrator)
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db/database');
const config = require('../config');

const router = express.Router();

// ---------- Fungsi bantu ----------

// Access token user: isi sub (id user) dan role, berlaku 10 menit
function buatAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    config.JWT_SECRET,
    { expiresIn: config.ACCESS_TOKEN_EXPIRES }
  );
}

// ---------- POST /auth/login ----------
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const deviceId = req.headers['x-device-id'];

  if (!username || !password) {
    return res.status(400).json({ error: 'username dan password wajib diisi' });
  }

  // 1. Cek kredensial (pesan sengaja dibuat umum agar tidak membocorkan info)
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Kredensial tidak valid' });
  }

  // 2. Cek device terdaftar untuk user ini
  const device = db
    .prepare('SELECT 1 FROM devices WHERE user_id = ? AND device_id = ?')
    .get(user.id, deviceId);
  if (!device) {
    return res.status(403).json({ error: 'Device tidak terdaftar untuk user ini' });
  }

  // 3. Terbitkan access token dan refresh token
  const accessToken = buatAccessToken(user);
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(
    Date.now() + config.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // Refresh token disimpan di database supaya bisa dicabut
  db.prepare(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
  ).run(user.id, refreshToken, expiresAt);

  res.json({ access_token: accessToken, refresh_token: refreshToken });
});

// ---------- POST /auth/refresh ----------
router.post('/refresh', (req, res) => {
  const { refresh_token } = req.body || {};

  const row = db
    .prepare('SELECT * FROM refresh_tokens WHERE token = ?')
    .get(refresh_token || '');

  if (!row) return res.status(401).json({ error: 'Refresh token tidak dikenal' });
  if (row.revoked) return res.status(401).json({ error: 'Refresh token sudah dicabut' });
  if (new Date(row.expires_at) < new Date()) {
    return res.status(401).json({ error: 'Refresh token sudah kedaluwarsa' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  res.json({ access_token: buatAccessToken(user) });
});

// ---------- POST /auth/logout ----------
router.post('/logout', (req, res) => {
  const { refresh_token } = req.body || {};

  // Logout = mencabut refresh token
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?').run(refresh_token || '');
  res.json({ message: 'Logout berhasil, refresh token dicabut' });
});

// ---------- POST /auth/service ----------
router.post('/service', (req, res) => {
  const { client_id, secret } = req.body || {};

  const client = db
    .prepare('SELECT * FROM service_clients WHERE client_id = ?')
    .get(client_id || '');
  if (!client || !bcrypt.compareSync(secret || '', client.secret_hash)) {
    return res.status(401).json({ error: 'Client ID atau secret tidak valid' });
  }

  // Token service: role "service", berlaku 5 menit
  const token = jwt.sign(
    { sub: client.client_id, role: 'service' },
    config.JWT_SECRET,
    { expiresIn: config.SERVICE_TOKEN_EXPIRES }
  );
  res.json({ access_token: token });
});

module.exports = router;