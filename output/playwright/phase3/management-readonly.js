async page => {
  const s = page.__phase3, staff = s.role === 'STAFF', ref = staff ? 'FWS-P3-B79D19E7' : 'FWS-P3-DF9912FD';
  if (!['STAFF','ADMIN'].includes(s.role) || s.managementReadDone) throw Error('MANAGEMENT_CONTEXT_OR_DUPLICATE_GUARD');
  const check = (name, ok) => { const id = s.role.toLowerCase()+'-'+name; s.checks.push({ id, passed: ok }); if (!ok) throw Error('PHASE3_BROWSER_'+id); };
  const r = await page.request.get('http://localhost:5000/api/v1/payments/bookings/'+ref), data = (await r.json()).data;
  check('authorized-persisted-payment-read', r.status() === 200 && data.payments.length === 1 && data.payments[0].captured && data.payments[0].amountMinor === '1200000' && data.payments[0].currency === 'BDT');
  await page.getByRole('heading', { name: 'SSLCommerz sandbox payments', exact: true }).waitFor();
  const text = await page.locator('body').innerText();
  check('operations-risk-queue-visible', text.includes('Sandbox payment operations') && text.includes('FWS-P3-B79D19E7 · RISK REVIEW'));
  check('passenger-and-accepted-quote', text.includes('Passenger Manifest (1)') && text.includes('Synthetic Traveller') && text.includes('12,000 BDT · Accepted'));
  check('financial-display-synchronized', staff ? text.includes('12000.00 BDT · RISK REVIEW') && data.payments[0].status === 'RISK_REVIEW' : text.includes('12000.00 BDT · PARTIALLY REFUNDED') && data.payments[0].financialState === 'PARTIALLY_REFUNDED' && text.includes('Refund 7000.00 BDT · REFUNDED'));
  check('refund-role-display', staff ? !data.refundsEnabled && await page.getByRole('button', { name: 'Request sandbox refund', exact: true }).count() === 0 : data.refundsEnabled && await page.getByRole('button', { name: 'Request sandbox refund', exact: true }).isVisible());
  await page.getByText('Payment audit history', { exact: true }).click();
  check('audit-history-present', data.history.length > 0 && (await page.locator('body').innerText()).includes(staff ? 'RISK REVIEW' : 'REFUND REFUNDED'));
  s.managementReadDone = true;
  return { role: s.role, passed: s.checks.filter(c => c.passed).length, failed: s.checks.filter(c => !c.passed).length, checks: s.checks, originalFinancialWrites: false, providerCalled: false };
}
