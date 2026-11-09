const crypto = require('node:crypto');

// Enkripsi data di basis data dengan ChaCha20-Poly1305.
// Format yang disimpan: nonce (12) | tag (16) | ciphertext
const PANJANG_NONCE = 12;
const PANJANG_TAG = 16;

function enkripsi(kunci, polos, aad) {
  const nonce = crypto.randomBytes(PANJANG_NONCE);
  const cipher = crypto.createCipheriv('chacha20-poly1305', kunci, nonce, { authTagLength: PANJANG_TAG });
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const isi = Buffer.concat([cipher.update(polos), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), isi]);
}

function dekripsi(kunci, data, aad) {
  const buf = Buffer.from(data);
  if (buf.length < PANJANG_NONCE + PANJANG_TAG) throw new Error('Data di basis data rusak');
  const nonce = buf.subarray(0, PANJANG_NONCE);
  const tag = buf.subarray(PANJANG_NONCE, PANJANG_NONCE + PANJANG_TAG);
  const isi = buf.subarray(PANJANG_NONCE + PANJANG_TAG);

  const decipher = crypto.createDecipheriv('chacha20-poly1305', kunci, nonce, { authTagLength: PANJANG_TAG });
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(isi), decipher.final()]);
  } catch {
    throw new Error('Data di basis data rusak atau kunci tidak cocok');
  }
}

module.exports = { enkripsi, dekripsi };