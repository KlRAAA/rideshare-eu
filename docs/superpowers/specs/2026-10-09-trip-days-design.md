# Trip days: confirm, skip, no-show (sub-project D)

Roadmap: `2026-10-08-panel-revisions-roadmap.md`. Panel notes 0b and §11.
Builds on sub-project B's `TripRun` (one row per trip per Philippine day).
Approved in chat on 9 Oct 2026.

## Problem

A driver with a recurring trip who can't drive one day, and forgets to cancel,
leaves riders waiting at the pickup point. There is no way to skip a single
day, nobody asks the driver ahead of time, and riders hear nothing when the
driver doesn't turn up. Separately, `applyLazyCompletion` still completes trips
nobody started and sends rating prompts for rides that may not have happened.

## Decisions

| Topic | Decision |
|---|---|
| Which trips | All trips get confirmations and no-show handling; "Skip this date" is for recurring trips only (a one-time trip is simply cancelled). |
| Asking the driver | One "Still driving tomorrow?" notification at 8 PM Philippine time the evening before, when the day has approved or pending riders. A trip posted after that 8 PM for the next day counts as confirmed. |
| Riders before departure | 60 minutes before departure, if the driver was asked and hasn't confirmed, approved riders are warned. |
| Riders after departure | +15 minutes without Start Trip: riders are told the driver hasn't started. +60 minutes: recorded as a no-show, riders told. The start window now closes at +60 minutes (was 2 hours). |
| No-show consequences | Recorded and shown on the admin watch list (2 or more in 30 days). No automatic strike or trust-score change. |

## Data

```prisma
enum RunStatus {
  CONFIRMED   // driver confirmed the day ahead of time
  ONGOING
  COMPLETED
  SKIPPED     // driver isn't driving that day (recurring trips)
  NO_SHOW     // not started 60 minutes after departure, with approved riders
}
```

`TripRun` changes (all additive or loosening, no data loss):
- `startedAt DateTime?` (was required with a default): only set by Start Trip.
- `confirmedAt DateTime?`, `skipReason String?` (≤ 200 characters).

`NotificationType` gains `CONFIRM_REQUEST` (to the driver), `DRIVER_UNCONFIRMED`,
`DRIVER_LATE`, `DRIVER_NO_SHOW`, `TRIP_SKIPPED` (to riders). Each is created with
`occurrenceDate` = the run day, and the job checks for an existing one with the
same type, user, trip and day before creating, so nothing is sent twice.

## Rules (pure, `server/services/tripDayRules.js`)

Built on `tripRunRules.departureOnDay`:
- `askAt(day)` → 8 PM Philippine time on the day before `day`.
- `stepsDue(departure, now)` → which of `ASK`, `UNCONFIRMED_WARNING`
  (departure − 60 min), `LATE_WARNING` (+15), `NO_SHOW` (+60) are due.
- `upcomingDays(trip, from, count)` → the next `count` run days with their
  departures (for the driver's day list and skip validation).

`tripRunRules.START_LATE_MS` becomes 60 minutes.

## Driver actions

| Route | Behaviour |
|---|---|
| `POST /api/trips/:id/days/:date/confirm` | Host. `date` = `YYYY-MM-DD` (PH). Must be a run day whose departure hasn't passed. Creates a `CONFIRMED` run (or 409 if the day already has a run: `ALREADY_STARTED`, `DAY_SKIPPED`). 200 `{ run }`. |
| `POST /api/trips/:id/days/:date/skip` `{ reason? }` | Host, recurring trips only (409 `ONE_TIME_TRIP`). Run day not yet started (409 `ALREADY_STARTED`). Upserts the run to `SKIPPED`; approved riders get `TRIP_SKIPPED` ("Juan isn't driving on Tue 14 Oct" + reason). |
| `DELETE /api/trips/:id/days/:date/skip` | Host, before that day's departure (409 `TOO_LATE`). Deletes the `SKIPPED` run; approved riders get `TRIP_SKIPPED` worded "is driving again on …". |
| `POST /api/trips/:id/start` | As in B, but a `CONFIRMED` run for that day is updated to `ONGOING` instead of a new row; a `SKIPPED` day → 409 `DAY_SKIPPED`; the window closes at +60 min. |

Each route has a `strictBody` schema (`trip.dayConfirm`, `trip.daySkip`,
`trip.dayUnskip`).

## Automatic steps (the 5-minute job: `tripDayService.runDaySteps(now)`)

For each OPEN or FULL trip and its run day around `now` (today and tomorrow, PH):

| Step | Condition | Action |
|---|---|---|
| Ask | now ≥ `askAt(day)`, before departure; no run row; trip created before `askAt(day)`; approved or pending riders | `CONFIRM_REQUEST` to the host: "Still driving tomorrow at 7:00 AM to MSEUF? Confirm or skip." |
| Unconfirmed warning | now ≥ departure − 60 min, before departure; no run row; a `CONFIRM_REQUEST` exists for the day | `DRIVER_UNCONFIRMED` to approved riders |
| Late warning | now ≥ departure + 15 min; no run row or `CONFIRMED`; approved riders | `DRIVER_LATE` to approved riders |
| No-show | now ≥ departure + 60 min; no run row or `CONFIRMED`; approved riders | Run becomes `NO_SHOW` (`endedAt` = now); `DRIVER_NO_SHOW` to approved riders; one-time trip: cancelled with reason "The driver didn't start the trip" (matches cancelled as in `cancelWholeTrip`, without the cancellation notifications); recurring: that day's PENDING requests are declined |
| No riders | now ≥ departure + 60 min, no approved riders, not started | One-time: `completeTrip` (closes quietly, as today). Recurring: nothing. |

`applyLazyCompletion` stops completing never-started trips; read paths call the
same per-trip step function, so a page never shows stale state between job runs.
Manual "Mark as completed" still works until a no-show is recorded.

**Search and reminders.** `matchController.loadSearchCandidates` drops a trip
whose run on the searched date is `SKIPPED`; `reminderService` skips skipped and
no-show days.

**Watch list.** `watchlistService` adds `driverNoShows`: hosts with ≥ 2
`NO_SHOW` runs in 30 days ("2 no-shows as driver").

## Screens

- **Driver, recurring trip page:** "Next 7 days" list, each day with its time
  and status (Not confirmed / Confirmed / Skipped / No-show / Completed) and
  actions: Confirm, Skip (asks for an optional reason), Undo skip.
- **Driver, one-time trip:** "Confirm you're driving" button while the trip is
  upcoming and unconfirmed.
- **Rider trip page:** a line for the next run: "Your driver confirmed",
  "Your driver isn't driving on Tue 14 Oct", "Not confirmed yet", or
  "Your driver didn't start this trip". When the driver is late or a no-show,
  **Find another ride** opens `/auth/search` with the trip's origin,
  destination, date and time filled in.
- `GET /api/trips/:id` adds `days: [{ date, departure, status }]` (next 7 run
  days; status `null` when nothing is recorded).
- Notifications: icons and links (trip page) for the five new types.

## Testing

Server (Jest, tests first):
- `tripDayRules`: ask time (8 PM the evening before, PH), each step's edge
  (exactly −60, +15, +60).
- `runDaySteps` with a fixed `now`: ask sent once; unconfirmed warning only when
  asked; late warning; no-show for one-time (trip cancelled) and recurring (day
  marked, trip open, pending declined); no riders → no row; nothing sent twice
  across repeated runs; confirmed and skipped days not warned.
- Routes: confirm, skip (recurring only), undo (until departure), Start on a
  confirmed day, Start refused on a skipped day, start window closes at +60.
- Search hides a skipped date; reminders skip it; watch list flags 2 no-shows.

Postman: folder "20. Trip days". Browser: the driver's day list (confirm, skip,
undo) and the rider's status line.

## Rollout

Schema change before UAT (backup; `db push` on dev and demo; production on
deploy; additive). AGENTS.md section; roadmap D → done.

## Out of scope

Per-day seats (a rider still holds every day's seat); rider "not riding today";
trust-score effects of no-shows.
