# PSGA ground truth — human labeling protocol

This is the procedure behind the manuscript's Algorithm Validation section:
two evaluators independently judge all 500 passenger–trip pairs in
`validation/dataset_500_pairs.json`, a third evaluator breaks ties, and the
result is the ground truth that precision@1, recall and mean rank of the first
acceptable match are measured against, for PSGA and the three baselines
(random, route-only, FIFO).

Nothing here can be filled in by the developer or by a script. The judgments
must come from people.

## Before anyone starts

1. **Approve the rubric.** The `Rubric` tab in each workbook holds the
   proposed rules (hard constraints first, then a time rule and a route rule
   with a "use your judgment" band). The numbers — 10 minutes past the
   passenger's wait window, and 1 km / 3 km of extra driving — are proposed
   defaults, chosen from commute common sense rather than from PSGA's own
   thresholds. Confirm or change them with the adviser **before** handing out
   the workbooks; after that, don't change them. If they change, edit `RUBRIC`
   in `validation/labeling/build_labeling_kit.py` and rebuild with `--force`.
2. **Pick three evaluators** who didn't build the app: A and B label
   everything, C (the tiebreaker) only sees the pairs A and B disagree on.
   Record who they are (name and role) for the methodology chapter.
3. **Expect about 3–4 hours each** for A and B (500 rows at roughly 20–30
   seconds each). Splitting it over a few sittings is fine.

## The workbooks

`validation/labeling/Evaluator_A.xlsx` and `Evaluator_B.xlsx` each hold all
500 pairs, shuffled in a different fixed order so the two evaluators don't
work through them in the same sequence. Every row shows only the situation:

- departure times, the passenger's ± wait, the gap between departures
- seats left, the passenger's gender and "Women+ trips only" choice, whether
  the driver accepts anyone or Women+ only (women and non-binary riders), the
  familiar-riders-only setting, and whether the passenger already knows the
  driver. The driver's own gender is not shown: the app never uses it.
- straight-line distances (passenger home → campus, driver start →
  passenger home, and the extra distance the driver takes to pick them up)
- a Google Maps link drawing driver start → passenger home → campus

The algorithm's output (route overlap, schedule alignment, preference match,
score, Stage 1 result) is deliberately left out, so the ground truth can't
just echo PSGA. Only the `Judgment` (a dropdown: `ACCEPTABLE` /
`NOT ACCEPTABLE`) and `Notes` columns can be edited.

Rebuild blank copies at any time with:

```bash
python validation/labeling/build_labeling_kit.py --force
```

Without `--force` it never overwrites an existing workbook.

## Running it

1. Send `Evaluator_A.xlsx` to evaluator A and `Evaluator_B.xlsx` to evaluator
   B. They work alone and don't compare answers until both are done.
2. Put the returned files back in `validation/labeling/` under the same names.
3. Merge:

   ```bash
   python validation/labeling/merge_labels.py
   ```

   It refuses to continue if either sheet has blank or invalid judgments, and
   lists which pairs. Otherwise it prints the agreement between A and B
   (percent and Cohen's kappa), saves it to
   `validation/labeling/agreement_report.json`, and writes
   `validation/labeling/Tiebreaker.xlsx` containing only the disagreements
   (without A's or B's answers).
4. Send `Tiebreaker.xlsx` to evaluator C, put it back, and run
   `merge_labels.py` again. It writes `validation/ground_truth.json`: the
   agreed label where A and B agree, C's label where they don't.
5. Score:

   ```bash
   python validation/score_against_ground_truth.py
   ```

   It prints precision@1, recall, mean rank of the first acceptable match and
   the number of queries evaluated for each method, and saves them to
   `validation/precision_results.json`.

Commit the filled workbooks, `agreement_report.json`, `ground_truth.json` and
`precision_results.json` together. They are the evidence for the results
table.

## What to report in the thesis

- Who the evaluators were and the rubric they used (copy the `Rubric` tab).
- Inter-rater agreement: percent agreement and Cohen's kappa with its
  Landis & Koch reading (the merge script prints it), and how many pairs went
  to the tiebreaker.
- The results table from `precision_results.json`: PSGA against random,
  route-only and FIFO.
- Queries where no candidate was acceptable can't be scored for precision@1,
  so they're skipped. `queries_evaluated` says how many counted.

## Fixes made while building this (2026-10-01)

- `validation/method_rankings.json` was stale. It had been produced before
  the corridor fix of 2026-09-21 (500 m → 1500 m, see
  [psga-independent-verification.md](psga-independent-verification.md)) and
  never regenerated, so PSGA's rankings differed in 59 of the 100 queries.
  It has been regenerated.
- The random baseline was seeded with Python's `hash(qid)`, which Python
  randomizes per process, so the "random" ranking changed on every run and
  couldn't be reproduced. It now uses `zlib.crc32(qid)`;
  `run_methods.py` gives byte-identical output across runs.

## Not part of this

`validation/PSGA_Human_Labeling_Sheet.xlsx` is an earlier 40-pair sample of
the real-route dataset (`dataset_geo_pairs.json`). It labels one pair per
scenario, so it can't produce precision@1 (which needs every candidate of a
query judged). It can still serve as a smaller sanity check on the longer
town-to-campus routes.

## Tests

```bash
python -m unittest discover -s validation/labeling -v
```

They cover what evaluators can and can't see, reading judgments back,
Cohen's kappa, the merge and tiebreak flow, and the scorer end to end. All
labels in the tests are throwaway data in a temporary folder.
