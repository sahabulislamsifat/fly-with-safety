const authDeliveryConfig: import('vitest/config').ViteUserConfig = {
  root: __dirname,
  envDir: false,
  test: {
    include: ['auth-delivery.test.ts', 'boundaries.test.ts'],
    setupFiles: ['./fixtures.ts'],
    globalSetup: [],
    environment: 'node', pool: 'threads', maxWorkers: 1, fileParallelism: false,
    isolate: true, watch: false, cache: false, coverage: { enabled: false },
    testTimeout: 5000, hookTimeout: 5000,
  },
};
module.exports = authDeliveryConfig;
