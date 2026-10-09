# Panel revisions roadmap

Source: the panel and adviser revision notes (RIDESHAREEU_REVISIONS.md, 8 Oct 2026).
This file fixes the order of the work and the decisions already made. Each
sub-project marked "spec" gets its own design document before any code.

## Timing

The revisions come first; UAT runs on the revised app afterwards. The schema
freeze (deployment guide, section 8) starts the day UAT starts, not before.
Everything in the notes is in scope; there is no fixed deadline.

## Decisions (8 Oct 2026)

| Topic | Decision |
|---|---|
| Driving and riding at the same time (§1) | Allowed on the same day, blocked when the times overlap (departure to estimated arrival), in both directions: joining a ride that overlaps your posted trip, and posting a trip that overlaps a ride you joined. |
| Passenger location for the driver (§3) | Opt-in by the passenger, from 15 minutes before departure until the trip starts; only that trip's driver sees it. |
| Driver no-shows on recurring trips (§11) | Recorded and shown: riders are notified, repeat no-shows appear on the admin watch list. No automatic strike or trust-score change; an admin decides. |
| Required gender at sign-up (§5) | No pre-selected answer; the user must choose Woman, Man, Non-binary or Prefer not to say. |
| "Auto completion" (§7) | Address autocomplete, which already exists (Photon suggestions while typing). |

## Sub-projects, in build order

| # | Sub-project | Notes items | Schema | Process |
|---|---|---|---|---|
| A | Quick fixes: password-reset success screen and email, cancellation wording, required gender, Luzon-only search with icon and spinner | §2, §5, §7 | no | **done 8 Oct** (in-chat design) |
| B | Trip lifecycle: `ONGOING` status and Start Trip, no cancelling once started, elapsed time, ETA, driver location only after start, location bug | 0a, §2, §3 | yes | **done 8 Oct** (spec + plan) |
| C | Driver and passenger modes, strict per-role screens, overlapping-times rule | §1 | yes (activeMode) | **done 9 Oct** (spec + plan) |
| D | Recurring trip days: per-date records, skip a date, advance confirmation, unconfirmed warning, no-show | 0b, §11 | yes | **done 9 Oct** (spec + plan) |
| E | Driver's license upload at sign-up and admin verification before posting | §4 | yes | **done 9 Oct** (spec + plan) |
| F | Noticeable notifications: in-app pop-up, sound, vibration; then Web Push | §6 | yes | **done 9 Oct** (spec + plan) |
| G | Passenger location shared with the driver | §3 | maybe | spec, after B |
| H | Driver dashboard and fuel-share "earnings" report | §9 | no | design in chat |
| I | Icons with tooltips (tap fallback on touch screens) | §8 | no | design in chat |
| J | 200-concurrent-user performance: reproduce, find the bottleneck (each search loads every open trip), fix | §12 | no | design in chat |
| K | Research and manuscript: automated fuel-price source (DOE), fee/markup cost model, cookie and cache usage, human-centered design justification | §10, §13 | no | documents |

Already done before this roadmap: address autocomplete; admin-editable fuel
price with a "last updated" warning and the DOE link; reminders before every
day of a recurring trip.
