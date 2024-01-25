// /**
//  * Mediasoup server using Express, Socket.io, and WebRTC.
//  * @module MediasoupServer
//  */

// const express = require('express');
// const http = require('http');
// const mediasoup = require('mediasoup');
// const socketIO = require('socket.io');

// const app = express();
// const server = http.createServer(app);
// const io = socketIO(server);

// // Mediasoup variables
// let worker;
// let router;

// // Server configuration
// const PORT = 3000;

// // Supported media codecs for WebRTC connections
// const mediaCodecs = [
//   {
//     kind: 'audio',
//     mimeType: 'audio/opus',
//     clockRate: 48000,
//     channels: 2,
//   },
//   {
//     kind: 'video',
//     mimeType: 'video/VP8',
//     clockRate: 90000,
//     parameters: {
//       'x-google-start-bitrate': 1000,
//     },
//   },
// ];

// /**
//  * Initializes Mediasoup worker and router.
//  * @async
//  * @function
//  */
// async function startMediasoup() {
//   worker = await mediasoup.createWorker();
//   router = await worker.createRouter({ mediaCodecs });
// }

// startMediasoup();

// // Map to store active transports, producers, and consumers
// const transports = new Map();
// const producers = new Map();
// const consumers = new Map();

// /**
//  * Handles client connection and WebRTC signaling messages.
//  * @event
//  * @name connection
//  * @param {Object} socket - Socket.io socket representing the connected client.
//  */
// io.on('connection', (socket) => {
//   console.log(`New client connected: ${socket.id}`);

//   /**
//    * Handles WebRTC transport connection.
//    * @event
//    * @name transport-connect
//    * @param {Object} data - Data containing information for transport connection.
//    */
//   socket.on('transport-connect', async (data) => {
//     try {
//       const producersTransport = transports.get(socket.id);
//       await producersTransport.connect({ dtlsParameters });
//     } catch (error) {
//       console.error(error);
//     }
//   });

//   /**
//    * Handles WebRTC transport produce event.
//    * @event
//    * @name transport-produce
//    * @param {Object} data - Data containing kind, rtpParameters, and appData for producing.
//    */
//   socket.on('transport-produce', async ({ kind, rtpParameters, appData }) => {
//     const producerTransport = transports.get(socket.id);
//     const producer = await producerTransport.produce({
//       kind,
//       rtpParameters,
//     });

//     console.log('Producer ID: ', producer.id, producer.kind);

//     producer.on('transportclose', () => {
//       console.log('Transport for this producer closed');
//       producer.close();
//     });
//   });

//   /**
//    * Handles client disconnection.
//    * @event
//    * @name disconnect
//    */
//   socket.on('disconnect', () => {
//     handleClientDisconnect(socket);
//   });
// });

// /**
//  * Handles WebRTC signaling data based on message type.
//  * @async
//  * @function
//  * @param {Object} socket - Socket.io socket representing the connected client.
//  * @param {Object} message - Signaling message from the client.
//  */
// async function handleSignalingData(socket, message) {
//   switch (message.type) {
//     case 'join':
//       handleJoin(socket, message);
//       break;

//     case 'offer':
//       handleOffer(socket, message);
//       break;

//     case 'answer':
//       handleAnswer(socket, message);
//       break;

//     case 'ice-candidate':
//       handleIceCandidate(socket, message);
//       break;

//     case 'getRtpCapabilities':
//       handleRtpCapabilities(socket, message);
//       break;

//     default:
//       break;
//   }
// }

// /**
//  * Handles 'join' signaling message, creating a WebRTC transport for the client.
//  * @async
//  * @function
//  * @param {Object} socket - Socket.io socket representing the connected client.
//  * @param {Object} message - 'join' signaling message containing roomId.
//  */
// async function handleJoin(socket, message) {
//   const { roomId } = message;
//   console.log(`${socket.id} joined room ${roomId}`);

//   const webRtcTransportOptions = {
//     listenIps: [
//       {
//         ip: '0.0.0.0',
//         announcedIp: '127.0.0.1',
//       },
//     ],
//     enableUdp: true,
//     enableTcp: true,
//     preferUdp: true,
//   };

//   // Create WebRTC transport for the client
//   const transport = await router.createWebRtcTransport(webRtcTransportOptions);
//   transports.set(socket.id, transport);
//   console.log(`Transport ID: ${transport.id}`);

//   transport.on('dtlsstatechange', (dtlsState) => {
//     if (dtlsState === 'closed') {
//       transport.close();
//     }
//   });

//   transport.on('close', () => {
//     console.log('Transport closed');
//   });

//   // Send the transport parameters to the client
//   socket.emit('transport', {
//     id: transport.id,
//     iceParameters: transport.iceParameters,
//     iceCandidates: transport.iceCandidates,
//     dtlsParameters: transport.dtlsParameters,
//   });
// }

// /**
//  * Handles 'offer' signaling message, creating a WebRTC producer for the client.
//  * @async
//  * @function
//  * @param {Object} socket - Socket.io socket representing the connected client.
//  * @param {Object} message - 'offer' signaling message containing offer and targetSocketId.
//  */
// async function handleOffer(socket, message) {
//   const { roomId, offer, targetSocketId } = message;
//   console.log(`${socket.id} sent an offer to ${targetSocketId}`);

//   // Create a WebRTC producer for the client
//   const producerTransport = transports.get(socket.id);
//   const producer = await producerTransport.produce({
//     kind: 'audio', // or 'video'
//     rtpParameters: offer.rtpParameters,
//   });
//   producers.set(socket.id, producer);

//   // Send the offer to the target client
//   io.to(targetSocketId).emit('offer', {
//     roomId,
//     offer,
//     socketId: socket.id,
//   });
// }

// /**
//  * Handles 'answer' signaling message, sending the answer to the WebRTC producer.
//  * @async
//  * @function
//  * @param {Object} socket - Socket.io socket representing the connected client.
//  * @param {Object} message - 'answer' signaling message containing answer and targetSocketId.
//  */
// async function handleAnswer(socket, message) {
//   const { answer, targetSocketId } = message;
//   console.log(`${socket.id} sent an answer to ${targetSocketId}`);

//   // Get the producer for the target client
//   const producer = producers.get(targetSocketId);

//   // Send the answer to the producer
//   await producer.send({
//     ...answer,
//   });
// }

// /**
//  * Handles 'ice-candidate' signaling message, adding ICE candidate to the WebRTC transport.
//  * @async
//  * @function
//  * @param {Object} socket - Socket.io socket representing the connected client.
//  * @param {Object} message - 'ice-candidate' signaling message containing targetSocketId and candidate.
//  */
// async function handleIceCandidate(socket, message) {
//   const { targetSocketId, candidate } = message;
//   console.log(`${socket.id} sent ICE candidate to ${targetSocketId}`);

//   // Get the WebRTC transport for the target client
//   const transport = transports.get(targetSocketId);

//   // Add the ICE candidate
//   await transport.addIceCandidate(candidate);
// }

// /**
//  * Handles client disconnection, cleaning up resources for the disconnected client.
//  * @function
//  * @param {Object} socket - Socket.io socket representing the disconnected client.
//  */
// function handleClientDisconnect(socket) {
//   console.log(`${socket.id} disconnected`);

//   // Clean up resources for the disconnected client
//   const transport = transports.get(socket.id);
//   if (transport) {
//     transport.close();
//     transports.delete(socket.id);
//   }

//   const producer = producers.get(socket.id);
//   if (producer) {
//     producer.close();
//     producers.delete(socket.id);
//   }

//   const consumer = consumers.get(socket.id);
//   if (consumer) {
//     consumer.close();
//     consumers.delete(socket.id);
//   }
// }

// /**
//  * Handles 'getRtpCapabilities' message, sending Mediasoup router's RTP capabilities to the client.
//  * @function
//  * @param {Object} socket - Socket.io socket representing the connected client.
//  * @param {Object} message - 'getRtpCapabilities' signaling message.
//  */
// const handleRtpCapabilities = (socket, message) => {
//   console.log('Getting RTP capabilities called');
//   const rtpCapabilities = router.rtpCapabilities;

//   socket.emit('RtpCapabilities', { rtpCapabilities });
// };

// // Start the server
// server.listen(PORT, () => {
//   console.log(`Server listening on port ${PORT}`);
// });

