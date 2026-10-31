import { bookingDetailsInputSchema } from '../validators/booking.schemas.js';
import { commercialSchema } from '../services/booking-commercial.service.js';

type Row = Record<string, any>;
const pick = (row: Row, keys: string[]) => Object.fromEntries(keys.filter(key => row[key] !== undefined).map(key => [key, row[key]]));

/** Never spread stored JSON: historical documents must obey today's response boundary too. */
export function bookingDetailsDTO(value: unknown, admin = false) {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
  const details: Row = {};
  for (const [key, schema] of Object.entries(bookingDetailsInputSchema.shape)) {
    const parsed = schema.safeParse(row[key]);
    if (parsed.success && parsed.data !== undefined) details[key] = parsed.data;
  }
  const paymentStates = ['AWAITING_PAYMENT_INSTRUCTIONS', 'AWAITING_PAYMENT_CONFIRMATION', 'PAYMENT_VERIFIED', 'CANCELLED'];
  if (paymentStates.includes(row.paymentStatus)) details.paymentStatus = row.paymentStatus;
  // Free-form legacy policies can contain unrelated traveler data. Return a fixed public policy.
  details.paymentPolicy = 'Manual agency booking. No immediate card charge. Payment instructions are provided by the operations team.';
  // No public support contact has been verified; never invent one or expose legacy JSON contact fields.
  if (admin) {
    for (const key of ['sourceInquiryId', 'sourceInquiryReference', 'sourceInquiryType']) {
      if (typeof row[key] === 'string' && row[key].length <= 128) details[key] = row[key];
    }
  }
  return details;
}

/** ADMIN and STAFF share the same minimized operations view; neither gets raw documents. */
export function bookingDTO(booking: Row, audience: 'admin' | 'customer' | 'guest') {
  const admin = audience === 'admin';
  const result: Row = pick(booking, ['id', 'referenceNumber', 'bookingType', 'bookingModel', 'status', 'totalPrice', 'currency', 'createdAt', 'updatedAt']);
  if (audience !== 'guest') Object.assign(result, pick(booking, ['customerName', 'customerEmail', 'customerPhone']));
  else Object.assign(result, { customerName: 'Booking customer', customerEmail: '••••' });
  if (admin) Object.assign(result, pick(booking, ['notes']));
  result.bookingDetails = bookingDetailsDTO(booking.bookingDetails, admin);
  if (audience !== 'guest') {
    const parsed = commercialSchema.safeParse(booking.bookingDetails?.commercial);
    if (parsed.success) result.commercial = { version: parsed.data.version, revision: parsed.data.revision,
      quotes: parsed.data.quotes, payments: parsed.data.payments };
  }
  if (Array.isArray(booking.passengers)) result.passengers = booking.passengers.map((p: Row) => {
    const passenger = pick(p, ['id', 'firstName', 'lastName', 'passengerType', 'nationality']);
    if (admin && typeof p.passportNumber === 'string' && p.passportNumber.length) {
      passenger.passportNumberMasked = p.passportNumber.length > 4 ? `••••${p.passportNumber.slice(-4)}` : '••••';
    }
    return passenger;
  });
  if (Array.isArray(booking.statusHistory)) result.statusHistory = booking.statusHistory.map((h: Row) =>
    pick(h, admin ? ['id', 'fromStatus', 'toStatus', 'reason', 'changedBy', 'createdAt'] : ['id', 'fromStatus', 'toStatus', 'createdAt']));
  return result;
}
