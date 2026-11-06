async page => {
  const identity = await page.request.get('http://localhost:5000/__phase3_identity', { maxRedirects: 0 });
  const data = await identity.json();
  const exact = identity.status() === 200 && data.db === 'flywithsafety_local_integration' && data.role === 'flywithsafe_phase2_booking_test' && data.oid === 34701 && data.host === '127.0.0.1' && data.port === 5432 && data.provider === 'MOCK_ONLY' && data.hostId === 'e77192b4-357f-47a6-ad59-dc35b980330e';
  if (!exact) throw Error('PHASE3_LIVE_BROWSER_IDENTITY_MISMATCH');
  const health = await page.request.get('http://localhost:5000/api/v1/health', { headers: { Origin: 'http://localhost:3000' }, maxRedirects: 0 });
  const denial = await page.request.get('http://localhost:5000/api/v1/payments/bookings/FWS-P3-BROWSER-E77192B4', { maxRedirects: 0 });
  const cors = health.headers()['access-control-allow-origin'] === 'http://localhost:3000' && health.headers()['access-control-allow-credentials'] === 'true';
  if (!cors || denial.status() !== 401) throw Error('PHASE3_PREFLIGHT_CORS_OR_ANONYMOUS_GUARD');
  return { passed: 3, failed: 0, checks: ['exact-live-local-database-role-oid', 'frontend-origin-credentialed-cors', 'anonymous-payment-denied'], authenticated: false, provider: 'MOCK_ONLY' };
}
