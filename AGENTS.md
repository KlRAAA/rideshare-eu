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
  admins promote/demote each other in the console at `/auth/admin`.
- Powers: official fuel price, report review (with optional ban), ban/unban,
  user search/detail, cancel a trip, promote/demote, audit log.
- Safety rules: no action on your own account (`CANNOT_TARGET_SELF`), including
  deciding a report about yourself; an admin must be demoted before being
  banned (`TARGET_IS_ADMIN`). Admins cannot read trip chats.
- **Official fuel price is a cap.** `GET /api/fuel-price` (any signed-in user)
  returns the newest `FuelPrice` row. `createTrip` rejects a higher host price
  with 400 `FUEL_PRICE_ABOVE_OFFICIAL`; with no official price, the old
  PHP 20–150 bounds apply. Posted trips keep their price.
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
