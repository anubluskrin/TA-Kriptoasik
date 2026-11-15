const crypto = require('node:crypto');
const vigenere = require('./vigenere');
const des = require('./des');

// Super enkripsi: Vigenere (klasik, mod 26) lalu DES mode CBC (modern).
//
// Alur enkripsi:
//   teks -> Vigenere -> UTF-8 -> DES CBC + padding PKCS#7 (IV acak 8 byte) -> Base64( IV || ciphertext )
//
// Vigenere hanya mengubah huruf A-Z. Angka, simbol, spasi, baris baru, dan emoji
// dibiarkan, tetapi semuanya tetap terlindungi karena DES bekerja pada seluruh byte.

const PANJANG_IV = des.UKURAN_BLOK;

function periksaKunciDes(kunciDes) {
  if (typeof kunciDes !== 'string' || !/^[0-9a-fA-F]{16}$/.test(kunciDes)) {
    throw new Error('Kunci DES harus 16 karakter heksadesimal (0-9, A-F)');
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
  if (mentah.length < PANJANG_IV + des.UKURAN_BLOK) {
    throw new Error('Ciphertext terlalu pendek');
  }
  return { iv: mentah.subarray(0, PANJANG_IV), isi: mentah.subarray(PANJANG_IV) };
}

// Parameter `iv` (Buffer 8 byte) hanya untuk pengujian; pemakaian normal dibiarkan acak.
function encrypt(teks, { kunciVigenere, kunciDes, iv } = {}) {
  periksaKunciDes(kunciDes);

  const hasilVigenere = vigenere.encrypt(teks, kunciVigenere);
  const ivByte = iv === undefined ? crypto.randomBytes(PANJANG_IV) : iv;
  const cipher = des.cbcEncrypt(Buffer.from(hasilVigenere, 'utf8'), kunciDes, ivByte);
  const token = Buffer.concat([ivByte, cipher]).toString('base64');

  return {
    hasil: token,
    rincian: [
      ['Teks masukan', teks],
      ['Kunci Vigenere', kunciVigenere.toUpperCase()],
      ['Tahap 1 (Vigenere)', hasilVigenere],
      ['Kunci DES', kunciDes.toUpperCase()],
      ['IV (hex)', ivByte.toString('hex')],
      ['Tahap 2 (DES CBC)', cipher.toString('hex')],
      ['Hasil akhir (Base64)', token],
    ],
  };
}

function decrypt(token, { kunciVigenere, kunciDes } = {}) {
  periksaKunciDes(kunciDes);

  const { iv, isi } = bacaToken(token);

  let hasilDes;
  try {
    hasilDes = new TextDecoder('utf-8', { fatal: true })
      .decode(des.cbcDecrypt(isi, kunciDes, iv));
  } catch {
    throw new Error('Dekripsi gagal: kunci DES salah atau ciphertext rusak');
  }

  const teks = vigenere.decrypt(hasilDes, kunciVigenere);

  return {
    hasil: teks,
    rincian: [
      ['Ciphertext masukan', token.trim()],
      ['Kunci DES', kunciDes.toUpperCase()],
      ['IV (hex)', iv.toString('hex')],
      ['Ciphertext DES (hex)', isi.toString('hex')],
      ['Dekripsi DES', hasilDes],
      ['Kunci Vigenere', kunciVigenere.toUpperCase()],
      ['Dekripsi Vigenere', teks],
    ],
  };
}

module.exports = { encrypt, decrypt };