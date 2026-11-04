async page => {
  const s = page.__phase3, ref = 'FWS-P3-BROWSER-E77192B4';
  if (!['ADMIN','STAFF'].includes(s.role) || s.finalManagementAdmitted) throw Error('MANAGEMENT_FINAL_SCOPE');
  s.finalManagementAdmitted = true;
  const check = (name, ok) => { const id = s.role.toLowerCase()+'-'+name; s.checks.push({ id, passed: ok }); if (!ok) throw Error('PHASE3_BROWSER_'+id); };
  await page.getByRole('button', { name: 'Refresh payment status', exact: true }).click();
  await page.getByText('12000.00 BDT · VERIFIED', { exact: true }).waitFor();
  check('verified-payment-ui-synchronized', await page.getByText(/AWAITING OPERATIONS · Updated/).isVisible());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Bookings Processing', exact: true }).click();
  await page.getByRole('row').filter({ hasText: ref }).getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByText('12000.00 BDT · VERIFIED', { exact: true }).waitFor();
  const response = await page.request.get('http://localhost:5000/api/v1/admin/bookings'), bookings = (await response.json()).data?.bookings, booking = bookings?.find(b => b.referenceNumber === ref);
  check('management-full-refresh-persistence', response.status() === 200 && bookings.length === 3 && booking?.status === 'PENDING' && booking.totalPrice === 12000);
  check('management-atomic-status-history-and-passenger', booking.passengers.length === 1 && booking.statusHistory.length === 2 && booking.statusHistory.some(h => h.changedBy === 'SSLCOMMERZ_SANDBOX' && h.reason.includes('VERIFIED')));
  check('management-no-customer-charge-control', await page.getByRole('button', { name: 'Pay now / resume sandbox checkout', exact: true }).count() === 0);
  s.finalManagementDone = true;
  return { role: s.role, passed: s.checks.filter(c => c.passed).length, failed: s.checks.filter(c => !c.passed).length, checks: s.checks, financialWrites: false, provider: 'MOCK_ONLY' };
}
