"""
Women+ rules in the PSGA validation (Women+ spec §5, §9). Both the system
module (psga.py) and the independent re-implementation must agree, and the
ranking must leave out trips the passenger can't join, as the live app does.

Run: python -m unittest discover -s validation/labeling
"""

import os
import sys
import unittest

VALIDATION = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, VALIDATION)

import psga  # noqa: E402
import psga_independent_recheck as recheck  # noqa: E402

OPEN_TRIP = {"hostGenderPreference": "ANY", "familiarRidersOnly": False, "seatsAvailable": 2}
WOMEN_PLUS_TRIP = dict(OPEN_TRIP, hostGenderPreference="WOMEN_PLUS")


def rider(gender, women_plus_only=False, familiar=False):
    return {"gender": gender, "womenPlusOnly": women_plus_only, "isFamiliarWithHost": familiar}


class WomenPlusRules(unittest.TestCase):
    def check(self, passenger, trip, expected):
        self.assertEqual(psga.preference_match(passenger, trip), expected)
        self.assertEqual(recheck.preference_match(passenger, trip), expected)

    def test_women_plus_trips_take_women_and_non_binary_riders_only(self):
        self.check(rider("MAN"), WOMEN_PLUS_TRIP, 0.0)
        self.check(rider("PREFER_NOT_TO_SAY"), WOMEN_PLUS_TRIP, 0.0)
        self.check(rider("WOMAN"), WOMEN_PLUS_TRIP, 1.0)
        self.check(rider("NON_BINARY"), WOMEN_PLUS_TRIP, 1.0)

    def test_open_trips_take_everyone(self):
        for gender in ("WOMAN", "MAN", "NON_BINARY", "PREFER_NOT_TO_SAY"):
            self.check(rider(gender), OPEN_TRIP, 1.0)

    def test_a_women_plus_only_passenger_skips_open_trips(self):
        self.check(rider("WOMAN", women_plus_only=True), OPEN_TRIP, 0.0)
        self.check(rider("WOMAN", women_plus_only=True), WOMEN_PLUS_TRIP, 1.0)

    def test_familiar_riders_and_seats_still_apply(self):
        familiar_trip = dict(OPEN_TRIP, familiarRidersOnly=True)
        self.check(rider("MAN"), familiar_trip, 0.0)
        self.check(rider("MAN", familiar=True), familiar_trip, 1.0)
        self.check(rider("WOMAN"), dict(OPEN_TRIP, seatsAvailable=0), 0.0)


class RankingLeavesOutTripsYouCantJoin(unittest.TestCase):
    def test_run_psga_drops_trips_that_fail_a_rule(self):
        here = (13.94, 121.62)
        campus = (13.949, 121.6203)
        passenger = dict(rider("MAN"), origin=here, destination=campus, departureMinutes=420, flexWindowMinutes=15)
        base = {"origin": here, "destination": campus, "departureMinutes": 420}
        trips = [
            dict(OPEN_TRIP, tripId="open", **base),
            dict(WOMEN_PLUS_TRIP, tripId="women-plus", **base),
        ]
        self.assertEqual([r["tripId"] for r in psga.run_psga(passenger, trips)], ["open"])


if __name__ == "__main__":
    unittest.main()
