// S-DES (Simplified DES): blok 8-bit, kunci 10-bit, 2 putaran Feistel.
// Bagian 1: tabel permutasi dan pembangkit subkunci K1 dan K2.
// Bit direpresentasikan sebagai array angka, mis. [1, 0, 1, 0, ...]

// Semua tabel memakai indeks mulai dari 1
const P10 = [3, 5, 2, 7, 4, 10, 1, 9, 8, 6];
const P8 = [6, 3, 7, 4, 8, 5, 10, 9];
const IP = [2, 6, 3, 1, 4, 8, 5, 7];
const IP_INV = [4, 1, 3, 5, 7, 2, 8, 6];
const EP = [4, 1, 2, 3, 2, 3, 4, 1];
const P4 = [2, 4, 3, 1];

const S0 = [
  [1, 0, 3, 2],
  [3, 2, 1, 0],
  [0, 2, 1, 3],
  [3, 1, 3, 2],
];
const S1 = [
  [0, 1, 2, 3],
  [2, 0, 1, 3],
  [3, 0, 1, 0],
  [2, 1, 0, 3],
];

// "1010000010" -> [1,0,1,0,0,0,0,0,1,0]
function bitDariString(teks, panjang) {
  if (typeof teks !== 'string' || teks.length !== panjang || !/^[01]+$/.test(teks)) {
    throw new Error(`Harus berupa ${panjang} karakter 0/1`);
  }
  return teks.split('').map(Number);
}

// [1,0,1,0] -> "1010"
function bitKeString(bit) {
  return bit.join('');
}

// Menyusun ulang bit sesuai tabel: hasil[i] = bit[tabel[i] - 1]
function permutasi(bit, tabel) {
  return tabel.map((indeks) => bit[indeks - 1]);
}

// Geser kiri melingkar sebanyak n posisi
function geserKiri(bit, n) {
  return bit.slice(n).concat(bit.slice(0, n));
}

// Membangkitkan subkunci K1 dan K2 (masing-masing 8 bit) dari kunci 10 bit
function buatSubkunci(kunci) {
  const bit = Array.isArray(kunci) ? kunci : bitDariString(kunci, 10);
  if (bit.length !== 10) {
    throw new Error('Kunci S-DES harus 10 bit');
  }

  const p10 = permutasi(bit, P10);
  let kiri = p10.slice(0, 5);
  let kanan = p10.slice(5);

  // LS-1 -> P8 = K1
  kiri = geserKiri(kiri, 1);
  kanan = geserKiri(kanan, 1);
  const k1 = permutasi(kiri.concat(kanan), P8);

  // LS-2 (dilanjutkan dari hasil LS-1) -> P8 = K2
  kiri = geserKiri(kiri, 2);
  kanan = geserKiri(kanan, 2);
  const k2 = permutasi(kiri.concat(kanan), P8);

  return { k1, k2 };
}

module.exports = {
  P10, P8, IP, IP_INV, EP, P4, S0, S1,
  bitDariString,
  bitKeString,
  permutasi,
  geserKiri,
  buatSubkunci,
};