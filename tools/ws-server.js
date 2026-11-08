const { WebSocketServer } = require('ws');

const PORT = 8765;
const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });

wss.on('listening', () => console.log('Server siap di port', PORT));

wss.on('connection', (socket, req) => {
  console.log('Client terhubung dari', req.socket.remoteAddress);
  socket.on('message', (data) => {
    const text = data.toString();
    console.log('Pesan masuk:', text);
    // teruskan ke semua client lain
    for (const client of wss.clients) {
      if (client !== socket && client.readyState === 1) client.send(text);
    }
    socket.send('server: pesan diterima');
  });
});
