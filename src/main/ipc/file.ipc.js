const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { enkripsiBerkas, dekripsiBerkas, MAKS_UKURAN } = require('../crypto/fileCipher');

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

async function enkripsiDariDialog(event, passphrase) {
  periksaPassphrase(passphrase);
  const win = BrowserWindow.fromWebContents(event.sender);

  const pilih = await dialog.showOpenDialog(win, {
    title: 'Pilih berkas yang akan dienkripsi',
    properties: ['openFile'],
  });
  if (pilih.canceled) return { dibatalkan: true };

  const asal = pilih.filePaths[0];
  const info = await fs.stat(asal);
  if (info.size > MAKS_UKURAN) throw new Error('Berkas terlalu besar (maksimal 200 MB)');

  const isi = await fs.readFile(asal);
  const nama = path.basename(asal);
  const hasil = await enkripsiBerkas(nama, isi, passphrase);

  const simpan = await dialog.showSaveDialog(win, {
    title: 'Simpan berkas terenkripsi',
    defaultPath: nama + '.svlt',
    filters: [{ name: 'Berkas SecureVault', extensions: ['svlt'] }],
  });
  if (simpan.canceled) return { dibatalkan: true };

  await fs.writeFile(simpan.filePath, hasil);
  return {
    rincian: [
      ['Berkas asal', nama],
      ['Ukuran asal (byte)', String(isi.length)],
      ['Algoritma', 'AES-256-GCM'],
      ['Turunan kunci', 'PBKDF2-HMAC-SHA256, 200000 iterasi'],
      ['Ukuran .svlt (byte)', String(hasil.length)],
      ['Disimpan di', simpan.filePath],
    ],
  };
}

async function dekripsiDariDialog(event, passphrase) {
  periksaPassphrase(passphrase);
  const win = BrowserWindow.fromWebContents(event.sender);

  const pilih = await dialog.showOpenDialog(win, {
    title: 'Pilih berkas .svlt',
    properties: ['openFile'],
    filters: [{ name: 'Berkas SecureVault', extensions: ['svlt'] }],
  });
  if (pilih.canceled) return { dibatalkan: true };

  const asal = pilih.filePaths[0];
  const info = await fs.stat(asal);
  if (info.size > MAKS_UKURAN + 1024) throw new Error('Berkas terlalu besar');

  const data = await fs.readFile(asal);
  const { namaAsli, isi } = await dekripsiBerkas(data, passphrase);

  const simpan = await dialog.showSaveDialog(win, {
    title: 'Simpan berkas hasil dekripsi',
    defaultPath: path.basename(namaAsli),
  });
  if (simpan.canceled) return { dibatalkan: true };

  await fs.writeFile(simpan.filePath, isi);
  return {
    rincian: [
      ['Berkas .svlt', path.basename(asal)],
      ['Nama berkas asli', namaAsli],
      ['Ukuran hasil (byte)', String(isi.length)],
      ['Disimpan di', simpan.filePath],
    ],
  };
}

function daftarkan() {
  ipcMain.handle('file:enkripsi', (event, passphrase) =>
    jalankan(() => enkripsiDariDialog(event, passphrase))
  );
  ipcMain.handle('file:dekripsi', (event, passphrase) =>
    jalankan(() => dekripsiDariDialog(event, passphrase))
  );
}

module.exports = { daftarkan };