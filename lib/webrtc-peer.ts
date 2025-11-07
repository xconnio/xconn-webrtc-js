import {Message, Serializer} from "xconn";

import {MessageAssembler} from "./message-assembler";

export interface Peer {
    send(data: any): void;
    receive(): Promise<any>;
    sendMessage(msg: Message): void;
    receiveMessage(): Promise<Message>;
    close(): Promise<void>;
}

const MTU_SIZE = 16 * 1024;

export class WebRTCPeer implements Peer {
    private readonly _channel: RTCDataChannel;
    private readonly _connection: RTCPeerConnection;
    private readonly _serializer: Serializer;
    private readonly _assembler: MessageAssembler;
    private readonly _messageQueue: Uint8Array[] = [];

    private _onMessageBound: ((event: MessageEvent) => void) | null = null;
    private _onCloseBound: (() => void) | null = null;

    constructor(
        channel: RTCDataChannel,
        connection: RTCPeerConnection,
        serializer: Serializer
    ) {
        this._channel = channel;
        this._connection = connection;
        this._serializer = serializer;
        this._assembler = new MessageAssembler(MTU_SIZE);

        // Attach message handler
        this._onMessageBound = (event: MessageEvent) => {
            const data = event.data;
            if (!(data instanceof ArrayBuffer)) return;

            const messageBytes = new Uint8Array(data);
            const assembled = this._assembler.feed(messageBytes);

            if (assembled) {
                this._messageQueue.push(assembled);
            }
        };
        this._channel.addEventListener("message", this._onMessageBound);

        // Handle closure
        this._onCloseBound = async () => {
            await this.close();
        };
        this._channel.addEventListener("close", this._onCloseBound);
    }

    serializer(): Serializer {
        return this._serializer;
    }

    send(data: Uint8Array): void {
        for (const chunk of this._assembler.chunkMessage(data)) {
            this._channel.send(chunk.buffer as ArrayBuffer);
        }
    }

    sendMessage(msg: Message): void {
        const serialized = this._serializer.serialize(msg);
        this.send(serialized as Uint8Array);
    }

    async receive(): Promise<Uint8Array> {
        // Wait until a message arrives
        return new Promise((resolve) => {
            const checkQueue = () => {
                if (this._messageQueue.length > 0) {
                    resolve(this._messageQueue.shift()!);
                } else {
                    setTimeout(checkQueue, 10);
                }
            };
            checkQueue();
        });
    }

    async receiveMessage(): Promise<Message> {
        const data = await this.receive();
        return this._serializer.deserialize(data);
    }

    async close(): Promise<void> {
        if (this._onMessageBound) {
            this._channel.removeEventListener("message", this._onMessageBound);
            this._onMessageBound = null;
        }

        if (this._onCloseBound) {
            this._channel.removeEventListener("close", this._onCloseBound);
            this._onCloseBound = null;
        }

        try {
            this._channel.close();
        } catch {
            /* ignore */
        }

        try {
            this._connection.close();
        } catch {
            /* ignore */
        }
    }
}
