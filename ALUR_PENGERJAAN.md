# Alur Pengerjaan SecureVault (JavaScript / Electron)

Dokumen ini adalah **peta jalan** pengerjaan proyek, dari komputer kosong sampai demo. Rancangan teknisnya ada di `README_JS.md`; dokumen ini menjawab pertanyaan **"mulai dari mana dan urutannya bagaimana"**.

---

## 1. Cara Kerja Kita (Step by Step)

1. Kamu bilang **"lanjut"**, aku kirim **satu step saja**.
2. Setiap step selalu berisi:
   - **Tujuan:** apa yang dicapai dan kenapa.
   - **Pasang apa:** bila perlu, lengkap dengan cara instalasi.
   - **Langkah:** urutan yang dikerjakan.
   - **Kode:** potongan kode secukupnya.
   - **Cara cek berhasil:** bagaimana kamu tahu step ini selesai.
   - **Kalau error:** kesalahan yang paling sering muncul.
3. Kalau ada yang tidak dipahami, bilang **"bingung"** dan aku jelaskan ulang dengan cara lebih sederhana.
4. Kalau ada error, tempel pesan error-nya. Aku akan menunjukkan **file mana, bagian mana, dan sebelum/sesudahnya**, tanpa memberi ulang seluruh file.
5. Setelah step berhasil, **commit ke Git** (`git commit -m "step 1.2: vigenere"`), baru lanjut.
6. Kita **tidak melompati step**. Urutan sengaja dibuat supaya setiap step punya dasar yang sudah teruji.

---

## 2. Gambaran Besar

```
FASE 0  Persiapan + uji risiko        → pastikan webcam, flashdisk, 2 laptop bisa dipakai
FASE 1  Fondasi kriptografi (tanpa UI) → semua algoritma jalan dan lulus tes
FASE 2  Kerangka Electron + database   → aplikasi bisa dibuka dan menyimpan data
FASE 3  Login 3 faktor                 → dongle + password + wajah
FASE 4  Fitur utama                    → kontak, pesan, file, gambar, blockchain
FASE 5  Relay jaringan (opsional)      → komunikasi langsung antar laptop
FASE 6  Integrasi, uji, laporan, demo
```

**Prinsip urutan:** kriptografi dikerjakan **sebelum** UI. Algoritma lebih mudah dites sendirian dengan `vitest`, dan kalau sudah benar, UI tinggal memanggilnya.

---

## 3. Daftar Instalasi

Semua dipasang **saat step-nya tiba**, lengkap dengan caranya. Ini hanya gambaran awal.

| Alat | Dipakai mulai | Catatan singkat |
|---|---|---|
| **Node.js LTS** | Step 0.1 | Unduh installer dari nodejs.org, pilih versi LTS. Cek dengan `node -v` |
| **Git** | Step 0.1 | Unduh dari git-scm.com. GitHub Desktop yang sudah kamu punya tidak otomatis menyediakan perintah `git` di terminal |
| **VS Code** | Sudah ada | Editor utama |
| **Electron** | Step 0.3 | Lewat `npm install`, tidak perlu installer terpisah |
| **vitest** | Step 1.1 | Lewat `npm install` |
| **better-sqlite3** + **@electron/rebuild** | Step 2.3 | Lewat `npm install`. Bila gagal kompilasi, perlu *Visual Studio Build Tools* (dijelaskan saat itu) |
| **pngjs** | Step 1.12 | Lewat `npm install` |
| **@vladmandic/human** | Step 3.6 | Lewat `npm install`, plus berkas model |
| **drivelist**, **ws** | Step 3.1 dan 0.6 | Lewat `npm install` |
| **PowerShell** | Step 0.5 | Sudah ada di Windows |

---

## 4. Rincian Fase dan Step

Estimasi waktu hanya perkiraan kasar untuk satu orang; sesuaikan dengan jadwal tim.

### FASE 0: Persiapan dan Uji Risiko (±2-3 hari)

Tujuan fase ini: memastikan tiga hal yang paling berisiko **benar-benar bisa** di laptop demo, sebelum kita membangun apa pun.

| Step | Yang dikerjakan | Cara cek berhasil | Pasang |
|---|---|---|---|
| 0.1 | Pasang Node.js LTS dan Git | `node -v`, `npm -v`, `git --version` tampil | Node.js, Git |
| 0.2 | Buat folder proyek, `git init`, `npm init`, `.gitignore` | Ada `package.json`, commit pertama tercatat | - |
| 0.3 | Pasang Electron, tampilkan jendela kosong | `npm start` membuka jendela | electron |
| 0.4 | **Uji risiko 1:** buka webcam di jendela Electron | Video webcam tampil | - |
| 0.5 | **Uji risiko 2:** baca serial number flashdisk lewat PowerShell | Serial flashdisk tercetak di terminal | - |
| 0.6 | **Uji risiko 3:** dua laptop saling kirim "ping" lewat hotspot | Laptop B menerima pesan dari laptop A | ws, butuh laptop kedua |

**Jika salah satu uji gagal**, kita putuskan solusinya di sini (lihat bagian 7).

### FASE 1: Fondasi Kriptografi (±1,5 minggu)

Semua di folder `src/main/crypto/` dan `src/main/security/`, **tanpa UI**, diuji dengan `vitest`.

| Step | Yang dikerjakan | Cara cek berhasil |
|---|---|---|
| 1.1 | Siapkan `vitest` dan struktur folder `crypto/`, `tests/` | `npm test` jalan (walau belum ada tes) |
| 1.2 | `vigenere.js` (mod 95) | Tes: enkripsi lalu dekripsi kembali ke teks asal |
| 1.3 | `sdes.js` bagian 1: tabel permutasi, pembangkit subkunci K1 dan K2 | Tes subkunci sesuai hitungan manual |
| 1.4 | `sdes.js` bagian 2: enkripsi/dekripsi satu blok | **Vektor uji:** K=1010000010, P=01110010 → C=01110111 |
| 1.5 | `sdes.js` bagian 3: mode CBC | Round-trip lulus, IV berbeda menghasilkan ciphertext berbeda |
| 1.6 | `superCipher.js` (Vigenère lalu S-DES) | Round-trip teks, termasuk emoji dan baris baru |
| 1.7 | `keys.js`: PBKDF2, subkey, kunci percakapan | Input sama → kunci sama; input beda → kunci beda |
| 1.8 | `password.js`: hash dan verifikasi password | Password benar lolos, salah ditolak |
| 1.9 | `dbCipher.js`: ChaCha20-Poly1305 | Round-trip lulus, ubah 1 byte → ditolak |
| 1.10 | `fileCipher.js`: AES-256-GCM per chunk, format `.svlt` | File kecil dan besar kembali identik; file diubah → ditolak |
| 1.11 | `envelope.js`: amplop pesan + MAC | MAC salah ditolak; `seq` ulang ditolak |
| 1.12 | `stego.js`: LSB + PSNR | Pesan tersisip dan terekstrak identik; PSNR > 40 dB |
| 1.13 | `block.js` dan `chain.js`: blok, PoW, validasi rantai | Ubah 1 blok → validasi menunjuk blok rusak |

### FASE 2: Kerangka Electron dan Database (±3-4 hari)

| Step | Yang dikerjakan | Cara cek berhasil |
|---|---|---|
| 2.1 | Susun `src/main`, `src/preload`, `src/renderer`; konfigurasi aman (`contextIsolation`, CSP) | Jendela terbuka dengan konfigurasi aman |
| 2.2 | Preload + satu kanal IPC percobaan (`ping`) | Tombol di UI memanggil main dan menampilkan balasan |
| 2.3 | Pasang `better-sqlite3` + `@electron/rebuild`, buat `schema.sql` | Berkas database terbentuk dengan semua tabel |
| 2.4 | `repositories.js` untuk tabel `users` | Bisa menambah dan membaca user lewat kode |
| 2.5 | Mode `--setup`: buat akun admin pertama | `npm run setup` membuat user di database |

### FASE 3: Login 3 Faktor (±1,5 minggu)

| Step | Yang dikerjakan | Cara cek berhasil |
|---|---|---|
| 3.1 | `dongle.js`: daftar flashdisk + baca serial | Aplikasi mengenali flashdisk yang dicolok |
| 3.2 | Enrollment dongle: tulis `.svkey`, simpan `dongle_tag` | File `.svkey` muncul di flashdisk |
| 3.3 | Verifikasi dongle + pemantau pencabutan | Cabut flashdisk → aplikasi terkunci |
| 3.4 | Login password (UI + IPC) | Password benar masuk, salah ditolak |
| 3.5 | `lockout.js`: kunci sementara setelah 3 kali gagal | Percobaan ke-3 mengunci akun |
| 3.6 | `faceCapture.js`: webcam + Human menghasilkan embedding | Satu wajah menghasilkan vektor angka |
| 3.7 | Daftar wajah (enroll) + verifikasi, kalibrasi ambang | Wajah sendiri lolos, wajah lain ditolak |
| 3.8 | `session.js`: master key, penghapusan kunci saat logout | Setelah logout, kunci di memori terhapus |
| 3.9 | Gabungkan alur: dongle → password → wajah → dashboard | Tiga faktor berjalan berurutan |

### FASE 4: Fitur Utama (±1,5 minggu)

| Step | Yang dikerjakan | Cara cek berhasil |
|---|---|---|
| 4.1 | Kerangka Dashboard dan navigasi | Menu ke semua fitur tampil |
| 4.2 | Kontak + percakapan: masukkan passphrase, tampilkan **kode cek kunci** | Dua laptop (atau dua akun) menampilkan kode yang sama |
| 4.3 | Kirim dan baca pesan teks, tandai "penting" | Pesan tersimpan terenkripsi; pesan penting dibungkus ChaCha20 |
| 4.4 | Ekspor/impor `.svmsg` (komunikasi Tahap 1) | Pesan dari laptop A terbaca di laptop B |
| 4.5 | UI enkripsi/dekripsi file | File terenkripsi dan terbuka kembali |
| 4.6 | UI steganografi + tampilan PSNR | Pesan tersisip di PNG dan terekstrak |
| 4.7 | UI blockchain + mining di `worker_threads` | Register dan transfer aset; tombol "Validasi Rantai" |
| 4.8 | Ekspor/impor rantai (`.svchain`) | Rantai laptop A bisa diimpor laptop B |

### FASE 5: Relay Jaringan (opsional, ±3-4 hari)

Dikerjakan hanya bila Fase 0-4 sudah stabil.

| Step | Yang dikerjakan | Cara cek berhasil |
|---|---|---|
| 5.1 | `server/relay.js` (simpan-dan-teruskan) | Dua client terhubung, relay meneruskan pesan |
| 5.2 | `relayClient.js`: outbox + auto-reconnect | Relay dimatikan lalu dihidupkan → pesan tertunda terkirim |
| 5.3 | Sinkronisasi rantai lewat relay | Blok baru di laptop A muncul di laptop B |

### FASE 6: Integrasi, Uji, Laporan, Demo (±1 minggu)

| Step | Yang dikerjakan | Cara cek berhasil |
|---|---|---|
| 6.1 | Uji alur penuh di dua laptop | Skenario demo berjalan tanpa error |
| 6.2 | Uji serangan (tabel pengujian di `README_JS.md` bagian 15) | Semua baris tabel terpenuhi |
| 6.3 | Periksa daftar keamanan Electron | Semua poin di bagian 5 README terpenuhi |
| 6.4 | (Opsional) bungkus jadi installer dengan `electron-builder` | Aplikasi jalan tanpa `npm start` |
| 6.5 | Tulis laporan | Sesuai kerangka bagian 18 README |
| 6.6 | Latihan demo + rencana cadangan | Demo bisa dijalankan dua kali berturut-turut tanpa masalah |

---

## 5. Pemetaan ke Kriteria Dosen

| Kriteria di slide | Dipenuhi di step |
|---|---|
| Login biometrik + hanya hidup dengan dongle | 3.1-3.3, 3.6-3.7, 3.9 |
| Login memakai algoritma kriptografi | 1.8, 3.4 |
| Pesan teks: super enkripsi (Vigenère + S-DES) | 1.2-1.6, 4.3 |
| Pesan file: kriptografi beda dari teks | 1.10, 4.5 |
| Pesan penting dienkripsi di basis data | 1.9, 4.3 |
| Pesan gambar: steganografi | 1.12, 4.6 |
| Aset penting: blockchain sederhana | 1.13, 4.7-4.8 |
| Laporan dan presentasi | 6.5-6.6 |
| (Tambahan tim) Komunikasi 2 arah antar laptop | 1.7, 1.11, 4.2, 4.4, Fase 5 |

---

## 6. Perkiraan Jadwal 6 Minggu

| Minggu | Isi |
|---|---|
| 1 | Fase 0 dan Step 1.1-1.6 |
| 2 | Step 1.7-1.13 dan Fase 2 |
| 3 | Step 3.1-3.5 (dongle dan password) |
| 4 | Step 3.6-3.9 (wajah, sesi) dan Step 4.1-4.3 |
| 5 | Step 4.4-4.8 dan Fase 5 bila sempat |
| 6 | Fase 6 |

Tanggal UAS dan jadwal presentasi belum kita masukkan. Setelah kamu tahu tanggalnya, jadwal ini kita sesuaikan.

---

## 7. Risiko dan Rencana Cadangan

| Risiko | Gejala | Rencana cadangan |
|---|---|---|
| Webcam/wajah bermasalah | Step 0.4 atau 3.6 gagal | Coba library wajah lain; cadangan terakhir: biometrik *keystroke dynamics* (ritme mengetik), tanpa hardware |
| Serial flashdisk tidak terbaca | Step 0.5 gagal | Pakai *volume serial number* (`vol E:`) sebagai pengganti, catat sebagai batasan |
| `better-sqlite3` gagal dipasang | Error kompilasi di Step 2.3 | Pasang Visual Studio Build Tools; bila tetap gagal, kita bahas alternatif SQLite lain saat itu |
| Dua laptop tidak bisa terhubung | Step 0.6 gagal | Pakai hotspot HP; cadangan: komunikasi Tahap 1 (tukar berkas `.svmsg`) |
| Waktu mepet | Jadwal tertinggal | Urutan dipotong dari belakang: relay (Fase 5) → anti-spoofing wajah → sinkronisasi rantai. Kriteria wajib dari dosen tetap dikerjakan |

---

## 8. Aturan Git Sederhana

- Satu folder proyek, satu repository.
- **Satu commit per step**, pesan singkat: `step 1.2: vigenere`.
- Kalau bekerja bertiga: buat branch per anggota (`git checkout -b nama-fitur`), gabungkan ke `main` lewat GitHub Desktop setelah tes lulus.
- Jangan pernah commit: folder `node_modules/`, folder `data/`, berkas `.svkey`, dan database `.db`. Semuanya masuk `.gitignore` di Step 0.2.

---

## 9. Mulai dari Mana?

**Step 0.1: Pasang Node.js LTS dan Git.**

Bilang **"lanjut"** dan aku kirim Step 0.1.
