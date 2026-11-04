async page => {
  const blocked = [], calls = [];
  await page.context().route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.protocol === 'data:' || url.protocol === 'about:') return route.continue();
    if (url.hostname === 'localhost' && ['3000', '5000'].includes(url.port)) {
      if (url.port === '5000') calls.push({ method: route.request().method(), path: url.pathname });
      return route.continue();
    }
    blocked.push({ origin: url.origin, path: url.pathname.startsWith('/api/') ? '/api/*' : '/external-asset-or-provider' });
    return route.abort('blockedbyclient');
  });
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  return { url: page.url(), title: await page.title(), blocked, apiRequests: calls, authenticatedTestsExecuted: false, cloudFallbackPermitted: false };
}
