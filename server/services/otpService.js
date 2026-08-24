const bcrypt = require('bcrypt');
const crypto = require('crypto');

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function generateOtp() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

async function hashOtp(otp) {
  return bcrypt.hash(otp, 10);
}

async function verifyOtp(otp, otpHash) {
  return bcrypt.compare(otp, otpHash);
}

function otpExpiryDate() {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
}

module.exports = { generateOtp, hashOtp, verifyOtp, otpExpiryDate, MAX_ATTEMPTS };
