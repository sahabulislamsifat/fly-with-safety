import { prisma } from '../lib/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { logger, serializeError } from '../lib/logger.js';
import {
  renderNotificationContent,
  sendEmailRaw,
  type NotificationTemplateType,
} from './notification.service.js';

export interface EnqueueNotificationInput {
  channel?: string;
  recipient: string;
  subject: string;
  template: NotificationTemplateType;
  params: Record<string, any>;
  idempotencyKey?: string;
  maxAttempts?: number;
}

export interface OutboxStats {
  pending: number;
  processing: number;
  delivered: number;
  failed: number;
  total: number;
}

let outboxTableAvailableState: boolean | null = null;
let missingTableCacheExpiresAt = 0;

/**
 * Checks whether the NotificationOutbox table exists in the database.
 * Results are cached in memory to avoid repeated queries.
 */
export async function isOutboxTableAvailable(): Promise<boolean> {
  if (outboxTableAvailableState === true || (outboxTableAvailableState === false && Date.now() < missingTableCacheExpiresAt)) {
    return outboxTableAvailableState;
  }
  try {
    if (!prisma.notificationOutbox) {
      setOutboxTableAvailable(false);
      return false;
    }
    await prisma.$queryRawUnsafe('SELECT 1 FROM "NotificationOutbox" LIMIT 0');
    outboxTableAvailableState = true;
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    const meta = error && typeof error === 'object' && 'meta' in error ? error.meta : undefined;
    const sqlCode = meta && typeof meta === 'object' && 'code' in meta ? meta.code : undefined;
    if (code !== '42P01' && sqlCode !== '42P01') throw error;
    setOutboxTableAvailable(false);
  }
  return outboxTableAvailableState === true;
}

export function setOutboxTableAvailable(available: boolean | null): void {
  outboxTableAvailableState = available;
  missingTableCacheExpiresAt = available === false ? Date.now() + 30_000 : 0;
}

/**
 * Persists a notification to the outbox table.
 * If provided a transaction client (tx), it commits atomically with the business operation.
 */
export async function enqueueNotification(
  dbClient: any,
  input: EnqueueNotificationInput
): Promise<{ id: string; status: string } | null> {
  // Pre-flight check: if outbox table is not yet migrated, do not execute SQL against dbClient
  // to avoid poisoning active PostgreSQL transaction blocks.
  const isAvailable = await isOutboxTableAvailable();
  if (!isAvailable) {
    logger.warn('outbox_unavailable_non_durable_fallback', {
      // Recipients and free-form subjects are not operational log metadata.
      template: input.template,
      message: 'NotificationOutbox table is not migrated. Delivery is non-durable best-effort.',
    });
    try {
      const rendered = renderNotificationContent(input.template, input.params);
      sendEmailRaw({
        to: input.recipient,
        subject: input.subject || rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }).catch((fallbackErr) => {
        logger.warn('outbox_direct_send_fallback_failed', serializeError(fallbackErr));
      });
    } catch (renderErr) {
      logger.error('outbox_render_fallback_failed', serializeError(renderErr));
    }
    return null;
  }

  const client = dbClient || prisma;

  try {
    // If idempotencyKey is supplied, check for an existing entry to avoid duplicates
    if (input.idempotencyKey) {
      const existing = await client.notificationOutbox.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return existing;
      }
    }

    const record = await client.notificationOutbox.create({
      data: {
        channel: input.channel || 'EMAIL',
        recipient: input.recipient,
        subject: input.subject,
        payload: {
          template: input.template,
          params: input.params,
        },
        status: 'PENDING',
        attempts: 0,
        maxAttempts: input.maxAttempts || 5,
        nextAttemptAt: new Date(),
        idempotencyKey: input.idempotencyKey || null,
      },
    });

    return record;
  } catch (err: any) {
    // If duplicate idempotency key race occurred
    if (err?.code === 'P2002' && input.idempotencyKey) {
      try {
        return await client.notificationOutbox.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
      } catch {
        // ignore fallback fetch error
      }
    }

    // In PostgreSQL, any failed query inside an active transaction (dbClient provided) poisons it.
    // We must never swallow the error and claim fallback within an aborted transaction.
    if (dbClient) {
      logger.error('outbox_transactional_enqueue_failed', serializeError(err));
      throw err;
    }

    // Non-transactional fallback if direct prisma call fails
    logger.warn('outbox_enqueue_failed_falling_back', serializeError(err));
    try {
      const rendered = renderNotificationContent(input.template, input.params);
      sendEmailRaw({
        to: input.recipient,
        subject: input.subject || rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }).catch((fallbackErr) => {
        logger.warn('outbox_direct_send_fallback_failed', serializeError(fallbackErr));
      });
    } catch (renderErr) {
      logger.error('outbox_render_fallback_failed', serializeError(renderErr));
    }
    return null;
  }
}

/**
 * Discovers and processes pending notification records.
 * Recovers stuck records (> 5 min in PROCESSING state).
 * Retries failed attempts using bounded exponential backoff.
 */
export async function processOutboxBatch(batchSize = 20, options: {
  timeBudgetMs?: number;
  throwOnError?: boolean;
} = {}): Promise<{
  processed: number;
  delivered: number;
  failed: number;
  recovered: number;
}> {
  let processed = 0;
  let delivered = 0;
  let failed = 0;
  let recovered = 0;
  const limit = Number.isFinite(batchSize) ? Math.max(1, Math.min(20, Math.floor(batchSize))) : 20;
  const budget = options.timeBudgetMs ?? 20_000;
  const deadline = Date.now() + (Number.isFinite(budget) ? Math.max(1, Math.min(25_000, budget)) : 20_000);

  try {
    const isAvailable = await isOutboxTableAvailable();
    if (!isAvailable) {
      if (options.throwOnError) throw new Error('Outbox storage unavailable');
      return { processed: 0, delivered: 0, failed: 0, recovered: 0 };
    }

    // 1. Recover records stuck in PROCESSING for more than 5 minutes (worker crashed / timed out)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recoveryResult = await prisma.notificationOutbox.updateMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lte: fiveMinutesAgo },
      },
      data: {
        status: 'PENDING',
        updatedAt: new Date(),
      },
    });
    recovered = recoveryResult.count;

    // 2. Discover records eligible for processing
    const candidates = await prisma.notificationOutbox.findMany({
      where: {
        status: 'PENDING',
        nextAttemptAt: { lte: new Date() },
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    for (const item of candidates) {
      // Admission deadline: await in-flight work; never abandon an SMTP send with Promise.race.
      if (Date.now() >= deadline) break;
      processed += 1;

      // Advance the version even within one millisecond to prevent ABA on rapid redrive.
      const leaseVersion = new Date(Math.max(Date.now(), item.updatedAt.getTime() + 1));
      // Optimistic concurrency lease: set to PROCESSING
      const leased = await prisma.notificationOutbox.updateMany({
        where: {
          id: item.id,
          status: 'PENDING',
          updatedAt: item.updatedAt,
        },
        data: {
          status: 'PROCESSING',
          updatedAt: leaseVersion,
        },
      });

      if (leased.count === 0) {
        // Leased by another concurrent worker
        continue;
      }

      // Fence every acknowledgment by ownership and expiry. Never hold a transaction across SMTP.
      const acknowledge = async (data: Prisma.NotificationOutboxUpdateManyMutationInput): Promise<boolean> => {
        const result = await prisma.notificationOutbox.updateMany({
          where: { id: item.id, status: 'PROCESSING', updatedAt: {
            equals: leaseVersion, gt: new Date(Date.now() - 5 * 60 * 1000),
          } },
          data: { ...data, updatedAt: new Date(Math.max(Date.now(), leaseVersion.getTime() + 1)) },
        });
        if (!result.count) logger.warn('outbox_lease_lost', { id: item.id });
        return result.count > 0;
      };

      try {
        const payload = item.payload as { template: NotificationTemplateType; params: Record<string, any> };
        const content = renderNotificationContent(payload.template, payload.params || {});

        // Send through underlying transport (throws if transport fails)
        const outcome = await sendEmailRaw({
          to: item.recipient,
          subject: item.subject || content.subject,
          html: content.html,
          text: content.text,
        });

        if (outcome.status === 'suppressed') {
          // Existing FAILED state represents terminal non-delivery; redrive is an explicit operator action.
          const acknowledged = await acknowledge({
              status: 'FAILED',
              processedAt: new Date(),
              error: `${outcome.reason}: delivery intentionally suppressed; no transport submission`,
          });
          if (!acknowledged) continue;
          logger.info('outbox_delivery_suppressed', { id: item.id, reason: outcome.reason });
          failed += 1;
          continue;
        }
        if (outcome.status !== 'submitted') throw new Error('Email transport returned an unknown outcome');

        // Mark as DELIVERED only after transport acceptance, not proof of inbox receipt.
        const acknowledged = await acknowledge({
            status: 'DELIVERED',
            processedAt: new Date(),
            error: null,
        });
        if (acknowledged) delivered += 1;
      } catch (sendErr: any) {
        const attempts = item.attempts + 1;
        const sanitizedError = 'EMAIL_TRANSPORT_FAILURE';

        if (attempts >= item.maxAttempts) {
          // Terminal failure: preserve record for investigation and safe redrive
          const acknowledged = await acknowledge({
              status: 'FAILED',
              attempts,
              error: sanitizedError,
              processedAt: new Date(),
          });
          if (acknowledged) failed += 1;
        } else {
          // Bounded exponential backoff: 1m, 2m, 4m, 8m... max 30m
          const backoffMinutes = Math.min(30, Math.pow(2, attempts - 1));
          const nextAttempt = new Date(Date.now() + backoffMinutes * 60 * 1000);

          await acknowledge({
              status: 'PENDING',
              attempts,
              nextAttemptAt: nextAttempt,
              error: sanitizedError,
          });
        }
      }
    }
  } catch (err: any) {
    if (options.throwOnError) throw err;
    // Gracefully handle if table does not exist
    if (err?.code === 'P2021' || err?.message?.includes('does not exist')) {
      return { processed: 0, delivered: 0, failed: 0, recovered: 0 };
    }
    logger.warn('outbox_batch_processing_error', serializeError(err));
  }

  return { processed, delivered, failed, recovered };
}

/**
 * Operator redrive: resets a permanently FAILED notification to PENDING for re-attempt.
 */
export async function redriveFailedNotification(id: string): Promise<boolean> {
  try {
    const record = await prisma.notificationOutbox.findUnique({ where: { id } });
    if (!record || record.status !== 'FAILED') return false;
    const updated = await prisma.notificationOutbox.updateMany({
      where: { id, status: 'FAILED', updatedAt: record.updatedAt },
      data: {
        status: 'PENDING',
        attempts: 0,
        updatedAt: new Date(Math.max(Date.now(), record.updatedAt.getTime() + 1)),
        nextAttemptAt: new Date(),
        error: null,
      },
    });
    return updated.count > 0;
  } catch (err) {
    logger.warn('outbox_redrive_failed', serializeError(err));
    return false;
  }
}

/**
 * Returns operational statistics for the notification outbox.
 */
export async function getOutboxStats(): Promise<OutboxStats> {
  try {
    const isAvailable = await isOutboxTableAvailable();
    if (!isAvailable) {
      return { pending: 0, processing: 0, delivered: 0, failed: 0, total: 0 };
    }

    const [pending, processing, delivered, failed] = await Promise.all([
      prisma.notificationOutbox.count({ where: { status: 'PENDING' } }),
      prisma.notificationOutbox.count({ where: { status: 'PROCESSING' } }),
      prisma.notificationOutbox.count({ where: { status: 'DELIVERED' } }),
      prisma.notificationOutbox.count({ where: { status: 'FAILED' } }),
    ]);
    return {
      pending,
      processing,
      delivered,
      failed,
      total: pending + processing + delivered + failed,
    };
  } catch {
    return { pending: 0, processing: 0, delivered: 0, failed: 0, total: 0 };
  }
}

let workerInterval: NodeJS.Timeout | null = null;

/**
 * Starts the periodic outbox background worker.
 */
export function startOutboxWorker(intervalMs = 15000): void {
  if (workerInterval) return;
  workerInterval = setInterval(() => {
    processOutboxBatch().catch((err) => {
      logger.warn('outbox_worker_error', serializeError(err));
    });
  }, intervalMs);
  workerInterval.unref?.();
}

/**
 * Stops the outbox background worker cleanly.
 */
export function stopOutboxWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}
