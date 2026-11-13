# SecureVault (TA-Kriptoasik)

Aplikasi desktop kriptografi untuk Tugas Akhir Kriptografi, dibangun dengan **JavaScript + Electron**. Satu aplikasi yang menggabungkan:

- **Autentikasi berlapis**: dongle flashdisk USB + password + biometrik wajah
- **Super enkripsi teks**: Vigenère (mod 26) lalu S-DES mode CBC
- **Enkripsi file**: AES-256-GCM (format `.svlt`)
- **Enkripsi basis data**: ChaCha20-Poly1305
- **Steganografi gambar**: LSB acak pada PNG, isi pesan dienkripsi AES-256-GCM
- **Blockchain sederhana**: pencatatan kepemilikan aset dengan Proof of Work
- **Komunikasi dua arah antar dua laptop**: pertukaran berkas pesan, berkas, dan gambar terenkripsi dengan passphrase bersama.

> **Catatan platform:** harus dijalankan sebagai **aplikasi desktop (Electron)**, bukan di browser. Browser tidak bisa membaca serial number flashdisk dan tidak bisa mendeteksi pencabutannya. Deteksi dongle saat ini memakai **PowerShell, jadi hanya berjalan di Windows**.

---

## Daftar Isi

1. [Keputusan Rancangan](#1-keputusan-rancangan)
2. [Arsitektur](#2-arsitektur)
3. [Struktur Repositori](#3-struktur-repositori)
4. [Alur Autentikasi dan Hierarki Kunci](#4-alur-autentikasi-dan-hierarki-kunci)
5. [Algoritma yang Digunakan](#5-algoritma-yang-digunakan)
6. [Skema Basis Data](#6-skema-basis-data)
7. [Komunikasi Dua Laptop](#7-komunikasi-dua-laptop)
8. [Prasyarat](#8-prasyarat)
9. [Clone dan Menjalankan Program](#9-clone-dan-menjalankan-program)
10. [Panduan Penggunaan](#10-panduan-penggunaan)
11. [Menjalankan Pengujian](#11-menjalankan-pengujian)
12. [Skrip Bantu (`tools/`)](#12-skrip-bantu-tools)
13. [Catatan Keamanan dan Batasan](#13-catatan-keamanan-dan-batasan)

---

## 1. Keputusan Rancangan

| Aspek | Keputusan |
|---|---|
| Bahasa / platform | JavaScript dengan Electron |
| Super enkripsi teks | Vigenère (**mod 26**) lalu S-DES mode CBC |
| Kesepakatan kunci antar laptop | **Passphrase bersama** (disepakati di luar aplikasi), karena algoritma klasik tidak asimetris |
| Autentikasi | 3 faktor: dongle USB, password, wajah (wajah opsional per akun, wajib bila sudah didaftarkan) |
| Penyimpanan | SQLite bawaan Node (`node:sqlite`), seluruh data sensitif terenkripsi |
| Transport antar laptop | **Berkas** (`.svmsg`, `.svlt`, `.png`) yang dipindahkan secara manual (flashdisk, email, dsb.) |

Pemisahan hak akses di Electron: proses utama (`main`) memegang semua kunci dan operasi kripto; tampilan (`renderer`) berjalan dengan `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, dan hanya bisa memanggil fungsi yang diekspos `preload.js` lewat `window.api`.

---

## 2. Arsitektur

```mermaid
flowchart LR
  subgraph Renderer["Renderer (sandbox)"]
    UI["index.html + app.js\nwajah.js + wajah-ui.js (Human)"]
  end
  subgraph Preload["Preload"]
    API["window.api (contextBridge)"]
  end
  subgraph Main["Main process (Node/Electron)"]
    GATE["gerbang.js\ncek login per kanal IPC"]
    IPC["ipc/*.ipc.js"]
    AUTH["auth/ (auth, session, password)"]
    SEC["security/ (dongle, dongleMonitor, wajah)"]
    CRY["crypto/ (vigenere, sdes, superCipher,\nfileCipher, stegano, keys)"]
    CHAIN["chain/ (blockchain, tambang, pow.worker)"]
    CHAT["chat/ (kunciPercakapan, amplop, media)"]
    DB["db/ (SQLite + dbCipher)"]
  end
  UI --> API --> GATE --> IPC
  IPC --> AUTH & SEC & CRY & CHAIN & CHAT & DB
  USB[("Flashdisk USB\n.svkey")] --> SEC
  CAM[("Kamera")] --> UI
```

Setiap kanal IPC (kecuali `app:ping`, `auth:status`, `auth:daftar`, `auth:masuk`, `auth:keluar`, `auth:wajah`, `dongle:status`) dibungkus `gerbang.js` sehingga **ditolak bila belum login penuh**.

---

## 3. Struktur Repositori

```
TA-Kriptoasik/
├── package.json            # skrip: start, test, test:watch
├── vitest.config.mjs       # konfigurasi pengujian (tests/**/*.test.js)
├── ALUR_PENGERJAAN.md      # catatan alur pengerjaan
├── COMMIT_HISTORY.md       # riwayat commit
├── src/
│   ├── main/               # proses utama Electron
│   │   ├── main.js         # titik masuk, BrowserWindow, izin kamera, --data-dir
│   │   ├── auth/
│   │   │   ├── auth.js         # daftar akun, login, lockout, turunkan kunci master
│   │   │   ├── session.js      # sesi di memori, kunci master, subkunci HMAC
│   │   │   └── password.js     # hash password PBKDF2
│   │   ├── security/
│   │   │   ├── dongle.js        # deteksi flashdisk (PowerShell), .svkey, tag HMAC
│   │   │   ├── dongleMonitor.js # pemantau pencabutan dongle
│   │   │   ├── wajah.js         # templat wajah terenkripsi, pencocokan embedding
│   │   │   └── protokolModel.js # protokol svmodel:// untuk model Human
│   │   ├── crypto/
│   │   │   ├── vigenere.js     # Vigenère mod 26
│   │   │   ├── sdes.js         # S-DES + mode CBC
│   │   │   ├── superCipher.js  # Vigenère -> S-DES CBC -> Base64
│   │   │   ├── fileCipher.js   # AES-256-GCM, format .svlt
│   │   │   ├── stegano.js      # LSB acak pada PNG
│   │   │   └── keys.js         # PBKDF2-HMAC-SHA256 (200.000 iterasi)
│   │   ├── chain/
│   │   │   ├── blockchain.js   # blok, hash, validasi, aturan transaksi
│   │   │   ├── tambang.js      # penambangan di worker thread
│   │   │   └── pow.worker.js   # pencarian nonce
│   │   ├── chat/
│   │   │   ├── kunciPercakapan.js # kunci percakapan dari passphrase bersama
│   │   │   ├── amplop.js          # amplop pesan .svmsg + HMAC
│   │   │   └── media.js           # pembungkus berkas/gambar untuk kontak
│   │   ├── db/
│   │   │   ├── db.js           # skema SQLite
│   │   │   ├── dbCipher.js     # ChaCha20-Poly1305
│   │   │   ├── percakapan.js   # percakapan dan riwayat pesan
│   │   │   └── pesanPenting.js # arsip pesan penting
│   │   └── ipc/                # penangan kanal IPC per fitur + gerbang.js
│   ├── preload/preload.js  # jembatan aman: window.api
│   └── renderer/           # tampilan (index.html, app.js, styles/app.css,
│                           #   wajah.js, wajah-ui.js)
├── tests/                  # pengujian Vitest per modul
└── tools/                  # skrip eksperimen (USB, WebSocket)
```

---

## 4. Alur Autentikasi dan Hierarki Kunci

### 4.1 Alur login

```mermaid
flowchart TD
  A[Masukkan username + password] --> B{Akun terkunci?}
  B -- ya --> X[Tolak: tunggu]
  B -- tidak --> C{Dongle cocok terpasang?}
  C -- tidak --> X2[Tolak: dongle tidak terpasang]
  C -- ya --> D{Password benar?}
  D -- tidak --> E[Gagal +1\n3x gagal = kunci 60 detik]
  D -- ya --> F[Turunkan kunci master]
  F --> G{Wajah terdaftar?}
  G -- tidak --> H[Sesi aktif]
  G -- ya --> I[Sesi tertunda: verifikasi wajah]
  I -- skor >= 0,6 --> H
  I -- gagal 5x --> X3[Sesi dibatalkan]
  H --> M[Pemantau dongle berjalan]
```

Faktor kegagalan dongle tidak dihitung sebagai salah password. Saat sesi berjalan, `dongleMonitor` memeriksa berkas `.svkey` **tiap 1 detik** dan serial flashdisk **tiap 10 detik**. Bila dongle dicabut, kunci dan sesi dihapus dari memori dan tampilan kembali ke layar login.

### 4.2 Hierarki kunci

```
password  ─┐
           ├─ "password \0 secret_hex" ──PBKDF2(200.000, kdf_salt)──► KUNCI MASTER (32 byte, hanya di memori)
secret .svkey (di flashdisk) ─┘                                          │
                                                                         ├─ HMAC("db")    → k_db   (ChaCha20-Poly1305 untuk isi basis data)
                                                                         └─ HMAC("wajah") → k_wajah (AES-256-GCM untuk templat wajah)
```

Karena `secret` ikut menurunkan kunci master, **data lokal tidak bisa dibuka tanpa flashdisk dongle**, walaupun password diketahui.

---

## 5. Algoritma yang Digunakan

### 5.1 Vigenère (mod 26) — `crypto/vigenere.js`

- Hanya huruf A–Z/a–z yang diubah; huruf besar/kecil dipertahankan, karakter lain dibiarkan.
- Kunci hanya huruf; posisi kunci maju **hanya saat menemui huruf**.
- Enkripsi: `C = (P + K) mod 26`, dekripsi: `P = (C − K) mod 26` (dengan `mod` yang selalu positif).

### 5.2 S-DES (Simplified DES) — `crypto/sdes.js`

- Blok 8 bit, kunci 10 bit, 2 putaran Feistel.
- **Pembangkit subkunci:** `P10` → pisah 2×5 bit → LS-1 → `P8` = **K1**; lanjut LS-2 → `P8` = **K2**.
- **Enkripsi blok:** `IP → f_K1 → swap → f_K2 → IP⁻¹`. Fungsi `F`: `EP(kanan) XOR subkunci → S0/S1 → P4`.
- **Dekripsi blok:** sama, dengan urutan subkunci dibalik (K2 dulu).
- **Mode CBC** (satu byte = satu blok, tanpa padding): `C[i] = E(P[i] XOR C[i−1])`, `C[0] = IV` (1 byte acak).

### 5.3 Super enkripsi teks — `crypto/superCipher.js`

```
Enkripsi: teks → Vigenère → UTF-8 → S-DES CBC (IV acak 1 byte) → Base64( IV || ciphertext )
Dekripsi: Base64 → pisah IV → S-DES CBC dekripsi → UTF-8 → Vigenère dekripsi
```

Kunci: Vigenère (huruf A–Z) dan S-DES (10 karakter `0/1`). Hasil juga mengembalikan `rincian` tiap tahap untuk ditampilkan di UI.

### 5.4 Enkripsi file — `crypto/fileCipher.js`

- Kunci: **PBKDF2-HMAC-SHA256**, 200.000 iterasi, salt 16 byte acak, keluaran 256 bit (passphrase minimal 8 karakter).
- Cipher: **AES-256-GCM**, IV 12 byte.
- Format berkas `.svlt`:

```
"SVLT1" (5) | salt (16) | iv (12) | tag (16) | ciphertext
ciphertext = AES-GCM( panjangNama (2 byte) | nama berkas asli | isi berkas )
```

`MAGIC + salt + iv` ikut diautentikasi sebagai AAD, sehingga header yang diubah ditolak. Ukuran maksimal 200 MB.

### 5.5 Enkripsi basis data — `db/dbCipher.js`

- **ChaCha20-Poly1305** (RFC 8439) lewat pustaka `@noble/ciphers` (BoringSSL milik Electron tidak menyediakannya via `crypto.createCipheriv`).
- Format: `nonce (12) | ciphertext | tag (16)`; AAD mengikat konteks (mis. `pesan-penting:<userId>`, `chat-pesan:<percakapanId>`), sehingga blob tidak bisa dipindah antar baris/pengguna.

### 5.6 Steganografi gambar — `crypto/stegano.js`

- Media: **PNG**, penyisipan pada **LSB kanal R, G, B** (alpha tidak disentuh).
- Pesan dienkripsi dulu dengan **AES-256-GCM** (kunci dari passphrase via PBKDF2).
- **Header 48 byte** di posisi berurutan: `salt (16) | iv (12) | tag (16) | panjang (4)`.
- **Isi ciphertext** disebar ke **posisi acak tanpa pengulangan** (Fisher-Yates sebagian, bilangan acak dari HMAC-SHA256 dengan penghitung, kunci diturunkan dari passphrase). Tanpa passphrase yang benar, posisi bit tidak bisa diketahui.
- Kualitas gambar dihitung dengan **PSNR**; kapasitas = `(piksel × 3 − 384) / 8` byte.

### 5.7 Blockchain sederhana — `chain/`

- Blok: `{ index, waktu, hashSebelumnya, data, nonce, hash }`.
- `hash = SHA-256( index | waktu | hashSebelumnya | JSON-stabil(data) | nonce )`; JSON diurutkan kuncinya agar hash deterministik.
- **Proof of Work:** hash harus diawali `000` (kesulitan 3). Penambangan berjalan di **worker thread** agar UI tidak membeku.
- Blok **genesis** tetap, sama di semua laptop.
- Transaksi:
  - `REGISTER` — mendaftarkan aset (ID unik `[A-Za-z0-9_-]{1,40}`).
  - `TRANSFER` — hanya pemilik saat ini yang boleh memindahkan aset.
- `validasiRantai` memeriksa genesis, urutan indeks, kecocokan hash, PoW, tautan `hashSebelumnya`, dan aturan transaksi, serta menunjuk **blok pertama yang rusak**. UI menyediakan fitur untuk sengaja merusak blok sebagai uji keamanan.
- Rantai disimpan di `rantai.json` pada folder data aplikasi.

### 5.8 Hash password — `auth/password.js`

PBKDF2-HMAC-SHA256, 210.000 iterasi, salt acak 16 byte, pembandingan `timingSafeEqual`. Username yang tidak ada tetap menjalankan hash agar waktu proses seragam.

### 5.9 Dongle USB — `security/dongle.js`

- Berkas `.svkey` di akar flashdisk berisi `secret` (32 byte acak).
- Basis data menyimpan `dongle_tag = HMAC-SHA256(kunci = secret, pesan = serial flashdisk)`.
- `.svkey` yang disalin ke flashdisk lain ditolak karena serial berbeda.
- Beberapa akun boleh memakai flashdisk yang sama (secret yang sudah ada dipakai ulang).

### 5.10 Pengenalan wajah — `security/wajah.js`, `renderer/wajah*.js`

- Pustaka **@vladmandic/human** di renderer menghasilkan **embedding 1024 angka**; model dilayani lewat protokol khusus `svmodel://`.
- Pendaftaran: 3–5 pengambilan yang harus saling mirip, lalu **dirata-ratakan** menjadi templat.
- Pencocokan: jarak kuadrat → skor kemiripan 0–1, **ambang 0,6**, maksimal 5 kegagalan.
- Templat disimpan **terenkripsi AES-256-GCM** dengan subkunci `wajah` dari kunci master.

---

## 6. Skema Basis Data

Berkas: `securevault.db` (SQLite) di folder data aplikasi.

| Tabel | Isi utama |
|---|---|
| `users` | username, hash password (salt, iterasi), `kdf_salt`, hitungan gagal + waktu kunci, `dongle_tag`, `wajah_embedding` (terenkripsi) |
| `pesan_penting` | arsip pesan penting per pengguna (`cipher` = label + isi terenkripsi) |
| `percakapan` | kontak, `kcv`, kunci master percakapan terenkripsi (`kunci_enc`), nomor urut kirim/terima |
| `pesan` | riwayat pesan: arah (masuk/keluar), `seq`, waktu, `penting`, isi terenkripsi |

---

## 7. Komunikasi Dua Laptop

Komunikasi dilakukan dengan **pertukaran berkas**, tanpa server.

### 7.1 Kunci percakapan

Kedua pengguna menyepakati **satu passphrase** di luar aplikasi. Kunci master percakapan:

```
master = PBKDF2( passphrase, salt = SHA256("securevault-percakapan-v1|" + sort(userA, userB))[0..16] )
```

Karena salt berasal dari dua username yang diurutkan, **kedua laptop menurunkan kunci yang sama tanpa saling mengirim apa pun**. Subkunci (HMAC-SHA256 dari master):

| Subkunci | Kegunaan |
|---|---|
| `mac` | stempel keaslian pesan |
| `kcv` | kode cek kunci 6 digit hex untuk dibandingkan di kedua laptop |
| `vigenere` | 12 huruf A–Z |
| `sdes` | 10 bit |
| `berkas` | passphrase pengganti untuk berkas `.svlt` |
| `gambar` | passphrase pengganti untuk steganografi |

### 7.2 Pesan teks (`.svmsg`)

```json
{ "v": 1, "dari": "...", "ke": "...", "seq": 1, "waktu": 0, "id": "...", "token": "...", "mac": "..." }
```

- `token` = hasil super enkripsi (Vigenère → S-DES CBC → Base64).
- `mac` = **HMAC-SHA256** atas semua bidang lain (*encrypt-then-MAC*). Algoritma klasik tidak mendeteksi perubahan data, jadi MAC inilah yang menolak pesan yang diubah atau yang memakai passphrase salah, **sebelum** dekripsi dijalankan.
- `seq` harus lebih besar dari nomor terakhir yang diterima, sehingga **pesan lama atau yang diimpor ulang (replay) ditolak**.
- Pemeriksaan tambahan: penerima (`ke`) dan pengirim (`dari`) harus sesuai percakapan.

### 7.3 Berkas dan gambar untuk kontak

- Berkas: format `.svlt` (AES-256-GCM) dengan kunci `kunci.berkas`.
- Gambar: pesan dienkripsi AES-256-GCM lalu disisipkan LSB dengan kunci `kunci.gambar`.

### 7.4 Alur

```mermaid
sequenceDiagram
  participant A as Laptop A
  participant M as Media pindah (flashdisk/email)
  participant B as Laptop B
  Note over A,B: Sepakati passphrase di luar aplikasi,\nlalu masing-masing buat percakapan\n(bandingkan KCV)
  A->>A: Tulis pesan → super enkripsi + HMAC → simpan .svmsg
  A->>M: Salin berkas
  M->>B: Terima berkas
  B->>B: Impor → cek tujuan, pengirim, HMAC, seq → dekripsi → riwayat
```

---

## 8. Prasyarat

- **Windows 10/11** (deteksi dongle memakai PowerShell; fitur lain relatif lintas platform, tetapi login memerlukan dongle)
- **Node.js 22.5 atau lebih baru** + npm (untuk pengujian dan instalasi; `node:sqlite` memerlukan Node 22.5+)
- **Git**
- **Flashdisk USB** (hanya satu terpasang saat membuat akun)
- **Webcam**, bila memakai verifikasi wajah

Dependensi (dipasang otomatis oleh `npm install`):

| Paket | Fungsi |
|---|---|
| `electron` (dev) | kerangka aplikasi desktop |
| `vitest` (dev) | pengujian |
| `@noble/ciphers` | ChaCha20-Poly1305 |
| `@vladmandic/human` | deteksi dan embedding wajah |
| `pngjs` | membaca/menulis PNG untuk steganografi |
| `ws` | WebSocket (dipakai skrip eksperimen di `tools/`) |

---

## 9. Clone dan Menjalankan Program

```bash
# 1. Clone
git clone https://github.com/anubluskrin/TA-Kriptoasik.git
cd TA-Kriptoasik

# 2. Pasang dependensi
npm install

# 3. Jalankan aplikasi
npm start
```

**Menguji dua akun di satu laptop** (data terpisah per folder):

```bash
npx electron . --data-dir=D:\tes-ujang
npx electron . --data-dir=D:\tes-budi
```

Tanpa `--data-dir`, aplikasi memakai folder data bawaan Electron (`userData`).

---

## 10. Panduan Penggunaan

1. **Buat akun**: colokkan **satu** flashdisk, isi username (3–30 karakter) dan password (8–100 karakter). Berkas `.svkey` ditulis ke flashdisk. **Jangan hilangkan flashdisk ini.**
2. **Login**: flashdisk harus terpasang, lalu username + password. Bila wajah sudah didaftarkan, lanjut ke verifikasi kamera.
3. **Daftarkan wajah** (opsional): menu *Face Recognition*, ambil 3–5 foto.
4. Fitur setelah login:

| Menu | Fungsi |
|---|---|
| Pesan | super enkripsi/dekripsi teks (Vigenère + S-DES) |
| File | enkripsi/dekripsi berkas ke `.svlt` |
| Gambar | sisipkan/ekstrak pesan rahasia di PNG |
| Aset | blockchain: daftarkan, transfer, validasi, uji perusakan blok |
| Chat | komunikasi dua laptop (lihat bagian 7) |
| Arsip | simpan pesan penting terenkripsi di basis data |
| Face Recognition | daftarkan/uji/hapus templat wajah |

5. **Mencabut flashdisk saat sesi berjalan** akan langsung mengunci aplikasi.

---

## 11. Menjalankan Pengujian

```bash
npm test            # sekali jalan (vitest run)
npm run test:watch  # mode pantau
```

Cakupan (`tests/`): `vigenere`, `sdes`, `superCipher`, `fileCipher`, `stegano`, `dbCipher`, `blockchain`, `auth`, `wajah`, `chat`, dan `wiring` (pengecekan penyambungan kanal IPC/preload).

---

## 12. Skrip Bantu (`tools/`)

Skrip eksperimen yang tidak dipakai langsung oleh aplikasi:

| Berkas | Fungsi |
|---|---|
| `usb-serial-test.js` | mencoba membaca daftar flashdisk dan serialnya (Windows) |
| `ws-server.js` | server WebSocket sederhana di port 8765 |
| `ws-client.js` | klien WebSocket untuk menguji server di atas |

```bash
node tools/usb-serial-test.js
node tools/ws-server.js
node tools/ws-client.js ws://localhost:8765 nama
```

---

## 13. Catatan Keamanan dan Batasan

- **Vigenère dan S-DES adalah algoritma klasik/edukasi** dan tidak aman untuk pemakaian nyata (S-DES: kunci hanya 10 bit, blok 1 byte, IV 1 byte). Keamanan pesan teks di chat sebenarnya ditopang oleh **HMAC-SHA256 (encrypt-then-MAC)**.
- Berkas, gambar, dan basis data memakai algoritma modern (AES-256-GCM, ChaCha20-Poly1305).
- Kekuatan chat bergantung pada **kekuatan passphrase bersama** dan bagaimana passphrase itu dibagikan.
- Deteksi dongle **khusus Windows**.
- Pemantauan dongle dan verifikasi wajah berjalan di sisi aplikasi; wajah bukan pengganti kriptografi, hanya lapisan autentikasi tambahan. Tidak ada deteksi *liveness* (antispoof dimatikan).
- Folder data pengguna (`data/`, `*.db`, `*.svkey`, `.env`) sudah dikecualikan di `.gitignore`.

---

## Lisensi

ISC (lihat `package.json`).
