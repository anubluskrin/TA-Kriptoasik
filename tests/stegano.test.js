const { PNG } = require('pngjs');
const stegano = require('../src/main/crypto/stegano');

const PASS = 'passphrase-uji';

// Gambar buatan: gradasi warna, alpha penuh
function buatPng(lebar, tinggi) {
  const png = new PNG({ width: lebar, height: tinggi });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = (i / 4) % 256;
    png.data[i + 1] = (i / 16) % 256;
    png.data[i + 2] = 120;
    png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

describe('stegano (LSB pada PNG)', () => {
  it('round-trip pesan dengan emoji dan baris baru', async () => {
    const asal = buatPng(100, 100);
    const pesan = 'Rapat jam 9 \u{1F600} rahasia\nbaris kedua';
    const r = await stegano.sisipkan(asal, pesan, PASS);
    expect((await stegano.ekstrak(r.png, PASS)).pesan).toBe(pesan);
  });

  it('PSNR di atas 40 dB untuk pesan pendek, dan alpha tidak berubah', async () => {
    const asal = buatPng(100, 100);
    const r = await stegano.sisipkan(asal, 'pesan pendek', PASS);
    expect(r.psnr).toBeGreaterThan(40);
    const data = PNG.sync.read(r.png).data;
    for (let i = 3; i < data.length; i += 4) expect(data[i]).toBe(255);
  });

  it('passphrase salah dan gambar tanpa pesan memberi galat yang sama', async () => {
    const asal = buatPng(100, 100);
    const r = await stegano.sisipkan(asal, 'rahasia', PASS);
    await expect(stegano.ekstrak(r.png, 'passphrase-salah')).rejects.toThrow(/Tidak ada pesan tersembunyi, atau passphrase salah/);
    await expect(stegano.ekstrak(asal, PASS)).rejects.toThrow(/Tidak ada pesan tersembunyi, atau passphrase salah/);
  });

  it('kapasitas: pesan tepat sebesar kapasitas lolos, satu byte lebih ditolak', async () => {
    const asal = buatPng(60, 60);
    const kapasitas = Math.floor((60 * 60 * 3 - 384) / 8);
    const r = await stegano.sisipkan(asal, 'a'.repeat(kapasitas), PASS);
    expect(r.kapasitas).toBe(kapasitas);
    expect((await stegano.ekstrak(r.png, PASS)).ukuranPesan).toBe(kapasitas);
    await expect(stegano.sisipkan(asal, 'a'.repeat(kapasitas + 1), PASS)).rejects.toThrow(/terlalu panjang/);
  });

  it('gambar yang diubah pada bit penyimpan pesan tidak lolos autentikasi', async () => {
    const asal = buatPng(60, 60);
    const r = await stegano.sisipkan(asal, 'pesan penting', PASS);
    const png = PNG.sync.read(r.png);
    for (let i = 0; i < png.data.length; i++) if (i % 4 !== 3) png.data[i] ^= 1; // balik semua LSB
    await expect(stegano.ekstrak(PNG.sync.write(png), PASS)).rejects.toThrow(/Tidak ada pesan tersembunyi/);
  });

  it('menolak berkas yang bukan PNG dan pesan kosong', async () => {
    await expect(stegano.sisipkan(Buffer.from('bukan png'), 'x', PASS)).rejects.toThrow(/bukan gambar PNG/);
    await expect(stegano.sisipkan(buatPng(50, 50), '', PASS)).rejects.toThrow(/tidak boleh kosong/);
  });

  it('posisiAcak: hasil tetap (nilai acuan) dan tidak ada posisi ganda', () => {
    // Nilai acuan dihitung dari implementasi larik penuh (sebelum optimasi memori).
    const a = stegano.posisiAcak(Buffer.from('kunci-emas'), 3000, 12);
    expect(Array.from(a)).toEqual([2904,1147,2209,2046,804,2087,692,707,1553,545,2543,479]);

    const b = stegano.posisiAcak(Buffer.from('kunci-emas'), 600, 40); // jalur larik penuh
    expect(Array.from(b.slice(0, 8))).toEqual([528,472,447,441,544,443,422,597]);

    const besar = stegano.posisiAcak(Buffer.from('k'), 30000, 2000);
    expect(new Set(besar).size).toBe(2000);
    expect(Math.min(...besar)).toBeGreaterThanOrEqual(384); // tidak menyentuh area header
  });
});
