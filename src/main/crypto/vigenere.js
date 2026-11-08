const JUMLAH_HURUF = 26;
const KODE_A_BESAR = 65;
const KODE_A_KECIL = 97;

// Sisa bagi yang selalu positif (operator % di JavaScript bisa menghasilkan angka negatif)
function mod(a, n) {
  return ((a % n) + n) % n;
}

// Mengubah kunci menjadi deret pergeseran: A=0, B=1, ..., Z=25
function pergeseranKunci(kunci) {
  if (typeof kunci !== 'string') {
    throw new TypeError('Kunci harus berupa string');
  }
  if (!/^[A-Za-z]+$/.test(kunci)) {
    throw new Error('Kunci hanya boleh berisi huruf A-Z (tanpa spasi, angka, atau simbol)');
  }
  return kunci
    .toUpperCase()
    .split('')
    .map((huruf) => huruf.charCodeAt(0) - KODE_A_BESAR);
}

// arah: +1 untuk enkripsi, -1 untuk dekripsi
function proses(teks, kunci, arah) {
  if (typeof teks !== 'string') {
    throw new TypeError('Teks harus berupa string');
  }
  const geser = pergeseranKunci(kunci);

  let hasil = '';
  let posisiKunci = 0; // maju hanya ketika menemui huruf

  for (const karakter of teks) {
    const kode = karakter.charCodeAt(0);
    let dasar;

    if (kode >= 65 && kode <= 90) {
      dasar = KODE_A_BESAR;
    } else if (kode >= 97 && kode <= 122) {
      dasar = KODE_A_KECIL;
    } else {
      hasil += karakter; // angka, spasi, simbol, dan karakter lain tidak diubah
      continue;
    }

    const k = geser[posisiKunci % geser.length];
    const nomorBaru = mod(kode - dasar + arah * k, JUMLAH_HURUF);
    hasil += String.fromCharCode(dasar + nomorBaru);
    posisiKunci++;
  }

  return hasil;
}

function encrypt(plaintext, key) {
  return proses(plaintext, key, +1);
}

function decrypt(ciphertext, key) {
  return proses(ciphertext, key, -1);
}

module.exports = { encrypt, decrypt };