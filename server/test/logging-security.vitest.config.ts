const lifecycleConfig: import('vitest/config').ViteUserConfig = {
  root: __dirname,
  envDir: false,
  test: {
    include: ['logging-security.test.ts'],
    globalSetup: [], setupFiles: [], environment: 'node',
    pool: 'threads', maxWorkers: 1, fileParallelism: false, isolate: true,
    watch: false, cache: false, coverage: { enabled: false },
    testTimeout: 5000, hookTimeout: 5000,
  },
};
module.exports = lifecycleConfig;
