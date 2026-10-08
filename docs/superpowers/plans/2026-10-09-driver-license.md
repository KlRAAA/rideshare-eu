# Driver's License Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drivers upload a license (photo, number, type, expiry); an admin approves or rejects it; only verified drivers can post trips.

**Architecture:** A `DriverLicense` row per submission. The photo is AES-256-GCM encrypted into `LICENSE_DIR` (never under the public `UPLOADS_DIR`) and deleted on the decision. Pure rules in `server/services/licenseRules.js`; DB work in `server/services/licenseService.js`; driver routes on `/api/users/me/license`, admin routes on `/api/admin/licenses`. `createTrip` checks `licenseState` first.

**Tech Stack:** Express 5 + multer (memory), Prisma 7 (`db push`), Next.js 16 / React 19, Jest 30, node-cron.

**Spec:** `docs/superpowers/specs/2026-10-09-driver-license-design.md`

## Global Constraints

- Photo: one file, ≤ 5 MB, JPEG/PNG/WebP by magic bytes (`sniffImageType`); 400 `INVALID_IMAGE`; multer size error 413 `FILE_TOO_LARGE`.
- License number 5–20 characters of letters, digits or dashes (stored upper-case); type `NON_PROFESSIONAL` | `PROFESSIONAL` | `STUDENT_PERMIT`; expiry a real `YYYY-MM-DD` not before today (PH).
- After a decision: `numberEnc` and `photoFile` are null and the file is gone.
- Verified = newest APPROVED row with `expiresOn` ≥ today (PH).
- Gate only on `POST /api/trips` (403 `LICENSE_REQUIRED` | `LICENSE_PENDING` | `LICENSE_REJECTED` | `LICENSE_EXPIRED`).
- Reject note ≤ 300 characters; `OTHER` needs one (400 `NOTE_REQUIRED`).
- Additive schema change; back up dev and demo first.
- Commits authored as `Xyrus <xyrusdimacali@gmail.com>`, no AI trailers.

---

### Task 1: Data, storage and rules

**Files:** `prisma/schema.prisma`; `server/config/uploads.js` (`LICENSE_DIR`); `.gitignore` (`storage/`); `server/services/encryptionService.js` (`encryptBuffer`, `decryptBuffer`); Create `server/services/licenseRules.js`; `scripts/backupModels.cjs` (`driverLicense` before `user` in delete order / after in restore order, as the file's convention); `server/test-helpers/seed.js` (`makeUser` licensed by default, `makeLicense`, cleanup removes rows and files); Tests `server/services/__tests__/licenseRules.test.js`, `server/services/__tests__/encryptionService.test.js` (buffer round trip, add if the file exists).

**Produces:**
- `validateLicenseInput({ licenseNumber, licenseType, expiresOn }, now) → { error, field } | { value: { number, last4, licenseType, expiresOn: Date } }` (errors `INVALID_LICENSE` with field, or `LICENSE_EXPIRED`).
- `licenseStateFrom(rows, now) → { verified, status, reason, current }` — `rows` newest first; reason `null` when verified, else `LICENSE_REQUIRED` / `LICENSE_PENDING` / `LICENSE_REJECTED` / `LICENSE_EXPIRED` from the newest row.
- `REJECT_REASONS`, `LICENSE_TYPES`, `MAX_REJECT_NOTE = 300`.
- `encryptBuffer(buf) → Buffer` (iv ‖ tag ‖ ciphertext), `decryptBuffer(buf) → Buffer`.

- [ ] Step 1: back up dev and demo; schema (enums, model, relation on `User` as `licenses DriverLicense[]`, new notification and admin action values); `prisma generate`; `db push` on both.
- [ ] Step 2: failing tests:

```js
const { validateLicenseInput, licenseStateFrom } = require('../licenseRules');
const NOW = new Date('2026-10-09T04:00:00Z'); // 9 Oct, noon PH
const ok = { licenseNumber: 'n01-23-456789', licenseType: 'NON_PROFESSIONAL', expiresOn: '2030-01-31' };

test('a valid license is normalised', () => {
  expect(validateLicenseInput(ok, NOW).value).toEqual({
    number: 'N01-23-456789', last4: '6789', licenseType: 'NON_PROFESSIONAL', expiresOn: new Date('2030-01-31T00:00:00Z'),
  });
});
test('each field is checked', () => {
  expect(validateLicenseInput({ ...ok, licenseNumber: 'ab' }, NOW)).toEqual({ error: 'INVALID_LICENSE', field: 'licenseNumber' });
  expect(validateLicenseInput({ ...ok, licenseNumber: 'N01 23' }, NOW)).toEqual({ error: 'INVALID_LICENSE', field: 'licenseNumber' });
  expect(validateLicenseInput({ ...ok, licenseType: 'PILOT' }, NOW)).toEqual({ error: 'INVALID_LICENSE', field: 'licenseType' });
  expect(validateLicenseInput({ ...ok, expiresOn: '2030-02-30' }, NOW)).toEqual({ error: 'INVALID_LICENSE', field: 'expiresOn' });
  expect(validateLicenseInput({ ...ok, expiresOn: '2026-10-08' }, NOW)).toEqual({ error: 'LICENSE_EXPIRED' });
  expect(validateLicenseInput({ ...ok, expiresOn: '2026-10-09' }, NOW).value).toBeDefined(); // valid through today
});
test('state follows the newest row; an earlier valid approval still counts', () => {
  const row = (status, expiresOn = '2030-01-31') => ({ status, expiresOn: new Date(`${expiresOn}T00:00:00Z`) });
  expect(licenseStateFrom([], NOW)).toMatchObject({ verified: false, reason: 'LICENSE_REQUIRED' });
  expect(licenseStateFrom([row('PENDING')], NOW)).toMatchObject({ verified: false, reason: 'LICENSE_PENDING' });
  expect(licenseStateFrom([row('REJECTED')], NOW)).toMatchObject({ verified: false, reason: 'LICENSE_REJECTED' });
  expect(licenseStateFrom([row('APPROVED', '2026-10-09')], NOW)).toMatchObject({ verified: true, reason: null });
  expect(licenseStateFrom([row('APPROVED', '2026-10-08')], NOW)).toMatchObject({ verified: false, reason: 'LICENSE_EXPIRED' });
  expect(licenseStateFrom([row('PENDING'), row('APPROVED')], NOW)).toMatchObject({ verified: true, status: 'PENDING' });
});
```

- [ ] Step 3: implement (`phDateOnly(now)` for "today"; number regex `/^[A-Z0-9-]{5,20}$/` after `trim().toUpperCase()`; date regex + round-trip check as `tripDayService.phDay`).
- [ ] Step 4: seed helpers — `makeLicense(bag, userId, { status = 'APPROVED', expiresOn = 2030-12-31, ... })` creates the row (`numberLast4 '0000'`); `makeUser(bag, { licensed = true })` calls it; cleanup: delete files for the bag's rows with a `photoFile`, then `driverLicense.deleteMany` (userId or decidedById in bag) before users.
- [ ] Step 5: run the unit tests and the full server suite (nothing else changes yet) — PASS. Commit `feat: driver license data and rules`.

### Task 2: Driver upload and the posting gate

**Files:** Create `server/services/licenseService.js` (`licenseState(userId, now)`, `submitLicense(userId, file, fields, now)`, `myLicense(userId)`, `removeLicenseFile(name)`); `server/controllers/userController.js` (`uploadLicense`, `getMyLicense`); `server/routes/userRoutes.js` (`/me/license`, multer field `photo`, registered before `/:id`); `server/validation/bodySchemas.js` (`user.license: { licenseNumber, licenseType, expiresOn: 'string' }`); `server/controllers/tripController.js` (`createTrip` gate first); `server/services/accountDeletionService.js` (delete the user's license rows and files); Test `server/__tests__/licenses.test.js`.

- [ ] Step 1: failing tests (multipart with `FormData` + `Blob` of a tiny PNG header buffer):
  - unlicensed user (`makeUser(bag, { licensed: false })`) posts a trip → 403 `LICENSE_REQUIRED`;
  - upload → 201, `license.status` PENDING, `numberLast4`; the stored file exists in `LICENSE_DIR`, is not under `UPLOADS_DIR`, and doesn't start with the PNG signature; `GET /me/license` has no `photoFile`/`numberEnc`; posting → 403 `LICENSE_PENDING`;
  - second upload while pending → 409 `LICENSE_PENDING`;
  - a text file → 400 `INVALID_IMAGE`; past expiry → 400 `LICENSE_EXPIRED`; bad type → 400 `INVALID_LICENSE` field `licenseType`;
  - a licensed user (default `makeUser`) posts → 201.
  - account deletion removes the user's license rows and file.
- [ ] Step 2: run — FAIL. Step 3: implement. Upload writes `randomBytes(16).hex + '.bin'` = `encryptBuffer(file)`, then creates the row; if the row insert fails the file is removed. Step 4: run with `tripsAuth`, `strictBody`, `crossUserAccess`, `accountDeletion` — PASS. Commit `feat: drivers upload a license before posting`.

### Task 3: Admin review

**Files:** Create `server/controllers/admin/licenseController.js` (`list`, `photo`, `approve`, `reject`); `server/routes/adminRoutes.js`; `server/validation/bodySchemas.js` (`admin.licenseApprove: NONE`, `admin.licenseReject: { reason, note }`); `server/services/licenseService.js` (`decideLicense(id, adminId, { approve, reason, note }, now)`); `server/services/emailService.js` (`sendLicenseDecisionEmail(email, { approved, reasonLabel, note })`); `server/controllers/admin/overviewController.js` (`pendingLicenses` in `queues()` and `navCounts`); `server/__tests__/crossUserAccess.test.js` (admin license routes refused for a non-admin); Test `server/__tests__/adminLicenses.test.js`.

- [ ] Step 1: failing tests — admin lists the pending license with the decrypted number and the user's name; `GET /:id/photo` as admin → 200 `image/png`, body equals the original bytes, `cache-control: no-store`; as a non-admin → 403; approve → 200, row APPROVED, `numberEnc` and `photoFile` null, file gone, `AdminAction` LICENSE_APPROVED, notification LICENSE_APPROVED; photo after decision → 404; approving twice → 409 `ALREADY_DECIDED`; reject OTHER without a note → 400 `NOTE_REQUIRED`; reject UNREADABLE → notification text contains the reason; own license → 403 `CANNOT_TARGET_SELF`; nav counts include `pendingLicenses`; after approval the driver posts a trip → 201.
- [ ] Step 2: run — FAIL. Step 3: implement (decision in one `$transaction` with an `updateMany where status PENDING` guard → 409 when count 0; then `removeLicenseFile`, then the email, failures logged). Step 4: run with `adminAccess`, `crossUserAccess`, `strictBody` — PASS. Commit `feat: admins approve or reject driver licenses`.

### Task 4: Expiry reminders and the one-time notice

**Files:** `server/services/licenseService.js` (`sendLicenseExpiryReminders(now)`, `notifyLicenseRequired()`); Create `server/scripts/notifyLicenseRequired.js`; `package.json` (`notify-license-required`); `server/server.js` (cron `0 8 * * *`, `{ timezone: 'Asia/Manila' }`); Test `server/__tests__/licenseJobs.test.js`.

- [ ] Step 1: failing tests — a license expiring in exactly 30 days gets one LICENSE_EXPIRING (run twice), 29 days none, 7 days a second one; an expired one none; `notifyLicenseRequired` for users given as ids (the function takes an optional `userIds` filter so the test never touches other data): a host without a license gets LICENSE_REQUIRED once; one with a license row gets none.
- [ ] Step 2–4: implement, run — PASS. Commit `feat: license expiry reminders and upload notice`.

### Task 5: Screens

**Files:** Create `src/lib/license.ts` (types, `licenseStatusText`, `rejectReasonLabel`, `licenseErrorMessage`, `REJECT_REASON_OPTIONS`, `LICENSE_TYPE_OPTIONS`) + `src/lib/__tests__/license.test.ts`; Create `src/components/LicenseStatusCard.tsx`, `src/app/auth/license/page.tsx` + `LicenseForm.tsx`; Modify `src/app/register/page.tsx` ("Will you drive?" → `/auth/license?welcome=1`), `src/app/auth/post/page.tsx` (gate), Profile page (status row), `NotificationsClient.tsx` + `notificationLink.ts` (four types → `/auth/license`), `src/lib/admin.ts` + `AdminNav.tsx` (People → "Driver licenses", badge `pendingLicenses`), Create `src/app/auth/admin/licenses/page.tsx` + `LicenseReviewClient.tsx` (photo via `<img src="/api/admin/licenses/:id/photo">` — same-origin through the proxy with the session cookie), admin overview tile.

- [ ] Step 1: failing web test for the helpers (status texts for each state, reason labels, error messages). Step 2: implement helpers and screens. Step 3: `npx tsc --noEmit && npm run test:web` — clean. Commit `feat: license screens for drivers and admins`.

### Task 6: Seeds, Postman, docs, verification

- [ ] `seedDemo.js`: approved licenses for Juan, Miguel, Ana, Carlo (before their trips); Rico pending with a generated sample PNG (plain card-coloured image built with `zlib`, no real data) saved through `submitLicense`.
- [ ] `seedPostman.js`: approved licenses for host and passenger; a third account `postman-driver@test.local` with none; deletes license rows (and files) of the Postman accounts.
- [ ] Postman "21. Driver licenses": new driver can't post (403 `LICENSE_REQUIRED`); uploads (201; `postman/fixtures/avatar.png`); can't post (403 `LICENSE_PENDING`); admin lists it; admin views the photo (200); admin rejects UNREADABLE; driver sees REJECTED with the reason; uploads again; admin approves; driver posts (201); driver cancels the trip (clean-up).
- [ ] Full suites, tsc, Postman, browser check (demo: Rico's license in Liza's queue → approve; a new account's Post a Trip shows the upload card).
- [ ] AGENTS.md "E. Driver's license verification"; roadmap E → done; deployment guide: `LICENSE_DIR=/data/licenses` and the one-time script. Commit `docs: driver license notes and Postman folder`.
