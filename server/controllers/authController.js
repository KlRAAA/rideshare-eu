const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { generateOtp, hashOtp, verifyOtp, otpExpiryDate, MAX_ATTEMPTS } = require('../services/otpService');
const { sendOtpEmail } = require('../services/emailService');

const STUDENT_DOMAIN = '@student.mseuf.edu.ph';
const STAFF_DOMAIN = '@mseuf.edu.ph';

// A fixed-cost stand-in for login's bcrypt.compare when no real user exists,
// so an unknown email takes the same time to reject as a wrong password —
// not tied to any real account, just an anchor for the compare's own cost.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('rsu-timing-safe-placeholder', 12);

function inferRole(email) {
  if (email.endsWith(STUDENT_DOMAIN)) return 'STUDENT';
  // Base domain covers both Faculty and Staff; the email alone can't tell
  // them apart without an ICTD record, so this defaults to FACULTY — a
  // documented limitation, not a full solution (see the plan's decisions log).
  if (email.endsWith(STAFF_DOMAIN)) return 'FACULTY';
  return null;
}

// Step 1 of 3: strict domain whitelist, then issue and email an OTP.
async function startRegistration(req, res) {
  const { email } = req.body;
  const role = email ? inferRole(email) : null;
  if (!role) {
    return res.status(400).json({ error: 'INVALID_DOMAIN', message: 'Email must end in @student.mseuf.edu.ph or @mseuf.edu.ph.' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'ACCOUNT_EXISTS' });

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  await prisma.emailVerification.create({
    data: { email, otpHash, expiresAt: otpExpiryDate() },
  });
  await sendOtpEmail(email, otp);

  return res.json({ status: 'OTP_SENT' });
}

// Step 2 of 3: verify the OTP, issue a short-lived ticket for Step 3.
async function verifyRegistrationOtp(req, res) {
  const { email, otp } = req.body;

  const record = await prisma.emailVerification.findFirst({
    where: { email, consumed: false },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return res.status(400).json({ error: 'NO_PENDING_OTP' });
  if (record.expiresAt < new Date()) return res.status(400).json({ error: 'OTP_EXPIRED' });
  if (record.attempts >= MAX_ATTEMPTS) return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });

  const valid = await verifyOtp(otp, record.otpHash);
  if (!valid) {
    await prisma.emailVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return res.status(401).json({ error: 'INVALID_OTP' });
  }

  await prisma.emailVerification.update({ where: { id: record.id }, data: { consumed: true } });

  const verificationTicket = jwt.sign({ email, purpose: 'complete-registration' }, process.env.JWT_SECRET, { expiresIn: '15m' });
  return res.json({ verificationTicket });
}

// Step 3 of 3: set password + name, create the User, issue a session token.
async function completeRegistration(req, res) {
  const { verificationTicket, password, fullName, universityId, gender } = req.body;

  let payload;
  try {
    payload = jwt.verify(verificationTicket, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'INVALID_OR_EXPIRED_TICKET' });
  }
  if (payload.purpose !== 'complete-registration') return res.status(401).json({ error: 'INVALID_OR_EXPIRED_TICKET' });

  const { email } = payload;

  // Mirrors register/page.tsx's validateFullName — enforced here too since
  // the client check is only a UX convenience, not a trust boundary.
  const trimmedFullName = (fullName || '').trim();
  const trimmedUniversityId = (universityId || '').trim();
  if (!trimmedFullName) return res.status(400).json({ error: 'EMPTY_FULL_NAME' });
  if (trimmedFullName.length < 3) return res.status(400).json({ error: 'FULL_NAME_TOO_SHORT' });
  if (trimmedFullName.toLowerCase() === trimmedUniversityId.toLowerCase()) {
    return res.status(400).json({ error: 'FULL_NAME_MATCHES_ID' });
  }
  // Same check resetPassword already enforces (below) — this path had none at
  // all, so a brand-new account could be created with a 1-character password
  // (only a client-side minLength=8 on the register form stood in the way).
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'PASSWORD_TOO_SHORT' });
  }

  const role = inferRole(email);
  const passwordHash = await bcrypt.hash(password, 12);
  const emailPrefix = email.split('@')[0];

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: trimmedFullName,
      universityId: trimmedUniversityId || emailPrefix,
      role,
      gender: gender === 'MALE' || gender === 'FEMALE' ? gender : 'UNSPECIFIED',
      verified: true,
    },
  });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return res.status(201).json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
}

// Forgot-password step 1: always respond the same way regardless of whether
// the account exists, to avoid leaking which emails are registered. Only the
// side effect (whether an OTP actually gets created/sent) differs.
async function requestPasswordReset(req, res) {
  const { email } = req.body;
  const GENERIC_RESPONSE = { status: 'OTP_SENT_IF_ACCOUNT_EXISTS' };

  if (!email) return res.status(400).json({ error: 'MISSING_EMAIL' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json(GENERIC_RESPONSE);

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  await prisma.emailVerification.create({
    data: { email, otpHash, expiresAt: otpExpiryDate() },
  });
  await sendOtpEmail(email, otp);

  return res.json(GENERIC_RESPONSE);
}

// Forgot-password step 2: same OTP-checking shape as verifyRegistrationOtp,
// but the issued ticket is scoped to 'reset-password' so it can't be replayed
// against completeRegistration (or vice versa) even though both tickets are
// signed with the same JWT_SECRET.
async function verifyPasswordResetOtp(req, res) {
  const { email, otp } = req.body;

  const record = await prisma.emailVerification.findFirst({
    where: { email, consumed: false },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return res.status(400).json({ error: 'NO_PENDING_OTP' });
  if (record.expiresAt < new Date()) return res.status(400).json({ error: 'OTP_EXPIRED' });
  if (record.attempts >= MAX_ATTEMPTS) return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });

  const valid = await verifyOtp(otp, record.otpHash);
  if (!valid) {
    await prisma.emailVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return res.status(401).json({ error: 'INVALID_OTP' });
  }

  await prisma.emailVerification.update({ where: { id: record.id }, data: { consumed: true } });

  const resetTicket = jwt.sign({ email, purpose: 'reset-password' }, process.env.JWT_SECRET, { expiresIn: '15m' });
  return res.json({ resetTicket });
}

// Forgot-password step 3: no session token issued — the frontend redirects
// to /login instead of auto-signing-in, per spec.
async function resetPassword(req, res) {
  const { resetTicket, password } = req.body;

  let payload;
  try {
    payload = jwt.verify(resetTicket, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'INVALID_OR_EXPIRED_TICKET' });
  }
  if (payload.purpose !== 'reset-password') return res.status(401).json({ error: 'INVALID_OR_EXPIRED_TICKET' });

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'PASSWORD_TOO_SHORT' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { email: payload.email }, data: { passwordHash } });

  return res.json({ status: 'PASSWORD_RESET' });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  // Same generic response whether the email doesn't exist or the password is
  // wrong — previously an unknown email got 404 ACCOUNT_NOT_FOUND while a
  // wrong password got 401, letting a client fingerprint which emails are
  // registered (requestPasswordReset already avoids exactly this). Comparing
  // against DUMMY_PASSWORD_HASH when there's no real user keeps the response
  // timing consistent too, not just the status code — bcrypt.compare's cost
  // is what a timing check would actually measure.
  const valid = await bcrypt.compare(password || '', user ? user.passwordHash : DUMMY_PASSWORD_HASH);
  if (!user || !valid) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
}

module.exports = {
  startRegistration,
  verifyRegistrationOtp,
  completeRegistration,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetPassword,
  login,
};
