const os = require('node:os');
const crypto = require('node:crypto');
const { WebSocketServer, WebSocket } = require('ws');

const PORT_BAWAAN = 8765;
const MAKS_MEDIA = 12 * 1024 * 1024; // berkas/gambar terenkripsi yang boleh lewat sambungan langsung
const MAKS_FRAME = 17 * 1024 * 1024; // cukup untuk MAKS_MEDIA setelah Base64
const BATAS_BALASAN = 30000;
const BATAS_HALO = 5000;

// Sambungan langsung antar dua laptop lewat WebSocket. Isi yang lewat sudah berupa amplop terenkripsi
// ber-MAC (lihat amplop.js), jadi saluran ini hanya pengangkut. Hanya satu sambungan pada satu waktu.
//
// Bingkai (JSON):
//   { t: 'halo',  dari }              perkenalan, dikirim kedua pihak saat tersambung
//   { t: 'pesan', amplop }            amplop pesan
//   { t: 'berkas'|'gambar', id, data } berkas .enc atau PNG stego (Base64), sudah terenkripsi
//   { t: 'ack',   id }                amplop diterima dan lolos pemeriksaan
//   { t: 'tolak', id, alasan }        amplop ditolak (passphrase beda, nomor urut lama, dan sebagainya)

function alamatLokal() {
  const hasil = [];
  for (const daftar of Object.values(os.networkInterfaces())) {
    for (const a of daftar || []) {
      if (a.family === 'IPv4' && !a.internal) hasil.push(a.address);
    }
  }
  return hasil;
}

class Tautan {
  // ambilUsername: () => username akun yang sedang login (melempar galat bila belum login)
  // saatPesan:     (amplop, rekan) => memproses amplop masuk; melempar galat bila harus ditolak
  // saatBerubah:   (status) => dipanggil setiap status sambungan berubah
  constructor({ ambilUsername, saatPesan, saatMedia, saatBerubah = () => {} }) {
    this.ambilUsername = ambilUsername;
    this.saatPesan = saatPesan;
    this.saatMedia = saatMedia;     // saatMedia: (jenis, data, rekan) => memproses berkas/gambar masuk; melempar galat bila harus ditolak.
    this.saatBerubah = saatBerubah;
    this.server = null;
    this.soket = null;
    this.rekan = null;
    this.menunggu = new Map(); // id amplop -> { selesai, gagal }
  }

  status() {
    return {
      mode: this.soket && this.rekan ? 'terhubung' : this.server ? 'mendengar' : 'mati',
      rekan: this.rekan,
      port: this.server ? this.server.address().port : null,
      alamat: this.server ? alamatLokal() : [],
    };
  }

  dengarkan(port = PORT_BAWAAN) {
    if (this.server) return Promise.resolve(this.status());
    return new Promise((selesai, gagal) => {
      const server = new WebSocketServer({ port, host: '0.0.0.0', maxPayload: MAKS_FRAME });
      server.on('error', (err) => {
        if (this.server) return;
        gagal(new Error(err.code === 'EADDRINUSE' ? `Port ${port} sudah dipakai program lain` : err.message));
      });
      server.on('listening', () => {
        this.server = server;
        this.saatBerubah(this.status());
        selesai(this.status());
      });
      server.on('connection', (soket) => {
        if (this.soket) {
          soket.close(1008, 'Sudah ada sambungan');
          return;
        }
        this.pasang(soket, null);
      });
    });
  }

  sambung(alamat, port = PORT_BAWAAN) {
    if (this.soket) return Promise.reject(new Error('Sudah terhubung. Putuskan dulu.'));
    if (typeof alamat !== 'string' || !/^[A-Za-z0-9.-]{1,100}$/.test(alamat)) {
      return Promise.reject(new Error('Alamat tidak valid (contoh: 192.168.43.10)'));
    }
    return new Promise((selesai, gagal) => {
      const soket = new WebSocket(`ws://${alamat}:${port}`, { maxPayload: MAKS_FRAME, handshakeTimeout: BATAS_HALO });
      let selesaiSudah = false;
      const batal = (err) => {
        if (selesaiSudah) return;
        selesaiSudah = true;
        clearTimeout(timer);
        gagal(err);
      };
      const timer = setTimeout(() => {
        batal(new Error(`${alamat} tidak menjawab sebagai Sandikarya`));
        soket.terminate();
      }, BATAS_HALO + 1000);
      soket.on('error', (err) => batal(new Error(`Tidak bisa terhubung ke ${alamat}: ${err.message}`)));
      soket.on('close', (kode, alasan) => batal(new Error(alasan.toString() || 'Sambungan ditutup oleh lawan')));
      soket.on('open', () =>
        this.pasang(soket, () => {
          if (selesaiSudah) return;
          selesaiSudah = true;
          clearTimeout(timer);
          selesai(this.status());
        })
      );
    });
  }

  pasang(soket, saatHalo) {
    try {
      soket.send(JSON.stringify({ t: 'halo', dari: this.ambilUsername() }));
    } catch {
      soket.close(1008, 'Penerima belum login');
      return;
    }
    this.soket = soket;
    // Sambungan yang tidak memperkenalkan diri tidak boleh menahan satu-satunya slot
    const batas = setTimeout(() => {
      if (this.soket === soket && !this.rekan) soket.terminate();
    }, BATAS_HALO);
    soket.on('message', (data) => this.tangani(soket, data, saatHalo));
    soket.on('error', () => {});
    soket.on('close', () => {
      clearTimeout(batas);
      if (this.soket !== soket) return;
      this.bersihkanSambungan();
      this.saatBerubah(this.status());
    });
  }

  async tangani(soket, data, saatHalo) {
    let f;
    try {
      f = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!f || typeof f.t !== 'string') return;

    if (f.t === 'halo') {
      if (this.rekan || typeof f.dari !== 'string' || f.dari.length > 30) return;
      this.rekan = f.dari;
      this.saatBerubah(this.status());
      if (saatHalo) saatHalo();
      return;
    }
    if (!this.rekan) return; // belum berkenalan

    if (f.t === 'pesan') {
      const id = f.amplop && typeof f.amplop.id === 'string' ? f.amplop.id : '';
      let balasan;
      try {
        if (!f.amplop || f.amplop.dari !== this.rekan) throw new Error('Pengirim tidak sesuai dengan sambungan');
        await this.saatPesan(f.amplop, this.rekan);
        balasan = { t: 'ack', id };
      } catch (err) {
        balasan = { t: 'tolak', id, alasan: err.message };
      }
      if (soket.readyState === WebSocket.OPEN) soket.send(JSON.stringify(balasan));
      return;
    }

    if (f.t === 'berkas' || f.t === 'gambar') {
      const id = typeof f.id === 'string' ? f.id : '';
      let balasan;
      try {
        if (typeof f.data !== 'string' || !this.saatMedia) throw new Error('Kiriman tidak valid');
        await this.saatMedia(f.t, Buffer.from(f.data, 'base64'), this.rekan);
        balasan = { t: 'ack', id };
      } catch (err) {
        balasan = { t: 'tolak', id, alasan: err.message };
      }
      if (soket.readyState === WebSocket.OPEN) soket.send(JSON.stringify(balasan));
      return;
    }

    if (f.t === 'ack' || f.t === 'tolak') {
      const m = this.menunggu.get(f.id);
      if (!m) return;
      this.menunggu.delete(f.id);
      if (f.t === 'ack') m.selesai();
      else m.gagal(new Error(`Ditolak ${this.rekan}: ${String(f.alasan).slice(0, 200)}`));
    }
  }

  kirimPesan(a) {
    return this.kirimBingkai(a.id, a.ke, { t: 'pesan', amplop: a });
  }

  // jenis: 'berkas' atau 'gambar'; data: Buffer yang sudah terenkripsi
  kirimMedia(jenis, ke, data) {
    if (data.length > MAKS_MEDIA) {
      return Promise.reject(new Error('Terlalu besar untuk sambungan langsung (maksimal 12 MB). Pakai berkas .enc manual.'));
    }
    const id = crypto.randomBytes(8).toString('hex');
    return this.kirimBingkai(id, ke, { t: jenis, id, data: data.toString('base64') });
  }

  kirimBingkai(id, ke, bingkai) {
    if (!this.soket || !this.rekan) return Promise.reject(new Error('Belum terhubung ke laptop lain'));
    if (ke !== this.rekan) {
      return Promise.reject(new Error(`Sedang terhubung dengan ${this.rekan}, bukan ${ke}`));
    }
    return new Promise((selesai, gagal) => {
      const timer = setTimeout(() => {
        this.menunggu.delete(id);
        gagal(new Error('Tidak ada balasan dari lawan bicara'));
      }, BATAS_BALASAN);
      this.menunggu.set(id, {
        selesai: () => (clearTimeout(timer), selesai()),
        gagal: (err) => (clearTimeout(timer), gagal(err)),
      });
      this.soket.send(JSON.stringify(bingkai));
    });
  }

  bersihkanSambungan() {
    this.soket = null;
    this.rekan = null;
    for (const m of this.menunggu.values()) m.gagal(new Error('Sambungan terputus'));
    this.menunggu.clear();
  }

  putus() {
    const s = this.soket;
    this.bersihkanSambungan();
    if (s) s.close();
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.saatBerubah(this.status());
  }
}

module.exports = { Tautan, PORT_BAWAAN };