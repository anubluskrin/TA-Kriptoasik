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
});