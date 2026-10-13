import { afterEach, describe, expect, it, vi } from 'vitest';

const LOCAL_API = 'http://localhost:5000/api/v1';
const PRODUCTION_API = 'https://fly-with-safety-server.vercel.app/api/v1';

function setBrowser(hostname: string): void {
  vi.stubGlobal('window', { location: { hostname }, setTimeout, clearTimeout });
}

async function loadClient() {
  vi.resetModules();
  return import('../../client/src/lib/api/client.ts');
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
  delete process.env.NEXT_PUBLIC_LOCAL_API_BASE_URL;
});

describe('API target resolver', () => {
  it('uses healthy localhost API and sends a mutation once', async () => {
    setBrowser('localhost');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { status: 'ok' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { id: 'one' } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { id: 'two' } }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const { post } = await loadClient();

    await post('/contact', { message: 'hello' });
    await post('/contact', { message: 'again' });

    expect(fetchMock).toHaveBeenNthCalledWith(1, `${LOCAL_API}/health`, expect.objectContaining({ method: 'GET' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${LOCAL_API}/contact`, expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, `${LOCAL_API}/contact`, expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('uses production after local health failure without retrying a mutation', async () => {
    setBrowser('localhost');
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { id: 'one' } }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const { post } = await loadClient();

    await post('/contact', { message: 'hello' });

    expect(fetchMock).toHaveBeenNthCalledWith(2, `${PRODUCTION_API}/contact`, expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never checks localhost from a deployed frontend', async () => {
    setBrowser('fly-with-safety.netlify.app');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { get } = await loadClient();

    await get('/packages');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(`${PRODUCTION_API}/packages`, expect.anything());
  });

  it('rejects a localhost API setting for a deployed frontend', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = LOCAL_API;
    setBrowser('fly-with-safety.netlify.app');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { get } = await loadClient();

    await get('/packages');

    expect(fetchMock).toHaveBeenCalledWith(`${PRODUCTION_API}/packages`, expect.anything());
  });
});
