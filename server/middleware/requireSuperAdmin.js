// After authenticate (which re-reads the flag on every request). Guards the
// powers only the superadmin has: managing admins and data requests.
function requireSuperAdmin(req, res, next) {
  if (!req.user?.isSuperAdmin) return res.status(403).json({ error: 'SUPERADMIN_ONLY' });
  return next();
}

module.exports = { requireSuperAdmin };
