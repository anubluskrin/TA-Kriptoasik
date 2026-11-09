const { ipcMain } = require('electron');
const session = require('../auth/session');
const pesanPenting = require('../db/pesanPenting');

async function jalankan(aksi) {
  try {
    return { ok: true, ...(await aksi()) };
  } catch (err) {
    return { ok: false, galat: err.message };
  }
}

function daftarkan() {
  ipcMain.handle('arsip:simpan', (event, label, isi) =>
    jalankan(async () => {
      const id = pesanPenting.simpan(session.penggunaSaatIni().id, label, isi, session.subkunci('db'));
      return { id };
    })
  );

  ipcMain.handle('arsip:daftar', () =>
    jalankan(async () => ({
      daftar: pesanPenting.daftar(session.penggunaSaatIni().id, session.subkunci('db')),
    }))
  );

  ipcMain.handle('arsip:buka', (event, id) =>
    jalankan(async () => {
      if (!Number.isInteger(id) || id < 1) throw new Error('Nomor pesan tidak valid');
      return { pesan: pesanPenting.buka(session.penggunaSaatIni().id, id, session.subkunci('db')) };
    })
  );
}

module.exports = { daftarkan };