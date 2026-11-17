const fs = require('node:fs/promises');
const path = require('node:path');
const percakapan = require('../db/percakapan');
const { subkunci } = require('./kunciPercakapan');
const media = require('./media');

// Nama berkas dari lawan bicara tidak dipercaya begitu saja: ambil nama akhirnya saja dan buang karakter terlarang
function namaAman(nama) {
  const akhir = String(nama).split(/[\\/]/).pop(); // buang folder gaya Windows maupun Linux
  const bersih = akhir.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
  return bersih && bersih !== '.' && bersih !== '..' ? bersih.slice(0, 120) : 'berkas';
}

// Menulis tanpa menimpa: bila nama sudah ada, dipakai "nama (1).ext", "nama (2).ext", dan seterusnya
async function simpanUnik(folder, nama, isi) {
  const { name, ext } = path.parse(nama);
  for (let i = 0; i < 1000; i++) {
    const kandidat = path.join(folder, i === 0 ? nama : `${name} (${i})${ext}`);
    try {
      await fs.writeFile(kandidat, isi, { flag: 'wx' });
      return kandidat;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
  throw new Error('Terlalu banyak berkas dengan nama yang sama');
}

// Memproses berkas atau gambar yang masuk lewat sambungan langsung.
// Berkas didekripsi lalu disimpan ke `folder`; gambar diambil pesan rahasianya. Keduanya dicatat di riwayat.
async function terimaMedia({ jenis, data, rekan, saya, kunciDb, folder }) {
  const id = percakapan.cariKontak(saya.id, rekan);
  if (!id) throw new Error(`belum ada percakapan dengan ${rekan}`);
  const p = percakapan.ambil(saya.id, id, kunciDb);
  const kunci = subkunci(p.master);
  p.master.fill(0);

  if (jenis === 'berkas') {
    const { namaAsli, isi } = await media.bukaBerkas(data, kunci);
    await fs.mkdir(folder, { recursive: true });
    const jalur = await simpanUnik(folder, namaAman(namaAsli), isi);
    percakapan.catatCatatan(p.id, 'masuk', Date.now(), `[berkas diterima] ${path.basename(jalur)} (${isi.length} byte)`, kunciDb);
    return { idPercakapan: p.id, ringkasan: `Berkas dari ${rekan} disimpan di ${jalur}` };
  }
  if (jenis === 'gambar') {
    const { pesan } = await media.bukaGambar(data, kunci);
    percakapan.catatCatatan(p.id, 'masuk', Date.now(), `[gambar diterima] ${pesan}`, kunciDb);
    return { idPercakapan: p.id, ringkasan: `Gambar dari ${rekan} berisi pesan tersembunyi: ${pesan}` };
  }
  throw new Error('Jenis kiriman tidak dikenal');
}

module.exports = { terimaMedia, namaAman };