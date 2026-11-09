const { parentPort, workerData } = require('node:worker_threads');
const { hitungHash } = require('./blockchain');

// Mencari nonce sampai hash blok diawali angka 0 sebanyak `kesulitan`.
// Dijalankan di thread terpisah supaya tampilan tidak membeku.
const { draft, kesulitan } = workerData;
const awalan = '0'.repeat(kesulitan);
const mulai = Date.now();

let nonce = 0;
let hash = hitungHash({ ...draft, nonce });
while (!hash.startsWith(awalan)) {
  nonce++;
  hash = hitungHash({ ...draft, nonce });
}

parentPort.postMessage({ nonce, hash, ms: Date.now() - mulai });