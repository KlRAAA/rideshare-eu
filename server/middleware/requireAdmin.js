// Runs after authenticate, which re-reads isAdmin from the database on every
// request — so a demotion takes effect immediately, not when the token expires.
function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'ADMIN_ONLY' });
  return next();
}

module.exports = { requireAdmin };
