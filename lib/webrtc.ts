import {Event, Session, getSubProtocol, joinPeer} from "xconn";

import {WebRTCPeer} from "./peer";
import {Offerer} from "./offerer";
import {ClientConfig, Offer, OfferConfig, OfferResponse} from "./types";

export async function connectWebRTC(config: ClientConfig) {
    const offerer = new Offerer();

    const offerConfig = new OfferConfig(
        getSubProtocol(config.serializer),
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

    offerer.startICETrickle(config.session, offerConfig.topicAnswererOnCandidate, offerResponse.requestID);
    await offerer.handleAnswer(offerResponse.answer);

    const channel = await offerer.waitReady();

    return { connection: offerer.getConnection(), channel };
}

export async function connectWAMP(config: ClientConfig): Promise<Session>{
    const { connection, channel } = await connectWebRTC(config);
    const peer = new WebRTCPeer(channel, connection);
    const baseSession = await joinPeer(peer, config.realm, config.serializer, config.authenticator);

    return new Session(baseSession);
}
