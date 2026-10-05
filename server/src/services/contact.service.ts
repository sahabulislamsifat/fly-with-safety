import { prisma } from '../lib/prisma.js';
import { generateReferenceNumber, normalizeEmail, normalizePhone } from '../utils/helpers.js';
import type { ContactInput } from '../validators/contact.schemas.js';
import { sendContactConfirmation } from './notification.service.js';
import { assertContactTransition } from '../utils/status-transitions.js';
import { AppError } from '../utils/errors.js';
import { logger, serializeError } from '../lib/logger.js';

export async function submitContact(input: ContactInput) {
  const referenceNumber = generateReferenceNumber();

  const message = await prisma.contactMessage.create({
    data: {
      referenceNumber,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: normalizeEmail(input.email),
      phone: input.phone ? normalizePhone(input.phone) : null,
      subject: input.subject.trim(),
      serviceType: input.serviceType ?? null,
      message: input.message.trim(),
      status: 'NEW',
    },
    select: {
      id: true,
      referenceNumber: true,
      firstName: true,
      email: true,
      createdAt: true,
    },
  });

  // Email only after the record is safely persisted; failure never fails the request.
  sendContactConfirmation({
    to: message.email,
    firstName: message.firstName,
    referenceNumber: message.referenceNumber,
  }).catch((err) => logger.warn('contact_email_failed', serializeError(err)));

  return message;
}

export async function getContactMessages(params: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where = params.status ? { status: params.status as any } : {};

  const [total, messages] = await Promise.all([
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        referenceNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        subject: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    messages,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getContactMessageById(id: string) {
  return prisma.contactMessage.findUnique({
    where: { id },
  });
}

export async function updateContactStatus(id: string, status: string) {
  const current = await prisma.contactMessage.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!current) throw AppError.notFound('Message not found');

  assertContactTransition(current.status, status);

  return prisma.contactMessage.update({
    where: { id },
    data: { status: status as 'NEW' | 'IN_PROGRESS' | 'RESOLVED' },
  });
}
