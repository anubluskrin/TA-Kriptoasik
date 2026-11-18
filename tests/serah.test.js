const chain = require('../src/main/chain/blockchain');
const serah = require('../src/main/chat/serah');
const { turunkanMaster, subkunci } = require('../src/main/chat/kunciPercakapan');

function tambangCepat(draft) {
  let nonce = 0;
  let hash = chain.hitungHash({ ...draft, nonce });
  while (!hash.startsWith('0'.repeat(chain.KESULITAN))) {
    nonce++;
    hash = chain.hitungHash({ ...draft, nonce });
  }
  return { ...draft, nonce, hash };
}

function tambahBlok(rantai, data) {
  const blok = tambangCepat(chain.siapkanBlok(rantai, data));
  rantai.push(blok);
  return blok;
}

describe('serah terima aset antar dua rantai', () => {
  let kunciH, kunciB, rantaiHasan, rantaiBudi, blokTransfer, bukti;

  beforeEach(async () => {
    kunciH = subkunci(await turunkanMaster('passphrase-bersama', 'hasan', 'budi'));
    kunciB = subkunci(await turunkanMaster('passphrase-bersama', 'budi', 'hasan'));
    rantaiHasan = [chain.buatGenesis()];
    tambahBlok(rantaiHasan, { tipe: 'REGISTER', idAset: 'LOGO-1', nama: 'Logo Kafe', pemilik: 'hasan' });
    blokTransfer = tambahBlok(rantaiHasan, { tipe: 'TRANSFER', idAset: 'LOGO-1', dari: 'hasan', ke: 'budi' });
    bukti = serah.buat({ blok: blokTransfer, nama: 'Logo Kafe', kunci: kunciH });
    rantaiBudi = [chain.buatGenesis()];
  });

  const terima = (b = bukti, opsi = {}) => serah.verifikasi(b, { saya: 'budi', rekan: 'hasan', kunci: kunciB, ...opsi });

  it('bukti dari Hasan diverifikasi Budi dan dicatat sebagai blok TERIMA di rantai Budi', () => {
    const data = terima();
    expect(data).toMatchObject({ tipe: 'TERIMA', idAset: 'LOGO-1', dari: 'hasan', ke: 'budi', hashPengirim: blokTransfer.hash, indeksPengirim: 2 });
    tambahBlok(rantaiBudi, data);
    expect(chain.validasiRantai(rantaiBudi)).toEqual({ valid: true });
    expect(chain.daftarAset(rantaiBudi)).toEqual([{ idAset: 'LOGO-1', nama: 'Logo Kafe', pemilik: 'budi' }]);
    // kedua rantai sepakat soal pemilik
    expect(chain.daftarAset(rantaiHasan)[0].pemilik).toBe('budi');
  });

  it('bukti ditolak: penerima salah, pengirim tidak sesuai sambungan, isi diubah, atau passphrase beda', async () => {
    expect(() => terima(bukti, { saya: 'cici' })).toThrow(/bukan kepada cici/);
    expect(() => terima(bukti, { rekan: 'cici' })).toThrow(/Pengirim bukti tidak sesuai/);
    expect(() => terima({ ...bukti, nama: 'Logo Mahal' })).toThrow(/Stempel keaslian salah/);
    expect(() => terima({ ...bukti, hash: 'f'.repeat(64) })).toThrow(/Stempel keaslian salah/);
    const kunciLain = subkunci(await turunkanMaster('passphrase-lain', 'budi', 'hasan'));
    expect(() => terima(bukti, { kunci: kunciLain })).toThrow(/Stempel keaslian salah/);
    expect(() => terima({ idAset: 'x' })).toThrow(/tidak valid/);
  });

  it('bukti yang sama diputar ulang ditolak oleh aturan rantai penerima', () => {
    tambahBlok(rantaiBudi, terima());
    expect(() => chain.siapkanBlok(rantaiBudi, terima())).toThrow(/pemilik aset LOGO-1 adalah budi, bukan hasan/);
  });

  describe('periksa silang', () => {
    let catatan;
    beforeEach(() => {
      tambahBlok(rantaiBudi, terima());
      catatan = rantaiBudi[1].data;
    });

    it('pengirim jujur: cocok', () => {
      expect(serah.periksaBlok(catatan, rantaiHasan[2])).toEqual({ status: 'cocok' });
    });

    it('pengirim mengubah isi blok tanpa menghitung ulang hash: terdeteksi sebagai diubah', () => {
      const salinan = JSON.parse(JSON.stringify(rantaiHasan));
      salinan[2].data.ke = 'penjahat';
      expect(serah.periksaBlok(catatan, salinan[2]).status).toBe('diubah');
    });

    it('pengirim menulis ulang rantainya dengan hash baru yang valid: terdeteksi sebagai berbeda', () => {
      const baru = [chain.buatGenesis()];
      tambahBlok(baru, { tipe: 'REGISTER', idAset: 'LOGO-1', nama: 'Logo Kafe', pemilik: 'hasan' });
      tambahBlok(baru, { tipe: 'TRANSFER', idAset: 'LOGO-1', dari: 'hasan', ke: 'cici' });
      expect(chain.validasiRantai(baru)).toEqual({ valid: true }); // rantai palsu itu sendiri tampak sah
      expect(serah.periksaBlok(catatan, baru[2]).status).toBe('berbeda');
    });

    it('blok yang hilang dari rantai pengirim terdeteksi', () => {
      expect(serah.periksaBlok(catatan, null).status).toBe('hilang');
      expect(serah.periksaBlok(catatan, undefined).status).toBe('hilang');
    });
  });
});