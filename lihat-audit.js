// Menampilkan 15 catatan audit log terakhir. Jalankan: node lihat-audit.js
const db = require('./db/database');

const rows = db
  .prepare('SELECT waktu, subjek, endpoint, device, hasil, alasan FROM audit_log ORDER BY id DESC LIMIT 15')
  .all()
  .reverse();

console.table(rows);