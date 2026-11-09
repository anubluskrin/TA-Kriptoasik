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