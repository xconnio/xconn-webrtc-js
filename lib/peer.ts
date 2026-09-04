import { JSONSerializer, Peer, Serializer } from "xconn";

import {MessageAssembler, MTU_SIZE} from "./assembler";

export class WebRTCPeer implements Peer {
    private readonly _channel: RTCDataChannel;
    private readonly _connection: RTCPeerConnection;
    private readonly _assembler: MessageAssembler;
    // JSONSerializer works with strings, not bytes; the wire framing itself
    // (see assembler.ts) is always raw bytes, matching xconn-webrtc-go.
    private readonly _isText: boolean;

    private readonly _messageQueue: (Uint8Array | string)[] = [];
    private readonly _pendingReceivers: {
        resolve: (data: Uint8Array | string) => void;
        reject: (err: Error) => void;
    }[] = [];

    private readonly _disconnectHandlers: (() => Promise<void>)[] = [];

    private _closed = false;

    constructor(channel: RTCDataChannel, connection: RTCPeerConnection, serializer: Serializer) {
        this._channel = channel;
        this._connection = connection;
        this._assembler = new MessageAssembler(MTU_SIZE);
        this._isText = serializer instanceof JSONSerializer;

        this._bindEvents();
    }

    private _bindEvents() {
        this._channel.binaryType = "arraybuffer";

        this._channel.addEventListener("message", (event: MessageEvent) => {
            if (!(event.data instanceof ArrayBuffer)) return;

            const messageBytes = new Uint8Array(event.data);
            const assembled = this._assembler.feed(messageBytes);
            if (!assembled) return;

            const message = this._isText ? new TextDecoder().decode(assembled) : assembled;

            if (this._pendingReceivers.length > 0) {
                const receiver = this._pendingReceivers.shift();
                if (receiver) {
                    receiver.resolve(message);
                }
            } else {
                this._messageQueue.push(message);
            }
        });

        this._channel.addEventListener("close", () => {
            void this._handleDisconnect();
        });

        this._channel.addEventListener("error", () => {
            void this._handleDisconnect();
        });

        this._connection.addEventListener("connectionstatechange", () => {
            if (
                this._connection.connectionState === "failed" ||
                this._connection.connectionState === "disconnected" ||
                this._connection.connectionState === "closed"
            ) {
                void this._handleDisconnect();
            }
        });
    }

    private async _handleDisconnect() {
        if (this._closed) return;
        this._closed = true;

        while (this._pendingReceivers.length > 0) {
            const receiver = this._pendingReceivers.shift();
            if (receiver) {
                receiver.reject(new Error("WebRTC connection closed"));
            }
        }

        for (const handler of this._disconnectHandlers) {
            try {
                await handler();
            } catch {
                // ignore
            }
        }
    }

    onDisconnect(callback: () => Promise<void>): void {
        this._disconnectHandlers.push(callback);
    }

    isConnected(): boolean {
        return (
            !this._closed &&
            this._channel.readyState === "open" &&
            this._connection.connectionState === "connected"
        );
    }

    send(data: Uint8Array | string): void {
        const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
        for (const chunk of this._assembler.chunkMessage(bytes)) {
            this._channel.send(chunk.buffer as ArrayBuffer);
        }
    }

    async receive(): Promise<Uint8Array | string> {
        if (this._messageQueue.length > 0) {
            const msg = this._messageQueue.shift();
            if (!msg) {
                throw new Error("Message queue unexpectedly empty");
            }

            return msg;
        }

        return new Promise((resolve, reject) => {
            this._pendingReceivers.push({ resolve, reject });
        });
    }

    async close(): Promise<void> {
        if (this._closed) return;

        this._closed = true;

        try {
            this._channel.close();
        } catch (error) {
            console.log(error)
        }

        await this._handleDisconnect();
    }
}
