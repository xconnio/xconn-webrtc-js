import {Event} from "xconn";

import {Offerer} from "./offerer";
import {WebRTCSession} from "./session";
import {ClientConfig, Offer, OfferConfig, OfferResponse} from "./types";

const DEFAULT_JOIN_TIMEOUT_MS = 20_000;

// Runs the offer/answer/ICE exchange and returns the resulting
// RTCPeerConnection and its first (signaling) DataChannel, before any WAMP
// handshake or join happens on it.
async function connectWebRTC(config: ClientConfig): Promise<{ connection: RTCPeerConnection; channel: RTCDataChannel }> {
    const offerer = new Offerer();

    const offerConfig = new OfferConfig(
        "",
        config.iceServers,
        true,
        1,
        config.topicAnswererOnCandidate
    );

    const offer: Offer = await offerer.offer(offerConfig);

    await config.session.subscribe(config.topicOffererOnCandidate, async (event: Event) => {
        if (event.args.length < 2) {
            return;
        }

        const candidateJSON = event.args[1];
        const candidate: RTCIceCandidateInit = JSON.parse(candidateJSON);
        await offerer.addICECandidate(candidate);
    });

    const offerJSON = JSON.stringify({"description": offer.description, "candidates": offer.candidates})
    const callResult = await config.session.call(config.procedureWebRTCOffer, [offerJSON]);

    const offerResponse = JSON.parse(callResult.args[0] as string) as OfferResponse;
    if (!offerResponse.requestID) {
        throw new Error("Offer response request ID must not be empty");
    }

    await offerer.startICETrickle(config.session, offerConfig.topicAnswererOnCandidate, offerResponse.requestID);
    await offerer.handleAnswer(offerResponse.answer);

    const channel = await offerer.waitReady();

    return {connection: offerer.getConnection(), channel};
}

// Establishes a WebRTC RTCPeerConnection and joins realm over its first
// DataChannel, returning a WebRTCSession. Since WebRTCSession extends
// Session, the result is immediately usable for WAMP calls, and also exposes
// the underlying connection for opening more sessions or raw data channels
// (see WebRTCSession.openSession / openDataChannel / onDataChannel).
export async function connectWAMP(config: ClientConfig): Promise<WebRTCSession> {
    const {connection, channel} = await connectWebRTC(config);

    return WebRTCSession.join(connection, channel, config.realm, config.serializer, config.authenticator, DEFAULT_JOIN_TIMEOUT_MS);
}
