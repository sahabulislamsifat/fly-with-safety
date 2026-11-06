async page => {
  const role = page.__phase3?.role;
  const expected = { CUSTOMER: ['d8505f78-a138-405e-a750-b23d82af87ad','CUSTOMER'], STAFF: ['7ca1205c-0844-40d7-abff-74da4974a8de','STAFF'], ADMIN: ['8948d02b-8f17-4e2c-aa35-3875420da1cb','ADMIN'], 'OTHER CUSTOMER': ['701fb225-e21e-4901-8663-81590207a66f','CUSTOMER'] }[role];
  if (!expected) throw Error('PHASE3_CONTEXT_ROLE_MISSING');
  const response = await page.request.get('http://localhost:5000/api/v1/auth/me', { maxRedirects: 0 }), body = await response.json();
  const user = body.data?.user;
  if (response.status() !== 200 || user?.id !== expected[0] || user?.role !== expected[1]) throw Error('PHASE3_EXACT_SIGNED_IN_ACTOR_MISMATCH_'+role);
  page.__phase3.checks = [{ id: role.toLowerCase().replaceAll(' ','-')+'-exact-authenticated-actor', passed: true }];
  return { role, passed: 1, failed: 0, actorMatched: true, isolatedBrowserContexts: page.context().browser().contexts().length, cookiesOrTokensRecorded: false };
}
