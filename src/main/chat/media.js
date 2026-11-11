const { enkripsiBerkas, dekripsiBerkas } = require('../crypto/fileCipher');
const stegano = require('../crypto/stegano');

// Berkas dan gambar untuk kontak memakai kunci percakapan (hasil subkunci() di kunciPercakapan.js).
//   Berkas : AES-256-GCM (format .svlt), kunci = kunci.berkas
//   Gambar : pesan dienkripsi AES-256-GCM lalu disisipkan LSB, kunci = kunci.gambar
// Kedua format sudah punya autentikasi sendiri (tag GCM), jadi berkas yang diubah atau kunci
// percakapan yang berbeda ditolak.

function bungkusBerkas(nama, isi, kunci) {
  return enkripsiBerkas(nama, isi, kunci.berkas);
}

async function bukaBerkas(data, kunci) {
  try {
    return await dekripsiBerkas(data, kunci.berkas);
  } catch (err) {
    if (/Passphrase salah/.test(err.message)) {
      throw new Error('Kunci percakapan berbeda (bukan dari kontak ini) atau berkas telah diubah');
    }
    throw err;
  }
}

function bungkusGambar(png, pesan, kunci) {
  return stegano.sisipkan(png, pesan, kunci.gambar);
}

async function bukaGambar(png, kunci) {
  try {
    return await stegano.ekstrak(png, kunci.gambar);
  } catch (err) {
    throw new Error('Tidak ada pesan untuk percakapan ini di gambar (' + err.message + ')');
  }
}

module.exports = { bungkusBerkas, bukaBerkas, bungkusGambar, bukaGambar };