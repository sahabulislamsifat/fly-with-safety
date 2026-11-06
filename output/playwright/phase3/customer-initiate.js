async page => {
  const s = page.__phase3, ref = 'FWS-P3-BROWSER-E77192B4';
  if (s.role !== 'CUSTOMER' || !s.eligibleDone || s.initiationAdmitted) throw Error('CUSTOMER_INITIATION_SCOPE_OR_DUPLICATE_GUARD');
  s.initiationAdmitted = true;
  const check = (id, ok) => { s.checks.push({ id, passed: ok }); if (!ok) throw Error('PHASE3_BROWSER_'+id); };
  await page.route('http://localhost:5000/api/v1/payments/bookings/'+ref+'/initiate', async route => {
    const body = route.request().postDataJSON();
    if (route.request().method() !== 'POST' || body.address !== 'Synthetic browser billing' || body.city !== 'Synthetic city' || body.country !== 'BD' || typeof body.requestId !== 'string') throw Error('BROWSER_OBSERVED_INITIATION_PAYLOAD_MISMATCH');
    if (!s.initiationRequestId) s.initiationRequestId = body.requestId;
    // Observational only: never change the application's request or manufacture a response.
    await route.continue();
  });
  await page.getByRole('textbox', { name: 'Synthetic billing address', exact: true }).fill('Synthetic browser billing');
  await page.getByRole('textbox', { name: 'City', exact: true }).fill('Synthetic city');
  await page.getByRole('textbox', { name: 'Country code', exact: true }).fill('BD');
  await page.getByRole('button', { name: 'Pay now / resume sandbox checkout', exact: true }).dblclick();
  await page.waitForURL(u => u.origin === 'https://sandbox.sslcommerz.com' && u.searchParams.get('phase3_injected_only') === '1');
  check('pay-now-injected-checkout-navigation-only', s.injectedCheckoutNavigations >= 1 && await page.getByRole('heading', { name: 'Injected checkout navigation only', exact: true }).isVisible());
  const r = await page.request.get('http://localhost:5000/api/v1/payments/bookings/'+ref), data = (await r.json()).data;
  check('duplicate-click-one-persisted-payment', r.status() === 200 && data.payments.length === 1);
  check('session-ready-not-financial-success', data.payments[0].status === 'SESSION_READY' && !data.payments[0].captured && data.payments[0].fulfillment === 'NOT_PAID');
  check('one-durable-intent-and-session-audit', data.history.filter(h => h.kind === 'INTENT').length === 1 && data.history.filter(h => h.kind === 'SESSION_READY').length === 1);
  check('no-genuine-provider-request', s.providerRequestsSent === 0);
  s.paymentId = data.payments[0].id; s.initiationDone = true;
  return { role: s.role, passed: s.checks.filter(c => c.passed).length, failed: s.checks.filter(c => !c.passed).length, checks: s.checks, newPaymentId: s.paymentId, checkout: 'INJECTED_ONLY', realProviderAcceptance: false };
}
