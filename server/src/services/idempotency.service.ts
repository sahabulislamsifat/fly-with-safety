import { createHash } from 'crypto';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';

type Transaction = Prisma.TransactionClient;

/**
 * Safely identify a Prisma unique-constraint error.
 *
 * The explicit type predicate allows TypeScript to narrow an unknown
 * caught error without disabling strict type checking.
 */

function isPrismaUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  return (error as unknown as { code?: unknown }).code === 'P2002';
}

/**
 * Recursively sort object keys to ensure equivalent payloads produce
 * the same hash regardless of property insertion order.
 */
function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }

  return value;
}

function payloadHash(payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(payload)))
    .digest('hex');
}

export function idempotencyPrincipal(userId: string | undefined, email: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  return `guest:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`;
}

export async function createIdempotentInquiry<T extends { referenceNumber: string }>(input: {
  operation: string;
  key: string;
  userId?: string;
  email: string;
  payload: unknown;
  create: (tx: Transaction) => Promise<T>;
  findByReference: (referenceNumber: string) => Promise<T | null>;
}): Promise<{ inquiry: T; replayed: boolean }> {
  const principal = idempotencyPrincipal(input.userId, input.email);
  const hash = payloadHash(input.payload);

  try {
    const inquiry = await prisma.$transaction(async (tx) => {
      const created = await input.create(tx);

      await tx.idempotencyRecord.create({
        data: {
          operation: input.operation,
          principal,
          key: input.key,
          payloadHash: hash,
          referenceNumber: created.referenceNumber,
          userId: input.userId || null,
        },
      });

      return created;
    });

    return { inquiry, replayed: false };
  } catch (error: unknown) {
    // Only handle Prisma unique-constraint violations.
    // All other errors must propagate unchanged.
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await prisma.idempotencyRecord.findUnique({
      where: {
        operation_principal_key: {
          operation: input.operation,
          principal,
          key: input.key,
        },
      },
    });

    if (!existing) {
      throw error;
    }

    if (existing.payloadHash !== hash) {
      throw AppError.conflict('This Idempotency-Key was already used with a different request.');
    }

    const inquiry = await input.findByReference(existing.referenceNumber);

    if (!inquiry) {
      throw AppError.internal('The original request could not be recovered.');
    }

    return { inquiry, replayed: true };
  }
}
