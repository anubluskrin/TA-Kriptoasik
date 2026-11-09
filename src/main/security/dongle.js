const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

// Dongle = flashdisk USB. Dua hal diperiksa:
//   1. Berkas .svkey di akar flashdisk berisi `secret` (32 byte acak)
//   2. Basis data menyimpan dongle_tag = HMAC-SHA256(kunci = secret, pesan = serial flashdisk)
// Berkas .svkey yang disalin ke flashdisk lain ditolak karena serialnya berbeda.
// Secret juga ikut menurunkan kunci master, jadi data lokal tidak terbuka tanpa dongle.

const NAMA_BERKAS = '.svkey';

const SKRIP_POWERSHELL = `
$result = @(
  Get-CimInstance Win32_DiskDrive | Where-Object { $_.InterfaceType -eq 'USB' } | ForEach-Object {
    $disk = $_
    Get-CimAssociatedInstance -InputObject $disk -ResultClassName Win32_DiskPartition | ForEach-Object {
      Get-CimAssociatedInstance -InputObject $_ -ResultClassName Win32_LogicalDisk | ForEach-Object {
        [PSCustomObject]@{
          Drive  = $_.DeviceID
          Serial = ([string]$disk.SerialNumber).Trim()
          Model  = $disk.Model
        }
      }
    }
  }
)
ConvertTo-Json -InputObject $result -Compress
`;

// Membaca daftar flashdisk USB lewat PowerShell (Windows)
function bacaDrivePowerShell() {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', SKRIP_POWERSHELL],
      { windowsHide: true, timeout: 15000 },
      (err, stdout) => {
        if (err) return reject(new Error('Gagal membaca flashdisk: ' + err.message));
        try {
          const mentah = JSON.parse(stdout.trim() || '[]');
          const daftar = Array.isArray(mentah) ? mentah : [mentah];
          resolve(
            daftar
              .filter((d) => d && d.Drive)
              .map((d) => ({ drive: d.Drive, serial: String(d.Serial || '').trim(), model: d.Model || '' }))
          );
        } catch {
          reject(new Error('Keluaran daftar flashdisk tidak dapat dibaca'));
        }
      }
    );
  });
}

// Penyedia daftar drive dibuat terpisah supaya mudah diganti saat diuji
const penyedia = { daftarDrive: bacaDrivePowerShell };

function akar(drive) {
  return drive.endsWith(path.sep) ? drive : drive + path.sep;
}

function jalurBerkas(drive) {
  return path.join(akar(drive), NAMA_BERKAS);
}

function hitungTag(secret, serial) {
  return crypto.createHmac('sha256', secret).update(serial, 'utf8').digest('hex');
}

function bacaSecret(drive) {
  try {
    const isi = JSON.parse(fs.readFileSync(jalurBerkas(drive), 'utf8'));
    if (isi && typeof isi.secret === 'string' && /^[0-9a-f]{64}$/.test(isi.secret)) {
      return Buffer.from(isi.secret, 'hex');
    }
  } catch {
    // berkas tidak ada atau rusak
  }
  return null;
}

async function status() {
  const daftar = await penyedia.daftarDrive();
  return { jumlah: daftar.length, drive: daftar[0] || null };
}

// Menyiapkan flashdisk sebagai dongle (dipakai saat membuat akun).
// Syarat: tepat satu flashdisk USB terpasang.
async function daftarkan() {
  const daftar = await penyedia.daftarDrive();
  if (daftar.length === 0) throw new Error('Flashdisk dongle belum terpasang');
  if (daftar.length > 1) {
    throw new Error(`Terdeteksi ${daftar.length} flashdisk. Sisakan hanya satu flashdisk yang terpasang`);
  }
  const { drive, serial, model } = daftar[0];
  if (!serial) throw new Error('Serial flashdisk tidak terbaca, gunakan flashdisk lain');

  const secret = crypto.randomBytes(32);
  fs.writeFileSync(jalurBerkas(drive), JSON.stringify({ versi: 1, secret: secret.toString('hex') }));
  return { secret, tag: hitungTag(secret, serial), drive, serial, model };
}

// Mencari flashdisk yang cocok dengan dongle_tag di basis data.
// Mengembalikan { secret, drive, serial, model } atau null bila tidak ada yang cocok.
async function verifikasi(tagTersimpan) {
  if (typeof tagTersimpan !== 'string' || tagTersimpan.length !== 64) return null;
  const tersimpan = Buffer.from(tagTersimpan, 'hex');

  const daftar = await penyedia.daftarDrive();
  for (const d of daftar) {
    const secret = bacaSecret(d.drive);
    if (!secret || !d.serial) continue;
    const hitung = Buffer.from(hitungTag(secret, d.serial), 'hex');
    if (hitung.length === tersimpan.length && crypto.timingSafeEqual(hitung, tersimpan)) {
      return { secret, drive: d.drive, serial: d.serial, model: d.model };
    }
    secret.fill(0);
  }
  return null;
}

// Pemeriksaan cepat untuk pemantau pencabutan
function adaBerkasKunci(drive) {
  return fs.existsSync(jalurBerkas(drive));
}

async function serialMasihAda(serial) {
  const daftar = await penyedia.daftarDrive();
  return daftar.some((d) => d.serial === serial);
}

module.exports = { penyedia, status, daftarkan, verifikasi, adaBerkasKunci, serialMasihAda };