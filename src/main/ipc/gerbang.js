const { ipcMain } = require('electron');
const session = require('../auth/session');
const audit = require('../chain/audit');

// Kanal yang boleh dipanggil sebelum login
const TERBUKA = new Set(['app:ping', 'auth:status', 'auth:daftar', 'auth:masuk', 'auth:keluar', 'dongle:status', 'auth:wajah', 'auth:daftarWajah', 'auth:ujiWajah', 'auth:selesaiDaftarWajah', 'auth:batalDaftar']);

// Kejadian yang dicatat ke rantai audit: kanal -> [aksi bila berhasil, aksi bila gagal]. null berarti tidak dicatat.
const KEJADIAN = {
  'auth:masuk': [null, 'LOGIN_GAGAL'],
  'auth:wajah': ['LOGIN_BERHASIL', 'WAJAH_GAGAL'],
  'auth:selesaiDaftarWajah': ['AKUN_DIBUAT', null],
  'auth:batalDaftar': ['PENDAFTARAN_DIBATALKAN', null],
  'auth:keluar': ['LOGOUT', null],
  'chat:kirim': ['PESAN_DIKIRIM', null],
  'chat:kirimLangsung': ['PESAN_DIKIRIM', null],
  'chat:impor': ['PESAN_DITERIMA', 'PESAN_DITOLAK'],
  'chat:kirimBerkas': ['BERKAS_DIKIRIM', null],
  'chat:terimaBerkas': ['BERKAS_DITERIMA', 'BERKAS_DITOLAK'],
  'chat:kirimGambar': ['GAMBAR_DIKIRIM', null],
  'chat:terimaGambar': ['GAMBAR_DITERIMA', 'GAMBAR_DITOLAK'],
  'file:enkripsi': ['BERKAS_DIENKRIPSI', null],
  'file:dekripsi': ['BERKAS_DIDEKRIPSI', 'BERKAS_DITOLAK'],
  'gambar:sisipkan': ['GAMBAR_DISISIPI', null],
  'gambar:ekstrak': ['GAMBAR_DIEKSTRAK', 'GAMBAR_DITOLAK'],
  'arsip:simpan': ['PESAN_PENTING_DISIMPAN', null],
  'arsip:buka': ['PESAN_PENTING_DIBUKA', null],
};

// Nama pengguna pada saat kanal dipanggil (sesi penuh, menunggu wajah, atau menunggu daftar wajah)
function pelakuSaatIni() {
  for (const ambil of [session.penggunaSaatIni, session.penggunaTertunda, session.penggunaMenungguDaftar]) {
    try {
      return ambil().username;
    } catch {
      // bukan keadaan ini, coba berikutnya
    }
  }
  return null;
}

function catatKejadian(kanal, argumen, hasil, pelakuAwal) {
  const peta = KEJADIAN[kanal];
  if (!peta || !hasil || hasil.dibatalkan) return;
  let aksi = hasil.ok ? peta[0] : peta[1];
  if (kanal === 'auth:masuk' && hasil.ok && hasil.masuk) aksi = 'LOGIN_BERHASIL'; // akun lama tanpa wajah
  if (!aksi) return;

  let pelaku = pelakuAwal;
  if (kanal === 'auth:masuk') pelaku = argumen[0];
  else if (hasil.ok && hasil.username) pelaku = hasil.username;

  let rincian;
  if (!hasil.ok && hasil.galat) rincian = String(hasil.galat).slice(0, 150);
  else if (kanal.startsWith('chat:') && Number.isInteger(argumen[0])) rincian = `percakapan #${argumen[0]}`;
  audit.catat(aksi, pelaku, rincian);
}

// Menjalankan `daftarkanSemua` dengan ipcMain.handle yang dibungkus pemeriksaan login
function daftarkanDenganGerbang(daftarkanSemua) {
  const asli = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (kanal, pendengar) =>
    asli(kanal, async (event, ...argumen) => {
      if (!TERBUKA.has(kanal) && !session.sudahMasuk()) {
        return { ok: false, galat: 'Belum login' };
      }
      const pelakuAwal = KEJADIAN[kanal] ? pelakuSaatIni() : null;
      const hasil = await pendengar(event, ...argumen);
      catatKejadian(kanal, argumen, hasil, pelakuAwal);
      return hasil;
    });
  try {
    daftarkanSemua();
  } finally {
    delete ipcMain.handle; // kembalikan ke fungsi bawaan
  }
}

module.exports = { daftarkanDenganGerbang };