const vigenere = require('./vigenere');

// Tahap 1: baru Vigenere. Tahap S-DES ditambahkan pada step berikutnya.

function encrypt(teks, { kunciVigenere }) {
  const hasilVigenere = vigenere.encrypt(teks, kunciVigenere);
  return {
    hasil: hasilVigenere,
    rincian: [
      ['Teks masukan', teks],
      ['Kunci Vigenere', kunciVigenere.toUpperCase()],
      ['Tahap 1 (Vigenere)', hasilVigenere],
    ],
  };
}

function decrypt(teks, { kunciVigenere }) {
  const hasilVigenere = vigenere.decrypt(teks, kunciVigenere);
  return {
    hasil: hasilVigenere,
    rincian: [
      ['Teks masukan', teks],
      ['Kunci Vigenere', kunciVigenere.toUpperCase()],
      ['Dekripsi Vigenere', hasilVigenere],
    ],
  };
}

module.exports = { encrypt, decrypt };