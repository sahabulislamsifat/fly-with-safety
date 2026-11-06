import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import { expect, it, vi } from 'vitest';
import { UatForwardingGuard, watchAllocatedConnector } from './phase3-uat-transport.js';

const origin = 'https://sandbox-proof.lhr.life';
const path = '/api/v1/payments/sslcommerz/fail';
function request(nonce: string, overrides: Record<string, string> = {}, url = path) {
  const headers = { host: new URL(origin).host, 'x-forwarded-proto': 'https', forwarded: 'proto=https', 'content-type': 'application/x-www-form-urlencoded', 'content-length': '0', 'x-fws-uat-transport': nonce, ...overrides };
  return { url, method: 'POST', headers, rawHeaders: Object.entries(headers).flat(), socket: { remoteAddress: '127.0.0.1' } } as unknown as IncomingMessage;
}

it('requires the assigned HTTPS host and one exact locally observed nonce', async () => {
  const stop = vi.fn(), record = vi.fn();
  const guard = new UatForwardingGuard(origin, stop, record, async (url, nonce) => {
    expect(url.href).toBe(origin + path);
    expect(guard.receive(request(nonce, { host: 'other.lhr.life' }))).toBeUndefined();
    expect(guard.receive(request(nonce, { 'x-forwarded-proto': 'http' }))).toBeUndefined();
    expect(guard.receive(request(nonce, { 'content-length': '1' }))).toBeUndefined();
    expect(guard.receive(request(nonce, {}, path.replace('/fail', '/cancel')))).toBeUndefined();
    expect(guard.receive(request(nonce + 'x'))).toBeUndefined();
    expect(guard.receive(request(nonce))).toBe(nonce);
    expect(guard.receive(request(nonce))).toBeUndefined();
    return { status: 204, marker: nonce };
  });
  await expect(guard.check('BEFORE_FIXTURES')).resolves.toBeUndefined();
  expect(record).toHaveBeenCalledWith({ kind: 'forwarding-proof', stage: 'BEFORE_FIXTURES', status: 204, originCorrelated: true });
  expect(stop).not.toHaveBeenCalled();
  expect(() => new UatForwardingGuard(origin.replace('https:', 'http:'), stop, record)).toThrow('UNAPPROVED');
});

it.each([404, 502, 204])('stops on edge response %i without local observation even with the echoed nonce', async status => {
  const stop = vi.fn();
  const guard = new UatForwardingGuard(origin, stop, vi.fn(), async (_url, nonce) => ({ status, marker: nonce }));
  await expect(guard.check('CHECKOUT_WATCH')).rejects.toThrow('FORWARDING_ORIGIN_NOT_CORRELATED');
  await expect(guard.check('BEFORE_RECONCILIATION')).rejects.toThrow('UNAVAILABLE');
  expect(stop).toHaveBeenCalledOnce();
});

it('records the HTTPS failure and rejects subsequent work', async () => {
  const stop = vi.fn(), record = vi.fn();
  const guard = new UatForwardingGuard(origin, stop, record, async () => { throw Error('transport-private-detail'); });
  await expect(guard.check('BEFORE_INITIATION')).rejects.toThrow('FORWARDING_HTTPS_FAILURE');
  expect(stop).toHaveBeenCalledWith('FORWARDING_HTTPS_FAILURE');
  expect(JSON.stringify(record.mock.calls)).not.toContain('transport-private-detail');
});

it('preserves the finite probe budget and never sends the 71st request', async () => {
  const stop = vi.fn();
  const probe = vi.fn(async (_url: URL, nonce: string) => ({ status: 204, marker: guard.receive(request(nonce)) }));
  const guard = new UatForwardingGuard(origin, stop, vi.fn(), probe);
  for (let i = 0; i < 70; i++) await guard.check('CHECKOUT_WATCH');
  await expect(guard.check('CHECKOUT_WATCH')).rejects.toThrow('FORWARDING_PROBE_CAP');
  expect(probe).toHaveBeenCalledTimes(70);
});

it('observes post-allocation child loss and ignores expected shutdown after detaching', () => {
  const child = new EventEmitter(), stop = vi.fn(), detach = watchAllocatedConnector(child, stop);
  child.emit('exit', 1, null);
  expect(stop).toHaveBeenCalledWith('SSH_EXIT_AFTER_ALLOCATION');
  detach();
  child.emit('exit', null, 'SIGTERM');
  expect(stop).toHaveBeenCalledOnce();
  const failing = new EventEmitter();
  const remove = watchAllocatedConnector(failing, stop);
  failing.emit('error', Error('failure'));
  expect(stop).toHaveBeenLastCalledWith('SSH_ERROR_AFTER_ALLOCATION');
  remove();
});
