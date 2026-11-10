const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { protocol, net } = require('electron');

// Model Human dilayani lewat svmodel://model/<berkas>. Skema harus didaftarkan SEBELUM app siap.
const FOLDER_MODEL = path.join(__dirname, '..', '..', '..', 'node_modules', '@vladmandic', 'human', 'models');

function daftarkanSkema() {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'svmodel', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  ]);
}

function pasangPenangan() {
  protocol.handle('svmodel', async (request) => {
    const url = new URL(request.url);
    const nama = path.basename(decodeURIComponent(url.pathname));
    if (!/^[A-Za-z0-9._-]+\.(json|bin)$/.test(nama)) return new Response('Tidak diizinkan', { status: 403 });
    const balasan = await net.fetch(pathToFileURL(path.join(FOLDER_MODEL, nama)).toString());
    const headers = new Headers(balasan.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(balasan.body, { status: balasan.status, headers });
  });
}

module.exports = { daftarkanSkema, pasangPenangan };