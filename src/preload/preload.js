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
});