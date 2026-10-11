# Live trip map with a next-turn banner

Approved in chat on 11 Oct 2026. Builds on sub-projects B (the driver's live
location), F (driver arriving) and G (passenger location). Like a ride-hailing
app's "driver is on the way" screen: the driver and the riders see each other
on our own map while the trip runs, and the driver gets turn guidance.

## Problem

Once a trip starts, the trip page shows the posted route and, for riders, a car
pin that moves every 30 seconds. The driver can't see the riders any more (G
erases their locations at Start Trip), has no turn guidance, and riders don't
know how far the driver is from the meeting point. The pickup happens after
Start Trip: the driver starts at home and drives to the meeting point.

## Decisions

| Topic | Decision |
|---|---|
| Navigation | Our map with a next-turn banner (arrow, distance, street), rerouting and both arrival times. A **Navigate** button opens Google Maps or Waze for spoken directions. No voice, lanes, speed limits or tolls in our app. |
| Riders after Start Trip | Riders keep sharing until the driver taps **Picked up** for them (Undo allowed while the trip runs). Their location is erased at pickup. |
| Who sees whom | The driver sees their own car, the route and the riders not yet picked up. A rider sees the car and themselves, never other riders. Admins and data releases see neither positions nor pickup times. |
| Schema | Two additive, optional fields during the UAT freeze (approved): `Match.pickedUpAt`, `TripRun.pickupEtaAt`. |
| Theme | App colors: maroon route and pins, app cards and buttons; Mapbox `dark-v11` when `data-theme="dark"`, `light-v11` otherwise. |
| Background | A website can't read GPS in the background. While the driver is in Google Maps/Waze or the screen is off, positions stop; riders see "Driver's location paused · last seen N min ago". The UI says so; staying on our map is the reliable path. |

## Data

```prisma
model Match {
  // …
  pickedUpAt DateTime? // the driver tapped "Picked up"; counts only for the run it falls in
}

model TripRun {
  // …
  pickupEtaAt DateTime? // the driver's expected arrival at the meeting point
}
```

A rider is **picked up for a run** when `pickedUpAt >= run.startedAt`. For a
recurring trip, yesterday's value is older than today's start, so nothing needs
resetting between days.

## API

All under the existing authentication; every write runs `strictBody`.

- `POST /api/matches/:id/picked-up` (the trip's host; body `{}`, schema
  `match.pickedUp`): sets `pickedUpAt = now` and clears `riderLat`/`riderLng`/
  `riderLocatedAt`. 404 `MATCH_NOT_FOUND`, 403 `NOT_AUTHORIZED` (not the host),
  409 `NOT_APPROVED`, 409 `NO_ONGOING_RUN`. Repeating it is fine (200).
- `DELETE /api/matches/:id/picked-up` (host, schema `match.pickedUp`): sets
  `pickedUpAt = null` while the run is ongoing; same errors.
- `POST /api/trips/:id/location` also accepts `pickupEtaSeconds` (0–6 h, else
  400 `INVALID_ETA`); saved as `pickupEtaAt`. Schema `trip.location` gains the
  field. The phone stops sending it once no pickup is ahead; the old value is
  then left alone, because a rider's screen picks the ETA by `pickedUp`, never
  by whether `pickupEtaAt` is set.
- `GET /api/trips/:id/location` (host and approved riders) returns
  `{ location, etaAt, pickupEtaAt, pickedUp }`:
  - `location` is `{ lat, lng, updatedAt }` while the run is ongoing and the
    point is under **10 minutes** old (was 90 s), so the client can show
    "paused". The client treats a point older than 45 s as paused.
  - `pickedUp` is whether the caller is picked up for the ongoing run (always
    false for the host).
- `POST /api/trips/:id/rider-location`: allowed before the start (as in G) and
  **during an ongoing run until the rider is picked up**; after pickup 409
  `PICKED_UP`. The 409 `TRIP_STARTED` case goes away for an ongoing run; a
  completed run still refuses (`TRIP_STARTED`).
- `GET /api/trips/:id/rider-locations` (host): during an ongoing run it returns
  every approved rider with `pickedUp` and, for those not picked up and
  sharing, their location and `metersToPickup`/`atPickup` as today. Empty once
  the run is completed.

## Erasing rider locations

- Start Trip no longer erases them (`startRun` drops `clearTripRiderLocations`).
- Erased at pickup, when the run ends (`finishRun`: End Trip, arrived, auto
  end), when the rider turns sharing off, on account deletion, and by the
  existing 5-minute job (older than 30 minutes or not approved).

## Driver's phone (navigation)

- `useDriverNavigation(trip, ridersWaiting)` replaces the 30-second send loop
  in `TripDetailClient`:
  - `navigator.geolocation.watchPosition` while the run is ongoing and the page
    is visible; the latest fix drives the map and the banner.
  - Sends `{ lat, lng, etaSeconds, pickupEtaSeconds }` to
    `/api/trips/:id/location` every **10 s**; keeps the near-campus `arrived`
    call and the screen wake lock.
- Route (`fetchNavRoute` in `src/lib/directions.ts`): Mapbox
  `driving-traffic`, `steps=true`, `geometries=geojson`, `overview=full`, from
  the car through the pickup point (meeting point, else origin) while any
  approved rider isn't picked up, to the destination. Returns the line, the
  steps and each leg's duration (`pickupEtaSeconds` = first leg when the pickup
  is still ahead; `etaSeconds` = total).
- Refetch: off route (more than 50 m from the line for two fixes in a row, at
  most once per 15 s), every 2 minutes, and after Picked up / Undo.
- `src/lib/navigation.ts` (pure): nearest point on the route, the next
  maneuver ahead and the distance to it, off-route check, maneuver → arrow
  icon, Google Maps link (`maps/dir/?api=1&destination=…&waypoints=…&travelmode=driving`)
  and Waze link (`waze.com/ul?ll=…&navigate=yes`, next stop only).
- Mapbox use: about 30–60 route requests per running trip per hour, inside the
  free 100,000 a month.

## Screens

- **Trip page, run ongoing:** the live map moves to the top.
- **Driver:**
  - `NavBanner` above the map: maneuver arrow, distance ("300 m", "1.2 km"),
    street / instruction.
  - Next-stop card: "Next: pick up at <meeting point> · 1.2 km · about 6 min",
    then "To campus · 8.4 km · arrive about 7:42 AM".
  - **Navigate** button → a small app-drawn menu: Google Maps, Waze (to the
    next stop).
  - The map shows the driver's own position, the remaining route from the car,
    and riders not yet picked up (initial pins, as in G).
  - `RidersNearbyCard` works during the run: per rider, distance / at the
    meeting point / not sharing, and **Picked up** or **Undo**.
- **Rider:**
  - Status line: before pickup "Driver is about 6 min from the meeting point";
    after "On the way · arrive about 7:42 AM"; when stale "Driver's location
    paused · last seen 2 min ago".
  - `RiderLocationCard` keeps sending until picked up, then shows "You're in
    the car" and stops.
- `RouteMapView`: Mapbox style follows the app theme (`dark-v11` / `light-v11`,
  switching live with the theme toggle); maroon route; the remaining route from
  the car replaces the posted route line while navigating.

## Testing

- Server (Jest):
  - picked-up and undo: host only, approved only, ongoing run only, location
    erased;
  - rider location accepted after Start Trip, refused after pickup
    (`PICKED_UP`), erased at run end;
  - `rider-locations` during a run with `pickedUp`;
  - location: `pickupEtaSeconds` validation and `pickupEtaAt`, `pickedUp` for a
    rider, point up to 10 minutes old;
  - `crossUserAccess.test.js` rows for both new routes; `strictBody` schemas.
- Web (Jest): `navigation.ts` with a recorded Mapbox route fixture: next
  maneuver and distance along the line, off-route threshold, links, arrow
  mapping.
- Browser: simulated geolocation in the preview; banner, reroute, Picked up,
  light and dark map, phone width.
- Real phones (the user): a short drive with a driver and a rider.

## Rollout

- `npx prisma db push` adds the two optional columns (Railway's pre-deploy does
  this; no data loss).
- Postman: folder "25. Live trip map" (picked-up, undo, location fields).
- `AGENTS.md`: a section for this feature; update G's "erased at Start Trip".
