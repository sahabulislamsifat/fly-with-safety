async page => {
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('/api/')).map(n => { const u = new URL(n); return { origin: u.origin, path: u.pathname }; }));
  return { passed: page.url().startsWith('http://localhost:3000/') && resources.every(r => r.origin === 'http://localhost:5000'), frontend: page.url(), apiResources: resources, realApiReady: false, authenticatedChecksExecuted: 0, note: 'Local auth/me connection refused while the API host is absent; no credential failure inferred.' };
}
