const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// node:sqlite hanya ada di Node 22.5 ke atas. Bila Node di komputer ini lebih lama, tes ini dilewati
// (aplikasi tetap jalan karena memakai Node bawaan Electron).
let sqliteAda = true;
try {
  require('node:sqlite');
} catch {
  sqliteAda = false;
}
const grup = sqliteAda ? describe : describe.skip;

grup('auth, dongle, sesi, dan pesan penting (dengan flashdisk palsu)', () => {
  let db, dongle, auth, session, pesanPenting;
  let folderKerja, berkasDb, flashA, flashB;
  let drives;

  const PASSWORD = 'password-kuat-1';
  const driveA = () => ({ drive: flashA, serial: 'SERIAL-AAA', model: 'Palsu' });
  const driveB = () => ({ drive: flashB, serial: 'SERIAL-BBB', model: 'Palsu' });

  beforeAll(() => {
    db = require('../src/main/db/db');
    dongle = require('../src/main/security/dongle');
    auth = require('../src/main/auth/auth');
    session = require('../src/main/auth/session');
    pesanPenting = require('../src/main/db/pesanPenting');
  });

  beforeEach(() => {
    folderKerja = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-uji-'));
    flashA = fs.mkdirSync(path.join(folderKerja, 'flashA')) || path.join(folderKerja, 'flashA');
    flashB = fs.mkdirSync(path.join(folderKerja, 'flashB')) || path.join(folderKerja, 'flashB');
    berkasDb = path.join(folderKerja, 'uji.db');
    drives = [driveA()];
    dongle.penyedia.daftarDrive = async () => drives;
    db.tutup();
    db.buka(berkasDb);
    session.akhiri();
  });

  afterEach(() => {
    session.akhiri();
    db.tutup();
    fs.rmSync(folderKerja, { recursive: true, force: true });
  });

  const jumlahAkun = () => db.ambil().prepare('SELECT COUNT(*) AS n FROM users').get().n;

  it('daftar tanpa flashdisk ditolak dan tidak membuat akun', async () => {
    drives = [];
    await expect(auth.daftar('hasan', PASSWORD)).rejects.toThrow(/Flashdisk dongle belum terpasang/);
    expect(jumlahAkun()).toBe(0);
  });

  it('daftar menolak lebih dari satu flashdisk', async () => {
    drives = [driveA(), driveB()];
    await expect(auth.daftar('hasan', PASSWORD)).rejects.toThrow(/Terdeteksi 2 flashdisk/);
  });

  it('daftar menulis .svkey ke flashdisk dan menyimpan akun; pendaftaran lalu ditutup', async () => {
    await auth.daftar('hasan', PASSWORD);
    expect(auth.adaAkun()).toBe(true);
    const isi = JSON.parse(fs.readFileSync(path.join(flashA, '.svkey'), 'utf8'));
    expect(isi.versi).toBe(1);
    expect(isi.secret).toMatch(/^[0-9a-f]{64}$/);
    await expect(auth.daftar('lain', 'password-kuat-2')).rejects.toThrow(/pendaftaran ditutup/);
  }, 20000);

  it('flashdisk yang sudah berisi .svkey dipakai ulang, tidak ditimpa (akun kedua di folder data lain)', async () => {
    await auth.daftar('hasan', PASSWORD);
    const sebelum = fs.readFileSync(path.join(flashA, '.svkey'), 'utf8');

    // folder data kedua = basis data baru, flashdisk yang sama
    db.tutup();
    db.buka(path.join(folderKerja, 'kedua.db'));
    await auth.daftar('budi', 'password-kuat-2');
    expect(fs.readFileSync(path.join(flashA, '.svkey'), 'utf8')).toBe(sebelum);
    await auth.masuk('budi', 'password-kuat-2');
    expect(session.penggunaSaatIni().username).toBe('budi');
  }, 30000);

  it('kegagalan menulis .svkey membatalkan akun (tidak ada akun tanpa dongle)', async () => {
    drives = [{ drive: path.join(folderKerja, 'tidak-ada'), serial: 'SERIAL-AAA', model: 'Palsu' }];
    await expect(auth.daftar('hasan', PASSWORD)).rejects.toThrow(/Gagal menulis kunci ke flashdisk/);
    expect(jumlahAkun()).toBe(0);
    expect(auth.adaAkun()).toBe(false);
  }, 20000);

  it('password disimpan sebagai hash, bukan teks asli', async () => {
    await auth.daftar('hasan', PASSWORD);
    const baris = db.ambil().prepare('SELECT * FROM users').get();
    expect(baris.pw_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(baris).includes(PASSWORD)).toBe(false);
    expect(fs.readFileSync(berkasDb).includes(PASSWORD)).toBe(false);
  }, 20000);

  it('masuk dan keluar: sesi hidup lalu kunci dihapus', async () => {
    await auth.daftar('hasan', PASSWORD);
    await auth.masuk('hasan', PASSWORD);
    expect(session.sudahMasuk()).toBe(true);
    expect(session.penggunaSaatIni().username).toBe('hasan');
    expect(session.subkunci('a').equals(session.subkunci('b'))).toBe(false);
    auth.keluar();
    expect(session.sudahMasuk()).toBe(false);
    expect(() => session.subkunci('a')).toThrow(/Belum login/);
  }, 20000);

  it('masuk tanpa dongle ditolak dan TIDAK dihitung sebagai password salah', async () => {
    await auth.daftar('hasan', PASSWORD);
    drives = [];
    await expect(auth.masuk('hasan', PASSWORD)).rejects.toThrow(/Flashdisk dongle tidak terpasang/);
    expect(db.ambil().prepare('SELECT gagal FROM users').get().gagal).toBe(0);
  }, 20000);

  it('berkas .svkey yang disalin ke flashdisk lain ditolak (serial berbeda)', async () => {
    await auth.daftar('hasan', PASSWORD);
    fs.copyFileSync(path.join(flashA, '.svkey'), path.join(flashB, '.svkey'));
    drives = [driveB()];
    await expect(auth.masuk('hasan', PASSWORD)).rejects.toThrow(/bukan dongle akun ini/);
  }, 20000);

  it('username salah dan password salah memakai pesan yang sama dengan sisa percobaan', async () => {
    await auth.daftar('hasan', PASSWORD);
    await expect(auth.masuk('orang-lain', PASSWORD)).rejects.toThrow(/Username atau password salah/);
    await expect(auth.masuk('hasan', 'salah-salah-salah')).rejects.toThrow(/sisa percobaan: 2/);
  }, 20000);

  it('3 kali salah mengunci akun; password benar saat terkunci tetap ditolak', async () => {
    await auth.daftar('hasan', PASSWORD);
    await expect(auth.masuk('hasan', 'salah-1-salah')).rejects.toThrow(/sisa percobaan: 2/);
    await expect(auth.masuk('hasan', 'salah-2-salah')).rejects.toThrow(/sisa percobaan: 1/);
    await expect(auth.masuk('hasan', 'salah-3-salah')).rejects.toThrow(/dikunci 60 detik/);
    await expect(auth.masuk('hasan', PASSWORD)).rejects.toThrow(/terkunci sementara/);
    expect(session.sudahMasuk()).toBe(false);

    db.ambil().prepare('UPDATE users SET kunci_sampai = 0').run(); // seolah 60 detik berlalu
    await auth.masuk('hasan', PASSWORD);
    expect(session.sudahMasuk()).toBe(true);
  }, 30000);

  it('pesan penting: tersimpan terenkripsi, bisa dibuka, dan terlindungi dari kunci lain', async () => {
    await auth.daftar('hasan', PASSWORD);
    await auth.masuk('hasan', PASSWORD);
    const user = session.penggunaSaatIni();
    const kunci = session.subkunci('db');

    const id = pesanPenting.simpan(user.id, 'Nomor rekening', '1234-5678-RAHASIA-BANGET', kunci);
    expect(pesanPenting.daftar(user.id, kunci).map((p) => p.label)).toEqual(['Nomor rekening']);
    expect(pesanPenting.buka(user.id, id, kunci).isi).toBe('1234-5678-RAHASIA-BANGET');

    const mentah = fs.readFileSync(berkasDb);
    expect(mentah.includes('RAHASIA-BANGET')).toBe(false);
    expect(mentah.includes('Nomor rekening')).toBe(false);

    expect(() => pesanPenting.buka(user.id, id, Buffer.alloc(32, 1))).toThrow(/rusak atau kunci tidak cocok/);
    expect(() => pesanPenting.buka(999, id, kunci)).toThrow(/tidak ditemukan/);
    expect(() => pesanPenting.simpan(user.id, '', 'isi', kunci)).toThrow(/Label/);
    expect(() => pesanPenting.simpan(user.id, 'label', '', kunci)).toThrow(/Isi pesan/);
  }, 30000);

  it('pesan penting yang diubah langsung di database ditolak', async () => {
    await auth.daftar('hasan', PASSWORD);
    await auth.masuk('hasan', PASSWORD);
    const user = session.penggunaSaatIni();
    const kunci = session.subkunci('db');
    const id = pesanPenting.simpan(user.id, 'x', 'isi', kunci);

    const baris = db.ambil().prepare('SELECT cipher FROM pesan_penting WHERE id = ?').get(id);
    const rusak = Buffer.from(baris.cipher);
    rusak[rusak.length - 1] ^= 1;
    db.ambil().prepare('UPDATE pesan_penting SET cipher = ? WHERE id = ?').run(rusak, id);
    expect(() => pesanPenting.buka(user.id, id, kunci)).toThrow(/rusak atau kunci tidak cocok/);
  }, 30000);
});
