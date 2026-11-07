import type { RequestHandler } from 'express';
import { AppError } from '../utils/errors.js';
import { identityContext, identityEnabled, requirePermission, resourceDepartment, type Permission, type Resource } from './policy.js';

export const adminPolicy: RequestHandler = (req, _res, next) => {
  if (!identityEnabled()) return next();
  try {
    const p = identityContext.getStore();
    if (!p) throw AppError.unauthorized();
    const path = req.originalUrl.split('?')[0].replace(/^\/api\/v1\/admin/, '');
    let permission: Permission;
    if (/^\/bookings(?:\/|$)/.test(path)) permission = 'booking.write';
    else if (/^\/inquiries\/(flights|hotels|packages|visa)(?:\/[^/]+\/status)?$/.test(path)) permission = 'inquiry';
    else if (/^\/contact(?:\/[^/]+(?:\/status)?)?$/.test(path)) permission = 'inquiry';
    else if (/^\/(testimonials|destinations|packages|visa)(?:\/|$)/.test(path)) permission = 'content';
    else if (/^\/outbox(?:\/|$)/.test(path)) permission = 'outbox';
    else throw AppError.forbidden('Operation is not authorized');
    requirePermission(p, permission);
    if (p.role === 'STAFF') {
      if (path === '/bookings/from-inquiry') throw AppError.forbidden('Booking conversion requires operations approval');
      const resource: Resource | undefined = path.startsWith('/contact') ? 'contactMessage' :
        path.startsWith('/inquiries/flights') ? 'flightInquiry' : path.startsWith('/inquiries/hotels') ? 'hotelInquiry' :
          path.startsWith('/inquiries/packages') ? 'packageInquiry' : path.startsWith('/inquiries/visa') ? 'visaInquiry' : undefined;
      if (resource && !p.departments.includes(resourceDepartment[resource]!)) throw AppError.forbidden('Department denied');
      if (req.body?.action === 'RECORD_PAYMENT') throw AppError.forbidden('Financial recording requires operations approval');
    }
    next();
  } catch (error) { next(error); }
};

export const paymentPolicy: RequestHandler = (req, _res, next) => {
  if (!identityEnabled()) return next();
  try {
    const p = identityContext.getStore();
    if (!p) throw AppError.unauthorized();
    if (p.role !== 'CUSTOMER') {
      requirePermission(p, 'booking.read');
      if (p.role === 'STAFF' && /\/(operations|reconciliation|reconcile|refunds)(?:\/|$)/.test(req.path)) throw AppError.forbidden('Financial operation denied');
    }
    next();
  } catch (error) { next(error); }
};
