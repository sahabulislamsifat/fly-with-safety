// G3-H may typecheck this config. Running it requires separate G3-P/G3-X approval.
const authConsumptionPgConfig: import('vitest/config').ViteUserConfig = {
  root: __dirname,
  envDir: false,
  test: {
    include: ['auth-consumption.pg.test.ts'],
    globalSetup: [], setupFiles: [], environment: 'node',
    pool: 'threads', maxWorkers: 1, fileParallelism: false, isolate: true,
    watch: false, cache: false, coverage: { enabled: false }, bail: 1,
    testTimeout: 15000, hookTimeout: 20000,
  },
};
module.exports = authConsumptionPgConfig;
