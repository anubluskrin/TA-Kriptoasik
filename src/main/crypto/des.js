// DES (Data Encryption Standard) ditulis sendiri: blok 64 bit, kunci 64 bit (56 bit efektif), 16 putaran Feistel.
// Bit disimpan sebagai larik angka 0/1 supaya setiap tabel permutasi mudah dicocokkan dengan standar FIPS 46-3.
// Tabel dan nomor bit memakai indeks mulai dari 1, bit 1 adalah bit paling kiri.

const IP = [
  58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4,
  62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
  57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3,
  61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7,
];
const FP = [
  40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31,
  38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
  36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27,
  34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25,
];
const E = [
  32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9,
  8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17,
  16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25,
  24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1,
];
const P = [
  16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
  2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25,
];
const PC1 = [
  57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18,
  10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
  63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22,
  14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4,
];
const PC2 = [
  14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10,
  23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
  41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48,
  44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32,
];
const GESER = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

const SBOX = [
  [
    14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7,
    0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8,
    4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0,
    15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13,
  ],
  [
    15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10,
    3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5,
    0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15,
    13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9,
  ],
  [
    10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8,
    13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1,
    13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7,
    1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12,
  ],
  [
    7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15,
    13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9,
    10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4,
    3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14,
  ],
  [
    2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9,
    14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6,
    4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14,
    11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3,
  ],
  [
    12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11,
    10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8,
    9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6,
    4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13,
  ],
  [
    4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1,
    13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6,
    1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2,
    6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12,
  ],
  [
    13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7,
    1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2,
    7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8,
    2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11,
  ],
];

const UKURAN_BLOK = 8; // byte

function keBit(buf) {
  const bit = [];
  for (const b of buf) for (let i = 7; i >= 0; i--) bit.push((b >> i) & 1);
  return bit;
}

function keByte(bit) {
  const buf = Buffer.alloc(bit.length / 8);
  for (let i = 0; i < bit.length; i++) buf[i >> 3] |= bit[i] << (7 - (i & 7));
  return buf;
}

const permutasi = (bit, tabel) => tabel.map((i) => bit[i - 1]);
const xor = (a, b) => a.map((v, i) => v ^ b[i]);
const geserKiri = (bit, n) => bit.slice(n).concat(bit.slice(0, n));

function periksaKunci(kunci) {
  if (typeof kunci !== 'string' || !/^[0-9a-fA-F]{16}$/.test(kunci)) {
    throw new Error('Kunci DES harus 16 karakter heksadesimal (0-9, A-F)');
  }
  return Buffer.from(kunci, 'hex');
}

// 16 subkunci masing-masing 48 bit
function buatSubkunci(kunci) {
  const k56 = permutasi(keBit(periksaKunci(kunci)), PC1);
  let c = k56.slice(0, 28);
  let d = k56.slice(28);
  const hasil = [];
  for (const n of GESER) {
    c = geserKiri(c, n);
    d = geserKiri(d, n);
    hasil.push(permutasi(c.concat(d), PC2));
  }
  return hasil;
}

function fungsiF(r, subkunci) {
  const x = xor(permutasi(r, E), subkunci);
  const keluar = [];
  for (let s = 0; s < 8; s++) {
    const g = x.slice(s * 6, s * 6 + 6);
    const baris = (g[0] << 1) | g[5];
    const kolom = (g[1] << 3) | (g[2] << 2) | (g[3] << 1) | g[4];
    const nilai = SBOX[s][baris * 16 + kolom];
    for (let i = 3; i >= 0; i--) keluar.push((nilai >> i) & 1);
  }
  return permutasi(keluar, P);
}

function prosesBlok(blok, subkunci) {
  const bit = permutasi(keBit(blok), IP);
  let l = bit.slice(0, 32);
  let r = bit.slice(32);
  for (const k of subkunci) {
    const baru = xor(l, fungsiF(r, k));
    l = r;
    r = baru;
  }
  // Setelah putaran terakhir, kedua sisi ditukar sebelum permutasi akhir
  return keByte(permutasi(r.concat(l), FP));
}

function periksaBlok(blok) {
  if (!Buffer.isBuffer(blok) || blok.length !== UKURAN_BLOK) throw new Error('Blok DES harus 8 byte');
}

function enkripsiBlok(blok, kunci) {
  periksaBlok(blok);
  return prosesBlok(blok, buatSubkunci(kunci));
}

function dekripsiBlok(blok, kunci) {
  periksaBlok(blok);
  return prosesBlok(blok, buatSubkunci(kunci).reverse());
}

function periksaIv(iv) {
  if (!Buffer.isBuffer(iv) || iv.length !== UKURAN_BLOK) throw new Error('IV DES harus 8 byte');
}

// Mode CBC dengan padding PKCS#7: C[i] = E(P[i] XOR C[i-1]), C[0] memakai IV
function cbcEncrypt(data, kunci, iv) {
  periksaIv(iv);
  const subkunci = buatSubkunci(kunci);
  const pad = UKURAN_BLOK - (data.length % UKURAN_BLOK);
  const polos = Buffer.concat([data, Buffer.alloc(pad, pad)]);
  const keluar = Buffer.alloc(polos.length);
  let sebelumnya = iv;
  for (let i = 0; i < polos.length; i += UKURAN_BLOK) {
    const blok = Buffer.alloc(UKURAN_BLOK);
    for (let j = 0; j < UKURAN_BLOK; j++) blok[j] = polos[i + j] ^ sebelumnya[j];
    sebelumnya = prosesBlok(blok, subkunci);
    sebelumnya.copy(keluar, i);
  }
  return keluar;
}

function cbcDecrypt(data, kunci, iv) {
  periksaIv(iv);
  if (data.length === 0 || data.length % UKURAN_BLOK !== 0) {
    throw new Error('Panjang ciphertext DES harus kelipatan 8 byte');
  }
  const subkunci = buatSubkunci(kunci).reverse();
  const polos = Buffer.alloc(data.length);
  let sebelumnya = iv;
  for (let i = 0; i < data.length; i += UKURAN_BLOK) {
    const blok = data.subarray(i, i + UKURAN_BLOK);
    const dek = prosesBlok(blok, subkunci);
    for (let j = 0; j < UKURAN_BLOK; j++) polos[i + j] = dek[j] ^ sebelumnya[j];
    sebelumnya = blok;
  }
  const pad = polos[polos.length - 1];
  if (pad < 1 || pad > UKURAN_BLOK) throw new Error('Padding tidak valid (kunci salah atau data rusak)');
  for (let i = polos.length - pad; i < polos.length; i++) {
    if (polos[i] !== pad) throw new Error('Padding tidak valid (kunci salah atau data rusak)');
  }
  return polos.subarray(0, polos.length - pad);
}

module.exports = { UKURAN_BLOK, buatSubkunci, enkripsiBlok, dekripsiBlok, cbcEncrypt, cbcDecrypt };