const { pendingLicenses, licensePhoto, decideLicense } = require('../../services/licenseService');

// Driver's license review (sub-project E).
async function list(req, res) {
  res.json({ licenses: await pendingLicenses() });
}

// Only while under review; never cached by the browser or a proxy.
async function photo(req, res) {
  const found = await licensePhoto(req.params.id);
  if (!found) return res.status(404).json({ error: 'LICENSE_NOT_FOUND' });
  res.set({ 'Content-Type': found.mime, 'Cache-Control': 'no-store' });
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

module.exports = { list, photo, approve, reject };
