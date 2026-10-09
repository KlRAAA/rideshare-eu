// RideShareEU service worker: shows phone notifications (Web Push) and opens
// the right page when one is tapped (sub-project F). No offline caching.
const ICON = '/icons/icon-192.png';
const CHAT_SOUND_GAP_MS = 60 * 1000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'RideShareEU', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(show(data));
});

async function show({ title = 'RideShareEU', body = '', url = '/auth/notifications', tag }) {
  const options = { body, tag, icon: ICON, badge: ICON, data: { url, count: 1, soundAt: Date.now() } };
  // Chat: one notification per trip, replaced as messages arrive, with sound
  // at most once a minute.
  if (tag && tag.startsWith('chat-')) {
    const [open] = await self.registration.getNotifications({ tag });
    if (open) {
      const count = (open.data?.count ?? 1) + 1;
      const quiet = Date.now() - (open.data?.soundAt ?? 0) < CHAT_SOUND_GAP_MS;
      options.body = `${count} new messages. Latest: ${body}`;
      options.renotify = !quiet;
      options.silent = quiet;
      options.data = { url, count, soundAt: quiet ? open.data.soundAt : Date.now() };
    }
  }
  return self.registration.showNotification(title, options);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/auth/notifications', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const same = windows.find((w) => w.url === url);
      if (same) return same.focus();
      const any = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (any) {
        await any.focus();
        return any.navigate(url);
      }
      return self.clients.openWindow(url);
    })()
  );
});
