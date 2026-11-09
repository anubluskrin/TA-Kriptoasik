const { ipcMain } = require('electron');

function daftarkan() {
  ipcMain.handle('app:ping', (event, pesan) => {
    if (typeof pesan !== 'string' || pesan.length > 200) {
      throw new Error('Pesan tidak valid');
    }
    return {
      balasan: 'proses utama menerima: ' + pesan,
      waktu: new Date().toISOString(),
      versi: {
        electron: process.versions.electron,
        node: process.versions.node,
      },
    };
  });
}

module.exports = { daftarkan };