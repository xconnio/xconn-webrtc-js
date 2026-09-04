import {ClientAuthenticator, joinPeer, Serializer, Session} from "xconn";

import {WebRTCPeer} from "./peer";
import {sendClientHandshake} from "./handshake";
import {OpenSessionConfig} from "./types";

// A WAMP session established over a WebRTC DataChannel. Extends Session, so
// every WAMP operation (call, register, publish, subscribe, ...) is available
// directly on it, while connection/channel give access to the shared
// RTCPeerConnection: openSession opens more independent WAMP sessions on it,
// and openDataChannel/onDataChannel open or receive raw (non-WAMP) data
// channels on it. Mirrors xconn-webrtc-go's WebRTCSession.
export class WebRTCSession extends Session {
    private constructor(
        baseSession: ConstructorParameters<typeof Session>[0],
        public readonly connection: RTCPeerConnection,
        public readonly channel: RTCDataChannel,
    ) {
        super(baseSession);
    }

    // Performs the magic-byte handshake and WAMP join over an already-open
    // channel, wrapping the result in a WebRTCSession that shares connection.
    // Used both for a brand new connection's first channel and for
    // additional channels opened via openSession.
    static async join(
        connection: RTCPeerConnection,
        channel: RTCDataChannel,
        realm: string,
        serializer: Serializer,
        authenticator: ClientAuthenticator,
        timeoutMs: number,
    ): Promise<WebRTCSession> {
        await sendClientHandshake(channel, serializer, timeoutMs);

        const peer = new WebRTCPeer(channel, connection, serializer);
        const baseSession = await joinPeer(peer, realm, serializer, authenticator);

        return new WebRTCSession(baseSession, connection, channel);
    }

    // Opens an additional, independent WAMP session on the same
    // RTCPeerConnection by creating a new DataChannel. No new offer/answer/ICE
    // exchange is required: opening extra data channels on an
    // already-established connection is handled by SCTP directly.
    async openSession(realm: string, config: OpenSessionConfig = new OpenSessionConfig()): Promise<WebRTCSession> {
        const channel = await this.openDataChannel("data");

        return WebRTCSession.join(this.connection, channel, realm, config.serializer, config.authenticator, config.openTimeout);
    }

    // Opens a new raw (non-WAMP) data channel over the same
    // RTCPeerConnection. label identifies the channel's purpose (e.g. "file-stream").
    openDataChannel(label: string, options?: RTCDataChannelInit): Promise<RTCDataChannel> {
        return new Promise((resolve, reject) => {
            let channel: RTCDataChannel;
            try {
                channel = this.connection.createDataChannel(label, {ordered: true, ...options});
            } catch (err) {
                reject(err instanceof Error ? err : new Error(String(err)));
                return;
            }
            channel.binaryType = "arraybuffer";

            channel.onopen = () => resolve(channel);
            channel.onerror = (event) => {
                const message = "error" in event && event.error instanceof Error ? event.error.message : "unknown error";
                reject(new Error(`data channel "${label}" failed to open: ${message}`));
            };
        });
    }

    // Registers a callback for raw (non-WAMP) data channels the remote peer opens.
    onDataChannel(callback: (channel: RTCDataChannel) => void): void {
        this.connection.addEventListener("datachannel", (event) => callback(event.channel));
    }
}
