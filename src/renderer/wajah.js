// Pengambilan embedding wajah di tampilan memakai pustaka Human (dimuat dari index.html).
// Model dibaca lewat protokol svmodel:// yang dilayani proses utama.
const Wajah = (() => {
  const UKURAN_MIN = 150; // lebar kotak wajah minimal (piksel) agar embedding cukup baik
  const SKOR_MIN = 0.6;
  let human = null;
  let aliran = null;

  async function muatModel() {
    if (human) return;
    human = new Human.Human({
      backend: 'webgl',
      modelBasePath: 'svmodel://model/',
      cacheModels: false,
      warmup: 'none',
      filter: { enabled: false },
      face: {
        enabled: true,
        detector: { rotation: false, maxDetected: 2 },
        mesh: { enabled: true },
        iris: { enabled: false },
        description: { enabled: true },
        emotion: { enabled: false },
        antispoof: { enabled: false },
        liveness: { enabled: false },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      gesture: { enabled: false },
    });
    await human.load();
  }

  async function nyalakanKamera(elVideo) {
    aliran = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false,
    });
    elVideo.srcObject = aliran;
    await elVideo.play();
  }

  function matikanKamera(elVideo) {
    if (aliran) aliran.getTracks().forEach((t) => t.stop());
    aliran = null;
    if (elVideo) elVideo.srcObject = null;
  }

  // Mengambil satu embedding dari sumber (video atau gambar). Melempar galat bila syarat tidak terpenuhi.
  async function ambilEmbedding(sumber) {
    await muatModel();
    const hasil = await human.detect(sumber);
    if (hasil.face.length === 0) throw new Error('Wajah tidak terdeteksi. Hadapkan wajah ke kamera dengan cahaya cukup');
    if (hasil.face.length > 1) throw new Error('Terdeteksi lebih dari satu wajah. Pastikan hanya satu wajah di kamera');
    const w = hasil.face[0];
    const skor = w.faceScore !== undefined ? w.faceScore : w.score;
    if (skor < SKOR_MIN) throw new Error('Wajah kurang jelas. Perbaiki pencahayaan');
    if (w.box[2] < UKURAN_MIN) throw new Error('Wajah terlalu jauh. Dekatkan wajah ke kamera');
    if (!w.embedding || w.embedding.length !== 1024) throw new Error('Embedding wajah tidak terbentuk');
    return Array.from(w.embedding);
  }

  return { muatModel, nyalakanKamera, matikanKamera, ambilEmbedding };
})();