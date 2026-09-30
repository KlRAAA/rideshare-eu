# RideShareEU — User Acceptance Test and SUS Protocol

This protocol carries out the usability evaluation described in the manuscript
(Section 5, *Quality Requirements and Evaluation of Results*):

- a structured User Acceptance Test (UAT) with a pilot group of verified
  MSEUF students, faculty and staff;
- each task mapped to an ISO/IEC 25010 usability sub-characteristic:
  appropriateness recognizability, learnability, operability, and user error
  protection;
- the System Usability Scale (SUS). The acceptance threshold is a **mean SUS
  score of 68 or higher**. Results are reported as mean ± standard deviation
  and classified with the SUS adjective rating scale;
- descriptive statistics only. The pilot sample is small, so results are
  indicative and do not claim statistical significance.

Record everything in [`UAT_SUS_Results.xlsx`](UAT_SUS_Results.xlsx). The
workbook calculates completion rates, task ease, per-sub-characteristic means,
SUS scores and the summary.

---

## 1. Participants

| Item | Plan |
|---|---|
| Number | 5–8. Five users typically uncover most usability problems (Nielsen & Landauer, 1993), and more give a steadier SUS mean. The workbook holds up to 12. |
| Mix | At least one student, one faculty member and one staff member. At least two people who would host rides and two who would join them. |
| Include | Active MSEUF community members with a school email and a smartphone. |
| Exclude | The thesis team, the adviser, and anyone who has already used RideShareEU. |
| Recruitment | Voluntary, by invitation. No payment or grade incentive. |

Give each participant an ID from **P01** to **P12**, in the order they take
part. The ID is the only identifier recorded anywhere in the results.

## 2. Ethics and data privacy (RA 10173)

- **Consent.** Before starting, read the consent script (Section 6) aloud and
  have the participant sign the consent form. Mark "Consent form signed" on
  the *Participants* tab. Without consent there is no session.
- **No real trips.** Every trip in the session is a test trip. Nobody rides
  anywhere, and no money changes hands.
- **Minimum data.** The workbook holds anonymous IDs, role, device, task
  outcomes and SUS answers only. Never write names, emails, student numbers,
  phone numbers or screenshots of profiles in it.
- **Pilot accounts.** Participants register with their real school email,
  because the OTP step needs it. Before the first session, take a snapshot
  with `node scripts/backup-db.mjs`. After the last session, restore it with
  `node scripts/restore-db.mjs backups/<that snapshot> --force`, which removes
  every pilot account. Also delete any profile photos uploaded during the
  sessions from `public/uploads/avatars/`.
- **Reporting.** Only aggregate results go in the thesis. Quotes from
  think-aloud notes are attributed as "a participant" or by ID, never by name.
- **Withdrawal.** A participant may stop at any time without giving a reason.
  If they withdraw, delete their rows from the workbook and their account from
  the database.

## 3. Setup

### Environment

- Run the sessions on each **participant's own phone**, because that is how
  the app will actually be used. Keep a laptop ready as a fallback, and write
  the device used in the *Participants* tab.
- The phone must reach both the web app and the API. Use a deployed instance,
  or a tunnel to the local servers (`npm run server` and `npm run dev`).
  - Point `NEXT_PUBLIC_API_URL` at the public API address.
  - Add the web address to `CORS_ORIGIN`.
- **If the API runs behind a proxy or tunnel, set `TRUST_PROXY=1`.** Without
  it, every participant shares the proxy's IP address and therefore one set of
  sign-in rate limits: 5 verification emails and 10 attempts per 15 minutes.
- SMTP must be configured, because participants receive their registration
  code by email.

### Moderator accounts

Prepare two accounts before the sessions start:

| Account | Setup | Used in |
|---|---|---|
| **Moderator Host** | Has a vehicle and an open one-time trip to MSEUF for the session date (for example, departing 7:00 AM), with seats free. | T3: the participant searches for it and requests to join. T6: the moderator approves the request, marks the trip complete, and the participant rates this host. |
| **Moderator Rider** | A plain passenger account. | T4: after the participant posts a trip in T2, this account requests to join it so the participant has a request to approve. |

The moderator uses a second device (a laptop is fine) to act as these
accounts between tasks.

### Before each session

1. Confirm both moderator accounts can log in, and that Moderator Host's trip
   is open with a free seat. Post a new one if an earlier participant filled it.
2. Clear the browser's site data on the participant's phone if a previous
   participant used it.
3. Open the workbook to the participant's rows. Have a stopwatch, the SUS
   sheet, and the consent form ready.

## 4. Tasks

Read each scenario aloud exactly as written. Start the stopwatch when you
finish reading, and stop it when the participant says "done" or the success
criterion is visibly met.

- The time limit is **5 minutes** per task. When it runs out, the outcome is
  **Failed**.
- The five **Core** tasks are the ones the manuscript lists.
- The three **Supplementary** tasks deepen the operability, learnability and
  error-protection data. Skip them if the session runs long, and leave their
  rows blank.

| # | Type | Scenario (read aloud) | Success criterion | ISO/IEC 25010 sub-characteristic |
|---|---|---|---|---|
| T1 | Core | "You've just heard about RideShareEU. Create an account with your school email." | Lands on the dashboard, signed in. | User error protection: email domain check, code entry, password rules |
| T2 | Core | "You drive to campus tomorrow morning. Post a trip from your home area to MSEUF with two free seats. Add your car if the app asks." | The trip appears under the participant's hosted trips. | Operability |
| T3 | Core | "Now imagine you need a ride instead. Find a ride to MSEUF tomorrow around 7:00 AM and ask to join the one that suits you." | A join request to Moderator Host's trip shows as pending. | Appropriateness recognizability: can they tell which ride fits? |
| T4 | Core | *(Moderator Rider requests to join the participant's T2 trip first.)* "Someone wants to join the trip you posted. Let them in." | The request shows as approved. | Operability |
| T5 | Supplementary | "Tell your passenger where to meet you." | A message appears in the trip chat. | Operability |
| T6 | Core | *(Moderator Host approves the T3 request and marks that trip complete.)* "The ride you joined is finished. Rate your driver." | The rating is submitted. | Learnability: the first time they've seen the rating flow |
| T7 | Supplementary | "You'd prefer to ride only with people of your own gender. Change that setting." | The preference is saved. | Learnability |
| T8 | Supplementary | "Your driver was rude during the trip. Report them, then check that the report went through." | The report appears in their report history. | User error protection: required category, length limit |

For each task, record in the *Tasks* tab:

- **Outcome:** Completed, Assisted, or Failed. The workbook's *Instructions*
  tab defines each one.
- **Time (s):** seconds from the end of the scenario to completion. Leave it
  blank if the participant failed.
- **Errors:** wrong taps that had to be backed out, validation messages
  triggered, or visits to the wrong page.
- **Ease (1–5):** right after the task, ask *"On a scale of 1 to 5, how easy
  was that task? 1 is very difficult, 5 is very easy."*
- **Observer notes:** what they said while thinking aloud, and where they
  hesitated.

## 5. Moderator script

**Opening (about 3 minutes)**

> "Thank you for helping. We're testing the app, not you. If something is
> confusing, that's the app's fault and exactly what we need to find. Please
> think aloud as you go: say what you're looking for, what you expect to
> happen, and anything that surprises you. I'll read you a few short
> scenarios. I can't help you while you work, because we need to see how the
> app does on its own. If you're stuck, say so. The whole session takes about
> 25 minutes, and you can stop at any time."

**During tasks**

- Stay neutral. Say "What would you try next?" rather than "Try the menu."
- If the participant is stuck for **2 minutes**, give the smallest possible
  hint (for example, "Have you looked at the bottom bar?") and record the task
  as **Assisted**.
- Don't explain features or answer "is this right?" questions until the task
  ends.

**After the last task**

Hand over the SUS sheet (Section 7):

> "Please answer all ten. Go with your first reaction. If you're not sure,
> circle the middle."

Then ask two open questions and note the answers on the *Participants* tab:

1. What was the most frustrating part?
2. What would make you actually use this for your commute?

## 6. Consent script

> "This session is part of a thesis at Manuel S. Enverga University
> Foundation evaluating a university carpooling app called RideShareEU.
>
> - You'll do a few short tasks on your phone while thinking aloud, then
>   answer a 10-question survey. It takes about 25 minutes.
> - You'll create an account with your school email. All trips are
>   pretend: nobody travels, and no payment is involved.
> - We record only an anonymous ID (such as P03), your role (student,
>   faculty or staff), how well each task went, and your survey answers. We
>   do not record your name or email in the results.
> - Your test account is deleted when the evaluation ends.
> - Results are reported only as group totals, in line with the Data Privacy
>   Act of 2012 (RA 10173).
> - Taking part is voluntary. You can stop at any time without giving a
>   reason, and your data will be removed.
>
> Do you agree to take part?"

## 7. System Usability Scale

These are the ten standard items (Brooke, 1996), with "the system" replaced
by "RideShareEU". Rate each one from **1 = Strongly disagree** to
**5 = Strongly agree**.

1. I think that I would like to use RideShareEU frequently.
2. I found RideShareEU unnecessarily complex.
3. I thought RideShareEU was easy to use.
4. I think that I would need the support of a technical person to be able to use RideShareEU.
5. I found the various functions in RideShareEU were well integrated.
6. I thought there was too much inconsistency in RideShareEU.
7. I would imagine that most people would learn to use RideShareEU very quickly.
8. I found RideShareEU very cumbersome to use.
9. I felt very confident using RideShareEU.
10. I needed to learn a lot of things before I could get going with RideShareEU.

Keep the wording and order as they are. The alternating positive and
negative items are part of what makes the scale valid.

## 8. Scoring and interpretation

The workbook does all of this automatically. It's written out here so it can
be explained in the thesis defense.

**SUS score (per participant)**

Odd items contribute `answer − 1`. Even items contribute `5 − answer`. Add
the ten contributions and multiply by 2.5, which gives a score from 0 to 100.
The score is not a percentage.

**SUS summary**

The workbook reports n, the mean, the sample standard deviation, the minimum
and the maximum. The mean is then classified three ways:

| Measure | Rule | Source |
|---|---|---|
| Acceptance | Mean ≥ 68 passes, as set in the manuscript. | Sauro (2011): 68 is the average across about 500 studies. |
| Adjective | The highest adjective whose mean the score reaches: Worst imaginable 0 · Awful 20.3 · Poor 35.7 · OK 50.9 · Good 71.4 · Excellent 85.5 · Best imaginable 90.9. | Bangor, Kortum & Miller (2009) |
| Acceptability | Below 50: not acceptable · 50–70: marginal · above 70: acceptable. | Bangor, Kortum & Miller (2008) |

**Task measures**

For each task, the workbook reports:

- **Unassisted success:** Completed ÷ Attempted.
- **Overall success:** (Completed + Assisted) ÷ Attempted.
- **Mean time:** successful attempts only.
- **Mean errors.**
- **Mean ease**, read against the 5-point scale: 1.00–1.80 very difficult ·
  1.81–2.60 difficult · 2.61–3.40 neutral · 3.41–4.20 easy · 4.21–5.00 very
  easy.

**ISO/IEC 25010 usability**

Each sub-characteristic's score is the mean ease rating of the tasks mapped
to it.

**Reporting template (Chapter 4)**

> "*n* participants (*x* students, *y* faculty, *z* staff) completed the UAT.
> The core tasks had an unassisted success rate of *__%* (*__%* including
> assisted completions). The mean SUS score was *__* (SD = *__*), which is
> rated *'__'* on the adjective scale and is *above/below* the acceptance
> threshold of 68. Given the pilot sample size, these results are indicative
> and not statistically generalizable."

## References

- Bangor, A., Kortum, P. T., & Miller, J. T. (2008). An empirical evaluation of the System Usability Scale. *International Journal of Human–Computer Interaction, 24*(6), 574–594.
- Bangor, A., Kortum, P., & Miller, J. (2009). Determining what individual SUS scores mean: Adding an adjective rating scale. *Journal of Usability Studies, 4*(3), 114–123.
- Brooke, J. (1996). SUS: A "quick and dirty" usability scale. In P. W. Jordan et al. (Eds.), *Usability Evaluation in Industry* (pp. 189–194). Taylor & Francis.
- Nielsen, J., & Landauer, T. K. (1993). A mathematical model of the finding of usability problems. *Proceedings of INTERCHI '93*, 206–213.
- Sauro, J. (2011). *A Practical Guide to the System Usability Scale.* Measuring Usability LLC.
