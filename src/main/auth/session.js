const crypto = require('node:crypto');

// Sesi login. Kunci master hanya ada di memori proses utama dan dihapus saat keluar.
let pengguna = null;
let kunciMaster = null;
let tertunda = false; // true: password dan dongle benar, wajah belum diverifikasi
let gagalWajah = 0;

function mulai(dataPengguna, kunci, opsi) {
  akhiri();
  pengguna = dataPengguna;
  kunciMaster = kunci;
  tertunda = Boolean(opsi && opsi.tertunda);
}

function akhiri() {
  if (kunciMaster) kunciMaster.fill(0);
  kunciMaster = null;
  pengguna = null;
  tertunda = false;
  gagalWajah = 0;
}

function sudahMasuk() {
  return pengguna !== null && kunciMaster !== null && !tertunda;
}

function menungguWajah() {
  return pengguna !== null && kunciMaster !== null && tertunda;
}

function selesaikanWajah() {
  if (!menungguWajah()) throw new Error('Tidak ada verifikasi wajah yang menunggu');
  tertunda = false;
  gagalWajah = 0;
}

// Mengembalikan jumlah kegagalan wajah sejauh ini
function catatGagalWajah() {
  gagalWajah += 1;
  return gagalWajah;
}

// Identitas pengguna yang sedang menunggu verifikasi wajah (bukan sesi penuh)
function penggunaTertunda() {
  if (!menungguWajah()) throw new Error('Tidak ada verifikasi wajah yang menunggu');
  return pengguna;
}

function penggunaSaatIni() {
  if (!sudahMasuk()) throw new Error('Belum login');
  return pengguna;
}

// Subkunci untuk keperluan tertentu, diturunkan dari kunci master dengan HMAC-SHA256
function subkunci(label) {
    if (pengguna === null || kunciMaster === null) throw new Error('Belum login');
  return crypto.createHmac('sha256', kunciMaster).update(label).digest();
}

module.exports = {
  mulai,
  akhiri,
  sudahMasuk,
  menungguWajah,
  selesaikanWajah,
  catatGagalWajah,
  penggunaTertunda,
  penggunaSaatIni,
  subkunci,
};