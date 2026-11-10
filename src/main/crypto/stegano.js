const crypto = require('node:crypto');
const { PNG } = require('pngjs');
const { turunkanKunci } = require('./keys');

// Steganografi LSB pada PNG (kanal R, G, B; kanal alpha tidak disentuh).
//
// Isi pesan dienkripsi dulu dengan AES-256-GCM (kunci dari passphrase), baru disisipkan.
// Tata letak bit (setiap bit disimpan di LSB satu kanal warna):
//   Header (384 bit, urut dari posisi 0): salt (16) | iv (12) | tag (16) | panjang (4)
//   Isi ciphertext: disebar di posisi acak yang ditentukan oleh kunci (HMAC-SHA256 counter)
// Tanpa passphrase yang benar, posisi bit isi tidak bisa diketahui.

const PANJANG_SALT = 16;
const PANJANG_IV = 12;
const PANJANG_TAG = 16;
const PANJANG_HEADER = PANJANG_SALT + PANJANG_IV + PANJANG_TAG + 4; // 48 byte
const BIT_HEADER = PANJANG_HEADER * 8;
const MAKS_PIKSEL = 40 * 1000 * 1000;

function bacaPng(buffer) {
  let png;
  try {
    png = PNG.sync.read(buffer);
  } catch {
    throw new Error('Berkas bukan gambar PNG yang valid');
  }
  if (png.width * png.height > MAKS_PIKSEL) throw new Error('Gambar terlalu besar');
  return png;
}

// Posisi byte RGBA ke-n yang boleh dipakai: lewati kanal alpha (setiap indeks ke-4)
function indeksKanal(n) {
  return n + Math.floor(n / 3);
}

function jumlahKanal(png) {
  return png.width * png.height * 3;
}

function kapasitasByte(png) {
  const bit = jumlahKanal(png) - BIT_HEADER;
  return bit > 0 ? Math.floor(bit / 8) : 0;
}

// Deretan posisi acak (tidak berulang) untuk `jumlah` bit isi, di luar area header.
// Pengacakan Fisher-Yates sebagian, bilangan acaknya dari HMAC-SHA256(kunciAcak, penghitung).
//
// Dua cara penyimpanan dengan hasil yang identik:
//   - pesan kecil dibanding gambar: hanya posisi yang ditukar dicatat di Map, jadi memori
//     sebanding dengan panjang pesan (gambar 40 juta piksel tidak butuh larik 480 MB);
//   - pesan besar dibanding gambar: larik penuh lebih cepat dan ukurannya tetap kecil.
function posisiAcak(kunciAcak, totalKanal, jumlah) {
  const sisa = totalKanal - BIT_HEADER;

  let penghitung = 0;
  let blok = Buffer.alloc(0);
  let posBlok = 0;
  function acak32() {
    if (posBlok + 4 > blok.length) {
      const c = Buffer.alloc(4);
      c.writeUInt32BE(penghitung++);
      blok = crypto.createHmac('sha256', kunciAcak).update(c).digest();
      posBlok = 0;
    }
    const nilai = blok.readUInt32BE(posBlok);
    posBlok += 4;
    return nilai;
  }

  if (jumlah * 8 >= sisa) {
    const peta = new Uint32Array(sisa);
    for (let i = 0; i < sisa; i++) peta[i] = BIT_HEADER + i;
    for (let i = 0; i < jumlah; i++) {
      const j = i + (acak32() % (sisa - i));
      const tmp = peta[i];
      peta[i] = peta[j];
      peta[j] = tmp;
    }
    return peta.subarray(0, jumlah);
  }

  const tertukar = new Map(); // indeks -> nilai yang sedang menempati indeks itu
  const nilaiDi = (k) => (tertukar.has(k) ? tertukar.get(k) : BIT_HEADER + k);
  const hasil = new Uint32Array(jumlah);
  for (let i = 0; i < jumlah; i++) {
    const j = i + (acak32() % (sisa - i));
    hasil[i] = nilaiDi(j);
    if (j !== i) tertukar.set(j, nilaiDi(i)); // indeks i tidak akan dibaca lagi
  }
  return hasil;
}

function tulisBit(data, n, bit) {
  const k = indeksKanal(n);
  data[k] = (data[k] & 0xfe) | bit;
}

function bacaBit(data, n) {
  return data[indeksKanal(n)] & 1;
}

function tulisBytes(data, bytes, posisiFn) {
  for (let b = 0; b < bytes.length; b++) {
    for (let i = 0; i < 8; i++) {
      tulisBit(data, posisiFn(b * 8 + i), (bytes[b] >> (7 - i)) & 1);
    }
  }
}

function bacaBytes(data, jumlahByte, posisiFn) {
  const hasil = Buffer.alloc(jumlahByte);
  for (let b = 0; b < jumlahByte; b++) {
    let nilai = 0;
    for (let i = 0; i < 8; i++) nilai = (nilai << 1) | bacaBit(data, posisiFn(b * 8 + i));
    hasil[b] = nilai;
  }
  return hasil;
}

// PSNR antara gambar asli dan gambar stego (hanya kanal R, G, B)
function hitungPsnr(asli, baru) {
  let jumlah = 0;
  let n = 0;
  for (let i = 0; i < asli.length; i++) {
    if (i % 4 === 3) continue; // lewati alpha
    const d = asli[i] - baru[i];
    jumlah += d * d;
    n++;
  }
  const mse = jumlah / n;
  if (mse === 0) return Infinity;
  return 10 * Math.log10((255 * 255) / mse);
}

async function sisipkan(bufferPng, pesan, passphrase) {
  if (typeof pesan !== 'string' || pesan.length === 0) throw new Error('Pesan tidak boleh kosong');
  const png = bacaPng(bufferPng);
  const asli = Buffer.from(png.data);

  const polos = Buffer.from(pesan, 'utf8');
  const kapasitas = kapasitasByte(png);
  if (polos.length > kapasitas) {
    throw new Error(`Pesan terlalu panjang untuk gambar ini (kapasitas ${kapasitas} byte, pesan ${polos.length} byte)`);
  }

  const salt = crypto.randomBytes(PANJANG_SALT);
  const iv = crypto.randomBytes(PANJANG_IV);
  const kunci = await turunkanKunci(passphrase, salt);

  const panjang = Buffer.alloc(4);
  panjang.writeUInt32BE(polos.length);

  const cipher = crypto.createCipheriv('aes-256-gcm', kunci, iv);
  cipher.setAAD(Buffer.concat([salt, iv, panjang]));
  const terenkripsi = Buffer.concat([cipher.update(polos), cipher.final()]);
  const tag = cipher.getAuthTag();

  const header = Buffer.concat([salt, iv, tag, panjang]);
  tulisBytes(png.data, header, (n) => n);

  const kunciAcak = crypto.createHmac('sha256', kunci).update('posisi-lsb').digest();
  const posisi = posisiAcak(kunciAcak, jumlahKanal(png), terenkripsi.length * 8);
  tulisBytes(png.data, terenkripsi, (n) => posisi[n]);

  return {
    png: PNG.sync.write(png),
    psnr: hitungPsnr(asli, png.data),
    kapasitas,
    ukuranPesan: polos.length,
    lebar: png.width,
    tinggi: png.height,
  };
}

async function ekstrak(bufferPng, passphrase) {
  const png = bacaPng(bufferPng);
  if (jumlahKanal(png) <= BIT_HEADER) throw new Error('Gambar terlalu kecil');

  const header = bacaBytes(png.data, PANJANG_HEADER, (n) => n);
  const salt = header.subarray(0, PANJANG_SALT);
  const iv = header.subarray(PANJANG_SALT, PANJANG_SALT + PANJANG_IV);
  const tag = header.subarray(PANJANG_SALT + PANJANG_IV, PANJANG_SALT + PANJANG_IV + PANJANG_TAG);
  const panjangBuf = header.subarray(PANJANG_HEADER - 4);
  const panjang = panjangBuf.readUInt32BE(0);

  const galat = 'Tidak ada pesan tersembunyi, atau passphrase salah';
  if (panjang === 0 || panjang > kapasitasByte(png)) throw new Error(galat);

  const kunci = await turunkanKunci(passphrase, salt);
  const kunciAcak = crypto.createHmac('sha256', kunci).update('posisi-lsb').digest();
  const posisi = posisiAcak(kunciAcak, jumlahKanal(png), panjang * 8);
  const terenkripsi = bacaBytes(png.data, panjang, (n) => posisi[n]);

  const decipher = crypto.createDecipheriv('aes-256-gcm', kunci, iv);
  decipher.setAAD(Buffer.concat([salt, iv, panjangBuf]));
  decipher.setAuthTag(tag);
  try {
    const polos = Buffer.concat([decipher.update(terenkripsi), decipher.final()]);
    return { pesan: polos.toString('utf8'), ukuranPesan: polos.length };
  } catch {
    throw new Error(galat);
  }
}

module.exports = { sisipkan, ekstrak, kapasitasByte, hitungPsnr, posisiAcak };