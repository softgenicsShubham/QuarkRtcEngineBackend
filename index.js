import e from "express";
import http from 'http';
import mediasoup from 'mediasoup';
import { Server } from 'socket.io'



const app = e();
const server = http.createServer(app);
const io = new Server(server)

server.listen(3000, (error) => {
    if (error) throw error;
    console.log("Application is running on port no 3000")
})

const mediaCodecs = [
    {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
    },
    {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
            'x-google-start-bitrate': 1000,
        },
    },
];


const webRtcTransportOptions = {
    listenIps: [
        {
            ip: '0.0.0.0',
            announcedIp: '127.0.0.1',
        },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
};

let worker;
let router;


let transport;
let producer;
let consumer;



const InitializesMedisoup = async () => {
    try {
        worker = await mediasoup.createWorker();
        router = await worker.createRouter({ mediaCodecs });









    } catch (error) {
        console.error(error)
    }
}


InitializesMedisoup()


io.on('connection', (socket) => {
    console.log("someone connected with socker id", socket.id)

    socket.on('getRtpCapabilities', (data) => {
        const rtpCapabilities = router.rtpCapabilities;
        socket.emit('sendingRtpCapablities', rtpCapabilities)
    })


    socket.on('createServerTransport', async (data) => {
        transport = await router.createWebRtcTransport(webRtcTransportOptions);

        transport.on('@close', () => {
            console.log("transport closed")
        })

        transport.on('dtlsstatechange', (params) => {
            if (params === 'closed') {
                transport.close
            }
        })

        socket.emit('transport', {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            sctpParameters: transport.sctpParameters
        })


        console.log('transport', transport)
    })


    socket.on('transport-connect', async ({ dtlsParameters }) => {
        console.log('DTLS PARAMS... ', { dtlsParameters })
        await transport.connect({ dtlsParameters })
        console.log('transport connected successfully')
    })



    socket.on('transport-produce', async ({ kind, rtpParameters, appData }, callback) => {
        producer = await transport.produce({
            kind,
            rtpParameters,
        })

        console.log('Producer ID: ', producer.id, producer.kind)

        producer.on('transportclose', () => {
            console.log('transport for this producer closed ')
            producer.close()
        })

        // Send back to the client the Producer's id
        callback({
            id: producer.id
        })
    })




    /**
     * Now the going to start for the consumers
     */



    // see client's socket.emit('transport-recv-connect', ...)
    socket.on('transport-recv-connect', async ({ dtlsParameters }) => {
        console.log(`DTLS PARAMS: ${dtlsParameters}`)
        await transport.connect({ dtlsParameters })
    })

    socket.on('consume', async ({ rtpCapabilities }, callback) => {
        try {
            // check if the router can consume the specified producer
            if (router.canConsume({
                producerId: producer.id,
                rtpCapabilities
            })) {
                // transport can now consume and return a consumer
                consumer = await transport.consume({
                    producerId: producer.id,
                    rtpCapabilities,
                    paused: true,
                })

                consumer.on('transportclose', () => {
                    console.log('transport close from consumer')
                })

                consumer.on('producerclose', () => {
                    console.log('producer of consumer closed')
                })

                // from the consumer extract the following params
                // to send back to the Client
                const params = {
                    id: consumer.id,
                    producerId: producer.id,
                    kind: consumer.kind,
                    rtpParameters: consumer.rtpParameters,
                }

                // send the parameters to the client
                callback({ params })
            }
        } catch (error) {
            console.log(error.message)
            callback({
                params: {
                    error: error
                }
            })
        }
    })

    socket.on('consumer-resume', async () => {
        console.log('consumer resume')
        await consumer.resume()
    })













socket.on('disconnect', () => {
    console.log("User disconnected whose socket id", socket.id)
})

})

