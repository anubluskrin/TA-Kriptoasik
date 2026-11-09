const WebSocket = require('ws');

const url = process.argv[2] || 'ws://localhost:8765';
const name = process.argv[3] || 'anon';
const socket = new WebSocket(url);

socket.on('open', () => {
  console.log('Terhubung ke', url);
  socket.send(`ping dari ${name}`);
});
socket.on('message', (data) => console.log('Diterima:', data.toString()));
socket.on('error', (err) => console.error('Error:', err.message));
socket.on('close', () => console.log('Koneksi ditutup'));