const config: import('vitest/config').ViteUserConfig = {
  root: __dirname, envDir: false,
  test: { include: ['p5-postgres.test.ts'], environment: 'node', pool: 'threads', isolate: true, maxWorkers: 1, fileParallelism: false, globalSetup: [], setupFiles: [], watch: false, cache: false },
};
module.exports = config;
