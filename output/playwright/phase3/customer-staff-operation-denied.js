async page => {
  const s = page.__phase3;
  if (s.role !== 'CUSTOMER' || s.managementDenialDone) throw Error('CUSTOMER_OPERATION_DENIAL_SCOPE');
  const r = await page.request.post('http://localhost:5000/api/v1/payments/bookings/FWS-P3-BROWSER-E77192B4/reconcile', { headers: { Origin: 'http://localhost:3000' }, data: {}, maxRedirects: 0, maxRetries: 0 });
  s.checks.push({ id: 'customer-real-service-reconcile-forbidden', passed: r.status() === 403 });
  if (r.status() !== 403) throw Error('CUSTOMER_RECONCILE_NOT_DENIED');
  s.managementDenialDone = true;
  return { role: s.role, passed: s.checks.filter(c => c.passed).length, failed: s.checks.filter(c => !c.passed).length, status: r.status(), realApplicationGuard: true };
}
