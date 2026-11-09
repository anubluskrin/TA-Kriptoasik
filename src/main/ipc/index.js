const appIpc = require('./app.ipc');
const pesanIpc = require('./pesan.ipc');
const fileIpc = require('./file.ipc');

function daftarkanSemuaIpc() {
  appIpc.daftarkan();
  pesanIpc.daftarkan();
  fileIpc.daftarkan();
}

module.exports = { daftarkanSemuaIpc };