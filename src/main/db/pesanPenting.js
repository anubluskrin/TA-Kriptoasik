const db = require('./db');
const { enkripsi, dekripsi } = require('./dbCipher');

// Pesan penting disimpan sebagai satu blob terenkripsi (label dan isi sekaligus).
const aad = (userId) => 'pesan-penting:' + userId;

function simpan(userId, label, isi, kunci) {
  if (typeof label !== 'string' || label.trim().length === 0 || label.length > 100) {
    throw new Error('Label harus 1 sampai 100 karakter');
  }
  if (typeof isi !== 'string' || isi.length === 0 || isi.length > 20000) {
    throw new Error('Isi pesan harus 1 sampai 20000 karakter');
  }
  const payload = Buffer.from(JSON.stringify({ label: label.trim(), isi }), 'utf8');
  const blob = enkripsi(kunci, payload, aad(userId));
  const hasil = db.ambil()
    .prepare('INSERT INTO pesan_penting (user_id, waktu, cipher) VALUES (?, ?, ?)')
    .run(userId, Date.now(), blob);
  return Number(hasil.lastInsertRowid);
}

function bacaBaris(baris, userId, kunci) {
  return JSON.parse(dekripsi(kunci, baris.cipher, aad(userId)).toString('utf8'));
}

// Daftar menampilkan label (hasil dekripsi) dan cuplikan isi mentah di basis data
function daftar(userId, kunci) {
  const baris = db.ambil()
    .prepare('SELECT id, waktu, cipher FROM pesan_penting WHERE user_id = ? ORDER BY id DESC')
    .all(userId);
  return baris.map((b) => ({
    id: Number(b.id),
    waktu: Number(b.waktu),
    label: bacaBaris(b, userId, kunci).label,
    cipherHex: Buffer.from(b.cipher).toString('hex').slice(0, 48),
  }));
}

function buka(userId, id, kunci) {
  const baris = db.ambil()
    .prepare('SELECT id, waktu, cipher FROM pesan_penting WHERE id = ? AND user_id = ?')
    .get(id, userId);
  if (!baris) throw new Error('Pesan tidak ditemukan');
  const { label, isi } = bacaBaris(baris, userId, kunci);
  return { id: Number(baris.id), waktu: Number(baris.waktu), label, isi };
}

module.exports = { simpan, daftar, buka };