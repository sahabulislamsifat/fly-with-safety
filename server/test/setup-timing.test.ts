import { expect, it, vi } from 'vitest';
import { setupStep } from './setup-timing.js';
it('awaits completion and reports only a fixed label and elapsed time', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  try {
    expect(await setupStep('synthetic step', async () => 'private payload')).toBe('private payload');
    expect(log).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain('private payload');
  } finally { log.mockRestore(); }
});
it('preserves failures without logging error secrets', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  const failure = new Error('private secret');
  try {
    await expect(setupStep('synthetic step', async () => { throw failure; })).rejects.toBe(failure);
    expect(JSON.stringify(log.mock.calls)).not.toContain('private secret');
  } finally { log.mockRestore(); }
});
