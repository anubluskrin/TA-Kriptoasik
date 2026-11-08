const { execFile } = require('node:child_process');

const psScript = `
$result = @(
  Get-CimInstance Win32_DiskDrive | Where-Object { $_.InterfaceType -eq 'USB' } | ForEach-Object {
    $disk = $_
    Get-CimAssociatedInstance -InputObject $disk -ResultClassName Win32_DiskPartition | ForEach-Object {
      Get-CimAssociatedInstance -InputObject $_ -ResultClassName Win32_LogicalDisk | ForEach-Object {
        [PSCustomObject]@{
          Drive  = $_.DeviceID
          Serial = ([string]$disk.SerialNumber).Trim()
          Model  = $disk.Model
          PnpId  = $disk.PNPDeviceID
        }
      }
    }
  }
)
ConvertTo-Json -InputObject $result -Compress
`;

execFile(
  'powershell.exe',
  ['-NoProfile', '-NonInteractive', '-Command', psScript],
  { windowsHide: true, timeout: 15000 },
  (err, stdout, stderr) => {
    if (err) {
      console.error('Gagal:', err.message);
      if (stderr) console.error(stderr);
      return;
    }
    const list = JSON.parse(stdout.trim() || '[]');
    console.log('Flashdisk terdeteksi:', list.length);
    console.table(list);
  }
);