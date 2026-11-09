const crypto = require('node:crypto');
const db = require('../db/db');
const session = require('./session');
const { buatHash, cocok } = require('./password');
const { turunkanKunci } = require('../crypto/keys');

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

  const h = await buatHash(password);
  const kdfSalt = crypto.randomBytes(16).toString('hex');
  db.ambil()
    .prepare(
      'INSERT INTO users (username, pw_salt, pw_hash, pw_iterasi, kdf_salt, dibuat) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(username, h.salt, h.hash, h.iterasi, kdfSalt, Date.now());
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
  const kunciMaster = await turunkanKunci(password, Buffer.from(user.kdf_salt, 'hex'));
  session.mulai({ id: user.id, username: user.username }, kunciMaster);
}

function keluar() {
  session.akhiri();
}

module.exports = { adaAkun, daftar, masuk, keluar };