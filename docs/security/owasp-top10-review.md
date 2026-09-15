# OWASP Top 10 (2021) Security Review — RideShareEU

**Scope:** the actual codebase as of commit `c0dcc4c3` (2026-09-15), Express/Node backend (`server/`) + Next.js frontend (`src/`) + Prisma/PostgreSQL schema (`prisma/schema.prisma`).

**Method:** every verdict below was checked against the current source this session — reading the controller/middleware/service code directly, grepping for the absence of things (raw SQL, rate-limit libraries, logging libraries, `dangerouslySetInnerHTML`), and running `npm audit` for real dependency data. Nothing here is carried over from an earlier audit without being re-verified; where an existing doc (`AGENTS.md`) turned out to be stale relative to the code, that's called out explicitly rather than repeated.

**Not in scope:** infrastructure-level controls this repo can't attest to one way or the other (hosting provider disk encryption, network firewalling, TLS termination) — noted as "unverifiable from the codebase" where relevant, not assumed either way.

---

## Summary

| # | Category | Verdict |
|---|---|---|
| A01 | Broken Access Control | **Mitigated** |
| A02 | Cryptographic Failures | Partially mitigated |
| A03 | Injection | **Mitigated** |
| A04 | Insecure Design | Partially mitigated |
| A05 | Security Misconfiguration | Partially mitigated |
| A06 | Vulnerable and Outdated Components | **Gap** |
| A07 | Identification and Authentication Failures | **Gap** |
| A08 | Software and Data Integrity Failures | Partially mitigated |
| A09 | Security Logging and Monitoring Failures | **Gap** |
| A10 | Server-Side Request Forgery | **Mitigated** |

2 fully mitigated, 5 partially mitigated, 3 real gaps.

---

## A01: Broken Access Control — Mitigated

**Evidence — ownership checks are real, consistent, and derived from the verified session, not client input:**

- Auth middleware sets `req.user.id` from a verified JWT signature only — [server/middleware/authenticate.js:34-51](../../server/middleware/authenticate.js). No controller anywhere in `server/controllers/` still trusts a client-supplied `userId`/`passengerId` for identity (this was the whole point of the "phase 2" hardening pass, and it holds up under inspection).
- Match approval/decline: `existing.trip.hostId !== req.user.id` → 403 — [server/controllers/matchController.js:285](../../server/controllers/matchController.js#L285).
- Trip edit/complete: `trip.hostId !== userId` → 403, checked independently in both handlers — [server/controllers/tripController.js:348](../../server/controllers/tripController.js#L348) and [:475](../../server/controllers/tripController.js#L475).
- Preferences: a `:userId` path param must equal `req.user.id` or 403, factored into one `requireSelf` helper reused by both handlers — [server/controllers/preferenceController.js:6-12](../../server/controllers/preferenceController.js#L6-L12).
- Notifications: `markRead` 404s if the notification doesn't exist, 403s if it isn't the caller's — [server/controllers/notificationController.js:36-46](../../server/controllers/notificationController.js#L36-L46).
- Ratings: the rater is `req.user.id`, and both rater and ratee must actually be the two real participants on that specific match (checked against the DB row, not trusted from the body) — [server/controllers/ratingController.js:44-50](../../server/controllers/ratingController.js#L44-L50).
- Trip group chat (added this session): participant check is trip-scoped by construction — a passenger's own `match` row is looked up *for that trip only*, so someone approved on a different trip is excluded with no separate check needed, plus an explicit trip-status gate that closes the endpoint to everyone once the trip ends — [server/controllers/messageController.js:59-60, 101-102](../../server/controllers/messageController.js#L59-L60).
- Mass-assignment: `createTrip`/`updateTrip` build their write payload from an explicit field allowlist (`CREATABLE_TRIP_FIELDS` / `EDITABLE_TRIP_FIELDS`), not a raw `req.body` spread — [server/controllers/tripController.js:60-67, 83](../../server/controllers/tripController.js#L60-L67) and [:451](../../server/controllers/tripController.js#L451).
- Field-level disclosure: `safeUserSelect` never includes `passwordHash`, and `email` is stripped from any user record that isn't the caller's own — [server/config/safeUserSelect.js:12-23](../../server/config/safeUserSelect.js), applied at [server/controllers/userController.js:26-27](../../server/controllers/userController.js#L26-L27).
- Auth-matrix test coverage exists for every one of the above (host/passenger/pending/outsider/no-token combinations) across `tripsAuth.test.js`, `matchAuth.test.js`, `preferencesAuth.test.js`, `messagesAuth.test.js`, `usersAuth.test.js`, `alertsAuth.test.js`, `vehiclesAuth.test.js`.

**One documentation staleness catch, not a code gap:** `AGENTS.md:79-80` currently reads *"Not done in phase 2: `createTrip` still mass-assigns `req.body`"* — that's no longer true; the allowlist fix landed in commit `417a0b0` (`fix: createTrip builds from a CREATABLE_TRIP_FIELDS allowlist, not a raw req.body spread`) and is confirmed present in the current file. Worth a doc fix, not a security fix.

**Intentional, not a gap:** `GET /api/trips/:id` has no host/passenger restriction — any authenticated user can view a trip's basic details. This is correct for a "Find a Ride" browsing model; the actually-sensitive fields (vehicle plate, live location) are gated separately by `canViewPlate`/`canViewLocation` and verified to work — [server/controllers/tripController.js:205-209, 254-258](../../server/controllers/tripController.js#L205-L209).

No IDOR was found in this review.

---

## A02: Cryptographic Failures — Partially mitigated

**Mitigated:**

- Passwords hashed with bcrypt, cost factor 12, both at registration and reset — [server/controllers/authController.js:89](../../server/controllers/authController.js#L89) and [:174](../../server/controllers/authController.js#L174).
- OTPs are never stored in plaintext — hashed with bcrypt (cost 10) before persisting — [server/services/otpService.js:11-12](../../server/services/otpService.js#L11-L12) — and generated via Node's CSPRNG (`crypto.randomInt`), not `Math.random()` — [server/services/otpService.js:7-8](../../server/services/otpService.js#L7-L8).
- `.env` (the only place real secrets live) is gitignored and has never been committed — confirmed via `git ls-files` and `git log --all -- .env` both returning nothing. `.env.example` correctly holds only placeholder values (`JWT_SECRET="change-me-to-a-long-random-string"`, etc.) — [.env.example](../../.env.example).
- The session cookie is `httpOnly`, `sameSite: 'lax'`, and `secure` is conditioned on `NODE_ENV === 'production'` — [src/app/api/session/route.ts:12-18](../../src/app/api/session/route.ts#L12-L18).
- Password-reset tickets are JWTs scoped with a `purpose` claim (`complete-registration` vs `reset-password`) so a ticket from one flow can't be replayed against the other, even though both are signed with the same secret — [server/controllers/authController.js:60, 153](../../server/controllers/authController.js#L60), verified in `authFlows.test.js`'s two cross-scope tests.

**Gap:** `JWT_SECRET` is still a placeholder-pattern value in the local `.env` (39 characters, matches a recognizable placeholder prefix) — this is already self-documented as a pre-deploy TODO in `AGENTS.md:82-83` ("`JWT_SECRET` is still the dev placeholder — generate a real random secret"), and this review confirms that TODO is still outstanding. Every session token, every registration/reset ticket, is forgeable by anyone who can guess or brute-force this specific secret. **Severity: High if deployed as-is. Effort: S** — rotate to a real random secret (`openssl rand -hex 32` or equivalent) before any real deployment; the only cost is that every existing session invalidates on rotation, which is fine pre-launch.

**Unverifiable, not confirmed either way:** the manuscript's ethics section claims *"Personal data is encrypted at rest using AES-256."* No field-level encryption exists anywhere in `prisma/schema.prisma` or the application code — `email`, `fullName`, `universityId` etc. are all plain `String` columns. If this claim is meant to describe managed-Postgres-provider disk encryption (infrastructure, not app code), that's outside what this repo can confirm or deny. As written, the application layer does not implement it. **Effort to close the gap, if application-level encryption is actually required: M** (selective field-level encryption for PII columns); **Effort to just make the claim accurate: S** (verify and document the hosting provider's at-rest encryption default, or soften the manuscript's wording).

---

## A03: Injection — Mitigated

- Every database query in `server/` goes through Prisma's query builder. The only raw-SQL calls in the entire codebase are `prisma.$queryRawUnsafe('SELECT 1')` — a hardcoded, literal health-check ping used in 16 test files' `beforeAll` blocks to check DB reachability. Confirmed via `grep -rn '\$queryRaw' server/` — zero occurrences outside tests, and the one literal that exists carries no interpolated input of any kind.
- No string-concatenated SQL exists anywhere.
- No `dangerouslySetInnerHTML`, `eval(`, or `new Function(` anywhere in `src/` — confirmed via grep across the whole frontend. User-generated content (chat messages, driver notes, rating comments, vehicle make/model) is rendered exclusively through React's default JSX text interpolation, which auto-escapes.
- File upload (`avatarController`'s `uploadAvatar`) validates the actual file bytes via magic-byte sniffing, not the client-supplied extension or MIME type, and writes to a server-generated UUID filename — a client can't control the on-disk filename to attempt path traversal or an extension-based content-type confusion — [server/controllers/userController.js:86-94](../../server/controllers/userController.js#L86-L94).

---

## A04: Insecure Design — Partially mitigated

**Mitigated — real, deliberate business-logic protections:**

- Seat-capacity race condition: match approval used to be read-then-write (two concurrent approvals could both read "room available" before either write landed, overbooking every time, not just under rare timing). Fixed with a single conditional `updateMany` inside a transaction — a trip's `filledSeats` only increments if there's still room *at that instant*, and the match only flips to `APPROVED` if that write actually happened — [server/controllers/matchController.js:306-349](../../server/controllers/matchController.js#L306-L349).
- The same transaction auto-declines every other still-`PENDING` request the instant a trip's last seat is claimed, so a passenger is never left with a request that can no longer succeed — same block, lines 322-341.
- Recurring-trip rating eligibility can't be forged: a rater can't submit an arbitrary `occurrenceDate` for a recurring match — the server checks that it already sent that specific rater a `RATING_PROMPT` for that specific occurrence before accepting the rating — [server/controllers/ratingController.js:58-72](../../server/controllers/ratingController.js#L58-L72).
- Domain-based registration whitelist (`@student.mseuf.edu.ph` / `@mseuf.edu.ph`) is enforced server-side, not just at the client form — [server/controllers/authController.js:10-17, 20-25](../../server/controllers/authController.js#L10-L17).

**Gap — a passenger's own client-computed match quality is trusted verbatim:** `POST /api/matches` takes `score`, `routeOverlap`, `scheduleAlignment`, and `preferenceMatch` directly from `req.body` and stores them on the created `Match` row with no server-side recomputation against the actual PSGA algorithm — [server/controllers/matchController.js:224, 234-248](../../server/controllers/matchController.js#L224-L248). `server/services/joinRequestService.js`'s `checkJoinEligibility` (the actual server-side gate) only checks seat capacity, duplicate requests, and trip status — never the score fields. A technically capable user could submit `score: 1.0` regardless of their real match quality. This doesn't bypass any safety constraint (seats/gender/familiar-only are still enforced independently), but it does mean the "match percentage" a host sees, and any ranking derived from it, can be fabricated by the client. **Severity: Low** (cosmetic/ranking manipulation, not an access-control bypass). **Effort: S-M** — recompute the score server-side in `matchController.create` using the same `psgaService` functions the search path already calls, and ignore the client-submitted values entirely.

**Gap, compounding A07 below:** no rate limiting or attempt throttling exists at the request level anywhere (see A07) — this is a design gap as much as a missing control, since nothing in the request-handling pipeline was ever designed to slow down repeated calls.

---

## A05: Security Misconfiguration — Partially mitigated

**Mitigated:**

- CORS is a strict origin allowlist (`CORS_ORIGIN` env var, default `http://localhost:3000`), not a wildcard, and `credentials: true` is only meaningful because of that — [server/app.js:22-26](../../server/app.js#L22-L26). Combined with the session cookie's `sameSite: 'lax'`, this also meaningfully limits classic CSRF: a cross-origin JSON POST triggers a CORS preflight the API will reject for any non-allowlisted origin, and the cookie itself isn't attached to a cross-site non-navigational request in the first place.
- The global error handler returns a generic `{ error: 'INTERNAL_ERROR' }` and logs the real error server-side only — it never leaks a stack trace or internal error message to the client — [server/app.js:50-54](../../server/app.js#L50-L54).
- Avatar upload has an explicit 5MB size limit, not the library default — [server/routes/userRoutes.js:7](../../server/routes/userRoutes.js#L7).
- `express.json()` uses Express's own sane default body-size cap (100kb) — not raised or disabled anywhere.

**Gap:** no security-headers middleware (`helmet` or equivalent) is installed anywhere — confirmed absent from `package.json`. There is no `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, or `Content-Security-Policy` set on any response. **Severity: Medium. Effort: S** — `npm install helmet` + `app.use(helmet())` is close to a one-line fix; the main work is deciding a CSP policy that doesn't break Mapbox GL/Nominatim calls, which is a short, bounded task.

**Gap (cross-referenced from A02):** the `JWT_SECRET` placeholder and the not-yet-applied `sameSite: 'none'; secure` cookie change for a split frontend/API domain deployment are both self-documented, still-outstanding pre-deploy items — [AGENTS.md:82-84](../../AGENTS.md#L82-L84).

---

## A06: Vulnerable and Outdated Components — Gap

`npm audit` was run against the current `package-lock.json` (737 total resolved packages: 318 prod, 335 dev, 111 optional). Real output:

```
# npm audit report

deepmerge-ts  <8.0.0
Severity: high
DeepmergeTS has stack exhaustion when merging recursive object graphs
fix available via `npm audit fix --force` (installs prisma@6.19.3, breaking)
  @prisma/config → prisma  [devDependency, CLI tooling only]

fast-uri  3.0.0 - 3.1.5
Severity: high
- host confusion via skipped IDN canonicalization
- SSRF via malformed IPv6 normalization
- SSRF via repeated hostname percent-decoding
- host confusion via percent-encoded scheme normalization
fix available via `npm audit fix`

js-yaml  3.0.0 - 3.15.1
Severity: high — maxTotalMergeKeys does not limit CPU use for empty merge sources
fix available via `npm audit fix`

multer  <=2.2.0
Severity: high
- DoS via crafted multipart field names
- DoS via file descriptor leak on aborted uploads
- file size limit bypass via async fileFilter race condition
- DoS via oversized array index in field names
fix available via `npm audit fix`

mysql2  <=3.23.0
Severity: high
- Auth Plugin Downgrade leaks plaintext credentials
- Unbounded zlib inflate allows decompression-bomb DoS
fix available via `npm audit fix --force` (installs prisma@6.19.3, breaking)
  prisma [CLI tooling only — this app uses @prisma/adapter-pg + PostgreSQL
  at runtime; mysql2 is a transitive dependency of the prisma CLI package,
  never imported by the running server]

next  16.0.0 - 16.3.2   ← this app runs 16.3.0
Severity: CRITICAL
- Unauthenticated Remote Code Execution on Windows-hosted servers
- Unauthenticated RCE in the Image Optimization API when AVIF files are used
fix available via `npm audit fix` (non-breaking)

nodemailer  <=9.1.0
Severity: high
- resolveContent() bypasses disableFileAccess/disableUrlAccess (legacy signature)
- IDN/Punycode domain allow-list bypass → delivery to attacker-controlled domain
- O(n²) addressparser complexity → DoS via crafted address list
- Recipient-domain validation bypass via RFC 5322 comment mis-parsing
fix available via `npm audit fix`

qs  2.2.5 - 6.15.3
Severity: moderate — array-limit bypass; DoS via attacker-controlled isBuffer
fix available via `npm audit fix`

sharp  <0.35.4
Severity: high — libheif vulnerabilities (GHSA-g89c-p67h-r497, GHSA-2jg2-4ch7-h545)
fix available via `npm audit fix`
  next → sharp  [transitive, Next's built-in image pipeline]

uuid  <11.1.1
Severity: moderate — missing buffer bounds check in v3/v5/v6
fix available via `npm audit fix --force` (installs autocannon@2.0.1, breaking)
  hyperid → autocannon  [devDependency, load-test tooling only]

14 vulnerabilities (4 moderate, 9 high, 1 critical)
```

**Assessment, not a placeholder:**

- **`next@16.3.0` is a direct production dependency** — [package.json:36](../../package.json#L36) `"next": "^16.3.0"` — and falls squarely in the vulnerable `16.0.0 - 16.3.2` range for a **critical, unauthenticated RCE**. One of the two advisories (Windows-hosted RCE) doesn't depend on any app-level usage at all. The other (Image Optimization API / AVIF) is somewhat narrowed by this app never importing `next/image` (confirmed via grep — zero usages in `src/`), but the built-in `/​_next/image` route is part of the Next.js server regardless of whether the app's own components call it, so that narrowing isn't a guarantee. **A non-breaking fix is available** (`npm audit fix` with no `--force` needed for this package specifically). This is the single highest-priority finding in this entire review: critical severity, direct production dependency, and the cheapest possible fix.
- **`multer@^2.2.0`** ([package.json:35](../../package.json#L35)) is a direct production dependency, actively used for avatar upload ([server/routes/userRoutes.js:7](../../server/routes/userRoutes.js#L7)) — the DoS advisories are real production exposure. Non-breaking fix available.
- **`nodemailer@^9.0.5`** ([package.json:38](../../package.json#L38)) is a direct production dependency (OTP delivery, [server/services/emailService.js](../../server/services/emailService.js)). This app's own usage (`transport.sendMail({from,to,subject,text})`, no attachments, no legacy `resolveContent` calls) doesn't exercise the most severe of the four listed advisories, but the domain-bypass and ReDoS-class issues still apply to the dependency as shipped. Non-breaking fix available.
- **`sharp@0.35.3`** is a transitive dependency of `next` (its image pipeline), not called directly by this app's code, but present in `node_modules` and reachable if the Image Optimization route is. Non-breaking fix available.
- **`mysql2`, `deepmerge-ts`, `js-yaml`, `qs`, `uuid`** are all transitive dependencies of either the `prisma` CLI (a devDependency — build/migration tooling, never imported by the running server, which uses `@prisma/client` + `@prisma/adapter-pg`) or `autocannon` (this session's own load-testing devDependency). Real advisories, but **not reachable by an external attacker through the running application** — confirmed via `npm ls mysql2` / `npm ls sharp` dependency-tree tracing. Lower urgency; the `--force` fixes here also come with breaking major-version bumps (`prisma@6.19.3`, `autocannon@2.0.1`) that deserve their own regression pass rather than a blind `--force`.

**No dependency audit of any kind existed before this review** — this is the first time `npm audit` has been run against this project. **Severity: Critical** (driven entirely by the Next.js RCE against a direct prod dependency). **Effort: S** for the four production-relevant packages (`npm audit fix`, no breaking changes, immediately followed by the full Jest suite + a manual smoke test of registration/search/chat to confirm nothing regressed); **Effort: M** for the dev-tooling-only packages if their breaking major-version bumps are pursued at all before the deadline — reasonable to defer.

---

## A07: Identification and Authentication Failures — Gap

**Mitigated:**

- OTP verification has both an expiry (`OTP_TTL_MINUTES = 10`) and an attempt cap (`MAX_ATTEMPTS = 5`, returning `429 TOO_MANY_ATTEMPTS` once exhausted, checked *before* running the bcrypt compare) — [server/services/otpService.js:4-5](../../server/services/otpService.js#L4-L5), enforced identically for both registration and password-reset OTPs — [server/controllers/authController.js:48-56, 141-149](../../server/controllers/authController.js#L48-L56).
- `requestPasswordReset` deliberately returns an identical generic response (`OTP_SENT_IF_ACCOUNT_EXISTS`) regardless of whether the email exists, so the forgot-password flow doesn't leak account existence — [server/controllers/authController.js:108-118](../../server/controllers/authController.js#L108-L118), and a test asserts no `EmailVerification` row is even created for an unknown email.
- Full auth-controller test coverage now exists (`server/__tests__/authFlows.test.js`, 24 tests) covering registration, login, OTP attempt-cap/expiry, and the full forgot/reset-password flow — this closed what was previously a zero-coverage gap on the most security-sensitive part of the app. Full suite: 300/300 passing as of this review.

**Gap — no brute-force protection on login at all:** `login` (`server/controllers/authController.js:180-190`) runs a `bcrypt.compare` on every single request with no attempt counter, no lockout, no delay, and — confirmed by grep across the entire `server/` tree — **there is no rate-limiting library or custom throttling logic anywhere in this codebase** (`express-rate-limit` and equivalents are absent from `package.json`; the only `429` responses that exist anywhere are the OTP attempt-cap ones, which protect a specific issued OTP, not the login endpoint or the OTP-request endpoints themselves). An attacker can attempt unlimited password guesses against any account, or spam `/register/start` / `/forgot-password` to trigger unlimited OTP emails, limited only by bcrypt's compute cost. **Severity: High** — this is exactly the "brute-force risk on login/OTP endpoints" the review was asked to confirm, and it's real and unmitigated. **Effort: M** — `express-rate-limit` (or a small custom per-IP+per-account counter) on `/api/auth/verify`, `/api/auth/register/*`, and `/api/auth/forgot-password`/`/verify-reset-otp`; the work is mostly picking sane limits and windows and re-testing `authFlows.test.js` doesn't trip them under normal test load.

**Gap — inconsistent account-enumeration protection:** `login` returns **404 `ACCOUNT_NOT_FOUND`** for an unknown email but **401 `INVALID_CREDENTIALS`** for a wrong password — [server/controllers/authController.js:183, 186](../../server/controllers/authController.js#L183-L186) — a status-code oracle for account existence, sitting right next to `requestPasswordReset`'s deliberately generic response a few functions earlier. **Severity: Low-Medium. Effort: S** — return the same 401/generic response either way, matching the pattern already established elsewhere in this same file.

**Gap — no minimum password length or complexity is enforced at registration:** `completeRegistration` hashes and stores `password` with zero validation on it — [server/controllers/authController.js:65-89](../../server/controllers/authController.js#L65-L89) — while `resetPassword`, a few functions later in the *same file*, enforces `password.length < 8` → `400 PASSWORD_TOO_SHORT` — [server/controllers/authController.js:170-171](../../server/controllers/authController.js#L170-L171). The only length enforcement for registration is a client-side HTML `minLength={8}` attribute — [src/app/register/page.tsx:279](../../src/app/register/page.tsx#L279) — which is trivially bypassed by calling the API directly. A brand-new account can be created with a 1-character password. **Severity: Medium. Effort: S** — copy the exact check `resetPassword` already has into `completeRegistration`.

**Gap — no server-side session revocation:** sessions are stateless JWTs with a 7-day expiry; there is no blacklist/revocation store, so logging out (`DELETE /api/session`, [src/app/api/session/route.ts:22-26](../../src/app/api/session/route.ts#L22-L26)) only clears the browser's cookie — a copied/stolen token remains valid for up to 7 days regardless. **Severity: Low** (bounded window, and this is a common, accepted tradeoff for stateless-JWT designs at this scale). **Effort: L** if a real fix (revocation list or short-lived-access + refresh-token rotation) is wanted — reasonable to explicitly accept as a known tradeoff rather than fix before Sept 30.

---

## A08: Software and Data Integrity Failures — Partially mitigated

**Mitigated:**

- `package-lock.json` is committed and tracked (confirmed via `git ls-files`), so installs are reproducible and pinned rather than resolving to whatever a bare `npm install` picks up at build time.
- No `eval`, dynamic `require()` of user-influenced paths, or unsafe deserialization anywhere in `server/` or `src/` — all request bodies are parsed as JSON via `express.json()` and consumed as plain objects, never `eval`'d or passed to a template-compilation step.
- Prisma migrations are tracked in version control (`prisma/migrations/`), including this session's own `20260915153542_add_message_model`, giving an auditable, ordered history of every schema change rather than ad hoc, undocumented `db push`-only changes.

**Gap (cross-referenced from A04):** a passenger's client-computed match `score`/`routeOverlap`/`scheduleAlignment`/`preferenceMatch` is accepted and persisted as-is by `POST /api/matches`, with no server-side recomputation — see A04 above for full detail and citation. This is fundamentally a data-integrity failure (trusting client-supplied data for a value the system itself is supposed to compute), so it's listed here too rather than only under Insecure Design. Same severity/effort assessment as A04.

**Gap:** there is no CI/CD pipeline at all — confirmed via `ls .github/workflows` (does not exist). Nothing automatically runs the Jest suite, `npm audit`, or a build check before code lands on `main`; every verification in this project (including this review) has been run manually, on-demand. **Severity: Low** (a process gap, not a direct exploitable vulnerability) **but it raises the practical risk of every other finding in this document going unnoticed on the next change. Effort: M** — a single GitHub Actions workflow running `npm test` and `npm audit --audit-level=high` on every push/PR would catch both regressions and newly-disclosed CVEs going forward.

---

## A09: Security Logging and Monitoring Failures — Gap

**Confirmed absent, not assumed:**

- No structured logging library exists anywhere in the dependency tree — `winston`, `pino`, `morgan`, and `bunyan` are all absent from `package.json`.
- `authController.js` — the single most security-sensitive file in the app — contains **zero** `console.log`/`console.warn`/`console.error` calls. A failed login, a failed OTP attempt, an exhausted OTP attempt cap, or a rejected registration domain produces an HTTP response and nothing else — no server-side trace of the event exists anywhere.
- Across the rest of `server/`, logging is six scattered `console.*` calls total ([server/scripts/loadTest.js](../../server/scripts/loadTest.js), [server/controllers/tripController.js](../../server/controllers/tripController.js) — a route-rejection warning, [server/services/geocodingService.js](../../server/services/geocodingService.js) — upstream API failures, [server/server.js](../../server/server.js) — the cron reminder job's own failures, [server/app.js:52](../../server/app.js#L52) — the generic 500 handler, [server/services/emailService.js](../../server/services/emailService.js) — the dev-only OTP fallback). None of these constitute security-event logging; they're operational/debug traces.
- There is no admin panel or any other surface where the data that *does* exist (e.g. the `EmailVerification.attempts` counter) could actually be reviewed by a human — confirmed absent in earlier sessions' audits and unchanged here.
- No alerting, no anomaly detection, no way to answer "is someone currently brute-forcing an account" other than reading raw Postgres rows by hand.

**Severity: Medium-High** — this is what makes the A07 brute-force gap worse than it already is: even if an attack were happening right now against a real account, nothing in this system would surface it. **Effort: M** — introduce a logging library (even a lightweight one) and, at minimum, log every authentication failure, every exhausted OTP attempt cap, and every 403 from an ownership check, with enough context (IP, user id where known, endpoint) to reconstruct an incident after the fact. A full monitoring/alerting pipeline (shipping logs to an external service, dashboards, paging) is a larger, separate effort reasonably deferred past Sept 30; structured logging of the events themselves is not.

---

## A10: Server-Side Request Forgery — Mitigated

- The only outbound server-side HTTP calls in the entire codebase are two hardcoded requests to `nominatim.openstreetmap.org` (forward and reverse geocoding) — confirmed via `grep -rn 'fetch(' server/` excluding tests, which surfaces exactly these two call sites plus `loadTest.js`'s own benchmark traffic to the local server. User input (`query`, `lat`, `lng`) is only ever interpolated into the **query string** of a fixed URL — [server/services/geocodingService.js:5, 27](../../server/services/geocodingService.js#L5-L27) — never into the hostname, scheme, or path. There is no code path anywhere that takes a user-supplied URL and fetches it server-side.
- `lat`/`lng` passed into `reverseGeocode` are numeric-validated (finite, within ±90/±180) before this function is ever called — [server/controllers/tripController.js:363-368](../../server/controllers/tripController.js#L363-L368) — though this validation is defense-in-depth rather than the primary SSRF control, since the destination host is fixed regardless.
- Mapbox Directions calls (route preview, distance/duration at trip creation) happen **client-side**, browser-to-Mapbox directly — the server never proxies or re-fetches route geometry, so there's no server-side attack surface there at all.
- No webhook, avatar-from-URL, or other "fetch a URL the user gave us" feature exists anywhere in the app.

This is a small, low-surface-area app for SSRF purposes — the mitigation here is largely "no SSRF-prone feature exists," which is itself a valid and sufficient state, not a weaker claim than a deliberately engineered defense.

---

## Priorities if there's time before Sept 30

Roughly in order of impact-per-effort, all individually small (S) except where noted:

1. **`npm audit fix`** (A06) — one command fixes the critical Next.js RCE plus the other three production-relevant advisories (multer, nodemailer, sharp) with no breaking changes. Re-run the full Jest suite and do a manual smoke test afterward. Highest severity, lowest cost in this entire review.
2. **Rotate `JWT_SECRET`** to a real random value (A02) before any real deployment — `AGENTS.md` already flags this as outstanding; this review confirms it still is.
3. **Enforce a minimum password length at registration** (A07) — copy the check `resetPassword` already has, four lines.
4. **Fix the login enumeration inconsistency** (A07) — make the unknown-email case return the same response shape as the wrong-password case.
5. **Add `helmet()`** (A05) — near-zero cost, closes the missing-security-headers gap.
6. **Rate limiting on `/api/auth/*`** (A07, M effort) — the single highest-value remaining item, but genuinely more work than the above (picking limits, retesting); pair with #7 if time allows, since logging is what would tell you the rate limit is actually needed/working.
7. **Minimal security-event logging** (A09, M effort) — at least log auth failures and exhausted OTP attempts with enough context to reconstruct an incident.

Everything else in this document (server-side score recomputation, CI/CD, session revocation, dev-tooling-only CVEs) is real but lower-severity or larger-effort, and reasonable to explicitly defer past the 30th rather than rush.
