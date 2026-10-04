const prisma = require('../config/db');

// Database copy of the security log (securityLog.js), so admins can see counts
// and spikes. It keeps as little personal data as possible: no IP, no email,
// no user agent. The stderr log still has those for incident work.
const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const EVENTS = ['LOGIN_FAILED', 'OTP_FAILED', 'OTP_LOCKED', 'RATE_LIMITED', 'PASSWORD_RECHECK_FAILED', 'ACCESS_DENIED'];
const FAILED_LOGIN_FLAG = 5;

async function storeSecurityEvent(entry) {
  try {
    await prisma.securityEvent.create({
      data: {
        event: entry.event,
        reason: entry.reason ?? null,
        userId: entry.userId ?? null,
        route: entry.route || '',
      },
    });
  } catch {
    // Monitoring must never break the request that triggered it.
  }
}

async function purgeOldSecurityEvents(now = new Date()) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * DAY_MS);
  const { count } = await prisma.securityEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}

// { LOGIN_FAILED: n, OTP_FAILED: n, … } since the given time; 0 for quiet
// events. Pass a userId to count one account only.
async function securityCounts(since, userId) {
  const rows = await prisma.securityEvent.groupBy({
    by: ['event'],
    where: { createdAt: { gte: since }, ...(userId ? { userId } : {}) },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(EVENTS.map((e) => [e, 0]));
  for (const r of rows) counts[r.event] = r._count._all;
  return counts;
}

// Accounts with at least `min` failed sign-ins since the given time.
async function accountsWithFailedLogins(since, min = FAILED_LOGIN_FLAG) {
  const rows = await prisma.securityEvent.groupBy({
    by: ['userId'],
    where: { event: 'LOGIN_FAILED', userId: { not: null }, createdAt: { gte: since } },
    _count: { _all: true },
  });
  return rows.filter((r) => r._count._all >= min).map((r) => ({ userId: r.userId, count: r._count._all }));
}

module.exports = {
  storeSecurityEvent,
  purgeOldSecurityEvents,
  securityCounts,
  accountsWithFailedLogins,
  RETENTION_DAYS,
  FAILED_LOGIN_FLAG,
};
