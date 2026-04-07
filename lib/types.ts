import {CBORSerializer, Session, ClientAuthenticator} from "xconn";

export interface Offer {
    description: RTCSessionDescriptionInit;
    candidates: RTCIceCandidateInit[];
}

export type Answer = Offer;

export interface OfferResponse {
    requestID: string;
    answer: Answer;
}

export class OfferConfig {
    constructor(
        public readonly protocol: string,
        public readonly iceServers: RTCIceServer[],
        public readonly ordered: boolean,
        public readonly id: number,
        public readonly topicAnswererOnCandidate: string,
    ) {}
}

export class ClientConfig {
    constructor(
        public readonly realm: string,
        public readonly procedureWebRTCOffer: string,
        public readonly topicAnswererOnCandidate: string,
        public readonly topicOffererOnCandidate: string,
        public readonly serializer: CBORSerializer,
        public readonly authenticator: ClientAuthenticator,
        public readonly session: Session,
        public readonly iceServers: RTCIceServer[],
    ) {}
}
