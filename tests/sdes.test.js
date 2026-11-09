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

describe('sdes - bagian 2: enkripsi dan dekripsi satu blok', () => {
  const KUNCI = '1010000010';

  it('vektor uji: K=1010000010, P=01110010 -> C=01110111', () => {
    const c = sdes.enkripsiBlok('01110010', KUNCI);
    expect(sdes.bitKeString(c)).toBe('01110111');
  });

  it('dekripsi mengembalikan blok asal pada vektor uji', () => {
    const p = sdes.dekripsiBlok('01110111', KUNCI);
    expect(sdes.bitKeString(p)).toBe('01110010');
  });

  it('round-trip untuk seluruh 256 kemungkinan blok', () => {
    for (let n = 0; n < 256; n++) {
      const blok = n.toString(2).padStart(8, '0');
      const c = sdes.enkripsiBlok(blok, KUNCI);
      expect(sdes.bitKeString(sdes.dekripsiBlok(c, KUNCI))).toBe(blok);
    }
  });

  it('enkripsi adalah permutasi: 256 blok menghasilkan 256 ciphertext berbeda', () => {
    const hasil = new Set();
    for (let n = 0; n < 256; n++) {
      const blok = n.toString(2).padStart(8, '0');
      hasil.add(sdes.bitKeString(sdes.enkripsiBlok(blok, KUNCI)));
    }
    expect(hasil.size).toBe(256);
  });

  it('kunci berbeda menghasilkan ciphertext berbeda', () => {
    const a = sdes.bitKeString(sdes.enkripsiBlok('01110010', '1010000010'));
    const b = sdes.bitKeString(sdes.enkripsiBlok('01110010', '1010000011'));
    expect(a).not.toBe(b);
  });

  it('menerima masukan berupa array bit maupun string', () => {
    const dariString = sdes.enkripsiBlok('01110010', KUNCI);
    const dariArray = sdes.enkripsiBlok([0, 1, 1, 1, 0, 0, 1, 0], [1, 0, 1, 0, 0, 0, 0, 0, 1, 0]);
    expect(dariArray).toEqual(dariString);
  });

  it('menolak blok atau kunci dengan panjang salah', () => {
    expect(() => sdes.enkripsiBlok('0111', KUNCI)).toThrow();
    expect(() => sdes.enkripsiBlok('01110010', '101')).toThrow();
  });

  it('cariSbox: baris dari bit 1 dan 4, kolom dari bit 2 dan 3', () => {
    // 0000 -> baris 0, kolom 0 -> S0[0][0] = 1 -> [0,1]
    expect(sdes.cariSbox(sdes.S0, [0, 0, 0, 0])).toEqual([0, 1]);
    // 1111 -> baris 3, kolom 3 -> S0[3][3] = 2 -> [1,0]
    expect(sdes.cariSbox(sdes.S0, [1, 1, 1, 1])).toEqual([1, 0]);
  });
});

describe('sdes - bagian 3: mode CBC', () => {
  const KUNCI = '1010000010';
  const IV = Buffer.from([0x5a]);

  it('round-trip untuk teks biasa', () => {
    const asal = Buffer.from('Halo, ini pesan rahasia!', 'utf8');
    const c = sdes.cbcEncrypt(asal, KUNCI, IV);
    expect(c.length).toBe(asal.length);
    expect(c.equals(asal)).toBe(false);
    expect(sdes.cbcDecrypt(c, KUNCI, IV).equals(asal)).toBe(true);
  });

  it('round-trip untuk seluruh nilai byte 0-255', () => {
    const asal = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
    const c = sdes.cbcEncrypt(asal, KUNCI, IV);
    expect(sdes.cbcDecrypt(c, KUNCI, IV).equals(asal)).toBe(true);
  });

  it('round-trip untuk data kosong', () => {
    const c = sdes.cbcEncrypt(Buffer.alloc(0), KUNCI, IV);
    expect(c.length).toBe(0);
    expect(sdes.cbcDecrypt(c, KUNCI, IV).length).toBe(0);
  });

  it('IV berbeda menghasilkan ciphertext berbeda', () => {
    const asal = Buffer.from('pesan yang sama', 'utf8');
    const a = sdes.cbcEncrypt(asal, KUNCI, Buffer.from([0x01]));
    const b = sdes.cbcEncrypt(asal, KUNCI, Buffer.from([0x02]));
    expect(a.equals(b)).toBe(false);
  });

  it('byte berulang tidak menghasilkan ciphertext berulang (beda dengan ECB)', () => {
    const asal = Buffer.alloc(16, 0x41); // 16 kali 'A'
    const c = sdes.cbcEncrypt(asal, KUNCI, IV);
    expect(new Set(c).size).toBeGreaterThan(1);
  });

  it('kunci salah tidak mengembalikan plaintext', () => {
    const asal = Buffer.from('rahasia sekali', 'utf8');
    const c = sdes.cbcEncrypt(asal, KUNCI, IV);
    const hasil = sdes.cbcDecrypt(c, '0000000001', IV);
    expect(hasil.equals(asal)).toBe(false);
  });

  it('IV salah hanya merusak byte pertama', () => {
    const asal = Buffer.from('abcdefgh', 'utf8');
    const c = sdes.cbcEncrypt(asal, KUNCI, IV);
    const hasil = sdes.cbcDecrypt(c, KUNCI, Buffer.from([0x00]));
    expect(hasil.subarray(1).equals(asal.subarray(1))).toBe(true);
    expect(hasil[0]).not.toBe(asal[0]);
  });

  it('menolak data bukan Buffer dan IV yang tidak valid', () => {
    expect(() => sdes.cbcEncrypt('teks', KUNCI, IV)).toThrow(TypeError);
    expect(() => sdes.cbcEncrypt(Buffer.from('a'), KUNCI, Buffer.from([1, 2]))).toThrow();
    expect(() => sdes.cbcEncrypt(Buffer.from('a'), KUNCI, 5)).toThrow();
  });

  it('konsisten dengan enkripsiBlok untuk byte pertama', () => {
    const p = Buffer.from([0b01110010]);
    const iv = Buffer.from([0b00000000]); // XOR dengan 0 tidak mengubah apa pun
    const c = sdes.cbcEncrypt(p, KUNCI, iv);
    expect(c[0]).toBe(0b01110111); // vektor uji README
  });
});