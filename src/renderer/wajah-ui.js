// ---------- Wajah di layar login: verifikasi (akun lama) dan pendaftaran (akun baru) ----------
const elLoginWajah = document.getElementById('login-wajah');
const elWajahJudul = document.getElementById('login-wajah-judul');
const elVideoLogin = document.getElementById('video-login');
const elWajahTombol = document.getElementById('login-wajah-tombol');
const elWajahUji = document.getElementById('login-wajah-uji');
const elWajahSelesai = document.getElementById('login-wajah-selesai');
const elWajahBatal = document.getElementById('login-wajah-batal');
const elWajahStatus = document.getElementById('login-wajah-status');

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

function statusLoginWajah(teks, sukses) {
  elWajahStatus.textContent = teks;
  elWajahStatus.className = 'status' + (sukses === true ? ' sukses' : sukses === false ? ' galat' : '');
}

// mode: 'verifikasi' (login akun yang sudah punya wajah) atau 'daftar' (akun baru)
let modeWajahLogin = 'verifikasi';

async function mulaiLoginWajah(mode) {
  modeWajahLogin = mode === 'daftar' ? 'daftar' : 'verifikasi';
  const daftarMode = modeWajahLogin === 'daftar';
  elWajahJudul.textContent = daftarMode ? 'Daftarkan wajah untuk akun ini' : 'Verifikasi wajah';
  elWajahTombol.textContent = daftarMode ? 'Daftarkan wajah (3 pengambilan)' : 'Verifikasi wajah';
  elWajahUji.classList.toggle('sembunyi', !daftarMode);
  elWajahSelesai.classList.toggle('sembunyi', !daftarMode);
  elWajahSelesai.disabled = true;
  elLoginWajah.classList.remove('sembunyi');
  elLoginTombol.disabled = true;
  elWajahTombol.disabled = true;
  statusLoginWajah('Memuat model wajah (pertama kali bisa beberapa detik)...');
  try {
    await Wajah.muatModel();
    await Wajah.nyalakanKamera(elVideoLogin);
    statusLoginWajah(
      daftarMode
        ? 'Hadapkan wajah ke kamera, lalu klik Daftarkan wajah'
        : 'Hadapkan wajah ke kamera, lalu klik Verifikasi wajah'
    );
    elWajahTombol.disabled = false;
  } catch (e) {
    statusLoginWajah('Gagal: ' + e.message, false);
  }
}

// Pendaftaran akun baru. Boleh diulang (daftar ulang) sebelum menekan Selesai dan masuk.
async function daftarkanWajahBaru() {
  elWajahTombol.disabled = true;
  elWajahUji.disabled = true;
  elWajahSelesai.disabled = true;
  try {
    const hasil = [];
    for (let i = 1; i <= 3; i++) {
      statusLoginWajah(`Pengambilan ${i} dari 3. Hadapkan wajah, sedikit ubah posisi tiap kali...`);
      await tunggu(1500);
      hasil.push(await Wajah.ambilEmbedding(elVideoLogin));
    }
    const r = await window.api.authDaftarWajah(hasil);
    if (!r.ok) throw new Error(r.galat);
    elWajahUji.disabled = false;
    elWajahSelesai.disabled = false;
    statusLoginWajah('Wajah tersimpan. Klik Uji skor untuk mengecek, Daftarkan wajah untuk mengulang, atau Selesai dan masuk.', true);
  } catch (e) {
    statusLoginWajah('Gagal: ' + e.message + '. Coba lagi.', false);
  }
  elWajahTombol.disabled = false;
  elWajahUji.disabled = false;
}

// Uji skor: skor wajah pemilik harus di atas ambang, wajah orang lain di bawahnya
elWajahUji.addEventListener('click', async () => {
  elWajahUji.disabled = true;
  try {
    statusLoginWajah('Mengambil wajah...');
    const emb = await Wajah.ambilEmbedding(elVideoLogin);
    const r = await window.api.authUjiWajah(emb);
    if (!r.ok) throw new Error(r.galat);
    const lolos = r.skor >= r.ambang;
    statusLoginWajah(`Skor kemiripan ${r.skor.toFixed(2)} (ambang ${r.ambang}): ${lolos ? 'akan LOLOS' : 'akan DITOLAK'}`, lolos);
  } catch (e) {
    statusLoginWajah('Gagal: ' + e.message, false);
  }
  elWajahUji.disabled = false;
});

elWajahSelesai.addEventListener('click', async () => {
  elWajahSelesai.disabled = true;
  const r = await window.api.authSelesaiDaftarWajah();
  if (!r.ok) {
    statusLoginWajah('Gagal: ' + r.galat, false);
    elWajahSelesai.disabled = false;
    return;
  }
  Wajah.matikanKamera(elVideoLogin);
  elLoginWajah.classList.add('sembunyi');
  elLoginTombol.disabled = false;
  masukAplikasi(r.username);
});

elWajahTombol.addEventListener('click', async () => {
  if (modeWajahLogin === 'daftar') {
    daftarkanWajahBaru();
    return;
  }
  elWajahTombol.disabled = true;
  statusLoginWajah('Memeriksa...');
  let emb;
  try {
    emb = await Wajah.ambilEmbedding(elVideoLogin);
  } catch (e) {
    statusLoginWajah(e.message, false);
    elWajahTombol.disabled = false;
    return;
  }
  const r = await window.api.authWajah(emb);
  if (!r.ok) {
    statusLoginWajah('Gagal: ' + r.galat, false);
    if (/dibatalkan|Tidak ada verifikasi/.test(r.galat)) {
      Wajah.matikanKamera(elVideoLogin);
      try {
        sessionStorage.setItem('pesanKunci', r.galat);
      } catch {
        // penyimpanan tidak tersedia, pesan dilewati
      }
      setTimeout(() => location.reload(), 2000);
    } else {
      elWajahTombol.disabled = false;
    }
    return;
  }
  Wajah.matikanKamera(elVideoLogin);
  elLoginWajah.classList.add('sembunyi');
  elLoginTombol.disabled = false;
  masukAplikasi(r.username);
});

elWajahBatal.addEventListener('click', async () => {
  Wajah.matikanKamera(elVideoLogin);
  // Saat mendaftar, batal berarti akun yang belum selesai dihapus
  if (modeWajahLogin === 'daftar') await window.api.authBatalDaftar();
  else await window.api.authKeluar();
  location.reload();
});