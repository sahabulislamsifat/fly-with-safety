import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { AppError } from '../utils/errors.js';
import { identityContext, identityEnabled, departments, requirePermission } from './policy.js';
import { acceptInvitation, assign, changeAccount, customerDirectory, invite, setDepartments } from './management.js';
import { beginEnrollment, confirmEnrollment, verifyFactor } from './mfa.js';
import { passwordSchema } from '../validators/auth.schemas.js';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

const router: Router = Router();
const run = (action: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
  void action(req, res).catch(error => next(error instanceof z.ZodError ? AppError.badRequest('Invalid identity request') : error));
};
const principal = () => { const p = identityContext.getStore(); if (!p) throw AppError.unauthorized(); return p; };
router.use('/identity', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!identityEnabled()) return next(new AppError('Identity rollout is not active', 503, 'IDENTITY_UNAVAILABLE'));
  next();
});
router.use('/identity', rateLimit({ windowMs: 600000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }));
router.post('/identity/invitations/accept', run(async (req, res) => {
  const input = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), password: passwordSchema, name: z.string().trim().min(2).max(100) }).strict().parse(req.body);
  res.json({ success: true, data: await acceptInvitation(input.token, input.password, input.name) });
}));
router.use('/identity', requireAuth);
router.get('/identity/me', run(async (_req, res) => {
  const p = principal(); res.json({ success: true, data: { role: p.role, departments: p.departments, mfaVerified: p.mfaVerified } });
}));
router.post('/identity/mfa/enroll', run(async (req, res) => {
  const { password } = z.object({ password: z.string().min(1).max(128) }).strict().parse(req.body);
  res.json({ success: true, data: await beginEnrollment(principal(), password) });
}));
router.post('/identity/mfa/confirm', run(async (req, res) => {
  const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).strict().parse(req.body);
  res.json({ success: true, data: await confirmEnrollment(principal(), code) });
}));
router.post('/identity/mfa/verify', run(async (req, res) => {
  const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).strict().parse(req.body);
  res.json({ success: true, data: await verifyFactor(principal(), code) });
}));
router.post('/identity/mfa/recover', run(async (req, res) => {
  const { code } = z.object({ code: z.string().regex(/^[a-f0-9]{32}$/) }).strict().parse(req.body);
  res.json({ success: true, data: await verifyFactor(principal(), code, true) });
}));
router.post('/identity/invitations', run(async (req, res) => {
  const input = z.object({ email: z.string().trim().email().max(254).transform(v => v.toLowerCase()), role: z.enum(['ADMIN', 'STAFF']),
    departments: z.array(z.enum(departments)).min(1).max(6).refine(d => new Set(d).size === d.length) }).strict().parse(req.body);
  res.status(201).json({ success: true, data: await invite(principal(), input) });
}));
router.patch('/identity/users/:id', run(async (req, res) => {
  const input = z.object({ role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN']).optional(), suspended: z.boolean().optional(),
    reason: z.enum(['ACCOUNT_SUPPORT', 'ROLE_POLICY', 'INCIDENT_RESPONSE']) }).strict().refine(v => v.role !== undefined || v.suspended !== undefined).parse(req.body);
  res.json({ success: true, data: await changeAccount(principal(), req.params.id, input) });
}));
router.post('/identity/assignments', run(async (req, res) => {
  const input = z.object({ userId: z.string().min(1).max(100), resource: z.enum(['booking', 'flightInquiry', 'hotelInquiry', 'packageInquiry', 'visaInquiry', 'contactMessage']),
    resourceId: z.string().min(1).max(100), department: z.enum(departments), active: z.boolean() }).strict().parse(req.body);
  res.json({ success: true, data: await assign(principal(), input) });
}));
router.get('/identity/customers', run(async (_req, res) => res.json({ success: true, data: await customerDirectory(principal()) })));
router.put('/identity/users/:id/departments', run(async (req, res) => {
  const input = z.object({ departments: z.array(z.enum(departments)).max(6).refine(d => new Set(d).size === d.length) }).strict().parse(req.body);
  res.json({ success: true, data: await setDepartments(principal(), req.params.id, input.departments) });
}));
router.get('/identity/audit', run(async (_req, res) => {
  requirePermission(principal(), 'governance');
  res.json({ success: true, data: await prisma.$queryRaw(Prisma.sql`/*p5:audit-read*/ SELECT id,"actorId",action,"targetId",reason,"createdAt" FROM "IdentityAudit" ORDER BY "createdAt" DESC,id LIMIT 100`) });
}));
export default router;
