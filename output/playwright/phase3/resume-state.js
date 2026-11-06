async page => {
  const s = page.__phase3;
  const live = await page.request.get('http://localhost:5000/__phase3_identity', { maxRedirects: 0 }), i = await live.json();
  if (i.db !== 'flywithsafety_local_integration' || i.role !== 'flywithsafe_phase2_booking_test' || i.oid !== 34701 || i.hostId !== 'e77192b4-357f-47a6-ad59-dc35b980330e') throw Error('RESUME_IDENTITY_MISMATCH');
  const me = await page.request.get('http://localhost:5000/api/v1/auth/me');
  return { role: s.role, checksPassed: s.checks.filter(c => c.passed).length, checksFailed: s.checks.filter(c => !c.passed).length, authStatus: me.status(), url: page.url(), identityVerified: true };
}
