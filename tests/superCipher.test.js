const superCipher = require('../src/main/crypto/superCipher');

const KUNCI = { kunciVigenere: 'LEMON', kunciSdes: '1010000010' };

describe('superCipher', () => {
  it('round-trip untuk teks biasa', () => {
    const c = superCipher.encrypt('Halo, ini pesan rahasia!', KUNCI);
    expect(c.hasil).not.toContain('Halo');
    expect(superCipher.decrypt(c.hasil, KUNCI).hasil).toBe('Halo, ini pesan rahasia!');
  });

  it('round-trip untuk emoji, baris baru, dan karakter non-Latin', () => {
    const asal = 'Baris 1\nBaris 2\r\n😀 selamat 🎉 日本語 é ñ\t(tab)';
    const c = superCipher.encrypt(asal, KUNCI);
    expect(superCipher.decrypt(c.hasil, KUNCI).hasil).toBe(asal);
  });

  it('round-trip untuk angka dan simbol', () => {
    const asal = 'PIN: 1234 !@#$%^&*()_+-=[]{};:,.<>/?';
    const c = superCipher.encrypt(asal, KUNCI);
    expect(superCipher.decrypt(c.hasil, KUNCI).hasil).toBe(asal);
  });

  it('round-trip untuk teks kosong dan teks panjang', () => {
    expect(superCipher.decrypt(superCipher.encrypt('', KUNCI).hasil, KUNCI).hasil).toBe('');
    const panjang = 'Lorem ipsum dolor sit amet. '.repeat(400);
    expect(superCipher.decrypt(superCipher.encrypt(panjang, KUNCI).hasil, KUNCI).hasil).toBe(panjang);
  });

  it('keluaran berupa Base64 yang valid', () => {
    const c = superCipher.encrypt('uji Base64', KUNCI);
    expect(c.hasil).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(c.hasil.length % 4).toBe(0);
  });

  it('IV yang sama memberi hasil yang sama, IV berbeda memberi hasil berbeda', () => {
    const iv1 = Buffer.from([0x11]);
    const iv2 = Buffer.from([0x22]);
    const a = superCipher.encrypt('pesan yang sama', { ...KUNCI, iv: iv1 }).hasil;
    const b = superCipher.encrypt('pesan yang sama', { ...KUNCI, iv: iv1 }).hasil;
    const c = superCipher.encrypt('pesan yang sama', { ...KUNCI, iv: iv2 }).hasil;
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('IV disimpan di byte pertama token', () => {
    const iv = Buffer.from([0xab]);
    const { hasil } = superCipher.encrypt('tes', { ...KUNCI, iv });
    expect(Buffer.from(hasil, 'base64')[0]).toBe(0xab);
  });

  it('tahap Vigenere terlihat di rincian dan sesuai dengan vigenere.js', () => {
    const c = superCipher.encrypt('ATTACKATDAWN', KUNCI);
    const tahap1 = c.rincian.find(([label]) => label === 'Tahap 1 (Vigenere)')[1];
    expect(tahap1).toBe('LXFOPVEFRNHR');
  });

  it('kunci S-DES salah tidak mengembalikan plaintext', () => {
    const iv = Buffer.from([0x5a]);
    const c = superCipher.encrypt('rahasia negara', { ...KUNCI, iv });
    const hasil = superCipher.decrypt(c.hasil, { ...KUNCI, kunciSdes: '0000000001' }).hasil;
    expect(hasil).not.toBe('rahasia negara');
  });

  it('kunci Vigenere salah tidak mengembalikan plaintext', () => {
    const c = superCipher.encrypt('rahasia negara', KUNCI);
    const hasil = superCipher.decrypt(c.hasil, { ...KUNCI, kunciVigenere: 'APPLE' }).hasil;
    expect(hasil).not.toBe('rahasia negara');
  });

  it('tidak ada autentikasi: ciphertext diubah tetap "berhasil" tetapi hasilnya sampah', () => {
    const c = superCipher.encrypt('transfer 100 ribu', KUNCI);
    const mentah = Buffer.from(c.hasil, 'base64');
    mentah[3] ^= 0xff;
    const hasil = superCipher.decrypt(mentah.toString('base64'), KUNCI).hasil;
    expect(hasil).not.toBe('transfer 100 ribu');
  });

  it('menolak kunci S-DES yang tidak valid', () => {
    expect(() => superCipher.encrypt('x', { kunciVigenere: 'A', kunciSdes: '101' })).toThrow();
    expect(() => superCipher.encrypt('x', { kunciVigenere: 'A', kunciSdes: '10100000X2' })).toThrow();
    expect(() => superCipher.encrypt('x', { kunciVigenere: 'A' })).toThrow();
  });

  it('menolak kunci Vigenere yang tidak valid', () => {
    expect(() => superCipher.encrypt('x', { ...KUNCI, kunciVigenere: 'AB C' })).toThrow();
    expect(() => superCipher.encrypt('x', { ...KUNCI, kunciVigenere: '' })).toThrow();
  });

  it('menolak ciphertext yang bukan Base64 atau kosong', () => {
    expect(() => superCipher.decrypt('!!!bukan-base64!!!', KUNCI)).toThrow();
    expect(() => superCipher.decrypt('', KUNCI)).toThrow();
    expect(() => superCipher.decrypt(123, KUNCI)).toThrow(TypeError);
  });

  it('dekripsi toleran terhadap spasi dan baris baru saat ditempel', () => {
    const c = superCipher.encrypt('salin tempel', KUNCI).hasil;
    const dengan = ' ' + c.slice(0, 4) + '\n' + c.slice(4) + ' ';
    expect(superCipher.decrypt(dengan, KUNCI).hasil).toBe('salin tempel');
  });
});