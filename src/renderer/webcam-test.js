const video = document.getElementById('video');
const statusEl = document.getElementById('status');
const btn = document.getElementById('btn');

btn.addEventListener('click', async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === 'videoinput');
    statusEl.textContent = 'Kamera terdeteksi: ' + cams.length;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    statusEl.textContent += ' | Webcam menyala (' + video.videoWidth + 'x' + video.videoHeight + ')';
  } catch (err) {
    statusEl.textContent = 'Gagal: ' + err.name + ' - ' + err.message;
  }
});