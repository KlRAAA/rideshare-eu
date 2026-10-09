# Passenger location for the driver (sub-project G)

Roadmap: `2026-10-08-panel-revisions-roadmap.md`. Panel note §3. Approved in
chat on 9 Oct 2026. Builds on sub-project B (the driver's live location).

## Problem

The driver can't tell whether a rider is actually at the meeting point. The
panel asked that an approved rider's live location be shared with that trip's
driver only, around pickup time.

## Decisions

| Topic | Decision |
|---|---|
| Opt-in | A switch per trip on the rider's trip page ("Share my location with the driver before pickup"), remembered; the rider can turn it off any time. |
| Window | From 15 minutes before that day's departure until the driver starts the trip, at the latest when the start window closes (60 minutes after departure). |
| Who sees it | Only that trip's driver (and the rider). Never admins, never data releases. |
| Driver view | Rider pins on the driver's map and one line per approved rider: at the meeting point (≤ 100 m) / distance / not sharing, with how long ago. |
| Retention | Only the latest point. Erased at Start Trip, when the rider turns sharing off or deletes the account, and by the 5-minute job when older than 30 minutes or the request is no longer approved. |
| Limit | A web page can't share from the background: the rider's trip page must be open (stated in the UI). |

## Data

`Match` gains (additive):

```prisma
sharesLocation Boolean   @default(false) // the rider's switch (sub-project G)
riderLat       Float?
riderLng       Float?
riderLocatedAt DateTime?
```

## API

| Route | Behaviour |
|---|---|
| `PATCH /api/matches/:id/location-sharing { on }` | Passenger of that match only (403), APPROVED only (409 `NOT_APPROVED`). 200 `{ sharesLocation }`. Turning off erases the point. Schema `match.locationSharing`. |
| `POST /api/trips/:id/rider-location { lat, lng }` | The caller's APPROVED match on that trip (403 otherwise), `sharesLocation` on (409 `NOT_SHARING`), inside the window (409 `NOT_IN_WINDOW` with `opensAt`; 409 `TRIP_STARTED` once a run is ongoing or completed that day). Coordinates validated as in B (400 `INVALID_COORDINATES`). Stores the point. Schema `trip.riderLocation`. |
| `GET /api/trips/:id/rider-locations` | Host only (403). `{ riders: [{ matchId, passengerId, fullName, sharing, location: { lat, lng } | null, updatedAt, metersToPickup, atPickup }] }` for APPROVED riders; a point older than 30 minutes is treated as none. `metersToPickup` uses the meeting point, else the origin; `atPickup` = within 100 m. Empty once the day's run has started. |

The window uses `tripRunRules`: the departure is `nextDeparture(trip, now)`
(which already skips skipped and no-show days); open when
`departure − 15 min ≤ now ≤ departure + 60 min` and no run of that day is
ONGOING or COMPLETED.

`GET /api/trips/:id` adds `myLocationSharing` (the caller's `sharesLocation`,
for a passenger with an approved match) so the rider's switch renders without
another request.

## Erasing

- `startRun`: `match.updateMany({ tripId }, { riderLat: null, riderLng: null, riderLocatedAt: null })`.
- Account deletion: the same for the user's matches.
- The 5-minute cron: `clearStaleRiderLocations(now)` erases points older than
  30 minutes and points on matches that aren't APPROVED.

Pure rules in `server/services/riderLocationRules.js` (`sharingWindow`,
`AT_PICKUP_M = 100`, `STALE_MS`); DB work in
`server/services/riderLocationService.js`; routes in
`tripRunController.js` / `matchController.js`.

## Screens

- **Rider's trip page** (approved, trip active, not started): a card with the
  switch, the state ("Sharing with your driver now" / "Starts at 6:30 AM, keep
  this page open" / "Off"), and the open-page limit. While on and in the
  window, the page sends its position every 30 s (`getCurrentCoords`, the same
  helper as the driver).
- **Driver's trip page** (before Start): polls `rider-locations` every 30 s
  while within the window; rider pins (initial, emerald) on `RouteMapView`
  (new `riderLocations` prop, included in the fitted view) and a "Riders"
  list with the status lines.

## Testing

- Pure: window edges (−15 min, departure + 60, a started day), distance and
  at-pickup labels.
- API: switch (own, approved only, off erases); posting refused when off,
  early, started; only the host reads; another approved rider can't read;
  stale point reads as none; Start erases; the cleanup job erases old and
  non-approved; account deletion erases. Cross-user rows for the three routes.
- Postman folder "23. Rider location". Browser: demo trip leaving soon,
  Paolo shares, Miguel sees the pin and the line.

## Rollout

Backup; `db push` on dev and demo; production on deploy (additive). Demo:
Miguel's soon trip already has Paolo approved. AGENTS.md section; roadmap
G → done.
