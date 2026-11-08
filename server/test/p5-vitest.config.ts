const config: import('vitest/config').ViteUserConfig = {
  root: __dirname, envDir: false,
  test: {
    include: ['p5-identity.test.ts', 'p5-disposable-target.test.ts', 'p5-postgres.test.ts', 'phase3-negative-contract.test.ts', 'phase3-booking-boundary.test.ts'],
    env: { P5_DISPOSABLE_EXECUTION_APPROVED: 'false', IDENTITY_SCOPE_ENABLED: 'false' },
    environment: 'node', pool: 'threads', isolate: true, maxWorkers: 1, fileParallelism: false,
    globalSetup: [], setupFiles: [], watch: false, cache: false,
  },
};
module.exports = config;
