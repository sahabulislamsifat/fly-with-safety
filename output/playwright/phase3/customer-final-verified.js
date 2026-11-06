async page => {
  const s = page.__phase3, ref = 'FWS-P3-BROWSER-E77192B4';
  if (s.role !== 'CUSTOMER' || !s.callbackDone || s.finalVerifiedAdmitted) throw Error('CUSTOMER_FINAL_VERIFIED_SCOPE');
  s.finalVerifiedAdmitted = true;
  const check = (id, ok) => { s.checks.push({ id, passed: ok }); if (!ok) throw Error('PHASE3_BROWSER_'+id); };
  await page.getByRole('button', { name: 'Refresh payment status', exact: true }).click();
  await page.getByText('12000.00 BDT · VERIFIED', { exact: true }).waitFor();
  check('customer-injected-verified-ui', await page.getByText(/AWAITING OPERATIONS · Updated/).isVisible());
  check('captured-payment-pay-now-form-hidden-after-fix', await page.getByRole('button', { name: 'Pay now / resume sandbox checkout', exact: true }).count() === 0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^flight · FWS-P3-BROWSER-E77192B4 / }).click();
  await page.getByText('12000.00 BDT · VERIFIED', { exact: true }).waitFor();
  check('verified-payment-survives-full-refresh', await page.getByRole('button', { name: 'Pay now / resume sandbox checkout', exact: true }).count() === 0);
  const r = await page.request.get('http://localhost:5000/api/v1/payments/bookings/'+ref), records = (await r.json()).data;
  const bookingResponse = await page.request.get('http://localhost:5000/api/v1/account/bookings/'+ref), booking = (await bookingResponse.json()).data?.booking;
  check('one-original-payment-verified-no-second-charge', r.status() === 200 && records.payments.length === 1 && records.payments[0].id === s.paymentId && records.payments[0].captured && records.payments[0].status === 'VERIFIED' && records.payments[0].amountMinor === '1200000' && records.payments[0].currency === 'BDT');
  check('payment-not-booking-fulfillment', bookingResponse.status() === 200 && booking.status === 'PENDING' && booking.statusHistory.length === 2 && records.payments[0].fulfillment === 'AWAITING_OPERATIONS');
  check('final-payment-audit-durable-and-deduped', records.history.filter(h => h.kind === 'VERIFIED').length === 1 && records.history.filter(h => h.kind === 'INTENT').length === 1 && records.history.filter(h => h.kind === 'NOTICE').length === 1);
  s.finalVerifiedDone = true;
  return { role: s.role, passed: s.checks.filter(c => c.passed).length, failed: s.checks.filter(c => !c.passed).length, checks: s.checks, payment: records.payments[0], booking: { referenceNumber: booking.referenceNumber, status: booking.status, passengerCount: booking.passengers.length, historyCount: booking.statusHistory.length }, provider: 'MOCK_ONLY' };
}
