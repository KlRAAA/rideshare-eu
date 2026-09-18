const nodemailer = require('nodemailer');

function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendOtpEmail(email, otp) {
  const transport = getTransport();
  if (!transport) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP is not configured — cannot send OTP email in production.');
    }
    // Dev-only fallback so registration is testable before SMTP creds exist.
    console.log(`[dev-only] OTP for ${email}: ${otp}`);
    return;
  }
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Your RideShareEU verification code',
    text: `Your verification code is ${otp}. It expires in 10 minutes.`,
  });
}

// Sent from the same code path that sets `bannedUntil` (reportEnforcementService's
// applyBanIfWarranted) — never manually, since no admin reviews these bans.
// Deliberately omits the reporter's identity and any report description: the
// reported user must never learn who reported them or what was said, and the
// tone stays factual rather than accusatory since nothing here was human-reviewed.
async function sendBanNotificationEmail(email, { categoryLabel, permanent, bannedUntil }) {
  const durationLine = permanent
    ? 'This suspension does not have an automatic end date.'
    : `This suspension is temporary and lifts automatically on ${bannedUntil.toISOString()}.`;
  const appealEmail = process.env.REPORT_APPEAL_EMAIL || 'support@rideshareeu.local';
  const body =
    `Your RideShareEU account has been automatically suspended following reports ` +
    `categorized as: ${categoryLabel}.\n\n` +
    `${durationLine}\n\n` +
    `This action was taken automatically based on report volume and category — it was not reviewed by a person. ` +
    `If you believe this was a mistake, you can request a review at ${appealEmail}.`;

  const transport = getTransport();
  if (!transport) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP is not configured — cannot send ban notification email in production.');
    }
    console.log(`[dev-only] Ban notification for ${email}:\n${body}`);
    return;
  }
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Your RideShareEU account has been suspended',
    text: body,
  });
}

module.exports = { sendOtpEmail, sendBanNotificationEmail };
