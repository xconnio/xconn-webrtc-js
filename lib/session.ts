// Wraps an established WebRTC connection: the underlying RTCPeerConnection and
// its first (WAMP) data channel. Mirrors xconn-webrtc-go's WebRTCSession.
export class WebRTCSession {
    constructor(
        public readonly connection: RTCPeerConnection,
        public readonly channel: RTCDataChannel,
    ) {}

    // Opens an additional RTCDataChannel over the existing peer connection.
    // label identifies the channel's purpose (e.g. "file-stream"). This is
    // independent of the WAMP handshake: the channel is handed back as soon
    // as it's open, with no protocol assumptions about its first message. The
    // answerer identifies channels by arrival order — the first data channel
    // it receives is the WAMP channel, every channel opened after that (i.e.
    // via this method) is routed to its non-WAMP data channel callback
    // instead of being treated as a WAMP transport.
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
}
