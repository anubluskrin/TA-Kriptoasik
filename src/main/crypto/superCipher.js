const crypto = require('node:crypto');
const vigenere = require('./vigenere');
const sdes = require('./sdes');

// Super enkripsi: Vigenere (klasik, mod 26) lalu S-DES mode CBC (modern).
//
// Alur enkripsi:
//   teks -> Vigenere -> UTF-8 -> S-DES CBC (IV acak 1 byte) -> Base64( IV || ciphertext )
//
// Vigenere hanya mengubah huruf A-Z. Angka, simbol, spasi, baris baru, dan emoji
// dibiarkan, tetapi semuanya tetap terlindungi karena S-DES bekerja pada seluruh byte.

function periksaKunciSdes(kunciSdes) {
  if (typeof kunciSdes !== 'string' || !/^[01]{10}$/.test(kunciSdes)) {
    throw new Error('Kunci S-DES harus 10 karakter 0 atau 1');
  }
}

function bacaToken(token) {
  if (typeof token !== 'string') {
    throw new TypeError('Ciphertext harus berupa string Base64');
  }
  const bersih = token.replace(/\s+/g, '');
  if (bersih.length === 0 || bersih.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(bersih)) {
    throw new Error('Ciphertext bukan Base64 yang valid');
  }
  const mentah = Buffer.from(bersih, 'base64');
  if (mentah.length < 1) {
    throw new Error('Ciphertext terlalu pendek');
  }
  return { iv: mentah.subarray(0, 1), isi: mentah.subarray(1) };
}

// Parameter `iv` (Buffer 1 byte) hanya untuk pengujian; pemakaian normal dibiarkan acak.
function encrypt(teks, { kunciVigenere, kunciSdes, iv } = {}) {
  periksaKunciSdes(kunciSdes);

  const hasilVigenere = vigenere.encrypt(teks, kunciVigenere);
  const ivByte = iv === undefined ? crypto.randomBytes(1) : iv;
  const cipher = sdes.cbcEncrypt(Buffer.from(hasilVigenere, 'utf8'), kunciSdes, ivByte);
  const token = Buffer.concat([ivByte, cipher]).toString('base64');

  return {
    hasil: token,
    rincian: [
      ['Teks masukan', teks],
      ['Kunci Vigenere', kunciVigenere.toUpperCase()],
      ['Tahap 1 (Vigenere)', hasilVigenere],
      ['Kunci S-DES', kunciSdes],
      ['IV (hex)', ivByte.toString('hex')],
      ['Tahap 2 (S-DES CBC)', cipher.toString('hex')],
      ['Hasil akhir (Base64)', token],
    ],
  };
}

function decrypt(token, { kunciVigenere, kunciSdes } = {}) {
  periksaKunciSdes(kunciSdes);

  const { iv, isi } = bacaToken(token);
  
  let hasilSdes;
  try {
    hasilSdes = new TextDecoder('utf-8', { fatal: true })
      .decode(sdes.cbcDecrypt(isi, kunciSdes, iv));
  } catch {
    throw new Error('Dekripsi gagal: kunci S-DES salah atau ciphertext rusak');
  }

  const teks = vigenere.decrypt(hasilSdes, kunciVigenere);

  return {
    hasil: teks,
    rincian: [
      ['Ciphertext masukan', token.trim()],
      ['Kunci S-DES', kunciSdes],
      ['IV (hex)', iv.toString('hex')],
      ['Ciphertext S-DES (hex)', isi.toString('hex')],
      ['Dekripsi S-DES', hasilSdes],
      ['Kunci Vigenere', kunciVigenere.toUpperCase()],
      ['Dekripsi Vigenere', teks],
    ],
  };
}

module.exports = { encrypt, decrypt };