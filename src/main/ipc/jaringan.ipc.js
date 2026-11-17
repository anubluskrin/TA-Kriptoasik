const { app, ipcMain, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const session = require('../auth/session');
const percakapan = require('../db/percakapan');
const amplop = require('../chat/amplop');
const { subkunci } = require('../chat/kunciPercakapan');
const { terimaAmplop } = require('../chat/terima');
const { terimaMedia } = require('../chat/terimaMedia');
const media = require('../chat/media');
const { MAKS_TEKS } = require('../chat/amplop');
const { siapkan, pilihBerkas } = require('./chatMedia.ipc');
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
        kabari('event:pesan-masuk', {
      idPercakapan: hasil.idPercakapan,
      dari: hasil.dari,
      ringkasan: `Pesan baru dari ${hasil.dari} (nomor ${hasil.seq})`,
    });
  },
  saatMedia: async (jenis, data, rekan) => {
    const saya = session.penggunaSaatIni();
    const label = jenis === 'berkas' ? 'BERKAS' : 'GAMBAR';
    let hasil;
    try {
      hasil = await terimaMedia({
        jenis,
        data,
        rekan,
        saya,
        kunciDb: session.subkunci('db'),
        folder: path.join(app.getPath('downloads'), 'Sandikarya'),
      });
    } catch (err) {
      audit.catat(`${label}_DITOLAK`, saya.username, String(err.message).slice(0, 150));
      throw err;
    }
    audit.catat(`${label}_DITERIMA`, saya.username, `percakapan #${hasil.idPercakapan}`);
    kabari('event:pesan-masuk', { idPercakapan: hasil.idPercakapan, dari: rekan, ringkasan: hasil.ringkasan });
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

function pastikanTerhubung() {
  if (tautan.status().mode !== 'terhubung') throw new Error('Belum terhubung ke laptop lain');
}

async function kirimBerkasLangsung(event, idPercakapan) {
  pastikanTerhubung();
  const { p, kDb, kunci } = siapkan(idPercakapan);
  const win = BrowserWindow.fromWebContents(event.sender);
  const asal = await pilihBerkas(win, `Pilih berkas untuk ${p.kontak}`, undefined);
  if (!asal) return { dibatalkan: true };

  const nama = path.basename(asal);
  const isi = await fs.readFile(asal);
  const bungkus = await media.bungkusBerkas(nama, isi, kunci);
  await tautan.kirimMedia('berkas', p.kontak, bungkus);
  percakapan.catatCatatan(p.id, 'keluar', Date.now(), `[berkas dikirim] ${nama} (${isi.length} byte)`, kDb);
  return { pesan: `Berkas ${nama} terkirim ke ${p.kontak}` };
}

async function kirimGambarLangsung(event, idPercakapan, pesan) {
  if (typeof pesan !== 'string' || pesan.length === 0 || pesan.length > MAKS_TEKS) {
    throw new Error(`Pesan rahasia harus 1 sampai ${MAKS_TEKS} karakter`);
  }
  pastikanTerhubung();
  const { p, kDb, kunci } = siapkan(idPercakapan);
  const win = BrowserWindow.fromWebContents(event.sender);
  const asal = await pilihBerkas(win, `Pilih gambar PNG pembawa pesan untuk ${p.kontak}`, [
    { name: 'Gambar PNG', extensions: ['png'] },
  ]);
  if (!asal) return { dibatalkan: true };

  const hasil = await media.bungkusGambar(await fs.readFile(asal), pesan, kunci);
  await tautan.kirimMedia('gambar', p.kontak, Buffer.from(hasil.png));
  percakapan.catatCatatan(p.id, 'keluar', Date.now(), `[gambar dikirim] ${pesan}`, kDb);
  return { pesan: `Gambar berisi pesan tersembunyi terkirim ke ${p.kontak}` };
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
  ipcMain.handle('chat:kirimBerkasLangsung', (event, id) => jalankan(() => kirimBerkasLangsung(event, id)));
  ipcMain.handle('chat:kirimGambarLangsung', (event, id, pesan) =>
    jalankan(() => kirimGambarLangsung(event, id, pesan))
  );
  ipcMain.handle('chat:kirimLangsung', (event, id, teks, penting) =>
    jalankan(() => kirimLangsung(id, teks, penting))
  );
}

module.exports = { daftarkan };