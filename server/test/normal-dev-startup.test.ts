import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn(), listen: vi.fn().mockReturnValue({ close: vi.fn(), on: vi.fn() }) }));
vi.mock('../src/config/env.js', () => ({ env: { nodeEnv: 'development', port: 5000, corsOrigin: 'http://localhost:3000' }, validateEnv: vi.fn() }));
vi.mock('../src/app.js', () => ({ default: { listen: state.listen } }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: { $disconnect: vi.fn() } }));
vi.mock('../src/services/outbox.service.js', () => ({ startOutboxWorker: state.start, stopOutboxWorker: state.stop }));
vi.mock('../src/config/passport.js', () => ({ isGoogleStrategyConfigured: () => false }));
vi.mock('../src/lib/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
it.each([true, false])('original server starts with outbox opt-out=%s without changing default admission', async disabled => {
  vi.resetModules(); state.start.mockClear(); state.listen.mockClear();
  const argv = process.argv, vercel = process.env.VERCEL;
  const events = ['SIGINT','SIGTERM','uncaughtException','unhandledRejection'] as const;
  const before = new Map(events.map(event => [event, process.listeners(event)]));
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    process.argv = ['node', 'server.ts', ...(disabled ? ['--no-outbox-worker'] : [])]; delete process.env.VERCEL;
    await import('../src/server.js');
    expect(state.listen).toHaveBeenCalledTimes(1);
    expect(state.listen.mock.calls[0][0]).toBe(5000);
    expect(state.start).toHaveBeenCalledTimes(disabled ? 0 : 1);
  } finally {
    process.argv = argv;
    if (vercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = vercel;
    for (const event of events) for (const listener of process.listeners(event)) if (!before.get(event)!.includes(listener)) process.removeListener(event, listener);
    log.mockRestore();
  }
});
