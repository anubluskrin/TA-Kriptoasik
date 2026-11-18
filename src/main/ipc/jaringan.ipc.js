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
const chain = require('../chain/blockchain');
const serah = require('../chat/serah');

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

// Kunci percakapan dengan seorang kontak (untuk MAC bukti serah terima)
function kunciUntuk(saya, kontak) {
  const idP = percakapan.cariKontak(saya.id, kontak);
  if (!idP) throw new Error(`belum ada percakapan dengan ${kontak}`);
  const p = percakapan.ambil(saya.id, idP, session.subkunci('db'));
  const kunci = subkunci(p.master);
  p.master.fill(0);
  return kunci;
}

// Permintaan dari lawan: 'serah' (bukti serah terima aset) dan 'periksa' (minta blok TRANSFER untuk diperiksa silang)
async function tanganiPermintaan(jenis, f, rekan) {
  const saya = session.penggunaSaatIni();
  if (jenis === 'serah') {
    const data = serah.verifikasi(f.bukti, { saya: saya.username, rekan, kunci: kunciUntuk(saya, rekan) });
    const { blok } = await audit.tambahBlok(data); // aturan rantai menolak bila pengirim bukan pemilik menurut catatan ini
    kabari('event:pesan-masuk', {
      idPercakapan: null,
      dari: rekan,
      aset: true,
      ringkasan: `Aset ${data.idAset} diserahkan ${rekan} kepadamu (blok #${blok.index} di rantaimu)`,
    });
    return { indeks: blok.index };
  }
  if (jenis === 'periksa') {
    const indeks = Array.isArray(f.indeks) ? f.indeks.slice(0, 50) : [];
    if (!indeks.every((i) => Number.isInteger(i) && i >= 1)) throw new Error('Permintaan tidak valid');
    const rantai = await audit.bacaRantai();
    // Hanya blok TRANSFER yang dibuka; blok lain (log audit) tidak diberikan
    return { blok: indeks.map((i) => (rantai[i] && rantai[i].data && rantai[i].data.tipe === 'TRANSFER' ? rantai[i] : null)) };
  }
  throw new Error('Permintaan tidak dikenal');
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
  saatPermintaan: tanganiPermintaan,
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
    const asal = await pilihBerkas(win, `Pilih gambar pembawa pesan (PNG atau JPEG) untuk ${p.kontak}`, [
    { name: 'Gambar PNG atau JPEG', extensions: ['png', 'jpg', 'jpeg'] },
  ]);
  if (!asal) return { dibatalkan: true };

  const hasil = await media.bungkusGambar(await fs.readFile(asal), pesan, kunci);
  await tautan.kirimMedia('gambar', p.kontak, Buffer.from(hasil.png));
  percakapan.catatCatatan(p.id, 'keluar', Date.now(), `[gambar dikirim] ${pesan}`, kDb);
  return { pesan: `Gambar berisi pesan tersembunyi terkirim ke ${p.kontak}` };
}

// Menyerahkan aset ke lawan yang sedang tersambung: blok TRANSFER dicatat di rantai sendiri,
// lalu buktinya dikirim agar lawan mencatat blok TERIMA di rantainya.
async function serahkan(idAset, ke) {
  if (typeof idAset !== 'string' || typeof ke !== 'string') throw new Error('Isian tidak valid');
  idAset = idAset.trim();
  ke = ke.trim();
  const saya = session.penggunaSaatIni();
  pastikanTerhubung();
  const rekan = tautan.status().rekan;
  if (rekan !== ke) throw new Error(`Sedang terhubung dengan ${rekan}, bukan ${ke}`);
  const kunci = kunciUntuk(saya, ke);

  const rantai = await audit.bacaRantai();
  const aset = chain.daftarAset(rantai).find((a) => a.idAset === idAset);
  if (!aset) throw new Error(`Aset ${idAset} belum terdaftar`);

  let blok;
  if (aset.pemilik === ke) {
    // Sudah tercatat berpindah ke lawan (mis. pengiriman sebelumnya gagal): kirim ulang buktinya
    blok = [...rantai].reverse().find(
      (b) => b.data.tipe === 'TRANSFER' && b.data.idAset === idAset && b.data.dari === saya.username && b.data.ke === ke
    );
    if (!blok) throw new Error(`Aset ${idAset} sudah dimiliki ${ke}`);
  } else {
    ({ blok } = await audit.tambahBlok({ tipe: 'TRANSFER', idAset, dari: saya.username, ke }));
  }

  try {
    await tautan.kirimPermintaan('serah', ke, { bukti: serah.buat({ blok, nama: aset.nama, kunci }) });
  } catch (err) {
    throw new Error(
      `Blok transfer #${blok.index} sudah tercatat di rantaimu, tetapi ${ke} belum menerima buktinya (${err.message}). Tekan Serahkan lagi untuk mengirim ulang.`
    );
  }
  return { pesan: `Aset ${idAset} diserahkan ke ${ke}. Blok #${blok.index} dicatat di rantaimu dan di rantai ${ke}` };
}

// Memeriksa semua aset yang pernah diterima dari lawan: apakah blok TRANSFER di rantainya masih sama
async function periksaSilang() {
  const saya = session.penggunaSaatIni();
  pastikanTerhubung();
  const rekan = tautan.status().rekan;
  const rantai = await audit.bacaRantai();
  const terima = rantai
    .filter((b) => b.data.tipe === 'TERIMA' && b.data.dari === rekan)
    .map((b) => ({ blokSaya: b.index, ...b.data }))
    .slice(-50);
  if (terima.length === 0) return { hasil: [], pesan: `Belum ada aset yang diterima dari ${rekan}` };

  const jawab = await tautan.kirimPermintaan('periksa', rekan, { indeks: terima.map((t) => t.indeksPengirim) });
  const daftarBlok = jawab && Array.isArray(jawab.blok) ? jawab.blok : [];
  const hasil = terima.map((t, i) => ({
    idAset: t.idAset,
    blokSaya: t.blokSaya,
    indeksPengirim: t.indeksPengirim,
    ...serah.periksaBlok(t, daftarBlok[i]),
  }));
  const bermasalah = hasil.filter((h) => h.status !== 'cocok').length;
  audit.catat('PERIKSA_SILANG', saya.username, `${rekan}: ${hasil.length - bermasalah} cocok, ${bermasalah} bermasalah`);
  return { hasil, pesan: bermasalah ? `${bermasalah} aset bermasalah` : `Semua ${hasil.length} aset cocok dengan rantai ${rekan}` };
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
  ipcMain.handle('aset:serahkan', (event, idAset, ke) => jalankan(() => serahkan(idAset, ke)));
  ipcMain.handle('aset:periksaSilang', () => jalankan(periksaSilang));
  ipcMain.handle('chat:kirimBerkasLangsung', (event, id) => jalankan(() => kirimBerkasLangsung(event, id)));
  ipcMain.handle('chat:kirimGambarLangsung', (event, id, pesan) =>
    jalankan(() => kirimGambarLangsung(event, id, pesan))
  );
  ipcMain.handle('chat:kirimLangsung', (event, id, teks, penting) =>
    jalankan(() => kirimLangsung(id, teks, penting))
  );
}

module.exports = { daftarkan };