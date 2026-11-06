async page => {
  const s = page.__phase3;
  if (s.expiredContextRefreshed) throw Error('CONTEXT_REFRESH_ALREADY_EXECUTED');
  const response = page.waitForResponse(r => r.url() === 'http://localhost:5000/api/v1/auth/refresh' && r.request().method() === 'POST');
  await page.evaluate(() => window.dispatchEvent(new Event('flywithsafe:auth-change')));
  const refresh = await response;
  const me = await page.request.get('http://localhost:5000/api/v1/auth/me'), user = (await me.json()).data?.user;
  const ids = { STAFF: '7ca1205c-0844-40d7-abff-74da4974a8de', ADMIN: '8948d02b-8f17-4e2c-aa35-3875420da1cb', 'OTHER CUSTOMER': '701fb225-e21e-4901-8663-81590207a66f' };
  const ok = refresh.status() === 200 && me.status() === 200 && user?.id === ids[s.role];
  s.checks.push({ id: s.role.toLowerCase().replaceAll(' ','-')+'-real-expired-session-refresh', passed: ok });
  if (!ok) throw Error('OWNED_SESSION_REFRESH_FAILED_'+s.role);
  s.expiredContextRefreshed = true;
  return { role: s.role, refreshStatus: refresh.status(), actorPreserved: true, passed: s.checks.filter(c => c.passed).length, failed: s.checks.filter(c => !c.passed).length, credentialsReadOrRecorded: false };
}
