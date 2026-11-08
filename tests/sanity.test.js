const { tambah } = require('../src/main/crypto/sanity');

describe('vitest siap dipakai', () => {
  it('tes dasar berjalan', () => {
    expect(1 + 1).toBe(2);
  });

  it('bisa memanggil modul dari folder crypto', () => {
    expect(tambah(2, 3)).toBe(5);
  });
});