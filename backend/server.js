const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');
const { PrismaClient } = require('@prisma/client');
const Stripe = require('stripe');
require('dotenv').config();

// Fix __dirname for Vercel - when loaded through api/index.js, __dirname resolves to api/
// We need to get the project root directory
const IS_VERCEL_RUNTIME = Boolean(process.env.VERCEL);
let projectRoot = __dirname;
if (IS_VERCEL_RUNTIME) {
  // When running on Vercel via api/index.js, __dirname is <project>/api
  // We need to go up one level to get the project root
  projectRoot = path.resolve(__dirname, '..');
}

// Now replace all usages of __dirname with projectRoot in path resolutions
// We'll override __dirname for the rest of the file
Object.defineProperty(global, '__dirname', {
  get: () => projectRoot,
  configurable: true
});

const frontendRootCandidate = path.resolve(__dirname, '..', 'frontend');
const FRONTEND_ROOT = fs.existsSync(frontendRootCandidate) ? frontendRootCandidate : __dirname;
const FRONTEND_BUILD_DIR = path.join(FRONTEND_ROOT, 'dist');
const FRONTEND_PUBLIC_DIR = fs.existsSync(FRONTEND_BUILD_DIR)
  ? FRONTEND_BUILD_DIR
  : path.join(FRONTEND_ROOT, 'public');
const FRONTEND_ASSETS_DIR = path.join(FRONTEND_ROOT, 'public');
const FRONTEND_IMAGES_DIR = path.join(FRONTEND_PUBLIC_DIR, 'images');
const FRONTEND_UPLOADS_DIR = path.join(FRONTEND_ASSETS_DIR, 'uploads');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_SECRET_PASSCODE = process.env.ADMIN_SECRET_PASSCODE || 'CHANGE_ME_ADMIN_PASSCODE';
const ONE_TIME_CODE_TTL_MS = 10 * 60 * 1000;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_PAYMENT_PAGE_URL = process.env.PAYSTACK_PAYMENT_PAGE_URL || '';
let ACTIVE_PORT = PORT;
let PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL
  || (process.env.VERCEL_URL ? `https://${String(process.env.VERCEL_URL).trim()}` : `http://localhost:${ACTIVE_PORT}`);
const GROK_API_KEY = String(process.env.GROK_API_KEY || '').trim();
const GROK_BASE_URL = String(process.env.GROK_BASE_URL || 'https://api.x.ai/v1').trim().replace(/\/+$/, '');
const GROK_MODEL = String(process.env.GROK_MODEL || 'grok-2-latest').trim();

const PAYMENTS_MODE = String(process.env.PAYMENTS_MODE || 'test').trim().toLowerCase();
const IS_LIVE_MODE = PAYMENTS_MODE === 'live';

function isLikelyPaystackLiveKey(key) {
  return String(key || '').trim().toLowerCase().startsWith('sk_live');
}

function isLikelyPaystackTestKey(key) {
  return String(key || '').trim().toLowerCase().startsWith('sk_test');
}

function isLikelyStripeLiveKey(key) {
  return String(key || '').trim().toLowerCase().startsWith('sk_live');
}

function isLikelyStripeTestKey(key) {
  return String(key || '').trim().toLowerCase().startsWith('sk_test');
}

// Stripe configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_CONNECTED_ACCOUNT_ID = process.env.STRIPE_CONNECTED_ACCOUNT_ID || '';

function isStripeConfigured() {
  return Boolean(String(STRIPE_SECRET_KEY || '').trim());
}

function getStripeClient() {
  if (!isStripeConfigured()) {
    const err = new Error('Stripe is not configured');
    err.code = 'STRIPE_NOT_CONFIGURED';
    throw err;
  }

  return new Stripe(String(STRIPE_SECRET_KEY).trim(), {
    // Keep defaults; Stripe may vary API versions by account.
  });
}

function getStripeRequestOptions() {
  const acct = String(STRIPE_CONNECTED_ACCOUNT_ID || '').trim();
  return acct ? { stripeAccount: acct } : undefined;
}

// Email (SMTP) configuration for admin replies
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_SECURE = String(process.env.SMTP_SECURE || '').trim().toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'CEO Unisex Salon <no-reply@ceosaloon.com>';
const SEND_PAYMENT_EMAIL_RECEIPTS = String(process.env.SEND_PAYMENT_EMAIL_RECEIPTS || 'false').trim().toLowerCase() === 'true';
const SEND_BOOKING_STATUS_EMAILS = String(process.env.SEND_BOOKING_STATUS_EMAILS || 'false').trim().toLowerCase() === 'true';
const SEND_ADMIN_NEW_BOOKING_EMAILS = String(process.env.SEND_ADMIN_NEW_BOOKING_EMAILS || 'false').trim().toLowerCase() === 'true';
const SEND_BOOKING_TRACKING_CODE_EMAILS = String(process.env.SEND_BOOKING_TRACKING_CODE_EMAILS || 'true').trim().toLowerCase() === 'true';
const SEND_PRODUCT_ORDER_STATUS_EMAILS = String(process.env.SEND_PRODUCT_ORDER_STATUS_EMAILS || 'true').trim().toLowerCase() === 'true';
const SEND_BOOKING_INVOICE_EMAILS = String(process.env.SEND_BOOKING_INVOICE_EMAILS || 'true').trim().toLowerCase() === 'true';
const SEND_PRODUCT_ORDER_INVOICE_EMAILS = String(process.env.SEND_PRODUCT_ORDER_INVOICE_EMAILS || 'true').trim().toLowerCase() === 'true';
const INVOICE_ACCESS_TOKEN_SECRET = String(process.env.INVOICE_ACCESS_TOKEN_SECRET || ADMIN_SECRET_PASSCODE || 'CHANGE_ME_INVOICE_SECRET').trim();
const INVOICE_ACCESS_TOKEN_TTL_SECONDS = Number(process.env.INVOICE_ACCESS_TOKEN_TTL_SECONDS) > 0
  ? Number(process.env.INVOICE_ACCESS_TOKEN_TTL_SECONDS)
  : 900;
const PAYMENT_RECEIPTS_BCC = process.env.PAYMENT_RECEIPTS_BCC || '';
const SEND_ADMIN_LOGIN_OTP_EMAILS = String(process.env.SEND_ADMIN_LOGIN_OTP_EMAILS || 'true').trim().toLowerCase() === 'true';
const SEND_ADMIN_LOGIN_OTP_SMS = String(process.env.SEND_ADMIN_LOGIN_OTP_SMS || 'true').trim().toLowerCase() === 'true';
const ALLOW_ADMIN_OTP_RESPONSE_FALLBACK = String(process.env.ALLOW_ADMIN_OTP_RESPONSE_FALLBACK || 'true').trim().toLowerCase() === 'true';
const ADMIN_OTP_DELIVERY_TIMEOUT_MS = Number(process.env.ADMIN_OTP_DELIVERY_TIMEOUT_MS) > 0
  ? Number(process.env.ADMIN_OTP_DELIVERY_TIMEOUT_MS)
  : 8000;

// SMS (Termii) - optional
// Termii is commonly used in Nigeria and supports DND routes.
const SEND_BOOKING_STATUS_SMS = String(process.env.SEND_BOOKING_STATUS_SMS || 'false').trim().toLowerCase() === 'true';
const TERMII_API_KEY = process.env.TERMII_API_KEY || '';
// Keep sender ID short to fit common SMS sender-id length limits; override in .env if needed.
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID || 'CEO UNISEX';
const TERMII_CHANNEL = String(process.env.TERMII_CHANNEL || 'generic').trim();
const TERMII_BASE_URL = String(process.env.TERMII_BASE_URL || 'https://api.ng.termii.com').trim().replace(/\/+$/, '');

function isTermiiConfigured() {
  return Boolean(String(TERMII_API_KEY || '').trim()) && Boolean(String(TERMII_SENDER_ID || '').trim());
}

function normalizePhoneToE164(phone) {
  // Basic Nigeria-friendly normalization.
  // Accepts: 070..., 80..., +234..., 234...
  const raw = String(phone || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^0-9+]/g, '');

  // If already looks like +234xxxxxxxxxx
  if (digits.startsWith('+') && digits.length >= 11) {
    return digits;
  }

  const onlyDigits = digits.replace(/\D/g, '');
  if (!onlyDigits) return '';

  // 234XXXXXXXXXX
  if (onlyDigits.startsWith('234') && onlyDigits.length >= 13) {
    return `+${onlyDigits}`;
  }

  // 0XXXXXXXXXX -> +234XXXXXXXXXX
  if (onlyDigits.startsWith('0') && onlyDigits.length >= 11) {
    return `+234${onlyDigits.slice(1)}`;
  }

  // XXXXXXXXXX (10/11 digits without leading 0) -> assume Nigeria
  if (onlyDigits.length === 10 || onlyDigits.length === 11) {
    return `+234${onlyDigits.replace(/^0/, '')}`;
  }

  // Fallback: treat as international without plus
  return `+${onlyDigits}`;
}

function isSmtpConfigured() {
  return Boolean(String(SMTP_HOST || '').trim()) &&
    Boolean(Number.isFinite(SMTP_PORT) && SMTP_PORT > 0) &&
    Boolean(String(SMTP_USER || '').trim()) &&
    Boolean(String(SMTP_PASS || '').trim());
}

function isGmailHostConfigured() {
  const host = String(SMTP_HOST || '').trim().toLowerCase();
  return host === 'smtp.gmail.com' || host.endsWith('.gmail.com');
}

const mailerCache = new Map();

function shouldRetrySmtpWithFallback(error) {
  const message = String(error && error.message ? error.message : '').toLowerCase();
  const code = String(error && error.code ? error.code : '').toUpperCase();
  return (
    message.includes('greeting never received') ||
    message.includes('timeout') ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNECTION' ||
    code === 'ESOCKET'
  );
}

function getMailer(overrides = {}) {
  if (!isSmtpConfigured()) {
    const err = new Error('SMTP is not configured');
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }

  const baseOptions = {
    host: String(SMTP_HOST).trim(),
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    requireTLS: !SMTP_SECURE,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
    tls: {
      servername: String(SMTP_HOST).trim(),
      minVersion: 'TLSv1.2'
    },
    auth: {
      user: String(SMTP_USER).trim(),
      pass: String(SMTP_PASS)
    }
  };

  const transportOptions = { ...baseOptions, ...overrides };
  const cacheKey = JSON.stringify({
    host: transportOptions.host || '',
    port: Number(transportOptions.port || 0),
    secure: Boolean(transportOptions.secure),
    service: String(transportOptions.service || ''),
    user: String(transportOptions.auth && transportOptions.auth.user ? transportOptions.auth.user : ''),
    fallback: Boolean(overrides && overrides.service === 'gmail')
  });

  if (mailerCache.has(cacheKey)) {
    return mailerCache.get(cacheKey);
  }

  const transporter = nodemailer.createTransport({
    ...transportOptions,
    pool: true,
    maxConnections: 3,
    maxMessages: 100
  });

  mailerCache.set(cacheKey, transporter);
  return transporter;
}

async function sendEmail({ to, subject, text, html, replyTo, bcc, attachments }) {
  const mailPayload = {
    from: SMTP_FROM,
    to,
    bcc: String(bcc || '').trim() || undefined,
    subject,
    text,
    html,
    replyTo: replyTo || undefined,
    attachments: Array.isArray(attachments) && attachments.length ? attachments : undefined
  };

  try {
    const transporter = getMailer();
    return await transporter.sendMail(mailPayload);
  } catch (primaryError) {
    // Common Gmail SMTP recovery path when STARTTLS/handshake fails in some networks.
    if (isGmailHostConfigured() && shouldRetrySmtpWithFallback(primaryError)) {
      try {
        const gmailFallbackTransporter = getMailer({
          service: 'gmail',
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          requireTLS: false,
          tls: {
            servername: 'smtp.gmail.com',
            minVersion: 'TLSv1.2'
          }
        });
        return await gmailFallbackTransporter.sendMail(mailPayload);
      } catch (fallbackError) {
        // Preserve original context while surfacing fallback failure details.
        const err = new Error(`${String(primaryError && primaryError.message ? primaryError.message : 'SMTP send failed')} | Gmail fallback failed: ${String(fallbackError && fallbackError.message ? fallbackError.message : 'unknown')}`);
        err.code = fallbackError && fallbackError.code ? fallbackError.code : (primaryError && primaryError.code ? primaryError.code : 'SMTP_SEND_FAILED');
        throw err;
      }
    }

    throw primaryError;
  }
}

async function maybeSendPaymentReceiptEmail({ booking, provider, paidAmount, reference, receiptUrl }) {
  if (!SEND_PAYMENT_EMAIL_RECEIPTS) {
    return { sent: false, skipped: true, reason: 'SEND_PAYMENT_EMAIL_RECEIPTS=false' };
  }

  // Don't send if SMTP is not configured.
  if (!isSmtpConfigured()) {
    return { sent: false, skipped: true, reason: 'SMTP not configured' };
  }

  if (!booking || !booking.email) {
    return { sent: false, skipped: true, reason: 'Missing booking/email' };
  }

  // Idempotency: don't spam customer.
  if (booking.paymentReceiptEmailSentAt) {
    return { sent: false, skipped: true, reason: 'Already sent' };
  }

  const toEmail = normalizeEmail(booking.email);
  const bookingId = String(booking.id || '').trim();
  const serviceName = String(booking.serviceName || '').trim() || 'Salon Service';
  const amountText = `₦${Number(paidAmount || 0).toLocaleString()}`;
  const providerLabel = String(provider || '').trim().toUpperCase();

  const subject = `Payment Receipt (${providerLabel}) - Booking ${bookingId || ''}`.trim();

  const safeRef = String(reference || '').trim();
  const safeReceiptUrl = String(receiptUrl || '').trim();
  const trackingCode = getBookingTrackingCode(booking);
  const secureInvoiceToken = createInvoiceAccessToken({
    resourceType: 'booking',
    lookupCode: trackingCode,
    email: toEmail
  });
  const secureInvoiceUrl = `${String(PUBLIC_BASE_URL || '').replace(/\/+$/, '')}/api/bookings/${encodeURIComponent(trackingCode)}/invoice?token=${encodeURIComponent(secureInvoiceToken)}`;
  const receiptDetailsTableHtml = buildEmailInfoTable([
    { label: 'Booking ID', value: bookingId },
    { label: 'Service', value: serviceName },
    { label: 'Provider', value: providerLabel },
    { label: 'Reference', value: safeRef || 'N/A' }
  ]);
  const receiptButtonHtml = safeReceiptUrl
    ? buildEmailActionButton({ href: safeReceiptUrl, label: 'View payment receipt', bg: '#0f766e' })
    : '';
  const invoiceButtonHtml = buildEmailActionButton({ href: secureInvoiceUrl, label: 'View invoice PDF', bg: '#1d4ed8' });

  const text = `Hi ${booking.name || 'Customer'},\n\nWe received your payment for your booking.\n\nBooking ID: ${bookingId}\nService: ${serviceName}\nAmount paid: ${amountText}\nProvider: ${providerLabel}\nReference: ${safeRef || 'N/A'}\nReceipt: ${safeReceiptUrl || 'N/A'}\nInvoice: ${secureInvoiceUrl}\n\nThank you for choosing CEO Unisex Salon.`;

  const html = buildColorfulEmailShell({
    title: 'Payment Receipt',
    subtitle: `${providerLabel} payment confirmed`,
    accent: '#1e9d53',
    bodyHtml: `
      <p style="margin:0 0 10px; font-size:15px;">Hi <strong>${escapeHtml(String(booking.name || 'Customer'))}</strong>,</p>
      <p style="margin:0 0 16px; color:#374151; font-size:14px;">Your payment has been confirmed. Your receipt details are below.</p>
      <div style="padding:16px; border:1px solid #bbf7d0; border-radius:12px; background:#f0fdf4; margin-bottom:14px;">
        <div style="font-size:13px; color:#14532d; text-transform:uppercase; letter-spacing:.4px; font-weight:700; margin-bottom:4px;">Amount Paid</div>
        <div style="font-size:24px; font-weight:800; color:#166534;">${escapeHtml(amountText)}</div>
      </div>
      ${receiptDetailsTableHtml}
      <div style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
        ${receiptButtonHtml}
        ${invoiceButtonHtml}
      </div>
    `
  });

  const info = await sendEmail({
    to: toEmail,
    subject,
    text,
    html,
    bcc: String(PAYMENT_RECEIPTS_BCC || '').trim() || undefined
  });

  booking.paymentReceiptEmailSentAt = new Date().toISOString();
  booking.paymentReceiptEmailTo = toEmail;
  booking.paymentReceiptEmailProvider = provider;
  booking.paymentReceiptEmailMessageId = info && info.messageId ? info.messageId : undefined;

  return { sent: true };
}

async function maybeSendBookingStatusEmail({ booking, previousStatus, newStatus }) {
  if (!SEND_BOOKING_STATUS_EMAILS) {
    return { sent: false, skipped: true, reason: 'SEND_BOOKING_STATUS_EMAILS=false' };
  }

  if (!isSmtpConfigured()) {
    return { sent: false, skipped: true, reason: 'SMTP not configured' };
  }

  if (!booking || !booking.email) {
    return { sent: false, skipped: true, reason: 'Missing booking/email' };
  }

  const prev = String(previousStatus || '').trim().toLowerCase();
  const next = String(newStatus || '').trim().toLowerCase();

  // Only notify on transitions.
  if (prev === next) {
    return { sent: false, skipped: true, reason: 'No status change' };
  }

  // Idempotency per status.
  if (next === 'approved' && booking.bookingAcceptedEmailSentAt) {
    return { sent: false, skipped: true, reason: 'Already sent (approved)' };
  }
  if (next === 'cancelled' && booking.bookingDeclinedEmailSentAt) {
    return { sent: false, skipped: true, reason: 'Already sent (cancelled)' };
  }

  if (!['approved', 'cancelled'].includes(next)) {
    return { sent: false, skipped: true, reason: 'No email for this status' };
  }

  const toEmail = normalizeEmail(booking.email);
  const bookingId = String(booking.id || '').trim();
  const bookingCode = buildBookingStatusCode(bookingId);
  const serviceName = String(booking.serviceName || '').trim() || 'Salon Service';
  const date = String(booking.date || '').trim();
  const time = String(booking.time || '').trim();
  const isPaidBooking = isBookingPaidForRefundNotice(booking);
  const refundStatementText = 'Where payment has already been made, your refund will be processed to the original payment method within 3 to 7 business days. Processing timelines may vary slightly by your bank or card issuer.';
  const refundStatementHtml = '<p style="margin:12px 0 0; color:#7f1d1d; font-size:13px;">Where payment has already been made, your refund will be processed to the original payment method within <strong>3 to 7 business days</strong>. Processing timelines may vary slightly by your bank or card issuer.</p>';

  const subject = next === 'approved'
    ? `CEO Unisex Salon - Appointment Accepted${bookingId ? ` (${bookingId})` : ''}`
    : `CEO Unisex Salon - Appointment Declined${bookingId ? ` (${bookingId})` : ''}`;

  const safeName = String(booking.name || 'Customer').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeService = serviceName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeBookingId = bookingId.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeDateTime = `${date}${time ? ` at ${time}` : ''}`.trim();

  const acceptedText = `Hi ${booking.name || 'Customer'},\n\nCEO Unisex Salon has ACCEPTED your appointment.\n\nService: ${serviceName}\nBooking Code: ${bookingCode}\nBooking ID: ${bookingId || 'N/A'}\nScheduled for: ${safeDateTime || 'N/A'}\n\nYour service will be rendered on the due date/time as requested in your booking.\n\nIf you need to reschedule, please reply to this email or contact the salon.\n\nThank you for choosing CEO Unisex Salon.`;
  const declinedText = `Hi ${booking.name || 'Customer'},\n\nCEO Unisex Salon has DECLINED your appointment.\n\nService: ${serviceName}\nBooking Code: ${bookingCode}\nBooking ID: ${bookingId || 'N/A'}\nScheduled for: ${safeDateTime || 'N/A'}\n\n${isPaidBooking ? `${refundStatementText}\n\n` : ''}Please contact the salon if you believe this was a mistake or to book another date/time.\n\nThank you.`;

  const html = next === 'approved'
    ? `
      <div style="margin:0; padding:24px; background:#f4fff8; font-family:'Segoe UI', Arial, sans-serif; line-height:1.5; color:#1f2d23;">
        <div style="max-width:620px; margin:0 auto; border-radius:18px; overflow:hidden; border:1px solid #cdeed8; background:#ffffff; box-shadow:0 12px 28px rgba(15,107,47,.12);">
          <div style="padding:20px 24px; background:linear-gradient(135deg,#0f6b2f 0%,#1e9d53 55%,#55c786 100%); color:#ffffff;">
            <div style="font-size:13px; opacity:.96; text-transform:uppercase; letter-spacing:.4px;">CEO Unisex Salon</div>
            <h2 style="margin:8px 0 0; font-size:24px; line-height:1.2;">✅ Appointment Accepted</h2>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 10px; font-size:15px;">Hi <strong>${safeName}</strong>,</p>
            <p style="margin:0 0 14px; font-size:15px; color:#31553c;">Great news! Your appointment has been accepted and your service will be carried out on the due date/time as requested.</p>
            <div style="padding:14px; border:1px solid #d7f2e1; border-radius:12px; background:linear-gradient(180deg,#f9fffb 0%,#ffffff 100%);">
              <div><strong>Service:</strong> ${safeService}</div>
              <div><strong>Booking Code:</strong> ${bookingCode}</div>
              <div><strong>Booking ID:</strong> ${safeBookingId || 'N/A'}</div>
              <div><strong>Scheduled for:</strong> ${safeDateTime || 'N/A'}</div>
            </div>
            <p style="margin:12px 0 0; color:#5d7665; font-size:13px;">If you need to reschedule, please contact the salon.</p>
          </div>
        </div>
      </div>
    `
    : `
      <div style="margin:0; padding:24px; background:#fff6f8; font-family:'Segoe UI', Arial, sans-serif; line-height:1.5; color:#3b2430;">
        <div style="max-width:620px; margin:0 auto; border-radius:18px; overflow:hidden; border:1px solid #f2cfdb; background:#ffffff; box-shadow:0 12px 28px rgba(176,0,32,.12);">
          <div style="padding:20px 24px; background:linear-gradient(135deg,#b00020 0%,#d81b60 55%,#ff6f91 100%); color:#ffffff;">
            <div style="font-size:13px; opacity:.96; text-transform:uppercase; letter-spacing:.4px;">CEO Unisex Salon</div>
            <h2 style="margin:8px 0 0; font-size:24px; line-height:1.2;">❌ Appointment Declined</h2>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 10px; font-size:15px;">Hi <strong>${safeName}</strong>,</p>
            <p style="margin:0 0 14px; font-size:15px; color:#6d3d4f;">Unfortunately, your appointment has been declined at this time.</p>
            <div style="padding:14px; border:1px solid #f4dbe3; border-radius:12px; background:linear-gradient(180deg,#fff9fb 0%,#ffffff 100%);">
              <div><strong>Service:</strong> ${safeService}</div>
              <div><strong>Booking Code:</strong> ${bookingCode}</div>
              <div><strong>Booking ID:</strong> ${safeBookingId || 'N/A'}</div>
              <div><strong>Scheduled for:</strong> ${safeDateTime || 'N/A'}</div>
            </div>
            ${isPaidBooking ? refundStatementHtml : ''}
            <p style="margin:12px 0 0; color:#83616f; font-size:13px;">Please contact the salon to book another time.</p>
          </div>
        </div>
      </div>
    `;

  const info = await sendEmail({
    to: toEmail,
    subject,
    text: next === 'approved' ? acceptedText : declinedText,
    html
  });

  const nowIso = new Date().toISOString();
  if (next === 'approved') {
    booking.bookingAcceptedEmailSentAt = nowIso;
  } else if (next === 'cancelled') {
    booking.bookingDeclinedEmailSentAt = nowIso;
  }
  booking.bookingStatusEmailTo = toEmail;
  booking.bookingStatusEmailLastMessageId = info && info.messageId ? info.messageId : undefined;

  return { sent: true };
}

async function maybeSendAdminNewBookingEmail({ booking, db }) {
  if (!SEND_ADMIN_NEW_BOOKING_EMAILS) {
    return { sent: false, skipped: true, reason: 'SEND_ADMIN_NEW_BOOKING_EMAILS=false' };
  }

  if (!isSmtpConfigured()) {
    return { sent: false, skipped: true, reason: 'SMTP not configured' };
  }

  if (!booking || !db || !Array.isArray(db.admins)) {
    return { sent: false, skipped: true, reason: 'Missing booking/admin records' };
  }

  const recipients = Array.from(new Set(
    db.admins
      .map(admin => normalizeEmail(admin && admin.email ? admin.email : ''))
      .filter(Boolean)
  ));

  if (!recipients.length) {
    return { sent: false, skipped: true, reason: 'No admin email recipients found' };
  }

  const bookingId = String(booking.id || '').trim();
  const bookingCode = buildBookingStatusCode(bookingId);
  const customerName = String(booking.name || '').trim() || 'Customer';
  const customerEmail = normalizeEmail(booking.email);
  const customerPhone = normalizePhone(booking.phone);
  const serviceName = String(booking.serviceName || '').trim() || 'Salon Service';
  const date = String(booking.date || '').trim();
  const time = String(booking.time || '').trim();
  const when = `${date}${time ? ` at ${time}` : ''}`.trim() || 'N/A';
  const serviceMode = String(booking.serviceMode || '').trim() || 'in_salon';

  const safe = (v) => escapeHtml(v);

  const subject = `New Booking Received - ${bookingCode}${bookingId ? ` (${bookingId})` : ''}`;
  const text = `A new booking has been created.\n\nBooking Code: ${bookingCode}\nBooking ID: ${bookingId || 'N/A'}\nCustomer: ${customerName}\nCustomer Email: ${customerEmail || 'N/A'}\nCustomer Phone: ${customerPhone || 'N/A'}\nService: ${serviceName}\nScheduled for: ${when}\nService Mode: ${serviceMode}\nAmount Due Now: ₦${Number(booking.amountDueNow || 0).toLocaleString()}\nPayment Method: ${String(booking.paymentMethod || '').trim() || 'N/A'}\n\nPlease log in to the admin dashboard to review this booking.`;

  const html = buildColorfulEmailShell({
    title: '📌 New Booking Received',
    subtitle: 'A customer just placed a new booking request',
    accent: '#ff1493',
    bodyHtml: `
      <div style="padding:14px; border:1px solid #f3d7ef; border-radius:12px; background:linear-gradient(180deg,#fff8fd 0%,#ffffff 100%);">
        <div><strong>Booking Code:</strong> ${safe(bookingCode)}</div>
        <div><strong>Booking ID:</strong> ${safe(bookingId || 'N/A')}</div>
        <div><strong>Customer:</strong> ${safe(customerName)}</div>
        <div><strong>Customer Email:</strong> ${safe(customerEmail || 'N/A')}</div>
        <div><strong>Customer Phone:</strong> ${safe(customerPhone || 'N/A')}</div>
        <div><strong>Service:</strong> ${safe(serviceName)}</div>
        <div><strong>Scheduled for:</strong> ${safe(when)}</div>
        <div><strong>Service Mode:</strong> ${safe(serviceMode)}</div>
        <div><strong>Amount Due Now:</strong> ₦${Number(booking.amountDueNow || 0).toLocaleString()}</div>
        <div><strong>Payment Method:</strong> ${safe(String(booking.paymentMethod || '').trim() || 'N/A')}</div>
      </div>
      <p style="margin:12px 0 0; color:#6a5c80; font-size:13px;">Please review this booking in the admin dashboard.</p>
    `
  });

  const info = await sendEmail({
    to: recipients.join(','),
    subject,
    text,
    html,
    replyTo: customerEmail || undefined
  });

  booking.adminBookingEmailSentAt = new Date().toISOString();
  booking.adminBookingEmailRecipients = recipients;
  booking.adminBookingEmailMessageId = info && info.messageId ? info.messageId : undefined;

  return { sent: true, recipients };
}

async function maybeSendAdminBookingStatusEmail({ booking, previousStatus, newStatus, db }) {
  if (!isSmtpConfigured()) {
    return { sent: false, skipped: true, reason: 'SMTP not configured' };
  }

  if (!booking || !db || !Array.isArray(db.admins)) {
    return { sent: false, skipped: true, reason: 'Missing booking/admin records' };
  }

  const prev = String(previousStatus || '').trim().toLowerCase();
  const next = String(newStatus || '').trim().toLowerCase();

  if (prev === next) {
    return { sent: false, skipped: true, reason: 'No status change' };
  }

  if (!['approved', 'cancelled'].includes(next)) {
    return { sent: false, skipped: true, reason: 'No admin email for this status' };
  }

  if (next === 'approved' && booking.adminBookingApprovedEmailSentAt) {
    return { sent: false, skipped: true, reason: 'Already sent (approved)' };
  }

  if (next === 'cancelled' && booking.adminBookingDeclinedEmailSentAt) {
    return { sent: false, skipped: true, reason: 'Already sent (cancelled)' };
  }

  const recipients = Array.from(new Set(
    db.admins
      .map(admin => normalizeEmail(admin && admin.email ? admin.email : ''))
      .filter(Boolean)
  ));

  if (!recipients.length) {
    return { sent: false, skipped: true, reason: 'No admin email recipients found' };
  }

  const bookingId = String(booking.id || '').trim();
  const bookingCode = buildBookingStatusCode(bookingId);
  const customerName = String(booking.name || '').trim() || 'Customer';
  const customerEmail = normalizeEmail(booking.email);
  const customerPhone = normalizePhone(booking.phone);
  const serviceName = String(booking.serviceName || '').trim() || 'Salon Service';
  const date = String(booking.date || '').trim();
  const time = String(booking.time || '').trim();
  const when = `${date}${time ? ` at ${time}` : ''}`.trim() || 'N/A';

  const safe = (v) => escapeHtml(v);
  const statusLabel = next === 'approved' ? 'APPROVED' : 'DECLINED';
  const statusEmoji = next === 'approved' ? '✅' : '❌';

  const subject = `${statusEmoji} Booking ${statusLabel} - ${bookingCode}${bookingId ? ` (${bookingId})` : ''}`;
  const text = `Booking status changed.

Booking Code: ${bookingCode}
Booking ID: ${bookingId || 'N/A'}
Status: ${statusLabel}
Customer: ${customerName}
Customer Email: ${customerEmail || 'N/A'}
Customer Phone: ${customerPhone || 'N/A'}
Service: ${serviceName}
Scheduled for: ${when}
Payment Status: ${String(booking.paymentStatus || 'pending')}`;

  const html = buildColorfulEmailShell({
    title: `${statusEmoji} Booking ${statusLabel}`,
    subtitle: 'Admin booking status update notice',
    accent: next === 'approved' ? '#1e9d53' : '#d81b60',
    bodyHtml: `
      <div style="padding:14px; border:1px solid ${next === 'approved' ? '#d7f2e1' : '#f4dbe3'}; border-radius:12px; background:${next === 'approved' ? 'linear-gradient(180deg,#f8fffb 0%,#ffffff 100%)' : 'linear-gradient(180deg,#fff9fb 0%,#ffffff 100%)'};">
        <div><strong>Booking Code:</strong> ${safe(bookingCode)}</div>
        <div><strong>Booking ID:</strong> ${safe(bookingId || 'N/A')}</div>
        <div><strong>Status:</strong> ${safe(statusLabel)}</div>
        <div><strong>Customer:</strong> ${safe(customerName)}</div>
        <div><strong>Customer Email:</strong> ${safe(customerEmail || 'N/A')}</div>
        <div><strong>Customer Phone:</strong> ${safe(customerPhone || 'N/A')}</div>
        <div><strong>Service:</strong> ${safe(serviceName)}</div>
        <div><strong>Scheduled for:</strong> ${safe(when)}</div>
        <div><strong>Payment Status:</strong> ${safe(String(booking.paymentStatus || 'pending'))}</div>
      </div>
    `
  });

  const info = await sendEmail({
    to: recipients.join(','),
    subject,
    text,
    html,
    replyTo: customerEmail || undefined
  });

  const nowIso = new Date().toISOString();
  if (next === 'approved') {
    booking.adminBookingApprovedEmailSentAt = nowIso;
  } else {
    booking.adminBookingDeclinedEmailSentAt = nowIso;
  }
  booking.adminBookingStatusEmailRecipients = recipients;
  booking.adminBookingStatusEmailLastMessageId = info && info.messageId ? info.messageId : undefined;

  return { sent: true, recipients };
}

async function maybeSendBookingTrackingCodeEmail({ booking }) {
  if (!SEND_BOOKING_TRACKING_CODE_EMAILS) {
    return { sent: false, skipped: true, reason: 'SEND_BOOKING_TRACKING_CODE_EMAILS=false' };
  }

  if (!isSmtpConfigured()) {
    return { sent: false, skipped: true, reason: 'SMTP not configured' };
  }

  if (!booking || !booking.email) {
    return { sent: false, skipped: true, reason: 'Missing booking/email' };
  }

  if (booking.trackingCodeEmailSentAt) {
    return { sent: false, skipped: true, reason: 'Already sent' };
  }

  const toEmail = normalizeEmail(booking.email);
  const trackingCode = getBookingTrackingCode(booking);
  const bookingId = String(booking.id || '').trim();
  const serviceName = String(booking.serviceName || 'Salon Service').trim();
  const when = `${String(booking.date || '').trim()}${String(booking.time || '').trim() ? ` at ${String(booking.time || '').trim()}` : ''}`.trim() || 'N/A';

  const subject = `Your Booking Tracking Code - ${trackingCode}`;
  const text = `Hi ${booking.name || 'Customer'},\n\nYour booking was received successfully.\n\nTracking Code: ${trackingCode}\nBooking ID: ${bookingId || 'N/A'}\nService: ${serviceName}\nScheduled for: ${when}\n\nUse your tracking code + booking email on our website to check if your booking is approved or declined.\n\nThank you for choosing CEO Unisex Salon.`;

  const html = buildColorfulEmailShell({
    title: '🔎 Booking Tracking Code',
    subtitle: 'Use this code to track approval status online',
    accent: '#2b6ef2',
    bodyHtml: `
      <p style="margin:0 0 10px;">Hi <strong>${escapeHtml(String(booking.name || 'Customer'))}</strong>,</p>
      <p style="margin:0 0 14px; color:#4c3f63;">Your booking was received. Keep your tracking code safe and use it with your booking email to track status on the website.</p>

      <div style="padding:14px; border:1px solid #d9e6ff; border-radius:12px; background:linear-gradient(180deg,#f6f9ff 0%,#ffffff 100%);">
        <div><strong>Tracking Code:</strong> <span style="font-family:monospace; font-size:16px; letter-spacing:1px;">${escapeHtml(trackingCode)}</span></div>
        <div><strong>Booking ID:</strong> ${escapeHtml(bookingId || 'N/A')}</div>
        <div><strong>Service:</strong> ${escapeHtml(serviceName)}</div>
        <div><strong>Scheduled for:</strong> ${escapeHtml(when)}</div>
      </div>

      <p style="margin:12px 0 0; color:#6a5c80; font-size:13px;">Tracking page: <a href="${escapeHtml(`${PUBLIC_BASE_URL}/#track-booking`)}" target="_blank" rel="noopener">${escapeHtml(`${PUBLIC_BASE_URL}/#track-booking`)}</a></p>
    `
  });

  const info = await sendEmail({
    to: toEmail,
    subject,
    text,
    html
  });

  booking.trackingCodeEmailSentAt = new Date().toISOString();
  booking.trackingCodeEmailTo = toEmail;
  booking.trackingCodeEmailMessageId = info && info.messageId ? info.messageId : undefined;

  return { sent: true };
}

async function maybeSendProductOrderStatusEmail({ order, previousStatus, newStatus }) {
  if (!SEND_PRODUCT_ORDER_STATUS_EMAILS) {
    return { sent: false, skipped: true, reason: 'SEND_PRODUCT_ORDER_STATUS_EMAILS=false' };
  }

  if (!isSmtpConfigured()) {
    return { sent: false, skipped: true, reason: 'SMTP not configured' };
  }

  if (!order || !order.email) {
    return { sent: false, skipped: true, reason: 'Missing order/email' };
  }

  const prev = normalizeProductOrderStatus(previousStatus);
  const next = normalizeProductOrderStatus(newStatus);

  if (!next) {
    return { sent: false, skipped: true, reason: 'Unsupported status' };
  }

  if (prev === next) {
    return { sent: false, skipped: true, reason: 'No status change' };
  }

  const notifyStatuses = ['approved', 'processed', 'shipped', 'on_the_way', 'delivered', 'cancelled'];
  if (!notifyStatuses.includes(next)) {
    return { sent: false, skipped: true, reason: 'No email for this status' };
  }

  const toEmail = normalizeEmail(order.email);
  const orderCode = String(order.orderCode || order.id || '').trim();
  const customerName = String(order.name || 'Customer').trim();

  const statusMeta = {
    approved: {
      label: 'Approved',
      emoji: '✅',
      accent: '#0f766e',
      subtitle: 'Your order has been accepted by our team.',
      body: 'Great news — your order has been accepted and queued for processing.'
    },
    processed: {
      label: 'Processed',
      emoji: '🧾',
      accent: '#2b6ef2',
      subtitle: 'Your order is now being prepared by our team.',
      body: 'Great news — your order has been processed and is now moving to shipment preparation.'
    },
    shipped: {
      label: 'Shipped',
      emoji: '🚚',
      accent: '#8f2aa8',
      subtitle: 'Your package is on the way.',
      body: 'Your order has been shipped and is currently in transit to your delivery address.'
    },
    on_the_way: {
      label: 'On the way',
      emoji: '🛵',
      accent: '#ff8c00',
      subtitle: 'Courier update: your order is now on the way.',
      body: 'Your order is currently with our courier rider and heading to your location.'
    },
    delivered: {
      label: 'Delivered',
      emoji: '📦',
      accent: '#1e9d53',
      subtitle: 'Your order has been delivered.',
      body: 'Your product order has been delivered successfully. Thank you for shopping with us.'
    },
    cancelled: {
      label: 'Cancelled',
      emoji: '❌',
      accent: '#d81b60',
      subtitle: 'Order update from CEO Unisex Salon.',
      body: 'Your product order was cancelled. Please contact us if you need assistance or want to reorder.'
    }
  };

  const meta = statusMeta[next];
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsText = items.length
    ? items.map(item => `${item.name} × ${item.quantity}`).join(', ')
    : 'N/A';

  const subject = `${meta.emoji} Product Order ${meta.label} - ${orderCode}`;
  const text = `Hi ${customerName},\n\n${meta.body}\n\nOrder Code: ${orderCode}\nStatus: ${meta.label}\nItems: ${itemsText}\nTotal: ₦${Number(order.totalAmount || 0).toLocaleString()}\n\nThank you for choosing CEO Unisex Salon.`;

  const html = buildColorfulEmailShell({
    title: `${meta.emoji} Product Order ${meta.label}`,
    subtitle: meta.subtitle,
    accent: meta.accent,
    bodyHtml: `
      <p style="margin:0 0 10px;">Hi <strong>${escapeHtml(customerName)}</strong>,</p>
      <p style="margin:0 0 14px; color:#4c3f63;">${escapeHtml(meta.body)}</p>
      <div style="padding:14px; border:1px solid #eadff7; border-radius:12px; background:linear-gradient(180deg,#fbf7ff 0%,#ffffff 100%);">
        <div><strong>Order Code:</strong> ${escapeHtml(orderCode)}</div>
        <div><strong>Status:</strong> ${escapeHtml(meta.label)}</div>
        <div><strong>Items:</strong> ${escapeHtml(itemsText)}</div>
        <div><strong>Total:</strong> ₦${Number(order.totalAmount || 0).toLocaleString()}</div>
      </div>
      <p style="margin:12px 0 0; color:#6a5c80; font-size:13px;">Track your order using order code + email in the app/website product tracker.</p>
    `
  });

  const info = await sendEmail({
    to: toEmail,
    subject,
    text,
    html
  });

  order.lastStatusEmailSentAt = new Date().toISOString();
  order.lastStatusEmailTo = toEmail;
  order.lastStatusEmailMessageId = info && info.messageId ? info.messageId : undefined;
  order.lastStatusEmailFor = next;

  return { sent: true };
}

async function maybeSendBookingInvoiceEmail({ booking }) {
  if (!SEND_BOOKING_INVOICE_EMAILS) {
    return { sent: false, skipped: true, reason: 'SEND_BOOKING_INVOICE_EMAILS=false' };
  }

  if (!isSmtpConfigured()) {
    return { sent: false, skipped: true, reason: 'SMTP not configured' };
  }

  if (!booking || !booking.email) {
    return { sent: false, skipped: true, reason: 'Missing booking/email' };
  }

  if (booking.bookingInvoiceEmailSentAt) {
    return { sent: false, skipped: true, reason: 'Already sent' };
  }

  const toEmail = normalizeEmail(booking.email);
  const bookingId = String(booking.id || '').trim();
  const invoiceNo = `INV-SVC-${bookingId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'N/A'}`;
  const customerName = String(booking.name || 'Customer').trim();
  const serviceName = String(booking.serviceName || 'Salon Service').trim();
  const when = `${String(booking.date || '').trim()}${String(booking.time || '').trim() ? ` at ${String(booking.time || '').trim()}` : ''}`.trim() || 'N/A';
  const paymentMethod = String(booking.paymentMethod || 'N/A').trim();
  const paymentPlan = String(booking.paymentPlan || 'N/A').trim();
  const subtotal = Number(booking.price || 0);
  const dueNow = Number(booking.amountDueNow || 0);
  const remaining = Number(booking.amountRemaining || 0);
  const productsTotal = Number(booking.requestedProductsTotal || 0);
  const total = Number(subtotal + productsTotal || dueNow + remaining || 0);
  const trackingCode = getBookingTrackingCode(booking);
  const secureInvoiceToken = createInvoiceAccessToken({
    resourceType: 'booking',
    lookupCode: trackingCode,
    email: toEmail
  });
  const secureInvoiceUrl = `${String(PUBLIC_BASE_URL || '').replace(/\/+$/, '')}/api/bookings/${encodeURIComponent(trackingCode)}/invoice?token=${encodeURIComponent(secureInvoiceToken)}`;
  const bookingInvoiceDetailsTableHtml = buildEmailInfoTable([
    { label: 'Invoice No', value: invoiceNo },
    { label: 'Booking ID', value: bookingId || 'N/A' },
    { label: 'Tracking Code', value: trackingCode },
    { label: 'Service', value: serviceName },
    { label: 'Scheduled', value: when },
    { label: 'Payment Method', value: paymentMethod },
    { label: 'Payment Plan', value: paymentPlan },
    { label: 'Total', valueHtml: `<strong>₦${total.toLocaleString()}</strong>` },
    { label: 'Amount Remaining', value: `₦${remaining.toLocaleString()}` }
  ]);
  const openBookingInvoiceButtonHtml = buildEmailActionButton({ href: secureInvoiceUrl, label: 'Open secure online invoice', bg: '#1d4ed8' });

  const subject = `Service Invoice - ${invoiceNo}`;
  const text = `Hi ${customerName},\n\nHere is your service invoice from CEO Unisex Salon.\n\nInvoice No: ${invoiceNo}\nBooking ID: ${bookingId || 'N/A'}\nTracking Code: ${trackingCode}\nService: ${serviceName}\nScheduled: ${when}\nPayment Method: ${paymentMethod}\nPayment Plan: ${paymentPlan}\nService Subtotal: ₦${subtotal.toLocaleString()}\nProducts Total: ₦${productsTotal.toLocaleString()}\nTotal: ₦${total.toLocaleString()}\nAmount Due Now: ₦${dueNow.toLocaleString()}\nAmount Remaining: ₦${remaining.toLocaleString()}\nOnline Invoice: ${secureInvoiceUrl}\n\nThank you for choosing CEO Unisex Salon.`;

  const pdfBuffer = await buildInvoicePdfBuffer({
    invoiceTitle: 'Service Invoice',
    invoiceNumber: invoiceNo,
    customerName,
    details: [
      { label: 'Booking ID', value: bookingId || 'N/A' },
      { label: 'Tracking Code', value: trackingCode },
      { label: 'Service', value: serviceName },
      { label: 'Scheduled', value: when },
      { label: 'Payment Method', value: paymentMethod },
      { label: 'Payment Plan', value: paymentPlan }
    ],
    totals: [
      { label: 'Service Subtotal', value: `₦${subtotal.toLocaleString()}` },
      { label: 'Products Total', value: `₦${productsTotal.toLocaleString()}` },
      { label: 'Total', value: `₦${total.toLocaleString()}` },
      { label: 'Amount Due Now', value: `₦${dueNow.toLocaleString()}` },
      { label: 'Amount Remaining', value: `₦${remaining.toLocaleString()}` }
    ]
  });

  const html = buildColorfulEmailShell({
    title: '🧾 Service Invoice',
    subtitle: 'Your booking invoice is ready',
    accent: '#2b6ef2',
    bodyHtml: `
      <p style="margin:0 0 10px; font-size:15px;">Hi <strong>${escapeHtml(customerName)}</strong>,</p>
      <p style="margin:0 0 16px; color:#374151; font-size:14px;">Your service invoice is ready. We've attached a PDF copy and included a quick summary below.</p>
      <div style="padding:14px; border:1px solid #dbeafe; border-radius:12px; background:#eff6ff; margin-bottom:14px;">
        <div style="font-size:13px; color:#1e40af; text-transform:uppercase; letter-spacing:.4px; font-weight:700;">Amount Due Now</div>
        <div style="font-size:24px; font-weight:800; color:#1d4ed8;">₦${dueNow.toLocaleString()}</div>
      </div>
      ${bookingInvoiceDetailsTableHtml}
      <div style="margin-top:16px;">
        ${openBookingInvoiceButtonHtml}
      </div>
    `
  });

  const info = await sendEmail({
    to: toEmail,
    subject,
    text,
    html,
    attachments: [
      {
        filename: `${invoiceNo}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });

  booking.bookingInvoiceEmailSentAt = new Date().toISOString();
  booking.bookingInvoiceEmailTo = toEmail;
  booking.bookingInvoiceEmailMessageId = info && info.messageId ? info.messageId : undefined;
  booking.invoiceNumber = invoiceNo;

  return { sent: true, invoiceNumber: invoiceNo };
}

async function maybeSendProductOrderInvoiceEmail({ order }) {
  if (!SEND_PRODUCT_ORDER_INVOICE_EMAILS) {
    return { sent: false, skipped: true, reason: 'SEND_PRODUCT_ORDER_INVOICE_EMAILS=false' };
  }

  if (!isSmtpConfigured()) {
    return { sent: false, skipped: true, reason: 'SMTP not configured' };
  }

  if (!order || !order.email) {
    return { sent: false, skipped: true, reason: 'Missing order/email' };
  }

  if (order.orderInvoiceEmailSentAt) {
    return { sent: false, skipped: true, reason: 'Already sent' };
  }

  const toEmail = normalizeEmail(order.email);
  const orderId = String(order.id || '').trim();
  const orderCode = String(order.orderCode || orderId || 'N/A').trim();
  const invoiceNo = `INV-PRD-${orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'N/A'}`;
  const customerName = String(order.name || 'Customer').trim();
  const paymentMethod = String(order.paymentMethod || 'N/A').trim();
  const deliverySpeed = String(order.deliverySpeed || 'standard').toUpperCase();
  const subtotal = Number(order.itemsSubtotal || 0);
  const deliveryFee = Number(order.deliveryFee || 0);
  const total = Number(order.totalAmount || 0);
  const amountDueNow = Number(order.amountDueNow || total);
  const items = Array.isArray(order.items) ? order.items : [];
  const secureInvoiceToken = createInvoiceAccessToken({
    resourceType: 'product',
    lookupCode: orderCode.toUpperCase(),
    email: toEmail
  });
  const secureInvoiceUrl = `${String(PUBLIC_BASE_URL || '').replace(/\/+$/, '')}/api/product-orders/${encodeURIComponent(orderCode.toUpperCase())}/invoice?token=${encodeURIComponent(secureInvoiceToken)}`;
  const productInvoiceDetailsTableHtml = buildEmailInfoTable([
    { label: 'Invoice No', value: invoiceNo },
    { label: 'Order Code', value: orderCode },
    { label: 'Order ID', value: orderId || 'N/A' },
    { label: 'Payment Method', value: paymentMethod },
    { label: 'Delivery Speed', value: deliverySpeed },
    { label: 'Subtotal', value: `₦${subtotal.toLocaleString()}` },
    { label: 'Delivery Fee', value: `₦${deliveryFee.toLocaleString()}` },
    { label: 'Amount Due Now', valueHtml: `<strong>₦${amountDueNow.toLocaleString()}</strong>` }
  ]);
  const openProductInvoiceButtonHtml = buildEmailActionButton({ href: secureInvoiceUrl, label: 'Open secure online invoice', bg: '#7c3aed' });
  const itemsText = items.length
    ? items.map(item => `${item.name} × ${item.quantity} — ₦${Number(item.lineTotal || 0).toLocaleString()}`).join('\n')
    : 'No item lines';

  const subject = `Product Order Invoice - ${invoiceNo}`;
  const text = `Hi ${customerName},\n\nHere is your product order invoice from CEO Unisex Salon.\n\nInvoice No: ${invoiceNo}\nOrder Code: ${orderCode}\nOrder ID: ${orderId || 'N/A'}\nPayment Method: ${paymentMethod}\nDelivery Speed: ${deliverySpeed}\n\nItems:\n${itemsText}\n\nSubtotal: ₦${subtotal.toLocaleString()}\nDelivery Fee: ₦${deliveryFee.toLocaleString()}\nTotal: ₦${total.toLocaleString()}\nAmount Due Now: ₦${amountDueNow.toLocaleString()}\nOnline Invoice: ${secureInvoiceUrl}\n\nThank you for shopping with CEO Unisex Salon.`;

  const pdfBuffer = await buildInvoicePdfBuffer({
    invoiceTitle: 'Product Order Invoice',
    invoiceNumber: invoiceNo,
    customerName,
    details: [
      { label: 'Order Code', value: orderCode },
      { label: 'Order ID', value: orderId || 'N/A' },
      { label: 'Payment Method', value: paymentMethod },
      { label: 'Delivery Speed', value: deliverySpeed },
      { label: 'Items', value: items.length ? items.map(item => `${item.name} x ${item.quantity}`).join(', ') : 'No item lines' }
    ],
    totals: [
      { label: 'Subtotal', value: `₦${subtotal.toLocaleString()}` },
      { label: 'Delivery Fee', value: `₦${deliveryFee.toLocaleString()}` },
      { label: 'Total', value: `₦${total.toLocaleString()}` },
      { label: 'Amount Due Now', value: `₦${amountDueNow.toLocaleString()}` }
    ]
  });

  const itemsHtml = items.length
    ? `<ul style="margin:8px 0 0 16px; padding:0;">${items.map(item => `<li>${escapeHtml(String(item.name || 'Item'))} × ${Number(item.quantity || 0)} — ₦${Number(item.lineTotal || 0).toLocaleString()}</li>`).join('')}</ul>`
    : '<div>No item lines</div>';

  const html = buildColorfulEmailShell({
    title: '🛍️ Product Order Invoice',
    subtitle: 'Your order invoice is ready',
    accent: '#8f2aa8',
    bodyHtml: `
      <p style="margin:0 0 10px; font-size:15px;">Hi <strong>${escapeHtml(customerName)}</strong>,</p>
      <p style="margin:0 0 16px; color:#374151; font-size:14px;">Your product order invoice is ready. A PDF is attached for easy download.</p>
      <div style="padding:14px; border:1px solid #ddd6fe; border-radius:12px; background:#f5f3ff; margin-bottom:14px;">
        <div style="font-size:13px; color:#5b21b6; text-transform:uppercase; letter-spacing:.4px; font-weight:700;">Order Total</div>
        <div style="font-size:24px; font-weight:800; color:#6d28d9;">₦${total.toLocaleString()}</div>
      </div>
      ${productInvoiceDetailsTableHtml}
      <div style="margin-top:10px;"><strong style="color:#374151;">Items:</strong>${itemsHtml}</div>
      <div style="margin-top:16px;">
        ${openProductInvoiceButtonHtml}
      </div>
    `
  });

  const info = await sendEmail({
    to: toEmail,
    subject,
    text,
    html,
    attachments: [
      {
        filename: `${invoiceNo}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });

  order.orderInvoiceEmailSentAt = new Date().toISOString();
  order.orderInvoiceEmailTo = toEmail;
  order.orderInvoiceEmailMessageId = info && info.messageId ? info.messageId : undefined;
  order.invoiceNumber = invoiceNo;

  return { sent: true, invoiceNumber: invoiceNo };
}

async function sendSmsViaTermii({ to, message }) {
  if (!isTermiiConfigured()) {
    const err = new Error('Termii is not configured');
    err.code = 'TERMII_NOT_CONFIGURED';
    throw err;
  }

  const payload = {
    to: String(to).trim(),
    from: String(TERMII_SENDER_ID).trim(),
    sms: String(message || '').trim(),
    type: 'plain',
    channel: TERMII_CHANNEL || 'generic',
    api_key: String(TERMII_API_KEY).trim()
  };

  const response = await fetch(`${TERMII_BASE_URL}/api/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const err = new Error('Failed to send SMS');
    err.code = 'TERMII_SEND_FAILED';
    err.details = data;
    throw err;
  }

  return data;
}

async function maybeSendBookingStatusSms({ booking, previousStatus, newStatus }) {
  if (!SEND_BOOKING_STATUS_SMS) {
    return { sent: false, skipped: true, reason: 'SEND_BOOKING_STATUS_SMS=false' };
  }

  if (!booking || !booking.phone) {
    return { sent: false, skipped: true, reason: 'Missing booking/phone' };
  }

  const prev = String(previousStatus || '').trim().toLowerCase();
  const next = String(newStatus || '').trim().toLowerCase();
  if (prev === next) {
    return { sent: false, skipped: true, reason: 'No status change' };
  }

  // Only notify on accepted/declined outcomes.
  if (!['approved', 'cancelled'].includes(next)) {
    return { sent: false, skipped: true, reason: 'No SMS for this status' };
  }

  // Idempotency per status.
  if (next === 'approved' && booking.bookingAcceptedSmsSentAt) {
    return { sent: false, skipped: true, reason: 'Already sent (approved)' };
  }
  if (next === 'cancelled' && booking.bookingDeclinedSmsSentAt) {
    return { sent: false, skipped: true, reason: 'Already sent (cancelled)' };
  }

  const to = normalizePhoneToE164(booking.phone);
  if (!to) {
    return { sent: false, skipped: true, reason: 'Invalid phone number' };
  }

  const bookingId = String(booking.id || '').trim();
  const bookingCode = buildBookingStatusCode(bookingId);
  const serviceName = String(booking.serviceName || '').trim() || 'Salon Service';
  const date = String(booking.date || '').trim();
  const time = String(booking.time || '').trim();
  const when = `${date}${time ? ` ${time}` : ''}`.trim();
  const isPaidBooking = isBookingPaidForRefundNotice(booking);

  const message = next === 'approved'
    ? `CEO Unisex Salon: Appointment ACCEPTED. ${serviceName}. ${when ? `Due: ${when}. ` : ''}Booking Code: ${bookingCode}. ${bookingId ? `Booking ID: ${bookingId}. ` : ''}Service will be rendered on the due date/time as requested.`
    : `CEO Unisex Salon: Appointment DECLINED. ${serviceName}. ${when ? `Due: ${when}. ` : ''}Booking Code: ${bookingCode}. ${bookingId ? `Booking ID: ${bookingId}. ` : ''}${isPaidBooking ? 'A refund will be processed within 3 to 7 business days (timelines may vary by bank). ' : ''}Please contact the salon to reschedule.`;

  const smsResult = await sendSmsViaTermii({ to, message });

  const nowIso = new Date().toISOString();
  if (next === 'approved') {
    booking.bookingAcceptedSmsSentAt = nowIso;
  } else {
    booking.bookingDeclinedSmsSentAt = nowIso;
  }
  booking.bookingStatusSmsTo = to;
  booking.bookingStatusSmsProvider = 'termii';
  booking.bookingStatusSmsResult = smsResult;

  return { sent: true };
}

// Monnify (card/transfer/ussd) configuration
const MONNIFY_API_KEY = process.env.MONNIFY_API_KEY || '';
const MONNIFY_SECRET_KEY = process.env.MONNIFY_SECRET_KEY || '';
const MONNIFY_CONTRACT_CODE = process.env.MONNIFY_CONTRACT_CODE || '';
const MONNIFY_ENV = String(process.env.MONNIFY_ENV || 'live').trim().toLowerCase();
const MONNIFY_BASE_URL = process.env.MONNIFY_BASE_URL || (MONNIFY_ENV === 'sandbox' ? 'https://sandbox.monnify.com' : 'https://api.monnify.com');

const SALON_BANK_ACCOUNT_NUMBER = process.env.SALON_BANK_ACCOUNT_NUMBER || '0204661552';
const SALON_BANK_NAME = process.env.SALON_BANK_NAME || 'GTB';
const SALON_BANK_ACCOUNT_NAME = process.env.SALON_BANK_ACCOUNT_NAME || 'Okonta Victor Chidiebere';
const PRODUCT_STANDARD_DELIVERY_FEE = Math.max(0, Number(process.env.PRODUCT_STANDARD_DELIVERY_FEE || 0));
const PRODUCT_EXPRESS_DELIVERY_FEE = Math.max(0, Number(process.env.PRODUCT_EXPRESS_DELIVERY_FEE || 1500));

let monnifyAccessTokenCache = {
  token: '',
  expiresAtMs: 0
};

function getDefaultProducts() {
  return [
    { id: 1, name: 'Beard Oil', category: 'Grooming', price: 4500, stock: 35, image: '/images/bread oil.jpeg' },
    { id: 2, name: 'Hair Oil', category: 'Hair Care', price: 3500, stock: 42, image: '/images/hair oil.jpeg' },
    { id: 3, name: 'Face Cream', category: 'Skin Care', price: 5000, stock: 28, image: '/images/face cream.jpeg' },
    { id: 4, name: 'Hair Cream', category: 'Hair Care', price: 4000, stock: 40, image: '/images/hair cream.jpeg' },
    { id: 5, name: 'Perfume', category: 'Fragrance', price: 9000, stock: 22, image: '/images/prefume.jpeg' },
    { id: 6, name: 'Premium Wig', category: 'Wigs', price: 45000, stock: 12, image: '/images/premium wig.jpeg' },
    { id: 7, name: 'Wig Revamping', category: 'Wig Service', price: 15000, stock: 999, image: '/images/wig revamping.jpeg' },
    { id: 9, name: 'Wig Fresh Oil', category: 'Wig Care', price: 6000, stock: 30, image: '/images/wig fresh oil.jpeg' }
  ];
}

function resolveExistingImagePath(imagePath) {
  const normalizedInput = String(imagePath || '').trim();
  if (!normalizedInput) return '';

  // Keep uploaded assets untouched.
  if (normalizedInput.startsWith('/uploads/')) {
    return normalizedInput;
  }

  try {
    const imageFiles = fs.existsSync(FRONTEND_IMAGES_DIR)
      ? fs.readdirSync(FRONTEND_IMAGES_DIR)
      : [];

    if (!imageFiles.length) {
      return normalizedInput;
    }

    const imageLookup = new Map(imageFiles.map((file) => [String(file).toLowerCase(), file]));
    const fileName = decodeURIComponent(path.basename(normalizedInput)).toLowerCase();
    const matchedName = imageLookup.get(fileName);

    if (matchedName) {
      return `/images/${matchedName}`;
    }

    return normalizedInput;
  } catch (error) {
    return normalizedInput;
  }
}

function normalizeProductRecord(product, fallbackProduct = null) {
  const fallback = fallbackProduct || {};
  const normalized = {
    ...product,
    name: String(product && product.name ? product.name : fallback.name || '').trim(),
    category: String(product && product.category ? product.category : fallback.category || '').trim(),
    price: Number.isFinite(Number(product && product.price)) ? Number(product.price) : Number(fallback.price || 0),
    stock: Number.isFinite(Number(product && product.stock)) ? Number(product.stock) : Number(fallback.stock || 0),
    image: resolveExistingImagePath(String(product && product.image ? product.image : fallback.image || ''))
  };

  if (!normalized.image && fallback.image) {
    normalized.image = resolveExistingImagePath(fallback.image);
  }

  return normalized;
}

function mergeProductDefaults(existingProducts) {
  const defaultProducts = getDefaultProducts();
  const mergedProducts = [...(existingProducts || [])];

  defaultProducts.forEach(defaultProduct => {
    const existingIndex = mergedProducts.findIndex(product => Number(product.id) === Number(defaultProduct.id));

    if (existingIndex === -1) {
      mergedProducts.push(defaultProduct);
      return;
    }

    const existingProduct = mergedProducts[existingIndex];
    mergedProducts[existingIndex] = normalizeProductRecord(
      {
        ...existingProduct,
        name: defaultProduct.name,
        category: defaultProduct.category,
        price: Number(existingProduct.price) || defaultProduct.price,
        stock: Number(existingProduct.stock) || defaultProduct.stock,
        image: existingProduct.image || defaultProduct.image
      },
      defaultProduct
    );
  });

  return mergedProducts.map((product) => {
    const defaultProduct = defaultProducts.find((item) => Number(item.id) === Number(product.id));
    return normalizeProductRecord(product, defaultProduct || null);
  });
}

// Use a configurable writable uploads directory for Render/persistent disks.
const configuredUploadsDir = String(process.env.UPLOADS_DIR || '').trim();
const uploadsDir = configuredUploadsDir
  ? path.resolve(configuredUploadsDir)
  : IS_VERCEL_RUNTIME
    ? path.join('/tmp', 'uploads')
    : FRONTEND_UPLOADS_DIR;
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

const uploadReceipt = multer({
  storage: storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB limit for receipts
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Upload an image or PDF receipt.'));
    }
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    // Keep raw body for providers that validate webhook signatures.
    req.rawBody = buf;
  }
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(FRONTEND_PUBLIC_DIR));
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    configuredMode: DATA_STORE_MODE,
    datastore: isMongoPrimaryEnabled()
      ? 'mongo'
      : (isPrismaPrimaryEnabled() ? 'prisma' : 'json'),
    mongoConfigured: isMongoEnabled(),
    prismaConfigured: isPrismaMirrorEnabled(),
    uploadsDir
  });
});
app.use('/images', express.static(FRONTEND_IMAGES_DIR));
app.get('/p1.webp', (req, res) => {
  res.sendFile(path.join(FRONTEND_IMAGES_DIR, 'p1.webp'));
});
app.get('/p2.jpg', (req, res) => {
  res.sendFile(path.join(FRONTEND_IMAGES_DIR, 'p2 hair color.jpg'));
});
app.get('/p3.jpg', (req, res) => {
  res.sendFile(path.join(FRONTEND_IMAGES_DIR, 'p3.jpg'));
});
app.get('/p4.jpg', (req, res) => {
  res.sendFile(path.join(FRONTEND_IMAGES_DIR, 'p4.jpg'));
});
app.get('/p5.jpg', (req, res) => {
  res.sendFile(path.join(FRONTEND_IMAGES_DIR, 'p5 relaxation services.jpg'));
});
app.get('/p6.jpg', (req, res) => {
  res.sendFile(path.join(FRONTEND_IMAGES_DIR, 'p6 styling.jpg'));
});
app.get('/male-stylist.jpg', (req, res) => {
  res.sendFile(path.join(FRONTEND_IMAGES_DIR, 'male baber sytlist.jpeg'));
});

// Database file path
const packagedDbPath = path.join(__dirname, 'database.json');
const dbPath = IS_VERCEL_RUNTIME
  ? path.join('/tmp', 'database.json')
  : packagedDbPath;
const MONGODB_URI = String(process.env.MONGODB_URI || '').trim();
const MONGODB_DB_NAME = String(process.env.MONGODB_DB_NAME || 'ceo_unisex_salon').trim();
const MONGODB_STATE_COLLECTION = String(process.env.MONGODB_STATE_COLLECTION || 'app_state').trim();
const MONGODB_STATE_DOCUMENT_ID = 'primary';
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const DATA_STORE_MODE = String(process.env.DATA_STORE_MODE || 'auto').trim().toLowerCase();

let mongoClientPromise = null;
let mongoSyncInFlight = false;
let mongoSyncQueued = false;
let mongoPrimaryCache = null;
let mongoPrimaryCacheLoadedAt = 0;
let mongoPrimaryCacheRefreshInFlight = false;
let prismaClient = null;
let prismaSyncInFlight = false;
let prismaSyncQueued = false;
let prismaPrimaryCache = null;
let prismaPrimaryCacheLoadedAt = 0;
let prismaPrimaryCacheRefreshInFlight = false;

function isMongoEnabled() {
  return Boolean(MONGODB_URI);
}

function isMongoPrimaryEnabled() {
  if (!isMongoEnabled()) return false;
  if (DATA_STORE_MODE === 'json') return false;
  if (DATA_STORE_MODE === 'prisma') return false;
  if (DATA_STORE_MODE === 'mongo') return true;
  // auto mode
  return true;
}

function isPrismaMirrorEnabled() {
  return Boolean(DATABASE_URL);
}

function isPrismaPrimaryEnabled() {
  if (isMongoPrimaryEnabled()) return false;
  if (!isPrismaMirrorEnabled()) return false;
  if (DATA_STORE_MODE === 'json') return false;
  if (DATA_STORE_MODE === 'prisma') return true;
  if (DATA_STORE_MODE === 'mongo') return false;
  // auto mode
  return true;
}

async function getMongoCollection() {
  if (!isMongoEnabled()) {
    return null;
  }

  if (!mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI, {
      ignoreUndefined: true
    });

    mongoClientPromise = client.connect().catch((error) => {
      mongoClientPromise = null;
      throw error;
    });
  }

  const client = await mongoClientPromise;
  return client.db(MONGODB_DB_NAME).collection(MONGODB_STATE_COLLECTION);
}

function getPrismaClient() {
  if (!isPrismaMirrorEnabled()) {
    return null;
  }

  if (prismaClient) {
    return prismaClient;
  }

  prismaClient = new PrismaClient();
  return prismaClient;
}

function toDateOrNull(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch (error) {
    return '{}';
  }
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function getDefaultServices() {
  return [
    { id: 1, name: 'Hair Cut', price: 5000, duration: 30, image: '/images/p1.webp' },
    { id: 2, name: 'Hair Coloring', price: 15000, duration: 60, image: '/images/p2 hair color.jpg' },
    { id: 3, name: 'Facial Treatment', price: 8000, duration: 45, image: '/images/p3.jpg' },
    { id: 4, name: 'Manicure', price: 4000, duration: 30, image: 'https://cdn.shopify.com/s/files/1/0422/7999/3512/files/11_40bb3f8c-aadf-47eb-9354-3c48e765ab3a_2048x2048.png?v=1641879023' },
    { id: 5, name: 'Pedicure', price: 5000, duration: 40, image: '/images/p5 relaxation services.jpg' },
    { id: 6, name: 'Spa', price: 12000, duration: 60, image: '/images/p5 relaxation services.jpg' },
    { id: 7, name: 'Beard Trim', price: 3000, duration: 20, image: '/images/p6 styling.jpg' },
    { id: 8, name: 'Full Body Massage', price: 18000, duration: 60, image: '/images/p5 relaxation services.jpg' },
    { id: 9, name: 'Wig Revamping', price: 15000, duration: 1440, image: '/images/wig revamping.jpeg' }
  ];
}

function normalizeServiceRecord(service, fallbackService = null) {
  const fallback = fallbackService || {};
  const normalizedId = Number(service && service.id);
  const normalizedName = String(service && service.name ? service.name : fallback.name || '').trim();

  const normalized = {
    ...service,
    id: Number.isFinite(normalizedId) ? normalizedId : Number(fallback.id || 0),
    name: normalizedName,
    price: Number.isFinite(Number(service && service.price)) ? Number(service.price) : Number(fallback.price || 0),
    duration: Number.isFinite(Number(service && service.duration)) ? Number(service.duration) : Number(fallback.duration || 0),
    image: resolveExistingImagePath(String(service && service.image ? service.image : fallback.image || ''))
  };

  if (!normalized.image && fallback.image) {
    normalized.image = resolveExistingImagePath(fallback.image);
  }

  // Product request: use "Spa" instead of "Hair Spa".
  if (normalized.id === 6 || /^hair\s+spa$/i.test(normalized.name)) {
    normalized.name = 'Spa';
  }

  return normalized;
}

function mergeServiceDefaults(existingServices) {
  const defaultServices = getDefaultServices();
  const mergedServices = [...(existingServices || [])];

  defaultServices.forEach((defaultService) => {
    const existingIndex = mergedServices.findIndex((service) => Number(service && service.id) === Number(defaultService.id));

    if (existingIndex === -1) {
      mergedServices.push(defaultService);
      return;
    }

    const existingService = mergedServices[existingIndex];
    mergedServices[existingIndex] = normalizeServiceRecord(
      {
        ...existingService,
        name: Number(defaultService.id) === 6 ? 'Spa' : (existingService && existingService.name ? existingService.name : defaultService.name),
        image: existingService && existingService.image ? existingService.image : defaultService.image
      },
      defaultService
    );
  });

  return mergedServices
    .map((service) => {
      const defaultService = defaultServices.find((item) => Number(item.id) === Number(service && service.id));
      return normalizeServiceRecord(service, defaultService || null);
    })
    .filter((service) => Number.isFinite(Number(service && service.id)));
}

function buildBaseDatabaseShape() {
  return {
    bookings: [],
    productOrders: [],
    messages: [],
    admins: [],
    adminAccessCodes: [],
    settings: {
      productDeliveryFees: {
        standard: PRODUCT_STANDARD_DELIVERY_FEE,
        express: PRODUCT_EXPRESS_DELIVERY_FEE
      }
    },
    products: getDefaultProducts(),
    services: getDefaultServices(),
    bookingNotifications: [],
    productOrderNotifications: []
  };
}

function parseJsonSafely(value, fallbackValue) {
  try {
    const parsed = JSON.parse(String(value || ''));
    return parsed == null ? fallbackValue : parsed;
  } catch (error) {
    return fallbackValue;
  }
}

function normalizeDatabaseObject(inputDb) {
  const base = buildBaseDatabaseShape();
  const db = {
    ...base,
    ...(inputDb && typeof inputDb === 'object' ? inputDb : {})
  };

  if (!Array.isArray(db.bookings)) db.bookings = [];
  if (!Array.isArray(db.productOrders)) db.productOrders = [];
  if (!Array.isArray(db.messages)) db.messages = [];
  if (!Array.isArray(db.services)) db.services = [];
  if (!Array.isArray(db.products)) db.products = [];
  if (!Array.isArray(db.admins)) db.admins = [];
  if (!Array.isArray(db.adminAccessCodes)) db.adminAccessCodes = [];
  if (!Array.isArray(db.bookingNotifications)) db.bookingNotifications = [];
  if (!Array.isArray(db.productOrderNotifications)) db.productOrderNotifications = [];
  if (!db.settings || typeof db.settings !== 'object') db.settings = {};

  if (!db.settings.productDeliveryFees || typeof db.settings.productDeliveryFees !== 'object') {
    db.settings.productDeliveryFees = {
      standard: PRODUCT_STANDARD_DELIVERY_FEE,
      express: PRODUCT_EXPRESS_DELIVERY_FEE
    };
  } else {
    const standard = Number(db.settings.productDeliveryFees.standard);
    const express = Number(db.settings.productDeliveryFees.express);
    db.settings.productDeliveryFees.standard = Number.isFinite(standard) && standard >= 0
      ? standard
      : PRODUCT_STANDARD_DELIVERY_FEE;
    db.settings.productDeliveryFees.express = Number.isFinite(express) && express >= 0
      ? express
      : PRODUCT_EXPRESS_DELIVERY_FEE;
  }

  if (db.products.length === 0) {
    db.products = getDefaultProducts();
  } else {
    db.products = mergeProductDefaults(db.products);
  }

  if (db.services.length === 0) {
    db.services = getDefaultServices();
  } else {
    db.services = mergeServiceDefaults(db.services);
  }

  return db;
}

async function buildDatabaseObjectFromPrisma() {
  const prisma = getPrismaClient();
  if (!prisma) {
    return null;
  }

  const [
    bookingRows,
    orderRows,
    messageRows,
    adminRows,
    serviceRows,
    productRows,
    bookingNotificationRows,
    productOrderNotificationRows,
    appSetting
  ] = await Promise.all([
    prisma.bookingRecord.findMany(),
    prisma.productOrderRecord.findMany(),
    prisma.messageRecord.findMany(),
    prisma.adminRecord.findMany(),
    prisma.serviceRecord.findMany(),
    prisma.productRecord.findMany(),
    prisma.bookingNotificationRecord.findMany(),
    prisma.productOrderNotificationRecord.findMany(),
    prisma.appSetting.findUnique({ where: { id: 1 } })
  ]);

  const db = buildBaseDatabaseShape();
  db.bookings = bookingRows.map((row) => parseJsonSafely(row.raw, { id: row.id, email: row.email || '', status: row.status || '' }));
  db.productOrders = orderRows.map((row) => parseJsonSafely(row.raw, { id: row.id, email: row.email || '', status: row.status || '' }));
  db.messages = messageRows.map((row) => parseJsonSafely(row.raw, { id: row.id, email: row.email || '', status: row.status || '' }));
  db.admins = adminRows.map((row) => parseJsonSafely(row.raw, { id: row.id, email: row.email || '', name: row.name || '' }));
  db.services = serviceRows.map((row) => parseJsonSafely(row.raw, { id: row.id, name: row.name, price: row.price, duration: row.duration || 0 }));
  db.products = productRows.map((row) => parseJsonSafely(row.raw, { id: row.id, name: row.name, category: row.category || '', price: row.price, stock: row.stock || 0, image: row.image || '' }));
  db.bookingNotifications = bookingNotificationRows.map((row) => parseJsonSafely(row.raw, { id: row.id, bookingId: row.bookingId || '' }));
  db.productOrderNotifications = productOrderNotificationRows.map((row) => parseJsonSafely(row.raw, { id: row.id, orderId: row.orderId || '' }));

  db.settings = parseJsonSafely(appSetting && appSetting.raw ? appSetting.raw : '{}', db.settings);
  db.adminAccessCodes = [];

  return normalizeDatabaseObject(db);
}

async function refreshPrismaPrimaryCache() {
  if (!isPrismaPrimaryEnabled()) return;
  if (prismaPrimaryCacheRefreshInFlight) return;

  prismaPrimaryCacheRefreshInFlight = true;
  try {
    const fromPrisma = await buildDatabaseObjectFromPrisma();
    if (fromPrisma) {
      prismaPrimaryCache = fromPrisma;
      prismaPrimaryCacheLoadedAt = Date.now();
    }
  } catch (error) {
    console.warn('[Prisma Primary] Cache refresh failed:', error && error.message ? String(error.message) : error);
  } finally {
    prismaPrimaryCacheRefreshInFlight = false;
  }
}

async function buildDatabaseObjectFromMongo() {
  const collection = await getMongoCollection();
  if (!collection) {
    return null;
  }

  const document = await collection.findOne({ _id: MONGODB_STATE_DOCUMENT_ID });
  if (!document || !document.state || typeof document.state !== 'object') {
    return null;
  }

  return normalizeDatabaseObject(document.state);
}

async function refreshMongoPrimaryCache() {
  if (!isMongoPrimaryEnabled()) return;
  if (mongoPrimaryCacheRefreshInFlight) return;

  mongoPrimaryCacheRefreshInFlight = true;
  try {
    const fromMongo = await buildDatabaseObjectFromMongo();
    if (fromMongo) {
      mongoPrimaryCache = fromMongo;
      mongoPrimaryCacheLoadedAt = Date.now();
      return;
    }

    await syncJsonDatabaseToMongo(mongoPrimaryCache || readDatabaseFromJsonDisk());
  } catch (error) {
    console.warn('[Mongo Primary] Cache refresh failed:', error && error.message ? String(error.message) : error);
  } finally {
    mongoPrimaryCacheRefreshInFlight = false;
  }
}

function buildPrismaMirrorPayload(db) {
  return {
    bookings: arrayOf(db.bookings)
      .map((item) => ({
        id: String(item && item.id ? item.id : '').trim(),
        trackingCode: item && item.trackingCode ? String(item.trackingCode) : null,
        email: item && item.email ? normalizeEmail(item.email) : null,
        status: item && item.status ? String(item.status) : null,
        createdAt: toDateOrNull(item && item.createdAt),
        updatedAt: toDateOrNull(item && item.updatedAt),
        raw: safeStringify(item)
      }))
      .filter((item) => item.id),
    productOrders: arrayOf(db.productOrders)
      .map((item) => ({
        id: String(item && item.id ? item.id : '').trim(),
        orderCode: item && item.orderCode ? String(item.orderCode) : null,
        email: item && item.email ? normalizeEmail(item.email) : null,
        status: item && item.status ? String(item.status) : null,
        createdAt: toDateOrNull(item && item.createdAt),
        updatedAt: toDateOrNull(item && item.updatedAt),
        raw: safeStringify(item)
      }))
      .filter((item) => item.id),
    messages: arrayOf(db.messages)
      .map((item) => ({
        id: String(item && item.id ? item.id : '').trim(),
        email: item && item.email ? normalizeEmail(item.email) : null,
        status: item && item.status ? String(item.status) : null,
        createdAt: toDateOrNull(item && item.createdAt),
        raw: safeStringify(item)
      }))
      .filter((item) => item.id),
    admins: arrayOf(db.admins)
      .map((item) => ({
        id: String(item && item.id ? item.id : '').trim(),
        email: item && item.email ? normalizeEmail(item.email) : null,
        name: item && item.name ? String(item.name) : null,
        createdAt: toDateOrNull(item && item.createdAt),
        raw: safeStringify(item)
      }))
      .filter((item) => item.id),
    services: arrayOf(db.services)
      .map((item) => ({
        id: Number(item && item.id),
        name: String(item && item.name ? item.name : ''),
        price: Number(item && item.price ? item.price : 0),
        duration: Number.isFinite(Number(item && item.duration)) ? Number(item.duration) : null,
        raw: safeStringify(item)
      }))
      .filter((item) => Number.isFinite(item.id)),
    products: arrayOf(db.products)
      .map((item) => ({
        id: Number(item && item.id),
        name: String(item && item.name ? item.name : ''),
        category: item && item.category ? String(item.category) : null,
        price: Number(item && item.price ? item.price : 0),
        stock: Number.isFinite(Number(item && item.stock)) ? Number(item.stock) : null,
        image: item && item.image ? String(item.image) : null,
        updatedAt: toDateOrNull(item && item.updatedAt),
        raw: safeStringify(item)
      }))
      .filter((item) => Number.isFinite(item.id)),
    bookingNotifications: arrayOf(db.bookingNotifications)
      .map((item) => ({
        id: String(item && item.id ? item.id : '').trim(),
        bookingId: item && item.bookingId ? String(item.bookingId) : null,
        email: item && item.email ? normalizeEmail(item.email) : null,
        type: item && item.type ? String(item.type) : null,
        createdAt: toDateOrNull(item && item.createdAt),
        raw: safeStringify(item)
      }))
      .filter((item) => item.id),
    productOrderNotifications: arrayOf(db.productOrderNotifications)
      .map((item) => ({
        id: String(item && item.id ? item.id : '').trim(),
        orderId: item && item.orderId ? String(item.orderId) : null,
        email: item && item.email ? normalizeEmail(item.email) : null,
        type: item && item.type ? String(item.type) : null,
        createdAt: toDateOrNull(item && item.createdAt),
        raw: safeStringify(item)
      }))
      .filter((item) => item.id),
    settingsRaw: safeStringify(db.settings || {})
  };
}

async function prismaReplaceTable(tx, tableName, rows) {
  await tx[tableName].deleteMany();
  if (rows.length) {
    await tx[tableName].createMany({ data: rows });
  }
}

async function syncJsonDatabaseToMongo(dbSnapshot) {
  if (!isMongoEnabled()) {
    return { synced: false, skipped: true, reason: 'MONGODB_URI not configured' };
  }

  const collection = await getMongoCollection();
  if (!collection) {
    return { synced: false, skipped: true, reason: 'Mongo collection unavailable' };
  }

  const normalized = normalizeDatabaseObject(dbSnapshot || {});

  await collection.updateOne(
    { _id: MONGODB_STATE_DOCUMENT_ID },
    {
      $set: {
        state: normalized,
        updatedAt: new Date().toISOString()
      }
    },
    { upsert: true }
  );

  return { synced: true };
}

async function syncJsonDatabaseToPrisma(dbSnapshot) {
  if (!isPrismaMirrorEnabled()) {
    return { synced: false, skipped: true, reason: 'DATABASE_URL not configured' };
  }

  const prisma = getPrismaClient();
  if (!prisma) {
    return { synced: false, skipped: true, reason: 'Prisma client unavailable' };
  }

  const payload = buildPrismaMirrorPayload(dbSnapshot || {});

  await prisma.$transaction(async (tx) => {
    await prismaReplaceTable(tx, 'bookingRecord', payload.bookings);
    await prismaReplaceTable(tx, 'productOrderRecord', payload.productOrders);
    await prismaReplaceTable(tx, 'messageRecord', payload.messages);
    await prismaReplaceTable(tx, 'adminRecord', payload.admins);
    await prismaReplaceTable(tx, 'serviceRecord', payload.services);
    await prismaReplaceTable(tx, 'productRecord', payload.products);
    await prismaReplaceTable(tx, 'bookingNotificationRecord', payload.bookingNotifications);
    await prismaReplaceTable(tx, 'productOrderNotificationRecord', payload.productOrderNotifications);

    await tx.appSetting.upsert({
      where: { id: 1 },
      update: { raw: payload.settingsRaw },
      create: { id: 1, raw: payload.settingsRaw }
    });
  });

  return { synced: true };
}

async function triggerMongoMirrorSync(dbSnapshot) {
  if (!isMongoEnabled()) {
    return;
  }

  if (mongoSyncInFlight) {
    mongoSyncQueued = true;
    return;
  }

  mongoSyncInFlight = true;
  let snapshot = dbSnapshot;

  try {
    do {
      mongoSyncQueued = false;
      await syncJsonDatabaseToMongo(snapshot || readDatabaseFromJsonDisk());

      if (mongoSyncQueued) {
        snapshot = readDatabaseFromJsonDisk();
      }
    } while (mongoSyncQueued);
  } catch (error) {
    console.warn('[Mongo Mirror] Sync failed:', error && error.message ? String(error.message) : error);
  } finally {
    mongoSyncInFlight = false;
  }
}

async function triggerPrismaMirrorSync(dbSnapshot) {
  if (!isPrismaMirrorEnabled()) {
    return;
  }

  if (prismaSyncInFlight) {
    prismaSyncQueued = true;
    return;
  }

  prismaSyncInFlight = true;
  let snapshot = dbSnapshot;

  try {
    do {
      prismaSyncQueued = false;
      await syncJsonDatabaseToPrisma(snapshot || readDatabase());

      if (prismaSyncQueued) {
        snapshot = readDatabaseFromJsonDisk();
      }
    } while (prismaSyncQueued);
  } catch (error) {
    console.warn('[Prisma Mirror] Sync failed:', error && error.message ? String(error.message) : error);
  } finally {
    prismaSyncInFlight = false;
  }
}

// Initialize database
function initializeDatabase() {
  if (fs.existsSync(dbPath)) {
    return;
  }

  if (IS_VERCEL_RUNTIME && fs.existsSync(packagedDbPath)) {
    const packagedRaw = fs.readFileSync(packagedDbPath, 'utf8');
    const packagedDb = normalizeDatabaseObject(JSON.parse(packagedRaw));
    fs.writeFileSync(dbPath, JSON.stringify(packagedDb, null, 2));
    return;
  }

  const initialData = normalizeDatabaseObject(buildBaseDatabaseShape());
  fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
}

function writeDatabaseFile(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function readDatabaseFromJsonDisk() {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const normalizedDb = normalizeDatabaseObject(db);
  let shouldPersist = false;

  if (JSON.stringify(normalizedDb) !== JSON.stringify(db)) {
    shouldPersist = true;
  }

  if (shouldPersist) {
    writeDatabaseFile(normalizedDb);
  }

  return normalizedDb;
}

// Helper functions to read/write database
function readDatabase() {
  if (isMongoPrimaryEnabled()) {
    if (mongoPrimaryCache) {
      return normalizeDatabaseObject(mongoPrimaryCache);
    }

    const fallbackDb = readDatabaseFromJsonDisk();
    mongoPrimaryCache = fallbackDb;
    mongoPrimaryCacheLoadedAt = Date.now();
    refreshMongoPrimaryCache();
    return fallbackDb;
  }

  if (!isPrismaPrimaryEnabled()) {
    return readDatabaseFromJsonDisk();
  }

  if (prismaPrimaryCache) {
    return normalizeDatabaseObject(prismaPrimaryCache);
  }

  const fallbackDb = readDatabaseFromJsonDisk();
  prismaPrimaryCache = fallbackDb;
  prismaPrimaryCacheLoadedAt = Date.now();
  refreshPrismaPrimaryCache();
  return fallbackDb;
}

function addBookingNotification(db, booking, type, message) {
  if (!db.bookingNotifications) {
    db.bookingNotifications = [];
  }

  db.bookingNotifications.push({
    id: uuidv4(),
    bookingId: booking.id,
    email: booking.email,
    phone: booking.phone,
    type,
    message,
    createdAt: new Date().toISOString()
  });
}

function normalizeProductOrderStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'accepted') return 'approved';
  if (normalized === 'declined' || normalized === 'rejected') return 'cancelled';
  if (normalized === 'completed') return 'delivered';
  if (['pending', 'approved', 'processed', 'shipped', 'on_the_way', 'delivered', 'cancelled'].includes(normalized)) {
    return normalized;
  }
  return '';
}

function normalizeDeliverySpeed(speed) {
  const normalized = String(speed || '').trim().toLowerCase();
  if (['express', 'fast'].includes(normalized)) return 'express';
  return 'standard';
}

function getProductDeliveryFeeSettings(db) {
  const standardFromDb = Number(db && db.settings && db.settings.productDeliveryFees
    ? db.settings.productDeliveryFees.standard
    : NaN);
  const expressFromDb = Number(db && db.settings && db.settings.productDeliveryFees
    ? db.settings.productDeliveryFees.express
    : NaN);

  return {
    standard: Number.isFinite(standardFromDb) && standardFromDb >= 0
      ? standardFromDb
      : PRODUCT_STANDARD_DELIVERY_FEE,
    express: Number.isFinite(expressFromDb) && expressFromDb >= 0
      ? expressFromDb
      : PRODUCT_EXPRESS_DELIVERY_FEE
  };
}

function getProductOrderDeliveryFee(speed, db) {
  const normalized = normalizeDeliverySpeed(speed);
  const fees = getProductDeliveryFeeSettings(db);
  if (normalized === 'express') {
    return fees.express;
  }
  return fees.standard;
}

function getDeliveryAutomationThresholds(speed) {
  const normalized = normalizeDeliverySpeed(speed);
  if (normalized === 'express') {
    return {
      shippedToOnTheWayMs: 30 * 60 * 1000,
      onTheWayToDeliveredMs: 6 * 60 * 60 * 1000
    };
  }

  return {
    shippedToOnTheWayMs: 2 * 60 * 60 * 1000,
    onTheWayToDeliveredMs: 24 * 60 * 60 * 1000
  };
}

async function maybeAutoAdvanceProductOrderDelivery(db, order) {
  if (!db || !order) return false;

  let changed = false;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  order.deliverySpeed = normalizeDeliverySpeed(order.deliverySpeed);
  const thresholds = getDeliveryAutomationThresholds(order.deliverySpeed);

  const currentStatus = normalizeProductOrderStatus(order.status || 'pending') || 'pending';
  order.status = currentStatus;

  if (!order.statusTimestamps || typeof order.statusTimestamps !== 'object') {
    order.statusTimestamps = {};
  }

  const timestamps = order.statusTimestamps;

  const ensureTimestamp = (key, fallbackValue) => {
    const existing = String(timestamps[key] || '').trim();
    if (existing) return existing;
    const fallback = String(fallbackValue || '').trim();
    if (fallback) {
      timestamps[key] = fallback;
      return fallback;
    }
    timestamps[key] = nowIso;
    return timestamps[key];
  };

  if (['shipped', 'on_the_way', 'delivered'].includes(order.status)) {
    const shippedAt = ensureTimestamp('shippedAt', order.shippedAt || order.updatedAt || order.createdAt);
    order.shippedAt = shippedAt;
  }

  if (['on_the_way', 'delivered'].includes(order.status)) {
    const onTheWayAt = ensureTimestamp('onTheWayAt', order.onTheWayAt || order.shippedAt || order.updatedAt || order.createdAt);
    order.onTheWayAt = onTheWayAt;
  }

  if (order.status === 'delivered') {
    const deliveredAt = ensureTimestamp('deliveredAt', order.deliveredAt || order.onTheWayAt || order.updatedAt || order.createdAt);
    order.deliveredAt = deliveredAt;
  }

  const shippedAtMs = Date.parse(String(order.shippedAt || timestamps.shippedAt || ''));
  if (order.status === 'shipped' && Number.isFinite(shippedAtMs) && (nowMs - shippedAtMs) >= thresholds.shippedToOnTheWayMs) {
    const previousStatus = order.status;
    order.status = 'on_the_way';
    order.onTheWayAt = nowIso;
    timestamps.onTheWayAt = nowIso;
    order.updatedAt = nowIso;
    changed = true;

    addProductOrderNotification(
      db,
      order,
      'order_on_the_way',
      `🛵 Your order (${order.orderCode}) is now on the way with our courier rider.`
    );

    try {
      await maybeSendProductOrderStatusEmail({
        order,
        previousStatus,
        newStatus: 'on_the_way'
      });
    } catch (error) {
      order.lastStatusEmailError = error && error.message ? String(error.message) : 'Email send failed';
      order.lastStatusEmailErrorAt = nowIso;
    }
  }

  const onTheWayAtMs = Date.parse(String(order.onTheWayAt || timestamps.onTheWayAt || ''));
  if (order.status === 'on_the_way' && Number.isFinite(onTheWayAtMs) && (nowMs - onTheWayAtMs) >= thresholds.onTheWayToDeliveredMs) {
    const previousStatus = order.status;
    order.status = 'delivered';
    order.deliveredAt = nowIso;
    timestamps.deliveredAt = nowIso;
    order.updatedAt = nowIso;
    changed = true;

    addProductOrderNotification(
      db,
      order,
      'order_delivered',
      `📦 Your order (${order.orderCode}) has been delivered by the courier rider. Enjoy!`
    );

    try {
      await maybeSendProductOrderStatusEmail({
        order,
        previousStatus,
        newStatus: 'delivered'
      });
    } catch (error) {
      order.lastStatusEmailError = error && error.message ? String(error.message) : 'Email send failed';
      order.lastStatusEmailErrorAt = nowIso;
    }
  }

  return changed;
}

function addProductOrderNotification(db, order, type, message) {
  if (!db.productOrderNotifications) {
    db.productOrderNotifications = [];
  }

  db.productOrderNotifications.push({
    id: uuidv4(),
    orderId: order.id,
    orderCode: order.orderCode,
    email: order.email,
    phone: order.phone,
    type,
    message,
    createdAt: new Date().toISOString()
  });
}

function normalizePhone(phone) {
  return String(phone || '').trim();
}

function getProductFreshnessScore(product) {
  const updatedAtMs = Date.parse(String(product && product.updatedAt ? product.updatedAt : ''));
  if (Number.isFinite(updatedAtMs)) {
    return updatedAtMs;
  }

  const createdAtMs = Date.parse(String(product && product.createdAt ? product.createdAt : ''));
  if (Number.isFinite(createdAtMs)) {
    return createdAtMs;
  }

  const numericId = Number(product && product.id ? product.id : 0);
  return Number.isFinite(numericId) ? numericId : 0;
}

function sortProductsForDisplay(products) {
  const list = Array.isArray(products) ? [...products] : [];
  list.sort((a, b) => getProductFreshnessScore(b) - getProductFreshnessScore(a));
  return list;
}

function buildBankTransferReference(bookingId) {
  const shortId = String(bookingId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return `CEOSALOON-${shortId || 'BOOKING'}`;
}

function buildBookingStatusCode(bookingId) {
  const shortId = String(bookingId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return `BOOK-${shortId || 'UNKNOWN'}`;
}

function isBookingPaidForRefundNotice(booking) {
  const paymentStatus = String(booking && booking.paymentStatus ? booking.paymentStatus : '').trim().toLowerCase();
  const paidAmount = Number(booking && booking.paidAmount ? booking.paidAmount : 0);

  if (paidAmount > 0) {
    return true;
  }

  return ['paid', 'partially_paid', 'partial_paid', 'part_paid'].includes(paymentStatus);
}

function getBookingTrackingCode(booking) {
  const existing = String(booking && booking.trackingCode ? booking.trackingCode : '').trim().toUpperCase();
  if (existing) {
    return existing;
  }

  return buildBookingStatusCode(booking && booking.id ? booking.id : '');
}

const DEFAULT_BOOKING_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const DEFAULT_BOOKING_STAFF = (() => {
  const configured = String(process.env.BOOKING_STAFF_LIST || '')
    .split(',')
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  if (configured.length) {
    return configured;
  }

  return ['Amina', 'Tunde', 'Grace'];
})();

function normalizeSlotDate(value) {
  const normalized = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function normalizeSlotTime(value) {
  const normalized = String(value || '').trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(normalized) ? normalized : '';
}

function normalizeStaffName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getBookingStaffList(db) {
  const fromBookings = (db && Array.isArray(db.bookings) ? db.bookings : [])
    .map((booking) => normalizeStaffName(booking && booking.selectedStaff))
    .filter(Boolean);

  const merged = [
    ...DEFAULT_BOOKING_STAFF.map(normalizeStaffName).filter(Boolean),
    ...fromBookings
  ];

  return Array.from(new Set(merged));
}

function shouldBlockSlotForBooking(booking) {
  const status = String(booking && booking.status ? booking.status : '').trim().toLowerCase();
  return ['pending', 'approved'].includes(status);
}

function shouldBlockSlotForStaff(booking, selectedStaff) {
  if (!shouldBlockSlotForBooking(booking)) {
    return false;
  }

  const normalizedSelectedStaff = normalizeStaffName(selectedStaff).toLowerCase();
  if (!normalizedSelectedStaff) {
    // No staff filter means any active booking blocks the slot.
    return true;
  }

  const bookingStaff = normalizeStaffName(booking && booking.selectedStaff).toLowerCase();
  if (!bookingStaff) {
    // Legacy bookings without staff assignment are treated as blocking all staff for safety.
    return true;
  }

  return bookingStaff === normalizedSelectedStaff;
}

function computeBlockedSlotsForDate(db, date, selectedStaff = '') {
  const normalizedDate = normalizeSlotDate(date);
  if (!normalizedDate) return [];

  return (db.bookings || [])
    .filter(booking => normalizeSlotDate(booking && booking.date) === normalizedDate)
    .filter(booking => shouldBlockSlotForStaff(booking, selectedStaff))
    .map(booking => normalizeSlotTime(booking && booking.time))
    .filter(Boolean);
}

function computeAvailableSlotsForDate(db, date, selectedStaff = '') {
  const blockedSlots = new Set(computeBlockedSlotsForDate(db, date, selectedStaff));
  return DEFAULT_BOOKING_SLOTS.filter(slot => !blockedSlots.has(slot));
}

function isPaystackConfigured() {
  return Boolean(String(PAYSTACK_SECRET_KEY || '').trim());
}

function isMonnifyConfigured() {
  return Boolean(String(MONNIFY_API_KEY || '').trim()) &&
    Boolean(String(MONNIFY_SECRET_KEY || '').trim()) &&
    Boolean(String(MONNIFY_CONTRACT_CODE || '').trim());
}

function getMonnifyBasicAuthHeader() {
  const apiKey = String(MONNIFY_API_KEY || '').trim();
  const secret = String(MONNIFY_SECRET_KEY || '').trim();
  const basicToken = Buffer.from(`${apiKey}:${secret}`).toString('base64');
  return `Basic ${basicToken}`;
}

async function monnifyGetAccessToken() {
  if (!isMonnifyConfigured()) {
    const err = new Error('Monnify credentials are not configured');
    err.code = 'MONNIFY_NOT_CONFIGURED';
    throw err;
  }

  const now = Date.now();
  // Keep a small buffer so we don't race with expiry.
  if (monnifyAccessTokenCache.token && monnifyAccessTokenCache.expiresAtMs > now + 30_000) {
    return monnifyAccessTokenCache.token;
  }

  const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      Authorization: getMonnifyBasicAuthHeader(),
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.requestSuccessful !== true || !data.responseBody || !data.responseBody.accessToken) {
    const err = new Error('Failed to authenticate with Monnify');
    err.code = 'MONNIFY_AUTH_FAILED';
    err.details = data;
    throw err;
  }

  const expiresInSeconds = Number(data.responseBody.expiresIn || 0);
  monnifyAccessTokenCache = {
    token: String(data.responseBody.accessToken),
    expiresAtMs: now + Math.max(0, expiresInSeconds) * 1000
  };

  return monnifyAccessTokenCache.token;
}

async function monnifyApiRequest(method, pathname, payload) {
  const token = await monnifyGetAccessToken();
  const url = `${MONNIFY_BASE_URL}${pathname}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: payload ? JSON.stringify(payload) : undefined
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return { ok: false, status: response.status, data };
  }

  return { ok: true, status: response.status, data };
}

async function monnifyQueryTransaction({ paymentReference, transactionReference }) {
  const token = await monnifyGetAccessToken();

  const ref = String(paymentReference || '').trim();
  const txRef = String(transactionReference || '').trim();
  if (!ref && !txRef) {
    const err = new Error('paymentReference or transactionReference is required');
    err.code = 'MONNIFY_MISSING_REFERENCE';
    throw err;
  }

  const query = ref
    ? `paymentReference=${encodeURIComponent(ref)}`
    : `transactionReference=${encodeURIComponent(txRef)}`;

  const response = await fetch(`${MONNIFY_BASE_URL}/api/v2/merchant/transactions/query?${query}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return { ok: false, status: response.status, data };
  }

  return { ok: true, status: response.status, data };
}

function computeMonnifyWebhookSignature(rawBodyBuffer) {
  const secret = String(MONNIFY_SECRET_KEY || '').trim();
  const raw = Buffer.isBuffer(rawBodyBuffer)
    ? rawBodyBuffer
    : Buffer.from(String(rawBodyBuffer || ''), 'utf8');

  return crypto.createHmac('sha512', secret).update(raw).digest('hex');
}

async function paystackRequest(pathname, payload) {
  if (!PAYSTACK_SECRET_KEY) {
    const err = new Error('Paystack secret key is not configured');
    err.code = 'PAYSTACK_NOT_CONFIGURED';
    throw err;
  }

  const response = await fetch(`https://api.paystack.co${pathname}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data
    };
  }

  return {
    ok: true,
    status: response.status,
    data
  };
}

function generateOneTimeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeOneTimeCode(code) {
  return String(code || '').replace(/\D/g, '').trim();
}

function normalizeTrackingToken(value) {
  return String(value || '')
    .trim()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeAdminRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (['super-admin', 'ops', 'support', 'inventory'].includes(normalized)) {
    return normalized;
  }
  // Backward compatibility for legacy admins without role field.
  return 'super-admin';
}

function getAdminRole(admin) {
  return normalizeAdminRole(admin && admin.role ? admin.role : 'super-admin');
}

function toPublicAdmin(admin) {
  return {
    id: admin && admin.id ? admin.id : '',
    email: admin && admin.email ? admin.email : '',
    name: admin && admin.name ? admin.name : '',
    role: getAdminRole(admin)
  };
}

function pushAuditLog(db, entry) {
  if (!db.settings || typeof db.settings !== 'object') {
    db.settings = {};
  }

  if (!Array.isArray(db.settings.auditLogs)) {
    db.settings.auditLogs = [];
  }

  db.settings.auditLogs.push({
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...entry
  });

  const maxEntries = 500;
  if (db.settings.auditLogs.length > maxEntries) {
    db.settings.auditLogs = db.settings.auditLogs.slice(db.settings.auditLogs.length - maxEntries);
  }
}

function isValidEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getPublicBaseUrlForRequest(req) {
  const explicitBase = String(PUBLIC_BASE_URL || '').trim();
  const explicitIsLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(explicitBase);
  if (hasExplicitPublicBaseUrl && explicitBase && !explicitIsLocalhost) {
    return explicitBase.replace(/\/+$/, '');
  }

  const forwardedProto = String(req && req.headers && req.headers['x-forwarded-proto'] ? req.headers['x-forwarded-proto'] : '')
    .split(',')[0]
    .trim();
  const forwardedHost = String(req && req.headers && req.headers['x-forwarded-host'] ? req.headers['x-forwarded-host'] : '')
    .split(',')[0]
    .trim();
  const host = forwardedHost || String(req && req.headers && req.headers.host ? req.headers.host : '').trim();
  const protocol = forwardedProto || String(req && req.protocol ? req.protocol : '').trim() || 'http';

  if (host) {
    return `${protocol}://${host}`;
  }

  return `http://localhost:${ACTIVE_PORT}`;
}

function buildColorfulEmailShell({ title, subtitle, bodyHtml, accent = '#8f2aa8' }) {
  const safeTitle = escapeHtml(title || 'CEO Unisex Salon');
  const safeSubtitle = escapeHtml(subtitle || 'Professional beauty services');
  const safeAccent = escapeHtml(String(accent || '#8f2aa8'));

  return `
    <div class="ceo-email-root" style="margin:0; padding:24px; background:linear-gradient(135deg,#f4f8ff 0%,#fff8fc 52%,#f8fff9 100%); font-family:'Segoe UI', Arial, sans-serif; line-height:1.6; color:#1f2937;">
      <style>
        @media (prefers-color-scheme: dark) {
          .ceo-email-root { background:#0b1220 !important; color:#e5e7eb !important; }
          .ceo-email-card { background:#111827 !important; border-color:#374151 !important; box-shadow:none !important; }
          .ceo-email-header { background:linear-gradient(135deg,#0f172a 0%, ${safeAccent} 60%, #be185d 100%) !important; }
          .ceo-email-body { background:#111827 !important; color:#e5e7eb !important; }
          .ceo-email-footer { background:#0f172a !important; border-top-color:#374151 !important; color:#cbd5e1 !important; }
          .ceo-email-body p,
          .ceo-email-body div,
          .ceo-email-body td,
          .ceo-email-body strong,
          .ceo-email-body li { color:inherit !important; }
        }
      </style>
      <div class="ceo-email-card" style="max-width:700px; margin:0 auto; border-radius:18px; overflow:hidden; border:1px solid #e5e7eb; background:#ffffff; box-shadow:0 16px 36px rgba(15,23,42,.10);">
        <div class="ceo-email-header" style="padding:20px 24px; background:linear-gradient(135deg,#1f2937 0%,${safeAccent} 58%,#ec4899 100%); color:#ffffff;">
          <div style="font-size:12px; letter-spacing:.6px; text-transform:uppercase; opacity:.96; font-weight:600;">CEO Unisex Salon</div>
          <h2 style="margin:8px 0 4px; font-size:24px; line-height:1.25; font-weight:700;">${safeTitle}</h2>
          <div style="font-size:13px; opacity:.94;">${safeSubtitle}</div>
        </div>
        <div class="ceo-email-body" style="padding:24px; background:#ffffff; color:#1f2937;">
          ${bodyHtml || ''}
        </div>
        <div class="ceo-email-footer" style="padding:12px 24px 18px; font-size:12px; color:#6b7280; border-top:1px solid #f3f4f6; background:#fcfcfd;">
          This is an automated message from CEO Unisex Salon. If you need help, please contact support.
        </div>
      </div>
    </div>
  `;
}

function buildEmailInfoTable(rows = []) {
  const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const rowHtml = safeRows.map((row) => {
    const label = escapeHtml(String(row.label || '').trim());
    const value = row.valueHtml != null
      ? String(row.valueHtml)
      : escapeHtml(String(row.value || '').trim());

    return `<tr><td style="padding:10px 12px; background:#f9fafb; width:42%; font-weight:600; color:#374151;">${label}</td><td style="padding:10px 12px; color:#111827;">${value}</td></tr>`;
  }).join('');

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">${rowHtml}</table>`;
}

function buildEmailActionButton({ href, label, bg = '#1d4ed8' }) {
  const safeHref = escapeHtml(String(href || '').trim());
  const safeLabel = escapeHtml(String(label || 'Open').trim());
  const safeBg = escapeHtml(String(bg || '#1d4ed8').trim());
  return `<a href="${safeHref}" target="_blank" rel="noopener" style="display:inline-block; padding:10px 14px; background:${safeBg}; color:#fff; text-decoration:none; border-radius:8px; font-weight:600;">${safeLabel}</a>`;
}

function buildInvoicePdfBuffer({
  invoiceTitle,
  invoiceNumber,
  customerName,
  details = [],
  totals = []
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentWidth = right - left;

      doc.roundedRect(left, 44, contentWidth, 78, 10).fillAndStroke('#f8fafc', '#e5e7eb');
      doc.fillColor('#1f2937').fontSize(20).text('CEO Unisex Salon', left + 16, 60, { width: contentWidth - 32 });
      doc.fillColor('#374151').fontSize(14).text(String(invoiceTitle || 'Invoice'), left + 16, 86, { width: contentWidth - 32 });

      doc.fillColor('#111827').fontSize(10);
      doc.text(`Invoice Number: ${String(invoiceNumber || 'N/A')}`, left, 142);
      doc.text(`Customer: ${String(customerName || 'Customer')}`, left, 158);
      doc.text(`Generated: ${new Date().toLocaleString()}`, left, 174);

      let y = 206;
      doc.fillColor('#4b5563').fontSize(11).text('DETAILS', left, y);
      y += 16;

      details.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const label = `${String(item.label || '').trim()}:`;
        const value = String(item.value || '').trim();
        doc.fillColor('#111827').fontSize(10).text(label, left, y, { continued: true });
        doc.fillColor('#374151').fontSize(10).text(` ${value}`);
        y += 14;
      });

      y += 10;
      doc.fillColor('#4b5563').fontSize(11).text('TOTALS', left, y);
      y += 14;
      doc.moveTo(left, y).lineTo(right, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
      y += 8;

      const totalKeyRegex = /^(total|amount due now)$/i;
      totals.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const label = String(item.label || '').trim();
        const value = String(item.value || '').trim();
        const isKeyTotal = totalKeyRegex.test(label);

        doc.fillColor(isKeyTotal ? '#111827' : '#374151').fontSize(isKeyTotal ? 11 : 10).text(label, left, y, {
          width: Math.floor(contentWidth * 0.6)
        });
        doc.fillColor(isKeyTotal ? '#0f766e' : '#111827').fontSize(isKeyTotal ? 11 : 10).text(value, left + Math.floor(contentWidth * 0.6), y, {
          width: Math.floor(contentWidth * 0.4),
          align: 'right'
        });
        y += 14;
      });

      y += 10;
      doc.roundedRect(left, y, contentWidth, 34, 8).fillAndStroke('#f0fdf4', '#bbf7d0');
      doc.fillColor('#166534').fontSize(10).text('Thank you for choosing CEO Unisex Salon.', left + 12, y + 11, {
        width: contentWidth - 24
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function resolveBookingByLookup(db, lookupToken) {
  const normalizedLookup = String(lookupToken || '').trim();
  const normalizedCode = normalizedLookup.toUpperCase();
  return (db.bookings || []).find(b => String(b.id) === normalizedLookup)
    || (db.bookings || []).find(b => getBookingTrackingCode(b) === normalizedCode)
    || null;
}

function resolveProductOrderByLookup(db, lookupToken) {
  const normalizedLookup = String(lookupToken || '').trim();
  const normalizedCode = normalizedLookup.toUpperCase();
  return (db.productOrders || []).find(o => String(o.id) === normalizedLookup)
    || (db.productOrders || []).find(o => String(o.orderCode || '').trim().toUpperCase() === normalizedCode)
    || null;
}

function createInvoiceAccessToken({ resourceType, lookupCode, email }) {
  const normalizedType = String(resourceType || '').trim().toLowerCase();
  const normalizedLookupCode = String(lookupCode || '').trim().toUpperCase();
  const normalizedEmail = normalizeEmail(email);

  return jwt.sign(
    {
      typ: 'invoice_access',
      resourceType: normalizedType,
      lookupCode: normalizedLookupCode,
      email: normalizedEmail
    },
    INVOICE_ACCESS_TOKEN_SECRET,
    { expiresIn: INVOICE_ACCESS_TOKEN_TTL_SECONDS }
  );
}

function verifyInvoiceAccessToken({ token, resourceType, lookupCode, email }) {
  try {
    const decoded = jwt.verify(String(token || '').trim(), INVOICE_ACCESS_TOKEN_SECRET);
    if (!decoded || typeof decoded !== 'object') return false;

    const tokenType = String(decoded.typ || '').trim().toLowerCase();
    const tokenResourceType = String(decoded.resourceType || '').trim().toLowerCase();
    const tokenLookupCode = String(decoded.lookupCode || '').trim().toUpperCase();
    const tokenEmail = normalizeEmail(decoded.email);

    const expectedType = String(resourceType || '').trim().toLowerCase();
    const expectedLookupCode = String(lookupCode || '').trim().toUpperCase();
    const expectedEmail = normalizeEmail(email);

    if (tokenType !== 'invoice_access') return false;
    if (tokenResourceType !== expectedType) return false;
    if (tokenLookupCode !== expectedLookupCode) return false;
    if (tokenEmail !== expectedEmail) return false;

    return true;
  } catch (error) {
    return false;
  }
}

function buildBookingInvoicePayload(booking) {
  const bookingId = String(booking && booking.id ? booking.id : '').trim();
  const invoiceNo = String(booking && booking.invoiceNumber ? booking.invoiceNumber : '').trim()
    || `INV-SVC-${bookingId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'N/A'}`;
  const customerName = String(booking && booking.name ? booking.name : 'Customer').trim();
  const serviceName = String(booking && booking.serviceName ? booking.serviceName : 'Salon Service').trim();
  const when = `${String(booking && booking.date ? booking.date : '').trim()}${String(booking && booking.time ? booking.time : '').trim() ? ` at ${String(booking.time).trim()}` : ''}`.trim() || 'N/A';
  const paymentMethod = String(booking && booking.paymentMethod ? booking.paymentMethod : 'N/A').trim();
  const paymentPlan = String(booking && booking.paymentPlan ? booking.paymentPlan : 'N/A').trim();
  const subtotal = Number(booking && booking.price ? booking.price : 0);
  const dueNow = Number(booking && booking.amountDueNow ? booking.amountDueNow : 0);
  const remaining = Number(booking && booking.amountRemaining ? booking.amountRemaining : 0);
  const productsTotal = Number(booking && booking.requestedProductsTotal ? booking.requestedProductsTotal : 0);
  const total = Number(subtotal + productsTotal || dueNow + remaining || 0);
  const trackingCode = getBookingTrackingCode(booking || {});

  return {
    invoiceNo,
    customerName,
    details: [
      { label: 'Booking ID', value: bookingId || 'N/A' },
      { label: 'Tracking Code', value: trackingCode },
      { label: 'Service', value: serviceName },
      { label: 'Scheduled', value: when },
      { label: 'Payment Method', value: paymentMethod },
      { label: 'Payment Plan', value: paymentPlan }
    ],
    totals: [
      { label: 'Service Subtotal', value: `₦${subtotal.toLocaleString()}` },
      { label: 'Products Total', value: `₦${productsTotal.toLocaleString()}` },
      { label: 'Total', value: `₦${total.toLocaleString()}` },
      { label: 'Amount Due Now', value: `₦${dueNow.toLocaleString()}` },
      { label: 'Amount Remaining', value: `₦${remaining.toLocaleString()}` }
    ]
  };
}

function buildProductOrderInvoicePayload(order) {
  const orderId = String(order && order.id ? order.id : '').trim();
  const orderCode = String(order && order.orderCode ? order.orderCode : orderId || 'N/A').trim();
  const invoiceNo = String(order && order.invoiceNumber ? order.invoiceNumber : '').trim()
    || `INV-PRD-${orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'N/A'}`;
  const customerName = String(order && order.name ? order.name : 'Customer').trim();
  const paymentMethod = String(order && order.paymentMethod ? order.paymentMethod : 'N/A').trim();
  const deliverySpeed = String(order && order.deliverySpeed ? order.deliverySpeed : 'standard').toUpperCase();
  const subtotal = Number(order && order.itemsSubtotal ? order.itemsSubtotal : 0);
  const deliveryFee = Number(order && order.deliveryFee ? order.deliveryFee : 0);
  const total = Number(order && order.totalAmount ? order.totalAmount : 0);
  const amountDueNow = Number(order && order.amountDueNow ? order.amountDueNow : total);
  const items = Array.isArray(order && order.items) ? order.items : [];

  return {
    invoiceNo,
    customerName,
    details: [
      { label: 'Order Code', value: orderCode },
      { label: 'Order ID', value: orderId || 'N/A' },
      { label: 'Payment Method', value: paymentMethod },
      { label: 'Delivery Speed', value: deliverySpeed },
      { label: 'Items', value: items.length ? items.map(item => `${item.name} x ${item.quantity}`).join(', ') : 'No item lines' }
    ],
    totals: [
      { label: 'Subtotal', value: `₦${subtotal.toLocaleString()}` },
      { label: 'Delivery Fee', value: `₦${deliveryFee.toLocaleString()}` },
      { label: 'Total', value: `₦${total.toLocaleString()}` },
      { label: 'Amount Due Now', value: `₦${amountDueNow.toLocaleString()}` }
    ]
  };
}

function isGrokConfigured() {
  return Boolean(String(GROK_API_KEY || '').trim());
}

function extractAdminToken(req) {
  const authHeader = String(req.headers.authorization || '').trim();

  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  if (req.headers['x-admin-token']) {
    return String(req.headers['x-admin-token']).trim();
  }

  if (req.body && req.body.token) {
    return String(req.body.token).trim();
  }

  return '';
}

function validateAdminToken(token, db) {
  if (!token) {
    return null;
  }

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [email, id] = decoded.split(':');

    if (!email || !id) {
      return null;
    }

    const normalizedDecodedEmail = normalizeEmail(email);

    return db.admins.find(a => normalizeEmail(a.email) === normalizedDecodedEmail && String(a.id) === String(id)) || null;
  } catch (error) {
    return null;
  }
}

function requireAdminAuth(req, res, next) {
  const db = readDatabase();

  if (db.admins.length === 0) {
    return res.status(401).json({ error: 'No admin account configured yet' });
  }

  const token = extractAdminToken(req);
  const admin = validateAdminToken(token, db);

  if (!admin) {
    return res.status(401).json({ error: 'Unauthorized admin access' });
  }

  req.admin = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: getAdminRole(admin)
  };

  next();
}

function requireAdminRole(allowedRoles = []) {
  const allowed = new Set((Array.isArray(allowedRoles) ? allowedRoles : []).map((role) => normalizeAdminRole(role)));

  return (req, res, next) => {
    const role = normalizeAdminRole(req && req.admin ? req.admin.role : '');
    if (!allowed.has(role)) {
      return res.status(403).json({
        error: 'You do not have permission to perform this action',
        requiredRoles: Array.from(allowed),
        currentRole: role
      });
    }
    return next();
  };
}

function writeDatabase(data) {
  const normalized = normalizeDatabaseObject(data);

  if (isMongoPrimaryEnabled()) {
    mongoPrimaryCache = normalized;
    mongoPrimaryCacheLoadedAt = Date.now();
  }

  if (isPrismaPrimaryEnabled()) {
    prismaPrimaryCache = normalized;
    prismaPrimaryCacheLoadedAt = Date.now();
  }

  writeDatabaseFile(normalized);
  triggerMongoMirrorSync(normalized);
  // Keep Prisma mirror in sync (non-blocking) when DATABASE_URL is configured.
  triggerPrismaMirrorSync(normalized);
}

// Initialize database on startup
initializeDatabase();
// Ensure JSON structure defaults are normalized, then warm remote mirrors.
const startupDbSnapshot = readDatabaseFromJsonDisk();
if (isMongoPrimaryEnabled()) {
  mongoPrimaryCache = startupDbSnapshot;
  mongoPrimaryCacheLoadedAt = Date.now();
  refreshMongoPrimaryCache();
}
if (isPrismaPrimaryEnabled()) {
  prismaPrimaryCache = startupDbSnapshot;
  prismaPrimaryCacheLoadedAt = Date.now();
  refreshPrismaPrimaryCache();
}
triggerPrismaMirrorSync(startupDbSnapshot);

// Routes

// Admin Dashboard Routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(FRONTEND_PUBLIC_DIR, 'index.html'));
});

app.get('/admin.html', (req, res) => {
  res.redirect('/admin');
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(FRONTEND_PUBLIC_DIR, 'index.html'));
});

// Get all services
app.get('/api/services', (req, res) => {
  const db = readDatabase();
  res.json(db.services);
});

// Get all products
app.get('/api/products', (req, res) => {
  const db = readDatabase();
  res.json(sortProductsForDisplay(db.products));
});

// Get booking staff list (Customer)
app.get('/api/bookings/staff', (req, res) => {
  const db = readDatabase();
  return res.json({ staff: getBookingStaffList(db) });
});

// Get available booking time slots for a date (Customer)
app.get('/api/bookings/available-slots', (req, res) => {
  const date = normalizeSlotDate(req.query.date);
  const selectedStaff = normalizeStaffName(req.query.staff);

  if (!date) {
    return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required' });
  }

  const db = readDatabase();
  const blockedSlots = computeBlockedSlotsForDate(db, date, selectedStaff);
  const slots = computeAvailableSlotsForDate(db, date, selectedStaff);

  return res.json({
    date,
    selectedStaff,
    staff: getBookingStaffList(db),
    slots,
    blockedSlots,
    totalSlots: DEFAULT_BOOKING_SLOTS.length,
    availableCount: slots.length
  });
});

// Create product order (Customer)
app.post('/api/product-orders', async (req, res) => {
  const {
    name,
    email,
    phone,
    address,
    paymentMethod,
    items,
    deliverySpeed
  } = req.body || {};

  const normalizedName = String(name || '').trim();
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  const normalizedAddress = String(address || '').trim();
  const normalizedPaymentMethod = String(paymentMethod || '').trim();
  const normalizedItems = Array.isArray(items) ? items : [];
  const normalizedDeliverySpeed = normalizeDeliverySpeed(deliverySpeed);

  if (!normalizedName || !normalizedEmail || !normalizedPhone || !normalizedAddress || !normalizedPaymentMethod) {
    return res.status(400).json({ error: 'name, email, phone, address and paymentMethod are required' });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  if (!normalizedItems.length) {
    return res.status(400).json({ error: 'At least one product item is required' });
  }

  const db = readDatabase();
  const orderItems = [];
  let itemsSubtotal = 0;

  for (const item of normalizedItems) {
    const productId = Number(item && item.productId);
    const qty = Math.max(1, Number(item && item.quantity) || 0);
    const product = db.products.find(p => Number(p.id) === productId);

    if (!product) {
      return res.status(400).json({ error: `Product not found (id: ${productId})` });
    }

    const stock = Number(product.stock || 0);
    if (qty > stock) {
      return res.status(400).json({ error: `Insufficient stock for ${product.name}. Available: ${stock}` });
    }

    const unitPrice = Number(product.price || 0);
    const lineTotal = unitPrice * qty;
    itemsSubtotal += lineTotal;

    orderItems.push({
      productId: Number(product.id),
      name: String(product.name || ''),
      category: String(product.category || ''),
      unitPrice,
      quantity: qty,
      lineTotal
    });
  }

  if (itemsSubtotal <= 0) {
    return res.status(400).json({ error: 'Order amount must be greater than zero' });
  }

  const deliveryFee = getProductOrderDeliveryFee(normalizedDeliverySpeed, db);
  const totalAmount = itemsSubtotal + deliveryFee;

  // Reserve stock at checkout submission.
  for (const line of orderItems) {
    const product = db.products.find(p => Number(p.id) === Number(line.productId));
    if (product) {
      product.stock = Math.max(0, Number(product.stock || 0) - Number(line.quantity || 0));
      product.updatedAt = new Date().toISOString();
    }
  }

  const order = {
    id: uuidv4(),
    orderCode: `ORD-${Date.now().toString(36).toUpperCase()}`,
    name: normalizedName,
    email: normalizedEmail,
    phone: normalizedPhone,
    address: normalizedAddress,
    paymentMethod: normalizedPaymentMethod,
    items: orderItems,
    itemsSubtotal,
    deliveryFee,
    totalAmount,
    amountDueNow: totalAmount,
    amountRemaining: totalAmount,
    paymentStatus: 'pending',
    paymentProvider: '',
    paymentReference: '',
    paidAmount: 0,
    bankTransferReference: '',
    deliverySpeed: normalizedDeliverySpeed,
    statusTimestamps: {
      createdAt: new Date().toISOString()
    },
    status: normalizeProductOrderStatus('pending'),
    createdAt: new Date().toISOString()
  };

  if (normalizedPaymentMethod === 'Bank Transfer') {
    order.bankTransferReference = `CEOSALOON-PROD-${String(order.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`;
  }

  db.productOrders.push(order);

  addProductOrderNotification(
    db,
    order,
    'order_created',
    `🧾 Your order (${order.orderCode}) has been received and is pending review. Delivery speed: ${order.deliverySpeed}.`
  );

  let adminEmailResult = null;
  let orderInvoiceEmail = null;
  try {
    if (SEND_ADMIN_NEW_BOOKING_EMAILS && isSmtpConfigured() && Array.isArray(db.admins) && db.admins.length) {
      const recipients = Array.from(new Set(db.admins.map(a => normalizeEmail(a.email)).filter(Boolean)));
      if (recipients.length) {
        const itemsHtml = order.items.map(i => `<li>${String(i.name).replace(/</g,'&lt;').replace(/>/g,'&gt;')} × ${i.quantity} — ₦${Number(i.lineTotal || 0).toLocaleString()}</li>`).join('');
        const text = `New product order received.\n\nOrder ID: ${order.id}\nCustomer: ${order.name}\nEmail: ${order.email}\nPhone: ${order.phone}\nTotal: ₦${Number(order.totalAmount || 0).toLocaleString()}\nPayment Method: ${order.paymentMethod}\nDelivery Speed: ${order.deliverySpeed}`;
        const html = `
          <div style="font-family: Arial, sans-serif; line-height:1.5;">
            <h2 style="margin:0 0 10px; color:#4a0e4e;">🛒 New Product Order</h2>
            <p><strong>Order ID:</strong> ${String(order.id).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
            <p><strong>Customer:</strong> ${String(order.name).replace(/</g,'&lt;').replace(/>/g,'&gt;')} (${String(order.email).replace(/</g,'&lt;').replace(/>/g,'&gt;')})</p>
            <p><strong>Phone:</strong> ${String(order.phone).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
            <p><strong>Address:</strong> ${String(order.address).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
            <p><strong>Payment Method:</strong> ${String(order.paymentMethod).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
            <p><strong>Delivery Speed:</strong> ${String(order.deliverySpeed).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
            <p><strong>Total:</strong> ₦${Number(order.totalAmount || 0).toLocaleString()}</p>
            <p><strong>Items:</strong></p>
            <ul>${itemsHtml}</ul>
          </div>
        `;

        await sendEmail({
          to: recipients.join(','),
          subject: `New Product Order - ${order.orderCode} (${order.id})`,
          text,
          html,
          replyTo: order.email
        });

        order.adminOrderEmailSentAt = new Date().toISOString();
        order.adminOrderEmailRecipients = recipients;
        adminEmailResult = { sent: true, recipients };
      }
    }
  } catch (e) {
    adminEmailResult = { sent: false, error: true, reason: e && e.message ? String(e.message) : 'Failed to notify admins' };
  }

  try {
    orderInvoiceEmail = await maybeSendProductOrderInvoiceEmail({ order });
  } catch (e) {
    orderInvoiceEmail = { sent: false, error: true, reason: e && e.message ? String(e.message) : 'Failed to send invoice email' };
  }

  writeDatabase(db);

  return res.status(201).json({
    message: `Product order created successfully. Order ID: ${order.id}`,
    notifications: {
      adminEmail: adminEmailResult,
      invoiceEmail: orderInvoiceEmail
    },
    paymentBankDetails: normalizedPaymentMethod === 'Bank Transfer'
      ? {
          bankName: SALON_BANK_NAME,
          accountNumber: SALON_BANK_ACCOUNT_NUMBER,
          accountName: SALON_BANK_ACCOUNT_NAME,
          reference: order.bankTransferReference,
          amountDueNow: order.amountDueNow
        }
      : null,
    order
  });
});

// Product order delivery fee configuration (Customer)
app.get('/api/product-orders/delivery-fees', (req, res) => {
  const db = readDatabase();
  const speed = String(req.query.deliverySpeed || '').trim();
  const normalizedSpeed = normalizeDeliverySpeed(speed);

  const fees = getProductDeliveryFeeSettings(db);

  return res.json({
    fees,
    selectedSpeed: normalizedSpeed,
    selectedFee: fees[normalizedSpeed]
  });
});

// Product order delivery fee configuration (Admin)
app.get('/api/admin/product-orders/delivery-fees', requireAdminAuth, (req, res) => {
  const db = readDatabase();
  return res.json({
    fees: getProductDeliveryFeeSettings(db)
  });
});

app.put('/api/admin/product-orders/delivery-fees', requireAdminAuth, requireAdminRole(['super-admin']), (req, res) => {
  const db = readDatabase();
  const previousFees = getProductDeliveryFeeSettings(db);
  const standardRaw = Number(req.body && req.body.standard);
  const expressRaw = Number(req.body && req.body.express);

  if (!Number.isFinite(standardRaw) || !Number.isFinite(expressRaw)) {
    return res.status(400).json({ error: 'standard and express delivery fees must be valid numbers' });
  }

  const standard = Math.max(0, standardRaw);
  const express = Math.max(0, expressRaw);

  if (!db.settings || typeof db.settings !== 'object') {
    db.settings = {};
  }

  db.settings.productDeliveryFees = { standard, express };
  pushAuditLog(db, {
    actor: toPublicAdmin(req.admin),
    action: 'update_delivery_fees',
    targetType: 'settings',
    targetId: 'productDeliveryFees',
    before: previousFees,
    after: db.settings.productDeliveryFees
  });
  writeDatabase(db);

  return res.json({
    message: 'Product delivery fees updated successfully',
    fees: db.settings.productDeliveryFees
  });
});

// Track product order by order code + email (Customer)
app.get('/api/product-orders/track', async (req, res) => {
  const orderCode = normalizeTrackingToken(req.query.orderCode);
  const email = normalizeEmail(req.query.email);

  if (!orderCode || !email) {
    return res.status(400).json({ error: 'orderCode and email are required' });
  }

  const db = readDatabase();
  const order = (db.productOrders || []).find(o => String(o.orderCode || '').trim().toUpperCase() === orderCode)
    || (db.productOrders || []).find(o => String(o.id || '').trim().toUpperCase() === orderCode);

  if (!order) {
    return res.status(404).json({ error: 'Product order not found' });
  }

  if (normalizeEmail(order.email) !== email) {
    return res.status(401).json({ error: 'Email does not match this product order' });
  }

  const autoAdvanced = await maybeAutoAdvanceProductOrderDelivery(db, order);
  if (autoAdvanced) {
    writeDatabase(db);
  }

  const notifications = (db.productOrderNotifications || [])
    .filter(n => String(n.orderId) === String(order.id))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return res.json({
    order: {
      id: order.id,
      orderCode: order.orderCode,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      itemsSubtotal: Number(order.itemsSubtotal || 0),
      deliveryFee: Number(order.deliveryFee || 0),
      totalAmount: order.totalAmount,
      amountDueNow: order.amountDueNow,
      amountRemaining: order.amountRemaining,
      paidAmount: order.paidAmount,
      paymentProvider: order.paymentProvider,
      paymentReference: order.paymentReference,
      bankTransferReference: order.bankTransferReference,
      deliverySpeed: order.deliverySpeed,
      shippedAt: order.shippedAt || null,
      onTheWayAt: order.onTheWayAt || null,
      deliveredAt: order.deliveredAt || null,
      items: Array.isArray(order.items) ? order.items : [],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt || null
    },
    notifications
  });
});

// Track product order by id OR order code (legacy/customer convenience)
app.get('/api/product-orders/:id/track', async (req, res) => {
  const lookupToken = String(req.params.id || '').trim();
  const lookupCode = lookupToken.toUpperCase();
  const email = normalizeEmail(req.query.email);

  if (!lookupToken || !email) {
    return res.status(400).json({ error: 'Order id/code and email are required' });
  }

  const db = readDatabase();
  const order = (db.productOrders || []).find(o => String(o.id) === lookupToken)
    || (db.productOrders || []).find(o => String(o.orderCode || '').trim().toUpperCase() === lookupCode);

  if (!order) {
    return res.status(404).json({ error: 'Product order not found' });
  }

  if (normalizeEmail(order.email) !== email) {
    return res.status(401).json({ error: 'Email does not match this product order' });
  }

  const autoAdvanced = await maybeAutoAdvanceProductOrderDelivery(db, order);
  if (autoAdvanced) {
    writeDatabase(db);
  }

  const notifications = (db.productOrderNotifications || [])
    .filter(n => String(n.orderId) === String(order.id))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return res.json({ order, notifications });
});

// Issue secure invoice link token (Customer)
app.post('/api/invoices/access-link', (req, res) => {
  const resourceType = String(req.body && req.body.resourceType ? req.body.resourceType : '').trim().toLowerCase();
  const code = String(req.body && req.body.code ? req.body.code : '').trim();
  const email = normalizeEmail(req.body && req.body.email ? req.body.email : '');

  if (!['booking', 'product'].includes(resourceType)) {
    return res.status(400).json({ error: 'resourceType must be booking or product' });
  }

  if (!code || !email) {
    return res.status(400).json({ error: 'code and email are required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }

  const db = readDatabase();
  const runtimeBaseUrl = getPublicBaseUrlForRequest(req);

  if (resourceType === 'booking') {
    const booking = resolveBookingByLookup(db, code);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (normalizeEmail(booking.email) !== email) {
      return res.status(401).json({ error: 'Email does not match this booking' });
    }

    const lookupCode = String(booking.trackingCode || booking.id || code).trim().toUpperCase();
    const token = createInvoiceAccessToken({
      resourceType: 'booking',
      lookupCode,
      email
    });

    const pathOnly = `/api/bookings/${encodeURIComponent(lookupCode)}/invoice?token=${encodeURIComponent(token)}`;
    return res.json({
      secureInvoiceUrl: `${runtimeBaseUrl}${pathOnly}`,
      path: pathOnly,
      expiresInSeconds: INVOICE_ACCESS_TOKEN_TTL_SECONDS
    });
  }

  const order = resolveProductOrderByLookup(db, code);
  if (!order) {
    return res.status(404).json({ error: 'Product order not found' });
  }
  if (normalizeEmail(order.email) !== email) {
    return res.status(401).json({ error: 'Email does not match this product order' });
  }

  const lookupCode = String(order.orderCode || order.id || code).trim().toUpperCase();
  const token = createInvoiceAccessToken({
    resourceType: 'product',
    lookupCode,
    email
  });

  const pathOnly = `/api/product-orders/${encodeURIComponent(lookupCode)}/invoice?token=${encodeURIComponent(token)}`;
  return res.json({
    secureInvoiceUrl: `${runtimeBaseUrl}${pathOnly}`,
    path: pathOnly,
    expiresInSeconds: INVOICE_ACCESS_TOKEN_TTL_SECONDS
  });
});

// Download product order invoice PDF (Customer)
app.get('/api/product-orders/:id/invoice', async (req, res) => {
  const lookupToken = String(req.params.id || '').trim();
  const email = normalizeEmail(req.query.email);
  const token = String(req.query.token || '').trim();

  if (!lookupToken || (!email && !token)) {
    return res.status(400).json({ error: 'Order id/code and either email or token are required' });
  }

  const db = readDatabase();
  const order = resolveProductOrderByLookup(db, lookupToken);

  if (!order) {
    return res.status(404).json({ error: 'Product order not found' });
  }

  const ownerEmail = normalizeEmail(order.email);
  const canonicalLookupCode = String(order.orderCode || order.id || lookupToken).trim().toUpperCase();
  const authorizedByToken = token
    ? verifyInvoiceAccessToken({
        token,
        resourceType: 'product',
        lookupCode: canonicalLookupCode,
        email: ownerEmail
      })
    : false;

  const authorizedByEmail = email && ownerEmail === email;

  if (!authorizedByToken && !authorizedByEmail) {
    return res.status(401).json({ error: 'Unauthorized invoice access' });
  }

  try {
    const payload = buildProductOrderInvoicePayload(order);
    const pdfBuffer = await buildInvoicePdfBuffer({
      invoiceTitle: 'Product Order Invoice',
      invoiceNumber: payload.invoiceNo,
      customerName: payload.customerName,
      details: payload.details,
      totals: payload.totals
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${payload.invoiceNo}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to generate product invoice PDF',
      details: error && error.message ? String(error.message) : undefined
    });
  }
});

// Get all products (Admin)
app.get('/api/admin/products', requireAdminAuth, (req, res) => {
  const db = readDatabase();
  res.json(sortProductsForDisplay(db.products));
});

// Create product (Admin)
app.post('/api/admin/products', requireAdminAuth, requireAdminRole(['super-admin', 'inventory']), upload.single('productImage'), (req, res) => {
  const { name, category, price, stock } = req.body;
  const normalizedName = String(name || '').trim();
  const normalizedCategory = String(category || '').trim();
  const normalizedPrice = Number(price);
  const normalizedStock = Number(stock);

  if (!normalizedName || !normalizedCategory || Number.isNaN(normalizedPrice) || Number.isNaN(normalizedStock)) {
    return res.status(400).json({ error: 'Name, category, price, and stock are required' });
  }

  const db = readDatabase();
  const nextId = db.products.length ? Math.max(...db.products.map(p => Number(p.id) || 0)) + 1 : 1;

  const product = {
    id: nextId,
    name: normalizedName,
    category: normalizedCategory,
    price: normalizedPrice,
    stock: normalizedStock,
    image: req.file ? `/uploads/${req.file.filename}` : null,
    createdAt: new Date().toISOString()
  };

  db.products.unshift(product);
  pushAuditLog(db, {
    actor: toPublicAdmin(req.admin),
    action: 'create_product',
    targetType: 'product',
    targetId: String(product.id),
    after: {
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock
    }
  });
  writeDatabase(db);

  res.status(201).json({ message: 'Product added successfully', product });
});

// Update product image (Admin)
app.put('/api/admin/products/:id/image', requireAdminAuth, requireAdminRole(['super-admin', 'inventory']), upload.single('productImage'), (req, res) => {
  const productId = Number(req.params.id);

  if (!req.file) {
    return res.status(400).json({ error: 'Product image file is required' });
  }

  const db = readDatabase();
  const product = db.products.find(p => Number(p.id) === productId);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const beforeImage = String(product.image || '');
  product.image = `/uploads/${req.file.filename}`;
  product.updatedAt = new Date().toISOString();
  pushAuditLog(db, {
    actor: toPublicAdmin(req.admin),
    action: 'update_product_image',
    targetType: 'product',
    targetId: String(product.id),
    before: { image: beforeImage },
    after: { image: product.image }
  });
  writeDatabase(db);

  res.json({ message: 'Product image updated successfully', product });
});

// Delete product (Admin)
app.delete('/api/admin/products/:id', requireAdminAuth, requireAdminRole(['super-admin', 'inventory']), (req, res) => {
  const productId = Number(req.params.id);
  const db = readDatabase();
  const existingProduct = db.products.find(p => Number(p.id) === productId) || null;
  const existingCount = db.products.length;

  db.products = db.products.filter(p => Number(p.id) !== productId);

  if (db.products.length === existingCount) {
    return res.status(404).json({ error: 'Product not found' });
  }

  pushAuditLog(db, {
    actor: toPublicAdmin(req.admin),
    action: 'delete_product',
    targetType: 'product',
    targetId: String(productId),
    before: existingProduct
  });
  writeDatabase(db);
  res.json({ message: 'Product deleted successfully' });
});

// Get Weather Data
app.get('/api/weather', async (req, res) => {
  try {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=6.5244&longitude=3.3792&current=temperature_2m,weather_code'
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
});

// Grok chatbot (Customer)
app.post('/api/grok/chat', async (req, res) => {
  const message = String(req.body && req.body.message ? req.body.message : '').trim();
  const history = Array.isArray(req.body && req.body.history) ? req.body.history : [];

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  // Dev-friendly fallback so chat UI still works when no key is configured.
  if (!isGrokConfigured()) {
    return res.json({
      provider: 'local-fallback',
      configured: false,
      reply: `I can help with your salon booking. You said: "${message}".\n\nTo enable live Grok replies, add GROK_API_KEY to your .env and restart the server.`
    });
  }

  try {
    const priorMessages = history
      .filter(item => item && typeof item === 'object')
      .map(item => {
        const role = String(item.role || '').trim().toLowerCase();
        const content = String(item.content || '').trim();
        if (!content) return null;
        return {
          role: ['assistant', 'system'].includes(role) ? role : 'user',
          content
        };
      })
      .filter(Boolean)
      .slice(-12);

    const messages = [
      {
        role: 'system',
        content: 'You are the helpful virtual assistant for CEO Unisex Salon. Keep answers concise, friendly, and booking-focused.'
      },
      ...priorMessages,
      { role: 'user', content: message }
    ];

    const response = await fetch(`${GROK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages,
        temperature: 0.7
      })
    });

    const data = await response.json().catch(() => null);
    const reply = data && data.choices && data.choices[0] && data.choices[0].message
      ? String(data.choices[0].message.content || '').trim()
      : '';

    if (!response.ok || !reply) {
      return res.status(502).json({
        error: 'Failed to get response from Grok',
        details: data && data.error ? data.error : undefined
      });
    }

    return res.json({
      provider: 'xai-grok',
      configured: true,
      model: GROK_MODEL,
      reply
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Grok chat request failed',
      details: error && error.message ? String(error.message) : undefined
    });
  }
});

// Create booking
app.post('/api/bookings', upload.single('styleImage'), async (req, res) => {
  const {
    name,
    email,
    phone,
    serviceId,
    serviceIds,
    selectedStaff,
    date,
    time,
    language,
    paymentMethod,
    paymentPlan,
    homeServiceRequested,
    homeServiceAddress,
    refreshment,
    specialRequests,
    productSelections
  } = req.body;

  const normalizedPaymentPlan = String(paymentPlan || '').trim();
  const normalizedHomeServiceRequested = String(homeServiceRequested || '').trim().toLowerCase();
  const isHomeServiceRequested = normalizedHomeServiceRequested === 'true' || normalizedHomeServiceRequested === '1' || normalizedHomeServiceRequested === 'yes';
  const normalizedHomeServiceAddress = String(homeServiceAddress || '').trim();
  const hasServiceSelection =
    (serviceId !== undefined && serviceId !== null && String(serviceId).trim() !== '') ||
    (serviceIds !== undefined && serviceIds !== null && String(serviceIds).trim() !== '');
  const normalizedSelectedStaff = normalizeStaffName(selectedStaff);

  if (!name || !email || !phone || !date || !time || !paymentMethod || !normalizedPaymentPlan || !hasServiceSelection || !normalizedSelectedStaff) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const normalizedDate = normalizeSlotDate(date);
  const normalizedTime = normalizeSlotTime(time);
  if (!normalizedDate || !normalizedTime) {
    return res.status(400).json({ error: 'Please provide valid date/time values (YYYY-MM-DD and HH:MM)' });
  }

  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  if (!['full', 'deposit_50'].includes(normalizedPaymentPlan)) {
    return res.status(400).json({ error: 'Invalid payment plan. Use full or deposit_50.' });
  }

  if (isHomeServiceRequested && !normalizedHomeServiceAddress) {
    return res.status(400).json({ error: 'Home service address is required when requesting home service' });
  }

  const db = readDatabase();
  const staffList = getBookingStaffList(db);
  const isKnownStaff = staffList
    .map((item) => normalizeStaffName(item).toLowerCase())
    .includes(normalizedSelectedStaff.toLowerCase());

  if (!isKnownStaff) {
    return res.status(400).json({
      error: 'Selected staff is invalid. Please choose a listed staff member.',
      staff: staffList
    });
  }

  const availableSlots = computeAvailableSlotsForDate(db, normalizedDate, normalizedSelectedStaff);
  if (!availableSlots.includes(normalizedTime)) {
    return res.status(409).json({
      error: `Selected time slot is no longer available for ${normalizedSelectedStaff}. Please choose another time or staff.`,
      availableSlots,
      selectedStaff: normalizedSelectedStaff,
      staff: staffList
    });
  }

  let parsedServiceIds = [];
  try {
    const rawServiceIds = serviceIds !== undefined && serviceIds !== null && String(serviceIds).trim() !== ''
      ? (typeof serviceIds === 'string' ? JSON.parse(serviceIds) : serviceIds)
      : [];

    if (Array.isArray(rawServiceIds)) {
      parsedServiceIds = rawServiceIds
        .map(item => Number(item))
        .filter(Number.isFinite)
        .map(item => Math.trunc(item))
        .filter(item => item > 0);
    }
  } catch (error) {
    return res.status(400).json({ error: 'Invalid serviceIds format' });
  }

  if (!parsedServiceIds.length && serviceId !== undefined && serviceId !== null && String(serviceId).trim() !== '') {
    const normalizedPrimaryServiceId = Math.trunc(Number(serviceId));
    if (Number.isFinite(normalizedPrimaryServiceId) && normalizedPrimaryServiceId > 0) {
      parsedServiceIds = [normalizedPrimaryServiceId];
    }
  }

  parsedServiceIds = Array.from(new Set(parsedServiceIds));

  if (!parsedServiceIds.length) {
    return res.status(400).json({ error: 'Please select at least one service' });
  }

  const selectedServices = parsedServiceIds
    .map(id => db.services.find(s => Number(s.id) === Number(id)))
    .filter(Boolean);

  if (selectedServices.length !== parsedServiceIds.length) {
    return res.status(400).json({ error: 'One or more selected services were not found' });
  }

  const primaryService = selectedServices[0];
  const serviceSubtotal = selectedServices.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const totalDuration = selectedServices.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);

  let parsedProductSelections = [];
  if (productSelections !== undefined && productSelections !== null && String(productSelections).trim() !== '') {
    try {
      const rawSelections = typeof productSelections === 'string'
        ? JSON.parse(productSelections)
        : productSelections;

      if (!Array.isArray(rawSelections)) {
        return res.status(400).json({ error: 'productSelections must be an array' });
      }

      parsedProductSelections = rawSelections
        .map(item => ({
          productId: Number(item && item.productId),
          quantity: Math.max(1, Number(item && item.quantity) || 1)
        }))
        .filter(item => Number.isFinite(item.productId) && item.productId > 0);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid productSelections format' });
    }
  }

  const requestedProducts = [];
  let requestedProductsTotal = 0;

  for (const selection of parsedProductSelections) {
    const product = db.products.find(p => Number(p.id) === Number(selection.productId));
    if (!product) {
      return res.status(400).json({ error: `Selected product not found (id: ${selection.productId})` });
    }

    const stock = Number(product.stock || 0);
    if (selection.quantity > stock) {
      return res.status(400).json({ error: `Insufficient stock for ${product.name}. Available: ${stock}` });
    }

    const unitPrice = Number(product.price || 0);
    const lineTotal = unitPrice * selection.quantity;
    requestedProductsTotal += lineTotal;

    requestedProducts.push({
      productId: Number(product.id),
      name: String(product.name || ''),
      category: String(product.category || ''),
      unitPrice,
      quantity: selection.quantity,
      lineTotal
    });
  }

  const serviceAmountDueNow = normalizedPaymentPlan === 'deposit_50'
    ? Math.ceil(serviceSubtotal * 0.5)
    : serviceSubtotal;
  const amountDueNow = serviceAmountDueNow + requestedProductsTotal;
  const amountRemaining = Math.max(0, serviceSubtotal - serviceAmountDueNow);

  const booking = {
    id: uuidv4(),
    trackingCode: '',
    name,
    email: normalizedEmail,
    phone,
    serviceId: Number(primaryService.id),
    serviceIds: selectedServices.map(item => Number(item.id)),
    selectedServices: selectedServices.map(item => ({
      id: Number(item.id),
      name: String(item.name || ''),
      price: Number(item.price) || 0,
      duration: Number(item.duration) || 0
    })),
    serviceName: selectedServices.map(item => String(item.name || '')).join(', '),
    selectedStaff: normalizedSelectedStaff,
    price: serviceSubtotal,
    totalDuration,
    date: normalizedDate,
    time: normalizedTime,
    language: language || '',
    paymentMethod: paymentMethod || '',
    paymentPlan: normalizedPaymentPlan,
    amountDueNow,
    amountRemaining,
    paymentStatus: 'pending',
    paymentProvider: '',
    paymentReference: '',
    paidAmount: 0,
    bankTransferReference: '',
    serviceMode: isHomeServiceRequested ? 'home' : 'in_salon',
    homeServiceAddress: isHomeServiceRequested ? normalizedHomeServiceAddress : '',
    refreshment: refreshment || 'No',
    specialRequests: specialRequests || '',
    requestedProducts,
    requestedProductsTotal,
    hasProductRequest: requestedProducts.length > 0,
    styleImage: req.file ? `/uploads/${req.file.filename}` : null,
    // Image approval state (admin)
    imageApproved: false,
    imageApprovalStatus: req.file ? 'pending' : '',
    imageApprovedAt: '',
    imageRejectedAt: '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  booking.trackingCode = getBookingTrackingCode(booking);

  db.bookings.push(booking);

  if (String(booking.paymentMethod || '').trim() === 'Bank Transfer') {
    booking.bankTransferReference = buildBankTransferReference(booking.id);
    addBookingNotification(
      db,
      booking,
      'payment_instructions',
      `🏦 Bank Transfer Details: ${SALON_BANK_NAME} ${SALON_BANK_ACCOUNT_NUMBER} (${SALON_BANK_ACCOUNT_NAME}). Use reference: ${booking.bankTransferReference}. Amount due now: ₦${Number(booking.amountDueNow || 0).toLocaleString()}.`
    );
  }

  let adminBookingEmail = null;
  let trackingCodeEmail = null;
  let bookingInvoiceEmail = null;
  try {
    adminBookingEmail = await maybeSendAdminNewBookingEmail({ booking, db });
  } catch (error) {
    adminBookingEmail = {
      sent: false,
      error: true,
      reason: error && error.message ? String(error.message) : 'Failed to notify admins'
    };
    // Never block booking creation due to admin email errors.
  }

  try {
    trackingCodeEmail = await maybeSendBookingTrackingCodeEmail({ booking });
  } catch (error) {
    trackingCodeEmail = {
      sent: false,
      error: true,
      reason: error && error.message ? String(error.message) : 'Failed to send tracking code email'
    };
    // Never block booking creation due to tracking code email errors.
  }

  try {
    bookingInvoiceEmail = await maybeSendBookingInvoiceEmail({ booking });
  } catch (error) {
    bookingInvoiceEmail = {
      sent: false,
      error: true,
      reason: error && error.message ? String(error.message) : 'Failed to send booking invoice email'
    };
  }

  addBookingNotification(
    db,
    booking,
    'tracking_code_issued',
    `🔎 Your tracking code is ${booking.trackingCode}. Use it with your booking email to check approval status on the website.`
  );

  writeDatabase(db);

  res.status(201).json({
    message: `Your service order has been made. A customer care representative will reach out to you via the email and phone number provided. Booking ID: ${booking.id}. Payment: ${normalizedPaymentPlan === 'deposit_50' ? '50% deposit' : 'full'} (₦${amountDueNow.toLocaleString()} due now).`,
    trackingCode: booking.trackingCode,
    paymentBankDetails: String(booking.paymentMethod || '').trim() === 'Bank Transfer'
      ? {
          bankName: SALON_BANK_NAME,
          accountNumber: SALON_BANK_ACCOUNT_NUMBER,
          accountName: SALON_BANK_ACCOUNT_NAME,
          reference: booking.bankTransferReference,
          amountDueNow: booking.amountDueNow
        }
      : null,
    notifications: {
      adminEmail: adminBookingEmail,
      trackingCodeEmail,
      invoiceEmail: bookingInvoiceEmail
    },
    booking
  });
});

// Bank transfer payment details (Customer)
app.get('/api/payments/bank/details', (req, res) => {
  const bookingId = String(req.query.bookingId || '').trim();
  const email = normalizeEmail(req.query.email);

  if (!bookingId || !email) {
    return res.status(400).json({ error: 'bookingId and email are required' });
  }

  const db = readDatabase();
  const booking = db.bookings.find(b => String(b.id) === bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (normalizeEmail(booking.email) !== email) {
    return res.status(401).json({ error: 'Email does not match this booking' });
  }

  if (String(booking.paymentMethod || '').trim() !== 'Bank Transfer') {
    return res.status(400).json({ error: 'This booking is not set to Bank Transfer payment method' });
  }

  if (!booking.bankTransferReference) {
    booking.bankTransferReference = buildBankTransferReference(booking.id);
    writeDatabase(db);
  }

  res.json({
    bankName: SALON_BANK_NAME,
    accountNumber: SALON_BANK_ACCOUNT_NUMBER,
    accountName: SALON_BANK_ACCOUNT_NAME,
    reference: booking.bankTransferReference,
    amountDueNow: booking.amountDueNow,
    bookingId: booking.id
  });
});

// Paystack configuration status (Customer)
app.get('/api/payments/paystack/status', (req, res) => {
  const configured = isPaystackConfigured();
  const callbackUrl = `${PUBLIC_BASE_URL}/paystack-callback.html`;

  const key = String(PAYSTACK_SECRET_KEY || '').trim();
  const keyEnv = isLikelyPaystackLiveKey(key) ? 'live' : isLikelyPaystackTestKey(key) ? 'test' : 'unknown';

  res.json({
    configured,
    paymentsMode: PAYMENTS_MODE,
    keyEnv,
    callbackUrl,
    publicBaseUrl: PUBLIC_BASE_URL,
    message: configured
      ? 'Paystack is configured'
      : 'Paystack is not configured on the server. Set PAYSTACK_SECRET_KEY in .env and restart the server.'
  });
});

// Paystack payment page link (optional - manual payment page)
app.get('/api/payments/paystack/page-link', (req, res) => {
  const url = String(PAYSTACK_PAYMENT_PAGE_URL || '').trim();
  res.json({
    configured: Boolean(url),
    paymentsMode: PAYMENTS_MODE,
    url: url || null
  });
});

// Payments mode (Customer)
app.get('/api/payments/mode', (req, res) => {
  res.json({
    paymentsMode: PAYMENTS_MODE,
    isLive: IS_LIVE_MODE
  });
});

// Stripe configuration status (Customer)
app.get('/api/payments/stripe/status', (req, res) => {
  const configured = isStripeConfigured();
  const successUrl = `${PUBLIC_BASE_URL}/stripe-success.html`;

  const key = String(STRIPE_SECRET_KEY || '').trim();
  const keyEnv = isLikelyStripeLiveKey(key) ? 'live' : isLikelyStripeTestKey(key) ? 'test' : 'unknown';

  res.json({
    configured,
    paymentsMode: PAYMENTS_MODE,
    keyEnv,
    connectedAccount: String(STRIPE_CONNECTED_ACCOUNT_ID || '').trim() || null,
    successUrl,
    message: configured
      ? 'Stripe is configured'
      : 'Stripe is not configured. Set STRIPE_SECRET_KEY in .env and restart the server.'
  });
});

// Initialize Stripe Checkout payment (Customer)
app.post('/api/payments/stripe/initialize', async (req, res) => {
  const { bookingId, email } = req.body;
  const normalizedBookingId = String(bookingId || '').trim();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedBookingId || !normalizedEmail) {
    return res.status(400).json({ error: 'bookingId and email are required' });
  }

  const db = readDatabase();
  const booking = db.bookings.find(b => String(b.id) === normalizedBookingId);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (normalizeEmail(booking.email) !== normalizedEmail) {
    return res.status(401).json({ error: 'Email does not match this booking' });
  }

  const amountKobo = Math.max(0, Number(booking.amountDueNow || 0)) * 100;
  if (!amountKobo) {
    return res.status(400).json({ error: 'No payable amount found for this booking' });
  }

  try {
    const stripe = getStripeClient();
    const opts = getStripeRequestOptions();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'ngn',
      customer_email: booking.email,
      success_url: `${PUBLIC_BASE_URL}/stripe-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_BASE_URL}/#booking`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'ngn',
            unit_amount: amountKobo,
            product_data: {
              name: `Booking: ${booking.serviceName || 'Salon Service'}`,
              description: `Payment plan: ${booking.paymentPlan || 'N/A'} | Booking ID: ${booking.id}`
            }
          }
        }
      ],
      metadata: {
        bookingId: booking.id,
        email: booking.email,
        serviceName: booking.serviceName || '',
        paymentPlan: booking.paymentPlan || ''
      }
    }, opts);

    booking.paymentProvider = 'stripe';
    booking.stripeSessionId = session.id;
    booking.paymentStatus = 'initiated';
    booking.paymentInitiatedAt = new Date().toISOString();
    writeDatabase(db);

    res.json({
      message: 'Payment initialized',
      checkoutUrl: session.url,
      sessionId: session.id
    });
  } catch (error) {
    if (error && error.code === 'STRIPE_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'Stripe is not configured on the server',
        hint: 'Set STRIPE_SECRET_KEY in .env and restart the server.'
      });
    }
    res.status(500).json({ error: 'Failed to initialize Stripe payment' });
  }
});

// Verify Stripe payment (Customer)
app.get('/api/payments/stripe/verify', async (req, res) => {
  const sessionId = String(req.query.session_id || '').trim();
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id is required' });
  }

  if (!isStripeConfigured()) {
    return res.status(503).json({
      error: 'Stripe is not configured on the server',
      hint: 'Set STRIPE_SECRET_KEY in .env and restart the server.'
    });
  }

  try {
    const stripe = getStripeClient();
    const opts = getStripeRequestOptions();

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent']
    }, opts);

    const bookingId = session && session.metadata ? String(session.metadata.bookingId || '').trim() : '';
    const db = readDatabase();
    const booking = bookingId
      ? db.bookings.find(b => String(b.id) === bookingId)
      : db.bookings.find(b => String(b.stripeSessionId || '').trim() === sessionId);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found for this Stripe session' });
    }

    const paid = session.payment_status === 'paid';

    let receiptUrl = '';
    let paidAmount = 0;

    if (session.payment_intent && typeof session.payment_intent === 'object') {
      const pi = session.payment_intent;
      paidAmount = Math.round(Number(pi.amount_received || 0) / 100);

      // Attempt to get receipt_url from the latest charge.
      if (pi.latest_charge) {
        const charge = await stripe.charges.retrieve(pi.latest_charge, {}, opts);
        receiptUrl = charge && charge.receipt_url ? String(charge.receipt_url) : '';
        booking.stripeChargeId = charge && charge.id ? charge.id : booking.stripeChargeId;
      }

      booking.stripePaymentIntentId = pi.id || booking.stripePaymentIntentId;
    }

    booking.paymentProvider = 'stripe';
    booking.paymentStatus = paid ? 'paid' : 'failed';
    booking.paidAmount = paid ? paidAmount : 0;
    booking.stripeReceiptUrl = receiptUrl || booking.stripeReceiptUrl || '';
    booking.paymentVerifiedAt = new Date().toISOString();

    if (paid) {
      booking.amountRemaining = Math.max(0, Number(booking.price || 0) - paidAmount);
      addBookingNotification(
        db,
        booking,
        'payment_received',
        `💳 Stripe payment received successfully (₦${paidAmount.toLocaleString()}). ${booking.stripeReceiptUrl ? `Receipt: ${booking.stripeReceiptUrl}` : ''}`
      );

      // Optional: email receipt to customer
      try {
        await maybeSendPaymentReceiptEmail({
          booking,
          provider: 'stripe',
          paidAmount,
          reference: booking.stripePaymentIntentId || booking.stripeSessionId,
          receiptUrl: booking.stripeReceiptUrl
        });
      } catch (e) {
        booking.paymentReceiptEmailError = String(e && e.message ? e.message : 'Failed to send receipt email');
        booking.paymentReceiptEmailErrorAt = new Date().toISOString();
      }
    }

    writeDatabase(db);

    res.json({
      ok: true,
      paid,
      receiptUrl: booking.stripeReceiptUrl || null,
      booking: {
        id: booking.id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        amountDueNow: booking.amountDueNow,
        amountRemaining: booking.amountRemaining,
        paidAmount: booking.paidAmount
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Stripe verification failed' });
  }
});

// Stripe webhook (optional but recommended)
app.post('/api/payments/stripe/webhook', async (req, res) => {
  if (!STRIPE_WEBHOOK_SECRET) {
    return res.status(501).json({ error: 'Stripe webhook secret not configured' });
  }

  try {
    const stripe = getStripeClient();
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);

    if (event.type === 'checkout.session.completed') {
      const session = event.data && event.data.object ? event.data.object : null;
      const bookingId = session && session.metadata ? String(session.metadata.bookingId || '').trim() : '';
      if (bookingId) {
        const db = readDatabase();
        const booking = db.bookings.find(b => String(b.id) === bookingId);
        if (booking) {
          booking.paymentProvider = 'stripe';
          booking.stripeSessionId = session.id || booking.stripeSessionId;
          booking.paymentStatus = 'paid';
          booking.paymentWebhookProcessedAt = new Date().toISOString();
          writeDatabase(db);
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// Monnify configuration status (Customer)
app.get('/api/payments/monnify/status', (req, res) => {
  const configured = isMonnifyConfigured();
  const callbackUrl = `${PUBLIC_BASE_URL}/monnify-callback.html`;

  res.json({
    configured,
    callbackUrl,
    publicBaseUrl: PUBLIC_BASE_URL,
    baseUrl: MONNIFY_BASE_URL,
    message: configured
      ? 'Monnify is configured'
      : 'Monnify is not configured on the server. Set MONNIFY_API_KEY, MONNIFY_SECRET_KEY, and MONNIFY_CONTRACT_CODE in .env and restart the server.'
  });
});

// Initialize Monnify payment (Customer)
app.post('/api/payments/monnify/initialize', async (req, res) => {
  const { bookingId, email, paymentMethods } = req.body;
  const normalizedBookingId = String(bookingId || '').trim();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedBookingId || !normalizedEmail) {
    return res.status(400).json({ error: 'bookingId and email are required' });
  }

  if (!isMonnifyConfigured()) {
    return res.status(503).json({
      error: 'Monnify is not configured on the server',
      hint: 'Set MONNIFY_API_KEY, MONNIFY_SECRET_KEY, and MONNIFY_CONTRACT_CODE in .env and restart the server.'
    });
  }

  const db = readDatabase();
  const booking = db.bookings.find(b => String(b.id) === normalizedBookingId);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (normalizeEmail(booking.email) !== normalizedEmail) {
    return res.status(401).json({ error: 'Email does not match this booking' });
  }

  const amount = Math.max(0, Number(booking.amountDueNow || 0));
  if (!amount) {
    return res.status(400).json({ error: 'No payable amount found for this booking' });
  }

  const redirectUrl = `${PUBLIC_BASE_URL}/monnify-callback.html`;
  const generatedPaymentReference = `CEOSALOON-${String(booking.id).slice(0, 12)}-${Date.now()}`;

  const normalizedPaymentMethods = Array.isArray(paymentMethods)
    ? paymentMethods
        .map(m => String(m || '').trim().toUpperCase())
        .filter(Boolean)
    : [];

  try {
    const init = await monnifyApiRequest('POST', '/api/v1/merchant/transactions/init-transaction', {
      amount,
      customerName: booking.name,
      customerEmail: booking.email,
      paymentReference: generatedPaymentReference,
      paymentDescription: `CEO UNISEX SALON - ${booking.serviceName}`,
      currencyCode: 'NGN',
      contractCode: String(MONNIFY_CONTRACT_CODE || '').trim(),
      redirectUrl,
      paymentMethods: normalizedPaymentMethods.length ? normalizedPaymentMethods : undefined,
      metaData: {
        bookingId: booking.id,
        serviceName: booking.serviceName,
        paymentPlan: booking.paymentPlan,
        amountDueNow: booking.amountDueNow,
        phone: booking.phone
      }
    });

    if (!init.ok || !init.data || init.data.requestSuccessful !== true || !init.data.responseBody || !init.data.responseBody.checkoutUrl) {
      return res.status(502).json({ error: 'Failed to initialize Monnify payment', details: init.data });
    }

    booking.paymentProvider = 'monnify';
    booking.paymentReference = init.data.responseBody.paymentReference || generatedPaymentReference;
    booking.monnifyTransactionReference = init.data.responseBody.transactionReference || '';
    booking.paymentStatus = 'initiated';
    booking.paymentInitiatedAt = new Date().toISOString();
    writeDatabase(db);

    return res.json({
      message: 'Payment initialized',
      checkoutUrl: init.data.responseBody.checkoutUrl,
      paymentReference: booking.paymentReference,
      transactionReference: booking.monnifyTransactionReference
    });
  } catch (error) {
    if (error && error.code === 'MONNIFY_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'Monnify is not configured on the server' });
    }
    return res.status(500).json({ error: 'Failed to initialize Monnify payment' });
  }
});

// Verify Monnify payment (Customer)
app.get('/api/payments/monnify/verify', async (req, res) => {
  const paymentReference = String(req.query.paymentReference || '').trim();
  const transactionReference = String(req.query.transactionReference || '').trim();

  if (!paymentReference && !transactionReference) {
    return res.status(400).json({ error: 'paymentReference or transactionReference is required' });
  }

  if (!isMonnifyConfigured()) {
    return res.status(503).json({
      error: 'Monnify is not configured on the server',
      hint: 'Set MONNIFY_API_KEY, MONNIFY_SECRET_KEY, and MONNIFY_CONTRACT_CODE in .env and restart the server.'
    });
  }

  try {
    const result = await monnifyQueryTransaction({ paymentReference, transactionReference });
    if (!result.ok || !result.data || result.data.requestSuccessful !== true || !result.data.responseBody) {
      return res.status(502).json({ error: 'Failed to verify payment', details: result.data });
    }

    const body = result.data.responseBody;
    const status = String(body.paymentStatus || '').trim().toUpperCase();
    const paid = ['PAID', 'OVERPAID'].includes(status);
    const amountPaid = Math.round(Number(body.amountPaid || body.amount || 0));

    const db = readDatabase();
    const booking = db.bookings.find(b => String(b.paymentReference || '').trim() === String(body.paymentReference || paymentReference).trim())
      || db.bookings.find(b => String(b.monnifyTransactionReference || '').trim() === String(body.transactionReference || transactionReference).trim());

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found for this payment reference' });
    }

    booking.paymentProvider = 'monnify';
    booking.paymentReference = String(body.paymentReference || booking.paymentReference || '').trim();
    booking.monnifyTransactionReference = String(body.transactionReference || booking.monnifyTransactionReference || '').trim();
    booking.paidAmount = paid ? amountPaid : 0;
    booking.paymentStatus = paid ? 'paid' : 'failed';
    booking.paymentVerifiedAt = new Date().toISOString();

    if (paid) {
      booking.amountRemaining = Math.max(0, Number(booking.price || 0) - amountPaid);
      addBookingNotification(
        db,
        booking,
        'payment_received',
        `💳 Payment received successfully (₦${amountPaid.toLocaleString()}). Your booking remains ${booking.status}.`
      );
    }

    writeDatabase(db);

    return res.json({
      ok: true,
      paid,
      status,
      booking: {
        id: booking.id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        paymentPlan: booking.paymentPlan,
        amountDueNow: booking.amountDueNow,
        amountRemaining: booking.amountRemaining,
        paidAmount: booking.paidAmount,
        paymentReference: booking.paymentReference,
        transactionReference: booking.monnifyTransactionReference
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// Monnify webhook (server-to-server) for payment completion events
app.post('/api/payments/monnify/webhook', async (req, res) => {
  if (!isMonnifyConfigured()) {
    return res.status(503).json({ error: 'Monnify is not configured on the server' });
  }

  const signature = String(req.headers['monnify-signature'] || '').trim();
  const rawBody = req.rawBody;
  if (!signature || !rawBody) {
    return res.status(400).json({ error: 'Missing monnify-signature header or raw body' });
  }

  const computed = computeMonnifyWebhookSignature(rawBody);
  if (String(computed).toLowerCase() !== String(signature).toLowerCase()) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  // Best practice: query Monnify for the final status before updating records.
  const payload = req.body;
  const eventData = payload && payload.eventData ? payload.eventData : null;
  const paymentReference = eventData ? String(eventData.paymentReference || '').trim() : '';
  const transactionReference = eventData ? String(eventData.transactionReference || '').trim() : '';

  if (!paymentReference && !transactionReference) {
    return res.status(400).json({ error: 'Webhook missing paymentReference/transactionReference' });
  }

  try {
    const verified = await monnifyQueryTransaction({ paymentReference, transactionReference });
    if (!verified.ok || !verified.data || verified.data.requestSuccessful !== true || !verified.data.responseBody) {
      return res.status(202).json({ received: true, verified: false });
    }

    const body = verified.data.responseBody;
    const status = String(body.paymentStatus || '').trim().toUpperCase();
    const paid = ['PAID', 'OVERPAID'].includes(status);
    const amountPaid = Math.round(Number(body.amountPaid || body.amount || 0));

    const db = readDatabase();
    const booking = db.bookings.find(b => String(b.paymentReference || '').trim() === String(body.paymentReference || paymentReference).trim())
      || db.bookings.find(b => String(b.monnifyTransactionReference || '').trim() === String(body.transactionReference || transactionReference).trim());

    if (booking) {
      booking.paymentProvider = 'monnify';
      booking.paymentReference = String(body.paymentReference || booking.paymentReference || '').trim();
      booking.monnifyTransactionReference = String(body.transactionReference || booking.monnifyTransactionReference || '').trim();
      booking.paidAmount = paid ? amountPaid : 0;
      booking.paymentStatus = paid ? 'paid' : booking.paymentStatus;
      booking.paymentWebhookProcessedAt = new Date().toISOString();

      if (paid) {
        booking.amountRemaining = Math.max(0, Number(booking.price || 0) - amountPaid);
        addBookingNotification(
          db,
          booking,
          'payment_received',
          `💳 Payment received successfully (₦${amountPaid.toLocaleString()}). Your booking remains ${booking.status}.`
        );
      }

      writeDatabase(db);
    }

    return res.json({ received: true });
  } catch (error) {
    return res.status(202).json({ received: true, verified: false });
  }
});

// Initialize Paystack payment (Customer)
app.post('/api/payments/paystack/initialize', async (req, res) => {
  const { bookingId, email, paymentChannel } = req.body;
  const normalizedBookingId = String(bookingId || '').trim();
  const normalizedEmail = normalizeEmail(email);
  const normalizedChannel = String(paymentChannel || '').trim();

  if (!normalizedBookingId || !normalizedEmail) {
    return res.status(400).json({ error: 'bookingId and email are required' });
  }

  const db = readDatabase();
  const booking = db.bookings.find(b => String(b.id) === normalizedBookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (normalizeEmail(booking.email) !== normalizedEmail) {
    return res.status(401).json({ error: 'Email does not match this booking' });
  }

  // Paystack expects the amount as an integer (kobo).
  const amountInKobo = Math.round(Math.max(0, Number(booking.amountDueNow || 0)) * 100);
  if (!amountInKobo) {
    return res.status(400).json({ error: 'No payable amount found for this booking' });
  }

  const callbackUrl = `${PUBLIC_BASE_URL}/paystack-callback.html`;

  const channels = [];
  // Paystack supported channels include: card, bank, ussd, bank_transfer, mobile_money
  if (normalizedChannel) {
    channels.push(normalizedChannel);
  }

  try {
    const init = await paystackRequest('/transaction/initialize', {
      email: booking.email,
      amount: amountInKobo,
      callback_url: callbackUrl,
      channels: channels.length ? channels : undefined,
      metadata: {
        bookingId: booking.id,
        serviceName: booking.serviceName,
        paymentPlan: booking.paymentPlan,
        amountDueNow: booking.amountDueNow,
        phone: booking.phone
      }
    });

    if (!init.ok || !init.data || init.data.status !== true) {
      return res.status(502).json({
        error: 'Failed to initialize payment',
        details: init.data
      });
    }

    booking.paymentProvider = 'paystack';
    booking.paymentReference = init.data.data.reference;
    booking.paymentStatus = 'initiated';
    booking.paymentInitiatedAt = new Date().toISOString();
    writeDatabase(db);

    return res.json({
      message: 'Payment initialized',
      authorizationUrl: init.data.data.authorization_url,
      reference: init.data.data.reference
    });
  } catch (error) {
    if (error && error.code === 'PAYSTACK_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'Paystack is not configured on the server',
        hint: 'Set PAYSTACK_SECRET_KEY in .env and restart the server.'
      });
    }

    // Provide a small amount of diagnostics to help resolve configuration/network issues.
    return res.status(500).json({
      error: 'Failed to initialize payment',
      details: {
        message: error && error.message ? String(error.message) : undefined,
        code: error && error.code ? String(error.code) : undefined
      }
    });
  }
});

// Verify Paystack payment (Customer)
app.get('/api/payments/paystack/verify/:reference', async (req, res) => {
  const reference = String(req.params.reference || '').trim();
  if (!reference) {
    return res.status(400).json({ error: 'reference is required' });
  }

  if (!isPaystackConfigured()) {
    return res.status(503).json({
      error: 'Paystack is not configured on the server',
      hint: 'Set PAYSTACK_SECRET_KEY in .env and restart the server.'
    });
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.status !== true) {
      return res.status(502).json({ error: 'Failed to verify payment', details: data });
    }

    const payData = data.data;
    const bookingId = payData && payData.metadata ? String(payData.metadata.bookingId || '').trim() : '';
    const db = readDatabase();
    const booking = bookingId
      ? db.bookings.find(b => String(b.id) === bookingId)
      : db.bookings.find(b => String(b.paymentReference || '').trim() === reference);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found for this payment reference' });
    }

    const paid = payData.status === 'success';
    const paidAmount = Math.round(Number(payData.amount || 0) / 100);

    booking.paymentProvider = 'paystack';
    booking.paymentReference = reference;
    booking.paidAmount = paid ? paidAmount : 0;
    booking.paymentStatus = paid ? 'paid' : 'failed';
    booking.paymentVerifiedAt = new Date().toISOString();

    if (paid) {
      booking.amountRemaining = Math.max(0, Number(booking.price || 0) - paidAmount);
      addBookingNotification(
        db,
        booking,
        'payment_received',
        `💳 Payment received successfully (₦${paidAmount.toLocaleString()}). Your booking remains ${booking.status}.`
      );

      // Optional: email receipt to customer
      try {
        await maybeSendPaymentReceiptEmail({
          booking,
          provider: 'paystack',
          paidAmount,
          reference: booking.paymentReference
        });
      } catch (e) {
        booking.paymentReceiptEmailError = String(e && e.message ? e.message : 'Failed to send receipt email');
        booking.paymentReceiptEmailErrorAt = new Date().toISOString();
      }
    }

    writeDatabase(db);

    res.json({
      ok: true,
      paid,
      booking: {
        id: booking.id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        paymentPlan: booking.paymentPlan,
        amountDueNow: booking.amountDueNow,
        amountRemaining: booking.amountRemaining,
        paidAmount: booking.paidAmount,
        paymentReference: booking.paymentReference
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Track booking status + notifications by tracking code (Customer)
app.get('/api/bookings/track', (req, res) => {
  const trackingCode = normalizeTrackingToken(req.query.trackingCode);
  const email = normalizeEmail(req.query.email);

  if (!trackingCode || !email) {
    return res.status(400).json({ error: 'trackingCode and email are required' });
  }

  const db = readDatabase();
  const booking = db.bookings.find(b => getBookingTrackingCode(b) === trackingCode)
    || db.bookings.find(b => String(b.id || '').trim().toUpperCase() === trackingCode);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (normalizeEmail(booking.email) !== email) {
    return res.status(401).json({ error: 'Email does not match this booking' });
  }

  if (!booking.trackingCode) {
    booking.trackingCode = getBookingTrackingCode(booking);
    writeDatabase(db);
  }

  const notifications = (db.bookingNotifications || [])
    .filter(n => String(n.bookingId) === String(booking.id))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  res.json({
    booking: {
      id: booking.id,
      trackingCode: booking.trackingCode,
      status: booking.status,
      serviceName: booking.serviceName,
      date: booking.date,
      time: booking.time,
      price: booking.price,
      paymentMethod: booking.paymentMethod,
      paymentPlan: booking.paymentPlan,
      amountDueNow: booking.amountDueNow,
      amountRemaining: booking.amountRemaining,
      paymentStatus: booking.paymentStatus,
      paymentProvider: booking.paymentProvider,
      paymentReference: booking.paymentReference,
      paidAmount: booking.paidAmount,
      bankTransferReference: booking.bankTransferReference,
      paymentReceiptFile: booking.paymentReceiptFile || null,
      paymentReceiptStatus: booking.paymentReceiptStatus || '',
      serviceMode: booking.serviceMode,
      homeServiceAddress: booking.homeServiceAddress
    },
    notifications
  });
});

// Track booking status + notifications (Customer)
app.get('/api/bookings/:id/track', (req, res) => {
  const bookingLookupToken = String(req.params.id || '').trim();
  const email = normalizeEmail(req.query.email);

  if (!bookingLookupToken || !email) {
    return res.status(400).json({ error: 'Booking id and email are required' });
  }

  const db = readDatabase();
  const normalizedLookupCode = bookingLookupToken.toUpperCase();
  const booking = db.bookings.find(b => String(b.id) === bookingLookupToken)
    || db.bookings.find(b => getBookingTrackingCode(b) === normalizedLookupCode);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (normalizeEmail(booking.email) !== email) {
    return res.status(401).json({ error: 'Email does not match this booking' });
  }

  if (!booking.trackingCode) {
    booking.trackingCode = getBookingTrackingCode(booking);
    writeDatabase(db);
  }

  const notifications = (db.bookingNotifications || [])
    .filter(n => String(n.bookingId) === String(booking.id))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  res.json({
    booking: {
      id: booking.id,
      trackingCode: booking.trackingCode,
      status: booking.status,
      serviceName: booking.serviceName,
      date: booking.date,
      time: booking.time,
      price: booking.price,
      paymentMethod: booking.paymentMethod,
      paymentPlan: booking.paymentPlan,
      amountDueNow: booking.amountDueNow,
      amountRemaining: booking.amountRemaining,
      paymentStatus: booking.paymentStatus,
      paymentProvider: booking.paymentProvider,
      paymentReference: booking.paymentReference,
      paidAmount: booking.paidAmount,
      bankTransferReference: booking.bankTransferReference,
      paymentReceiptFile: booking.paymentReceiptFile || null,
      paymentReceiptStatus: booking.paymentReceiptStatus || '',
      serviceMode: booking.serviceMode,
      homeServiceAddress: booking.homeServiceAddress
    },
    notifications
  });
});

// Download booking invoice PDF (Customer)
app.get('/api/bookings/:id/invoice', async (req, res) => {
  const lookupToken = String(req.params.id || '').trim();
  const email = normalizeEmail(req.query.email);
  const token = String(req.query.token || '').trim();

  if (!lookupToken || (!email && !token)) {
    return res.status(400).json({ error: 'Booking id/code and either email or token are required' });
  }

  const db = readDatabase();
  const booking = resolveBookingByLookup(db, lookupToken);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const ownerEmail = normalizeEmail(booking.email);
  const canonicalLookupCode = String(booking.trackingCode || booking.id || lookupToken).trim().toUpperCase();
  const authorizedByToken = token
    ? verifyInvoiceAccessToken({
        token,
        resourceType: 'booking',
        lookupCode: canonicalLookupCode,
        email: ownerEmail
      })
    : false;

  const authorizedByEmail = email && ownerEmail === email;

  if (!authorizedByToken && !authorizedByEmail) {
    return res.status(401).json({ error: 'Unauthorized invoice access' });
  }

  try {
    const payload = buildBookingInvoicePayload(booking);
    const pdfBuffer = await buildInvoicePdfBuffer({
      invoiceTitle: 'Service Invoice',
      invoiceNumber: payload.invoiceNo,
      customerName: payload.customerName,
      details: payload.details,
      totals: payload.totals
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${payload.invoiceNo}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to generate booking invoice PDF',
      details: error && error.message ? String(error.message) : undefined
    });
  }
});

// Upload bank transfer receipt (Customer)
app.post('/api/bookings/:id/upload-receipt', uploadReceipt.single('receipt'), (req, res) => {
  const bookingId = String(req.params.id || '').trim();
  const email = normalizeEmail(req.body.email);

  if (!bookingId || !email) {
    return res.status(400).json({ error: 'Booking id and email are required' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Receipt file is required' });
  }

  const db = readDatabase();
  const booking = db.bookings.find(b => String(b.id) === bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (normalizeEmail(booking.email) !== email) {
    return res.status(401).json({ error: 'Email does not match this booking' });
  }

  booking.paymentReceiptFile = `/uploads/${req.file.filename}`;
  booking.paymentReceiptUploadedAt = new Date().toISOString();
  booking.paymentReceiptStatus = 'submitted';

  if (booking.paymentStatus === 'pending' || booking.paymentStatus === 'initiated') {
    booking.paymentStatus = 'receipt_submitted';
  }

  addBookingNotification(
    db,
    booking,
    'receipt_uploaded',
    '📎 Payment receipt uploaded successfully. Our team will confirm your payment shortly.'
  );

  writeDatabase(db);

  res.status(201).json({
    message: 'Receipt uploaded successfully',
    receiptFile: booking.paymentReceiptFile,
    booking: {
      id: booking.id,
      paymentStatus: booking.paymentStatus,
      paymentReceiptStatus: booking.paymentReceiptStatus
    }
  });
});

// Get all bookings (Admin)
app.get('/api/admin/bookings', requireAdminAuth, (req, res) => {
  const db = readDatabase();
  res.json(db.bookings);
});

// Get all product orders (Admin)
app.get('/api/admin/product-orders', requireAdminAuth, async (req, res) => {
  const db = readDatabase();
  let hasAutoChanges = false;
  for (const order of (db.productOrders || [])) {
    // eslint-disable-next-line no-await-in-loop
    const changed = await maybeAutoAdvanceProductOrderDelivery(db, order);
    if (changed) hasAutoChanges = true;
  }

  if (hasAutoChanges) {
    writeDatabase(db);
  }

  res.json(db.productOrders || []);
});

// Update product order status (Admin)
app.put('/api/admin/product-orders/:id', requireAdminAuth, requireAdminRole(['super-admin', 'ops']), async (req, res) => {
  const orderId = String(req.params.id || '').trim();
  const requestedStatus = String((req.body && req.body.status) || '').trim().toLowerCase();
  const status = normalizeProductOrderStatus(requestedStatus);
  const requestedDeliverySpeed = normalizeDeliverySpeed(req.body && req.body.deliverySpeed);

  if (!['pending', 'approved', 'processed', 'shipped', 'on_the_way', 'delivered', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const db = readDatabase();
  const order = (db.productOrders || []).find(o => String(o.id) === orderId);

  if (!order) {
    return res.status(404).json({ error: 'Product order not found' });
  }

  const previousStatus = normalizeProductOrderStatus(order.status || 'pending') || 'pending';
  const beforeSnapshot = {
    status: previousStatus,
    deliverySpeed: normalizeDeliverySpeed(order.deliverySpeed)
  };
  const statusChanged = previousStatus !== status;
  const speedChanged = normalizeDeliverySpeed(order.deliverySpeed) !== requestedDeliverySpeed;

  order.deliverySpeed = requestedDeliverySpeed;
  order.status = status;
  order.updatedAt = new Date().toISOString();

  if (!order.statusTimestamps || typeof order.statusTimestamps !== 'object') {
    order.statusTimestamps = {};
  }

  if (!order.statusTimestamps.createdAt) {
    order.statusTimestamps.createdAt = String(order.createdAt || order.updatedAt || new Date().toISOString());
  }

  if (statusChanged && status === 'approved') {
    addProductOrderNotification(db, order, 'order_approved', `✅ Your order (${order.orderCode}) has been approved and queued for processing.`);
  }

  if (statusChanged && status === 'processed') {
    addProductOrderNotification(db, order, 'order_processed', `🧾 Your order (${order.orderCode}) has been processed and is being prepared for shipment.`);
  }

  if (statusChanged && status === 'shipped') {
    order.shippedAt = order.updatedAt;
    order.statusTimestamps.shippedAt = order.updatedAt;
    addProductOrderNotification(db, order, 'order_shipped', `🚚 Your order (${order.orderCode}) has been shipped and is on the way.`);
  }

  if (statusChanged && status === 'on_the_way') {
    order.onTheWayAt = order.updatedAt;
    order.statusTimestamps.onTheWayAt = order.updatedAt;
    addProductOrderNotification(db, order, 'order_on_the_way', `🛵 Your order (${order.orderCode}) is now on the way with our courier rider.`);
  }

  if (statusChanged && status === 'delivered') {
    order.deliveredAt = order.updatedAt;
    order.statusTimestamps.deliveredAt = order.updatedAt;
    addProductOrderNotification(db, order, 'order_delivered', `📦 Your order (${order.orderCode}) has been delivered by the courier rider. Enjoy!`);
  }

  if (statusChanged && status === 'cancelled') {
    addProductOrderNotification(db, order, 'order_cancelled', `❌ Your order (${order.orderCode}) was cancelled. Please contact support if needed.`);
  }

  if (speedChanged) {
    addProductOrderNotification(db, order, 'delivery_speed_updated', `⚡ Delivery speed updated to ${order.deliverySpeed}.`);
  }

  let customerEmail;
  if (statusChanged) {
    try {
      customerEmail = await maybeSendProductOrderStatusEmail({
        order,
        previousStatus,
        newStatus: status
      });
    } catch (error) {
      customerEmail = {
        sent: false,
        error: true,
        reason: error && error.message ? String(error.message) : 'Email send failed'
      };
    }
  } else {
    customerEmail = { sent: false, skipped: true, reason: 'No status change' };
  }

  pushAuditLog(db, {
    actor: toPublicAdmin(req.admin),
    action: 'update_product_order_status',
    targetType: 'productOrder',
    targetId: String(order.id),
    before: beforeSnapshot,
    after: {
      status,
      deliverySpeed: order.deliverySpeed
    }
  });
  writeDatabase(db);

  return res.json({
    message: statusChanged
      ? `Product order status updated to ${status}`
      : `Product order already ${status}. No status change.`,
    statusChanged,
    speedChanged,
    previousStatus,
    currentStatus: status,
    notifications: {
      customerEmail
    },
    order
  });
});

// Delete product order (Admin)
app.delete('/api/admin/product-orders/:id', requireAdminAuth, requireAdminRole(['super-admin', 'ops']), (req, res) => {
  const orderId = String(req.params.id || '').trim();
  const db = readDatabase();
  const existingOrder = (db.productOrders || []).find(o => String(o.id) === orderId) || null;
  const before = (db.productOrders || []).length;
  db.productOrders = (db.productOrders || []).filter(o => String(o.id) !== orderId);

  if (db.productOrders.length === before) {
    return res.status(404).json({ error: 'Product order not found' });
  }

  pushAuditLog(db, {
    actor: toPublicAdmin(req.admin),
    action: 'delete_product_order',
    targetType: 'productOrder',
    targetId: orderId,
    before: existingOrder
  });
  writeDatabase(db);
  return res.json({ message: 'Product order deleted successfully' });
});

// Initialize Paystack payment for product order (Customer)
app.post('/api/product-orders/payments/paystack/initialize', async (req, res) => {
  const { orderId, email, paymentChannel } = req.body || {};
  const normalizedOrderId = String(orderId || '').trim();
  const normalizedEmail = normalizeEmail(email);
  const normalizedChannel = String(paymentChannel || '').trim();

  if (!normalizedOrderId || !normalizedEmail) {
    return res.status(400).json({ error: 'orderId and email are required' });
  }

  const db = readDatabase();
  const order = (db.productOrders || []).find(o => String(o.id) === normalizedOrderId);
  if (!order) {
    return res.status(404).json({ error: 'Product order not found' });
  }

  if (normalizeEmail(order.email) !== normalizedEmail) {
    return res.status(401).json({ error: 'Email does not match this order' });
  }

  const amountInKobo = Math.round(Math.max(0, Number(order.amountDueNow || 0)) * 100);
  if (!amountInKobo) {
    return res.status(400).json({ error: 'No payable amount found for this order' });
  }

  const callbackUrl = `${PUBLIC_BASE_URL}/paystack-callback.html`;
  const channels = [];
  if (normalizedChannel) channels.push(normalizedChannel);

  try {
    const init = await paystackRequest('/transaction/initialize', {
      email: order.email,
      amount: amountInKobo,
      callback_url: callbackUrl,
      channels: channels.length ? channels : undefined,
      metadata: {
        productOrderId: order.id,
        orderCode: order.orderCode || '',
        amountDueNow: order.amountDueNow,
        phone: order.phone
      }
    });

    if (!init.ok || !init.data || init.data.status !== true) {
      return res.status(502).json({ error: 'Failed to initialize payment', details: init.data });
    }

    order.paymentProvider = 'paystack';
    order.paymentReference = init.data.data.reference;
    order.paymentStatus = 'initiated';
    order.paymentInitiatedAt = new Date().toISOString();
    writeDatabase(db);

    return res.json({
      message: 'Payment initialized',
      authorizationUrl: init.data.data.authorization_url,
      reference: init.data.data.reference
    });
  } catch (error) {
    if (error && error.code === 'PAYSTACK_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'Paystack is not configured on the server',
        hint: 'Set PAYSTACK_SECRET_KEY in .env and restart the server.'
      });
    }

    return res.status(500).json({
      error: 'Failed to initialize payment',
      details: {
        message: error && error.message ? String(error.message) : undefined,
        code: error && error.code ? String(error.code) : undefined
      }
    });
  }
});

// Verify Paystack payment for product order (Customer)
app.get('/api/product-orders/payments/paystack/verify/:reference', async (req, res) => {
  const reference = String(req.params.reference || '').trim();
  if (!reference) {
    return res.status(400).json({ error: 'reference is required' });
  }

  if (!isPaystackConfigured()) {
    return res.status(503).json({
      error: 'Paystack is not configured on the server',
      hint: 'Set PAYSTACK_SECRET_KEY in .env and restart the server.'
    });
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.status !== true) {
      return res.status(502).json({ error: 'Failed to verify payment', details: data });
    }

    const payData = data.data;
    const orderId = payData && payData.metadata ? String(payData.metadata.productOrderId || '').trim() : '';
    const db = readDatabase();
    const order = orderId
      ? (db.productOrders || []).find(o => String(o.id) === orderId)
      : (db.productOrders || []).find(o => String(o.paymentReference || '').trim() === reference);

    if (!order) {
      return res.status(404).json({ error: 'Product order not found for this payment reference' });
    }

    const paid = payData.status === 'success';
    const paidAmount = Math.round(Number(payData.amount || 0) / 100);

    order.paymentProvider = 'paystack';
    order.paymentReference = reference;
    order.paidAmount = paid ? paidAmount : 0;
    order.paymentStatus = paid ? 'paid' : 'failed';
    order.paymentVerifiedAt = new Date().toISOString();
    if (paid) {
      order.amountRemaining = Math.max(0, Number(order.totalAmount || 0) - paidAmount);
    }

    writeDatabase(db);

    return res.json({
      ok: true,
      paid,
      order: {
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        amountRemaining: order.amountRemaining,
        paidAmount: order.paidAmount,
        paymentReference: order.paymentReference
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// Update booking status (Admin)
app.put('/api/admin/bookings/:id', requireAdminAuth, requireAdminRole(['super-admin', 'ops']), async (req, res) => {
  const { status } = req.body;
  const bookingId = req.params.id;

  // Backward compatibility: map old status names to new ones
  const normalizedStatusMap = {
    accepted: 'approved',
    declined: 'cancelled'
  };
  const requestedStatusRaw = String(status || '').trim().toLowerCase();
  const normalizedStatus = normalizedStatusMap[requestedStatusRaw] || requestedStatusRaw;

  if (!['pending', 'approved', 'cancelled', 'completed'].includes(normalizedStatus)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const db = readDatabase();
  const booking = db.bookings.find(b => b.id === bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const previousStatusRaw = String(booking.status || '').trim().toLowerCase();
  const previousStatus = normalizedStatusMap[previousStatusRaw] || previousStatusRaw || 'pending';
  const statusChanged = previousStatus !== normalizedStatus;
  const beforeSnapshot = { status: previousStatus };

  booking.status = normalizedStatus;
  booking.updatedAt = new Date().toISOString();

  if (statusChanged && normalizedStatus === 'approved') {
    addBookingNotification(
      db,
      booking,
      'approved',
      '✅ Your booking has been approved! We will contact you shortly using the email and phone number you provided.'
    );
  }

  if (statusChanged && normalizedStatus === 'cancelled') {
    const refundNotice = isBookingPaidForRefundNotice(booking)
      ? ' Where payment has already been made, your refund will be processed within 3 to 7 business days (timelines may vary slightly by bank or card issuer).'
      : '';
    addBookingNotification(
      db,
      booking,
      'cancelled',
      `❌ Your booking was cancelled.${refundNotice} Please contact the salon if you believe this was a mistake.`
    );
  }

  let bookingStatusEmailResult = null;
  let bookingStatusSmsResult = null;
  let bookingStatusAdminEmailResult = null;

  if (statusChanged) {
    try {
      bookingStatusEmailResult = await maybeSendBookingStatusEmail({ booking, previousStatus, newStatus: normalizedStatus });
    } catch (e) {
      bookingStatusEmailResult = {
        sent: false,
        error: true,
        reason: e && e.message ? String(e.message) : 'Email send failed'
      };
      // Never block admin updates due to email errors.
    }

    try {
      bookingStatusSmsResult = await maybeSendBookingStatusSms({ booking, previousStatus, newStatus: normalizedStatus });
    } catch (e) {
      bookingStatusSmsResult = {
        sent: false,
        error: true,
        reason: e && e.message ? String(e.message) : 'SMS send failed'
      };
      // Never block admin updates due to SMS errors.
    }

    try {
      bookingStatusAdminEmailResult = await maybeSendAdminBookingStatusEmail({
        booking,
        previousStatus,
        newStatus: normalizedStatus,
        db
      });
    } catch (e) {
      bookingStatusAdminEmailResult = {
        sent: false,
        error: true,
        reason: e && e.message ? String(e.message) : 'Admin email send failed'
      };
      // Never block admin updates due to admin-notify errors.
    }
  } else {
    bookingStatusEmailResult = { sent: false, skipped: true, reason: 'No status change' };
    bookingStatusSmsResult = { sent: false, skipped: true, reason: 'No status change' };
    bookingStatusAdminEmailResult = { sent: false, skipped: true, reason: 'No status change' };
  }

  pushAuditLog(db, {
    actor: toPublicAdmin(req.admin),
    action: 'update_booking_status',
    targetType: 'booking',
    targetId: String(booking.id),
    before: beforeSnapshot,
    after: { status: normalizedStatus }
  });
  writeDatabase(db);

  const statusActionLabel = normalizedStatus === 'approved'
    ? 'accepted'
    : normalizedStatus === 'cancelled'
      ? 'declined'
      : normalizedStatus;

  res.json({
    message: statusChanged
      ? `Booking ${statusActionLabel} successfully`
      : `Booking already ${statusActionLabel}. No status change.`,
    statusChanged,
    previousStatus,
    currentStatus: normalizedStatus,
    booking,
    notifications: {
      email: bookingStatusEmailResult,
      sms: bookingStatusSmsResult,
      adminEmail: bookingStatusAdminEmailResult
    }
  });
});

// Approve or disapprove booking image
app.put('/api/admin/bookings/:id/approve-image', requireAdminAuth, requireAdminRole(['super-admin', 'ops']), (req, res) => {
  const { approved } = req.body;
  const bookingId = req.params.id;

  const db = readDatabase();
  const booking = db.bookings.find(b => b.id === bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (!booking.styleImage) {
    return res.status(400).json({ error: 'No image to approve' });
  }

  const approvedBool = approved === true || approved === 'true';
  const nowIso = new Date().toISOString();

  booking.imageApproved = approvedBool;
  booking.imageApprovalStatus = approvedBool ? 'approved' : 'rejected';

  // Backward compatibility: older UI/data used imageApprovedAt only.
  booking.imageApprovedAt = nowIso;
  if (approvedBool) {
    booking.imageRejectedAt = '';
  } else {
    booking.imageRejectedAt = nowIso;
  }

  pushAuditLog(db, {
    actor: toPublicAdmin(req.admin),
    action: 'update_booking_image_approval',
    targetType: 'booking',
    targetId: String(booking.id),
    after: {
      imageApprovalStatus: booking.imageApprovalStatus
    }
  });
  writeDatabase(db);

  res.json({ message: 'Image approval updated successfully', booking });
});

// Test booking status notifications (Admin)
// This endpoint helps confirm email/SMS delivery config without changing booking status.
app.post('/api/admin/bookings/:id/test-notify', requireAdminAuth, requireAdminRole(['super-admin', 'ops']), async (req, res) => {
  const bookingId = String(req.params.id || '').trim();
  const status = String((req.body && req.body.status) || 'approved').trim().toLowerCase();

  if (!bookingId) {
    return res.status(400).json({ error: 'Booking id is required' });
  }

  if (!['approved', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or cancelled' });
  }

  const db = readDatabase();
  const booking = db.bookings.find(b => String(b.id) === bookingId);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  // Use a fake previous status to force the notification helpers to run.
  const previousStatus = status === 'approved' ? 'pending' : 'approved';

  let email = null;
  let sms = null;
  let adminEmail = null;

  try {
    email = await maybeSendBookingStatusEmail({ booking, previousStatus, newStatus: status });
  } catch (e) {
    email = { sent: false, error: true, reason: e && e.message ? String(e.message) : 'Email send failed' };
  }

  try {
    sms = await maybeSendBookingStatusSms({ booking, previousStatus, newStatus: status });
  } catch (e) {
    sms = { sent: false, error: true, reason: e && e.message ? String(e.message) : 'SMS send failed' };
  }

  try {
    adminEmail = await maybeSendAdminBookingStatusEmail({
      booking,
      previousStatus,
      newStatus: status,
      db
    });
  } catch (e) {
    adminEmail = { sent: false, error: true, reason: e && e.message ? String(e.message) : 'Admin email send failed' };
  }

  writeDatabase(db);
  return res.json({ message: 'Notification test completed', bookingId, status, notifications: { email, sms, adminEmail } });
});

// Notify booking customer about staff/chair assignment (Admin)
app.post('/api/admin/bookings/:id/assignment-notify', requireAdminAuth, requireAdminRole(['super-admin', 'ops']), async (req, res) => {
  try {
    const bookingId = String(req.params.id || '').trim();
    const staff = String(req.body && req.body.staff ? req.body.staff : '').trim();
    const chair = String(req.body && req.body.chair ? req.body.chair : '').trim();
    const date = String(req.body && req.body.date ? req.body.date : '').trim();
    const time = String(req.body && req.body.time ? req.body.time : '').trim();
    const shouldSendSms = req.body && req.body.sendSms !== false;
    const shouldSendEmail = req.body && req.body.sendEmail !== false;

    if (!bookingId) {
      return res.status(400).json({ error: 'Booking id is required' });
    }

    if (!staff || !chair) {
      return res.status(400).json({ error: 'Both staff and chair are required for assignment notification' });
    }

    const db = readDatabase();
    const booking = db.bookings.find(b => String(b.id) === bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const resolvedDate = date || String(booking.date || '').trim() || 'scheduled date';
    const resolvedTime = time || String(booking.time || '').trim() || 'scheduled time';
    const safeWhen = `${resolvedDate} ${resolvedTime}`.trim();
    const serviceName = String(booking.serviceName || 'your appointment').trim();
    const customerName = String(booking.name || 'Customer').trim();

    const smsText = `Hi ${customerName}, your booking assignment is ready. Staff: ${staff}. Chair: ${chair}. Service: ${serviceName}. Time: ${safeWhen}. - CEO Unisex Salon`;
    const emailSubject = `Booking assignment update${booking.id ? ` (${booking.id})` : ''}`;
    const emailText = `Hi ${customerName},\n\nYour booking assignment is ready.\n\nService: ${serviceName}\nAssigned staff: ${staff}\nAssigned chair: ${chair}\nScheduled: ${safeWhen}\n\nIf this timing no longer works, kindly contact the salon for support.\n\nCEO Unisex Salon`;
    const emailHtml = buildColorfulEmailShell({
      title: '👩‍💼 Booking Assignment Update',
      subtitle: 'Your staff and chair have been assigned',
      accent: '#7c46e8',
      bodyHtml: `
        <p style="margin:0 0 10px;">Hi <strong>${escapeHtml(customerName)}</strong>,</p>
        <p style="margin:0 0 14px; color:#4c3f63;">Your booking assignment is ready. Please see your details below.</p>
        <div style="padding:14px; border:1px solid #e9dffd; border-radius:12px; background:linear-gradient(180deg,#fbf8ff 0%,#ffffff 100%);">
          <div><strong>Service:</strong> ${escapeHtml(serviceName)}</div>
          <div><strong>Assigned staff:</strong> ${escapeHtml(staff)}</div>
          <div><strong>Assigned chair:</strong> ${escapeHtml(chair)}</div>
          <div><strong>Scheduled:</strong> ${escapeHtml(safeWhen)}</div>
        </div>
        <p style="margin:12px 0 0; color:#6a5c80; font-size:13px;">If this timing no longer works, kindly contact the salon for support.</p>
      `
    });

    let smsResult = { sent: false, skipped: true, reason: 'SMS disabled by request' };
    if (shouldSendSms) {
      const toPhone = normalizePhoneToE164(booking.phone);
      if (!toPhone) {
        smsResult = { sent: false, skipped: true, reason: 'Customer phone is missing' };
      } else if (!isTermiiConfigured()) {
        smsResult = { sent: false, skipped: true, reason: 'Termii is not configured' };
      } else {
        try {
          const providerResponse = await sendSmsViaTermii({ to: toPhone, message: smsText });
          smsResult = { sent: true, to: toPhone, provider: 'termii', providerResponse };
        } catch (e) {
          smsResult = {
            sent: false,
            error: true,
            reason: e && e.message ? String(e.message) : 'SMS send failed'
          };
        }
      }
    }

    let emailResult = { sent: false, skipped: true, reason: 'Email disabled by request' };
    if (shouldSendEmail) {
      const toEmail = normalizeEmail(booking.email);
      if (!toEmail) {
        emailResult = { sent: false, skipped: true, reason: 'Customer email is missing' };
      } else if (!isSmtpConfigured()) {
        emailResult = { sent: false, skipped: true, reason: 'SMTP is not configured' };
      } else {
        try {
          const emailInfo = await sendEmail({
            to: toEmail,
            subject: emailSubject,
            text: emailText,
            html: emailHtml
          });
          emailResult = {
            sent: true,
            to: toEmail,
            messageId: emailInfo && emailInfo.messageId ? emailInfo.messageId : undefined
          };
        } catch (e) {
          emailResult = {
            sent: false,
            error: true,
            reason: e && e.message ? String(e.message) : 'Email send failed'
          };
        }
      }
    }

    const assignmentLog = {
      id: uuidv4(),
      staff,
      chair,
      date: resolvedDate,
      time: resolvedTime,
      serviceName,
      admin: {
        id: req.admin && req.admin.id ? String(req.admin.id) : '',
        name: req.admin && req.admin.name ? String(req.admin.name) : 'Admin',
        email: req.admin && req.admin.email ? String(req.admin.email) : ''
      },
      notifications: {
        sms: smsResult,
        email: emailResult
      },
      createdAt: new Date().toISOString()
    };

    booking.assignmentNotifications = Array.isArray(booking.assignmentNotifications)
      ? booking.assignmentNotifications
      : [];
    booking.assignmentNotifications.push(assignmentLog);
    booking.lastAssignmentNotificationAt = assignmentLog.createdAt;
    booking.lastAssignment = {
      staff,
      chair,
      date: resolvedDate,
      time: resolvedTime,
      notifiedAt: assignmentLog.createdAt
    };

    const bookingStatusMap = {
      accepted: 'approved',
      declined: 'cancelled'
    };
    const previousStatusRaw = String(booking.status || '').trim().toLowerCase();
    const previousStatus = bookingStatusMap[previousStatusRaw] || previousStatusRaw || 'pending';
    let statusAfterNotify = previousStatus;
    let autoApproved = false;
    let bookingStatusEmail = { sent: false, skipped: true, reason: 'No status change from assignment notify' };
    let bookingStatusSms = { sent: false, skipped: true, reason: 'No status change from assignment notify' };
    let bookingStatusAdminEmail = { sent: false, skipped: true, reason: 'No status change from assignment notify' };

    if (['pending', 'new'].includes(previousStatus)) {
      booking.status = 'approved';
      booking.updatedAt = assignmentLog.createdAt;
      statusAfterNotify = 'approved';
      autoApproved = true;

      addBookingNotification(
        db,
        booking,
        'approved',
        `✅ Your booking has been approved and assigned. Staff: ${staff}. Chair: ${chair}. Scheduled: ${safeWhen}.`
      );

      try {
        bookingStatusEmail = await maybeSendBookingStatusEmail({
          booking,
          previousStatus,
          newStatus: statusAfterNotify
        });
      } catch (e) {
        bookingStatusEmail = {
          sent: false,
          error: true,
          reason: e && e.message ? String(e.message) : 'Booking status email send failed'
        };
      }

      try {
        bookingStatusSms = await maybeSendBookingStatusSms({
          booking,
          previousStatus,
          newStatus: statusAfterNotify
        });
      } catch (e) {
        bookingStatusSms = {
          sent: false,
          error: true,
          reason: e && e.message ? String(e.message) : 'Booking status SMS send failed'
        };
      }

      try {
        bookingStatusAdminEmail = await maybeSendAdminBookingStatusEmail({
          booking,
          previousStatus,
          newStatus: statusAfterNotify,
          db
        });
      } catch (e) {
        bookingStatusAdminEmail = {
          sent: false,
          error: true,
          reason: e && e.message ? String(e.message) : 'Booking status admin email send failed'
        };
      }
    }

    pushAuditLog(db, {
      actor: toPublicAdmin(req.admin),
      action: 'notify_booking_assignment',
      targetType: 'booking',
      targetId: String(booking.id),
      after: {
        assignment: {
          staff,
          chair,
          date: resolvedDate,
          time: resolvedTime
        },
        bookingStatus: statusAfterNotify,
        autoApproved
      }
    });

    writeDatabase(db);

    return res.json({
      message: 'Assignment notification completed',
      bookingId,
      bookingStatus: statusAfterNotify,
      autoApproved,
      assignment: {
        staff,
        chair,
        date: resolvedDate,
        time: resolvedTime
      },
      notifications: {
        sms: smsResult,
        email: emailResult,
        bookingStatusEmail,
        bookingStatusSms,
        bookingStatusAdminEmail
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: error && error.message ? String(error.message) : 'Failed to send assignment notification'
    });
  }
});

// Send message
app.post('/api/messages', upload.single('reportFile'), (req, res) => {
  const { name, email, subject, message, reportType } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const normalizedMessageEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedMessageEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  const db = readDatabase();
  const msg = {
    id: uuidv4(),
    name,
    email: normalizedMessageEmail,
    subject,
    message,
    reportType: reportType || 'general_message',
    reportFile: req.file ? `/uploads/${req.file.filename}` : null,
    status: 'unread',
    createdAt: new Date().toISOString()
  };

  db.messages.push(msg);
  writeDatabase(db);

  res.status(201).json({ message: 'Message sent successfully', data: msg });
});

// Get all messages (Admin)
app.get('/api/admin/messages', requireAdminAuth, (req, res) => {
  const db = readDatabase();
  res.json(db.messages);
});

// Update message status (Admin)
app.put('/api/admin/messages/:id', requireAdminAuth, (req, res) => {
  const { status } = req.body;
  const messageId = req.params.id;

  const db = readDatabase();
  const msg = db.messages.find(m => m.id === messageId);

  if (!msg) {
    return res.status(404).json({ error: 'Message not found' });
  }

  msg.status = status;
  msg.updatedAt = new Date().toISOString();
  writeDatabase(db);

  res.json({ message: 'Message updated successfully', data: msg });
});

// Delete message (Admin)
app.delete('/api/admin/messages/:id', requireAdminAuth, (req, res) => {
  const messageId = req.params.id;
  const db = readDatabase();
  db.messages = db.messages.filter(m => m.id !== messageId);
  writeDatabase(db);

  res.json({ message: 'Message deleted successfully' });
});

// Reply to a customer message/complaint via email (Admin)
app.post('/api/admin/messages/:id/reply', requireAdminAuth, async (req, res) => {
  try {
    const messageId = String(req.params.id || '').trim();
    const subject = String(req.body && req.body.subject ? req.body.subject : '').trim();
    const bodyText = String(req.body && req.body.message ? req.body.message : '').trim();

    if (!messageId) {
      return res.status(400).json({ error: 'Message id is required' });
    }

    if (!subject || !bodyText) {
      return res.status(400).json({ error: 'subject and message are required' });
    }

    const db = readDatabase();
    const msg = db.messages.find(m => String(m.id) === messageId);
    if (!msg) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const toEmail = normalizeEmail(msg.email);
    if (!toEmail) {
      return res.status(400).json({ error: 'Customer email is missing on this message' });
    }

    const adminName = req.admin && req.admin.name ? String(req.admin.name) : 'Admin';
    const adminEmail = req.admin && req.admin.email ? String(req.admin.email) : '';

    const safeOriginalSubject = String(msg.subject || '').trim();
    const safeOriginalMessage = String(msg.message || '').trim();

    const emailText = `${bodyText}\n\n---\nOriginal message from ${msg.name || 'Customer'} (${toEmail})\nSubject: ${safeOriginalSubject}\n\n${safeOriginalMessage}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p>${bodyText.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>
        <hr>
        <p style="color:#555; font-size: 13px; margin:0;">Original message from <strong>${String(msg.name || 'Customer').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong> (${toEmail})</p>
        <p style="color:#555; font-size: 13px; margin:0;">Subject: ${safeOriginalSubject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        <p style="white-space: pre-wrap; color:#333;">${safeOriginalMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        <p style="color:#777; font-size: 12px;">Sent by ${adminName}${adminEmail ? ` (${adminEmail})` : ''}</p>
      </div>
    `;

    const info = await sendEmail({
      to: toEmail,
      subject,
      text: emailText,
      html: emailHtml
    });

    if (!Array.isArray(msg.replies)) {
      msg.replies = [];
    }

    msg.replies.push({
      id: uuidv4(),
      subject,
      message: bodyText,
      to: toEmail,
      admin: {
        id: req.admin && req.admin.id ? req.admin.id : undefined,
        name: adminName,
        email: adminEmail
      },
      transport: {
        messageId: info && info.messageId ? info.messageId : undefined,
        accepted: info && info.accepted ? info.accepted : undefined,
        rejected: info && info.rejected ? info.rejected : undefined
      },
      sentAt: new Date().toISOString()
    });

    msg.lastRepliedAt = new Date().toISOString();
    msg.status = 'read';
    msg.updatedAt = new Date().toISOString();
    writeDatabase(db);

    res.json({
      message: 'Reply sent successfully',
      replyCount: msg.replies.length,
      to: toEmail
    });
  } catch (error) {
    const code = error && error.code ? error.code : 'REPLY_FAILED';
    const status = code === 'SMTP_NOT_CONFIGURED' ? 503 : 500;
    res.status(status).json({
      error: error && error.message ? error.message : 'Failed to send reply',
      code
    });
  }
});

// Reply to a booking customer via email (Admin)
app.post('/api/admin/bookings/:id/reply', requireAdminAuth, async (req, res) => {
  try {
    const bookingId = String(req.params.id || '').trim();
    const subject = String(req.body && req.body.subject ? req.body.subject : '').trim();
    const bodyText = String(req.body && req.body.message ? req.body.message : '').trim();

    if (!bookingId) {
      return res.status(400).json({ error: 'Booking id is required' });
    }

    if (!subject || !bodyText) {
      return res.status(400).json({ error: 'subject and message are required' });
    }

    const db = readDatabase();
    const booking = db.bookings.find(b => String(b.id) === bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const toEmail = normalizeEmail(booking.email);
    if (!toEmail || !isValidEmail(toEmail)) {
      return res.status(400).json({ error: 'Customer email is missing or invalid on this booking' });
    }

    const adminName = req.admin && req.admin.name ? String(req.admin.name) : 'Admin';
    const adminEmail = req.admin && req.admin.email ? String(req.admin.email) : '';
    const bookingName = String(booking.name || 'Customer').trim();
    const serviceName = String(booking.serviceName || 'Service').trim();
    const when = `${String(booking.date || '').trim()} ${String(booking.time || '').trim()}`.trim() || 'N/A';

    const emailText = `${bodyText}\n\n---\nBooking details\nCustomer: ${bookingName}\nBooking ID: ${booking.id}\nService: ${serviceName}\nWhen: ${when}\n`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p>${bodyText.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>
        <hr>
        <p style="color:#555; font-size: 13px; margin:0;"><strong>Booking details</strong></p>
        <p style="color:#555; font-size: 13px; margin:0;">Customer: ${bookingName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        <p style="color:#555; font-size: 13px; margin:0;">Booking ID: ${String(booking.id || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        <p style="color:#555; font-size: 13px; margin:0;">Service: ${serviceName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        <p style="color:#555; font-size: 13px; margin:0;">When: ${when.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        <p style="color:#777; font-size: 12px; margin-top:10px;">Sent by ${adminName}${adminEmail ? ` (${adminEmail})` : ''}</p>
      </div>
    `;

    const info = await sendEmail({
      to: toEmail,
      subject,
      text: emailText,
      html: emailHtml,
      replyTo: adminEmail || undefined
    });

    if (!Array.isArray(booking.replies)) {
      booking.replies = [];
    }

    booking.replies.push({
      id: uuidv4(),
      subject,
      message: bodyText,
      to: toEmail,
      admin: {
        id: req.admin && req.admin.id ? req.admin.id : undefined,
        name: adminName,
        email: adminEmail
      },
      transport: {
        messageId: info && info.messageId ? info.messageId : undefined,
        accepted: info && info.accepted ? info.accepted : undefined,
        rejected: info && info.rejected ? info.rejected : undefined
      },
      sentAt: new Date().toISOString()
    });

    booking.lastRepliedAt = new Date().toISOString();
    booking.updatedAt = new Date().toISOString();
    writeDatabase(db);

    res.json({
      message: 'Booking reply sent successfully',
      to: toEmail,
      replyCount: booking.replies.length,
      bookingId: booking.id
    });
  } catch (error) {
    const code = error && error.code ? error.code : 'BOOKING_REPLY_FAILED';
    const status = code === 'SMTP_NOT_CONFIGURED' ? 503 : 500;
    res.status(status).json({
      error: error && error.message ? error.message : 'Failed to send booking reply',
      code
    });
  }
});

// Reply to a product-order customer via email (Admin)
app.post('/api/admin/product-orders/:id/reply', requireAdminAuth, async (req, res) => {
  try {
    const orderId = String(req.params.id || '').trim();
    const subject = String(req.body && req.body.subject ? req.body.subject : '').trim();
    const bodyText = String(req.body && req.body.message ? req.body.message : '').trim();

    if (!orderId) {
      return res.status(400).json({ error: 'Order id is required' });
    }

    if (!subject || !bodyText) {
      return res.status(400).json({ error: 'subject and message are required' });
    }

    const db = readDatabase();
    const order = (db.productOrders || []).find(o => String(o.id) === orderId);
    if (!order) {
      return res.status(404).json({ error: 'Product order not found' });
    }

    const toEmail = normalizeEmail(order.email);
    if (!toEmail || !isValidEmail(toEmail)) {
      return res.status(400).json({ error: 'Customer email is missing or invalid on this order' });
    }

    const adminName = req.admin && req.admin.name ? String(req.admin.name) : 'Admin';
    const adminEmail = req.admin && req.admin.email ? String(req.admin.email) : '';
    const customerName = String(order.name || 'Customer').trim();
    const orderCode = String(order.orderCode || order.id || '').trim();
    const orderStatus = String(order.status || 'pending').trim();
    const orderTotal = Number(order.totalAmount || 0);

    const emailText = `${bodyText}\n\n---\nOrder details\nCustomer: ${customerName}\nOrder Code: ${orderCode || 'N/A'}\nOrder ID: ${String(order.id || '')}\nStatus: ${orderStatus}\nTotal: ₦${orderTotal.toLocaleString()}\n`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p>${escapeHtml(bodyText).replace(/\n/g, '<br>')}</p>
        <hr>
        <p style="color:#555; font-size: 13px; margin:0;"><strong>Order details</strong></p>
        <p style="color:#555; font-size: 13px; margin:0;">Customer: ${escapeHtml(customerName)}</p>
        <p style="color:#555; font-size: 13px; margin:0;">Order Code: ${escapeHtml(orderCode || 'N/A')}</p>
        <p style="color:#555; font-size: 13px; margin:0;">Order ID: ${escapeHtml(String(order.id || ''))}</p>
        <p style="color:#555; font-size: 13px; margin:0;">Status: ${escapeHtml(orderStatus)}</p>
        <p style="color:#555; font-size: 13px; margin:0;">Total: ₦${orderTotal.toLocaleString()}</p>
        <p style="color:#777; font-size: 12px; margin-top:10px;">Sent by ${escapeHtml(adminName)}${adminEmail ? ` (${escapeHtml(adminEmail)})` : ''}</p>
      </div>
    `;

    const info = await sendEmail({
      to: toEmail,
      subject,
      text: emailText,
      html: emailHtml,
      replyTo: adminEmail || undefined
    });

    if (!Array.isArray(order.replies)) {
      order.replies = [];
    }

    order.replies.push({
      id: uuidv4(),
      subject,
      message: bodyText,
      to: toEmail,
      admin: {
        id: req.admin && req.admin.id ? req.admin.id : undefined,
        name: adminName,
        email: adminEmail
      },
      transport: {
        messageId: info && info.messageId ? info.messageId : undefined,
        accepted: info && info.accepted ? info.accepted : undefined,
        rejected: info && info.rejected ? info.rejected : undefined
      },
      sentAt: new Date().toISOString()
    });

    order.lastRepliedAt = new Date().toISOString();
    order.updatedAt = new Date().toISOString();
    writeDatabase(db);

    return res.json({
      message: 'Order reply sent successfully',
      to: toEmail,
      replyCount: order.replies.length,
      orderId: order.id,
      orderCode: orderCode || null
    });
  } catch (error) {
    const code = error && error.code ? error.code : 'ORDER_REPLY_FAILED';
    const status = code === 'SMTP_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({
      error: error && error.message ? String(error.message) : 'Failed to send order reply',
      code
    });
  }
});

// Delete booking (Admin)
app.delete('/api/admin/bookings/:id', requireAdminAuth, requireAdminRole(['super-admin', 'ops']), (req, res) => {
  const bookingId = req.params.id;
  const db = readDatabase();
  const existingBooking = db.bookings.find(b => b.id === bookingId) || null;
  db.bookings = db.bookings.filter(b => b.id !== bookingId);

  pushAuditLog(db, {
    actor: toPublicAdmin(req.admin),
    action: 'delete_booking',
    targetType: 'booking',
    targetId: String(bookingId),
    before: existingBooking
  });
  writeDatabase(db);

  res.json({ message: 'Booking deleted successfully' });
});

// Read admin audit logs (Super Admin)
app.get('/api/admin/audit-logs', requireAdminAuth, requireAdminRole(['super-admin']), (req, res) => {
  const db = readDatabase();
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(200, Math.max(1, Math.floor(limitRaw)))
    : 100;

  const logs = Array.isArray(db.settings && db.settings.auditLogs)
    ? [...db.settings.auditLogs]
    : [];

  logs.sort((a, b) => new Date(String(b && b.createdAt ? b.createdAt : 0)).getTime() - new Date(String(a && a.createdAt ? a.createdAt : 0)).getTime());

  return res.json({
    total: logs.length,
    limit,
    logs: logs.slice(0, limit)
  });
});

// Admin Authentication Routes

// Request one-time admin login access code (email/SMS delivery)
app.post('/api/admin/request-login-access', async (req, res) => {
  const { email, secretPasscode, phone } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedSecretPasscode = String(secretPasscode || '').trim();
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail || !normalizedSecretPasscode) {
    return res.status(400).json({ error: 'Email and secret passcode are required' });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  const db = readDatabase();

  if (db.admins.length === 0) {
    return res.status(400).json({ error: 'No admin account configured yet' });
  }

  const admin = db.admins.find(a => normalizeEmail(a.email) === normalizedEmail);

  if (!admin) {
    return res.status(401).json({ error: 'Admin account not found for this email' });
  }

  if (normalizedSecretPasscode !== ADMIN_SECRET_PASSCODE) {
    return res.status(401).json({ error: 'Invalid secret passcode' });
  }

  const now = Date.now();
  db.adminAccessCodes = Array.isArray(db.adminAccessCodes) ? db.adminAccessCodes : [];

  // Cleanup stale/used codes
  db.adminAccessCodes = db.adminAccessCodes.filter(code => {
    const isExpired = new Date(code.expiresAt).getTime() <= now;
    return !isExpired && !code.used;
  });

  // If admin phone is not yet saved, allow setting it during OTP request.
  if (!normalizePhone(admin.phone) && normalizedPhone) {
    admin.phone = normalizedPhone;
    admin.updatedAt = new Date().toISOString();
  }

  const accessCode = generateOneTimeCode();
  const otpMessage = `This is your OTP code: ${accessCode}`;
  const safeCode = String(accessCode || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const secureOtpDeliveryEnabled = SEND_ADMIN_LOGIN_OTP_EMAILS || SEND_ADMIN_LOGIN_OTP_SMS;
  const delivery = {
    email: { attempted: false, sent: false, skipped: false, reason: '' },
    sms: { attempted: false, sent: false, skipped: false, reason: '' }
  };

  async function withTimeout(promiseFactory, timeoutMs) {
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const err = new Error(`Timeout after ${timeoutMs}ms`);
        err.code = 'DELIVERY_TIMEOUT';
        reject(err);
      }, timeoutMs);
    });

    try {
      return await Promise.race([promiseFactory(), timeoutPromise]);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  const emailTask = async () => {
    if (!SEND_ADMIN_LOGIN_OTP_EMAILS) return;
    delivery.email.attempted = true;

    if (!isSmtpConfigured()) {
      delivery.email.skipped = true;
      delivery.email.reason = 'SMTP not configured';
      return;
    }

    try {
      const subject = 'CEO Unisex Salon Admin OTP Code';
      const text = `${otpMessage}\n\nThis code expires in 10 minutes. If you did not request this, ignore this message.`;
      const decoratedCode = String(accessCode || '')
        .split('')
        .map(char => `<span style="display:inline-block; min-width:42px; padding:10px 0; margin:0 4px; text-align:center; border-radius:10px; background:#ffffff; color:#4a0e4e; border:1px solid #f1d3f6; box-shadow:0 4px 10px rgba(74,14,78,.08); font-weight:800; font-size:26px; letter-spacing:0;">${char.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`)
        .join('');
      const html = `
        <div style="margin:0; padding:24px; background:#f7f2ff; font-family:'Segoe UI', Arial, sans-serif; line-height:1.5; color:#2f2340;">
          <div style="max-width:620px; margin:0 auto; border-radius:18px; overflow:hidden; border:1px solid #ead6ff; background:#ffffff; box-shadow:0 12px 28px rgba(74,14,78,.12);">
            <div style="padding:22px 24px; background:linear-gradient(135deg,#5c1b66 0%,#8f2aa8 45%,#ff5fa2 100%); color:#ffffff;">
              <div style="font-size:13px; opacity:.95; letter-spacing:.4px; text-transform:uppercase;">CEO Unisex Salon</div>
              <h2 style="margin:8px 0 0; font-size:24px; line-height:1.2;">Admin Login OTP</h2>
            </div>

            <div style="padding:24px;">
              <p style="margin:0 0 12px; font-size:15px; color:#4b3b62;">Hi Admin,</p>
              <p style="margin:0 0 14px; font-size:15px; color:#4b3b62;">This is your OTP code. Use it to complete your admin login:</p>

              <div style="margin:0 0 16px; padding:18px 12px; border-radius:14px; background:linear-gradient(180deg,#fff7ff 0%,#fff 100%); border:1px solid #f1d3f6; text-align:center;">
                <div style="margin:0 0 8px; font-size:12px; color:#8a6292; text-transform:uppercase; letter-spacing:.7px;">One-Time Password</div>
                <div aria-label="OTP code" style="white-space:nowrap;">${decoratedCode}</div>
                <div style="margin-top:10px; font-size:12px; color:#8a6292;">Code (plain): <strong style="color:#4a0e4e; letter-spacing:2px;">${safeCode}</strong></div>
              </div>

              <div style="margin:0 0 14px; padding:10px 12px; border-radius:10px; background:#eefbf3; border:1px solid #caedd7; color:#1e6a3a; font-size:14px;">
                ⏱ This code expires in <strong>10 minutes</strong>.
              </div>

              <p style="margin:0; font-size:13px; color:#7a6c8f;">If you did not request this code, please ignore this email.</p>
            </div>
          </div>
        </div>
      `;

      await withTimeout(
        () => sendEmail({
          to: normalizeEmail(admin.email),
          subject,
          text,
          html
        }),
        ADMIN_OTP_DELIVERY_TIMEOUT_MS
      );

      delivery.email.sent = true;
    } catch (error) {
      delivery.email.reason = error && error.message ? String(error.message) : 'Failed to send OTP email';
    }
  };

  const smsTask = async () => {
    if (!SEND_ADMIN_LOGIN_OTP_SMS) return;
    delivery.sms.attempted = true;
    const adminPhone = normalizePhone(admin.phone);
    const smsTo = normalizePhoneToE164(adminPhone);

    if (!adminPhone) {
      delivery.sms.skipped = true;
      delivery.sms.reason = 'Admin phone is not configured';
      return;
    }
    if (!isTermiiConfigured()) {
      delivery.sms.skipped = true;
      delivery.sms.reason = 'Termii is not configured';
      return;
    }
    if (!smsTo) {
      delivery.sms.skipped = true;
      delivery.sms.reason = 'Invalid admin phone number';
      return;
    }

    try {
      await withTimeout(
        () => sendSmsViaTermii({
          to: smsTo,
          message: `${otpMessage}. It expires in 10 minutes.`
        }),
        ADMIN_OTP_DELIVERY_TIMEOUT_MS
      );
      delivery.sms.sent = true;
    } catch (error) {
      delivery.sms.reason = error && error.message ? String(error.message) : 'Failed to send OTP SMS';
    }
  };

  await Promise.all([emailTask(), smsTask()]);

  const deliveredBy = [];
  if (delivery.email.sent) deliveredBy.push('email');
  if (delivery.sms.sent) deliveredBy.push('sms');

  let fallbackToResponse = false;
  if (secureOtpDeliveryEnabled && deliveredBy.length === 0) {
    if (ALLOW_ADMIN_OTP_RESPONSE_FALLBACK) {
      fallbackToResponse = true;
      deliveredBy.push('response');
    } else {
      return res.status(503).json({
        error: 'Failed to deliver OTP to admin email/phone',
        hint: 'Configure SMTP for email OTP and/or Termii + admin phone for SMS OTP.',
        delivery
      });
    }
  }

  const accessCodeRecord = {
    id: uuidv4(),
    email: admin.email,
    code: accessCode,
    used: false,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ONE_TIME_CODE_TTL_MS).toISOString()
  };

  db.adminAccessCodes.push(accessCodeRecord);
  writeDatabase(db);

  return res.json({
    message: fallbackToResponse
      ? 'OTP delivery channels failed. One-time access code returned in response as fallback.'
      : deliveredBy.length
      ? `One-time access code sent via ${deliveredBy.join(' & ')}`
      : 'One-time access code generated successfully',
    expiresInMinutes: 10,
    deliveredBy: deliveredBy.length ? deliveredBy : ['response'],
    delivery,
    // Backward-compatibility fallback when secure OTP channels are disabled,
    // or when channel delivery fails and response fallback is enabled.
    accessCode: (!secureOtpDeliveryEnabled || fallbackToResponse) ? accessCode : undefined
  });
});

// Admin registration status
app.get('/api/admin/registration-status', (req, res) => {
  const db = readDatabase();
  const registrationOpen = db.admins.length === 0;

  res.json({
    registrationOpen,
    message: registrationOpen
      ? 'Admin registration is open for initial setup'
      : 'Admin registration is closed. Contact the existing admin for access.'
  });
});

// Reset admin password using one-time code (forgot password flow)
app.post('/api/admin/reset-password', (req, res) => {
  const { email, oneTimeCode, newPassword, secretPasscode } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedOneTimeCode = normalizeOneTimeCode(oneTimeCode);
  const normalizedNewPassword = String(newPassword || '').trim();
  const normalizedSecretPasscode = String(secretPasscode || '').trim();

  if (!normalizedEmail || !normalizedOneTimeCode || !normalizedNewPassword || !normalizedSecretPasscode) {
    return res.status(400).json({
      error: 'Email, one-time code, new password, and secret passcode are required'
    });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  if (normalizedNewPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  if (normalizedSecretPasscode !== ADMIN_SECRET_PASSCODE) {
    return res.status(401).json({ error: 'Invalid secret passcode' });
  }

  const db = readDatabase();
  const admin = db.admins.find(a => normalizeEmail(a.email) === normalizedEmail);

  if (!admin) {
    return res.status(404).json({ error: 'Admin account not found for this email' });
  }

  const now = Date.now();
  const validAccessCode = db.adminAccessCodes.find(code => {
    return (
      normalizeEmail(code.email) === normalizedEmail &&
      normalizeOneTimeCode(code.code) === normalizedOneTimeCode &&
      code.used !== true &&
      new Date(code.expiresAt).getTime() > now
    );
  });

  if (!validAccessCode) {
    return res.status(401).json({ error: 'Invalid or expired one-time access code' });
  }

  admin.password = normalizedNewPassword;
  admin.updatedAt = new Date().toISOString();

  validAccessCode.used = true;
  validAccessCode.usedAt = new Date().toISOString();
  validAccessCode.usedFor = 'password_reset';

  // Cleanup stale/used codes
  db.adminAccessCodes = db.adminAccessCodes.filter(code => {
    const isExpired = new Date(code.expiresAt).getTime() <= now;
    return !isExpired && !code.used;
  });

  writeDatabase(db);

  return res.json({
    message: 'Password reset successful. You can now login with your new password.'
  });
});

// Admin Registration
app.post('/api/admin/register', (req, res) => {
  const { email, password, name, secretPasscode, phone } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password || '').trim();
  const normalizedName = String(name || '').trim();
  const normalizedSecretPasscode = String(secretPasscode || '').trim();
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail || !normalizedPassword || !normalizedName || !normalizedSecretPasscode) {
    return res.status(400).json({ error: 'Name, email, password, and secret passcode are required' });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  const db = readDatabase();

  // Only one admin can ever self-register
  if (db.admins.length > 0) {
    return res.status(403).json({
      error: 'Admin registration is closed. Contact the existing admin for consent.'
    });
  }

  if (normalizedSecretPasscode !== ADMIN_SECRET_PASSCODE) {
    return res.status(401).json({ error: 'Invalid secret passcode for admin registration' });
  }
  
  // Check if admin already exists
  if (db.admins.some(a => normalizeEmail(a.email) === normalizedEmail)) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const newAdmin = {
    id: require('uuid').v4(),
    email: normalizedEmail,
    password: normalizedPassword,
    name: normalizedName,
    role: 'super-admin',
    phone: normalizedPhone || '',
    createdAt: new Date().toISOString()
  };

  db.admins.push(newAdmin);
  writeDatabase(db);

  res.status(201).json({ 
    message: 'Admin registered successfully',
    admin: toPublicAdmin(newAdmin)
  });
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { email, password, oneTimeCode, secretPasscode } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password || '').trim();
  const normalizedOneTimeCode = normalizeOneTimeCode(oneTimeCode);
  const normalizedSecretPasscode = String(secretPasscode || '').trim();

  if (!normalizedEmail || !normalizedPassword || !normalizedSecretPasscode) {
    return res.status(400).json({ error: 'Email, password, and admin secret passcode are required' });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  const db = readDatabase();
  const admin = db.admins.find(a => {
    const adminEmail = normalizeEmail(a.email);
    const adminPassword = String(a.password || '').trim();
    return adminEmail === normalizedEmail && adminPassword === normalizedPassword;
  });

  if (db.admins.length === 0) {
    return res.status(401).json({ error: 'No admin account found. Complete initial admin setup first.' });
  }

  if (!admin) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (normalizedSecretPasscode !== ADMIN_SECRET_PASSCODE) {
    return res.status(401).json({ error: 'Invalid admin secret passcode' });
  }

  if (!normalizedOneTimeCode) {
    return res.status(400).json({ error: 'One-time access code is required. Request OTP before login.' });
  }

  const now = Date.now();
  db.adminAccessCodes = Array.isArray(db.adminAccessCodes) ? db.adminAccessCodes : [];
  const validAccessCode = db.adminAccessCodes.find(code => {
    return (
      normalizeEmail(code.email) === normalizeEmail(admin.email) &&
      normalizeOneTimeCode(code.code) === normalizedOneTimeCode &&
      code.used !== true &&
      new Date(code.expiresAt).getTime() > now
    );
  });

  if (!validAccessCode) {
    return res.status(401).json({ error: 'Invalid or expired one-time access code' });
  }

  validAccessCode.used = true;
  validAccessCode.usedAt = new Date().toISOString();
  validAccessCode.usedFor = 'admin_login';

  admin.lastLoginAt = new Date().toISOString();
  admin.updatedAt = admin.lastLoginAt;

  // Cleanup stale/used codes to keep DB tidy
  db.adminAccessCodes = db.adminAccessCodes.filter(code => {
    const isExpired = new Date(code.expiresAt).getTime() <= now;
    return !isExpired && !code.used;
  });
  writeDatabase(db);

  res.json({ 
    message: 'Login successful',
    admin: toPublicAdmin(admin),
    token: Buffer.from(`${admin.email}:${admin.id}`).toString('base64')
  });
});

// Verify Admin
app.post('/api/admin/verify', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const db = readDatabase();
    const admin = validateAdminToken(token, db);

    if (db.admins.length === 0) {
      return res.status(401).json({ error: 'No admin configured' });
    }

    if (!admin) {
      return res.status(401).json({ error: 'Admin not found' });
    }

    res.json({ 
      valid: true, 
      admin: toPublicAdmin(admin)
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

const hasExplicitPublicBaseUrl = Boolean(String(process.env.PUBLIC_BASE_URL || process.env.VERCEL_URL || '').trim());
const preferredPorts = [
  Number(PORT),
  3002,
  3001,
  3000
].filter((value, index, arr) => Number.isFinite(value) && value > 0 && arr.indexOf(value) === index);

function startServerWithPortFallback(index = 0) {
  const candidatePort = preferredPorts[index];

  if (!candidatePort) {
    console.error('\n❌ Unable to start server. No available configured fallback ports.');
    process.exit(1);
  }

  const server = app.listen(candidatePort, () => {
    ACTIVE_PORT = candidatePort;
    if (!hasExplicitPublicBaseUrl) {
      PUBLIC_BASE_URL = `http://localhost:${ACTIVE_PORT}`;
    }

    console.log(`CEO UNISEX SALON Server running at http://localhost:${ACTIVE_PORT}`);
    if (index > 0) {
      console.log(`ℹ️  Auto-picked fallback port ${ACTIVE_PORT}.`);
    }
    if (!hasExplicitPublicBaseUrl) {
      console.log(`ℹ️  PUBLIC_BASE_URL set to ${PUBLIC_BASE_URL}`);
    }
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      const nextPort = preferredPorts[index + 1];
      if (nextPort) {
        console.warn(`⚠️  Port ${candidatePort} is busy; trying ${nextPort}...`);
        return startServerWithPortFallback(index + 1);
      }

      console.error(`\n❌ Ports tried: ${preferredPorts.join(', ')} are all in use.`);
      console.error('   - Close the other app(s) using these ports, OR');
      console.error('   - Start with a free custom port, e.g. PORT=3100 (Windows: set PORT=3100)');
      console.error('   - If you set PUBLIC_BASE_URL manually, ensure it matches your active port.\n');
      process.exit(1);
    }

    console.error('\n❌ Server failed to start:', err);
    process.exit(1);
  });
}

if (!IS_VERCEL_RUNTIME && require.main === module) {
  startServerWithPortFallback();
}

module.exports = app;
