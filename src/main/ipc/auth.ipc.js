const { ipcMain } = require('electron');
const auth = require('../auth/auth');
const session = require('../auth/session');

async function jalankan(aksi) {
  try {
    return { ok: true, ...(await aksi()) };
  } catch (err) {
    return { ok: false, galat: err.message };
  }
}

function status() {
  const masuk = session.sudahMasuk();
  return {
    adaAkun: auth.adaAkun(),
    masuk,
    username: masuk ? session.penggunaSaatIni().username : null,
  };
}

function daftarkan() {
  ipcMain.handle('auth:status', () => jalankan(async () => status()));

  ipcMain.handle('auth:daftar', (event, username, password) =>
    jalankan(async () => {
      await auth.daftar(username, password);
      await auth.masuk(username, password);
      return status();
    })
  );

  ipcMain.handle('auth:masuk', (event, username, password) =>
    jalankan(async () => {
      await auth.masuk(username, password);
      return status();
    })
  );

  ipcMain.handle('auth:keluar', () =>
    jalankan(async () => {
      auth.keluar();
      return status();
    })
  );
}

module.exports = { daftarkan };