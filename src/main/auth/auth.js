const crypto = require('node:crypto');
const db = require('../db/db');
const session = require('./session');
const { buatHash, cocok } = require('./password');
const { turunkanKunci } = require('../crypto/keys');
const dongle = require('../security/dongle');

const MAKS_GAGAL = 3;
const JEDA_KUNCI_MS = 60 * 1000;

function adaAkun() {
  return db.ambil().prepare('SELECT COUNT(*) AS n FROM users').get().n > 0;
}

function periksaUsername(username) {
  if (typeof username !== 'string' || !/^[A-Za-z0-9_.-]{3,30}$/.test(username)) {
    throw new Error('Username 3 sampai 30 karakter (huruf, angka, titik, - dan _)');
  }
}

function periksaPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 100) {
    throw new Error('Password harus 8 sampai 100 karakter');
  }
}

// Akun pertama dibuat saat aplikasi pertama kali dipakai. Setelah itu pendaftaran ditutup.
async function daftar(username, password) {
  periksaUsername(username);
  periksaPassword(password);
  if (adaAkun()) throw new Error('Akun sudah ada, pendaftaran ditutup');

  const dg = await dongle.daftarkan(); // menulis .svkey ke flashdisk
  const h = await buatHash(password);
  const kdfSalt = crypto.randomBytes(16).toString('hex');
  db.ambil()
    .prepare(
      'INSERT INTO users (username, pw_salt, pw_hash, pw_iterasi, kdf_salt, dongle_tag, dibuat) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(username, h.salt, h.hash, h.iterasi, kdfSalt, dg.tag, Date.now());
  dg.secret.fill(0);
}

async function masuk(username, password) {
  periksaUsername(username);
  if (typeof password !== 'string' || password.length === 0 || password.length > 100) {
    throw new Error('Password tidak valid');
  }

  const dbAktif = db.ambil();
  const user = dbAktif.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    await buatHash(password); // samakan waktu proses dengan username yang benar
    throw new Error('Username atau password salah');
  }

  const sekarang = Date.now();
  if (user.kunci_sampai > sekarang) {
    const detik = Math.ceil((user.kunci_sampai - sekarang) / 1000);
    throw new Error(`Akun terkunci sementara. Coba lagi dalam ${detik} detik`);
  }

    // Faktor 1: dongle. Gagal di sini tidak dihitung sebagai salah password.
  const dg = await dongle.verifikasi(user.dongle_tag);
  if (!dg) throw new Error('Flashdisk dongle tidak terpasang atau bukan dongle akun ini');

  const benar = await cocok(password, { salt: user.pw_salt, hash: user.pw_hash, iterasi: user.pw_iterasi });
  
  if (!benar) {
    const gagal = user.gagal + 1;
    if (gagal >= MAKS_GAGAL) {
      dbAktif.prepare('UPDATE users SET gagal = 0, kunci_sampai = ? WHERE id = ?')
        .run(sekarang + JEDA_KUNCI_MS, user.id);
      throw new Error(`Salah ${MAKS_GAGAL} kali. Akun dikunci ${JEDA_KUNCI_MS / 1000} detik`);
    }
    dbAktif.prepare('UPDATE users SET gagal = ? WHERE id = ?').run(gagal, user.id);
    throw new Error(`Username atau password salah (sisa percobaan: ${MAKS_GAGAL - gagal})`);
  }

  dbAktif.prepare('UPDATE users SET gagal = 0, kunci_sampai = 0 WHERE id = ?').run(user.id);

    // Kunci master memerlukan password DAN rahasia di dongle
  const gabungan = password + '\u0000' + dg.secret.toString('hex');
  const kunciMaster = await turunkanKunci(gabungan, Buffer.from(user.kdf_salt, 'hex'));
  session.mulai(
    { id: user.id, username: user.username, dongle: { drive: dg.drive, serial: dg.serial } },
    kunciMaster
  );
  dg.secret.fill(0);
}

function keluar() {
  session.akhiri();
}

module.exports = { adaAkun, daftar, masuk, keluar };