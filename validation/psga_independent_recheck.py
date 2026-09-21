"""
Independent Python re-implementation of the PSGA scoring formula, written
from the thesis proposal's own description (Section 5.1.2.5 / Table IV) —
NOT copy-pasted from validation/psga.py, so agreement between the two remains
a meaningful check rather than a comparison of a module against itself.

This targets `dataset_500_pairs.json`'s actual ground-truth generator,
validation/psga.py. As of 2026-09-21 validation/psga.py's constants are
synced to match production (server/config/psgaConfig.js) exactly, so this
recheck now uses the same production values too — CORRIDOR_METERS=1500, not
the earlier 500.
"""

import math
from typing import Dict, Any, List, Tuple

# ---- Constants matching validation/psga.py, which is synced to psgaConfig.js ----
MIN_OVERLAP = 0.4
CORRIDOR_METERS = 1500
DEFAULT_FLEX_WINDOW = 15
W1, W2, W3 = 0.5, 0.3, 0.2
ROUTE_SAMPLE_POINTS = 20


def haversine_meters(lat1, lng1, lat2, lng2) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def sample_line(origin: Tuple[float, float], destination: Tuple[float, float],
                 n: int = ROUTE_SAMPLE_POINTS) -> List[Tuple[float, float]]:
    lat1, lng1 = origin
    lat2, lng2 = destination
    return [
        (lat1 + (lat2 - lat1) * i / (n - 1), lng1 + (lng2 - lng1) * i / (n - 1))
        for i in range(n)
    ]


def route_overlap(passenger_origin, passenger_dest, host_origin, host_dest,
                   corridor_m: float = CORRIDOR_METERS) -> float:
    """Fraction of passenger sample points within corridor_m of ANY host sample point."""
    passenger_pts = sample_line(passenger_origin, passenger_dest)
    host_pts = sample_line(host_origin, host_dest)

    covered = 0
    for plat, plng in passenger_pts:
        for hlat, hlng in host_pts:
            if haversine_meters(plat, plng, hlat, hlng) <= corridor_m:
                covered += 1
                break
    return covered / len(passenger_pts)


def schedule_alignment(time_diff_min: float, flex_window_min: float) -> float:
    if flex_window_min <= 0:
        return 1.0 if time_diff_min == 0 else 0.0
    return max(0.0, 1 - (time_diff_min / flex_window_min))


def preference_match(passenger: Dict[str, Any], trip: Dict[str, Any]) -> float:
    """Bidirectional gender check + familiar-riders-only + seats, all hard constraints."""
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


def time_diff_minutes(passenger_departure_min, trip_departure_min) -> float:
    return abs(passenger_departure_min - trip_departure_min)


def score_trip(passenger: Dict[str, Any], trip: Dict[str, Any]) -> Dict[str, Any]:
    overlap = route_overlap(passenger["origin"], passenger["destination"], trip["origin"], trip["destination"])
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


def passes_stage1(passenger: Dict[str, Any], trip: Dict[str, Any]) -> bool:
    overlap = route_overlap(passenger["origin"], passenger["destination"], trip["origin"], trip["destination"])
    tdiff = time_diff_minutes(passenger["departureMinutes"], trip["departureMinutes"])
    flex = passenger.get("flexWindowMinutes", DEFAULT_FLEX_WINDOW)
    return overlap >= MIN_OVERLAP and tdiff <= flex


# ---------------------------------------------------------------------------
# Comparison harness: recomputes every row in a dataset JSON file (default
# dataset_500_pairs.json, or pass another path as argv[1] — e.g.
# dataset_geo_pairs.json) with the independent implementation above and diffs
# it against the system values already baked into that file by whichever
# generate_dataset*.py script produced it. In Colab, upload the dataset file
# alongside this script and run as-is, or edit DEFAULT_DATASET below.
# ---------------------------------------------------------------------------
DEFAULT_DATASET = "dataset_500_pairs.json"

if __name__ == "__main__":
    import json
    import sys

    dataset_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DATASET
    with open(dataset_path) as f:
        rows = json.load(f)

    disagreements = {"routeOverlap": [], "scheduleAlignment": [], "preferenceMatch": [], "score": []}

    for row in rows:
        passenger = {
            "origin": tuple(row["passengerOrigin"]),
            "destination": tuple(row["passengerDestination"]),
            "departureMinutes": row["passengerDepartureMinutes"],
            "flexWindowMinutes": row["passengerFlexWindowMinutes"],
            "gender": row["passengerGender"],
            "sameGenderOnly": row["passengerSameGenderOnly"],
            "isFamiliarWithHost": row["passengerIsFamiliarWithHost"],
        }
        trip = {
            "tripId": row["tripId"],
            "origin": tuple(row["tripOrigin"]),
            "destination": tuple(row["tripDestination"]),
            "departureMinutes": row["tripDepartureMinutes"],
            "seatsAvailable": row["tripSeatsAvailable"],
            "hostGender": row["hostGender"],
            "hostGenderPreference": row["hostGenderPreference"],
            "familiarRidersOnly": row["familiarRidersOnly"],
        }
        recalc = score_trip(passenger, trip)

        for field in ("routeOverlap", "scheduleAlignment", "preferenceMatch", "score"):
            if recalc[field] != row[field]:
                disagreements[field].append({
                    "tripId": row["tripId"],
                    "system": row[field],
                    "recalc": recalc[field],
                })

    total = len(rows)
    print(f"Dataset: {dataset_path}")
    print(f"Rows checked: {total}")
    for field, diffs in disagreements.items():
        print(f"  {field}: {len(diffs)} disagreements ({len(diffs) / total:.1%})")
        for d in diffs[:5]:
            print(f"    {d}")
