const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const chain = require('../src/main/chain/blockchain');
const audit = require('../src/main/chain/audit');

let folder;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-audit-'));
  audit.aturLokasi(path.join(folder, 'rantai.json'));
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

describe('log audit pada blockchain', () => {
  it('blok AUDIT sah, tidak mengubah status aset, dan menolak data yang tidak valid', () => {
    const status = new Map();
    expect(() => chain.terapkan(status, { tipe: 'AUDIT', aksi: 'LOGIN_BERHASIL', pelaku: 'hasan' })).not.toThrow();
    expect(status.size).toBe(0);
    expect(() => chain.terapkan(status, { tipe: 'AUDIT', aksi: '', pelaku: 'hasan' })).toThrow();
    expect(() => chain.terapkan(status, { tipe: 'AUDIT', aksi: 'X', pelaku: '' })).toThrow();
    expect(() => chain.terapkan(status, { tipe: 'AUDIT', aksi: 'X', pelaku: 'a', rincian: 'x'.repeat(201) })).toThrow();
  });

  it('kejadian dicatat berurutan dan rantai tetap valid, bercampur dengan transaksi aset', async () => {
    await audit.catat('LOGIN_BERHASIL', 'hasan');
    await audit.tambahBlok({ tipe: 'REGISTER', idAset: 'A1', nama: 'Model mobil', pemilik: 'hasan' });
    await audit.catat('PESAN_DIKIRIM', 'hasan', 'percakapan #1');
    const rantai = await audit.bacaRantai();
    expect(rantai).toHaveLength(4);
    expect(rantai.slice(1).map((b) => b.data.aksi || b.data.tipe)).toEqual(['LOGIN_BERHASIL', 'REGISTER', 'PESAN_DIKIRIM']);
    expect(chain.validasiRantai(rantai)).toEqual({ valid: true });
    expect(chain.daftarAset(rantai)).toEqual([{ idAset: 'A1', nama: 'Model mobil', pemilik: 'hasan' }]);
  }, 20000);

  it('banyak kejadian sekaligus tidak saling menimpa dan urutannya terjaga', async () => {
    await Promise.all(['A', 'B', 'C', 'D', 'E'].map((x) => audit.catat('KEJADIAN_' + x, 'u')));
    const rantai = await audit.bacaRantai();
    expect(rantai.slice(1).map((b) => b.data.aksi)).toEqual(['KEJADIAN_A', 'KEJADIAN_B', 'KEJADIAN_C', 'KEJADIAN_D', 'KEJADIAN_E']);
    expect(chain.validasiRantai(rantai).valid).toBe(true);
  }, 20000);

  it('mengubah satu catatan lama terdeteksi dan menunjuk blok yang rusak', async () => {
    await audit.catat('LOGIN_GAGAL', 'penyerang');
    await audit.catat('LOGIN_BERHASIL', 'hasan');
    await audit.catat('PESAN_DIKIRIM', 'hasan');
    const rantai = await audit.bacaRantai();
    rantai[2].data.pelaku = 'orang-lain'; // memalsukan riwayat
    const hasil = chain.validasiRantai(rantai);
    expect(hasil.valid).toBe(false);
    expect(hasil.indeksRusak).toBe(2);
  }, 20000);

  it('menghapus satu blok di tengah terdeteksi', async () => {
    await audit.catat('A1', 'u');
    await audit.catat('A2', 'u');
    await audit.catat('A3', 'u');
    const rantai = await audit.bacaRantai();
    rantai.splice(2, 1);
    expect(chain.validasiRantai(rantai).valid).toBe(false);
  }, 20000);

  it('rantai rusak menolak blok baru dan catat() tidak melempar galat', async () => {
    await audit.catat('A1', 'u');
    const rantai = await audit.bacaRantai();
    rantai[1].data.pelaku = 'palsu';
    await audit.tulisRantai(rantai);
    await expect(audit.tambahBlok({ tipe: 'AUDIT', aksi: 'A2', pelaku: 'u' })).rejects.toThrow(/Rantai rusak/);
    await expect(audit.catat('A3', 'u')).resolves.toBe(false);
  }, 20000);

  it('pelaku kosong diganti tanda strip dan rincian yang terlalu panjang dipotong', async () => {
    await audit.catat('X', '', 'r'.repeat(500));
    const [, blok] = await audit.bacaRantai();
    expect(blok.data.pelaku).toBe('-');
    expect(blok.data.rincian).toHaveLength(200);
  }, 20000);
});