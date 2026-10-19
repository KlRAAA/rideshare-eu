# RideShareEU evaluation instrument (UAT)

The Google Form made by `forms/create-evaluation-form.gs`. Testers follow the
public guide at `/test` (QR code: `rideshareeu-test-qr.png`), then answer it.
Anonymous: no name or email is collected.

## Respondent groups and what each answers

| Group | Group section | Then everyone answers |
|---|---|---|
| Students, faculty, non-teaching staff (end users) | none | Tasks, Usability (U1–U10), SUS (S1–S10), comments |
| ICTD (IT evaluators) | ISO/IEC 25010 product quality (Q1–Q20) | same |
| Sustainability office, Transportation office (domain evaluators) | Campus mobility and sustainability (D1–D10) | same |

Profile questions for all: group, used as passenger / driver / both, device,
added to home screen. Consent comes first; "I do not agree" ends the form.

## Scales

All rated items use a 5-point Likert scale: 1 Strongly disagree, 2 Disagree,
3 Neutral, 4 Agree, 5 Strongly agree.

**Usability (ISO/IEC 25010 sub-characteristics):** U1–U2 appropriateness
recognizability, U3–U4 learnability, U5–U6 operability, U7–U8 user error
protection, U9 user interface aesthetics, U10 accessibility.

**ICTD (ISO/IEC 25010 characteristics):** Q1–Q3 functional suitability, Q4–Q6
performance efficiency, Q7–Q8 compatibility, Q9–Q12 reliability, Q13–Q16
security, Q17–Q18 maintainability, Q19–Q20 portability.

**Domain evaluators:** D1–D3 functional suitability, D4 mobility impact, D5
cost, D6–D7 safety, D8 operations, D9 sustainability, D10 adoption.

**SUS:** the ten standard items (Brooke, 1996) with "RideShareEU" as the
system name.

The exact wording of every item is in the script.

## Scoring

**Likert items:** weighted mean per item, per characteristic and per group,
with this interpretation:

| Mean | Interpretation |
|---|---|
| 4.21 – 5.00 | Strongly agree (Excellent) |
| 3.41 – 4.20 | Agree (Very good) |
| 2.61 – 3.40 | Neutral (Good) |
| 1.81 – 2.60 | Disagree (Fair) |
| 1.00 – 1.80 | Strongly disagree (Poor) |

**SUS** (per respondent): odd items score (answer − 1), even items score
(5 − answer); the sum × 2.5 gives 0–100. Report the mean and standard
deviation. The acceptance threshold is a mean of **68 or higher**; classify it
with the SUS adjective scale (e.g. 68 OK/Good, 80.3 Excellent).

**Tasks:** the share of respondents who completed each task, from the
checklist; the "couldn't finish" answers explain the gaps.

Results are descriptive (no statistical significance claimed), reported by
group, as in the manuscript's evaluation plan.
