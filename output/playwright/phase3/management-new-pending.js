async page => {
  const s = page.__phase3, ref = 'FWS-P3-BROWSER-E77192B4';
  if (!['ADMIN','STAFF'].includes(s.role) || s.newPendingObserved) throw Error('MANAGEMENT_PENDING_CONTEXT_GUARD');
  const check = (name, ok) => { const id = s.role.toLowerCase()+'-'+name; s.checks.push({ id, passed: ok }); if (!ok) throw Error('PHASE3_BROWSER_'+id); };
  await page.getByRole('row').filter({ hasText: ref }).getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByText('12000.00 BDT · UNKNOWN', { exact: true }).waitFor();
  const r = await page.request.get('http://localhost:5000/api/v1/payments/bookings/'+ref), data = (await r.json()).data;
  check('new-pending-api-and-ui-synchronized', r.status() === 200 && data.payments.length === 1 && !data.payments[0].captured && data.payments[0].status === 'UNKNOWN');
  check('management-no-customer-pay-now-control', await page.getByRole('button', { name: 'Pay now / resume sandbox checkout', exact: true }).count() === 0 && await page.getByRole('button', { name: 'Reconcile with gateway', exact: true }).isVisible());
  s.newPendingObserved = true; s.newPaymentId = data.payments[0].id;
  return { role: s.role, passed: s.checks.filter(c => c.passed).length, failed: s.checks.filter(c => !c.passed).length, checks: s.checks, financialWrites: false };
}
