const { pendingLicenses, licensePhoto, decideLicense, recentAutoApproved, revokeLicense } = require('../../services/licenseService');

// Driver's license review (sub-project E).
async function list(req, res) {
  res.json({ licenses: await pendingLicenses() });
}

// Only while under review; never cached by the browser or a proxy. same-site
// (not helmet's same-origin) so the admin page can show it when the site and
// the API run on different ports locally; production serves both from one origin.
async function photo(req, res) {
  const found = await licensePhoto(req.params.id);
  if (!found) return res.status(404).json({ error: 'LICENSE_NOT_FOUND' });
  res.set({ 'Content-Type': found.mime, 'Cache-Control': 'no-store', 'Cross-Origin-Resource-Policy': 'same-site' });
  res.send(found.image);
}

async function approve(req, res) {
  const { status, body } = await decideLicense(req.params.id, req.user.id, { approve: true });
  res.status(status).json(body);
}

async function reject(req, res) {
  const { reason, note } = req.body || {};
  const { status, body } = await decideLicense(req.params.id, req.user.id, { approve: false, reason, note });
  res.status(status).json(body);
}

// Automatic approvals still within their 7-day spot-check window.
async function recentAuto(req, res) {
  res.json({ licenses: await recentAutoApproved() });
}

async function revoke(req, res) {
  const { reason, note } = req.body || {};
  const { status, body } = await revokeLicense(req.params.id, req.user.id, { reason, note });
  res.status(status).json(body);
}

module.exports = { list, photo, approve, reject, recentAuto, revoke };
