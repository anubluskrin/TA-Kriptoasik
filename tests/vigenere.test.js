const vigenere = require('../src/main/crypto/vigenere');

describe('vigenere (mod 26)', () => {
  it('cocok dengan contoh klasik ATTACKATDAWN + LEMON', () => {
    expect(vigenere.encrypt('ATTACKATDAWN', 'LEMON')).toBe('LXFOPVEFRNHR');
  });

  it('round-trip: dekripsi mengembalikan teks asal', () => {
    const asal = 'ATTACKATDAWN';
    const c = vigenere.encrypt(asal, 'LEMON');
    expect(vigenere.decrypt(c, 'LEMON')).toBe(asal);
  });

  it('mempertahankan huruf besar-kecil', () => {
    const asal = 'Halo Dunia';
    const c = vigenere.encrypt(asal, 'kunci');
    expect(c).not.toBe(asal);
    expect(vigenere.decrypt(c, 'kunci')).toBe(asal);
    expect(c[0]).toMatch(/[A-Z]/);
    expect(c[1]).toMatch(/[a-z]/);
  });

  it('angka, spasi, simbol, dan baris baru tidak diubah', () => {
    const asal = 'a1 b2\n!?';
    const c = vigenere.encrypt(asal, 'KEY');
    expect(c.slice(1, 3)).toBe('1 ');
    expect(c.includes('\n')).toBe(true);
    expect(vigenere.decrypt(c, 'KEY')).toBe(asal);
  });

  it('kunci tidak membedakan huruf besar-kecil', () => {
    expect(vigenere.encrypt('HELLO', 'abc')).toBe(vigenere.encrypt('HELLO', 'ABC'));
  });

  it('kunci A tidak menggeser huruf', () => {
    expect(vigenere.encrypt('HELLO', 'A')).toBe('HELLO');
  });

  it('menolak kunci kosong, berspasi, atau berangka', () => {
    expect(() => vigenere.encrypt('x', '')).toThrow();
    expect(() => vigenere.encrypt('x', 'AB C')).toThrow();
    expect(() => vigenere.encrypt('x', 'AB1')).toThrow();
  });

  it('menolak masukan bukan string', () => {
    expect(() => vigenere.encrypt(123, 'KEY')).toThrow(TypeError);
    expect(() => vigenere.encrypt('x', 123)).toThrow(TypeError);
  });
});