import type { EncryptionContext, SyntheticGrant, SyntheticPassengerDocumentV1 } from './contracts.js';
import { installOfflineGuards } from './vitest.config.js';

// This is also the standalone config's safety setup: no tested runtime module imports.
installOfflineGuards();

export const context: EncryptionContext = Object.freeze({ environmentId: 'synthetic-offline', bookingId: 'synthetic-booking-1', passengerId: 'synthetic-passenger-1' });
export const document: SyntheticPassengerDocumentV1 = Object.freeze({ passportNumber: 'SYNTHETIC-NOT-A-PASSPORT-9912', passportExpiry: '2032-02-29', dateOfBirth: '2000-02-29' });
export const nowMs = Date.UTC(2030, 0, 1);
export const grant: SyntheticGrant = Object.freeze({ actorId: 'synthetic-operator', role: 'FULFILLMENT',
  ...context, purpose: 'synthetic-fulfillment', expiresAtMs: nowMs + 60_000, stepUpVerified: true });

export const sensitiveSentinels = Object.freeze([document.passportNumber!, document.dateOfBirth!, document.passportExpiry!, 'SYNTHETIC-KEY-SENTINEL', 'SYNTHETIC-TOKEN-SENTINEL']);
