import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
  await sendEmail({
    to: params.to,
    subject: `We received your message — ${params.referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a8a;">Thank you, ${params.firstName}!</h2>
        <p>We have received your message. Our team will get back to you within 24 hours.</p>
        <p><strong>Reference Number:</strong> ${params.referenceNumber}</p>
        <p>Please keep this reference number for your records.</p>
        <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 14px;">FlyWithSafe — Travel Made Reassuring</p>
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
        <h2 style="color: #1e3a8a;">Thank you, ${params.name}!</h2>
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
        <p style="color: #64748b; font-size: 14px;">FlyWithSafe — Travel Made Reassuring</p>
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
    subject: 'Verify your FlyWithSafe email address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a8a;">Welcome to FlyWithSafe${params.name ? `, ${params.name}` : ''}!</h2>
        <p>Please verify your email address to complete your registration.</p>
        <a href="${params.verificationUrl}"
           style="display: inline-block; background: #ea580c; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Verify Email Address
        </a>
        <p style="color: #64748b; font-size: 14px;">This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>
        <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 14px;">FlyWithSafe — Travel Made Reassuring</p>
      </div>
    `,
  });
}
