const superCipher = require('../src/main/crypto/superCipher');

const KUNCI = { kunciVigenere: 'LEMON', kunciDes: '133457799BBCDFF1' };

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
    const iv1 = Buffer.alloc(8, 0x11);
    const iv2 = Buffer.alloc(8, 0x22);
    const a = superCipher.encrypt('pesan yang sama', { ...KUNCI, iv: iv1 }).hasil;
    const b = superCipher.encrypt('pesan yang sama', { ...KUNCI, iv: iv1 }).hasil;
    const c = superCipher.encrypt('pesan yang sama', { ...KUNCI, iv: iv2 }).hasil;
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('IV (8 byte) disimpan di awal token', () => {
    const iv = Buffer.alloc(8, 0xab);
    const { hasil } = superCipher.encrypt('tes', { ...KUNCI, iv });
    expect(Buffer.from(hasil, 'base64').subarray(0, 8).equals(iv)).toBe(true);
  });

  it('tahap Vigenere terlihat di rincian dan sesuai dengan vigenere.js', () => {
    const c = superCipher.encrypt('ATTACKATDAWN', KUNCI);
    const tahap1 = c.rincian.find(([label]) => label === 'Tahap 1 (Vigenere)')[1];
    expect(tahap1).toBe('LXFOPVEFRNHR');
  });

  it('kunci DES salah: ditolak atau menghasilkan teks yang berbeda', () => {
    const iv = Buffer.alloc(8, 0x5a);
    const c = superCipher.encrypt('rahasia negara', { ...KUNCI, iv });
    let hasil = null;
    try {
      hasil = superCipher.decrypt(c.hasil, { ...KUNCI, kunciDes: '0000000000000001' }).hasil;
    } catch {
      // ditolak juga termasuk perilaku yang benar
    }
    expect(hasil).not.toBe('rahasia negara');
  });

  it('kunci DES salah pada pesan yang cukup panjang ditolak dengan pesan yang jelas', () => {
    const iv = Buffer.alloc(8, 0x5a);
    const c = superCipher.encrypt('transfer 100 ribu rupiah ke rekening 12345', { ...KUNCI, iv });
    expect(() => superCipher.decrypt(c.hasil, { ...KUNCI, kunciDes: '0000000000000001' })).toThrow(
      /Dekripsi gagal/
    );
  });

  it('kunci Vigenere salah tidak mengembalikan plaintext', () => {
    const c = superCipher.encrypt('rahasia negara', KUNCI);
    const hasil = superCipher.decrypt(c.hasil, { ...KUNCI, kunciVigenere: 'APPLE' }).hasil;
    expect(hasil).not.toBe('rahasia negara');
  });

  it('ciphertext diubah: ditolak atau menghasilkan teks yang berbeda (bukan autentikasi sungguhan)', () => {
    const c = superCipher.encrypt('transfer 100 ribu', KUNCI);
    const mentah = Buffer.from(c.hasil, 'base64');
    mentah[3] ^= 0xff;
    let hasil = null;
    try {
      hasil = superCipher.decrypt(mentah.toString('base64'), KUNCI).hasil;
    } catch {
      // ditolak juga termasuk perilaku yang benar
    }
    expect(hasil).not.toBe('transfer 100 ribu');
  });

  it('menolak kunci DES yang tidak valid', () => {
    expect(() => superCipher.encrypt('x', { kunciVigenere: 'A', kunciDes: '1011' })).toThrow();
    expect(() => superCipher.encrypt('x', { kunciVigenere: 'A', kunciDes: '133457799BBCDFFZ' })).toThrow();
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