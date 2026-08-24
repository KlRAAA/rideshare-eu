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

router.post('/register/start', startRegistration);
router.post('/register/verify-otp', verifyRegistrationOtp);
router.post('/register/complete', completeRegistration);
router.post('/forgot-password', requestPasswordReset);
router.post('/verify-reset-otp', verifyPasswordResetOtp);
router.post('/reset-password', resetPassword);
router.post('/verify', login); // thesis's traceability matrix names this endpoint "verify"; behavior is login

module.exports = router;
