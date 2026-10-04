# Women+ Trips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace "same-gender only" with enforced Women+ trips, inclusive self-declared gender options, enforced "familiar riders only", and no gender in API responses.

**Architecture:** One pure rules module (`server/services/riderRules.js`, mirrored in `src/lib/riderRules.ts`) decides who may join and who may host. A small loader (`riderFacts`) reads the facts it needs from the DB. Every server entry point (search, show-all, join, approve, trip create/edit/detail, preferences, gender change) calls it. PSGA's formula is unchanged; safety rules become pre-filters before scoring.

**Tech Stack:** Express 5, Prisma 7 + PostgreSQL 17, Jest 30 (server against the real DB, web via `jest.web.config.mjs`), Next.js 16 App Router, Python 3 unittest, Postman/newman.

**Spec:** `docs/superpowers/specs/2026-10-02-women-plus-ride-preferences-design.md` (D1–D10, scenarios S1–S27).

## Global Constraints

- Gender values: `WOMAN`, `MAN`, `NON_BINARY`, `PREFER_NOT_TO_SAY`. Women+ eligible: `WOMAN`, `NON_BINARY`.
- `GenderPreference` enum: `ANY` | `WOMEN_PLUS`. `SAME_GENDER` is removed.
- Gender stays AES-256-GCM encrypted at rest (`encryptField` / `decryptUserFields`).
- Gender is returned only on your own `GET /api/users/:id` and the admin user detail (D10). Never anywhere else.
- Changing gender is never written to the security log.
- Error codes (exact): `TRIP_WOMEN_PLUS_ONLY` (403), `TRIP_FAMILIAR_RIDERS_ONLY` (403), `RIDER_NO_LONGER_ELIGIBLE` (409), `WOMEN_PLUS_HOST_NOT_ELIGIBLE` (403), `WHO_CAN_JOIN_LOCKED` (409), `WOMEN_PLUS_NOT_ELIGIBLE` (403, preferences), `INVALID_GENDER` (400), `HOSTING_WOMEN_PLUS_TRIPS` (409), `CONFIRM_WITHDRAW_PENDING` (409).
- Copy (exact):
  - Help text: "Used only for Women+ trips. Never shown to other users. You can change it anytime."
  - Warning: "**This trip is open to everyone.** You chose Women+ trips only. Other riders on this trip could be any gender." Buttons: "Cancel", "Request anyway".
  - Badges: "Women+ trip", "Familiar riders only".
  - Driver option: "Women+ only (women and non-binary riders)".
  - Empty state: "Also show trips open to everyone".
  - D7: "You're hosting Women+ trips. Finish or cancel them first."
  - D9: "Harassment, including about gender or identity".
- Commits: author `Xyrus <xyrusdimacali@gmail.com>`, short imperative subject, no AI trailers. No push.

---

## File map

| File | Responsibility |
|---|---|
| `server/services/riderRules.js` (new) | Pure rules: `normalizeGender`, `isWomenPlusEligible`, `canHostWomenPlus`, `joinBlockReason`, `canJoin`, `effectivePreference`, constants |
| `server/services/riderFacts.js` (new) | DB loader: `riderFacts(db, riderId, hostId)` → `{ gender, familiarWithHost }` |
| `server/services/genderChangeService.js` (new) | `changeGender(userId, gender, { confirm })` with D7/D8 |
| `server/scripts/migrateWomenPlus.js` (new) | One-time, idempotent data migration |
| `server/config/safeUserSelect.js` | Drop `gender` |
| `server/controllers/matchController.js` | Search pre-filter, join 403s, approve 409 |
| `server/services/psgaService.js` | `checkPreferenceMatch` uses `riderEligible` |
| `server/controllers/tripController.js` | Create/edit host rule, D3 lock, S13 declines, detail 404 |
| `server/services/tripValidation.js` | `GENDER_PREFERENCES = ['ANY', 'WOMEN_PLUS']` |
| `server/controllers/preferenceController.js` | Validate/normalize preference |
| `server/controllers/userController.js`, `server/routes/userRoutes.js` | Own gender on own profile, `PATCH /me/gender` |
| `server/controllers/authController.js` | Registration gender values |
| `server/services/accountDeletionService.js` | Erase to `PREFER_NOT_TO_SAY` |
| `server/controllers/admin/userController.js` | Admin detail keeps gender (D10) |
| `server/services/reportEnforcementService.js`, `src/lib/format.ts` | D9 label |
| `src/lib/riderRules.ts` (new) | UI mirror: options, labels, eligibility, warning rule, badges |
| `src/components/RuleBadges.tsx` (new) | The two rule badges |
| `src/components/OpenTripWarning.tsx` (new) | The join warning dialog |
| Register, Profile, PostTripForm, edit page, SearchClient, search page, RideDetailClient, TripDetailClient, RequestToJoinModal, admin user page | UI |
| `validation/*.py`, `validation/labeling/*` | Women+ semantics, regenerated artifacts |
| `postman/*`, `server/scripts/seedPostman.js`, `server/scripts/seedDemo.js`, `server/scripts/loadTest.js`, `server/test-helpers/seed.js` | Seeds and API suite |
| `AGENTS.md`, `docs/thesis/thesis-proposal.md`, `docs/security/owasp-top10-review.md` | Docs |

---

### Task 1: Rules module and privacy

**Files:**
- Create: `server/services/riderRules.js`, `server/services/riderFacts.js`, `server/services/__tests__/riderRules.test.js`, `server/__tests__/genderPrivacy.test.js`
- Modify: `server/config/safeUserSelect.js`, `server/controllers/userController.js` (getById), `server/controllers/admin/userController.js` (getUserDetail)

**Interfaces:**
- Produces: `normalizeGender(v: string|null): Gender` (maps legacy `FEMALE`→`WOMAN`, `MALE`→`MAN`, unknown→`PREFER_NOT_TO_SAY`); `isWomenPlusEligible(gender): boolean`; `canHostWomenPlus(host: {gender}): boolean`; `joinBlockReason(trip: {genderPreference, familiarRidersOnly}, rider: {gender, familiarWithHost}): null | 'TRIP_WOMEN_PLUS_ONLY' | 'TRIP_FAMILIAR_RIDERS_ONLY'`; `canJoin(trip, rider): boolean`; `effectivePreference(pref, gender): 'ANY'|'WOMEN_PLUS'`; `GENDERS`, `GENDER_PREFERENCES`.
- Produces: `riderFacts(db, riderId, hostId): Promise<{ gender: Gender, familiarWithHost: boolean } | null>`.

- [ ] **Step 1: Write the failing unit test** `server/services/__tests__/riderRules.test.js`

```js
const r = require('../riderRules');

describe('riderRules', () => {
  test('normalizeGender maps legacy and unknown values', () => {
    expect(r.normalizeGender('FEMALE')).toBe('WOMAN');
    expect(r.normalizeGender('MALE')).toBe('MAN');
    expect(r.normalizeGender('UNSPECIFIED')).toBe('PREFER_NOT_TO_SAY');
    expect(r.normalizeGender('NON_BINARY')).toBe('NON_BINARY');
    expect(r.normalizeGender(null)).toBe('PREFER_NOT_TO_SAY');
  });

  test('women and non-binary users are Women+ eligible', () => {
    expect(r.isWomenPlusEligible('WOMAN')).toBe(true);
    expect(r.isWomenPlusEligible('NON_BINARY')).toBe(true);
    expect(r.isWomenPlusEligible('MAN')).toBe(false);
    expect(r.isWomenPlusEligible('PREFER_NOT_TO_SAY')).toBe(false);
    expect(r.canHostWomenPlus({ gender: 'NON_BINARY' })).toBe(true);
    expect(r.canHostWomenPlus({ gender: 'MAN' })).toBe(false);
  });

  const open = { genderPreference: 'ANY', familiarRidersOnly: false };
  const wplus = { genderPreference: 'WOMEN_PLUS', familiarRidersOnly: false };
  const familiar = { genderPreference: 'ANY', familiarRidersOnly: true };

  test('S1/S3/S4/S5: Women+ trips only take eligible riders', () => {
    expect(r.joinBlockReason(wplus, { gender: 'MAN', familiarWithHost: false })).toBe('TRIP_WOMEN_PLUS_ONLY');
    expect(r.joinBlockReason(wplus, { gender: 'PREFER_NOT_TO_SAY', familiarWithHost: false })).toBe('TRIP_WOMEN_PLUS_ONLY');
    expect(r.canJoin(wplus, { gender: 'NON_BINARY', familiarWithHost: false })).toBe(true);
    expect(r.canJoin(open, { gender: 'MAN', familiarWithHost: false })).toBe(true);
  });

  test('S10/S11: familiar-riders-only needs a completed ride with the host', () => {
    expect(r.joinBlockReason(familiar, { gender: 'WOMAN', familiarWithHost: false })).toBe('TRIP_FAMILIAR_RIDERS_ONLY');
    expect(r.canJoin(familiar, { gender: 'MAN', familiarWithHost: true })).toBe(true);
  });

  test('S24: unknown or ineligible preferences become ANY', () => {
    expect(r.effectivePreference('SAME_GENDER', 'WOMAN')).toBe('ANY');
    expect(r.effectivePreference('WOMEN_PLUS', 'MAN')).toBe('ANY');
    expect(r.effectivePreference('WOMEN_PLUS', 'WOMAN')).toBe('WOMEN_PLUS');
    expect(r.effectivePreference(undefined, 'WOMAN')).toBe('ANY');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails** — `npx jest server/services/__tests__/riderRules.test.js` → "Cannot find module '../riderRules'".

- [ ] **Step 3: Implement** `server/services/riderRules.js`

```js
// Who may join and who may host a trip. Pure functions, so every entry point
// (search, show-all, join, approve, trip create/edit/detail, preferences)
// applies the same rule. Mirrored for the UI in src/lib/riderRules.ts.
const GENDERS = ['WOMAN', 'MAN', 'NON_BINARY', 'PREFER_NOT_TO_SAY'];
const WOMEN_PLUS_GENDERS = ['WOMAN', 'NON_BINARY'];
const GENDER_PREFERENCES = ['ANY', 'WOMEN_PLUS'];
const LEGACY_GENDERS = { FEMALE: 'WOMAN', MALE: 'MAN', UNSPECIFIED: 'PREFER_NOT_TO_SAY' };

function normalizeGender(value) {
  if (GENDERS.includes(value)) return value;
  return LEGACY_GENDERS[value] || 'PREFER_NOT_TO_SAY';
}

function isWomenPlusEligible(gender) {
  return WOMEN_PLUS_GENDERS.includes(normalizeGender(gender));
}

function canHostWomenPlus(host) {
  return Boolean(host) && isWomenPlusEligible(host.gender);
}

// Worded around the trip's rule, never another person's gender.
function joinBlockReason(trip, rider) {
  if (trip.genderPreference === 'WOMEN_PLUS' && !isWomenPlusEligible(rider.gender)) return 'TRIP_WOMEN_PLUS_ONLY';
  if (trip.familiarRidersOnly && !rider.familiarWithHost) return 'TRIP_FAMILIAR_RIDERS_ONLY';
  return null;
}

function canJoin(trip, rider) {
  return joinBlockReason(trip, rider) === null;
}

// A stored or submitted "Trips I see" value, made safe: anything unknown, and
// Women+ for someone who isn't eligible, reads as ANY.
function effectivePreference(pref, gender) {
  return pref === 'WOMEN_PLUS' && isWomenPlusEligible(gender) ? 'WOMEN_PLUS' : 'ANY';
}

module.exports = {
  GENDERS,
  GENDER_PREFERENCES,
  normalizeGender,
  isWomenPlusEligible,
  canHostWomenPlus,
  joinBlockReason,
  canJoin,
  effectivePreference,
};
```

`server/services/riderFacts.js`:

```js
const { decryptUserFields } = require('./encryptionService');
const { normalizeGender } = require('./riderRules');

// The facts riderRules needs about one rider and one host, read from the DB —
// never from the client. Returns null if the rider doesn't exist.
async function riderFacts(db, riderId, hostId) {
  const raw = await db.user.findUnique({ where: { id: riderId }, select: { gender: true } });
  if (!raw) return null;
  const prior = await db.match.findFirst({
    where: { passengerId: riderId, status: 'COMPLETED', trip: { hostId } },
    select: { id: true },
  });
  return { gender: normalizeGender(decryptUserFields(raw).gender), familiarWithHost: prior != null };
}

module.exports = { riderFacts };
```

- [ ] **Step 4: Run** the unit test → PASS.

- [ ] **Step 5: Write the failing privacy test** `server/__tests__/genderPrivacy.test.js` (S26). Seed a host (WOMAN), a passenger (MAN), a trip and an approved match with `test-helpers/seed`; then, as the passenger, call and assert `JSON.stringify(body)` has no `"gender"` key for: `GET /api/trips/:id`, `GET /api/trips/mine` (as host), `GET /api/users/<hostId>`, `POST /api/matches/search` (route matching the trip), `GET /api/trips/:id/messages` if it embeds users. As the host, `GET /api/users/<hostId>` **does** contain `gender: 'WOMAN'`. As an admin (`makeAdminUser`), `GET /api/admin/users/<passengerId>` contains `gender: 'MAN'`.

```js
const noGender = (body) => expect(JSON.stringify(body)).not.toMatch(/"gender"/);
```

Use the `dbUp` guard and `json(method, path, userId, body)` helper exactly as `server/__tests__/tripsAuth.test.js` does.

- [ ] **Step 6: Run** → FAIL (gender present).

- [ ] **Step 7: Implement privacy**
  - `server/config/safeUserSelect.js`: delete `gender: true,` and add a comment line: "gender is deliberately absent: it's returned only on your own profile and to admins (Women+ spec §6)."
  - `server/controllers/userController.js` getById: select `{ ...safeUserSelect, isAdmin: true, gender: true }`; destructure `const { email, isAdmin, gender, ...rest } = user;` and set `const visible = isOwnProfile ? { ...user, gender: normalizeGender(gender) } : rest;` (require `normalizeGender` from riderRules).
  - `server/controllers/admin/userController.js` getUserDetail: add `gender: true` to the select and return `gender: normalizeGender(decrypted.gender)` in the user object (follow how the function already decrypts `fullName`).

- [ ] **Step 8: Run** `npx jest server/__tests__/genderPrivacy.test.js server/__tests__/userRatings.test.js server/__tests__/adminUsers*.test.js` → PASS. If an existing test asserted `gender` on someone else's record, update it to assert absence.

- [ ] **Step 9: Commit** `feat: add rider rules and stop returning gender to other users`

---

### Task 2: Schema, migration and seeds

**Files:**
- Modify: `prisma/schema.prisma` (enum + `User.gender` comment), `server/services/tripValidation.js:11`, `server/controllers/authController.js:139`, `server/services/accountDeletionService.js:104`, `server/test-helpers/seed.js:12`, `server/scripts/seedPostman.js:99`, `server/scripts/seedDemo.js` (PEOPLE genders, lines 275 and 310), `server/scripts/loadTest.js:162,211`, `package.json` (script)
- Create: `server/scripts/migrateWomenPlus.js`, `server/scripts/__tests__/migrateWomenPlus.test.js`
- Tests touched: `server/__tests__/authFlows.test.js`, `server/__tests__/tripsAuth.test.js`, `server/services/__tests__/tripUpdateService.test.js:85`, `server/__tests__/preferencesAuth.test.js`

**Interfaces:**
- Produces: `migrateWomenPlus(db): Promise<{ users, tripsWomenPlus, tripsOpened, prefsWomenPlus, prefsAny }>` (exported for the test; the CLI calls it).

- [ ] **Step 1: Back up** — `node scripts/backup-db.mjs`.

- [ ] **Step 2: Write the failing migration test.** It runs only when the DB still accepts `SAME_GENDER` (`SELECT unnest(enum_range(NULL::"GenderPreference"))::text`); otherwise it seeds rows through raw SQL after the enum has `WOMEN_PLUS`. Seed (encrypted genders): woman host with a `SAME_GENDER` trip, man host with a `SAME_GENDER` trip, a woman's and a man's `SAME_GENDER` preference, a user with legacy `UNSPECIFIED`. Assert after `migrateWomenPlus(prisma)`:
  - woman's trip → `WOMEN_PLUS`; man's trip → `ANY` and he has one `TRIP_UPDATED` notification containing "Same-gender trips are now Women+ trips";
  - woman's preference → `WOMEN_PLUS`, man's → `ANY`;
  - genders decrypt to `WOMAN`, `MAN`, `PREFER_NOT_TO_SAY`;
  - running it a second time changes nothing (all counts 0).

  Seeding `SAME_GENDER` requires raw SQL (`INSERT ... '"SAME_GENDER"'::"GenderPreference"`) because the generated client won't know the value. Because Task 2 removes `SAME_GENDER` from the DB at Step 6, this test checks the **post-push** state with `test.skip` when `SAME_GENDER` isn't in the enum, and is run for real at Step 5 before the push.

- [ ] **Step 3: Implement** `server/scripts/migrateWomenPlus.js`

```js
// One-time move from "same-gender only" to Women+ (spec §4). Idempotent:
// rows already on the new values are left alone. Back up first:
//   node scripts/backup-db.mjs && npm run migrate-women-plus && npx prisma db push
require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { encryptField, decryptField } = require('../services/encryptionService');
const { normalizeGender, isWomenPlusEligible } = require('../services/riderRules');

async function genderOf(db, userId) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { gender: true } });
  return u ? normalizeGender(decryptField(u.gender)) : 'PREFER_NOT_TO_SAY';
}

async function migrateWomenPlus(db) {
  const counts = { users: 0, tripsWomenPlus: 0, tripsOpened: 0, prefsWomenPlus: 0, prefsAny: 0 };
  // Postgres can't use a new enum value in the transaction that adds it, so this
  // runs on its own before anything reads WOMEN_PLUS.
  await db.$executeRawUnsafe(`ALTER TYPE "GenderPreference" ADD VALUE IF NOT EXISTS 'WOMEN_PLUS'`);

  const users = await db.user.findMany({ select: { id: true, gender: true } });
  for (const u of users) {
    const old = decryptField(u.gender);
    const next = normalizeGender(old);
    if (old !== next) {
      await db.user.update({ where: { id: u.id }, data: { gender: encryptField(next) } });
      counts.users += 1;
    }
  }

  const trips = await db.$queryRawUnsafe(
    `SELECT id, "hostId", "destinationAddress" FROM "Trip" WHERE "genderPreference"::text = 'SAME_GENDER'`
  );
  for (const t of trips) {
    const womenPlus = isWomenPlusEligible(await genderOf(db, t.hostId));
    await db.$executeRawUnsafe(
      `UPDATE "Trip" SET "genderPreference" = $1::"GenderPreference" WHERE id = $2`,
      womenPlus ? 'WOMEN_PLUS' : 'ANY',
      t.id
    );
    if (womenPlus) {
      counts.tripsWomenPlus += 1;
    } else {
      counts.tripsOpened += 1;
      await db.notification.create({
        data: {
          userId: t.hostId,
          type: 'TRIP_UPDATED',
          relatedTripId: t.id,
          message: `Same-gender trips are now Women+ trips. Your trip to ${decryptField(t.destinationAddress)} is open to everyone; edit it if you want to change who can join.`,
        },
      });
    }
  }

  const prefs = await db.$queryRawUnsafe(
    `SELECT "userId" FROM "Preference" WHERE "genderPreference"::text = 'SAME_GENDER'`
  );
  for (const p of prefs) {
    const womenPlus = isWomenPlusEligible(await genderOf(db, p.userId));
    await db.$executeRawUnsafe(
      `UPDATE "Preference" SET "genderPreference" = $1::"GenderPreference" WHERE "userId" = $2`,
      womenPlus ? 'WOMEN_PLUS' : 'ANY',
      p.userId
    );
    counts[womenPlus ? 'prefsWomenPlus' : 'prefsAny'] += 1;
  }
  return counts;
}

if (require.main === module) {
  migrateWomenPlus(prisma)
    .then((c) => {
      console.log(JSON.stringify(c));
      return prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}

module.exports = { migrateWomenPlus };
```

(Check `decryptField` exists in `encryptionService.js`; if only `decryptUserFields` is exported, use `decryptUserFields({ gender }).gender`. Confirm the table names are the Prisma model names — the schema has no `@@map`.)

Add to `package.json` scripts: `"migrate-women-plus": "node server/scripts/migrateWomenPlus.js"`.

- [ ] **Step 4: Run the migration test** → PASS, then run `npm run migrate-women-plus` on the dev DB and record the counts.

- [ ] **Step 5: Change the schema**: `enum GenderPreference { ANY WOMEN_PLUS }`; `User.gender` comment → "WOMAN / MAN / NON_BINARY / PREFER_NOT_TO_SAY, self-declared; drives Women+ eligibility only (riderRules.js)". Run `npx prisma db push` then `npx prisma generate`. It must not report data loss; if it does, stop — a `SAME_GENDER` row was missed.

- [ ] **Step 6: Update writers of gender and preference values**
  - `tripValidation.js`: `const { GENDER_PREFERENCES } = require('./riderRules');` replacing the local constant.
  - `authController.js:139`: `gender: encryptField(GENDERS.includes(gender) ? gender : 'PREFER_NOT_TO_SAY')` (require `GENDERS`).
  - `accountDeletionService.js:104`: `encryptField('PREFER_NOT_TO_SAY')`.
  - `test-helpers/seed.js`: default `gender = 'MAN'`.
  - `seedPostman.js:99`: `'MAN'`; `loadTest.js`: `'MAN'`/`'WOMAN'`.
  - `seedDemo.js`: PEOPLE `MALE`→`MAN`, `FEMALE`→`WOMAN`; make **Bea** `NON_BINARY` (demo coverage for S4); line 275 → `'WOMEN_PLUS'`; line 310 Ana's trip → `'WOMEN_PLUS'`.
  - Tests: `authFlows.test.js` sends `'MAN'`/`'WOMAN'` and stores `'PREFER_NOT_TO_SAY'`; add one assertion that registering with `'FEMALE'` stores `PREFER_NOT_TO_SAY` (legacy clients get the safe default). `tripsAuth.test.js:122` keeps `MALE_ONLY` and adds `[{ genderPreference: 'SAME_GENDER' }, 'genderPreference']` (S23). `tripUpdateService.test.js:85` → `'WOMEN_PLUS'`. `preferencesAuth.test.js` → `'WOMEN_PLUS'` with a WOMAN user (seed with `gender: 'WOMAN'`).

- [ ] **Step 7: Run** `npm run test:server` (or `npx jest server`) → all pass except tests Task 3–6 will rewrite (`matchShowAll`, `psgaService` same-gender cases). Note them; don't skip.

- [ ] **Step 8: Reseed demo** — start nothing; run `DATABASE_URL=postgres://postgres:postgres@localhost:5432/rideshare_demo npx prisma db push` then `npm run seed:demo` against the demo DB.

- [ ] **Step 9: Commit** `feat: switch gender options to Women+ and migrate same-gender data`

---

### Task 3: Search and Show all pre-filter

**Files:**
- Modify: `server/controllers/matchController.js` (`loadSearchCandidates`), `server/services/psgaService.js` (`checkPreferenceMatch` and comments)
- Test: `server/__tests__/matchShowAll.test.js` (rewrite gender case), `server/services/__tests__/psgaService.test.js`, create `server/__tests__/womenPlusSearch.test.js`

**Interfaces:**
- Consumes: `canJoin`, `normalizeGender`, `effectivePreference` (Task 1).
- Produces: candidates carry `riderEligible: true` (always true after the filter); `checkPreferenceMatch(passenger, trip)` returns false when seats are full or `trip.riderEligible === false`.

- [ ] **Step 1: Write the failing integration test** `server/__tests__/womenPlusSearch.test.js`. Seed: woman host W with a `WOMEN_PLUS` trip, man host M with an `ANY` trip, a familiar-only trip by host F, all on the same route/time; riders: man, non-binary, prefer-not-to-say, woman, and a man with a COMPLETED match on one of F's earlier trips. Search body `{ origin, destination, departureMinutes, date, flexWindowMinutes: 30, genderPreference }` matching the seeded trips (copy route numbers from `matchSearchDate.test.js`).
  - S1: man → results exclude the W+ trip; `/show-all` too.
  - S4: non-binary → both W+ and ANY trips.
  - S5: prefer-not-to-say → ANY only.
  - S6: woman with `genderPreference: 'WOMEN_PLUS'` → W+ trip only.
  - S6b: man sending `genderPreference: 'WOMEN_PLUS'` → treated as ANY (effectivePreference), sees ANY trips, never W+.
  - S10: stranger → familiar-only trip absent from search and show-all.
  - S11: familiar man → familiar-only trip present.
  - S27/S26: no result contains `"gender"`.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** in `loadSearchCandidates`:
  - Delete the host-gender lookup (`hosts`, `hostGenderById`) entirely (D6: driver gender is never used for filtering).
  - After computing `familiarHostIds`:

```js
  // Safety rules are pre-filters, applied before any scoring, in both the
  // normal search and Show all (Women+ spec §5). A trip the searcher can't
  // join never reaches PSGA, so its route and schedule are never revealed.
  const rider = { gender: normalizeGender(searcher.gender) };
  const womenPlusOnly = effectivePreference(passengerRequest.genderPreference, rider.gender) === 'WOMEN_PLUS';
  const eligibleTrips = openTrips.filter(
    (t) =>
      canJoin(t, { ...rider, familiarWithHost: familiarHostIds.has(t.hostId) }) &&
      (!womenPlusOnly || t.genderPreference === 'WOMEN_PLUS')
  );
```

  - In the candidate map, replace `genderMatchesHost`/`familiarWithHost` with `riderEligible: true`.
  - `psgaService.checkPreferenceMatch`:

```js
// Seats, plus the rider-eligibility flag the caller computed server-side with
// riderRules (Women+ and familiar-riders-only). Ineligible trips are already
// removed before scoring, so for every scored trip this is met; the check stays
// as a backstop so a candidate built without the pre-filter still fails closed.
function checkPreferenceMatch(passenger, trip) {
  if (trip.filledSeats >= trip.totalSeats) return false;
  if (trip.riderEligible === false) return false;
  return true;
}
```

  - Update the `runShowAllFallback` comment block to say the searcher's Women+ filter and the trip's rules are applied upstream by `loadSearchCandidates`.

- [ ] **Step 4: Update unit tests** in `psgaService.test.js`: replace the four same-gender cases with `riderEligible: false` → false/excluded, `riderEligible: true` → true/kept. Rewrite `matchShowAll.test.js`'s gender case: woman host's `WOMEN_PLUS` trip must not appear for the male passenger.

- [ ] **Step 5: Run** `npx jest server/__tests__/womenPlusSearch.test.js server/__tests__/matchShowAll.test.js server/__tests__/matchSearchDate.test.js server/services/__tests__/psgaService.test.js` → PASS.

- [ ] **Step 6: Commit** `feat: hide trips a rider can't join before scoring`

---

### Task 4: Join and approve enforcement

**Files:**
- Modify: `server/controllers/matchController.js` (`create`, `updateStatus`)
- Test: create `server/__tests__/womenPlusJoin.test.js`

**Interfaces:**
- Consumes: `riderFacts`, `joinBlockReason`.

- [ ] **Step 1: Write the failing test.**
  - S3: man `POST /api/matches { tripId: <W+ trip> }` → 403 `TRIP_WOMEN_PLUS_ONLY`, and `prisma.match.count({ where: { tripId } })` is 0.
  - S10: stranger on a familiar-only trip → 403 `TRIP_FAMILIAR_RIDERS_ONLY`.
  - S4/S9: non-binary on W+ trip → 201.
  - S11: familiar rider → 201.
  - S22: woman requests a W+ trip (201); her stored gender is then set to `MAN` directly in the DB (`encryptField('MAN')`); host `PATCH /api/matches/:id { status: 'APPROVED' }` → 409 `RIDER_NO_LONGER_ELIGIBLE`; the match is `DECLINED`; trip `filledSeats` unchanged; she has an `APPROVAL` notification ending "was declined.".

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.** In `create`, right after the `checkJoinEligibility` guard:

```js
  const rider = await riderFacts(prisma, passengerId, trip.hostId);
  const blocked = rider ? joinBlockReason(trip, rider) : 'TRIP_NOT_FOUND';
  if (blocked) return res.status(blocked === 'TRIP_NOT_FOUND' ? 404 : 403).json({ error: blocked });
```

In `updateStatus`, widen the `existing` include to `trip: { select: { hostId: true, totalSeats: true, genderPreference: true, familiarRidersOnly: true } }`, and before the approve transaction:

```js
  if (status === 'APPROVED') {
    // Backstop for a rider who became ineligible after requesting (spec S22);
    // a gender change normally withdraws such requests first (D8).
    const rider = await riderFacts(prisma, existing.passengerId, existing.trip.hostId);
    if (!rider || joinBlockReason(existing.trip, rider)) {
      const declined = await prisma.match.update({
        where: { id },
        data: { status: 'DECLINED', respondedAt: new Date() },
        include: { trip: true },
      });
      const dest = decryptTripFields(declined.trip).destinationAddress;
      await prisma.notification.create({
        data: {
          userId: declined.passengerId,
          type: 'APPROVAL',
          message: `Your request to join the trip to ${dest} was declined.`,
          relatedMatchId: id,
          relatedTripId: declined.tripId,
        },
      });
      return res.status(409).json({ error: 'RIDER_NO_LONGER_ELIGIBLE' });
    }
  }
```

- [ ] **Step 4: Run** the new test plus `server/__tests__/matches*.test.js` and `server/services/__tests__/joinRequestService.test.js` → PASS.

- [ ] **Step 5: Commit** `feat: enforce Women+ and familiar-riders rules on join and approve`

---

### Task 5: Trip create, edit and detail

**Files:**
- Modify: `server/controllers/tripController.js` (`createTrip`, `updateTrip`, `getById`)
- Test: create `server/__tests__/womenPlusTrips.test.js`

**Interfaces:**
- Consumes: `canHostWomenPlus`, `isWomenPlusEligible`, `normalizeGender`, `riderFacts`.

- [ ] **Step 1: Write the failing test** (mock `getOfficialFuelPrice` to null like `tripsAuth.test.js`; create trips through `POST /api/trips` with the same body as that file's `validTrip`).
  - S12: man posts `genderPreference: 'WOMEN_PLUS'` → 403 `WOMEN_PLUS_HOST_NOT_ELIGIBLE`; woman → 201; non-binary → 201.
  - S23: `'SAME_GENDER'` → 400 `INVALID_TRIP` field `genderPreference`.
  - S12 edit: man `PATCH` his ANY trip to `WOMEN_PLUS` → 403.
  - S13: woman's ANY trip has pending requests from a man and a non-binary rider; `PATCH { genderPreference: 'WOMEN_PLUS' }` → 200; man's match `DECLINED` with an `APPROVAL` "was declined." notification; non-binary still `PENDING`.
  - S14: trip with an APPROVED rider; `PATCH { genderPreference: 'WOMEN_PLUS' }` (or back to ANY) → 409 `WHO_CAN_JOIN_LOCKED` even with `confirmStructural: true`; nothing changed.
  - S15: W+ trip with no approved riders → `PATCH { genderPreference: 'ANY' }` → 200.
  - S2: man `GET /api/trips/<W+ id>` → 404 `{ error: 'Trip not found' }` (identical to a missing trip); woman non-participant → 200; host → 200; an approved rider whose gender was later changed to MAN (S18) → 200 (participant).
  - S16: a `DAILY` W+ trip behaves the same in search (one assertion: man's search on a weekday excludes it).

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`createTrip`, after the vehicle ownership check:

```js
  if (body.genderPreference === 'WOMEN_PLUS') {
    const host = await riderFacts(prisma, req.user.id, req.user.id);
    if (!canHostWomenPlus(host)) return res.status(403).json({ error: 'WOMEN_PLUS_HOST_NOT_ELIGIBLE' });
  }
```

`updateTrip`, after `classifyTripChanges` and `approvedCount`:

```js
  // "Who can join" (spec D3/D5): only a Women+ host may choose Women+, and the
  // rule can't change once a rider is approved — riders agreed to the trip as it was.
  const ruleChanging = 'genderPreference' in incoming && incoming.genderPreference !== trip.genderPreference;
  let ruleDeclines = [];
  if (ruleChanging) {
    if (!GENDER_PREFERENCES.includes(incoming.genderPreference)) {
      return res.status(400).json({ error: 'INVALID_TRIP', field: 'genderPreference' });
    }
    if (approvedCount > 0) return res.status(409).json({ error: 'WHO_CAN_JOIN_LOCKED' });
    if (incoming.genderPreference === 'WOMEN_PLUS') {
      const host = await riderFacts(prisma, userId, userId);
      if (!canHostWomenPlus(host)) return res.status(403).json({ error: 'WOMEN_PLUS_HOST_NOT_ELIGIBLE' });
      ruleDeclines = await pendingRidersNotEligible(trip.matches);
    }
  }
```

with a module-level helper:

```js
// Pending riders who can't join once a trip becomes Women+ (spec S13). They get
// the ordinary "declined" notification, which says nothing about gender.
async function pendingRidersNotEligible(matches) {
  const pending = matches.filter((m) => m.status === 'PENDING');
  if (pending.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: pending.map((m) => m.passengerId) } },
    select: { id: true, gender: true },
  });
  const eligible = new Set(users.filter((u) => isWomenPlusEligible(decryptUserFields(u).gender)).map((u) => u.id));
  return pending.filter((m) => !eligible.has(m.passengerId));
}
```

and in the `ops` array before `$transaction`:

```js
  for (const m of ruleDeclines) {
    ops.push(prisma.match.update({ where: { id: m.id }, data: { status: 'DECLINED', respondedAt: new Date() } }));
    ops.push(
      prisma.notification.create({
        data: {
          userId: m.passengerId,
          type: 'APPROVAL',
          message: `Your request to join the trip to ${trip.destinationAddress} was declined.`,
          relatedMatchId: m.id,
          relatedTripId: trip.id,
        },
      })
    );
  }
```

`getById`, right after the `!tripRaw` check:

```js
  // A shared link must not expose a Women+ trip's route and schedule to someone
  // who can't join it (spec S2). Same 404 body as a missing trip, so the response
  // doesn't confirm the trip exists. Participants keep access (D2).
  if (tripRaw.genderPreference === 'WOMEN_PLUS' && tripRaw.hostId !== userId) {
    const participant = tripRaw.matches.some(
      (m) => m.passengerId === userId && ['PENDING', 'APPROVED', 'COMPLETED'].includes(m.status)
    );
    if (!participant) {
      const viewer = await riderFacts(prisma, userId, tripRaw.hostId);
      if (!viewer || !isWomenPlusEligible(viewer.gender)) return res.status(404).json({ error: 'Trip not found' });
    }
  }
```

- [ ] **Step 4: Run** the new test plus `tripsAuth`, `tripEditDetail`, `tripLocation`, `tripUpdateService` → PASS.

- [ ] **Step 5: Commit** `feat: enforce who can host and see Women+ trips`

---

### Task 6: Preferences and changing gender

**Files:**
- Modify: `server/controllers/preferenceController.js`, `server/controllers/userController.js`, `server/routes/userRoutes.js`
- Create: `server/services/genderChangeService.js`, `server/__tests__/genderChange.test.js`
- Test: `server/__tests__/preferencesAuth.test.js`

**Interfaces:**
- Produces: `PATCH /api/users/me/gender { gender, confirm? }` → 200 `{ gender, withdrawn }`; 400 `INVALID_GENDER`; 409 `HOSTING_WOMEN_PLUS_TRIPS { tripCount }`; 409 `CONFIRM_WITHDRAW_PENDING { pendingCount }`.
- Produces: `changeGender(userId, gender, { confirm })` returning `{ ok: true, gender, withdrawn } | { ok: false, status, body }`.

- [ ] **Step 1: Write the failing tests.**
  - Preferences: man `PUT /api/preferences/:id { genderPreference: 'WOMEN_PLUS', ... }` → 403 `WOMEN_PLUS_NOT_ELIGIBLE`; `'SAME_GENDER'` → 400 `INVALID_PREFERENCE`; woman → 200 `WOMEN_PLUS`; GET returns `ANY` for a stored WOMEN_PLUS row whose owner became MAN (S24 normalisation through `effectivePreference`).
  - S17: woman with 2 pending requests on W+ trips and 1 on an ANY trip → `PATCH /api/users/me/gender { gender: 'MAN' }` → 409 `CONFIRM_WITHDRAW_PENDING { pendingCount: 2 }`, nothing changed; with `confirm: true` → 200 `{ gender: 'MAN', withdrawn: 2 }`; both W+ matches `CANCELLED`; the ANY request still `PENDING`; each W+ host has a `CANCELLATION` notification "<name> withdrew their request to join your trip to …"; her preference row is now `ANY`.
  - S18: her APPROVED match on a W+ trip stays `APPROVED`.
  - S19: woman hosting an OPEN W+ trip → `{ gender: 'MAN' }` → 409 `HOSTING_WOMEN_PLUS_TRIPS { tripCount: 1 }`; with the trip CANCELLED → 200.
  - S20: man → `NON_BINARY` → 200; then search sees W+ trips.
  - `{ gender: 'FEMALE' }` → 400 `INVALID_GENDER`.
  - No `"type":"security"` entry is captured (use `setSecurityLogSink` from `services/securityLog`) — gender changes aren't logged.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `server/services/genderChangeService.js`

```js
const prisma = require('../config/db');
const { encryptField, decryptUserFields, decryptTripFields } = require('./encryptionService');
const { GENDERS, isWomenPlusEligible, normalizeGender } = require('./riderRules');
const { cancelPassengerMatch } = require('./tripCancellationService');

const OPEN_STATUSES = ['OPEN', 'FULL'];

// Self-declared gender, changeable any time (D2). Approved rides stay. A host
// can't leave Women+ while hosting open Women+ trips (D7). Pending requests on
// Women+ trips the user could no longer join are withdrawn after a warning (D8).
// Deliberately not written to the security log (spec §6).
async function changeGender(userId, gender, { confirm = false } = {}) {
  if (!GENDERS.includes(gender)) return { ok: false, status: 400, body: { error: 'INVALID_GENDER' } };
  const userRaw = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, gender: true } });
  const user = decryptUserFields(userRaw);
  if (normalizeGender(user.gender) === gender) return { ok: true, gender, withdrawn: 0 };

  let pending = [];
  if (!isWomenPlusEligible(gender)) {
    const tripCount = await prisma.trip.count({
      where: { hostId: userId, genderPreference: 'WOMEN_PLUS', status: { in: OPEN_STATUSES } },
    });
    if (tripCount > 0) return { ok: false, status: 409, body: { error: 'HOSTING_WOMEN_PLUS_TRIPS', tripCount } };
    pending = await prisma.match.findMany({
      where: { passengerId: userId, status: 'PENDING', trip: { genderPreference: 'WOMEN_PLUS' } },
      include: { trip: { select: { id: true, hostId: true, destinationAddress: true } } },
    });
    if (pending.length > 0 && !confirm) {
      return { ok: false, status: 409, body: { error: 'CONFIRM_WITHDRAW_PENDING', pendingCount: pending.length } };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { gender: encryptField(gender) } });
    if (!isWomenPlusEligible(gender)) {
      await tx.preference.updateMany({ where: { userId, genderPreference: 'WOMEN_PLUS' }, data: { genderPreference: 'ANY' } });
    }
    for (const m of pending) {
      await cancelPassengerMatch(tx, m);
      const dest = decryptTripFields(m.trip).destinationAddress;
      await tx.notification.create({
        data: {
          userId: m.trip.hostId,
          type: 'CANCELLATION',
          message: `${user.fullName} withdrew their request to join your trip to ${dest}.`,
          relatedMatchId: m.id,
          relatedTripId: m.trip.id,
        },
      });
    }
  });
  return { ok: true, gender, withdrawn: pending.length };
}

module.exports = { changeGender };
```

(Check `cancelPassengerMatch(tx, match)` only needs `{ id, status, tripId }` — read `tripCancellationService.js:40` and pass what it uses.)

`userController.js`:

```js
async function updateGender(req, res) {
  const result = await changeGender(req.user.id, req.body?.gender, { confirm: req.body?.confirm === true });
  if (!result.ok) return res.status(result.status).json(result.body);
  res.json({ gender: result.gender, withdrawn: result.withdrawn });
}
```

`userRoutes.js`: `router.patch('/me/gender', updateGender);` placed **before** `router.get('/:id', ...)` is irrelevant for PATCH, but keep it with the other `/me` routes.

`preferenceController.js`:
- `getByUser`: after loading, read the user's gender and return `{ ...preference, genderPreference: effectivePreference(preference.genderPreference, gender) }`.
- `upsert`: if `genderPreference !== undefined && !GENDER_PREFERENCES.includes(genderPreference)` → 400 `INVALID_PREFERENCE`; if `'WOMEN_PLUS'` and the user isn't eligible → 403 `WOMEN_PLUS_NOT_ELIGIBLE`.

- [ ] **Step 4: Run** `npx jest server/__tests__/genderChange.test.js server/__tests__/preferencesAuth.test.js` → PASS.

- [ ] **Step 5: Commit** `feat: let users change their gender and Women+ preference safely`

---

### Task 7: Harassment label (D9) and server sweep

**Files:**
- Modify: `server/services/reportEnforcementService.js:15`, `src/lib/format.ts:105`, any report-form option list (`grep -rn "Harassment" src`)
- Test: existing report tests that assert the label

- [ ] **Step 1:** Change both labels to `'Harassment, including about gender or identity'`. Update any test asserting the old string.
- [ ] **Step 2:** `grep -rn "SAME_GENDER\|'MALE'\|'FEMALE'\|UNSPECIFIED\|genderMatchesHost" server` → only the migration script and the legacy map in `riderRules.js` remain.
- [ ] **Step 3:** Run the full server suite `npx jest server` → all green.
- [ ] **Step 4: Commit** `feat: name gender and identity harassment in the report category`

---

### Task 8: Frontend rules, registration and Profile

**Files:**
- Create: `src/lib/riderRules.ts`, `src/lib/__tests__/riderRules.test.ts`
- Modify: `src/app/register/page.tsx` (lines 56, 134–157, 285–294), `src/app/auth/profile/ProfileClient.tsx` (lines 27, 188–193 + a new Gender field), `src/lib/session.ts` (`CurrentUser.gender?`), the profile `page.tsx` that renders `ProfileClient` (pass `gender`)

**Interfaces:**
- Produces (TS):

```ts
export type Gender = 'WOMAN' | 'MAN' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY';
export type GenderPreference = 'ANY' | 'WOMEN_PLUS';
export const GENDER_OPTIONS: { value: Gender; label: string }[];
export const GENDER_HELP: string;
export const WHO_CAN_JOIN_OPTIONS: { value: GenderPreference; label: string }[];
export const TRIPS_I_SEE_OPTIONS: { value: GenderPreference; label: string }[];
export function isGender(v: unknown): v is Gender;
export function isWomenPlusEligible(g: string | null | undefined): boolean;
export function needsOpenTripWarning(tripPref: string, riderPref: string): boolean;
export function ruleBadges(trip: { genderPreference: string; familiarRidersOnly?: boolean }): string[];
export function genderChangeMessage(error: string, body: { pendingCount?: number }): string | null;
```

- [ ] **Step 1: Write the failing web test** `src/lib/__tests__/riderRules.test.ts`

```ts
import { describe, test, expect } from '@jest/globals';
import {
  isWomenPlusEligible, needsOpenTripWarning, ruleBadges, genderChangeMessage, isGender, GENDER_OPTIONS, GENDER_HELP,
} from '../riderRules';

describe('riderRules (UI)', () => {
  test('eligibility', () => {
    expect(isWomenPlusEligible('WOMAN')).toBe(true);
    expect(isWomenPlusEligible('NON_BINARY')).toBe(true);
    expect(isWomenPlusEligible('MAN')).toBe(false);
    expect(isWomenPlusEligible(undefined)).toBe(false);
  });

  test('S7/S8/S9: warn only a Women+-only rider joining an open trip', () => {
    expect(needsOpenTripWarning('ANY', 'WOMEN_PLUS')).toBe(true);
    expect(needsOpenTripWarning('ANY', 'ANY')).toBe(false);
    expect(needsOpenTripWarning('WOMEN_PLUS', 'WOMEN_PLUS')).toBe(false);
  });

  test('S27: badges describe the rule, never a person', () => {
    expect(ruleBadges({ genderPreference: 'WOMEN_PLUS', familiarRidersOnly: true })).toEqual(['Women+ trip', 'Familiar riders only']);
    expect(ruleBadges({ genderPreference: 'ANY', familiarRidersOnly: false })).toEqual([]);
  });

  test('gender options and help text', () => {
    expect(GENDER_OPTIONS.map((o) => o.label)).toEqual(['Woman', 'Man', 'Non-binary', 'Prefer not to say']);
    expect(GENDER_HELP).toBe('Used only for Women+ trips. Never shown to other users. You can change it anytime.');
    expect(isGender('FEMALE')).toBe(false);
  });

  test('gender change messages', () => {
    expect(genderChangeMessage('CONFIRM_WITHDRAW_PENDING', { pendingCount: 2 })).toBe(
      'Changing this will withdraw your 2 pending requests on Women+ trips. Continue?'
    );
    expect(genderChangeMessage('CONFIRM_WITHDRAW_PENDING', { pendingCount: 1 })).toBe(
      'Changing this will withdraw your 1 pending request on a Women+ trip. Continue?'
    );
    expect(genderChangeMessage('HOSTING_WOMEN_PLUS_TRIPS', {})).toBe("You're hosting Women+ trips. Finish or cancel them first.");
  });
});
```

- [ ] **Step 2: Run** `npx jest -c jest.web.config.mjs src/lib/__tests__/riderRules.test.ts` → FAIL.

- [ ] **Step 3: Implement** `src/lib/riderRules.ts`

```ts
// UI mirror of server/services/riderRules.js. The server enforces every rule;
// this only decides what to show.
export type Gender = 'WOMAN' | 'MAN' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY';
export type GenderPreference = 'ANY' | 'WOMEN_PLUS';

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'WOMAN', label: 'Woman' },
  { value: 'MAN', label: 'Man' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

export const GENDER_HELP = 'Used only for Women+ trips. Never shown to other users. You can change it anytime.';

export const WHO_CAN_JOIN_OPTIONS: { value: GenderPreference; label: string }[] = [
  { value: 'ANY', label: 'Anyone' },
  { value: 'WOMEN_PLUS', label: 'Women+ only (women and non-binary riders)' },
];

export const TRIPS_I_SEE_OPTIONS: { value: GenderPreference; label: string }[] = [
  { value: 'ANY', label: 'All trips' },
  { value: 'WOMEN_PLUS', label: 'Women+ trips only' },
];

const WOMEN_PLUS: string[] = ['WOMAN', 'NON_BINARY'];

export function isGender(v: unknown): v is Gender {
  return GENDER_OPTIONS.some((o) => o.value === v);
}

export function isWomenPlusEligible(g: string | null | undefined): boolean {
  return g != null && WOMEN_PLUS.includes(g);
}

export function needsOpenTripWarning(tripPref: string, riderPref: string): boolean {
  return riderPref === 'WOMEN_PLUS' && tripPref !== 'WOMEN_PLUS';
}

export function ruleBadges(trip: { genderPreference: string; familiarRidersOnly?: boolean }): string[] {
  const badges: string[] = [];
  if (trip.genderPreference === 'WOMEN_PLUS') badges.push('Women+ trip');
  if (trip.familiarRidersOnly) badges.push('Familiar riders only');
  return badges;
}

export function genderChangeMessage(error: string, body: { pendingCount?: number }): string | null {
  if (error === 'HOSTING_WOMEN_PLUS_TRIPS') return "You're hosting Women+ trips. Finish or cancel them first.";
  if (error === 'CONFIRM_WITHDRAW_PENDING') {
    const n = body.pendingCount ?? 0;
    return n === 1
      ? 'Changing this will withdraw your 1 pending request on a Women+ trip. Continue?'
      : `Changing this will withdraw your ${n} pending requests on Women+ trips. Continue?`;
  }
  return null;
}
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Registration.** State type `Gender` default `'PREFER_NOT_TO_SAY'`; draft restore uses `isGender(d.gender)`; the select maps `GENDER_OPTIONS`; help text `{GENDER_HELP}` replaces "Used only for the optional same-gender co-rider matching preference."

- [ ] **Step 6: Profile.**
  - `CurrentUser` gets `gender?: Gender`. The profile server page passes `user.gender ?? 'PREFER_NOT_TO_SAY'` to `ProfileClient`.
  - New "Gender" select (`GENDER_OPTIONS`) + `GENDER_HELP`, saved with its own button via `apiFetch('/api/users/me/gender', { method: 'PATCH', body: { gender } })`. On 409 `CONFIRM_WITHDRAW_PENDING`, show `genderChangeMessage(...)` in a `window.confirm`-free inline confirm (two buttons: "Cancel", "Change and withdraw") that resends with `confirm: true`. On 409 `HOSTING_WOMEN_PLUS_TRIPS`, show the message inline. On success, `router.refresh()`.
  - "Matching preferences → Trips I see": `TRIPS_I_SEE_OPTIONS`, with the Women+ option rendered only when `isWomenPlusEligible(gender)`. For a prefer-not-to-say user show the hint (S5): "Choose a gender above to use Women+ trips."
  - Type `genderPreference: GenderPreference`.

- [ ] **Step 7:** `npx tsc --noEmit` → clean. `npm run test:web` → green.

- [ ] **Step 8: Commit** `feat: inclusive gender options in registration and profile`

---

### Task 9: Frontend trips, search, warning, badges, admin

**Files:**
- Create: `src/components/RuleBadges.tsx`, `src/components/OpenTripWarning.tsx`
- Modify: `src/app/auth/post/PostTripForm.tsx` (lines 25–27, 86, 177, 715–719), `src/app/auth/trips/[id]/edit/page.tsx:31`, `src/app/auth/search/page.tsx:27`, `src/app/auth/search/SearchClient.tsx` (96, 170, 203, 442–447, empty state, result cards, join), `src/app/auth/rides/[id]/RideDetailClient.tsx:60,221` (+ join), `src/app/auth/trips/[id]/TripDetailClient.tsx:72,425`, `src/components/RequestToJoinModal.tsx`, admin user detail page under `src/app/auth/admin/users/[id]/`

- [ ] **Step 1: `RuleBadges`**

```tsx
import { ruleBadges } from '@/lib/riderRules';

interface RuleBadgesProps {
  trip: { genderPreference: string; familiarRidersOnly?: boolean };
}

// The trip's rules, never a person's gender (Women+ spec §6).
export default function RuleBadges({ trip }: RuleBadgesProps) {
  const badges = ruleBadges(trip);
  if (badges.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <span key={b} className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
          {b}
        </span>
      ))}
    </span>
  );
}
```

(Match the badge styling already used for status pills in the codebase if one exists — check `StatusPill` and reuse its classes.)

- [ ] **Step 2: `OpenTripWarning`** — a small inline panel (no browser dialog) rendered inside `RequestToJoinModal` before the send button:

```tsx
interface OpenTripWarningProps {
  onCancel: () => void;
  onContinue: () => void;
}

export default function OpenTripWarning({ onCancel, onContinue }: OpenTripWarningProps) {
  return (
    <div role="alertdialog" aria-labelledby="open-trip-warning-title" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p id="open-trip-warning-title" className="font-semibold text-amber-900">This trip is open to everyone.</p>
      <p className="mt-1 text-sm text-amber-900">You chose Women+ trips only. Other riders on this trip could be any gender.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel} className="rsu-btn-secondary">Cancel</button>
        <button type="button" onClick={onContinue} className="rsu-btn-primary">Request anyway</button>
      </div>
    </div>
  );
}
```

(Use whatever button classes `RequestToJoinModal` already uses.)

`RequestToJoinModal` gets a new prop `riderPreference: GenderPreference` and the trip's `genderPreference`. When `needsOpenTripWarning(trip.genderPreference, riderPreference)` and the warning hasn't been accepted, the modal shows `OpenTripWarning` first; "Cancel" closes the modal without a request (S7); "Request anyway" reveals the normal send form.

The rider's preference: Search passes its current filter value (which defaults to the Profile preference). Ride Details reads `?show=womenplus` if present, otherwise the Profile preference, fetched server-side in `rides/[id]/page.tsx` via `apiFetch('/api/preferences/<userId>')` and passed down.

- [ ] **Step 3: Post / edit.** Replace `GENDER_PREFERENCE_OPTIONS` with `WHO_CAN_JOIN_OPTIONS` filtered to `ANY` unless `isWomenPlusEligible(hostGender)` (pass the host's gender from the server page: `getCurrentUser()` now returns it). Label the field "Who can join". On edit, when the trip has approved riders, disable the control and show "Locked because riders are already approved." (the same wording style as the other structural notices in this form). Map a 409 `WHO_CAN_JOIN_LOCKED` and 403 `WOMEN_PLUS_HOST_NOT_ELIGIBLE` in the form's error copy map to "Who can join can't change after a rider is approved." and "Only women and non-binary hosts can post Women+ trips."

- [ ] **Step 4: Find a Ride.**
  - `search/page.tsx`: `genderPreference: one(sp.show) === 'womenplus' ? 'WOMEN_PLUS' : <profile preference>` — read the Profile preference server-side, and pass `canUseWomenPlus = isWomenPlusEligible(user.gender)`.
  - `SearchClient`: filter label "Show", options `TRIPS_I_SEE_OPTIONS`, rendered only when `canUseWomenPlus`; URL key `show=womenplus`.
  - Empty state when `genderPreference === 'WOMEN_PLUS'` and no results: a button "Also show trips open to everyone" that sets the filter to `ANY` and re-runs the search, while **keeping** `riderPreference = 'WOMEN_PLUS'` for the join warning (store `womenPlusChosen` separately from the active filter, so S7 still warns).
  - Result cards render `<RuleBadges trip={m.trip} />`.

- [ ] **Step 5: Details pages.** `RideDetailClient:221` and `TripDetailClient:425`: replace the "Any / Same-gender only" text with "Who can join: Anyone" or "Who can join: Women+ only", plus `<RuleBadges />` near the title.

- [ ] **Step 6: Admin user page (D10).** Add a row "Gender (self-declared)" with the label from `GENDER_OPTIONS`, and a one-line note "Visible to admins only, for reviewing Women+ reports."

- [ ] **Step 7:** `grep -rn "SAME_GENDER\|Same-gender\|same-gender\|'MALE'\|'FEMALE'" src` → nothing. `npx tsc --noEmit` clean, `npm run test:web` green, `npm run build` succeeds.

- [ ] **Step 8: Commit** `feat: Women+ choices, warning and badges across trip and search screens`

---

### Task 10: Python validation

**Files:**
- Modify: `validation/psga.py:105-125`, `validation/psga_independent_recheck.py:66-80,138-150`, `validation/generate_dataset.py`, `validation/generate_dataset_geo.py`, `validation/run_methods.py:32-46`, `validation/labeling/labeling_common.py:32-38,98-106`, `validation/labeling/build_labeling_kit.py:37-38`, `validation/labeling/test_labeling.py:60-66`
- Regenerate: `validation/dataset_500_pairs.json`, `validation/dataset_geo_pairs.json`, `validation/method_rankings.json`, `validation/PSGA_Human_Labeling_Sheet.xlsx` and the kit workbooks

Semantics (same in `psga.py` and the independent recheck):
- Genders: `WOMAN`, `MAN`, `NON_BINARY`, `PREFER_NOT_TO_SAY`.
- Trip field `hostGenderPreference` ∈ `ANY`, `WOMEN_PLUS`; a `WOMEN_PLUS` trip always has an eligible host (D5).
- Passenger flag `womenPlusOnly` (renamed from `sameGenderOnly`).
- Constraint fails when: trip is `WOMEN_PLUS` and the passenger isn't eligible; the passenger is `womenPlusOnly` and the trip isn't `WOMEN_PLUS`; `familiarRidersOnly` and not familiar; no seats.
- Driver gender is no longer a matching input (D6), so drop `hostGender` from the dataset and the labeling sheet.

- [ ] **Step 1: Write failing tests** in `validation/labeling/test_labeling.py` (or a new `validation/test_psga_rules.py` discovered by the same command — put it under `validation/labeling/` so `python -m unittest discover -s validation/labeling` runs it):

```python
import unittest, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from psga import preference_match
from psga_independent_recheck import constraints_ok

BASE_TRIP = {"hostGenderPreference": "ANY", "familiarRidersOnly": False, "seatsAvailable": 2}

class WomenPlusRules(unittest.TestCase):
    def check(self, passenger, trip, expected):
        self.assertEqual(preference_match(passenger, trip), expected)
        self.assertEqual(constraints_ok(passenger, trip), expected)

    def test_women_plus_trip(self):
        t = dict(BASE_TRIP, hostGenderPreference="WOMEN_PLUS")
        self.check({"gender": "MAN", "womenPlusOnly": False}, t, False)
        self.check({"gender": "PREFER_NOT_TO_SAY", "womenPlusOnly": False}, t, False)
        self.check({"gender": "NON_BINARY", "womenPlusOnly": False}, t, True)

    def test_women_plus_only_passenger(self):
        self.check({"gender": "WOMAN", "womenPlusOnly": True}, BASE_TRIP, False)
        self.check({"gender": "WOMAN", "womenPlusOnly": True}, dict(BASE_TRIP, hostGenderPreference="WOMEN_PLUS"), True)
```

Use the actual function names in those files (read them first; `preference_match` is at `psga.py:105`; find the recheck's name at line 65) and the actual seats field name.

- [ ] **Step 2: Run** `python -m unittest discover -s validation/labeling` → FAIL.
- [ ] **Step 3: Implement** the semantics in both rule functions, the generators (conflict "gender": if the passenger is ineligible, make the trip `WOMEN_PLUS`; else if the passenger is `womenPlusOnly`, make the trip `ANY`; else fall back to the "familiar" conflict), `run_methods.py` field names, and the labeling sheet columns: "Passenger gender", "Passenger wants Women+ trips only", "Driver accepts" = "Women+ only" / "Anyone" (drop "Driver gender"). Rubric lines in `build_labeling_kit.py`: "2. Passenger wants Women+ trips only and the trip is open to everyone." / "3. The trip is Women+ only and the passenger is a man or prefers not to say."
- [ ] **Step 4: Regenerate** in order: `python validation/generate_dataset.py`, `python validation/generate_dataset_geo.py`, `python validation/run_methods.py`, `python validation/psga_independent_recheck.py` (must report 100% agreement), `python validation/labeling/build_labeling_kit.py`. Run `run_methods.py` twice and confirm `method_rankings.json` is byte-identical (deterministic).
- [ ] **Step 5: Run** the unittest command → PASS.
- [ ] **Step 6: Commit** `feat: use Women+ rules in the PSGA validation and labeling kit`

---

### Task 11: Postman and docs

**Files:**
- Modify: `postman/RideShareEU.postman_collection.json`, `server/scripts/seedPostman.js`, `AGENTS.md`, `docs/thesis/thesis-proposal.md`, `docs/security/owasp-top10-review.md`, `docs/project/jira-backlog.csv` (optional item)

- [ ] **Step 1: Postman.** `seedPostman.js` creates the host as `WOMAN` (so she can host W+) and the passenger as `MAN`. Add a folder "14. Women+" to the Automated run (after trips are created, before reports):
  - Host posts a W+ trip → 201; save `womenPlusTripId`.
  - S12: passenger posts a W+ trip (he needs a vehicle — reuse the passenger vehicle if the collection has one, else assert 403 before the vehicle check by sending a valid body with his own vehicle id created in this folder) → 403 `WOMEN_PLUS_HOST_NOT_ELIGIBLE`.
  - S3: passenger joins W+ trip → 403 `TRIP_WOMEN_PLUS_ONLY`.
  - S2: passenger `GET /api/trips/{{womenPlusTripId}}` → 404.
  - S10: host posts a familiar-only trip; passenger joins → 403 `TRIP_FAMILIAR_RIDERS_ONLY`.
  - S26: passenger `GET /api/users/{{hostId}}` → body has no `gender`.
  - Host cancels both trips at the end.
  Each request keeps the `< 2000 ms` assertion. Run `npm run seed:postman && npm run test:api` → 0 failures; record the new request/assertion totals.
- [ ] **Step 2: AGENTS.md.** New section "Women+ trips (Oct 2026)": values, `riderRules.js`/`riderFacts.js`, where it is enforced and the error codes, privacy (`safeUserSelect` has no gender), `PATCH /api/users/me/gender` with D7/D8, D3 lock, `npm run migrate-women-plus` (backup first, then `prisma db push`), and that the validation artifacts were regenerated.
- [ ] **Step 3: Manuscript** `docs/thesis/thesis-proposal.md`: `grep -n -i "same-gender\|same gender\|gender preference" docs/thesis/thesis-proposal.md`; rewrite each passage for Women+ (women and non-binary; self-declared, optional, never shown, changeable); add to the PSGA preference-term paragraph: "Safety rules (Women+ and familiar riders only) are applied as pre-filters before scoring, so for every trip shown the preference term is met." Add an ethics sentence and the limitation "self-declared gender is not verified; misuse is handled by host approval, ratings, reports and admin review." Record the changed line numbers for the user's Word copy.
- [ ] **Step 4: OWASP** `docs/security/owasp-top10-review.md`: under A01 add a RESOLVED entry "Gender of other users returned by the API (`safeUserSelect`)" with the fix and date, following the doc's audit-trail convention.
- [ ] **Step 5: Commit** `docs: describe Women+ trips and add their Postman checks`

---

### Task 12: Full regression and browser walkthrough

- [ ] **Step 1:** `npm test` (server + web), `python -m unittest discover -s validation/labeling`, `npx tsc --noEmit`, `npm run build`, `npm run seed:postman && npm run test:api` (API on :4000). All green; write down the counts.
- [ ] **Step 2:** Demo servers (`api-demo`, `web-demo` launch configs) against the reseeded `rideshare_demo`. With Playwright (`playwright-core`, `channel: 'msedge'`, scratchpad script), log in with the demo accounts and check:
  - Ana (woman) → Post a ride shows "Women+ only"; Juan (man) → it doesn't (S12).
  - Juan searches Tayabas → campus: Ana's W+ trip is absent (S1); opening its URL shows not found (S2).
  - Bea (non-binary) sees it and can open the request modal without a warning (S4, S9).
  - Maria (woman, Profile "Women+ trips only") → filter defaults to Women+; "Also show trips open to everyone" reveals open trips; Request to Join on one shows the warning; Cancel sends nothing; Request anyway sends (S6, S7).
  - Profile: changing gender with a pending W+ request shows the withdraw confirmation (S17); Ana (hosting W+) gets the D7 message (S19).
  - Trip cards and details show "Women+ trip" badges and no gender anywhere (S27).
  - Admin (Liza) → user page shows "Gender (self-declared)" (D10); report category reads the new Harassment label (D9).
  Take screenshots into the scratchpad as evidence; don't add them to `screenshots/`.
- [ ] **Step 3:** Fix anything found (with a test), re-run Step 1.
- [ ] **Step 4:** Update the memory notes and hand off with superpowers:finishing-a-development-branch (merge to local `main` only when the user picks it; no push).

---

## Self-review

- Spec coverage: §4 → Task 2; §5 → Tasks 1, 3–5; §6 → Tasks 1, 6 (no security log), 9 (badges); §7 → Tasks 8–9; D1 → Task 9 Step 3; D2/S18 → Tasks 5, 6; D3/S14 → Task 5; D5/S12 → Task 5; D6 → Task 3 (host gender lookup deleted); D7/S19 and D8/S17 → Task 6; D9 → Task 7; D10 → Tasks 1, 9; S16 → Task 5; S21 → documented limitation (Task 11 Step 3); S22 → Task 4; S23 → Task 2 Step 6; S24 → Tasks 1, 6; S25 → Task 2 Step 6; S26 → Task 1; S27 → Tasks 3, 9. §9 Python → Task 10; Postman/docs → Task 11; §10 step 7 → Task 12.
- The spec's "Test plan F-06" update lives in the user's `.docx` outside the repo: listed for the user in the hand-off rather than as a task.
- Names used across tasks: `riderFacts`, `joinBlockReason`, `canHostWomenPlus`, `isWomenPlusEligible`, `effectivePreference`, `normalizeGender`, `GENDER_PREFERENCES`, `GENDERS`, `changeGender`, `riderEligible` — consistent.
