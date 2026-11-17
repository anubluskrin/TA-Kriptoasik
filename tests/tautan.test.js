const { Tautan } = require('../src/main/chat/tautan');
const { turunkanMaster, subkunci } = require('../src/main/chat/kunciPercakapan');
const amplop = require('../src/main/chat/amplop');

// Dua "laptop" dalam satu proses: masing-masing punya Tautan sendiri dan penyimpanan pesan tiruan.
async function buatLaptop(username, kunci, seqAwal = 0) {
  const masuk = [];
  const media = [];
  let seqTerima = seqAwal;
  const tautan = new Tautan({
    ambilUsername: () => username,
    saatPesan: (a) => {
      const hasil = amplop.verifikasi(a, { saya: username, kontak: a.dari, kunci, seqTerakhir: seqTerima });
      seqTerima = hasil.seq;
      masuk.push(hasil.teks);
    },
      saatMedia: (jenis, data) => {
      if (data.toString() === 'RUSAK') throw new Error('kunci berbeda');
      media.push([jenis, data.toString()]);
    },
  });
  return { tautan, masuk, media };
}

describe('Tautan (sambungan langsung)', () => {
  const PASS = 'passphrase-bersama';
  let hasan, budi, kunciH, kunciB;
  const tunggu = async (kondisi) => {
    for (let i = 0; i < 100 && !kondisi(); i++) await new Promise((r) => setTimeout(r, 20));
  };

  beforeEach(async () => {
    kunciH = subkunci(await turunkanMaster(PASS, 'hasan', 'budi'));
    kunciB = subkunci(await turunkanMaster(PASS, 'budi', 'hasan'));
    hasan = await buatLaptop('hasan', kunciH);
    budi = await buatLaptop('budi', kunciB);
  });
  afterEach(() => {
    hasan.tautan.putus();
    budi.tautan.putus();
  });

  async function hubungkan() {
    const s = await hasan.tautan.dengarkan(0);
    await budi.tautan.sambung('127.0.0.1', s.port);
    await tunggu(() => hasan.tautan.status().rekan);
  }

  it('saling berkenalan: kedua sisi tahu username lawan', async () => {
    await hubungkan();
    expect(hasan.tautan.status().rekan).toBe('budi');
    expect(budi.tautan.status().rekan).toBe('hasan');
  });

  it('pesan dua arah sampai dan terbaca', async () => {
    await hubungkan();
    await budi.tautan.kirimPesan(amplop.buat({ dari: 'budi', ke: 'hasan', seq: 1, teks: 'Halo Hasan', kunci: kunciB }));
    await hasan.tautan.kirimPesan(amplop.buat({ dari: 'hasan', ke: 'budi', seq: 1, teks: 'Halo Budi', kunci: kunciH }));
    expect(hasan.masuk).toEqual(['Halo Hasan']);
    expect(budi.masuk).toEqual(['Halo Budi']);
  });

  it('passphrase berbeda: pengirim mendapat penolakan beserta alasannya', async () => {
    await hubungkan();
    const kunciSalah = subkunci(await turunkanMaster('passphrase-lain', 'budi', 'hasan'));
    const a = amplop.buat({ dari: 'budi', ke: 'hasan', seq: 1, teks: 'x', kunci: kunciSalah });
    await expect(budi.tautan.kirimPesan(a)).rejects.toThrow(/Stempel keaslian salah/);
    expect(hasan.masuk).toEqual([]);
  });

  it('pesan yang sama dikirim ulang ditolak (nomor urut lama)', async () => {
    await hubungkan();
    const a = amplop.buat({ dari: 'budi', ke: 'hasan', seq: 1, teks: 'sekali saja', kunci: kunciB });
    await budi.tautan.kirimPesan(a);
    await expect(budi.tautan.kirimPesan(a)).rejects.toThrow(/sudah pernah diimpor|Pesan lama/);
  });

  it('amplop dari pengirim yang bukan lawan sambungan ditolak', async () => {
    await hubungkan();
    const a = amplop.buat({ dari: 'cici', ke: 'hasan', seq: 1, teks: 'x', kunci: kunciB });
    await expect(budi.tautan.kirimPesan(a)).rejects.toThrow(/Pengirim tidak sesuai/);
  });

  it('kirim tanpa sambungan ditolak dengan pesan jelas', async () => {
    const a = amplop.buat({ dari: 'budi', ke: 'hasan', seq: 1, teks: 'x', kunci: kunciB });
    await expect(budi.tautan.kirimPesan(a)).rejects.toThrow(/Belum terhubung/);
  });

  it('putus: status kembali mati dan sisi lawan kembali menunggu', async () => {
    await hubungkan();
    budi.tautan.putus();
    expect(budi.tautan.status().mode).toBe('mati');
    await tunggu(() => hasan.tautan.status().mode !== 'terhubung');
    expect(hasan.tautan.status().mode).toBe('mendengar');
  });

  it('sambungan kedua ditolak selama masih ada sambungan', async () => {
    await hubungkan();
    const s = hasan.tautan.status();
    const orangLain = new Tautan({ ambilUsername: () => 'cici', saatPesan() {} });
    await expect(orangLain.sambung('127.0.0.1', s.port)).rejects.toThrow();
    expect(hasan.tautan.status().rekan).toBe('budi');
    orangLain.putus();
  });

  it('alamat tidak valid dan tujuan tak terjangkau memberi galat, bukan crash', async () => {
    await expect(budi.tautan.sambung('a b;c')).rejects.toThrow(/Alamat tidak valid/);
    await expect(budi.tautan.sambung('127.0.0.1', 1)).rejects.toThrow(/Tidak bisa terhubung/);
  });

    it('berkas dan gambar terenkripsi sampai utuh ke sisi lawan', async () => {
    await hubungkan();
    const isi = Buffer.from([0, 255, 1, 254, 65, 66]);
    await budi.tautan.kirimMedia('berkas', 'hasan', isi);
    await budi.tautan.kirimMedia('gambar', 'hasan', Buffer.from('PNG-PALSU'));
    expect(hasan.media[0][0]).toBe('berkas');
    expect(Buffer.from(hasan.media[0][1], 'latin1').length).toBe(isi.length);
    expect(hasan.media[1]).toEqual(['gambar', 'PNG-PALSU']);
  });

  it('kiriman yang ditolak penerima menjadi galat di pengirim', async () => {
    await hubungkan();
    await expect(budi.tautan.kirimMedia('berkas', 'hasan', Buffer.from('RUSAK'))).rejects.toThrow(/Ditolak hasan: kunci berbeda/);
  });

  it('kiriman lebih dari 12 MB ditolak dengan petunjuk memakai berkas manual', async () => {
    await hubungkan();
    await expect(budi.tautan.kirimMedia('berkas', 'hasan', Buffer.alloc(12 * 1024 * 1024 + 1))).rejects.toThrow(/maksimal 12 MB/);
  });
});