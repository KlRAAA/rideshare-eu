# Noticeable Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loud notifications get a pop-up, chime and vibration while the app is open, and a real phone notification (Web Push) when it isn't; riders are told when the driver is almost at the meeting point.

**Architecture:** A push outbox: `Notification.pushedAt` + `sendPendingPushes` every 10 s sends loud, recent, unpushed notifications to the user's `PushSubscription`s through `web-push`. The web app polls `GET /api/alerts/feed` (20 s, and on focus) from one `NotificationFeed` provider in the `/auth` layout, which feeds the live badge and shows toasts. `public/sw.js` displays pushes; `src/app/manifest.ts` makes the site installable.

**Tech Stack:** Express 5, Prisma 7, `web-push` (new), Next.js 16 / React 19, Jest 30.

**Spec:** `docs/superpowers/specs/2026-10-09-loud-notifications-design.md`

## Global Constraints

- Loud types: MATCH_REQUEST, APPROVAL, CANCELLATION, TRIP_STARTED, MESSAGE, CONFIRM_REQUEST, DRIVER_UNCONFIRMED, DRIVER_LATE, DRIVER_NO_SHOW, TRIP_SKIPPED, LICENSE_APPROVED, LICENSE_REJECTED, DRIVER_ARRIVING.
- Outbox: only notifications created in the last 10 minutes; each pushed once; 404/410 deletes the subscription; TTL 600 s, urgency high.
- Push is off unless `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are set.
- Subscriptions: https endpoint ≤ 1000 characters, keys `p256dh` and `auth`; max 10 per user (oldest dropped); an endpoint belongs to the newest account that registered it.
- Arriving: within 1,000 m of the meeting point (else origin), ongoing run, approved riders, once per trip and run day.
- Chat: push tag `chat-<tripId>`; no toast while on `/auth/trips/<tripId>`; phone sound at most once a minute.
- Sound and vibration on by default, per device (`localStorage` key `rsu.sound`).
- Additive schema change; back up dev and demo first.
- Commits authored as `Xyrus <xyrusdimacali@gmail.com>`, no AI trailers.

---

### Task 1: Outbox and push service

**Files:** `prisma/schema.prisma` (`PushSubscription`, `Notification.pushedAt`, `@@index([createdAt])`, `DRIVER_ARRIVING`, `User.pushSubscriptions`); `scripts/backupModels.cjs` (`pushSubscription` after `user`); `package.json` (`web-push`); Create `server/services/pushService.js`; `server/test-helpers/seed.js` (cleanup deletes push subscriptions before users); Test `server/__tests__/pushOutbox.test.js`.

**Produces:** `LOUD_TYPES`; `notificationUrl(n)` (mirror of `src/lib/notificationLink.ts`); `pushPayload(n) → { title, body, url, tag }`; `createWebPushSender()` (null when unconfigured); `sendPendingPushes({ now, send, userIds })` → number sent, where `send(subscription, payloadString)` resolves or rejects with `{ statusCode }`.

- [ ] Step 1: back up dev and demo; schema; `npm install web-push`; `prisma generate`; `db push` on both.
- [ ] Step 2: failing test (fake `send` records calls; scoped by `userIds`):
  - a loud notification (APPROVAL) of a user with two subscriptions → two sends, payload JSON has `title` "Request approved", `url` `/auth/trips/<id>?requestId=<match>` when relatedMatchId else the trip URL, `tag` = notification id; `pushedAt` set; a second run sends nothing;
  - a quiet one (RATING_PROMPT) → no send, `pushedAt` stays null;
  - a loud one created 11 minutes ago → no send;
  - a MESSAGE → tag `chat-<tripId>`;
  - a send rejecting with `{ statusCode: 410 }` deletes that subscription; the other gets `lastUsedAt`;
  - a loud one for a user with no subscriptions is marked pushed.
- [ ] Step 3: implement. Titles: APPROVAL → by message text ("approved" → "Request approved", "declined" → "Request declined", "filled up" → "Trip filled up"); MATCH_REQUEST "New join request"; CANCELLATION "Trip cancelled"; TRIP_STARTED "Your driver is on the way"; MESSAGE "New message"; CONFIRM_REQUEST "Still driving tomorrow?"; DRIVER_UNCONFIRMED "Driver hasn't confirmed"; DRIVER_LATE "Driver hasn't started"; DRIVER_NO_SHOW "Driver didn't come"; TRIP_SKIPPED "Trip day changed"; LICENSE_APPROVED / LICENSE_REJECTED "Driver's license"; DRIVER_ARRIVING "Your driver is almost here". Body = the notification message.
- [ ] Step 4: run — PASS. Commit `feat: push outbox for loud notifications`.

### Task 2: Subscriptions and feed API

**Files:** Create `server/controllers/pushController.js`, `server/routes/pushRoutes.js` (mounted at `/api/push` in `server/app.js` behind `authenticate`, like the others); `server/controllers/notificationController.js` (`feed`, sharing the mode filter with `list` via a `modeWhere(userId, mode)` helper); `server/routes/notificationRoutes.js` (`GET /feed` before `/:id`); `server/validation/bodySchemas.js` (`push.subscribe: { endpoint: 'string', keys: 'object' }`, `push.unsubscribe: { endpoint: 'string' }`; check how `strictBody` types objects and use its existing spelling); `server/services/accountDeletionService.js` (delete subscriptions); `server/__tests__/crossUserAccess.test.js` (B deleting A's endpoint leaves it); Test `server/__tests__/pushApi.test.js`.

- [ ] Step 1: failing tests: `GET /api/push/key` → `{ publicKey }` (string or null); subscribe → 201, row stored; same endpoint again by another user → moves to them; bad endpoint (`http://…`, missing keys) → 400 `INVALID_SUBSCRIPTION`; 11th subscription drops the oldest; DELETE by another user leaves it, by the owner removes it (204 both); feed without `after` → `{ notifications: [], unreadCount }`; with `after` → only newer, oldest first, max 20, mode-filtered; bad `after` → 400 `INVALID_CURSOR`.
- [ ] Step 2–4: implement, run with `strictBody`, `crossUserAccess`, `alertsByMode`, `accountDeletion` — PASS. Commit `feat: push subscriptions and a notification feed`.

### Task 3: Driver arriving

**Files:** Create `server/services/arrivalRules.js` (`isNearPickup(point, trip)`, `ARRIVING_RADIUS_M = 1000`, haversine); `server/controllers/tripRunController.js` (`updateLocation` → `notifyArrivingOnce(trip, run, point)`); Tests `server/services/__tests__/arrivalRules.test.js`, extend `server/__tests__/tripLocation.test.js`.

- [ ] Step 1: failing tests: pure — 900 m from the meeting point is near, 1,100 m isn't, no meeting point → origin is used; API — host on an ongoing run posts a location 500 m from the meeting point → each approved rider (not the pending one) gets one DRIVER_ARRIVING with `occurrenceDate` = run day; posting again → still one; a location 5 km away → none.
- [ ] Step 2–4: implement (`updateLocation` loads the trip's meeting point/origin and APPROVED matches; dedupe by type + `relatedTripId` + `occurrenceDate`; failures never fail the location write — log and continue), run — PASS. Commit `feat: tell riders when the driver is almost there`.

### Task 4: Wiring and environment

**Files:** `server/server.js` (`setInterval(…, 10_000).unref()` running `sendPendingPushes({ send })` when `createWebPushSender()` returns a sender; errors logged); `.env.example` (three VAPID lines, commented); `docs/deployment/railway-vercel.md` (env table rows + "generate with `npx web-push generate-vapid-keys`").

- [ ] Steps: implement; `node --check server/server.js`; full server suite — PASS. Commit `feat: send pushes every 10 seconds when configured`.

### Task 5: Screens

**Files:** Create `src/lib/loudNotifications.ts` (`LOUD_TYPES`, `isLoud`, `shouldPopUp(n, pathname)`, `isIosSafari(ua, standalone)`, `soundEnabled()` / `setSoundEnabled()` with try/catch around `localStorage`) + `src/lib/__tests__/loudNotifications.test.ts`; Create `src/components/NotificationFeed.tsx` (provider + `useLiveUnread()`; polling; toast; chime via `AudioContext` oscillator 880 Hz → 660 Hz, 0.3 s; `navigator.vibrate`); `src/components/Header.tsx`, `src/components/BottomNav.tsx` (show `useLiveUnread() ?? unreadCount`); `src/app/auth/layout.tsx` and `src/app/help/HelpShell.tsx` (wrap in the provider); Create `public/sw.js`; Create `src/app/manifest.ts` and `public/icons/icon-192.png`, `icon-512.png` (rendered once from `src/app/icon.svg` with `sharp`); Create `src/components/PushCard.tsx` (dashboard: dismissable, `localStorage` `rsu.pushCardDismissed`; Profile: with Turn off) + `src/lib/push.ts` (`urlBase64ToUint8Array`, `subscribe()`, `unsubscribe()`); Profile: "Sounds and vibration" switch; `src/proxy.ts` CSP: `worker-src 'self'` already allows `/sw.js` (check), `manifest-src 'self'` if a `default-src` fallback blocks it.

- [ ] Step 1: failing web test for `isLoud`, `shouldPopUp` (chat on its own trip page → false; on another page → true; quiet type → false), `isIosSafari` (iPhone Safari not standalone → true; standalone → false; Android Chrome → false).
- [ ] Step 2: implement helpers, provider, badges, toast, service worker, manifest, icons, push card, sound switch.
- [ ] Step 3: `npx tsc --noEmit && npm run test:web` — PASS. Commit `feat: live notifications with pop-ups, sound and phone push`.

### Task 6: Postman, docs, verification

- [ ] Postman "22. Notifications": push key (200, `publicKey` key present); subscribe a fake https endpoint (201); feed without cursor (200, `unreadCount` number); feed with a bad cursor (400 `INVALID_CURSOR`); unsubscribe (204).
- [ ] Full suites, tsc, Postman.
- [ ] Browser (demo, two contexts): Juan approves Paolo's request while Paolo has a page open → within ~20 s Paolo sees the toast and the badge goes up; the service worker registers and the manifest loads (`navigator.serviceWorker.getRegistration()`, `/manifest.webmanifest` 200).
- [ ] AGENTS.md "F. Noticeable notifications"; roadmap F → done. Commit `docs: notification notes and Postman folder`.
