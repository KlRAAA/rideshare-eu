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
- `run_methods.py` shuffles each query's posting order (seeded): the generator
  always creates the clear positive (T1) first, which handed FIFO the ideal
  trip and broke route-only ties in its favor. Familiarity is per
  (passenger, trip) pair, never read once per query.
- `python validation/compare_methods.py` compares each method's top pick
  without human labels (rule-breaking, outside route/time, minutes off), for
  the committed rankings and averaged over 200 posting orders.
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

## Address suggestions (Oct 2026)

- Address fields (Post a Trip origin/destination/meeting point, Find a Ride
  origin/destination) use `src/components/AddressInput.tsx`, an accessible
  combobox: arrow keys, Enter, Escape, `aria-activedescendant`, and a polite
  live region announcing the count.
- Suggestions come from `GET /api/geocode/suggest?q=` → `addressSuggestService`
  → komoot's public Photon (OpenStreetMap; allows search-as-you-type, "be
  fair"): Philippines only, ranked toward Lucena, max 5, cached 1 h, 60/min per
  account. An outage returns `[]`; typing and the map pin still work.
- Picking a suggestion sets the exact pin. Text typed without picking is looked
  up once on blur (`onCommit` → `useGeocodedAddress` → Nominatim), never per
  keystroke: Nominatim's policy forbids autocomplete. `geocodingService` limits
  Nominatim to the Philippines (`countrycodes=ph`, Lucena viewbox) and ignores
  pins outside the country.
- Find a Ride keeps a picked drop-off in the URL (`dlat`/`dlng`).
- If a new Tailwind class doesn't show in `next dev`, the Turbopack dev cache
  can be stale: stop the server and delete `.next/dev`.

## Deployment: Railway + Vercel (Oct 2026)

Guide: `docs/deployment/railway-vercel.md`.

- Production: Vercel (Next.js, `vercel.json` → `sin1`) forwards `/api/*`
  (except its own `/api/session`) and `/uploads/*` to the Railway API in
  `src/proxy.ts`, adding `x-origin-secret`. The browser never calls Railway
  directly; `NEXT_PUBLIC_API_URL` is unset there, so `API_BASE` is `''`.
  Server rendering calls `API_ORIGIN` directly with the same header
  (`src/lib/api.ts`).
- The API refuses requests without `ORIGIN_SECRET` (`middleware/
  requireOriginSecret.js`; off when unset, i.e. locally), except
  `GET /api/health` (DB check, used by Railway's deploy check and the uptime
  monitor). `checkEnv` requires `ORIGIN_SECRET`, an email API key and
  `EMAIL_FROM` in production.
- Visitor IPs: Vercel's server is what connects to Railway, so `proxy.ts`
  sends the visitor's address (Vercel's `x-real-ip`) as `x-client-ip`, always
  overwriting what the browser sent, and `requireOriginSecret` sets `req.ip`
  from it only on requests with the secret. Without this, every visitor shared
  one sign-in limit (the log showed a Vercel `13.212.…` address).
- Schema freeze during UAT: no `prisma/schema.prisma` changes; after UAT,
  switch Railway's pre-deploy to versioned migrations (steps in the deployment
  guide, section 8).
- Railway Hobby blocks SMTP: `emailService` sends through Brevo
  (`BREVO_API_KEY`) or Resend (`RESEND_API_KEY`) when set, SMTP otherwise.
- Photos: `server/config/uploads.js` (`UPLOADS_DIR`, a Railway volume at
  `/data/uploads`; defaults to `public/uploads` locally). The API serves
  `/uploads/*` with a 30-day immutable cache.
- Railway service settings live in the dashboard (Railway no longer reads
  `railway.json` for new services; the file was removed): build
  `npx prisma generate`, pre-deploy `npx prisma db push`, start
  `npm run server`, healthcheck `/api/health`, one replica (the cron jobs run
  in-process). Auto-deploy needs the Railway GitHub app installed on the repo.
  Watch Paths are empty on purpose: Railway checks them against only the
  newest commit of a push, so a push ending in a docs-only commit was skipped
  and the API ran a day-old build. `railway redeploy --service rideshare-eu
  --from-source` deploys the latest commit by hand.
- Backups: Hobby can't create Railway backups. `scripts/backup-production.ps1`
  (Task Scheduler: daily 9 PM during UAT, weekly after) opens
  `railway connect Postgres --tunnel-only` (no public database address; needs
  `railway login` + `railway link`), runs `backup-db.mjs` through it into
  `%USERPROFILE%\rideshare-backups\production`, copies it with `-MirrorDir` to
  `F:\rideshare-backups\production` (the second physical disk), and logs
  OK/FAILED to `backup.log` there. Profile photos (the volume) aren't backed
  up; losing them is an accepted, stated limitation. Every table is listed in
  `scripts/backupModels.cjs` (restore order); `backupModels.test.js` fails if a
  model is missing. Manifests never contain the database password.
- Uptime: `.github/workflows/uptime.yml` checks the live `/api/health` every
  15 minutes; a failed run emails the repo owner.
- Reminders (`reminderService.sendDueReminders`, every 5 minutes) fire an hour
  before every run of a recurring trip, not just the first: `upcomingDeparture`
  adds whole days to the first departure (no DST in PH) and checks the PH day
  with `recurrenceRunsOnDay`; dedupe is per trip, user and
  `Notification.occurrenceDate`. Seats are still per trip, not per day.
- Chat polls `GET /api/trips/:id/messages?after=<last id>` (only newer
  messages); Express compresses responses (`compression`).
- CI: `.github/workflows/ci.yml` (Postgres 17, server + web tests, `tsc`).
  Tests must create their own data; CI's database starts empty.
- To rehearse production routing locally: launch configs `api-prodsim`
  (:4100, secret on, separate uploads folder) and `web-prodsim` (:3002).
  Only one `next dev` can run per folder, so stop `web`/`web-demo` first.

## Panel revisions (Oct 2026)

Roadmap and decisions: `docs/superpowers/specs/2026-10-08-panel-revisions-roadmap.md`
(sub-projects A–K, in build order; B–F each get their own spec first).

**A. Quick fixes (done):**
- Places are limited to **Luzon** (`server/config/serviceArea.js`, UI mirror
  `src/lib/serviceArea.ts`; a box, lat 12.0–21.2, lng 119.4–124.6). Photon
  suggestions use it as `bbox` and drop anything outside; Nominatim asks for 5
  results and takes the first inside; reverse lookups outside are skipped.
  `validateNewTrip` and trip edits return 400 `INVALID_TRIP` with field
  `origin` / `destination` / `meetingPoint`. `RouteMapView` snaps a pin dropped
  outside back and shows "Pick a place in Luzon".
- `AddressInput` has a search icon and a spinner while suggestions load or the
  caller looks the text up (`busy`, from `useGeocodedAddress().resolving`).
- Sign-up gender has no default: the form starts on "Choose one", and
  `register/complete` returns 400 `GENDER_REQUIRED` for a missing or unknown
  value ("Prefer not to say" is a valid choice).
- After a password reset the page shows "Password changed", and
  `sendPasswordChangedEmail` tells the owner, with the admin contact
  (`REPORT_APPEAL_EMAIL`). A failed send is logged; the reset still succeeds.
- The host's cancel dialog says "No one has joined yet" (and hides the reason
  box) when the trip has no approved or pending passengers.

**B. Trip lifecycle (done):** spec `docs/superpowers/specs/2026-10-08-trip-lifecycle-design.md`,
plan `docs/superpowers/plans/2026-10-08-trip-lifecycle.md`.
- A `TripRun` is one day's run of a trip (`@@unique([tripId, runDate])`,
  `runDate` = the departure's PH day via `phDateOnly`), created by
  `POST /api/trips/:id/start` (host; 201). The posted trip keeps
  OPEN/FULL/CANCELLED/COMPLETED. Rules are pure in `services/tripRunRules.js`
  (start window: 30 min before to 60 min after that day's departure, 2 h
  until D; a near-midnight departure can still start after midnight); DB actions in
  `services/tripRunService.js`; routes in `controllers/tripRunController.js`.
- Start 409s: `TRIP_NOT_ACTIVE`, `NOT_A_TRIP_DAY`, `TOO_EARLY_TO_START` (with
  `opensAt`), `TOO_LATE_TO_START`, `ALREADY_STARTED`. Approved riders get a
  `TRIP_STARTED` notification.
- `POST /end` (host) and `POST /arrived` (the driver's phone within 150 m of
  campus) end the ongoing run, then complete as before: `completeTrip` for
  one-time, `completeRecurringOccurrence(trip, runDate)` for recurring. Both 409
  `NO_ONGOING_RUN` when nothing is running, so the near-campus check can't
  complete an unstarted trip any more (it used to, via `/complete`). The 5-min
  cron runs `endOverdueRuns` (`AUTO`, 60 min after `plannedArrivalAt`).
  (`applyLazyCompletion` is gone since D: see below.)
- Host and passenger cancel → 409 `TRIP_IN_PROGRESS` while a run is ongoing.
- Location lives on the run: `POST /location { lat, lng, etaSeconds? }` needs an
  ongoing run; `GET` returns `{ location, etaAt }`, location only while ongoing
  and under 90 s old, to the host and APPROVED riders. `Trip.lastKnown*` and
  `Preference.liveLocationSharing` are unused (kept so deploys don't need a
  data-loss `db push`; drop them with migrations).
- `GET /api/trips/:id` adds `currentRun` and `nextDeparture` (with the start
  window and planned arrival); `/api/trips/mine` adds `inProgress`.
- UI: `TripRunPanel` (Start Trip / "Trip in progress · 14 min" / "Arrive about
  7:42 AM" / End Trip). The driver's page sends position every 30 s, a Mapbox
  ETA every ~2 min, and holds a screen wake lock while ongoing. Riders' maps
  include the car in the fitted view.
- Demo: the seed adds Miguel's trip leaving 10 minutes after seeding (Paolo
  approved). Postman: folder "18. Trip runs"; `seed:postman` deletes runs
  before trips.

**C. Driver and passenger modes (done):** spec `docs/superpowers/specs/2026-10-09-driver-passenger-modes-design.md`,
plan `docs/superpowers/plans/2026-10-09-driver-passenger-modes.md`.
- `User.activeMode` (`AppMode`: PASSENGER default | DRIVER), set by
  `PATCH /api/users/me/mode { mode }` (400 `INVALID_MODE`); returned only on
  your own `GET /api/users/:id`. A view setting: no API refuses a call because
  of the caller's mode. Since E, posting a trip needs an approved license; the
  mode switch itself stays open.
- Overlap rule (`services/scheduleRules.js`, pure; DB side in
  `services/scheduleConflicts.js`): two trips clash when they share a PH day
  (one-time dates, `recurrenceRunsOnDay`, or shared weekdays) and their spans
  (departure time of day + `durationSeconds`, 60 min when unknown) intersect;
  back-to-back is fine. 409 `SCHEDULE_CONFLICT` (`conflictTripId`,
  `conflictDepartureTime`) on join (vs trips you host), post and schedule edits
  (vs rides you have PENDING/APPROVED), and approve (vs the rider's hosted trips).
- `GET /api/alerts?mode=driver|passenger`: notifications about trips you host
  are Driver mode, about other trips Passenger mode, ones without a trip show in
  both; adds `otherModeUnread`. Without `mode` it's unchanged.
- Web: `getCurrentUser` is React-`cache`d; the `/auth` layout (and `HelpShell`)
  wraps pages in `ModeProvider` (`useMode()`). `Header`/`BottomNav` render
  `tabsFor(mode)` from `src/lib/modeNav.ts` (Passenger: Home, My Rides, Find a
  Ride, Alerts, Profile; Driver: Home, My Trips, Post a Trip, Alerts, Profile).
  The main action (`primary`) sits in the middle of the bottom bar as a 32 px
  maroon circle (every icon has the same 32 px slot, so labels line up). Maroon
  in both modes; green is for success states only.
  `ModeSegmented` ("Passenger | Driver" radio group, current filled) on Home
  under the welcome and in Profile; the header has no switch, so the logo and
  name fit. `ModeSwitchButton` remains only inside `WrongModeNotice` and the
  notifications nudge; `WrongModeNotice`
  on Find a Ride in Driver mode and Post a Trip in Passenger mode; the dashboard,
  My Trips/My Rides and Alerts show only the current mode. The onboarding tour
  points at the mode switch.
- Demo: Juan, Miguel, Ana and Carlo start in Driver mode. Postman: folder
  "19. Modes and schedule conflicts".

**D. Trip days (done):** spec `docs/superpowers/specs/2026-10-09-trip-days-design.md`,
plan `docs/superpowers/plans/2026-10-09-trip-days.md`.
- `RunStatus` adds `CONFIRMED`, `SKIPPED`, `NO_SHOW`; `TripRun.startedAt` is
  optional (set only by Start Trip), plus `confirmedAt` and `skipReason`. New
  notification types `CONFIRM_REQUEST` (driver), `DRIVER_UNCONFIRMED`,
  `DRIVER_LATE`, `DRIVER_NO_SHOW`, `TRIP_SKIPPED` (riders), all with
  `occurrenceDate` = the run day.
- Routes (host; `:date` is `YYYY-MM-DD`, Philippine time), in
  `services/tripDayService.js`: `POST /api/trips/:id/days/:date/confirm`,
  `POST .../skip { reason? }` (recurring only, 409 `ONE_TIME_TRIP`; ≤200
  characters), `DELETE .../skip` (before departure, else 409 `TOO_LATE`).
  Other errors: 400 `INVALID_DATE`, 409 `NOT_A_TRIP_DAY`, `DEPARTED`,
  `ALREADY_STARTED`, `DAY_SKIPPED`, `NOT_SKIPPED`. Skip and undo notify approved
  riders (`TRIP_SKIPPED`). Start Trip turns a `CONFIRMED` day into the ongoing
  run and refuses a skipped one (409 `DAY_SKIPPED`).
- Timing is pure in `services/tripDayRules.js`: ask the driver at 8 PM PH the
  evening before (only with approved or pending riders, and only if the trip
  existed by then); warn approved riders 60 min before if the driver was asked
  and hasn't confirmed; +15 min without a start: `DRIVER_LATE`; +60 min: no-show.
  The start window closes at +60.
- `settleTrips(trips, now)` applies the due steps, once per trip and day. It
  replaced `applyLazyCompletion` on every read path (search, My Trips, trip
  details) and runs on the 5-minute cron as `runDaySteps`. A no-show (approved
  riders, departure within 2 days) records a `NO_SHOW` run and tells the riders;
  a one-time trip is then cancelled with `NO_SHOW_CANCEL_REASON` (no
  `CANCELLATION` notifications), a recurring trip just declines that day's
  pending requests. A one-time trip with nobody approved, or left unstarted
  longer than that, closes quietly as `COMPLETED` (no rating prompts). A trip
  nobody started is never completed with rating prompts any more.
- Search drops a trip on a date it's skipped; reminders skip skipped and no-show
  days; Start Trip's next departure passes over them. `GET /api/trips/:id` adds
  `days: [{ date, departure, status }]` (next 7 run days). The watch list adds
  "N no-shows as driver" (≥2 in 30 days); no-show cancellations don't count as
  host cancellations.
- Web: `TripDaysCard` (driver: "Next 7 days", or "Your trip day" for a one-time
  trip: Confirm / Skip with an optional reason / Undo skip); an approved rider
  gets a status line and, when the driver is late, skipped or didn't come,
  "Find another ride" (Find a Ride pre-filled). Helpers in `src/lib/tripDays.ts`.
- Tests that read past one-time trips through the API now see them closed;
  fixtures that need an open trip use a future departure.
- Demo: Juan confirmed his first weekday and skips the second (Maria approved).
  Postman: folder "20. Trip days".

**E. Driver's license verification (done):** spec `docs/superpowers/specs/2026-10-09-driver-license-design.md`,
plan `docs/superpowers/plans/2026-10-09-driver-license.md`.
- `DriverLicense`: one row per submission (PENDING / APPROVED / REJECTED,
  type, expiry, last 4 of the number). Verified = newest APPROVED row not yet
  expired (PH day), so a pending or rejected renewal doesn't lock out a driver
  whose old license is still valid. Pure rules in `services/licenseRules.js`,
  DB work in `services/licenseService.js`.
- The photo is AES-256-GCM encrypted (`encryptBuffer`, `PII_ENCRYPTION_KEY`)
  into `LICENSE_DIR` (`/data/licenses` on Railway; git-ignored
  `storage/licenses` locally), never under the public `UPLOADS_DIR`. The photo
  and the full number (encrypted) exist only while PENDING; a decision erases
  both and deletes the file. Account deletion removes the user's licenses and
  files. Rows are backed up, photos never.
- Driver: `POST /api/users/me/license` (multipart `photo` + `licenseNumber`,
  `licenseType`, `expiresOn`; 400 `INVALID_IMAGE` / `INVALID_LICENSE` with
  `field` / `LICENSE_EXPIRED`, 409 `LICENSE_PENDING`), `GET` returns
  `{ license, verified, canPost, reason }` without the photo or full number.
- Gate: only `createTrip`, first thing: 403 `LICENSE_REQUIRED` /
  `LICENSE_PENDING` / `LICENSE_REJECTED` / `LICENSE_EXPIRED`. Posted trips keep
  running; nothing else is gated.
- Admin (`/api/admin/licenses`, any admin): queue (oldest first, with the full
  number), `GET /:id/photo` (decrypted, `no-store`, CORP `same-site`, only while
  PENDING), `POST /:id/approve`, `POST /:id/reject { reason, note }` (OTHER
  needs a note; ≤300). 409 `ALREADY_DECIDED`, 403 `CANNOT_TARGET_SELF`. Each
  decision writes `LICENSE_APPROVED` / `LICENSE_REJECTED` (audit + notification)
  and emails the driver. Nav badge and overview tile: `pendingLicenses`.
- Jobs: daily 8 AM PH `sendLicenseExpiryReminders` (30 and 7 days before,
  `LICENSE_EXPIRING`, deduped by day; skipped when a renewal is already
  approved). `npm run notify-license-required` (one-time, rerunnable) sends
  `LICENSE_REQUIRED` to hosts with no license.
- Web: `/auth/license` (status card + upload form, hidden while pending),
  sign-up "Will you drive?" → `/auth/license?welcome=1`, Post a Trip shows the
  status card instead of the form until approved, Profile card, admin
  "Driver licenses" page. Helpers in `src/lib/license.ts`. The site's CSP
  allows images from the API origin (only set locally).
- Tests: `makeUser` gives every test user an approved license unless
  `licensed: false`; `makeLicense` adds one. `makeTrip` departs in a week by
  default: a search settles past trips on the searched date (D), which used to
  close other files' fixtures mid-run. Server tests run with a 15 s timeout.
- Demo: Juan, Miguel, Ana, Carlo approved; Rico's (made-up sample photo) waits
  in the queue. Postman: host and passenger approved, a fourth account
  `postman-driver@test.local` (no license) for folder "21. Driver licenses".
- Deploy: set `LICENSE_DIR=/data/licenses` on Railway first; afterwards run
  `npm run notify-license-required` once.
- **Automatic check (OCR, follow-up):** the photo is taken with the in-page
  camera only (`LicenseCamera`, `getUserMedia`, no gallery or file picker; no
  camera → "open this page on your phone"). The camera starts only on "Open
  camera" and stops after the photo, on Cancel, when the page is hidden or left
  (a camera still starting when cancelled is stopped at once). After an upload,
  `scheduleLicenseCheck` queues `checkLicense` (one at a time,
  `services/licenseOcr.js`): `sharp` decodes and normalises the photo, Tesseract
  (`tesseract.js` + the bundled `@tesseract.js-data/eng`, free, on our server,
  with an `errorHandler` so a bad image can't crash the API) reads it, and
  `services/licenseChecks.js` compares it with the typed details: LTO license
  wording, every name part (one OCR slip allowed), the number and the expiry
  (OCR letter/digit mix-ups and date layouts tolerated), not a student permit.
  Only the yes/no results are stored (`checks`, `checkedAt`), never the text.
  All pass → APPROVED with `autoApproved`, `decidedById` null, audit
  `LICENSE_APPROVED` with `actorId` null and `{ automatic: true }`; the photo
  and number are kept until `photoKeepUntil` (7 days) for spot-checks, then
  deleted by the daily `purgeSpotCheckPhotos`. Anything else stays PENDING for
  an admin, who sees the checks (✓/✗). Unchecked uploads are swept at startup
  and every 5 minutes (`checkUncheckedLicenses`). `LICENSE_OCR=off` disables it;
  under Jest it runs only when a test sets `setOcrReader`.
- Admin: `GET /api/admin/licenses/recent-auto` (spot-check list with photos),
  `POST /api/admin/licenses/:id/revoke { reason, note }` (APPROVED only, 409
  `NOT_APPROVED`; erases photo and number, notifies, `LICENSE_REVOKED`); the
  admin user page shows the newest license with Revoke. It checks consistency,
  not authenticity: there's no free LTO service to confirm a license is real.

**F. Noticeable notifications (done):** spec `docs/superpowers/specs/2026-10-09-loud-notifications-design.md`,
plan `docs/superpowers/plans/2026-10-09-loud-notifications.md`.
- Loud types (`LOUD_TYPES`, server `services/pushService.js`, web mirror
  `src/lib/loudNotifications.ts`): MATCH_REQUEST, APPROVAL (approved,
  declined and "filled up" all use it), CANCELLATION, TRIP_STARTED, MESSAGE,
  CONFIRM_REQUEST, DRIVER_UNCONFIRMED, DRIVER_LATE, DRIVER_NO_SHOW,
  TRIP_SKIPPED, LICENSE_APPROVED, LICENSE_REJECTED, DRIVER_ARRIVING. The rest
  are badge-only.
- Push outbox: `Notification.pushedAt`; `sendPendingPushes` (every 10 s in
  `server.js`, overlap-guarded, only when `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are set) sends loud notifications from
  the last 10 minutes once to each `PushSubscription` (TTL 600 s, urgency
  high), deletes subscriptions answered 404/410, then stamps `pushedAt`. No
  call site creates pushes itself. Tests pass a fake `send` and `userIds`.
- `/api/push`: `GET /key`, `POST /subscriptions` (the browser's
  `subscription.toJSON()`; https only; an endpoint moves to the newest account;
  10 per user, oldest dropped; 400 `INVALID_SUBSCRIPTION`), `DELETE
  /subscriptions { endpoint }` (own only, always 204). Account deletion removes
  them.
- `GET /api/alerts/feed?after=&mode=` → `{ notifications, unreadCount, cursor }`
  (max 20 newer than `after`, oldest first; `cursor` is the server's clock, so a
  phone's wrong clock can't skip anything; 400 `INVALID_CURSOR`).
- Driver arriving: `tripRunController.updateLocation` → `notifyArrivingOnce`:
  within 1 km (`services/arrivalRules.js`) of the meeting point, else the
  origin; approved riders; once per trip and run day (`occurrenceDate`).
- Web: `NotificationFeed` (in the `/auth` layout and `HelpShell`) polls every
  20 s and on focus, feeds `useLiveUnread()` to `Header`/`BottomNav`, and for
  loud types shows a pop-up, plays a Web Audio chime (after the first tap) and
  vibrates (Android). No chat pop-up on that trip's own page. "Sounds and
  vibration" is per device (`localStorage` `rsu.sound`).
- Phone: `public/sw.js` shows pushes (chat grouped per trip, "N new
  messages", sound at most once a minute) and opens the link on tap;
  `src/app/manifest.ts` + `public/icons/` make the site installable (needed for
  iPhone push, iOS 16.4+, from the Home Screen). `PushCard` ("Phone
  notifications") on the dashboard (dismissable) and Profile (with Turn off and
  the sound switch); `src/lib/push.ts` subscribes.
- Testing push without a phone: Chrome DevTools protocol
  `ServiceWorker.deliverPushMessage` drives `sw.js`; headless browsers refuse
  `pushManager.subscribe`, so real delivery is checked on a phone.
- Local dev: generate keys with `npx web-push generate-vapid-keys` into `.env`
  (git-ignored). Postman: folder "22. Notifications".
- Deploy: set the three VAPID variables on Railway (the website needs none).

**G. Passenger location (done):** spec `docs/superpowers/specs/2026-10-09-passenger-location-design.md`,
plan `docs/superpowers/plans/2026-10-09-passenger-location.md`.
- `Match.sharesLocation` (the rider's remembered switch) and
  `riderLat`/`riderLng`/`riderLocatedAt` (only the latest point). Pure rules
  in `services/riderLocationRules.js` (window: 15 min before the next
  startable departure to 60 min after; at pickup ≤ 100 m of the meeting point,
  else the origin; stale after 30 min), DB work in
  `services/riderLocationService.js`.
- `PATCH /api/matches/:id/location-sharing { on }` (passenger, approved only:
  403 / 409 `NOT_APPROVED`; off erases). `POST /api/trips/:id/rider-location
  { lat, lng }` (409 `NOT_SHARING`, `NOT_IN_WINDOW` with `opensAt`,
  `TRIP_STARTED`; 400 `INVALID_COORDINATES`). `GET /api/trips/:id/rider-locations`
  (host only): approved riders with `sharing`, `location`, `metersToPickup`,
  `atPickup`; empty once the day's run has started. `GET /api/trips/:id` adds
  `myLocationSharing`.
- Erased at Start Trip (`clearTripRiderLocations` in `startRun`), on switch off,
  on account deletion, and by the 5-minute cron (`clearStaleRiderLocations`:
  older than 30 min or not APPROVED). Never shown to admins or in data
  releases.
- Web: `RiderLocationCard` (rider: switch, flips at once and reverts on error;
  sends every 30 s while on and in the window; the page must stay open) and
  `RidersNearbyCard` (driver: list, polls every 30 s in the window);
  `RouteMapView` `riderLocations` pins (emerald initial, in the fitted view).
  Helpers in `src/lib/riderLocation.ts`.
- Postman: folder "23. Rider location". Demo: Paolo is approved on Miguel's
  trip that leaves 10 minutes after seeding.

**H. Driver dashboard (done, designed in chat):**
- "Earnings" = fuel share the app showed riders; the app never handles money,
  and the page says so.
- `TripRun.riderCount` / `fuelShareTotal` are saved by `finishRun` (End Trip,
  arrived, auto end) from the riders approved then (`fuelShareAmount`, else the
  trip's `fuelSharePerSeat`).
- `GET /api/driver/summary?period=week|month|all` (default month, 400
  `INVALID_PERIOD`; your own trips only) → `{ totals: { rides, riders,
  fuelShare }, weeks (last 12 PH weeks, Monday starts), recent (20) }`
  (`services/driverSummaryService.js`). A ride is a completed recurring day
  with riders, or a completed one-time trip with completed riders; recurring
  days from before the counts existed use today's approved riders and are
  flagged `estimated`.
- Web: `/auth/driver` "My driving" (period tabs, three tiles, CSS bar chart,
  recent rides), a "This month: …" card on the Driver-mode dashboard, a link in
  Profile. Helpers in `src/lib/driverSummary.ts`. Postman: folder "24. Driver
  summary".

**I. Icons and tooltips (done, designed in chat):**
- `src/components/Tip.tsx`: an icon or short value whose meaning shows in a
  tooltip; mouse hover and keyboard focus (`:focus-visible` only, since a tap
  also focuses) open it, a tap toggles it, a tap elsewhere or Escape closes it;
  the text is always in the DOM (`aria-describedby`, `sr-only` when closed).
  The bubble shifts back inside the screen (it sets the CSS `translate`
  property: Tailwind v4's translate utilities use it, not `transform`).
  `mode="wrap"` for elements that are already links/buttons (header icons);
  `side="bottom"` along the top edge.
- `TripFacts` (one row: time, date, repeats, seats, ₱/seat, car) and
  `RuleChips` (Women+ / Familiar, explained in tooltips; `RuleBadges` renders
  them) replace the stacked sentences on Find a Ride results and My Trips /
  My Rides; the Trip details card uses icon rows with the label as tooltip.
  Wording in `src/lib/tripFacts.ts`. Facts only: buttons keep their words.

## Automatic DOE fuel prices (Oct 2026)

Designed in chat. The official caps come from the DOE's weekly price
monitoring instead of an admin typing them in.

- Every day at 10 AM and 3 PM PH (`server.js` cron; the DOE posts on no fixed
  day) `doeFuelService.checkDoeFuelPrices` reads the DOE South Luzon page,
  takes the newest Region IV-A file (week labels under year headings), reads
  the PDF (`services/doePdf.js`, `pdfjs-dist` legacy build, no eval) and takes
  **Lucena's highest monitored price** (the range's top) for RON 91 →
  Regular, RON 95 → Premium, DIESEL → Diesel. Parsing is pure in
  `services/doeFuelRules.js`; fixtures are the real page excerpt and the
  Sep 29 – Oct 5, 2026 file's text in `server/test-helpers/fixtures/`.
- `DoeFuelImport` (one row per file, `key` = its URL, or `page:<PH date>` when
  the page lists no file): `APPLIED` when every grade moved ≤ 15%
  (`FuelPrice` rows with `importId`, `setById` null; `FUEL_PRICE_SET` audit
  with `actorId` null and `source: 'DOE'`); `HELD` when one moved more,
  `FAILED` when the file can't be read: both notify every admin
  (`FUEL_PRICE_CHECK`, links to the fuel price page). The DOE site being down
  records nothing, so the next run retries. Only changed grades get a row.
- Admin routes: `GET /api/admin/fuel-price/doe` (last 5), `POST .../doe/check`
  (502 `DOE_UNREACHABLE`; one run at a time, shared with the cron),
  `POST .../doe/:id/apply` and `.../dismiss` (404 `NOT_FOUND`, 409 `NOT_HELD`;
  dismiss writes `DOE_PRICES_DISMISSED`). Manual prices still work.
- Under Jest nothing reaches the DOE: tests call `setDoeSource` with a fake.
  Postman leaves out "check now" (live site).

## App-drawn pickers and dialogs (Oct 2026)

No browser-drawn pop-ups: their look follows the phone, not the app's theme.
- `Select` (`src/components/Select.tsx`) keeps the `<select>` API (`<option>`
  children, `onChange(e)` with `e.target.value`) but draws its own list: under
  the field on wide screens, a bottom sheet with 48 px rows on phones (above
  the bottom nav). `role="combobox"` + listbox, arrows/Home/End/first letter,
  Enter/Space, Escape. `Listbox` is a typed wrapper around it. Don't use a raw
  `<select>`.
- Dates: `DatePicker` (`min`/`max`, a year list spanning them, month arrows;
  the license expiry offers today to +10 years). Times: `TimePicker`. No
  `<input type="date|time|datetime-local">`.
- Confirm/prompt: `useAppDialog()` (`src/components/AppDialog.tsx`) →
  `confirm({ title, message, confirmLabel, danger })` /
  `ask({ title, label, required, maxLength })`, render `{dialog}`. A native
  `<dialog>` portalled to `<body>` (stops submit/click propagation, so it can
  sit inside a form). No `window.confirm` / `prompt` / `alert`.
- Required/format checks: `InvalidFieldHint` (root layout) catches every
  form's `invalid` event, cancels the browser bubble, focuses the first bad
  field and shows "<Label> is required." under it. Needs the field's
  `<label htmlFor>`, so keep labels linked.
