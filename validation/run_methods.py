"""
Runs PSGA and all three baselines against the 500-pair dataset, grouped back
into 100 queries x 5 candidates. Produces, per query, each method's ranked
list of tripIds - this is what later gets compared against the human ground
truth to compute precision@1 / recall / mean rank (see score_against_ground_truth.py).

This script does NOT decide which matches are "correct" - it only records
what each method (PSGA, random, route-only, FIFO) would show a user. The
correctness judgment comes later, from the human evaluators.
"""

import json
from collections import defaultdict

from psga import run_psga, baseline_random, baseline_route_only, baseline_fifo

with open("dataset_500_pairs.json") as f:
    rows = json.load(f)

by_query = defaultdict(list)
for r in rows:
    by_query[r["queryId"]].append(r)

results = {}
for qid, pair_rows in by_query.items():
    passenger = {
        "origin": tuple(pair_rows[0]["passengerOrigin"]),
        "destination": tuple(pair_rows[0]["passengerDestination"]),
        "departureMinutes": pair_rows[0]["passengerDepartureMinutes"],
        "flexWindowMinutes": pair_rows[0]["passengerFlexWindowMinutes"],
        "gender": pair_rows[0]["passengerGender"],
        "sameGenderOnly": pair_rows[0]["passengerSameGenderOnly"],
        "isFamiliarWithHost": pair_rows[0]["passengerIsFamiliarWithHost"],
    }
    trips = []
    for r in pair_rows:
        trips.append({
            "tripId": r["tripId"],
            "origin": tuple(r["tripOrigin"]),
            "destination": tuple(r["tripDestination"]),
            "departureMinutes": r["tripDepartureMinutes"],
            "seatsAvailable": r["tripSeatsAvailable"],
            "hostGender": r["hostGender"],
            "hostGenderPreference": r["hostGenderPreference"],
            "familiarRidersOnly": r["familiarRidersOnly"],
            "postedAtSeq": pair_rows.index(r) + 1,
        })

    psga_ranked = [x["tripId"] for x in run_psga(passenger, trips)]
    results[qid] = {
        "psga": psga_ranked,
        "random": baseline_random(passenger, trips, seed=hash(qid) % (2**31)),
        "routeOnly": baseline_route_only(passenger, trips),
        "fifo": baseline_fifo(passenger, trips),
    }

with open("method_rankings.json", "w") as f:
    json.dump(results, f, indent=2)

# Quick sanity summary
n_psga_nonempty = sum(1 for v in results.values() if v["psga"])
print(f"{len(results)} queries processed.")
print(f"PSGA returned at least one match for {n_psga_nonempty}/{len(results)} queries.")
