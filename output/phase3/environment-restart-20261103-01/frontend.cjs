'use strict';
const path = require('node:path'), fs = require('node:fs'), { createRequire } = require('node:module');
const dir = path.resolve(__dirname, '../../../client'), local = createRequire(path.join(dir, 'package.json'));
process.env.NODE_ENV = 'development';
process.env.NEXT_PUBLIC_LOCAL_API_BASE_URL = 'http://localhost:5000/api/v1';
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:5000/api/v1';
(async () => {
  const app = local('next')({ dev: true, dir, hostname: 'localhost', port: 3000 });
  await app.prepare();
  const server = require('node:http').createServer(app.getRequestHandler());
  server.on('error', () => { console.error('DEVELOPMENT_FRONTEND_BIND_FAILED'); process.exitCode = 1; void app.close(); });
  server.listen(3000, 'localhost', () => {
    fs.writeFileSync(path.join(__dirname, 'frontend-config.json'), JSON.stringify({ pid: process.pid, frontend: 'http://localhost:3000', api: 'http://localhost:5000/api/v1', cloudFallbackDisabled: true, processLocalPin: true, envFilesModified: false }, null, 2), { flag: 'wx' });
    console.log('LOCAL_DEVELOPMENT_FRONTEND_READY_3000');
  });
  process.on('message', async m => {
    if (m?.action !== 'stop-owned-development-server') return;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await app.close(); process.exit(0);
  });
})().catch(() => { console.error('DEVELOPMENT_FRONTEND_PREPARATION_FAILED'); process.exit(1); });
