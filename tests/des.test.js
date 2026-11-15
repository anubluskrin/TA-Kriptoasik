const des = require('../src/main/crypto/des');

const hex = (s) => Buffer.from(s, 'hex');

describe('DES: satu blok', () => {
  it('vektor uji baku FIPS: K=133457799BBCDFF1, P=0123456789ABCDEF, C=85E813540F0AB405', () => {
    const c = des.enkripsiBlok(hex('0123456789ABCDEF'), '133457799BBCDFF1');
    expect(c.toString('hex').toUpperCase()).toBe('85E813540F0AB405');
    expect(des.dekripsiBlok(c, '133457799BBCDFF1').toString('hex').toUpperCase()).toBe('0123456789ABCDEF');
  });

  it('vektor uji kedua: K=0E329232EA6D0D73, P=8787878787878787, C=0000000000000000', () => {
    expect(des.enkripsiBlok(hex('8787878787878787'), '0E329232EA6D0D73').toString('hex')).toBe('0000000000000000');
  });

  it('menghasilkan 16 subkunci masing-masing 48 bit', () => {
    const k = des.buatSubkunci('133457799BBCDFF1');
    expect(k).toHaveLength(16);
    for (const sub of k) expect(sub).toHaveLength(48);
    // Subkunci K1 pada contoh baku: 000110 110000 001011 101111 111111 000111 000001 110010
    expect(k[0].join('')).toBe('000110110000001011101111111111000111000001110010');
  });

  it('round-trip untuk banyak blok acak', () => {
    for (let i = 0; i < 50; i++) {
      const blok = Buffer.from(Array.from({ length: 8 }, (_, j) => (i * 37 + j * 91) % 256));
      const kunci = Buffer.from(Array.from({ length: 8 }, (_, j) => (i * 53 + j * 17) % 256)).toString('hex');
      expect(des.dekripsiBlok(des.enkripsiBlok(blok, kunci), kunci).equals(blok)).toBe(true);
    }
  });

  it('menolak kunci dan blok yang tidak valid', () => {
    expect(() => des.enkripsiBlok(hex('0123456789ABCDEF'), '1234')).toThrow(/16 karakter/);
    expect(() => des.enkripsiBlok(hex('0123456789ABCDEF'), 'ZZ3457799BBCDFF1')).toThrow(/16 karakter/);
    expect(() => des.enkripsiBlok(hex('0123'), '133457799BBCDFF1')).toThrow(/8 byte/);
  });
});

describe('DES: mode CBC dengan padding', () => {
  const KUNCI = '133457799BBCDFF1';
  const IV = hex('0001020304050607');

  it('round-trip untuk panjang 0, 1, 7, 8, 9, dan 1000 byte', () => {
    for (const n of [0, 1, 7, 8, 9, 1000]) {
      const data = Buffer.from(Array.from({ length: n }, (_, i) => (i * 7) % 256));
      const c = des.cbcEncrypt(data, KUNCI, IV);
      expect(c.length % 8).toBe(0);
      expect(c.length).toBeGreaterThan(n); // selalu ada padding
      expect(des.cbcDecrypt(c, KUNCI, IV).equals(data)).toBe(true);
    }
  });

  it('IV berbeda menghasilkan ciphertext berbeda, IV sama menghasilkan hasil sama', () => {
    const data = Buffer.from('pesan yang sama');
    const a = des.cbcEncrypt(data, KUNCI, IV);
    const b = des.cbcEncrypt(data, KUNCI, IV);
    const c = des.cbcEncrypt(data, KUNCI, hex('1111111111111111'));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('blok plaintext yang sama menghasilkan ciphertext berbeda (efek CBC)', () => {
    const c = des.cbcEncrypt(Buffer.alloc(32, 0x41), KUNCI, IV);
    expect(c.subarray(0, 8).equals(c.subarray(8, 16))).toBe(false);
  });

  it('kunci salah: ditolak karena padding atau menghasilkan data berbeda', () => {
    const data = Buffer.from('rahasia negara, jangan disebar');
    const c = des.cbcEncrypt(data, KUNCI, IV);
    let hasil = null;
    try {
      hasil = des.cbcDecrypt(c, '0000000000000001', IV);
    } catch {
      // ditolak juga benar
    }
    expect(hasil === null || !hasil.equals(data)).toBe(true);
  });

  it('IV salah hanya merusak blok pertama', () => {
    const data = Buffer.from('0123456789ABCDEF0123456789ABCDEF');
    const c = des.cbcEncrypt(data, KUNCI, IV);
    const hasil = des.cbcDecrypt(c, KUNCI, hex('FFFFFFFFFFFFFFFF'));
    expect(hasil.subarray(0, 8).equals(data.subarray(0, 8))).toBe(false);
    expect(hasil.subarray(8).equals(data.subarray(8))).toBe(true);
  });

  it('menolak ciphertext yang panjangnya bukan kelipatan 8 atau kosong, dan IV yang salah ukuran', () => {
    expect(() => des.cbcDecrypt(Buffer.alloc(5), KUNCI, IV)).toThrow(/kelipatan 8/);
    expect(() => des.cbcDecrypt(Buffer.alloc(0), KUNCI, IV)).toThrow(/kelipatan 8/);
    expect(() => des.cbcEncrypt(Buffer.from('x'), KUNCI, Buffer.alloc(1))).toThrow(/8 byte/);
  });
});