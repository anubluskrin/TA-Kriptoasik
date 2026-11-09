const crypto = require('node:crypto');

// Blockchain sederhana untuk mencatat kepemilikan aset.
// Setiap blok: { index, waktu, hashSebelumnya, data, nonce, hash }
// hash = SHA-256 dari seluruh isi blok. Blok sah bila hash-nya diawali sejumlah angka 0
// (proof of work) dan hashSebelumnya sama dengan hash blok sebelumnya.

const KESULITAN = 3; // hash harus diawali "000"
const HASH_NOL = '0'.repeat(64);

// Mengubah objek jadi teks dengan urutan kunci tetap, supaya hash selalu sama
function teksStabil(nilai) {
  if (Array.isArray(nilai)) return '[' + nilai.map(teksStabil).join(',') + ']';
  if (nilai && typeof nilai === 'object') {
    return '{' + Object.keys(nilai).sort()
      .map((k) => JSON.stringify(k) + ':' + teksStabil(nilai[k])).join(',') + '}';
  }
  return JSON.stringify(nilai);
}

function hitungHash({ index, waktu, hashSebelumnya, data, nonce }) {
  const isi = [index, waktu, hashSebelumnya, teksStabil(data), nonce].join('|');
  return crypto.createHash('sha256').update(isi, 'utf8').digest('hex');
}

// Blok pertama. Isinya tetap, jadi sama persis di semua laptop.
function buatGenesis() {
  const blok = { index: 0, waktu: 0, hashSebelumnya: HASH_NOL, data: { tipe: 'GENESIS' }, nonce: 0 };
  blok.hash = hitungHash(blok);
  return blok;
}

function periksaTeks(nilai, nama, maks) {
  if (typeof nilai !== 'string' || nilai.trim().length === 0 || nilai.length > maks) {
    throw new Error(`${nama} harus berisi 1 sampai ${maks} karakter`);
  }
}

// Menerapkan satu transaksi ke status kepemilikan (Map idAset -> { nama, pemilik }).
// Melempar galat bila transaksi melanggar aturan.
function terapkan(status, data) {
  if (!data || typeof data !== 'object') throw new Error('Data transaksi tidak valid');

  if (data.tipe === 'REGISTER') {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(data.idAset))) {
      throw new Error('ID aset hanya huruf, angka, - dan _ (maksimal 40 karakter)');
    }
    periksaTeks(data.nama, 'Nama aset', 100);
    periksaTeks(data.pemilik, 'Pemilik', 60);
    if (status.has(data.idAset)) throw new Error(`Aset ${data.idAset} sudah terdaftar`);
    status.set(data.idAset, { nama: data.nama, pemilik: data.pemilik });
    return;
  }

  if (data.tipe === 'TRANSFER') {
    const aset = status.get(data.idAset);
    if (!aset) throw new Error(`Aset ${data.idAset} belum terdaftar`);
    periksaTeks(data.ke, 'Pemilik baru', 60);
    if (data.dari !== aset.pemilik) throw new Error(`Pengirim bukan pemilik aset (pemilik saat ini: ${aset.pemilik})`);
    if (data.ke === data.dari) throw new Error('Pemilik baru sama dengan pemilik lama');
    aset.pemilik = data.ke;
    return;
  }

  throw new Error('Jenis transaksi tidak dikenal');
}

// Mengulang seluruh transaksi di rantai untuk mendapatkan status kepemilikan terkini
function hitungStatus(rantai) {
  const status = new Map();
  for (let i = 1; i < rantai.length; i++) terapkan(status, rantai[i].data);
  return status;
}

function daftarAset(rantai) {
  return Array.from(hitungStatus(rantai), ([idAset, v]) => ({ idAset, ...v }));
}

// Memeriksa seluruh rantai. Mengembalikan { valid: true } atau
// { valid: false, indeksRusak, alasan } yang menunjuk blok pertama yang bermasalah.
function validasiRantai(rantai) {
  if (!Array.isArray(rantai) || rantai.length === 0) {
    return { valid: false, indeksRusak: 0, alasan: 'Rantai kosong' };
  }
  const genesis = buatGenesis();
  if (rantai[0].hash !== genesis.hash || hitungHash(rantai[0]) !== genesis.hash) {
    return { valid: false, indeksRusak: 0, alasan: 'Blok genesis tidak sesuai' };
  }

  const status = new Map();
  for (let i = 1; i < rantai.length; i++) {
    const blok = rantai[i];
    const sebelumnya = rantai[i - 1];
    const rusak = (alasan) => ({ valid: false, indeksRusak: i, alasan });

    if (blok.index !== i) return rusak('Nomor blok tidak berurutan');
    if (hitungHash(blok) !== blok.hash) return rusak('Isi blok tidak cocok dengan hash-nya (data diubah)');
    if (!blok.hash.startsWith('0'.repeat(KESULITAN))) return rusak('Proof of work tidak terpenuhi');
    if (blok.hashSebelumnya !== sebelumnya.hash) return rusak('Tautan ke blok sebelumnya putus');
    try {
      terapkan(status, blok.data);
    } catch (err) {
      return rusak('Transaksi melanggar aturan: ' + err.message);
    }
  }
  return { valid: true };
}

// Menyiapkan blok baru (belum ditambang). Transaksi diperiksa lebih dulu.
function siapkanBlok(rantai, data) {
  const status = hitungStatus(rantai);
  terapkan(status, data);
  const terakhir = rantai[rantai.length - 1];
  return { index: terakhir.index + 1, waktu: Date.now(), hashSebelumnya: terakhir.hash, data };
}

module.exports = {
  KESULITAN, HASH_NOL, hitungHash, buatGenesis, terapkan, hitungStatus,
  daftarAset, validasiRantai, siapkanBlok,
};