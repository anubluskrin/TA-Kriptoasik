const crypto = require('node:crypto');
const chain = require('../chain/blockchain');

// Bukti serah terima aset antar dua laptop.
// Pengirim mencatat blok TRANSFER di rantainya, lalu mengirim bukti { idAset, nama, dari, ke, indeks, hash, mac }.
// Penerima memeriksa MAC (kunci percakapan) lalu mencatat blok TERIMA di rantainya sendiri. Blok itu memuat hash
// blok TRANSFER milik pengirim sebagai "saksi". Bila pengirim kemudian mengubah atau menulis ulang rantainya,
// periksaBlok() menemukan bahwa blok itu tidak lagi sama dengan yang pernah dijanjikan.

function hitungMac(kunciMac, b) {
  const isi = ['serah-v1', b.idAset, b.nama, b.dari, b.ke, b.indeks, b.hash].join('|');
  return crypto.createHmac('sha256', kunciMac).update(isi, 'utf8').digest('hex');
}

// blok: blok TRANSFER yang baru ditambang di rantai pengirim
function buat({ blok, nama, kunci }) {
  const b = { idAset: blok.data.idAset, nama, dari: blok.data.dari, ke: blok.data.ke, indeks: blok.index, hash: blok.hash };
  return { ...b, mac: hitungMac(kunci.mac, b) };
}

// Memeriksa bukti yang diterima. Mengembalikan data blok TERIMA yang siap ditambahkan ke rantai penerima.
function verifikasi(bukti, { saya, rekan, kunci }) {
  const teksSemua = ['idAset', 'nama', 'dari', 'ke', 'hash', 'mac'].every((k) => bukti && typeof bukti[k] === 'string');
  const bentukBenar =
    teksSemua && Number.isInteger(bukti.indeks) && bukti.indeks >= 1 &&
    /^[0-9a-f]{64}$/.test(bukti.hash) && /^[0-9a-f]{64}$/.test(bukti.mac);
  if (!bentukBenar) throw new Error('Bukti serah terima tidak valid');
  if (bukti.ke !== saya) throw new Error(`Aset ini diserahkan kepada ${bukti.ke}, bukan kepada ${saya}`);
  if (bukti.dari !== rekan) throw new Error('Pengirim bukti tidak sesuai dengan sambungan');

  const mac = Buffer.from(hitungMac(kunci.mac, bukti), 'hex');
  const diterima = Buffer.from(bukti.mac, 'hex');
  if (mac.length !== diterima.length || !crypto.timingSafeEqual(mac, diterima)) {
    throw new Error('Stempel keaslian salah: passphrase percakapan berbeda atau bukti telah diubah');
  }
  return {
    tipe: 'TERIMA',
    idAset: bukti.idAset,
    nama: bukti.nama,
    dari: bukti.dari,
    ke: bukti.ke,
    hashPengirim: bukti.hash,
    indeksPengirim: bukti.indeks,
  };
}

// Membandingkan blok yang kini ditunjukkan pengirim dengan catatan TERIMA di rantai penerima.
// Hasil: { status: 'cocok' | 'diubah' | 'berbeda' | 'hilang', alasan? }
function periksaBlok(terima, blok) {
  if (!blok || typeof blok !== 'object' || !blok.data) {
    return { status: 'hilang', alasan: 'Blok itu tidak ada di rantai pengirim' };
  }
  let hashHitung;
  try {
    hashHitung = chain.hitungHash(blok);
  } catch {
    return { status: 'diubah', alasan: 'Blok di pengirim rusak bentuknya' };
  }
  if (hashHitung !== blok.hash) {
    return { status: 'diubah', alasan: 'Isi blok di pengirim tidak cocok dengan hash-nya (data diubah)' };
  }
  if (blok.hash !== terima.hashPengirim) {
    return { status: 'berbeda', alasan: 'Hash blok di pengirim berbeda dari yang dicatat saat serah terima (rantai ditulis ulang)' };
  }
  const d = blok.data;
  if (d.tipe !== 'TRANSFER' || d.idAset !== terima.idAset || d.dari !== terima.dari || d.ke !== terima.ke) {
    return { status: 'berbeda', alasan: 'Isi transaksi di pengirim berbeda dari yang diserahkan' };
  }
  return { status: 'cocok' };
}

module.exports = { buat, verifikasi, periksaBlok, hitungMac };