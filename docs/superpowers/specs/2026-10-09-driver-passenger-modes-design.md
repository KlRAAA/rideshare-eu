# Driver and passenger modes (sub-project C)

Roadmap: `2026-10-08-panel-revisions-roadmap.md`. Panel notes §1 (the main issue).
Approved in chat on 9 Oct 2026.

## Problem

Every user sees the same app: one set of tabs (Dashboard, My Trips,
Notifications, Profile), a dashboard offering both "Post a Ride" and "Find a
Ride", and one list mixing trips they drive with rides they joined. The panel
asked for Airbnb-style modes: one account, switching between driving and
riding, each mode showing only its own screens. Separately, a user can drive a
trip and join another at the same time, which is impossible in practice.

## Decisions

| Topic | Decision |
|---|---|
| Where the mode is kept | On the account (`User.activeMode`), so every device shows the same mode. New accounts start as Passenger. |
| Navigation | Separate tabs per mode. Passenger: Home, Find a Ride, My Rides, Alerts, Profile. Driver: Home, Post a Trip, My Trips, Alerts, Profile. |
| Notifications | Each mode shows its own; account-wide ones show in both; a nudge counts unread notifications waiting in the other mode. |
| Who can drive | Anyone for now. Sub-project E (verified driver's license) becomes the gate. |
| Overlapping times | Same day is fine; overlapping time spans are refused, in both directions (roadmap decision, 8 Oct). |

Modes are a view of the app. The server does not refuse an API call because of
the caller's mode; it enforces the overlap rule and the existing permissions.

## Data and API

```prisma
enum AppMode {
  PASSENGER
  DRIVER
}
```

`User.activeMode AppMode @default(PASSENGER)`.

| Route | Behaviour |
|---|---|
| `GET /api/users/:id` | Your own record adds `activeMode`. Others' records never include it. |
| `PATCH /api/users/me/mode` `{ mode }` | Sets it. 400 `INVALID_MODE`. Schema `user.mode`. |
| `GET /api/alerts?mode=driver|passenger` | Without `mode`: unchanged (all). With it: that mode's notifications plus account-wide ones, and `otherModeUnread` (the unread count in the other mode). |

**Which mode a notification belongs to:** a notification with a
`relatedTripId` belongs to Driver mode when the user hosts that trip, otherwise
to Passenger mode. One without a trip (announcements, warnings, support
replies) is account-wide. The list query joins the trip's `hostId`, so no
schema change is needed.

## Overlap rule (server)

A pure module `server/services/scheduleRules.js`:

- `timeSpan(trip)` → minutes after Philippine midnight `[start, end)`, from the
  departure's time of day and `durationSeconds` (60 minutes when unknown).
  A span past midnight wraps.
- `sharesADay(a, b)` → whether two trips can run on the same Philippine day:
  one-time vs one-time compares dates; one-time vs recurring asks
  `recurrenceRunsOnDay(recurring, start, oneTimeDay)`; recurring vs recurring
  compares their weekday sets (DAILY = all, WEEKDAYS = Mon–Fri, CUSTOM = its
  days); recurring trips have no end date, so a shared weekday is enough.
- `overlaps(a, b)` → `sharesADay(a, b) && spans intersect`.
- `findConflict(candidate, trips)` → the first trip that overlaps, or null.

Where it applies (409 `SCHEDULE_CONFLICT` with `conflictTripId` and
`conflictDepartureTime`):

| Action | Checked against |
|---|---|
| Join (`POST /api/matches`) | Trips the joiner hosts that are OPEN or FULL |
| Post (`POST /api/trips`) | Trips the poster has a PENDING or APPROVED match on, still OPEN or FULL |
| Edit schedule (`PATCH /api/trips/:id`, when departure, recurrence, days or route change) | Same as post |
| Approve (`PATCH /api/matches/:id` to APPROVED) | The rider's hosted trips (they may have posted after joining); a conflict declines nothing, it just refuses the approval |

## Screens

- **Mode in the app shell.** `getCurrentUser` is wrapped in React `cache()` so
  the layout and the page share one request. The signed-in layout provides
  `activeMode` through a `ModeProvider` context; `Header` and `BottomNav` read
  it.
- **Tabs.** Passenger: Home `/auth/dashboard`, Find a Ride `/auth/search`, My
  Rides `/auth/trips`, Alerts `/auth/notifications`, Profile. Driver: Home, Post
  a Trip `/auth/post`, My Trips `/auth/trips`, Alerts, Profile. The bottom bar
  has five items; the mode is also shown as a small label ("Driver" /
  "Passenger") and the active tab colour differs (maroon for Driver, emerald for
  Passenger).
- **Switch.** A "Switch to Driver" / "Switch to Passenger" button in the header
  (desktop: next to the bell; phone: in the header) and on Profile. It calls
  `PATCH /me/mode`, then `router.refresh()` and goes to Home.
- **Home.** Passenger: Find a Ride card, upcoming rides you joined. Driver: Post
  a Trip card, upcoming trips you drive (with "Start Trip" when its window is
  open), and "N requests waiting" linking to the trip.
- **My Trips / My Rides.** `TripsListClient` shows only hosted trips in Driver
  mode and only joined rides in Passenger mode.
- **Strict pages.** `/auth/search` in Driver mode and `/auth/post` in Passenger
  mode show a short screen: "Finding a ride is in Passenger mode" with a
  **Switch to Passenger** button (and the reverse). Trip pages open in either
  mode.
- **Alerts.** The page requests its mode's list and shows "2 new in Driver mode
  · Switch" when `otherModeUnread > 0`. The unread badge counts the current
  mode plus account-wide.
- **Conflicts.** Join and post forms show: "You're driving a trip at that time
  (7:00 AM, Sariaya → MSEUF). Pick a different ride or time."

## Error handling

- Switching fails: the button shows "Couldn't switch. Try again." and the mode
  stays.
- A notification about a trip the user doesn't host counts as Passenger mode (trips are never deleted, only cancelled or anonymized).

## Testing

Server (Jest, tests first):
- `scheduleRules`: back-to-back spans don't overlap (end = start); a 30-minute
  overlap does; a span past midnight; one-time vs weekday trip on a Saturday
  (no conflict) and a Tuesday (conflict); DAILY vs CUSTOM [Sat]; unknown
  duration counts as 60 minutes.
- API: join refused when you drive at the same time, allowed later the same
  day; post and schedule edit refused when they overlap a ride you joined;
  approve refused when the rider now drives at that time; `PATCH /me/mode`
  sets and validates; `activeMode` only on your own record; alerts filtered by
  mode with `otherModeUnread`.
- `strictBody.test.js`, `crossUserAccess.test.js` keep passing (the new route
  is self-only).

Web (Jest): the tab list per mode; the conflict message.

Postman: folder "19. Modes and schedule conflicts".

Browser: both modes at phone width: tabs, home, My Trips, strict pages,
alerts nudge, a refused overlapping join.

## Rollout

Schema change before UAT (backup first, `db push` on dev and demo; production
applies it on deploy; additive, no data loss). Demo seed: drivers start in
Driver mode, riders in Passenger mode. AGENTS.md section.

## Out of scope

License verification (E); per-day seats (D/limitations); mode-specific emails.
