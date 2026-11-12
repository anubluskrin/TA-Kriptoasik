const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Tes ini menjaga agar tampilan, preload, dan proses utama tetap "nyambung".
// Salah satu masalah yang pernah terjadi: kurung kurawal salah tempat membuat seluruh logika
// login di app.js tidak pernah berjalan, padahal sintaksnya valid.

const akar = path.join(__dirname, '..');
const baca = (...bagian) => fs.readFileSync(path.join(akar, ...bagian), 'utf8');

const html = baca('src/renderer/index.html');
const appJs = baca('src/renderer/app.js');
// Semua skrip renderer menurut urutan di index.html (kecuali pustaka Human dari node_modules)
const daftarSkrip = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((src) => !src.includes('node_modules'));
const rendererJs = daftarSkrip.map((src) => baca('src/renderer', src)).join('\n');
const preload = baca('src/preload/preload.js');

function bacaSemuaIpc() {
  const folder = path.join(akar, 'src/main/ipc');
  return fs.readdirSync(folder).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(folder, f), 'utf8')).join('\n');
}

describe('sambungan antar file', () => {
  it('semua id yang dipakai JavaScript ada di index.html', () => {
    const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    const dipakai = new Set([...(appJs + rendererJs).matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]));
    expect([...dipakai].filter((id) => !ids.has(id))).toEqual([]);
  });

  it('setiap menu punya halaman dan setiap halaman punya menu', () => {
    const menu = new Set([...html.matchAll(/data-page="([^"]+)"/g)].map((m) => m[1]));
    const halaman = new Set([...html.matchAll(/id="page-([^"]+)"/g)].map((m) => m[1]));
    expect([...menu].sort()).toEqual([...halaman].sort());
  });

  it('semua window.api yang dipakai tampilan didefinisikan di preload', () => {
    const didefinisikan = new Set([...preload.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]));
    const dipakai = new Set([...rendererJs.matchAll(/window\.api\.(\w+)/g)].map((m) => m[1]));
    expect([...dipakai].filter((nama) => !didefinisikan.has(nama))).toEqual([]);
  });

  it('semua kanal di preload punya handler di proses utama, dan sebaliknya', () => {
    const kanalPreload = new Set([...preload.matchAll(/invoke\('([^']+)'/g)].map((m) => m[1]));
    const kanalMain = new Set([...bacaSemuaIpc().matchAll(/ipcMain\.handle\('([^']+)'/g)].map((m) => m[1]));
    expect([...kanalPreload].filter((k) => !kanalMain.has(k))).toEqual([]);
    expect([...kanalMain].filter((k) => !kanalPreload.has(k))).toEqual([]);
  });

  it('semua kanal terlindungi gerbang login, kecuali yang memang harus terbuka', () => {
    const gerbang = baca('src/main/ipc/gerbang.js');
    const terbuka = [...gerbang.match(/TERBUKA = new Set\(\[(.*?)\]\)/s)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(terbuka.sort()).toEqual(['app:ping', 'auth:batalDaftar', 'auth:daftar', 'auth:daftarWajah', 'auth:keluar', 'auth:masuk', 'auth:selesaiDaftarWajah', 'auth:status', 'auth:ujiWajah', 'auth:wajah', 'dongle:status']);
  });
});

describe('app.js dijalankan dengan DOM tiruan', () => {
  function jalankanApp({ adaAkun = true } = {}) {
    const panggilan = [];
    const pendengar = {};
    const cache = {};
    const elemen = (id) => ({
      id,
      value: '',
      textContent: '',
      className: '',
      style: {},
      dataset: {},
      classList: { toggle() {}, add() {}, remove() {}, contains: () => true },
      addEventListener(tipe, fn) {
        (pendengar[`${id}:${tipe}`] = pendengar[`${id}:${tipe}`] || []).push(fn);
      },
    });
    const document = {
      getElementById: (id) => cache[id] || (cache[id] = elemen(id)),
      querySelectorAll: () => [],
      body: { classList: { contains: () => true, remove() {}, add() {} } },
    };
    const api = new Proxy({}, {
      get: (_, nama) => (...argumen) => {
        panggilan.push([nama, ...argumen]);
        if (nama === 'authStatus') return Promise.resolve({ ok: true, adaAkun, masuk: false });
        if (nama === 'dongleStatus') return Promise.resolve({ ok: true, terpasang: true, drive: 'E:', model: 'X' });
        if (nama === 'authMasuk' || nama === 'authDaftar') return Promise.resolve({ ok: true, username: argumen[0] });
        if (nama === 'onDongleDicabut') return undefined;
        return Promise.resolve({ ok: true, daftar: [], rantai: [], aset: [], validasi: { valid: true } });
      },
    });
    const konteks = {
      document,
      window: { api },
      sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      location: { reload() {} },
      setTimeout: () => 0,
      console,
    };
    vm.createContext(konteks);
    for (const src of daftarSkrip) vm.runInContext(baca('src/renderer', src), konteks, { filename: src });
    return { panggilan, pendengar, document };
  }

  it('saat dimuat: status login diperiksa dan tombol-tombol utama punya pendengar klik', () => {
    const { panggilan, pendengar } = jalankanApp();
    expect(panggilan.some(([nama]) => nama === 'authStatus')).toBe(true);
    for (const id of ['login-tombol', 'btn-keluar', 'btn-ping', 'pesan-enkripsi', 'pesan-dekripsi', 'file-enkripsi',
      'file-dekripsi', 'gambar-sisipkan', 'gambar-ekstrak', 'aset-reset', 'arsip-simpan', 'arsip-buka',
      'login-wajah-tombol', 'login-wajah-batal', 'wajah-kamera', 'wajah-daftar', 'wajah-uji', 'wajah-hapus']) {
      expect(pendengar[`${id}:click`], `tombol ${id} tidak punya pendengar klik`).toBeTruthy();
    }
  });

  it('klik Masuk memanggil authMasuk dengan username dan password yang diisi', async () => {
    const { panggilan, pendengar, document } = jalankanApp();
    await new Promise((r) => setImmediate(r)); // beri waktu periksaStatusLogin menyelesaikan mode login
    document.getElementById('login-username').value = 'hasan';
    document.getElementById('login-password').value = 'rahasia-banget';
    await pendengar['login-tombol:click'][0]();
    const panggilanMasuk = panggilan.find(([nama]) => nama === 'authMasuk');
    expect(panggilanMasuk).toEqual(['authMasuk', 'hasan', 'rahasia-banget']);
    expect(document.getElementById('login-password').value).toBe(''); // password dibersihkan dari layar
  });

  it('akun belum ada: klik tombol memakai authDaftar, dan password yang tidak sama ditolak', async () => {
    const { panggilan, pendengar, document } = jalankanApp({ adaAkun: false });
    await new Promise((r) => setImmediate(r));
    document.getElementById('login-username').value = 'hasan';
    document.getElementById('login-password').value = 'rahasia-banget';
    document.getElementById('login-ulang').value = 'beda-sekali';
    await pendengar['login-tombol:click'][0]();
    expect(panggilan.some(([nama]) => nama === 'authDaftar')).toBe(false);
    expect(document.getElementById('login-status').textContent).toMatch(/tidak sama/);

    document.getElementById('login-ulang').value = 'rahasia-banget';
    await pendengar['login-tombol:click'][0]();
    expect(panggilan.find(([nama]) => nama === 'authDaftar')).toEqual(['authDaftar', 'hasan', 'rahasia-banget']);
  });
});
