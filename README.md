# SecureVault (Versi JavaScript / Electron)

Aplikasi desktop kriptografi untuk Tugas Akhir Kriptografi. Satu aplikasi yang menggabungkan autentikasi berlapis (dongle flashdisk, password, biometrik wajah), super enkripsi teks (Vigenère + S-DES), enkripsi file, enkripsi basis data, steganografi gambar, blockchain sederhana, dan **komunikasi dua arah antar dua laptop**.

> Nama "SecureVault" masih sementara. Dokumen ini adalah rancangan dan dokumentasi untuk implementasi **JavaScript dengan Electron**.

**Keputusan yang sudah disepakati tim:**
- Bahasa/platform: JavaScript dengan Electron.
- Super enkripsi teks: Vigenère (**mod 26**, keputusan 9 November 2026) lalu S-DES mode CBC.
- Kesepakatan kunci antar laptop: **passphrase bersama** (kedua pengguna menyepakati passphrase di luar aplikasi), karena tidak ada algoritma klasik yang asimetris.

> **Penting:** ini harus **aplikasi desktop (Electron)**, bukan web biasa di browser. Browser tidak bisa membaca serial number flashdisk dan tidak bisa mendeteksi pencabutannya, sehingga syarat dongle tidak terpenuhi.

> **Catatan versi:** README ini sudah memuat lapisan komunikasi dan skema database terbaru. `README_PYTHON.md` dan `README_JAVA.md` belum diperbarui, jadi skema DB-nya berbeda (tabel `messages` dan tabel kontak/percakapan).

---

## Status Pengerjaan

_Diperbarui: 9 November 2026, setelah Step 1.6 (super enkripsi teks)._

Ringkasnya: fondasi kriptografi teks sudah jadi dan teruji (Vigenère, S-DES, super cipher), kerangka Electron sudah berjalan, dan halaman **Pesan Teks** sudah bisa dipakai. Login 3 faktor, database, file, steganografi, dan blockchain belum dikerjakan.

| Fase | Step | Status | Catatan |
|---|---|---|---|
| 0 | 0.1-0.3 Node, Git, proyek, jendela Electron | Selesai | |
| 0 | 0.4-0.6 Uji webcam, serial flashdisk, WebSocket | Skrip selesai | `src/renderer/webcam-test.js`, `tools/usb-serial-test.js`, `tools/ws-*.js`. Hasil uji di laptop demo belum dicatat di dokumen ini. |
| 1 | 1.1 `vitest` | Selesai | `npm test` |
| 1 | 1.2 `vigenere.js` | Selesai | **mod 26** (lihat 8.1) |
| 1 | 1.3-1.5 `sdes.js` | Selesai | Subkunci, enkripsi/dekripsi satu blok (lulus vektor uji), mode CBC |
| 1 | 1.6 `superCipher.js` | Selesai | Vigenère lalu S-DES CBC lalu Base64, IV acak 1 byte |
| 1 | 1.7-1.13 `keys`, `password`, `dbCipher`, `fileCipher`, `envelope`, `stego`, `block`/`chain` | Belum | Berikutnya: **1.7 `keys.js`** |
| 2 | 2.1-2.2 Kerangka aman, preload, IPC | Selesai | `contextIsolation`, `sandbox`, CSP, preload `contextBridge`, kanal `app:ping` |
| 2 | 2.3-2.5 SQLite, repositories, mode `--setup` | Belum | |
| 3 | 3.1-3.9 Login 3 faktor | Belum | |
| 4 | 4.1 Kerangka dashboard | Sebagian | Sidebar dan 3 halaman (Beranda, Pesan Teks, Uji Webcam) |
| 4 | 4.3 Pesan teks | Sebagian | Enkripsi/dekripsi dengan **kunci manual**. Belum: kunci percakapan, amplop ber-MAC, penyimpanan ke DB, tanda "penting" |
| 4 | 4.2, 4.4-4.8 | Belum | |
| 5, 6 | Relay, integrasi, uji, laporan | Belum | |

**Pemetaan ke kriteria dosen:**

| # | Kriteria | Status |
|---|---|---|
| 1 | Login biometrik + hanya hidup dengan dongle | Belum (baru skrip uji webcam dan serial) |
| 2 | Login memakai algoritma kriptografi | Belum |
| 3 | Pesan teks: super enkripsi | **Algoritma dan UI selesai**; belum terhubung ke kontak, kunci percakapan, dan DB |
| 4 | Pesan file: kriptografi berbeda dari teks | Belum |
| 5 | Pesan penting terenkripsi di basis data | Belum |
| 6 | Pesan gambar: steganografi | Belum |
| 7 | Aset penting: blockchain sederhana | Belum |

**Pengujian saat ini:** `npm test` menjalankan 48 tes (8 Vigenère, 25 S-DES, 15 super cipher), semuanya lulus.

**Catatan penomoran:** commit `step 1.3 dan 1.4: kerangka aplikasi dan pesan teks tahap 1` sebenarnya setara Step 2.1-2.2 dan sebagian 4.3 di `ALUR_PENGERJAAN.md`. Perbaikan susulan (ganti nama `superCipher.js`, pasang preload, rapikan `index.html`, tes Vigenère) disebut Step A1-A4. Mulai dari S-DES, penomoran kembali mengikuti `ALUR_PENGERJAAN.md`.

---

## Daftar Isi

1. [Ringkasan Fitur dan Pemetaan Kriteria](#1-ringkasan-fitur-dan-pemetaan-kriteria)
2. [Tech Stack](#2-tech-stack)
3. [Arsitektur Electron](#3-arsitektur-electron)
4. [Struktur Folder](#4-struktur-folder)
5. [Keamanan Electron](#5-keamanan-electron)
6. [Manajemen Kunci](#6-manajemen-kunci)
7. [Rancangan Modul Keamanan](#7-rancangan-modul-keamanan)
8. [Rancangan Modul Kriptografi](#8-rancangan-modul-kriptografi)
9. [Steganografi](#9-steganografi)
10. [Blockchain](#10-blockchain)
11. [Komunikasi Antar Laptop](#11-komunikasi-antar-laptop)
12. [Skema Basis Data](#12-skema-basis-data)
13. [Alur Aplikasi](#13-alur-aplikasi)
14. [Instalasi dan Menjalankan](#14-instalasi-dan-menjalankan)
15. [Rencana Pengujian](#15-rencana-pengujian)
16. [Ancaman dan Batasan](#16-ancaman-dan-batasan)
17. [Pembagian Kerja dan Jadwal](#17-pembagian-kerja-dan-jadwal)
18. [Kerangka Laporan](#18-kerangka-laporan)

---

## 1. Ringkasan Fitur dan Pemetaan Kriteria

| # | Kriteria Tugas | Solusi | Algoritma |
|---|---|---|---|
| 1 | Login biometrik + hanya hidup dengan dongle | Dongle flashdisk (serial + file kunci) dan verifikasi wajah via webcam (laptop tanpa fingerprint) | HMAC-SHA256, face embedding |
| 2 | Login memakai algoritma kriptografi | Password di-hash dengan salt | PBKDF2-HMAC-SHA256 (opsional scrypt) |
| 3 | Pesan teks: super enkripsi | Klasik + modern berurutan | Vigenère (mod 26) lalu S-DES mode CBC |
| 4 | Pesan file: kriptografi beda dari teks | Enkripsi file per-chunk dengan autentikasi | AES-256-GCM |
| 5 | Pesan penting terenkripsi di basis data | Kolom ciphertext di SQLite | ChaCha20-Poly1305 |
| 6 | Pesan gambar: steganografi | Penyisipan pesan terenkripsi ke piksel PNG | LSB dengan urutan piksel acak (seed dari kunci) |
| 7 | Aset penting: blockchain sederhana | Registrasi dan transfer kepemilikan aset | SHA-256, proof-of-work ringan, opsional Ed25519 |
| 8 | (Tambahan tim) Komunikasi 2 arah antar laptop | Kunci bersama dari passphrase; pesan dibungkus amplop ber-MAC; transport lewat tukar file dan/atau relay WebSocket | PBKDF2, HMAC-SHA256, WebSocket |

Prinsip rancangan: **setiap fitur memakai algoritma dan kunci turunan yang berbeda**, supaya mudah dijelaskan saat presentasi dan kebocoran satu kunci tidak membuka semuanya.

---

## 2. Tech Stack

| Kebutuhan | Pilihan | Catatan |
|---|---|---|
| Runtime | Node.js LTS + Electron | Electron membawa Node sendiri |
| UI | HTML + CSS + JavaScript biasa | React/Vue opsional, tidak wajib |
| Kriptografi modern | Modul bawaan `node:crypto` | `pbkdf2`, `scrypt`, `createCipheriv` (`aes-256-gcm`, `chacha20-poly1305`), HMAC, Ed25519, `randomBytes`, `timingSafeEqual` |
| Face recognition | `@vladmandic/human` (di renderer) | Alternatif: `face-api.js`. Webcam lewat `getUserMedia` |
| Deteksi drive | `drivelist` | Untuk daftar drive dan titik mount |
| Serial flashdisk | `child_process` → PowerShell (Windows) / `udevadm` (Linux) | Lihat 7.1 |
| Gambar PNG | `pngjs` (JS murni) | Alternatif: `sharp` (native, lebih cepat tapi perlu build) |
| Database | `better-sqlite3` | Native module, perlu `@electron/rebuild` |
| Komunikasi jaringan | `ws` (WebSocket) | Dipakai client (di app) dan relay (server kecil) |
| Pengujian | `vitest` atau `jest` | Modul crypto murni Node sehingga bisa diuji tanpa Electron |
| Packaging | `electron-builder` | Menghasilkan installer/`.exe` |

Contoh `package.json` (isi versi dengan rilis terbaru saat setup):

```json
{
  "name": "securevault-js",
  "main": "src/main/main.js",
  "scripts": {
    "start": "electron .",
    "setup": "electron . --setup",
    "relay": "node server/relay.js",
    "test": "vitest run",
    "rebuild": "electron-rebuild",
    "dist": "electron-builder"
  },
  "dependencies": {
    "better-sqlite3": "*",
    "drivelist": "*",
    "pngjs": "*",
    "ws": "*",
    "@vladmandic/human": "*"
  },
  "devDependencies": {
    "electron": "*",
    "electron-builder": "*",
    "@electron/rebuild": "*",
    "vitest": "*"
  }
}
```

Vigenère, S-DES, dan blockchain **ditulis sendiri** (tanpa library kriptografi) karena itulah inti penilaian.

---

## 3. Arsitektur Electron

Electron punya **dua jenis proses**. Pembagian tugas di antara keduanya adalah inti rancangan ini.

| Proses | Isi | Boleh akses |
|---|---|---|
| **Main** (Node.js) | Semua kriptografi, kunci, database, dongle, blockchain, steganografi, jaringan, sesi | Sistem file, USB, jaringan, `node:crypto`, SQLite |
| **Renderer** (Chromium) | Tampilan, webcam + ekstraksi embedding wajah | Hanya DOM dan API yang diekspos preload |
| **Preload** | Jembatan sempit antara keduanya | `contextBridge.exposeInMainWorld` dengan daftar fungsi terbatas |

**Aturan emas: kunci dan data sensitif tidak pernah berada di renderer.** Renderer hanya mengirim input (password, passphrase, teks, path file, embedding wajah) dan menerima hasil.

### 3.1 Diagram

```
┌─────────────────────── RENDERER (Chromium, tanpa Node) ────────────────────────┐
│  LoginView │ Dashboard │ Kontak/Chat │ FileView │ StegoView │ ChainView         │
│  FaceCapture (getUserMedia + Human → embedding 1 frame)                          │
└───────────────────────────────┬─────────────────────────────────────────────────┘
                                │ window.api.*  (contextBridge)
┌───────────────────────────────▼─────────────────────────────────────────────────┐
│  PRELOAD: hanya meneruskan ke ipcRenderer.invoke(channel, payload)              │
└───────────────────────────────┬─────────────────────────────────────────────────┘
                                │ IPC (invoke/handle, send untuk event)
┌───────────────────────────────▼─────────────────────────────────────────────────┐
│                          MAIN PROCESS (Node.js)                                 │
│  IPC HANDLERS  (validasi input, cek sesi)                                       │
│       │                                                                         │
│  SERVICE LAYER: AuthService │ ContactService │ ConversationService │           │
│                 MessageService │ FileService │ StegoService │ AssetService      │
│       │            │              │               │              │              │
│  ┌────▼─────┐ ┌────▼──────┐ ┌─────▼────────┐ ┌────▼─────┐ ┌──────▼───────┐     │
│  │ SECURITY │ │ CRYPTO    │ │ BLOCKCHAIN   │ │ DATA     │ │ NETWORK      │     │
│  │ dongle   │ │ vigenere  │ │ block        │ │ db       │ │ relayClient  │     │
│  │ biometric│ │ sdes      │ │ chain        │ │ repos    │ │ packageIO    │     │
│  │ password │ │ superCiph.│ │ signing      │ │ schema   │ │ (export/     │     │
│  │ keys     │ │ fileCiph. │ └──────────────┘ └──────────┘ │  import)     │     │
│  │ session  │ │ dbCipher  │                                └──────┬───────┘     │
│  │          │ │ envelope  │  worker_threads: mining PoW, stego    │             │
│  │          │ │ stego     │                                       │             │
│  └──────────┘ └───────────┘                                       │             │
└───────────────────────────────────────────────────────────────────┼─────────────┘
                                                                    │ WebSocket (opsional)
                                                       ┌────────────▼─────────────┐
                                                       │ RELAY (server/relay.js)  │
                                                       │ hanya meneruskan         │
                                                       │ ciphertext               │
                                                       └──────────────────────────┘
```

Aturan ketergantungan: IPC handler → Service → (Security, Crypto, Blockchain, Data, Network). **Folder `crypto/` tidak boleh mengimpor Electron, database, jaringan, atau UI** supaya bisa diuji dengan `vitest` tanpa menjalankan Electron.

### 3.2 Aliran Data Per Fitur

```
Pesan teks   : plaintext → Vigenère → S-DES CBC → Base64 → amplop + MAC → kirim / simpan
Pesan penting: amplop di atas → ChaCha20-Poly1305 (kunci DB lokal) → kolom terenkripsi
File         : file → AES-256-GCM per-chunk → file .svlt (+ amplop yang memuat hash file)
Gambar       : pesan → super enkripsi → bit → LSB piksel PNG → stego.png (+ amplop)
Aset         : file → SHA-256 → transaksi → blok → rantai (PoW + prevHash)
```

### 3.3 Daftar Kanal IPC

Tiap kanal divalidasi di main (tipe data, panjang, sesi aktif).

| Kanal | Arah | Fungsi |
|---|---|---|
| `dongle:status` | R→M | Cek dongle terpasang dan valid |
| `auth:login` | R→M | Kirim username + password, terima "perlu verifikasi wajah" |
| `auth:face-enroll` | R→M | Kirim array embedding wajah untuk didaftarkan |
| `auth:face-verify` | R→M | Kirim embedding, main membandingkan dengan template |
| `auth:logout` | R→M | Hapus sesi dan kunci |
| `contact:add`, `contact:list`, `contact:remove` | R→M | Kelola kontak |
| `conv:setup` | R→M | Kirim passphrase untuk kontak tertentu, terima kode cek kunci |
| `conv:keycheck` | R→M | Ambil kode cek kunci percakapan |
| `msg:send`, `msg:list`, `msg:open` | R→M | Kirim, daftar, dan buka pesan |
| `msg:export`, `msg:import` | R→M | Ekspor/impor paket pesan `.svmsg` (dialog dibuka dari main) |
| `file:encrypt`, `file:decrypt` | R→M | Path file dipilih lewat dialog yang dibuka dari main |
| `stego:embed`, `stego:extract` | R→M | Sisip dan ekstrak pesan |
| `chain:register`, `chain:transfer`, `chain:list`, `chain:validate`, `chain:export`, `chain:import` | R→M | Operasi blockchain |
| `net:connect`, `net:disconnect`, `net:status` | R→M | Kelola koneksi ke relay |
| `event:dongle-removed` | M→R | Dongle dicabut, UI harus mengunci |
| `event:session-expired` | M→R | Sesi habis |
| `event:msg-received` | M→R | Ada pesan baru dari kontak |
| `event:net-status` | M→R | Status koneksi relay berubah |

**Kanal yang sudah ada saat ini (sementara):** `app:ping`, `pesan:enkripsi`, dan `pesan:dekripsi`. Dua kanal terakhir menerima teks, kunci Vigenère (huruf A-Z), dan kunci S-DES (10 karakter `0`/`1`) yang diketik manual, lalu mengembalikan `{ ok, hasil, rincian }`. Keduanya akan digantikan `msg:send` dan `msg:open` setelah kunci percakapan tersedia (Step 4.2-4.3).

---

## 4. Struktur Folder

```
securevault-js/
├─ package.json
├─ electron-builder.yml
├─ README.md
├─ ALUR_PENGERJAAN.md             # peta jalan step demi step
├─ vitest.config.mjs
├─ tools/                         # skrip uji risiko Fase 0
│  ├─ usb-serial-test.js          # baca serial flashdisk (PowerShell)
│  ├─ ws-server.js                # server WebSocket percobaan (port 8765)
│  └─ ws-client.js
├─ server/
│  └─ relay.js                    # server relay kecil (opsional, Tahap 2 komunikasi)
├─ src/
│  ├─ main/
│  │  ├─ main.js                  # buat window, daftarkan IPC, mode --setup
│  │  ├─ config.js                # iterasi KDF, difficulty, ambang wajah, alamat relay, path
│  │  ├─ ipc/
│  │  │  ├─ auth.ipc.js
│  │  │  ├─ contact.ipc.js
│  │  │  ├─ message.ipc.js
│  │  │  ├─ file.ipc.js
│  │  │  ├─ stego.ipc.js
│  │  │  ├─ chain.ipc.js
│  │  │  └─ net.ipc.js
│  │  ├─ services/
│  │  │  ├─ authService.js
│  │  │  ├─ contactService.js
│  │  │  ├─ conversationService.js  # passphrase → kunci percakapan, kode cek kunci
│  │  │  ├─ messageService.js
│  │  │  ├─ fileService.js
│  │  │  ├─ stegoService.js
│  │  │  └─ assetService.js
│  │  ├─ security/
│  │  │  ├─ dongle.js
│  │  │  ├─ usbSerial/
│  │  │  │  ├─ windows.js
│  │  │  │  └─ linux.js
│  │  │  ├─ biometric.js          # bandingkan embedding, kelola template
│  │  │  ├─ password.js
│  │  │  ├─ keys.js               # master key lokal + kunci percakapan
│  │  │  ├─ lockout.js            # hitung gagal login
│  │  │  └─ session.js
│  │  ├─ crypto/
│  │  │  ├─ vigenere.js
│  │  │  ├─ sdes.js
│  │  │  ├─ superCipher.js
│  │  │  ├─ envelope.js           # amplop pesan + MAC
│  │  │  ├─ fileCipher.js
│  │  │  ├─ dbCipher.js
│  │  │  └─ stego.js
│  │  ├─ blockchain/
│  │  │  ├─ block.js
│  │  │  ├─ chain.js
│  │  │  ├─ signing.js            # opsional, Ed25519
│  │  │  └─ miner.worker.js       # worker_threads untuk mining
│  │  ├─ network/
│  │  │  ├─ packageIO.js          # ekspor/impor .svmsg dan .svchain
│  │  │  └─ relayClient.js        # klien WebSocket, outbox, auto-reconnect
│  │  └─ data/
│  │     ├─ db.js
│  │     ├─ schema.sql
│  │     └─ repositories.js
│  ├─ preload/
│  │  └─ preload.js
│  ├─ renderer/
│  │  ├─ index.html
│  │  ├─ styles/
│  │  ├─ views/                   # login, dashboard, kontak/chat, file, stego, chain
│  │  └─ face/
│  │     └─ faceCapture.js        # webcam + Human → embedding
│  └─ shared/
│     └─ constants.js             # nama kanal IPC
├─ tests/
│  ├─ vigenere.test.js
│  ├─ sdes.test.js
│  ├─ superCipher.test.js
│  ├─ envelope.test.js
│  ├─ fileCipher.test.js
│  ├─ stego.test.js
│  └─ chain.test.js
├─ data/                          # runtime (di-.gitignore): securevault.db, files/, stego/, inbox/, outbox/
└─ docs/                          # ERD, flowchart, screenshot, laporan
```

---

## 5. Keamanan Electron

Konfigurasi ini wajib, dan layak dijadikan bahan bahasan di laporan.

```js
// main.js (potongan konsep)
const win = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,     // renderer terpisah dari preload
    nodeIntegration: false,     // renderer tidak punya akses Node
    sandbox: true,
    preload: path.join(__dirname, '../preload/preload.js'),
  },
});
```

- **Content Security Policy** ketat di `index.html`: `default-src 'self'`; tidak memuat script dari internet. Bundel model Human secara lokal, jangan ambil dari CDN. Koneksi WebSocket dilakukan dari **main**, bukan renderer, sehingga CSP renderer tidak perlu membuka `connect-src` ke jaringan.
- **Preload** hanya mengekspos fungsi spesifik (`window.api.login(...)`), bukan `ipcRenderer` mentah.
- **Validasi semua payload IPC** di main (tipe, panjang, whitelist kanal). Jangan percaya renderer.
- **Izin kamera:** gunakan `session.setPermissionRequestHandler` dan izinkan hanya `media` dari halaman aplikasi sendiri.
- **Dialog file dibuka dari main** (`dialog.showOpenDialog`), renderer tidak menentukan path sembarang.
- Nonaktifkan navigasi dan pembukaan window baru (`setWindowOpenHandler(() => ({ action: 'deny' }))`).
- Nonaktifkan DevTools pada build produksi.

---

## 6. Manajemen Kunci

Ada **dua kelompok kunci** yang berasal dari sumber berbeda.

### 6.1 Kunci Lokal (melindungi data di laptop sendiri)

Berasal dari **password** pengguna dan **secret dongle** (32 byte acak di flashdisk). Tanpa salah satunya, data lokal tidak bisa dibuka.

```
master_key = PBKDF2-HMAC-SHA256(
                password = utf8(password_user) || dongle_secret,   // gabungan byte
                salt     = user.kdf_salt (16 byte),
                iter     = 200_000,
                dkLen    = 32)

subkey(label) = HMAC-SHA256(master_key, label)

k_file   = subkey("file-aes")      → AES-256-GCM (brankas file lokal)
k_db     = subkey("db-chacha")     → ChaCha20-Poly1305 (basis data)
k_stego  = subkey("stego-seed")    → seed LSB untuk gambar lokal
k_face   = subkey("face-template") → mengenkripsi template wajah di DB
```

### 6.2 Kunci Percakapan (untuk berkomunikasi dengan satu kontak)

Berasal dari **passphrase bersama** yang disepakati kedua pengguna **di luar aplikasi** (misalnya bertemu langsung). Passphrase tidak pernah dikirim lewat jaringan.

```
conv_salt   = SHA-256( "securevault-conv-v1|" + namaA + "|" + namaB + "|" + epoch )
              // namaA dan namaB = username kedua pihak, huruf kecil, diurutkan alfabet
              // epoch = nomor 1, 2, 3... (naik bila passphrase diganti)

conv_master = PBKDF2-HMAC-SHA256(utf8(passphrase), conv_salt, 200_000, 32)

csub(label) = HMAC-SHA256(conv_master, label)

k_vig    = csub("conv-vigenere")  → 16 huruf A-Z (tiap byte b → "A" + (b mod 26))
k_sdes   = 10 bit pertama dari csub("conv-sdes")
k_xfile  = csub("conv-file")      → AES-256-GCM untuk file yang dikirim ke kontak
k_xstego = csub("conv-stego")     → seed LSB untuk gambar yang dikirim ke kontak
k_mac    = csub("conv-mac")       → HMAC untuk amplop pesan (lihat 8.6)
kcv      = HMAC-SHA256(conv_master, "kcv") → 4 byte pertama dalam hex
```

Karena `conv_salt` hanya bergantung pada nama kedua pihak dan epoch, **kedua laptop menghitung hasil yang sama tanpa bertukar data apa pun** selain passphrase.

**Kode cek kunci (`kcv`):** setelah kedua pihak memasukkan passphrase, aplikasi menampilkan kode 8 karakter hex (misal `A1B2 C3D4`). Kedua pengguna membandingkannya secara lisan. Kalau sama, passphrase dan username sama persis; kalau beda, ada salah ketik. Ini mencegah kebingungan "pesan tidak bisa dibuka" tanpa tahu sebabnya.

**Aturan passphrase:** minimal 12 karakter. Sarankan 4 kata acak atau lebih. Tolak passphrase yang terlalu umum.

**Penyimpanan di laptop:** `conv_master` **tidak** disimpan polos. Aplikasi menyimpannya terenkripsi dengan `k_db` (ChaCha20-Poly1305) di tabel `conversations`, sehingga pengguna cukup memasukkan passphrase sekali per kontak, dan hanya bisa dibuka lagi dengan dongle + password + wajah.

### 6.3 Aturan Umum

- **Pakai versi async** (`crypto.pbkdf2`, bukan `pbkdf2Sync`) supaya proses main dan UI tidak membeku selama 200 ribu iterasi.
- Semua kunci **hanya ada di memori proses main** selama sesi, disimpan sebagai `Buffer`. Jangan pernah ditulis ke disk (kecuali `conv_master` terenkripsi seperti di atas) atau dikirim ke renderer.
- Saat logout atau dongle dicabut: `buffer.fill(0)` untuk semua kunci dan hapus referensi sesi.
- Hash login (`password_hash`) dihitung **terpisah** dengan salt lain dari `kdf_salt`, supaya hash login tidak sama dengan bahan master key.
- Bandingkan hash/tag/MAC selalu dengan `crypto.timingSafeEqual` (setelah memastikan panjang sama).

Implementasi di Node:

```js
const { pbkdf2, createHmac, timingSafeEqual, randomBytes, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const pbkdf2p = promisify(pbkdf2);

const subkey = (master, label) => createHmac('sha256', master).update(label).digest();

async function deriveMasterKey(password, secret, salt) {
  const input = Buffer.concat([Buffer.from(password, 'utf8'), secret]);
  const key = await pbkdf2p(input, salt, 200_000, 32, 'sha256');
  input.fill(0);
  return key;
}

async function deriveConvMaster(passphrase, userA, userB, epoch) {
  const [a, b] = [userA.toLowerCase(), userB.toLowerCase()].sort();
  const salt = createHash('sha256').update(`securevault-conv-v1|${a}|${b}|${epoch}`).digest();
  return pbkdf2p(Buffer.from(passphrase, 'utf8'), salt, 200_000, 32, 'sha256');
}
```

---

## 7. Rancangan Modul Keamanan

### 7.1 Dongle Flashdisk (`security/dongle.js`)

**Konsep:** aplikasi hanya berjalan bila flashdisk terdaftar terpasang.

**Isi flashdisk:** file `.svkey` di root, berisi `secret` (32 byte acak) dan `version`.

**Enrollment (sekali, mode `--setup`):**
1. Pilih drive removable (daftar dari `drivelist`), baca **serial number** fisik, bukan nama volume.
2. Buat `secret = randomBytes(32)`, tulis ke `E:\.svkey`.
3. Simpan di DB: `dongle_tag = HMAC-SHA256(secret, serial)`.

**Verifikasi (setiap aplikasi dibuka):**
1. `drivelist.list()` → ambil perangkat yang `isUSB` / `isRemovable` beserta `mountpoints`.
2. Untuk tiap drive: baca `.svkey` dan serial.
3. Hitung `HMAC-SHA256(secret, serial)` dan bandingkan dengan `dongle_tag` memakai `timingSafeEqual`.
4. Cocok → dongle valid, `secret` diserahkan ke modul `keys`.

**Membaca serial.** Jangan mengandalkan `drivelist` untuk serial (tidak semua platform menyediakannya). Gunakan perintah OS lewat `child_process.execFile`, dibungkus per platform:

```powershell
# Windows (PowerShell)
Get-CimInstance Win32_DiskDrive | Where-Object { $_.InterfaceType -eq 'USB' } |
  Select-Object DeviceID, SerialNumber, PNPDeviceID | ConvertTo-Json
```

Lalu petakan huruf drive ke disk fisik lewat `Win32_DiskDriveToDiskPartition` dan `Win32_LogicalDiskToPartition`. Di Linux: `udevadm info --query=property --name=/dev/sdX` dan ambil `ID_SERIAL_SHORT`.

```js
// usbSerial/index.js (konsep)
// windows.js dan linux.js sama-sama mengekspor: async serialOf(mountpoint) → string | null
const reader = process.platform === 'win32' ? require('./windows') : require('./linux');
```

Gunakan `execFile` dengan argumen terpisah (bukan `exec` dengan string yang disambung) agar tidak ada risiko command injection dari nama drive.

**Fallback sederhana (kurang kuat):** *volume serial number* (`vol E:`) bila pemetaan serial fisik terlalu rumit. Catat di laporan bahwa ini bisa berubah saat flashdisk diformat.

**Pemantauan:** `setInterval` di main tiap 1-2 detik memeriksa keberadaan drive. Jika hilang: nol-kan kunci, hapus sesi, putus koneksi relay, kirim `event:dongle-removed` ke renderer, dan UI kembali ke layar login.

Pseudocode:

```js
async function verifyDongle() {
  for (const drive of await removableDrives()) {
    const keyPath = path.join(drive.mountpoint, '.svkey');
    if (!fs.existsSync(keyPath)) continue;
    const secret = readKeyFile(keyPath);
    const serial = await serialOf(drive.mountpoint);
    if (!serial) continue;
    const tag = createHmac('sha256', secret).update(serial).digest();
    if (safeEqual(tag, db.getDongleTag())) return secret;
  }
  return null;
}
```

### 7.2 Password (`security/password.js`)

- `PBKDF2-HMAC-SHA256`, 200.000 iterasi, salt 16 byte dari `randomBytes`, hasil 32 byte.
- Simpan `password_salt` dan `password_hash`. Verifikasi dengan `timingSafeEqual`.
- Opsional ganti ke **scrypt** (`crypto.scrypt`, juga bawaan Node, *memory-hard*) sebagai nilai plus di laporan.

### 7.3 Biometrik Wajah (`renderer/face/faceCapture.js` + `security/biometric.js`)

Laptop tanpa fingerprint → **face recognition via webcam**. Pembagian tugasnya:

| Di renderer | Di main |
|---|---|
| Buka webcam (`getUserMedia`), deteksi wajah, hitung **embedding** (vektor angka) dengan Human | Simpan template (terenkripsi), bandingkan embedding, putuskan lolos atau tidak |

Alasannya: model deteksi wajah butuh API browser (WebGL/WASM), sedangkan **keputusan autentikasi** harus di main supaya renderer tidak bisa memalsukan hasil "lolos".

**Enrollment:**
1. Ambil 5-10 frame dengan variasi sudut dan cahaya, hitung embedding tiap frame.
2. Kirim ke main lewat `auth:face-enroll`. Main menghitung **rata-rata embedding** sebagai template, lalu mengenkripsinya dengan `k_face` (ChaCha20-Poly1305) dan menyimpannya di DB.

**Verifikasi:**
1. Renderer mengirim embedding satu frame lewat `auth:face-verify`.
2. Main mendekripsi template, menghitung kemiripan (cosine similarity atau jarak Euclidean), dan membandingkannya dengan ambang di `config.js`.
3. Gagal 3 kali berturut-turut → akun dikunci sementara (misal 60 detik, naik eksponensial).

**Kalibrasi ambang:** nilainya bergantung model dan kamera. Uji dengan beberapa wajah berbeda di laptop demo (tentukan ambang yang menolak orang lain tapi menerima pemilik dalam cahaya berbeda). Jangan memakai angka dari dokumentasi tanpa diuji.

**Anti-spoofing (nilai tambah):** Human menyediakan modul antispoof/liveness; aktifkan dan uji. Tanpa ini, foto cetak bisa mengelabui sistem; cantumkan sebagai batasan bila tidak diimplementasi.

**Catatan:** embedding wajah termasuk data sensitif. Jangan di-log, dan hanya dikirim lewat IPC lokal.

### 7.4 Sesi (`security/session.js`)

Menyimpan user aktif, kunci turunan (lokal dan percakapan yang sudah dibuka), waktu login, dan status verifikasi tiap faktor. Timeout otomatis (misal 10 menit tidak aktif) dan penghancuran kunci saat logout. Setiap handler IPC (kecuali `dongle:status` dan `auth:*`) menolak permintaan bila sesi belum lolos ketiga faktor.

---

## 8. Rancangan Modul Kriptografi

### 8.1 Vigenère (`crypto/vigenere.js`)

**Keputusan tim (9 November 2026): Vigenère klasik, mod 26.** Hanya huruf yang digeser. Huruf besar dan kecil dipertahankan. Angka, spasi, simbol, baris baru, dan emoji **tidak diubah** dan tidak menggeser posisi kunci (kunci hanya maju ketika menemui huruf).

```
enc(c, k) = (c + k) mod 26      c dan k bernilai 0..25 (A=0, B=1, ..., Z=25)
dec(c, k) = (c - k) mod 26
```

Kunci hanya boleh berisi huruf A-Z (tidak membedakan huruf besar-kecil), tidak boleh kosong, spasi, atau angka. Perhatian di JavaScript: operator `%` bisa menghasilkan nilai negatif, jadi dipakai `((a % n) + n) % n`.

Contoh uji klasik: `ATTACKATDAWN` dengan kunci `LEMON` menghasilkan `LXFOPVEFRNHR`.

**Konsekuensi yang perlu ditulis di laporan:** tahap Vigenère tidak melindungi angka dan simbol. Karena itu plaintext **tidak** di-Base64 sebelum Vigenère (Base64 akan membuat banyak karakter, yaitu angka, `+`, `/`, dan `=`, lolos tanpa terenkripsi). Perlindungan untuk semua karakter (termasuk emoji dan baris baru) datang dari tahap S-DES yang bekerja pada seluruh byte UTF-8 (lihat 8.3).

_Alternatif yang dipertimbangkan: mod 95 (ASCII 32-126) dengan Base64 di awal. Tim memilih mod 26 karena lebih mudah dijelaskan sebagai Vigenère klasik._

### 8.2 S-DES (`crypto/sdes.js`)

Simplified DES: blok 8-bit, kunci 10-bit, 2 putaran Feistel.

**Tabel permutasi (indeks mulai dari 1):**

```js
const P10    = [3, 5, 2, 7, 4, 10, 1, 9, 8, 6];
const P8     = [6, 3, 7, 4, 8, 5, 10, 9];
const IP     = [2, 6, 3, 1, 4, 8, 5, 7];
const IP_INV = [4, 1, 3, 5, 7, 2, 8, 6];
const EP     = [4, 1, 2, 3, 2, 3, 4, 1];
const P4     = [2, 4, 3, 1];

const S0 = [
  [1, 0, 3, 2],
  [3, 2, 1, 0],
  [0, 2, 1, 3],
  [3, 1, 3, 2],
];
const S1 = [
  [0, 1, 2, 3],
  [2, 0, 1, 3],
  [3, 0, 1, 0],
  [2, 1, 0, 3],
];
```

**Pembangkitan subkunci:** `P10` → pecah 5|5 → `LS-1` masing-masing → `P8` = K1 → `LS-2` (dari hasil LS-1) → `P8` = K2.

**Fungsi putaran `f_K(L, R)`:** `EP(R)` XOR K → pecah 4|4 → S0 (kiri), S1 (kanan) → `P4` → XOR dengan L → gabung dengan R. Baris S-box dari bit 1 dan 4, kolom dari bit 2 dan 3.

**Enkripsi:** `IP` → `f_K1` → swap → `f_K2` → `IP_INV`. **Dekripsi:** sama, urutan subkunci dibalik (K2 lalu K1).

**Saran implementasi:** representasikan bit sebagai array angka `[0,1,...]` agar permutasi mudah ditulis (`table.map(i => bits[i - 1])`) dan mudah di-debug. Optimasi bitwise bisa menyusul setelah semuanya benar.

**Vektor uji (verifikasi implementasi):**

```
Key        = 1010000010
Plaintext  = 01110010
Ciphertext = 01110111
```

Jadikan ini tes pertama di `tests/sdes.test.js`. Jika tidak cocok, ada yang salah di tabel atau urutan shift.

**Mode CBC:** `C[i] = E(P[i] XOR C[i-1])`, `C[0]` memakai IV 8-bit acak yang disimpan di depan ciphertext. Karena blok S-DES hanya 1 byte, **padding tidak diperlukan** dan CBC bekerja per byte. Tulis di laporan bahwa ruang kunci hanya 2^10 = 1024 sehingga mudah di-brute-force (S-DES edukasi, bukan untuk produksi).

**Status implementasi (Step 1.3-1.5, selesai):** `crypto/sdes.js` memakai representasi bit berupa array angka. Fungsi yang diekspor: `buatSubkunci(kunci)` (untuk `1010000010` menghasilkan K1 = `10100100` dan K2 = `01000011`), `enkripsiBlok(blok, kunci)` dan `dekripsiBlok(blok, kunci)` untuk satu blok 8 bit, serta `cbcEncrypt(data, kunci, iv)` dan `cbcDecrypt(data, kunci, iv)` untuk `Buffer`. Kunci berupa string 10 karakter `0`/`1` (atau array bit), IV berupa `Buffer` sepanjang 1 byte. Subkunci dihitung sekali per panggilan CBC. Tes `tests/sdes.test.js` mencakup vektor uji README, round-trip seluruh 256 blok (membuktikan enkripsi adalah permutasi), dan sifat CBC (IV salah hanya merusak byte pertama).

### 8.3 Super Enkripsi (`crypto/superCipher.js`)

Kunci yang dipakai adalah **kunci percakapan** (`k_vig`, `k_sdes`) bila pesan dikirim ke kontak. Pada tahap pengembangan saat ini kunci diketik manual di halaman Pesan Teks.

```
encrypt(text, kVig, kSdes):
    v  = vigenere.encrypt(text, kVig)                          // klasik, mod 26 (hanya huruf)
    iv = randomBytes(1)
    c  = sdes.cbcEncrypt(Buffer.from(v, 'utf8'), kSdes, iv)    // modern, seluruh byte
    return base64(Buffer.concat([iv, c]))

decrypt(token, kVig, kSdes):
    raw = Buffer.from(token, 'base64')
    iv = raw.subarray(0, 1); c = raw.subarray(1)
    v  = sdes.cbcDecrypt(c, kSdes, iv).toString('utf8')
    return vigenere.decrypt(v, kVig)
```

**Antarmuka (sudah diimplementasikan):** `encrypt(teks, { kunciVigenere, kunciSdes })` dan `decrypt(token, { kunciVigenere, kunciSdes })`, keduanya mengembalikan `{ hasil, rincian }`. `rincian` berisi hasil tiap tahap (teks, hasil Vigenère, IV, ciphertext hex, Base64) untuk ditampilkan di UI dan dijelaskan saat demo. Parameter opsional `iv` hanya dipakai pada pengujian. Kunci S-DES harus 10 karakter `0`/`1`; token yang bukan Base64 valid atau kosong ditolak; spasi dan baris baru saat menempel token diabaikan.

Kunci Vigenère dan S-DES **berbeda**. Sebagai nilai laporan: bahas bagaimana dua lapis menambah *confusion* dan *diffusion* meski S-DES lemah.

**Catatan penting:** super enkripsi ini **tidak punya autentikasi**. Dengan kunci yang salah atau pesan yang dimodifikasi, dekripsi tetap "berhasil" tetapi hasilnya sampah, dan tidak ada tanda bahwa ada yang salah. Perilaku ini sengaja diuji di `tests/superCipher.test.js`. Itu sebabnya setiap pesan dibungkus amplop ber-MAC (8.6).

### 8.4 Enkripsi File (`crypto/fileCipher.js`)

`createCipheriv('aes-256-gcm', key, nonce)`, diproses per-chunk 1 MiB agar file besar tidak memenuhi RAM. Baca dengan `fs.promises.open` + `read` berukuran tetap (atau stream dengan `highWaterMark` 1 MiB) dan tulis hasil berurutan.

Kunci dasar: `k_xfile` untuk file yang dikirim ke kontak, atau `k_file` untuk brankas lokal.

**Format file `.svlt`:**

```
Offset  Ukuran  Isi
0       4       Magic "SVLT"
4       1       Versi format (1)
5       16      Salt file (acak)
21      8       Prefix nonce (acak)
29      4       Ukuran chunk (uint32 big-endian)
33      ...     Chunk 0..N

Chunk:
  uint32 panjang ciphertext (termasuk tag 16 byte)
  ciphertext || tag(16)

Nonce chunk i = prefix_nonce(8) || i (uint32 big-endian)
AAD chunk i   = header(33 byte) || i (uint32) || flag_terakhir (1 byte)
```

- Kunci per file: `HMAC-SHA256(kunci_dasar, salt_file)` agar tiap file punya kunci unik.
- Gunakan `cipher.setAAD(aad)` sebelum `update`, lalu `cipher.getAuthTag()` setelah `final()`. Saat dekripsi: `decipher.setAuthTag(tag)` dan `setAAD(aad)` sebelum `update`.
- AAD yang memuat indeks dan penanda chunk terakhir **mencegah pemotongan dan penukaran urutan chunk**.
- Dekripsi gagal (`final()` melempar error autentikasi) → tampilkan "file rusak atau kunci salah", hapus file keluaran parsial.
- Jangan pernah memakai ulang pasangan (kunci, nonce). Karena kunci unik per file dan nonce memuat indeks chunk, aman.
- Jalankan proses ini secara asinkron (atau di `worker_threads`) dan kirim progres ke UI lewat event, supaya aplikasi tidak terasa membeku.

### 8.5 Enkripsi Basis Data (`crypto/dbCipher.js`)

`createCipheriv('chacha20-poly1305', k_db, nonce12, { authTagLength: 16 })`. Tiap nilai terenkripsi:

```
simpan = base64( nonce(12) || ciphertext || tag(16) )
```

Nonce acak 12 byte baru untuk setiap penulisan. Yang dienkripsi: isi pesan berflag penting, `conv_master` di tabel `conversations`, template wajah, metadata file sensitif. Password **tidak dienkripsi**, hanya di-hash.

Kunci `k_db` hanya dimiliki laptop itu, jadi enkripsi ini melindungi data **saat tersimpan**. Untuk pengiriman antar laptop yang dipakai adalah kunci percakapan.

### 8.6 Amplop Pesan Terautentikasi (`crypto/envelope.js`)

Semua pesan yang dikirim ke kontak dibungkus amplop (JSON) dengan **encrypt-then-MAC**:

```json
{
  "v": 1,
  "id": "uuid-pesan",
  "from": "alice",
  "to": "bob",
  "epoch": 1,
  "seq": 17,
  "ts": "2026-11-08T13:10:00+07:00",
  "type": "text | file | stego",
  "ct": "base64 hasil super enkripsi (untuk type=text)",
  "fileHash": "sha256 hex dari .svlt atau stego.png (untuk type=file/stego)",
  "mac": "base64 HMAC-SHA256(k_mac, canonical(v,id,from,to,epoch,seq,ts,type,ct,fileHash))"
}
```

**Pengirim:** isi `ct` atau `fileHash`, naikkan `seq` (nomor urut per arah per percakapan), hitung `mac` atas seluruh field dalam bentuk kanonik (urutan key tetap).

**Penerima (urutan wajib):**
1. Periksa `to` = pengguna ini dan `epoch` = epoch percakapan saat ini.
2. **Verifikasi MAC dengan `timingSafeEqual` sebelum mendekripsi apa pun.** Gagal → tolak dengan pesan "passphrase berbeda atau pesan telah diubah".
3. Periksa `seq` lebih besar dari `seq` terakhir yang diterima dari pengirim itu (menolak pesan ulang/replay), dan `id` belum pernah ada (dedup).
4. Baru dekripsi `ct` dengan super enkripsi (atau cocokkan `fileHash` dengan berkas yang diterima, lalu dekripsi berkas).

Manfaatnya: kesalahan passphrase dan pengubahan pesan **terdeteksi** (padahal Vigenère + S-DES saja tidak mendeteksinya), pengirim palsu tidak bisa membuat MAC yang valid tanpa passphrase, dan pesan lama tidak bisa dikirim ulang.

---

## 9. Steganografi

Modul `crypto/stego.js` memakai **LSB** pada gambar **PNG** (lossless; JPEG merusak bit tersembunyi karena kompresi lossy).

Untuk gambar yang **dikirim ke kontak**, pesan disisipkan setelah super enkripsi dengan kunci percakapan, dan seed pengocok piksel dari `k_xstego`, sehingga penerima (yang punya passphrase sama) bisa mengekstraknya. Gambar untuk penyimpanan lokal memakai `k_stego`.

**Alur menyisipkan:**
1. Pesan → `superCipher.encrypt` → bytes.
2. Bangun payload: `magic "STG1" (4 byte) + panjang (uint32) + data`.
3. Cek kapasitas: `kapasitasByte = floor(lebar × tinggi × 3 / 8)`. Tolak jika payload lebih besar.
4. Ubah payload jadi deret bit. 64 bit header (magic + panjang) disisipkan **berurutan** di posisi awal.
5. Bit sisanya disisipkan di posisi **acak**: urutan indeks kanal dikocok dengan Fisher-Yates memakai PRNG deterministik yang di-seed dari kunci stego.
6. Ganti bit paling tidak signifikan tiap kanal R/G/B dengan bit pesan. **Jangan ubah kanal alpha.**
7. Simpan sebagai PNG baru, lalu buat amplop `type: "stego"` dengan `fileHash` = SHA-256 berkas PNG.

**Detail JavaScript:**
- Dengan `pngjs`: `PNG.sync.read(buffer)` menghasilkan `data` (Buffer RGBA, 4 byte per piksel). Kanal yang dipakai: indeks `i % 4 !== 3`. Tulis kembali dengan `PNG.sync.write(png)`.
- Operasi bit: `data[i] = (data[i] & 0xFE) | bit`.
- `Math.random()` **tidak bisa di-seed**. Buat PRNG sendiri: mis. aliran HMAC-SHA256 berbasis counter dari kunci stego, lalu ambil angka darinya untuk Fisher-Yates. Hasilnya deterministik dan kuat.
- Gambar besar: proses di `worker_threads` agar UI tidak membeku.
- **Kirim gambar sebagai file, bukan screenshot atau lewat aplikasi yang mengompres** (WhatsApp biasa, media sosial). Kompresi menghancurkan bit tersembunyi. Pakai pengiriman sebagai dokumen/file, flashdisk, atau lewat relay.

**Ekstraksi:** baca header, ambil panjang, baca bit sesuai urutan acak yang sama, rangkai ke bytes, lalu dekripsi.

**Metrik kualitas:** hitung `MSE` dan `PSNR = 10·log10(255² / MSE)` antara cover dan stego. PSNR di atas ~40 dB berarti perubahan nyaris tak terlihat. Tampilkan di UI sebagai bahan demo.

---

## 10. Blockchain

Konsep: **"aset penting" = dokumen/file yang didaftarkan beserta pemiliknya**, dan kepemilikan bisa ditransfer.

**Struktur blok:**

```json
{
  "index": 3,
  "timestamp": "2026-11-08T13:10:00+07:00",
  "data": {
    "action": "REGISTER | TRANSFER",
    "assetId": "uuid",
    "fileHash": "sha256 hex",
    "from": "alice",
    "to": "bob"
  },
  "prevHash": "…",
  "nonce": 8231,
  "hash": "…"
}
```

- `hash = SHA-256(index | timestamp | json(data) | prevHash | nonce)`. Pastikan **urutan key JSON deterministik** (tulis fungsi `canonicalize` yang mengurutkan key), karena urutan key di JavaScript mengikuti urutan penyisipan dan bisa berbeda antar eksekusi.
- **Proof-of-work ringan:** naikkan `nonce` sampai hash (hex) diawali `"000"` (atur `DIFFICULTY` di `config.js`).
- **Blok genesis:** index 0, `prevHash = '0'.repeat(64)`. **Blok genesis harus identik di kedua laptop** (isi tetap di kode, bukan dibuat dari waktu saat ini), kalau tidak rantai keduanya tidak akan pernah cocok.
- Mining dijalankan di **`worker_threads`** (`miner.worker.js`) agar proses main tidak terblokir saat difficulty dinaikkan.

**Validasi rantai:** untuk tiap blok: (1) hash dihitung ulang sama dengan `hash` tersimpan, (2) `prevHash` sama dengan hash blok sebelumnya, (3) hash memenuhi difficulty.

**Aturan state kepemilikan** (dihitung dengan memutar ulang seluruh rantai ke `Map` assetId → pemilik):
- `REGISTER` hanya sah bila `assetId` belum ada.
- `TRANSFER` hanya sah bila `from` adalah pemilik saat ini.

**Penguatan opsional:** tiap transaksi ditandatangani **Ed25519** (`crypto.generateKeyPairSync('ed25519')`, `crypto.sign(null, data, privateKey)`, `crypto.verify`). Kunci publik pengguna perlu dipertukarkan dengan kontak (bisa lewat paket ekspor), jadi ini tahap lanjutan.

**Sinkronisasi antar laptop:** lihat 11.6.

**Skenario demo:** register aset, transfer, ubah satu byte data di blok tengah (lewat DB), lalu tombol "Validasi Rantai" menunjukkan blok mana yang rusak.

Penyimpanan: tabel `blocks` di SQLite.

---

## 11. Komunikasi Antar Laptop

Tujuan: dua laptop yang sama-sama memasang aplikasi ini dapat saling mengirim pesan teks, file, dan gambar stego, secara dua arah.

### 11.1 Prinsip

- **Format pesan sama, transportnya yang berbeda.** Semua yang dikirim adalah amplop ber-MAC (8.6) dan, bila ada, berkas pendamping (`.svlt` atau PNG stego). Cara membawanya ke laptop lain dibuat modular (`network/`), jadi transport bisa ditambah tanpa mengubah kripto.
- **Dibangun bertahap:** Tahap 1 (tukar berkas) wajib dan murah. Tahap 2 (relay WebSocket) ditambahkan bila waktu cukup.
- **Jaringan tidak dipercaya.** Relay atau jalur apa pun hanya melihat ciphertext dan metadata. Keaslian dan keutuhan dijamin MAC dari passphrase bersama.

### 11.2 Menyiapkan Percakapan dengan Kontak

Dilakukan sekali per kontak, oleh **kedua pihak** di laptop masing-masing.

1. Kedua pengguna sepakat **passphrase** di luar aplikasi (bertemu langsung, bukan lewat chat).
2. Masing-masing: Tambah Kontak → isi username lawan bicara.
3. Masing-masing: Atur Percakapan → ketik passphrase → renderer mengirimnya lewat `conv:setup`.
4. Main menghitung `conv_master` (6.2), menyimpannya terenkripsi dengan `k_db`, dan mengembalikan **kode cek kunci**.
5. Kedua pengguna membandingkan kode cek kunci secara lisan. Sama berarti siap dipakai.
6. Ganti passphrase di kemudian hari dengan menaikkan `epoch` (kedua pihak harus melakukannya). Pesan lama tetap terbaca karena kunci epoch lama disimpan terenkripsi.

Username kedua pihak ikut membentuk salt, jadi **username harus persis sama** di kedua laptop (huruf kecil/besar diabaikan).

### 11.3 Tahap 1: Tukar Berkas (tanpa jaringan)

Cocok untuk demo paling aman, dan tidak bergantung Wi-Fi.

**Mengirim:**
- Teks: aplikasi membuat amplop dan mengekspornya sebagai `nama.svmsg` (JSON, boleh berisi beberapa amplop sekaligus).
- File: aplikasi membuat `.svlt` (dengan `k_xfile`) dan amplop `type: file` yang memuat `fileHash`.
- Gambar: aplikasi membuat PNG stego dan amplop `type: stego`.
- Bawa berkas ke laptop lain: flashdisk, kirim sebagai dokumen lewat aplikasi chat, atau email.

**Menerima:** Impor → pilih `.svmsg` (dan berkas pendampingnya). Aplikasi menjalankan urutan verifikasi 8.6 (MAC dulu, lalu `seq`/`id`, lalu hash berkas, baru dekripsi), lalu menyimpan ke tabel `messages`.

Karena `seq` diperiksa, mengimpor berkas yang sama dua kali tidak menggandakan pesan.

### 11.4 Tahap 2: Relay WebSocket

Satu program kecil (`server/relay.js`) dijalankan di salah satu laptop (atau laptop ketiga). Kedua aplikasi menjadi *client*.

```
Laptop A (app)  ──ws──►  RELAY (laptop mana pun)  ◄──ws──  Laptop B (app)
  relayClient             simpan-dan-teruskan                relayClient
                          (hanya ciphertext)
```

**Protokol (JSON per pesan WebSocket):**

| Arah | Pesan | Keterangan |
|---|---|---|
| Client → Relay | `{"t":"HELLO","user":"alice","token":"…"}` | Masuk. `token` = rahasia relay yang sama di semua client |
| Relay → Client | `{"t":"HELLO_OK","pending":2}` | Jumlah pesan tertunda untuk user ini |
| Client → Relay | `{"t":"SEND","to":"bob","envelope":{…}}` | Kirim amplop |
| Relay → Client | `{"t":"SEND_OK","id":"uuid"}` | Relay sudah menyimpan |
| Relay → Client | `{"t":"DELIVER","envelope":{…}}` | Teruskan ke penerima (saat online atau saat dia masuk) |
| Client → Relay | `{"t":"ACK","id":"uuid"}` | Penerima sudah menyimpan; relay menghapus dari antrean |
| Relay → Client | `{"t":"DELIVERED","id":"uuid"}` | Pengirim diberi tahu |

**Aturan relay:**
- Menolak koneksi tanpa `token` yang benar, dan memastikan `envelope.from` sama dengan user di `HELLO`.
- Menyimpan amplop selama penerima offline (memori atau berkas JSON), menghapusnya setelah `ACK`.
- **Tidak pernah memegang passphrase atau kunci apa pun**, dan tidak mendekripsi apa pun.
- Berkas besar (`.svlt`, PNG): tahap awal cukup dikirim lewat Tahap 1. Bila ingin lewat relay, kirim dalam potongan (chunk) Base64 dengan `fileId`, `index`, `total`, dan penerima menyusun ulang lalu mencocokkan `fileHash`.

**Aturan client (`network/relayClient.js`):**
- Berjalan di proses **main**, dengan auto-reconnect.
- **Outbox:** pesan yang gagal terkirim disimpan dengan status `pending` dan dikirim ulang saat koneksi pulih.
- Pesan masuk melewati verifikasi 8.6 sebelum disimpan dan ditampilkan; yang gagal dibuang dan dicatat di `audit_log`.
- Status di UI: `pending` → `sent` → `delivered`.

**Mengapa token relay saja tidak cukup:** token hanya mencegah pihak asing ikut terhubung. Kalau seorang pengguna sah memalsukan nama pengirim, amplopnya tetap gagal verifikasi MAC karena ia tidak punya passphrase percakapan tersebut.

### 11.5 Jaringan Saat Demo

- Wi-Fi kampus sering menerapkan *client isolation* sehingga antar perangkat tidak bisa saling terhubung. Gunakan **hotspot HP** atau router sendiri.
- Jalankan relay (`npm run relay`), catat alamat IP laptop relay (misal `192.168.43.10:8080`), dan isi di pengaturan aplikasi kedua laptop.
- Izinkan port relay di firewall Windows pada laptop yang menjalankan relay.
- Uji koneksi **di tempat presentasi** sebelum hari-H. Siapkan Tahap 1 sebagai rencana cadangan bila jaringan bermasalah.
- Koneksi memakai `ws://` biasa (tanpa TLS). Isi pesan tetap terenkripsi, tetapi metadata (nama pengirim, penerima, waktu, ukuran) terlihat. Catat sebagai batasan; TLS dengan sertifikat self-signed bisa jadi pengembangan lanjutan.

### 11.6 Sinkronisasi Blockchain

Kedua laptop punya salinan rantai sendiri dengan blok genesis yang sama.

- **Tahap 1:** `chain:export` menghasilkan `nama.svchain` (JSON seluruh rantai), `chain:import` memvalidasi seluruh rantai kiriman. Bila valid dan **lebih panjang** dari rantai lokal, rantai lokal diganti; jika tidak, ditolak.
- **Tahap 2 (relay):** setelah membuat blok baru, client menyiarkan `{"t":"CHAIN_BLOCK","block":{…}}` lewat relay. Penerima menambahkan blok bila `prevHash` cocok dengan blok terakhirnya dan blok valid. Bila tidak cocok, penerima meminta seluruh rantai (`CHAIN_REQ`/`CHAIN_RES`) dan memakai aturan rantai valid terpanjang.
- Ini hanya sinkronisasi sederhana, bukan konsensus. Bila dua laptop membuat blok bersamaan, salah satunya akan tertinggal dan mengikuti rantai yang lebih panjang.

---

## 12. Skema Basis Data

Disimpan di `src/main/data/schema.sql` dan dijalankan saat aplikasi pertama kali dibuka. Tiap laptop punya database sendiri.

```sql
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT UNIQUE NOT NULL,
    password_hash   BLOB NOT NULL,
    password_salt   BLOB NOT NULL,
    kdf_salt        BLOB NOT NULL,          -- salt master key lokal
    dongle_tag      BLOB NOT NULL,          -- HMAC(secret, serial)
    face_template   BLOB,                   -- terenkripsi k_face
    pubkey          BLOB,                   -- Ed25519 (opsional)
    failed_attempts INTEGER DEFAULT 0,
    locked_until    TEXT,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Kontak = orang di laptop lain
CREATE TABLE IF NOT EXISTS contacts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id         INTEGER NOT NULL REFERENCES users(id),
    contact_username TEXT NOT NULL,
    display_name     TEXT,
    created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (owner_id, contact_username)
);

-- Satu baris per (kontak, epoch passphrase)
CREATE TABLE IF NOT EXISTS conversations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id    INTEGER NOT NULL REFERENCES contacts(id),
    epoch         INTEGER NOT NULL DEFAULT 1,
    conv_key_enc  TEXT NOT NULL,            -- conv_master terenkripsi k_db (ChaCha20)
    key_check     TEXT NOT NULL,            -- kcv (untuk ditampilkan/dibandingkan)
    last_seq_in   INTEGER DEFAULT 0,        -- seq terakhir diterima (anti replay)
    next_seq_out  INTEGER DEFAULT 1,        -- seq berikutnya yang dikirim
    created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (contact_id, epoch)
);

CREATE TABLE IF NOT EXISTS messages (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    msg_uuid         TEXT UNIQUE NOT NULL,  -- id amplop (dedup)
    conversation_id  INTEGER NOT NULL REFERENCES conversations(id),
    direction        TEXT NOT NULL,         -- 'out' | 'in'
    seq              INTEGER NOT NULL,
    type             TEXT NOT NULL,         -- 'text' | 'file' | 'stego'
    envelope         TEXT NOT NULL,         -- JSON amplop ber-MAC
    is_important     INTEGER DEFAULT 0,
    db_encrypted     TEXT,                  -- amplop dibungkus ChaCha20 bila penting
    status           TEXT DEFAULT 'sent',   -- 'pending' | 'sent' | 'delivered' | 'received'
    created_at       TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS files (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id        INTEGER NOT NULL REFERENCES users(id),
    conversation_id INTEGER REFERENCES conversations(id),  -- NULL = brankas lokal
    original_name   TEXT NOT NULL,          -- terenkripsi bila sensitif
    encrypted_path  TEXT NOT NULL,
    file_hash       TEXT,
    size_bytes      INTEGER,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stego_images (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id        INTEGER NOT NULL REFERENCES users(id),
    conversation_id INTEGER REFERENCES conversations(id),
    image_path      TEXT NOT NULL,
    file_hash       TEXT,
    psnr            REAL,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blocks (
    idx        INTEGER PRIMARY KEY,
    timestamp  TEXT NOT NULL,
    data       TEXT NOT NULL,               -- JSON
    prev_hash  TEXT NOT NULL,
    nonce      INTEGER NOT NULL,
    hash       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    event      TEXT NOT NULL,               -- LOGIN_OK, LOGIN_FAIL, DONGLE_REMOVED, MAC_FAIL, REPLAY_REJECTED, …
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**ERD ringkas:** `users 1—N contacts`, `contacts 1—N conversations` (satu per epoch), `conversations 1—N messages`, `conversations 1—N files` dan `stego_images` (opsional), `blocks` berdiri sendiri (data memuat username).

Gunakan *prepared statement* (`db.prepare('... WHERE id = ?')`) untuk semua query agar aman dari SQL injection. `better-sqlite3` bersifat sinkron; itu aman dipakai di main untuk data sebesar ini.

---

## 13. Alur Aplikasi

### 13.1 Login (3 faktor)

```
Buka aplikasi
   │
   ▼
[1] main: verifyDongle() ──gagal──► UI: "Pasang flashdisk" (tidak lanjut)
   │ ok (secret didapat)
   ▼
[2] UI kirim username + password ──► main: verifikasi hash ──salah──► hitung gagal
   │ ok
   ▼
[3] UI: webcam → embedding ──► main: bandingkan dengan template ──gagal 3x──► kunci akun
   │ ok
   ▼
main: turunkan master key → buat sesi → (sambung ke relay bila diaktifkan) → UI: Dashboard
   │
   ▼ (setInterval di main)
Dongle dicabut ──► main: zero kunci + putus relay → event:dongle-removed → UI kembali ke login
```

### 13.2 Mengirim Pesan Teks ke Kontak

```
Pilih kontak → tulis pesan → [centang "penting"?]
   → conversationService: ambil conv keys (k_vig, k_sdes, k_mac)
   → superCipher.encrypt → envelope.build (seq++, MAC)
   → simpan ke messages (direction=out, status=pending)
   └─ bila penting: amplop juga dibungkus dbCipher (k_db) sebelum disimpan
   → transport: ekspor .svmsg (Tahap 1) atau relayClient.send (Tahap 2)
```

### 13.3 Menerima Pesan

```
Impor .svmsg / event dari relay
   → envelope.verify: to/epoch ✓ → MAC ✓ (timingSafeEqual) → seq & id baru ✓
   → superCipher.decrypt → simpan (direction=in, status=received) → tampil di UI
Gagal di langkah mana pun → buang, tulis audit_log (MAC_FAIL / REPLAY_REJECTED), UI tampilkan alasan
```

### 13.4 Mengirim File, Gambar, Aset

Lihat bagian 8.4, 9, dan 10. File dan gambar dikirim bersama amplop yang memuat `fileHash`. Semuanya dipanggil lewat IPC → Service dan dicatat di `audit_log`.

### 13.5 Responsivitas UI

Operasi berat (PBKDF2, enkripsi file besar, mining, steganografi) harus asinkron atau di `worker_threads`. Hindari fungsi `*Sync` untuk operasi lama di proses main.

---

## 14. Instalasi dan Menjalankan

**Prasyarat:** Node.js LTS, webcam, flashdisk. Untuk `better-sqlite3` di Windows mungkin perlu **Visual Studio Build Tools (C++)** bila tidak ada binary siap pakai.

```bash
# 1. Pasang dependensi
npm install

# 2. Rebuild modul native agar cocok dengan versi Electron
npm run rebuild

# 3. Inisialisasi database + daftarkan admin + dongle (sekali)
npm run setup

# 4. Jalankan aplikasi
npm start

# 5. (Tahap 2 komunikasi) jalankan relay di satu laptop
npm run relay
```

Untuk dua laptop: pasang aplikasi dan jalankan setup di **masing-masing laptop** (masing-masing punya flashdisk, wajah, dan database sendiri), buat username berbeda, lalu atur kontak dan percakapan sesuai 11.2.

Pengujian (modul crypto, envelope, blockchain, dan stego tidak butuh Electron):

```bash
npm test
```

Membuat installer (opsional):

```bash
npm run dist
```

Model Human sebaiknya disalin ke folder aplikasi (offline) dan dimuat dari path lokal, selaras dengan CSP.

---

## 15. Rencana Pengujian

| Area | Uji | Hasil yang diharapkan |
|---|---|---|
| S-DES | Vektor uji K=1010000010, P=01110010 | C = 01110111 |
| S-DES | Round-trip seluruh 256 blok; 256 blok menghasilkan 256 ciphertext berbeda | Identik; enkripsi berupa permutasi |
| S-DES CBC | Round-trip byte 0-255; IV berbeda; kunci salah; IV salah | Identik; ciphertext berbeda; bukan plaintext; hanya byte pertama rusak |
| Vigenère | Contoh klasik `ATTACKATDAWN` + `LEMON`; round-trip dengan huruf besar-kecil, angka, simbol | `LXFOPVEFRNHR`; teks kembali identik, angka dan simbol tidak berubah |
| Super cipher | Round-trip, termasuk emoji dan baris baru | Identik |
| File | Round-trip file 0 byte, 1 byte, 1 MiB, 50 MiB | Identik, memori stabil |
| File | Ubah 1 byte di ciphertext | Dekripsi ditolak (autentikasi gagal) |
| File | Potong chunk terakhir | Ditolak (AAD flag terakhir) |
| DB | Salin file `.db` ke komputer lain tanpa dongle | Kolom penting dan `conv_key_enc` tidak terbaca |
| Stego | Sisip lalu ekstrak pesan | Identik; PSNR > 40 dB |
| Stego | Pesan melebihi kapasitas | Ditolak dengan pesan jelas |
| Stego | Simpan stego sebagai JPEG lalu ekstrak | Gagal (dokumentasikan sebagai batasan) |
| Blockchain | Ubah data blok tengah | Validasi menunjuk blok rusak |
| Blockchain | Transfer oleh non-pemilik | Ditolak |
| Dongle | Cabut flashdisk saat aplikasi berjalan | Aplikasi terkunci, kunci terhapus, relay terputus |
| Dongle | Salin `.svkey` ke flashdisk lain | Ditolak (serial berbeda) |
| Login | Wajah orang lain | Ditolak |
| Login | 3 kali gagal | Akun terkunci sementara |
| Electron | Renderer mencoba `require('fs')` atau memanggil kanal IPC tanpa sesi | Gagal / ditolak |
| Electron | Kirim payload IPC dengan tipe salah | Ditolak oleh validasi |
| Kunci percakapan | Passphrase sama di dua laptop | `kcv` identik di kedua layar |
| Kunci percakapan | Passphrase berbeda satu huruf | `kcv` berbeda |
| Amplop | Kirim teks A→B lalu B→A | Terbaca di kedua arah |
| Amplop | Passphrase B salah | Ditolak di verifikasi MAC (bukan menampilkan sampah) |
| Amplop | Ubah satu karakter pada `.svmsg` | MAC gagal, pesan ditolak |
| Amplop | Impor `.svmsg` yang sama dua kali | Pesan kedua ditolak (`id`/`seq`) |
| Amplop | Kirim ulang amplop lama (replay) | Ditolak (`seq` tidak lebih besar) |
| Amplop | Pasangkan `fileHash` dengan berkas yang diubah | Ditolak (hash tidak cocok) |
| Relay | Matikan relay saat mengirim, lalu hidupkan | Pesan masuk outbox dan terkirim setelah pulih |
| Relay | Client tanpa token yang benar | Koneksi ditolak |
| Relay | Pengirim memalsukan nama pengirim | Amplop gagal verifikasi MAC di penerima |
| Relay | Periksa isi yang tersimpan di relay | Hanya ciphertext, tanpa kunci |
| Blockchain sync | Impor rantai valid yang lebih panjang | Rantai lokal diganti |
| Blockchain sync | Blok dengan `prevHash` salah | Ditolak |

---

## 16. Ancaman dan Batasan

Tulis jujur di laporan, ini justru nilai plus:

- **S-DES lemah:** ruang kunci 1024, brute force instan. Dipakai karena syarat tugas/edukasi. Vigenère mod 26 juga lemah terhadap analisis frekuensi dan tidak mengubah angka maupun simbol, tetapi hasilnya (seluruh byte) dilapisi S-DES CBC dengan IV acak, sehingga pola teks tidak langsung terlihat.
- **Keamanan percakapan bertumpu pada passphrase.** Jika passphrase bocor atau lemah, semua pesan di epoch itu bisa dibuka. Passphrase harus dibagikan lewat jalur aman di luar aplikasi.
- **Tidak ada forward secrecy.** Kunci percakapan tetap sama selama satu epoch. Kebocoran di kemudian hari membuka pesan lama yang sudah tersadap. Mitigasi: ganti passphrase berkala (naikkan epoch).
- **Tidak ada pertukaran kunci asimetris** (tidak ada algoritma klasik yang asimetris). Ini keputusan sadar tim: kesepakatan kunci dilakukan secara manual di luar aplikasi.
- **Serial flashdisk bisa dipalsukan** pada perangkat tertentu. Karena secret di `.svkey` ikut menurunkan master key, memalsukan serial saja tidak cukup untuk membuka data lokal.
- **Face recognition tanpa liveness** dapat dikelabui foto. Kurangi risiko dengan modul antispoof/liveness atau tantangan acak.
- **Password dan passphrase lewat IPC sebagai string JavaScript** tidak bisa dihapus dari memori secara pasti (string immutable, ada garbage collector). Kunci di main memakai `Buffer` dan di-`fill(0)` sebisanya.
- **Relay tanpa TLS** menampakkan metadata (siapa kirim ke siapa, kapan, berapa besar). Isi tetap terenkripsi dan terautentikasi. Relay bisa menunda atau membuang pesan, tetapi tidak bisa mengubah atau memalsukannya tanpa terdeteksi MAC.
- **Relay satu titik gagal:** bila relay mati, pesan menunggu di outbox. Tahap 1 menjadi cadangan.
- **Serial USB bergantung OS** dan memanggil proses eksternal. Putuskan OS demo sejak awal.
- **Renderer adalah Chromium:** kerentanan XSS di UI bisa memanggil API preload. Karena itu CSP ketat, validasi IPC, dan pembatasan sesi wajib.
- **Blockchain tanpa konsensus sungguhan:** sinkronisasi hanya memakai aturan rantai valid terpanjang.
- **Steganografi LSB** rentan terhadap kompresi, resize, dan analisis statistik (steganalysis).
- **Tidak ada pemulihan** bila password dan flashdisk hilang bersamaan. Pertimbangkan flashdisk cadangan.

---

## 17. Pembagian Kerja dan Jadwal

| Anggota | Tanggung jawab |
|---|---|
| A | `security/` (dongle, password, biometrik, sesi, kunci), `authService`, kerangka Electron (main, preload, IPC) |
| B | `crypto/` (Vigenère, S-DES, super cipher, envelope, AES file, ChaCha20 DB) dan tes `vitest`, `conversationService` |
| C | `crypto/stego.js`, `blockchain/`, UI renderer, `faceCapture.js`, `network/` (ekspor/impor dan relay), integrasi, dokumentasi |

Jika tim kurang dari 3 orang, prioritaskan urutan: crypto inti → login (password + dongle) → komunikasi Tahap 1 → blockchain → steganografi → biometrik wajah → relay (Tahap 2).

| Minggu | Target |
|---|---|
| 1 | Finalisasi rancangan, repo, skema DB, kerangka Electron (main/preload/IPC), tes S-DES lulus |
| 2-3 | Crypto inti (teks, file, DB), login password + dongle, kunci percakapan + amplop ber-MAC |
| 4 | Biometrik wajah, steganografi, blockchain |
| 5 | Komunikasi: kontak, percakapan, ekspor/impor (Tahap 1); relay WebSocket (Tahap 2) bila waktu cukup; sinkronisasi rantai |
| 6 | Integrasi, uji dua laptop, pengujian serangan, laporan, latihan demo |

**Uji risiko di awal (sebelum minggu 2):** pastikan di laptop demo (1) webcam terbuka dan Human menghasilkan embedding, (2) serial flashdisk terbaca lewat PowerShell/`udevadm`, dan (3) dua laptop bisa saling terhubung lewat hotspot (cukup `ping` dan satu koneksi `ws` percobaan). Tiga hal ini paling menentukan kelancaran proyek.

Sesuaikan dengan tanggal UAS dan jadwal presentasi di 4 pertemuan terakhir.

---

## 18. Kerangka Laporan

1. Pendahuluan (latar belakang, tujuan, ruang lingkup)
2. Landasan teori (Vigenère, S-DES, PBKDF2, HMAC, AES-GCM, ChaCha20-Poly1305, LSB, blockchain, biometrik, model keamanan Electron)
3. Analisis kebutuhan dan rancangan (arsitektur main/renderer, flowchart, ERD, format file, format amplop, protokol relay, daftar IPC)
4. Implementasi (potongan kode penting, tangkapan layar)
5. Pengujian (tabel bagian 15, PSNR, analisis kelemahan)
6. Kesimpulan dan saran (termasuk pengembangan lanjutan: pertukaran kunci asimetris, TLS, forward secrecy)

Demo presentasi yang disarankan (dua laptop): cabut flashdisk (aplikasi terkunci) → login wajah → cocokkan kode cek kunci di kedua laptop → kirim pesan super enkripsi A→B lalu B→A → ubah satu karakter pada pesan dan tunjukkan MAC menolaknya → ekstrak pesan dari gambar stego → tampering blockchain lalu validasi rantai.