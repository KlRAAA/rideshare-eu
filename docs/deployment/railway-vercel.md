# Deploying RideShareEU: Railway + Vercel

**How it fits together**

```
Browser ──► Vercel (Next.js website, region sin1)
              │  /api/* and /uploads/* are forwarded by src/proxy.ts,
              │  with the x-origin-secret header
              ▼
            Railway, Singapore (Express API + volume for photos)
              │  private network
              ▼
            Railway Postgres (backed up weekly from your PC)
```

- The browser only ever talks to the website's address, so the sign-in cookie
  is first-party. `/api/session` stays on Vercel; every other `/api/*` call
  and every `/uploads/*` photo goes to the API.
- The API refuses any request without the secret header (except
  `/api/health`), so nobody can reach it around the website.
- Scheduled jobs (ride reminders every 5 minutes, the nightly security-log
  cleanup) run inside the API. Keep **exactly one** API replica.

**Code already in place:** `vercel.json`, `.github/workflows/ci.yml` (tests),
`.github/workflows/uptime.yml` (uptime check), `server/config/checkEnv.js`,
which refuses to start with a missing or weak setting, the forwarding in
`src/proxy.ts`, and `scripts/backup-production.ps1`.

---

## 0. Before you start

You'll need:

| Account | Plan | What for |
|---|---|---|
| Railway | Hobby ($5/month) | API, database, photo volume |
| Vercel | Hobby (free, personal and non-commercial) | Website |
| Brevo | Free (300 emails a day) | Sign-up codes and notices. Railway Hobby blocks SMTP, so Gmail SMTP won't work there |

Generate three secrets, each with its own run of this Git Bash command. It
puts a 64-character key straight on the clipboard, so nothing extra is copied;
paste each into a password manager:

```bash
openssl rand -hex 32 | tr -d '\r\n' | clip
```

| Name | Goes to |
|---|---|
| `JWT_SECRET` | Railway **and** Vercel (same value) |
| `ORIGIN_SECRET` | Railway **and** Vercel (same value) |
| `PII_ENCRYPTION_KEY` | Railway only |

Check a length with `powershell -NoProfile -Command "(Get-Clipboard).Length"`
(it should print 64).

> **Back up `PII_ENCRYPTION_KEY` outside Railway.** Names, gender and trip
> addresses are encrypted with it. If it's lost, that data can't be read again.
> Use a **new** key for production. Don't reuse the one in your local `.env`.

## 1. Email (Brevo)

1. Create a Brevo account. Under **Senders**, add the address emails should
   come from (e.g. your Gmail or the thesis group's address) and verify it
   from the email Brevo sends.
2. Create an API key (**SMTP & API → API keys**). That value is
   `BREVO_API_KEY`.
3. `EMAIL_FROM` = `RideShareEU <the-verified-address>`.

(Resend works too, with `RESEND_API_KEY`, but it only sends to other people
once you've verified a domain you own.)

## 2. Railway: database and API

1. **Install the Railway GitHub app** on the repo first:
   github.com/apps/railway-app → Install → `KlRAAA` → *Only select
   repositories* → `rideshare-eu`. Signing in with GitHub is not enough;
   without the app, Railway shows "Could not load branches" and never deploys
   new pushes.
2. **New Project → Deploy from GitHub repo →** `KlRAAA/rideshare-eu`. The
   first deploy crashes until the variables below are set; that's expected.
3. The service's **Settings** (Railway no longer reads a `railway.json` file
   for new services, so enter these in the dashboard; click each field's ✓):

   | Setting | Value |
   |---|---|
   | Region | Southeast Asia (Singapore), 1 replica |
   | Replica limits (cost guard) | 1 vCPU, 1 GB |
   | Custom Build Command | `npx prisma generate` |
   | Watch Paths | leave empty (see section 8) |
   | Pre-deploy step | `npx prisma db push` (creates/updates the tables) |
   | Custom Start Command | `npm run server` |
   | Healthcheck Path | `/api/health` |
   | Serverless | **off** (the scheduled jobs need it awake) |
   | Source branch | `main`, auto deploys on |

4. **+ Create → Database → PostgreSQL** in the same project; keep the name
   **Postgres** and set its region to Singapore. (Hobby can't create backups;
   see **Backups** below.)
5. Right-click the API service → **Attach volume**, mount path `/data`.
5. API service **Variables**:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway's reference to the database, over the private network) |
   | `NODE_ENV` | `production` |
   | `TZ` | `Asia/Manila` |
   | `JWT_SECRET` | from step 0 |
   | `PII_ENCRYPTION_KEY` | from step 0 |
   | `ORIGIN_SECRET` | from step 0 |
   | `UPLOADS_DIR` | `/data/uploads` |
   | `LICENSE_DIR` | `/data/licenses` (driver's license photos: private, encrypted, never served publicly) |
   | `VAPID_PUBLIC_KEY` | phone notifications: from `npx web-push generate-vapid-keys` (push stays off without all three) |
   | `VAPID_PRIVATE_KEY` | from the same command; keep it secret |
   | `VAPID_SUBJECT` | `mailto:` the admin contact address |
   | `TRUST_PROXY` | `2` (check it in step 6) |
   | `CORS_ORIGIN` | your Vercel address, e.g. `https://rideshare-eu.vercel.app` (set after step 3) |
   | `BREVO_API_KEY` | from step 1 |
   | `EMAIL_FROM` | from step 1 |
   | `REPORT_APPEAL_EMAIL` | the address people write to about a ban |
   | `SENTRY_ENVIRONMENT` | `production` (optional; Railway's environment name is used otherwise) |

6. Variables: paste them in **Variables → Raw Editor** (`NAME=value`, no
   quotes or brackets).
7. **Settings → Networking → Generate Domain** (port 8080, the one the app
   logs as `RideShareEU API listening on :8080`). That `https://….up.railway.app`
   address is `API_ORIGIN` for Vercel.
8. **Workspace → Usage → Set Usage Limits**: compute email alert $7, hard limit
   $15 (the minimum is $10; reaching it stops the services). Agent limits: $0.

Check it: `https://<api>.up.railway.app/api/health` answers `{"status":"ok"}`,
and any other path answers `403 {"error":"FORBIDDEN"}`, as it should.

## 3. Vercel: website

1. **Add New → Project →** import `KlRAAA/rideshare-eu`. Vercel detects
   Next.js; keep the defaults. `vercel.json` pins server rendering to
   Singapore (`sin1`), next to the API.
2. **Environment Variables** (Production and Preview):

   | Variable | Value |
   |---|---|
   | `API_ORIGIN` | the Railway address from step 2.7 |
   | `ORIGIN_SECRET` | same as on Railway |
   | `JWT_SECRET` | same as on Railway |
   | `NEXT_PUBLIC_MAPBOX_TOKEN` | your `pk.` Mapbox token |
   | `NEXT_PUBLIC_CAMPUS_SECURITY_PHONE` | optional, shown on Help |

   **Don't** set `NEXT_PUBLIC_API_URL`. Leaving it out is what makes the
   browser call the site's own `/api/*`. Vercel may offer the repo as several
   "services": choose **Import single project** on the `web` (Next.js) row.
   Mark `JWT_SECRET` and `ORIGIN_SECRET` as **Secret**, but
   `NEXT_PUBLIC_MAPBOX_TOKEN` as **Config** (it is sent to browsers, so Vercel
   refuses it as a secret). Skip the Prisma Postgres and Sentry integrations.
3. Deploy, then copy the production address into Railway's `CORS_ORIGIN`
   (step 2.6). Railway redeploys on its own.

## 4. Mapbox

The default public token can't be restricted, so at account.mapbox.com →
**Tokens → Create a token** make a `rideshare-web` token with the default
public scopes only and these **URL restrictions**: your Vercel address,
`http://localhost:3000` and `http://localhost:3001`. Put it in Vercel's
`NEXT_PUBLIC_MAPBOX_TOKEN` and redeploy (it is built into the site). A copied
token then won't work on other sites.

## 5. First accounts

The production database starts empty, with no demo accounts.

1. Register on the live site with your school email (the code arrives through
   Brevo).
2. Make yourself the superadmin (the school's DPO role) and an admin. Install
   the Railway CLI, then from the repo:

   ```bash
   railway link
   railway ssh
   npm run make-superadmin your.email@mseuf.edu.ph
   npm run make-admin other.admin@mseuf.edu.ph
   ```

3. Once, after the driver's license check ships (sub-project E): ask everyone
   who has already hosted a trip to upload their license. Safe to rerun.

   ```bash
   railway ssh --service rideshare-eu npm run notify-license-required
   ```

## 6. Checks after the first deploy

| Check | How | Expected |
|---|---|---|
| Health | open `https://<site>/api/health` | `{"status":"ok"}` |
| Direct API blocked | open `https://<api>.up.railway.app/api/fuel-price` | `403 FORBIDDEN` |
| Sign-up email | register a second test account | the code arrives within a minute |
| Photo upload | upload a 3–4 MB photo on Profile | it saves and shows |
| Real visitor IPs | sign in once with a wrong password, then search the Railway logs for `LOGIN_FAILED` | `"ip"` is **your** public IP. The website passes it on as `x-client-ip` (`src/proxy.ts`), and the API trusts that header only with the origin secret. A Vercel address (e.g. `13.212.…`) means that forwarding isn't deployed |
| Reminders | post a trip departing in ~1 hour with a joined rider | the reminder notification appears |
| Errors reach Sentry | Sentry → Issues, filter environment `production` | any error shows with the right environment |

## 7. Uptime monitor

`.github/workflows/uptime.yml` checks `https://<site>/api/health` every 15
minutes (three tries) from GitHub Actions; that one request covers the website,
the forwarding, the API and the database. A failed run makes GitHub email you.

- Make sure GitHub → **Settings → Notifications → Actions** has email on for
  failed workflows (it is by default).
- Run it by hand: repo → **Actions → Uptime → Run workflow**.
- GitHub runs schedules on a best-effort basis (a run can start a few minutes
  late) and pauses scheduled workflows in a public repo after 60 days without
  commits; re-enable it from the Actions tab if that happens.
- For alerts within 5 minutes, a free UptimeRobot monitor on the same URL works
  alongside it.

## 8. CI and deploys

- `.github/workflows/ci.yml` runs the server tests, web tests and type check
  on every push to `main` and on pull requests, against a fresh Postgres 17.
- Vercel and Railway both redeploy on every push to `main`. Railway's Watch
  Paths are left empty on purpose: Railway compares them only with the
  newest commit of a push, so a push ending in a docs-only commit was skipped
  and the API stayed a day behind (8 Oct 2026). If Railway ever stops picking
  up pushes, check that the Railway GitHub app is still installed (step 2.1),
  or deploy the latest commit with `railway redeploy --service rideshare-eu
  --from-source`.
- Schema changes deploy through `prisma db push`, which **refuses** a change
  that would delete data. If a deploy fails on that, back up first
  (`node scripts/backup-db.mjs` with `DATABASE_URL` set to the production
  database), then apply the change by hand.
- **During UAT, don't change `prisma/schema.prisma`.** A failed or partial
  schema change mid-session is an outage, and `db push` can't be rolled back.
  Code-only fixes are fine.
- **After UAT, switch to versioned migrations,** so every schema change is a
  reviewed file applied the same way everywhere:
  1. Back up production (section 9).
  2. Move the old `prisma/migrations` folder aside; it stopped matching the
     schema when the project moved to `db push`.
  3. Create one baseline migration from the current schema
     (`prisma migrate diff` from empty to `prisma/schema.prisma`, saved as
     `prisma/migrations/0_init/migration.sql`) and mark it as already applied
     on production with `npx prisma migrate resolve --applied 0_init`. Check
     the exact flags in Prisma 7's "baselining" guide.
  4. In Railway, change the pre-deploy command to `npx prisma migrate deploy`,
     and do the same in CI.
  5. From then on, make schema changes with `npx prisma migrate dev --name …`
     and commit the generated folder.

## 9. Backups

Railway's Hobby plan can't create database backups, so they run from your PC
with `scripts/backup-production.ps1`. It opens Railway's private tunnel to the
database (`railway connect Postgres --tunnel-only`; the database never gets a
public address, so leave **Add Public Access** off), copies every table into
`%USERPROFILE%\rideshare-backups\production\<timestamp>\` (outside the
repo), then closes the tunnel. The password is never saved, and each run adds
an `OK` or `FAILED` line to `%USERPROFILE%\rideshare-backups\backup.log`.

**One-time setup**

1. Install the Railway CLI: `npm install -g @railway/cli`
2. `railway login` (approve it in the browser that opens).
3. From the repo folder: `railway link`, and choose the project and the
   `production` environment.
4. Run the first backup (do this before UAT starts):
   `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup-production.ps1`
5. Schedule it: **daily at 9 PM during UAT**, weekly (Sunday) afterwards. If
   the PC is off at that time, it runs at the next chance. `-MirrorDir` copies
   each backup to a second folder on another physical drive (here the `F:`
   hard drive; the first copy is on the `C:` SSD), so one failed disk doesn't
   take every copy. In PowerShell:

   ```powershell
   $a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\Users\Spider-Man\rideshare-eu\scripts\backup-production.ps1" -MirrorDir "F:\rideshare-backups\production"'
   $t = New-ScheduledTaskTrigger -Daily -At 9pm   # after UAT: -Weekly -DaysOfWeek Sunday -At 9pm
   $s = New-ScheduledTaskSettingsSet -StartWhenAvailable
   Register-ScheduledTask -TaskName 'RideShareEU production backup' -Action $a -Trigger $t -Settings $s
   ```

   To change the existing task instead, use
   `Set-ScheduledTask -TaskName 'RideShareEU production backup' -Action $a -Trigger $t`.

   Check `backup.log` now and then: each run should end with `OK  copied to
   F:\…`. If a run says `FAILED` with a login error, run `railway login` again.

The backups hold real student data: keep them on this PC's own drives (not
GitHub or a shared or cloud drive), and delete them when the study ends, as the Privacy Policy says.
Encrypted fields stay encrypted in the backup and need `PII_ENCRYPTION_KEY`.

## 10. Recovery

- **Database:** restore a backup (either copy) with
  `node scripts/restore-db.mjs <backup folder> --force`, with `DATABASE_URL`
  set to the target. It inserts every table parents-first and fails unless
  every row count matches the backup.
- **Photos:** live on the API volume, which Hobby can't back up either. They
  are not in the database backup; if the volume were lost, people would need
  to upload their photo again (the app shows initials until then).
- **Bad deploy:** in Railway or Vercel, open **Deployments** and redeploy the
  previous one. Both keep their history.
