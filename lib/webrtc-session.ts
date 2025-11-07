import { Message, Serializer } from "xconn";
import { WebRTCPeer } from "./webrtc-peer";

export class WebRTCSession {
    private readonly _peer: WebRTCPeer;
    private readonly _serializer: Serializer;
    private readonly _details: any;

    constructor(base: { peer: WebRTCPeer; details: any; serializer: Serializer }) {
        this._peer = base.peer;
        this._details = base.details;
        this._serializer = base.serializer;
    }

    async sendMessage(msg: Message): Promise<void> {
        this._peer.sendMessage(msg);
    }

    async receiveMessage(): Promise<Message> {
        return this._peer.receiveMessage();
    }

    get details() {
        return this._details;
    }

    async close(): Promise<void> {
        await this._peer.close();
    }
}
