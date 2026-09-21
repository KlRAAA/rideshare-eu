"""
Extends validation/generate_dataset.py's synthetic-scenario approach with
real town-to-campus routes, to test PSGA correctness at realistic longer
distances rather than only the campus-local clusters the original 500-row
dataset used.

Real anchor coordinates, as given for this study (verified via web search,
not estimated or jittered from a single source point the way the original
dataset's barangay anchors were):

    MSEUF main campus (destination): 13.949456, 121.620404
    Sariaya:                          13.967,    121.533
    Tayabas:                          14.036387, 121.653269
    Lucban:                           14.134446, 121.559835

Straight-line distances from campus (haversine, computed here, not assumed):
Sariaya ~9.6km, Tayabas ~10.3km, Lucban ~21.6km — confirms Lucban is a
genuinely longer-distance case, useful for stress-testing whether RouteOverlap
and the corridor threshold still behave sensibly well past the ~1-3km scale
the original dataset's jittered barangay clusters covered.

Deliberately reuses validation/psga.py's actual scoring functions (score_trip,
passes_stage1) exactly as generate_dataset.py does — this is not a third
implementation, it's the same frozen reference module scoring a new,
geographically different set of inputs.

Candidate design per query (6 types, not the original's 5): all queries
converge on the same destination (the campus), so a real, worth-testing
question this raises that the original local dataset never could: does a
straight-line RouteOverlap model handle two DIFFERENT towns' routes
correctly, given both necessarily converge near the shared destination
regardless of how different their origins are? Type 6 below tests exactly
that "hub convergence" scenario, which has no equivalent in the original
same-anchor-only candidate pool.

    T1 - Clear positive: same town as passenger, tight jitter, close time.
    T2 - Clear negative: different town AND far-off departure time.
    T3 - Borderline route overlap: same town, wide jitter (opposite ends of
         the same town can plausibly diverge before rejoining near campus).
    T4 - Borderline schedule: same town, tight jitter, time near the
         passenger's own flex window edge.
    T5 - Preference conflict: same town, good route/schedule, fails a hard
         constraint (gender / familiar-riders-only / seats).
    T6 - Cross-town, close departure time: different town, but otherwise a
         plausible commute (same-ish time of day) — isolates whether
         hub-convergence alone (both routes ending at campus) produces a
         higher RouteOverlap than the diverging origins should suggest.
"""

import json
import math
import random

from psga import score_trip, passes_stage1

random.seed(20260921)  # fixed seed, reproducible

CAMPUS = (13.949456, 121.620404)  # MSEUF main campus, as given for this study

REAL_ANCHORS = {
    "Sariaya": (13.967, 121.533),
    "Tayabas": (14.036387, 121.653269),
    "Lucban": (14.134446, 121.559835),
}


def haversine_km(a, b):
    R = 6371.0
    lat1, lng1 = a
    lat2, lng2 = b
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    h = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


DISTANCE_FROM_CAMPUS_KM = {name: round(haversine_km(CAMPUS, pt), 2) for name, pt in REAL_ANCHORS.items()}


def jitter(coord, km_sd=1.0):
    """Gaussian offset around a real town center, representing different streets within that town."""
    lat, lng = coord
    dlat = random.gauss(0, km_sd) / 111.0
    dlng = random.gauss(0, km_sd) / (111.0 * math.cos(math.radians(lat)))
    return (lat + dlat, lng + dlng)


def bimodal_departure_minutes():
    """Peaks at 7:00 AM (420 min) and 4:30 PM (990 min), same commute pattern as generate_dataset.py."""
    peak = random.choice([420, 990])
    return int(max(360, min(1140, random.gauss(peak, 35))))


GENDERS = ["MALE", "FEMALE"]
TOWN_NAMES = list(REAL_ANCHORS.keys())


def make_trip(trip_id, town_name, posted_seq):
    return {
        "tripId": trip_id,
        "originTown": town_name,
        "origin": jitter(REAL_ANCHORS[town_name]),
        "destination": CAMPUS,
        "departureMinutes": bimodal_departure_minutes(),
        "seatsAvailable": random.choices([0, 1, 2, 3, 4], weights=[5, 25, 30, 25, 15])[0],
        "hostGender": random.choice(GENDERS),
        "hostGenderPreference": random.choices(["ANY", "SAME_GENDER"], weights=[80, 20])[0],
        "familiarRidersOnly": random.random() < 0.15,
        "postedAtSeq": posted_seq,
    }


def make_passenger(query_id, town_name):
    return {
        "queryId": query_id,
        "originTown": town_name,
        "origin": jitter(REAL_ANCHORS[town_name]),
        "destination": CAMPUS,
        "departureMinutes": bimodal_departure_minutes(),
        "flexWindowMinutes": random.choice([10, 15, 15, 15, 20, 30]),
        "gender": random.choice(GENDERS),
        "sameGenderOnly": random.random() < 0.2,
    }


def other_town(town_name):
    return random.choice([t for t in TOWN_NAMES if t != town_name])


def make_candidate_pool_for_query(passenger, posted_seq_start):
    trips = []
    seq = posted_seq_start
    home_town = passenger["originTown"]

    # T1: Clear positive — same town, tight jitter, close departure time.
    t = make_trip(f"{passenger['queryId']}-T1", home_town, seq); seq += 1
    t["origin"] = jitter(REAL_ANCHORS[home_town], km_sd=0.3)
    t["departureMinutes"] = max(360, min(1140, passenger["departureMinutes"] + random.randint(-5, 5)))
    t["hostGenderPreference"] = "ANY"
    t["familiarRidersOnly"] = False
    t["seatsAvailable"] = random.choice([1, 2, 3])
    trips.append(t)

    # T2: Clear negative — different town AND far-off departure time.
    t = make_trip(f"{passenger['queryId']}-T2", other_town(home_town), seq); seq += 1
    t["departureMinutes"] = max(360, min(1140, passenger["departureMinutes"] + random.choice([-1, 1]) * random.randint(180, 300)))
    trips.append(t)

    # T3: Borderline route overlap — same town, wide jitter.
    t = make_trip(f"{passenger['queryId']}-T3", home_town, seq); seq += 1
    t["origin"] = jitter(REAL_ANCHORS[home_town], km_sd=2.0)
    t["departureMinutes"] = max(360, min(1140, passenger["departureMinutes"] + random.randint(-10, 10)))
    trips.append(t)

    # T4: Borderline schedule — same town, tight jitter, time near flex-window edge.
    t = make_trip(f"{passenger['queryId']}-T4", home_town, seq); seq += 1
    t["origin"] = jitter(REAL_ANCHORS[home_town], km_sd=0.4)
    edge = passenger["flexWindowMinutes"]
    t["departureMinutes"] = max(360, min(1140, passenger["departureMinutes"] + random.choice([-1, 1]) * (edge + random.randint(-3, 3))))
    trips.append(t)

    # T5: Preference conflict — same town, good route/schedule, fails a hard constraint.
    t = make_trip(f"{passenger['queryId']}-T5", home_town, seq); seq += 1
    t["origin"] = jitter(REAL_ANCHORS[home_town], km_sd=0.3)
    t["departureMinutes"] = max(360, min(1140, passenger["departureMinutes"] + random.randint(-5, 5)))
    conflict = random.choice(["gender", "familiar", "seats"])
    if conflict == "gender":
        t["hostGenderPreference"] = "SAME_GENDER"
        t["hostGender"] = "MALE" if passenger["gender"] == "FEMALE" else "FEMALE"
    elif conflict == "familiar":
        t["familiarRidersOnly"] = True
    else:
        t["seatsAvailable"] = 0
    trips.append(t)

    # T6: Cross-town, close departure time — isolates hub-convergence behavior:
    # a different town's route, but a plausible same-time-of-day commute, so
    # any overlap found is purely from both lines converging near campus, not
    # from a coincidentally-matched departure time doing the filtering instead.
    t = make_trip(f"{passenger['queryId']}-T6", other_town(home_town), seq); seq += 1
    t["departureMinutes"] = max(360, min(1140, passenger["departureMinutes"] + random.randint(-8, 8)))
    t["hostGenderPreference"] = "ANY"
    t["familiarRidersOnly"] = False
    t["seatsAvailable"] = random.choice([1, 2, 3])
    trips.append(t)

    return trips, seq


def build_dataset(n_queries_per_town=20):
    records = []
    posted_seq = 1
    query_num = 1
    for town_name in TOWN_NAMES:
        for _ in range(n_queries_per_town):
            qid = f"G{query_num:03d}"
            passenger = make_passenger(qid, town_name)
            candidates, posted_seq = make_candidate_pool_for_query(passenger, posted_seq)
            for t in candidates:
                passenger_for_scoring = dict(passenger)
                passenger_for_scoring["isFamiliarWithHost"] = random.random() < 0.4
                row = score_trip(passenger_for_scoring, t)
                row.update({
                    "queryId": passenger["queryId"],
                    "candidateType": t["tripId"].split("-")[-1],
                    "passengerOriginTown": passenger["originTown"],
                    "passengerOrigin": passenger["origin"],
                    "passengerDestination": passenger["destination"],
                    "passengerDepartureMinutes": passenger["departureMinutes"],
                    "passengerFlexWindowMinutes": passenger["flexWindowMinutes"],
                    "passengerGender": passenger["gender"],
                    "passengerSameGenderOnly": passenger["sameGenderOnly"],
                    "passengerIsFamiliarWithHost": passenger_for_scoring["isFamiliarWithHost"],
                    "tripOriginTown": t["originTown"],
                    "tripOrigin": t["origin"],
                    "tripDestination": t["destination"],
                    "tripDepartureMinutes": t["departureMinutes"],
                    "tripSeatsAvailable": t["seatsAvailable"],
                    "hostGender": t["hostGender"],
                    "hostGenderPreference": t["hostGenderPreference"],
                    "familiarRidersOnly": t["familiarRidersOnly"],
                    "distanceFromCampusKm": DISTANCE_FROM_CAMPUS_KM[passenger["originTown"]],
                    "passesStage1": passes_stage1(passenger_for_scoring, t),
                })
                records.append(row)
            query_num += 1
    return records


if __name__ == "__main__":
    dataset = build_dataset(n_queries_per_town=20)
    expected = len(TOWN_NAMES) * 20 * 6
    assert len(dataset) == expected, f"expected {expected} pairs, got {len(dataset)}"
    with open("dataset_geo_pairs.json", "w") as f:
        json.dump(dataset, f, indent=2)
    print(f"Wrote {len(dataset)} pairs to dataset_geo_pairs.json")
    print(f"Distances from campus: {DISTANCE_FROM_CAMPUS_KM}")
    print(f"Pass Stage 1: {sum(1 for r in dataset if r['passesStage1'])} / {len(dataset)}")
    by_town = {}
    for r in dataset:
        by_town.setdefault(r["passengerOriginTown"], []).append(r["passesStage1"])
    for town, results in by_town.items():
        print(f"  {town}: pass Stage 1 {sum(results)}/{len(results)}")
