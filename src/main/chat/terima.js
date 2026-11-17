const percakapan = require('../db/percakapan');
const { subkunci } = require('./kunciPercakapan');
const amplop = require('./amplop');

// Memeriksa satu amplop pesan lalu menyimpannya bila lolos. Dipakai oleh impor berkas dan sambungan langsung,
// jadi kedua jalur memakai aturan penolakan yang sama (MAC, penerima, nomor urut).
function terimaAmplop(saya, kunciDb, a) {
  if (!a || typeof a.dari !== 'string') throw new Error('berkas bukan pesan Sandikarya yang valid');
  const id = percakapan.cariKontak(saya.id, a.dari);
  if (!id) throw new Error(`belum ada percakapan dengan ${a.dari}`);

  const p = percakapan.ambil(saya.id, id, kunciDb);
  const kunci = subkunci(p.master);
  p.master.fill(0);

  const hasil = amplop.verifikasi(a, {
    saya: saya.username,
    kontak: p.kontak,
    kunci,
    seqTerakhir: p.seqTerima,
  });
  percakapan.catatMasuk(p.id, hasil.seq, hasil.waktu, hasil.teks, kunciDb);
  return { idPercakapan: p.id, dari: a.dari, seq: hasil.seq };
}

module.exports = { terimaAmplop };