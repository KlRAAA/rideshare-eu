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

# .env — copy from .env.example and set at least:
#   DATABASE_URL="postgres://postgres:postgres@localhost:5432/rideshare_dev"
#   JWT_SECRET=<any string, must match between server and .env.local>

npx prisma db push        # deploy the schema
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
