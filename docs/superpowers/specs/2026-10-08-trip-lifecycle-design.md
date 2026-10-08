# Trip lifecycle: Start Trip, ongoing runs, ETA and live location (sub-project B)

Roadmap: `2026-10-08-panel-revisions-roadmap.md`. Panel notes 0a, §2, §3.
Approved in chat on 8 Oct 2026.

## Problem

A trip is `OPEN`, `FULL`, `CANCELLED` or `COMPLETED`; nothing records that it has
started. So an underway trip can still be cancelled, there is no elapsed time
or ETA, and the driver's live location has no clear start or end.

Live location also rarely appears in practice: sharing is off by default
(Profile → `Preference.liveLocationSharing`), the driver's phone only sends a
position while the trip page is open, and a position older than 90 s is hidden.

A worse bug: on the trip page, a host with sharing on runs a one-time "near
campus" check that calls `POST /api/trips/:id/complete`. A host who opens the
page near campus, even days before departure, completes the trip at once:
pending requests are declined and rating prompts go out.

## Decisions

| Topic | Decision |
|---|---|
| Where "ongoing" lives | A per-day **trip run**. One-time trips have one run day; recurring trips one per day they run. Sub-project D (skip a date, no-show) extends the same table. |
| Start window | From 30 minutes before to 2 hours after that day's departure, on a day the trip runs (Philippine time). |
| Ending | The driver taps End Trip. Safety net: a run still ongoing 60 minutes after its planned arrival ends automatically. Arriving near campus also ends it, but only once started. |
| Location sharing | Starting the trip shares the driver's position with approved riders until the run ends. The Profile setting is removed. |

## Data model

```prisma
enum RunStatus {
  ONGOING
  COMPLETED
}

enum RunEndReason {
  DRIVER     // End Trip
  AUTO       // 60 min after planned arrival
  ARRIVED    // near campus while ongoing
}

model TripRun {
  id                    String        @id @default(cuid())
  tripId                String
  trip                  Trip          @relation(fields: [tripId], references: [id])
  runDate               DateTime      // the run's Philippine calendar day, as phDateOnly() gives it
  status                RunStatus     @default(ONGOING)
  startedAt             DateTime      @default(now())
  plannedArrivalAt      DateTime      // that day's departure + durationSeconds
  endedAt               DateTime?
  endReason             RunEndReason?
  lastKnownLat          Float?
  lastKnownLng          Float?
  lastLocationUpdatedAt DateTime?
  etaAt                 DateTime?     // live ETA from the driver's phone
  createdAt             DateTime      @default(now())

  @@unique([tripId, runDate])
  @@index([status])
}
```

- The driver's position moves to the run. `Trip.lastKnownLat`, `lastKnownLng`,
  `lastLocationUpdatedAt` and `Preference.liveLocationSharing` are no longer
  read or written, but the columns stay: dropping them is a data-loss change
  that the deploy's plain `prisma db push` refuses. They go with the move to
  versioned migrations after UAT.
- `NotificationType` gains `TRIP_STARTED`.
- A day nobody started has no row. `Trip.status` keeps its four values.
- `scripts/backupModels.cjs` lists `tripRun` after `trip` (the backup test
  enforces this).

## Rules (server)

A pure module `server/services/tripRunRules.js`:

- `runDepartureFor(trip, now)` → today's departure instant (the first departure
  plus whole days, as `reminderService.upcomingDeparture` does; the Philippines
  has no DST) or `null` when the trip doesn't run on today's Philippine day
  (`recurrenceRunsOnDay`).
- `startWindow(departure)` → `{ opensAt: departure − 30 min, closesAt: departure + 2 h }`.
- `plannedArrival(departure, trip)` → `departure + durationSeconds` (departure
  itself when the route duration is unknown).
- `canStart(trip, now, existingRun)` → `null` or an error code:
  `TRIP_NOT_ACTIVE` (not OPEN/FULL), `NOT_A_TRIP_DAY`, `TOO_EARLY_TO_START`
  (with `opensAt`), `TOO_LATE_TO_START`, `ALREADY_STARTED`.

For a departure close to midnight the "day" is the departure's Philippine day,
so a 11:50 PM trip can be started at 12:30 AM the next day. `runDepartureFor`
therefore checks today's and yesterday's departures and takes the one whose
start window contains `now`.

## API

| Route | Who | Behaviour |
|---|---|---|
| `POST /api/trips/:id/start` | host | Applies `canStart`; creates the run (`ONGOING`, `plannedArrivalAt`); sends `TRIP_STARTED` to approved riders ("Your driver has started the trip to …"). 201 `{ run }`. 409 with the code above; 403 not the host; 404 no trip. |
| `POST /api/trips/:id/end` | host | Ends the ongoing run (`DRIVER`), then completes: `completeTrip` for one-time trips, `completeRecurringOccurrence(trip, runDate)` for recurring ones. 409 `NO_ONGOING_RUN`. |
| `POST /api/trips/:id/arrived` | host | Same as end with `ARRIVED`, called by the near-campus check. 409 `NO_ONGOING_RUN` when not started, so it can never complete an unstarted trip. Replaces the client's call to `/complete`. |
| `POST /api/trips/:id/location` | host | Requires an ongoing run (409 `NO_ONGOING_RUN`); `{ lat, lng, etaSeconds? }`; stores the position, and `etaAt = now + etaSeconds` when given (0–6 h). The preference check is removed. |
| `GET /api/trips/:id/location` | host, approved riders | `{ location: null }` unless a run is ongoing and the position is under 90 s old; otherwise `{ location: { lat, lng, updatedAt }, etaAt }`. |
| `GET /api/trips/:id` | as today | Adds `currentRun: { status, startedAt, plannedArrivalAt, etaAt } | null` (today's run, ongoing or ended) and `nextDeparture` with its start window, so the page can show "You can start from 6:30 AM". |
| `PATCH /api/trips/:id/cancel`, passenger cancel | as today | 409 `TRIP_IN_PROGRESS` while a run is ongoing. |
| `POST /api/trips/:id/complete` | host | Unchanged for a trip that isn't ongoing (manual completion); while a run is ongoing it behaves like `end`. |

Each new write route gets a `strictBody` schema (`trip.start`, `trip.end`,
`trip.arrived`; `trip.location` gains `etaSeconds: 'number'`).

**Automatic end.** The existing 5-minute cron in `server.js` also runs
`endOverdueRuns(now)`: every `ONGOING` run with `plannedArrivalAt + 60 min < now`
ends with `AUTO` and completes like `end`.

**Not started.** `applyLazyCompletion` keeps completing never-started trips as
today; sub-project D replaces that with skipped days and no-shows.

## Screens

Trip page, driver (`TripDetailClient`):
- Before the window: "You can start this trip from 6:30 AM." In the window:
  **Start Trip**. Pressing it asks for location permission (sharing works
  without it, just with no position).
- Ongoing: a banner "Trip in progress · 14 min" (ticks every 30 s), "Arrive
  about 7:42 AM" (live ETA, else planned arrival), **End Trip** (confirm
  dialog), and "Keep this page open so your riders can see where you are." The
  page holds a screen wake lock while ongoing (released on end, ignored where
  unsupported). Cancel is hidden.
- The driver's phone sends its position every 30 s and, every 2 minutes,
  computes the remaining drive with `fetchRoute(position, destination)` and
  sends `etaSeconds`.
- The near-campus check runs only while a run is ongoing and calls `arrived`.

Trip page, rider:
- Before start: "Arrives about 7:45 AM" (planned).
- Ongoing: the same banner (elapsed and ETA), the driver's car on the map
  (polled every 30 s), cancel hidden.

My Trips and the dashboard: an "In progress" badge on a trip with an ongoing run.

Profile: the "Share my live location" toggle is removed.

## Error handling

- Start/end/arrived/location failures show the server's message; a 409 refreshes
  the page so its state matches the server.
- Location and ETA failures are silent per tick (the next tick retries), as now.
- Mapbox unavailable: no live ETA; the planned arrival is shown.

## Testing

Server (Jest, tests first):
- `tripRunRules`: window edges (−30 min, +2 h), a non-run day, Philippine-time
  edges (a 7:00 AM departure stored as 23:00 UTC; a near-midnight departure),
  planned arrival with and without a route duration.
- API: start as host / as rider (403) / twice (409) / outside the window;
  riders get `TRIP_STARTED`; end and arrived complete one-time and recurring
  trips correctly; arrived on an unstarted trip → 409 and the trip stays OPEN
  (regression for the early-completion bug); cancel while ongoing → 409;
  location write/read only while ongoing and only for approved riders;
  `endOverdueRuns` ends only overdue runs.
- `backupModels.test.js` and `strictBody.test.js` keep passing.

Web (Jest): the elapsed and ETA labels ("14 min", "Arrive about 7:42 AM").

Postman: a "Trip runs" folder (start, location, read as rider, end; the 409s).

Browser: driver and rider views on the demo data, before, during and after a run.

## Rollout

Schema change before UAT (the freeze starts with UAT): back up, then
`npx prisma db push` on `rideshare_dev` and `rideshare_demo`; production applies
it on deploy. Update `seedDemo.js` and `seedPostman.js` (no
`liveLocationSharing`). AGENTS.md gets a section.

## Out of scope

Skipping a day, advance confirmation, no-shows (D); passenger location (G);
loud notifications (F; `TRIP_STARTED` is an ordinary notification until then);
sharing location from a locked phone (not possible for a web app).
