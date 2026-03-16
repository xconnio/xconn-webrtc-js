import { v4 } from "uuid";
import {Event, Session, getSubProtocol, joinPeer} from "xconn";

import {WebRTCPeer} from "./peer";
import {Offerer} from "./offerer";
import {ClientConfig, Offer, OfferConfig} from "./types";

export async function connectWebRTC(config: ClientConfig) {
    const offerer = new Offerer();
    const requestId = v4();

    const offerConfig = new OfferConfig(
        getSubProtocol(config.serializer),
        config.iceServers,
        true,
        1,
        config.topicAnswererOnCandidate
    );

    const offer: Offer = await offerer.offer(offerConfig, config.session, requestId);

    await config.session.subscribe(config.topicOffererOnCandidate, async (event: Event) => {
        if (event.args.length < 2) {
            return;
        }

        const candidateJSON = event.args[1];
        const candidate: RTCIceCandidateInit = JSON.parse(candidateJSON);
        await offerer.addICECandidate(candidate);
    });

    const offerJSON = JSON.stringify({"description": offer.description, "candidates": offer.candidates})
    const callResult = await config.session.call(config.procedureWebRTCOffer, [requestId, offerJSON]);

    const answer = JSON.parse(callResult.args[0]);
    await offerer.handleAnswer(answer);

    const channel = await offerer.waitReady();

    return { connection: offerer.getConnection(), channel };
}

export async function connectWAMP(config: ClientConfig): Promise<Session>{
    const { connection, channel } = await connectWebRTC(config);
    const peer = new WebRTCPeer(channel, connection);
    const baseSession = await joinPeer(peer, config.realm, config.serializer, config.authenticator);

    return new Session(baseSession);
}
