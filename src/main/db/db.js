const { DatabaseSync } = require('node:sqlite');

// Basis data SQLite bawaan Node (node:sqlite), tanpa pustaka tambahan.
let db = null;

const SKEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  pw_salt TEXT NOT NULL,
  pw_hash TEXT NOT NULL,
  pw_iterasi INTEGER NOT NULL,
  kdf_salt TEXT NOT NULL,
  gagal INTEGER NOT NULL DEFAULT 0,
  kunci_sampai INTEGER NOT NULL DEFAULT 0,
  dongle_tag TEXT,
  wajah_embedding BLOB,
  dibuat INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pesan_penting (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  waktu INTEGER NOT NULL,
  cipher BLOB NOT NULL
);
`;

function buka(berkas) {
  if (db) return db;
  db = new DatabaseSync(berkas);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SKEMA);
  return db;
}

function ambil() {
  if (!db) throw new Error('Basis data belum dibuka');
  return db;
}

function tutup() {
  if (db) db.close();
  db = null;
}

module.exports = { buka, ambil, tutup };