import { Session } from "xconn";
import {OfferConfig} from "./types";

export interface Offer {
    description: RTCSessionDescriptionInit;
}

export interface Answer {
    description: RTCSessionDescriptionInit;
    candidates: RTCIceCandidateInit[];
}

/**
 * Offerer handles the WebRTC offer creation, ICE candidate signaling, and data channel setup.
 */
export class Offerer {
    private connection?: RTCPeerConnection;
    private readonly channelPromise: Promise<RTCDataChannel>;
    private channelResolve!: (channel: RTCDataChannel) => void;

    constructor() {
        // Promise resolves when the data channel is open
        this.channelPromise = new Promise((resolve) => {
            this.channelResolve = resolve;
        });
    }

    /**
     * Create and send a WebRTC offer.
     */
    async offer(
        offerConfig: OfferConfig,
        session: Session,
        requestId: string
    ): Promise<Offer> {

        const config: RTCConfiguration = {
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        };

        const pc = new RTCPeerConnection(config);
        this.connection = pc;

        // Handle ICE candidates generated locally
        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                const candidateData = JSON.stringify(event.candidate.toJSON());
                await session.publish(offerConfig.topicAnswererOnCandidate, [
                    requestId,
                    candidateData,
                ]);
            }
        };

        // Handle connection state changes for debugging/logging
        pc.onconnectionstatechange = () => {
            console.debug("Peer connection state changed:", pc.connectionState);
        };

        // Create the data channel
        const dataChannel = pc.createDataChannel("data", {
            ordered: offerConfig.ordered,
            protocol: offerConfig.protocol,
            id: offerConfig.id,
        });

        // When open, resolve the promise
        dataChannel.onopen = () => {
            console.debug("Data channel opened");
            this.channelResolve(dataChannel);
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        return { description: offer };
    }

    /**
     * Apply the remote answer (SDP + ICE candidates).
     */
    async handleAnswer(answer: Answer): Promise<void> {
        if (!this.connection) {
            throw new Error("Connection not initialized");
        }

        await this.connection.setRemoteDescription(answer.description);

        for (const candidate of answer.candidates || []) {
            try {
                await this.connection.addIceCandidate(candidate);
            } catch (err) {
                console.error("Failed to add ICE candidate:", err);
            }
        }
    }

    /**
     * Add a remote ICE candidate received from the answerer.
     */
    async addICECandidate(candidate: RTCIceCandidateInit): Promise<void> {
        if (!this.connection) {
            throw new Error("Connection not initialized");
        }
        await this.connection.addIceCandidate(candidate);
    }

    /**
     * Wait for the data channel to become ready and return it.
     */
    async waitReady(): Promise<RTCDataChannel> {
        return this.channelPromise;
    }

    /**
     * Get the underlying RTCPeerConnection.
     */
    getConnection(): RTCPeerConnection {
        return this.connection!;
    }
}
