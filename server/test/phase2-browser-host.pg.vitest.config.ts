const config: import('vitest/config').ViteUserConfig = {
  root: __dirname, envDir: false, test: { include: ['phase2-browser-host.pg.test.ts'], setupFiles: [], globalSetup: [],
    environment: 'node', pool: 'threads', maxWorkers: 1, fileParallelism: false, isolate: true, bail: 1,
    watch: false, cache: false, testTimeout: 0, coverage: { enabled: false } },
};
module.exports = config;
