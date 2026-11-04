async page => {
  const s = page.__phase3, ref = 'FWS-P3-BROWSER-E77192B4';
  if (s.role !== 'CUSTOMER' || s.eligibleDone) throw Error('CUSTOMER_ELIGIBILITY_CONTEXT_GUARD');
  const check = (id, ok) => { if (!s.checks.some(c => c.id === id)) s.checks.push({ id, passed: ok }); if (!ok) throw Error('PHASE3_BROWSER_'+id); };
  const response = await page.request.get('http://localhost:5000/api/v1/account/bookings/'+ref), booking = (await response.json()).data?.booking;
  check('owned-new-booking-persisted-api', response.status() === 200 && booking?.referenceNumber === ref && booking.totalPrice === 12000 && booking.currency === 'BDT' && booking.status === 'PENDING');
  check('accepted-quote-and-no-manual-payment', booking.commercial?.quotes.length === 1 && !!booking.commercial.quotes[0].acceptedAt && booking.commercial.payments.length === 0);
  const payments = await page.request.get('http://localhost:5000/api/v1/payments/bookings/'+ref), records = (await payments.json()).data;
  check('new-booking-no-payment-before-click', payments.status() === 200 && records?.payments.length === 0);
  await page.getByRole('heading', { name: 'SSLCommerz sandbox payments', exact: true }).waitFor();
  const text = await page.locator('main[aria-live="polite"]').innerText();
  check('customer-passenger-ui', text.includes('Synthetic BrowserTraveller') && text.includes('Passengers (1)'));
  check('customer-accepted-quote-ui', text.includes('12,000 BDT · Accepted'));
  check('pay-now-control-visible', await page.getByRole('button', { name: 'Pay now / resume sandbox checkout', exact: true }).isVisible());
  check('no-supplier-success-claim', text.includes('Payment verification does not issue tickets') && !text.includes('Booking completed'));
  s.eligibleDone = true;
  return { role: s.role, passed: s.checks.filter(c => c.passed).length, failed: s.checks.filter(c => !c.passed).length, checks: s.checks, fixtureWrites: false };
}
