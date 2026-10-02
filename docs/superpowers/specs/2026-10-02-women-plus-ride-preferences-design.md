# Women+ trips and inclusive gender options

**Date:** 2026-10-02
**Status:** Draft for review (team and research adviser)
**Replaces:** the "same-gender only" rule for drivers and passengers

## 1. Why

"Same-gender only" was meant to protect women, but in practice it fails on three counts:

1. **It doesn't protect.** A driver's same-gender trip still shows up for the opposite gender in a normal search (it only lowers the match score by 20%), and the join endpoint never checks it. "Familiar riders only" has the same gap.
2. **It leaves people out.** Registration offers only Male, Female or Prefer not to say. A non-binary user has no option that fits, chooses "Prefer not to say", and is then locked out of every same-gender trip, as rider and as driver.
3. **It leaks gender.** `safeUserSelect` returns every user's gender, so the API sends the gender of drivers and co-riders to other users, even though no screen displays it.

## 2. Goals and non-goals

**Goals**
- A safe space that actually holds: **Women+ trips** (women and non-binary riders and drivers), modelled on Lyft's Women+ Connect. They are hidden from, and rejected for, everyone else.
- Nobody is shut out: inclusive, self-declared gender options, changeable in Profile. Everyone can always use trips open to everyone.
- Gender is never shown to other users. Trips display their rule, never people's genders.
- "Familiar riders only" is enforced the same way.
- A passenger who prefers Women+ trips is warned before joining a trip open to everyone.

**Non-goals (future work)**
- A minimum-trust-score option.
- A co-rider rule that keeps a trip open to everyone free of opposite-gender riders after a Women+-preferring passenger joins. This design only warns her.
- Verifying anyone's gender. Safety relies on accountability (school-verified accounts, ratings, reports, bans), not proof.

## 3. Decisions (confirmed 2026-10-02)

| # | Question | Decision |
|---|---|---|
| D1 | Driver options | **Anyone** or **Women+ only**. No men-only option. |
| D2 | Changing gender later | **Allowed in Profile.** Applies to new requests; rides already approved stay. |
| D3 | Switching a trip to or from Women+ | **Only while the trip has no approved riders** (same lock as other structural edits). |
| D4 | Minimum-trust-score filter | **Not now** (future work). |

Further decisions made in this spec (flag any you disagree with):

| # | Decision | Reason |
|---|---|---|
| D5 | Only Women+ users can **host** a Women+ trip. | A "Women+ trip" with a male driver would mislead the riders it exists for. Same rule as Lyft. |
| D6 | The passenger filter uses only the **trip's rule**, never the driver's gender. | Filtering by driver gender would reveal it through the search results. |
| D7 | A user who hosts open Women+ trips can't change their gender to one that isn't Women+ until those trips are finished or cancelled. | Otherwise a Women+ trip would suddenly have an ineligible driver. Narrow case, explained in the UI. |
| D8 | Changing gender withdraws the user's **pending** requests on Women+ trips they'd no longer be eligible for, after a warning. Approved rides stay (D2). | The host is told "X withdrew their request", exactly like a normal withdrawal, so no gender is revealed. |
| D9 | No new report category. "Harassment" is relabelled **"Harassment, including about gender or identity"**. | Harassment is already a high-alert category (immediate ban on a qualified report); a duplicate category adds nothing. |
| D10 | Admins can see a user's declared gender on the admin user page only. | Needed to review reports of Women+ misuse. Never returned anywhere else except to the user themselves. |

## 4. Data model

**User.gender** (AES-256-GCM ciphertext, as now). Values:

| Value | Label | Women+ eligible |
|---|---|---|
| `WOMAN` | Woman | Yes |
| `NON_BINARY` | Non-binary | Yes |
| `MAN` | Man | No |
| `PREFER_NOT_TO_SAY` | Prefer not to say | No (they can choose another option at any time) |

**Enum `GenderPreference`** (used by `Trip.genderPreference` and `Preference.genderPreference`): `ANY` | `WOMEN_PLUS`. The old `SAME_GENDER` value is removed.

**Migration** (`npm run migrate-women-plus`, idempotent, backup first):

| Old | New |
|---|---|
| User gender `FEMALE` / `MALE` / `UNSPECIFIED` | `WOMAN` / `MAN` / `PREFER_NOT_TO_SAY` (decrypt, map, re-encrypt) |
| Trip `SAME_GENDER`, host is a woman | `WOMEN_PLUS` |
| Trip `SAME_GENDER`, any other host | `ANY`, and the host gets a notification: "Same-gender trips are now Women+ trips. Your trip to … is open to everyone; edit it if you want to change who can join." |
| Preference `SAME_GENDER`, user is a woman | `WOMEN_PLUS` |
| Preference `SAME_GENDER`, any other user | `ANY` |

The app isn't deployed, so this only touches dev and demo data. It still has to be correct for the Postman and demo seeds.

## 5. One rule, used everywhere

A single server module (`server/services/riderRules.js`), mirrored in `src/lib/riderRules.ts` for the UI:

- `isWomenPlusEligible(gender)`: `WOMAN` or `NON_BINARY`.
- `canJoin(trip, rider)`: false if `trip.genderPreference === 'WOMEN_PLUS'` and the rider isn't eligible; false if `trip.familiarRidersOnly` and the rider has no completed ride with this host; otherwise true.
- `canHostWomenPlus(host)`: `isWomenPlusEligible(host.gender)`.

**Where it is enforced (server, never trusted from the client):**

| Place | Behaviour |
|---|---|
| Search (`POST /api/matches/search`) and Show all (`/show-all`) | Trips the searcher can't join are removed **before** PSGA scoring. |
| Join (`POST /api/matches`) | `403 TRIP_WOMEN_PLUS_ONLY` or `403 TRIP_FAMILIAR_RIDERS_ONLY`. |
| Approve (`PATCH /api/matches/:id`, status APPROVED) | Re-checks `canJoin`; `409 RIDER_NO_LONGER_ELIGIBLE` (backstop for races; D8 normally prevents it). |
| Create trip / edit trip | `WOMEN_PLUS` only if `canHostWomenPlus`, else `403 WOMEN_PLUS_HOST_NOT_ELIGIBLE`. Changing the rule follows D3 (`409` structural lock when riders are approved). |
| Ride details (`GET /api/trips/:id`) for an ineligible non-participant | `404 TRIP_NOT_FOUND`, so a shared link doesn't expose a Women+ trip's route and schedule. |

**PSGA.** The formula is unchanged. Safety rules become pre-filters, which is how the passenger's own gender filter already worked. For trips that are shown, the preference term is therefore always met; the manuscript gets one sentence saying so.

## 6. Privacy

- Remove `gender` from `safeUserSelect`. Gender is returned only by `GET /api/users/me` (your own) and the admin user page (D10).
- Trip cards and ride details show **badges for the rule**: "Women+ trip" and "Familiar riders only". They never show any person's gender.
- Warnings and errors are worded around the trip's rule, never about another person's gender.
- Help text at registration and in Profile: "Used only for Women+ trips. Never shown to other users. You can change it anytime."
- Gender stays encrypted at rest. Changing it is not written to the security log (that would create a gender-change history).

## 7. User experience

**Registration.** A "Gender" select with Woman, Man, Non-binary, Prefer not to say (default), plus the help text above.

**Profile.**
- A new "Gender" field (D2). On save, if it would withdraw pending Women+ requests (D8): "Changing this will withdraw your 2 pending requests on Women+ trips. Continue?" If it's blocked by D7: "You're hosting Women+ trips. Finish or cancel them first."
- "Matching preferences → Trips I see": **All trips** / **Women+ trips only**. The Women+ option appears only for eligible users.

**Post a ride / edit trip.** "Who can join: Anyone / Women+ only (women and non-binary riders)". The Women+ option appears only for eligible hosts. Once riders are approved the control is locked, with the same notice as other structural changes.

**Find a Ride.**
- Filter "Show: All trips / Women+ trips only", for eligible users only, defaulting to their Profile preference.
- If "Women+ trips only" finds nothing, the empty state offers **"Also show trips open to everyone"**.
- Result cards show the rule badges.

**Joining a trip open to everyone (the warning).** It shows when a passenger whose search filter or Profile preference is "Women+ trips only" taps Request to Join on an Anyone trip:

> **This trip is open to everyone.** You chose Women+ trips only. Other riders on this trip could be any gender.
> [Cancel] [Request anyway]

No warning on Women+ trips, and none for passengers whose preference is "All trips".

**Admin.** The user page shows declared gender (D10). The report form and admin labels use the new "Harassment" wording (D9).

## 8. Scenarios

Each row becomes at least one test case. "W+" means a Women+ eligible user (woman or non-binary).

**Who sees and joins what**

| # | Situation | Expected |
|---|---|---|
| S1 | Man searches; a W+ trip matches his route and time | Not in results, not in Show all |
| S2 | Man opens a shared link to a W+ trip | 404 "trip not found" |
| S3 | Man calls the join API directly with a W+ trip id | 403 `TRIP_WOMEN_PLUS_ONLY`, nothing created |
| S4 | Non-binary passenger searches | Sees W+ trips and Anyone trips; can join both |
| S5 | "Prefer not to say" passenger searches | Sees Anyone trips only; W+ filter hidden; Profile hints they can choose a gender to use W+ trips |
| S6 | Woman with "Women+ trips only" | Only W+ trips; if none, "Also show trips open to everyone" |
| S7 | Woman with "Women+ trips only" taps Request to Join on an Anyone trip | Warning; Cancel sends nothing; Request anyway sends it |
| S8 | Woman with "All trips" joins an Anyone trip | No warning |
| S9 | Anyone joins a W+ trip | No warning |
| S10 | Stranger searches; a "Familiar riders only" trip matches | Not in results; join API returns 403 `TRIP_FAMILIAR_RIDERS_ONLY` |
| S11 | Rider who completed a ride with that host searches | Familiar-only trip shown and joinable |

**Drivers**

| # | Situation | Expected |
|---|---|---|
| S12 | Man tries to post a W+ trip (UI or API) | Option hidden; API 403 `WOMEN_PLUS_HOST_NOT_ELIGIBLE` |
| S13 | W+ host switches Anyone → W+ with no approved riders | Allowed; non-eligible **pending** requests are declined with the normal "declined" notification |
| S14 | Host switches Anyone ↔ W+ with approved riders | Blocked by the structural lock (D3) |
| S15 | Host switches W+ → Anyone with no approved riders | Allowed |
| S16 | Recurring W+ trip | The rule applies to every occurrence (standing matches don't change) |

**Changing gender**

| # | Situation | Expected |
|---|---|---|
| S17 | Woman with pending W+ requests changes to Man | Warned, then the requests are withdrawn; hosts see a normal withdrawal |
| S18 | Woman approved on a W+ trip changes to Man | The approved ride stays (D2); future W+ requests are blocked |
| S19 | W+ host with open W+ trips changes to Man | Blocked (D7) with an explanation |
| S20 | Man changes to Woman | Can see and join W+ trips from then on |
| S21 | Someone switches gender just to join a W+ trip | Allowed by design (self-declared). Covered by host approval, ratings, reports ("Harassment" or "Safety") and admin review |

**Races and leftovers**

| # | Situation | Expected |
|---|---|---|
| S22 | A request was sent, then the rider becomes ineligible before approval | Approve returns 409 `RIDER_NO_LONGER_ELIGIBLE`; the request is declined |
| S23 | Old app version sends `SAME_GENDER` | 400 `INVALID_TRIP` (field `genderPreference`); the frontend never sends it |
| S24 | Old preference row says `SAME_GENDER` | Converted by the migration; the server treats any unknown value as `ANY` |
| S25 | Deleted account | Gender erased with the other PII (existing behaviour) |

**Privacy**

| # | Situation | Expected |
|---|---|---|
| S26 | Any response other than your own `/api/users/me` and the admin user page | Contains no `gender` field (test scans the main responses) |
| S27 | Trip card or ride details for any trip | Show rule badges only, never a person's gender |

## 9. Changes by area

| Area | Change |
|---|---|
| Schema and migration | Enum values; migration script with backup; Postman and demo seeds updated |
| Server | `riderRules.js`; search, show-all, join, approve, trip create, edit and detail; preferences; `safeUserSelect`; registration and a new `PATCH /api/users/me/gender`; report label |
| Frontend | Registration, Profile (gender and preference), post and edit trip, Find a Ride filter and empty state, the join warning, rule badges, admin user page |
| Validation (Python) | `psga.py`, the dataset generators and the independent recheck use Women+ semantics; regenerate `dataset_500_pairs.json`, `method_rankings.json` and the blank evaluator workbooks. Labeling hasn't started, so nothing is lost |
| Tests | Jest (one test per scenario above where automatable), web tests for the warning rule, Python validation tests, Postman cases for S3, S10 and S12 |
| Docs | Manuscript: the same-gender passages (6 places), the preference term note (Section 5), ethics (self-declared, optional, never shown, changeable). AGENTS.md. OWASP review (gender exposure fixed under A01). Test plan F-06 |

## 10. Build order

1. Rules module and privacy (`safeUserSelect`) with tests. No behaviour change visible to users yet beyond less data in responses.
2. Schema and migration, seeds.
3. Server enforcement (search, show-all, join, approve, trip create, edit and detail), preferences, gender update endpoint.
4. Frontend: registration, Profile, post and edit, Find a Ride, warning, badges, admin.
5. Python validation update and regenerated artifacts.
6. Postman, manuscript, AGENTS.md, OWASP review, test plan.
7. Full regression (Jest, web, Python, Postman) and a browser walkthrough of S1–S27 with the demo accounts.

Each step lands with its tests; nothing merges to main until step 7 passes.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Fewer matches for Women+ users while there are few Women+ drivers | "Also show trips open to everyone" in the empty state, with the warning |
| Self-declared gender is abused | Host approval, ratings, the high-alert Harassment and Safety reports, admin review; stated as a limitation in the thesis |
| Manuscript and validation drift from the code | Validation and manuscript updated in the same change (steps 5 and 6) |
| Scope before the adviser check | Build order keeps each step shippable; steps 5 and 6 can follow if time runs short |
