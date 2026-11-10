const { enkripsi, dekripsi } = require('../src/main/db/dbCipher');

const KUNCI = Buffer.alloc(32, 7);

describe('dbCipher (ChaCha20-Poly1305 lewat @noble/ciphers)', () => {
  it('round-trip dan format nonce(12) + ciphertext + tag(16)', () => {
    const polos = Buffer.from('isi rahasia');
    const blob = enkripsi(KUNCI, polos, 'aad-1');
    expect(blob.length).toBe(12 + 16 + polos.length);
    expect(dekripsi(KUNCI, blob, 'aad-1').equals(polos)).toBe(true);
  });

  it('enkripsi ulang menghasilkan blob berbeda (nonce acak)', () => {
    const a = enkripsi(KUNCI, Buffer.from('sama'), 'aad');
    const b = enkripsi(KUNCI, Buffer.from('sama'), 'aad');
    expect(a.equals(b)).toBe(false);
  });

  it('kunci salah, AAD salah, dan data diubah ditolak', () => {
    const blob = enkripsi(KUNCI, Buffer.from('isi'), 'aad-1');
    expect(() => dekripsi(Buffer.alloc(32, 8), blob, 'aad-1')).toThrow(/rusak atau kunci tidak cocok/);
    expect(() => dekripsi(KUNCI, blob, 'aad-2')).toThrow(/rusak atau kunci tidak cocok/);
    for (const posisi of [0, 12, blob.length - 1]) {
      const rusak = Buffer.from(blob);
      rusak[posisi] ^= 1;
      expect(() => dekripsi(KUNCI, rusak, 'aad-1')).toThrow(/rusak atau kunci tidak cocok/);
    }
  });

  it('data yang terlalu pendek ditolak', () => {
    expect(() => dekripsi(KUNCI, Buffer.alloc(10), 'aad')).toThrow(/rusak/);
  });
});
