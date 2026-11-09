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

// Muat rantai yang tersimpan saat aplikasi dibuka
jalankanAset(() => window.api.asetStatus());