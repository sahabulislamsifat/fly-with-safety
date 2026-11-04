async page => {
  const role = 'CUSTOMER';
  const state = { role, apiPinned: true, cloudFallbackBlocked: true, providerRequestsSent: 0, injectedCheckoutNavigations: 0, responses: [], failures: [], blocked: [] };
  page.__phase3 = state;
  await page.context().unroute('**/*');
  await page.context().route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.protocol === 'about:' || url.protocol === 'data:') return route.continue();
    if (['http://localhost:3000', 'http://localhost:5000'].includes(url.origin)) return route.continue();
    if (url.origin === 'https://sandbox.sslcommerz.com' && url.pathname === '/checkout' && url.searchParams.get('phase3_injected_only') === '1') {
      state.injectedCheckoutNavigations++;
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Injected checkout — NOT SSLCommerz acceptance</title><h1>Injected checkout navigation only</h1><p>No provider request or payment was made. Return to inspect server-side verification.</p><a href="http://localhost:3000/account">Return to local account</a>' });
    }
    state.blocked.push({ origin: url.origin, path: '/external-request-blocked' }); return route.abort('blockedbyclient');
  });
  page.on('response', r => { const u = new URL(r.url()); if (u.origin === 'http://localhost:5000') state.responses.push({ path: u.pathname, status: r.status() }); });
  page.on('requestfailed', r => { const u = new URL(r.url()); if (u.origin === 'http://localhost:5000') state.failures.push({ path: u.pathname, failed: true }); });
  const live = await page.request.get('http://localhost:5000/__phase3_identity', { maxRedirects: 0 }), identity = await live.json();
  if (live.status() !== 200 || identity.db !== 'flywithsafety_local_integration' || identity.role !== 'flywithsafe_phase2_booking_test' || identity.oid !== 34701 || identity.hostId !== 'e77192b4-357f-47a6-ad59-dc35b980330e' || identity.provider !== 'MOCK_ONLY') throw Error('PHASE3_CONTEXT_IDENTITY_GUARD');
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(role => { document.title = 'PHASE3 ' + role + ' | FlyWithSafe'; }, role);
  return { role, prepared: true, isolatedBrowserContexts: page.context().browser().contexts().length, identityVerified: true, credentialsSubmitted: false };
}
