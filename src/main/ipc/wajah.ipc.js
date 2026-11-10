const { ipcMain } = require('electron');
const wajah = require('../security/wajah');
const dongleMonitor = require('../security/dongleMonitor');

async function jalankan(aksi) {
  try {
    return { ok: true, ...(await aksi()) };
  } catch (err) {
    return { ok: false, galat: err.message };
  }
}

function daftarkan() {
  // Kanal ini dibuka di gerbang, tetapi hanya berhasil bila sesi sedang menunggu wajah
  ipcMain.handle('auth:wajah', (event, embedding) =>
    jalankan(async () => {
      const hasil = wajah.verifikasi(embedding);
      dongleMonitor.mulai(event.sender);
      return { username: hasil.username, skor: hasil.skor };
    })
  );

  ipcMain.handle('wajah:status', () =>
    jalankan(async () => ({ terdaftar: wajah.terdaftar(), ambang: wajah.AMBANG }))
  );

  ipcMain.handle('wajah:daftar', (event, daftarEmbedding) =>
    jalankan(async () => {
      wajah.daftar(daftarEmbedding);
      return { terdaftar: true };
    })
  );

  ipcMain.handle('wajah:uji', (event, embedding) => jalankan(async () => wajah.uji(embedding)));

  ipcMain.handle('wajah:hapus', () =>
    jalankan(async () => {
      wajah.hapus();
      return { terdaftar: false };
    })
  );
}

module.exports = { daftarkan };