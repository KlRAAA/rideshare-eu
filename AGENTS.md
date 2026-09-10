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
