# Sistem Nilai dengan Arsitektur Zero Trust

Tugas Praktikum Individu, Keamanan Informasi (KP70065004), Informatika Universitas Siliwangi.

Sistem ini menerapkan prinsip zero trust (never trust, always verify; least privilege; assume breach) pada aplikasi pengelolaan nilai mata kuliah. API gateway berperan sebagai Policy Enforcement Point (PEP) yang terpisah dari service, sesuai NIST SP 800-207.

## Arsitektur

| Komponen | Port | Peran |
|---|---|---|
| API Gateway | 3000 | PEP. Satu-satunya pintu masuk, memuat Policy Engine/Administrator dan audit log |
| Service Nilai | 3001 | Mengelola data nilai dan kelas, menjalankan finalisasi |
| Service Transkrip | 3002 | Mengelola data transkrip mahasiswa |
| Database (SQLite) | - | Satu database bersama untuk kedua service |

Struktur direktori:

```
config.js              pengaturan (secret, masa berlaku token, jam akses, port)
db/                    koneksi database dan seed data
gateway/               auth.js (login, token), pep.js, policy.js, audit.js, index.js
service-nilai/         Service Nilai
service-transkrip/     Service Transkrip
shared/verifikasi.js   verifikasi gateway secret dan JWT di sisi service
```

## Prasyarat

- Node.js versi 18 atau lebih baru
- Postman atau curl untuk pengujian

## Cara Menjalankan

1. Pasang dependensi:
   ```
   npm install
   ```
2. Isi database dengan data awal (dapat dijalankan berulang untuk mengatur ulang data):
   ```
   node db/seed.js
   ```
3. Jalankan ketiga komponen, masing-masing pada terminal yang terpisah:
   ```
   node gateway/index.js
   node service-nilai/index.js
   node service-transkrip/index.js
   ```
4. Seluruh permintaan dikirim ke gateway di `http://localhost:3000`.

## Daftar Akun Data Awal

Seluruh akun menggunakan kata sandi `password123`. Setiap permintaan dari user wajib menyertakan header `X-Device-ID`.

| Username | Role | NIM | Device ID |
|---|---|---|---|
| admin1 | admin | - | DEV-ADMIN-1 |
| dosen1 | dosen (mengampu Keamanan Informasi, kelas id 1) | - | DEV-DOSEN-1 |
| dosen2 | dosen (mengampu Struktur Data, kelas id 2) | - | DEV-DOSEN-2 |
| mhs1 | mahasiswa | 227006001 | DEV-MHS-1 |
| mhs2 | mahasiswa | 227006002 | DEV-MHS-2 |
| mhs3 | mahasiswa | 227006003 | DEV-MHS-3 |

Akun service: `client_id` = `service-nilai`, `secret` = `rahasia-service-nilai`.

## Endpoint

| Endpoint | Ditangani oleh | Diizinkan |
|---|---|---|
| POST /auth/login | Gateway | Semua user (kredensial valid dan device terdaftar) |
| POST /auth/refresh, /auth/logout | Gateway | Semua user (refresh token valid dan belum dicabut) |
| POST /auth/service | Gateway | Service Nilai (client ID dan secret valid) |
| GET /nilai | Service Nilai | Mahasiswa (nilai sendiri), dosen (kelas yang diampu) |
| PUT /nilai/:id | Service Nilai | Dosen (kelas diampu, belum final, dalam jam akses) |
| POST /kelas/:id/finalisasi | Service Nilai | Dosen (kelas diampu, dalam jam akses) |
| GET /transkrip/:nim | Service Transkrip | Mahasiswa (NIM sendiri), admin (semua NIM) |
| POST /transkrip/sinkron | Service Transkrip | Hanya token service |

## Mekanisme Keamanan

1. **Autentikasi dan token.** Access token berupa JWT berlaku 10 menit (berisi `sub` dan `role`). Refresh token berlaku 1 hari dan disimpan di database sehingga dapat dicabut; logout mencabut refresh token. Token service berlaku 5 menit dengan role `service`.
2. **Gateway secret.** Gateway menambahkan header `X-Gateway-Secret` saat meneruskan permintaan. Service menolak permintaan tanpa header tersebut sehingga tidak dapat diakses langsung.
3. **Verifikasi ulang di service.** Selain gateway secret, setiap service memverifikasi tanda tangan dan masa berlaku token (`shared/verifikasi.js`).
4. **Kebijakan akses.** `gateway/policy.js` memutuskan allow/deny dengan pendekatan default deny. Atribut yang tidak tersedia pada token (kepemilikan kelas, NIM, status final) dibaca dari database.
5. **Verifikasi konteks.** Device harus terdaftar untuk user yang bersangkutan. Perubahan dan finalisasi nilai hanya diizinkan pada jam akses yang diatur melalui `JAM_AKSES` pada `config.js` (bawaan 07.00-21.00 WIB).
6. **Audit log.** Gateway mencatat setiap keputusan akses (waktu, subjek, endpoint, device, hasil, alasan) pada tabel `audit_log` dan pada keluaran terminal. Isi log dapat dilihat dengan `node lihat-audit.js`.

## Alur Finalisasi Nilai

1. Dosen memanggil `POST /kelas/:id/finalisasi` melalui gateway.
2. Gateway memeriksa token, device, dan kebijakan, lalu meneruskan ke Service Nilai.
3. Service Nilai menandai nilai kelas sebagai final.
4. Service Nilai meminta token service ke `POST /auth/service` pada gateway.
5. Service Nilai memanggil `POST /transkrip/sinkron` melalui gateway dengan token service.
6. Gateway hanya mengizinkan token service pada endpoint tersebut, lalu meneruskannya ke Service Transkrip.

## Pengujian

Jalankan `node db/seed.js` dan mulai ulang ketiga komponen sebelum menjalankan skrip pengujian:

```
node tes-tahap5.js
```

Skrip ini menguji alur ubah nilai, finalisasi, sinkron ke transkrip, pembatasan akses antar user, dan penolakan akses langsung ke service. Apabila pengujian dilakukan di luar jam 07.00-21.00 WIB, ubah `JAM_AKSES` pada `config.js` terlebih dahulu.