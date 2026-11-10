// Halaman Gambar
const elGambarPass = document.getElementById('gambar-passphrase');
const elGambarPesan = document.getElementById('gambar-pesan');
const elGambarHasil = document.getElementById('gambar-hasil');
const elGambarStatus = document.getElementById('gambar-status');
const elGambarRincian = document.getElementById('gambar-rincian');

function tampilkanHasilGambar(respons) {
  elGambarRincian.textContent = '';
  elGambarHasil.value = '';
  if (!respons.ok) {
    elGambarStatus.textContent = 'Gagal: ' + respons.galat;
    elGambarStatus.className = 'status galat';
    return;
  }
  if (respons.dibatalkan) {
    elGambarStatus.textContent = 'Dibatalkan';
    elGambarStatus.className = 'status';
    return;
  }
  if (respons.hasil !== undefined) elGambarHasil.value = respons.hasil;
  elGambarRincian.textContent = respons.rincian
    .map(([label, nilai]) => label.padEnd(22) + ': ' + nilai)
    .join('\n');
  elGambarStatus.textContent = 'Berhasil';
  elGambarStatus.className = 'status sukses';
}

async function jalankanGambar(aksi) {
  elGambarStatus.textContent = 'Memproses...';
  elGambarStatus.className = 'status';
  try {
    tampilkanHasilGambar(await aksi());
  } catch (err) {
    tampilkanHasilGambar({ ok: false, galat: err.message });
  }
}

document.getElementById('gambar-sisipkan').addEventListener('click', () => {
  jalankanGambar(() => window.api.gambarSisipkan(elGambarPesan.value, elGambarPass.value));
});

document.getElementById('gambar-ekstrak').addEventListener('click', () => {
  jalankanGambar(() => window.api.gambarEkstrak(elGambarPass.value));
});

// Navigasi antar halaman
const menuItems = document.querySelectorAll('.menu-item');
const pages = document.querySelectorAll('.page');

function tampilkanHalaman(nama) {
  pages.forEach((p) => p.classList.toggle('active', p.id === 'page-' + nama));
  menuItems.forEach((m) => m.classList.toggle('active', m.dataset.page === nama));
}

menuItems.forEach((m) => {
  m.addEventListener('click', () => tampilkanHalaman(m.dataset.page));
});

// Uji komunikasi ke proses main
document.getElementById('btn-ping').addEventListener('click', async () => {
  const keluaran = document.getElementById('ping-output');
  try {
    const balasan = await window.api.ping('halo dari antarmuka');
    keluaran.textContent = JSON.stringify(balasan, null, 2);
  } catch (err) {
    keluaran.textContent = 'Gagal: ' + err.message;
  }
});

// Halaman Pesan Teks
const elKunciVig = document.getElementById('pesan-kunci-vig');
const elKunciSdes = document.getElementById('pesan-kunci-sdes');
const elTeks = document.getElementById('pesan-teks');
const elHasil = document.getElementById('pesan-hasil');
const elStatus = document.getElementById('pesan-status');
const elRincian = document.getElementById('pesan-rincian');

function tampilkanHasil(respons) {
  if (!respons.ok) {
    elHasil.value = '';
    elRincian.textContent = '';
    elStatus.textContent = 'Gagal: ' + respons.galat;
    elStatus.className = 'status galat';
    return;
  }
  elHasil.value = respons.hasil;
  elRincian.textContent = respons.rincian
    .map(([label, nilai]) => label.padEnd(22) + ': ' + nilai)
    .join('\n');
  elStatus.textContent = 'Berhasil';
  elStatus.className = 'status sukses';
}

async function jalankan(aksi) {
  try {
    tampilkanHasil(await aksi());
  } catch (err) {
    tampilkanHasil({ ok: false, galat: err.message });
  }
}

document.getElementById('pesan-enkripsi').addEventListener('click', () => {
  jalankan(() => window.api.pesanEnkripsi(elTeks.value, elKunciVig.value, elKunciSdes.value));
});

document.getElementById('pesan-dekripsi').addEventListener('click', () => {
  jalankan(() => window.api.pesanDekripsi(elTeks.value, elKunciVig.value, elKunciSdes.value));
});

document.getElementById('pesan-pindah').addEventListener('click', () => {
  elTeks.value = elHasil.value;
  elHasil.value = '';
});

// Halaman File
const elFilePass = document.getElementById('file-passphrase');
const elFileStatus = document.getElementById('file-status');
const elFileRincian = document.getElementById('file-rincian');

function tampilkanHasilFile(respons) {
  elFileRincian.textContent = '';
  if (!respons.ok) {
    elFileStatus.textContent = 'Gagal: ' + respons.galat;
    elFileStatus.className = 'status galat';
    return;
  }
  if (respons.dibatalkan) {
    elFileStatus.textContent = 'Dibatalkan';
    elFileStatus.className = 'status';
    return;
  }
  elFileRincian.textContent = respons.rincian
    .map(([label, nilai]) => label.padEnd(22) + ': ' + nilai)
    .join('\n');
  elFileStatus.textContent = 'Berhasil';
  elFileStatus.className = 'status sukses';
}

async function jalankanFile(aksi) {
  elFileStatus.textContent = 'Memproses...';
  elFileStatus.className = 'status';
  try {
    tampilkanHasilFile(await aksi());
  } catch (err) {
    tampilkanHasilFile({ ok: false, galat: err.message });
  }
}

document.getElementById('file-enkripsi').addEventListener('click', () => {
  jalankanFile(() => window.api.fileEnkripsi(elFilePass.value));
});

document.getElementById('file-dekripsi').addEventListener('click', () => {
  jalankanFile(() => window.api.fileDekripsi(elFilePass.value));
});

// Halaman Aset
const elAsetStatus = document.getElementById('aset-status');
const elAsetDaftar = document.getElementById('aset-daftar');
const elAsetRantai = document.getElementById('aset-rantai');

function ringkasData(data) {
  if (data.tipe === 'REGISTER') return `REGISTER ${data.idAset} "${data.nama}" oleh ${data.pemilik}`;
  if (data.tipe === 'TRANSFER') return `TRANSFER ${data.idAset}: ${data.dari} -> ${data.ke}`;
  return data.tipe;
}

function tampilkanAset(respons) {
  if (!respons.ok) {
    elAsetStatus.textContent = 'Gagal: ' + respons.galat;
    elAsetStatus.className = 'status galat';
    return;
  }

  const { rantai, aset, validasi } = respons;

  elAsetDaftar.textContent = aset.length
    ? aset.map((a) => `${a.idAset.padEnd(12)} ${a.nama.padEnd(24)} pemilik: ${a.pemilik}`).join('\n')
    : '(belum ada aset)';

  elAsetRantai.textContent = rantai
    .map((b, i) => {
      const tandaRusak = !validasi.valid && i === validasi.indeksRusak ? '   <-- RUSAK' : '';
      return [
        `Blok #${b.index}  ${ringkasData(b.data)}${tandaRusak}`,
        `  hash       : ${b.hash}`,
        `  sebelumnya : ${b.hashSebelumnya}`,
        `  nonce      : ${b.nonce}`,
      ].join('\n');
    })
    .join('\n\n');

  const awal = respons.pesan ? respons.pesan + '. ' : '';
  if (validasi.valid) {
    elAsetStatus.textContent = `${awal}Rantai valid (${rantai.length} blok, kesulitan ${respons.kesulitan})`;
    elAsetStatus.className = 'status sukses';
  } else {
    elAsetStatus.textContent = `${awal}Rantai RUSAK pada blok #${validasi.indeksRusak}: ${validasi.alasan}`;
    elAsetStatus.className = 'status galat';
  }
}

async function jalankanAset(aksi) {
  elAsetStatus.textContent = 'Memproses...';
  elAsetStatus.className = 'status';
  try {
    tampilkanAset(await aksi());
  } catch (err) {
    tampilkanAset({ ok: false, galat: err.message });
  }
}

const nilaiAset = (id) => document.getElementById(id).value;

document.getElementById('aset-daftarkan').addEventListener('click', () => {
  jalankanAset(() =>
    window.api.asetDaftarkan(nilaiAset('aset-id-daftar'), nilaiAset('aset-nama'), nilaiAset('aset-pemilik'))
  );
});

document.getElementById('aset-transfer').addEventListener('click', () => {
  jalankanAset(() =>
    window.api.asetTransfer(nilaiAset('aset-id-transfer'), nilaiAset('aset-dari'), nilaiAset('aset-ke'))
  );
});

document.getElementById('aset-rusakkan').addEventListener('click', () => {
  jalankanAset(() =>
    window.api.asetRusakkan(parseInt(nilaiAset('aset-blok-rusak'), 10), nilaiAset('aset-nilai-palsu'))
  );
});

document.getElementById('aset-validasi').addEventListener('click', () => {
  jalankanAset(() => window.api.asetValidasi());
});

document.getElementById('aset-reset').addEventListener('click', () => {
  jalankanAset(() => window.api.asetReset());
});

// Muat rantai yang tersimpan (dipanggil setelah login berhasil)
function muatAset() {
  jalankanAset(() => window.api.asetStatus());
}

  // Halaman Pesan Penting
const elArsipLabel = document.getElementById('arsip-label');
const elArsipIsi = document.getElementById('arsip-isi');
const elArsipDaftar = document.getElementById('arsip-daftar');
const elArsipId = document.getElementById('arsip-id');
const elArsipHasil = document.getElementById('arsip-hasil');
const elArsipStatus = document.getElementById('arsip-status');

function statusArsip(teks, sukses) {
  elArsipStatus.textContent = teks;
  elArsipStatus.className = 'status ' + (sukses ? 'sukses' : 'galat');
}

async function muatArsip() {
  const r = await window.api.arsipDaftar();
  if (!r.ok) {
    statusArsip('Gagal: ' + r.galat, false);
    return;
  }
  elArsipDaftar.textContent = r.daftar.length
    ? r.daftar
        .map((p) => `#${p.id}  ${new Date(p.waktu).toLocaleString('id-ID')}  ${p.label}\n    isi mentah di DB: ${p.cipherHex}...`)
        .join('\n')
    : '(belum ada pesan)';
}

document.getElementById('arsip-simpan').addEventListener('click', async () => {
  const r = await window.api.arsipSimpan(elArsipLabel.value, elArsipIsi.value);
  if (!r.ok) {
    statusArsip('Gagal: ' + r.galat, false);
    return;
  }
  elArsipIsi.value = '';
  statusArsip('Tersimpan sebagai pesan nomor ' + r.id, true);
  muatArsip();
});

document.getElementById('arsip-buka').addEventListener('click', async () => {
  const r = await window.api.arsipBuka(parseInt(elArsipId.value, 10));
  if (!r.ok) {
    elArsipHasil.value = '';
    statusArsip('Gagal: ' + r.galat, false);
    return;
  }
  elArsipHasil.value = r.pesan.isi;
  statusArsip('Berhasil dibuka: ' + r.pesan.label, true);
});

// Login
const elLoginJudul = document.getElementById('login-judul');
const elLoginKeterangan = document.getElementById('login-keterangan');
const elLoginUser = document.getElementById('login-username');
const elLoginPass = document.getElementById('login-password');
const elLoginUlang = document.getElementById('login-ulang');
const elLoginBarisUlang = document.getElementById('login-baris-ulang');
const elLoginTombol = document.getElementById('login-tombol');
const elLoginStatus = document.getElementById('login-status');
let modeDaftar = false;

function aturModeLogin(daftar) {
  modeDaftar = daftar;
  elLoginJudul.textContent = daftar ? 'Buat akun' : 'Masuk';
  elLoginKeterangan.textContent = daftar
    ? 'Belum ada akun. Buat akun pertama untuk aplikasi ini.'
    : 'Masukkan username dan password.';
  elLoginBarisUlang.style.display = daftar ? 'block' : 'none';
  elLoginTombol.textContent = daftar ? 'Buat akun dan masuk' : 'Masuk';
}

function masukAplikasi(username) {
  document.body.classList.remove('terkunci');
  document.getElementById('nama-pengguna').textContent = 'Masuk sebagai ' + username;
  elLoginPass.value = '';
  elLoginUlang.value = '';
  elLoginStatus.textContent = '';
  tampilkanHalaman('beranda');
  muatAset();
  muatArsip();
  muatPercakapan();
}

async function prosesLogin() {
  elLoginStatus.className = 'status';
  elLoginStatus.textContent = 'Memeriksa...';

  if (modeDaftar && elLoginPass.value !== elLoginUlang.value) {
    elLoginStatus.textContent = 'Gagal: password dan pengulangannya tidak sama';
    elLoginStatus.className = 'status galat';
    return;
  }

  const r = modeDaftar
    ? await window.api.authDaftar(elLoginUser.value, elLoginPass.value)
    : await window.api.authMasuk(elLoginUser.value, elLoginPass.value);

  if (!r.ok) {
    elLoginStatus.textContent = 'Gagal: ' + r.galat;
    elLoginStatus.className = 'status galat';
    elLoginPass.value = '';
    return;
  }
  masukAplikasi(r.username);
}

elLoginTombol.addEventListener('click', prosesLogin);
[elLoginUser, elLoginPass, elLoginUlang].forEach((el) => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') prosesLogin();
  });
});

document.getElementById('btn-keluar').addEventListener('click', async () => {
  await window.api.authKeluar();
  location.reload(); // membersihkan semua data yang masih tampil di layar
});

async function periksaStatusLogin() {
  const s = await window.api.authStatus();
  if (s.ok && s.masuk) {
    masukAplikasi(s.username);
  } else {
    aturModeLogin(!(s.ok && s.adaAkun));
  }
}

periksaStatusLogin();


// Dongle
const elLoginDongle = document.getElementById('login-dongle');

async function perbaruiDongle() {
  if (document.body.classList.contains('terkunci')) {
    const r = await window.api.dongleStatus();
    if (r.ok && r.terpasang) {
      elLoginDongle.textContent = `Dongle terdeteksi (${r.drive}, ${r.model})`;
      elLoginDongle.className = 'status sukses';
    } else {
      elLoginDongle.textContent = r.ok ? 'Pasang flashdisk dongle' : 'Gagal membaca flashdisk: ' + r.galat;
      elLoginDongle.className = 'status galat';
    }
  }
  setTimeout(perbaruiDongle, 2000);
}

perbaruiDongle();

// Flashdisk dicabut saat sesi berjalan: kembali ke layar login
window.api.onDongleDicabut(() => {
  try {
    sessionStorage.setItem('pesanKunci', 'Flashdisk dongle dicabut. Aplikasi dikunci.');
  } catch {
    // penyimpanan tidak tersedia, pesan dilewati
  }
  location.reload();
});

try {
  const pesanKunci = sessionStorage.getItem('pesanKunci');
  if (pesanKunci) {
    elLoginStatus.textContent = pesanKunci;
    elLoginStatus.className = 'status galat';
    sessionStorage.removeItem('pesanKunci');
  }
} catch {
  // penyimpanan tidak tersedia, pesan dilewati
}

// Halaman Percakapan
const elChatKontak = document.getElementById('chat-kontak');
const elChatPass = document.getElementById('chat-passphrase');
const elChatPilih = document.getElementById('chat-pilih');
const elChatKcv = document.getElementById('chat-kcv');
const elChatTeks = document.getElementById('chat-teks');
const elChatPenting = document.getElementById('chat-penting');
const elChatStatus = document.getElementById('chat-status');
const elChatRiwayat = document.getElementById('chat-riwayat');
let daftarChat = [];

function statusChat(teks, sukses) {
  elChatStatus.textContent = teks;
  elChatStatus.className = 'status ' + (sukses ? 'sukses' : 'galat');
}

function idChatDipilih() {
  const id = parseInt(elChatPilih.value, 10);
  return Number.isInteger(id) ? id : null;
}

async function perbaruiRiwayat() {
  const id = idChatDipilih();
  const p = daftarChat.find((x) => x.id === id);
  if (!p) {
    elChatKcv.textContent = '';
    elChatRiwayat.textContent = '(belum ada percakapan)';
    return;
  }
  elChatKcv.textContent = `Kode cek kunci: ${p.kcv} (harus sama dengan yang tampil di laptop ${p.kontak})`;
  elChatKcv.className = 'status';

  const r = await window.api.chatRiwayat(id);
  if (!r.ok) {
    statusChat('Gagal: ' + r.galat, false);
    return;
  }
  elChatRiwayat.textContent = r.riwayat.length
    ? r.riwayat
        .map((m) => {
          const arah = m.arah === 'keluar' ? 'kirim' : 'terima';
          const waktu = new Date(m.waktu).toLocaleString('id-ID');
          return `[${arah} #${m.seq}  ${waktu}]${m.penting ? ' (penting)' : ''}\n${m.teks}`;
        })
        .join('\n\n')
    : '(belum ada pesan)';
}

async function muatPercakapan(pilihId) {
  const r = await window.api.chatDaftar();
  if (!r.ok) {
    statusChat('Gagal: ' + r.galat, false);
    return;
  }
  const sebelumnya = pilihId || idChatDipilih();
  daftarChat = r.daftar;
  elChatPilih.textContent = '';
  daftarChat.forEach((p) => {
    const opsi = document.createElement('option');
    opsi.value = String(p.id);
    opsi.textContent = `${p.kontak}  (kode cek kunci ${p.kcv})`;
    elChatPilih.appendChild(opsi);
  });
  if (daftarChat.some((p) => p.id === sebelumnya)) elChatPilih.value = String(sebelumnya);
  await perbaruiRiwayat();
}

elChatPilih.addEventListener('change', perbaruiRiwayat);

document.getElementById('chat-buat').addEventListener('click', async () => {
  statusChat('Memproses...', true);
  const r = await window.api.chatBuat(elChatKontak.value, elChatPass.value);
  if (!r.ok) {
    statusChat('Gagal: ' + r.galat, false);
    return;
  }
  const kontak = elChatKontak.value;
  elChatKontak.value = '';
  elChatPass.value = '';
  statusChat(`Percakapan dibuat. Kode cek kunci: ${r.kcv}. Bandingkan dengan kode di laptop ${kontak}.`, true);
  muatPercakapan(r.id);
});

document.getElementById('chat-kirim').addEventListener('click', async () => {
  const id = idChatDipilih();
  if (id === null) {
    statusChat('Gagal: pilih atau buat percakapan dulu', false);
    return;
  }
  const r = await window.api.chatKirim(id, elChatTeks.value, elChatPenting.checked);
  if (!r.ok) {
    statusChat('Gagal: ' + r.galat, false);
    return;
  }
  if (r.dibatalkan) {
    statusChat('Dibatalkan', true);
    return;
  }
  elChatTeks.value = '';
  elChatPenting.checked = false;
  statusChat(r.pesan, true);
  muatPercakapan(id);
});

document.getElementById('chat-impor').addEventListener('click', async () => {
  const r = await window.api.chatImpor();
  if (!r.ok) {
    statusChat('Gagal: ' + r.galat, false);
    return;
  }
  if (r.dibatalkan) {
    statusChat('Dibatalkan', true);
    return;
  }
  statusChat(r.ringkasan.join('\n'), r.diterima > 0);
  muatPercakapan();
});