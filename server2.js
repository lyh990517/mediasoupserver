const mediasoup = require('mediasoup');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*', // 모든 출처 허용 (필요에 따라 특정 출처로 제한 가능)
    methods: ['GET', 'POST'], // 허용할 HTTP 메서드
  },
});

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

// CORS 설정 추가
app.use(cors());

app.get('/', (req, res) => {
  res.send('Mediasoup Server is Running');
});

startServer();

io.on('connection', (socket) => {
    console.log('Client connected');
    
    socket.on('createWebRtcTransport', async (callback) => {
      try {
        // WebRtcTransport 생성
        const transport = await router.createWebRtcTransport({
          listenIps: [{ ip: '127.0.0.1', announcedIp: null }], // 서버 IP 설정
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
        });
    
        console.log('rtpCapabilities:', router.rtpCapabilities); // 디버그용 로그 추가

        // routerRtpCapabilities를 transportOptions에 추가
        const transportOptions = {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
          routerRtpCapabilities: router.rtpCapabilities, // RTP 기능을 추가
        };

        if (callback && typeof callback === 'function') {
          callback({ transportOptions });
        }
      } catch (error) {
        console.error('Error creating WebRtcTransport:', error);
        if (callback && typeof callback === 'function') {
          callback({ error: 'Failed to create WebRtcTransport' });
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
});

server.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
