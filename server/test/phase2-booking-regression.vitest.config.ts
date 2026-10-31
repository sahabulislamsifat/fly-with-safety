const config: import('vitest/config').ViteUserConfig = {
  root: __dirname, envDir: false, test: { include: ['booking-lifecycle.test.ts', 'booking-privacy.test.ts', 'booking-idempotency.test.ts'],
    setupFiles: ['./phase2-booking-regression.setup.ts'], globalSetup: [], environment: 'node', pool: 'threads',
    maxWorkers: 1, fileParallelism: false, isolate: true, watch: false, cache: false, testTimeout: 5000, coverage: { enabled: false } },
};
module.exports = config;
