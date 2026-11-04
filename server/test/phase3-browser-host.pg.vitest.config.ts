const config: import('vitest/config').ViteUserConfig = {
  root: __dirname, envDir: false,
  test: { include: ['phase3-browser-host.pg.integration.ts'], setupFiles: [], globalSetup: [], environment: 'node', pool: 'threads', maxWorkers: 1, fileParallelism: false, isolate: true, watch: false, cache: false, testTimeout: 0, coverage: { enabled: false } },
};
module.exports = config;
