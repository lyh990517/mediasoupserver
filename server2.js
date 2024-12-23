const mediasoup = require('mediasoup');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let worker;
let router;

const startServer = async () => {
  // Mediasoup 워커 생성
  worker = await mediasoup.createWorker();
  worker.on('died', (error) => {
    console.error('Mediasoup worker died, exiting...');
    process.exit(1);
  });

  // Router 생성
  router = await worker.createRouter({
    mediaCodecs: [
      {
        mimeType: 'audio/opus',
        kind: 'audio',
        clockRate: 48000,
        channels: 2,
      },
      {
        mimeType: 'video/vp8',
        kind: 'video',
        clockRate: 90000,
      },
    ],
  });

  console.log('Mediasoup server started');
};

app.get('/', (req, res) => {
    res.send('Mediasoup Server is Running');
  });  

startServer();

io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('createWebRtcTransport', async (callback) => {
    try {
      const transport = await router.createWebRtcTransport({
        listenIps: ['127.0.0.1'],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      callback({ transportOptions: transport.options });
    } catch (error) {
      console.error('Error creating WebRtcTransport:', error);
      callback({ error: 'Failed to create WebRtcTransport' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
