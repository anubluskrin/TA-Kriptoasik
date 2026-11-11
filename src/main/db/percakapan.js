const db = require('./db');
const { enkripsi, dekripsi } = require('./dbCipher');

// Kunci master percakapan dan isi pesan disimpan terenkripsi (ChaCha20-Poly1305, kunci k_db).
const aadKunci = (userId, kontak) => `percakapan-kunci:${userId}:${kontak}`;
const aadPesan = (percakapanId) => `chat-pesan:${percakapanId}`;

function periksaNamaKontak(kontak) {
  if (typeof kontak !== 'string' || !/^[A-Za-z0-9_.-]{3,30}$/.test(kontak)) {
    throw new Error('Nama kontak 3 sampai 30 karakter (huruf, angka, titik, - dan _)');
  }
}

function buat(userId, kontak, master, kcv, kunciDb) {
  periksaNamaKontak(kontak);
  const ada = db.ambil()
    .prepare('SELECT id FROM percakapan WHERE user_id = ? AND kontak = ?')
    .get(userId, kontak);
  if (ada) throw new Error(`Percakapan dengan ${kontak} sudah ada`);

  const blob = enkripsi(kunciDb, master, aadKunci(userId, kontak));
  const hasil = db.ambil()
    .prepare('INSERT INTO percakapan (user_id, kontak, kcv, kunci_enc, dibuat) VALUES (?, ?, ?, ?, ?)')
    .run(userId, kontak, kcv, blob, Date.now());
  return Number(hasil.lastInsertRowid);
}

function daftar(userId) {
  return db.ambil()
    .prepare('SELECT id, kontak, kcv, seq_kirim, seq_terima FROM percakapan WHERE user_id = ? ORDER BY kontak')
    .all(userId)
    .map((b) => ({
      id: Number(b.id),
      kontak: b.kontak,
      kcv: b.kcv,
      seqKirim: Number(b.seq_kirim),
      seqTerima: Number(b.seq_terima),
    }));
}

function ambil(userId, id, kunciDb) {
  const b = db.ambil()
    .prepare('SELECT * FROM percakapan WHERE id = ? AND user_id = ?')
    .get(id, userId);
  if (!b) throw new Error('Percakapan tidak ditemukan');
  return {
    id: Number(b.id),
    kontak: b.kontak,
    master: dekripsi(kunciDb, b.kunci_enc, aadKunci(userId, b.kontak)),
    seqKirim: Number(b.seq_kirim),
    seqTerima: Number(b.seq_terima),
  };
}

function cariKontak(userId, kontak) {
  const b = db.ambil()
    .prepare('SELECT id FROM percakapan WHERE user_id = ? AND kontak = ?')
    .get(userId, kontak);
  return b ? Number(b.id) : null;
}

function simpanPesan(percakapanId, arah, seq, waktu, penting, teks, kunciDb) {
  const blob = enkripsi(kunciDb, Buffer.from(teks, 'utf8'), aadPesan(percakapanId));
  db.ambil()
    .prepare('INSERT INTO pesan (percakapan_id, arah, seq, waktu, penting, cipher) VALUES (?, ?, ?, ?, ?, ?)')
    .run(percakapanId, arah, seq, waktu, penting ? 1 : 0, blob);
}

// Mencatat pesan keluar setelah berkas .svmsg berhasil ditulis
function catatKeluar(percakapanId, seq, waktu, penting, teks, kunciDb) {
  db.ambil().prepare('UPDATE percakapan SET seq_kirim = ? WHERE id = ?').run(seq, percakapanId);
  simpanPesan(percakapanId, 'keluar', seq, waktu, penting, teks, kunciDb);
}

// Mencatat pesan masuk yang sudah lolos pemeriksaan
function catatMasuk(percakapanId, seq, waktu, teks, kunciDb) {
  db.ambil().prepare('UPDATE percakapan SET seq_terima = ? WHERE id = ?').run(seq, percakapanId);
  simpanPesan(percakapanId, 'masuk', seq, waktu, false, teks, kunciDb);
}

// Catatan riwayat untuk berkas dan gambar (nomor urut 0, tidak memengaruhi nomor urut pesan teks)
function catatCatatan(percakapanId, arah, waktu, teks, kunciDb) {
  simpanPesan(percakapanId, arah, 0, waktu, false, teks, kunciDb);
}

function riwayat(percakapanId, kunciDb) {
  return db.ambil()
    .prepare('SELECT arah, seq, waktu, penting, cipher FROM pesan WHERE percakapan_id = ? ORDER BY waktu, id')
    .all(percakapanId)
    .map((b) => ({
      arah: b.arah,
      seq: Number(b.seq),
      waktu: Number(b.waktu),
      penting: Number(b.penting) === 1,
      teks: dekripsi(kunciDb, b.cipher, aadPesan(percakapanId)).toString('utf8'),
    }));
}

module.exports = { buat, daftar, ambil, cariKontak, catatKeluar, catatMasuk, catatCatatan, riwayat };