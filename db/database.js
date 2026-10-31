// Koneksi ke database SQLite (satu database dipakai bersama oleh kedua service)
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'sistem-nilai.db'));
module.exports = db;