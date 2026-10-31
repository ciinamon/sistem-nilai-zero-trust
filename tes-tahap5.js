// Tes alur nilai -> finalisasi -> transkrip. Jalankan: node tes-tahap5.js
// Sebelum menjalankan: node db/seed.js lalu restart ketiga server.
const BASE = 'http://localhost:3000';

async function kirim(method, path, token, device, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (device) headers['X-Device-ID'] = device;
  const r = await fetch(BASE + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function login(username, device) {
  const r = await kirim('POST', '/auth/login', null, device, { username, password: 'password123' });
  return r.body.access_token;
}

function cek(nama, hasil, harapan) {
  const ok = hasil.status === harapan;
  console.log(`${ok ? 'BENAR ' : 'SALAH '} | ${nama} -> ${hasil.status} (seharusnya ${harapan})`);
  return hasil;
}

(async () => {
  const mhs1 = await login('mhs1', 'DEV-MHS-1');
  const dosen1 = await login('dosen1', 'DEV-DOSEN-1');
  const admin1 = await login('admin1', 'DEV-ADMIN-1');

  console.log('--- Nilai ---');
  const lihat = cek('mhs1 lihat nilai', await kirim('GET', '/nilai', mhs1, 'DEV-MHS-1'), 200);
  console.log('   isi nilai mhs1:', JSON.stringify(lihat.body));
  cek('dosen1 ubah nilai id 1 jadi 95', await kirim('PUT', '/nilai/1', dosen1, 'DEV-DOSEN-1', { nilai: 95 }), 200);

  console.log('--- Finalisasi kelas 1 (lalu sinkron ke transkrip) ---');
  const fin = cek('dosen1 finalisasi kelas 1', await kirim('POST', '/kelas/1/finalisasi', dosen1, 'DEV-DOSEN-1'), 200);
  console.log('   respons:', JSON.stringify(fin.body));
  cek('dosen1 ubah nilai id 1 SETELAH final', await kirim('PUT', '/nilai/1', dosen1, 'DEV-DOSEN-1', { nilai: 50 }), 403);

  console.log('--- Transkrip ---');
  const tr = cek('mhs1 lihat transkrip sendiri', await kirim('GET', '/transkrip/227006001', mhs1, 'DEV-MHS-1'), 200);
  console.log('   isi transkrip mhs1:', JSON.stringify(tr.body));
  cek('mhs1 lihat transkrip mhs2', await kirim('GET', '/transkrip/227006002', mhs1, 'DEV-MHS-1'), 403);
  const adm = cek('admin lihat transkrip mhs2', await kirim('GET', '/transkrip/227006002', admin1, 'DEV-ADMIN-1'), 200);
  console.log('   isi transkrip mhs2:', JSON.stringify(adm.body));

  console.log('--- Akses langsung ke service (tanpa gateway) ---');
  const langsung = await fetch(`http://127.0.0.1:${3002}/transkrip/227006001`);
  console.log(`${langsung.status === 403 ? 'BENAR ' : 'SALAH '} | akses langsung ke port 3002 -> ${langsung.status} (seharusnya 403)`);
})();