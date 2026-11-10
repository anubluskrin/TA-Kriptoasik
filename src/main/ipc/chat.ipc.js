const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const session = require('../auth/session');
const percakapan = require('../db/percakapan');
const { turunkanMaster, subkunci } = require('../chat/kunciPercakapan');
const amplop = require('../chat/amplop');

const MAKS_BERKAS = 200 * 1024;

async function jalankan(aksi) {
  try {
    return { ok: true, ...(await aksi()) };
  } catch (err) {
    return { ok: false, galat: err.message };
  }
}

function periksaId(id) {
  if (!Number.isInteger(id) || id < 1) throw new Error('Percakapan tidak valid');
}

async function buatPercakapan(kontak, passphrase) {
  const saya = session.penggunaSaatIni();
  if (typeof kontak !== 'string') throw new Error('Nama kontak tidak valid');
  if (kontak === saya.username) throw new Error('Nama kontak tidak boleh sama dengan akunmu sendiri');
  if (typeof passphrase !== 'string' || passphrase.length < 8 || passphrase.length > 200) {
    throw new Error('Passphrase harus 8 sampai 200 karakter');
  }

  const master = await turunkanMaster(passphrase, saya.username, kontak);
  const kunci = subkunci(master);
  const id = percakapan.buat(saya.id, kontak, master, kunci.kcv, session.subkunci('db'));
  master.fill(0);
  return { id, kcv: kunci.kcv };
}

async function kirimPesan(event, idPercakapan, teks, penting) {
  periksaId(idPercakapan);
  const saya = session.penggunaSaatIni();
  const kDb = session.subkunci('db');

  const p = percakapan.ambil(saya.id, idPercakapan, kDb);
  const kunci = subkunci(p.master);
  p.master.fill(0);

  const seq = p.seqKirim + 1;
  const a = amplop.buat({ dari: saya.username, ke: p.kontak, seq, teks, kunci });

  const win = BrowserWindow.fromWebContents(event.sender);
  const simpan = await dialog.showSaveDialog(win, {
    title: 'Simpan berkas pesan',
    defaultPath: `pesan-${saya.username}-ke-${p.kontak}-${seq}.svmsg`,
    filters: [{ name: 'Pesan SecureVault', extensions: ['svmsg'] }],
  });
  if (simpan.canceled) return { dibatalkan: true };

  await fs.writeFile(simpan.filePath, JSON.stringify(a, null, 2));
  percakapan.catatKeluar(p.id, seq, a.waktu, Boolean(penting), teks, kDb);
  return { pesan: `Pesan nomor ${seq} untuk ${p.kontak} disimpan di ${simpan.filePath}` };
}

async function imporPesan(event) {
  const saya = session.penggunaSaatIni();
  const kDb = session.subkunci('db');
  const win = BrowserWindow.fromWebContents(event.sender);

  const pilih = await dialog.showOpenDialog(win, {
    title: 'Pilih berkas pesan',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Pesan SecureVault', extensions: ['svmsg'] }],
  });
  if (pilih.canceled) return { dibatalkan: true };

  const ringkasan = [];
  const daftar = [];
  for (const jalur of pilih.filePaths) {
    const nama = path.basename(jalur);
    try {
      const info = await fs.stat(jalur);
      if (info.size > MAKS_BERKAS) throw new Error('berkas terlalu besar');
      daftar.push({ nama, isi: JSON.parse(await fs.readFile(jalur, 'utf8')) });
    } catch (err) {
      const alasan = err instanceof SyntaxError ? 'bukan berkas pesan yang valid' : err.message;
      ringkasan.push(`${nama}: ditolak, ${alasan}`);
    }
  }

  // Diproses berurutan menurut nomor urut, supaya beberapa berkas sekaligus tidak saling menolak
  daftar.sort((x, y) => (Number(x.isi && x.isi.seq) || 0) - (Number(y.isi && y.isi.seq) || 0));

  let diterima = 0;
  for (const { nama, isi: a } of daftar) {
    try {
      if (!a || typeof a.dari !== 'string') throw new Error('berkas bukan pesan SecureVault yang valid');
      const id = percakapan.cariKontak(saya.id, a.dari);
      if (!id) throw new Error(`belum ada percakapan dengan ${a.dari}`);

      const p = percakapan.ambil(saya.id, id, kDb);
      const kunci = subkunci(p.master);
      p.master.fill(0);

      const hasil = amplop.verifikasi(a, {
        saya: saya.username,
        kontak: p.kontak,
        kunci,
        seqTerakhir: p.seqTerima,
      });
      percakapan.catatMasuk(p.id, hasil.seq, hasil.waktu, hasil.teks, kDb);
      diterima++;
      ringkasan.push(`${nama}: diterima (dari ${a.dari}, nomor ${hasil.seq})`);
    } catch (err) {
      ringkasan.push(`${nama}: ditolak, ${err.message}`);
    }
  }
  return { diterima, ringkasan };
}

function daftarkan() {
  ipcMain.handle('chat:daftar', () =>
    jalankan(async () => ({ daftar: percakapan.daftar(session.penggunaSaatIni().id) }))
  );

  ipcMain.handle('chat:buat', (event, kontak, passphrase) =>
    jalankan(() => buatPercakapan(kontak, passphrase))
  );

  ipcMain.handle('chat:kirim', (event, id, teks, penting) =>
    jalankan(() => kirimPesan(event, id, teks, penting))
  );

  ipcMain.handle('chat:impor', (event) => jalankan(() => imporPesan(event)));

  ipcMain.handle('chat:riwayat', (event, id) =>
    jalankan(async () => {
      periksaId(id);
      const saya = session.penggunaSaatIni();
      const kDb = session.subkunci('db');
      const p = percakapan.ambil(saya.id, id, kDb); // memastikan percakapan milik pengguna ini
      p.master.fill(0);
      return { riwayat: percakapan.riwayat(id, kDb) };
    })
  );
}

module.exports = { daftarkan };