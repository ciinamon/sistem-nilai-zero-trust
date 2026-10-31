// Policy Engine: memutuskan allow/deny beserta alasan (sesuai Tabel 3 di soal)
// Prinsip: DEFAULT DENY. Kalau tidak ada aturan yang mengizinkan, request ditolak.
const db = require('../db/database');
const config = require('../config');

const allow = (alasan) => ({ allow: true, alasan });
const deny = (alasan) => ({ allow: false, alasan });

// ---------- Fungsi bantu (data dibaca dari database) ----------

// Cek apakah sekarang masih dalam jam akses (zona waktu WIB)
function dalamJamAkses() {
  const jam = parseInt(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date()),
    10
  );
  return jam >= config.JAM_AKSES.mulai && jam < config.JAM_AKSES.selesai;
}

// Apakah dosen ini mengampu kelas tersebut?
function dosenMengampu(dosenId, kelasId) {
  const row = db
    .prepare('SELECT 1 FROM kelas WHERE id = ? AND dosen_id = ?')
    .get(kelasId, dosenId);
  return !!row;
}

// ---------- Fungsi utama ----------
function putuskan({ user, req }) {
  const method = req.method;
  const url = new URL(req.originalUrl, 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '');      // contoh: /nilai/5
  const bagian = path.split('/').filter(Boolean);     // contoh: ['nilai', '5']
  const role = user.role;

  // --- POST /transkrip/sinkron : HANYA token service ---
  if (method === 'POST' && path === '/transkrip/sinkron') {
    if (role === 'service') return allow('token service sah untuk sinkron transkrip');
    return deny('Sinkron transkrip hanya boleh memakai token service, token user ditolak');
  }

  // Token service tidak boleh dipakai di endpoint lain
  if (role === 'service') {
    return deny('Token service hanya boleh untuk POST /transkrip/sinkron');
  }

  // --- GET /nilai : mahasiswa (miliknya), dosen (kelas yang diampu) ---
  if (method === 'GET' && path === '/nilai') {
    if (role === 'mahasiswa') {
      return allow('mahasiswa melihat nilai miliknya sendiri');
    }
    if (role === 'dosen') {
      const kelasId = url.searchParams.get('kelas_id');
      if (kelasId && !dosenMengampu(user.sub, kelasId)) {
        return deny('Dosen tidak mengampu kelas ini');
      }
      return allow('dosen melihat nilai kelas yang diampu');
    }
    return deny('Role ' + role + ' tidak boleh melihat nilai');
  }

  // --- PUT /nilai/:id : dosen, kelas diampu, belum final, dalam jam akses ---
  if (method === 'PUT' && bagian.length === 2 && bagian[0] === 'nilai') {
    if (role !== 'dosen') return deny('Hanya dosen yang boleh mengubah nilai');

    const row = db
      .prepare(
        'SELECT n.final, k.dosen_id FROM nilai n JOIN kelas k ON k.id = n.kelas_id WHERE n.id = ?'
      )
      .get(bagian[1]);
    if (!row) return deny('Data nilai tidak ditemukan');
    if (row.dosen_id !== user.sub) return deny('Dosen tidak mengampu kelas dari nilai ini');
    if (row.final === 1) return deny('Nilai sudah final, tidak boleh diubah');
    if (!dalamJamAkses()) return deny('Di luar jam akses ubah nilai');

    return allow('dosen mengubah nilai kelas yang diampu, belum final, dalam jam akses');
  }

  // --- POST /kelas/:id/finalisasi : dosen, kelas diampu, dalam jam akses ---
  if (
    method === 'POST' &&
    bagian.length === 3 &&
    bagian[0] === 'kelas' &&
    bagian[2] === 'finalisasi'
  ) {
    if (role !== 'dosen') return deny('Hanya dosen yang boleh memfinalisasi nilai');
    if (!dosenMengampu(user.sub, bagian[1])) return deny('Dosen tidak mengampu kelas ini');
    if (!dalamJamAkses()) return deny('Di luar jam akses finalisasi');

    return allow('dosen memfinalisasi kelas yang diampu, dalam jam akses');
  }

  // --- GET /transkrip/:nim : mahasiswa (NIM sendiri), admin (semua) ---
  if (method === 'GET' && bagian.length === 2 && bagian[0] === 'transkrip') {
    if (role === 'admin') return allow('admin melihat transkrip semua mahasiswa');
    if (role === 'mahasiswa') {
      const me = db.prepare('SELECT nim FROM users WHERE id = ?').get(user.sub);
      if (me && me.nim === bagian[1]) return allow('mahasiswa melihat transkrip NIM sendiri');
      return deny('Mahasiswa hanya boleh melihat transkrip NIM sendiri');
    }
    return deny('Role ' + role + ' tidak boleh melihat transkrip');
  }

  // --- Selain itu: DEFAULT DENY ---
  return deny('Tidak ada kebijakan yang mengizinkan request ini (default deny)');
}

module.exports = { putuskan };