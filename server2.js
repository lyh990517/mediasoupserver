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
let transport;

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
    
    socket.on('createWebRtcTransport', async (optionsJson ,callback) => {
      try {
        // WebRtcTransport 생성
        const options = JSON.parse(optionsJson)

        console.log('options:', options);
        
        transport = await router.createWebRtcTransport({
          listenIps: [{ ip: '127.0.0.1', announcedIp: null }], // 서버 IP 설정
          enableUdp: options.enableUdp,
          enableTcp: options.enableTcp,
          enableSctp: true,
          preferUdp: options.preferUdp,
          sctpParameters: options.sctpCapabilities,
        });
    
        console.log('id:', transport.id); // 디버그용 로그 추가
        console.log('iceParameters:', transport.iceParameters); // 디버그용 로그 추가
        console.log('iceCandidates:', transport.iceCandidates); // 디버그용 로그 추가
        console.log('dtlsParameters:', transport.dtlsParameters); // 디버그용 로그 추가
        console.log('sctpParameters:', transport.sctpParameters); // 디버그용 로그 추가

        // routerRtpCapabilities를 transportOptions에 추가
        const transportOptions = {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
          sctpParameters: transport.sctpParameters,
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

    socket.on('getRouterCapabilities', (callback) => {
      if (router) {
        callback({
          routerRtpCapabilities: router.rtpCapabilities,
        });
      } else {
        callback({
          error: 'Router not initialized',
        });
      }
    });

    socket.on('consume', async (data, callback) => {
      try {
          const json = JSON.parse(data);
          console.log('producerId:', json.producerId);  // 디버깅 로그

          const rtpCapabilities = typeof json.rtpCapabilities === 'string'
            ? JSON.parse(json.rtpCapabilities)
            : json.rtpCapabilities;

            console.log('rtpCapabilities:', rtpCapabilities);  // 디버깅 로그

          if (!transport) {
              throw new Error('Transport not found');
          }
  
          const consumer = await transport.consume({ 
            producerId: json.producerId,
            rtpCapabilities: rtpCapabilities
          })
  
          console.log(`Consumer created with ID: ${consumer.id}`);
  
          callback({ consumerId: consumer.id });
  
      } catch (error) {
          console.error('Error in consume:', error);
          callback({ error: 'Failed to consume' });
      }
  });

    socket.on('produce', async (data, callback) => {
      try {
          const json = JSON.parse(data)
  
          console.log('transportId:', json.transportId); // 디버그용 로그 추가
          console.log('kind:', json.kind); // 디버그용 로그 추가
          console.log('rtpParameters:', json.rtpParameters); // 디버그용 로그 추가
          console.log('appData:', json.appData); // 디버그용 로그 추가

          const rtpParametersObject = JSON.parse(json.rtpParameters);
          const appDataObject = JSON.parse(json.appData)

          const appData = json.appData && typeof json.appData === 'object' ? json.appData : {};

          if (!transport) {
              throw new Error('Transport not found');
          }
  
          const producer = await transport.produce({
              kind: json.kind,
              rtpParameters: rtpParametersObject,
              appData: appDataObject,
          });
  
          const producerId = producer.id;
  
          console.log(`Producer created with ID: ${producerId}`);
  
          callback({ producerId });
  
      } catch (error) {
          console.error('Error in produce:', error);
          callback({ error: 'Failed to produce' });
      }
  });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
});

server.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
