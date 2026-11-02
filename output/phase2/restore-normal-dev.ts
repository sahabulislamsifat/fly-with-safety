// Retired before execution: starting then stopping a worker is not read-only safe.
throw new Error('RETIRED_USE_ORIGINAL_SERVER_WITH_NO_OUTBOX_WORKER_FLAG');
if (process.env.DATABASE_URL || process.env.DIRECT_URL || process.env.PHASE2_BOOKING_DATABASE_URL) {
  throw new Error('INHERITED_DATABASE_OVERRIDE_PRESENT');
}
process.env.NODE_ENV = 'development';
process.env.PORT = '5000';
void (async () => {
  await import('../../server/src/server.js');
  const { stopOutboxWorker } = await import('../../server/src/services/outbox.service.js');
  stopOutboxWorker();
  console.log('NORMAL_DEVELOPMENT_CONFIG_RESTORED_BACKGROUND_DELIVERY_PAUSED_FOR_READONLY_REVIEW');
})().catch(() => { console.error('NORMAL_DEV_RESTORE_STOP'); process.exitCode = 1; });
