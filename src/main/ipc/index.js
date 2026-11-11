const appIpc = require('./app.ipc');
const authIpc = require('./auth.ipc');
const pesanIpc = require('./pesan.ipc');
const fileIpc = require('./file.ipc');
const gambarIpc = require('./gambar.ipc');
const asetIpc = require('./aset.ipc');
const arsipIpc = require('./arsip.ipc');
const dongleIpc = require('./dongle.ipc');
const chatIpc = require('./chat.ipc');
const chatMediaIpc = require('./chatMedia.ipc');
const wajahIpc = require('./wajah.ipc');
const { daftarkanDenganGerbang } = require('./gerbang');

function daftarkanSemuaIpc() {
  // Semua kanal (kecuali app: dan auth:) hanya bisa dipakai setelah login
  daftarkanDenganGerbang(() => {
    appIpc.daftarkan();
    authIpc.daftarkan();
    pesanIpc.daftarkan();
    fileIpc.daftarkan();
    gambarIpc.daftarkan();
    asetIpc.daftarkan();
    arsipIpc.daftarkan();
    dongleIpc.daftarkan();
    chatIpc.daftarkan();
    chatMediaIpc.daftarkan();
    wajahIpc.daftarkan();
  });
}

module.exports = { daftarkanSemuaIpc };