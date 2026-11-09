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
   - **Cara cek berhasil:** apa yang harus terlihat di aplikasi.
   - **Kalau error:** kesalahan yang paling sering muncul.
3. **Tanpa berkas tes.** Setiap step langsung membangun program inti, dan hasilnya dicek dengan menjalankan aplikasi (`npm start`) lalu melihat layar. Untuk algoritma kriptografi, aku berikan **nilai contoh baku** (misalnya `ATTACKATDAWN` + `LEMON` = `LXFOPVEFRNHR`) yang bisa kamu ketik sendiri di aplikasi dan cocokkan hasilnya.
4. **Tanpa emoticon** di kode, komentar, teks tampilan, maupun dokumen proyek.
5. Kalau ada yang tidak dipahami, bilang **"bingung"** dan aku jelaskan ulang dengan cara lebih sederhana.
6. Kalau ada error, tempel pesan error-nya. Aku akan menunjukkan **file mana, bagian mana, dan sebelum/sesudahnya**, tanpa memberi ulang seluruh file.
7. Setelah step berhasil, **commit ke Git** (`git commit -m "step 1.3: kerangka aplikasi"`), baru lanjut.
8. Kita **tidak melompati step**.

---

## 2. Gambaran Besar

```
FASE 0  Persiapan + uji risiko                (SELESAI)
FASE 1  Kerangka aplikasi + algoritma teks    → Vigenere, S-DES, super enkripsi langsung di aplikasi
FASE 2  Fitur kripto lain di aplikasi         → file, steganografi, blockchain (kunci diisi manual dulu)
FASE 3  Database + login 3 faktor             → SQLite, password, dongle, wajah, sesi
FASE 4  Kontak dan komunikasi antar laptop    → passphrase bersama, amplop ber-MAC, tukar berkas
FASE 5  Relay jaringan (opsional)             → komunikasi langsung lewat WebSocket
FASE 6  Integrasi, uji manual, laporan, demo
```

**Prinsip urutan:** setiap fitur dibuat sebagai **halaman di aplikasi** sejak awal, dengan kunci diisi manual. Dengan begitu hasilnya langsung terlihat tanpa tes terpisah, dan halaman-halaman itu nanti tetap berguna sebagai bahan demonstrasi algoritma saat presentasi. Fitur login dan kunci turunan dipasang setelahnya, membungkus fitur yang sudah jalan.

---

## 3. Daftar Instalasi

Semua dipasang **saat step-nya tiba**, lengkap dengan caranya.

| Alat | Dipakai mulai | Catatan singkat |
|---|---|---|
| **Node.js LTS**, **Git**, **VS Code** | Sudah ada | |
| **Electron** | Sudah ada | |
| **vitest** | Sudah terpasang (Step 1.1) | Tidak dipakai lagi. Dibiarkan saja |
| **ws** | Sudah ada (Step 0.6) | Dipakai di Fase 5 |
| **pngjs** | Step 2.2 | Lewat `npm install` |
| **better-sqlite3** + **@electron/rebuild** | Step 3.1 | Lewat `npm install`. Bila gagal kompilasi, perlu *Visual Studio Build Tools* (dijelaskan saat itu) |
| **@vladmandic/human** | Step 3.6 | Lewat `npm install`, plus berkas model |
| **drivelist** | Step 3.4 | Lewat `npm install` |

---

## 4. Rincian Fase dan Step

Estimasi waktu hanya perkiraan kasar untuk satu orang; sesuaikan dengan jadwal tim.

### FASE 0: Persiapan dan Uji Risiko (SELESAI)

| Step | Hasil |
|---|---|
| 0.1-0.3 | Node.js, Git, proyek, dan Electron beres |
| 0.4 | Webcam di Electron beres |
| 0.5 | Serial flashdisk SanDisk terbaca |
| 0.6 | Koneksi WebSocket dua laptop beres (port 8765) |

### FASE 1: Kerangka Aplikasi dan Algoritma Teks (±1 minggu)

| Step | Yang dikerjakan | Cara cek berhasil di aplikasi |
|---|---|---|
| 1.1 | Setup vitest | **Selesai** |
| 1.2 | Modul `vigenere.js` (mod 26) | **Selesai** |
| 1.3 | Kerangka aplikasi: susun folder `src/main`, `src/preload`, `src/renderer`; preload aman; satu kanal IPC; tampilan dengan menu samping | Jendela punya menu samping, dan tombol uji memanggil proses main lalu menampilkan balasan |
| 1.4 | Halaman **Vigenère**: isi teks dan kunci, tombol enkripsi dan dekripsi | `ATTACKATDAWN` + `LEMON` menghasilkan `LXFOPVEFRNHR`, dan dekripsi mengembalikannya |
| 1.5 | Modul `sdes.js` bagian 1: tabel permutasi dan pembangkit subkunci K1, K2. Halaman **S-DES** menampilkan subkunci | Kunci contoh menampilkan K1 dan K2 sesuai nilai yang kuberikan |
| 1.6 | `sdes.js` bagian 2: enkripsi dan dekripsi satu blok | Kunci `1010000010`, plaintext `01110010` menghasilkan `01110111`, dan dekripsi mengembalikannya |
| 1.7 | `sdes.js` bagian 3: mode CBC | Teks pendek terenkripsi lalu terdekripsi; IV berbeda menghasilkan ciphertext berbeda |
| 1.8 | Halaman **Pesan Teks**: super enkripsi (Vigenère lalu S-DES lalu Base64), kunci diisi manual | Pesan dengan huruf beraksen dan baris baru kembali identik setelah dekripsi |

### FASE 2: Fitur Kripto Lain di Aplikasi (±1 minggu)

Kunci diisi manual (passphrase) dulu. Integrasi dengan login dilakukan di Fase 3.

| Step | Yang dikerjakan | Cara cek berhasil di aplikasi |
|---|---|---|
| 2.1 | `keys.js` (PBKDF2, subkunci) + halaman **File**: enkripsi dan dekripsi file dengan AES-256-GCM (format `.svlt`) | File terenkripsi lalu terbuka kembali identik; file yang diubah ditolak |
| 2.2 | Halaman **Gambar**: steganografi LSB pada PNG dan tampilan PSNR | Pesan tersisip dan terekstrak; PSNR di atas 40 dB |
| 2.3 | Halaman **Aset**: blockchain (blok, proof-of-work di `worker_threads`, validasi rantai) | Register dan transfer aset berjalan; data blok diubah, validasi menunjuk blok rusak |

### FASE 3: Database dan Login 3 Faktor (±1,5 minggu)

| Step | Yang dikerjakan | Cara cek berhasil di aplikasi |
|---|---|---|
| 3.1 | Pasang `better-sqlite3` + `@electron/rebuild`, buat `schema.sql` dan akses tabel `users` | Berkas database terbentuk dengan semua tabel |
| 3.2 | Mode `--setup`: buat akun admin dengan password ter-hash (`password.js`, PBKDF2) | `npm run setup` membuat user di database |
| 3.3 | Halaman **Login** (password) + penguncian sementara setelah 3 kali gagal | Password benar masuk, salah ditolak, percobaan ke-3 mengunci akun |
| 3.4 | `dongle.js`: daftar flashdisk dan baca serial | Aplikasi menampilkan flashdisk yang dicolok |
| 3.5 | Enrollment dongle (tulis `.svkey`, simpan `dongle_tag`), verifikasi, dan pemantau pencabutan | Cabut flashdisk, aplikasi terkunci |
| 3.6 | `faceCapture.js`: webcam + Human menghasilkan embedding | Satu wajah menghasilkan vektor angka |
| 3.7 | Daftar wajah (enroll) dan verifikasi, kalibrasi ambang | Wajah sendiri lolos, wajah lain ditolak |
| 3.8 | `session.js`: master key, penghapusan kunci saat logout, dan gerbang login (dongle, password, wajah) yang membungkus semua halaman | Tiga faktor berjalan berurutan; tanpa login halaman fitur tidak bisa dibuka |
| 3.9 | `dbCipher.js` (ChaCha20-Poly1305): simpan pesan penting terenkripsi di database | Pesan penting di database tampil sebagai teks acak; terbuka kembali di aplikasi |

### FASE 4: Kontak dan Komunikasi Antar Laptop (±1 minggu)

| Step | Yang dikerjakan | Cara cek berhasil di aplikasi |
|---|---|---|
| 4.1 | Kontak dan percakapan: masukkan passphrase, tampilkan **kode cek kunci** | Dua laptop menampilkan kode yang sama |
| 4.2 | `envelope.js`: amplop pesan ber-MAC | Pesan dengan passphrase salah atau yang diubah ditolak dengan alasan jelas |
| 4.3 | Kirim dan baca pesan teks antar pengguna, tandai "penting" | Pesan tersimpan di database dan tampil di daftar |
| 4.4 | Ekspor dan impor `.svmsg` (komunikasi Tahap 1) | Pesan dari laptop A terbaca di laptop B |
| 4.5 | Kirim file dan gambar stego ke kontak dengan kunci percakapan | File dan gambar dari laptop A terbuka di laptop B |
| 4.6 | Ekspor dan impor rantai (`.svchain`) | Rantai laptop A bisa diimpor laptop B |

### FASE 5: Relay Jaringan (opsional, ±3-4 hari)

Dikerjakan hanya bila Fase 0-4 sudah stabil.

| Step | Yang dikerjakan | Cara cek berhasil di aplikasi |
|---|---|---|
| 5.1 | `server/relay.js` (simpan-dan-teruskan) | Dua client terhubung, relay meneruskan pesan |
| 5.2 | `relayClient.js`: outbox dan sambung ulang otomatis | Relay dimatikan lalu dihidupkan, pesan tertunda terkirim |
| 5.3 | Sinkronisasi rantai lewat relay | Blok baru di laptop A muncul di laptop B |

### FASE 6: Integrasi, Uji Manual, Laporan, Demo (±1 minggu)

| Step | Yang dikerjakan | Cara cek berhasil |
|---|---|---|
| 6.1 | Uji alur penuh di dua laptop | Skenario demo berjalan tanpa error |
| 6.2 | Uji serangan secara manual (tabel pengujian di `README_JS.md` bagian 15) | Semua baris tabel terpenuhi |
| 6.3 | Periksa daftar keamanan Electron | Semua poin di bagian 5 README terpenuhi |
| 6.4 | (Opsional) bungkus jadi installer dengan `electron-builder` | Aplikasi jalan tanpa `npm start` |
| 6.5 | Tulis laporan | Sesuai kerangka bagian 18 README |
| 6.6 | Latihan demo dan rencana cadangan | Demo bisa dijalankan dua kali berturut-turut tanpa masalah |

---

## 5. Pemetaan ke Kriteria Dosen

| Kriteria di slide | Dipenuhi di step |
|---|---|
| Login biometrik + hanya hidup dengan dongle | 3.4-3.8 |
| Login memakai algoritma kriptografi | 3.2-3.3 |
| Pesan teks: super enkripsi (Vigenère + S-DES) | 1.2-1.8, 4.3 |
| Pesan file: kriptografi beda dari teks | 2.1, 4.5 |
| Pesan penting dienkripsi di basis data | 3.9, 4.3 |
| Pesan gambar: steganografi | 2.2, 4.5 |
| Aset penting: blockchain sederhana | 2.3, 4.6 |
| Laporan dan presentasi | 6.5-6.6 |
| (Tambahan tim) Komunikasi 2 arah antar laptop | 4.1-4.4, Fase 5 |

---

## 6. Perkiraan Jadwal 6 Minggu

| Minggu | Isi |
|---|---|
| 1 | Fase 0 (selesai) dan Fase 1 |
| 2 | Fase 2 dan awal Fase 3 (3.1-3.3) |
| 3 | Step 3.4-3.5 (dongle) dan 3.6-3.7 (wajah) |
| 4 | Step 3.8-3.9 dan Fase 4 |
| 5 | Sisa Fase 4 dan Fase 5 bila sempat |
| 6 | Fase 6 |

Tanggal UAS dan jadwal presentasi belum kita masukkan. Setelah kamu tahu tanggalnya, jadwal ini kita sesuaikan.

---

## 7. Risiko dan Rencana Cadangan

| Risiko | Gejala | Rencana cadangan |
|---|---|---|
| Wajah sulit dikenali | Step 3.6 atau 3.7 tidak stabil | Coba library wajah lain; cadangan terakhir: biometrik *keystroke dynamics* (ritme mengetik), tanpa hardware |
| Serial flashdisk tidak andal | Serial kosong atau sama antar unit | Pakai *volume serial number* sebagai pengganti, catat sebagai batasan |
| `better-sqlite3` gagal dipasang | Error kompilasi di Step 3.1 | Pasang Visual Studio Build Tools; bila tetap gagal, kita bahas alternatif SQLite lain saat itu |
| Dua laptop tidak bisa terhubung | Pesan tidak sampai | Pakai hotspot HP; cadangan: komunikasi Tahap 1 (tukar berkas `.svmsg`) |
| Algoritma salah tanpa terdeteksi | Hasil tampak benar tapi menyimpang | Selalu cocokkan dengan nilai contoh baku yang diberikan di tiap step; jalankan tabel uji manual di Step 6.2 |
| Waktu mepet | Jadwal tertinggal | Urutan dipotong dari belakang: relay (Fase 5), anti-spoofing wajah, sinkronisasi rantai. Kriteria wajib dari dosen tetap dikerjakan |

---

## 8. Aturan Git Sederhana

- Satu folder proyek, satu repository.
- **Satu commit per step**, pesan singkat: `step 1.3: kerangka aplikasi`.
- Kalau bekerja bertiga: buat branch per anggota (`git checkout -b nama-fitur`), gabungkan ke `main` lewat GitHub Desktop setelah hasilnya dicek di aplikasi.
- Jangan pernah commit: folder `node_modules/`, folder `data/`, berkas `.svkey`, dan database `.db`. Semuanya sudah ada di `.gitignore`.

---