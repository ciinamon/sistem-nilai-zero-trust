// Script untuk membuat tabel dan mengisi data awal. Aman dijalankan berulang kali.
const bcrypt = require('bcryptjs');
const db = require('./database');

// Hapus tabel lama supaya bersih
db.exec(`
  DROP TABLE IF EXISTS audit_log;
  DROP TABLE IF EXISTS refresh_tokens;
  DROP TABLE IF EXISTS transkrip;
  DROP TABLE IF EXISTS nilai;
  DROP TABLE IF EXISTS kelas;
  DROP TABLE IF EXISTS devices;
  DROP TABLE IF EXISTS service_clients;
  DROP TABLE IF EXISTS users;
`);

// Buat tabel
db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nama TEXT NOT NULL,
    nim TEXT,                -- hanya diisi untuk mahasiswa
    role TEXT NOT NULL       -- 'mahasiswa' | 'dosen' | 'admin'
  );

  CREATE TABLE devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_id TEXT NOT NULL
  );

  CREATE TABLE kelas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    dosen_id INTEGER NOT NULL   -- dosen yang mengampu
  );

  CREATE TABLE nilai (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mahasiswa_id INTEGER NOT NULL,
    kelas_id INTEGER NOT NULL,
    nilai INTEGER NOT NULL,
    final INTEGER NOT NULL DEFAULT 0   -- 0 = belum final, 1 = sudah final
  );

  CREATE TABLE transkrip (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nim TEXT NOT NULL,
    kelas_id INTEGER NOT NULL,
    nama_kelas TEXT NOT NULL,
    nilai INTEGER NOT NULL,
    UNIQUE (nim, kelas_id)
  );

  CREATE TABLE refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE service_clients (
    client_id TEXT PRIMARY KEY,
    secret_hash TEXT NOT NULL
  );

  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    waktu TEXT NOT NULL,
    subjek TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    device TEXT,
    hasil TEXT NOT NULL,     -- 'allow' | 'deny'
    alasan TEXT NOT NULL
  );
`);

// Semua akun seed memakai password: password123
const hash = bcrypt.hashSync('password123', 10);

const addUser = db.prepare(
  'INSERT INTO users (username, password_hash, nama, nim, role) VALUES (?, ?, ?, ?, ?)'
);
const addDevice = db.prepare('INSERT INTO devices (user_id, device_id) VALUES (?, ?)');

// [username, nama, nim, role, device]
const users = [
  ['admin1',  'Admin Prodi',   null,        'admin',     'DEV-ADMIN-1'],
  ['dosen1',  'Dosen Satu',    null,        'dosen',     'DEV-DOSEN-1'],
  ['dosen2',  'Dosen Dua',     null,        'dosen',     'DEV-DOSEN-2'],
  ['mhs1',    'Mahasiswa Satu', '227006001', 'mahasiswa', 'DEV-MHS-1'],
  ['mhs2',    'Mahasiswa Dua',  '227006002', 'mahasiswa', 'DEV-MHS-2'],
  ['mhs3',    'Mahasiswa Tiga', '227006003', 'mahasiswa', 'DEV-MHS-3'],
];

for (const [username, nama, nim, role, device] of users) {
  const info = addUser.run(username, hash, nama, nim, role);
  addDevice.run(info.lastInsertRowid, device);
}

// 2 kelas, diampu dosen yang berbeda (dosen1 id=2, dosen2 id=3)
db.prepare('INSERT INTO kelas (nama, dosen_id) VALUES (?, ?)').run('Keamanan Informasi', 2);
db.prepare('INSERT INTO kelas (nama, dosen_id) VALUES (?, ?)').run('Struktur Data', 3);

// Nilai awal: tiap mahasiswa (id 4,5,6) punya nilai di kedua kelas, belum final
const addNilai = db.prepare('INSERT INTO nilai (mahasiswa_id, kelas_id, nilai) VALUES (?, ?, ?)');
const dataNilai = [
  [4, 1, 80], [4, 2, 75],
  [5, 1, 85], [5, 2, 70],
  [6, 1, 90], [6, 2, 88],
];
for (const [m, k, n] of dataNilai) addNilai.run(m, k, n);

// Akun service (Service Nilai) untuk /auth/service
db.prepare('INSERT INTO service_clients (client_id, secret_hash) VALUES (?, ?)')
  .run('service-nilai', bcrypt.hashSync('rahasia-service-nilai', 10));

console.log('Seed selesai.');