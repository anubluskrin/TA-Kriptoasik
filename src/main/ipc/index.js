const appIpc = require('./app.ipc');
const pesanIpc = require('./pesan.ipc');
const fileIpc = require('./file.ipc');
const gambarIpc = require('./gambar.ipc')

function daftarkanSemuaIpc() {
  appIpc.daftarkan();
  pesanIpc.daftarkan();
  fileIpc.daftarkan();
  gambarIpc.daftarkan();
}

module.exports = { daftarkanSemuaIpc };