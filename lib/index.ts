import {CBORSerializer, connectAnonymous, SessionDetails, WAMPCRAAuthenticator} from "xconn";
import {connectWebRTC} from "./webrtc";
import {ClientConfig} from "./types";
import {WebRTCSession} from "./webrtc-session";
import {WebRTCPeer} from "./webrtc-peer";
import {join} from "./joiner";


async function main() {
    console.log('Happy developing ✨')
    const session = await connectAnonymous("ws://localhost:8080/ws", "realm1");
    console.log('session created')
    console.log(session);
    const config = new ClientConfig(
        "realm1",
        "io.xconn.webrtc.offer",
        "io.xconn.webrtc.answerer.on_candidate",
        "io.xconn.webrtc.offerer.on_candidate",
        new CBORSerializer(),
        new WAMPCRAAuthenticator("john", "hello", {}),
        session
    )
    const { connection, channel } = await connectWebRTC(config);
    const webRTCPeer = new WebRTCPeer(channel, connection, config.serializer);
    const newSession = await join(webRTCPeer, config)
    console.log('session created')
    console.log(newSession)

    console.log("Received message:");
}


main().catch((err) => {
    console.error("Error:", err);
});
