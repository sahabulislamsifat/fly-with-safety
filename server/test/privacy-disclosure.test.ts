import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Disclosure regression only: no Next server, application runtime or database import.
const source = readFileSync(resolve(__dirname, '../../client/app/privacy/page.tsx'), 'utf8');
describe('P01/P02 truthful draft disclosure regressions', () => {
  it('marks the notice as a draft and prevents indexing as a finalized notice', () => {
    expect(source).toContain('not a finalized or production-approved privacy policy');
    expect(source).toContain('robots: { index: false, follow: false }');
  });
  it('does not invent support contacts or a company address', () => {
    expect(source).not.toMatch(/privacy@flywithsafety|123 Travel Street|New York, NY/);
    expect(source).toContain('Official company details, customer-support contact and privacy contact are not yet finalized');
  });
  it('does not assert an unverified statutory retention period', () => {
    expect(source).not.toMatch(/retained for 7 years|retained for seven years/);
    expect(source).toContain('No statutory retention period has been established by this draft');
  });
  it('does not claim that production encryption or infrastructure certification is complete', () => {
    expect(source).not.toContain('This includes encryption, secure data centers');
    expect(source).toContain('Sensitive-data encryption integration and production infrastructure verification remain incomplete');
  });
  it('keeps child travel in scope without fabricating a completed guardian workflow', () => {
    expect(source).toContain('Travel bookings may include child travelers');
    expect(source).toContain('does not invent a legal age threshold or claim guardian verification is already implemented');
  });
  it('does not assert transfer permissions or silently select Cloudflare Workers', () => {
    expect(source).toContain('Production hosting, KMS provider and region');
    expect(source).toContain('No adequacy decision or contractual safeguard is asserted here');
    expect(source).not.toContain('Cloudflare Workers');
  });
  it('uses a content revision date and does not infer consent from continued use', () => {
    expect(source).not.toMatch(/new Date\(|Continued use of our services after changes constitutes acceptance/);
    expect(source).toContain('Draft updated:');
    expect(source).toContain('must be implemented rather than inferred from continued use');
  });
});
