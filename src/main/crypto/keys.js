const crypto = require('node:crypto');
const { promisify } = require('node:util');

const pbkdf2 = promisify(crypto.pbkdf2);

const ITERASI = 200000;
const PANJANG_KUNCI = 32; // 256 bit

// Mengubah passphrase menjadi kunci 32 byte (PBKDF2-HMAC-SHA256).
// Salt acak membuat passphrase yang sama menghasilkan kunci berbeda di tiap berkas.
async function turunkanKunci(passphrase, salt) {
  if (typeof passphrase !== 'string' || passphrase.length < 8) {
    throw new Error('Passphrase minimal 8 karakter');
  }
  if (!Buffer.isBuffer(salt) || salt.length < 16) {
    throw new Error('Salt minimal 16 byte');
  }
  return pbkdf2(passphrase, salt, ITERASI, PANJANG_KUNCI, 'sha256');
}

module.exports = { turunkanKunci, ITERASI, PANJANG_KUNCI };