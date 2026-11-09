// S-DES (Simplified DES): blok 8-bit, kunci 10-bit, 2 putaran Feistel.
// Bagian 1: tabel permutasi dan pembangkit subkunci K1 dan K2.
// Bagian 2: enkripsi dan dekripsi satu blok 8 bit.
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

// XOR dua array bit yang panjangnya sama
function xor(a, b) {
  return a.map((nilai, i) => nilai ^ b[i]);
}

// Mencari nilai S-box: baris dari bit 1 dan 4, kolom dari bit 2 dan 3.
// Hasilnya 2 bit, mis. 3 -> [1, 1]
function cariSbox(sbox, empatBit) {
  const baris = empatBit[0] * 2 + empatBit[3];
  const kolom = empatBit[1] * 2 + empatBit[2];
  const nilai = sbox[baris][kolom];
  return [nilai >> 1, nilai & 1];
}

// Fungsi F: EP(kanan) XOR subkunci -> S0 dan S1 -> P4
function fungsiF(kanan, subkunci) {
  const diperluas = xor(permutasi(kanan, EP), subkunci);
  const hasilS0 = cariSbox(S0, diperluas.slice(0, 4));
  const hasilS1 = cariSbox(S1, diperluas.slice(4));
  return permutasi(hasilS0.concat(hasilS1), P4);
}

// Satu putaran Feistel: f_K(L, R) = (L XOR F(R, K), R)
function putaran(kiri, kanan, subkunci) {
  return { kiri: xor(kiri, fungsiF(kanan, subkunci)), kanan };
}

// Proses satu blok 8 bit dengan urutan subkunci tertentu (dipakai enkripsi dan dekripsi)
function prosesBlok(blok, kunciPertama, kunciKedua) {
  const bit = permutasi(blok, IP);
  let kiri = bit.slice(0, 4);
  let kanan = bit.slice(4);

  ({ kiri, kanan } = putaran(kiri, kanan, kunciPertama));
  [kiri, kanan] = [kanan, kiri]; // swap
  ({ kiri, kanan } = putaran(kiri, kanan, kunciKedua));

  return permutasi(kiri.concat(kanan), IP_INV);
}

// Menerima kunci/blok berupa string "0101..." atau array bit; mengembalikan array bit
function terimaBit(nilai, panjang) {
  return Array.isArray(nilai) ? nilai : bitDariString(nilai, panjang);
}

// Enkripsi satu blok 8 bit: IP -> f_K1 -> swap -> f_K2 -> IP^-1
function enkripsiBlok(blok, kunci) {
  const { k1, k2 } = buatSubkunci(terimaBit(kunci, 10));
  return prosesBlok(terimaBit(blok, 8), k1, k2);
}

// Dekripsi satu blok 8 bit: sama dengan enkripsi, tetapi K2 dipakai lebih dulu
function dekripsiBlok(blok, kunci) {
  const { k1, k2 } = buatSubkunci(terimaBit(kunci, 10));
  return prosesBlok(terimaBit(blok, 8), k2, k1);
}

module.exports = {
  P10, P8, IP, IP_INV, EP, P4, S0, S1,
  bitDariString,
  bitKeString,
  permutasi,
  geserKiri,
  buatSubkunci,
  xor,
  cariSbox,
  fungsiF,
  enkripsiBlok,
  dekripsiBlok,
};