# RideShareEU

PSGA-based carpool matching for a university community — Next.js frontend, Express + Prisma API, PostgreSQL.

## Local development

### Prerequisites

- Node.js 20+
- PostgreSQL 17 running locally as a service

Install PostgreSQL (Windows, admin shell):

```powershell
choco install postgresql17 --params '/Password:postgres' -y
```

This installs the `postgresql-x64-17` Windows service (auto-starts on boot,
listens on `localhost:5432`, superuser `postgres` / password `postgres`).
Open a new terminal afterward so `psql` / `createdb` are on `PATH`.

> The project previously used `npx prisma dev` (an in-process PGlite database).
> It was replaced with a real local Postgres because it kept dropping idle
> connections. There is no longer a database command to run — the service is
> always on.

### Setup

```bash
npm install

# create the database
createdb -U postgres rideshare_dev            # or: psql -U postgres -c "CREATE DATABASE rideshare_dev"

# Two separate env files are needed — one per process:
#   cp .env.example .env              # Express API (server/): DATABASE_URL, JWT_SECRET, CORS_ORIGIN, SMTP_*
#   cp .env.local.example .env.local  # Next.js app (src/): JWT_SECRET, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_MAPBOX_TOKEN
#
# JWT_SECRET must be the EXACT SAME value in both files — generate one and
# copy it into both, don't generate two different ones:
#   openssl rand -base64 32
# If they don't match, the API still works, but every server-rendered
# /auth/* page will silently treat every logged-in user as logged-out
# (src/lib/session.ts's own verification fails independently of the API's).
#
# SMTP_* can stay blank for local dev — emailService.js falls back to
# logging the OTP to the server console instead of sending a real email.
# NEXT_PUBLIC_MAPBOX_TOKEN needs a real Mapbox token for maps/routes to work
# (a free "pk." publishable token from https://account.mapbox.com/access-tokens/).

npx prisma migrate deploy # apply the tracked migrations in prisma/migrations/
npx prisma generate
```

If you have a data backup under `backups/`:

```bash
node scripts/restore-db.mjs
```

### Run

Two terminals:

```bash
npm run server   # Express API  -> http://localhost:4000
npm run dev      # Next.js app  -> http://localhost:3000
```

### Tests

```bash
npx jest server  # server-side unit + integration tests
```

## Backups

- `node scripts/backup-db.mjs` — snapshot every table to `backups/<timestamp>/`
  (JSON, gitignored). Run before schema changes.
- `node scripts/restore-db.mjs [backups/<dir>] [--force]` — restore a snapshot;
  verifies row counts against the manifest.
