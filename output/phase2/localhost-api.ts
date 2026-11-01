import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
type Express = typeof import('../../server/src/app.js').default;
import { safeFailure } from '../../server/test/phase2-identity-diagnostic.js';
const base = resolve('output/phase2/localhost-runtime-20261102-01');
mkdirSync(base, { recursive: true });
if (existsSync(resolve(base, 'attempt.json'))) throw new Error('LOCAL_RUNTIME_ALREADY_STARTED_NO_RETRY');
const raw = process.env.PHASE2_BOOKING_DATABASE_URL || '';
let target: URL;
try { target = new URL(raw); } catch { throw new Error('LOCAL_RUNTIME_PRIVATE_TARGET_REQUIRED'); }
if (target.protocol !== 'postgresql:' || target.hostname !== '127.0.0.1' || target.port !== '5432' || target.pathname !== '/flywithsafe_phase2_booking_integration' || target.username !== 'flywithsafe_phase2_booking_test' || !target.password || target.search || target.hash) throw new Error('LOCAL_RUNTIME_TARGET_DENIED');
Object.assign(process.env, { NODE_ENV: 'development', DATABASE_URL: target.href, DIRECT_URL: target.href,
  PORT: '5000', FRONTEND_URL: 'http://localhost:3000', CORS_ORIGINS: 'http://localhost:3000', API_BASE_URL: 'http://localhost:5000',
  EMAIL_DELIVERY_ENABLED: 'false', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '', JWT_SECRET: randomBytes(32).toString('hex') });
writeFileSync(resolve(base, 'attempt.json'), JSON.stringify({ startedUTC: new Date().toISOString(), syntheticOnly: true }), { flag: 'wx' });
let stage = 'client-import';
void (async () => {
  const { prisma } = await import('../../server/src/lib/prisma.js');
  try {
    stage = 'identity';
    const rows = await prisma.$queryRaw<{ db: string; role: string; host: string; port: number }[]>`SELECT current_database() AS db,current_user AS role,host(inet_server_addr()) AS host,inet_server_port() AS port`;
    const row = rows[0];
    if (rows.length !== 1 || row.db !== target.pathname.slice(1) || row.role !== target.username || row.host !== '127.0.0.1' || row.port !== 5432) throw new Error('LOCAL_RUNTIME_IDENTITY_DENIED');
    stage = 'fixture-read';
    const booking = await prisma.booking.findUnique({ where: { referenceNumber: 'FWS-2026-53YFS3' }, select: { id: true, status: true, totalPrice: true, currency: true } });
    if (!booking || booking.status !== 'COMPLETED' || booking.totalPrice !== 12000 || booking.currency !== 'BDT') throw new Error('LOCAL_RUNTIME_FIXTURE_DENIED');
    stage = 'listen';
    const loaded = await import('../../server/src/app.js');
    const candidate: unknown = loaded.default;
    const app = (typeof candidate === 'function' ? candidate : (candidate as { default: Express }).default) as Express;
    const server = app.listen(5000, 'localhost');
    server.on('error', async () => { console.error('PHASE2_LOCALHOST_LISTEN_STOP'); await prisma.$disconnect(); process.exitCode = 1; });
    server.on('listening', () => {
      writeFileSync(resolve(base, 'ready.json'), JSON.stringify({ db: row.db, role: row.role, host: row.host, port: row.port, api: 'http://localhost:5000/api/v1', frontend: 'http://localhost:3000', existingBookingId: booking.id, readyUTC: new Date().toISOString() }), { flag: 'wx' });
      console.log('PHASE2_LOCALHOST_API_READY_NOT_ACCEPTANCE');
    });
    process.once('SIGINT', () => { server.close(() => { void prisma.$disconnect().then(() => process.exit(0)); }); });
  } catch (error) {
    writeFileSync(resolve(base, 'stopped.json'), JSON.stringify({ stage, passed: false, failure: safeFailure(error) }), { flag: 'wx' });
    await prisma.$disconnect(); throw new Error('PHASE2_LOCALHOST_RUNTIME_STOP_' + stage);
  }
})().catch(error => { console.error('PHASE2_LOCALHOST_RUNTIME_FAILED_NO_RETRY ' + JSON.stringify({ stage, failure: safeFailure(error) })); process.exitCode = 1; });
