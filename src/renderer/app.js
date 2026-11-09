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
  jalankan(() => window.api.pesanEnkripsi(elTeks.value, elKunciVig.value));
});

document.getElementById('pesan-dekripsi').addEventListener('click', () => {
  jalankan(() => window.api.pesanDekripsi(elTeks.value, elKunciVig.value));
});

document.getElementById('pesan-pindah').addEventListener('click', () => {
  elTeks.value = elHasil.value;
  elHasil.value = '';
});