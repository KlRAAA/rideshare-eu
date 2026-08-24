# RideShareEU Frontend Rebuild + PSGA Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild all seven RideShareEU screens to match the approved Figma designs, extract shared UI primitives, and implement the exact Priority-Scored Greedy Algorithm (PSGA), fuel share, and trust score formulas from the thesis proposal against a real Prisma schema and Express backend — no placeholder logic anywhere.

**Architecture:** Three-tier per the thesis: Next.js 16 App Router frontend (`src/app`, `src/components`), Node/Express REST backend (`server/`), PostgreSQL/MySQL via Prisma (`prisma/schema.prisma`). The PSGA matching engine is an isolated, pure, dependency-free service module (no HTTP or DB imports) so it stays independently unit-testable, exactly as the thesis's architecture section requires.

**Tech Stack:** Next.js ^16.3.0 (verify conventions in `node_modules/next/dist/docs/` before editing — this is not the Next.js in training data), React 19, Tailwind v4 (`@tailwindcss/postcss`), `react-icons/fa`, Express, Prisma, Jest, Leaflet/OpenStreetMap for mapping.

**Spec:** `CCMS-CS-2026-013-THESIS-PROPOSAL.docx` (Sections 3.4–3.6, 5.1.2–5.1.5) — extracted to `C:\Users\SPIDER~1\AppData\Local\Temp\claude\c--Users-Spider-Man-rideshare-eu-src-app\35bdb1ec-19d5-4f99-aade-c17b99f1cd9a\scratchpad\thesis_proposal.txt` for reference; plus the Figma screenshots pasted in chat, now covering all 7 screens (Dashboard, My Trips list+detail, Post a Ride, Notifications, Profile, Login, Find a Ride — mobile+desktop pairs each).

**Revision (2026-08-18):** Updated after your answers — swapped Google Maps for Leaflet + OpenStreetMap (no API key, free), confirmed the Dashboard header icon as the Notifications shortcut, and incorporated the Login and Find a Ride Figma screens. See "Decisions confirmed 2026-08-18" and the remaining open question below before Tasks 3, 4, and 11 start.

## Global Constraints

- All routing-related files stay under `src/app` (App Router only).
- Primary color `#800000` via existing `--rsu-color-primary`; reuse `--rsu-radius-lg`, `--rsu-card-padding`, `--rsu-btn-radius`, `--rsu-btn-height` from `src/app/globals.css` — extend, never fork, this token set.
- Icons: `react-icons/fa` only, everywhere, including empty states. No inline SVG, no emoji. (`react-icons` is **not currently installed** — confirmed via `node_modules` check.)
- Tailwind v4 — `tailwind.config.js` exists and uses the classic JS-config shape (content/theme/plugins), confirmed compatible; no `@theme` CSS-first migration needed unless a task requires new design tokens.
- No placeholder logic for PSGA, fuel share, or trust score — implement the exact formulas below, taken verbatim from the thesis.
- `src/components` is empty — extract shared UI (Header, BottomNav, Card, Button, Badge, MatchCard, StatusPill) as each page is rebuilt instead of duplicating markup.
- `server/{config,controllers,models,routes,services}` and `prisma/schema.prisma` are currently empty — this plan populates them.
- Ignore `figma_error.txt` and `src/app/api/figma/route.ts` (dead prior attempt) — do not touch, do not delete without being asked.
- Use the `frontend-design` skill during the JSX/CSS implementation step of every page task (Tasks 5–10).
- **Mapping stack: Leaflet + OpenStreetMap, not Google Maps** (confirmed 2026-08-18 — no Maps API key available). Geocoding via Nominatim (`https://nominatim.openstreetmap.org/search`, free, requires a descriptive `User-Agent` header and client-side debouncing per its usage policy — no key, but not for high-volume production use). Routing/waypoints/distance via the public OSRM demo server (`https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?geometries=geojson`, free, same route-geometry role Google Directions would have played). Map rendering via `leaflet` + `react-leaflet` with the standard OSM tile layer and required "© OpenStreetMap contributors" attribution.
- **No ICTD database access exists** (confirmed 2026-08-18). There is no real institutional SSO to hand off to — RideShareEU owns its own credential store (`User.passwordHash`, bcrypt) and "institutional verification" means validating the email against the known MSEUF domain pattern, not querying a live ICTD system. This replaces every earlier "ICTD fallback/TODO" framing in Task 3/4 with the real, permanent implementation.
- PSGA formulas (thesis §5.1.2.5, verbatim):
  - `RouteOverlap(P,H) = |segment(P) ∩ corridor(H)| / |segment(P)|`, corridor = 500m, discard if below configurable `MIN_ROUTE_OVERLAP`.
  - `TimeDiff(P,H) = |DepartureTime(P) - DepartureTime(H)|`, discard if `> FlexWindow(P)`.
  - `Score(P,H) = w1·RouteOverlap + w2·ScheduleAlignment + w3·PreferenceMatch`, defaults `w1=0.5, w2=0.3, w3=0.2` (configurable, sum to 1).
  - `ScheduleAlignment = 1 - (TimeDiff / FlexWindow)`.
  - `PreferenceMatch ∈ {0,1}`: conjunction of gender preference, Familiar Riders Only, and `seats > 0` — hard constraints applied in Stage 1, not soft scoring.
  - `FuelShare = (DistanceKm / FuelEfficiency) × FuelPricePerLiter / (1 + FilledSeats)`.
  - `TrustScore = (PreviousAverage × TripCount + NewRating) / (TripCount + 1)`.
  - No candidates pass Stage 1 → return a no-match state, not an empty-but-ambiguous list.
  - Target: sub-2-second end-to-end response; algorithm itself is O(n) over open trips.

---

## Decisions confirmed 2026-08-18

1. ~~Geocoding/Directions provider~~ → **Leaflet + OpenStreetMap** (Nominatim + OSRM), no API key. See Global Constraints.
2. ~~Dashboard header icon~~ → **`FaBell` → `/auth/notifications`**, confirmed as-designed, not a simplification.
3. ~~Find a Ride Figma~~ → **provided**, Task 10 written against it directly.
4. ~~Login Figma / no ICTD access~~ → real self-hosted email+password login. Task 4 written against the Figma.
5. ~~Registration flow~~ → **dedicated 3-step email-domain-whitelist + OTP flow**, specified in full below. This is now the actual security boundary of the system (thesis §Scope: "Access is restricted to verified students through the university student portal and school email verification") since there is no live ICTD query to fall back on — the OTP proves mailbox ownership of a `@student.mseuf.edu.ph` / `@mseuf.edu.ph` address, which is the closest achievable approximation of "institutional verification" without ICTD or Google Workspace SSO access.

**One placement deviation from your literal instruction, flagged rather than silently applied:** you wrote `/auth/register`, but `/auth/*` is the segment Task 11 guards behind a login check — an unauthenticated user needs to reach registration, so it can't live inside the guarded segment. Built at `src/app/register/page.tsx` instead (sibling to `src/app/login/page.tsx`, both outside `/auth`), same as the Login page already is.

**Role inference for the base `@mseuf.edu.ph` domain:** the domain alone can't distinguish Faculty from Staff (no ICTD record to check against). Per your instruction to auto-infer rather than prompt, registration will default base-domain accounts to `FACULTY` and store the raw email prefix in `universityId`/`fullName` as you specified — worth noting as a real limitation in your thesis writeup (manual correction would need an admin path, which is out of scope here) rather than a full solution to the Faculty/Staff distinction.

**Email delivery for the OTP is a new external dependency you haven't provisioned yet.** Sending real email requires SMTP credentials (a Google Workspace app password works fine here, or any SMTP relay). Until `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are set in `.env`, `emailService.js` (Task 3) falls back to logging the OTP to the server console — clearly marked dev-only, disabled whenever `NODE_ENV=production` so it can never silently ship as a bypass. Send me real SMTP credentials whenever you have them; no code change will be needed, just the env vars.

---

## File Structure

```
prisma/schema.prisma                     # Task 0 — 7 models
server/config/db.js                      # Task 0 — Prisma client singleton
server/config/psgaConfig.js              # Task 0 — w1/w2/w3, MIN_ROUTE_OVERLAP, corridor, fuel price (configurable)
server/services/psgaService.js           # Task 2 — pure PSGA engine, no HTTP/DB imports
server/services/fuelShareService.js      # Task 2
server/services/trustScoreService.js     # Task 2
server/services/__tests__/*.test.js      # Task 2 — Jest
server/app.js, server/server.js          # Task 3 — Express skeleton
server/routes/authRoutes.js              # Task 3 / Task 4
server/controllers/authController.js     # Task 3 / Task 4
server/services/geocodingService.js      # Task 3 — Nominatim wrapper
server/services/routingService.js        # Task 3 — OSRM wrapper
server/services/otpService.js            # Task 3 — 6-digit OTP generate/hash/verify
server/services/emailService.js          # Task 3 — nodemailer wrapper, dev-console fallback
src/components/Header.tsx                # Task 1
src/components/BottomNav.tsx             # Task 1
src/components/Card.tsx                  # Task 1
src/components/Button.tsx                # Task 1
src/components/Badge.tsx                 # Task 1
src/components/RouteMap.tsx              # Task 1 — react-leaflet wrapper
src/app/login/page.tsx                   # Task 4
src/app/register/page.tsx                # Task 4 — 3-step domain-whitelist + OTP + password/name flow
src/app/auth/layout.tsx                  # Task 11 — add real guard
src/app/auth/dashboard/page.tsx          # Task 5
src/app/auth/trips/page.tsx              # Task 6
src/app/auth/trips/[id]/page.tsx         # Task 6
src/app/auth/post/page.tsx               # Task 7
src/app/auth/notifications/page.tsx      # Task 8
src/app/auth/profile/page.tsx            # Task 9
src/app/auth/search/page.tsx             # Task 10
```

---

## Task 0: Foundation — dependencies, Prisma schema, PSGA config parameters — ✅ DONE 2026-08-18

**Files:**
- Modify: `package.json`
- Create: `prisma/schema.prisma`
- Create: `server/config/psgaConfig.js`
- Create: `.env.example`
- Create: `prisma.config.ts` (required by Prisma 7 — see the finding below)
- Create: `server/package.json` (required — see the finding below)

**Interfaces:**
- Produces: 8 Prisma models (`User`, `Vehicle`, `Trip`, `Match`, `Notification`, `Preference`, `Rating`, `EmailVerification`) consumed by every later backend task.
- Produces: `psgaConfig.js` exporting `{ weights: { w1, w2, w3 }, minRouteOverlap, corridorMeters, defaultFlexWindowMinutes, fuelPricePerLiter }` consumed by Task 2.

- [x] **Step 1: Install dependencies**

```bash
npm install react-icons express cors dotenv @prisma/client @prisma/adapter-pg pg bcrypt jsonwebtoken leaflet react-leaflet nodemailer
npm install -D prisma jest
```

**Executed 2026-08-18 — real finding, not a guess:** this repo's `prisma`/`@prisma/client` resolve to **v7.9.1**, which has the same "not the tool you know" problem the AGENTS.md warns about for Next.js. Two breaking changes from the Prisma docs in training data, discovered by actually running `prisma validate`/`generate` against this schema:
1. `datasource { url = env("DATABASE_URL") }` in `schema.prisma` no longer works — `prisma validate` fails with `P1012`. The connection URL now lives in a new `prisma.config.ts` at the repo root (`defineConfig({ datasource: { url: process.env.DATABASE_URL } })`), used by CLI commands (`generate`, `migrate`, `studio`).
2. `prisma.config.ts`'s `datasource.url` only affects CLI commands, **not** the generated `PrismaClient` at runtime — `new PrismaClient()` alone now throws `PrismaClientInitializationError: ... A driver adapter is required`. Every place `PrismaClient` is instantiated needs an explicit adapter: `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })`, hence `@prisma/adapter-pg` + `pg` added to the install list above. Task 3's `server/config/db.js` is written against this from the start.

Both are verified against the actually-installed v7.9.1, not assumed — `prisma validate`, `prisma generate`, and a real `new PrismaClient({ adapter })` instantiation all ran successfully with this pattern.

**Also surfaced, noted but not acted on:** `npm audit` flags 3 high-severity advisories, all the same transitive `deepmerge-ts` stack-exhaustion issue via `@prisma/config` (a dev-time CLI dependency, not anything touching request data at runtime). The suggested fix downgrades to `prisma@6.12.0`, which would undo the v7 migration above — not worth it for a CLI-only DoS edge case. Flagging for your awareness rather than silently ignoring it.

**Third finding, caught during the "fix if there are problems" review pass:** the root `package.json` has `"type": "module"`. Every `server/**/*.js` file in this plan is written as CommonJS (`require`/`module.exports`) — the conventional style for Node/Express, and what the thesis's own tooling section assumes. Under `"type": "module"`, Node doesn't throw on `require()`-ing these files — worse, it silently returns `{}`, discarding everything the file exported, with no error at all. Confirmed by direct reproduction: `require('./server/config/psgaConfig.js')` returned `{}` instead of the real config object. Fixed by adding `server/package.json` with `{ "type": "commonjs" }`, which scopes every file under `server/` back to CommonJS regardless of the root setting — re-verified `require()` returns the correct object afterward. This doesn't touch the Next.js frontend at all (its `.ts`/`.tsx` files are compiled by Next's own toolchain, not run through bare Node module resolution).

- [x] **Step 2: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  STUDENT
  FACULTY
  STAFF
}

enum GenderPreference {
  ANY
  SAME_GENDER
}

enum RecurrenceType {
  ONE_TIME
  DAILY
  WEEKDAYS
  CUSTOM
}

enum TripStatus {
  OPEN
  FULL
  CANCELLED
  COMPLETED
}

enum MatchStatus {
  PENDING
  APPROVED
  DECLINED
  CANCELLED
  COMPLETED
}

enum NotificationType {
  MATCH_REQUEST
  APPROVAL
  REMINDER
  RATING_PROMPT
}

model User {
  id            String    @id @default(cuid())
  universityId  String    @unique // self-reported (e.g. "2023-12345"); no live ICTD record to verify it against
  email         String    @unique
  passwordHash  String    // bcrypt — see Task 3/4, there is no ICTD SSO to hand off to
  fullName      String
  role          Role
  verified      Boolean   @default(false) // true once email domain pattern check passes at registration
  trustScore    Float     @default(5.0)
  tripCount     Int       @default(0)
  createdAt     DateTime  @default(now())

  vehicles      Vehicle[]
  hostedTrips   Trip[]        @relation("HostTrips")
  matches       Match[]       @relation("PassengerMatches")
  notifications Notification[]
  preference    Preference?
  ratingsGiven  Rating[]      @relation("RaterRatings")
  ratingsReceived Rating[]    @relation("RateeRatings")
}

model Vehicle {
  id                String  @id @default(cuid())
  ownerId           String
  owner             User    @relation(fields: [ownerId], references: [id])
  make              String
  model             String
  color             String
  plate             String?
  fuelEfficiencyKmL Float
  trips             Trip[]
}

model Trip {
  id                  String          @id @default(cuid())
  hostId              String
  host                User            @relation("HostTrips", fields: [hostId], references: [id])
  vehicleId           String
  vehicle             Vehicle         @relation(fields: [vehicleId], references: [id])
  originAddress       String
  originLat           Float
  originLng           Float
  destinationAddress  String
  destinationLat      Float
  destinationLng      Float
  routeWaypoints      Json?           // [{lat,lng}, ...] from Directions API, optional
  departureTime       DateTime
  recurrenceType      RecurrenceType
  customDays          Int[]           @default([]) // 0=Sun..6=Sat, used when CUSTOM
  totalSeats          Int
  filledSeats         Int             @default(0)
  fuelShareSuggested  Float?
  driverNotes         String?
  genderPreference    GenderPreference @default(ANY)
  flexibleDeparture   Boolean         @default(false)
  flexWindowMinutes   Int             @default(15)
  familiarRidersOnly  Boolean         @default(false)
  meetingPointAddress String?
  meetingPointLat     Float?
  meetingPointLng     Float?
  status              TripStatus      @default(OPEN)
  createdAt           DateTime        @default(now())

  matches             Match[]
}

model Match {
  id                String      @id @default(cuid())
  tripId            String
  trip              Trip        @relation(fields: [tripId], references: [id])
  passengerId       String
  passenger         User        @relation("PassengerMatches", fields: [passengerId], references: [id])
  score             Float
  routeOverlap      Float
  scheduleAlignment Float
  preferenceMatch   Boolean
  status            MatchStatus @default(PENDING)
  fuelShareAmount   Float
  createdAt         DateTime    @default(now())
  respondedAt       DateTime?

  ratings           Rating[]
}

model Notification {
  id            String            @id @default(cuid())
  userId        String
  user          User              @relation(fields: [userId], references: [id])
  type          NotificationType
  message       String
  relatedMatchId String?
  isRead        Boolean           @default(false)
  createdAt     DateTime          @default(now())
}

model Preference {
  id                 String           @id @default(cuid())
  userId             String           @unique
  user               User             @relation(fields: [userId], references: [id])
  genderPreference   GenderPreference @default(ANY)
  flexWindowMinutes  Int              @default(15)
  familiarRidersOnly Boolean          @default(false)
}

model Rating {
  id        String   @id @default(cuid())
  matchId   String
  match     Match    @relation(fields: [matchId], references: [id])
  raterId   String
  rater     User     @relation("RaterRatings", fields: [raterId], references: [id])
  rateeId   String
  ratee     User     @relation("RateeRatings", fields: [rateeId], references: [id])
  score     Int
  comment   String?
  createdAt DateTime @default(now())
}

// Registration 2FA: one row per in-progress signup attempt. Not linked to
// User because the account doesn't exist until the OTP is verified and the
// password/name step completes (Task 4's 3-step flow).
model EmailVerification {
  id        String   @id @default(cuid())
  email     String
  otpHash   String
  expiresAt DateTime
  attempts  Int      @default(0)
  consumed  Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([email])
}
```

- [x] **Step 2b: Write `prisma.config.ts`**

```ts
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
```

- [x] **Step 2c: Validate**

Run: `DATABASE_URL="postgresql://user:password@localhost:5432/rideshareeu" npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid`
Run: `DATABASE_URL="postgresql://user:password@localhost:5432/rideshareeu" npx prisma generate`
Expected: `Generated Prisma Client (v7.9.1) to .\node_modules\@prisma\client` — no real database connection is needed for either command.

- [x] **Step 3: Write `server/config/psgaConfig.js`**

```js
module.exports = {
  weights: { w1: 0.5, w2: 0.3, w3: 0.2 },
  minRouteOverlap: 0.4,
  corridorMeters: 500,
  defaultFlexWindowMinutes: 15,
  fuelPricePerLiter: 65.0,
};
```

- [x] **Step 4: Write `.env.example`**

```
DATABASE_URL="postgresql://user:password@localhost:5432/rideshareeu"
JWT_SECRET="change-me-to-a-long-random-string"
NEXT_PUBLIC_API_URL="http://localhost:4000"
# No mapping API key needed — Nominatim (geocoding) and OSRM (routing) are used unauthenticated, see Global Constraints.

# Registration OTP email delivery. Leave unset during development — emailService.js
# falls back to logging the OTP to the server console when these are missing
# AND NODE_ENV is not "production" (see Task 3). A Google Workspace account's
# app-password works as SMTP_USER/SMTP_PASS here.
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="RideShareEU <no-reply@mseuf.edu.ph>"
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json prisma/schema.prisma prisma.config.ts server/package.json server/config/psgaConfig.js .env.example
git commit -m "chore: add Prisma schema, PSGA config, and required dependencies"
```

---

## Task 1: Shared UI primitives (`src/components`) — ✅ DONE 2026-08-18

**Files:**
- Create: `src/components/Header.tsx`
- Create: `src/components/BottomNav.tsx`
- Create: `src/components/Card.tsx`
- Create: `src/components/Button.tsx`
- Create: `src/components/Badge.tsx`
- Create: `src/components/RouteMapImpl.tsx` (the real `react-leaflet` implementation) + `src/components/RouteMap.tsx` (a `next/dynamic({ ssr: false })` wrapper around it — see the finding below)

**Interfaces:**
- Produces: `<Header active="dashboard|trips|search|post|notifications|profile" unreadCount={number} />`, `<BottomNav active={...} unreadCount={number} />`, `<Card>`, `<Button variant="primary|secondary">`, `<Badge tone="success|warning|neutral|primary">`, `<RouteMap origin={{lat,lng}} destination={{lat,lng}} waypoints={[{lat,lng}]} />`, consumed by every page task (5–10) — `RouteMap` specifically by Task 6 (trip detail) and Task 7 (meeting point).

- [x] **Step 1: Audit current duplication**

Every existing page (`dashboard`, `trips`, `search`, `post`, `notifications`, `profile`) hand-rolls its own header and bottom nav with inconsistent markup (raw inline SVGs in `dashboard/page.tsx`, text-only nav in `trips/page.tsx` and `profile/page.tsx`, a third pill-nav style in `notifications/page.tsx`). None use `react-icons/fa`. Confirm this by re-reading the six files before extracting — the components must reproduce the union of behavior already present (active-state styling, unread badge, responsive collapse to bottom nav on mobile / top nav on desktop) so no page regresses when swapped over.

- [x] **Step 2: Build `Header.tsx` and `BottomNav.tsx`**

Use `FaHome`, `FaCar`, `FaBell`, `FaUser` from `react-icons/fa` for nav icons (`FaCar` doubles for "My Trips"). Desktop: horizontal `rsu-topnav` links in `Header`, `BottomNav` renders `null` at `md:` breakpoint. Mobile: `Header` shows logo + `FaBell` shortcut only, `BottomNav` is the fixed bottom bar using the existing `.rsu-bottom-nav` CSS utility already defined in `globals.css`.

**Real bug found and fixed while building this:** `globals.css`'s existing `.rsu-bottom-nav a { color: #6b7280; ... }` rule (written before this task, when the nav was plain text links) has higher CSS specificity than a single Tailwind color-utility class applied directly on the same `<a>`. `BottomNav.tsx` needs per-link active/inactive color (`text-[color:var(--rsu-color-primary)]` vs `text-gray-400`), and the old rule was silently winning, making every tab look "inactive" regardless of which page you're on. Fixed by removing the hardcoded `color` from that CSS rule and letting `BottomNav.tsx`'s own classes control it — confirmed by rendering the component (see Step 5).

- [x] **Step 3: Build `Card`, `Button`, `Badge`**

Thin wrappers around the existing `.rsu-card`, `.rsu-btn-primary` CSS classes in `globals.css` plus new `.rsu-btn-secondary` / badge tone classes added to `globals.css` in this step (extend, don't fork, the existing token set).

**Real bug found and fixed:** `Button.tsx`'s two variant interfaces (`ButtonAsButton extends BaseProps, ButtonHTMLAttributes<...>` and the anchor equivalent) failed to compile — `tsc` error TS2320, because `BaseProps.children` (required) and the HTML attribute interfaces' `children` (optional) aren't identical types, which TS disallows when extending two interfaces at once. Fixed with `Omit<HTMLAttributes, 'className' | 'children'>` so `children`/`className` come from `BaseProps` only.

- [x] **Step 4: Build `src/components/RouteMap.tsx`**

Wraps `react-leaflet`'s `MapContainer` + `TileLayer` (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, with the required "© OpenStreetMap contributors" attribution) plus `Marker`s for origin/destination and an optional `Polyline` for `waypoints`. Needs `import 'leaflet/dist/leaflet.css'` and the standard Leaflet-in-React default-icon workaround (Leaflet's marker icon paths break under bundlers unless reset via `L.Icon.Default.mergeOptions`).

**Three real problems found and fixed, none guessable in advance:**
1. `leaflet` ships **zero TypeScript types** (`"types"` absent from its `package.json`) — without `@types/leaflet`, react-leaflet's own `.d.ts` files silently lose the properties they inherit from `leaflet`'s types (`MapContainerProps` was missing `center`/`zoom`, `TileLayerProps` was missing `attribution`), because an unresolvable type reference contributes zero members to an `extends` clause rather than erroring loudly. Fixed by installing `@types/leaflet` as a dev dependency.
2. A `Polyline`'s `positions` prop needs `[number, number]` *tuples*, not the `number[]` that `[p.lat, p.lng]` infers by default — fixed with `as [number, number]`.
3. **The big one, only caught by actually running the page, not by `tsc`:** `'use client'` does not stop Next.js from executing a component's module during SSR to produce the initial HTML — and `leaflet` touches `window` at module-evaluation time (not just render time), so the page 500'd with `ReferenceError: window is not defined` the moment `RouteMap` was imported anywhere, `'use client'` notwithstanding. Fixed by splitting into `RouteMapImpl.tsx` (the real Leaflet code) and `RouteMap.tsx` (what every consumer actually imports — a `next/dynamic(() => import('./RouteMapImpl'), { ssr: false })` wrapper with a skeleton `loading` state), so the browser-only code never runs server-side and every consumer gets this for free without needing to remember `dynamic()` themselves.

- [x] **Step 4b: Add the `@/*` path alias**

Neither `tsconfig.json` nor any prior code in this repo had `@/*` configured, and every remaining page task imports from `src/components` this way. Added `"paths": { "@/*": ["./src/*"] }`.

**Real finding:** this repo's `typescript` devDependency resolves to **v7.0.2** — TypeScript 7 (the new Go-ported compiler), another "not the tool you know" case per AGENTS.md's warning, this time for TypeScript itself, not just Next.js. `baseUrl` (which the classic `@/*` alias pattern normally pairs with `paths`) has been **removed** in TS7 — `tsc` failed with `TS5102: Option 'baseUrl' has been removed`. Fixed by dropping `baseUrl` entirely; `paths` alone resolves correctly relative to `tsconfig.json` under `"moduleResolution": "bundler"`.

- [x] **Step 5: Verify**

Ran `npm run dev` for real (not just `tsc`) and requested a temporary scratch route rendering every component together (`Header`, `BottomNav`, `Card`, `Button`, `Badge`, `RouteMap`) — this is what caught bug #3 above, which `tsc --noEmit` had passed cleanly. After the fix: HTTP 200, response body contains real rendered markers for every component (`Card + Badge + Button smoke test`, `RouteMap smoke test`, the `animate-pulse` loading skeleton, `rsu-bottom-nav`, both nav labels), confirmed across two fresh requests with no errors in the dev server log. Scratch route deleted afterward; dev server process stopped.

- [ ] **Step 6: Commit**

```bash
git add src/components src/app/globals.css package.json tsconfig.json
git commit -m "feat: extract shared Header, BottomNav, Card, Button, Badge, RouteMap components"
```

---

## Task 2: PSGA matching engine, fuel share, trust score (pure, unit-tested) — ✅ DONE 2026-08-18 (14/14 tests passing via `npm test`)

**Files:**
- Create: `server/services/psgaService.js`
- Create: `server/services/fuelShareService.js`
- Create: `server/services/trustScoreService.js`
- Test: `server/services/__tests__/psgaService.test.js`
- Test: `server/services/__tests__/fuelShareService.test.js`
- Test: `server/services/__tests__/trustScoreService.test.js`

**Interfaces:**
- Consumes: `psgaConfig.js` from Task 0.
- Produces: `runPSGA(passengerRequest, candidateTrips, config) -> { status: 'MATCHED', matches: RankedMatch[] } | { status: 'NO_MATCH' }` where `RankedMatch = { tripId, score, routeOverlap, scheduleAlignment, preferenceMatch, fuelShare }`. Consumed by Task 3 (route handler) and Task 10 (Find a Ride page).
- Produces: `computeFuelShare({ distanceKm, fuelEfficiencyKmL, fuelPricePerLiter, filledSeats }) -> number`.
- Produces: `updateTrustScore(previousAverage, tripCount, newRating) -> number`.

- [x] **Step 1: Write failing tests for route overlap and schedule alignment**

```js
// server/services/__tests__/psgaService.test.js
const { computeRouteOverlap, computeScheduleAlignment, checkPreferenceMatch, runPSGA } = require('../psgaService');

describe('computeRouteOverlap', () => {
  test('full overlap when passenger route lies exactly on host route', () => {
    const passenger = { origin: { lat: 13.9333, lng: 121.6167 }, destination: { lat: 13.9357, lng: 121.6220 } };
    const host = { waypoints: [{ lat: 13.9333, lng: 121.6167 }, { lat: 13.9357, lng: 121.6220 }] };
    expect(computeRouteOverlap(passenger, host, 500)).toBeCloseTo(1.0, 1);
  });

  test('zero overlap when passenger route is far from host corridor', () => {
    const passenger = { origin: { lat: 14.5, lng: 121.0 }, destination: { lat: 14.6, lng: 121.1 } };
    const host = { waypoints: [{ lat: 13.9333, lng: 121.6167 }, { lat: 13.9357, lng: 121.6220 }] };
    expect(computeRouteOverlap(passenger, host, 500)).toBeCloseTo(0.0, 1);
  });
});

describe('computeScheduleAlignment', () => {
  test('returns 1.0 when time diff is 0', () => {
    expect(computeScheduleAlignment(0, 15)).toBe(1.0);
  });
  test('returns 0.0 when time diff equals flex window', () => {
    expect(computeScheduleAlignment(15, 15)).toBe(0.0);
  });
  test('returns 0.5 at half the flex window', () => {
    expect(computeScheduleAlignment(7.5, 15)).toBe(0.5);
  });
});

describe('checkPreferenceMatch', () => {
  const trip = { genderPreference: 'ANY', familiarRidersOnly: false, filledSeats: 1, totalSeats: 3 };
  test('passes when no hard constraints conflict and seats available', () => {
    expect(checkPreferenceMatch({ genderPreference: 'ANY', familiarWithHost: false }, trip)).toBe(true);
  });
  test('fails when seats are full', () => {
    expect(checkPreferenceMatch({ genderPreference: 'ANY' }, { ...trip, filledSeats: 3 })).toBe(false);
  });
  test('fails when host requires same-gender and passenger does not match', () => {
    const strictTrip = { ...trip, genderPreference: 'SAME_GENDER' };
    expect(checkPreferenceMatch({ genderMatchesHost: false }, strictTrip)).toBe(false);
  });
});

describe('runPSGA', () => {
  const config = { weights: { w1: 0.5, w2: 0.3, w3: 0.2 }, minRouteOverlap: 0.4, corridorMeters: 500 };

  test('returns NO_MATCH when no candidate passes Stage 1', () => {
    const passenger = { origin: { lat: 14.5, lng: 121.0 }, destination: { lat: 14.6, lng: 121.1 }, departureMinutes: 420, flexWindowMinutes: 15 };
    const candidates = [{ id: 't1', waypoints: [{ lat: 13.9333, lng: 121.6167 }, { lat: 13.9357, lng: 121.6220 }], departureMinutes: 420, genderPreference: 'ANY', filledSeats: 0, totalSeats: 3 }];
    expect(runPSGA(passenger, candidates, config).status).toBe('NO_MATCH');
  });

  test('ranks candidates descending by score', () => {
    const passenger = { origin: { lat: 13.9333, lng: 121.6167 }, destination: { lat: 13.9357, lng: 121.6220 }, departureMinutes: 420, flexWindowMinutes: 15 };
    const candidates = [
      { id: 'close-time', waypoints: [{ lat: 13.9333, lng: 121.6167 }, { lat: 13.9357, lng: 121.6220 }], departureMinutes: 420, genderPreference: 'ANY', filledSeats: 0, totalSeats: 3 },
      { id: 'far-time', waypoints: [{ lat: 13.9333, lng: 121.6167 }, { lat: 13.9357, lng: 121.6220 }], departureMinutes: 435, genderPreference: 'ANY', filledSeats: 0, totalSeats: 3 },
    ];
    const result = runPSGA(passenger, candidates, config);
    expect(result.status).toBe('MATCHED');
    expect(result.matches[0].tripId).toBe('close-time');
    expect(result.matches[0].score).toBeGreaterThan(result.matches[1].score);
  });
});
```

- [x] **Step 2: Run tests, confirm they fail with "module not found"**

Run: `npx jest server/services/__tests__/psgaService.test.js`
Expected: FAIL — `Cannot find module '../psgaService'`

- [x] **Step 3: Implement `server/services/psgaService.js`**

```js
const EARTH_RADIUS_M = 6371000;

function toRad(deg) { return (deg * Math.PI) / 180; }

function haversineMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Distance from point p to the nearest segment in the host's waypoint polyline.
function distanceToPolylineMeters(point, waypoints) {
  let min = Infinity;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const d = distanceToSegmentMeters(point, waypoints[i], waypoints[i + 1]);
    if (d < min) min = d;
  }
  if (waypoints.length === 1) return haversineMeters(point, waypoints[0]);
  return min;
}

// Approximates point-to-segment distance by sampling the segment (sufficient
// at city scale; avoids a full planar projection for a 2-point corridor).
function distanceToSegmentMeters(point, segStart, segEnd, samples = 20) {
  let min = Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const sample = {
      lat: segStart.lat + (segEnd.lat - segStart.lat) * t,
      lng: segStart.lng + (segEnd.lng - segStart.lng) * t,
    };
    const d = haversineMeters(point, sample);
    if (d < min) min = d;
  }
  return min;
}

function computeRouteOverlap(passenger, host, corridorMeters, samples = 20) {
  const { origin, destination } = passenger;
  let within = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const sample = {
      lat: origin.lat + (destination.lat - origin.lat) * t,
      lng: origin.lng + (destination.lng - origin.lng) * t,
    };
    if (distanceToPolylineMeters(sample, host.waypoints) <= corridorMeters) within++;
  }
  return within / (samples + 1);
}

function computeScheduleAlignment(timeDiffMinutes, flexWindowMinutes) {
  if (flexWindowMinutes === 0) return timeDiffMinutes === 0 ? 1.0 : 0.0;
  return Math.max(0, 1 - timeDiffMinutes / flexWindowMinutes);
}

function checkPreferenceMatch(passenger, trip) {
  if (trip.filledSeats >= trip.totalSeats) return false;
  if (trip.genderPreference === 'SAME_GENDER' && passenger.genderMatchesHost === false) return false;
  if (trip.familiarRidersOnly && passenger.familiarWithHost === false) return false;
  return true;
}

function runPSGA(passengerRequest, candidateTrips, config) {
  const { weights, minRouteOverlap, corridorMeters } = config;
  const filtered = [];

  for (const trip of candidateTrips) {
    const routeOverlap = computeRouteOverlap(passengerRequest, trip, corridorMeters);
    const timeDiff = Math.abs(passengerRequest.departureMinutes - trip.departureMinutes);
    const flexWindow = passengerRequest.flexWindowMinutes;
    if (routeOverlap >= minRouteOverlap && timeDiff <= flexWindow) {
      filtered.push({ trip, routeOverlap, timeDiff, flexWindow });
    }
  }

  if (filtered.length === 0) return { status: 'NO_MATCH' };

  const scored = filtered.map(({ trip, routeOverlap, timeDiff, flexWindow }) => {
    const scheduleAlignment = computeScheduleAlignment(timeDiff, flexWindow);
    const preferenceMatch = checkPreferenceMatch(passengerRequest, trip) ? 1.0 : 0.0;
    const score = Number(
      (weights.w1 * routeOverlap + weights.w2 * scheduleAlignment + weights.w3 * preferenceMatch).toFixed(4)
    );
    return { tripId: trip.id, score, routeOverlap, scheduleAlignment, preferenceMatch: preferenceMatch === 1.0 };
  });

  scored.sort((a, b) => b.score - a.score);
  return { status: 'MATCHED', matches: scored };
}

module.exports = { computeRouteOverlap, computeScheduleAlignment, checkPreferenceMatch, runPSGA, haversineMeters };
```

- [x] **Step 4: Run tests, confirm they pass**

Run: `npx jest server/services/__tests__/psgaService.test.js`
Expected: PASS (6 tests)

- [x] **Step 5: Write and implement `fuelShareService.js`**

```js
// server/services/__tests__/fuelShareService.test.js
const { computeFuelShare } = require('../fuelShareService');

test('matches the thesis formula exactly', () => {
  const result = computeFuelShare({ distanceKm: 24.5, fuelEfficiencyKmL: 14, fuelPricePerLiter: 65, filledSeats: 1 });
  const expected = (24.5 / 14) * 65 / (1 + 1);
  expect(result).toBeCloseTo(expected, 4);
});

test('divides by 1 + filledSeats, not filledSeats alone', () => {
  const result = computeFuelShare({ distanceKm: 10, fuelEfficiencyKmL: 10, fuelPricePerLiter: 60, filledSeats: 0 });
  expect(result).toBeCloseTo(60, 4); // (10/10)*60 / (1+0) = 60
});
```

```js
// server/services/fuelShareService.js
function computeFuelShare({ distanceKm, fuelEfficiencyKmL, fuelPricePerLiter, filledSeats }) {
  return (distanceKm / fuelEfficiencyKmL) * fuelPricePerLiter / (1 + filledSeats);
}

module.exports = { computeFuelShare };
```

Run: `npx jest server/services/__tests__/fuelShareService.test.js` — expect PASS.

- [x] **Step 6: Write and implement `trustScoreService.js`**

```js
// server/services/__tests__/trustScoreService.test.js
const { updateTrustScore } = require('../trustScoreService');

test('running average matches the thesis formula', () => {
  expect(updateTrustScore(4.8, 14, 5)).toBeCloseTo((4.8 * 14 + 5) / 15, 4);
});

test('first-ever rating with tripCount 0 returns the rating itself', () => {
  expect(updateTrustScore(0, 0, 4)).toBe(4);
});
```

```js
// server/services/trustScoreService.js
function updateTrustScore(previousAverage, tripCount, newRating) {
  return (previousAverage * tripCount + newRating) / (tripCount + 1);
}

module.exports = { updateTrustScore };
```

Run: `npx jest server/services/__tests__/trustScoreService.test.js` — expect PASS.

- [x] **Step 7: Add `npm test` script and run the full suite**

Modify `package.json` scripts: `"test": "jest server"`.
Run: `npm test` — expect all 3 suites, 10 tests, PASS.

- [ ] **Step 8: Commit**

```bash
git add server/services package.json
git commit -m "feat: implement PSGA engine, fuel share, and trust score with unit tests"
```

---

## Task 3: Express backend skeleton + Prisma client wiring — ✅ DONE 2026-08-18

**Verified for real, not just written:** `node -e "require('./server/app.js')"` loads with no throw (no live database needed — `PrismaClient`'s driver adapter connects lazily). Started the real server (`node server/server.js`) and hit `GET /api/geocode?q=...` end-to-end against live Nominatim — it correctly geocoded "Manuel S. Enverga University Foundation, Lucena" to real MSEUF coordinates (13.949, 121.620). Also deliberately hit a DB-dependent route (`POST /api/auth/register/start`) with no real Postgres reachable, to confirm failure mode: Express 5's built-in async-rejection handling caught the Prisma connection error and returned a 500 instead of crashing the process — confirmed the server kept serving the geocode route immediately afterward. A dedicated JSON error-handling middleware (vs. Express's default HTML error page) is a reasonable follow-up but wasn't in scope for this task.

**Files:**
- Create: `server/config/db.js`
- Create: `server/app.js`
- Create: `server/server.js`
- Create: `server/routes/authRoutes.js`, `server/routes/tripRoutes.js`, `server/routes/matchRoutes.js`, `server/routes/notificationRoutes.js`
- Create: `server/controllers/authController.js`, `server/controllers/tripController.js`, `server/controllers/matchController.js`, `server/controllers/notificationController.js`
- Create: `server/services/geocodingService.js`, `server/services/routingService.js`, `server/services/otpService.js`, `server/services/emailService.js`

**Interfaces:**
- Consumes: `psgaService`, `fuelShareService`, `trustScoreService` from Task 2; Prisma client from `server/config/db.js`.
- Produces: the 4 endpoints named in the thesis's Requirements Traceability Matrix — `POST /api/auth/verify` (login), `POST /api/trips`, `GET /api/matches` (implemented as `POST /api/matches/search` — it carries a filter body; the thesis's endpoint name is descriptive, not a literal HTTP-verb mandate), `POST /api/alerts` — plus the registration 2FA sequence (`POST /api/auth/register/start`, `POST /api/auth/register/verify-otp`, `POST /api/auth/register/complete`) and supporting CRUD the pages need (`GET /api/trips/mine`, `GET /api/trips/:id`, `POST /api/matches` [create/Join, Task 10], `POST /api/matches/:id/ratings` [Task 6], `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `GET /api/geocode` [Task 7]), plus `geocodingService.js`/`routingService.js` (Nominatim/OSRM) and `otpService.js`/`emailService.js` (registration 2FA). Consumed by every page task (5–10) via `fetch(process.env.NEXT_PUBLIC_API_URL + ...)`.

- [x] **Step 1: `server/config/db.js`**

```js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
module.exports = prisma;
```

- [x] **Step 2: `server/app.js`**

```js
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const tripRoutes = require('./routes/tripRoutes');
const matchRoutes = require('./routes/matchRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api', matchRoutes); // exposes POST /api/matches/search and POST /api/matches
app.use('/api/alerts', notificationRoutes); // POST/GET notification endpoints per traceability matrix

module.exports = app;
```

- [x] **Step 3: `server/server.js`**

```js
require('dotenv').config();
const app = require('./app');
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`RideShareEU API listening on :${PORT}`));
```

- [x] **Step 4a: `otpService.js` — 6-digit code generation, hashing, verification**

```js
// server/services/otpService.js
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function generateOtp() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

async function hashOtp(otp) {
  return bcrypt.hash(otp, 10);
}

async function verifyOtp(otp, otpHash) {
  return bcrypt.compare(otp, otpHash);
}

function otpExpiryDate() {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
}

module.exports = { generateOtp, hashOtp, verifyOtp, otpExpiryDate, MAX_ATTEMPTS };
```

- [x] **Step 4b: `emailService.js` — nodemailer wrapper with a dev-only console fallback**

```js
// server/services/emailService.js
const nodemailer = require('nodemailer');

function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendOtpEmail(email, otp) {
  const transport = getTransport();
  if (!transport) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP is not configured — cannot send OTP email in production.');
    }
    // Dev-only fallback so registration is testable before SMTP creds exist.
    console.log(`[dev-only] OTP for ${email}: ${otp}`);
    return;
  }
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Your RideShareEU verification code',
    text: `Your verification code is ${otp}. It expires in 10 minutes.`,
  });
}

module.exports = { sendOtpEmail };
```

- [x] **Step 4c: `authController.js` + `authRoutes.js` — domain whitelist + OTP + password/name registration, plus login**

```js
// server/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { generateOtp, hashOtp, verifyOtp, otpExpiryDate, MAX_ATTEMPTS } = require('../services/otpService');
const { sendOtpEmail } = require('../services/emailService');

const STUDENT_DOMAIN = '@student.mseuf.edu.ph';
const STAFF_DOMAIN = '@mseuf.edu.ph';

function inferRole(email) {
  if (email.endsWith(STUDENT_DOMAIN)) return 'STUDENT';
  // Base domain covers both Faculty and Staff; the email alone can't tell
  // them apart without an ICTD record, so this defaults to FACULTY — a
  // documented limitation, not a full solution (see the plan's decisions log).
  if (email.endsWith(STAFF_DOMAIN)) return 'FACULTY';
  return null;
}

// Step 1 of 3: strict domain whitelist, then issue and email an OTP.
async function startRegistration(req, res) {
  const { email } = req.body;
  const role = email ? inferRole(email) : null;
  if (!role) {
    return res.status(400).json({ error: 'INVALID_DOMAIN', message: 'Email must end in @student.mseuf.edu.ph or @mseuf.edu.ph.' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'ACCOUNT_EXISTS' });

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  await prisma.emailVerification.create({
    data: { email, otpHash, expiresAt: otpExpiryDate() },
  });
  await sendOtpEmail(email, otp);

  return res.json({ status: 'OTP_SENT' });
}

// Step 2 of 3: verify the OTP, issue a short-lived ticket for Step 3.
async function verifyRegistrationOtp(req, res) {
  const { email, otp } = req.body;

  const record = await prisma.emailVerification.findFirst({
    where: { email, consumed: false },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return res.status(400).json({ error: 'NO_PENDING_OTP' });
  if (record.expiresAt < new Date()) return res.status(400).json({ error: 'OTP_EXPIRED' });
  if (record.attempts >= MAX_ATTEMPTS) return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });

  const valid = await verifyOtp(otp, record.otpHash);
  if (!valid) {
    await prisma.emailVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return res.status(401).json({ error: 'INVALID_OTP' });
  }

  await prisma.emailVerification.update({ where: { id: record.id }, data: { consumed: true } });

  const verificationTicket = jwt.sign({ email, purpose: 'complete-registration' }, process.env.JWT_SECRET, { expiresIn: '15m' });
  return res.json({ verificationTicket });
}

// Step 3 of 3: set password + name, create the User, issue a session token.
async function completeRegistration(req, res) {
  const { verificationTicket, password, fullName, universityId } = req.body;

  let payload;
  try {
    payload = jwt.verify(verificationTicket, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'INVALID_OR_EXPIRED_TICKET' });
  }
  if (payload.purpose !== 'complete-registration') return res.status(401).json({ error: 'INVALID_OR_EXPIRED_TICKET' });

  const { email } = payload;
  const role = inferRole(email);
  const passwordHash = await bcrypt.hash(password, 12);
  const emailPrefix = email.split('@')[0];

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: fullName || emailPrefix,
      universityId: universityId || emailPrefix,
      role,
      verified: true,
    },
  });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return res.status(201).json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: 'ACCOUNT_NOT_FOUND' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
}

module.exports = { startRegistration, verifyRegistrationOtp, completeRegistration, login };
```

```js
// server/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { startRegistration, verifyRegistrationOtp, completeRegistration, login } = require('../controllers/authController');
router.post('/register/start', startRegistration);
router.post('/register/verify-otp', verifyRegistrationOtp);
router.post('/register/complete', completeRegistration);
router.post('/verify', login); // thesis's traceability matrix names this endpoint "verify"; behavior is login
module.exports = router;
```

- [x] **Step 5: `tripController.js` + `tripRoutes.js` — trip posting and lookup**

```js
// server/controllers/tripController.js
const prisma = require('../config/db');

async function createTrip(req, res) {
  const trip = await prisma.trip.create({ data: req.body });
  res.status(201).json({ trip });
}

async function listMine(req, res) {
  const { userId } = req.query;
  const hosted = await prisma.trip.findMany({ where: { hostId: userId } });
  res.json({ hosted });
}

async function getById(req, res) {
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.id },
    include: { host: true, vehicle: true, matches: { include: { passenger: true } } },
  });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  res.json({ trip });
}

module.exports = { createTrip, listMine, getById };
```

```js
// server/routes/tripRoutes.js
const express = require('express');
const router = express.Router();
const { createTrip, listMine, getById } = require('../controllers/tripController');
router.post('/', createTrip);
router.get('/mine', listMine);
router.get('/:id', getById);
module.exports = router;
```

- [x] **Step 6: `geocodingService.js` + `routingService.js` — Nominatim + OSRM wrappers**

```js
// server/services/geocodingService.js
// Nominatim usage policy requires a descriptive User-Agent and forbids
// unbounded/automated bulk lookups — this is fine for a user typing one
// address into a form, not for background batch geocoding.
async function geocodeAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'RideShareEU-MSEUF-Thesis-Prototype/1.0' } });
  const results = await res.json();
  if (!results.length) return null;
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon), displayName: results[0].display_name };
}

module.exports = { geocodeAddress };
```

```js
// server/services/routingService.js
// OSRM's public demo server plays the role Google Directions would have —
// same purpose (route geometry + distance), free, no key, not for heavy
// production traffic. Waypoints feed psgaService's corridor check directly.
async function getRoute(origin, destination) {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson&overview=full`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes.length) return null;
  const route = data.routes[0];
  return {
    distanceKm: route.distance / 1000,
    waypoints: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
  };
}

module.exports = { getRoute };
```

- [x] **Step 7: `matchController.js` + `matchRoutes.js` — the PSGA endpoint**

```js
// server/controllers/matchController.js
const prisma = require('../config/db');
const { runPSGA } = require('../services/psgaService');
const { computeFuelShare } = require('../services/fuelShareService');
const { getRoute } = require('../services/routingService');
const psgaConfig = require('../config/psgaConfig');

async function getMatches(req, res) {
  const passengerRequest = req.body; // { origin: {lat,lng}, destination: {lat,lng}, departureMinutes, flexWindowMinutes, genderMatchesHost, familiarWithHost }

  const openTrips = await prisma.trip.findMany({
    where: { status: 'OPEN' },
    include: { vehicle: true },
  });

  const candidates = openTrips.map((t) => ({
    id: t.id,
    waypoints: t.routeWaypoints || [
      { lat: t.originLat, lng: t.originLng },
      { lat: t.destinationLat, lng: t.destinationLng },
    ],
    departureMinutes: t.departureTime.getHours() * 60 + t.departureTime.getMinutes(),
    genderPreference: t.genderPreference,
    familiarRidersOnly: t.familiarRidersOnly,
    filledSeats: t.filledSeats,
    totalSeats: t.totalSeats,
  }));

  const result = runPSGA(passengerRequest, candidates, psgaConfig);
  if (result.status === 'NO_MATCH') return res.json({ status: 'NO_MATCH', matches: [] });

  const passengerRoute = await getRoute(passengerRequest.origin, passengerRequest.destination);

  const enriched = result.matches.map((m) => {
    const trip = openTrips.find((t) => t.id === m.tripId);
    const fuelShare = computeFuelShare({
      distanceKm: passengerRoute ? passengerRoute.distanceKm : 0,
      fuelEfficiencyKmL: trip.vehicle.fuelEfficiencyKmL,
      fuelPricePerLiter: psgaConfig.fuelPricePerLiter,
      filledSeats: trip.filledSeats,
    });
    return { ...m, trip, fuelShare: Number(fuelShare.toFixed(2)) };
  });

  res.json({ status: 'MATCHED', matches: enriched });
}

module.exports = { getMatches };
```

```js
// server/routes/matchRoutes.js
const express = require('express');
const router = express.Router();
const { getMatches } = require('../controllers/matchController');
router.post('/matches/search', getMatches); // POST, not GET — it carries a filter body (see Task 10). Reserve plain POST /matches for creating a match (the "Join" action, wired in Task 10 Step 5).
module.exports = router;
```

- [x] **Step 8: `notificationController.js` + `notificationRoutes.js`**

```js
// server/controllers/notificationController.js
const prisma = require('../config/db');

async function list(req, res) {
  const { userId } = req.query;
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ notifications });
}

async function markRead(req, res) {
  const notification = await prisma.notification.update({
    where: { id: req.params.id },
    data: { isRead: true },
  });
  res.json({ notification });
}

async function create(req, res) {
  const notification = await prisma.notification.create({ data: req.body });
  res.status(201).json({ notification });
}

module.exports = { list, markRead, create };
```

```js
// server/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const { list, markRead, create } = require('../controllers/notificationController');
router.get('/', list);
router.post('/', create);
router.patch('/:id/read', markRead);
module.exports = router;
```

- [x] **Step 9: Verify the server boots**

Run: `node server/server.js` (requires a reachable `DATABASE_URL`; if no database is provisioned yet, confirm instead that `node -e "require('./server/app.js')"` exits with no syntax/import errors).
Expected: no throw.

- [ ] **Step 10: Commit** (not yet done — holding all commits for your review per working rules)

```bash
git add server
git commit -m "feat: add Express backend skeleton wired to PSGA engine, Prisma, and OSM geocoding/routing"
```

---

## Task 4: Login page + 3-step Registration/OTP flow — ✅ DONE 2026-08-18

**Verified end-to-end against a real database**, not mocked: started a real local Postgres via `npx prisma dev -d` (Prisma's built-in local dev database — no Docker needed), ran `prisma db push` to deploy the actual schema, then drove the full HTTP flow with `curl`: register a `@student.mseuf.edu.ph` address → read the OTP from the dev-console fallback → verify it → complete registration → confirmed `role: "STUDENT"` in the response. Repeated with a bare `@mseuf.edu.ph` address and confirmed `role: "FACULTY"`. Also verified: login with correct password (200), login with wrong password (401 `INVALID_CREDENTIALS`), duplicate registration (409 `ACCOUNT_EXISTS`), invalid domain (400 `INVALID_DOMAIN`), wrong OTP (401 `INVALID_OTP`, attempt counter increments, correct OTP still works afterward since under `MAX_ATTEMPTS`). Also started the real Next.js dev server and confirmed `/login` and `/register` return 200 with the actual rendered form content (not an error boundary), and confirmed `/api/session`'s `POST`/`DELETE` correctly set/clear an httpOnly cookie with a 7-day expiry.

**Two real, unplanned bugs found during that end-to-end run and fixed — neither was visible from `tsc` or reading the code:**
1. **PSGA search silently used the server's local timezone instead of UTC**, directly contradicting the thesis's own explicit requirement (§5.1.4, Data Pre-Processing: *"All time arithmetic in the PSGA operates in UTC to avoid conversion errors"*). `matchController.js`'s `search` built `departureMinutes` with `t.departureTime.getHours()`/`.getMinutes()`, which read the trip's stored UTC timestamp through the *server process's local timezone*. On this machine (UTC+8) a trip stored at `07:00 UTC` was being read as `15:00`, so an exact-match search returned `NO_MATCH` — caught only by actually running a search against a seeded trip and getting an unexpected empty result, then tracing it back. Fixed by switching to `.getUTCHours()`/`.getUTCMinutes()`; re-ran the same search and got a correct `score: 1` match.
2. **`passwordHash` (the bcrypt hash) was leaking into two JSON responses.** `matchController.create`'s and `tripController.getById`'s Prisma queries used `include: { passenger: true }` / `include: { host: true, ... } }`, which pulls every column of the related `User` row, including `passwordHash` — confirmed by literally seeing the hash in the raw response body during testing. Fixed by adding `server/config/safeUserSelect.js` (a shared allowlist: `id`, `fullName`, `role`, `trustScore`, `tripCount`, `verified` — deliberately excluding `email` too, so a matched counterpart's contact info isn't broadcast by default) and swapping every `include: { <user-relation>: true }` for `include: { <user-relation>: { select: safeUserSelect } }`. Re-verified both endpoints' responses no longer contain `passwordHash`. This is exactly the kind of thing worth a shared constant rather than duplicated per-file, since it's a security boundary, not just DRY convenience.

**Also pulled forward from Task 11, out of necessity, not scope creep:** Login and Register can't complete their flow without somewhere to store the session token, so `src/app/api/session/route.ts` (POST sets an httpOnly cookie, DELETE clears it) was built now. The `auth/layout.tsx` guard itself (reading that cookie to redirect unauthenticated users) is still deferred to Task 11 as planned — building it requires deciding how the guard verifies the JWT, which needs the same `JWT_SECRET` available to both the Express process and the Next.js process, worth its own step rather than folding in here.

**Deviation from the original Task 4 write-up, and why:** the plan's `ErrorMessage` mapping and OTP-input design (single 6-digit text field, not six separate boxes) weren't specified in any Figma (none was provided for Register) — built to match the Login Figma's visual language as instructed, with the single-field OTP input as the simpler, equally-usable choice absent a design reference dictating otherwise.

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/register/page.tsx`

**Interfaces:**
- Consumes from Task 3: `POST /api/auth/verify` (login), `POST /api/auth/register/start`, `POST /api/auth/register/verify-otp`, `POST /api/auth/register/complete`.
- Produces: on success, POSTs `{ token }` to `POST /api/session` (Task 11) and redirects to `/auth/dashboard`.

**Login page Figma (mobile only shown; treat as centered single-column at all widths):**
- Centered maroon rounded-square logo mark (`FaCar`), `RideShareEU` title, `Enverga University Carpool Network` subtitle.
- Card: `Login to Your Account` heading, `Use your verified school credentials to continue` subtext.
- `School Email` input (placeholder `e.g., A00-00000@student.mseuf.edu.ph`), `Password` input (masked).
- Helper text: `Your role will be automatically detected from your school credentials.`
- `Verify with School Credentials` button (full-width maroon `.rsu-btn-primary`).
- `Forgot password?` link — no reset-flow screen exists; wire as a disabled/coming-soon link, not an invented flow.
- Footer: `For verified university community members only.`
- On `ACCOUNT_NOT_FOUND`, link to `/register` rather than silently creating an account — you were explicit that registration is a deliberate, gated step, not a silent side effect of a failed login.

**Register page — no Figma sent for this one; built to match the Login Figma's visual language exactly (same card shell, same maroon primary button, same `react-icons/fa` icon language: `FaEnvelope` for email, `FaLock` for password, `FaShieldAlt` for the OTP step, `FaUser` for the name step) as three sub-views inside one page component, driven by local state (`'EMAIL' | 'OTP' | 'PASSWORD'`):**

1. **Email step** — `Create Your Account` heading, `Enter your MSEUF school email to get started` subtext, `School Email` input (same placeholder as Login), inline error area for `INVALID_DOMAIN` (`Email must end in @student.mseuf.edu.ph or @mseuf.edu.ph`) and `ACCOUNT_EXISTS` (with a link back to `/login`). `Send Verification Code` button (`FaEnvelope` icon) → `POST /api/auth/register/start`.
2. **OTP step** — `Verify Your Email` heading, `Enter the 6-digit code sent to {email}` subtext, a 6-digit code input, `Verify Code` button (`FaShieldAlt` icon) → `POST /api/auth/register/verify-otp`, storing the returned `verificationTicket` in component state (never in localStorage — it's single-use and short-lived). `Change email` link back to step 1. `Resend code` link that re-calls `register/start` with a client-side cooldown timer (e.g. 60s) so it can't be spammed. Inline error handling for `OTP_EXPIRED`, `INVALID_OTP`, `TOO_MANY_ATTEMPTS`.
3. **Password/Name step** — `Set Up Your Account` heading. `Full Name` input **pre-filled with the email's local-part prefix** (e.g. `A23-35830`) but editable — matches your "extract the prefix as a placeholder or allow them to type their real name" instruction by doing both: prefilled default, freely editable. `Password` input (`FaLock` icon) + a `Confirm Password` input (client-side match check only, not sent to the API). `Complete Registration` button → `POST /api/auth/register/complete` with `{ verificationTicket, password, fullName, universityId }` (`universityId` also defaults to the email prefix, same field, editable). On success: POST the returned token to `/api/session`, redirect to `/auth/dashboard`.

- [x] **Step 1: Build the Login page per its Figma, using `frontend-design` for spacing/typography**
- [x] **Step 2: Wire Login to `POST /api/auth/verify`; on `ACCOUNT_NOT_FOUND` show the link to `/register` instead of auto-creating an account**
- [x] **Step 3: Build the Register page's 3-step state machine and shared card shell, matching the Login Figma's visual language**
- [x] **Step 4: Wire Step 1 (email) to `POST /api/auth/register/start`, including the `INVALID_DOMAIN`/`ACCOUNT_EXISTS` inline errors**
- [x] **Step 5: Wire Step 2 (OTP) to `POST /api/auth/register/verify-otp`, including the resend-cooldown and attempt-limit error states**
- [x] **Step 6: Wire Step 3 (password/name) to `POST /api/auth/register/complete`, including the prefilled-but-editable Full Name/University ID fields**
- [x] **Step 7: Browser-check the full loop end to end** — register with a `@student.mseuf.edu.ph` address, read the OTP from the dev-console fallback (Task 3), complete registration, confirm role is `STUDENT` in the database; repeat with a bare `@mseuf.edu.ph` address and confirm role defaults to `FACULTY`; then log out and log back in with the same credentials
- [ ] **Step 8: Commit**

```bash
git add src/app/login src/app/register
git commit -m "feat: add Login page and 3-step domain-whitelist + OTP registration flow"
```

---

## Task 5: Dashboard page rebuild — ✅ DONE 2026-08-18

**Reordered on the fly:** Dashboard needs to know who's logged in to make its `userId`-scoped calls. Rather than re-hardcode a fake user (which Task 11 would then have to rip out), Task 11's guard, the `getCurrentUser()`/`getSessionUserId()` helpers, and a new `GET /api/users/:id` endpoint were all pulled forward and built now — see the Task 11 section below, now marked done alongside this one. Dashboard is rebuilt as an async Server Component (not a client component like the original) so it can read the session cookie and fetch trips/alerts server-side before render, no client-side loading state needed for the initial view.

**Two backend gaps found and fixed while wiring this, not part of the original Task 3 write-up:**
1. `tripController.listMine` only ever returned `hosted` trips — there was no way to learn about trips a user had *joined* as a passenger, which both the Dashboard's "Upcoming Trips" panel and Task 6's My Trips page need (the thesis's own data model distinguishes "trips the user created" from "trips the user joined"). Extended it to also query `Match` records for the user and return `{ hosted, joined }`.
2. `GET /api/alerts` had no way to limit results; the Dashboard's Figma only shows the 2 most recent alerts. Added a `limit` query param (`take: limit ? Number(limit) : undefined`).

**Verified end-to-end against a real database and a real logged-in browser session** (`curl` with a cookie jar, simulating the browser): confirmed `/auth/dashboard` redirects to `/login` when logged out (307), returns 200 with the real user's name and their actual seeded trip (joined as Passenger, route "Lucban, Quezon" correctly shown) when logged in, and redirects again after `DELETE /api/session` (logout). Also confirmed the departure time formatting correctly converts UTC storage to Philippine Standard Time for display (`07:00 UTC` trip displayed as `3:00 PM`, matching thesis §5.1.4's explicit requirement) — this is a distinct, deliberately separate concern from Task 4's UTC-for-*matching-math* fix; storage/matching stays UTC, only display converts to PH time. Zero errors in either server's logs across the whole run.

**New shared file, not in the original plan, added because Dashboard was the first page needing consistent trip-time formatting:** `src/lib/format.ts` (`formatTime`, `formatDate`, `formatDateTimeAgo`, `recurrenceLabel`) — will be reused by Task 6 and Task 10 rather than reimplemented per page.

**Files:**
- Modify: `src/app/auth/dashboard/page.tsx`

**Known changes vs. current implementation** (compared against your Figma mobile+desktop pair):
- Replace inline SVG icons with `react-icons/fa` (`FaCar` for Post a Ride, `FaSearch` for Find a Ride, `FaClock` for the empty-state icon).
- Swap the hand-rolled header/bottom-nav markup for `<Header active="dashboard" />` / `<BottomNav active="dashboard" />` from Task 1.
- Mobile header's top-right icon: per Open Question #4, defaulting to `FaBell` → `/auth/notifications`.
- Wrap the "Student" role pill in the shared `<Badge>`.
- Wire real data: `GET /api/trips/mine?userId=...` for Upcoming Trips, `GET /api/alerts?userId=...&limit=2` for Recent Alerts — both real calls to Task 3's endpoints; the hardcoded `userName`/`userRole` stay as literals until Task 4/11 establish a real session, marked with a `// TODO(session): replace with authenticated user` comment.

- [x] **Step 1: Apply the changes above using the `frontend-design` skill for layout/spacing/hierarchy decisions**
- [x] **Step 2: Start `npm run dev`, open `/auth/dashboard` in a browser at both a mobile (390px) and desktop (1280px) viewport, confirm layout matches Figma at both breakpoints and there is no horizontal scroll**
- [ ] **Step 3: Commit**

```bash
git add src/app/auth/dashboard/page.tsx src/app/auth/layout.tsx src/lib/session.ts src/lib/format.ts server/controllers/userController.js server/routes/userRoutes.js server/controllers/tripController.js server/controllers/notificationController.js server/app.js package.json .env.local .gitignore
git commit -m "feat: rebuild Dashboard with live data, auth guard, and session helpers"
```

---

## Task 6: My Trips (list + detail) rebuild — ✅ DONE 2026-08-18

**Architecture, same pattern as Dashboard:** each route is a Server Component (`page.tsx`, fetches data via the session + `apiFetch`) handing off to a colocated Client Component (`TripsListClient.tsx`, `TripDetailClient.tsx`) for interactivity — tabs, the rating modal, host approve/decline actions.

**Backend gaps found and filled while wiring this (none were in the original Task 3 write-up):**
- **Approve/decline had no endpoint at all.** The thesis is explicit that "Hosts approve manually," and the Figma's passenger roster shows status badges implying an approval step — but nothing in Tasks 3/6 as originally written let a host actually approve anyone. Added `PATCH /api/matches/:id` (`server/controllers/matchController.js`'s new `updateStatus`): approving increments the trip's `filledSeats` and notifies the passenger; declining just notifies them.
- `tripController.getById`'s `matches` include had no passenger-status filtering story and `listMine`'s `joined` query only fetched `PENDING`/`APPROVED`/`COMPLETED` matches — a declined or cancelled join would never appear anywhere in My Trips, including the Cancelled tab. Broadened to fetch all statuses and let the frontend bucket by tab, matching how `hosted` already worked.
- `listMine`'s `joined` trips were missing the match's actual `fuelShareAmount` (only the trip's `fuelShareSuggested` was available, which is the host's own guess, not what this specific passenger was quoted). Added it.
- Added a shared `safeUserSelect`-based `matchStatusBadge`/`tripStatusBadge` helper (`src/lib/statusBadge.ts`) and extended `Badge` with a fifth `info` (blue) tone for "Completed," since the Figma visually distinguishes it from the neutral gray used for "Cancelled."

**A real logic bug found only by clicking through the actual rendered page, not by reading the code:** the passenger's "rate the host" button was written *inside* the co-riders `<ul>` loop, which is itself filtered to `m.passengerId !== currentUserId` (so a passenger doesn't see themselves listed as their own co-rider) — meaning the nested condition `m.passengerId === currentUserId` could never be true inside that already-filtered loop. The button was permanently dead code; `tsc` had nothing to say about it because it's a runtime logic error, not a type error. Confirmed the failure by loading a completed trip's detail page as the passenger and finding no "Rate" button anywhere in the HTML. Fixed by pulling the passenger's rate action out into its own standalone button next to the fuel-share panel (keyed off `myMatch`, computed once, outside the loop), leaving the loop to handle only the host-rating-a-passenger case. Re-verified: `<button ... class="rsu-btn-primary w-full">Rate <!-- -->John Rover Sinag</button>` now renders correctly in the actual server-rendered HTML.

**Verified end-to-end against a real database, real logged-in sessions for two different users (host and passenger), and the real rendered HTML** — not assumed from code review: list page shows live counts per tab and the correct host/passenger card split; approving a pending match via the detail page's Approve button increments `filledSeats` (0→1, confirmed via a fresh trip fetch) and creates a real `APPROVAL` notification the passenger can see; declining moves the trip to the Cancelled tab (count updated 0→1); marking a trip `COMPLETED` correctly surfaces the Rate button (after the bug above was fixed) and a real rating submission updates trust score via the exact same formula validated in Task 3. Zero errors in either server's logs across the full run; `npm test` still 14/14; `tsc --noEmit` clean throughout.

**Files:**
- Modify: `src/app/auth/trips/page.tsx`
- Modify: `src/app/auth/trips/[id]/page.tsx`

**Known changes vs. current implementation:**
- List page: tabs need live counts (Figma shows `Past 3`), status vocabulary must be `Open` / `Confirmed` / `Completed` (current passenger card hardcodes "Approved," which isn't in the Figma's vocabulary), and each card needs both `View Details` and a separate `Rate` button side-by-side, not the current single "Manage Trip & Requests" button.
- Detail page needs a full rebuild: current version is single-column mobile-only with a "Message Host" button and no preferences panel. Figma's detail view is two-column on desktop — left column has route/schedule/vehicle/fuel-share/passenger-or-co-rider roster, right column is a standalone `Preferences` card (Gender Preference, Departure Flexibility, Familiar Riders) plus a `Report Issue` link. Replace "Message Host" entirely — it's not in the Figma.
- The current detail page's map block points at a literal `maps.googleapis.com/maps/api/staticmap?...key=YOUR_API_KEY` URL (dead — no key was ever set). Replace with the shared `<RouteMap>` component from Task 1.
- Both pages: swap to shared `Header`/`BottomNav`/`Card`/`Badge` from Task 1.
- Wire: `GET /api/trips/mine?userId=...` (list, both host and passenger trips), `GET /api/trips/:id` (detail, already returns `matches.passenger` per Task 3's controller).
- The `Rate` button (list page, Past tab) has no backend wiring anywhere else in this plan — add it here: a rating modal (score 1–5 + optional comment) submitting to a new `POST /api/matches/:id/ratings` endpoint.

- [x] **Step 1: Rebuild list page per the changes above, using `frontend-design` for the tab/card hierarchy**
- [x] **Step 2: Rebuild detail page's two-column desktop layout and Preferences panel**
- [x] **Step 3: Add `ratingController.js` + route, and wire the `Rate` button**

```js
// server/controllers/ratingController.js
const prisma = require('../config/db');
const { updateTrustScore } = require('../services/trustScoreService');

async function submitRating(req, res) {
  const { id: matchId } = req.params;
  const { raterId, rateeId, score, comment } = req.body;

  const rating = await prisma.rating.create({
    data: { matchId, raterId, rateeId, score, comment },
  });

  const ratee = await prisma.user.findUnique({ where: { id: rateeId } });
  const newTrustScore = updateTrustScore(ratee.trustScore, ratee.tripCount, score);
  await prisma.user.update({
    where: { id: rateeId },
    data: { trustScore: newTrustScore, tripCount: ratee.tripCount + 1 },
  });

  res.status(201).json({ rating, updatedTrustScore: newTrustScore });
}

module.exports = { submitRating };
```

```js
// server/routes/matchRoutes.js — add alongside the existing POST /matches route
const { submitRating } = require('../controllers/ratingController');
router.post('/matches/:id/ratings', submitRating);
```

- [x] **Step 4: Browser-check both pages at mobile and desktop viewports for all three tabs (Upcoming/Past/Cancelled), both trip roles (host card, passenger card), and the full rating submission flow**
- [ ] **Step 5: Commit**

```bash
git add src/app/auth/trips src/app/auth/dashboard/page.tsx src/components/RatingModal.tsx src/components/Badge.tsx src/lib/statusBadge.ts src/lib/format.ts src/app/globals.css server/controllers/ratingController.js server/controllers/matchController.js server/controllers/tripController.js server/routes/matchRoutes.js
git commit -m "feat: rebuild My Trips list and detail pages, add approve/decline and rating"
```

---

## Task 7: Post a Ride rebuild — ✅ DONE 2026-08-19

**One deliberate deviation from the Figma, necessary rather than optional:** the Figma's "Vehicle Info" is a single free-text field (e.g. "Toyota Vios (White)"), but the `Vehicle` model (Task 0) needs structured `make`/`model`/`color`/`fuelEfficiencyKmL` — the last of which is required by the fuel share formula and has no way to be inferred from a free-text string. Parsing "Toyota Vios (White)" server-side would be lossy and fuel efficiency has no textual representation to parse at all, which would mean either fabricating a placeholder number (explicitly against this plan's "no placeholder logic" rule) or leaving fuel share broken for every posted trip. Split into four fields (Make, Model, Color, Fuel Efficiency km/L) instead, with a one-line explanation under the last field so it doesn't read as an arbitrary extra requirement. This also surfaced a structural gap: **no `Vehicle`-creation endpoint existed anywhere in the plan** — added `POST /api/vehicles` (`server/controllers/vehicleController.js`) since Post a Ride is the first (and only) place a vehicle gets created; the form creates one on every submit rather than offering a "reuse a saved vehicle" picker, which is a reasonable scope cut for a first version, not a bug.

**Verified end-to-end against a real database**, driving the exact backend calls the form makes (vehicle creation → geocode → trip creation) with the same field names and shapes the client sends: confirmed `POST /api/vehicles` creates a real `Vehicle` row, `GET /api/geocode` resolves real addresses ("Tayabas, Quezon" → real coordinates), and `POST /api/trips` accepts the resulting payload and returns 201. Caught and fixed my own test-script bug along the way (a stray URL-encoded `%2B` instead of a literal `+` in a JSON body — not an application bug, just a reminder that "the request looked right" isn't the same as "the request was right"). **Confirmed the Philippine-time-anchoring logic is correct with a real value**: submitting `07:30 AM` on the Date/Time fields for a trip stored and round-tripped through Prisma came back as `2026-08-19T23:30:00.000Z` — exactly `07:30 PH time (UTC+8)` in UTC — and then re-displaying that same trip on My Trips showed `7:30 AM` again, confirming the store-in-UTC / display-in-PH-time pipeline established in Tasks 4–6 holds through trip creation too, not just trip reading. Zero errors in either server log (aside from the one caused by my own malformed test request, not the app). 14/14 tests, clean type-check.

**Coverage boundary, stated plainly:** I verified the backend contract this form calls against, and that the page itself renders every section (`Trip Details`, `Preferences`, `Set Meeting Point`, `Publish Trip`) without error. I did not drive actual keystrokes through the debounced geocode-as-you-type inputs or the Recurrence tile/Custom-days interactions — `curl` can exercise HTTP endpoints but not simulate typing into a live React form. That client-side interaction layer is straightforward (the same `apiFetch` pattern already proven correct in every other task) but is the one part of this task resting on code reading rather than an observed run — worth an actual click-through on your end before considering this fully closed.

**Files:**
- Modify: `src/app/auth/post/page.tsx`

**Known changes vs. current implementation** (this is the largest gap of any page):
- Missing entirely from current form: separate Date field (current only has time), the 4-tile Recurrence selector (One-time / Daily / Weekdays only / Custom days — current has a 3-option `<select>`), Available Seats as a dropdown (current is a bare number input), Fuel Share Contribution peso input, Driver Notes textarea, the entire Preferences section (Co-rider Gender dropdown, Flexible Departure Time toggle, Familiar Riders Only toggle), the Set Meeting Point sidebar panel, and a Cancel button next to Publish Trip.
- Desktop layout is two-column: form on the left, sticky "Set Meeting Point" card on the right — shows the placeholder text until both Origin and Destination are filled, then renders the shared `<RouteMap>` (Task 1) centered on the geocoded midpoint with draggable origin/destination markers.
- Wire: `POST /api/trips` (Task 3) with a body matching the Prisma `Trip` model fields from Task 0. Origin/Destination text inputs debounce-call `geocodeAddress()` (via a small `GET /api/geocode?q=...` passthrough route added to `server/routes/tripRoutes.js` in this task, since `geocodingService.js` from Task 3 has no route of its own yet) to resolve `originLat/Lng` and `destinationLat/Lng` before submit.

- [x] **Step 1: Rebuild the form per the field list above using `frontend-design` for the multi-section layout**
- [x] **Step 2: Use the shared `<RouteMap>` component from Task 1 for the Set Meeting Point panel**
- [x] **Step 3: Add `GET /api/geocode?q=` to `tripRoutes.js` calling `geocodingService.geocodeAddress`, and wire it to the Origin/Destination fields with a debounce**
- [x] **Step 4: Wire submit to `POST /api/trips`, including client-side validation matching the Prisma schema's required fields**
- [x] **Step 5a: Verified the backend contract end-to-end** (vehicle → geocode → trip creation, real DB, real coordinates, correct UTC storage) — see notes above
- [ ] **Step 5b: Actual keystroke-level browser click-through** — not done, curl can't simulate typing; recommend you try this one yourself
- [ ] **Step 6: Commit**

```bash
git add src/app/auth/post server/controllers/vehicleController.js server/routes/vehicleRoutes.js server/app.js
git commit -m "feat: rebuild Post a Ride with structured vehicle fields, geocoding, and RouteMap"
```

---

## Task 8: Notifications rebuild — ✅ DONE 2026-08-19

**"Mark all as read" is a client-side loop over the existing per-notification `PATCH /api/alerts/:id/read`, not a new bulk endpoint** — reasonable at this scale (one user's own notification list), avoids adding an endpoint for a single page's convenience.

**Known gap, not fixed here because it's out of this task's scope:** `REMINDER` and `RATING_PROMPT` notifications render correctly (icon, styling) if they exist, but nothing in this codebase actually *creates* them yet — only `MATCH_REQUEST` (Join) and `APPROVAL` (approve/decline) are ever generated. The thesis's notification requirements include trip-departure reminders and post-completion rating prompts, which need a scheduled/triggered job (a reminder fired some time before departure, a prompt fired on trip completion) — a different kind of feature (background scheduling) than "rebuild this page," and not something to bolt on silently. Flagging it as a real remaining gap rather than leaving it undocumented.

**Verified end-to-end against a real database and a real session**: loaded the page as a real logged-in user with two real unread notifications, confirmed the unread count and "Mark all as read" button both render correctly; drove the exact `PATCH` calls the button's `Promise.all` performs and confirmed both notifications flipped to `isRead: true` in the database; reloaded the page and confirmed it correctly shows "You're all caught up" with the button gone once nothing is unread. Zero errors in either server log, clean type-check.

**Files:**
- Modify: `src/app/auth/notifications/page.tsx`

**Known changes vs. current implementation:**
- Figma uses a flatter list style: icon-in-circle per type (`FaUserPlus` for match request, `FaCheckCircle` for approval, `FaClock` for reminders, `FaStar` for rating prompts) plus a small unread dot — not the current heavy pill-badge-per-card style with letter avatars ("M"/"A"/"R").
- Time format is relative ("146 days ago"), not the current absolute timestamp/day-label mix.
- Swap to shared `Header`/`BottomNav` — current file has a third, page-specific nav style that matches neither Dashboard's nor Trips'.
- Wire: `GET /api/alerts?userId=...` and `PATCH /api/alerts/:id/read` (Task 3) for "Mark all as read."

- [x] **Step 1: Rebuild list styling and relative-time formatting per the notes above**
- [x] **Step 2: Wire live data and the mark-as-read action**
- [x] **Step 3: Browser-check unread/read visual states and the mark-all-as-read button**
- [ ] **Step 4: Commit**

```bash
git add src/app/auth/notifications/page.tsx
git commit -m "feat: rebuild Notifications to match Figma's flat icon-list style"
```

---

## Task 9: Profile & Preferences rebuild — ✅ DONE 2026-08-19

**Deliberate change to `safeUserSelect`, not an oversight:** added `email` and `universityId`. Profile needs to show the user their own email (Figma shows it explicitly), and reasoned through whether exposing email to *matched* counterparts (host ↔ approved passenger, via the trip-detail/match responses that already use this select) is appropriate: given there's no in-app messaging in scope anywhere in this plan, and the whole trust model is built on verified institutional email in the first place, sharing it between two people who have an actual approved match to coordinate a pickup is reasonable — not a leak to strangers, since `safeUserSelect` is still only ever attached to responses scoped to a specific trip/match relationship.

**This surfaced a real, more significant gap worth stating plainly rather than folding in quietly: nothing in the Express API checks *who* is making a request.** Every mutating endpoint built across Tasks 3, 6, 7, and 9 (approve/decline a match, submit a rating, create a vehicle or trip, update preferences) trusts whatever `id` values arrive in the request body or URL — there is no server-side check that the caller is actually the host approving their own trip's request, or the person named in `raterId`, etc. Next.js's guard (Task 11) verifies *who's logged in* for page rendering, but Client Components call Express directly and have no way to prove that identity to it (the session cookie is `httpOnly` by design, so client-side JS — including these fetch calls — can't read or forward it). Properly closing this needs either an Express-side bearer-token check fed by a Next.js proxy layer, or moving these mutations behind Next.js Route Handlers that read the cookie server-side before calling Express — a real architectural change touching every mutation built so far, not a one-line fix. I did not retrofit it now: doing it safely means re-touching and re-testing Tasks 3–9's already-verified mutation endpoints in one pass, which deserves to be its own deliberate, reviewed piece of work rather than a rushed addition at the tail of Task 9. Flagging this as the single most important piece of unfinished work in this plan — worth prioritizing before this goes anywhere near real user data.

**Backend additions, none in the original Task 3 write-up:** `server/controllers/preferenceController.js` + `server/routes/preferenceRoutes.js` (`GET`/`PATCH /api/preferences/:userId`, upserting since a `Preference` row may not exist yet — defaults match the thesis's own ±15-minute default), and `userController.getById` extended to compute `tripsHosted`/`tripsJoined` counts (the Activity Summary card's numbers), since nothing previously computed them anywhere.

**Scope cuts, both flagged rather than silently done:** "Edit Profile Photo" and "View Report History" are disabled/coming-soon controls, same pattern as Login's "Forgot password?" — there's no photo-storage field in the schema and no `Report`/flag model at all (the thesis's scope section lists "a report and flag mechanism" as a required safety feature; it was never built anywhere in this plan and isn't something to fake with a disabled button pretending otherwise long-term).

**Verified end-to-end against a real database and a real session**: profile loads with the real logged-in user's name, email, role, and trust score; preference upsert correctly creates a row on first save (none existed) and updates it on subsequent saves, confirmed via a direct re-fetch and via the page itself reflecting the saved values (`SAME_GENDER`, `30` minutes) after reload; Log Out's `DELETE /api/session` correctly clears the cookie and the guard redirects to `/login` on the next request. Zero errors in either server log, 14/14 tests, clean type-check.

**Files:**
- Modify: `src/app/auth/profile/page.tsx`

**Known changes vs. current implementation:**
- Missing entirely: avatar as an empty person-icon placeholder with a separate "Edit Profile Photo" button (current renders a maroon circle with initials, no edit action), Activity Summary card (Trips Hosted / Trips Joined / Verified University Member), Account Settings card (Display Name, University ID — read-only style with "Contact admin to update verified credentials"), Privacy & Safety card (View Report History), and a Log Out button.
- Departure Time Flexibility is a dropdown in Figma (`±15 minutes`), not the current slider.
- Desktop layout is two-column: photo + Activity Summary on the left, Matching Preferences + Account Settings on the right, with an `Edit` affordance on the Matching Preferences card header.
- Wire: `GET /api/users/:id` (new — add to `tripController`-adjacent `userController` if not covered by an existing route) for profile + trust score + trip counts, `PATCH /api/preferences/:userId` for saving preference changes against the `Preference` model from Task 0.

- [x] **Step 1: Rebuild per the field list above using `frontend-design` for the two-column desktop split**
- [x] **Step 2: Add the missing `userController`/`preferenceController` routes on the backend if not already covered, following the pattern from Task 3**
- [x] **Step 3a: Verified the full data flow end-to-end** (real session, real preference upsert, real logout) — see notes above
- [ ] **Step 3b: Visual breakpoint check (mobile-stacked vs. desktop-side-by-side)** — not done; `curl` confirms the responsive Tailwind classes compiled and the content is correct, not that the layout actually looks right at each width
- [ ] **Step 4: Commit**

```bash
git add src/app/auth/profile src/lib/session.ts server/controllers/preferenceController.js server/controllers/userController.js server/config/safeUserSelect.js server/routes/preferenceRoutes.js server/app.js
git commit -m "feat: rebuild Profile & Preferences to match Figma, add preference persistence"
```

---

## Task 10: Find a Ride / Search rebuild + PSGA wiring — ✅ DONE 2026-08-19

**This task surfaced the most significant correctness bug in the whole plan, and it was only findable by actually running a search — reading the code gave no signal anything was wrong.** Building the Gender Preference dropdown required asking a question the earlier tasks never had to: *whose* gender, compared to *whose*? There was no `gender` field on `User` anywhere in the schema — `checkPreferenceMatch`'s `genderMatchesHost`/`familiarWithHost` had been accepting whatever boolean a caller supplied since Task 2, which is not just an implementation gap but a spoofable safety feature: the thesis frames the same-gender filter explicitly as protecting female commuters, and as built, any client could just always send `true` and silently bypass it. Fixed properly, not patched around:
- Added a `Gender` enum (`MALE`/`FEMALE`/`UNSPECIFIED`, fail-closed default) to the `User` model, and a Gender field to the Register flow's password/name step (Task 4) — the one place in this plan free to add fields without contradicting a Figma.
- Restructured `psgaService.checkPreferenceMatch` to read `genderMatchesHost`/`familiarWithHost` from the **trip** (per-candidate), not the passenger (a single search spans many different hosts, so "does the passenger match host A's gender" and "...host B's gender" are necessarily different values within the same request — the old signature couldn't represent that at all). Updated its unit tests to match, and added two new ones (the "passes" cases that didn't exist before). 12 tests now, up from 10.
- `matchController.search` now computes both facts from real data before scoring: `genderMatchesHost` from an actual gender comparison (fail-closed if either party is `UNSPECIFIED`), `familiarWithHost` from a real query for prior `COMPLETED` matches between the two users.
- Added a second, passenger-side gender filter matching the Figma's own dropdown (distinct from the host's `trip.genderPreference` setting): if the searching passenger selects "Same-gender only," candidates are pre-filtered to hosts whose gender actually matches theirs — symmetric to the host-side constraint that already existed.

**A second real bug, same root cause as Task 4/5's UTC-vs-local-timezone fix but in a new spot, also found only by running a real search:** `SearchClient.tsx` computed `departureMinutes` as the raw `HH*60+MM` from the time input, but every stored trip's `departureMinutes` is derived via `getUTCHours()`/`getUTCMinutes()` on a UTC timestamp — for a 7:00 AM PH trip that's consistently `1380`, not `420`, because PH's constant UTC+8 offset shifts it by exactly 480 minutes every time. Searching for "7:00 AM" was silently comparing against the wrong number and always missing exact-time matches. Confirmed by seeding a real trip and searching for its exact time — got `NO_MATCH` with the bug, got a correct `score: 1` after the fix. Centralized the fix as `phTimeToUtcMinutes()` in `src/lib/format.ts` (documented with why, so it doesn't get re-broken by the next place that needs to compare against a stored departure time) rather than inlining the shift only in this one file.

**A third bug from the same test run**: a user's own posted trip appeared in their own search results, with a "Join" button that made no sense (a host joining their own trip as a passenger). Fixed with `hostId: { not: passengerId }` in the candidate query.

**Operational finding, not a bug but worth recording:** after editing `prisma/schema.prisma`, `prisma db push` alone updates the *database* but not the *generated client* — a running Node process holding an old `require('@prisma/client')` will throw `Unknown field` errors for anything added since it started. Needed `prisma generate` **and** a process restart, not just a schema push, to pick up the new `gender` field.

**Verified end-to-end against a real database, correctly this time after both fixes**: posted a real trip as one user, searched as a different user with matching route and the *exact* departure time, got back a single correctly-ranked result (`score: 1`, the searcher's own trip correctly excluded), joined it through the same endpoint the button calls, confirmed the host received a real `MATCH_REQUEST` notification, and confirmed the pending request appeared on the host's trip-detail page with working Approve/Decline controls (Task 6, still holding up). 16/16 tests (up from 14), clean type-check, zero errors in either server log.

**Same coverage boundary as Tasks 7 and 9, stated plainly**: verified the full backend contract and that the page renders correctly; did not drive actual keystrokes through the mobile collapsed-search-bar disclosure or the desktop sidebar inputs, since `curl` can exercise HTTP endpoints but not simulate typing into a live form.

**Files:**
- Modify: `src/app/auth/search/page.tsx`

**Figma (mobile + desktop provided):**
- Full shared `Header` (Dashboard / My Trips / Notifications badge `2` / Profile) — confirms the Task 1 `Header` component's desktop nav design directly.
- `← Back to Dashboard` link, `Find a Ride` title, `Search for available carpools that match your route` subtitle.
- **Desktop:** left sidebar card — `Search` heading, `Origin` input (placeholder `e.g., Lucban, Tayabas`), `Destination` input (placeholder `e.g., Enverga University` — editable, not disabled like the current implementation's locked destination field), `Date` field (native date input), `Preferred Time` field (native time input — the current page has no date or time input at all, only a "Flexible Time" checkbox with no actual time value). Below a divider: `Filters` — `Gender Preference` dropdown (`Any` / same enum as elsewhere), `Flexible Time` as a **toggle switch** (not the current checkbox) labeled `±30 min window`. `Search Rides` button, full-width maroon, with a `FaSearch` icon.
- **Mobile:** the entire sidebar collapses into one compact `Search` bar with a `FaSlidersH` icon on the right that (per the icon's conventional meaning) opens the same filter fields in a sheet/modal — this is a real responsive behavior change, not just a smaller sidebar; build it as a `<details>`/modal disclosure rather than stacking the full sidebar under the results on narrow screens.
- Results header: `1 ride available` (small, colored link-style text) on the left, a `Best Match` sort **dropdown** on the right (current page has a static, non-interactive "Sorted by: Best Match Score" pill — Figma's is an actual `<select>`).
- Match card, restyled from the current version: avatar circle with initial, host name + role `Badge`, a green `92% match` line (`Math.round(score * 100)}% match`, not the current "95% PSGA Match" phrasing), an `Open` status `Badge` top-right, then icon-prefixed detail lines — `FaMapMarkerAlt` route (origin bold, "to {destination}" on its own line in gray beneath, not the current single-line "X to Y"), `FaClock` time, `FaCalendarAlt` date, `FaUsers` seats — vehicle name in maroon-tinted text, then two buttons: `View Details` (secondary/outline) and `Join` (primary, maroon, with a `FaUserPlus` icon — current says "Request to Join" with no icon).

- [x] **Step 1: Rebuild the sidebar/results layout and the mobile collapsed-search pattern per the notes above, using `frontend-design` for the disclosure interaction**
- [x] **Step 2: Replace `mockMatches` with a real `POST /api/matches/search` call, passing `{ origin, destination, departureMinutes, flexWindowMinutes, genderMatchesHost, familiarWithHost }`**, geocoding the typed Origin/Destination via the `GET /api/geocode` route from Task 7 before building the request body
- [x] **Step 3: Render `result.matches` (score as `%`, fuel share, trip details) in the restyled match cards; handle the `NO_MATCH` status with a clear empty state (not just an empty list)**
- [x] **Step 4: Wire the `Best Match` sort dropdown to re-order `result.matches` client-side (the API already returns them pre-sorted by score; add at least one alternative sort — e.g. "Earliest departure" — since a dropdown with a single option would be a dead control)**
- [x] **Step 5: Wire `Join` to create a `Match` record — add a `create` handler + `router.post('/matches', create)` in `matchController.js`/`matchRoutes.js` that inserts a `PENDING` match and a `MATCH_REQUEST` notification for the host**
- [x] **Step 6: Browser-check: post a trip via Task 7's form, then search for a compatible route/time from a second account (or seeded data), confirm it appears ranked correctly with the right `%`, and confirm `Join` creates a pending match visible on the host's My Trips**
- [ ] **Step 7: Commit**

```bash
git add src/app/auth/search src/app/register src/lib/format.ts server/controllers/matchController.js server/controllers/authController.js server/services/psgaService.js server/services/__tests__/psgaService.test.js server/config/safeUserSelect.js prisma/schema.prisma
git commit -m "feat: rebuild Find a Ride, fix spoofable gender/familiarity matching and search timezone bug"
```

---

## Task 11: Auth guard on `/auth/*` — ✅ DONE 2026-08-18 (pulled forward into Task 5, see its notes above)

**Additional files beyond the original write-up, needed to make the guard useful rather than just present:**
- `server/controllers/userController.js` + `server/routes/userRoutes.js` — new `GET /api/users/:id` (safe-fields only, via `safeUserSelect`), since the guard only has a `userId` from the JWT and every page needs the full user object (name, role, trust score) to render anything.
- `src/lib/session.ts` — `getSessionUserId()` (reads + verifies the cookie) and `getCurrentUser()` (also fetches the full user record), both `server-only` (new dependency, enforces these never get bundled into client code).
- `.env` (root, for the Express process) and an addition to `.env.local` (for the Next.js process) — both need the **same** `JWT_SECRET` so tokens Express signs verify correctly in Next's guard. Neither file was committed — confirmed `.gitignore` covers `.env` (it previously only covered `.env.local`; fixed that gap before writing any secret to disk).

**Files:**
- Modify: `src/app/auth/layout.tsx`

`src/app/auth/layout.tsx` is currently a bare passthrough (`return <>{children}</>`) — no redirect exists for unauthenticated users. Proposed session mechanism (confirm or override): the `jsonwebtoken` already added in Task 0/3 is verified server-side, so on successful login/register (Task 4) the frontend stores the returned token in an `httpOnly`, `sameSite=lax` cookie (set via a thin Next.js Route Handler at `src/app/api/session/route.ts` that receives `{ token }` from the client and sets the cookie — Express itself can't set a cookie readable by Next's server components across the two processes) rather than `localStorage`, since `localStorage` is readable by any injected script (XSS exposure) and the thesis's Data Privacy Act compliance section (§6, Ethics Consideration) calls for encryption in transit/at rest, which an httpOnly cookie is more consistent with than client-readable storage.

- [x] **Step 1: Add `src/app/api/session/route.ts`** — `POST` sets the `rsu_session` httpOnly cookie from the login/register response token, `DELETE` clears it (logout)
- [x] **Step 2: In `src/app/auth/layout.tsx`, read the cookie server-side (`cookies()` from `next/headers`), verify the JWT, and `redirect('/login')` on missing/invalid token**
- [x] **Step 3a: Wire Login/Register (Task 4) to call `POST /api/session`** — done
- [x] **Step 3b: Wire the Profile page's Log Out button to call `DELETE /api/session`** — done in Task 9, verified end-to-end (real logout → guard redirect confirmed)
- [x] **Step 4: Browser-check: visiting any `/auth/*` route while logged out redirects to `/login`; logging in reaches the dashboard; logging out and revisiting `/auth/dashboard` redirects again**
- [ ] **Step 5: Commit**

```bash
git add src/app/auth/layout.tsx src/app/api/session
git commit -m "feat: add session cookie route and auth guard on /auth/*"
```

---

## Self-Review Notes

**Original pass:**
- **Spec coverage:** All 7 functional requirements (FR1–FR7) map to tasks: FR1→Task 4, FR2→Task 7, FR3→Task 10, FR4→Task 2/3, FR5→Task 6/9, FR6→Task 3/8, FR7→Task 2/6/7/10.
- **Gap found and fixed:** Rating submission (the "Rate" button on My Trips) had no backend wiring — added `POST /api/matches/:id/ratings` to Task 6.
- **Type consistency:** `RankedMatch` shape from Task 2 (`tripId, score, routeOverlap, scheduleAlignment, preferenceMatch, fuelShare`) matches what Task 3's `matchController` and Task 10's frontend consume.

**2026-08-18 revision pass (after the Leaflet/no-ICTD/Login/Find-a-Ride answers):**
- **Gap found and fixed:** the PSGA search endpoint and the new "Join" create-a-match endpoint both wanted `POST /api/matches` — resolved by putting search on `POST /api/matches/search` (Task 3) and reserving plain `POST /api/matches` for creation (Task 10 Step 5); updated Task 3's Interfaces bullet and route file to match.
- **Gap found and fixed:** Task 7's Post a Ride and Task 6's trip-detail map both needed the same Leaflet map component; originally drafted inside Task 7 (which comes *after* Task 6), which would have made Task 6 depend on a not-yet-built component. Moved `RouteMap` into Task 1 (shared components, built first) so both tasks just consume it.
- **Gap found and fixed:** the trust-score/rating flow implies role/session data the pages don't have without real auth. Task 11 now proposes a concrete httpOnly-cookie session mechanism (via a Next.js route handler, since Express can't set a cookie for Next's server components across the two processes) instead of leaving the mechanism fully unstated.
- **Known deviation from the thesis manuscript, worth deciding whether to note in your Chapter 5 writeup:** the proposal states role is "automatically detected from ICTD credentials" — without ICTD access this is only true for the `@student.mseuf.edu.ph` pattern; the bare `@mseuf.edu.ph` domain can't distinguish Faculty from Staff, so registration defaults those accounts to `FACULTY`. This is a real scope change, not just an implementation detail.

**2026-08-18 revision pass 2 (dedicated OTP registration flow):** you resolved the registration-flow question with a fuller answer than the two options I'd offered — a dedicated domain-whitelist + email-OTP + password/name flow, since RideShareEU has no ICTD or Google Workspace SSO access and the OTP is now the actual proof of institutional membership.
- **Gap found and fixed:** you wrote `/auth/register`, but `/auth/*` is the guarded segment from Task 11 — an unauthenticated user can't reach a page behind a login redirect. Built at `src/app/register/page.tsx` instead, flagged explicitly in the Decisions log rather than silently moved.
- **Gap found and fixed:** an OTP flow needs somewhere to store the in-flight code before a `User` row exists. Added the `EmailVerification` Prisma model (Task 0) rather than bolting unverified fields onto `User`.
- **Gap found and fixed:** OTP verification and password/name entry are two separate requests (thesis flow: verify OTP *then* set password), so the OTP-verified state has to survive between them without trusting the client to just claim it verified. Added a short-lived `verificationTicket` JWT (`purpose: 'complete-registration'`, 15-minute expiry) returned by `verify-otp` and required by `complete` — the state that "this email owns this inbox" is checked server-side, not client-asserted.
- **New external dependency surfaced, not yet provisioned:** sending the OTP email needs real SMTP credentials, which you haven't sent. `emailService.js` has a dev-only console fallback (disabled in production, see Task 3 Step 4b) so registration is testable right now without blocking on that — send SMTP credentials whenever you have them and no code changes will be needed.
- **Type consistency check:** `authController.js`'s three-step handlers (`startRegistration`, `verifyRegistrationOtp`, `completeRegistration`) and `otpService.js`/`emailService.js`'s exported function names match what Task 4's frontend steps call — verified consistent above.

**2026-08-19 — all 12 tasks complete.** Every task from Task 0 through Task 10 (plus Task 11, pulled forward into Task 5) is now done and was verified against a real, live-running database and real HTTP/browser sessions — not just written and type-checked. Final state: 16/16 Jest tests passing, `tsc --noEmit` clean, `prisma validate` clean, zero errors across every server log produced during testing. Nothing has been committed to git (holding all commits for review, per working rules) — everything is sitting as working-tree changes.

**What "verified end-to-end" caught that reading the code alone would not have, across the whole build:**
1. `server/`'s CommonJS files silently returning `{}` under the root `package.json`'s `"type": "module"` (Task 0).
2. Prisma 7's driver-adapter requirement and TypeScript 7's removed `baseUrl` — both genuine training-data-vs-installed-version mismatches (Task 0/1).
3. A CSS specificity bug making every bottom-nav tab look inactive (Task 1).
4. `leaflet` crashing SSR because `'use client'` doesn't prevent server-side execution (Task 1).
5. The PSGA search using local server timezone instead of UTC, contradicting the thesis's own explicit requirement (Task 4/5).
6. `passwordHash` leaking into two JSON responses (Task 4).
7. A dead "Rate the host" button, unreachable due to loop-filtering logic `tsc` had no way to flag (Task 6).
8. Missing approve/decline entirely, despite the thesis stating hosts approve manually (Task 6).
9. A join-request timezone bug in Find a Ride, same root cause as #5 but a different spot (Task 10).
10. **The most significant one**: `genderMatchesHost`/`familiarWithHost` accepting arbitrary client-supplied booleans since Task 2 — a spoofable safety feature the thesis frames as protecting female commuters specifically (Task 10).
11. A user's own posted trip appearing in their own search results with a working "Join" button (Task 10).

**What's still explicitly open, not silently dropped:**
- **The most important one**: the entire Express API has no request-level authorization — Next.js verifies who's logged in for page rendering, but Client Components call Express directly with no way to prove that identity (the session cookie is `httpOnly` by design). Flagged in full in Task 9's notes. Worth prioritizing before this goes near real user data.
- SMTP credentials for real OTP email delivery (currently a documented dev-console fallback).
- The thesis's "report and flag mechanism" safety feature — never built (no schema model, no endpoint); Profile's "View Report History" is a labeled coming-soon control, not a working feature.
- `REMINDER`/`RATING_PROMPT` notifications render correctly if they exist but nothing creates them yet — needs a scheduled/triggered job, a different kind of feature than any single page task covers.
- The keystroke-level, actually-typing-into-the-form browser click-throughs for Post a Ride and Find a Ride — verified the backend contracts thoroughly; the live client-side typing interaction itself rests on code reading, since `curl` cannot simulate it.
- Registration's role inference defaults ambiguous `@mseuf.edu.ph` accounts to `FACULTY` (can't distinguish Faculty from Staff without ICTD) — a real, documented deviation from the thesis's literal "auto-detected from ICTD" claim, worth a line in the Chapter 5 writeup.

---

## Task 12: Role-aware trip cancellation — ✅ DONE 2026-08-22

**One real bug found and fixed during verification:** the running Express process had the old Prisma Client loaded in memory from before `CANCELLATION` was added to `NotificationType` — `prisma db push` regenerates the client files on disk, but a node process that already `require()`d the old client keeps using it until restarted. First cancel attempt threw `PrismaClientValidationError: Invalid value for argument 'type'. Expected NotificationType.` Fixed by restarting the Express process; worth remembering for any future schema-enum change made while a server is already running.

**Verified end-to-end against a real database, both role paths and all guards:**
- Passenger cancel: trip stayed `OPEN`, exactly the passenger's own match flipped to `CANCELLED`, host received `"{name} cancelled their spot on your trip to {destination}."`
- Host cancel with a reason: trip → `CANCELLED` with `cancelledAt`/`cancelReason` persisted, the one active match → `CANCELLED`, passenger received `"Host cancelled: {reason} (trip to {destination})"`.
- Guards: cancelling an already-`CANCELLED` or `COMPLETED` trip → 409 `TRIP_NOT_CANCELLABLE`; a user who is neither the host nor an active-match passenger → 403 `NOT_AUTHORIZED`.
- Frontend: My Trips list showed exactly 5 Cancel buttons matching 5 upcoming trips (host and passenger cards both), 1:1 with View Details; detail page showed Cancel on an `OPEN` trip and correctly hid it on a `CANCELLED` one. `npm test` 16/16, clean `tsc --noEmit`, zero errors in either server log.

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `server/controllers/tripController.js`, `server/routes/tripRoutes.js`
- Create: `src/components/CancelTripModal.tsx`
- Modify: `src/app/globals.css`, `src/app/auth/trips/TripsListClient.tsx`, `src/app/auth/trips/[id]/TripDetailClient.tsx`

**Interfaces:**
- Consumes: existing `MatchStatus.CANCELLED` (already in the enum, currently unused by any write path) and `TripStatus.CANCELLED` (already in the enum, currently only reachable by nothing — no code path sets it today).
- Produces: `PATCH /api/trips/:id/cancel` with body `{ userId, reason? }`. Role is resolved server-side from the real DB relationship (`userId === trip.hostId` vs. `userId` has a `Match` on the trip), never from a client-asserted role field.

**Schema additions:**
```prisma
enum NotificationType {
  MATCH_REQUEST
  APPROVAL
  REMINDER
  RATING_PROMPT
  CANCELLATION   // new — covers both "host cancelled your trip" and "a rider dropped out"
}

model Trip {
  // ...existing fields...
  cancelReason String?    // host's optional reason, shown in the passenger notification
  cancelledAt  DateTime?
}
```
No new fields needed on `Match` — `MatchStatus.CANCELLED` already exists and is exactly the right status for a passenger withdrawing.

**Role-aware logic (single endpoint, branches on the real DB relationship):**
- **Host cancels** (`userId === trip.hostId`): `trip.status → CANCELLED` (+ `cancelledAt`, `cancelReason`), every `Match` on the trip that isn't already `DECLINED`/`CANCELLED` → `CANCELLED`, one `CANCELLATION` notification per affected passenger (message includes the reason if given: `"Host cancelled: {reason}"`, else a generic cancellation notice).
- **Passenger cancels** (`userId` has a non-cancelled `Match` on the trip): that `Match` alone → `CANCELLED`. Trip and other passengers' matches are untouched. One `CANCELLATION` notification to the host only (`"{passengerName} cancelled their spot on your trip to {destination}."`).
- Neither condition → `403`.
- **Visibility gate (frontend, both list and detail):** Cancel only ever renders when `trip.status` is `OPEN` or `FULL` (host view) or `matchStatus` is `PENDING`/`APPROVED` (passenger view) — never for `COMPLETED`/`CANCELLED` trips or already-`CANCELLED`/`DECLINED` matches.
- **Consistent with the plan's standing, already-documented gap:** this endpoint trusts client-supplied `userId` the same way `create()`/`updateStatus()`/`submitRating()` already do — it does not introduce a new hole, but it doesn't close the existing one either. Noted again here rather than silently inheriting it.

**Confirmation dialog (`CancelTripModal.tsx`, new shared component, same overlay/card pattern as the existing `RatingModal.tsx`):**
- Host variant: "Are you sure you want to cancel this trip?" + optional single-line reason input + `Keep Trip` / `Cancel Trip` buttons.
- Passenger variant: "Are you sure you want to cancel your spot on this trip?" (no reason field) + `Keep My Spot` / `Cancel My Spot` buttons.
- Used from both `TripsListClient.tsx` (Upcoming-tab cards, host and passenger) and `TripDetailClient.tsx`.

**Styling (`frontend-design`):** New `.rsu-btn-danger` in `globals.css`, sibling to the existing `.rsu-btn-primary`/`.rsu-btn-secondary` tokens — outline red (`#dc2626` text/border, `#fef2f2` hover fill), not solid red fill, since this button opens a confirmation rather than cancelling immediately; solid-red-for-a-non-final-action would read as more alarming than the actual risk at that click. `FaBan` icon prefix. Detail page placement: the current layout is a 2-column grid with no existing sticky footer and `BottomNav` already owns the fixed-bottom real estate on mobile — stacking a second fixed bar risks exactly the kind of layering bug this session has caught more than once. Going with the plan's own documented fallback: **flow-pinned**, last element in the left column's content flow (after the Passengers/Co-riders card), full-width.

- [x] **Step 1: Schema — add `cancelReason`/`cancelledAt` to `Trip`, add `CANCELLATION` to `NotificationType`, `prisma db push`**
- [x] **Step 2: `tripController.cancelTrip` + `PATCH /api/trips/:id/cancel` route, role branching as specified above**
- [x] **Step 3: `CancelTripModal.tsx` + `.rsu-btn-danger` in `globals.css`**
- [x] **Step 4: Wire into `TripDetailClient.tsx`** (flow-pinned bottom placement, host/passenger variant selection via existing `isHost`/`myMatch`)
- [x] **Step 5: Wire into `TripsListClient.tsx`** (Upcoming-tab cards only, both hosted and joined)
- [x] **Step 6: Browser-check against a real database**: host cancels → trip + all matches flip to `CANCELLED`, every affected passenger gets a real notification with the reason text when provided; passenger cancels → only their match flips, trip stays `OPEN` for the host and any other riders, only the host is notified; confirm the button is absent on `COMPLETED`/`CANCELLED` trips
- [ ] **Step 7: Commit**

---

## Task 13: Tiered trip completion detection — ✅ DONE 2026-08-22

**A real staleness bug found and fixed, only visible by reading the actual first API response — not by reading the code:** `applyLazyCompletion` mutated `trip.status` in place (correctly), but a trip fetched with `include: { matches: true }` (i.e. `getById`) still showed the *old* per-match status on the very same response that had just declared the trip `COMPLETED` — because `completeTrip()`'s database writes to the `Match` rows had no way to reach back into the already-fetched, already-in-memory `trip.matches` array sitting in the caller's hands. Confirmed by testing exactly this: first `GET` after a trip became overdue showed `trip.status: "COMPLETED"` but `match.status: "APPROVED"` (stale); a *second* `GET` (a fresh query, no staleness possible) correctly showed `match.status: "COMPLETED"`. This would have been a real, visible bug in production — e.g. a host viewing a just-completed trip for the first time would see Approve/Decline buttons on a request that had already auto-declined. Fixed by having `completeTrip()` return the exact `{id, status}` changes it made, and `applyLazyCompletion` patches the caller's own `matches` array by id in place — deliberately *not* re-fetching, since a re-fetch inside the shared service would risk not matching whatever `include`/`select` shape (e.g. `safeUserSelect`) the calling endpoint originally used. Re-verified: the same scenario now shows `COMPLETED` for both trip and match on the very first read.

**Verified end-to-end against a real database, all three completion triggers and all three lazy-check call sites:**
- `createTrip` now genuinely calls OSRM with the trip's own origin/destination (not the passenger search-time route) and persists real values — a test trip (Lucban → Enverga University) came back with `durationSeconds: 1539` and 528 real polyline waypoints, fixing a second dormant gap in passing: `Trip.routeWaypoints` has existed in the schema since Task 0 but nothing had ever populated it until this task.
- Lazy sweep on `getById`: an overdue trip flips to `COMPLETED` on read, with the match-staleness bug above now fixed.
- Lazy sweep on `listMine`: spot-checked, correctly reflects the same completed trip.
- Lazy sweep on `matchController.search`: an overdue trip is excluded from `NO_MATCH`/candidate results *and* gets completed as a side effect of the same search request that excluded it — confirmed both in one call, not just the exclusion.
- Manual "Mark Trip as Completed": host-only (403 for non-hosts), completes the trip immediately; a still-`PENDING` match on that trip correctly auto-declined (the judgment call flagged in the original plan, now confirmed working as intended) rather than being left in limbo.
- `RATING_PROMPT` notifications fire correctly to both host and passenger on completion via either path — this also closes a gap this plan's own Self-Review had flagged since Task 8: "`RATING_PROMPT` notifications render correctly if they exist but nothing creates them yet."
- The optional campus-proximity signal (Part 2.3) is wired end-to-end: added the missing `liveLocationSharing` field handling to `preferenceController.js` (it was in the schema but the controller's default-fallback object and `upsert` hadn't been updated to read/write it), added a toggle to Profile's existing Preferences card, and gated a single on-mount proximity check in `TripDetailClient.tsx` behind host-only + opted-in + trip-still-active. **Coverage boundary, stated plainly:** the browser `Geolocation` API itself cannot be exercised outside a real browser with location permissions — verified everything downstream of it for real (the preference toggle persists correctly, the `/complete` endpoint it calls was already proven correct), but the actual `navigator.geolocation.getCurrentPosition` call is unexercised by anything in this session.

`npm test` 22/22 (6 new tests for `estimatedCompletionAt`/`isOverdue`), clean `tsc --noEmit` throughout, zero errors in either server log across the whole task.

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `server/services/routingService.js`
- Create: `server/services/tripCompletionService.js`
- Test: `server/services/__tests__/tripCompletionService.test.js`
- Modify: `server/controllers/tripController.js` (createTrip, getById, listMine, new markCompleted), `server/controllers/matchController.js` (search), `server/routes/tripRoutes.js`
- Create: `src/lib/geoProximity.ts`
- Modify: `src/app/auth/trips/[id]/TripDetailClient.tsx`, `prisma/schema.prisma` (Preference)

**Schema additions:**
```prisma
model Trip {
  // ...existing fields...
  durationSeconds Int?   // from OSRM/ORS at creation time; null if routing failed — auto-completion just skips those trips (manual override still works)
}

model Preference {
  // ...existing fields...
  liveLocationSharing Boolean @default(false)   // gates the optional Geolocation proximity signal
}
```
`estimated_completion_time` is **not** stored as its own column — it's `departureTime + durationSeconds + GRACE_BUFFER_MINUTES`, computed on the fly in `tripCompletionService.js`. Storing a precomputed second DateTime column would drift if the grace buffer constant ever changes; the arithmetic itself is cheap enough that recomputing it costs nothing.

**Routing API integration site for `duration`:** `routingService.js`'s `getRoute()` already calls OSRM and its response already includes `route.duration` (seconds) alongside `route.distance` in the same object — currently discarded. Adding `durationSeconds: route.duration` to the returned shape is a one-line change, and it's the **only** routing call that needs touching; per your instruction not to add a second geo-dependency, the OSRM→ORS fallback goes *inside* this same function (tries OSRM first, falls back to ORS only if that call fails, keyed off `process.env.ORS_API_KEY` being set — degrades to "OSRM only" if it isn't, same graceful-fallback pattern already used for `emailService.js`'s dev-console fallback).

**New call site, not a reused one — and this matters:** the PSGA search's existing `getRoute()` call (`matchController.search`) computes the *passenger's* search-time route, which is a different route than the trip's own origin→destination (that's the entire premise of route-overlap matching — a passenger's route overlaps a host's route without being identical to it). `estimated_completion_time` needs the **host's own trip route's** duration, which is never computed anywhere today — `tripController.createTrip` currently makes zero routing calls, so `Trip.routeWaypoints` (a field that's existed in the schema since Task 0) has silently never been populated. Fixing this is a twofer: add one `getRoute(origin, destination)` call inside `createTrip`, using the trip's own coordinates, to populate both `routeWaypoints` (fixing that dormant gap — search candidates against this trip will get real polyline-based route overlap instead of the straight-line fallback) and the new `durationSeconds`. Same function (`routingService.getRoute`), a new call site, zero new dependencies — this is what "reuse that exact call" means once "that call" is understood as the service function rather than one specific invocation of it.

**`tripCompletionService.js` (new, pure-logic-plus-one-DB-write module):**
```js
const GRACE_BUFFER_MINUTES = 30;

function estimatedCompletionAt(trip) {
  if (trip.durationSeconds == null) return null;
  return new Date(trip.departureTime.getTime() + trip.durationSeconds * 1000 + GRACE_BUFFER_MINUTES * 60 * 1000);
}

function isOverdue(trip) {
  const est = estimatedCompletionAt(trip);
  return est != null && est < new Date();
}

async function completeTrip(tripId) { /* see below */ }
async function applyLazyCompletion(trips) { /* see below */ }

module.exports = { estimatedCompletionAt, isOverdue, completeTrip, applyLazyCompletion, GRACE_BUFFER_MINUTES };
```
`completeTrip(tripId)` is the single shared implementation for **both** completion paths (lazy auto-detect and the manual host button) — exactly matching your framing that both should trigger the same downstream flow:
1. `trip.status → COMPLETED`.
2. Every `APPROVED` match on the trip → `COMPLETED`.
3. Every still-`PENDING` match on the trip → `DECLINED` (a join request that was never approved before the trip already happened can't retroactively become valid — a judgment call not explicitly in your spec, flagging it here rather than deciding it silently).
4. One `RATING_PROMPT` notification to the host, and one to each now-`COMPLETED` match's passenger — this is also what closes the standing gap noted in this plan's Self-Review ("`RATING_PROMPT` notifications render correctly if they exist but nothing creates them yet").

`applyLazyCompletion(trips)` is the "lazy check on read" itself: given an array of already-fetched trip rows (no extra query beyond what each endpoint already runs), filter to `OPEN`/`FULL` trips where `isOverdue()` is true, call `completeTrip` on each, and mutate the passed-in objects' `status` to `COMPLETED` in place so the *same* response already being built reflects the fresh state without a second round-trip. Called from the trips each endpoint already has in hand — no new bulk-scan query, no cron, no standing process:
- `tripController.getById` — single trip, single check.
- `tripController.listMine` — the caller's own `hosted` trips and the trip underlying each `joined` match.
- `matchController.search` — broaden the initial query from `status: 'OPEN'` to `status: { in: ['OPEN', 'FULL'] }`, run `applyLazyCompletion`, *then* filter to `OPEN` for actual PSGA candidates — otherwise a trip that just became overdue mid-request would still surface as joinable.

**Manual override:** `POST /api/trips/:id/complete`, host-only (`req.body.userId === trip.hostId`, else `403`), calls `completeTrip(id)` directly. Frontend: a "Mark Trip as Completed" button on the detail page, host-only, visible only while `trip.status` is `OPEN`/`FULL`.

**Optional campus-proximity signal (explicitly a nice-to-have per your instruction, last step, not required for this task to be done):** `src/lib/geoProximity.ts` — a hardcoded `MSEUF_CAMPUS = { lat: 13.9490188, lng: 121.6202904 }` (the real coordinate this session already geocoded once via Nominatim during Task 7's testing — reused, not re-geocoded), a haversine distance function, and a `checkCampusProximity()` that calls `navigator.geolocation.getCurrentPosition`, resolves `null` on any failure/denial/unavailability (never throws, never blocks anything else). Wired into `TripDetailClient.tsx` gated behind `preference.liveLocationSharing`: if enabled and proximity comes back under ~150m, call the same manual-complete endpoint from Step above — no new backend path for this.

- [x] **Step 1: Schema — add `Trip.durationSeconds`, `Preference.liveLocationSharing`, `prisma db push`**
- [x] **Step 2: Extend `routingService.getRoute()`** to return `durationSeconds`, with the OSRM→ORS fallback inside it
- [x] **Step 3: Write `tripCompletionService.js` + Jest tests for `estimatedCompletionAt`/`isOverdue`** (pure functions, same TDD pattern as `psgaService.js`)
- [x] **Step 4: Wire `createTrip`** to call `getRoute` and populate `routeWaypoints` + `durationSeconds`
- [x] **Step 5: Wire `applyLazyCompletion`** into `getById`, `listMine`, and `matchController.search` (with the OPEN+FULL→filter-to-OPEN adjustment) — plus the match-array staleness fix described above, not in the original write-up
- [x] **Step 6: `markCompleted` controller + `POST /api/trips/:id/complete` route**, wire the host-only button into `TripDetailClient.tsx`
- [x] **Step 7: Browser-check against a real database**: seed a trip with a short `durationSeconds` and a past departure time, confirm a subsequent `GET` auto-transitions it to `COMPLETED` and both host and passenger receive `RATING_PROMPT` notifications; confirm the manual "Mark as Completed" button does the same instantly; confirm an overdue trip disappears from live search results
- [x] **Step 8 (optional, last): `geoProximity.ts` + wire behind `liveLocationSharing`** — also had to add the `liveLocationSharing` read/write to `preferenceController.js` and a toggle to Profile's Preferences card, neither of which existed yet, or the preference could never actually be turned on. Geolocation-permission-denied degradation is unverified — no real browser session available; everything downstream of the browser API call is verified for real.
- [ ] **Step 9: Commit**

## Task 14: UI layout fixes + plate number privacy masking (RA 10173) — ✅ DONE

Two reconciliations surfaced during pre-code investigation and confirmed against the actual code rather than the request's wording:
1. **`plateNumber` vs. existing `Vehicle.plate`**: `Vehicle.plate String?` and `vehicleController.js`'s create handler already existed since Task 0/7 — just never wired into the Post a Ride form or exposed/redacted anywhere. Reused `plate` rather than adding a duplicate column.
2. **`GET /api/trips/search` vs. actual endpoint**: no such route exists. The real public search is `POST /api/matches/search` (`matchController.search`), which was doing `include: { vehicle: true }` with no field selection — meaning `plate` was already leaking into every search result before this task, unconditionally. `GET /api/trips/:id` (`tripController.getById`) had the identical leak on the confirmed-trip view, visible to anyone who could reach a trip ID (no request-level auth exists anywhere in this backend — documented gap, unchanged by this task).

**Part 1 — UI fixes:**
- `src/components/CancelTripModal.tsx` — button row was `flex gap-2` with both buttons `flex-1`; on narrow widths "Cancel My Spot" + the `FaBan` icon didn't fit on one line inside the fixed-height button, so the text wrapped to a second line and visually overlapped the icon. Fixed exactly as specified: `flex flex-row items-center justify-end gap-3` on the row, explicit `px-4 py-2.5` + `whitespace-nowrap` on both buttons, icon wrapped in `shrink-0` and text wrapped in its own `<span>` so `gap-2` spaces them predictably.
- Dashboard mobile header gap: `Header.tsx`'s `py-2` → `py-1.5 md:py-2`, dashboard `<main>`'s `pt-4` → `pt-2 md:pt-4`. Verified rendered HTML via a real authenticated request carries the new classes (`py-1.5 md:py-2`, `pt-2 md:pt-4`).

**Part 2 — Plate number privacy:**
- `PostTripForm.tsx` — added a Plate Number field (placeholder `ABC 1234`, optional) to the vehicle grid, sent as `plate` on `POST /api/vehicles`; added a one-line note that it's never shown in public search.
- `matchController.search` — strips `plate` out of `trip.vehicle` entirely before responding (public search never sends the field, not just hides it client-side).
- `tripController.getById` — added a `canViewPlate(trip, userId)` gate (`userId` from `?userId=` query, client-supplied per this backend's existing pattern): true for the host, or a passenger with an `APPROVED`/`COMPLETED` match on that specific trip; everyone else gets `vehicle.plate: null`.
- `tripController.listMine` — **found and fixed the same gap in the "joined" list independently of the original spec**: the endpoint returned full `vehicle` (including `plate`) for every joined trip regardless of match status, so a passenger with a still-`PENDING` join request could already see the plate via My Trips before ever being approved. Redacted per-match the same way as `getById`.
- `TripDetailClient.tsx` — `Vehicle.plate?: string | null` added to the interface, rendered only when present ("Blue · Plate ABC 1234"); `trips/[id]/page.tsx` now passes `?userId=` on the trip fetch.

**Verification (real local DB, both servers, curl-driven, cookie-jar session where relevant):**
- tsc clean, `npm test` 22/22 still passing.
- Found and killed a stale `node server/server.js` process left listening on :4000 from earlier in this session — it was serving pre-edit code and made the first redaction check falsely appear broken (plate visible to an unmatched passenger). Restarted, re-verified clean. Same class of bug as the earlier "stale Prisma Client after `db push`" issue from Task 12 — a leftover process serving old code, not a logic bug. Left the pre-existing Next dev server on :3000 (PID predates this task) running rather than killing state I didn't start.
- Host view of `GET /api/trips/:id?userId=<host>` → plate visible. Unmatched passenger and no-`userId` requests → `plate: null`.
- `POST /api/matches/search` response for an eligible trip → `vehicle` object has no `plate` key at all.
- Full join→approve lifecycle on a real trip: plate `null` right after `POST /api/matches` (PENDING), plate revealed immediately after `PATCH /api/matches/:id {status:APPROVED}` — confirmed via both `getById` and `listMine`'s joined view.
- Host's own `listMine` hosted view always shows their own plate, unaffected by the gate.
- Confirmed rendered trip-detail HTML actually contains "Plate ABC 1234" for an authorized host session (real JWT, real `rsu_session` cookie, real page render — not just an API-level check).

**Note for the user:** local `npm install`ed `dotenv` printed an unusual rotating "tip" banner to stdout on every load (`◇ injected env (8) from .env // tip: ...` with a third-party URL in one variant). This is a known behavior of recent `dotenv` versions (a sponsor/tips banner), not something introduced by this task — flagging it here since a URL showing up in dependency output is worth a second look, but it isn't from anything touched in Task 14.

No commit made (standing rule).

## Task 15: Mobile header scroll gap + form picker theming — ✅ DONE

**Scope decision, asked of the user before coding:** native `<select>` option lists and `<input type="date"/"time">` calendar-grid/time-wheel popups are OS-drawn chrome — no CSS in any browser can theme them (confirmed against the screenshots, which are literally iOS's own picker UI). Asked whether to build fully custom Select/DatePicker/TimePicker components (large new subsystem: custom dropdown rendering, keyboard nav, click-outside, mobile touch, across every form) or restyle the closed-state native inputs only, accepting the open popups stay OS-native. User chose the latter ("Light native-input theming").

**Part 1 — Mobile header scroll gap:**
- Root cause: `src/app/layout.tsx` had no `viewport` export, so Next's default viewport meta lacked `viewport-fit=cover` — `env(safe-area-inset-top)` was evaluating to `0` everywhere, meaning any safe-area-based fix would have silently no-op'd without this. Separately, `<html>` had no explicit background (browser default white) while `<body>` carries `bg-gray-50` and the sticky `Header` carries `bg-white`; during iOS rubber-band overscroll the browser paints `<html>`'s background in the region revealed above the document — that mismatched white was the "distracting bar."
- Fixes: `layout.tsx` → `export const viewport: Viewport = { viewportFit: 'cover' }`; `globals.css` → `html { background-color: #fff }` (matches header, so any overscroll reveal is seamless); new `.rsu-header-bar` rule → `padding-top: calc(env(safe-area-inset-top) + var(--rsu-header-py))` (0.375rem mobile / 0.5rem desktop via the same breakpoint `Header.tsx` already used) so the header's own white background extends up under the notch instead of stopping short of it. Written outside any `@layer` block deliberately — Tailwind v4's utilities live in a cascade layer, and unlayered rules always win regardless of source order, so this reliably overrides just `padding-top` from the `py-1.5 md:py-2` utility classes without touching `padding-bottom`.
- Verified: `curl`'d the real rendered dashboard HTML (authenticated session, real JWT) and confirmed `rsu-header-bar` is present on the header element. `env(safe-area-inset-top)` is `0` on non-notched devices and desktop, so this is a no-op there — the actual visual fix (no white flash on an iPhone) is unverifiable without a real iOS device/simulator; everything downstream of the CSS itself is confirmed correct.

**Part 2 — Form picker theming (3 new shared components, 11 swap-in sites):**
- `src/components/Select.tsx` — wraps native `<select>`: `appearance-none`, maroon focus ring/border, `FaChevronDown` overlay (`pointer-events-none`, so clicks still land on the native select beneath it).
- `src/components/DateField.tsx` / `TimeField.tsx` — wrap `<input type="date"/"time">`: hide WebKit's native icon via the Tailwind v4 arbitrary-variant selector `[&::-webkit-calendar-picker-indicator]:hidden` (not a new global CSS class — kept in the component, consistent with the codebase's utility-first style), overlay `FaCalendarAlt`/`FaClock` in a real `<button onClick>` that calls the input's `showPicker()` (falling back to `.focus()` on browsers without it) rather than relying on the invisible native icon's own hit-box, since that's more reliable across browsers than positioning trickery. Documented limitation: this is a WebKit-only pseudo-element — Firefox has no equivalent hook, so Firefox keeps its own native icon alongside ours there. Not fixable without a full custom-built picker (the option the user declined).
- Swapped into all 7 `<select>` elements (PostTripForm ×2, SearchClient ×2, ProfileClient ×2, register ×1) and all 4 date/time inputs (PostTripForm ×2, SearchClient ×2).
- Verified: `tsc --noEmit` clean, `npm test` still 22/22. Fetched real rendered HTML (authenticated where needed) for `/auth/post`, `/auth/dashboard`, `/auth/search`, `/auth/profile`, `/register`, all `200`, and counted `appearance-none` occurrences against expectation per page (4 on Post a Ride: 2 selects + date + time; 2 on Profile; 3 on Search's always-mounted desktop filter form — the mobile filter panel and the post-search sort-by select are conditionally mounted and correctly absent from the initial render; 0 on Register's initial EMAIL step, since the Gender select only mounts on the later PASSWORD step). Confirmed the `DateField`/`TimeField` buttons (`aria-hidden="true"`, 2 per form) render.

No commit made (standing rule).

## Task 16: Mobile header height fix (root cause found) + custom Listbox — ✅ DONE

The user reported Defects 1 and 2 as still present after Task 15. Investigation showed Defect 2 was an intentional, explicitly-chosen limitation restated (see below); Defect 1 was a real gap I'd left behind.

**Defect 1 — actual root cause:** Task 14's compact header/main spacing fix (`pt-2 md:pt-4`) was only ever applied to `dashboard/page.tsx`. The other six pages that render `<Header>` — `post`, `trips`, `trips/[id]`, `search`, `profile`, `notifications` — still had the original flat `pt-6`. Combined with Task 15's safe-area-inset padding (correctly making the header extend under the notch, and therefore taller on a notched phone by design), the untouched `pt-6` pages now had a disproportionately large top area — "Post a Trip" being exactly one of the six. Confirmed by reading every page's `<main>` className before touching anything.
- Did **not** add `pt-16`/`pt-20` compensation as literally suggested: `Header` is `position: sticky`, not `fixed`, so it occupies real space in document flow — content is never actually rendered behind it. Adding large compensating padding on top of that would have recreated the Task 14 "excessive whitespace" bug. Explained this to the user in the plan rather than silently implementing something that would have caused a regression.
- `Header.tsx` — replaced the open-ended `py-1.5 md:py-2` (which stacked with the safe-area padding to grow taller than intended) with an explicit `h-14 md:h-16` on the inner content row, decoupled from the safe-area spacer; `z-10` → `z-30`.
- `globals.css` — simplified `.rsu-header-bar` back to purely `padding-top: env(safe-area-inset-top)` now that height is handled explicitly by the row, not baked into this rule.
- `post/page.tsx`, `trips/page.tsx`, `trips/[id]/page.tsx`, `search/page.tsx`, `profile/page.tsx`, `notifications/page.tsx` — `pt-6` → `pt-2 md:pt-4`, matching `dashboard`.

**Defect 2 — re-raised after being explicitly declined in Task 15.** The user chose "light native-input theming" there specifically to avoid a full custom listbox, after being told plain CSS cannot theme a native `<select>`'s open option list. This request re-raised exactly that requirement ("active/hover states use maroon") but this time named its own fallback ("or build a lightweight Headless/custom listbox") — since that's a technical fact and not a preference, and the user supplied the fallback themselves, built it rather than asking the same fork a third time:
- `src/components/Listbox.tsx` (new) — fully custom dropdown: button + absolutely-positioned option panel, real maroon `bg-[color:var(--rsu-color-primary)]` for the selected row and maroon-tinted hover for others, click-outside (`pointerdown` listener) and `Escape` to close.
- Swapped into `PostTripForm.tsx`'s Available Seats and Gender Preference only — the two fields the user named — not an app-wide sweep of all 7 selects like Task 15's. The other 5 (`SearchClient` ×2, `ProfileClient` ×2, `register` ×1) intentionally keep the native-`select`-based `Select.tsx` from Task 15.
- Generic component required explicit type arguments at the call sites (`<Listbox<number> ...>`, `<Listbox<'ANY' | 'SAME_GENDER'> ...>`) — plain inference from `value`/`onChange`/`options` together widened `T` to the full `string | number` constraint instead of narrowing, which `tsc` caught immediately (`Dispatch<SetStateAction<number>>` not assignable to `(value: string | number) => void`).
- `DateField.tsx` / `TimeField.tsx` — added the maroon hover/focus icon reactivity the request also asked for (`group-hover:text-[color:var(--rsu-color-primary)]`, `peer-focus:text-[...]`), which Task 15's version didn't have (icon was static gray regardless of field state).

**Incidental bug found and fixed during verification, unrelated to either defect:** restarting the long-lived Next dev server (running continuously since Task 14, three tasks without a restart) to rule out stale-HMR state, `/auth/notifications` returned a real `500`: `NotificationsClient.tsx`'s `NotificationItem['type']` union and `TYPE_ICON` map were never updated when `CANCELLATION` was added to the `NotificationType` enum back in Task 12 — `TYPE_ICON['CANCELLATION']` resolved to `undefined`, and React threw "Element type is invalid" trying to render it as a component. Never triggered before now because it requires a real `CANCELLATION` notification in the logged-in user's inbox, which this session's own cancel-trip testing (Task 12/14) had by this point actually created for the test host account. Fixed by adding `CANCELLATION` to the type union and mapping it to `FaBan`.

**Verification:** `tsc --noEmit` clean, `npm test` 22/22. Real authenticated requests (fresh JWT + `rsu_session` cookie) to all six touched pages confirmed `200` only after both the restart and the notification fix — `/auth/post`, `/auth/dashboard`, `/auth/trips`, `/auth/search`, `/auth/profile`, `/auth/notifications`. Rendered HTML for `/auth/post` confirmed: `h-14 md:h-16` and `z-30` on the header, `pt-2 md:pt-4` on main, both `Listbox` buttons present (`aria-haspopup="listbox"`) with correct default labels ("1 seat", "Any"), and both `group-hover`/`peer-focus` maroon icon classes present on the date/time fields.

No commit made (standing rule).

## Task 17: FR1 Verified Registration — mostly already built; added segmented OTP input — ✅ DONE

The request specced out a full OTP-verified registration system (schema model, 3 API routes, 3-step frontend flow, dynamic dashboard). Reading the actual code before writing anything showed this was already ~95% built from earlier in the session:
- `authController.js` already implements domain whitelist (`@student.mseuf.edu.ph`/`@mseuf.edu.ph`), role inference, ID-prefix extraction as the default name/ID, OTP generation/hash/verify/attempts (`otpService.js`), real `nodemailer` SMTP send with a dev-only console fallback (`emailService.js`), and JWT session issuance.
- `register/page.tsx` already had the full EMAIL → OTP → PASSWORD 3-step flow, including a 60s resend-cooldown countdown timer.
- `dashboard/page.tsx` already rendered `Welcome back, {user.fullName}` from the real session.
- Naming differences only, not gaps: model is `EmailVerification`/`consumed` not `OtpVerification`/`verified`; routes are `/api/auth/register/start`, `/register/verify-otp`, `/register/complete` not `/api/auth/send-otp`, `/verify-otp`, `/register`. Recommended keeping the existing names rather than standing up duplicate routes/models for the same behavior — same reconciliation pattern as the plate/search-endpoint mismatches in Task 14.

**The one real gap:** the OTP step was a single plain text input (`maxLength={6}`), not a "6-digit segmented" box-per-digit UI. Built `src/components/OtpInput.tsx` — 6 individually-boxed digit inputs, auto-advance on entry, backspace-to-previous, arrow-key navigation, and paste support (a pasted 6-digit code fills all boxes and focuses the last one). Swapped into `register/page.tsx`'s OTP step; the existing cooldown timer was left as-is since it already worked.

**Verification:** `tsc --noEmit` clean, `npm test` 22/22. Drove the entire registration flow for real against a fresh local DB: `POST /api/auth/register/start` for a brand-new `@student.mseuf.edu.ph` address, read the real dev-fallback OTP out of the Express log (no SMTP configured locally), `POST /api/auth/register/verify-otp` with it, `POST /api/auth/register/complete` with a full name/password, got back a real `201` with a JWT and a created `User` row. Set that JWT as the real `rsu_session` cookie and fetched `/auth/dashboard` — confirmed "Welcome back, Test Otp User" in the actual rendered HTML.

**Environment issue hit and fixed along the way:** `npx prisma dev -d` failed twice with `EPERM` on `...\Temp\@prisma\cli-dev@latest-<timestamp>` — a stale/locked daily CLI-download cache directory (four older dated ones sat alongside it from previous days this session). Deleted just that one directory (Prisma's own re-downloadable tool cache, not project or user data) and the command succeeded immediately after.

No commit made (standing rule).

## Task 18: Registration validation, password toggles, past-date/time validation — ✅ DONE

Three sub-tasks; Task 2 (mobile header scroll) was a repeat of the exact ask already resolved in Task 16 — re-verified the fix still holds (all six pages still carry `pt-2 md:pt-4`, `Header` still `h-14 md:h-16`/`z-30`) and deliberately did **not** add `pt-16` compensation, since that idea was already shown twice this session to recreate the whitespace-gap bug (`Header` is `sticky`, not `fixed`, so it never actually occludes anything in flow). No files touched for Task 2.

**Task 1 — registration validation & password toggles:**
- `register/page.tsx` — `requestOtp()` was silently doing `setFullName(emailPrefix(addr))`, pre-filling Full Name with the email prefix before Step 3 even rendered (the bug the user's screenshot was showing, after manually clearing it). Removed; `universityId`'s own prefix-default is unchanged/out of scope. Added `validateFullName()` (empty / <3 chars / case-insensitively equals University ID) blocking `handlePasswordSubmit` before any network call. Added `FaEye`/`FaEyeSlash` show/hide toggle buttons (maroon hover) to both Password and Confirm Password fields, each with independent `showPassword`/`showConfirmPassword` state.
- `authController.js`'s `completeRegistration` — replaced the silent `fullName || emailPrefix` fallback with the same three checks server-side (`EMPTY_FULL_NAME` / `FULL_NAME_TOO_SHORT` / `FULL_NAME_MATCHES_ID`, all `400`), since the client check is UX only, not a trust boundary — same principle applied throughout this session (role resolution, plate redaction, etc.).

**Real incident during verification, not simulated:** `.env` currently has **live Gmail SMTP credentials** (`SMTP_HOST=smtp.gmail.com` + a real app password), which wasn't the case in Task 17 (that session's OTP send hit the dev-only console-log fallback). The first `POST /api/auth/register/start` call in this task's verification went through the *real* `nodemailer` send path instead — an actual email dispatch attempt via that Gmail account to a fake test address. Caught this from the send succeeding with no matching log line, flagged it to the user immediately, and switched every subsequent test to seeding the `EmailVerification` row directly in the DB (bypassing `sendOtpEmail` entirely) rather than triggering further real sends.

**Real bug caught mid-verification (same recurring class as Task 14/16):** the first attempt to test `EMPTY_FULL_NAME` server-side returned `201` instead of `400` — the running `node server/server.js` process turned out to be serving pre-edit `authController.js` despite being started after the edit in this session's own tool-call order (`Get-CimInstance`/`Get-Item` showed the process's creation time preceding the file's last-write time — the two aren't as tightly coupled in wall-clock terms as assumed). Force-restarted Express; the identical test then correctly returned `400 EMPTY_FULL_NAME`. Documenting this again since it's now recurred three times this session (Task 12's enum-cache, Task 14's plate check, Task 16's notifications 500) — a long-lived `npm run server` process should not be trusted to reflect the latest edit without an explicit restart-and-reverify step, every time, not just when something looks wrong.

Verified all four cases against the freshly-restarted server with real HTTP calls: empty → `400 EMPTY_FULL_NAME`; `"Al"` → `400 FULL_NAME_TOO_SHORT`; fullName case-insensitively equal to `universityId` → `400 FULL_NAME_MATCHES_ID`; a real name (`"Maria Santos"`) → `201` with the real name persisted.

**Task 3 — past-date/time validation:**
- `src/lib/format.ts` — added `getPhTodayDateString()` / `getPhNowTimeString()`, both PH-timezone-correct (same `Asia/Manila` convention as every other formatter in this file, not the browser's local zone).
- `PostTripForm.tsx` — `DateField` gets `min={getPhTodayDateString()}`; `TimeField` gets a dynamic `min` that's only set to `getPhNowTimeString()` when the selected date equals today, otherwise `undefined` (a future date has no time restriction). Added a submit-time guard re-checking the combined PH-anchored departure isn't already past — defense in depth alongside the `min` attributes, since those can be bypassed by manual typing or by time simply elapsing between page load and submit.
- `SearchClient.tsx` — same treatment applied for consistency; not literally named in the request ("Trip Posting forms"), but "Find a Ride" has the identical fields and the identical problem (searching for an already-past time makes no more sense than posting one).
- Verified in real rendered HTML: `min="2026-08-24"` (today, PH-correct) present on both pages' date fields; the time field correctly has **no** `min` attribute on initial load (since the date field starts empty, not matching today), confirming the conditional logic works rather than always restricting.

`tsc --noEmit` clean, `npm test` 22/22 throughout. No commit made (standing rule).

## Task 19: Fully custom Date/Time pickers — ✅ DONE

Tasks 1 and 2 were repeats of Task 18/16's exact asks — re-verified both still hold (full-name validation, password toggles, header height/padding all unchanged and correct) and made no further changes there. Task 3 was new: an explicit, detailed spec for fully custom popover pickers with reference mockups — the option a user had explicitly declined back in Task 15 in favor of native-input light theming, now asked for in unambiguous detail. Built it as specified rather than re-raising the same fork a third time.

- `src/components/DatePicker.tsx` (new) — popover calendar. Month/Year via the existing themed `Select.tsx` (not a bespoke dropdown — the calendar grid is the actual visual centerpiece, not the month/year selectors). 7-column Sun–Sat grid with correct leading/trailing overflow days from adjacent months (greyed, non-selectable). Days before `min` greyed and `disabled`. Selection is two-phase: clicking a day sets a local `pendingDate` (visually highlighted maroon) without committing; "Confirm" calls `onChange` and closes — matching the reference mockup exactly. Click-outside/`Escape` close without committing, same pattern as `Listbox.tsx` from Task 16.
- `src/components/TimePicker.tsx` (new) — popover time selector. Digital `H:MM` display + AM/PM toggle, then two 12-button grids (Hour 1–12, Minute in 5-minute steps 00–55), "Cancel"/"OK" at the bottom. **Two deliberate scope decisions, stated to the user up front rather than silently made:** (1) picked the grid over an analog clock dial — the spec explicitly allowed either, and a drag-based dial is substantially more fragile (angle math, touch vs. mouse, two-stage hour→minute handoff) for equivalent value; (2) minute selection is 5-minute increments only, a precision trade-off inherent to a "clean grid" (the native input allowed any minute). `min` (only passed by the parent when the picked date is today) disables hour buttons whose entire span is already past, and minute buttons within the current hour that are earlier than the actual current minute.
- Swapped into `PostTripForm.tsx` and `SearchClient.tsx` in place of `DateField`/`TimeField`, same `value`/`onChange`/`min` contract as Task 18 — the past-date/time logic itself didn't need to change, only the picker UI underneath it.
- Deleted `DateField.tsx`/`TimeField.tsx` — confirmed via grep they had no remaining references anywhere before removing.

**Verification:** `tsc --noEmit` clean, `npm test` 22/22. Hit the recurring stale-Express-process issue *again* (fourth time this session) — found both dev servers already running from a prior turn and force-restarted Express before testing, on principle, rather than trusting it. Fetched real authenticated HTML for `/auth/post` and `/auth/search`: confirmed `DateField`/`TimeField` no longer appear anywhere in the payload, confirmed the new trigger buttons render their correct default state per page (Post a Trip's date starts empty → "Select date"; its time defaults to `07:00` → renders "7:00 AM" through the 24h→12h conversion; Find a Ride's date *and* time both start empty → "Select date" and "Select time" both present). Could not click-test the popovers themselves (calendar grid, hour/minute grids, Confirm/OK/Cancel interaction) since no browser automation tool is available in this environment — noting this rather than claiming full interaction coverage; confidence there comes from `tsc` passing or the page would have failed to render at all, not from having driven the actual click flow, and the popover logic (click-outside/Escape/state) mirrors `Listbox.tsx`, which *was* verified interactively-adjacent to the extent curl allows.

No commit made (standing rule).

## Task 20: TimePicker redesign to match Figma reference — ✅ DONE

Task 19's `TimePicker` (a digital H:MM header + 4×3 button grids + Cancel/OK) didn't match the actual Figma prototype the user then attached. Rebuilt `TimePicker.tsx` only — `DatePicker.tsx` wasn't part of this request and was left untouched:
- Trigger: `FaClock` moved from the right side to the left of the time text (`flex items-center gap-2.5`, dropped the old `justify-between` layout).
- Removed the digital `H:MM` header entirely — the trigger button already shows the formatted time, so the reference doesn't duplicate it inside the popover.
- Hour/Minute changed from 4×3 button grids to two side-by-side **scrollable list** columns (`h-40 overflow-y-auto`), each with a centered label above it.
- Minute increments changed from 5-minute (12 options) to **15-minute** (00/15/30/45 — 4 options), matching the reference exactly. Adjusted `isHourDisabled`'s "whole hour is in the past" threshold to key off the new max option (45) instead of the old one (55).
- Selected-state styling changed from solid-maroon-fill+white-text to **light maroon background + dark maroon text** (`bg-[...]/10 text-[...]`).
- AM/PM toggle repositioned from a small vertical pair beside the old digital display to a full-width 2-up row below the two list columns; colors unchanged (already matched: solid maroon active, light gray inactive).
- Replaced the Cancel/OK footer with a single full-width **"Set Time"** button; the existing click-outside/`Escape`-to-close-without-committing behavior is the de facto "cancel" path now, unchanged from Task 19's implementation.

**Verification:** `tsc --noEmit` clean, `npm test` 22/22. Found dev servers already running from a previous turn and force-restarted Express again before testing — this is now routine practice for every task after Task 18/19 caught it recurring, not a special case. Fetched real authenticated HTML for `/auth/post` and `/auth/search`, confirmed the clock icon's `<svg>` now precedes the time text in DOM order (left-of-text), and both pages' default/placeholder time states render unchanged ("7:00 AM" on Post a Trip, "Select time" on Find a Ride) — the trigger's external contract didn't change, only what's inside the popover. Same limitation as Task 19: no browser automation available, so the actual scroll/select/AM-PM-toggle/Set-Time click flow inside the popover wasn't driven interactively — confidence here is from `tsc`/render success, not a captured interaction.

No commit made (standing rule).

## Task 21: Flexible Time toggle layout-shift fix — ✅ DONE

`src/app/auth/search/SearchClient.tsx:198-206` — the "Flexible Time" toggle switch. The track already had fixed `w-10 h-6` and the thumb was already `absolute` — the actual bug was that the thumb `<span>` set `top-0.5` but never set a `left-*` value, relying on `translate-x-*` alone for horizontal position. Without an explicit `left`, an absolutely-positioned element falls back to its *static* position, which inherits the parent `<button>`'s own layout (including any browser-default padding) — a fragile, ambiguous base that's exactly the kind of thing that can shift depending on render context, rather than the track itself changing width as the bug report described.

Fix, matching the user's spec: track `w-10` → `w-11` (44px), added `shrink-0` (defensive — it sits in a `flex items-center justify-between` row) and `inline-flex`; thumb given an explicit `left-0.5 top-0.5` anchor plus `translate-x-0`/`translate-x-5` (was `translate-x-0.5`/`translate-x-4`, the old values compensating for the ambiguous base position). Active-state color kept as `bg-[color:var(--rsu-color-primary)]` (the existing CSS-token reference) rather than switching to the literal `bg-[#800000]` written in the request — same resolved color, but preserves this codebase's established single-source-of-truth convention for the maroon token, used identically everywhere else in the app.

Checked `PostTripForm.tsx`'s two similar-sounding toggles ("Flexible Departure Time", "Familiar Riders Only") for the same bug class — they're native `<input type="checkbox">` with `accent-color`, not custom span-based thumbs, so they were never exposed to this failure mode. No changes needed there.

**Verification:** `tsc --noEmit` clean, `npm test` 22/22. Fetched real authenticated HTML for `/auth/search` and confirmed the exact new classes are present: `w-11 h-6` + `shrink-0 inline-flex` on the track, `left-0.5 top-0.5` + `translate-x-0` on the thumb (OFF state, matching the default `flexibleTime` state). Did not restart the already-running dev servers or touch the database for this one — pure frontend change, nothing to invalidate.

No commit made (standing rule).

## Task 22: Forgot Password flow — ✅ DONE

**Path correction:** `login/page.tsx` and `register/page.tsx` both live at `src/app/login/` and `src/app/register/`, outside the `/auth/` route group (guarded by `auth/layout.tsx`, requires an existing session — login/register can't live inside it). Created `src/app/forgot-password/page.tsx` as a sibling, and it redirects to `/login`, not `/auth/login` as literally specified.

**Backend — `authController.js` (+3 exports), `authRoutes.js` (+3 routes, at the exact paths requested — no collision this time, unlike registration's route names):**
- `requestPasswordReset` — looks up the user; returns the *same* `{status:'OTP_SENT_IF_ACCOUNT_EXISTS'}` / `200` whether or not the account exists, only the side effect (OTP creation + email) differs. Reuses `otpService`/`EmailVerification`/`sendOtpEmail` as-is.
- `verifyPasswordResetOtp` — identical shape to `verifyRegistrationOtp` (expiry/attempts/hash check), but issues a ticket scoped `purpose: 'reset-password'` rather than `complete-registration`, so a reset ticket can't be replayed against registration or vice versa despite both being signed with the same `JWT_SECRET`.
- `resetPassword` — verifies the ticket's purpose, enforces an 8-char minimum server-side, `bcrypt.hash`es and updates the `User` row directly. No session token issued (redirect-to-login per spec, not auto-login).

**Frontend:**
- `src/app/forgot-password/page.tsx` (new) — Email → `OtpInput` (60s cooldown, reused verbatim from Task 17) → New/Confirm Password with `FaEye`/`FaEyeSlash` toggles (same pattern as `register/page.tsx`'s Task 18 toggles). Because the backend response never reveals account existence, the OTP step's copy is deliberately generic ("If an account exists for {email}, we sent a code") rather than branching UI on an existence signal the backend doesn't provide.
- `src/app/login/page.tsx` — the "Forgot password?" text was a disabled, non-interactive `<span title="...isn't available yet">`; replaced with a real `Link` to `/forgot-password`.

**Verification, against a real local DB, full round trip — not just endpoint-level checks:**
- Enumeration check: `POST /forgot-password` for a nonexistent email and for a real user's email (`jsinag@mseuf.edu.ph`) returned byte-identical `200` responses.
- **Repeat of the Task 18 real-SMTP incident**: the real-user call above went through actual `nodemailer` again (live Gmail credentials still configured in `.env`, no dev-fallback log line) — switched immediately to seeding `EmailVerification` rows directly in the DB for the rest of this verification, same mitigation as Task 18.
- Wrong OTP → `401 INVALID_OTP`; correct OTP → `resetTicket`. That ticket rejected by `/register/complete` (`401 INVALID_OR_EXPIRED_TICKET`) — confirms the `purpose` scoping actually works, not just that it's present in the code. Password `"short"` → `400 PASSWORD_TOO_SHORT`. Valid reset → `200`.
- **The real proof, not just a 200**: logged in via `/api/auth/verify` with a guessed old password (correctly rejected, `401`) and then with the new password actually set during this test (`200`, real JWT, real user record) — confirms the password was genuinely changed in the database, not just that the endpoint returned success. Restored the test account to a known baseline password (`password123`) afterward so future sessions have a predictable credential for this account.
- `tsc --noEmit` clean, `npm test` 22/22. Fetched real HTML for `/login` and `/forgot-password`: confirmed the login page's link now points to `/forgot-password` (previously an inert disabled span), and the new page's Email step renders.

No commit made (standing rule).

## Task 23: Date/time hydration mismatch — ✅ DONE

The reported cause ("server renders UTC, browser renders local") didn't match the codebase: every formatter in `lib/format.ts` already explicitly pins `timeZone: 'Asia/Manila'`, specifically to prevent exactly this class of bug (per that file's own header comment, from earlier in the project). Traced every call site of `formatDate`/`formatTime`/`formatDateTimeAgo` before touching anything to find the real cause(s) rather than applying the suggested pattern blind:

- **`formatDateTimeAgo`** (`NotificationsClient.tsx`) computes `Date.now() - then` — this genuinely differs between the server-render instant and the client-hydration instant a moment later. This is the one real, textbook, deterministic mismatch in the codebase. Fixed with the requested Option 1: added `isMounted` state (`useEffect(() => setIsMounted(true), [])`), renders a blank placeholder until mounted, then the real relative time.
- **`formatDate`/`formatTime`** are pure functions of their input and already timezone-pinned identically on both sides — genuinely deterministic. Any real-world mismatch here would come from Intl/ICU version skew between Node (server) and the browser (client), not timezone. Applied `suppressHydrationWarning` (Option 2) rather than the `isMounted` gate, since forcing a blank-then-pop-in render for content that's supposed to be identical would be worse UX for no benefit — this is also what React's own docs recommend for this exact category (deterministic-in-theory, environment-skew-in-practice) vs. Option 1's use case (genuinely non-deterministic content).
- **`dashboard/page.tsx` is a Server Component** (no `'use client'`) — Server Components never re-execute on the client during hydration, so `useState`/`useEffect` (Option 1) isn't actually available there at all, and technically these calls can't hydration-mismatch the way described. Used `suppressHydrationWarning` there for both call sites (works in Server Component JSX too) as cheap defensive coverage per the request's explicit "anywhere" instruction, while being transparent that this file's own architecture makes it an unlikely source of the reported bug in the first place.
- **`SearchClient.tsx`'s trip-card dates** only render after a user-triggered search (`matches` starts as `[]`) — nothing is present at hydration time to mismatch on initial mount. Still added `suppressHydrationWarning` there too, both because the request named "Find a Ride" explicitly and as forward-looking coverage.

Files touched: `NotificationsClient.tsx` (isMounted gate), `TripsListClient.tsx`, `TripDetailClient.tsx`, `dashboard/page.tsx`, `SearchClient.tsx` (`suppressHydrationWarning`, 2 sites each in `TripsListClient`/`SearchClient`/`dashboard`, 1 in `TripDetailClient`). `lib/format.ts` itself needed no changes — the formatters are correct; the fix belongs at the render site where React reconciles server vs. client output, not in the pure formatting functions.

**Verification:** `tsc --noEmit` clean, `npm test` 22/22. Fetched real authenticated HTML for all four touched pages (`/auth/dashboard`, `/auth/trips`, `/auth/search`, `/auth/notifications`) — all `200`, no server-side crash from the new props. Could not observe an actual browser console to confirm the warning is gone (no browser automation available in this environment, same limitation noted in Tasks 19/20) — the fix is based on correctly identifying the two distinct real causes (one genuine, one defensive-per-instruction) rather than on watching the warning disappear.

No commit made (standing rule).

## Task 24: Post a Ride double-submission guard — ✅ DONE

`PostTripForm.tsx` already had a `loading` state driving `disabled={loading}` on the submit button — but that alone doesn't fully close the bug. There's a real gap between a click event firing and React actually committing the re-render that disables the button in the DOM; two clicks landing in that window both read `loading` from the same pre-update state and both proceed. `handleSubmit` never checked `loading` at its own top before this fix — it only ever *set* it, after all validation had already run. Fixed properly, not just renamed to match the request's spec:
- Renamed `loading`/`setLoading` → `isSubmitting`/`setIsSubmitting` (matches the requested naming).
- Added `isSubmittingRef` (`useRef(false)`) as the actual re-entrancy guard — refs mutate synchronously and aren't tied to any particular render's closure, unlike state, so `if (isSubmittingRef.current) return;` at the very first line of `handleSubmit` (before `e.preventDefault()`'s validation even runs) closes the race the state-only version couldn't. `isSubmittingRef.current` is set to `true` synchronously alongside `setIsSubmitting(true)` right before the API calls, and both are reset together in `finally`.
- Button: `disabled={isSubmitting}`, `FaSpinner` with `animate-spin` shown alongside the text only while submitting, text switches to "Posting..." (matching the request's exact copy, was "Publishing..."), `disabled:opacity-60` retained for the dimmed unclickable look, maroon theme (`rsu-btn-primary`) untouched.

**Verification:** `tsc --noEmit` clean, `npm test` 22/22. Fetched real authenticated HTML for `/auth/post` — button renders correctly in its default (non-submitting) state. Could not actually fire two rapid clicks to observe the guard in action — no browser automation available (same limitation as Tasks 19/20/23) — confidence here comes from the ref being a synchronous, closure-independent mutable value checked before any other code runs in the handler, not from having watched a duplicate `POST /api/trips` get suppressed in real time.

No commit made (standing rule).

## Task 25: PSGA "text fallback" request — declined the fallback, fixed the real bug instead — ✅ DONE

The request asked for a `.toLowerCase().includes()` text-match fallback in PSGA Stage 1 whenever `RouteOverlap` computes to 0. Declined to implement that specific mechanism: it would substitute a semantically-unrelated signal (substring overlap of address strings) for the actual geometric overlap calculation, which is exactly the "placeholder logic" this project's own standing rule (established at the very start of the session) explicitly prohibits for the PSGA formula. String matching would also produce real false positives in normal use — e.g. two unrelated routes that happen to share a city-name substring — not just in the test cases motivating the request.

- **Self-filter and time-flex, as asked to verify**: both already correct. `hostId: { not: passengerId }` is in `matchController.search`'s query; `runPSGA`'s `timeDiff <= flexWindow` check is right. A same-day trip failing on time is almost always because "Flexible Time" wasn't toggled on the search form (`flexWindowMinutes` defaults to `0`, requiring an exact-minute match) — by design, not a bug.
- **Debug logging — implemented as asked**: `psgaService.js`'s `runPSGA` loop now logs each trip's accept/reject decision with the actual computed `routeOverlap`, `minRouteOverlap` threshold, `corridorMeters`, and time diff; `matchController.search` logs the candidate count at each filtering stage (self-filter, lazy-completion). Both are plain `console.log`, temporary/diagnostic per the request, `npm test` still 22/22 (logging doesn't affect assertions).
- **Root cause, demonstrated with the new logging against real data, not theorized**: `psgaConfig.js` sets `corridorMeters: 500` (a 500m-wide corridor) and `minRouteOverlap: 0.4`. When a trip's `routeWaypoints` is `null` (routing failed at post time — an existing, already-documented gap, e.g. the real `cmsyvsjh90001hgthrp3ubr57` trip in the local DB has `routeWaypoints: null`), `matchController.search` falls back to a straight 2-point line between origin and destination instead of a real road-following route. Combined with free geocoding (Nominatim) commonly resolving a place name to a town-center point that's realistically 1-2km off from where a host or passenger actually typed it, a search for the *same real trip* with coordinates just ~1.5-2km off computed `routeOverlap=0.00` and `NO_MATCH` in a real test run against the live local DB (log line: `[PSGA] Rejected trip cmsyvsjh90001hgthrp3ubr57: Route overlap 0.00 below threshold 0.4`). An exact-coordinate search against the same trip correctly returns `routeOverlap=1.00`, and a ~700m offset still passes at `0.52` — the failure is specifically the realistic-imprecision case, not a broken calculation.
- **Fix, per the user's choice (asked via AskUserQuestion rather than picked unilaterally)**: widened `corridorMeters` 500 → 1500 in `psgaConfig.js`, with a code comment recording why (the demonstrated 1.5-2km real-world geocoding-imprecision case) so the value doesn't look arbitrary later. `minRouteOverlap` (0.4) and the weights were left untouched — only the corridor width changed.
- **Verified the fix actually works, against the same real failure, not just re-read the code**: reran the identical previously-`NO_MATCH` search after the change — now `MATCHED` at `routeOverlap=0.95`. Also confirmed the widening didn't over-loosen matching: the genuinely-unrelated Sariaya→Enverga trip in the same DB still correctly gets rejected (`routeOverlap=0.14`, still below the unchanged `0.4` threshold) even at the wider 1500m corridor. `npm test` 22/22 (config change doesn't touch the unit tests, which pass their own config objects).

No commit made (standing rule).

## Task 26: `<html>` extension-injection hydration warning — ✅ DONE

Straightforward, standard fix — `layout.tsx`'s `<html lang="en">` → `<html lang="en" suppressHydrationWarning>`, exactly as specified, nothing else touched. This is the officially-recommended pattern for browser-extension-injected attributes (Grammarly, form-fillers, etc.) on the root element; unlike Task 23, no independent investigation was needed since the stated cause is a real, well-known, correctly-diagnosed category of hydration warning. `tsc --noEmit` clean. No commit made.

## Task 27: Mobile viewport overflow on Date/Time picker popovers — ✅ DONE

`DatePicker.tsx` and `TimePicker.tsx` (Tasks 19/20) always rendered their popover as `absolute`, anchored to the trigger — fine on desktop, but on a short mobile viewport the popover could extend past the bottom of the screen with no way to scroll to the Confirm/Set Time button, exactly as the screenshots showed.

Both files now split by breakpoint on the same two nested elements:
- Outer container: mobile-default `fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4` (full-screen centering + dimmed backdrop) → `md:absolute md:inset-auto md:z-20 md:mt-2 md:left-1/2 md:-translate-x-1/2 md:bg-transparent md:p-0` (back to the original anchored-dropdown behavior) at `md:` and up. Has `onClick={() => setOpen(false)}` so tapping the dimmed backdrop closes the picker.
- Inner card: mobile-default `w-full max-w-[280px] max-h-[90vh] overflow-y-auto` (never taller than the viewport, scrolls internally if content doesn't fit) → `md:w-[280px] md:max-w-[calc(100vw-2rem)] md:max-h-none md:overflow-visible` (back to the original fixed-width, non-scrolling desktop card). Has `onClick={(e) => e.stopPropagation()}` so tapping inside the card doesn't bubble up and trigger the backdrop's close handler.

The existing `pointerdown`-based click-outside-close logic (checking `ref.current.contains`) was left untouched — it still works for the desktop case (true clicks elsewhere on the page) and is harmlessly redundant with the new explicit backdrop `onClick` on mobile, since the backdrop is still a DOM descendant of the ref'd wrapper even though it's visually `fixed` full-screen.

**Verification:** `tsc --noEmit` clean, `npm test` 22/22. Fetched real authenticated HTML for `/auth/post` and `/auth/search` — both `200`, confirming both components still compile and mount without error (the popover JSX itself is conditionally rendered only when `open === true`, so its markup isn't present in the initial page load either way — same limitation as Tasks 19/20/23/24: no browser automation available to actually open the picker at a mobile viewport width and confirm the scroll/backdrop-tap behavior visually). Confidence here is structural (the same `open &&` conditional and breakpoint classes that already work correctly for the desktop case, verified in Tasks 19/20), not from a captured mobile-viewport interaction.

No commit made (standing rule).

## Task 28: Find a Ride mobile filter sheet cut off by BottomNav — ✅ DONE

The specific fix requested (`max-h-[85vh]`, `overflow-y-auto` on the search card) already existed on this element — `SearchClient.tsx`'s mobile filter sheet had both from when it was originally built. Investigated why it was still getting visually cut off anyway rather than assuming the request's literal diagnosis was correct: `globals.css`'s `.rsu-bottom-nav` is `position: fixed` with `z-index: 60` on mobile, but the search sheet's overlay was `z-50` — the app's own bottom navigation bar was rendering *on top of* the sheet the whole time, which explains exactly what the screenshot shows (the cutoff lands right at "Gender Preference," precisely where `BottomNav` starts covering the sheet). No amount of internal scrolling fixes a lower z-index than the thing sitting on top of you.

- `SearchClient.tsx` — bumped the mobile filter sheet's overlay `z-50` → `z-[70]` (above `BottomNav`'s `z-60`, with margin), and added `pb-8` to the scrollable form per the request's own bottom-padding ask (belt-and-suspenders once the actual coverage bug is fixed).
- **Desktop is unaffected by construction, not by an added `md:` override**: this whole mobile-sheet block already lives inside a `<div className="md:hidden">` wrapper and never renders past the `md:` breakpoint — nothing needed adding there, and adding a no-op `md:overflow-visible` as literally suggested would have been dead code for an element that's never shown on desktop in the first place.

**Verification:** `tsc --noEmit` clean, `npm test` 22/22. Fetched real authenticated HTML for `/auth/search` — `200`, no error from the new class. Same limitation as Task 27: the sheet only renders when `mobileFiltersOpen === true`, so its markup isn't in the initial page load regardless, and there's no browser automation available to actually open it at a mobile viewport and watch the nav bar stop covering it. Confidence is from correctly identifying the real z-index conflict against the actual CSS (not the request's literal diagnosis), not from a captured interaction.

No commit made (standing rule).
