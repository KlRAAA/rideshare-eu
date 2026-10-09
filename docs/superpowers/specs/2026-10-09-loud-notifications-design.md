# Noticeable notifications and Web Push (sub-project F)

Roadmap: `2026-10-08-panel-revisions-roadmap.md`. Panel note §6. Approved in
chat on 9 Oct 2026.

## Problem

Notifications are a silent list and a badge that only updates when a page
loads. The panel asked for notifications that grab attention: a pop-up, sound
and vibration while the app is open, and real phone notifications (Web Push)
when it's in the background or closed, with email as the fallback for
important events.

## Decisions

| Topic | Decision |
|---|---|
| Loud types | MATCH_REQUEST, APPROVAL, CANCELLATION (includes declines), TRIP_STARTED, MESSAGE, CONFIRM_REQUEST, DRIVER_UNCONFIRMED, DRIVER_LATE, DRIVER_NO_SHOW, TRIP_SKIPPED, LICENSE_APPROVED, LICENSE_REJECTED, and the new DRIVER_ARRIVING. Everything else stays quiet (badge only). |
| Driver arriving | New: when the driver's live location is within 1 km of the meeting point (or the trip's origin when there is none), approved riders get one `DRIVER_ARRIVING` per trip day. |
| Chat | One phone notification per trip chat, replaced as messages arrive; sound at most once a minute; no pop-up while the user is on that trip's page. |
| Sound and vibration | On by default; a "Sounds and vibration" switch in Profile, stored per device (localStorage). |
| Phone notifications | Opt-in with a "Turn on phone notifications" card (dashboard until turned on or dismissed, and Profile). |
| Modes | Pushes go out whatever mode the user is in; tapping opens the related page. |
| Email | Unchanged. |

Approvals, declines and "the trip filled up" are all `APPROVAL` notifications
(`matchController.updateStatus`), so the one loud type covers them. The push
title follows the text: "Request approved" / "Request declined" / "Trip
filled up".

## Server

### Subscriptions

```prisma
model PushSubscription {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  endpoint   String   @unique
  p256dh     String
  auth       String
  createdAt  DateTime @default(now())
  lastUsedAt DateTime?
  @@index([userId])
}
```

`Notification` gains `pushedAt DateTime?` and `@@index([createdAt])`;
`NotificationType` gains `DRIVER_ARRIVING`. Additive only.
`scripts/backupModels.cjs` lists `pushSubscription`.

| Route | Behaviour |
|---|---|
| `GET /api/push/key` | `{ publicKey }` (the VAPID public key), or `{ publicKey: null }` when push isn't configured. |
| `POST /api/push/subscriptions { endpoint, keys: { p256dh, auth } }` | Upserts by endpoint for the caller (an endpoint moves to the newest account that registers it). 400 `INVALID_SUBSCRIPTION` (https endpoint ≤ 1000 characters, keys present). Max 10 per user: the oldest is dropped. |
| `DELETE /api/push/subscriptions { endpoint }` | Removes the caller's own subscription with that endpoint (204 either way). |

`strictBody` schemas: `push.subscribe`, `push.unsubscribe`. Account deletion
removes the user's subscriptions.

### The outbox

`server/services/pushService.js`:
- `LOUD_TYPES`, `pushPayload(notification, tripDestination?)` → `{ title, body, url, tag }`
  (`url` from the same rules as the web's `notificationHref`, mirrored server
  side; `tag` = `chat-<tripId>` for MESSAGE, else the notification id).
- `createPushSender(sendFn)` wraps `web-push`'s `sendNotification`; tests pass
  a fake.
- `sendPendingPushes(now, sender)`: up to 200 notifications with
  `pushedAt = null`, a loud type and `createdAt` within the last 10 minutes,
  oldest first; for each, sends to every subscription of the user (TTL 10
  minutes, urgency `high`), deletes subscriptions answered with 404 or 410,
  sets `lastUsedAt` on success, then sets `pushedAt` on every processed
  notification (including users with no subscriptions). Quiet and old ones are
  never pushed.
- Runs every 10 s in-process (`setInterval` in `server.js`, unref'd, skipped
  under Jest and when VAPID keys are missing; one replica, as the cron jobs).

Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
(`mailto:` the admin contact). Generated once with `npx web-push
generate-vapid-keys`; documented in the deployment guide and `.env.example`.

### Driver arriving

`tripRunController.updateLocation`, after saving the location: if the run is
ongoing, the trip has approved riders, the point is within 1,000 m
(haversine) of the meeting point or origin, and no `DRIVER_ARRIVING` exists
for this trip and run day, create one per approved rider: "Your driver is
almost at the meeting point." with `occurrenceDate` = the run day. A pure
`isNearPickup(location, trip)` holds the rule.

### Feed

`GET /api/alerts/feed?after=<ISO>&mode=` → `{ notifications, unreadCount }`:
notifications created after `after` (max 20, oldest first), filtered by mode
the same way as `GET /api/alerts`; without `after`, none, only the count (the
client's first call sets its cursor). 400 `INVALID_CURSOR` for a bad date.

## Web

- `src/lib/loudNotifications.ts`: `LOUD_TYPES` (mirror), `isLoud(type)`,
  `shouldPopUp(notification, pathname)` (no chat pop-up on that trip's page),
  `isIosSafari(userAgent, standalone)`.
- `src/components/NotificationFeed.tsx` (client, mounted once in the `/auth`
  layout and `HelpShell`): polls the feed every 20 s and on tab focus; updates
  the header and bottom-nav badges through a small context; for loud types
  shows a toast (text + "Open"), plays a chime (Web Audio oscillator, ~0.3 s)
  and calls `navigator.vibrate([200, 100, 200])` when the switch is on. The
  chime only plays after the first user interaction (browser rule).
- `public/sw.js`: `push` → `showNotification(title, { body, tag, data: { url }, icon, badge, renotify })`;
  for a chat tag it merges into the open notification ("3 new messages on your
  trip to …") and sets `renotify` only when the last sound was over 60 s ago;
  `notificationclick` focuses an open tab on that URL or opens one.
- `src/app/manifest.ts` (name, short name, start URL `/auth/dashboard`,
  standalone, theme colour, 192 and 512 px icons in `public/icons/`).
- `src/components/PushCard.tsx`: "Turn on phone notifications" → registers
  the service worker, asks permission, subscribes with the VAPID key, posts
  the subscription; states: on / blocked in browser settings / not supported;
  on iPhone Safari outside the Home Screen: "Add RideShareEU to your Home Screen
  first (Share → Add to Home Screen)". Dashboard (dismissable, remembered per
  device) and Profile (with "Turn off").
- Profile: "Sounds and vibration" switch.

## Testing

- Jest: outbox (sends a loud one once to each subscription, skips quiet and
  older-than-10-minutes ones, deletes a 410 subscription, marks users without
  subscriptions), payload and chat tag, subscription routes (validation,
  upsert, cap of 10, delete only your own), feed (cursor, mode, count),
  arriving (inside/outside 1 km, once per day, only approved riders, only
  while ongoing). Cross-user rows for the subscription routes.
- Web: `isLoud`, `shouldPopUp`, `isIosSafari`.
- Postman folder "22. Notifications": key, subscribe, feed, unsubscribe.
- Browser: the toast and badge appear while a page is open (demo, two
  accounts). Real push on a phone is checked by hand after deploy (Android
  Chrome; iPhone from the Home Screen).

## Rollout

Backup; `db push` on dev and demo; production on deploy (additive). Generate
VAPID keys and set the three variables on Railway; the website needs no new
variable (it fetches the public key from the API). AGENTS.md section;
roadmap F → done.

## Out of scope

Native apps; per-type notification settings; quiet hours; SMS.
