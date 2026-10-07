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
            Railway Postgres (daily backups)
```

- The browser only ever talks to the website's address, so the sign-in cookie
  is first-party. `/api/session` stays on Vercel; every other `/api/*` call
  and every `/uploads/*` photo goes to the API.
- The API refuses any request without the secret header (except
  `/api/health`), so nobody can reach it around the website.
- Scheduled jobs (ride reminders every 5 minutes, the nightly security-log
  cleanup) run inside the API. Keep **exactly one** API replica.

**Code already in place:** `railway.json`, `vercel.json`,
`.github/workflows/ci.yml`, `server/config/checkEnv.js`, which refuses to
start with a missing or weak setting, and the forwarding in `src/proxy.ts`.

---

## 0. Before you start

You'll need:

| Account | Plan | What for |
|---|---|---|
| Railway | Hobby ($5/month) | API, database, photo volume |
| Vercel | Hobby (free, personal and non-commercial) | Website |
| Brevo | Free (300 emails a day) | Sign-up codes and notices. Railway Hobby blocks SMTP, so Gmail SMTP won't work there |
| UptimeRobot or Better Stack | Free | Alerts when the site is down |

Generate three secrets and keep them in a password manager:

```bash
openssl rand -base64 33   # JWT_SECRET (Railway AND Vercel, same value)
openssl rand -hex 32      # ORIGIN_SECRET (Railway AND Vercel, same value)
openssl rand -hex 32      # PII_ENCRYPTION_KEY (Railway only)
```

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

1. **New Project → Deploy from GitHub repo →** `KlRAAA/rideshare-eu`.
   Railway reads `railway.json`: it builds with `npx prisma generate`, runs
   `npx prisma db push` before each deploy (creating the tables the first
   time), starts with `npm run server`, and waits for `/api/health`.
2. In the service's **Settings**, set the region to **Southeast Asia
   (Singapore)**.
3. **+ New → Database → PostgreSQL** in the same project. In its settings,
   also pick Singapore. Under **Backups**, turn on a **daily** schedule.
4. On the API service, **+ Volume**, mount path `/data`.
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
   | `TRUST_PROXY` | `2` (check it in step 6) |
   | `CORS_ORIGIN` | your Vercel address, e.g. `https://rideshare-eu.vercel.app` (set after step 3) |
   | `BREVO_API_KEY` | from step 1 |
   | `EMAIL_FROM` | from step 1 |
   | `REPORT_APPEAL_EMAIL` | the address people write to about a ban |
   | `SENTRY_ENVIRONMENT` | `production` (optional; Railway's environment name is used otherwise) |

6. **Settings → Networking → Generate Domain**. That `https://….up.railway.app`
   address is `API_ORIGIN` for Vercel.
7. **Workspace → Usage**: set a usage limit (e.g. $10) so a mistake can't run
   up a bill.

Check it: `https://<api>.up.railway.app/api/health` answers `{"status":"ok"}`,
and any other path answers `403 {"error":"FORBIDDEN"}`, as it should.

## 3. Vercel: website

1. **Add New → Project →** import `KlRAAA/rideshare-eu`. Vercel detects
   Next.js; keep the defaults. `vercel.json` pins server rendering to
   Singapore (`sin1`), next to the API.
2. **Environment Variables** (Production and Preview):

   | Variable | Value |
   |---|---|
   | `API_ORIGIN` | the Railway address from step 2.6 |
   | `ORIGIN_SECRET` | same as on Railway |
   | `JWT_SECRET` | same as on Railway |
   | `NEXT_PUBLIC_MAPBOX_TOKEN` | your `pk.` Mapbox token |
   | `NEXT_PUBLIC_CAMPUS_SECURITY_PHONE` | optional, shown on Help |

   **Don't** set `NEXT_PUBLIC_API_URL`. Leaving it out is what makes the
   browser call the site's own `/api/*`.
3. Deploy, then copy the production address into Railway's `CORS_ORIGIN`
   (step 2.5). Railway redeploys on its own.

## 4. Mapbox

At account.mapbox.com → **Tokens**, edit the `pk.` token and add **URL
restrictions**: your Vercel address and `http://localhost:3000`. A copied
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

## 6. Checks after the first deploy

| Check | How | Expected |
|---|---|---|
| Health | open `https://<site>/api/health` | `{"status":"ok"}` |
| Direct API blocked | open `https://<api>.up.railway.app/api/fuel-price` | `403 FORBIDDEN` |
| Sign-up email | register a second test account | the code arrives within a minute |
| Photo upload | upload a 3–4 MB photo on Profile | it saves and shows |
| Real visitor IPs | sign in once with a wrong password, then search the Railway logs for `LOGIN_FAILED` | `"ip"` is **your** public IP. If it's a Vercel or Railway address, change `TRUST_PROXY` (try `1` or `3`) and repeat |
| Reminders | post a trip departing in ~1 hour with a joined rider | the reminder notification appears |
| Errors reach Sentry | Sentry → Issues, filter environment `production` | any error shows with the right environment |

## 7. Uptime monitor

In UptimeRobot (or Better Stack), add an HTTP(S) monitor for
`https://<site>/api/health` every 5 minutes, alerting your email. It checks the
website, the forwarding, the API and the database in one request.

## 8. CI and deploys

- `.github/workflows/ci.yml` runs the server tests, web tests and type check
  on every push to `main` and on pull requests, against a fresh Postgres 17.
- Vercel redeploys the website on every push to `main`. Railway redeploys the
  API only when `server/`, `prisma/`, `package*.json` or `railway.json`
  change (`watchPatterns` in `railway.json`).
- Schema changes deploy through `prisma db push`, which **refuses** a change
  that would delete data. If a deploy fails on that, back up first
  (`node scripts/backup-db.mjs` with `DATABASE_URL` set to the production
  database), then apply the change by hand.

## 9. Recovery

- **Database:** Railway's daily backups (kept 6 days). Restore from the
  Postgres service's **Backups** tab. For an extra copy you control, run
  `node scripts/backup-db.mjs` against production now and then.
- **Photos:** live on the API volume. Railway backs up volumes the same way;
  turn that on for the API's `/data` volume too.
- **Bad deploy:** in Railway or Vercel, open **Deployments** and redeploy the
  previous one. Both keep their history.
