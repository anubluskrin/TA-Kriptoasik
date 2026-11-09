const crypto = require('node:crypto');
const { turunkanKunci } = require('./keys');

// Format berkas .svlt:
//   MAGIC "SVLT1" (5) | salt (16) | iv (12) | tag (16) | ciphertext
// Isi yang dienkripsi: panjangNama (2 byte) | nama berkas asli (UTF-8) | isi berkas
// MAGIC, salt, dan iv ikut diautentikasi (AAD), jadi header yang diubah akan ditolak.

const MAGIC = Buffer.from('SVLT1', 'utf8');
const PANJANG_SALT = 16;
const PANJANG_IV = 12;
const PANJANG_TAG = 16;
const PANJANG_HEADER = MAGIC.length + PANJANG_SALT + PANJANG_IV + PANJANG_TAG;
const MAKS_UKURAN = 200 * 1024 * 1024;

async function enkripsiBerkas(namaAsli, isi, passphrase) {
  if (!Buffer.isBuffer(isi)) throw new TypeError('Isi berkas harus berupa Buffer');
  if (isi.length > MAKS_UKURAN) throw new Error('Berkas terlalu besar (maksimal 200 MB)');

  const nama = Buffer.from(namaAsli, 'utf8');
  if (nama.length === 0 || nama.length > 255) throw new Error('Nama berkas tidak valid');

  const salt = crypto.randomBytes(PANJANG_SALT);
  const iv = crypto.randomBytes(PANJANG_IV);
  const kunci = await turunkanKunci(passphrase, salt);

  const panjangNama = Buffer.alloc(2);
  panjangNama.writeUInt16BE(nama.length);
  const polos = Buffer.concat([panjangNama, nama, isi]);

  const cipher = crypto.createCipheriv('aes-256-gcm', kunci, iv);
  cipher.setAAD(Buffer.concat([MAGIC, salt, iv]));
  const terenkripsi = Buffer.concat([cipher.update(polos), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([MAGIC, salt, iv, tag, terenkripsi]);
}

async function dekripsiBerkas(data, passphrase) {
  if (!Buffer.isBuffer(data) || data.length < PANJANG_HEADER + 2) {
    throw new Error('Berkas bukan format .svlt yang valid');
  }
  if (!data.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Berkas bukan format .svlt yang valid');
  }

  let pos = MAGIC.length;
  const salt = data.subarray(pos, (pos += PANJANG_SALT));
  const iv = data.subarray(pos, (pos += PANJANG_IV));
  const tag = data.subarray(pos, (pos += PANJANG_TAG));
  const terenkripsi = data.subarray(pos);

  const kunci = await turunkanKunci(passphrase, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', kunci, iv);
  decipher.setAAD(Buffer.concat([MAGIC, salt, iv]));
  decipher.setAuthTag(tag);

  let polos;
  try {
    polos = Buffer.concat([decipher.update(terenkripsi), decipher.final()]);
  } catch {
    throw new Error('Passphrase salah atau berkas telah diubah');
  }

  const panjangNama = polos.readUInt16BE(0);
  if (panjangNama === 0 || 2 + panjangNama > polos.length) {
    throw new Error('Isi berkas rusak');
  }
  const namaAsli = polos.subarray(2, 2 + panjangNama).toString('utf8');
  const isi = polos.subarray(2 + panjangNama);
  return { namaAsli, isi };
}

module.exports = { enkripsiBerkas, dekripsiBerkas, MAKS_UKURAN };