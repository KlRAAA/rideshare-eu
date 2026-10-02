"""
Combines the evaluators' workbooks into validation/ground_truth.json, the
file score_against_ground_truth.py reads.

    python validation/labeling/merge_labels.py

Follows the manuscript's oracle: two evaluators label every pair
independently; where they agree, that is the label; where they disagree, a
third evaluator (the tiebreaker) decides.

Run it after Evaluator_A.xlsx and Evaluator_B.xlsx are both complete:
  1st run  — checks both are fully labeled, reports agreement (percent and
             Cohen's kappa) to agreement_report.json, and writes
             Tiebreaker.xlsx holding only the disagreements.
  2nd run  — once Tiebreaker.xlsx is filled in, writes ground_truth.json.
If A and B agree on everything, the first run writes ground_truth.json
directly. It never overwrites a Tiebreaker.xlsx that already exists.
"""

import json
import os
import sys

from build_labeling_kit import build_workbook
from labeling_common import ACCEPTABLE, HERE, VALIDATION_DIR, evaluator_row, load_dataset, read_labels

GROUND_TRUTH_PATH = os.path.join(VALIDATION_DIR, "ground_truth.json")
REPORT_PATH = os.path.join(HERE, "agreement_report.json")


class LabelingIncomplete(Exception):
    pass


def check_complete(name, labels, invalid, expected_ids):
    problems = []
    missing_rows = sorted(expected_ids - labels.keys())
    unexpected = sorted(labels.keys() - expected_ids)
    blank = sorted(pid for pid, label in labels.items() if label is None and pid in expected_ids)
    if missing_rows:
        problems.append(f"{len(missing_rows)} pairs are missing from the sheet (e.g. {missing_rows[:5]})")
    if unexpected:
        problems.append(f"{len(unexpected)} unknown pair IDs (e.g. {unexpected[:5]})")
    if invalid:
        problems.append(f"{len(invalid)} judgments aren't ACCEPTABLE / NOT ACCEPTABLE (e.g. {invalid[:3]})")
    blank_only = [pid for pid in blank if pid not in {i for i, _ in invalid}]
    if blank_only:
        problems.append(f"{len(blank_only)} pairs have no judgment yet (e.g. {blank_only[:5]})")
    if problems:
        raise LabelingIncomplete(f"{name} isn't finished:\n  - " + "\n  - ".join(problems))


def cohens_kappa(a, b):
    """Agreement beyond chance for two raters' labels on the same items."""
    ids = list(a)
    n = len(ids)
    if n == 0:
        raise ValueError("no items to compare")
    observed = sum(a[i] == b[i] for i in ids) / n
    a_yes = sum(a[i] == ACCEPTABLE for i in ids) / n
    b_yes = sum(b[i] == ACCEPTABLE for i in ids) / n
    expected = a_yes * b_yes + (1 - a_yes) * (1 - b_yes)
    if expected == 1:
        return 1.0
    return (observed - expected) / (1 - expected)


def agreement_report(a, b):
    ids = sorted(a)
    disagreements = [i for i in ids if a[i] != b[i]]
    return {
        "pairs": len(ids),
        "agreed": len(ids) - len(disagreements),
        "disagreed": len(disagreements),
        "percent_agreement": round(100 * (len(ids) - len(disagreements)) / len(ids), 2),
        "cohens_kappa": round(cohens_kappa(a, b), 4),
        "acceptable_by_A": sum(a[i] == ACCEPTABLE for i in ids),
        "acceptable_by_B": sum(b[i] == ACCEPTABLE for i in ids),
        "disagreement_ids": disagreements,
    }


def resolve(a, b, tiebreak):
    """Final label per pair: the agreed label, or the tiebreaker's where A and B differ."""
    truth = {}
    for pid in sorted(a):
        label = a[pid] if a[pid] == b[pid] else tiebreak[pid]
        truth[pid] = label == ACCEPTABLE
    return truth


def kappa_reading(kappa):
    # Landis & Koch (1977) bands, the usual way to describe kappa in a thesis.
    for limit, words in ((0.0, "poor"), (0.20, "slight"), (0.40, "fair"), (0.60, "moderate"), (0.80, "substantial")):
        if kappa <= limit:
            return words
    return "almost perfect"


def run(work_dir=HERE, ground_truth_path=GROUND_TRUTH_PATH, dataset=None):
    dataset = dataset if dataset is not None else load_dataset()
    expected_ids = {r["tripId"] for r in dataset}

    a, a_bad = read_labels(os.path.join(work_dir, "Evaluator_A.xlsx"))
    b, b_bad = read_labels(os.path.join(work_dir, "Evaluator_B.xlsx"))
    check_complete("Evaluator_A.xlsx", a, a_bad, expected_ids)
    check_complete("Evaluator_B.xlsx", b, b_bad, expected_ids)

    report = agreement_report(a, b)
    with open(os.path.join(work_dir, "agreement_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"A and B agree on {report['agreed']}/{report['pairs']} pairs ({report['percent_agreement']}%). "
          f"Cohen's kappa = {report['cohens_kappa']} ({kappa_reading(report['cohens_kappa'])}).")

    disagreements = set(report["disagreement_ids"])
    tiebreak = {}
    tiebreaker_path = os.path.join(work_dir, "Tiebreaker.xlsx")
    if disagreements:
        if not os.path.exists(tiebreaker_path):
            rows = [evaluator_row(r) for r in dataset if r["tripId"] in disagreements]
            build_workbook(rows, "C (tiebreaker)", tiebreaker_path)
            print(f"Wrote Tiebreaker.xlsx with the {len(rows)} disagreements. "
                  "Send it to the third evaluator, then run this script again.")
            return None
        tiebreak, t_bad = read_labels(tiebreaker_path)
        check_complete("Tiebreaker.xlsx", tiebreak, t_bad, disagreements)

    truth = resolve(a, b, tiebreak)
    with open(ground_truth_path, "w", encoding="utf-8") as f:
        json.dump(truth, f, indent=2, sort_keys=True)
    print(f"Wrote {ground_truth_path}: {sum(truth.values())} acceptable, "
          f"{len(truth) - sum(truth.values())} not acceptable. "
          "Next: python validation/score_against_ground_truth.py")
    return truth


if __name__ == "__main__":
    try:
        run()
    except FileNotFoundError as err:
        sys.exit(f"Missing workbook: {err.filename}")
    except LabelingIncomplete as err:
        sys.exit(str(err))
