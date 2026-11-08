import { AsyncLocalStorage } from 'node:async_hooks';
import { AppError } from '../utils/errors.js';

export const roles = ['CUSTOMER', 'STAFF', 'ADMIN', 'SUPER_ADMIN'] as const;
export type Role = typeof roles[number];
export const departments = ['FLIGHT', 'HOTEL', 'VISA', 'PACKAGES', 'FINANCE', 'SUPPORT'] as const;
export type Department = typeof departments[number];
export type Principal = { id: string; email: string; name: string | null; role: Role;
  sessionId: string; version: number; mfaVersion: number; mfaVerified: boolean; departments: Department[] };
export type Resource = 'booking' | 'flightInquiry' | 'hotelInquiry' | 'packageInquiry' | 'visaInquiry' | 'contactMessage';
export type Permission = 'governance' | 'customers' | 'assign' | 'booking.read' | 'booking.write' | 'inquiry' | 'content' | 'outbox' | 'finance';
export const identityContext = new AsyncLocalStorage<Principal>();
export const identityEnabled = () => process.env.IDENTITY_SCOPE_ENABLED === 'true';
export const privileged = (role: Role) => role !== 'CUSTOMER';
export function requirePermission(p: Principal, permission: Permission) {
  if (privileged(p.role) && !p.mfaVerified) throw new AppError('Complete privileged MFA first', 403, 'MFA_REQUIRED');
  if (p.role === 'SUPER_ADMIN') return;
  if (p.role === 'ADMIN' && permission !== 'governance') return;
  if (p.role === 'STAFF' && ['booking.read', 'booking.write', 'inquiry'].includes(permission) && p.departments.length) return;
  throw AppError.forbidden('Permission denied');
}
export const resourceDepartment: Partial<Record<Resource, Department>> = {
  flightInquiry: 'FLIGHT', hotelInquiry: 'HOTEL', packageInquiry: 'PACKAGES', visaInquiry: 'VISA', contactMessage: 'SUPPORT',
};
export function scopedPrincipal() {
  if (!identityEnabled()) return undefined;
  const p = identityContext.getStore();
  if (!p) throw AppError.unauthorized();
  return p;
}
