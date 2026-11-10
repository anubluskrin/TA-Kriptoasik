const chain = require('../src/main/chain/blockchain');
const { tambang } = require('../src/main/chain/tambang');

// Menambang blok langsung dengan pencarian nonce (tanpa worker) agar tes cepat
function tambangCepat(draft) {
  let nonce = 0;
  let hash = chain.hitungHash({ ...draft, nonce });
  while (!hash.startsWith('0'.repeat(chain.KESULITAN))) {
    nonce++;
    hash = chain.hitungHash({ ...draft, nonce });
  }
  return { ...draft, nonce, hash };
}

function tambahBlok(rantai, data) {
  const blok = tambangCepat(chain.siapkanBlok(rantai, data));
  rantai.push(blok);
  return rantai;
}

const REG = { tipe: 'REGISTER', idAset: 'A1', nama: 'Laptop', pemilik: 'Hasan' };
const TRF = { tipe: 'TRANSFER', idAset: 'A1', dari: 'Hasan', ke: 'Budi' };

function rantaiContoh() {
  const r = [chain.buatGenesis()];
  tambahBlok(r, { ...REG });
  tambahBlok(r, { ...TRF });
  return r;
}

describe('blockchain', () => {
  it('blok genesis tetap sama setiap kali dibuat', () => {
    expect(chain.buatGenesis()).toEqual(chain.buatGenesis());
    expect(chain.buatGenesis().hashSebelumnya).toBe(chain.HASH_NOL);
  });

  it('hash tidak bergantung pada urutan kunci objek data', () => {
    const a = chain.hitungHash({ index: 1, waktu: 5, hashSebelumnya: 'x', data: { a: 1, b: 2 }, nonce: 0 });
    const b = chain.hitungHash({ index: 1, waktu: 5, hashSebelumnya: 'x', data: { b: 2, a: 1 }, nonce: 0 });
    expect(a).toBe(b);
  });

  it('rantai sah: validasi lolos dan status kepemilikan benar', () => {
    const r = rantaiContoh();
    expect(chain.validasiRantai(r)).toEqual({ valid: true });
    expect(chain.daftarAset(r)).toEqual([{ idAset: 'A1', nama: 'Laptop', pemilik: 'Budi' }]);
    for (const blok of r.slice(1)) expect(blok.hash.startsWith('000')).toBe(true);
  });

  it('aturan transaksi: transfer oleh bukan pemilik, register ganda, aset belum ada', () => {
    const r = rantaiContoh();
    expect(() => chain.siapkanBlok(r, { tipe: 'TRANSFER', idAset: 'A1', dari: 'Hasan', ke: 'Cici' })).toThrow(/bukan pemilik/);
    expect(() => chain.siapkanBlok(r, REG)).toThrow(/sudah terdaftar/);
    expect(() => chain.siapkanBlok(r, { tipe: 'TRANSFER', idAset: 'ZZ', dari: 'a', ke: 'b' })).toThrow(/belum terdaftar/);
    expect(() => chain.siapkanBlok(r, { tipe: 'TRANSFER', idAset: 'A1', dari: 'Budi', ke: 'Budi' })).toThrow(/sama/);
    expect(() => chain.siapkanBlok(r, { tipe: 'LAIN' })).toThrow(/tidak dikenal/);
    expect(() => chain.siapkanBlok(r, { ...REG, idAset: 'a b!' })).toThrow(/ID aset/);
  });

  it('data blok diubah: validasi menunjuk blok yang diubah', () => {
    const r = rantaiContoh();
    r[1].data.pemilik = 'Penyerang';
    const v = chain.validasiRantai(r);
    expect(v.valid).toBe(false);
    expect(v.indeksRusak).toBe(1);
    expect(v.alasan).toMatch(/data diubah/);
  });

  it('blok diubah lalu ditambang ulang: tautan blok berikutnya putus', () => {
    const r = rantaiContoh();
    const { index, waktu, hashSebelumnya } = r[1];
    r[1] = tambangCepat({ index, waktu, hashSebelumnya, data: { ...REG, pemilik: 'Penyerang' } });
    const v = chain.validasiRantai(r);
    expect(v.valid).toBe(false);
    expect(v.indeksRusak).toBe(2);
    expect(v.alasan).toMatch(/Tautan/);
  });

  it('proof of work tidak terpenuhi ditolak', () => {
    const r = [chain.buatGenesis()];
    const draft = chain.siapkanBlok(r, REG);
    let nonce = 0;
    let hash = chain.hitungHash({ ...draft, nonce });
    while (hash.startsWith('0')) hash = chain.hitungHash({ ...draft, nonce: ++nonce }); // hash tanpa awalan 0
    r.push({ ...draft, nonce, hash });
    const v = chain.validasiRantai(r);
    expect(v.valid).toBe(false);
    expect(v.alasan).toMatch(/Proof of work/);
  });

  it('genesis yang dipalsukan dan rantai kosong ditolak', () => {
    const r = rantaiContoh();
    r[0].data = { tipe: 'GENESIS', palsu: true };
    expect(chain.validasiRantai(r).valid).toBe(false);
    expect(chain.validasiRantai([]).valid).toBe(false);
  });

  it('nomor blok yang tidak berurutan ditolak', () => {
    const r = rantaiContoh();
    r[2].index = 5;
    const v = chain.validasiRantai(r);
    expect(v.valid).toBe(false);
    expect(v.indeksRusak).toBe(2);
  });

  it('penambangan lewat worker_threads menghasilkan blok yang sah', async () => {
    const r = [chain.buatGenesis()];
    const { blok } = await tambang(chain.siapkanBlok(r, REG));
    r.push(blok);
    expect(chain.validasiRantai(r)).toEqual({ valid: true });
  }, 20000);
});
