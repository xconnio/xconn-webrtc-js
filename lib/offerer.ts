import { Session } from "xconn";

import {Answer, Offer, OfferConfig} from "./types";

export class Offerer {
    private connection?: RTCPeerConnection;
    private readonly channelPromise: Promise<RTCDataChannel>;
    private channelResolve!: (channel: RTCDataChannel) => void;

    constructor() {
        this.channelPromise = new Promise((resolve) => {
            this.channelResolve = resolve;
        });
    }

    async offer(offerConfig: OfferConfig, session: Session, requestID: string): Promise<Offer> {
        const config: RTCConfiguration = {
            iceServers: offerConfig.iceServers,
        };

        const pc = new RTCPeerConnection(config);
        this.connection = pc;

        const cachedCandidates: RTCIceCandidateInit[] = [];
        let batching = true;

        // after 200ms stop batching
        const batchingPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
                batching = false;
                resolve();
            }, 200);
        });

        pc.onicecandidate = async (event) => {
            // ice candidates gathering complete
            if (!event.candidate) {
                batching = false;
                return;
            }

            const candidateData = event.candidate.toJSON();

            if (batching) {
                cachedCandidates.push(candidateData);
            } else {
                await session.publish(offerConfig.topicAnswererOnCandidate, [requestID, candidateData]);
            }
        };

        pc.onconnectionstatechange = () => {
            console.debug("Peer connection state changed:", pc.connectionState);
        };

        const dataChannel = pc.createDataChannel("data", {
            ordered: offerConfig.ordered,
            protocol: offerConfig.protocol,
            id: offerConfig.id,
        });
        dataChannel.binaryType = "arraybuffer";

        dataChannel.onopen = () => {
            this.channelResolve(dataChannel);
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // wait for initial candidate gathering window
        await batchingPromise;

        return {description: offer, candidates: cachedCandidates};
    }

    async handleAnswer(answer: Answer): Promise<void> {
        if (!this.connection) {
            throw new Error("Connection not initialized");
        }

        await this.connection.setRemoteDescription(answer.description);

        for (const candidate of answer.candidates) {
            try {
                await this.connection.addIceCandidate(candidate);
            } catch (err) {
                console.error("Failed to add ICE candidate:", err);
            }
        }
    }

    async addICECandidate(candidate: RTCIceCandidateInit): Promise<void> {
        if (!this.connection) {
            throw new Error("Connection not initialized");
        }

        await this.connection.addIceCandidate(candidate);
    }

    async waitReady(): Promise<RTCDataChannel> {
        return this.channelPromise;
    }

    getConnection(): RTCPeerConnection {
        if (!this.connection) {
            throw new Error("Connection not initialized");
        }

        return this.connection;
    }
}
