const express = require('express');
const multer = require('multer');
const router = express.Router();
const { getById, getRatings, uploadAvatar, completeOnboarding, deleteMe, updateGender, updateMode } = require('../controllers/userController');
const { authAttemptLimiter } = require('../middleware/rateLimit');
const { strictBody } = require('../middleware/strictBody');

// In-memory so the bytes can be inspected before anything is written to disk.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Map multer's own errors (size limit, malformed multipart) to clean JSON
// rather than letting them reach the generic 500 handler.
function acceptAvatar(req, res, next) {
  upload.single('avatar')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'FILE_TOO_LARGE' });
    return res.status(400).json({ error: 'UPLOAD_FAILED' });
  });
}

router.get('/:id', getById);
router.get('/:id/ratings', getRatings); // public rating summary + reviews for the profile page
router.post('/me/avatar', acceptAvatar, strictBody('user.avatar'), uploadAvatar);
router.patch('/me/onboarding', strictBody('user.onboarding'), completeOnboarding);
router.patch('/me/mode', strictBody('user.mode'), updateMode); // Driver or Passenger mode, your own account
router.patch('/me/gender', strictBody('user.gender'), updateGender); // your own gender; Women+ eligibility only
router.delete('/me', authAttemptLimiter(), strictBody('user.delete'), deleteMe); // password re-check, so rate-limited like sign-in

module.exports = router;
