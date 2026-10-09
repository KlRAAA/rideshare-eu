// Phone notifications (Web Push) for loud notifications (sub-project F).
// An outbox: sendPendingPushes picks up loud notifications created in the last
// few minutes that haven't been handled, so the ~30 places that create
// notifications don't each need to know about push.
const prisma = require('../config/db');

const LOUD_TYPES = [
  'MATCH_REQUEST',
  'APPROVAL',
  'CANCELLATION',
  'TRIP_STARTED',
  'MESSAGE',
  'CONFIRM_REQUEST',
  'DRIVER_UNCONFIRMED',
  'DRIVER_LATE',
  'DRIVER_NO_SHOW',
  'TRIP_SKIPPED',
  'LICENSE_APPROVED',
  'LICENSE_REJECTED',
  'DRIVER_ARRIVING',
];
const MAX_AGE_MS = 10 * 60 * 1000;
const BATCH = 200;
const PUSH_TTL_SECONDS = 600;
const GONE = new Set([404, 410]);

const TITLES = {
  MATCH_REQUEST: 'New join request',
  CANCELLATION: 'Trip cancelled',
  TRIP_STARTED: 'Your driver is on the way',
  MESSAGE: 'New message',
  CONFIRM_REQUEST: 'Still driving tomorrow?',
  DRIVER_UNCONFIRMED: "Driver hasn't confirmed",
  DRIVER_LATE: "Driver hasn't started",
  DRIVER_NO_SHOW: "Driver didn't come",
  TRIP_SKIPPED: 'Trip day changed',
  LICENSE_APPROVED: "Driver's license",
  LICENSE_REJECTED: "Driver's license",
  DRIVER_ARRIVING: 'Your driver is almost here',
};

function title(n) {
  if (n.type !== 'APPROVAL') return TITLES[n.type] ?? 'RideShareEU';
  if (/declined/i.test(n.message)) return 'Request declined';
  if (/filled up/i.test(n.message)) return 'Trip filled up';
  return 'Request approved';
}

// Mirrors src/lib/notificationLink.ts.
const TRIP_TYPES = new Set([...LOUD_TYPES, 'RATING_PROMPT', 'TRIP_UPDATED']);
function notificationUrl(n) {
  if (n.type === 'SUPPORT_REPLY') return '/help/requests';
  if (n.type === 'WARNING') return '/auth/dashboard';
  if (n.type.startsWith('LICENSE_')) return '/auth/license';
  if (!n.relatedTripId || !TRIP_TYPES.has(n.type)) return '/auth/notifications';
  const base = `/auth/trips/${n.relatedTripId}`;
  return n.relatedMatchId ? `${base}?requestId=${n.relatedMatchId}` : base;
}

function pushPayload(n) {
  return {
    title: title(n),
    body: n.message,
    url: notificationUrl(n),
    tag: n.type === 'MESSAGE' && n.relatedTripId ? `chat-${n.relatedTripId}` : n.id,
  };
}

// The real sender, or null when the VAPID keys aren't configured (push off).
function createWebPushSender() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return null;
  const webpush = require('web-push');
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return (sub, payload) =>
    webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
      TTL: PUSH_TTL_SECONDS,
      urgency: 'high',
    });
}

// Sends each pending loud notification to every phone of its user, once.
// `userIds` narrows the run (tests). Returns the number of pushes delivered.
async function sendPendingPushes({ now = new Date(), send, userIds } = {}) {
  const pending = await prisma.notification.findMany({
    where: {
      pushedAt: null,
      type: { in: LOUD_TYPES },
      createdAt: { gte: new Date(now.getTime() - MAX_AGE_MS) },
      ...(userIds && { userId: { in: userIds } }),
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
    include: { user: { select: { pushSubscriptions: true } } },
  });
  if (pending.length === 0) return 0;

  let delivered = 0;
  const used = new Set();
  const gone = new Set();
  for (const n of pending) {
    const payload = JSON.stringify(pushPayload(n));
    const results = await Promise.allSettled(n.user.pushSubscriptions.map((sub) => send(sub, payload)));
    results.forEach((r, i) => {
      const sub = n.user.pushSubscriptions[i];
      if (r.status === 'fulfilled') {
        delivered += 1;
        used.add(sub.id);
      } else if (GONE.has(r.reason?.statusCode)) {
        gone.add(sub.id);
      } else {
        console.error(`[push] send failed (${r.reason?.statusCode ?? 'no status'}): ${r.reason?.message}`);
      }
    });
  }
  await prisma.notification.updateMany({ where: { id: { in: pending.map((n) => n.id) }, pushedAt: null }, data: { pushedAt: now } });
  if (gone.size) await prisma.pushSubscription.deleteMany({ where: { id: { in: [...gone] } } });
  const stillUsed = [...used].filter((id) => !gone.has(id));
  if (stillUsed.length) await prisma.pushSubscription.updateMany({ where: { id: { in: stillUsed } }, data: { lastUsedAt: now } });
  return delivered;
}

module.exports = { LOUD_TYPES, notificationUrl, pushPayload, createWebPushSender, sendPendingPushes };
