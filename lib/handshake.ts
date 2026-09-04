import {CBORSerializer, JSONSerializer, MsgPackSerializer, Serializer} from "xconn";

// Mirrors wampproto-go's transports package: a RawSocket-style 4-byte
// magic-byte handshake, reused here to identify a DataChannel as a WAMP
// session (see xconn-webrtc-go's handshake.go).
const MAGIC = 0x7f;
const DEFAULT_MAX_MSG_SIZE = 1 << 20;

function serializerRawSocketID(serializer: Serializer): number {
    if (serializer instanceof JSONSerializer) return 1;
    if (serializer instanceof MsgPackSerializer) return 2;
    if (serializer instanceof CBORSerializer) return 3;
    throw new Error("invalid serializer");
}

function buildHandshake(serializerID: number): Uint8Array {
    const sizeShift = Math.log2(DEFAULT_MAX_MSG_SIZE) - 9;
    const b1 = ((sizeShift << 4) | (serializerID & 0x0f)) & 0xff;
    return new Uint8Array([MAGIC, b1, 0x00, 0x00]);
}

function isHandshake(data: Uint8Array): boolean {
    return data.length === 4 && data[0] === MAGIC && data[2] === 0x00 && data[3] === 0x00;
}

// Performs the client side of the magic-byte handshake on an already-open
// channel: send our handshake, then wait for the server's response before
// any WAMP traffic flows. Mirrors xconn-webrtc-go's sendClientHandshake.
export function sendClientHandshake(channel: RTCDataChannel, serializer: Serializer, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            channel.onmessage = null;
            reject(new Error("timed out waiting for handshake response"));
        }, timeoutMs);

        channel.onmessage = (event: MessageEvent) => {
            clearTimeout(timer);
            channel.onmessage = null;

            const data = event.data instanceof ArrayBuffer ? new Uint8Array(event.data) : null;
            if (!data || !isHandshake(data)) {
                reject(new Error("failed to parse handshake response"));
                return;
            }
            resolve();
        };

        channel.send(buildHandshake(serializerRawSocketID(serializer)).buffer as ArrayBuffer);
    });
}
