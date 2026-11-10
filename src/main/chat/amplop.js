const crypto = require('node:crypto');
const superCipher = require('../crypto/superCipher');

// Amplop pesan (isi berkas .svmsg):
//   { v, dari, ke, seq, waktu, id, token, mac }
// token = hasil super enkripsi (Vigenere lalu S-DES CBC lalu Base64)
// mac   = HMAC-SHA256 atas seluruh bidang lain (encrypt-then-MAC), memakai kunci mac percakapan.
// Algoritma klasik tidak mendeteksi perubahan data, jadi MAC inilah yang menolak pesan yang
// diubah dan pesan dengan passphrase yang salah, sebelum proses dekripsi dijalankan.

const MAKS_TOKEN = 60000;
const MAKS_TEKS = 5000;

function hitungMac(kunciMac, a) {
  const isi = [a.v, a.dari, a.ke, a.seq, a.waktu, a.id, a.token].join('|');
  return crypto.createHmac('sha256', kunciMac).update(isi, 'utf8').digest('hex');
}

function buat({ dari, ke, seq, teks, kunci }) {
  if (typeof teks !== 'string' || teks.length === 0 || teks.length > MAKS_TEKS) {
    throw new Error(`Pesan harus 1 sampai ${MAKS_TEKS} karakter`);
  }
  const { hasil } = superCipher.encrypt(teks, { kunciVigenere: kunci.vigenere, kunciSdes: kunci.sdes });
  const amplop = {
    v: 1,
    dari,
    ke,
    seq,
    waktu: Date.now(),
    id: crypto.randomBytes(8).toString('hex'),
    token: hasil,
  };
  amplop.mac = hitungMac(kunci.mac, amplop);
  return amplop;
}

// Memeriksa amplop yang diterima. Melempar galat dengan alasan yang jelas bila ditolak.
function verifikasi(amplop, { saya, kontak, kunci, seqTerakhir }) {
  const bentukBenar =
    amplop && typeof amplop === 'object' && amplop.v === 1 &&
    typeof amplop.dari === 'string' && typeof amplop.ke === 'string' &&
    Number.isInteger(amplop.seq) && Number.isFinite(amplop.waktu) &&
    typeof amplop.id === 'string' && typeof amplop.token === 'string' &&
    typeof amplop.mac === 'string';
  if (!bentukBenar) throw new Error('Berkas bukan pesan SecureVault yang valid');
  if (amplop.token.length > MAKS_TOKEN) throw new Error('Pesan terlalu besar');

  if (amplop.ke !== saya) throw new Error(`Pesan ini ditujukan untuk ${amplop.ke}, bukan untuk ${saya}`);
  if (amplop.dari !== kontak) throw new Error('Pengirim tidak sesuai dengan percakapan');

  const mac = Buffer.from(hitungMac(kunci.mac, amplop), 'hex');
  const diterima = Buffer.from(/^[0-9a-f]{64}$/.test(amplop.mac) ? amplop.mac : '', 'hex');
  if (diterima.length !== mac.length || !crypto.timingSafeEqual(mac, diterima)) {
    throw new Error('Stempel keaslian salah: passphrase percakapan berbeda atau pesan telah diubah');
  }

  if (amplop.seq <= seqTerakhir) {
    throw new Error('Pesan lama atau sudah pernah diimpor (nomor urut ' + amplop.seq + ')');
  }

  const { hasil } = superCipher.decrypt(amplop.token, {
    kunciVigenere: kunci.vigenere,
    kunciSdes: kunci.sdes,
  });
  return { teks: hasil, seq: amplop.seq, waktu: amplop.waktu };
}

module.exports = { buat, verifikasi, hitungMac, MAKS_TEKS };