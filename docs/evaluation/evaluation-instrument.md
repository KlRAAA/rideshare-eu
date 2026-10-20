# RideShareEU evaluation instrument (UAT)

The Google Form made by `forms/create-evaluation-form.gs`, modeled on the
structure other CCMS thesis groups use (intro page, consent, profile, feature
usability, interface, SUS, open feedback). Testers follow the public guide at
`/test` (QR code: `rideshareeu-test-qr.png`), then answer it. Anonymous: no
name or email is collected. Contact on the form: thesis013xvn@gmail.com. No
token of appreciation.

## Pages

| Page | Who | Content |
|---|---|---|
| Intro | everyone | Study title and purpose, Data Privacy Notice (RA 10173), objectives, researchers, contact |
| I. Informed Consent and Tester Verification | everyone | Consent ("I do not consent" ends the form); "I created an account and used RideShareEU" check |
| II. Respondent Profile | everyone | Group (decides the next page), age group, used as passenger / driver / both, device, added to home screen |
| III-A. Software Quality (ISO/IEC 25010) | ICTD only | Q1–Q20 |
| III-B. Campus Mobility and Sustainability | Sustainability and Transportation offices only | D1–D10 |
| IV. Core Feature Usability and Task Performance | everyone | F1–F11 in one grid, Strongly disagree … Strongly agree or "Did not try" |
| V. Usability and User Interface (ISO/IEC 25010) | everyone | U1–U10 |
| VI. System Usability Scale | everyone | S1–S10 |
| VII. Feedback and Recommendations | everyone | Feature highlights, issues and frustrations, suggestions |

Students, faculty and non-teaching staff go from II straight to IV.

As in the ISO/IEC 25010 questionnaires of other groups, the ICTD, domain and
usability items are answered in grids (one grid per characteristic for the
ICTD), each row written as "Sub-characteristic — statement" with the columns
Strongly disagree, Disagree, Neutral, Agree, Strongly agree (scored 1–5). The
SUS keeps its standard ten separate 1–5 items.

## Scales

All rated items use a 5-point Likert scale: 1 Strongly disagree, 2 Disagree,
3 Neutral, 4 Agree, 5 Strongly agree.

**Core features (F1–F11):** account creation, ride search and results, join
request and approval status, posting a trip, approving riders, running a trip
(start, pickups, end), live map, notifications, chat, fuel share, help and
safety. "Did not try" answers are left out of that item's mean and counted
separately as the share of testers who tried each feature.

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

Results are descriptive (no statistical significance claimed), reported by
group, as in the manuscript's evaluation plan.
