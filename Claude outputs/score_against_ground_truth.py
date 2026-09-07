"""
Computes precision@1, recall, and mean rank of first acceptable match for
PSGA and each baseline, against the human-labelled ground truth.

Run this AFTER the ground truth review is done (see the review tool). It
expects a file `ground_truth.json` in this same folder, shaped like:

    {
      "Q001-T1": true,
      "Q001-T2": false,
      ...
      "Q100-T5": false
    }

keyed by tripId (every row in dataset_500_pairs.json has a unique tripId),
value = true if the pair is a ground-truth positive (both evaluators agreed
it's an acceptable match, or the tiebreaker resolved it as acceptable).

Metrics, as defined in the proposal:
  - Precision at rank 1: proportion of queries where the method's #1 ranked
    trip is a ground-truth positive.
  - Recall: proportion of ground-truth-positive candidates (within a query's
    5-candidate pool) that the method's output includes at all.
  - Mean rank of first acceptable match: average position (1-indexed) of the
    first ground-truth-positive trip in the method's ranked list, among
    queries where the method found one at all.
"""

import json
import os
import sys
from collections import defaultdict

with open("dataset_500_pairs.json") as f:
    rows = json.load(f)
with open("method_rankings.json") as f:
    rankings = json.load(f)

by_query = defaultdict(list)
for r in rows:
    by_query[r["queryId"]].append(r["tripId"])

if not os.path.exists("ground_truth.json"):
    print("ground_truth.json not found yet.")
    print("This script is ready to run as soon as the evaluator labeling is done -")
    print("export the results from the review tool into ground_truth.json in this folder,")
    print("then re-run this script.")
    sys.exit(0)

with open("ground_truth.json") as f:
    ground_truth = json.load(f)

missing = [tid for tid in [r["tripId"] for r in rows] if tid not in ground_truth]
if missing:
    print(f"WARNING: {len(missing)} pairs have no ground truth label yet (e.g. {missing[:5]}).")
    print("Results below only use the pairs that ARE labeled.\n")


def evaluate(method_name):
    precision_hits, precision_total = 0, 0
    recall_hits, recall_total = 0, 0
    ranks_found = []
    queries_with_no_hit = 0

    for qid, candidate_ids in by_query.items():
        ranked = rankings[qid][method_name]
        gt_positive_ids = {tid for tid in candidate_ids if ground_truth.get(tid) is True}

        if not gt_positive_ids:
            continue  # can't measure precision/recall/rank for a query with zero ground-truth positives

        precision_total += 1
        if ranked and ranked[0] in gt_positive_ids:
            precision_hits += 1

        recall_total += len(gt_positive_ids)
        recall_hits += sum(1 for tid in ranked if tid in gt_positive_ids)

        first_hit_rank = None
        for i, tid in enumerate(ranked, start=1):
            if tid in gt_positive_ids:
                first_hit_rank = i
                break
        if first_hit_rank is not None:
            ranks_found.append(first_hit_rank)
        else:
            queries_with_no_hit += 1

    precision_at_1 = precision_hits / precision_total if precision_total else float("nan")
    recall = recall_hits / recall_total if recall_total else float("nan")
    mean_rank = sum(ranks_found) / len(ranks_found) if ranks_found else float("nan")

    return {
        "precision@1": round(precision_at_1, 4),
        "recall": round(recall, 4),
        "mean_rank_of_first_hit": round(mean_rank, 3) if ranks_found else None,
        "queries_evaluated": precision_total,
        "queries_with_no_acceptable_match_found": queries_with_no_hit,
    }


print(f"{'method':<12} {'precision@1':<13} {'recall':<9} {'mean_rank':<11} {'n_queries'}")
for method in ["psga", "random", "routeOnly", "fifo"]:
    m = evaluate(method)
    print(f"{method:<12} {m['precision@1']:<13} {m['recall']:<9} "
          f"{str(m['mean_rank_of_first_hit']):<11} {m['queries_evaluated']}")
