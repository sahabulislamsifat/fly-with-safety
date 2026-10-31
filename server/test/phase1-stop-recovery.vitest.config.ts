const config: import('vitest/config').ViteUserConfig = {
  root: __dirname, envDir: false, test: {include: ['phase1-transport.test.ts','phase1-proof-journal.test.ts','phase1-fault-readiness.test.ts','phase1-application-readiness.test.ts'],
    globalSetup: [], setupFiles: [], environment: 'node', pool: 'threads', maxWorkers: 1,
    fileParallelism: false, isolate: true, watch: false, cache: false, testTimeout: 5000, coverage: {enabled: false}},
};
module.exports = config;
