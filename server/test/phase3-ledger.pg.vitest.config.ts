// Not part of the offline suite. Owner approval and guarded local schema activation are prerequisites.
const config: import('vitest/config').ViteUserConfig = {
  root: __dirname, envDir: false,
  test: { include: ['phase3-ledger.pg.integration.ts'], setupFiles: [], globalSetup: [], environment: 'node', pool: 'threads', maxWorkers: 1, fileParallelism: false, isolate: true, watch: false, cache: false, testTimeout: 60000, coverage: { enabled: false } },
};
module.exports = config;
