// Service Nilai (port 3001): data nilai dan kelas
const express = require('express');
const db = require('../db/database');
const config = require('../config');
const verifikasi = require('../shared/verifikasi');

const app = express();
app.use(express.json());
app.use(verifikasi); // cek gateway secret + JWT (verifikasi ulang)

const GATEWAY = `http://127.0.0.1:${config.PORT.gateway}`;

// GET /nilai : mahasiswa lihat miliknya, dosen lihat kelas yang diampu
app.get('/nilai', (req, res) => {
  const { sub, role } = req.user;

  if (role === 'mahasiswa') {
    const rows = db.prepare(
      `SELECT n.id, k.nama AS kelas, n.nilai, n.final
       FROM nilai n JOIN kelas k ON k.id = n.kelas_id
       WHERE n.mahasiswa_id = ?`
    ).all(sub);
    return res.json(rows);
  }

  if (role === 'dosen') {
    let sql = `SELECT n.id, u.nama AS mahasiswa, k.nama AS kelas, n.nilai, n.final
               FROM nilai n
               JOIN kelas k ON k.id = n.kelas_id
               JOIN users u ON u.id = n.mahasiswa_id
               WHERE k.dosen_id = ?`;
    const params = [sub];
    if (req.query.kelas_id) {
      sql += ' AND k.id = ?';
      params.push(req.query.kelas_id);
    }
    return res.json(db.prepare(sql).all(...params));
  }

  res.status(403).json({ error: 'Role tidak boleh melihat nilai' });
});

// PUT /nilai/:id : dosen ubah nilai (kelas diampu, belum final)
app.put('/nilai/:id', (req, res) => {
  if (req.user.role !== 'dosen') {
    return res.status(403).json({ error: 'Hanya dosen yang boleh mengubah nilai' });
  }

  const nilai = Number(req.body && req.body.nilai);
  if (!Number.isInteger(nilai) || nilai < 0 || nilai > 100) {
    return res.status(400).json({ error: 'nilai harus bilangan bulat 0-100' });
  }

  // Syarat kepemilikan dan status final dicek lagi langsung di query
  const info = db.prepare(
    `UPDATE nilai SET nilai = ?
     WHERE id = ? AND final = 0
       AND kelas_id IN (SELECT id FROM kelas WHERE dosen_id = ?)`
  ).run(nilai, req.params.id, req.user.sub);

  if (info.changes === 0) {
    return res.status(403).json({ error: 'Nilai tidak ditemukan, sudah final, atau bukan kelas Anda' });
  }
  res.json({ message: 'Nilai berhasil diubah', id: Number(req.params.id), nilai });
});

// POST /kelas/:id/finalisasi : finalisasi nilai lalu sinkron ke transkrip
app.post('/kelas/:id/finalisasi', async (req, res) => {
  const kelasId = req.params.id;
  const kelas = db.prepare('SELECT * FROM kelas WHERE id = ? AND dosen_id = ?')
    .get(kelasId, req.user.sub);

  if (req.user.role !== 'dosen' || !kelas) {
    return res.status(403).json({ error: 'Anda tidak mengampu kelas ini' });
  }

  // 1. Tandai semua nilai di kelas ini sebagai final
  db.prepare('UPDATE nilai SET final = 1 WHERE kelas_id = ?').run(kelasId);

  // 2. Siapkan data yang dikirim ke transkrip
  const data = db.prepare(
    `SELECT u.nim, k.id AS kelas_id, k.nama AS nama_kelas, n.nilai
     FROM nilai n
     JOIN users u ON u.id = n.mahasiswa_id
     JOIN kelas k ON k.id = n.kelas_id
     WHERE n.kelas_id = ?`
  ).all(kelasId);

  try {
    // 3. Ambil token service dari gateway
    const t = await fetch(GATEWAY + '/auth/service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config.SERVICE_CLIENT),
    });
    if (!t.ok) throw new Error('gagal mengambil token service');
    const { access_token } = await t.json();

    // 4. Panggil sinkron transkrip LEWAT GATEWAY memakai token service
    const s = await fetch(GATEWAY + '/transkrip/sinkron', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + access_token,
      },
      body: JSON.stringify({ data }),
    });
    const hasil = await s.json();
    if (!s.ok) throw new Error(hasil.error || 'sinkron ditolak');

    res.json({ message: 'Kelas difinalisasi dan transkrip tersinkron', sinkron: hasil });
  } catch (err) {
    res.status(502).json({ error: 'Nilai sudah final, tapi sinkron transkrip gagal: ' + err.message });
  }
});

app.listen(config.PORT.nilai, () => {
  console.log(`Service Nilai berjalan di http://localhost:${config.PORT.nilai}`);
});