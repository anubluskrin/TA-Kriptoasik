const fs = require('node:fs/promises');
const path = require('node:path');
const chain = require('./blockchain');
const { tambang } = require('./tambang');

// Rantai audit: setiap kejadian penting menjadi satu blok { tipe: 'AUDIT', aksi, pelaku, rincian }.
// Rantai yang sama juga memuat transaksi aset (REGISTER dan TRANSFER). Isi pesan, berkas, dan password
// tidak pernah dicatat; hanya jenis kejadian, pelaku, dan keterangan singkat.

let lokasi = null; // jalur berkas rantai.json, diisi sekali saat aplikasi mulai
let antrean = Promise.resolve(); // semua penambahan blok berjalan satu per satu

function aturLokasi(jalur) {
  lokasi = jalur;
}

async function bacaRantai() {
  try {
    const rantai = JSON.parse(await fs.readFile(lokasi, 'utf8'));
    if (Array.isArray(rantai) && rantai.length > 0) return rantai;
  } catch {
    // berkas belum ada atau rusak: mulai dari blok genesis
  }
  return [chain.buatGenesis()];
}

async function tulisRantai(rantai) {
  await fs.mkdir(path.dirname(lokasi), { recursive: true });
  await fs.writeFile(lokasi, JSON.stringify(rantai, null, 2));
}

// Menambang dan menyimpan satu blok. Bila rantai sudah rusak, blok baru ditolak.
function tambahBlok(data) {
  const kerja = antrean.then(async () => {
    if (!lokasi) throw new Error('Lokasi rantai belum diatur');
    const rantai = await bacaRantai();
    if (!chain.validasiRantai(rantai).valid) {
      throw new Error('Rantai rusak, blok baru tidak bisa ditambahkan. Kembalikan isi berkas rantai.json ke aslinya, atau hapus berkas itu untuk memulai rantai baru.');
    }
    const draft = chain.siapkanBlok(rantai, data);
    const { blok, ms } = await tambang(draft);
    rantai.push(blok);
    await tulisRantai(rantai);
    return { rantai, blok, ms };
  });
  antrean = kerja.catch(() => {}); // kegagalan satu blok tidak menghentikan antrean
  return kerja;
}

// Mencatat satu kejadian tanpa menunggu dan tanpa pernah melempar galat,
// sehingga kegagalan mencatat tidak mengganggu fitur yang sedang dipakai.
function catat(aksi, pelaku, rincian) {
  const data = { tipe: 'AUDIT', aksi, pelaku: String(pelaku || '-').trim().slice(0, 60) || '-' };
  if (typeof rincian === 'string' && rincian.trim()) data.rincian = rincian.trim().slice(0, 200);
  return tambahBlok(data).then(
    () => true,
    () => false
  );
}

module.exports = { aturLokasi, bacaRantai, tulisRantai, tambahBlok, catat };