// ---------- Halaman Wajah (pendaftaran dan kalibrasi) ----------
const elVideoWajah = document.getElementById('video-wajah');
const elStatusWajah = document.getElementById('status-wajah');
const elInfoWajah = document.getElementById('info-wajah');
const elBtnKamera = document.getElementById('wajah-kamera');
const elBtnMatikan = document.getElementById('wajah-matikan');
const elBtnDaftarWajah = document.getElementById('wajah-daftar');
const elBtnUjiWajah = document.getElementById('wajah-uji');
const elBtnHapusWajah = document.getElementById('wajah-hapus');

function statusWajah(teks, sukses) {
  elStatusWajah.textContent = teks;
  elStatusWajah.className = 'status' + (sukses === true ? ' sukses' : sukses === false ? ' galat' : '');
}

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

async function muatStatusWajah() {
  const r = await window.api.wajahStatus();
  if (!r.ok) {
    elInfoWajah.textContent = 'Gagal membaca status: ' + r.galat;
    return;
  }
  elInfoWajah.textContent = r.terdaftar
    ? 'Wajah sudah terdaftar. Login akan meminta verifikasi wajah. Ambang kemiripan: ' + r.ambang
    : 'Wajah belum terdaftar. Login hanya memakai flashdisk dan password.';
}

elBtnKamera.addEventListener('click', async () => {
  try {
    statusWajah('Memuat model wajah (pertama kali bisa beberapa detik)...');
    await Wajah.muatModel();
    await Wajah.nyalakanKamera(elVideoWajah);
    statusWajah('Kamera menyala', true);
  } catch (e) {
    statusWajah('Gagal: ' + e.message, false);
  }
});

elBtnMatikan.addEventListener('click', () => {
  Wajah.matikanKamera(elVideoWajah);
  statusWajah('Kamera dimatikan');
});

elBtnDaftarWajah.addEventListener('click', async () => {
  try {
    const hasil = [];
    for (let i = 1; i <= 3; i++) {
      statusWajah(`Pengambilan ${i} dari 3. Hadapkan wajah, sedikit ubah posisi tiap kali...`);
      await tunggu(1500);
      hasil.push(await Wajah.ambilEmbedding(elVideoWajah));
    }
    const r = await window.api.wajahDaftar(hasil);
    if (!r.ok) throw new Error(r.galat);
    statusWajah('Wajah berhasil didaftarkan', true);
    muatStatusWajah();
  } catch (e) {
    statusWajah('Gagal: ' + e.message, false);
  }
});

elBtnUjiWajah.addEventListener('click', async () => {
  try {
    statusWajah('Mengambil wajah...');
    const emb = await Wajah.ambilEmbedding(elVideoWajah);
    const r = await window.api.wajahUji(emb);
    if (!r.ok) throw new Error(r.galat);
    const lolos = r.skor >= r.ambang;
    statusWajah(`Skor kemiripan ${r.skor.toFixed(2)} (ambang ${r.ambang}): ${lolos ? 'akan LOLOS' : 'akan DITOLAK'}`, lolos);
  } catch (e) {
    statusWajah('Gagal: ' + e.message, false);
  }
});

elBtnHapusWajah.addEventListener('click', async () => {
  const r = await window.api.wajahHapus();
  statusWajah(r.ok ? 'Data wajah dihapus' : 'Gagal: ' + r.galat, r.ok);
  muatStatusWajah();
});

// ---------- Login wajah (setelah password dan dongle benar) ----------
const elLoginWajah = document.getElementById('login-wajah');
const elVideoLogin = document.getElementById('video-login');
const elWajahTombol = document.getElementById('login-wajah-tombol');
const elWajahBatal = document.getElementById('login-wajah-batal');
const elWajahStatus = document.getElementById('login-wajah-status');

function statusLoginWajah(teks, sukses) {
  elWajahStatus.textContent = teks;
  elWajahStatus.className = 'status' + (sukses === true ? ' sukses' : sukses === false ? ' galat' : '');
}

async function mulaiLoginWajah() {
  elLoginWajah.classList.remove('sembunyi');
  elLoginTombol.disabled = true;
  elWajahTombol.disabled = true;
  statusLoginWajah('Memuat model wajah...');
  try {
    await Wajah.muatModel();
    await Wajah.nyalakanKamera(elVideoLogin);
    statusLoginWajah('Hadapkan wajah ke kamera, lalu klik Verifikasi wajah');
    elWajahTombol.disabled = false;
  } catch (e) {
    statusLoginWajah('Gagal: ' + e.message, false);
  }
}

elWajahTombol.addEventListener('click', async () => {
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
  await window.api.authKeluar();
  location.reload();
});