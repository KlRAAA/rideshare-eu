const nodemailer = require('nodemailer');

// Reserved names that can never receive mail (RFC 2606 / RFC 6761). Test and
// seed accounts use them, so skipping them keeps automated runs from sending
// real messages that would only bounce back to the SMTP account.
const RESERVED_TLDS = ['.test', '.local', '.localhost', '.invalid', '.example'];
const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org'];

function isUndeliverableAddress(email) {
  const domain = String(email).split('@').pop().toLowerCase();
  return RESERVED_DOMAINS.includes(domain) || RESERVED_TLDS.some((tld) => domain.endsWith(tld));
}

function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// "RideShareEU <no-reply@x.ph>" → { name, email }, for APIs that want them apart.
function parseFrom(from) {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from || '');
  return match ? { name: match[1] || undefined, email: match[2] } : { email: String(from || '').trim() };
}

async function sendViaApi(url, init, provider) {
  const res = await fetch(url, { method: 'POST', ...init, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${provider} refused the email (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

// Railway's Hobby plan blocks SMTP, so production sends through an HTTPS email
// API: Resend (RESEND_API_KEY) or Brevo (BREVO_API_KEY). SMTP stays for local
// use. `devLog` is printed instead of sending when nothing is configured (dev
// only) or the address can never receive mail.
async function deliver({ to, subject, text, devLog }) {
  if (isUndeliverableAddress(to)) {
    console.warn(`[email skipped: reserved test domain] ${devLog}`);
    return;
  }
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (process.env.RESEND_API_KEY) {
    return sendViaApi(
      'https://api.resend.com/emails',
      {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, text }),
      },
      'Resend'
    );
  }
  if (process.env.BREVO_API_KEY) {
    return sendViaApi(
      'https://api.brevo.com/v3/smtp/email',
      {
        headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender: parseFrom(from), to: [{ email: to }], subject, textContent: text }),
      },
      'Brevo'
    );
  }
  const transport = getTransport();
  if (!transport) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`No email provider is configured — cannot send "${subject}" in production.`);
    }
    console.log(`[dev-only] ${devLog}`);
    return;
  }
  await transport.sendMail({ from, to, subject, text });
}

async function sendOtpEmail(email, otp) {
  await deliver({
    to: email,
    subject: 'Your RideShareEU verification code',
    text: `Your verification code is ${otp}. It expires in 10 minutes.`,
    devLog: `OTP for ${email}: ${otp}`,
  });
}

// Deliberately omits the reporter's identity and any report description: the
// reported user must never learn who reported them or what was said.
async function sendBanNotificationEmail(email, { categoryLabel, permanent, bannedUntil, byAdmin = false }) {
  const durationLine = permanent
    ? 'This suspension does not have an automatic end date.'
    : `This suspension is temporary and lifts automatically on ${bannedUntil.toISOString()}.`;
  const appealEmail = process.env.REPORT_APPEAL_EMAIL || 'support@rideshareeu.local';
  const body = byAdmin
    ? `Your RideShareEU account has been suspended by a RideShareEU administrator ` +
      `for: ${categoryLabel}.\n\n` +
      `${durationLine}\n\n` +
      `If you believe this was a mistake, you can request a review at ${appealEmail}.`
    : `Your RideShareEU account has been automatically suspended following reports ` +
      `categorized as: ${categoryLabel}.\n\n` +
      `${durationLine}\n\n` +
      `This action was taken automatically based on report volume and category — it was not reviewed by a person. ` +
      `If you believe this was a mistake, you can request a review at ${appealEmail}.`;

  await deliver({
    to: email,
    subject: 'Your RideShareEU account has been suspended',
    text: body,
    devLog: `Ban notification for ${email}:\n${body}`,
  });
}

// An official warning. Names the reason and the admin's note, never the reporter.
async function sendWarningEmail(email, { reasonLabel, note }) {
  const appealEmail = process.env.REPORT_APPEAL_EMAIL || 'support@rideshareeu.local';
  const body =
    `You have received an official warning from a RideShareEU administrator for: ${reasonLabel}.\n\n` +
    (note ? `Note from the administrator: ${note}\n\n` : '') +
    `Your account is still active. Repeated issues can lead to a suspension. ` +
    `If you believe this was a mistake, contact us through Help in the app or at ${appealEmail}.`;
  await deliver({
    to: email,
    subject: 'An official warning about your RideShareEU account',
    text: body,
    devLog: `Warning notification for ${email}:\n${body}`,
  });
}

module.exports = { sendOtpEmail, sendBanNotificationEmail, sendWarningEmail, isUndeliverableAddress, parseFrom };
