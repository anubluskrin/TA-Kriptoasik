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

  // Tiga kanal berikut dibuka di gerbang, tetapi hanya berhasil bila akun baru menunggu pendaftaran wajah
  ipcMain.handle('auth:daftarWajah', (event, daftarEmbedding) =>
    jalankan(async () => {
      wajah.daftarAwal(daftarEmbedding);
      return { terdaftar: true };
    })
  );

  ipcMain.handle('auth:ujiWajah', (event, embedding) => jalankan(async () => wajah.ujiAwal(embedding)));

  ipcMain.handle('auth:selesaiDaftarWajah', (event) =>
    jalankan(async () => {
      const hasil = wajah.selesaiDaftar();
      dongleMonitor.mulai(event.sender);
      return { username: hasil.username };
    })
  );
}

module.exports = { daftarkan };