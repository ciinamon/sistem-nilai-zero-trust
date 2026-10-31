// Tes otomatis kebijakan akses. Jalankan: node tes-policy.js
const BASE = 'http://localhost:3000';

async function login(username, device) {
  const r = await fetch(BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-ID': device },
    body: JSON.stringify({ username, password: 'password123' }),
  });
  return (await r.json()).access_token;
}

async function tokenService() {
  const r = await fetch(BASE + '/auth/service', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: 'service-nilai', secret: 'rahasia-service-nilai' }),
  });
  return (await r.json()).access_token;
}

async function tes(nama, token, device, method, path, harapan) {
  const headers = { Authorization: 'Bearer ' + token };
  if (device) headers['X-Device-ID'] = device;
  const r = await fetch(BASE + path, { method, headers });
  const ok = r.status === harapan;
  console.log(`${ok ? 'BENAR ' : 'SALAH '} | ${nama} -> status ${r.status} (seharusnya ${harapan})`);
}

(async () => {
  const mhs1 = await login('mhs1', 'DEV-MHS-1');
  const dosen1 = await login('dosen1', 'DEV-DOSEN-1');
  const admin1 = await login('admin1', 'DEV-ADMIN-1');
  const svc = await tokenService();

  console.log('--- MAHASISWA (mhs1) ---');
  await tes('mhs1 lihat nilai', mhs1, 'DEV-MHS-1', 'GET', '/nilai', 200);
  await tes('mhs1 lihat transkrip NIM sendiri', mhs1, 'DEV-MHS-1', 'GET', '/transkrip/227006001', 200);
  await tes('mhs1 lihat transkrip NIM orang lain', mhs1, 'DEV-MHS-1', 'GET', '/transkrip/227006002', 403);
  await tes('mhs1 ubah nilai', mhs1, 'DEV-MHS-1', 'PUT', '/nilai/1', 403);

  console.log('--- ADMIN (admin1) ---');
  await tes('admin lihat transkrip mhs2', admin1, 'DEV-ADMIN-1', 'GET', '/transkrip/227006002', 200);
  await tes('admin lihat nilai', admin1, 'DEV-ADMIN-1', 'GET', '/nilai', 403);

  console.log('--- DOSEN (dosen1, mengampu kelas 1) ---');
  await tes('dosen1 lihat nilai kelas 1', dosen1, 'DEV-DOSEN-1', 'GET', '/nilai?kelas_id=1', 200);
  await tes('dosen1 lihat nilai kelas 2', dosen1, 'DEV-DOSEN-1', 'GET', '/nilai?kelas_id=2', 403);
  await tes('dosen1 ubah nilai id 1 (kelas 1)', dosen1, 'DEV-DOSEN-1', 'PUT', '/nilai/1', 200);
  await tes('dosen1 ubah nilai id 2 (kelas 2)', dosen1, 'DEV-DOSEN-1', 'PUT', '/nilai/2', 403);
  await tes('dosen1 finalisasi kelas 1', dosen1, 'DEV-DOSEN-1', 'POST', '/kelas/1/finalisasi', 200);
  await tes('dosen1 finalisasi kelas 2', dosen1, 'DEV-DOSEN-1', 'POST', '/kelas/2/finalisasi', 403);

  console.log('--- SINKRON TRANSKRIP ---');
  await tes('token service sinkron', svc, null, 'POST', '/transkrip/sinkron', 200);
  await tes('token mhs1 sinkron', mhs1, 'DEV-MHS-1', 'POST', '/transkrip/sinkron', 403);
  await tes('token dosen1 sinkron', dosen1, 'DEV-DOSEN-1', 'POST', '/transkrip/sinkron', 403);
})();