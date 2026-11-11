# SecureVault (Versi JavaScript / Electron)

Aplikasi desktop kriptografi untuk Tugas Akhir Kriptografi. Satu aplikasi yang menggabungkan autentikasi berlapis (dongle flashdisk, password, biometrik wajah), super enkripsi teks (Vigenère + S-DES), enkripsi file, enkripsi basis data, steganografi gambar, blockchain sederhana, dan **komunikasi dua arah antar dua laptop**.

> Nama "SecureVault" masih sementara. Dokumen ini adalah rancangan dan dokumentasi untuk implementasi **JavaScript dengan Electron**.

**Keputusan yang sudah disepakati tim:**
- Bahasa/platform: JavaScript dengan Electron.
- Super enkripsi teks: Vigenère (**mod 26**, keputusan 9 November 2026) lalu S-DES mode CBC.
- Kesepakatan kunci antar laptop: **passphrase bersama** (kedua pengguna menyepakati passphrase di luar aplikasi), karena tidak ada algoritma klasik yang asimetris.

> **Penting:** ini harus **aplikasi desktop (Electron)**, bukan web biasa di browser. Browser tidak bisa membaca serial number flashdisk dan tidak bisa mendeteksi pencabutannya, sehingga syarat dongle tidak terpenuhi.

