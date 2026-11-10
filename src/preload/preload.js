const { contextBridge, ipcRenderer } = require('electron');

// Hanya fungsi di bawah ini yang bisa dipanggil oleh tampilan lewat window.api
contextBridge.exposeInMainWorld('api', {
  ping: (pesan) => ipcRenderer.invoke('app:ping', pesan),
  pesanEnkripsi: (teks, kunciVigenere, kunciSdes) =>
    ipcRenderer.invoke('pesan:enkripsi', teks, kunciVigenere, kunciSdes),
  pesanDekripsi: (teks, kunciVigenere, kunciSdes) =>
    ipcRenderer.invoke('pesan:dekripsi', teks, kunciVigenere, kunciSdes),
  fileEnkripsi: (passphrase) => ipcRenderer.invoke('file:enkripsi', passphrase),
  fileDekripsi: (passphrase) => ipcRenderer.invoke('file:dekripsi', passphrase),

  gambarSisipkan: (pesan, passphrase) => ipcRenderer.invoke('gambar:sisipkan', pesan, passphrase),
  gambarEkstrak: (passphrase) => ipcRenderer.invoke('gambar:ekstrak', passphrase),

  asetStatus: () => ipcRenderer.invoke('aset:status'),
  asetDaftarkan: (idAset, nama, pemilik) => ipcRenderer.invoke('aset:daftarkan', idAset, nama, pemilik),
  asetTransfer: (idAset, dari, ke) => ipcRenderer.invoke('aset:transfer', idAset, dari, ke),
  asetValidasi: () => ipcRenderer.invoke('aset:validasi'),
  asetRusakkan: (nomor, nilai) => ipcRenderer.invoke('aset:rusakkan', nomor, nilai),
  asetReset: () => ipcRenderer.invoke('aset:reset'),

  authStatus: () => ipcRenderer.invoke('auth:status'),
  authDaftar: (username, password) => ipcRenderer.invoke('auth:daftar', username, password),
  authMasuk: (username, password) => ipcRenderer.invoke('auth:masuk', username, password),
  authKeluar: () => ipcRenderer.invoke('auth:keluar'),
  arsipSimpan: (label, isi) => ipcRenderer.invoke('arsip:simpan', label, isi),
  arsipDaftar: () => ipcRenderer.invoke('arsip:daftar'),
  arsipBuka: (id) => ipcRenderer.invoke('arsip:buka', id),

  dongleStatus: () => ipcRenderer.invoke('dongle:status'),

  authWajah: (embedding) => ipcRenderer.invoke('auth:wajah', embedding),
  wajahStatus: () => ipcRenderer.invoke('wajah:status'),
  wajahDaftar: (daftar) => ipcRenderer.invoke('wajah:daftar', daftar),
  wajahUji: (embedding) => ipcRenderer.invoke('wajah:uji', embedding),
  wajahHapus: () => ipcRenderer.invoke('wajah:hapus'),

  onDongleDicabut: (pemanggil) => ipcRenderer.on('event:dongle-dicabut', () => pemanggil()),

  chatDaftar: () => ipcRenderer.invoke('chat:daftar'),
  chatBuat: (kontak, passphrase) => ipcRenderer.invoke('chat:buat', kontak, passphrase),
  chatKirim: (id, teks, penting) => ipcRenderer.invoke('chat:kirim', id, teks, penting),
  chatImpor: () => ipcRenderer.invoke('chat:impor'),
  chatRiwayat: (id) => ipcRenderer.invoke('chat:riwayat', id),
  
});