import { randomBytes } from 'crypto';

/**
 * Generates a unique FlyWithSafe reference number.
 * Format: FWS-YYYY-XXXXXX (6 random alphanumeric chars)
 */
export function generateReferenceNumber(): string {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars: 0O1I
  let suffix = '';
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  return `FWS-${year}-${suffix}`;
}

/**
 * Normalizes an email address.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalizes a phone number by stripping extra spaces.
 */
export function normalizePhone(phone: string): string {
  return phone.trim().replace(/\s+/g, '');
}

/**
 * Slugifies a string.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
