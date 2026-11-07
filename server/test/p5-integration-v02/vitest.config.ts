const config: import('vitest/config').ViteUserConfig = {
  root: __dirname, envDir: false,
  test: {
    include: ['postgres.test.ts'], reporters: [['json', { stdout: true }]],
    environment: 'node', pool: 'threads', isolate: true, maxWorkers: 1,
    fileParallelism: false, globalSetup: [], setupFiles: [], watch: false, cache: false,
  },
};
module.exports = config;
