const { ipcMain, BrowserWindow } = require('electron');
const session = require('../auth/session');
const percakapan = require('../db/percakapan');
const amplop = require('../chat/amplop');
const { subkunci } = require('../chat/kunciPercakapan');
const { terimaAmplop } = require('../chat/terima');
const { Tautan } = require('../chat/tautan');
const audit = require('../chain/audit');

async function jalankan(aksi) {
  try {
    return { ok: true, ...(await aksi()) };
  } catch (err) {
    return { ok: false, galat: err.message };
  }
}

function kabari(kanal, isi) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(kanal, isi);
  }
}

// Pesan yang masuk lewat sambungan melewati pemeriksaan yang sama dengan impor berkas
const tautan = new Tautan({
  ambilUsername: () => session.penggunaSaatIni().username,
  saatPesan: (a) => {
    const saya = session.penggunaSaatIni(); // melempar galat bila belum login, sehingga pesan ditolak
    let hasil;
    try {
      hasil = terimaAmplop(saya, session.subkunci('db'), a);
    } catch (err) {
      audit.catat('PESAN_DITOLAK', saya.username, String(err.message).slice(0, 150));
      throw err;
    }
    audit.catat('PESAN_DITERIMA', saya.username, `percakapan #${hasil.idPercakapan}`);
    kabari('event:pesan-masuk', { idPercakapan: hasil.idPercakapan, dari: hasil.dari, seq: hasil.seq });
  },
  saatBerubah: (status) => kabari('event:jaringan', status),
});

// Keluar atau dongle dicabut: sambungan ikut diputus
session.saatAkhiri(() => tautan.putus());

async function kirimLangsung(idPercakapan, teks, penting) {
  if (!Number.isInteger(idPercakapan) || idPercakapan < 1) throw new Error('Percakapan tidak valid');
  const saya = session.penggunaSaatIni();
  const kDb = session.subkunci('db');
  const p = percakapan.ambil(saya.id, idPercakapan, kDb);
  const kunci = subkunci(p.master);
  p.master.fill(0);

  const seq = p.seqKirim + 1;
  const a = amplop.buat({ dari: saya.username, ke: p.kontak, seq, teks, kunci });
  await tautan.kirimPesan(a); // melempar galat bila ditolak lawan atau tidak dibalas
  percakapan.catatKeluar(p.id, seq, a.waktu, Boolean(penting), teks, kDb);
  return { pesan: `Pesan nomor ${seq} terkirim ke ${p.kontak}` };
}

function daftarkan() {
  ipcMain.handle('jaringan:status', () => jalankan(async () => tautan.status()));
  ipcMain.handle('jaringan:dengarkan', () => jalankan(() => tautan.dengarkan()));
  ipcMain.handle('jaringan:sambung', (event, alamat) => jalankan(() => tautan.sambung(alamat)));
  ipcMain.handle('jaringan:putus', () =>
    jalankan(async () => {
      tautan.putus();
      return tautan.status();
    })
  );
  ipcMain.handle('chat:kirimLangsung', (event, id, teks, penting) =>
    jalankan(() => kirimLangsung(id, teks, penting))
  );
}

module.exports = { daftarkan };