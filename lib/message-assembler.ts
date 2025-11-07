export class MessageAssembler {
    private readonly mtu: number;
    private chunks: Uint8Array[] = [];

    constructor(mtu: number) {
        this.mtu = mtu;
    }

    feed(data: Uint8Array): Uint8Array | null {
        const isFinal = data[0];
        this.chunks.push(data.subarray(1));

        if (isFinal === 1) {
            const totalLength = this.chunks.reduce((a, c) => a + c.length, 0);
            const output = new Uint8Array(totalLength);

            let offset = 0;
            for (const chunk of this.chunks) {
                output.set(chunk, offset);
                offset += chunk.length;
            }

            this.chunks = [];
            return output;
        }

        return null;
    }

    *chunkMessage(message: Uint8Array): Generator<Uint8Array> {
        const chunkSize = this.mtu - 1; // 1 byte reserved for flag
        const totalChunks = Math.ceil(message.length / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, message.length);

            const isFinal = i === totalChunks - 1 ? 1 : 0;
            const chunk = message.subarray(start, end);

            const out = new Uint8Array(chunk.length + 1);
            out[0] = isFinal;
            out.set(chunk, 1);

            yield out;
        }
    }
}
