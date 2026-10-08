# Driver's license verification (sub-project E)

Roadmap: `2026-10-08-panel-revisions-roadmap.md`. Panel note §4. Approved in
chat on 9 Oct 2026.

## Problem

Anyone can post a ride today. The panel asked that drivers upload a driver's
license and that an admin verify it before the account can post trips, with an
admin review screen (approve, or reject with a reason).

## Decisions

| Topic | Decision |
|---|---|
| When to upload | Sign-up asks "Will you drive?"; yes leads to the license page right after the account is created, no skips it. Anyone can upload later from Profile or Post a Trip. |
| What the gate blocks | Posting a new trip. Driver mode still opens; trips already posted keep running. |
| Existing drivers | Not approved automatically. A one-time notification asks everyone who has hosted a trip to upload. |
| What is uploaded | One photo of the license front, plus the license number, type and expiry date typed in. |
| What is kept | The photo only while under review; deleted on the decision. Afterwards: status, type, expiry date, the last 4 characters of the number, who decided and when, reason and note (RA 10173: least data held). |
| Expiry | Reminders 30 and 7 days before; on the expiry date the driver can't post until a renewed license is approved. |
| Rejection | A fixed reason plus an optional note (required for Other). The driver sees it and can upload again. |
| Student permits | Rejected (a student permit doesn't allow carrying passengers). |

Out of scope: reading the license automatically (OCR), checking it with LTO.

## Data

```prisma
enum LicenseStatus { PENDING APPROVED REJECTED }
enum LicenseType { NON_PROFESSIONAL PROFESSIONAL STUDENT_PERMIT }
enum LicenseRejectReason {
  UNREADABLE        // blurry or unreadable photo
  DETAILS_MISMATCH  // typed number or expiry doesn't match the photo
  EXPIRED
  STUDENT_PERMIT
  NOT_A_LICENSE
  NAME_MISMATCH     // name on the license isn't the account's
  OTHER             // note required
}

model DriverLicense {
  id            String               @id @default(cuid())
  userId        String
  user          User                 @relation(fields: [userId], references: [id])
  status        LicenseStatus        @default(PENDING)
  licenseType   LicenseType
  numberEnc     String?              // full number, encrypted; erased on the decision
  numberLast4   String
  expiresOn     DateTime             // a date (PH), stored at 00:00 UTC
  photoFile     String?              // file name under LICENSE_DIR; null once decided
  submittedAt   DateTime             @default(now())
  decidedAt     DateTime?
  decidedById   String?
  rejectReason  LicenseRejectReason?
  rejectNote    String?              // ≤ 300 characters
  @@index([userId, submittedAt])
  @@index([status, submittedAt])
}
```

One row per submission; a user's **current** license is their newest row. A
user is **verified** when their newest APPROVED row's `expiresOn` is today (PH)
or later. Additive change only.

`NotificationType` gains `LICENSE_APPROVED`, `LICENSE_REJECTED`,
`LICENSE_REQUIRED`, `LICENSE_EXPIRING`. `AdminActionType` gains
`LICENSE_APPROVED`, `LICENSE_REJECTED`. `scripts/backupModels.cjs` lists
`driverLicense` (rows only; photos are never backed up).

## Storage

- `server/config/uploads.js` adds `LICENSE_DIR`: `process.env.LICENSE_DIR`, or
  `<repo>/storage/licenses` locally (git-ignored). Production:
  `LICENSE_DIR=/data/licenses` on the existing Railway volume. Never under
  `UPLOADS_DIR`, which is served publicly.
- The file is the image encrypted with AES-256-GCM under `PII_ENCRYPTION_KEY`
  (`encryptionService` gains `encryptBuffer` / `decryptBuffer`), named
  `<random 32 hex>.bin`. The type is re-detected from the decrypted bytes when
  served.
- Upload rules as for avatars: one file, 5 MB, JPEG/PNG/WebP checked by magic
  bytes (400 `INVALID_IMAGE`).

## Driver API

| Route | Behaviour |
|---|---|
| `POST /api/users/me/license` (multipart: `photo`, `licenseNumber`, `licenseType`, `expiresOn`) | 201 `{ license }`. 409 `LICENSE_PENDING` while one is under review. 400 `INVALID_LICENSE` with `field` (`licenseNumber`: 5–20 letters, digits or dashes; `licenseType`; `expiresOn`: a real `YYYY-MM-DD`), 400 `LICENSE_EXPIRED` for a past date, 400 `INVALID_IMAGE`. Uploading after an approval replaces it once the new one is approved (renewal). |
| `GET /api/users/me/license` | `{ license: { status, licenseType, numberLast4, expiresOn, submittedAt, decidedAt, rejectReason, rejectNote } | null, verified, canPost }`. Never the photo or full number. |

`strictBody('user.license')` covers the text fields.

## Admin API (`/api/admin/licenses`, `requireAdmin`)

| Route | Behaviour |
|---|---|
| `GET /` | Pending licenses, oldest first: id, user (id, name, university ID), type, full number (decrypted), expiry, submitted at. |
| `GET /:id/photo` | The decrypted image, `Cache-Control: no-store`, while the license is PENDING; 404 after the decision. |
| `POST /:id/approve` | PENDING only (409 `ALREADY_DECIDED`). 403 `CANNOT_TARGET_SELF` for your own. Sets APPROVED, `decidedAt/ById`, erases `numberEnc` and `photoFile`; `LICENSE_APPROVED` audit entry and notification in one transaction; then deletes the file and emails the driver. |
| `POST /:id/reject { reason, note? }` | As approve, with 400 `INVALID_REASON` and 400 `NOTE_REQUIRED` (OTHER). The driver's notification and email give the reason and note. |

The admin overview adds `pendingLicenses`. Regular admins and the superadmin
can both review.

## The gate

`server/services/licenseService.js`:
- `licenseState(userId, now)` → `{ verified, status, reason }` where `reason`
  is `LICENSE_REQUIRED` (none), `LICENSE_PENDING`, `LICENSE_REJECTED`,
  `LICENSE_EXPIRED`, or null when verified.
- `createTrip` returns 403 with that code when not verified, before any other
  work. Nothing else is gated: editing, starting and ending trips that already
  exist keep working.

## Notifications and jobs

- Decision: `LICENSE_APPROVED` ("Your driver's license is approved. You can post
  trips.") / `LICENSE_REJECTED` (reason and note), plus an email.
- `npm run notify-license-required` (one-time, rerunnable: skips users who have
  a license row or already got the notification): every non-deleted user who
  has hosted a trip gets `LICENSE_REQUIRED`.
- Daily 8 AM PH cron `sendLicenseExpiryReminders`: `LICENSE_EXPIRING` 30 and 7
  days before `expiresOn` for the current approved license, deduped by type,
  user and `occurrenceDate` (= the reminder's day).
- All link to `/auth/license`. They show in both modes (no trip attached).

## Screens

- **`/auth/license`** (driver): status card (none / under review / approved
  until … / rejected with reason / expired) and the upload form: photo (camera
  allowed on phones), license number, type, expiry date. A note says the photo
  is seen only by admins and deleted after review.
- **Sign-up:** "Will you drive?" (Yes / Not now). Yes → `/auth/license` after
  the account is created.
- **Post a Trip:** when the driver can't post, the form is replaced by the
  status card and a link to `/auth/license`.
- **Profile:** "Driver's license" row with the status.
- **Admin → Driver licenses:** the queue; each item shows the photo, the
  account's name and university ID next to the typed details, Approve, and
  Reject (reason picker, note).
- Notifications page: icons and links for the four new types.

## Testing

- Unit: number and date validation, `licenseState` (none, pending, rejected,
  approved, expired today vs yesterday), buffer encryption round trip.
- API (Jest): upload validation and magic bytes; the stored file is not the
  plain image and isn't under `UPLOADS_DIR`; second upload while pending 409;
  photo route 403 for non-admins, 404 after decision; approve/reject delete the
  file, write the audit entry and notification; self-review 403; createTrip
  403 codes and success once approved; renewal; expiry reminders once each;
  the notify script skips users who already have a license. Cross-user access
  table rows for the admin routes.
- Existing tests post trips as fresh users: the seed helper `makeUser` gives
  every test user an approved license unless called with `licensed: false`,
  and tests that create users another way get one through
  `makeLicense(bag, userId, overrides)`.
- Postman folder "21. Driver licenses". `seed:postman` gives the host and the
  passenger approved licenses so earlier folders keep posting (folder 19's
  passenger posts to reach the schedule-conflict check); folder 21 uses a third
  account with none.
- When a renewal is pending or rejected while an earlier approval is still
  valid, the driver stays verified until that earlier one expires. Browser check: upload, admin
  approve, Post a Trip unlocked.

## Rollout

Backup; `db push` on dev and demo; production on deploy (additive). Set
`LICENSE_DIR=/data/licenses` on Railway before deploying. Run
`npm run notify-license-required` once on production after deploy. Seeds:
demo drivers Juan, Miguel, Ana, Carlo approved; Rico pending with a made-up
sample image; Postman host approved. AGENTS.md section; roadmap E → done.
