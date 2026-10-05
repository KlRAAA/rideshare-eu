const bcrypt = require('bcrypt');
const prisma = require('../../config/db');
const { record } = require('../../services/adminActionService');
const { decryptField } = require('../../services/encryptionService');
const { logSecurityEvent } = require('../../services/securityLog');
const { validateDataRequest } = require('../../services/dataRequestValidation');
const { buildRelease, paperworkDueAt, isOverdue } = require('../../services/dataRequestService');

// Data requests from the police or another authority, handled only by the
// superadmin (the school's DPO). See docs/policy/law-enforcement-data-requests.md.
const LIST_LIMIT = 100;

// Stored on each audit entry; regular admins see only agency, reference and basis.
const auditDetails = (r) => ({
  dataRequestId: r.id,
  agency: r.agency,
  referenceNumber: r.referenceNumber,
  legalBasis: r.legalBasis,
});

async function passwordMatches(req, password) {
  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { passwordHash: true } });
  if (me && (await bcrypt.compare(password, me.passwordHash))) return true;
  logSecurityEvent(req, 'PASSWORD_RECHECK_FAILED', { userId: req.user.id, reason: 'DATA_REQUEST' });
  return false;
}

async function list(req, res) {
  const rows = await prisma.dataRequest.findMany({ orderBy: { createdAt: 'desc' }, take: LIST_LIMIT });
  const subjects = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.subjectUserId))] } },
    select: { id: true, fullName: true },
  });
  const nameById = new Map(subjects.map((u) => [u.id, decryptField(u.fullName)]));
  const now = new Date();
  res.json({
    requests: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      agency: r.agency,
      referenceNumber: r.referenceNumber,
      legalBasis: r.legalBasis,
      subjectName: nameById.get(r.subjectUserId) ?? null,
      paperworkDueAt: r.paperworkDueAt,
      paperworkReceivedAt: r.paperworkReceivedAt,
      overdue: isOverdue(r, now),
    })),
  });
}

// Validate, re-check the password, then write the request and its audit entry
// in one transaction before building the release (superadmin spec D2, D9).
async function create(req, res) {
  const { password, ...fields } = req.body || {};
  const checked = validateDataRequest(fields);
  if (checked.field) return res.status(400).json({ error: 'INVALID_DATA_REQUEST', field: checked.field });
  const value = checked.value;
  if (value.subjectUserId === req.user.id) return res.status(400).json({ error: 'CANNOT_TARGET_SELF' });
  if (typeof password !== 'string' || password === '') return res.status(400).json({ error: 'PASSWORD_REQUIRED' });
  if (!(await passwordMatches(req, password))) return res.status(403).json({ error: 'INVALID_PASSWORD' });
  const subject = await prisma.user.findUnique({ where: { id: value.subjectUserId }, select: { id: true } });
  if (!subject) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  const now = new Date();
  const request = await prisma.$transaction(async (tx) => {
    const row = await tx.dataRequest.create({
      data: { ...value, createdById: req.user.id, paperworkDueAt: paperworkDueAt(value.legalBasis, now) },
    });
    await record(tx, { actorId: req.user.id, action: 'DATA_RELEASED', targetUserId: row.subjectUserId, details: auditDetails(row) });
    return row;
  });
  res.status(201).json({ request, release: await buildRelease(prisma, request, now) });
}

// Rebuilt on every opening and recorded each time (spec D10). An emergency
// release is rebuilt as of when it was first released.
async function open(req, res) {
  const request = await prisma.dataRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: 'NOT_FOUND' });
  const asOf = request.legalBasis === 'EMERGENCY' ? request.createdAt : new Date();
  const release = await buildRelease(prisma, request, asOf);
  await record(prisma, {
    actorId: req.user.id,
    action: 'DATA_RELEASE_VIEWED',
    targetUserId: request.subjectUserId,
    details: auditDetails(request),
  });
  res.json({ request, release, overdue: isOverdue(request) });
}

async function markPaperwork(req, res) {
  const request = await prisma.dataRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: 'NOT_FOUND' });
  if (request.paperworkReceivedAt) return res.json({ request });
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.dataRequest.update({ where: { id: request.id }, data: { paperworkReceivedAt: new Date() } });
    await record(tx, {
      actorId: req.user.id,
      action: 'DATA_PAPERWORK_RECEIVED',
      targetUserId: row.subjectUserId,
      details: auditDetails(row),
    });
    return row;
  });
  res.json({ request: updated });
}

module.exports = { list, create, open, markPaperwork };
