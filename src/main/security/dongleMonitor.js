const dongle = require('./dongle');
const session = require('../auth/session');
const audit = require('../chain/audit');

// Memantau dongle selama sesi berjalan.
// Tiap detik: periksa berkas .sdk (cepat). Tiap 10 detik: periksa serial flashdisk.
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
  let pelaku = null;
  try {
    pelaku = session.penggunaSaatIni().username;
  } catch {
    // sesi sudah berakhir
  }
  berhenti();
  session.akhiri();
  audit.catat('DONGLE_DICABUT', pelaku);
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