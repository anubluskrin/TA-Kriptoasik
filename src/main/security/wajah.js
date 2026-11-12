const crypto = require('node:crypto');
const db = require('../db/db');
const session = require('../auth/session');

// Login wajah: tampilan menghitung embedding 1024 angka dengan Human, proses utama yang membandingkan.
// Templat wajah disimpan terenkripsi AES-256-GCM dengan subkunci dari kunci master (password + dongle),
// sehingga isi database tidak membocorkan embedding wajah.
const PANJANG = 1024;
const AMBANG = 0.6; // kemiripan minimal (0 sampai 1). Naikkan bila wajah orang lain masih lolos
const MAKS_GAGAL = 5;
const JUMLAH_FOTO_MIN = 3;
const JUMLAH_FOTO_MAKS = 5;
const AAD = Buffer.from('securevault-wajah-v1');

// Rumus yang sama dengan Human.match.similarity (sudah dicocokkan angkanya)
function jarak(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.round(100 * 25 * s) / 100;
}

function kemiripan(a, b) {
  const dist = jarak(a, b);
  if (dist === 0) return 1;
  const norm = (1 - Math.sqrt(dist) / 100 - 0.2) / (0.8 - 0.2);
  return Math.round(100 * Math.max(Math.min(norm, 1), 0)) / 100;
}

function periksaEmbedding(e) {
  if (!Array.isArray(e) || e.length !== PANJANG) throw new Error('Data wajah tidak valid');
  for (const x of e) {
    if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > 100) throw new Error('Data wajah tidak valid');
  }
  return Float32Array.from(e);
}

function rataRata(daftar) {
  const hasil = new Float32Array(PANJANG);
  for (const v of daftar) for (let i = 0; i < PANJANG; i++) hasil[i] += v[i] / daftar.length;
  return hasil;
}

function segel(vektor) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', session.subkunci('wajah'), iv);
  c.setAAD(AAD);
  const ct = Buffer.concat([c.update(Buffer.from(vektor.buffer)), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]);
}

function buka(blob) {
  const b = Buffer.from(blob);
  if (b.length !== 12 + 16 + PANJANG * 4) throw new Error('Templat wajah rusak');
  const d = crypto.createDecipheriv('aes-256-gcm', session.subkunci('wajah'), b.subarray(0, 12));
  d.setAAD(AAD);
  d.setAuthTag(b.subarray(12, 28));
  const polos = Buffer.concat([d.update(b.subarray(28)), d.final()]);
  return new Float32Array(polos.buffer, polos.byteOffset, PANJANG);
}

function ambilBlob(idPengguna) {
  const baris = db.ambil().prepare('SELECT wajah_embedding FROM users WHERE id = ?').get(idPengguna);
  return baris && baris.wajah_embedding && baris.wajah_embedding.length > 0 ? baris.wajah_embedding : null;
}

function terdaftar() {
  return ambilBlob(session.penggunaSaatIni().id) !== null;
}

// Pendaftaran: butuh sesi penuh. Beberapa foto harus saling mirip supaya templat konsisten.
function simpanTemplat(idPengguna, daftarEmbedding) {
  if (!Array.isArray(daftarEmbedding) || daftarEmbedding.length < JUMLAH_FOTO_MIN || daftarEmbedding.length > JUMLAH_FOTO_MAKS) {
    throw new Error(`Perlu ${JUMLAH_FOTO_MIN} sampai ${JUMLAH_FOTO_MAKS} pengambilan wajah`);
  }
  const vektor = daftarEmbedding.map(periksaEmbedding);
  for (let i = 0; i < vektor.length; i++) {
    for (let j = i + 1; j < vektor.length; j++) {
      if (kemiripan(vektor[i], vektor[j]) < AMBANG) {
        throw new Error('Pengambilan wajah tidak konsisten. Ulangi dengan satu wajah dan cahaya yang stabil');
      }
    }
  }
  const templat = rataRata(vektor);
  db.ambil().prepare('UPDATE users SET wajah_embedding = ? WHERE id = ?').run(segel(templat), idPengguna);
}

// Pendaftaran ulang dari halaman Face Recognition: butuh sesi penuh
function daftar(daftarEmbedding) {
  simpanTemplat(session.penggunaSaatIni().id, daftarEmbedding);
}

// Pendaftaran wajah saat membuat akun. Boleh diulang sampai pengguna menekan Selesai.
function daftarAwal(daftarEmbedding) {
  simpanTemplat(session.penggunaMenungguDaftar().id, daftarEmbedding);
}

// Uji skor saat membuat akun, untuk kalibrasi ambang
function ujiAwal(embedding) {
  const blob = ambilBlob(session.penggunaMenungguDaftar().id);
  if (!blob) throw new Error('Wajah belum didaftarkan');
  return { skor: kemiripan(buka(blob), periksaEmbedding(embedding)), ambang: AMBANG };
}

// Menutup tahap pendaftaran: akun baru boleh masuk setelah templat wajah tersimpan
function selesaiDaftar() {
  const orang = session.penggunaMenungguDaftar();
  if (!ambilBlob(orang.id)) throw new Error('Daftarkan wajah dulu');
  session.selesaikanDaftarWajah();
  return { username: orang.username };
}

// Untuk kalibrasi: skor satu pengambilan terhadap templat milik pengguna yang sedang login
function uji(embedding) {
  const blob = ambilBlob(session.penggunaSaatIni().id);
  if (!blob) throw new Error('Wajah belum didaftarkan');
  return { skor: kemiripan(buka(blob), periksaEmbedding(embedding)), ambang: AMBANG };
}

function hapus() {
  db.ambil().prepare('UPDATE users SET wajah_embedding = NULL WHERE id = ?').run(session.penggunaSaatIni().id);
}

// Verifikasi saat login: hanya berlaku bila password dan dongle sudah benar (sesi tertunda).
function verifikasi(embedding) {
  const orang = session.penggunaTertunda();
  const uji = periksaEmbedding(embedding);
  const blob = ambilBlob(orang.id);
  if (!blob) throw new Error('Templat wajah tidak ditemukan');

  const skor = kemiripan(buka(blob), uji);
  if (skor >= AMBANG) {
    session.selesaikanWajah();
    return { skor, username: orang.username };
  }
  const gagal = session.catatGagalWajah();
  if (gagal >= MAKS_GAGAL) {
    session.akhiri();
    throw new Error(`Wajah tidak cocok ${MAKS_GAGAL} kali. Login dibatalkan, ulangi dari awal`);
  }
  throw new Error(`Wajah tidak cocok (skor ${skor.toFixed(2)}, perlu ${AMBANG}). Sisa percobaan: ${MAKS_GAGAL - gagal}`);
}

module.exports = { AMBANG, kemiripan, terdaftar, daftar, daftarAwal, ujiAwal, selesaiDaftar, uji, hapus, verifikasi };