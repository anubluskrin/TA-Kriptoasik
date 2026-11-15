const { ipcMain } = require('electron');
const superCipher = require('../crypto/superCipher');

const MAKS_TEKS_ENKRIPSI = 10000;
const MAKS_TOKEN_DEKRIPSI = 60000; // 10000 karakter bisa jadi ~40000 byte, Base64 ~53000 karakter

function periksaMasukan(teks, kunciVigenere, kunciDes, maksTeks) {
  if (typeof teks !== 'string' || teks.length > maksTeks) {
    throw new Error(`Teks tidak valid (maksimal ${maksTeks} karakter)`);
  }
  if (typeof kunciVigenere !== 'string' || kunciVigenere.length > 100) {
    throw new Error('Kunci Vigenere tidak valid (maksimal 100 karakter)');
  }
  if (typeof kunciDes !== 'string' || kunciDes.length > 20) {
    throw new Error('Kunci DES tidak valid');
  }
}

// Membungkus hasil agar tampilan menerima { ok: true, ... } atau { ok: false, galat }
function jalankan(aksi) {
  try {
    return { ok: true, ...aksi() };
  } catch (err) {
    return { ok: false, galat: err.message };
  }
}

function daftarkan() {
  ipcMain.handle('pesan:enkripsi', (event, teks, kunciVigenere, kunciDes) =>
    jalankan(() => {
      periksaMasukan(teks, kunciVigenere, kunciDes, MAKS_TEKS_ENKRIPSI);
      return superCipher.encrypt(teks, { kunciVigenere, kunciDes });
    })
  );

  ipcMain.handle('pesan:dekripsi', (event, teks, kunciVigenere, kunciDes) =>
    jalankan(() => {
      periksaMasukan(teks, kunciVigenere, kunciDes, MAKS_TOKEN_DEKRIPSI);
      return superCipher.decrypt(teks, { kunciVigenere, kunciDes });
    })
  );
}

module.exports = { daftarkan };