async page => {
  const s = page.__phase3;
  if (!s || s.checks.some(c => !c.passed) || new Set(s.checks.map(c => c.id)).size !== s.checks.length) throw Error('CONTEXT_CHECKS_INCOMPLETE_OR_DUPLICATED');
  return { role: s.role, passed: s.checks.length, failed: 0, checks: s.checks, isolatedBrowserContexts: page.context().browser().contexts().length, cloudFallbackBlocked: s.cloudFallbackBlocked, externalBlocked: s.blocked, providerRequestsSent: s.providerRequestsSent, injectedCheckoutNavigations: s.injectedCheckoutNavigations, apiTransportFailures: s.failures, tokensOrPasswordsRecorded: false, url: page.url() };
}
