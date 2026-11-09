const crypto = require('node:crypto');

// Sesi login. Kunci master hanya ada di memori proses utama dan dihapus saat keluar.
let pengguna = null;
let kunciMaster = null;

function mulai(dataPengguna, kunci) {
  akhiri();
  pengguna = dataPengguna;
  kunciMaster = kunci;
}

function akhiri() {
  if (kunciMaster) kunciMaster.fill(0);
  kunciMaster = null;
  pengguna = null;
}

function sudahMasuk() {
  return pengguna !== null && kunciMaster !== null;
}

function penggunaSaatIni() {
  if (!sudahMasuk()) throw new Error('Belum login');
  return pengguna;
}

// Subkunci untuk keperluan tertentu, diturunkan dari kunci master dengan HMAC-SHA256
function subkunci(label) {
  if (!sudahMasuk()) throw new Error('Belum login');
  return crypto.createHmac('sha256', kunciMaster).update(label).digest();
}

module.exports = { mulai, akhiri, sudahMasuk, penggunaSaatIni, subkunci };