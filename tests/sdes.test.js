const sdes = require('../src/main/crypto/sdes');

describe('sdes - bagian 1: permutasi dan subkunci', () => {
  it('bitDariString dan bitKeString saling berbalik', () => {
    const bit = sdes.bitDariString('1010000010', 10);
    expect(bit).toEqual([1, 0, 1, 0, 0, 0, 0, 0, 1, 0]);
    expect(sdes.bitKeString(bit)).toBe('1010000010');
  });

  it('bitDariString menolak panjang salah dan karakter bukan 0/1', () => {
    expect(() => sdes.bitDariString('101', 10)).toThrow();
    expect(() => sdes.bitDariString('10100000X2', 10)).toThrow();
    expect(() => sdes.bitDariString(1010000010, 10)).toThrow();
  });

  it('geserKiri melingkar', () => {
    expect(sdes.geserKiri([1, 0, 0, 0, 0], 1)).toEqual([0, 0, 0, 0, 1]);
    expect(sdes.geserKiri([1, 1, 0, 0, 0], 2)).toEqual([0, 0, 0, 1, 1]);
  });

  it('permutasi mengikuti tabel (indeks mulai dari 1)', () => {
    // P4 = [2,4,3,1] pada [a,b,c,d] -> [b,d,c,a]
    expect(sdes.permutasi([1, 0, 0, 1], sdes.P4)).toEqual([0, 1, 0, 1]);
  });

  it('IP lalu IP_INV mengembalikan data asal', () => {
    const data = [0, 1, 1, 1, 0, 0, 1, 0];
    const bolakBalik = sdes.permutasi(sdes.permutasi(data, sdes.IP), sdes.IP_INV);
    expect(bolakBalik).toEqual(data);
  });

  it('subkunci untuk kunci 1010000010 adalah K1=10100100 dan K2=01000011', () => {
    const { k1, k2 } = sdes.buatSubkunci('1010000010');
    expect(sdes.bitKeString(k1)).toBe('10100100');
    expect(sdes.bitKeString(k2)).toBe('01000011');
  });

  it('kunci sama menghasilkan subkunci sama, kunci beda menghasilkan subkunci beda', () => {
    const a = sdes.buatSubkunci('1010000010');
    const b = sdes.buatSubkunci('1010000010');
    const c = sdes.buatSubkunci('0000000001');
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('subkunci selalu 8 bit', () => {
    const { k1, k2 } = sdes.buatSubkunci('1111100000');
    expect(k1).toHaveLength(8);
    expect(k2).toHaveLength(8);
  });
});