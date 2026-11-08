const config: import('vitest/config').ViteUserConfig = {
  root: __dirname, envDir: false,
  test: { include: ['timezone.test.ts', 'api-offline.test.ts'], reporters: [['json', { stdout: true }]], environment: 'node', pool: 'threads', maxWorkers: 1, fileParallelism: false, watch: false, cache: false },
};
module.exports = config;
