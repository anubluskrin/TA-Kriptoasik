const appIpc = require('./app.ipc');
const pesanIpc = require('./pesan.ipc');

function daftarkanSemuaIpc() {
  appIpc.daftarkan();
  pesanIpc.daftarkan();
}

module.exports = { daftarkanSemuaIpc };