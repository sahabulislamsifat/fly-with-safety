async page => {
  const s = page.__phase3, ref = 'FWS-P3-BROWSER-E77192B4', tranId = 'FWS806040ae04a794c1573c71c498';
  if (s.role !== 'CUSTOMER' || !s.refreshReplayDone || s.callbackAdmitted) throw Error('CALLBACK_SCOPE_OR_DUPLICATE_GUARD');
  s.callbackAdmitted = true;
  const check = (id, ok) => { s.checks.push({ id, passed: ok }); if (!ok) throw Error('PHASE3_BROWSER_'+id); };
  const url = 'http://localhost:5000/api/v1/payments/sslcommerz/ipn';
  const base = { tran_id: tranId, val_id: 'BROWSER_V_'+tranId, store_id: 'browser-injected-only', status: 'VALID', amount: '1.00', currency: 'USD' };
  const json = await page.request.post(url, { data: base, maxRedirects: 0, maxRetries: 0 });
  check('callback-json-rejected-by-real-route', json.status() === 400);
  const signed = await page.request.post(url, { form: { ...base, verify_key: 'amount,tran_id', verify_sign: '0'.repeat(32) }, maxRedirects: 0, maxRetries: 0 });
  check('forged-signature-rejected-by-real-route', signed.status() === 400);
  const rejected = await page.request.get('http://localhost:5000/api/v1/payments/bookings/'+ref), before = (await rejected.json()).data;
  check('rejected-callbacks-no-notice-or-capture', !before.payments[0].captured && before.history.filter(h => h.kind === 'NOTICE').length === 0);
  const ipn = await page.request.post(url, { form: base, maxRedirects: 0, maxRetries: 0 });
  check('unsigned-notice-durable-ack-only', ipn.status() === 200 && (await ipn.text()) === 'RECEIVED');
  const observed = await page.request.get('http://localhost:5000/api/v1/payments/bookings/'+ref), after = (await observed.json()).data;
  check('unverified-valid-status-cannot-authorize-capture', after.payments[0].id === s.paymentId && !after.payments[0].captured && after.payments[0].status === 'UNKNOWN' && after.payments[0].fulfillment === 'NOT_PAID');
  const duplicate = await page.request.post(url, { form: base, maxRedirects: 0, maxRetries: 0 });
  const fetched = await page.request.get('http://localhost:5000/api/v1/payments/bookings/'+ref), final = (await fetched.json()).data;
  check('duplicate-ipn-one-durable-notice', duplicate.status() === 200 && final.history.filter(h => h.kind === 'NOTICE').length === 1 && final.payments.length === 1 && !final.payments[0].captured);
  await page.getByRole('button', { name: 'Refresh payment status', exact: true }).click();
  await page.getByText('12000.00 BDT · UNKNOWN', { exact: true }).waitFor();
  check('unverified-pending-state-ui-not-paid', await page.getByText(/NOT PAID · Updated/).isVisible());
  s.callbackDone = true;
  return { role: s.role, passed: s.checks.filter(c => c.passed).length, failed: s.checks.filter(c => !c.passed).length, checks: s.checks, callbackStatuses: [json.status(), signed.status(), ipn.status(), duplicate.status()], actualHttpAndPostgres: true, provider: 'MOCK_ONLY' };
}
