const { contextBridge, ipcRenderer } = require('electron');

// Hanya fungsi di bawah ini yang bisa dipanggil oleh tampilan lewat window.api
contextBridge.exposeInMainWorld('api', {
  ping: (pesan) => ipcRenderer.invoke('app:ping', pesan),
  pesanEnkripsi: (teks, kunciVigenere) => ipcRenderer.invoke('pesan:enkripsi', teks, kunciVigenere),
  pesanDekripsi: (teks, kunciVigenere) => ipcRenderer.invoke('pesan:dekripsi', teks, kunciVigenere),
});