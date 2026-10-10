import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] || character);
}

function createTransporter() {
  if (!env.smtpUser || !env.smtpPassword) {
    return null;
  }
  return nodemailer.createTransport({
    service: env.smtpService || undefined,
    host: env.smtpService ? undefined : env.smtpHost,
    port: env.smtpService ? undefined : env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPassword,
    },
  });
}

async function sendEmail(options: EmailOptions): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[Email] SMTP not configured — skipping email send');
    return;
  }

  // Use the SMTP user as the sender (avoid invalid "noreply@" addresses)
  const fromAddress = env.smtpEmailFrom && env.smtpEmailFrom.includes('@')
    ? env.smtpEmailFrom
    : env.smtpUser;

  const from = `"${env.smtpEmailFromName}" <${fromAddress}>`;

  try {
    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    console.log(`[Email] Sent to ${options.to}: ${options.subject}`);
  } catch (err) {
    console.error('[Email] Failed to send email:', err);
    // Do NOT rethrow — email failure must not fail the request
  }
}

export async function sendContactConfirmation(params: {
  to: string;
  firstName: string;
  referenceNumber: string;
}): Promise<void> {
  const firstName = escapeHtml(params.firstName);
  await sendEmail({
    to: params.to,
    subject: `We received your message — ${params.referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a8a;">Thank you, ${firstName}!</h2>
        <p>We have received your message. Our team will get back to you within 24 hours.</p>
        <p><strong>Reference Number:</strong> ${params.referenceNumber}</p>
        <p>Please keep this reference number for your records.</p>
        <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 14px;">FlyWithsafety — Travel Made Reassuring</p>
      </div>
    `,
  });
}

export async function sendInquiryConfirmation(params: {
  to: string;
  name: string;
  referenceNumber: string;
  type: 'flight' | 'hotel' | 'package' | 'visa';
}): Promise<void> {
  const name = escapeHtml(params.name);
  const typeLabel = {
    flight: 'Flight',
    hotel: 'Hotel',
    package: 'Package',
    visa: 'Visa',
  }[params.type];

  await sendEmail({
    to: params.to,
    subject: `Your ${typeLabel} inquiry received — ${params.referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a8a;">Thank you, ${name}!</h2>
        <p>We have received your <strong>${typeLabel} Inquiry</strong> and our travel specialists will review it shortly.</p>
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Reference Number:</strong></p>
          <p style="font-size: 24px; font-weight: bold; color: #1e3a8a; margin: 8px 0;">${params.referenceNumber}</p>
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
  });
}

export async function sendEmailVerification(params: {
  to: string;
  name: string;
  verificationUrl: string;
}): Promise<void> {
  await sendEmail({
    to: params.to,
    subject: 'Verify your FlyWithsafety email address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a8a;">Welcome to FlyWithsafety${params.name ? `, ${params.name}` : ''}!</h2>
        <p>Please verify your email address to complete your registration.</p>
        <a href="${params.verificationUrl}"
           style="display: inline-block; background: #ea580c; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Verify Email Address
        </a>
        <p style="color: #64748b; font-size: 14px;">This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>
        <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 14px;">FlyWithsafety — Travel Made Reassuring</p>
      </div>
    `,
  });
}

export async function sendPasswordReset(params: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<void> {
  await sendEmail({
    to: params.to,
    subject: 'Reset your FlyWithSafety password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #8B1D24;">Reset your password${params.name ? `, ${params.name}` : ''}</h2>
        <p>Use the link below to choose a new password. It expires in one hour.</p>
        <a href="${params.resetUrl}"
           style="display: inline-block; background: #8B1D24; color: white; padding: 12px 24px; border-radius: 2px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #64748b; font-size: 14px;">If you did not request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendBookingConfirmation(params: {
  to: string;
  name: string;
  referenceNumber: string;
  bookingType: string;
  totalPrice: number;
  currency: string;
}): Promise<void> {
  await sendEmail({
    to: params.to,
    subject: `Your Booking Request — ${params.referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #1e3a8a;">Booking Request Received</h2>
        <p>Dear ${params.name},</p>
        <p>Thank you for booking with FlyWithsafety. Your ${params.bookingType.toLowerCase()} booking request has been registered under reference:</p>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #ea580c;">
          <p style="margin: 0; font-size: 14px; color: #64748b;">REFERENCE NUMBER</p>
          <p style="font-size: 24px; font-weight: bold; color: #1e3a8a; margin: 4px 0;">${params.referenceNumber}</p>
          <p style="margin: 8px 0 0 0; font-size: 14px;">Total Amount: <strong>${params.currency} ${params.totalPrice.toLocaleString()}</strong></p>
          <p style="margin: 4px 0 0 0; font-size: 14px;">Status: <span style="background: #fed7aa; color: #9a3412; padding: 2px 8px; border-radius: 4px; font-weight: 600;">PENDING</span></p>
        </div>
        <p>Our dedicated travel desk is processing your reservation. You can check the current status anytime using your reference number and email address on our website.</p>
        <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 14px;">FlyWithsafety — Travel Made Reassuring</p>
      </div>
    `,
  });
}

export async function sendBookingStatusNotification(params: {
  to: string;
  name: string;
  referenceNumber: string;
  status: string;
  reason?: string;
}): Promise<void> {
  await sendEmail({
    to: params.to,
    subject: `Booking Status Update: ${params.status} — ${params.referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #1e3a8a;">Booking Status Update</h2>
        <p>Dear ${params.name},</p>
        <p>Your booking <strong>${params.referenceNumber}</strong> status has been updated to:</p>
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="font-size: 20px; font-weight: bold; color: #1e3a8a; margin: 0;">${params.status}</p>
          ${params.reason ? `<p style="margin: 8px 0 0 0; font-size: 14px; color: #64748b;">Note: ${params.reason}</p>` : ''}
        </div>
        <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 14px;">FlyWithsafety — Travel Made Reassuring</p>
      </div>
    `,
  });
}

