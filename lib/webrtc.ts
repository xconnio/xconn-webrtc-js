import { Offerer } from "./offerer";
import { v4 as uuidv4 } from "uuid";
import {ClientConfig, OfferConfig} from "./types";
import {Event} from "xconn";

export async function connectWebRTC(config: ClientConfig) {
    const offerer = new Offerer();

    await config.session.subscribe(config.topicOffererOnCandidate, async (event: Event) => {
        if (event.args.length < 2) {
            return;
        }

        console.log(`event received ${event.args}`)
        const candidateJSON = event.args[1];
        const candidate: RTCIceCandidateInit = JSON.parse(candidateJSON);
        await offerer.addICECandidate(candidate);
    });

    const requestId = uuidv4();

    const offerConfig = new OfferConfig(
        "wamp.2.cbor",
        ["stun:stun.l.google.com:19302"],
        true,
        1,
        config.topicAnswererOnCandidate
    );

    const offer = await offerer.offer(offerConfig, config.session, requestId);

    const offerJSON = JSON.stringify({"description": offer.description, "candidates": []})
    const callResult = await config.session.call(config.procedureWebRTCOffer, [
        requestId,
        offerJSON,
    ]);

    const answerText = callResult.args[0];
    const answer = JSON.parse(answerText);

    await offerer.handleAnswer(answer);

    // Wait for channel ready
    const channel = await offerer.waitReady();

    console.log("Channel ready:", channel);

    return { connection: offerer.getConnection(), channel };
}
