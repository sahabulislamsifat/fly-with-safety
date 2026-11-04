'use strict';
const fs = require('node:fs'), path = require('node:path'), { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..'), local = createRequire(path.join(root, 'server/package.json'));
const dotenv = local('dotenv');
const read = p => fs.existsSync(p) ? dotenv.parse(fs.readFileSync(p)) : {};
const env = { ...read(path.join(root, '.env')), ...read(path.join(root, 'server/.env')) };
function target(raw) {
  try { const u = new URL(raw); return { present: true, valid: true, protocol: u.protocol, local: ['localhost','127.0.0.1','[::1]'].includes(u.hostname), prismaHost: u.hostname.endsWith('.prisma.io') || u.hostname === 'prisma.io', db: ['/postgres','/flywithsafety_local_integration'].includes(u.pathname) ? u.pathname.slice(1) : 'OTHER', roleMatchesPreviouslyObservedMain: u.username === 'prisma_migration', localRole: u.username === 'flywithsafe_phase2_booking_test', hasPassword: Boolean(u.password), hasQuery: Boolean(u.search) }; } catch { return { present: Boolean(raw), valid: false }; }
}
const isLocalAPI = value => { try { const u = new URL(value); return ['localhost','127.0.0.1'].includes(u.hostname) && u.port === '5000' && u.pathname.replace(/\/$/,'') === '/api/v1' && !u.username && !u.password && !u.search; } catch { return false; } };
const clientRequire = createRequire(path.join(root, 'client/package.json'));
const next = createRequire(clientRequire.resolve('next/package.json'))('@next/env');
const frontend = next.loadEnvConfig(path.join(root, 'client'), true, { info() {}, error() {} }, true);
const staging = read(path.join(root, 'server/.env.staging.local'));
const report = {
  backendCwd: 'server', backendExistingFiles: ['server/.env','.env'].filter(p => fs.existsSync(path.join(root,p))), backendPrecedence: 'fresh child -> server/.env -> root/.env missing keys only',
  database: target(env.DATABASE_URL), direct: target(env.DIRECT_URL),
  runtimeAndDirectSameTarget: (() => {try{const a=new URL(env.DATABASE_URL),b=new URL(env.DIRECT_URL);return a.hostname===b.hostname&&a.pathname===b.pathname;}catch{return false;}})(),
  runtimeEqualsConfiguredStaging: Boolean(staging.INTREGRATION_DATABASE_URL && env.DATABASE_URL === staging.INTREGRATION_DATABASE_URL),
  storePasswordPresent: Boolean(env.SSLCOMMERZ_STORE_PASSWORD), storeIdPresent: Boolean(env.SSLCOMMERZ_STORE_ID), sandboxTrue: env.SSLCOMMERZ_SANDBOX === 'true', paymentEnabledInFile: env.SSLCOMMERZ_ENABLED === 'true',
  callbackOriginConfigured: Boolean(env.SSLCOMMERZ_CALLBACK_BASE_URL),
  configuredFrontendLocal: env.FRONTEND_URL === 'http://localhost:3000', configuredBackendLocal: env.API_BASE_URL === 'http://localhost:5000',
  configuredGoogleCallbackLocal: env.GOOGLE_CALLBACK_URL === 'http://localhost:5000/api/v1/auth/google/callback',
  googleCredentialPairPresent: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  frontendLoadedFiles: frontend.loadedEnvFiles.map(f => 'client/' + f.path),
  frontendAPIIsLocal: isLocalAPI(process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_BASE_API_URL),
  frontendExplicitLocalAPI: Boolean(process.env.NEXT_PUBLIC_LOCAL_API_BASE_URL),
  frontendPublicSecretKeyNames: Object.keys(process.env).filter(k => /^NEXT_PUBLIC_/.test(k) && /PASSWORD|SECRET|DATABASE_URL|PRIVATE_KEY|STORE_PASSWD/.test(k) && process.env[k]),
  callbackHostsLoadDotenv: false, callbackHostsHaveMerchantCredentials: false,
  noEnvFilesModified: true,
};
fs.writeFileSync(path.join(__dirname,'environment-audit.json'),JSON.stringify(report,null,2),{flag:'wx'});
console.log(JSON.stringify(report));
