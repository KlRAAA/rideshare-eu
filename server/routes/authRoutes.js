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
const { strictBody } = require('../middleware/strictBody');

router.post('/register/start', emailSendLimiter(), strictBody('auth.registerStart'), startRegistration);
router.post('/register/verify-otp', authAttemptLimiter(), strictBody('auth.registerVerifyOtp'), verifyRegistrationOtp);
router.post('/register/complete', authAttemptLimiter(), strictBody('auth.registerComplete'), completeRegistration);
router.post('/forgot-password', emailSendLimiter(), strictBody('auth.forgotPassword'), requestPasswordReset);
router.post('/verify-reset-otp', authAttemptLimiter(), strictBody('auth.verifyResetOtp'), verifyPasswordResetOtp);
router.post('/reset-password', authAttemptLimiter(), strictBody('auth.resetPassword'), resetPassword);
router.post('/verify', authAttemptLimiter(), strictBody('auth.login'), login); // thesis's traceability matrix names this endpoint "verify"; behavior is login

module.exports = router;
