// Session-only local frontend; preserve the owner's existing Next server and config.
const path = require('node:path'), { pathToFileURL } = require('node:url'), { createRequire } = require('node:module');
const dir = path.resolve(__dirname, '../../client'), local = createRequire(path.join(dir, 'package.json'));
process.env.NEXT_PUBLIC_LOCAL_API_BASE_URL = 'http://phase2.localhost:5002/api/v1';
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://phase2.localhost:5002/api/v1';
(async () => {
  const original = (await import(pathToFileURL(path.join(dir, 'next.config.ts')).href)).default;
  const app = local('next')({ dev: true, dir, hostname: 'phase2.localhost', port: 3002,
    conf: { ...original, distDir: '.next-phase2-browser', env: { ...original.env, NEXT_PUBLIC_LOCAL_API_BASE_URL: process.env.NEXT_PUBLIC_LOCAL_API_BASE_URL } } });
  await app.prepare();
  const handle = app.getRequestHandler();
  require('node:http').createServer((req, res) => handle(req, res)).listen(3002, '127.0.0.1', () => console.log('PHASE2_ISOLATED_FRONTEND_READY_3002'));
})().catch(() => { console.error('PHASE2_LOCAL_FRONTEND_START_FAILED'); process.exitCode = 1; });
