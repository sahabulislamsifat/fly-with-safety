import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EventEmitter } from 'node:events';
import { CommitAckFilter, openCommitAckFault, PreparationGate } from './phase1-fault-controls.js';
import { verifyRemainingFaults, type FaultApproval } from './phase1-fault.integration.js';
import {verifyOrdinaryServiceAdapters} from './phase1-ordinary.integration.js';

const network = vi.hoisted(() => ({listen: vi.fn(), connect: vi.fn()}));
vi.mock('node:net', () => ({createServer: network.listen, createConnection: network.connect}));
vi.mock('pg', () => { throw new Error('OFFLINE_DRIVER_FORBIDDEN'); });
vi.mock('dotenv', () => { throw new Error('OFFLINE_ENV_FORBIDDEN'); });
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
const frame = (type: string, payload: string): Buffer => {
  const bytes = Buffer.from(payload), header = Buffer.alloc(5);
  header[0] = type.charCodeAt(0); header.writeUInt32BE(bytes.length + 4, 1);
  return Buffer.concat([header, bytes]);
};
const commit = frame('C', 'COMMIT\0'), ready = frame('Z', 'I');

describe('COMMIT wire-fault parser — synthetic byte fixtures, NOT live wire proof', () => {
  it('is inert on import', () => { expect(network.listen).not.toHaveBeenCalled(); expect(network.connect).not.toHaveBeenCalled(); });
  it('requires explicit authorization before opening any listener', async () => {
    await expect(openCommitAckFault(false)).rejects.toThrow('FAULT_APPROVAL_REQUIRED');
    expect(network.listen).not.toHaveBeenCalled();
  });
  it('forwards all unarmed messages byte-identically including COMMIT', () => {
    const source = Buffer.concat([frame('R', 'synthetic-auth'), frame('D', 'SYNTHETIC_PRIVATE_BYTES'), commit, ready]);
    expect(Buffer.concat(new CommitAckFilter().push(source))).toEqual(source);
  });
  for (let split = 0; split <= commit.length; split++) it('does not leak fragmented COMMIT bytes at split ' + split, () => {
    const parser = new CommitAckFilter(); parser.arm();
    expect(parser.push(commit.subarray(0, split))).toEqual([]);
    expect(parser.push(Buffer.concat([commit.subarray(split), ready]))).toEqual([]);
    expect(parser.dropped).toBe(true);
  });
  it('forwards earlier frames, drops ACK and all coalesced later frames', () => {
    const parser = new CommitAckFilter(), earlier = frame('C', 'UPDATE 1\0'); parser.arm();
    expect(parser.push(Buffer.concat([earlier, commit, ready]))).toEqual([earlier]);
    expect(parser.push(ready)).toEqual([]);
  });
  for (const tag of ['COMMIT', 'COMMIT\0extra', 'COMMIT 1\0', 'ROLLBACK\0', 'commit\0']) it('never confuses a different command tag with COMMIT: ' + JSON.stringify(tag), () => {
    const parser = new CommitAckFilter(), source = frame('C', tag); parser.arm();
    expect(parser.push(source)).toEqual([source]); expect(parser.dropped).toBe(false);
  });
  it('does not mistake arbitrary row/auth data for CommandComplete', () => {
    const parser = new CommitAckFilter(), source = frame('D', 'COMMIT\0'); parser.arm();
    expect(parser.push(source)).toEqual([source]); expect(parser.dropped).toBe(false);
  });
  for (const length of [0, 1, 3, 16777217, 4294967295]) it('rejects invalid frame length ' + length + ' with a fixed label', () => {
    const header = Buffer.alloc(5); header[0] = 0x44; header.writeUInt32BE(length, 1);
    expect(() => new CommitAckFilter().push(header)).toThrow('FAULT_FRAME_INVALID');
  });
  it('bounds direct incoming buffers', () => { expect(() => new CommitAckFilter().push(Buffer.alloc(16777217))).toThrow('FAULT_FRAME_INVALID'); });
  it('handles one-byte fragmentation without losing or modifying frames', () => {
    const source = frame('D', 'SYNTHETIC_ONLY'), parser = new CommitAckFilter(), output: Buffer[] = [];
    for (const byte of source) output.push(...parser.push(Buffer.from([byte])));
    expect(Buffer.concat(output)).toEqual(source);
  });
  it('rejects double arm and arm after acknowledged drop', () => {
    const parser = new CommitAckFilter(); parser.arm(); expect(() => parser.arm()).toThrow('FAULT_ARM_INVALID');
    parser.push(commit); expect(() => parser.arm()).toThrow('FAULT_ARM_INVALID');
  });
  it('clear discards incomplete buffered bytes', () => {
    const parser = new CommitAckFilter(); parser.push(frame('D', 'discard').subarray(0, 5)); parser.clear();
    expect(parser.push(ready)).toEqual([ready]);
  });
});

describe('bounded pre-transaction rendezvous — no timeout or concurrency relaxation', () => {
  for (const concurrency of [1, 2, 8, 16]) it('admits exactly ' + concurrency + ' only after blocker is held', async () => {
    const gate = new PreparationGate(concurrency), dispatch = vi.fn(), lock = vi.fn(async () => {});
    const work = Array.from({length: concurrency}, () => gate.arrive().then(dispatch));
    expect(dispatch).not.toHaveBeenCalled();
    await gate.openWhenReady(6500, lock); await Promise.all(work);
    expect(lock).toHaveBeenCalledTimes(1); expect(dispatch).toHaveBeenCalledTimes(concurrency);
    expect(gate.snapshot()).toEqual({required: concurrency, arrived: concurrency, state: 'open'});
    await expect(gate.arrive()).rejects.toThrow('FAULT_GATE_CANCELLED');
  });
  it('does not start the blocker transaction or dispatch while preparations are pending', async () => {
    const gate = new PreparationGate(16), lock = vi.fn(async () => {}), dispatch = vi.fn();
    const work = Array.from({length: 15}, () => gate.arrive().then(dispatch));
    const ready = gate.openWhenReady(6500, lock);
    await Promise.resolve(); expect(lock).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled();
    work.push(gate.arrive().then(dispatch)); await ready; await Promise.all(work);
    expect(lock).toHaveBeenCalledTimes(1); expect(dispatch).toHaveBeenCalledTimes(16);
  });
  it('timeout cancels all pending and late transactions', async () => {
    vi.useFakeTimers(); const gate = new PreparationGate(16), dispatch = vi.fn(), lock = vi.fn(async () => {});
    const work = Promise.allSettled(Array.from({length: 8}, () => gate.arrive().then(dispatch)));
    const ready = expect(gate.openWhenReady(6500, lock)).rejects.toThrow('FAULT_PREPARATION_INCONCLUSIVE');
    await vi.advanceTimersByTimeAsync(6500); await ready;
    expect((await work).every(x => x.status === 'rejected')).toBe(true);
    await expect(gate.arrive()).rejects.toThrow('FAULT_GATE_CANCELLED');
    expect(dispatch).not.toHaveBeenCalled(); expect(lock).not.toHaveBeenCalled();
  });
  it('early scenario failure prevents late arrivals from dispatching', async () => {
    const gate = new PreparationGate(16), dispatch = vi.fn();
    const arrived = Promise.allSettled([gate.arrive().then(dispatch)]); gate.cancel();
    await expect(gate.arrive()).rejects.toThrow('FAULT_GATE_CANCELLED');
    expect((await arrived)[0].status).toBe('rejected'); expect(dispatch).not.toHaveBeenCalled();
  });
  it('lock setup failure rejects every prepared operation without transaction dispatch', async () => {
    const gate = new PreparationGate(16), dispatch = vi.fn();
    const work = Promise.allSettled(Array.from({length: 16}, () => gate.arrive().then(dispatch)));
    await expect(gate.openWhenReady(6500, async () => { throw new Error('SYNTHETIC_SECRET'); })).rejects.toThrow('FAULT_PREPARATION_INCONCLUSIVE');
    expect((await work).every(x => x.status === 'rejected')).toBe(true); expect(dispatch).not.toHaveBeenCalled();
  });
  it('cancellation during asynchronous blocker setup cannot dispatch late transactions', async () => {
    const gate = new PreparationGate(2), dispatch = vi.fn();
    const work = Promise.allSettled([gate.arrive().then(dispatch), gate.arrive().then(dispatch)]);
    await expect(gate.openWhenReady(6500, async () => { gate.cancel(); })).rejects.toThrow('FAULT_PREPARATION_INCONCLUSIVE');
    expect((await work).every(x => x.status === 'rejected')).toBe(true); expect(dispatch).not.toHaveBeenCalled();
  });
  for (const budget of [0, -1, 6501, Infinity, NaN]) it('refuses preparation budget ' + budget, async () => {
    const gate = new PreparationGate(16); await expect(gate.openWhenReady(budget)).rejects.toThrow('FAULT_PREPARATION_BUDGET');
    expect(gate.snapshot().state).toBe('cancelled');
  });
});

describe('loopback fault transport lifecycle — mocked sockets, NOT a live connection', () => {
  class Socket extends EventEmitter {
    destroyed = false; writes: Buffer[] = []; paused = false; backpressure = false;
    setTimeout = vi.fn(); pipe = vi.fn();
    write(bytes: Buffer) { this.writes.push(bytes); return !this.backpressure; }
    pause() { this.paused = true; }
    resume() { this.paused = false; }
    destroy() { if (!this.destroyed) { this.destroyed = true; this.emit('close'); } }
  }
  function setup() {
    const client = new Socket(), upstream = new Socket();
    let accept!: (client: Socket) => void;
    const server = Object.assign(new EventEmitter(), {
      listen: vi.fn((_port: number, _host: string, callback: () => void) => callback()),
      address: () => ({address: '127.0.0.1', port: 12345}), close: vi.fn((callback: () => void) => callback()),
    });
    network.listen.mockImplementation(callback => { accept = callback; return server; });
    network.connect.mockReturnValue(upstream);
    return {client, upstream, server, accept: (socket = client) => accept(socket)};
  }
  it('binds only loopback and forwards opaquely to the fixed PostgreSQL target', async () => {
    const s = setup(), fault = await openCommitAckFault(true);
    expect(s.server.listen).toHaveBeenCalledWith(0, '127.0.0.1', expect.any(Function));
    expect(network.connect).not.toHaveBeenCalled();
    s.accept(); expect(network.connect).toHaveBeenCalledWith({host: '127.0.0.1', port: 5432});
    expect(s.client.pipe).toHaveBeenCalledWith(s.upstream);
    const auth = frame('R', 'SYNTHETIC_SCRAM_BYTES'); s.upstream.emit('data', auth);
    expect(s.client.writes).toEqual([auth]); await fault.close();
  });
  it('rejects a second client instead of creating a second upstream', async () => {
    const s = setup(), fault = await openCommitAckFault(true); s.accept(); const second = new Socket(); s.accept(second);
    expect(second.destroyed).toBe(true); expect(network.connect).toHaveBeenCalledTimes(1); await fault.close();
  });
  it('drops the real framed ACK, destroys both owned sockets, and never forwards ReadyForQuery', async () => {
    const s = setup(), fault = await openCommitAckFault(true); s.accept(); fault.arm();
    s.upstream.emit('data', Buffer.concat([commit, ready]));
    expect(s.client.writes).toEqual([]); expect(s.client.destroyed && s.upstream.destroyed).toBe(true);
    expect(fault.observed()).toEqual({acknowledgementDropped: true, transportFailed: false}); await fault.close();
  });
  it('never classifies arbitrary transport errors as acknowledgement loss', async () => {
    const s = setup(), fault = await openCommitAckFault(true); s.accept();
    s.upstream.emit('error', new Error('PASSWORD CONNECTION TOKEN RAW SQL'));
    expect(fault.observed()).toEqual({acknowledgementDropped: false, transportFailed: true});
    expect(s.client.destroyed && s.upstream.destroyed).toBe(true); await fault.close();
  });
  it('honors backpressure and drains before receiving more backend frames', async () => {
    const s = setup(), fault = await openCommitAckFault(true); s.accept(); s.client.backpressure = true;
    s.upstream.emit('data', ready); expect(s.upstream.paused).toBe(true);
    s.client.emit('drain'); expect(s.upstream.paused).toBe(false); await fault.close();
  });
  it('refuses arming before a client is authenticated/connected and closes all owned resources', async () => {
    const s = setup(), fault = await openCommitAckFault(true);
    expect(() => fault.arm()).toThrow('FAULT_ARM_INVALID'); s.accept(); await fault.close();
    expect(s.client.destroyed && s.upstream.destroyed).toBe(true); expect(s.server.close).toHaveBeenCalledTimes(1);
  });
});

describe('fault proof approval, isolation and safe reporting — OFFLINE', () => {
  const approval = (): FaultApproval => ({approved: true, syntheticOnly: true, record: vi.fn(), commitFault: vi.fn()});
  for (const field of ['approved', 'syntheticOnly', 'record', 'commitFault']) it('fails closed without ' + field, async () => {
    const input = approval(); Object.assign(input, {[field]: undefined}); const connect = vi.fn();
    await expect(verifyRemainingFaults({connect} as never, input, {})).rejects.toThrow('FAULT_APPROVAL_REQUIRED');
    expect(connect).not.toHaveBeenCalled();
  });
  it('redacts actual connection errors before any fixture', async () => {
    const input = approval();
    await expect(verifyRemainingFaults({connect: async () => { throw new Error('PASSWORD TOKEN SQL CONNECTION STRING'); }} as never, input, {})).rejects.toThrow('FAULT_PREFLIGHT_FAILED');
    expect(input.record).not.toHaveBeenCalled();
  });
  it('rejects wrong target, privileges or state with only readonly SQL', async () => {
    const queries: string[] = [], release = vi.fn(), input = approval();
    await expect(verifyRemainingFaults({connect: async () => ({query: async (sql: string) => { queries.push(sql); return {rows: [{ok: false}]}; }, release})} as never, input, {})).rejects.toThrow('FAULT_PREFLIGHT_FAILED');
    expect(queries).toHaveLength(1); expect(queries[0].trim()).toMatch(/^SELECT /);
    expect(input.record).not.toHaveBeenCalled(); expect(release).toHaveBeenCalledTimes(1);
  });
  it('failed fixture journal blocks every write and proxy startup', async () => {
    const queries: string[] = [], input = approval(); input.record = vi.fn(async () => { throw new Error('SYNTHETIC_SECRET'); });
    await expect(verifyRemainingFaults({connect: async () => ({query: async (sql: string) => { queries.push(sql); return {rows: [{ok: true}]}; }, release() {}})} as never, input, {})).rejects.toThrow('PHASE1_FAULT_PROOF_STOPPED_PRESERVE_LEDGER');
    expect(queries).toHaveLength(1); expect(input.commitFault).not.toHaveBeenCalled();
  });
  it('preserves critical live-proof predicates and truthfully leaves equality gap open', () => {
    const source = readFileSync(resolve(__dirname, 'phase1-fault.integration.ts'), 'utf8');
    expect(source).toContain('count === 16'); expect(source).toContain('performance.now() - polling <= 1500');
    expect(source).toContain('performance.now() - began < 15000'); expect(source).toContain('pending = await Promise.allSettled(operations)');
    expect(source).toContain('backend_start=$2::timestamptz'); expect(source).toContain('usename=current_user');
    expect(source).toContain('fullServiceExactEqualityProved: false');
    expect(source).not.toMatch(/console\.|process\.env|DELETE FROM|GRANT |ALTER ROLE|DROP TABLE/);
  });
  for (const field of ['ordinaryAccess','expiryMethod']) it('rejects arbitrary ' + field + ' selectors before connection', async () => {
    const connect = vi.fn(), input = {...approval(), [field]: 'unreviewed'};
    await expect(verifyRemainingFaults({connect} as never, input as never, {})).rejects.toThrow('FAULT_APPROVAL_REQUIRED');
    expect(connect).not.toHaveBeenCalled();
  });
  for (const ordinaryAccess of ['absent','approved'] as const) it('binds closed ' + ordinaryAccess + ' permission scope and stops on denied guard', async () => {
    const values: unknown[][] = [], input = {...approval(), ordinaryAccess};
    await expect(verifyRemainingFaults({connect: async () => ({query: async (_sql: string, args: unknown[]) => {values.push(args); return {rows: [{ok: false}]};}, release() {}})} as never, input, {})).rejects.toThrow('FAULT_PREFLIGHT_FAILED');
    expect(values[0]).toEqual(['flywithsafe_phase1_schema_integration','flywithsafe_phase1_service_test',ordinaryAccess === 'approved']);
    expect(input.record).not.toHaveBeenCalled();
  });
  it('checks ordinary clean state only after approved matrix, before any fixture write', async () => {
    const calls: string[] = [], input = {...approval(), ordinaryAccess: 'approved' as const};
    await expect(verifyRemainingFaults({connect: async () => ({query: async (sql: string) => {calls.push(sql); return {rows: [{ok: calls.length === 1}]};}, release() {}})} as never, input, {})).rejects.toThrow('FAULT_PREFLIGHT_FAILED');
    expect(calls).toHaveLength(2); expect(calls[1]).toContain('NotificationOutbox'); expect(input.record).not.toHaveBeenCalled();
  });
  it('proposed UTC composition retains immutable expiry, exact predicate, real wait and unchanged case limits', () => {
    const proof = readFileSync(resolve(__dirname,'phase1-fault.integration.ts'),'utf8');
    const production = readFileSync(resolve(__dirname,'../src/security/protected-auth.pg.ts'),'utf8');
    const lookup = production.slice(production.indexOf('  lookupCredential('), production.indexOf('  private async unit'));
    const consumption = production.slice(production.indexOf('  consume(id:'), production.indexOf('  claim('));
    expect(lookup).toContain('c."expiresAt">clock_timestamp()');
    expect(consumption).toContain('c."expiresAt">clock_timestamp()');
    expect(consumption.indexOf('FOR UPDATE')).toBeLessThan(consumption.indexOf('c."expiresAt">clock_timestamp()'));
    expect(proof).toContain("VALUES(-1,false),(0,false),(1,true)"); expect(proof).toContain('expires_at>wall_clock');
    expect(proof).toContain("approval.expiryMethod === 'composed-post-lock'");
    expect(proof).toContain('gate.openWhenReady(1500)'); expect(proof).toContain('performance.now() - started < 15000');
    expect(proof).toContain('outcome === \'invalid\' && observedWait && actuallyExpired');
    expect(proof).not.toMatch(/UPDATE public\."ProtectedCredential" SET "expiresAt"/);
  });
});

describe('ordinary outbox real-adapter proof is inert and separately permission-gated', () => {
  const approval = () => ({approved: true, syntheticOnly: true, permissionDeltaApproved: true, record: vi.fn<(id: string) => Promise<void>>(async () => {})});
  it('rejects invalid application composition before any connection',async()=>{
    const connect=vi.fn();
    await expect(verifyOrdinaryServiceAdapters({connect} as never,{...approval(),applicationWorker:true} as never)).rejects.toThrow('PHASE1_ORDINARY_APPROVAL_REQUIRED');
    expect(connect).not.toHaveBeenCalled();
  });
  it('does not run an application worker when the durable fixture journal fails',async()=>{
    const applicationWorker=vi.fn(),input={...approval(),applicationWorker,record:vi.fn(async()=>{throw new Error('PRIVATE_SYNTHETIC');})};
    await expect(verifyOrdinaryServiceAdapters({connect:async()=>({query:async()=>({rows:[{ok:true}]}),release(){}})} as never,input)).rejects.toThrow('PHASE1_ORDINARY_PROOF_STOPPED_PRESERVE_LEDGER');
    expect(applicationWorker).not.toHaveBeenCalled();
  });
  for (const field of ['approved', 'syntheticOnly', 'permissionDeltaApproved', 'record']) it('requires ' + field + ' before connection', async () => {
    const input = approval(); Object.assign(input, {[field]: undefined}); const connect = vi.fn();
    await expect(verifyOrdinaryServiceAdapters({connect} as never, input)).rejects.toThrow('PHASE1_ORDINARY_APPROVAL_REQUIRED');
    expect(connect).not.toHaveBeenCalled();
  });
  it('existing insufficient role privileges stop in read-only preflight, without fixtures', async () => {
    const input = approval(), release = vi.fn(), queries: string[] = [];
    await expect(verifyOrdinaryServiceAdapters({connect: async () => ({query: async (sql: string) => {queries.push(sql); return {rows: [{ok: false}]};}, release})} as never, input)).rejects.toThrow('PHASE1_ORDINARY_PREFLIGHT_FAILED');
    expect(input.record).not.toHaveBeenCalled(); expect(release).toHaveBeenCalledTimes(1); expect(queries).toHaveLength(1); expect(queries[0].trim()).toMatch(/^SELECT /);
  });
  it('journal failure prevents first ordinary INSERT', async () => {
    const input = approval(), queries: string[] = []; input.record = vi.fn(async () => {throw new Error('SYNTHETIC_SECRET');});
    await expect(verifyOrdinaryServiceAdapters({connect: async () => ({query: async (sql: string) => {queries.push(sql); return {rows: [{ok: true}]};}, release() {}})} as never, input)).rejects.toThrow('PHASE1_ORDINARY_PROOF_STOPPED_PRESERVE_LEDGER');
    expect(queries).toHaveLength(1);
  });
  it('does not leak connection errors or grant itself missing permissions', async () => {
    const input = approval();
    await expect(verifyOrdinaryServiceAdapters({connect: async () => {throw new Error('PASSWORD SQL TOKEN');}} as never, input)).rejects.toThrow('PHASE1_ORDINARY_PREFLIGHT_FAILED');
    expect(input.record).not.toHaveBeenCalled();
    const source = readFileSync(resolve(__dirname, 'phase1-ordinary.integration.ts'), 'utf8');
    expect(source).not.toMatch(/console\.|process\.env|DELETE FROM|GRANT |ALTER ROLE|DROP TABLE/);
    expect(source).toContain('await approval.record(id)'); expect(source).toContain('Promise.allSettled');
  });
});
