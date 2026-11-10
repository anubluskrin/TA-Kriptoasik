const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
const { daftarkanSemuaIpc } = require('./ipc');
const db = require('./db/db');

const sesiLogin = require('./auth/session');

const protokolModel = require('./security/protokolModel');
protokolModel.daftarkanSkema();

// Untuk uji dua akun di satu laptop: npx electron . --data-dir=D:\tes-ujang
// Tanpa bendera ini, aplikasi memakai folder data bawaan.
const argDataDir = process.argv.find((a) => a.startsWith('--data-dir='));
if (argDataDir) {
  app.setPath('userData', argDataDir.slice('--data-dir='.length));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
    protokolModel.pasangPenangan();
    
  // Daftarkan semua kanal IPC sebelum jendela dibuat
    // Buka basis data lalu daftarkan semua kanal IPC sebelum jendela dibuat
  db.buka(path.join(app.getPath('userData'), 'securevault.db'));
  daftarkanSemuaIpc();

  // Hanya izinkan akses kamera/mikrofon (tipe 'media'), tolak izin lain
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media');
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return permission === 'media';
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  sesiLogin.akhiri();
  db.tutup();
});