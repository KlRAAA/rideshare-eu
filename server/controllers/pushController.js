const prisma = require('../config/db');

// Web Push subscriptions (sub-project F): the caller's own phones and browsers.
const MAX_PER_USER = 10;
const MAX_ENDPOINT = 1000;

function key(req, res) {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
}

async function subscribe(req, res) {
  const { endpoint, keys } = req.body || {};
  const valid =
    typeof endpoint === 'string' &&
    endpoint.startsWith('https://') &&
    endpoint.length <= MAX_ENDPOINT &&
    typeof keys?.p256dh === 'string' &&
    keys.p256dh &&
    typeof keys?.auth === 'string' &&
    keys.auth;
  if (!valid) return res.status(400).json({ error: 'INVALID_SUBSCRIPTION' });

  const userId = req.user.id;
  // A phone that changes hands (sign out, someone else signs in) follows the newest account.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth },
  });
  const extra = await prisma.pushSubscription.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip: MAX_PER_USER,
    select: { id: true },
  });
  if (extra.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: extra.map((s) => s.id) } } });
  res.status(201).json({ status: 'SUBSCRIBED' });
}

// Only the caller's own; 204 either way, so it can't probe other people's phones.
async function unsubscribe(req, res) {
  const { endpoint } = req.body || {};
  if (typeof endpoint === 'string') await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user.id } });
  res.status(204).end();
}

module.exports = { key, subscribe, unsubscribe };
