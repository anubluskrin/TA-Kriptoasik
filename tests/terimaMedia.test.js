const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PNG } = require('pngjs');
const { turunkanMaster, subkunci } = require('../src/main/chat/kunciPercakapan');
const media = require('../src/main/chat/media');

describe('terimaMedia (berkas dan gambar dari sambungan langsung)', () => {
  const KUNCI_DB = Buffer.alloc(32, 3);
  let db, percakapan, terimaMedia, namaAman;
  let folderKerja, folder, saya, kunciKirim;

  beforeAll(() => {
    db = require('../src/main/db/db');
    percakapan = require('../src/main/db/percakapan');
    ({ terimaMedia, namaAman } = require('../src/main/chat/terimaMedia'));
  });

  beforeEach(async () => {
    folderKerja = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-media-'));
    folder = path.join(folderKerja, 'unduhan');
    db.tutup();
    db.buka(path.join(folderKerja, 'uji.db'));
    const hasil = db.ambil()
      .prepare("INSERT INTO users (username, pw_salt, pw_hash, pw_iterasi, kdf_salt, dibuat) VALUES ('hasan','a','b',1,'c',1)")
      .run();
    saya = { id: Number(hasil.lastInsertRowid), username: 'hasan' };

    const masterH = await turunkanMaster('passphrase-bersama', 'hasan', 'budi');
    percakapan.buat(saya.id, 'budi', masterH, subkunci(masterH).kcv, KUNCI_DB);
    kunciKirim = subkunci(await turunkanMaster('passphrase-bersama', 'budi', 'hasan'));
  }, 20000);

  afterEach(() => {
    db.tutup();
    fs.rmSync(folderKerja, { recursive: true, force: true });
  });

  const terima = (jenis, data, rekan = 'budi') => terimaMedia({ jenis, data, rekan, saya, kunciDb: KUNCI_DB, folder });

  it('berkas: didekripsi, disimpan utuh, dan dicatat di riwayat', async () => {
    const isi = Buffer.from([1, 2, 3, 250, 251, 252]);
    const hasil = await terima('berkas', await media.bungkusBerkas('laporan.pdf', isi, kunciKirim));
    expect(fs.readFileSync(path.join(folder, 'laporan.pdf')).equals(isi)).toBe(true);
    expect(hasil.ringkasan).toMatch(/laporan\.pdf/);
    const riwayat = percakapan.riwayat(hasil.idPercakapan, KUNCI_DB);
    expect(riwayat[0].teks).toMatch(/\[berkas diterima\] laporan\.pdf \(6 byte\)/);
  });

  it('berkas bernama sama tidak menimpa yang lama', async () => {
    await terima('berkas', await media.bungkusBerkas('a.txt', Buffer.from('satu'), kunciKirim));
    await terima('berkas', await media.bungkusBerkas('a.txt', Buffer.from('dua'), kunciKirim));
    expect(fs.readFileSync(path.join(folder, 'a.txt'), 'utf8')).toBe('satu');
    expect(fs.readFileSync(path.join(folder, 'a (1).txt'), 'utf8')).toBe('dua');
  });

  it('nama berkas berbahaya dibersihkan: tidak bisa keluar dari folder tujuan', async () => {
    await terima('berkas', await media.bungkusBerkas('..\\..\\jahat.txt', Buffer.from('x'), kunciKirim));
    await terima('berkas', await media.bungkusBerkas('../../jahat2.txt', Buffer.from('x'), kunciKirim));
    expect(fs.readdirSync(folder).sort()).toEqual(['jahat.txt', 'jahat2.txt']);
    expect(namaAman('..')).toBe('berkas');
    expect(namaAman('a:b?.txt')).toBe('a_b_.txt');
  });

  it('kunci percakapan berbeda ditolak dan tidak ada berkas tersimpan', async () => {
    const kunciLain = subkunci(await turunkanMaster('passphrase-lain', 'budi', 'hasan'));
    await expect(terima('berkas', await media.bungkusBerkas('x.txt', Buffer.from('x'), kunciLain))).rejects.toThrow(/Kunci percakapan berbeda/);
    expect(fs.existsSync(folder)).toBe(false);
  });

  it('pengirim tanpa percakapan ditolak', async () => {
    await expect(terima('berkas', Buffer.from('x'), 'orang-asing')).rejects.toThrow(/belum ada percakapan dengan orang-asing/);
  });

  it('gambar: pesan tersembunyi diambil dan dicatat', async () => {
    const png = new PNG({ width: 64, height: 64 });
    for (let i = 0; i < png.data.length; i++) png.data[i] = (i * 7) % 256;
    const hasil = await media.bungkusGambar(PNG.sync.write(png), 'kode akses 4711', kunciKirim);
    const diterima = await terima('gambar', Buffer.from(hasil.png));
    expect(diterima.ringkasan).toMatch(/kode akses 4711/);
    expect(percakapan.riwayat(diterima.idPercakapan, KUNCI_DB)[0].teks).toBe('[gambar diterima] kode akses 4711');
  });

  it('jenis tidak dikenal ditolak', async () => {
    await expect(terima('video', Buffer.from('x'))).rejects.toThrow(/Jenis kiriman tidak dikenal/);
  });
});