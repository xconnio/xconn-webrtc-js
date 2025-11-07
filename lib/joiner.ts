import { WebRTCPeer } from "./webrtc-peer";
import { ClientConfig } from "./types";
import { WebRTCSession } from "./webrtc-session";
import {Joiner} from "wampproto";

export async function join(
    peer: WebRTCPeer,
    config: ClientConfig
): Promise<WebRTCSession> {
    const joiner = new Joiner(config.realm, config.serializer, config.authenticator);

    const hello = joiner.sendHello();
    peer.send(hello as Uint8Array);

    while (true) {
        const msgBytes = await peer.receive();
        const toSend = await joiner.receive(msgBytes);

        if (toSend == null) {
            const sessionDetails = joiner.getSessionDetails();
            const base = {
                peer,
                details: sessionDetails,
                serializer: config.serializer,
            };
            return new WebRTCSession(base);
        }

        peer.send(toSend as Uint8Array);
    }
}
