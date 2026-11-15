const { ipcMain, app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const chain = require('../chain/blockchain');
const audit = require('../chain/audit');

function berkasRantai() {
  return path.join(app.getPath('userData'), 'rantai.json');
}

const bacaRantai = audit.bacaRantai;
const tulisRantai = audit.tulisRantai;

// Data yang dikirim ke tampilan: rantai, daftar aset, dan hasil validasi.
// Bila rantai rusak, daftar aset hanya dihitung dari blok sebelum blok yang rusak.
function ringkasan(rantai) {
  const validasi = chain.validasiRantai(rantai);
  const dasar = validasi.valid ? rantai : rantai.slice(0, validasi.indeksRusak);
  let aset = [];
  try {
    aset = chain.daftarAset(dasar);
  } catch {
    aset = [];
  }
  return { rantai, aset, validasi, kesulitan: chain.KESULITAN };
}

async function jalankan(aksi) {
  try {
    return { ok: true, ...(await aksi()) };
  } catch (err) {
    return { ok: false, galat: err.message };
  }
}

async function tambahTransaksi(data) {
  const { rantai, blok, ms } = await audit.tambahBlok(data);
  return {
    ...ringkasan(rantai),
    pesan: `Blok #${blok.index} ditambang: nonce ${blok.nonce}, ${ms} ms`,
  };
}

function teks(nilai, nama) {
  if (typeof nilai !== 'string') throw new Error(`${nama} tidak valid`);
  return nilai.trim();
}

function daftarkan() {
  audit.aturLokasi(berkasRantai());

  ipcMain.handle('aset:status', () => jalankan(async () => ringkasan(await bacaRantai())));

  ipcMain.handle('aset:daftarkan', (event, idAset, nama, pemilik) =>
    jalankan(() =>
      tambahTransaksi({
        tipe: 'REGISTER',
        idAset: teks(idAset, 'ID aset'),
        nama: teks(nama, 'Nama aset'),
        pemilik: teks(pemilik, 'Pemilik'),
      })
    )
  );

  ipcMain.handle('aset:transfer', (event, idAset, dari, ke) =>
    jalankan(() =>
      tambahTransaksi({
        tipe: 'TRANSFER',
        idAset: teks(idAset, 'ID aset'),
        dari: teks(dari, 'Pengirim'),
        ke: teks(ke, 'Pemilik baru'),
      })
    )
  );

  ipcMain.handle('aset:validasi', () => jalankan(async () => ringkasan(await bacaRantai())));

  // Hanya untuk uji/demo: mengubah isi satu blok TANPA menghitung ulang hash,
  // meniru penyerang yang memalsukan data.
  ipcMain.handle('aset:rusakkan', (event, nomor, nilai) =>
    jalankan(async () => {
      const rantai = await bacaRantai();
      if (!Number.isInteger(nomor) || nomor < 1 || nomor >= rantai.length) {
        throw new Error('Nomor blok tidak ada (blok 0 adalah genesis)');
      }
      const nilaiBersih = teks(nilai, 'Nilai palsu');
      if (nilaiBersih.length === 0 || nilaiBersih.length > 60) throw new Error('Nilai palsu 1 sampai 60 karakter');

      const data = rantai[nomor].data;
      if (data.tipe === 'REGISTER') data.pemilik = nilaiBersih;
      else if (data.tipe === 'AUDIT') data.pelaku = nilaiBersih;
      else data.ke = nilaiBersih;
      await tulisRantai(rantai);
      return { ...ringkasan(rantai), pesan: `Isi blok #${nomor} diubah tanpa menghitung ulang hash` };
    })
  );

  ipcMain.handle('aset:reset', () =>
    jalankan(async () => {
      const rantai = [chain.buatGenesis()];
      await tulisRantai(rantai);
      return { ...ringkasan(rantai), pesan: 'Rantai dikembalikan ke blok genesis' };
    })
  );
}

module.exports = { daftarkan };