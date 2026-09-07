"""
Generates the 500-record synthetic validation dataset described in the
thesis proposal: "500 trip records generated from residential address
clusters identified ... within 15 kilometers of Enverga University.
Trip departure times follow a bimodal distribution peaking at 7:00 AM
and 4:30 PM."

Design decision (documented, not left implicit): the proposal describes
"500 trips" / "500 passenger queries" / "500 passenger-trip pairs" without
fully reconciling those into one structure. To make every stated metric
computable - precision at rank 1 and recall both require a passenger query
to have MULTIPLE candidate trips to rank, while the ground-truth process
needs exactly 500 individually-labelable pairs - this script generates
100 passenger queries, each searched against a pool of 5 candidate trips,
for exactly 500 total (passenger, trip) pairs. This is the operationalization
used throughout this validation study; state it plainly if asked how "500"
was interpreted.

Real anchor coordinates (not invented): campus location and two Lucena
barangays came from the live app's own constants / PhilAtlas; Sariaya's
town-center coordinate matches a real trip already posted in the live app's
dev database. Additional residential points are Gaussian-jittered around
these three real anchors to build a plausible spread, not independently
verified per-point - this matches the proposal's own "address clusters"
framing rather than claiming survey-grade precision on invented locations.
"""

import json
import random
import math

from psga import score_trip, passes_stage1, route_overlap, time_diff_minutes, schedule_alignment

random.seed(20260907)  # fixed seed: reproducible dataset, re-runnable by anyone

CAMPUS = (13.9490188, 121.6202904)  # MSEUF Lucena, matches src/lib/constants.ts in the live app

REAL_ANCHORS = {
    "Ibabang Dupay":  (13.9414, 121.6235),   # PhilAtlas
    "Ilayang Dupay":  (13.9752, 121.6231),   # PhilAtlas
    "Sariaya":        (13.9629837, 121.5243402),  # matches a real trip in the live app's dev DB
}

def jitter(coord, km_sd=1.2):
    """Gaussian offset around a real anchor point, in roughly km, converted to degrees."""
    lat, lng = coord
    dlat = random.gauss(0, km_sd) / 111.0
    dlng = random.gauss(0, km_sd) / (111.0 * math.cos(math.radians(lat)))
    return (lat + dlat, lng + dlng)

def random_origin():
    anchor = random.choice(list(REAL_ANCHORS.values()))
    return jitter(anchor)

def bimodal_departure_minutes():
    """Peaks at 7:00 AM (420 min) and 4:30 PM (990 min), per the proposal."""
    peak = random.choice([420, 990])
    return int(max(360, min(1140, random.gauss(peak, 35))))  # clamp 6:00-19:00

GENDERS = ["MALE", "FEMALE"]

def make_trip(trip_id, posted_seq):
    return {
        "tripId": trip_id,
        "origin": random_origin(),
        "destination": CAMPUS,
        "departureMinutes": bimodal_departure_minutes(),
        "seatsAvailable": random.choices([0, 1, 2, 3, 4], weights=[5, 25, 30, 25, 15])[0],
        "hostGender": random.choice(GENDERS),
        "hostGenderPreference": random.choices(["ANY", "SAME_GENDER"], weights=[80, 20])[0],
        "familiarRidersOnly": random.random() < 0.15,
        "postedAtSeq": posted_seq,
    }

def make_passenger(query_id):
    return {
        "queryId": query_id,
        "origin": random_origin(),
        "destination": CAMPUS,
        "departureMinutes": bimodal_departure_minutes(),
        "flexWindowMinutes": random.choice([10, 15, 15, 15, 20, 30]),  # 15 is the stated default, weighted accordingly
        "gender": random.choice(GENDERS),
        "sameGenderOnly": random.random() < 0.2,
    }

def make_candidate_pool_for_query(passenger, posted_seq_start, edge_case_slot):
    """
    5 candidates per query, deliberately spanning the range so the study
    isn't trivial: at least one clear positive, one clear negative, and
    edge cases near the Stage-1 thresholds (per the proposal's own
    instruction to cover "zero route overlap, exact schedule alignment,
    and conflicting gender preference constraints").
    """
    trips = []
    seq = posted_seq_start

    # 1) Clear positive: same anchor area as passenger, close departure time
    t = make_trip(f"{passenger['queryId']}-T1", seq); seq += 1
    t["origin"] = jitter(passenger["origin"], km_sd=0.3)
    t["departureMinutes"] = max(360, min(1140, passenger["departureMinutes"] + random.randint(-5, 5)))
    t["hostGenderPreference"] = "ANY"
    t["familiarRidersOnly"] = False
    t["seatsAvailable"] = random.choice([1, 2, 3])
    trips.append(t)

    # 2) Clear negative: far-away anchor, far-off time (zero/near-zero overlap)
    t = make_trip(f"{passenger['queryId']}-T2", seq); seq += 1
    other_anchor = random.choice([a for a in REAL_ANCHORS.values() if a != passenger["origin"]])
    t["origin"] = jitter(other_anchor, km_sd=2.5)
    t["departureMinutes"] = max(360, min(1140, passenger["departureMinutes"] + random.choice([-1, 1]) * random.randint(180, 300)))
    trips.append(t)

    # 3) Borderline route overlap (near MIN_OVERLAP=0.4)
    t = make_trip(f"{passenger['queryId']}-T3", seq); seq += 1
    t["origin"] = jitter(passenger["origin"], km_sd=1.5)  # partial overlap likely
    t["departureMinutes"] = max(360, min(1140, passenger["departureMinutes"] + random.randint(-10, 10)))
    trips.append(t)

    # 4) Borderline schedule (time diff near the passenger's flex window)
    t = make_trip(f"{passenger['queryId']}-T4", seq); seq += 1
    t["origin"] = jitter(passenger["origin"], km_sd=0.4)
    edge = passenger["flexWindowMinutes"]
    t["departureMinutes"] = max(360, min(1140, passenger["departureMinutes"] + random.choice([-1, 1]) * (edge + random.randint(-3, 3))))
    trips.append(t)

    # 5) Preference conflict: good route/schedule but fails a hard constraint
    t = make_trip(f"{passenger['queryId']}-T5", seq); seq += 1
    t["origin"] = jitter(passenger["origin"], km_sd=0.3)
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

    return trips, seq


def build_dataset(n_queries=100):
    records = []
    posted_seq = 1
    for i in range(1, n_queries + 1):
        passenger = make_passenger(f"Q{i:03d}")
        candidates, posted_seq = make_candidate_pool_for_query(passenger, posted_seq, i)
        # attach isFamiliarWithHost per (passenger, trip) pair - independent per pair
        for t in candidates:
            passenger_for_scoring = dict(passenger)
            passenger_for_scoring["isFamiliarWithHost"] = random.random() < 0.4
            row = score_trip(passenger_for_scoring, t)
            row.update({
                "queryId": passenger["queryId"],
                "passengerOrigin": passenger["origin"],
                "passengerDestination": passenger["destination"],
                "passengerDepartureMinutes": passenger["departureMinutes"],
                "passengerFlexWindowMinutes": passenger["flexWindowMinutes"],
                "passengerGender": passenger["gender"],
                "passengerSameGenderOnly": passenger["sameGenderOnly"],
                "passengerIsFamiliarWithHost": passenger_for_scoring["isFamiliarWithHost"],
                "tripOrigin": t["origin"],
                "tripDestination": t["destination"],
                "tripDepartureMinutes": t["departureMinutes"],
                "tripSeatsAvailable": t["seatsAvailable"],
                "hostGender": t["hostGender"],
                "hostGenderPreference": t["hostGenderPreference"],
                "familiarRidersOnly": t["familiarRidersOnly"],
                "passesStage1": passes_stage1(passenger_for_scoring, t),
            })
            records.append(row)
    return records


if __name__ == "__main__":
    dataset = build_dataset(n_queries=100)
    assert len(dataset) == 500, f"expected 500 pairs, got {len(dataset)}"
    with open("dataset_500_pairs.json", "w") as f:
        json.dump(dataset, f, indent=2)
    print(f"Wrote {len(dataset)} pairs to dataset_500_pairs.json")
    print(f"Pass Stage 1: {sum(1 for r in dataset if r['passesStage1'])} / {len(dataset)}")
