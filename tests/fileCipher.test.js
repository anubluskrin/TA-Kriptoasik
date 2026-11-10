const { enkripsiBerkas, dekripsiBerkas } = require('../src/main/crypto/fileCipher');

const PASS = 'passphrase-uji';

describe('fileCipher (.svlt, AES-256-GCM)', () => {
  it('round-trip untuk berkas kosong, kecil, dan 5000 byte', async () => {
    for (const ukuran of [0, 1, 5000]) {
      const isi = Buffer.alloc(ukuran, 0xab);
      const enc = await enkripsiBerkas('data.bin', isi, PASS);
      const hasil = await dekripsiBerkas(enc, PASS);
      expect(hasil.isi.equals(isi)).toBe(true);
      expect(hasil.namaAsli).toBe('data.bin');
    }
  });

  it('nama berkas dengan emoji dan spasi ikut kembali utuh', async () => {
    const enc = await enkripsiBerkas('laporan akhir \u{1F600}.pdf', Buffer.from('isi'), PASS);
    expect((await dekripsiBerkas(enc, PASS)).namaAsli).toBe('laporan akhir \u{1F600}.pdf');
  });

  it('format: diawali SVLT1 dan panjangnya sesuai', async () => {
    const isi = Buffer.alloc(100, 1);
    const enc = await enkripsiBerkas('a.txt', isi, PASS);
    expect(enc.subarray(0, 5).toString('utf8')).toBe('SVLT1');
    // magic 5 + salt 16 + iv 12 + tag 16 + panjang nama 2 + nama 5 + isi 100
    expect(enc.length).toBe(5 + 16 + 12 + 16 + 2 + 5 + 100);
  });

  it('isi asli tidak terlihat di hasil', async () => {
    const enc = await enkripsiBerkas('a.txt', Buffer.from('RAHASIA-SEKALI-123'), PASS);
    expect(enc.includes('RAHASIA-SEKALI-123')).toBe(false);
  });

  it('dua enkripsi dari isi dan passphrase sama menghasilkan berkas berbeda', async () => {
    const isi = Buffer.from('sama');
    const a = await enkripsiBerkas('a.txt', isi, PASS);
    const b = await enkripsiBerkas('a.txt', isi, PASS);
    expect(a.equals(b)).toBe(false);
  });

  it('passphrase salah ditolak', async () => {
    const enc = await enkripsiBerkas('a.txt', Buffer.from('x'), PASS);
    await expect(dekripsiBerkas(enc, 'passphrase-salah')).rejects.toThrow(/salah atau berkas telah diubah/);
  });

  it('perubahan satu bit di isi, header, atau tag ditolak', async () => {
    const enc = await enkripsiBerkas('a.txt', Buffer.alloc(200, 7), PASS);
    // 7 = salt, 22 = iv, 40 = tag, terakhir = isi
    for (const posisi of [7, 22, 40, enc.length - 1]) {
      const rusak = Buffer.from(enc);
      rusak[posisi] ^= 1;
      await expect(dekripsiBerkas(rusak, PASS)).rejects.toThrow(/salah atau berkas telah diubah/);
    }
  });

  it('berkas yang dipotong ditolak', async () => {
    const enc = await enkripsiBerkas('a.txt', Buffer.alloc(200, 7), PASS);
    await expect(dekripsiBerkas(enc.subarray(0, enc.length - 10), PASS)).rejects.toThrow();
  });

  it('menolak berkas yang bukan format .svlt', async () => {
    await expect(dekripsiBerkas(Buffer.from('bukan berkas svlt sama sekali, hanya teks biasa'), PASS)).rejects.toThrow(
      /bukan format .svlt/
    );
    await expect(dekripsiBerkas(Buffer.alloc(3), PASS)).rejects.toThrow(/bukan format .svlt/);
    await expect(dekripsiBerkas('teks', PASS)).rejects.toThrow(/bukan format .svlt/);
  });

  it('menolak masukan tidak valid', async () => {
    await expect(enkripsiBerkas('a.txt', 'bukan buffer', PASS)).rejects.toThrow(TypeError);
    await expect(enkripsiBerkas('', Buffer.from('x'), PASS)).rejects.toThrow(/Nama berkas tidak valid/);
    await expect(enkripsiBerkas('a'.repeat(300), Buffer.from('x'), PASS)).rejects.toThrow(/Nama berkas tidak valid/);
    await expect(enkripsiBerkas('a.txt', Buffer.from('x'), 'pendek')).rejects.toThrow(/Passphrase minimal 8/);
  });
});
