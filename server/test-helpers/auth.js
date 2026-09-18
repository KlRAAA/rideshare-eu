const jwt = require('jsonwebtoken');

// A valid session token header for the integration tests. The auth middleware
// checks the signature/expiry and that `userId` is present, then does one DB
// lookup for the ban check — but a row that doesn't exist has nothing to
// enforce and falls through same as an unbanned user, so any id string still
// works for tests that don't otherwise care who the caller is.
function bearer(userId = 'test-user', opts = {}) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d', ...opts });
  return { Authorization: `Bearer ${token}` };
}

// An already-expired token, for negative tests.
function expiredBearer(userId = 'test-user') {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '-1h' });
  return { Authorization: `Bearer ${token}` };
}

module.exports = { bearer, expiredBearer };
