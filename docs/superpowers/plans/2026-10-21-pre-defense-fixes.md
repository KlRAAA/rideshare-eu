# Pre-defense fixes (21 Oct 2026)

Defense is 26 Oct. UAT is running on the live site, so every change here deploys
mid-test. Rules for the whole plan:

- **No `prisma/schema.prisma` changes** (schema freeze during UAT). Items that need
  one are in Phase 4 and wait until after UAT.
- One commit per item, tests with each, `npm run test:server` and `npx tsc --noEmit`
  green before "merge and push". CI and `/api/health` checked after each push.
- Don't change the fuel-share formula or the PSGA weights: the manuscript and the
  validation numbers describe them.

## Decisions (21 Oct, from the team)

1. **Passenger cancel:** allowed until the driver taps Picked up; blocked after.
   (Today it is blocked from the moment the trip starts.)
2. **Admin overview lists:** passenger names for the superadmin only; regular
   admins see host and "2 of 3 seats".
3. **Overlap buffer:** 10 minutes each side of a trip. Yes.
4. **Ratings:** the softer rule, not a hard block. A rider can't send a new join
   request until they've rated their last completed ride; a driver can't post the
   next trip until they've rated the riders of their last completed trip (lapses
   after 24 h). Everything else keeps working.
5. **End Trip:** confirm dialog plus an optional note to riders.

## What already exists (don't rebuild)

| Request | Already in the app |
|---|---|
| Overlapping trips | `SCHEDULE_CONFLICT` on join (vs trips you drive), post and edit (vs rides you have PENDING/APPROVED), and approve. Uses `durationSeconds` (60 min when unknown). `services/scheduleRules.js`, `scheduleConflicts.js`. |
| No cancel once the trip is moving | Host and passenger cancel both return 409 `TRIP_IN_PROGRESS` while a run is ONGOING (`tripController.js` ~405, ~458); the Cancel button is hidden (`TripDetailClient.tsx:150`). |
| Confirm End Trip | `TripRunPanel.tsx:82` already asks "End this trip?". |
| Cancel reason | `CancelTripModal` has a reason box, but only the **host's** reason is sent (`reason: isHost && reason ? ...`). |
| Logout | Exists, but is the last row of Profile (`ProfileClient.tsx:304`). |
| License text detection | Done (`licenseOcr.js`, `licenseChecks.js`), but the details are typed first and the photo is only compared with them. |
| Admin overview tiles | The five queue cards already link to their pages. "Platform today" counts do not. |
| Admin user search | `/auth/admin/users?q=`. |
| "Driver almost here" | `DRIVER_ARRIVING` fires within 1 km of the **pickup** only. |
| Ratings | RATING_PROMPT notifications + Rate buttons after a trip; optional. |

## Phase 1: UX fixes, no API changes (do first, about half a day)

1. **Missing and invalid fields, red and obvious.** `src/components/InvalidFieldHint.tsx`
   already catches every form's `invalid` event and shows text under the first bad
   field. Extend it:
   - Put a red border and light red background on the field's container (the closest
     `label`/field wrapper, not only the input), driven by `aria-invalid="true"` in
     `globals.css` (`[aria-invalid="true"]`, plus a `.field-error` class on the wrapper).
   - One short shake/flash (about 600 ms, red ring pulse), disabled under
     `prefers-reduced-motion`.
   - Scroll the field to the middle of the screen, not just focus it (phones hide the
     bottom hint behind the bottom bar).
   - Message names the field: "Date is required.", "Plate number needs at least 3
     characters." Cover custom controls (`Select`, `DatePicker`, `TimePicker`,
     `AddressInput`): they need `aria-invalid` forwarded to their trigger.
   - Server errors with a `field` (`INVALID_TRIP`, `INVALID_LICENSE`, ...): a shared
     helper `showFieldError(name, message)` does the same highlight for the named field.
   - Check: Post a Trip, Find a Ride, sign-up, license upload, edit trip, report form.
2. **Colors that carry meaning.** One token set in `globals.css` and used everywhere:
   green = success/approved/available, amber = waiting/pending/warning, red = danger,
   cancelled, declined, error, maroon = brand/primary action, grey = neutral. Apply to
   status badges (`TripRow`, `TripFacts`, `RuleChips`), alerts by type, toasts, and
   the trip-day states. Follow the Calmer UI rules in AGENTS.md: colour only the
   status word or a small dot, not whole cards. Contrast must pass 4.5:1 in both themes.
3. **Logout next to the name.** In the Profile identity header, a small
   "Log out" button on the right of the name row (outline, red text), with the
   existing `handleLogout`. Keep or drop the bottom row (drop it: one place is enough).
4. **"About the app" section in Profile** (static, no API):
   - **How the fuel share is worked out:** `(distance ÷ km per litre) × fuel price ÷
     seats offered`, the price is the lower of what the driver enters and the official
     DOE cap, set once when the trip is posted and never changes; one worked example
     (20 km, 12 km/L, ₱60/L, 3 seats = ₱33.33 per seat). Say plainly: voluntary, paid
     outside the app, the driver's seat isn't counted.
   - How matching works (route 50%, time 30%, seats and rules 20%).
   - Women+ trips, 4-seat limit and why, ratings and trust, cancellation and no-show
     rules, how to report, privacy and data (links to Privacy, Terms, Help).
   - Build it as an `/about` page linked from Profile ("Help and safety" section), so
     it is also public and can be shown to the panel. Reuse `HelpShell`.
5. **Confirmations on high-impact buttons.** Audit every `rsu-btn-danger` and
   state-changing button; all use `useAppDialog().confirm`, never `window.confirm`.
   Check and add where missing: Decline a rider, Approve (shows seats left), Picked
   up / undo, Skip a day, Stop repeating (has one), Revoke license, Ban/Unban,
   Promote/Demote admin, Dismiss report, Apply/Dismiss DOE prices, Post announcement
   (notifies everyone: show the count), Delete account (has one), Delete saved car
   (has one), Turn off phone notifications. Danger actions use `danger: true`.
6. **Reasons on every cancellation.** Passenger "Cancel my spot" must also ask why
   (optional, 200 chars) and the driver gets it in the `CANCELLATION` notification
   ("Maria left your 6:45 trip: <reason>"). The API: `DELETE /api/trips/:id/match`
   accepts `reason` (add to the `strictBody` schema; no DB column, it goes only into
   the notification text). Host cancel keeps its reason. End Trip: keep the confirm
   dialog and add an optional note box ("Anything riders should know?", 200 chars),
   sent with `POST /end` and `/complete` (add `note` to their `strictBody` schemas)
   and included in the riders' rating-prompt notification text. No DB column.

## Phase 2: Rules on the server (about one day, each with tests)

7. **Overlap rules: verify, then close gaps.** The checks exist; write the missing
   tests and fix any hole they find. Matrix to test, each both ways (driver↔passenger):
   - Host posts a trip that overlaps a trip they drive → 409.
   - Host posts a trip that overlaps a ride they requested (PENDING) or joined
     (APPROVED) → 409 (`conflictTripId` returned).
   - Passenger joins a trip that overlaps a trip they host, or another ride of theirs.
   - Same time, different day: allowed. Back-to-back: allowed.
   - Use the trip's `durationSeconds` (estimated travel time) for the span, plus a
     buffer: add `TRIP_BUFFER_MIN = 10` in `scheduleRules.js` to each side so a
     20-minute trip at 7:00 blocks 6:50–7:30. Adjust the existing "back-to-back is
     fine" tests accordingly, and tell testers: this is stricter.
   - Recurring vs one-time, recurring vs recurring (shared weekday).
   - Approve race (two drivers approving the same rider) is already locked: keep the test.
   - UI: the error already carries `conflictDepartureTime`; show "You already have a
     trip at 7:00 AM that day" with a link to it, in red (Phase 1 item 1 style).
8. **Passenger cancel timing.** Change: while a run is ONGOING a rider can still
   cancel until the driver taps Picked up for them (`isPickedUp`, `Match.pickedUpAt`
   after `run.startedAt`); after that, 409 `TRIP_IN_PROGRESS`. The host still can't
   cancel while a run is ONGOING. Cancelling before pickup frees the seat and tells
   the driver (with the reason from item 6). Update the `TripDetailClient.tsx:150`
   `canCancel` rule to match, and the live-map rider switch (cancel erases the
   rider's location). Tests: ongoing + not picked up → rider 200; ongoing + picked up
   → 409; host → 409; run finished → fine.
9. **Rejoin/cancel abuse.** Rate-limit join, cancel, join again, cancel:
   - After a passenger cancels an approved or pending request, they can't request the
     **same trip** again for 2 hours (409 `REJOIN_COOLDOWN`, `retryAt`).
   - Three cancellations of any ride inside 24 hours: no new join requests for 1 hour
     (429 `JOIN_COOLDOWN`, `retryAt`), and the passenger is added to the watch list
     with a reason ("Cancelled 3 rides in 24 h"), which already flags cancels in 30 days.
   - `Match` has no `cancelledAt`, and pending cancels leave `respondedAt` null. First
     check how rejoining works (new Match row or the old one reused) and whether the
     cancel time can be derived without a schema change (e.g. a `SecurityEvent`
     entry `JOIN_CANCELLED`, or `AdminAction`-style log). If it can't, ship only the
     per-account request limiter (`rateLimit.js`, joins 10/hour) now and put the
     `Match.cancelledAt` column in Phase 4.
   - UI: the Join button shows "Try again at 3:40 PM" in amber instead of an error.
10. **Rating rule (decision 4).** No schema change: compare completed matches with
    `Rating` rows.
    - `createMatch` (join): if the passenger has a COMPLETED match (one-time) or a
      completed run day (recurring) of their own that they haven't rated, 409
      `RATING_REQUIRED` with `tripId` and `rateeName`. The Join button turns into
      "Rate <driver> first" and opens the existing rating dialog.
    - `createTrip`: same for the driver and the riders of their last completed trip,
      but only for the 24 hours after it ended; after that it lapses (no permanent lockouts).
    - Not enforced on: Find a Ride search, chat, anything else. Rating stays 1–5 with
      optional comment; no forced star value.
    - Ride ends: send the RATING_PROMPT to both sides immediately (already done) and
      show the rating dialog on the trip page at once.
    - Tests: join blocked, join allowed after rating, driver post blocked inside 24 h,
      allowed after 24 h, recurring day handled.
    Motivation extras (reveal both ratings after both rated, rating streak, "Rated 10
    rides" badge) stay in Phase 4.
11. **Near-destination notification.** Needs a new `NotificationType` value (schema
    change), so: after UAT. Until then, nothing. Design: `DRIVER_NEARING_DESTINATION`
    when the car is within 1 km of the end point (campus), to approved riders still on
    board, once per run (`occurrenceDate`), in `LOUD_TYPES`. Reuse `notifyArrivingOnce`
    with the destination point.

## Phase 3: Admin console (about one day)

12. **Focused admin shell.** In `src/app/auth/admin/layout.tsx` stop rendering the
    trip/ride `Header` tabs and `BottomNav`. Use a minimal bar: logo, "Admin console",
    the admin's name, "Back to app" and "Log out". The user-side pages stay reachable
    through "Back to app" (Home), so admins can still act as normal users, but the
    console shows no Find a Ride / Post a Trip / mode switch and no trip-chat pop-ups.
    Keep the mobile bottom bar to admin sections only (Overview, Reports, Support,
    Users, More).
13. **Admin search.** A search box in the console bar and `/auth/admin/search?q=`:
    users (name, email, university ID last digits), trips (route text, host), reports,
    support requests, licenses. API: `GET /api/admin/search?q=` returning grouped
    results (max 5 each, links to the existing detail pages); `requireAdmin`; 2-character
    minimum; 30/min limit; nothing that regular admins can't already see (no chats, no
    past-trip history, no emails shown for other users in the results text).
14. **Clickable "Platform today" tiles.** Each tile opens a list page:
    Rides today, Open trips, New sign-ups, Active bans, plus whatever else the
    overview shows. API: `GET /api/admin/overview/:kind` (`rides-today`, `open-trips`,
    `signups-today`, `active-bans`), reusing the same queries that produce the counts so
    the number and the list can't disagree. Rows: trip time, route, host, seats filled/total, status.
    Privacy (decision 2): regular admins see host and "2 of 3 seats" only. Passenger
    names are returned only when `req.user.isSuperAdmin`; reading them by the
    superadmin writes a `DATA_RELEASE_VIEWED`-style `AdminAction` entry
    (`PASSENGERS_VIEWED`, a new `AdminActionType` is a schema change: reuse
    `DATA_RELEASE_VIEWED` with a `details.source = 'overview'` until after UAT).

## Phase 4: After UAT (needs schema changes; don't build before 26 Oct)

15. **Vehicle OR/CR check.** `Vehicle` has only make/model/color/plate/efficiency.
    Needs a `VehicleRegistration` table (or fields): OR/CR photo (encrypted like the
    licenses, deleted after review), plate, make, model, year, colour, registration
    expiry, status. OCR with the existing `tesseract.js` path: read the CR, **pre-fill
    the car form** (editable), then compare with the typed values like
    `licenseChecks.js`. Gate on posting only if you decide so; a new gate mid-UAT would
    block every tester who is a driver. Also: **pre-fill the license form from the photo**
    (today the driver types first): take the photo → OCR → fill name, number, expiry,
    type → driver corrects → submit. Reuse `licenseOcr.js`; only the reading order changes.
    This one needs no schema change and can come earlier if there's time.
16. **Rush-hour fuel factor.** Don't touch the formula before the defense: the
    manuscript's formula, the validation and the posted trips all use the current
    one. Proposed after: multiply litres by `RUSH_FACTOR` (e.g. 1.15) when the
    departure falls in 6:30–9:00 or 16:30–19:30 PH on weekdays, shown on the trip as
    "includes rush-hour traffic". It has to be computed at posting and stored, so it
    follows the existing "never drifts" rule. Still capped by the DOE price. Needs a
    note in the manuscript's Fuel Share section and in the About page.
17. **Rating motivation extras:** reveal both ratings only after both sides have
    rated (or after 3 days), a "Rated 10 rides" trust badge, a streak on Profile, a
    push 5 minutes after the ride ends if still unrated. (The gate itself is item 10.)
18. **Near-destination notification** (item 11).
19. `Match.cancelledAt` if item 9 couldn't avoid it.

## Order and time (5 days left)

Oct 21: items 1, 3, 4, 6, 5. Oct 22: 7, 8, 10 (tests first), 9. Oct 23: 12, 13, 14.
Oct 24: full test run, deploy, quick pass on a phone, tell testers about the new
overlap, cancel and rating rules. Oct 25: nothing new, rehearse.
Phase 4 after the defense, except the license pre-fill if time is left.

Tester heads-up (rules that change mid-UAT): trips now need 10 minutes of space,
a rider can cancel only until pickup, new joins need the last ride rated.
