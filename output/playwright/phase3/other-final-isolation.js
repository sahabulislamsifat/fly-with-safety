async page => {
  const s = page.__phase3;
  if (s.role !== 'OTHER CUSTOMER' || s.finalIsolationDone) throw Error('FINAL_ISOLATION_SCOPE');
  const check = (id, ok) => { s.checks.push({ id, passed: ok }); if (!ok) throw Error('PHASE3_BROWSER_'+id); };
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'No bookings yet', exact: true }).waitFor();
  check('other-customer-empty-dashboard-after-verified-capture', true);
  const r = await page.request.get('http://localhost:5000/api/v1/payments/bookings/FWS-P3-BROWSER-E77192B4');
  check('verified-financial-record-still-cross-customer-denied', r.status() === 404);
  const b = await page.request.get('http://localhost:5000/api/v1/account/bookings/FWS-P3-BROWSER-E77192B4');
  check('verified-booking-detail-still-cross-customer-denied', b.status() === 404);
  s.finalIsolationDone = true;
  return { role: s.role, passed: s.checks.filter(c => c.passed).length, failed: s.checks.filter(c => !c.passed).length, checks: s.checks, fixtureWrites: false };
}
