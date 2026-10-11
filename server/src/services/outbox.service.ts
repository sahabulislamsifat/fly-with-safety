import { prisma } from '../lib/prisma.js';
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

/**
 * Checks whether the NotificationOutbox table exists in the database.
 * Results are cached in memory to avoid repeated queries.
 */
export async function isOutboxTableAvailable(): Promise<boolean> {
  if (outboxTableAvailableState !== null) {
    return outboxTableAvailableState;
  }
  try {
    if (!prisma.notificationOutbox) {
      outboxTableAvailableState = false;
      return false;
    }
    await prisma.$queryRawUnsafe('SELECT 1 FROM "NotificationOutbox" LIMIT 0');
    outboxTableAvailableState = true;
  } catch {
    outboxTableAvailableState = false;
  }
  return outboxTableAvailableState;
}

export function setOutboxTableAvailable(available: boolean | null): void {
  outboxTableAvailableState = available;
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
      recipient: input.recipient,
      subject: input.subject,
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
export async function processOutboxBatch(batchSize = 20): Promise<{
  processed: number;
  delivered: number;
  failed: number;
  recovered: number;
}> {
  let processed = 0;
  let delivered = 0;
  let failed = 0;
  let recovered = 0;

  try {
    const isAvailable = await isOutboxTableAvailable();
    if (!isAvailable) {
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
      },
    });
    recovered = recoveryResult.count;

    // 2. Discover records eligible for processing
    const candidates = await prisma.notificationOutbox.findMany({
      where: {
        status: 'PENDING',
        nextAttemptAt: { lte: new Date() },
      },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });

    for (const item of candidates) {
      processed += 1;

      // Optimistic concurrency lease: set to PROCESSING
      const leased = await prisma.notificationOutbox.updateMany({
        where: {
          id: item.id,
          status: 'PENDING',
        },
        data: {
          status: 'PROCESSING',
        },
      });

      if (leased.count === 0) {
        // Leased by another concurrent worker
        continue;
      }

      try {
        const payload = item.payload as { template: NotificationTemplateType; params: Record<string, any> };
        const content = renderNotificationContent(payload.template, payload.params || {});

        // Send through underlying transport (throws if transport fails)
        await sendEmailRaw({
          to: item.recipient,
          subject: item.subject || content.subject,
          html: content.html,
          text: content.text,
        });

        // Mark as DELIVERED
        await prisma.notificationOutbox.update({
          where: { id: item.id },
          data: {
            status: 'DELIVERED',
            processedAt: new Date(),
            error: null,
          },
        });
        delivered += 1;
      } catch (sendErr: any) {
        const attempts = item.attempts + 1;
        const sanitizedError = (sendErr?.message || 'Email transport error').slice(0, 500);

        if (attempts >= item.maxAttempts) {
          // Terminal failure: preserve record for investigation and safe redrive
          await prisma.notificationOutbox.update({
            where: { id: item.id },
            data: {
              status: 'FAILED',
              attempts,
              error: sanitizedError,
              processedAt: new Date(),
            },
          });
          failed += 1;
        } else {
          // Bounded exponential backoff: 1m, 2m, 4m, 8m... max 30m
          const backoffMinutes = Math.min(30, Math.pow(2, attempts - 1));
          const nextAttempt = new Date(Date.now() + backoffMinutes * 60 * 1000);

          await prisma.notificationOutbox.update({
            where: { id: item.id },
            data: {
              status: 'PENDING',
              attempts,
              nextAttemptAt: nextAttempt,
              error: sanitizedError,
            },
          });
        }
      }
    }
  } catch (err: any) {
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
    const updated = await prisma.notificationOutbox.updateMany({
      where: { id, status: 'FAILED' },
      data: {
        status: 'PENDING',
        attempts: 0,
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
