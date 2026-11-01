const config: import('vitest/config').ViteUserConfig = {
  root: __dirname, envDir: false, test: { include: ['phase2-browser-preflight.test.ts'], setupFiles: [], globalSetup: [],
    environment: 'node', pool: 'threads', maxWorkers: 1, fileParallelism: false, isolate: true,
    watch: false, cache: false, testTimeout: 5000, coverage: { enabled: false } },
};
module.exports = config;
