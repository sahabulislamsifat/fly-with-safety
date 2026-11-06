import type { IncomingMessage } from 'node:http';
import { expect, it, vi } from 'vitest';
import { cloudflareAdmission, cloudflareArgs, cloudflareOriginReader, CloudflareForwarding } from './phase3-failed-uat-v03/cloudflare.js';

const origin = 'https://synthetic-probe.trycloudflare.com';
const route = '/api/v1/payments/sslcommerz/fail';
function request(overrides: Record<string, string> = {}, path = route, method = 'POST') {
  const headers = { host: 'phase3-callback.invalid', 'x-forwarded-proto': 'https', 'content-type': 'application/x-www-form-urlencoded', 'content-length': '3', ...overrides };
  return { url: path, method, headers, rawHeaders: Object.entries(headers).flat(), socket: { remoteAddress: '127.0.0.1' } } as unknown as IncomingMessage;
}

it('binds only an isolated loopback port and supplies the reviewed host rewrite', () => {
  for (const port of [3000, 5000, 0]) expect(() => cloudflareArgs(port, 'empty.yml')).toThrow('ISOLATED');
  expect(cloudflareArgs(45123, 'empty.yml')).toContain('http://127.0.0.1:45123');
  expect(cloudflareArgs(45123, 'empty.yml')).toContain('phase3-callback.invalid');
});

it('requires registration and stops on changed assigned Cloudflare origin', () => {
  const read = cloudflareOriginReader();
  expect(read(Buffer.from(origin + '\n'))).toBeUndefined();
  expect(read(Buffer.from('Registered tunnel connection\n'))).toBe(origin);
  expect(() => read(Buffer.from('https://second-probe.trycloudflare.com\n'))).toThrow('CLOUDFLARE_ORIGIN_CHANGED');
});

it('denies unrelated routes, wrong hosts, non-HTTPS and duplicate or supplied forwarding schemes', () => {
  expect(cloudflareAdmission(request())).toBe(true);
  expect(cloudflareAdmission(request({}, '/api/v1/auth/login'))).toBe(false);
  expect(cloudflareAdmission(request({}, route, 'GET'))).toBe(false);
  expect(cloudflareAdmission(request({ host: 'localhost:5000' }))).toBe(false);
  expect(cloudflareAdmission(request({ 'x-forwarded-proto': 'http' }))).toBe(false);
  expect(cloudflareAdmission(request({ forwarded: 'proto=https' }))).toBe(false);
  const duplicate = request();
  duplicate.rawHeaders.push('X-Forwarded-Proto', 'https');
  expect(cloudflareAdmission(duplicate)).toBe(false);
});

it('requires TLS-origin receipt and correlated nonce for the single readiness request', async () => {
  const stop = vi.fn(), record = vi.fn();
  const probe = vi.fn(async (url: URL, nonce: string) => {
    expect(url.href).toBe(origin + route);
    expect(guard.receive(request({ 'x-fws-uat-transport': nonce, 'x-forwarded-proto': 'http' }))).toBeUndefined();
    expect(guard.receive(request({ 'x-fws-uat-transport': nonce }))).toBe(nonce);
    expect(guard.receive(request({ 'x-fws-uat-transport': nonce }))).toBeUndefined();
    return { status: 204, marker: nonce };
  });
  const guard = new CloudflareForwarding(origin, stop, record, probe);
  await expect(guard.check('BEFORE_FIXTURES')).resolves.toBeUndefined();
  expect(probe).toHaveBeenCalledOnce();
  expect(stop).not.toHaveBeenCalled();
});

it.each([302, 403, 530, 204])('stops on response %i without isolated origin correlation', async status => {
  const stop = vi.fn();
  const guard = new CloudflareForwarding(origin, stop, vi.fn(), async (_url, nonce) => ({ status, marker: nonce }));
  await expect(guard.check('BEFORE_FIXTURES')).rejects.toThrow('CLOUDFLARE_ORIGIN_NOT_CORRELATED');
  expect(stop).toHaveBeenCalledWith('CLOUDFLARE_ORIGIN_NOT_CORRELATED');
  await expect(guard.check('CHECKOUT_WATCH')).rejects.toThrow('UNAVAILABLE');
});
