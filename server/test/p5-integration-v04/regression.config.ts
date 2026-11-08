import path from 'node:path';
const config: import('vitest/config').ViteUserConfig = {
  root: path.resolve(__dirname, '..'), envDir: false,
  test: { include: ['p5-identity.test.ts', 'phase3-negative-contract.test.ts', 'phase3-booking-boundary.test.ts'],
    env: { P5_DISPOSABLE_EXECUTION_APPROVED: 'false', IDENTITY_SCOPE_ENABLED: 'false' },
    reporters: [['json', { stdout: true }]], environment: 'node', pool: 'threads', maxWorkers: 1, fileParallelism: false, watch: false, cache: false },
};
module.exports = config;
