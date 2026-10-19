# Load test: how many people can use RideShareEU at once

Sub-project J. Run on 19 Oct 2026 with `loadtest/seed.cjs` and `loadtest/run.cjs`;
raw numbers in `loadtest/results/`.

## Setup

- **Machine:** one Windows PC, Intel Core i3-7100 (2 cores, 4 threads,
  3.9 GHz), running the API, PostgreSQL 17 and the load generator together.
- **API:** `server/server.js` in production mode (`NODE_ENV=production`),
  against its own database (`rideshare_load`), with its timed jobs running,
  as on Railway. One Node.js process, like the one Railway replica.
- **Data:** 500 accounts (60 licensed drivers, 440 passengers) and 60 trips
  around Lucena for the first run; 1,000 accounts and 120 trips for the second.
  A third of the trips were on the road during the test, each with 3 riders.
- **Simulated people,** with the app's real timings:

  | Who | Share | What they do |
  |---|---|---|
  | Drivers on a running trip | 8% | send position and ETA every 10 s, check riders' locations every 30 s, chat |
  | Riders on those trips | 24% | check the driver's position every 10 s, chat every 7 s, trip page every 60 s |
  | Drivers between trips | 4% | alerts and page views |
  | Passengers browsing | 64% | alerts and page views; half also search every 2 min |

  Everyone checks alerts every 5 s and opens a page (profile, My Trips, Alerts)
  every 60 s. Each step ran for 60 s after a 10 s warm-up. A request that took
  longer than 10 s was counted as an error, as a phone would give up.

## Results

| Simultaneous users | Requests/s | Median | 95% under | 99% under | Errors | API CPU* |
|---|---|---|---|---|---|---|
| 50 | 17 | 24 ms | 57 ms | 136 ms | 0% | 4% |
| 100 | 34 | 23 ms | 47 ms | 74 ms | 0% | 6% |
| 200 | 68 | 26 ms | 73 ms | 112 ms | 0% | 12% |
| 300 | 101 | 33 ms | 105 ms | 161 ms | 0% | 17% |
| 400 | 135 | 51 ms | 157 ms | 300 ms | 0% | 21% |
| 500 | 169 | 236 ms | 1,496 ms | 2,778 ms | 0% | 27% |
| 600 | 198 sent | timed out | timed out | timed out | 99% | 28% |
| 800 | 259 sent | timed out | timed out | timed out | 98% | 27% |
| 1,000 | 352 sent | timed out | timed out | timed out | 100% | 27% |

\* Of the whole 4-thread machine; 25% is one full core.

## What it means

- **The 200-user target is met with a wide margin:** at 200 people, 95% of
  requests finished within 73 ms, far inside the 2-second requirement, with no
  errors.
- **Comfortable up to about 400 people** (95% within 157 ms). At 500 it still
  works without errors, but some requests take 1.5–2.8 s.
- **At 600 and above it collapses:** more work arrives than one process can
  finish, the backlog grows, almost every request times out and memory climbs
  to 2.6 GB.
- **The limit is the API's single core,** not the database: CPU sits at one
  full core (25–28%) from 500 users on, while response times explode.
- **Where the load comes from:** the alerts check every 5 s is about 60% of all
  requests (100 of 169 per second at 500 people). The heaviest single requests
  are My Trips and the trip page.

## Limits of this test

- The load generator and the database shared the same 2-core PC with the API,
  so the API had less than the whole machine. Railway's hardware differs; a
  single Node.js process still uses one core there.
- It's a local test, not the live site. A short, capped run against Railway
  would confirm the production numbers.
- Website (Vercel) pages weren't included: they are served by Vercel and call
  the same API, so the API is the shared bottleneck.

## Ways to raise the limit

1. Check alerts every 10 s instead of 5 s, and not at all while the app is in
   the background: about 30% fewer requests.
2. Run one API process per CPU core on Railway (Node.js cluster), with the timed
   jobs in only one of them: roughly a multiple of the cores available.
3. Refuse new requests quickly with "busy, try again" when overloaded, so the
   app slows down instead of collapsing past the limit.
4. Make My Trips cheaper (it re-checks every trip's day steps on each load).
