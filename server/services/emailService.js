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

module.exports = { sendOtpEmail };
