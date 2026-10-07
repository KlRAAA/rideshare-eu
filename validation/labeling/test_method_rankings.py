"""
method_rankings.json must agree with the dataset: PSGA (like the live app)
never shows a trip the passenger can't join (familiarity is per
(passenger, trip) pair, not per query), and posting order must not give
FIFO the generator's clear positive for free.

Run: python -m unittest discover -s validation/labeling
"""

import json
import os
import unittest

VALIDATION = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(name):
    with open(os.path.join(VALIDATION, name)) as f:
        return json.load(f)


class MethodRankings(unittest.TestCase):
    def test_psga_never_ranks_a_trip_the_passenger_cannot_join(self):
        rows = {r["tripId"]: r for r in load("dataset_500_pairs.json")}
        rankings = load("method_rankings.json")
        shown = [t for v in rankings.values() for t in v["psga"]]
        blocked = [t for t in shown if rows[t]["preferenceMatch"] == 0]
        self.assertEqual(blocked, [])

    def test_posting_order_is_not_the_designed_quality_order(self):
        # T1 is always the generator's clear positive. If it is also always
        # posted first, FIFO gets it at #1 for free.
        rankings = load("method_rankings.json")
        fifo_t1_first = sum(v["fifo"][0].endswith("-T1") for v in rankings.values())
        self.assertLess(fifo_t1_first, len(rankings) / 2)


if __name__ == "__main__":
    unittest.main()
