import {Event, Session, getSubProtocol, joinPeer} from "xconn";

import {WebRTCPeer} from "./peer";
import {Offerer} from "./offerer";
import {WebRTCSession} from "./session";
import {ClientConfig, Offer, OfferConfig, OfferResponse} from "./types";

interface PendingRemoteCandidate {
    requestID: string;
    candidate: RTCIceCandidateInit;
}

export async function connectWebRTC(config: ClientConfig): Promise<WebRTCSession> {
    const offerer = new Offerer();

    const offerConfig = new OfferConfig(
        getSubProtocol(config.serializer),
        config.iceServers,
        true,
        1,
        config.topicAnswererOnCandidate
    );

    const offer: Offer = await offerer.offer(offerConfig);

    let requestID = "";
    const pendingCandidates: PendingRemoteCandidate[] = [];

    await config.session.subscribe(config.topicOffererOnCandidate, async (event: Event) => {
        if (event.args.length < 2) {
            return;
        }

        const candidateRequestID = event.args[0] as string;
        const candidateJSON = event.args[1];
        const candidate: RTCIceCandidateInit = JSON.parse(candidateJSON);

        if (!requestID) {
            pendingCandidates.push({requestID: candidateRequestID, candidate});
            return;
        }

        if (candidateRequestID !== requestID) {
            return;
        }

        await offerer.addICECandidate(candidate);
    });

    const offerJSON = JSON.stringify({"description": offer.description, "candidates": offer.candidates})
    const callResult = await config.session.call(config.procedureWebRTCOffer, [offerJSON]);

    const offerResponse = JSON.parse(callResult.args[0] as string) as OfferResponse;
    if (!offerResponse.requestID) {
        throw new Error("Offer response request ID must not be empty");
    }

    requestID = offerResponse.requestID;

    const buffered = pendingCandidates.splice(0, pendingCandidates.length);
    for (const pc of buffered) {
        if (pc.requestID !== requestID) {
            continue;
        }
        await offerer.addICECandidate(pc.candidate);
    }

    await offerer.startICETrickle(config.session, offerConfig.topicAnswererOnCandidate, requestID);
    await offerer.handleAnswer(offerResponse.answer);

    const channel = await offerer.waitReady();

    return new WebRTCSession(offerer.getConnection(), channel);
}

export async function connectWAMP(config: ClientConfig): Promise<[Session, WebRTCSession]> {
    const webrtc = await connectWebRTC(config);
    const peer = new WebRTCPeer(webrtc.channel, webrtc.connection);
    const baseSession = await joinPeer(peer, config.realm, config.serializer, config.authenticator);

    return [new Session(baseSession), webrtc];
}
