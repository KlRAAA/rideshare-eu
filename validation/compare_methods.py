"""
Compares each method's top pick on facts the dataset already records, so it
needs no human labels: does the #1 trip break a hard rule (Women+, familiar
riders only, no seats), fall outside the route/time filter, and how far off
is it? Precision@1 against the human ground truth is score_against_ground_truth.py.

The baselines depend on posting order (FIFO uses it; route-only and random
ties fall to it), so besides method_rankings.json it reports the average and
range over ORDERS shuffled posting orders.

Run: python validation/compare_methods.py
"""

import json
import os
import statistics

from run_methods import rank_queries

HERE = os.path.dirname(os.path.abspath(__file__))
METHODS = {"psga": "PSGA", "routeOnly": "Route-only", "random": "Random", "fifo": "FIFO"}
ORDERS = 200


def load(name):
    with open(os.path.join(HERE, name)) as f:
        return json.load(f)


def compare(rows, rankings):
    by_id = {r["tripId"]: r for r in rows}
    results = {}
    for key, label in METHODS.items():
        tops = [by_id[v[key][0]] for v in rankings.values() if v[key]]
        shown = [by_id[t] for v in rankings.values() for t in v[key]]
        results[label] = {
            "topUsable": sum(r["preferenceMatch"] == 1 and r["passesStage1"] for r in tops),
            "topBreaksRule": sum(r["preferenceMatch"] == 0 for r in tops),
            "topOutsideRouteOrTime": sum(not r["passesStage1"] for r in tops),
            "topMeanMinutesOff": round(statistics.mean(r["timeDiffMinutes"] for r in tops), 1),
            "topMeanRouteOverlap": round(statistics.mean(r["routeOverlap"] for r in tops), 3),
            "blockedTripsShown": sum(r["preferenceMatch"] == 0 for r in shown),
            "queries": len(rankings),
        }
    return results


if __name__ == "__main__":
    rows = load("dataset_500_pairs.json")
    cols = ["topUsable", "topBreaksRule", "topOutsideRouteOrTime", "topMeanMinutesOff",
            "topMeanRouteOverlap", "blockedTripsShown"]

    print("method_rankings.json (one posting order):")
    print("| Method | " + " | ".join(cols) + " |")
    print("|---" * (len(cols) + 1) + "|")
    for label, r in compare(rows, load("method_rankings.json")).items():
        print(f"| {label} | " + " | ".join(str(r[c]) for c in cols) + " |")

    runs = [compare(rows, rank_queries(rows, order_key=str(i))) for i in range(ORDERS)]
    print(f"\nAcross {ORDERS} posting orders (mean, min-max):")
    print("| Method | " + " | ".join(cols) + " |")
    print("|---" * (len(cols) + 1) + "|")
    for label in METHODS.values():
        cells = []
        for c in cols:
            values = [run[label][c] for run in runs]
            mean = round(statistics.mean(values), 1)
            cells.append(f"{mean} ({min(values)}-{max(values)})")
        print(f"| {label} | " + " | ".join(cells) + " |")
