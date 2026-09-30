# Admin Role — Design

**Status:** approved in brainstorming on 2026-09-30, awaiting spec review.
**Why:** the research adviser asked for an admin role that handles
maintenance and safety, and that sets fuel prices for everyone so hosts
can't overcharge.

The admin role is the first of several pieces of adviser feedback. The rest
follow as their own designs, in this order:

1. saved cars
2. full-screen map with draggable pins
3. form drafts that survive "back"
4. quick fixes
5. defense documents: algorithm, backend, connection recheck, data handling,
   governance, legality, sustainability
6. Jira CSV
7. deployment and simultaneous testing
8. data-usage measurement

## Decisions

| Question | Decision |
|---|---|
| Scope | All four powers: the official fuel price, report review and bans, user and trip oversight, and a system dashboard. |
| Fuel price | The admin-set official price is a **cap**. The form pre-fills it, and a host may enter less but never more. |
| Becoming an admin | The first admin is created with `npm run make-admin <email>`. After that, admins promote and demote each other in the dashboard. Nobody can make themselves an admin through the app. |
| Approach | An `isAdmin` flag on the normal account, guarded `/api/admin/*` routes, and `/auth/admin` pages in the existing Next.js app. Rejected: an off-the-shelf admin panel (it shows encrypted fields as scrambled text and skips business rules) and an `ADMIN` role value (roles are derived from the email address, and a staff member can also be an admin). |
| Trip chats | Admins **cannot** read them. The manuscript's RA 10173 section promises that only matched partners see trip details. |

## 1. Data model

All changes are additive or have defaults, so `npx prisma db push` is safe
for existing rows. Take a backup first with `node scripts/backup-db.mjs`.

- `User.isAdmin Boolean @default(false)`
- `Report` gains:
  - `status ReportStatus @default(OPEN)`, where `ReportStatus` is `OPEN`,
    `REVIEWED` or `DISMISSED`
  - `reviewedById String?`, a relation to `User`
  - `reviewedAt DateTime?`
  - `reviewNote String?`, capped at 500 characters
- New `FuelPrice` model, with one row per change:
  - fields: `id`, `pricePerLiter Float`, `setById` (relation to `User`),
    `createdAt`
  - The current official price is the newest row. No rows means no official
    price is set.
- New `AdminAction` model, the audit log:
  - `actorId String?`, a relation to `User`. It is null when the automatic
    strike ladder acted, so ban history is complete.
  - `action AdminActionType`, one of: `BAN`, `UNBAN`, `REPORT_REVIEWED`,
    `REPORT_DISMISSED`, `TRIP_CANCELLED`, `FUEL_PRICE_SET`, `PROMOTE`,
    `DEMOTE`
  - `targetUserId String?`, `targetTripId String?`, `targetReportId String?`
  - `details Json?`: ban length and category, the old and new price, the note
  - `createdAt`, plus indexes on `(createdAt)` and `(targetUserId, createdAt)`
- Update the schema comments that say "no admin role, deliberately" so they
  describe the new model: the automatic ladder, with admin review on top.

## 2. Access control

- `authenticate` already loads the user on every request for its ban check.
  It now also selects `isAdmin` and sets `req.user.isAdmin`. Demoting an
  admin takes effect on their next request, not when their login token
  expires.
- New `server/middleware/requireAdmin.js` runs after `authenticate` and
  returns `403 { error: 'ADMIN_ONLY' }` for anyone who isn't an admin. It is
  mounted once, on the `/api/admin` router.
- Safety rules, enforced on the server:
  - An admin can't ban or demote themselves (`400 CANNOT_TARGET_SELF`).
  - The last remaining admin can't be demoted (`409 LAST_ADMIN`).
  - An admin can't be banned without being demoted first
    (`409 TARGET_IS_ADMIN`).
- `GET /api/users/:id` returns `isAdmin` only for the caller's own record,
  the same rule already used for `email`.

## 3. API

Every route is under `/api/admin` and requires an admin, except
`GET /api/fuel-price`, which any signed-in user can call.

| Endpoint | Behavior |
|---|---|
| `GET /api/admin/overview` | Counts: users, open trips, completed trips, pending requests, open reports, active bans. Also returns the 10 most recent audit rows. |
| `GET /api/fuel-price` | `{ official: number \| null, updatedAt }` |
| `PUT /api/admin/fuel-price` `{ pricePerLiter }` | The price must be between PHP 20 and 150 (`400 INVALID_FUEL_PRICE`). Inserts a `FuelPrice` row and writes the audit row. |
| `GET /api/admin/fuel-price/history` | Newest first, with the setter's decrypted name. |
| `GET /api/admin/reports?status=OPEN` | Reports with the reporter, reported user, match and trip summary. Names are decrypted. Paged with a cursor. |
| `PATCH /api/admin/reports/:id` `{ status, note, ban? }` | Sets `REVIEWED` or `DISMISSED` plus the reviewer, time and note. The optional `ban: { duration }` bans the reported user in the same transaction, using the report's category as the ban reason. The same safety rules as the ban endpoint apply. |
| `POST /api/admin/users/:id/ban` `{ duration, reason }` | `duration` is `24H`, `7D`, `30D` or `PERMANENT`. Sets `bannedUntil`, `banReason` and `banSeverity`, and sends the existing ban email. |
| `POST /api/admin/users/:id/unban` `{ reason }` | Clears the three ban fields. |
| `GET /api/admin/users?q=` | Searches by email or university ID in the database, and by name by decrypting in memory (names are encrypted with a random IV, so the database can't search them). Returns at most 50 results. |
| `GET /api/admin/users/:id` | Profile plus trips hosted and joined, ratings, reports filed and received, and ban history from the audit log. |
| `PATCH /api/admin/trips/:id/cancel` `{ reason }` | Moves the host-cancel logic out of `tripController.cancelTrip` into a shared service and calls it. Passengers are notified, and the reason is prefixed "Cancelled by an administrator: ". |
| `POST /api/admin/users/:id/promote`, `.../demote` | Subject to the safety rules in section 2. |
| `GET /api/admin/actions?cursor=` | Audit log, newest first. |

- Every write calls `adminActionService.record(tx, {...})` inside the same
  `prisma.$transaction` as the change, so a change and its audit row can
  never disagree.
- The automatic strike ladder (`reportEnforcementService`) also records a
  `BAN` row with `actorId = null`.
- **Fuel price cap on trip creation.** `createTrip` loads the official price.
  If one exists and the host's `fuelPricePerLiter` is above it, it returns
  `400 FUEL_PRICE_ABOVE_OFFICIAL`. If there is no official price, today's
  20–150 bounds apply unchanged. Existing trips are untouched, because the
  share is locked when the trip is posted.
- **`make-admin` script.** `server/scripts/makeAdmin.js <email>` sets
  `isAdmin` and writes a `PROMOTE` audit row with `actorId = null`. It exits
  non-zero if the email doesn't exist.

## 4. Screens

All admin pages are under `src/app/auth/admin/`. The admin layout calls
`getCurrentUser()` on the server and returns `notFound()` unless the caller
is an admin. The API's 403 is the real guard; the 404 just hides the admin
area.

- **Entry point:** one "Admin" item in the profile menu, shown only to
  admins. Regular users see no new buttons.
- **Overview:** stat tiles, an "Open reports" shortcut, and the recent
  activity list.
- **Reports:** Open, Reviewed and Dismissed tabs. Each report card opens a
  panel with Dismiss, Mark reviewed, or Ban (with a length picker). A note is
  required.
- **Users:** a search box, then a user detail page with trips, ratings,
  reports and ban history. The Ban, Unban, Promote, Demote and Cancel-trip
  buttons all ask for confirmation.
- **Fuel price:** the current price, a form to set a new one, and the
  history.
- **Activity log:** a paged list of audit rows.
- **Layout:** works on a phone (tables collapse into cards) and on a laptop,
  in both themes.
- **Post-trip form:** pre-fills the official price, with the hint "Official
  price PHP 62.55/L. You can enter less, not more.", filled with the live
  price from `GET /api/fuel-price`. Entering more shows an inline
  error before submitting.

## 5. Testing

Tests are written first, as Jest integration tests against the local
PostgreSQL database, using the existing `server/test-helpers/seed.js`
pattern.

- `requireAdmin`:
  - no token returns 401
  - a non-admin gets 403
  - a demoted admin is refused on their very next request
- The normal path of every endpoint in section 3.
- The safety rules: `CANNOT_TARGET_SELF`, `LAST_ADMIN`, `TARGET_IS_ADMIN`.
- Every admin write produces exactly one audit row. An automatic-ladder ban
  produces a row with `actorId = null`.
- Fuel price cap:
  - at the official price, 201
  - below it, 201
  - above it, 400
  - with no official price, the old bounds apply
- Report review together with a ban applies both, or neither.
- The admin cancel notifies passengers, exactly like a host cancel.
- Postman: a new "Admin" folder in the Automated run. `seedPostman.js`
  creates a third, admin account.
- Browser: walk every admin page and the post-form hint at 375 px and at
  desktop width, in light and dark themes.

## 6. Documentation updates

- **Manuscript:**
  - the fuel share section (the host price is capped at the admin-set
    official price)
  - the moderation and report passages (automatic ladder plus admin review)
  - any "no admin role" statements
  - I'll provide the replacement text to paste into Word.
- **`docs/security/owasp-top10-review.md`:**
  - A01: add the admin guard as evidence.
  - A09: the audit log covers admin actions and automatic bans. This is still
    partial, because failed logins aren't logged yet.
- **`AGENTS.md`:** the admin role, `make-admin`, and the fuel-price endpoint.

## Out of scope

- Announcements or broadcast messages.
- Admins editing a user's profile data.
- CSV exports.
- Admins reading trip chats.
- Automatically recalculating existing trips when the official price changes.
