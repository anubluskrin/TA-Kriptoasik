const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { KESULITAN } = require('./blockchain');

// Menambang blok di worker thread. Mengembalikan blok lengkap (dengan nonce dan hash).
function tambang(draft) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'pow.worker.js'), {
      workerData: { draft, kesulitan: KESULITAN },
    });
    worker.once('message', ({ nonce, hash, ms }) => {
      resolve({ blok: { ...draft, nonce, hash }, ms });
    });
    worker.once('error', reject);
    worker.once('exit', (kode) => {
      if (kode !== 0) reject(new Error('Proses penambangan berhenti tak terduga'));
    });
  });
}

module.exports = { tambang };