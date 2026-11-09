const { ipcMain } = require('electron');
const session = require('../auth/session');

// Kanal yang boleh dipanggil sebelum login
const TERBUKA = new Set(['app:ping', 'auth:status', 'auth:daftar', 'auth:masuk', 'auth:keluar']);

// Menjalankan `daftarkanSemua` dengan ipcMain.handle yang dibungkus pemeriksaan login
function daftarkanDenganGerbang(daftarkanSemua) {
  const asli = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (kanal, pendengar) =>
    asli(kanal, (event, ...argumen) => {
      if (!TERBUKA.has(kanal) && !session.sudahMasuk()) {
        return { ok: false, galat: 'Belum login' };
      }
      return pendengar(event, ...argumen);
    });
  try {
    daftarkanSemua();
  } finally {
    delete ipcMain.handle; // kembalikan ke fungsi bawaan
  }
}

module.exports = { daftarkanDenganGerbang };