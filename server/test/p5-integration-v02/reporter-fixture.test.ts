import { it, expect } from 'vitest';
// Pure test-infrastructure fixture: no driver, API, private config or database imports.
const mode = process.env.P5_REPORTER_FIXTURE_OUTCOME;
it.skipIf(mode === 'skip')('offline reporter contract fixture', () => { expect(mode).toBe('pass'); });
