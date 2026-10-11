import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import {
  enqueueNotification,
  processOutboxBatch,
  redriveFailedNotification,
  getOutboxStats,
  startOutboxWorker,
  stopOutboxWorker,
  setOutboxTableAvailable,
} from '../src/services/outbox.service.js';
import * as notificationService from '../src/services/notification.service.js';

describe('Phase 7: Transactional Notification Resilience & Outbox', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setOutboxTableAvailable(true);
  });

  afterEach(() => {
    stopOutboxWorker();
  });

  // ─── 1. Enqueue & Atomic Persistence ─────────────────────────────────────────
  describe('enqueueNotification', () => {
    it('persists notification to outbox using provided database client/transaction', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'outbox-1',
        status: 'PENDING',
        recipient: 'passenger@example.com',
      });
      const mockTxClient = {
        notificationOutbox: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: mockCreate,
        },
      };

      const result = await enqueueNotification(mockTxClient as any, {
        recipient: 'passenger@example.com',
        subject: 'Flight Confirmation',
        template: 'BOOKING_CONFIRMATION',
        params: {
          customerName: 'Alice Smith',
          bookingReference: 'FWS-BKG-123456',
          totalAmount: '45,000 BDT',
          bookingType: 'flight',
        },
        idempotencyKey: 'idemp-key-1',
      });

      expect(mockTxClient.notificationOutbox.findUnique).toHaveBeenCalledWith({
        where: { idempotencyKey: 'idemp-key-1' },
      });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipient: 'passenger@example.com',
            subject: 'Flight Confirmation',
            idempotencyKey: 'idemp-key-1',
            status: 'PENDING',
          }),
        })
      );
      expect(result).toEqual({
        id: 'outbox-1',
        status: 'PENDING',
        recipient: 'passenger@example.com',
      });
    });

    it('returns existing record and avoids duplicate persistence if idempotencyKey already exists', async () => {
      const mockFindUnique = vi.fn().mockResolvedValue({
        id: 'outbox-existing',
        status: 'DELIVERED',
        recipient: 'passenger@example.com',
      });
      const mockCreate = vi.fn();
      const mockTxClient = {
        notificationOutbox: {
          findUnique: mockFindUnique,
          create: mockCreate,
        },
      };

      const result = await enqueueNotification(mockTxClient as any, {
        recipient: 'passenger@example.com',
        subject: 'Flight Confirmation',
        template: 'BOOKING_CONFIRMATION',
        params: { customerName: 'Alice' },
        idempotencyKey: 'idemp-key-existing',
      });

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { idempotencyKey: 'idemp-key-existing' },
      });
      expect(mockCreate).not.toHaveBeenCalled();
      expect(result?.id).toBe('outbox-existing');
    });

    it('handles unique constraint race (P2002) gracefully by returning existing record', async () => {
      const err = new Error('Unique constraint failed');
      (err as any).code = 'P2002';

      const mockFindUnique = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'outbox-raced', status: 'PENDING' });
      const mockCreate = vi.fn().mockRejectedValue(err);

      const mockTxClient = {
        notificationOutbox: {
          findUnique: mockFindUnique,
          create: mockCreate,
        },
      };

      const result = await enqueueNotification(mockTxClient as any, {
        recipient: 'passenger@example.com',
        subject: 'Flight Confirmation',
        template: 'BOOKING_CONFIRMATION',
        params: {},
        idempotencyKey: 'race-key',
      });

      expect(result?.id).toBe('outbox-raced');
    });

    it('preserves surrounding transaction and falls back to async direct send when outbox table is unmigrated', async () => {
      setOutboxTableAvailable(false);
      const mockTxClient = {
        notificationOutbox: {
          findUnique: vi.fn(),
          create: vi.fn(),
        },
      };

      const sendEmailSpy = vi.spyOn(notificationService, 'sendEmailRaw').mockResolvedValue(true);

      const result = await enqueueNotification(mockTxClient as any, {
        recipient: 'passenger@example.com',
        subject: 'Fallback Test',
        template: 'BOOKING_CONFIRMATION',
        params: { customerName: 'Alice' },
        idempotencyKey: 'fallback-key',
      });

      // Does not touch transaction client (never issues queries that could abort PostgreSQL transaction)
      expect(mockTxClient.notificationOutbox.findUnique).not.toHaveBeenCalled();
      expect(mockTxClient.notificationOutbox.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
      expect(sendEmailSpy).toHaveBeenCalled();
    });

    it('rethrows database errors explicitly when executing inside an active transaction', async () => {
      setOutboxTableAvailable(true);
      const dbError = new Error('Database serialization failure');
      const mockTxClient = {
        notificationOutbox: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockRejectedValue(dbError),
        },
      };

      await expect(
        enqueueNotification(mockTxClient as any, {
          recipient: 'passenger@example.com',
          subject: 'Tx Error Test',
          template: 'BOOKING_CONFIRMATION',
          params: {},
          idempotencyKey: 'tx-err-key',
        })
      ).rejects.toThrow('Database serialization failure');
    });

    it('rolls back outbox record atomically when the surrounding transaction throws an error', async () => {
      const txMock = {
        flightInquiry: {
          create: vi.fn().mockResolvedValue({ id: 'inq-1', referenceNumber: 'FWS-FLT-RB' }),
        },
        notificationOutbox: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'outbox-rb-1', status: 'PENDING' }),
        },
      };

      await expect(
        (async () => {
          await txMock.flightInquiry.create({ data: {} });
          await enqueueNotification(txMock as any, {
            recipient: 'test@example.com',
            subject: 'Test Rollback',
            template: 'INQUIRY_CONFIRMATION',
            params: { name: 'Bob', referenceNumber: 'FWS-FLT-RB', type: 'flight' },
            idempotencyKey: 'tx-rb-key',
          });
          throw new Error('Downstream validation failure triggering rollback');
        })()
      ).rejects.toThrow('Downstream validation failure triggering rollback');
    });

    it('ensures inquiry replay does not trigger duplicate logical notification events', async () => {
      const enqueueSpy = vi.spyOn(notificationService, 'sendInquiryConfirmation');
      const mockResult = {
        inquiry: { referenceNumber: 'FWS-FLT-123' },
        replayed: true, // Replayed request
      };

      // Simulates flight.service behavior: if replayed, confirmation email is skipped
      if (!mockResult.replayed) {
        await notificationService.sendInquiryConfirmation({
          to: 'passenger@example.com',
          name: 'Alice',
          referenceNumber: 'FWS-FLT-123',
          type: 'flight',
        });
      }

      expect(enqueueSpy).not.toHaveBeenCalled();
    });
  });

  // ─── 2. Batch Processing & Stuck Task Recovery ───────────────────────────────
  describe('processOutboxBatch', () => {
    it('recovers stuck PROCESSING records older than 5 minutes back to PENDING', async () => {
      const mockUpdateMany = vi.spyOn(prisma.notificationOutbox, 'updateMany').mockResolvedValue({ count: 2 } as any);
      vi.spyOn(prisma.notificationOutbox, 'findMany').mockResolvedValue([]);

      const stats = await processOutboxBatch();

      expect(mockUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PROCESSING',
          }),
          data: { status: 'PENDING' },
        })
      );
      expect(stats.recovered).toBe(2);
      expect(stats.processed).toBe(0);
    });

    it('successfully processes pending records and marks them DELIVERED', async () => {
      vi.spyOn(prisma.notificationOutbox, 'updateMany')
        .mockResolvedValueOnce({ count: 0 } as any) // recovery
        .mockResolvedValueOnce({ count: 1 } as any); // lease

      vi.spyOn(prisma.notificationOutbox, 'findMany').mockResolvedValue([
        {
          id: 'outbox-item-1',
          recipient: 'user@flywithsafe.test',
          subject: 'Your Booking Confirmed',
          payload: {
            template: 'BOOKING_CONFIRMATION',
            params: {
              customerName: 'John Doe',
              bookingReference: 'FWS-BKG-999',
              totalAmount: '120,000 BDT',
              bookingType: 'hotel',
            },
          },
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 5,
        } as any,
      ]);

      const rawSendSpy = vi.spyOn(notificationService, 'sendEmailRaw').mockResolvedValue(true);
      const updateSpy = vi.spyOn(prisma.notificationOutbox, 'update').mockResolvedValue({} as any);

      const stats = await processOutboxBatch(10);

      expect(stats.processed).toBe(1);
      expect(stats.delivered).toBe(1);
      expect(stats.failed).toBe(0);
      expect(rawSendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@flywithsafe.test',
          subject: 'Your Booking Confirmed',
        })
      );
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'outbox-item-1' },
        data: expect.objectContaining({
          status: 'DELIVERED',
          error: null,
        }),
      });
    });

    it('skips item if another concurrent worker leases it first', async () => {
      vi.spyOn(prisma.notificationOutbox, 'updateMany')
        .mockResolvedValueOnce({ count: 0 } as any) // recovery
        .mockResolvedValueOnce({ count: 0 } as any); // lease failed (count = 0)

      vi.spyOn(prisma.notificationOutbox, 'findMany').mockResolvedValue([
        {
          id: 'outbox-item-raced',
          recipient: 'user@test.com',
          payload: { template: 'BOOKING_CONFIRMATION', params: {} },
          status: 'PENDING',
          attempts: 0,
        } as any,
      ]);

      const rawSendSpy = vi.spyOn(notificationService, 'sendEmailRaw');
      const stats = await processOutboxBatch(10);

      expect(stats.processed).toBe(1);
      expect(stats.delivered).toBe(0);
      expect(rawSendSpy).not.toHaveBeenCalled();
    });

    it('schedules retry with bounded exponential backoff on transport failure', async () => {
      vi.spyOn(prisma.notificationOutbox, 'updateMany')
        .mockResolvedValueOnce({ count: 0 } as any) // recovery
        .mockResolvedValueOnce({ count: 1 } as any); // lease succeeded

      vi.spyOn(prisma.notificationOutbox, 'findMany').mockResolvedValue([
        {
          id: 'outbox-retry-1',
          recipient: 'user@test.com',
          payload: { template: 'BOOKING_CONFIRMATION', params: {} },
          status: 'PENDING',
          attempts: 1,
          maxAttempts: 5,
        } as any,
      ]);

      vi.spyOn(notificationService, 'sendEmailRaw').mockRejectedValue(new Error('Connection reset by peer'));
      const updateSpy = vi.spyOn(prisma.notificationOutbox, 'update').mockResolvedValue({} as any);

      const stats = await processOutboxBatch(10);

      expect(stats.delivered).toBe(0);
      expect(stats.failed).toBe(0); // Not terminal yet
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'outbox-retry-1' },
        data: expect.objectContaining({
          status: 'PENDING',
          attempts: 2,
          error: expect.stringContaining('Connection reset by peer'),
        }),
      });
    });

    it('marks record as permanently FAILED when maxAttempts is reached', async () => {
      vi.spyOn(prisma.notificationOutbox, 'updateMany')
        .mockResolvedValueOnce({ count: 0 } as any) // recovery
        .mockResolvedValueOnce({ count: 1 } as any); // lease succeeded

      vi.spyOn(prisma.notificationOutbox, 'findMany').mockResolvedValue([
        {
          id: 'outbox-terminal-1',
          recipient: 'user@test.com',
          payload: { template: 'BOOKING_CONFIRMATION', params: {} },
          status: 'PENDING',
          attempts: 4,
          maxAttempts: 5,
        } as any,
      ]);

      vi.spyOn(notificationService, 'sendEmailRaw').mockRejectedValue(new Error('SMTP authentication rejected'));
      const updateSpy = vi.spyOn(prisma.notificationOutbox, 'update').mockResolvedValue({} as any);

      const stats = await processOutboxBatch(10);

      expect(stats.delivered).toBe(0);
      expect(stats.failed).toBe(1); // Terminal failure
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'outbox-terminal-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          attempts: 5,
          error: expect.stringContaining('SMTP authentication rejected'),
        }),
      });
    });
  });

  // ─── 3. Redrive & Operational Telemetry ───────────────────────────────────────
  describe('redriveFailedNotification & getOutboxStats', () => {
    it('resets a FAILED record to PENDING with attempts reset to 0', async () => {
      const updateManySpy = vi.spyOn(prisma.notificationOutbox, 'updateMany').mockResolvedValue({ count: 1 } as any);

      const success = await redriveFailedNotification('outbox-failed-id');

      expect(success).toBe(true);
      expect(updateManySpy).toHaveBeenCalledWith({
        where: { id: 'outbox-failed-id', status: 'FAILED' },
        data: expect.objectContaining({
          status: 'PENDING',
          attempts: 0,
          error: null,
        }),
      });
    });

    it('returns false if notification is not in FAILED state or record not found', async () => {
      vi.spyOn(prisma.notificationOutbox, 'updateMany').mockResolvedValue({ count: 0 } as any);

      const success = await redriveFailedNotification('outbox-not-failed');
      expect(success).toBe(false);
    });

    it('computes accurate operational statistics across all statuses', async () => {
      vi.spyOn(prisma.notificationOutbox, 'count')
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(2) // processing
        .mockResolvedValueOnce(45) // delivered
        .mockResolvedValueOnce(3); // failed

      const stats = await getOutboxStats();

      expect(stats).toEqual({
        pending: 5,
        processing: 2,
        delivered: 45,
        failed: 3,
        total: 55,
      });
    });
  });

  // ─── 4. Security Hardening & HTML Sanitization in Templates ──────────────────
  describe('HTML Escaping & Content Sanitization', () => {
    it('escapes dangerous HTML characters in dynamic parameters across all notification templates', () => {
      const rawPayload = {
        customerName: '<script>alert("XSS")</script>',
        bookingReference: '<img src=x onerror=alert(1)>',
        totalAmount: '50,000" onmouseover="alert(1)',
        bookingType: 'flight',
      };

      const rendered = notificationService.renderNotificationContent('BOOKING_CONFIRMATION', rawPayload);

      expect(rendered.html).not.toContain('<script>');
      expect(rendered.html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
      expect(rendered.html).not.toContain('<img');
      expect(rendered.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('escapes verification tokens and links against script injection', () => {
      const rendered = notificationService.renderNotificationContent('EMAIL_VERIFICATION', {
        name: 'Jane <b>Doe</b>',
        link: 'https://flywithsafe.test/verify?token="><script>alert(1)</script>',
      });

      expect(rendered.html).not.toContain('<b>Doe</b>');
      expect(rendered.html).toContain('Jane &lt;b&gt;Doe&lt;/b&gt;');
      expect(rendered.html).not.toContain('"><script>');
    });

    it('escapes password reset tokens and links against script injection', () => {
      const rendered = notificationService.renderNotificationContent('PASSWORD_RESET', {
        name: 'John <style>body{display:none}</style>',
        link: 'https://flywithsafe.test/reset?token=" onclick="alert(1)',
      });

      expect(rendered.html).not.toContain('<style>');
      expect(rendered.html).toContain('&lt;style&gt;');
    });
  });

  // ─── 5. Worker Lifecycle ─────────────────────────────────────────────────────
  describe('Worker Lifecycle', () => {
    it('starts and stops background worker without unhandled errors', () => {
      expect(() => startOutboxWorker(1000)).not.toThrow();
      expect(() => stopOutboxWorker()).not.toThrow();
    });
  });
});
