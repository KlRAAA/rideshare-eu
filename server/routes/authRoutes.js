const express = require('express');
const router = express.Router();
const {
  startRegistration,
  verifyRegistrationOtp,
  completeRegistration,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetPassword,
  login,
} = require('../controllers/authController');
const { emailSendLimiter, authAttemptLimiter } = require('../middleware/rateLimit');

router.post('/register/start', emailSendLimiter(), startRegistration);
router.post('/register/verify-otp', authAttemptLimiter(), verifyRegistrationOtp);
router.post('/register/complete', authAttemptLimiter(), completeRegistration);
router.post('/forgot-password', emailSendLimiter(), requestPasswordReset);
router.post('/verify-reset-otp', authAttemptLimiter(), verifyPasswordResetOtp);
router.post('/reset-password', authAttemptLimiter(), resetPassword);
router.post('/verify', authAttemptLimiter(), login); // thesis's traceability matrix names this endpoint "verify"; behavior is login

module.exports = router;
