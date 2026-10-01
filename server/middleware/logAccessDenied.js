const { logSecurityEvent } = require('../services/securityLog');

// 403s that mean "signed in, but this isn't yours" — the ownership checks and
// the admin gate. ACCOUNT_SUSPENDED is left out (a banned user's every request
// would log one) and so is LOCATION_SHARING_DISABLED (a setting, not an
// attempt). INVALID_PASSWORD is logged where it happens, with more context.
const LOGGED_CODES = new Set(['NOT_AUTHORIZED', 'NOT_A_PARTICIPANT', 'NOT_MATCHED', 'VEHICLE_NOT_OWNED', 'ADMIN_ONLY']);

// Mounted after authenticate, so req.user is set. Watches res.json rather than
// touching each controller, so a new ownership check is logged automatically
// as long as it uses one of the codes above.
function logAccessDenied(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 403 && LOGGED_CODES.has(body?.error)) {
      logSecurityEvent(req, 'ACCESS_DENIED', { userId: req.user?.id, reason: body.error });
    }
    return json(body);
  };
  next();
}

module.exports = { logAccessDenied };
