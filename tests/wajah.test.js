const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Pembangkit angka acak yang hasilnya tetap (supaya tes tidak berubah-ubah)
function acak(benih) {
  let x = benih >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}
// Vektor 1024 angka seperti embedding wajah. Orang yang sama = vektor dasar + gangguan kecil.
function orang(benih) {
  const r = acak(benih);
  return Array.from({ length: 1024 }, () => r() * 2 - 1);
}
function ambilan(dasar, benih, gangguan = 0.02) {
  const r = acak(benih);
  return dasar.map((v) => v + (r() * 2 - 1) * gangguan);
}

let sqliteAda = true;
try {
  require('node:sqlite');
} catch {
  sqliteAda = false;
}

describe('wajah: perhitungan kemiripan', () => {
  const wajah = () => require('../src/main/security/wajah');
  const kemiripan = (a, b) => wajah().kemiripan(Float32Array.from(a), Float32Array.from(b));

  it('vektor yang sama bernilai 1, pengambilan orang yang sama di atas ambang, orang lain di bawahnya', () => {
    if (!sqliteAda) return; // wajah.js memuat db.js yang butuh node:sqlite
    const A = orang(1);
    expect(kemiripan(A, A)).toBe(1);
    expect(kemiripan(A, ambilan(A, 2))).toBeGreaterThanOrEqual(wajah().AMBANG);
    expect(kemiripan(A, orang(3))).toBeLessThan(wajah().AMBANG);
  });
});

const grup = sqliteAda ? describe : describe.skip;

grup('wajah: pendaftaran dan verifikasi saat login', () => {
  let db, dongle, auth, session, wajah;
  let folderKerja, berkasDb, flash;
  const PASSWORD = 'password-kuat-1';
  const A = orang(11); // wajah pemilik akun
  const B = orang(22); // wajah orang lain

  beforeAll(() => {
    db = require('../src/main/db/db');
    dongle = require('../src/main/security/dongle');
    auth = require('../src/main/auth/auth');
    session = require('../src/main/auth/session');
    wajah = require('../src/main/security/wajah');
  });

  beforeEach(async () => {
    folderKerja = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-wajah-'));
    flash = path.join(folderKerja, 'flash');
    fs.mkdirSync(flash);
    dongle.penyedia.daftarDrive = async () => [{ drive: flash, serial: 'SERIAL-AAA', model: 'Palsu' }];
    berkasDb = path.join(folderKerja, 'uji.db');
    db.tutup();
    db.buka(berkasDb);
    session.akhiri();
    await auth.daftar('hasan', PASSWORD);
    await auth.masuk('hasan', PASSWORD);
  }, 20000);

  afterEach(() => {
    session.akhiri();
    db.tutup();
    fs.rmSync(folderKerja, { recursive: true, force: true });
  });

  const daftarkanWajah = () => wajah.daftar([ambilan(A, 1), ambilan(A, 2), ambilan(A, 3)]);

  it('sebelum didaftarkan: belum terdaftar; sesudahnya templat tersimpan terenkripsi', () => {
    expect(wajah.terdaftar()).toBe(false);
    daftarkanWajah();
    expect(wajah.terdaftar()).toBe(true);
    const blob = db.ambil().prepare('SELECT wajah_embedding AS w FROM users').get().w;
    expect(blob.length).toBe(12 + 16 + 1024 * 4); // iv + tag + 1024 angka Float32
  });

  it('pendaftaran: jumlah pengambilan harus 3 sampai 5 dan wajahnya konsisten', () => {
    expect(() => wajah.daftar([ambilan(A, 1), ambilan(A, 2)])).toThrow(/3 sampai 5/);
    expect(() => wajah.daftar(Array.from({ length: 6 }, (_, i) => ambilan(A, i)))).toThrow(/3 sampai 5/);
    expect(() => wajah.daftar([ambilan(A, 1), ambilan(A, 2), B])).toThrow(/tidak konsisten/);
    expect(wajah.terdaftar()).toBe(false);
  });

  it('data wajah yang rusak ditolak (panjang salah, bukan angka, nilai di luar batas)', () => {
    const baik = [ambilan(A, 1), ambilan(A, 2), ambilan(A, 3)];
    expect(() => wajah.daftar([baik[0], baik[1], [1, 2, 3]])).toThrow(/Data wajah tidak valid/);
    expect(() => wajah.daftar([baik[0], baik[1], A.map((v, i) => (i === 5 ? NaN : v))])).toThrow(/Data wajah tidak valid/);
    expect(() => wajah.daftar([baik[0], baik[1], A.map((v, i) => (i === 5 ? 500 : v))])).toThrow(/Data wajah tidak valid/);
    expect(() => wajah.daftar([baik[0], baik[1], 'teks'])).toThrow(/Data wajah tidak valid/);
  });

  it('uji skor: wajah pemilik di atas ambang, wajah orang lain di bawah', () => {
    daftarkanWajah();
    expect(wajah.uji(ambilan(A, 9)).skor).toBeGreaterThanOrEqual(wajah.AMBANG);
    expect(wajah.uji(B).skor).toBeLessThan(wajah.AMBANG);
  });

  it('login dengan wajah: sesi tertunda sampai wajah cocok', async () => {
    daftarkanWajah();
    session.akhiri();

    await auth.masuk('hasan', PASSWORD); // password dan dongle benar
    expect(session.menungguWajah()).toBe(true);
    expect(session.sudahMasuk()).toBe(false); // gerbang IPC memakai sudahMasuk(), jadi fitur lain tetap tertutup

    const hasil = wajah.verifikasi(ambilan(A, 7));
    expect(hasil.username).toBe('hasan');
    expect(session.sudahMasuk()).toBe(true);
    expect(session.menungguWajah()).toBe(false);
  }, 20000);

  it('wajah orang lain ditolak; 5 kali gagal membatalkan login', async () => {
    daftarkanWajah();
    session.akhiri();
    await auth.masuk('hasan', PASSWORD);

    expect(() => wajah.verifikasi(B)).toThrow(/Sisa percobaan: 4/);
    expect(session.sudahMasuk()).toBe(false);
    for (let i = 0; i < 3; i++) expect(() => wajah.verifikasi(B)).toThrow(/Sisa percobaan/);
    expect(() => wajah.verifikasi(B)).toThrow(/Login dibatalkan/);

    expect(session.menungguWajah()).toBe(false); // sesi dihapus, harus mulai dari password lagi
    expect(() => wajah.verifikasi(ambilan(A, 7))).toThrow(/Tidak ada verifikasi wajah yang menunggu/);
  }, 20000);

  it('verifikasi tidak bisa dipakai tanpa melewati password dan dongle', () => {
    daftarkanWajah();
    session.akhiri();
    expect(() => wajah.verifikasi(ambilan(A, 7))).toThrow(/Tidak ada verifikasi wajah yang menunggu/);
  });

  it('tanpa wajah terdaftar, login langsung penuh; setelah wajah dihapus, login kembali tanpa wajah', async () => {
    session.akhiri();
    await auth.masuk('hasan', PASSWORD);
    expect(session.sudahMasuk()).toBe(true);

    daftarkanWajah();
    wajah.hapus();
    expect(wajah.terdaftar()).toBe(false);
    session.akhiri();
    await auth.masuk('hasan', PASSWORD);
    expect(session.sudahMasuk()).toBe(true);
  }, 20000);

  it('templat wajah tidak bisa dibuka dengan kunci master yang berbeda', () => {
    daftarkanWajah();
    session.akhiri();
    // kunci master palsu = seolah penyerang tidak tahu password atau dongle
    session.mulai({ id: 1, username: 'hasan' }, Buffer.alloc(32, 9), { tertunda: false });
    expect(() => wajah.uji(ambilan(A, 5))).toThrow();
  });
});