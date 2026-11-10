const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { hitungSalt, turunkanMaster, subkunci } = require('../src/main/chat/kunciPercakapan');
const amplop = require('../src/main/chat/amplop');

const PASS = 'passphrase-bersama';

describe('kunciPercakapan', () => {
  it('salt sama untuk kedua urutan username, 16 byte, berbeda untuk pasangan lain', () => {
    expect(hitungSalt('hasan', 'budi').equals(hitungSalt('budi', 'hasan'))).toBe(true);
    expect(hitungSalt('hasan', 'budi')).toHaveLength(16);
    expect(hitungSalt('hasan', 'budi').equals(hitungSalt('hasan', 'cici'))).toBe(false);
  });

  it('kedua laptop menurunkan kunci master yang sama tanpa saling mengirim apa pun', async () => {
    const dariHasan = await turunkanMaster(PASS, 'hasan', 'budi');
    const dariBudi = await turunkanMaster(PASS, 'budi', 'hasan');
    expect(dariHasan.equals(dariBudi)).toBe(true);
    const beda = await turunkanMaster('passphrase-lain', 'hasan', 'budi');
    expect(beda.equals(dariHasan)).toBe(false);
  });

  it('subkunci: bentuk benar dan deterministik', () => {
    const master = Buffer.alloc(32, 5);
    const k = subkunci(master);
    expect(k.vigenere).toMatch(/^[A-Z]{12}$/);
    expect(k.sdes).toMatch(/^[01]{10}$/);
    expect(k.kcv).toMatch(/^[0-9A-F]{6}$/);
    expect(k.mac).toHaveLength(32);
    expect(subkunci(master)).toEqual(k);
    expect(subkunci(Buffer.alloc(32, 6)).kcv).not.toBe(k.kcv);
  });
});

describe('amplop (encrypt-then-MAC)', () => {
  const kunci = subkunci(Buffer.alloc(32, 5));
  const kunciLain = subkunci(Buffer.alloc(32, 9));
  const buat = (teks = 'Rapat jam 9') => amplop.buat({ dari: 'hasan', ke: 'budi', seq: 1, teks, kunci });
  const periksa = (a, opsi = {}) =>
    amplop.verifikasi(a, { saya: 'budi', kontak: 'hasan', kunci, seqTerakhir: 0, ...opsi });

  it('simulasi dua pihak: pesan dibuat Hasan, diverifikasi dan dibuka Budi', async () => {
    const kHasan = subkunci(await turunkanMaster(PASS, 'hasan', 'budi'));
    const kBudi = subkunci(await turunkanMaster(PASS, 'budi', 'hasan'));
    expect(kHasan.kcv).toBe(kBudi.kcv); // kode cek kunci dibandingkan lewat telepon

    const teks = 'Halo Budi \u{1F600}\nbaris kedua, PIN 1234';
    const a = amplop.buat({ dari: 'hasan', ke: 'budi', seq: 1, teks, kunci: kHasan });
    const hasil = amplop.verifikasi(a, { saya: 'budi', kontak: 'hasan', kunci: kBudi, seqTerakhir: 0 });
    expect(hasil.teks).toBe(teks);
    expect(hasil.seq).toBe(1);
  });

  it('bentuk amplop dan isi token tidak membuka teks asli', () => {
    const a = buat('RAHASIA-123');
    expect(Object.keys(a).sort()).toEqual(['dari', 'id', 'ke', 'mac', 'seq', 'token', 'v', 'waktu']);
    expect(JSON.stringify(a).includes('RAHASIA-123')).toBe(false);
    expect(a.mac).toMatch(/^[0-9a-f]{64}$/);
  });

  it('passphrase berbeda: ditolak oleh stempel keaslian sebelum dekripsi', () => {
    expect(() => periksa(buat(), { kunci: kunciLain })).toThrow(/Stempel keaslian salah/);
  });

  it('perubahan token, nomor urut, pengirim, atau waktu ditolak', () => {
    const asli = buat();
    const token = Buffer.from(asli.token, 'base64');
    token[token.length - 1] ^= 1;
    expect(() => periksa({ ...asli, token: token.toString('base64') })).toThrow(/Stempel keaslian salah/);
    expect(() => periksa({ ...asli, seq: 2 })).toThrow(/Stempel keaslian salah/);
    expect(() => periksa({ ...asli, waktu: asli.waktu + 1 })).toThrow(/Stempel keaslian salah/);
  });

  it('pesan untuk orang lain atau dari pengirim lain ditolak', () => {
    const a = buat();
    expect(() => periksa(a, { saya: 'cici' })).toThrow(/ditujukan untuk budi/);
    expect(() => periksa(a, { kontak: 'cici' })).toThrow(/Pengirim tidak sesuai/);
  });

  it('pesan lama atau yang sudah pernah diimpor ditolak (anti pengulangan)', () => {
    const a = buat();
    expect(() => periksa(a, { seqTerakhir: 1 })).toThrow(/sudah pernah diimpor/);
    expect(() => periksa(a, { seqTerakhir: 5 })).toThrow(/sudah pernah diimpor/);
    expect(periksa(a, { seqTerakhir: 0 }).seq).toBe(1);
  });

  it('berkas yang bentuknya salah ditolak dengan galat yang jelas, bukan crash', () => {
    const a = buat();
    for (const rusak of [null, 'teks', 42, {}, { ...a, v: 2 }, { ...a, seq: 1.5 }, { ...a, token: 7 }]) {
      expect(() => periksa(rusak)).toThrow(/bukan pesan SecureVault yang valid/);
    }
    expect(() => periksa({ ...a, mac: 'bukan-hex' })).toThrow(/Stempel keaslian salah/);
    expect(() => periksa({ ...a, token: 'A'.repeat(60001) })).toThrow(/terlalu besar/);
  });

  it('menolak teks kosong dan teks lebih dari 5000 karakter', () => {
    expect(() => buat('')).toThrow(/1 sampai 5000/);
    expect(() => buat('a'.repeat(5001))).toThrow(/1 sampai 5000/);
    expect(buat('a'.repeat(5000)).token.length).toBeGreaterThan(0);
  });
});

// ---- bagian yang memakai basis data (dilewati bila Node di komputer ini tidak punya node:sqlite)
let sqliteAda = true;
try {
  require('node:sqlite');
} catch {
  sqliteAda = false;
}
const grupDb = sqliteAda ? describe : describe.skip;

grupDb('percakapan di basis data', () => {
  let db, dongle, auth, session, percakapan;
  let folderKerja, berkasDb, userId;
  const KUNCI_DB = Buffer.alloc(32, 3);
  const MASTER = Buffer.alloc(32, 5);

  beforeAll(() => {
    db = require('../src/main/db/db');
    dongle = require('../src/main/security/dongle');
    auth = require('../src/main/auth/auth');
    session = require('../src/main/auth/session');
    percakapan = require('../src/main/db/percakapan');
  });

  beforeEach(async () => {
    folderKerja = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-chat-'));
    const flash = path.join(folderKerja, 'flash');
    fs.mkdirSync(flash);
    dongle.penyedia.daftarDrive = async () => [{ drive: flash, serial: 'SERIAL-AAA', model: 'Palsu' }];
    berkasDb = path.join(folderKerja, 'uji.db');
    db.tutup();
    db.buka(berkasDb);
    session.akhiri();
    await auth.daftar('hasan', 'password-kuat-1');
    userId = db.ambil().prepare('SELECT id FROM users').get().id;
  }, 20000);

  afterEach(() => {
    session.akhiri();
    db.tutup();
    fs.rmSync(folderKerja, { recursive: true, force: true });
  });

  it('buat, daftar, dan ambil: kunci master tersimpan terenkripsi', () => {
    const id = percakapan.buat(userId, 'budi', MASTER, 'ABC123', KUNCI_DB);
    expect(percakapan.daftar(userId)).toEqual([{ id, kontak: 'budi', kcv: 'ABC123', seqKirim: 0, seqTerima: 0 }]);
    expect(percakapan.ambil(userId, id, KUNCI_DB).master.equals(MASTER)).toBe(true);
    expect(fs.readFileSync(berkasDb).includes(MASTER)).toBe(false);
    expect(percakapan.cariKontak(userId, 'budi')).toBe(id);
    expect(percakapan.cariKontak(userId, 'tidak-ada')).toBe(null);
  });

  it('menolak percakapan ganda dan nama kontak yang tidak valid', () => {
    percakapan.buat(userId, 'budi', MASTER, 'ABC123', KUNCI_DB);
    expect(() => percakapan.buat(userId, 'budi', MASTER, 'ABC123', KUNCI_DB)).toThrow(/sudah ada/);
    for (const nama of ['ab', 'nama dengan spasi', 'a'.repeat(31), 'x|y', 5]) {
      expect(() => percakapan.buat(userId, nama, MASTER, 'ABC123', KUNCI_DB)).toThrow(/Nama kontak/);
    }
  });

  it('percakapan milik pengguna lain tidak bisa dibuka, kunci db salah ditolak', () => {
    const id = percakapan.buat(userId, 'budi', MASTER, 'ABC123', KUNCI_DB);
    expect(() => percakapan.ambil(999, id, KUNCI_DB)).toThrow(/tidak ditemukan/);
    expect(() => percakapan.ambil(userId, id, Buffer.alloc(32, 4))).toThrow(/rusak atau kunci tidak cocok/);
  });

  it('pesan keluar dan masuk: nomor urut naik, riwayat terbaca, isi tidak terlihat di database', () => {
    const id = percakapan.buat(userId, 'budi', MASTER, 'ABC123', KUNCI_DB);
    percakapan.catatKeluar(id, 1, 1000, true, 'PIN-RAHASIA-9876', KUNCI_DB);
    percakapan.catatMasuk(id, 1, 2000, 'balasan dari Budi', KUNCI_DB);

    const p = percakapan.ambil(userId, id, KUNCI_DB);
    expect([p.seqKirim, p.seqTerima]).toEqual([1, 1]);

    const riwayat = percakapan.riwayat(id, KUNCI_DB);
    expect(riwayat.map((r) => [r.arah, r.penting, r.teks])).toEqual([
      ['keluar', true, 'PIN-RAHASIA-9876'],
      ['masuk', false, 'balasan dari Budi'],
    ]);
    const mentah = fs.readFileSync(berkasDb);
    expect(mentah.includes('PIN-RAHASIA-9876')).toBe(false);
    expect(mentah.includes('balasan dari Budi')).toBe(false);
    expect(() => percakapan.riwayat(id, Buffer.alloc(32, 4))).toThrow(/rusak atau kunci tidak cocok/);
  });
});
