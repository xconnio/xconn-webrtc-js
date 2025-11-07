import {CBORSerializer, AnonymousAuthenticator, Session, WAMPCRAAuthenticator} from "xconn";

export class OfferConfig {
    constructor(
        public readonly protocol: string,
        public readonly iceServers: any[],
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
        public readonly authenticator: WAMPCRAAuthenticator,
        public readonly session: Session,
    ) {}
}
