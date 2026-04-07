import { Session } from "xconn";

import {Answer, Offer, OfferConfig} from "./types";

export class Offerer {
    private connection?: RTCPeerConnection;
    private readonly channelPromise: Promise<RTCDataChannel>;
    private channelResolve!: (channel: RTCDataChannel) => void;
    private pendingCandidates: RTCIceCandidateInit[] = [];
    private publishICECandidate?: (candidate: RTCIceCandidateInit) => Promise<void>;

    constructor() {
        this.channelPromise = new Promise((resolve) => {
            this.channelResolve = resolve;
        });
    }

    async offer(offerConfig: OfferConfig): Promise<Offer> {
        const config: RTCConfiguration = {
            iceServers: offerConfig.iceServers,
        };

        const pc = new RTCPeerConnection(config);
        this.connection = pc;

        const initialCandidates: RTCIceCandidateInit[] = [];
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
                initialCandidates.push(candidateData);
                return;
            }

            await this.handleICECandidate(candidateData);
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

        return {description: offer, candidates: initialCandidates};
    }

    async startICETrickle(session: Session, topic: string, requestID: string): Promise<void> {
        if (!this.connection) {
            throw new Error("Connection not initialized");
        }

        this.publishICECandidate = async (candidate) => {
            await session.publish(topic, [requestID, candidate]);
        };

        const pendingCandidates = this.pendingCandidates;
        this.pendingCandidates = [];

        for (const candidate of pendingCandidates) {
            await this.publishICECandidate(candidate);
        }
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

    private async handleICECandidate(candidate: RTCIceCandidateInit): Promise<void> {
        if (!this.publishICECandidate) {
            this.pendingCandidates.push(candidate);
            return;
        }

        await this.publishICECandidate(candidate);
    }
}
