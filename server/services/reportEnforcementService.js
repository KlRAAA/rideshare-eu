const prisma = require('../config/db');
const { sendBanNotificationEmail } = require('./emailService');

// Fixed mapping, not a per-report human judgment call — no admin role reviews
// these (see AGENTS.md / the thesis's IP-compliance section on why). HARASSMENT
// and SAFETY are the two categories serious enough to skip the strike ladder
// entirely and jump straight to the top tier off a single qualifying report.
const HIGH_ALERT_CATEGORIES = new Set(['HARASSMENT', 'SAFETY']);

const CATEGORY_LABELS = {
  SPAM: 'Spam',
  NO_SHOW: 'No-show',
  INAPPROPRIATE_BEHAVIOR: 'Inappropriate behavior',
  HARASSMENT: 'Harassment',
  SAFETY: 'Safety concern',
  OTHER: 'Other',
};

// Reports older than this stop counting toward a user's strike count — an
// old, isolated incident shouldn't permanently anchor someone near a ban.
const DECAY_WINDOW_DAYS = 90;

// A brand-new/throwaway account's report shouldn't carry the same weight as
// an established one's — both conditions, not either/or: `verified` happens
// to be true for every account today (completeRegistration always sets it),
// so tripCount is what actually discriminates a throwaway account right now,
// but keeping both means this stays meaningful if verified ever becomes a
// real signal again (e.g. re-verification after an email change).
function isQualifyingReporter(reporter) {
  return reporter.verified === true && reporter.tripCount >= 1;
}

// Representing "permanent" as a far-future timestamp (rather than a separate
// boolean) keeps the authenticate middleware's ban check a single timestamp
// comparison — no second branch to keep in sync. Chosen and documented per
// the build request's ask to pick one and say which.
const PERMANENT_BAN_UNTIL = new Date('9999-12-31T23:59:59.999Z');
function isPermanent(bannedUntil) {
  return bannedUntil != null && bannedUntil.getTime() >= PERMANENT_BAN_UNTIL.getTime();
}

const STANDARD_TIERS = [
  { strikes: 1, hours: 24 },
  { strikes: 2, hours: 24 * 7 },
  { strikes: 3, hours: 24 * 30 },
  // 4th+ standard strike escalates to permanent, same as a single high-alert report.
];

function tierForStrikeCount(strikeCount) {
  const match = STANDARD_TIERS.find((t) => t.strikes === strikeCount);
  if (match) return { until: new Date(Date.now() + match.hours * 60 * 60 * 1000), severity: 'STANDARD' };
  return { until: PERMANENT_BAN_UNTIL, severity: 'HIGH_ALERT' };
}

// Only prepares the currently-qualifying report set + tier decision (pure
// query + math, no writes) — applyBanIfWarranted below does the write. Called
// with the reporter who just filed, so a non-qualifying reporter's report
// short-circuits immediately: it can't change anything, since qualification
// only ever adds/removes whole reporters from the window, and this reporter
// didn't just get added if they don't qualify.
async function evaluate(reportedUserId, triggeringReporterId) {
  const reporter = await prisma.user.findUnique({
    where: { id: triggeringReporterId },
    select: { verified: true, tripCount: true },
  });
  if (!reporter || !isQualifyingReporter(reporter)) return null;

  const windowStart = new Date(Date.now() - DECAY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const reports = await prisma.report.findMany({
    where: { reportedUserId, createdAt: { gte: windowStart } },
    select: { reporterId: true, category: true },
  });

  const reporterIds = [...new Set(reports.map((r) => r.reporterId))];
  const reporters = await prisma.user.findMany({
    where: { id: { in: reporterIds } },
    select: { id: true, verified: true, tripCount: true },
  });
  const qualifyingIds = new Set(reporters.filter(isQualifyingReporter).map((r) => r.id));

  // One report per distinct qualifying reporter — the same person filing five
  // reports against one target must count as one, not five.
  const categoryByReporter = new Map();
  for (const r of reports) {
    if (!qualifyingIds.has(r.reporterId)) continue;
    categoryByReporter.set(r.reporterId, r.category);
  }
  if (categoryByReporter.size === 0) return null;

  const categories = [...categoryByReporter.values()];
  const hasHighAlert = categories.some((c) => HIGH_ALERT_CATEGORIES.has(c));
  const strikeCount = categoryByReporter.size;

  const tier = hasHighAlert ? { until: PERMANENT_BAN_UNTIL, severity: 'HIGH_ALERT' } : tierForStrikeCount(strikeCount);

  return { tier, strikeCount, hasHighAlert };
}

async function applyBanIfWarranted(reportedUserId, triggeringReporterId, triggeringCategory) {
  const result = await evaluate(reportedUserId, triggeringReporterId);
  if (!result) return;

  const user = await prisma.user.findUnique({
    where: { id: reportedUserId },
    select: { email: true, bannedUntil: true },
  });
  if (!user) return;

  // Never shorten a currently-active ban that's already at or past this
  // evaluation's tier — e.g. someone already permanently banned, or already
  // serving a 30-day suspension when a decayed window briefly recomputes to
  // a shorter tier.
  const now = new Date();
  if (user.bannedUntil && user.bannedUntil > now && user.bannedUntil >= result.tier.until) {
    return;
  }

  await prisma.user.update({
    where: { id: reportedUserId },
    data: {
      bannedUntil: result.tier.until,
      banReason: triggeringCategory,
      banSeverity: result.tier.severity,
    },
  });

  await sendBanNotificationEmail(user.email, {
    categoryLabel: CATEGORY_LABELS[triggeringCategory] || triggeringCategory,
    permanent: isPermanent(result.tier.until),
    bannedUntil: result.tier.until,
  });
}

module.exports = {
  applyBanIfWarranted,
  isPermanent,
  isQualifyingReporter,
  CATEGORY_LABELS,
  HIGH_ALERT_CATEGORIES,
  PERMANENT_BAN_UNTIL,
  DECAY_WINDOW_DAYS,
};
