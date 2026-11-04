async page => {
  const s = page.__phase3, ref = 'FWS-P3-BROWSER-E77192B4';
  if (s.role !== 'ADMIN' || !s.newPendingObserved || s.validationAdmitted) throw Error('ADMIN_VALIDATION_SCOPE_OR_DUPLICATE_GUARD');
  s.validationAdmitted = true;
  const check = (id, ok) => { s.checks.push({ id, passed: ok }); if (!ok) throw Error('PHASE3_BROWSER_'+id); };
  const observed = page.waitForResponse(r => r.request().method() === 'POST' && r.url() === 'http://localhost:5000/api/v1/payments/bookings/'+ref+'/reconcile');
  await page.getByRole('button', { name: 'Reconcile with gateway', exact: true }).click();
  const response = await observed;
  check('admin-real-route-reconciliation-admitted', response.status() === 200 && (await response.json()).data.checked === 1);
  await page.getByText('12000.00 BDT · VERIFIED', { exact: true }).waitFor();
  const r = await page.request.get('http://localhost:5000/api/v1/payments/bookings/'+ref), data = (await r.json()).data;
  check('injected-validation-one-original-capture', r.status() === 200 && data.payments.length === 1 && data.payments[0].id === s.newPaymentId && data.payments[0].status === 'VERIFIED' && data.payments[0].captured);
  check('verified-ui-awaits-operations-not-fulfillment', data.payments[0].fulfillment === 'AWAITING_OPERATIONS' && await page.getByText(/AWAITING OPERATIONS · Updated/).isVisible());
  check('one-verified-financial-audit', data.history.filter(h => h.kind === 'VERIFIED').length === 1 && data.history.filter(h => h.kind === 'NOTICE').length === 1);
  s.validationDone = true;
  return { role: s.role, passed: s.checks.filter(c => c.passed).length, failed: s.checks.filter(c => !c.passed).length, checks: s.checks, provider: 'MOCK_ONLY', genuineProviderAcceptance: false };
}
