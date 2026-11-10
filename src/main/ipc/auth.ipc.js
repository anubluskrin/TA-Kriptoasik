const { ipcMain } = require('electron');
const auth = require('../auth/auth');
const session = require('../auth/session');
const dongleMonitor = require('../security/dongleMonitor');

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
    perluWajah: session.menungguWajah(),
    username: masuk ? session.penggunaSaatIni().username : null,
  };
}

function daftarkan() {
  ipcMain.handle('auth:status', () => jalankan(async () => status()));

    ipcMain.handle('auth:daftar', (event, username, password) =>
    jalankan(async () => {
      await auth.daftar(username, password);
      await auth.masuk(username, password);
      dongleMonitor.mulai(event.sender);
      return status();
    })
  );

  ipcMain.handle('auth:masuk', (event, username, password) =>
    jalankan(async () => {
      await auth.masuk(username, password);
      // Bila wajah diperlukan, pemantau dongle dimulai setelah wajah lolos (di wajah.ipc.js)
      if (!session.menungguWajah()) dongleMonitor.mulai(event.sender);
      return status();
    })
  );

  ipcMain.handle('auth:keluar', () =>
    jalankan(async () => {
      dongleMonitor.berhenti();
      auth.keluar();
      return status();
    })
  );
}

module.exports = { daftarkan };