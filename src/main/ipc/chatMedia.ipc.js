const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const session = require('../auth/session');
const percakapan = require('../db/percakapan');
const { subkunci } = require('../chat/kunciPercakapan');
const media = require('../chat/media');
const { MAKS_TEKS } = require('../chat/amplop');

const MAKS_BERKAS = 50 * 1024 * 1024;
const MAKS_GAMBAR = 50 * 1024 * 1024;

async function jalankan(aksi) {
  try {
    return { ok: true, ...(await aksi()) };
  } catch (err) {
    return { ok: false, galat: err.message };
  }
}

// Mengambil percakapan milik pengguna yang login beserta kunci turunannya
function siapkan(idPercakapan) {
  if (!Number.isInteger(idPercakapan) || idPercakapan < 1) throw new Error('Percakapan tidak valid');
  const saya = session.penggunaSaatIni();
  const kDb = session.subkunci('db');
  const p = percakapan.ambil(saya.id, idPercakapan, kDb);
  const kunci = subkunci(p.master);
  p.master.fill(0);
  return { p, kDb, kunci };
}

async function pilihBerkas(win, judul, filter) {
  const pilih = await dialog.showOpenDialog(win, { title: judul, properties: ['openFile'], filters: filter });
  if (pilih.canceled) return null;
  return pilih.filePaths[0];
}

async function kirimBerkas(event, idPercakapan) {
  const { p, kDb, kunci } = siapkan(idPercakapan);
  const win = BrowserWindow.fromWebContents(event.sender);

  const asal = await pilihBerkas(win, `Pilih berkas untuk ${p.kontak}`, undefined);
  if (!asal) return { dibatalkan: true };
  const info = await fs.stat(asal);
  if (info.size > MAKS_BERKAS) throw new Error('Berkas terlalu besar (maksimal 50 MB)');

  const nama = path.basename(asal);
  const isi = await fs.readFile(asal);
  const hasil = await media.bungkusBerkas(nama, isi, kunci);

  const simpan = await dialog.showSaveDialog(win, {
    title: 'Simpan berkas terenkripsi untuk dikirim',
    defaultPath: `${nama}.svlt`,
    filters: [{ name: 'Berkas SecureVault', extensions: ['svlt'] }],
  });
  if (simpan.canceled) return { dibatalkan: true };

  await fs.writeFile(simpan.filePath, hasil);
  percakapan.catatCatatan(p.id, 'keluar', Date.now(), `[berkas dikirim] ${nama} (${isi.length} byte)`, kDb);
  return { pesan: `Berkas ${nama} untuk ${p.kontak} disimpan di ${simpan.filePath}` };
}

async function terimaBerkas(event, idPercakapan) {
  const { p, kDb, kunci } = siapkan(idPercakapan);
  const win = BrowserWindow.fromWebContents(event.sender);

  const asal = await pilihBerkas(win, 'Pilih berkas .svlt dari kontak', [
    { name: 'Berkas SecureVault', extensions: ['svlt'] },
  ]);
  if (!asal) return { dibatalkan: true };
  const info = await fs.stat(asal);
  if (info.size > MAKS_BERKAS + 1024) throw new Error('Berkas terlalu besar');

  const { namaAsli, isi } = await media.bukaBerkas(await fs.readFile(asal), kunci);
  const nama = path.basename(namaAsli);

  const simpan = await dialog.showSaveDialog(win, {
    title: 'Simpan berkas hasil dekripsi',
    defaultPath: nama,
  });
  if (simpan.canceled) return { dibatalkan: true };

  await fs.writeFile(simpan.filePath, isi);
  percakapan.catatCatatan(p.id, 'masuk', Date.now(), `[berkas diterima] ${nama} (${isi.length} byte)`, kDb);
  return { pesan: `Berkas ${nama} dari ${p.kontak} disimpan di ${simpan.filePath}` };
}

async function kirimGambar(event, idPercakapan, pesan) {
  if (typeof pesan !== 'string' || pesan.length === 0 || pesan.length > MAKS_TEKS) {
    throw new Error(`Pesan rahasia harus 1 sampai ${MAKS_TEKS} karakter`);
  }
  const { p, kDb, kunci } = siapkan(idPercakapan);
  const win = BrowserWindow.fromWebContents(event.sender);

  const asal = await pilihBerkas(win, `Pilih gambar PNG pembawa pesan untuk ${p.kontak}`, [
    { name: 'Gambar PNG', extensions: ['png'] },
  ]);
  if (!asal) return { dibatalkan: true };
  const info = await fs.stat(asal);
  if (info.size > MAKS_GAMBAR) throw new Error('Gambar terlalu besar (maksimal 50 MB)');

  const hasil = await media.bungkusGambar(await fs.readFile(asal), pesan, kunci);

  const nama = path.basename(asal, path.extname(asal));
  const simpan = await dialog.showSaveDialog(win, {
    title: 'Simpan gambar berisi pesan',
    defaultPath: `${nama}-untuk-${p.kontak}.png`,
    filters: [{ name: 'Gambar PNG', extensions: ['png'] }],
  });
  if (simpan.canceled) return { dibatalkan: true };

  await fs.writeFile(simpan.filePath, hasil.png);
  percakapan.catatCatatan(p.id, 'keluar', Date.now(), `[gambar dikirim] ${pesan}`, kDb);
  const psnr = Number.isFinite(hasil.psnr) ? hasil.psnr.toFixed(2) + ' dB' : 'tak hingga';
  return { pesan: `Gambar untuk ${p.kontak} disimpan di ${simpan.filePath} (PSNR ${psnr})` };
}

async function terimaGambar(event, idPercakapan) {
  const { p, kDb, kunci } = siapkan(idPercakapan);
  const win = BrowserWindow.fromWebContents(event.sender);

  const asal = await pilihBerkas(win, 'Pilih gambar PNG dari kontak', [{ name: 'Gambar PNG', extensions: ['png'] }]);
  if (!asal) return { dibatalkan: true };
  const info = await fs.stat(asal);
  if (info.size > MAKS_GAMBAR) throw new Error('Gambar terlalu besar (maksimal 50 MB)');

  const { pesan } = await media.bukaGambar(await fs.readFile(asal), kunci);
  percakapan.catatCatatan(p.id, 'masuk', Date.now(), `[gambar diterima] ${pesan}`, kDb);
  return { pesan: `Pesan tersembunyi dari ${p.kontak}: ${pesan}` };
}

function daftarkan() {
  ipcMain.handle('chat:kirimBerkas', (event, id) => jalankan(() => kirimBerkas(event, id)));
  ipcMain.handle('chat:terimaBerkas', (event, id) => jalankan(() => terimaBerkas(event, id)));
  ipcMain.handle('chat:kirimGambar', (event, id, pesan) => jalankan(() => kirimGambar(event, id, pesan)));
  ipcMain.handle('chat:terimaGambar', (event, id) => jalankan(() => terimaGambar(event, id)));
}

module.exports = { daftarkan };