import { expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
const db = vi.hoisted(() => ({ $transaction: vi.fn(), booking: { findUnique: vi.fn() } }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: db }));
vi.mock('../src/services/notification.service.js', () => ({ sendBookingConfirmation: vi.fn(), sendBookingStatusNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../src/config/env.js', () => ({ env: { nodeEnv: 'test' } }));
vi.mock('pg', () => { throw new Error('OFFLINE_DB_FORBIDDEN'); });
vi.mock('dotenv', () => { throw new Error('OFFLINE_ENV_FORBIDDEN'); });
import { adminUpdateBookingStatus } from '../src/controllers/booking.controller.js';
import { finalInvariantRecord, statusActorTag } from './phase2-final-invariant-diagnostics.js';

it.each(['STAFF', 'ADMIN'] as const)('real controller → service attributes %s status events to authenticated email, not a client actor or UUID assumption', async role => {
  const staff = { id: 'synthetic-actor-id', email: 'synthetic-staff@example.invalid', role, name: null };
  const before = { id: 'synthetic-booking', status: 'PENDING', customerName: 'Synthetic', customerEmail: 'synthetic-owner@example.invalid', referenceNumber: 'FWS-SYNTHETIC', bookingDetails: {}, passengers: [], statusHistory: [] };
  const after = { ...before, status: 'CONFIRMED' }, history = vi.fn().mockResolvedValue({});
  db.$transaction.mockImplementation(callback => callback({ $queryRaw: vi.fn().mockResolvedValue([]), booking: {
    findUnique: vi.fn().mockResolvedValue(before), update: vi.fn().mockResolvedValue(after),
  }, bookingStatusHistory: { create: history } }));
  db.booking.findUnique.mockResolvedValue(after);
  const req = { user: staff, params: { id: before.id }, body: { status: 'CONFIRMED', expectedStatus: 'PENDING', reason: 'Synthetic audit', changedBy: 'FORGED-CLIENT-ACTOR' } };
  const res = { set: vi.fn().mockReturnThis(), json: vi.fn() }, next = vi.fn();
  await adminUpdateBookingStatus(req as unknown as Request, res as unknown as Response, next as NextFunction);
  expect(next).not.toHaveBeenCalled(); expect(res.json).toHaveBeenCalledTimes(1);
  expect(history).toHaveBeenCalledExactlyOnceWith({ data: { bookingId: before.id, fromStatus: 'PENDING', toStatus: 'CONFIRMED', reason: 'Synthetic audit', changedBy: staff.email } });
  expect(history.mock.calls[0][0].data.changedBy).not.toBe(staff.id);
  expect(history.mock.calls[0][0].data.changedBy).not.toBe(req.body.changedBy);
});
it('records the precise named actor mismatch without forwarding raw staff identifiers', () => {
  expect(finalInvariantRecord('statusActors', 'STAFF_EMAIL', 'STAFF_ID')).toEqual({ kind: 'final-invariant', invariant: 'statusActors', expected: 'STAFF_EMAIL', observed: 'STAFF_ID', matched: false });
});
it.each(['synthetic-secret', { password: 'synthetic-secret', toJSON: () => { throw new Error('unsafe'); } }, NaN, Infinity])('never serializes arbitrary final-invariant values %#', observed => {
  expect(JSON.stringify(finalInvariantRecord('historyCount', 4, observed))).not.toContain('secret');
  expect(finalInvariantRecord('historyCount', 4, observed).matched).toBe(false);
});
it('records finite numeric expected/observed values exactly for failed count/price invariants', () => {
  expect(finalInvariantRecord('notifications', 3, 2)).toMatchObject({ expected: 3, observed: 2, matched: false });
  expect(finalInvariantRecord('totalPrice', 12000, 12000).matched).toBe(true);
});
it('requires exact authenticated email attribution and refuses missing/mixed actors', () => {
  const staff = { id: 'synthetic-id', email: 'synthetic@example.invalid' };
  expect(statusActorTag([staff.email, staff.email], staff)).toBe('STAFF_EMAIL');
  expect(statusActorTag([staff.id, staff.id], staff)).toBe('STAFF_ID');
  expect(statusActorTag([staff.email, 'synthetic-secret'], staff)).toBe('OTHER');
  expect(statusActorTag([], staff)).toBe('MISSING');
});
