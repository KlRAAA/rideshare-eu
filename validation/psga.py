"""
Standalone Python implementation of the Priority-Scored Greedy Algorithm (PSGA)
for RideShareEU, implemented directly from the formulas in the thesis proposal
(Section 5.1.2.5 / Table IV):

Stage 1 - Filter:
    RouteOverlap(P, H) = |segment(P) intersect corridor(H)| / |segment(P)|
    Discard trip H if RouteOverlap < MIN_OVERLAP
    TimeDiff(P, H) = |DepartureTime(P) - DepartureTime(H)|
    Discard trip H if TimeDiff > FlexWindow(P)

Stage 2 - Score:
    Score(P, H) = w1*RouteOverlap + w2*ScheduleAlignment + w3*PreferenceMatch
    ScheduleAlignment = 1 - (TimeDiff / FlexWindow)
    PreferenceMatch = 1.0 if ALL hard constraints hold, else 0.0
        hard constraints: co-rider gender preference, familiar-riders-only, seats > 0

This module is intentionally isolated from the live Node.js app / database -
it operates on plain dicts, exactly as the proposal specifies ("no direct
dependency on the HTTP routing layer, the database connection pool, or the
notification service").

Route representation note (documented simplification): the live app uses the
Mapbox Directions API to get real driving routes. For this standalone
validation study, both the passenger's and the host's route are approximated
as a straight line from origin to destination, sampled into points, matching
the proposal's own description ("line segment approximation... using Haversine
distance calculations between sampled points") but without a live routing API
call. This is a documented simplification, not an attempt to reproduce
real road geometry - it is sufficient to test whether the SCORING LOGIC is
correct, which is what this study evaluates.
"""

import math
import random
from dataclasses import dataclass, field
from typing import List, Dict, Any

# ---- System parameters (match server/config/psgaConfig.js in the live app) ----
MIN_OVERLAP = 0.4          # minimum RouteOverlap to pass Stage 1
CORRIDOR_METERS = 500      # tolerance corridor width around the host route
DEFAULT_FLEX_WINDOW = 15   # minutes, the proposal's stated default
W1, W2, W3 = 0.5, 0.3, 0.2 # RouteOverlap, ScheduleAlignment, PreferenceMatch weights
ROUTE_SAMPLE_POINTS = 20   # points sampled along each straight-line route


def haversine_meters(lat1, lng1, lat2, lng2):
    """Great-circle distance between two lat/lng points, in meters."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def sample_line(origin, destination, n=ROUTE_SAMPLE_POINTS):
    """Linear interpolation between origin and destination, n points inclusive."""
    lat1, lng1 = origin
    lat2, lng2 = destination
    return [
        (lat1 + (lat2 - lat1) * i / (n - 1), lng1 + (lng2 - lng1) * i / (n - 1))
        for i in range(n)
    ]


def route_overlap(passenger_origin, passenger_dest, host_origin, host_dest,
                   corridor_m=CORRIDOR_METERS):
    """
    Fraction of the passenger's sampled route points that fall within
    `corridor_m` meters of ANY point on the host's sampled route.
    """
    passenger_pts = sample_line(passenger_origin, passenger_dest)
    host_pts = sample_line(host_origin, host_dest)

    covered = 0
    for plat, plng in passenger_pts:
        for hlat, hlng in host_pts:
            if haversine_meters(plat, plng, hlat, hlng) <= corridor_m:
                covered += 1
                break
    return covered / len(passenger_pts)


def schedule_alignment(time_diff_min, flex_window_min):
    if flex_window_min <= 0:
        return 1.0 if time_diff_min == 0 else 0.0
    return max(0.0, 1 - (time_diff_min / flex_window_min))


def preference_match(passenger: Dict[str, Any], trip: Dict[str, Any]) -> float:
    """
    Binary hard-constraint check, per the proposal's definition:
    "PreferenceMatch is evaluated as a conjunction. All constraints must
    pass for the value to be 1.0." Constraints: co-rider gender preference
    (checked both directions - host's stated preference against the
    passenger's gender, AND the passenger's own same-gender-only toggle
    against the host's gender), familiar-riders-only, and seats > 0.
    """
    if trip["seatsAvailable"] <= 0:
        return 0.0

    if trip.get("hostGenderPreference") == "SAME_GENDER" and \
       passenger.get("gender") != trip.get("hostGender"):
        return 0.0

    if passenger.get("sameGenderOnly") and \
       passenger.get("gender") != trip.get("hostGender"):
        return 0.0

    if trip.get("familiarRidersOnly") and not passenger.get("isFamiliarWithHost", False):
        return 0.0

    return 1.0


def time_diff_minutes(passenger_departure_min, trip_departure_min):
    return abs(passenger_departure_min - trip_departure_min)


def score_trip(passenger, trip):
    overlap = route_overlap(
        passenger["origin"], passenger["destination"],
        trip["origin"], trip["destination"],
    )
    tdiff = time_diff_minutes(passenger["departureMinutes"], trip["departureMinutes"])
    flex = passenger.get("flexWindowMinutes", DEFAULT_FLEX_WINDOW)
    sched = schedule_alignment(tdiff, flex)
    pref = preference_match(passenger, trip)
    score = W1 * overlap + W2 * sched + W3 * pref
    return {
        "tripId": trip["tripId"],
        "routeOverlap": round(overlap, 4),
        "timeDiffMinutes": tdiff,
        "scheduleAlignment": round(sched, 4),
        "preferenceMatch": pref,
        "score": round(score, 4),
    }


def passes_stage1(passenger, trip):
    overlap = route_overlap(
        passenger["origin"], passenger["destination"],
        trip["origin"], trip["destination"],
    )
    tdiff = time_diff_minutes(passenger["departureMinutes"], trip["departureMinutes"])
    flex = passenger.get("flexWindowMinutes", DEFAULT_FLEX_WINDOW)
    return overlap >= MIN_OVERLAP and tdiff <= flex


def run_psga(passenger, candidate_trips):
    """Full two-stage PSGA. Returns candidates that pass Stage 1, ranked by score desc."""
    filtered = [t for t in candidate_trips if passes_stage1(passenger, t)]
    scored = [score_trip(passenger, t) for t in filtered]
    return sorted(scored, key=lambda r: r["score"], reverse=True)


# ---------------------------------------------------------------------------
# Baselines, as specified in the proposal's "Baseline Comparison Justification"
# ---------------------------------------------------------------------------

def baseline_random(passenger, candidate_trips, seed=None):
    """Baseline 1: trips passing Stage 1 filtering, presented in random order."""
    filtered = [t["tripId"] for t in candidate_trips if passes_stage1(passenger, t)]
    rng = random.Random(seed)
    rng.shuffle(filtered)
    return filtered


def baseline_route_only(passenger, candidate_trips):
    """Baseline 2: Stage 1 filtered, ranked by route overlap alone."""
    filtered = [t for t in candidate_trips if passes_stage1(passenger, t)]
    scored = []
    for t in filtered:
        overlap = route_overlap(passenger["origin"], passenger["destination"],
                                 t["origin"], t["destination"])
        scored.append((t["tripId"], overlap))
    scored.sort(key=lambda x: x[1], reverse=True)
    return [tid for tid, _ in scored]


def baseline_fifo(passenger, candidate_trips):
    """Baseline 3: no filtering, no scoring - posted order."""
    ordered = sorted(candidate_trips, key=lambda t: t["postedAtSeq"])
    return [t["tripId"] for t in ordered]
