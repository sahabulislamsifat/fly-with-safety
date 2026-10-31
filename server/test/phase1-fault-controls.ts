import { createServer, createConnection, type Socket } from 'node:net';

/** Test-only backend-protocol filter. Never interprets client/auth/query payloads.
 * Forward complete frames unchanged until the exact COMMIT command tag is armed.
 * Holding the whole frame prevents a fragmented acknowledgement leaking early.
 */
export class CommitAckFilter {
  private buffered = Buffer.alloc(0);
  private armed = false;
  dropped = false;
  arm(): void {
    if (this.armed || this.dropped) throw new Error('FAULT_ARM_INVALID');
    this.armed = true;
  }
  push(chunk: Uint8Array): Buffer[] {
    if (this.dropped) return [];
    const forwarded: Buffer[] = [];
    // The upstream socket highWaterMark bounds incoming chunks. Also bound direct callers.
    if (chunk.byteLength > 16 * 1024 * 1024) throw new Error('FAULT_FRAME_INVALID');
    this.buffered = Buffer.concat([this.buffered, chunk]);
    while (this.buffered.length >= 5) {
      const length = this.buffered.readUInt32BE(1);
      if (length < 4 || length > 16 * 1024 * 1024) throw new Error('FAULT_FRAME_INVALID');
      if (this.buffered.length < length + 1) break;
      const frame = this.buffered.subarray(0, length + 1);
      this.buffered = this.buffered.subarray(length + 1);
      if (this.armed && frame[0] === 0x43 && length === 11 &&
          frame.subarray(5).equals(Buffer.from('COMMIT\0'))) {
        this.dropped = true;
        this.buffered = Buffer.alloc(0);
        break; // Drop CommandComplete AND coalesced ReadyForQuery. Commit already occurred upstream.
      }
      forwarded.push(frame);
    }
    return forwarded;
  }
  clear(): void { this.buffered = Buffer.alloc(0); }
}

/** Exactly one local client and one fixed upstream. Inert until explicitly called.
 * No TLS downgrade: dedicated synthetic local pg client must specify ssl:false.
 * No logs, captured parameters, credentials, retries or external listener.
 */
export async function openCommitAckFault(approved: boolean): Promise<{
  port: number; arm(): void; observed(): { acknowledgementDropped: boolean; transportFailed: boolean };
  close(): Promise<void>;
}> {
  if (approved !== true) throw new Error('FAULT_APPROVAL_REQUIRED');
  const filter = new CommitAckFilter(), sockets = new Set<Socket>();
  let accepted = false, failed = false;
  const server = createServer(client => {
    if (accepted) { client.destroy(); return; }
    accepted = true;
    const upstream = createConnection({ host: '127.0.0.1', port: 5432 });
    for (const socket of [client, upstream]) {
      sockets.add(socket);
      socket.setTimeout(15000);
      socket.on('timeout', () => { failed = true; client.destroy(); upstream.destroy(); });
      socket.on('error', () => { if (!filter.dropped) failed = true; client.destroy(); upstream.destroy(); });
      socket.on('close', () => { sockets.delete(socket); client.destroy(); upstream.destroy(); });
    }
    client.pipe(upstream); // Opaque client bytes; never parsed, stored or logged.
    upstream.on('data', (data: Buffer) => {
      try {
        for (const frame of filter.push(data)) if (!client.write(frame)) upstream.pause();
        if (filter.dropped) { client.destroy(); upstream.destroy(); }
      } catch { failed = true; client.destroy(); upstream.destroy(); }
    });
    client.on('drain', () => upstream.resume());
  });
  server.on('error', () => { failed = true; });
  await new Promise<void>((resolve, reject) => {
    const startupError = () => reject(new Error('FAULT_LISTENER_FAILED'));
    server.once('error', startupError);
    server.listen(0, '127.0.0.1', () => { server.off('error', startupError); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') { server.close(); throw new Error('FAULT_LISTENER_FAILED'); }
  return {
    port: address.port,
    arm: () => { if (!accepted || failed) throw new Error('FAULT_ARM_INVALID'); filter.arm(); },
    observed: () => ({ acknowledgementDropped: filter.dropped, transportFailed: failed }),
    async close() {
      for (const socket of sockets) socket.destroy();
      filter.clear();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** Pre-transaction rendezvous only. Does not extend the 1500ms DB observation
 * window. Late arrivals are rejected after timeout/cancel, before DB dispatch.
 */
export class PreparationGate {
  private count = 0;
  private state: 'waiting' | 'open' | 'cancelled' = 'waiting';
  private release!: () => void;
  private reject!: (error: Error) => void;
  private readonly admitted: Promise<void>;
  private ready!: () => void;
  private readonly allReady: Promise<void>;
  constructor(readonly required: number) {
    if (!Number.isInteger(required) || required < 1 || required > 16) throw new Error('FAULT_GATE_INVALID');
    this.admitted = new Promise((resolve, reject) => { this.release = resolve; this.reject = reject; });
    void this.admitted.catch(() => {}); // Cancel before arrivals is safe; each arrival still sees rejection.
    this.allReady = new Promise(resolve => { this.ready = resolve; });
  }
  async arrive(): Promise<void> {
    if (this.state !== 'waiting' || this.count >= this.required) throw new Error('FAULT_GATE_CANCELLED');
    if (++this.count === this.required) this.ready();
    await this.admitted;
    if (this.snapshot().state !== 'open') throw new Error('FAULT_GATE_CANCELLED');
  }
  async openWhenReady(budgetMs: number, beforeOpen: () => Promise<void> = async () => {}): Promise<void> {
    if (!Number.isFinite(budgetMs) || budgetMs <= 0 || budgetMs > 6500) { this.cancel(); throw new Error('FAULT_PREPARATION_BUDGET'); }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = performance.now();
    try {
      await Promise.race([this.allReady, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('FAULT_PREPARATION_TIMEOUT')), budgetMs);
      })]);
      if (this.state !== 'waiting') throw new Error('FAULT_GATE_CANCELLED');
      await beforeOpen();
      if (this.state !== 'waiting' || performance.now() - started > budgetMs) throw new Error('FAULT_GATE_CANCELLED');
      this.state = 'open'; this.release();
    } catch { this.cancel(); throw new Error('FAULT_PREPARATION_INCONCLUSIVE'); }
    finally { clearTimeout(timer); }
  }
  cancel(): void { if (this.state === 'waiting') { this.state = 'cancelled'; this.reject(new Error('FAULT_GATE_CANCELLED')); } }
  snapshot(): { required: number; arrived: number; state: 'waiting' | 'open' | 'cancelled' } {
    return { required: this.required, arrived: this.count, state: this.state };
  }
}
