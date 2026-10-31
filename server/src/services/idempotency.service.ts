import { createHash } from 'crypto';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { inquiryDigest, matchesInquiryDigest, type LogicalDigestPolicy } from '../security/idempotency-digest.js';

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
  // Opt-in from trusted server composition only; existing callers retain historical SHA-256.
  digestPolicy?: LogicalDigestPolicy;
  create: (tx: Transaction) => Promise<T>;
  findByReference: (referenceNumber: string) => Promise<T | null>;
}): Promise<{ inquiry: T; replayed: boolean }> {
  const principal = idempotencyPrincipal(input.userId, input.email);
  const scope = { operation: input.operation, principal };
  let hash: string;
  try { hash = inquiryDigest(input.payload,scope,input.digestPolicy); }
  catch { throw AppError.internal(); }

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

    let matches: boolean;
    try { matches = matchesInquiryDigest(existing.payloadHash,input.payload,scope,input.digestPolicy); }
    catch { throw AppError.internal(); }
    if (!matches) {
      throw AppError.conflict('This Idempotency-Key was already used with a different request.');
    }

    const inquiry = await input.findByReference(existing.referenceNumber);

    if (!inquiry) {
      throw AppError.internal('The original request could not be recovered.');
    }

    return { inquiry, replayed: true };
  }
}
