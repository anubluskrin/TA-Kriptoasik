const { ipcMain } = require('electron');
const superCipher = require('../crypto/superCipher');

function periksaMasukan(teks, kunci) {
  if (typeof teks !== 'string' || teks.length > 10000) {
    throw new Error('Teks tidak valid (maksimal 10000 karakter)');
  }
  if (typeof kunci !== 'string' || kunci.length > 100) {
    throw new Error('Kunci tidak valid (maksimal 100 karakter)');
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
  ipcMain.handle('pesan:enkripsi', (event, teks, kunciVigenere) =>
    jalankan(() => {
      periksaMasukan(teks, kunciVigenere);
      return superCipher.encrypt(teks, { kunciVigenere });
    })
  );

  ipcMain.handle('pesan:dekripsi', (event, teks, kunciVigenere) =>
    jalankan(() => {
      periksaMasukan(teks, kunciVigenere);
      return superCipher.decrypt(teks, { kunciVigenere });
    })
  );
}

module.exports = { daftarkan };