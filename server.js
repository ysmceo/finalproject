const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_SECRET_PASSCODE = process.env.ADMIN_SECRET_PASSCODE || 'CHANGE_ME_ADMIN_PASSCODE';
const ONE_TIME_CODE_TTL_MS = 10 * 60 * 1000;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_PAYMENT_PAGE_URL = process.env.PAYSTACK_PAYMENT_PAGE_URL || '';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
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
const PAYMENT_RECEIPTS_BCC = process.env.PAYMENT_RECEIPTS_BCC || '';
const SEND_ADMIN_LOGIN_OTP_EMAILS = String(process.env.SEND_ADMIN_LOGIN_OTP_EMAILS || 'true').trim().toLowerCase() === 'true';
const SEND_ADMIN_LOGIN_OTP_SMS = String(process.env.SEND_ADMIN_LOGIN_OTP_SMS || 'true').trim().toLowerCase() === 'true';
const ALLOW_ADMIN_OTP_RESPONSE_FALLBACK = String(process.env.ALLOW_ADMIN_OTP_RESPONSE_FALLBACK || 'true').trim().toLowerCase() === 'true';

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

function getMailer() {
  if (!isSmtpConfigured()) {
    const err = new Error('SMTP is not configured');
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }

  return nodemailer.createTransport({
    host: String(SMTP_HOST).trim(),
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: String(SMTP_USER).trim(),
      pass: String(SMTP_PASS)
    }
  });
}

async function sendEmail({ to, subject, text, html, replyTo, bcc }) {
  const transporter = getMailer();
  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to,
    bcc: String(bcc || '').trim() || undefined,
    subject,
    text,
    html,
    replyTo: replyTo || undefined
  });
  return info;
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

  const text = `Hi ${booking.name || 'Customer'},\n\nWe received your payment for your booking.\n\nBooking ID: ${bookingId}\nService: ${serviceName}\nAmount paid: ${amountText}\nProvider: ${providerLabel}\nReference: ${safeRef || 'N/A'}\nReceipt: ${safeReceiptUrl || 'N/A'}\n\nThank you for choosing CEO Unisex Salon.`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5;">
      <h2 style="margin:0 0 10px; color:#4a0e4e;">Payment Receipt</h2>
      <p style="margin:0 0 12px;">Hi <strong>${String(booking.name || 'Customer').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</strong>,</p>
      <p style="margin:0 0 12px;">We received your payment for your booking.</p>
      <div style="padding:12px; border:1px solid #eee; border-radius:10px; background:#faf7ff;">
        <div><strong>Booking ID:</strong> ${bookingId}</div>
        <div><strong>Service:</strong> ${serviceName.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        <div><strong>Amount paid:</strong> ${amountText}</div>
        <div><strong>Provider:</strong> ${providerLabel}</div>
        <div><strong>Reference:</strong> ${safeRef ? safeRef.replace(/</g,'&lt;').replace(/>/g,'&gt;') : 'N/A'}</div>
        <div><strong>Receipt:</strong> ${safeReceiptUrl ? `<a href="${safeReceiptUrl}" target="_blank" rel="noopener">View receipt</a>` : 'N/A'}</div>
      </div>
      <p style="margin:12px 0 0; color:#666; font-size: 13px;">Thank you for choosing CEO Unisex Salon.</p>
    </div>
  `;

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

  const subject = next === 'approved'
    ? `CEO Unisex Salon - Appointment Accepted${bookingId ? ` (${bookingId})` : ''}`
    : `CEO Unisex Salon - Appointment Declined${bookingId ? ` (${bookingId})` : ''}`;

  const safeName = String(booking.name || 'Customer').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeService = serviceName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeBookingId = bookingId.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeDateTime = `${date}${time ? ` at ${time}` : ''}`.trim();

  const acceptedText = `Hi ${booking.name || 'Customer'},\n\nCEO Unisex Salon has ACCEPTED your appointment.\n\nService: ${serviceName}\nBooking Code: ${bookingCode}\nBooking ID: ${bookingId || 'N/A'}\nScheduled for: ${safeDateTime || 'N/A'}\n\nYour service will be rendered on the due date/time as requested in your booking.\n\nIf you need to reschedule, please reply to this email or contact the salon.\n\nThank you for choosing CEO Unisex Salon.`;
  const declinedText = `Hi ${booking.name || 'Customer'},\n\nCEO Unisex Salon has DECLINED your appointment.\n\nService: ${serviceName}\nBooking Code: ${bookingCode}\nBooking ID: ${bookingId || 'N/A'}\nScheduled for: ${safeDateTime || 'N/A'}\n\nPlease contact the salon if you believe this was a mistake or to book another date/time.\n\nThank you.`;

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

  const safe = (v) => String(v || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const subject = `New Booking Received - ${bookingCode}${bookingId ? ` (${bookingId})` : ''}`;
  const text = `A new booking has been created.\n\nBooking Code: ${bookingCode}\nBooking ID: ${bookingId || 'N/A'}\nCustomer: ${customerName}\nCustomer Email: ${customerEmail || 'N/A'}\nCustomer Phone: ${customerPhone || 'N/A'}\nService: ${serviceName}\nScheduled for: ${when}\nService Mode: ${serviceMode}\nAmount Due Now: ₦${Number(booking.amountDueNow || 0).toLocaleString()}\nPayment Method: ${String(booking.paymentMethod || '').trim() || 'N/A'}\n\nPlease log in to the admin dashboard to review this booking.`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5;">
      <h2 style="margin:0 0 10px; color:#4a0e4e;">📌 New Booking Received</h2>
      <p style="margin:0 0 12px;">A new customer booking has been submitted.</p>
      <div style="padding:12px; border:1px solid #eee; border-radius:10px; background:#faf7ff;">
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
      <p style="margin:12px 0 0; color:#666; font-size:13px;">Please review this booking in the admin dashboard.</p>
    </div>
  `;

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

  const message = next === 'approved'
    ? `CEO Unisex Salon: Appointment ACCEPTED. ${serviceName}. ${when ? `Due: ${when}. ` : ''}Booking Code: ${bookingCode}. ${bookingId ? `Booking ID: ${bookingId}. ` : ''}Service will be rendered on the due date/time as requested.`
    : `CEO Unisex Salon: Appointment DECLINED. ${serviceName}. ${when ? `Due: ${when}. ` : ''}Booking Code: ${bookingCode}. ${bookingId ? `Booking ID: ${bookingId}. ` : ''}Please contact the salon to reschedule.`;

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
const SALON_BANK_NAME = process.env.SALON_BANK_NAME || 'YSMBANK CEOS';
const SALON_BANK_ACCOUNT_NAME = process.env.SALON_BANK_ACCOUNT_NAME || 'CEO SALOON';

let monnifyAccessTokenCache = {
  token: '',
  expiresAtMs: 0
};

function getDefaultProducts() {
  return [
    { id: 1, name: 'Bread Oil', category: 'Grooming', price: 4500, stock: 35, image: '/images/bread oil.jpeg' },
    { id: 2, name: 'Hair Oil', category: 'Hair Care', price: 3500, stock: 42, image: '/images/hair oil.jpeg' },
    { id: 3, name: 'Face Cream', category: 'Skin Care', price: 5000, stock: 28, image: '/images/face cream.jpeg' },
    { id: 4, name: 'Hair Cream', category: 'Hair Care', price: 4000, stock: 40, image: '/images/hair cream.jpeg' },
    { id: 5, name: 'Prefume', category: 'Fragrance', price: 9000, stock: 22, image: '/images/prefume.jpeg' },
    { id: 6, name: 'Premium Wig', category: 'Wigs', price: 45000, stock: 12, image: '/images/premium wig.jpeg' },
    { id: 7, name: 'Wig Revampimg', category: 'Wig Service', price: 15000, stock: 999, image: '/images/wig revamping.jpeg' },
    { id: 9, name: 'Wig Frsh Oil', category: 'Wig Care', price: 6000, stock: 30, image: '/images/wig fresh oil.jpeg' }
  ];
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
    mergedProducts[existingIndex] = {
      ...existingProduct,
      name: defaultProduct.name,
      category: defaultProduct.category,
      price: Number(existingProduct.price) || defaultProduct.price,
      stock: Number(existingProduct.stock) || defaultProduct.stock,
      image: existingProduct.image || defaultProduct.image
    };
  });

  return mergedProducts;
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
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
app.use(express.static('public'));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.get('/p1.webp', (req, res) => {
  res.sendFile(path.join(__dirname, 'images', 'p1.webp'));
});
app.get('/p2.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'images', 'p2 hair color.jpg'));
});
app.get('/p3.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'images', 'p3.jpg'));
});
app.get('/p4.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'p4.jpg'));
});
app.get('/p5.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'images', 'p5 relaxation services.jpg'));
});
app.get('/p6.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'images', 'p6 styling.jpg'));
});
app.get('/male-stylist.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'male baber sytlist.jpeg'));
});

// Database file path
const dbPath = path.join(__dirname, 'database.json');

// Initialize database
function initializeDatabase() {
  if (!fs.existsSync(dbPath)) {
    const initialData = {
      bookings: [],
      productOrders: [],
      messages: [],
      admins: [],
      adminAccessCodes: [],
      products: getDefaultProducts(),
      services: [
        { id: 1, name: 'Hair Cut', price: 5000, duration: 30 },
        { id: 2, name: 'Hair Coloring', price: 15000, duration: 60 },
        { id: 3, name: 'Facial Treatment', price: 8000, duration: 45 },
        { id: 4, name: 'Manicure', price: 4000, duration: 30 },
        { id: 5, name: 'Pedicure', price: 5000, duration: 40 },
        { id: 6, name: 'Hair Spa', price: 12000, duration: 60 },
        { id: 7, name: 'Beard Trim', price: 3000, duration: 20 },
        { id: 8, name: 'Full Body Massage', price: 18000, duration: 60 }
      ]
    };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
  }
}

// Helper functions to read/write database
function readDatabase() {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  if (!Array.isArray(db.bookings)) db.bookings = [];
  if (!Array.isArray(db.productOrders)) db.productOrders = [];
  if (!Array.isArray(db.messages)) db.messages = [];
  if (!Array.isArray(db.services)) db.services = [];
  if (!Array.isArray(db.products)) db.products = [];
  if (!Array.isArray(db.admins)) db.admins = [];
  if (!Array.isArray(db.adminAccessCodes)) db.adminAccessCodes = [];
  if (!Array.isArray(db.bookingNotifications)) db.bookingNotifications = [];

  if (db.products.length === 0) {
    db.products = getDefaultProducts();
    writeDatabase(db);
  } else {
    const mergedProducts = mergeProductDefaults(db.products);
    const hasChanges = JSON.stringify(mergedProducts) !== JSON.stringify(db.products);

    if (hasChanges) {
      db.products = mergedProducts;
      writeDatabase(db);
    }
  }

  return db;
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

function normalizePhone(phone) {
  return String(phone || '').trim();
}

function buildBankTransferReference(bookingId) {
  const shortId = String(bookingId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return `CEOSALOON-${shortId || 'BOOKING'}`;
}

function buildBookingStatusCode(bookingId) {
  const shortId = String(bookingId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return `BOOK-${shortId || 'UNKNOWN'}`;
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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
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
    name: admin.name
  };

  next();
}

function writeDatabase(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Initialize database on startup
initializeDatabase();

// Routes

// Admin Dashboard Routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Get all services
app.get('/api/services', (req, res) => {
  const db = readDatabase();
  res.json(db.services);
});

// Get all products
app.get('/api/products', (req, res) => {
  const db = readDatabase();
  res.json(db.products);
});

// Create product order (Customer)
app.post('/api/product-orders', async (req, res) => {
  const {
    name,
    email,
    phone,
    address,
    paymentMethod,
    items
  } = req.body || {};

  const normalizedName = String(name || '').trim();
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  const normalizedAddress = String(address || '').trim();
  const normalizedPaymentMethod = String(paymentMethod || '').trim();
  const normalizedItems = Array.isArray(items) ? items : [];

  if (!normalizedName || !normalizedEmail || !normalizedPhone || !normalizedAddress || !normalizedPaymentMethod) {
    return res.status(400).json({ error: 'name, email, phone, address and paymentMethod are required' });
  }

  if (!normalizedItems.length) {
    return res.status(400).json({ error: 'At least one product item is required' });
  }

  const db = readDatabase();
  const orderItems = [];
  let totalAmount = 0;

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
    totalAmount += lineTotal;

    orderItems.push({
      productId: Number(product.id),
      name: String(product.name || ''),
      category: String(product.category || ''),
      unitPrice,
      quantity: qty,
      lineTotal
    });
  }

  if (totalAmount <= 0) {
    return res.status(400).json({ error: 'Order amount must be greater than zero' });
  }

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
    totalAmount,
    amountDueNow: totalAmount,
    amountRemaining: totalAmount,
    paymentStatus: 'pending',
    paymentProvider: '',
    paymentReference: '',
    paidAmount: 0,
    bankTransferReference: '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  if (normalizedPaymentMethod === 'Bank Transfer') {
    order.bankTransferReference = `CEOSALOON-PROD-${String(order.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`;
  }

  db.productOrders.push(order);

  let adminEmailResult = null;
  try {
    if (SEND_ADMIN_NEW_BOOKING_EMAILS && isSmtpConfigured() && Array.isArray(db.admins) && db.admins.length) {
      const recipients = Array.from(new Set(db.admins.map(a => normalizeEmail(a.email)).filter(Boolean)));
      if (recipients.length) {
        const itemsHtml = order.items.map(i => `<li>${String(i.name).replace(/</g,'&lt;').replace(/>/g,'&gt;')} × ${i.quantity} — ₦${Number(i.lineTotal || 0).toLocaleString()}</li>`).join('');
        const text = `New product order received.\n\nOrder ID: ${order.id}\nCustomer: ${order.name}\nEmail: ${order.email}\nPhone: ${order.phone}\nTotal: ₦${Number(order.totalAmount || 0).toLocaleString()}\nPayment Method: ${order.paymentMethod}`;
        const html = `
          <div style="font-family: Arial, sans-serif; line-height:1.5;">
            <h2 style="margin:0 0 10px; color:#4a0e4e;">🛒 New Product Order</h2>
            <p><strong>Order ID:</strong> ${String(order.id).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
            <p><strong>Customer:</strong> ${String(order.name).replace(/</g,'&lt;').replace(/>/g,'&gt;')} (${String(order.email).replace(/</g,'&lt;').replace(/>/g,'&gt;')})</p>
            <p><strong>Phone:</strong> ${String(order.phone).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
            <p><strong>Address:</strong> ${String(order.address).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
            <p><strong>Payment Method:</strong> ${String(order.paymentMethod).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
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

  writeDatabase(db);

  return res.status(201).json({
    message: `Product order created successfully. Order ID: ${order.id}`,
    notifications: { adminEmail: adminEmailResult },
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

// Track product order (Customer)
app.get('/api/product-orders/:id/track', (req, res) => {
  const orderId = String(req.params.id || '').trim();
  const email = normalizeEmail(req.query.email);

  if (!orderId || !email) {
    return res.status(400).json({ error: 'Order id and email are required' });
  }

  const db = readDatabase();
  const order = db.productOrders.find(o => String(o.id) === orderId);

  if (!order) {
    return res.status(404).json({ error: 'Product order not found' });
  }

  if (normalizeEmail(order.email) !== email) {
    return res.status(401).json({ error: 'Email does not match this product order' });
  }

  return res.json({ order });
});

// Get all products (Admin)
app.get('/api/admin/products', requireAdminAuth, (req, res) => {
  const db = readDatabase();
  res.json(db.products);
});

// Create product (Admin)
app.post('/api/admin/products', requireAdminAuth, upload.single('productImage'), (req, res) => {
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

  db.products.push(product);
  writeDatabase(db);

  res.status(201).json({ message: 'Product added successfully', product });
});

// Update product image (Admin)
app.put('/api/admin/products/:id/image', requireAdminAuth, upload.single('productImage'), (req, res) => {
  const productId = Number(req.params.id);

  if (!req.file) {
    return res.status(400).json({ error: 'Product image file is required' });
  }

  const db = readDatabase();
  const product = db.products.find(p => Number(p.id) === productId);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  product.image = `/uploads/${req.file.filename}`;
  product.updatedAt = new Date().toISOString();
  writeDatabase(db);

  res.json({ message: 'Product image updated successfully', product });
});

// Delete product (Admin)
app.delete('/api/admin/products/:id', requireAdminAuth, (req, res) => {
  const productId = Number(req.params.id);
  const db = readDatabase();
  const existingCount = db.products.length;

  db.products = db.products.filter(p => Number(p.id) !== productId);

  if (db.products.length === existingCount) {
    return res.status(404).json({ error: 'Product not found' });
  }

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

  if (!name || !email || !phone || !serviceId || !date || !time || !paymentMethod || !normalizedPaymentPlan) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['full', 'deposit_50'].includes(normalizedPaymentPlan)) {
    return res.status(400).json({ error: 'Invalid payment plan. Use full or deposit_50.' });
  }

  if (isHomeServiceRequested && !normalizedHomeServiceAddress) {
    return res.status(400).json({ error: 'Home service address is required when requesting home service' });
  }

  const db = readDatabase();
  const service = db.services.find(s => s.id === parseInt(serviceId));

  if (!service) {
    return res.status(400).json({ error: 'Service not found' });
  }

  const totalAmount = Number(service.price) || 0;
  const amountDueNow = normalizedPaymentPlan === 'deposit_50' ? Math.ceil(totalAmount * 0.5) : totalAmount;
  const amountRemaining = Math.max(0, totalAmount - amountDueNow);

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

  const booking = {
    id: uuidv4(),
    name,
    email,
    phone,
    serviceId: parseInt(serviceId),
    serviceName: service.name,
    price: service.price,
    date,
    time,
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

  writeDatabase(db);

  res.status(201).json({
    message: `Your service order has been made. A customer care representative will reach out to you via the email and phone number provided. Booking ID: ${booking.id}. Payment: ${normalizedPaymentPlan === 'deposit_50' ? '50% deposit' : 'full'} (₦${amountDueNow.toLocaleString()} due now).`,
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
      adminEmail: adminBookingEmail
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

// Track booking status + notifications (Customer)
app.get('/api/bookings/:id/track', (req, res) => {
  const bookingId = String(req.params.id || '').trim();
  const email = normalizeEmail(req.query.email);

  if (!bookingId || !email) {
    return res.status(400).json({ error: 'Booking id and email are required' });
  }

  const db = readDatabase();
  const booking = db.bookings.find(b => String(b.id) === bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (normalizeEmail(booking.email) !== email) {
    return res.status(401).json({ error: 'Email does not match this booking' });
  }

  const notifications = (db.bookingNotifications || [])
    .filter(n => String(n.bookingId) === bookingId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  res.json({
    booking: {
      id: booking.id,
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
app.get('/api/admin/product-orders', requireAdminAuth, (req, res) => {
  const db = readDatabase();
  res.json(db.productOrders || []);
});

// Update product order status (Admin)
app.put('/api/admin/product-orders/:id', requireAdminAuth, (req, res) => {
  const orderId = String(req.params.id || '').trim();
  const status = String((req.body && req.body.status) || '').trim().toLowerCase();

  if (!['pending', 'approved', 'cancelled', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const db = readDatabase();
  const order = (db.productOrders || []).find(o => String(o.id) === orderId);

  if (!order) {
    return res.status(404).json({ error: 'Product order not found' });
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();
  writeDatabase(db);

  return res.json({ message: 'Product order updated successfully', order });
});

// Delete product order (Admin)
app.delete('/api/admin/product-orders/:id', requireAdminAuth, (req, res) => {
  const orderId = String(req.params.id || '').trim();
  const db = readDatabase();
  const before = (db.productOrders || []).length;
  db.productOrders = (db.productOrders || []).filter(o => String(o.id) !== orderId);

  if (db.productOrders.length === before) {
    return res.status(404).json({ error: 'Product order not found' });
  }

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
app.put('/api/admin/bookings/:id', requireAdminAuth, async (req, res) => {
  const { status } = req.body;
  const bookingId = req.params.id;

  // Backward compatibility: map old status names to new ones
  const normalizedStatusMap = {
    accepted: 'approved',
    declined: 'cancelled'
  };
  const normalizedStatus = normalizedStatusMap[status] || status;

  if (!['pending', 'approved', 'cancelled', 'completed', 'accepted', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const db = readDatabase();
  const booking = db.bookings.find(b => b.id === bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const previousStatus = booking.status;
  booking.status = normalizedStatus;
  booking.updatedAt = new Date().toISOString();

  if (previousStatus !== normalizedStatus && normalizedStatus === 'approved') {
    addBookingNotification(
      db,
      booking,
      'approved',
      '✅ Your booking has been approved! We will contact you shortly using the email and phone number you provided.'
    );
  }

  if (previousStatus !== normalizedStatus && normalizedStatus === 'cancelled') {
    addBookingNotification(
      db,
      booking,
      'cancelled',
      '❌ Your booking was cancelled. Please contact the salon if you believe this was a mistake.'
    );
  }

  let bookingStatusEmailResult = null;
  let bookingStatusSmsResult = null;

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

  writeDatabase(db);

  res.json({
    message: 'Booking updated successfully',
    booking,
    notifications: {
      email: bookingStatusEmailResult,
      sms: bookingStatusSmsResult
    }
  });
});

// Approve or disapprove booking image
app.put('/api/admin/bookings/:id/approve-image', requireAdminAuth, (req, res) => {
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
  writeDatabase(db);

  res.json({ message: 'Image approval updated successfully', booking });
});

// Test booking status notifications (Admin)
// This endpoint helps confirm email/SMS delivery config without changing booking status.
app.post('/api/admin/bookings/:id/test-notify', requireAdminAuth, async (req, res) => {
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

  writeDatabase(db);
  return res.json({ message: 'Notification test completed', bookingId, status, notifications: { email, sms } });
});

// Send message
app.post('/api/messages', upload.single('reportFile'), (req, res) => {
  const { name, email, subject, message, reportType } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db = readDatabase();
  const msg = {
    id: uuidv4(),
    name,
    email,
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

// Delete booking (Admin)
app.delete('/api/admin/bookings/:id', requireAdminAuth, (req, res) => {
  const bookingId = req.params.id;
  const db = readDatabase();
  db.bookings = db.bookings.filter(b => b.id !== bookingId);
  writeDatabase(db);

  res.json({ message: 'Booking deleted successfully' });
});

// Admin Authentication Routes

// Request one-time admin login access code (requires secret passcode)
app.post('/api/admin/request-login-access', async (req, res) => {
  const { email, secretPasscode, phone } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedSecretPasscode = String(secretPasscode || '').trim();
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail || !normalizedSecretPasscode) {
    return res.status(400).json({ error: 'Email and secret passcode are required' });
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

  if (SEND_ADMIN_LOGIN_OTP_EMAILS) {
    delivery.email.attempted = true;

    if (!isSmtpConfigured()) {
      delivery.email.skipped = true;
      delivery.email.reason = 'SMTP not configured';
    } else {
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

        await sendEmail({
          to: normalizeEmail(admin.email),
          subject,
          text,
          html
        });

        delivery.email.sent = true;
      } catch (error) {
        delivery.email.reason = error && error.message ? String(error.message) : 'Failed to send OTP email';
      }
    }
  }

  if (SEND_ADMIN_LOGIN_OTP_SMS) {
    delivery.sms.attempted = true;
    const adminPhone = normalizePhone(admin.phone);
    const smsTo = normalizePhoneToE164(adminPhone);

    if (!adminPhone) {
      delivery.sms.skipped = true;
      delivery.sms.reason = 'Admin phone is not configured';
    } else if (!isTermiiConfigured()) {
      delivery.sms.skipped = true;
      delivery.sms.reason = 'Termii is not configured';
    } else if (!smsTo) {
      delivery.sms.skipped = true;
      delivery.sms.reason = 'Invalid admin phone number';
    } else {
      try {
        await sendSmsViaTermii({
          to: smsTo,
          message: `${otpMessage}. It expires in 10 minutes.`
        });
        delivery.sms.sent = true;
      } catch (error) {
        delivery.sms.reason = error && error.message ? String(error.message) : 'Failed to send OTP SMS';
      }
    }
  }

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
    phone: normalizedPhone || '',
    createdAt: new Date().toISOString()
  };

  db.admins.push(newAdmin);
  writeDatabase(db);

  res.status(201).json({ 
    message: 'Admin registered successfully',
    admin: { id: newAdmin.id, email: newAdmin.email, name: newAdmin.name }
  });
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { email, password, oneTimeCode, secretPasscode } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password || '').trim();
  const normalizedOneTimeCode = String(oneTimeCode || '').trim();
  const normalizedSecretPasscode = String(secretPasscode || '').trim();

  if (!normalizedEmail || !normalizedPassword) {
    return res.status(400).json({ error: 'Email and password are required' });
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

  const usedSecretPasscodeForLogin = normalizedSecretPasscode === ADMIN_SECRET_PASSCODE;

  if (!usedSecretPasscodeForLogin && !normalizedOneTimeCode) {
    return res.status(400).json({
      error: 'Provide either a valid secret passcode or a one-time access code'
    });
  }

  if (!usedSecretPasscodeForLogin && normalizedSecretPasscode && normalizedSecretPasscode !== ADMIN_SECRET_PASSCODE) {
    return res.status(401).json({ error: 'Invalid secret passcode' });
  }

  if (usedSecretPasscodeForLogin) {
    return res.json({ 
      message: 'Login successful',
      admin: { 
        id: admin.id, 
        email: admin.email, 
        name: admin.name 
      },
      token: Buffer.from(`${admin.email}:${admin.id}`).toString('base64')
    });
  }

  const now = Date.now();
  const validAccessCode = db.adminAccessCodes.find(code => {
    return (
      normalizeEmail(code.email) === normalizeEmail(admin.email) &&
      String(code.code || '').trim() === normalizedOneTimeCode &&
      code.used !== true &&
      new Date(code.expiresAt).getTime() > now
    );
  });

  if (!validAccessCode) {
    return res.status(401).json({ error: 'Invalid or expired one-time access code' });
  }

  validAccessCode.used = true;
  validAccessCode.usedAt = new Date().toISOString();

  // Cleanup stale/used codes to keep DB tidy
  db.adminAccessCodes = db.adminAccessCodes.filter(code => {
    const isExpired = new Date(code.expiresAt).getTime() <= now;
    return !isExpired && !code.used;
  });
  writeDatabase(db);

  res.json({ 
    message: 'Login successful',
    admin: { 
      id: admin.id, 
      email: admin.email, 
      name: admin.name 
    },
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
      admin: { 
        id: admin.id, 
        email: admin.email, 
        name: admin.name 
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`CEO UNISEX SALON Server running at http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error('   - Close the other app using this port, OR');
    console.error('   - Set a different port, e.g. PORT=3001 (Windows: set PORT=3001)');
    console.error('   - If you also use PUBLIC_BASE_URL, update it to match the new port.\n');
    process.exit(1);
  }

  console.error('\n❌ Server failed to start:', err);
  process.exit(1);
});
