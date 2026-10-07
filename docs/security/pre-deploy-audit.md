# Pre-deployment security audit (Oct 2026)

Checked against the code on branch `security-audit`, before the Railway + Vercel
deployment. Each item says what was found, what changed, and how it is proven.

Stack, for context: Next.js frontend (Vercel) → Express API (Railway) →
PostgreSQL. The browser never talks to the database; every read and write goes
through the Express API, which checks the session on every route except
`/api/auth/*`.

---

## 1. Secrets

**Found**

| Variable | Used by | Reaches the browser? | Secret? |
|---|---|---|---|
| `JWT_SECRET` | API (signs/verifies sessions) and Next server (`src/lib/session.ts`, `/api/session`) | No | **Yes** |
| `PII_ENCRYPTION_KEY` | API (AES-256-GCM field encryption) | No | **Yes** — losing it makes encrypted data unreadable |
| `DATABASE_URL` | API, scripts | No | **Yes** |
| `SMTP_HOST/PORT/USER/PASS/FROM` | API (OTP, ban and warning emails) | No | `SMTP_PASS` **yes** |
| `MAPBOX_ACCESS_TOKEN` | Demo seed script only | No | No — it is the same public `pk.` token |
| `CORS_ORIGIN`, `TRUST_PROXY`, `PORT`, `REPORT_APPEAL_EMAIL`, `ADMIN_ERRORS_URL` | API | No | No (config) |
| `NEXT_PUBLIC_API_URL` | Browser | Yes (by design) | No |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Browser (maps) | Yes (by design) | No — public `pk.` token |
| `NEXT_PUBLIC_CAMPUS_SECURITY_PHONE` | Browser (Help page) | Yes (by design) | No |
| Sentry DSN (hard-coded in `server/server.js`, `sentry.*.config.ts`) | Browser + API | Yes | No — a DSN is a public identifier |
| `FIGMA_TOKEN`, `FIGMA_FILE_KEY` | `src/app/api/figma/route.ts` | No, **but see below** | **Yes** |

- **Nothing was ever committed.** The actual values of `JWT_SECRET`,
  `PII_ENCRYPTION_KEY`, `SMTP_PASS`, both Mapbox tokens and `FIGMA_TOKEN` were
  searched for across the whole git history (all branches): 0 matches. Only
  `.env.example` and `.env.local.example` (placeholders) are tracked.
- **Built browser code holds no secret.** The same values were searched for in
  `.next/static`: 0 matches for every secret; only the public Mapbox `pk.` token
  appears, as intended.
- **Fixed — public Figma proxy.** `GET /api/figma` on the Next app had no
  sign-in check and returned the whole Figma design file using the personal
  Figma token. Nothing in the app used it (left from the August import).
  Deleted, and removed from `.env.local.example`.
- **Added — startup check** (`server/config/checkEnv.js`). The API refuses to
  start if `JWT_SECRET` is shorter than 32 characters or still the
  `change-me` placeholder, if `PII_ENCRYPTION_KEY` isn't 64 hex characters, if
  `DATABASE_URL` is missing, or (in production) if `CORS_ORIGIN` isn't https.
- **Added — HS256 pinned** on every `jwt.verify` (API, Next session check,
  registration and reset tickets), so a token signed with another algorithm is
  never accepted.

**Rotation:** nothing needs rotating because nothing leaked. For production, use
**new** values rather than the local ones: a new `JWT_SECRET`
(`openssl rand -base64 33`), a dedicated SMTP app password, and a production
`PII_ENCRYPTION_KEY` (`openssl rand -hex 32`) stored in a password manager.
In the Mapbox dashboard, restrict the `pk.` token to the production URL. The
Figma token can be revoked if it is no longer used.

## 2. Ownership

Every controller takes the caller from the verified token (`req.user.id`).
No controller reads `userId`, `hostId`, `passengerId`, `raterId`, `ownerId` or
`reporterId` from the body, query or URL as the caller's identity (searched:
the only match is the preferences check below, which compares the URL id *to*
the token). Since this audit, those fields are also refused outright (item 4).

| Route | Ownership check |
|---|---|
| `POST /api/trips` | host = token; car must be the caller's (`tripController.js:92`, 403 `VEHICLE_NOT_OWNED`) |
| `PATCH /api/trips/:id` | host only (`tripController.js:524`) |
| `PATCH /api/trips/:id/cancel` | host, or a passenger cancelling their own spot (`tripController.js:454`) |
| `POST /api/trips/:id/complete` | host only (`tripController.js:396`) |
| `POST /api/trips/:id/location` | host only, sharing on (`tripController.js:318`) |
| `GET /api/trips/:id/location` | host or an approved passenger (`tripController.js:363`) |
| `GET/POST /api/trips/:id/messages` | trip participants only (`messageController.js:62`, `:105`) |
| `GET /api/trips/:id` | any signed-in user (listings are public in the app); plate only after matching, Women+ trips 404 to non-eligible outsiders (`:263`) |
| `GET /api/trips/mine` | filtered by token |
| `POST /api/matches` | passenger = token; Women+/familiar rules checked from the DB (`matchController.js:241`) |
| `PATCH /api/matches/:id` | trip host only (`matchController.js:324`) |
| `POST /api/matches/:id/ratings` | rater = token; rater and ratee must be the two parties (`ratingController.js:49`) |
| `POST /api/reports` | reporter = token; must share a ride with the reported user (`reportController.js:46`, `:68`) |
| `GET /api/reports/mine` | filtered by token |
| `GET/PATCH /api/preferences/:userId` | `:userId` must equal the token (`preferenceController.js:15`) |
| `GET /api/alerts`, `PATCH /api/alerts/:id/read` | filtered by token; owner only (`notificationController.js:39`) |
| `/api/saved-vehicles/:id` (update, default, delete) | owner only (`savedVehicleController.js:14`) |
| `GET /api/support/:id`, reply, close | looked up by id **and** token, so others get 404 (`supportController.js:46`, `:55`, `:68`); a linked trip must be the caller's (`:16`) |
| `PATCH /api/warnings/:id/acknowledge` | the warned user only (`warningController.js:17`) |
| `/api/users/me/*` | always the token's own account; `GET /api/users/:id` shows email only on your own record |
| `/api/admin/*` | `requireAdmin` (403 `ADMIN_ONLY`), re-read from the DB each request; promote/demote and data requests also `requireSuperAdmin` |

**No route trusts a userId from the request.**

## 3. Database rules (RLS)

**Not applicable as written, and deliberately not added.** "RLS scoped to
`auth.uid()`" is the Supabase model, where the browser holds a database key and
queries tables directly, so the database itself must filter rows. This app has
no such path:

- The database is reachable only by the API (on Railway: private network, no
  public proxy). The browser has no database credentials: none of the
  `NEXT_PUBLIC_*` variables is a database URL or key (item 1).
- The API connects as one role, so per-user RLS would need every query wrapped
  in a transaction that first sets the user id, including the cron jobs, the
  admin console and account deletion that legitimately act on other users'
  rows. That is a large change for no new protection, since the same checks
  already run in the API and are proven per route (items 2 and 7).

The equivalent guarantees here: the database is not exposed, ownership is checked
on every route, and the production database user should be a non-superuser that
owns only this database (set when the Railway database is created).

## 4. Mass assignment

**Before:** controllers copied only allow-listed fields (`CREATABLE_TRIP_FIELDS`,
`EDITABLE_TRIP_FIELDS`, validators), so unknown fields were ignored, never
saved. But they were ignored silently, and one route took values unchecked
(`POST /api/matches` stored client-sent `score`/`routeOverlap`, where a string
caused a 500).

**Now:** every POST/PUT/PATCH/DELETE route runs `strictBody('<name>')`
(`server/middleware/strictBody.js`) with its schema in
`server/validation/bodySchemas.js` (the single place to read every route's
allowed fields and types). A body is refused with 400 when it has:

- a field that must **never** be set by a client: `FORBIDDEN_FIELD` (also
  written to the security log as `ACCESS_DENIED`). The list: `id`, `userId`,
  `hostId`, `passengerId`, `raterId`, `reporterId`, `ownerId`, `issuedById`,
  `actorId`, `createdAt`, `updatedAt`, `isAdmin`, `isSuperAdmin`, `bannedUntil`,
  `banSeverity`, `deletedAt`, `trustScore`, `filledSeats`, `fuelSharePerSeat`,
  `fuelShareAmount`, `isDefault`;
- a field the route doesn't list: `UNKNOWN_FIELD` (e.g. `status` or
  `cancelReason` on trip creation);
- a value of the wrong type: `INVALID_FIELD_TYPE`;
- a body that isn't a JSON object: `INVALID_BODY`.

The response names the field, e.g. `{ "error": "FORBIDDEN_FIELD", "field": "hostId" }`.
Ranges and formats are still checked by each controller's validator.
The frontend was cleaned to match (it still sent `userId`, `hostId`,
`passengerId` and `raterId`, and the whole preference row); join-request scores
are now range-checked (400 `INVALID_MATCH_SCORE`).

`server/__tests__/strictBody.test.js` walks the Express router and fails if any
write route has no schema, or if a schema lists a never-set field.

## 5. Payments

**There are no payments in the app.** No payment provider, no checkout, no
Stripe, so no webhook to verify. Passengers settle fuel costs with the host
outside the platform (stated in the manuscript).

The only amount is the fuel share, and the server decides it:

- `fuelSharePerSeat` = route distance ÷ car efficiency × fuel price ÷ seats,
  computed in `fuelShareService.js` when the trip is posted. Clients can't send
  it (`FORBIDDEN_FIELD`).
- The fuel price is entered by the host but capped by the admin's official price
  for the car's fuel type (400 `FUEL_PRICE_ABOVE_OFFICIAL`).
- A join request copies the trip's share on the server
  (`matchController.create`, `fuelShareAmount: trip.fuelSharePerSeat`); the
  client's figure is never used. `fuelShareAmount` is also a never-set field.

## 6. Rate limits

All limits return **429** with
`{ "error": "TOO_MANY_REQUESTS", "message": "Too many requests. Try again in a few minutes." }`,
standard `RateLimit-Policy`/`RateLimit` headers, and a `RATE_LIMITED` security
log entry. Sign-in routes count per IP; signed-in routes count per account.

| Route | Limit | Why |
|---|---|---|
| `POST /api/auth/register/start` | 5 / 15 min / IP | sends an email |
| `POST /api/auth/forgot-password` | 5 / 15 min / IP | sends an email |
| `POST /api/auth/verify` (login) | 10 / 15 min / IP | password guessing |
| `POST /api/auth/register/verify-otp`, `/register/complete`, `/verify-reset-otp`, `/reset-password` | 10 / 15 min / IP each | code guessing (plus the per-code attempt cap) |
| `DELETE /api/users/me` | 10 / 15 min / IP | password re-check |
| `POST /api/admin/data-requests` | 10 / 15 min / IP | password re-check |
| **New:** every signed-in route together | 300 / min / account | scraping and runaway loops |
| **New:** `GET /api/geocode` | 30 / min / account | the one external API the server calls (Nominatim, shared queue) |
| **New:** `POST /api/reports` | 10 / hour / account | each report can trigger a ban and its email |
| `POST /api/support` | 5 open, 10 a day / account (429 `TOO_MANY_TICKETS`) | existing business limit |

No server route calls a paid API: maps and routes are drawn in the browser with
the public Mapbox token (restrict it to the site's URL in the Mapbox dashboard),
and geocoding uses the free Nominatim service.

Behind Railway's proxy, set `TRUST_PROXY=1` so limits count real client IPs.
The counters are in memory: correct for one API instance; running several would
need a shared store (Redis).

## 7. Proof

`server/__tests__/crossUserAccess.test.js`: user A creates a saved car, a trip
(with its own car), a support request, preferences, a join request, and has a
notification and an admin warning. User B, signed in but unrelated, tries every
read, update and delete. Output (`SHOW_ACCESS_TABLE=1 npx jest server/__tests__/crossUserAccess`):

```
403  B tries to update A’s saved car
403  B tries to make A’s saved car B’s default
403  B tries to delete A’s saved car
403  B tries to read the live location on A’s trip
403  B tries to read the chat on A’s trip
403  B tries to post in the chat on A’s trip
403  B tries to edit A’s trip
403  B tries to share a location as A’s trip
403  B tries to mark A’s trip completed
403  B tries to cancel A’s trip
404  B tries to read A’s support request
404  B tries to reply to A’s support request
404  B tries to close A’s support request
403  B tries to read A’s preferences
403  B tries to change A’s preferences
403  B tries to approve A’s join request
403  B tries to rate on A’s join request
403  B tries to mark A’s notification read
403  B tries to acknowledge A’s warning
403  B tries to open A’s admin record

Tests: 23 passed, 23 total
```

The other three tests check that B's own lists never include A's records, that
B sees A's trip listing without the plate, and that every one of A's records is
unchanged afterwards (no edit, no message, no rating, no read flag).

Also run: 725 server tests, 37 web tests, `tsc`, and the Postman suite
(103 requests, 313 checks, 0 failures). A browser walkthrough covered every
screen whose request changed: search, show all, request to join, approve,
cancel a spot, save preferences, edit a trip, rate a passenger. No request was
rejected.

---

## Deployment readiness (the rest of the checklist)

| Area | Today | Before going live |
|---|---|---|
| Access, authority, permissions | Done (items 2, 4, 7) | — |
| Encryption / hashing | bcrypt passwords; AES-256-GCM for names, gender, addresses; HTTPS from the hosts | New production `PII_ENCRYPTION_KEY`, backed up separately |
| Rate limiting | Done (item 6) | `TRUST_PROXY=1` on Railway |
| Hosting & compute | Local only | Vercel (Next.js) + Railway (API + Postgres) |
| CI/CD & version control | Git + GitHub; **no CI** | GitHub Actions: tests + `tsc` on every push; Vercel/Railway deploy from `main` |
| Speed: caching & CDN | Geocoding cached 24 h in memory; no CDN yet | Vercel's CDN serves pages and assets; avatars need a Railway volume or object storage |
| Traffic: load balancing & scaling | One process | One API instance is enough for a campus pilot. Several would need Redis for rate limits, and one cron runner |
| Error tracking | Sentry on frontend and API | Set the environment name; Umami's broken SRI pin |
| Logs | JSON security log to stderr + `SecurityEvent` table | Railway log view; nothing else needed |
| Availability | Nothing watches it | `GET /api/health` + an uptime monitor |
| Recovery | `backup-db.mjs` / `restore-db.mjs` | Railway daily backups, plus a tested restore |
