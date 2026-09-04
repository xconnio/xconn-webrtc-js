import {AnonymousAuthenticator, ClientAuthenticator, JSONSerializer, Serializer, Session} from "xconn";

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
        public readonly serializer: Serializer,
        public readonly authenticator: ClientAuthenticator,
        public readonly session: Session,
        public readonly iceServers: RTCIceServer[],
    ) {}
}

// Configures an additional WAMP session opened via WebRTCSession.openSession.
export class OpenSessionConfig {
    constructor(
        public readonly serializer: Serializer = new JSONSerializer(),
        public readonly authenticator: ClientAuthenticator = new AnonymousAuthenticator("", {}),
        public readonly openTimeout = 20_000,
    ) {}
}
