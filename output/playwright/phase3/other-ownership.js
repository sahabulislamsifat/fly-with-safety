async page => {
  const state = page.__phase3;
  if (state.role !== 'OTHER CUSTOMER' || state.otherOwnershipDone) throw Error('OWNERSHIP_CONTEXT_OR_DUPLICATE_GUARD');
  const check = (id, ok) => { state.checks.push({ id, passed: ok }); if (!ok) throw Error('PHASE3_BROWSER_'+id); };
  await page.getByRole('heading', { name: 'No bookings yet', exact: true }).waitFor();
  check('other-customer-no-owned-bookings-ui', true);
  for (const ref of ['FWS-P3-BROWSER-E77192B4', 'FWS-P3-DF9912FD']) {
    const r = await page.request.get('http://localhost:5000/api/v1/payments/bookings/'+ref, { maxRedirects: 0 });
    check('other-customer-payment-denied-'+ref, r.status() === 404);
  }
  const management = await page.request.get('http://localhost:5000/api/v1/admin/bookings', { maxRedirects: 0 });
  check('other-customer-admin-denied', management.status() === 403);
  const invalid = await page.request.get('http://localhost:5000/api/v1/payments/bookings/FWS-P3-BROWSER-E77192B4', { headers: { Authorization: 'Bearer synthetic-invalid-session' }, maxRedirects: 0 });
  check('invalid-session-denied-despite-cookie', invalid.status() === 401);
  state.otherOwnershipDone = true;
  return { role: state.role, passed: state.checks.filter(c => c.passed).length, failed: state.checks.filter(c => !c.passed).length, checks: state.checks, fixtureWrites: false };
}
