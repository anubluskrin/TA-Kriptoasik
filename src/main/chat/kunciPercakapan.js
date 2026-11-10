const crypto = require('node:crypto');
const { turunkanKunci } = require('../crypto/keys');

// Kunci percakapan diturunkan dari passphrase yang disepakati kedua pihak.
// Salt berasal dari dua username (diurutkan), jadi kedua laptop menghasilkan kunci yang sama
// tanpa perlu saling mengirim apa pun.

function hitungSalt(userA, userB) {
  const urut = [userA, userB].sort();
  return crypto
    .createHash('sha256')
    .update('securevault-percakapan-v1|' + urut.join('|'), 'utf8')
    .digest()
    .subarray(0, 16);
}

async function turunkanMaster(passphrase, userA, userB) {
  return turunkanKunci(passphrase, hitungSalt(userA, userB));
}

// Subkunci dari kunci master percakapan (HMAC-SHA256):
//   mac       : kunci untuk stempel keaslian pesan
//   kcv       : kode cek kunci (6 digit hex) untuk dibandingkan di kedua laptop
//   vigenere  : 12 huruf A-Z untuk tahap Vigenere
//   sdes      : 10 bit untuk tahap S-DES
function subkunci(master) {
  const turunan = (label) => crypto.createHmac('sha256', master).update(label).digest();

  const vig = turunan('vigenere');
  const kunciVigenere = Array.from(vig.subarray(0, 12), (b) => String.fromCharCode(65 + (b % 26))).join('');

  const sd = turunan('sdes');
  const kunciSdes = (((sd[0] << 2) | (sd[1] >> 6)) & 0x3ff).toString(2).padStart(10, '0');

  return {
    mac: turunan('mac'),
    kcv: turunan('kcv').subarray(0, 3).toString('hex').toUpperCase(),
    vigenere: kunciVigenere,
    sdes: kunciSdes,
  };
}

module.exports = { hitungSalt, turunkanMaster, subkunci };