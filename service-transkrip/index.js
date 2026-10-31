// Service Transkrip (port 3002): data transkrip mahasiswa
const express = require('express');
const db = require('../db/database');
const config = require('../config');
const verifikasi = require('../shared/verifikasi');

const app = express();
app.use(express.json());
app.use(verifikasi); // cek gateway secret + JWT (verifikasi ulang)

// POST /transkrip/sinkron : HANYA token service
app.post('/transkrip/sinkron', (req, res) => {
  if (req.user.role !== 'service') {
    return res.status(403).json({ error: 'Hanya token service yang boleh sinkron transkrip' });
  }

  const data = req.body && req.body.data;
  if (!Array.isArray(data)) {
    return res.status(400).json({ error: 'data harus berupa array' });
  }

  // Kalau sudah ada (nim + kelas sama), nilainya diperbarui
  const upsert = db.prepare(
    `INSERT INTO transkrip (nim, kelas_id, nama_kelas, nilai) VALUES (?, ?, ?, ?)
     ON CONFLICT(nim, kelas_id) DO UPDATE SET nilai = excluded.nilai, nama_kelas = excluded.nama_kelas`
  );
  const simpanSemua = db.transaction((rows) => {
    for (const r of rows) upsert.run(r.nim, r.kelas_id, r.nama_kelas, r.nilai);
  });
  simpanSemua(data);

  res.json({ message: 'Sinkron berhasil', jumlah: data.length });
});

// GET /transkrip/:nim : mahasiswa (NIM sendiri), admin (semua)
app.get('/transkrip/:nim', (req, res) => {
  const { role, sub } = req.user;

  if (role === 'mahasiswa') {
    const me = db.prepare('SELECT nim FROM users WHERE id = ?').get(sub);
    if (!me || me.nim !== req.params.nim) {
      return res.status(403).json({ error: 'Mahasiswa hanya boleh melihat NIM sendiri' });
    }
  } else if (role !== 'admin') {
    return res.status(403).json({ error: 'Role tidak boleh melihat transkrip' });
  }

  const rows = db.prepare(
    'SELECT nama_kelas, nilai FROM transkrip WHERE nim = ?'
  ).all(req.params.nim);
  res.json({ nim: req.params.nim, transkrip: rows });
});

app.listen(config.PORT.transkrip, () => {
  console.log(`Service Transkrip berjalan di http://localhost:${config.PORT.transkrip}`);
});