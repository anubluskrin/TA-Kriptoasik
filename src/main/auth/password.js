const crypto = require('node:crypto');
const { promisify } = require('node:util');

const pbkdf2 = promisify(crypto.pbkdf2);

// Password disimpan sebagai hash PBKDF2-HMAC-SHA256 dengan salt acak, bukan teks asli.
const ITERASI = 210000;

async function buatHash(password) {
  const salt = crypto.randomBytes(16);
  const hash = await pbkdf2(password, salt, ITERASI, 32, 'sha256');
  return { salt: salt.toString('hex'), hash: hash.toString('hex'), iterasi: ITERASI };
}

async function cocok(password, { salt, hash, iterasi }) {
  const hitung = await pbkdf2(password, Buffer.from(salt, 'hex'), iterasi, 32, 'sha256');
  const tersimpan = Buffer.from(hash, 'hex');
  return hitung.length === tersimpan.length && crypto.timingSafeEqual(hitung, tersimpan);
}

module.exports = { buatHash, cocok };