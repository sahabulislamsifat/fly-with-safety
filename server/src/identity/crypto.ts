import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from '../utils/errors.js';

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function key() {
  const text = process.env.IDENTITY_MFA_KEY || '';
  const bytes = Buffer.from(text, 'base64');
  if (bytes.length !== 32 || bytes.toString('base64') !== text) throw new AppError('MFA key configuration unavailable', 503, 'MFA_UNAVAILABLE');
  return bytes;
}
export function seal(secret: string, userId: string) {
  const iv = randomBytes(12), k = key();
  try {
    const cipher = createCipheriv('aes-256-gcm', k, iv);
    cipher.setAAD(Buffer.from(`fws:p5:mfa:${userId}`));
    const bytes = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), bytes].map(b => b.toString('base64url')).join('.');
  } finally { k.fill(0); }
}
export function open(value: string, userId: string) {
  const parts = value.split('.').map(v => Buffer.from(v, 'base64url')), k = key();
  try {
    if (parts.length !== 3 || parts[0].length !== 12 || parts[1].length !== 16) throw Error('format');
    const cipher = createDecipheriv('aes-256-gcm', k, parts[0]);
    cipher.setAAD(Buffer.from(`fws:p5:mfa:${userId}`)); cipher.setAuthTag(parts[1]);
    return Buffer.concat([cipher.update(parts[2]), cipher.final()]).toString('utf8');
  } finally { k.fill(0); }
}
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes: Buffer) {
  let bits = 0, value = 0, text = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; text += alphabet[(value >>> bits) & 31]; }
  }
  if (bits) text += alphabet[(value << (5 - bits)) & 31];
  return text;
}
function decode(text: string) {
  if (!/^[A-Z2-7]{16,128}$/.test(text)) throw Error('Invalid MFA secret');
  let bits = 0, value = 0; const bytes: number[] = [];
  for (const char of text) {
    value = (value << 5) | alphabet.indexOf(char); bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 255); }
  }
  return Buffer.from(bytes);
}
/** RFC 4226/6238 HMAC-SHA1, 30 seconds. Database fencing rejects used steps. */
export function totp(secret: string, step: bigint, digits = 6) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(step);
  const digest = createHmac('sha1', decode(secret)).update(counter).digest(), offset = digest[19] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).padStart(digits, '0');
}
export function matchStep(secret: string, code: string, now: Date, lastStep: bigint) {
  if (!/^\d{6}$/.test(code)) return undefined;
  const step = BigInt(Math.floor(+now / 30000));
  for (const candidate of [step, step - 1n, step + 1n]) {
    if (candidate >= 0n && candidate > lastStep && timingSafeEqual(Buffer.from(totp(secret, candidate)), Buffer.from(code))) return candidate;
  }
  return undefined;
}
