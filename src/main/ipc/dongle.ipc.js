const { ipcMain } = require('electron');
const dongle = require('../security/dongle');

function daftarkan() {
  // Boleh dipanggil sebelum login: hanya melaporkan apakah ada flashdisk terpasang
  ipcMain.handle('dongle:status', async () => {
    try {
      const s = await dongle.status();
      return {
        ok: true,
        terpasang: s.jumlah > 0,
        jumlah: s.jumlah,
        drive: s.drive ? s.drive.drive : null,
        model: s.drive ? s.drive.model : null,
      };
    } catch (err) {
      return { ok: false, galat: err.message };
    }
  });
}

module.exports = { daftarkan };