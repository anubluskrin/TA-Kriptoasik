const crypto = require('node:crypto');
const { chacha20poly1305 } = require('@noble/ciphers/chacha');

// Enkripsi data di basis data dengan ChaCha20-Poly1305 (RFC 8439).
// Dipakai pustaka @noble/ciphers karena Electron memakai BoringSSL, yang tidak menyediakan
// ChaCha20-Poly1305 lewat crypto.createCipheriv (muncul galat "Unknown cipher").
// Format yang disimpan: nonce (12) | ciphertext | tag (16)
const PANJANG_NONCE = 12;
const PANJANG_TAG = 16;

function enkripsi(kunci, polos, aad) {
  const nonce = crypto.randomBytes(PANJANG_NONCE);
  const isi = chacha20poly1305(kunci, nonce, Buffer.from(aad, 'utf8')).encrypt(polos);
  return Buffer.concat([nonce, isi]);
}

function dekripsi(kunci, data, aad) {
  const buf = Buffer.from(data);
  if (buf.length < PANJANG_NONCE + PANJANG_TAG) throw new Error('Data di basis data rusak');
  try {
    const polos = chacha20poly1305(kunci, buf.subarray(0, PANJANG_NONCE), Buffer.from(aad, 'utf8'))
      .decrypt(buf.subarray(PANJANG_NONCE));
    return Buffer.from(polos);
  } catch {
    throw new Error('Data di basis data rusak atau kunci tidak cocok');
  }
}

module.exports = { enkripsi, dekripsi };