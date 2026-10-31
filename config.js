// Semua pengaturan dikumpulkan di sini supaya mudah diubah dan didemokan
module.exports = {
  JWT_SECRET: 'kunci-rahasia-jwt-sistem-nilai-2026',
  GATEWAY_SECRET: 'rahasia-gateway-antar-service',

    SERVICE_CLIENT: { client_id: 'service-nilai', secret: 'rahasia-service-nilai' },

  ACCESS_TOKEN_EXPIRES: '10m',   // access token user
  SERVICE_TOKEN_EXPIRES: '5m',   // token service
  REFRESH_TOKEN_DAYS: 1,         // refresh token berlaku 1 hari

  // Jam akses ubah/finalisasi nilai (dipakai di tahap berikutnya)
  JAM_AKSES: { mulai: 7, selesai: 21 },

  PORT: { gateway: 3000, nilai: 3001, transkrip: 3002 },
};