const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const stego = require('../crypto/stegano');

const MAKS_BERKAS = 50 * 1024 * 1024;
const MAKS_PESAN = 100000;

function periksaPassphrase(passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < 8 || passphrase.length > 200) {
    throw new Error('Passphrase harus 8 sampai 200 karakter');
  }
}

// Membungkus hasil agar tampilan menerima { ok: true, ... } atau { ok: false, galat }
async function jalankan(aksi) {
  try {
    return { ok: true, ...(await aksi()) };
  } catch (err) {
    return { ok: false, galat: err.message };
  }
}

async function bacaGambarDariDialog(win, judul) {
  const pilih = await dialog.showOpenDialog(win, {
    title: judul,
    properties: ['openFile'],
    filters: [{ name: 'Gambar PNG', extensions: ['png'] }],
  });
  if (pilih.canceled) return null;

  const asal = pilih.filePaths[0];
  const info = await fs.stat(asal);
  if (info.size > MAKS_BERKAS) throw new Error('Berkas terlalu besar (maksimal 50 MB)');
  return { asal, isi: await fs.readFile(asal) };
}

async function sisipkanDariDialog(event, pesan, passphrase) {
  periksaPassphrase(passphrase);
  if (typeof pesan !== 'string' || pesan.length === 0 || pesan.length > MAKS_PESAN) {
    throw new Error(`Pesan harus 1 sampai ${MAKS_PESAN} karakter`);
  }
  const win = BrowserWindow.fromWebContents(event.sender);

  const gambar = await bacaGambarDariDialog(win, 'Pilih gambar PNG pembawa pesan');
  if (!gambar) return { dibatalkan: true };

  const hasil = await stego.sisipkan(gambar.isi, pesan, passphrase);

  const nama = path.basename(gambar.asal, path.extname(gambar.asal));
  const simpan = await dialog.showSaveDialog(win, {
    title: 'Simpan gambar hasil sisipan',
    defaultPath: nama + '-stego.png',
    filters: [{ name: 'Gambar PNG', extensions: ['png'] }],
  });
  if (simpan.canceled) return { dibatalkan: true };

  await fs.writeFile(simpan.filePath, hasil.png);

  const psnr = Number.isFinite(hasil.psnr) ? hasil.psnr.toFixed(2) + ' dB' : 'tak hingga (tidak ada perubahan)';
  return {
    rincian: [
      ['Gambar asal', path.basename(gambar.asal)],
      ['Ukuran gambar', hasil.lebar + ' x ' + hasil.tinggi + ' piksel'],
      ['Kapasitas (byte)', String(hasil.kapasitas)],
      ['Ukuran pesan (byte)', String(hasil.ukuranPesan)],
      ['Enkripsi pesan', 'AES-256-GCM'],
      ['Metode sisip', 'LSB kanal RGB, posisi acak'],
      ['PSNR', psnr],
      ['Disimpan di', simpan.filePath],
    ],
  };
}

async function ekstrakDariDialog(event, passphrase) {
  periksaPassphrase(passphrase);
  const win = BrowserWindow.fromWebContents(event.sender);

  const gambar = await bacaGambarDariDialog(win, 'Pilih gambar PNG yang berisi pesan');
  if (!gambar) return { dibatalkan: true };

  const { pesan, ukuranPesan } = await stego.ekstrak(gambar.isi, passphrase);
  return {
    hasil: pesan,
    rincian: [
      ['Gambar', path.basename(gambar.asal)],
      ['Ukuran pesan (byte)', String(ukuranPesan)],
    ],
  };
}

function daftarkan() {
  ipcMain.handle('gambar:sisipkan', (event, pesan, passphrase) =>
    jalankan(() => sisipkanDariDialog(event, pesan, passphrase))
  );
  ipcMain.handle('gambar:ekstrak', (event, passphrase) =>
    jalankan(() => ekstrakDariDialog(event, passphrase))
  );
}

module.exports = { daftarkan };