import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { enqueueNotification } from './outbox.service.js';
import { logger, serializeError } from '../lib/logger.js';

export type EmailSendResult =
  | { status: 'submitted' }
  | { status: 'suppressed'; reason: 'EMAIL_DELIVERY_DISABLED' };

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export type NotificationTemplateType =
  | 'INQUIRY_CONFIRMATION'
  | 'BOOKING_CONFIRMATION'
  | 'BOOKING_STATUS'
  | 'CONTACT_CONFIRMATION'
  | 'EMAIL_VERIFICATION'
  | 'PASSWORD_RESET';

export function escapeHtml(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] || character);
}

export function createTransporter() {
  if (!env.emailDeliveryEnabled || !env.smtpUser || !env.smtpPassword || (!env.smtpService && !env.smtpHost)) {
    return null;
  }
  return nodemailer.createTransport({
    service: env.smtpService || undefined,
    host: env.smtpService ? undefined : env.smtpHost,
    port: env.smtpService ? undefined : env.smtpPort,
    secure: env.smtpSecure,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPassword,
    },
  });
}

/**
 * Underlying transport sender. Throws on error so caller (e.g. outbox processor)
 * can record retry or failure accurately.
 */
export async function sendEmailRaw(options: EmailOptions): Promise<EmailSendResult> {
  const transporter = createTransporter();
  if (!transporter) {
    if (!env.emailDeliveryEnabled) {
      // Suppression is explicit and must never be interpreted as transport submission.
      logger.info('email_delivery_suppressed', { reason: 'EMAIL_DELIVERY_DISABLED' });
      return { status: 'suppressed', reason: 'EMAIL_DELIVERY_DISABLED' };
    }
    throw new Error('SMTP transport not configured');
  }

  const fromAddress = env.smtpEmailFrom && env.smtpEmailFrom.includes('@')
    ? env.smtpEmailFrom
    : env.smtpUser;

  const from = `"${env.smtpEmailFromName}" <${fromAddress}>`;

  const result = await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
  if (!Array.isArray(result.accepted) || result.accepted.length === 0) {
    throw new Error('SMTP transport did not accept any recipients');
  }
  return { status: 'submitted' };
}

/**
 * Safe email send that catches errors without crashing.
 */
async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    await sendEmailRaw(options);
  } catch (err) {
    logger.error('email_send_failed', serializeError(err));
  }
}

/**
 * Pure template renderer with complete HTML escaping across all parameters.
 */
export function renderNotificationContent(
  template: NotificationTemplateType,
  params: Record<string, any>
): { subject: string; html: string; text?: string } {
  switch (template) {
    case 'CONTACT_CONFIRMATION': {
      const firstName = escapeHtml(params.firstName);
      const ref = escapeHtml(params.referenceNumber);
      return {
        subject: `We received your message — ${ref}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e3a8a;">Thank you, ${firstName}!</h2>
            <p>We have received your message. Our team will get back to you within 24 hours.</p>
            <p><strong>Reference Number:</strong> ${ref}</p>
            <p>Please keep this reference number for your records.</p>
            <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #64748b; font-size: 14px;">FlyWithsafety — Travel Made Reassuring</p>
          </div>
        `,
      };
    }

    case 'INQUIRY_CONFIRMATION': {
      const name = escapeHtml(params.name);
      const ref = escapeHtml(params.referenceNumber);
      const typeLabelMap: Record<string, string> = {
        flight: 'Flight',
        hotel: 'Hotel',
        package: 'Package',
        visa: 'Visa',
      };
      const typeLabel = typeLabelMap[params.type] || 'Travel';
      return {
        subject: `Your ${typeLabel} inquiry received — ${ref}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e3a8a;">Thank you, ${name}!</h2>
            <p>We have received your <strong>${escapeHtml(typeLabel)} Inquiry</strong> and our travel specialists will review it shortly.</p>
            <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0;"><strong>Reference Number:</strong></p>
              <p style="font-size: 24px; font-weight: bold; color: #1e3a8a; margin: 8px 0;">${ref}</p>
            </div>
            <p>What happens next:</p>
            <ol>
              <li>Our team will review your inquiry (usually within 2-4 hours during business hours)</li>
              <li>We'll contact you at this email address with options and pricing</li>
              <li>You confirm and we finalize your booking</li>
            </ol>
            <p><strong>Important:</strong> This is an inquiry confirmation only. Your booking is not yet confirmed until you receive a separate booking confirmation.</p>
            <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #64748b; font-size: 14px;">FlyWithsafety — Travel Made Reassuring</p>
          </div>
        `,
      };
    }

    case 'BOOKING_CONFIRMATION': {
      const name = escapeHtml(params.name || params.customerName || '');
      const ref = escapeHtml(params.referenceNumber || params.bookingReference || '');
      const bookingType = escapeHtml(params.bookingType || 'Travel');
      const currency = escapeHtml(params.currency || 'BDT');
      const totalPrice = Number(params.totalPrice || 0).toLocaleString();
      return {
        subject: `Your Booking Request — ${ref}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #1e3a8a;">Booking Request Received</h2>
            <p>Dear ${name},</p>
            <p>Thank you for booking with FlyWithsafety. Your ${bookingType.toLowerCase()} booking request has been registered under reference:</p>
            <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #ea580c;">
              <p style="margin: 0; font-size: 14px; color: #64748b;">REFERENCE NUMBER</p>
              <p style="font-size: 24px; font-weight: bold; color: #1e3a8a; margin: 4px 0;">${ref}</p>
              <p style="margin: 8px 0 0 0; font-size: 14px;">Total Amount: <strong>${currency} ${totalPrice}</strong></p>
              <p style="margin: 4px 0 0 0; font-size: 14px;">Status: <span style="background: #fed7aa; color: #9a3412; padding: 2px 8px; border-radius: 4px; font-weight: 600;">PENDING</span></p>
            </div>
            <p>Our dedicated travel desk is processing your reservation. You can check the current status anytime using your reference number and email address on our website.</p>
            <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #64748b; font-size: 14px;">FlyWithsafety — Travel Made Reassuring</p>
          </div>
        `,
      };
    }

    case 'BOOKING_STATUS': {
      const name = escapeHtml(params.name || params.customerName || '');
      const ref = escapeHtml(params.referenceNumber || params.bookingReference || '');
      const status = escapeHtml(params.status || '');
      const reason = params.reason ? escapeHtml(params.reason) : '';
      return {
        subject: `Booking Status Update: ${status} — ${ref}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #1e3a8a;">Booking Status Update</h2>
            <p>Dear ${name},</p>
            <p>Your booking <strong>${ref}</strong> status has been updated to:</p>
            <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="font-size: 20px; font-weight: bold; color: #1e3a8a; margin: 0;">${status}</p>
              ${reason ? `<p style="margin: 8px 0 0 0; font-size: 14px; color: #64748b;">Note: ${reason}</p>` : ''}
            </div>
            <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #64748b; font-size: 14px;">FlyWithsafety — Travel Made Reassuring</p>
          </div>
        `,
      };
    }

    case 'EMAIL_VERIFICATION': {
      const name = escapeHtml(params.name || '');
      const verificationUrl = escapeHtml(params.verificationUrl || params.link || '');
      return {
        subject: 'Verify your FlyWithsafety email address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e3a8a;">Welcome to FlyWithsafety${name ? `, ${name}` : ''}!</h2>
            <p>Please verify your email address to complete your registration.</p>
            <a href="${verificationUrl}"
               style="display: inline-block; background: #ea580c; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
              Verify Email Address
            </a>
            <p style="color: #64748b; font-size: 14px;">This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>
            <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #64748b; font-size: 14px;">FlyWithsafety — Travel Made Reassuring</p>
          </div>
        `,
      };
    }

    case 'PASSWORD_RESET': {
      const name = escapeHtml(params.name || '');
      const resetUrl = escapeHtml(params.resetUrl || params.link || '');
      return {
        subject: 'Reset your FlyWithSafety password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #8B1D24;">Reset your password${name ? `, ${name}` : ''}</h2>
            <p>Use the link below to choose a new password. It expires in one hour.</p>
            <a href="${resetUrl}"
               style="display: inline-block; background: #8B1D24; color: white; padding: 12px 24px; border-radius: 2px; text-decoration: none; font-weight: bold; margin: 16px 0;">
              Reset Password
            </a>
            <p style="color: #64748b; font-size: 14px;">If you did not request a password reset, you can safely ignore this email.</p>
          </div>
        `,
      };
    }
  }
}

// ─── Exported public methods (now backed by Transactional Outbox) ─────────────

export async function sendContactConfirmation(params: {
  to: string;
  firstName: string;
  referenceNumber: string;
  dbClient?: any;
}): Promise<void> {
  const content = renderNotificationContent('CONTACT_CONFIRMATION', params);
  await enqueueNotification(params.dbClient, {
    recipient: params.to,
    subject: content.subject,
    template: 'CONTACT_CONFIRMATION',
    params,
    idempotencyKey: `contact-${params.referenceNumber}`,
  });
}

export async function sendInquiryConfirmation(params: {
  to: string;
  name: string;
  referenceNumber: string;
  type: 'flight' | 'hotel' | 'package' | 'visa';
  dbClient?: any;
}): Promise<void> {
  const content = renderNotificationContent('INQUIRY_CONFIRMATION', params);
  await enqueueNotification(params.dbClient, {
    recipient: params.to,
    subject: content.subject,
    template: 'INQUIRY_CONFIRMATION',
    params,
    idempotencyKey: `inq-${params.referenceNumber}`,
  });
}

export async function sendEmailVerification(params: {
  to: string;
  name: string;
  verificationUrl: string;
  dbClient?: any;
}): Promise<void> {
  const content = renderNotificationContent('EMAIL_VERIFICATION', params);
  await enqueueNotification(params.dbClient, {
    recipient: params.to,
    subject: content.subject,
    template: 'EMAIL_VERIFICATION',
    params,
  });
}

export async function sendPasswordReset(params: {
  to: string;
  name: string;
  resetUrl: string;
  dbClient?: any;
}): Promise<void> {
  const content = renderNotificationContent('PASSWORD_RESET', params);
  await enqueueNotification(params.dbClient, {
    recipient: params.to,
    subject: content.subject,
    template: 'PASSWORD_RESET',
    params,
  });
}

export async function sendBookingConfirmation(params: {
  to: string;
  name: string;
  referenceNumber: string;
  bookingType: string;
  totalPrice: number;
  currency: string;
  dbClient?: any;
}): Promise<void> {
  const content = renderNotificationContent('BOOKING_CONFIRMATION', params);
  await enqueueNotification(params.dbClient, {
    recipient: params.to,
    subject: content.subject,
    template: 'BOOKING_CONFIRMATION',
    params,
    idempotencyKey: `book-${params.referenceNumber}-create`,
  });
}

export async function sendBookingStatusNotification(params: {
  to: string;
  name: string;
  referenceNumber: string;
  status: string;
  reason?: string;
  dbClient?: any;
}): Promise<void> {
  const content = renderNotificationContent('BOOKING_STATUS', params);
  await enqueueNotification(params.dbClient, {
    recipient: params.to,
    subject: content.subject,
    template: 'BOOKING_STATUS',
    params,
    idempotencyKey: `book-${params.referenceNumber}-status-${params.status}-${Date.now()}`,
  });
}
