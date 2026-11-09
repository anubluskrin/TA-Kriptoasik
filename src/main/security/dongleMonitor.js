const dongle = require('./dongle');
const session = require('../auth/session');

// Memantau dongle selama sesi berjalan.
// Tiap detik: periksa berkas .svkey (cepat). Tiap 10 detik: periksa serial flashdisk.
// Bila dongle hilang: hapus kunci dan sesi, lalu beri tahu tampilan agar kembali ke login.
let timer = null;
let hitungan = 0;
let sedangPeriksa = false;

function berhenti() {
  if (timer) clearInterval(timer);
  timer = null;
  hitungan = 0;
  sedangPeriksa = false;
}

function kunci(webContents) {
  berhenti();
  session.akhiri();
  if (webContents && !webContents.isDestroyed()) webContents.send('event:dongle-dicabut');
}

function mulai(webContents) {
  berhenti();
  const info = session.penggunaSaatIni().dongle;

  timer = setInterval(async () => {
    if (sedangPeriksa) return;
    if (!session.sudahMasuk()) return berhenti();
    sedangPeriksa = true;
    try {
      hitungan++;
      let aman = dongle.adaBerkasKunci(info.drive);
      if (aman && hitungan % 10 === 0) aman = await dongle.serialMasihAda(info.serial);
      if (!aman) kunci(webContents);
    } catch {
      kunci(webContents);
    } finally {
      sedangPeriksa = false;
    }
  }, 1000);
}

module.exports = { mulai, berhenti };