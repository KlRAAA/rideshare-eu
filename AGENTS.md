<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Local Development

## Database — local PostgreSQL (not `npx prisma dev`)

This project **used** `npx prisma dev` (an in-process PGlite / WASM Postgres on
port 51214). It dropped connections when idle (`P1017: Server has closed the
connection`) and needed constant restarting. It was replaced (Sep 2026) with a
real local PostgreSQL 17 running as a Windows service.

- **Nothing to start** — the `postgresql-x64-17` service auto-starts on boot and
  is always available at `localhost:5432`. There is no DB command in the dev
  workflow anymore.
- Superuser `postgres` / password `postgres`; database `rideshare_dev`.
- `.env` → `DATABASE_URL="postgres://postgres:postgres@localhost:5432/rideshare_dev"`
- Schema is managed with `npx prisma db push` (no formal migrations dir yet).
- `server/config/db.js` uses the default pg pool — the old `max: 1` prisma-dev
  workaround is gone.

Fresh setup on a new machine:

```
choco install postgresql17 --params '/Password:postgres' -y   # admin shell
createdb -U postgres rideshare_dev                             # or: psql -U postgres -c "CREATE DATABASE rideshare_dev"
npx prisma db push
node scripts/restore-db.mjs                                    # if you have a backup under backups/
```

## Backup / restore

- `node scripts/backup-db.mjs` → snapshots every table to `backups/<timestamp>/`
  (gitignored) as portable JSON. Run this before schema changes or risky work.
- `node scripts/restore-db.mjs [backups/<dir>] [--force]` → restores the latest
  (or named) backup into whatever `DATABASE_URL` points at, parents-first, and
  fails if any table's row count doesn't match the manifest.

## Running the app

Two terminals (no third for the DB):

```
npm run server   # Express API on :4000
npm run dev       # Next.js on :3000
```

## API authentication (Sep 2026)

The Express API requires a valid session JWT on every route **except**
`/api/auth/*`. `server/middleware/authenticate.js` verifies the token
(HS256, `JWT_SECRET`) and sets `req.user.id`; a missing/invalid/expired token
gets `401 UNAUTHENTICATED`.

- The token is the same one login/register issue. The frontend forwards it:
  browser calls via the `rsu_session` cookie (`credentials: 'include'` +
  credentialed CORS — `CORS_ORIGIN`, default `http://localhost:3000`); server
  components via `src/lib/api-server.ts`, which reads the cookie and sends a
  Bearer header. Client components keep importing `apiFetch` from `@/lib/api`.

**Phase 2 (branch `auth-phase2`):** every controller derives the caller from
`req.user.id`, not the request body/query/params.
- Self-identity fields (`hostId` on create, `userId`/`passengerId`/`raterId`/
  `ownerId`) are taken from the token; the client may still send them, they are
  ignored.
- Resource-ownership: `PATCH /api/matches/:id` requires the verified trip host;
  `PATCH /api/alerts/:id/read` requires the notification owner;
  `/api/preferences/:userId` requires `:userId === req.user.id` — all 403 on
  mismatch, 404 if the resource is missing.
- `GET /api/users/:id` returns `email` only on your own record.
- `POST /api/alerts` (forgeable, unused) — deleted.
- Not done in phase 2: `createTrip` still mass-assigns `req.body` (a client
  could set `status`/`filledSeats` on create) — separate hardening pass.

**Before deploy:** `JWT_SECRET` is still the dev placeholder — generate a real
random secret. Production also needs the cookie set `sameSite: 'none'; secure`
once frontend/API are on different domains.

## Admin role (Oct 2026)

Added at the research adviser's request. Spec and plan:
`docs/superpowers/specs/2026-09-30-admin-role-design.md`,
`docs/superpowers/plans/2026-09-30-admin-role.md`.

- `User.isAdmin` is re-read by `authenticate` on every request, so a demotion
  takes effect immediately. `requireAdmin` guards the whole `/api/admin/*`
  router (403 `ADMIN_ONLY`).
- First admin: `npm run make-admin <email>` (existing account). After that,
  only the superadmin promotes/demotes admins (see "Superadmin and data
  requests" below).
- Powers: official fuel price, report review (with optional ban), ban/unban,
  user search/detail, cancel a trip, promote/demote, audit log.
- Safety rules: no action on your own account (`CANNOT_TARGET_SELF`), including
  deciding a report about yourself; an admin must be demoted before being
  banned (`TARGET_IS_ADMIN`). Admins cannot read trip chats.
- **Official fuel prices are caps, one per fuel type** (`FuelType`: REGULAR,
  PREMIUM, DIESEL). `GET /api/fuel-price` (any signed-in user) returns
  `{ prices: { REGULAR, PREMIUM, DIESEL } }`, each the newest `FuelPrice` row of
  that type or null. `PUT /api/admin/fuel-price` takes `{ fuelType, pricePerLiter }`
  (400 `INVALID_FUEL_TYPE`). Every car (`Vehicle`, `SavedVehicle`) has a
  `fuelType`, defaulting to REGULAR when a client omits it. `createTrip` caps the
  host price by the trip car's type (400 `FUEL_PRICE_ABOVE_OFFICIAL` with
  `officialPrice` and `fuelType`); with no price set for that type, the old
  PHP 20–150 bounds apply. Posted trips keep their price. The admin page flags a
  price older than 7 days and links the DOE weekly pump-price page.
- Every admin write and every automatic ladder ban (`actorId` null) is recorded
  in `AdminAction`, in the same transaction as the change. The 403
  `ACCOUNT_SUSPENDED` body carries `byAdmin` so the suspended screen and ban
  email word admin and automatic bans differently.
- `emailService` never sends to reserved test domains (`.test`, `.local`,
  `.invalid`, `example.com` …), so seeded/Postman accounts don't trigger real
  mail.
- Postman: `npm run seed:postman` also creates `postman-admin@test.local`; the
  "13. Admin" folder covers every admin endpoint. Each run uses 4 of the 10
  logins allowed per 15 minutes.

## Saved cars (Oct 2026)

- `SavedVehicle` is the host's "My cars" list (max 5, one default), managed at
  `/api/saved-vehicles` and on the profile page. The post-trip form pre-selects
  the default car.
- Saved cars only fill in the form. Each trip still gets its own `Vehicle` row
  (a snapshot via `POST /api/vehicles`), because editing a trip's car updates
  that row — sharing one row across trips would change every trip at once.
- `createTrip` rejects a missing car (400 `VEHICLE_REQUIRED`) and someone
  else's car (403 `VEHICLE_NOT_OWNED`). Car fields are validated by
  `server/services/vehicleValidation.js` (fuel efficiency 3–50 km/L).
- `npm run import-saved-cars` (one-time, rerunnable) saves each host's most
  recently used car as their default when they have none.

## Account deletion, geocoding, seats (Oct 2026)

- `DELETE /api/users/me` (password re-check, rate-limited like sign-in)
  anonymizes rather than hard-deletes: `accountDeletionService` erases name,
  email, university ID, photo, saved cars, preferences, notifications, chat
  messages, plates and home/meeting locations, cancels hosted trips and
  releases held seats (notifying everyone), and sets `User.deletedAt`.
  Ratings, reports and others' trip history keep pointing at "Deleted user".
  `authenticate` returns 401 `ACCOUNT_DELETED` for such sessions. The only
  remaining admin gets 409 `LAST_ADMIN`.
- `geocodingService` caches Nominatim results (24 h, 1,000 entries), shares
  identical in-flight lookups and spaces outgoing requests ≥ 1.1 s apart, per
  the Nominatim usage policy. Tests use `createGeocoder` with a fake fetch.
- `cancelPassengerMatch` gives an approved passenger's seat back and reopens a
  FULL trip; both passenger cancellation and account deletion use it.

## Security event log (Oct 2026)

- `server/services/securityLog.js` writes one JSON line (`"type":"security"`)
  to stderr per `LOGIN_FAILED`, `OTP_FAILED`, `OTP_LOCKED`, `RATE_LIMITED`,
  `PASSWORD_RECHECK_FAILED` and `ACCESS_DENIED` (ownership/admin 403s, via
  `middleware/logAccessDenied.js`). Find them with `grep '"type":"security"'`.
- Only allow-listed fields are kept (never passwords, codes or tokens); emails
  are masked. Responses are unchanged.
- Quiet under Jest; tests capture entries with `setSecurityLogSink`.

## PSGA ground-truth labeling (Oct 2026)

- `validation/labeling/` builds the evaluator workbooks (`build_labeling_kit.py`),
  merges them with a tiebreaker into `validation/ground_truth.json`
  (`merge_labels.py`), and `validation/score_against_ground_truth.py` then
  writes `precision_results.json`. Procedure: `docs/validation/human-labeling-protocol.md`.
- Never generate or fill in judgments — they must come from the human evaluators.
- Regenerate `validation/method_rankings.json` (`python validation/run_methods.py`)
  whenever `validation/psga.py` or the dataset changes; it is deterministic.
- Tests: `python -m unittest discover -s validation/labeling`.

## Help, support and admin monitoring (Oct 2026)

Spec and plan: `docs/superpowers/specs/2026-10-04-help-and-admin-monitoring-design.md`,
`docs/superpowers/plans/2026-10-04-help-and-admin-monitoring.md`.

- `/help` is public: emergency guidance first (911; campus number only if
  `NEXT_PUBLIC_CAMPUS_SECURITY_PHONE` is set), how to report, and the
  contact-admin form for signed-in users. `/help/requests` lists the user's
  requests and their conversations.
- Support API: `POST/GET /api/support`, `GET /api/support/:id`,
  `POST /api/support/:id/messages` (reopens an answered request),
  `PATCH /api/support/:id/close`. Limits: 5 open requests, 10 a day
  (429 `TOO_MANY_TICKETS`). A request may link only the user's own trip
  (403 `TRIP_NOT_YOURS`). Suspended users can't reach it (authenticate blocks
  them); their screen links to `/help` and keeps the appeal email.
- Admin inbox `/api/admin/support*`: safety first, then oldest. A reply sets
  ANSWERED, notifies the user (`SUPPORT_REPLY`) and writes `SUPPORT_REPLIED`;
  closing writes `SUPPORT_CLOSED`. An admin can't handle their own request
  (`CANNOT_TARGET_SELF`).
- Announcements: `POST /api/admin/announcements` notifies every non-deleted
  user (`ANNOUNCEMENT`) and writes `ANNOUNCEMENT_POSTED`; the dashboard banner
  reads `GET /api/announcements/active`. Because posting notifies every user,
  `npm run test:server` runs `announcements.test.js` alone, after the other
  server tests (don't use a bare `jest server`). Tests and `seed:postman` remove the
  fan-out notifications they create.
- Monitoring: `SecurityEvent` stores security log entries without IP or email
  (installed in `server.js`, purged after 30 days by a 3:30 AM cron). The
  overview adds queues, today, security counts and `watchlistCount`;
  `/api/admin/watchlist` flags (never acts on) ≥3 approved rides cancelled by
  the passenger, ≥2 trips cancelled by the host after approval (admin
  cancellations excluded), ≥2 reports, all in 30 days. `ADMIN_ERRORS_URL`
  shows an error-reports link when set.
- Deleting an account deletes the user's support requests.
- Data requests from the police follow `docs/policy/law-enforcement-data-requests.md`.

## Women+ trips (Oct 2026)

Spec and plan: `docs/superpowers/specs/2026-10-02-women-plus-ride-preferences-design.md`,
`docs/superpowers/plans/2026-10-04-women-plus.md`. Replaces "same-gender only".

- `User.gender` (encrypted) is self-declared: `WOMAN`, `MAN`, `NON_BINARY`,
  `PREFER_NOT_TO_SAY` (default). Women+ eligible = woman or non-binary.
  `GenderPreference` is `ANY` | `WOMEN_PLUS` on `Trip` (who can join) and
  `Preference` (Trips I see).
- One rule set: `server/services/riderRules.js` (UI mirror `src/lib/riderRules.ts`),
  facts from `server/services/riderFacts.js`, never from the client. Search and
  Show all drop trips the searcher can't join before PSGA scoring; join 403s
  `TRIP_WOMEN_PLUS_ONLY` / `TRIP_FAMILIAR_RIDERS_ONLY`; approve re-checks (409
  `RIDER_NO_LONGER_ELIGIBLE`, request declined); only Women+ hosts may post or
  switch to Women+ (403 `WOMEN_PLUS_HOST_NOT_ELIGIBLE`); "who can join" locks
  once a rider is approved (409 `WHO_CAN_JOIN_LOCKED`); switching to Women+
  declines ineligible pending requests; a Women+ trip's details give a
  non-eligible outsider the same 404 as a missing trip.
- Privacy: `safeUserSelect` has no `gender`. It's returned only on your own
  `GET /api/users/:id` and the admin user detail. Trips show rule badges, never
  a person's gender.
- `PATCH /api/users/me/gender { gender, confirm }`: 409 `HOSTING_WOMEN_PLUS_TRIPS`
  while hosting open Women+ trips; 409 `CONFIRM_WITHDRAW_PENDING` before
  withdrawing pending Women+ requests (resend with `confirm: true`); resets a
  Women+ preference to `ANY`. Not written to the security log.
- Preferences: 400 `INVALID_PREFERENCE`, 403 `WOMEN_PLUS_NOT_ELIGIBLE`; a stale
  value reads as `ANY`.
- Find a Ride's `show=womenplus|all` overrides the Profile default; a rider who
  chose Women+ trips sees a warning before requesting a trip open to everyone.
- Migration: `node scripts/backup-db.mjs`, `npm run migrate-women-plus`, then
  `npx prisma db push` (drops the old `SAME_GENDER` value). Done on
  `rideshare_dev` and `rideshare_demo`.
- Validation: `psga.py` and the recheck use the Women+ rules and, like the app,
  rank only trips that pass them; datasets, `method_rankings.json` and the blank
  evaluator workbooks were regenerated. The Postman host is a woman; folder
  "15. Women+ trips" covers the rules.

## Superadmin and data requests (Oct 2026)

Spec and plan: `docs/superpowers/specs/2026-10-05-superadmin-data-requests-design.md`,
`docs/superpowers/plans/2026-10-05-superadmin-data-requests.md`. Policy:
`docs/policy/law-enforcement-data-requests.md`.

- `User.isSuperAdmin`: exactly one, meant to be the school's DPO. Set only by
  `npm run make-superadmin <email>` (`--replace` hands over; the old one stays
  an admin). Re-read by `authenticate` (`req.user.isSuperAdmin`);
  `requireSuperAdmin` returns 403 `SUPERADMIN_ONLY`.
- Only the superadmin promotes/demotes admins. Nobody can ban or demote the
  superadmin (409 `TARGET_IS_SUPERADMIN`); the superadmin can't delete their
  account (409 `LAST_SUPERADMIN`). With no superadmin set, promote/demote are
  simply unavailable.
- Regular admins see only a user's open/full hosted trips (to cancel them);
  `joinedMatches` and past trips are gone from `GET /api/admin/users/:id`.
- `/api/admin/data-requests` (superadmin only): `GET /` list (with `overdue`),
  `POST /` create + release (password re-check, 403 `INVALID_PASSWORD`,
  rate-limited like sign-in; 400 `INVALID_DATA_REQUEST` with `field`,
  `CANNOT_TARGET_SELF`), `GET /:id` reopen, `PATCH /:id/paperwork`.
  `DataRequest` stores who asked and why, never the released data:
  `dataRequestService.buildRelease` rebuilds it on each opening.
- A release has the person's trips in the range (or, for `EMERGENCY`, the most
  recent trip, the next 24 h and active recurring trips), co-riders by name,
  car and plate; chats/support only for a warrant or court order that names
  them. Never emails, passwords, codes, security logs or ratings.
- Every release, reopening and paperwork confirmation is an `AdminAction`
  (`DATA_RELEASED`, `DATA_RELEASE_VIEWED`, `DATA_PAPERWORK_RECEIVED`);
  `redactDataActions` hides the person and details from regular admins.
  Emergency paperwork is due 72 h after release (`overdueDataPaperwork` on the
  superadmin's overview).
- Demo: Liza is the superadmin, Carlo a regular admin. Postman: the admin
  account is the superadmin; folder "16. Data requests".

## Official warnings (Oct 2026)

Spec: `docs/superpowers/specs/2026-10-06-user-warnings-design.md`.

- A `UserWarning` is the step before a suspension. `issueWarning` (in
  `server/services/warningService.js`) writes the warning, a `WARNING`
  notification and a `WARNING_ISSUED` audit entry in one transaction; the
  controller then sends the email. Reasons: SMOKING, UNSAFE_DRIVING,
  LATE_OR_NO_SHOW, DISRESPECTFUL, OTHER (OTHER needs a note, 400 `NOTE_REQUIRED`).
- Three ways to issue one: `POST /api/admin/users/:id/warnings` (user page,
  or a support request's "Warn the driver" with `ticketId`), and report review
  with `warn: { reason, note }` (can't be combined with a ban, 400 `WARN_OR_BAN`).
  A linked ticket's trip host or a report's reported user must be the target
  (400 `WARNING_TARGET_MISMATCH`).
- The user sees a dashboard banner until they press "I understand"
  (`GET /api/warnings/active`, `PATCH /api/warnings/:id/acknowledge`). Their
  view never includes the issuer, report or ticket, so they can't tell who
  reported them.
- The watch list flags ≥2 warnings in 30 days. A notification type the
  notifications page doesn't know falls back to a bell icon instead of crashing.

## Pre-deploy security pass (Oct 2026)

Report: `docs/security/pre-deploy-audit.md`.

- Every write route runs `strictBody('<name>')` (`server/middleware/strictBody.js`);
  schemas live in `server/validation/bodySchemas.js`. Unknown fields → 400
  `UNKNOWN_FIELD`, wrong types → `INVALID_FIELD_TYPE`, identity/ownership/price
  fields (`NEVER_SET`: `userId`, `hostId`, `passengerId`, `raterId`, `ownerId`,
  `isAdmin`, `filledSeats`, `fuelSharePerSeat` …) → `FORBIDDEN_FIELD`, logged as
  `ACCESS_DENIED`. A new route needs a schema: `strictBody.test.js` walks the
  router and fails otherwise. Clients must not send identity fields any more.
- Signed-in routes are limited per account: 300/min overall, geocode 30/min,
  reports 10/hour (`middleware/rateLimit.js`, skipped under Jest unless
  `RATE_LIMIT_IN_TESTS=1`).
- The API won't start with a weak or placeholder `JWT_SECRET`, a bad
  `PII_ENCRYPTION_KEY`, no `DATABASE_URL`, or (production) non-https
  `CORS_ORIGIN` (`server/config/checkEnv.js`). JWTs are verified as HS256 only.
- `/api/session` (Next) sets the cookie only for a same-origin JSON request with
  a validly signed token (stops login CSRF). The unused public `/api/figma`
  proxy was removed.
- `crossUserAccess.test.js` is the per-route proof that another user gets
  403/404; `SHOW_ACCESS_TABLE=1` prints each attempt's status.
