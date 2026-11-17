const { contextBridge, ipcRenderer } = require('electron');

// Hanya fungsi di bawah ini yang bisa dipanggil oleh tampilan lewat window.api
contextBridge.exposeInMainWorld('api', {
  ping: (pesan) => ipcRenderer.invoke('app:ping', pesan),
  pesanEnkripsi: (teks, kunciVigenere, kunciDes) =>
    ipcRenderer.invoke('pesan:enkripsi', teks, kunciVigenere, kunciDes),
  pesanDekripsi: (teks, kunciVigenere, kunciDes) =>
    ipcRenderer.invoke('pesan:dekripsi', teks, kunciVigenere, kunciDes),
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
  authDaftarWajah: (daftar) => ipcRenderer.invoke('auth:daftarWajah', daftar),
  authUjiWajah: (embedding) => ipcRenderer.invoke('auth:ujiWajah', embedding),
  authSelesaiDaftarWajah: () => ipcRenderer.invoke('auth:selesaiDaftarWajah'),
  authBatalDaftar: () => ipcRenderer.invoke('auth:batalDaftar'),
 

  onDongleDicabut: (pemanggil) => ipcRenderer.on('event:dongle-dicabut', () => pemanggil()),

  chatDaftar: () => ipcRenderer.invoke('chat:daftar'),
  chatBuat: (kontak, passphrase) => ipcRenderer.invoke('chat:buat', kontak, passphrase),
  chatKirim: (id, teks, penting) => ipcRenderer.invoke('chat:kirim', id, teks, penting),
  chatImpor: () => ipcRenderer.invoke('chat:impor'),
  chatRiwayat: (id) => ipcRenderer.invoke('chat:riwayat', id),
  chatKirimBerkas: (id) => ipcRenderer.invoke('chat:kirimBerkas', id),
  chatTerimaBerkas: (id) => ipcRenderer.invoke('chat:terimaBerkas', id),
  chatKirimGambar: (id, pesan) => ipcRenderer.invoke('chat:kirimGambar', id, pesan),
  chatTerimaGambar: (id) => ipcRenderer.invoke('chat:terimaGambar', id),
  jaringanStatus: () => ipcRenderer.invoke('jaringan:status'),
  jaringanDengarkan: () => ipcRenderer.invoke('jaringan:dengarkan'),
  jaringanSambung: (alamat) => ipcRenderer.invoke('jaringan:sambung', alamat),
  jaringanPutus: () => ipcRenderer.invoke('jaringan:putus'),
  chatKirimLangsung: (id, teks, penting) => ipcRenderer.invoke('chat:kirimLangsung', id, teks, penting),
  chatKirimBerkasLangsung: (id) => ipcRenderer.invoke('chat:kirimBerkasLangsung', id),
  chatKirimGambarLangsung: (id, pesan) => ipcRenderer.invoke('chat:kirimGambarLangsung', id, pesan),

  onJaringan: (pemanggil) => ipcRenderer.on('event:jaringan', (_event, status) => pemanggil(status)),
  onPesanMasuk: (pemanggil) => ipcRenderer.on('event:pesan-masuk', (_event, info) => pemanggil(info)),
  
});