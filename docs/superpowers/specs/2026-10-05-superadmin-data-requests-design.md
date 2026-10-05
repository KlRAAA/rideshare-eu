# Superadmin and data requests

**Date:** 2026-10-05
**Status:** Draft for review (team and research adviser)
**Builds on:** `docs/policy/law-enforcement-data-requests.md` (its section 9 "DPO-only export tool")

## 1. Why

Every admin can do everything today. That includes appointing more admins and seeing a user's trip history on the admin user page. Trip history shows where someone goes and when, so it is the most sensitive data the app holds.

The data request policy already says only the school's Data Protection Officer (DPO) releases user data to the police or another authority. But the app has no way to do that safely: the DPO would have to query the database by hand, and nothing would record it.

This design adds one **superadmin**, meant to be the DPO, with two jobs:

1. Appointing and removing admins.
2. Releasing a person's trip records for an investigation, with every release recorded.

## 2. Decisions (confirmed 2026-10-05)

| # | Question | Decision |
|---|---|---|
| D1 | How many superadmins | **Exactly one**, meant to be the DPO. |
| D2 | Second approval for a release | **No.** A permanent audit entry is the safeguard, plus a password re-check. |
| D3 | When | **Build now**, before deploying. |

Further decisions made in this spec (flag any you disagree with):

| # | Decision | Reason |
|---|---|---|
| D4 | The superadmin is set only from the command line (`npm run make-superadmin <email>`), never in the app. A handover uses `--replace`. | Nobody can grant it to themselves through a hacked admin account. |
| D5 | The superadmin is also an admin, so they can do normal admin work. | One account for the DPO. |
| D6 | Only the superadmin can promote or demote admins (403 `SUPERADMIN_ONLY`). | One compromised admin account can't create more admins. |
| D7 | Admins can't ban or demote the superadmin (409 `TARGET_IS_SUPERADMIN`). The superadmin can't delete their own account (409 `LAST_SUPERADMIN`) until there's a handover. | The role can't be removed by a lower one, and is never left empty by accident. |
| D8 | Regular admins no longer see a user's full trip history. The admin user page keeps only the user's **open and full hosted trips** (needed for "Cancel trip"). Past trips and joined trips are removed for everyone, including the superadmin, whose only route to history is a recorded release. | Least privilege, and every look at someone's history leaves a record. |
| D9 | A release requires a **password re-check**, rate-limited like sign-in. | A walked-away, unlocked laptop can't be used to release data. |
| D10 | The release is generated when it's opened, not stored. Every opening is recorded. | No second copy of personal data sits in the database. |
| D11 | Other admins see in the activity log that a release happened (agency, reference number, legal basis), but **not who it was about**. The superadmin sees everything. | Being the subject of a police request is itself sensitive. |
| D12 | The user isn't notified by the app. Telling them is the DPO's decision under the policy. | Notifying could harm an investigation (for example, if the user is a suspect). |

## 3. Roles after this change

| Power | Admin | Superadmin |
|---|---|---|
| Reports, bans, support inbox, announcements, fuel prices, cancel a trip | Yes | Yes |
| See a user's open trips (to cancel them) | Yes | Yes |
| See a user's past or joined trips | **No** | Only through a recorded release |
| Promote or demote admins | **No** | Yes |
| Release records for a data request | **No** | Yes |
| Can be banned or demoted by an admin | Yes | **No** |
| Read trip chats | No | Only inside a release whose warrant names chat content |

## 4. Data model

- `User.isSuperAdmin Boolean @default(false)`, re-read by `authenticate` on every request together with `isAdmin`, so `req.user = { id, isAdmin, isSuperAdmin }`.
- New enum `DataRequestBasis`: `WARRANT` (a Warrant to Disclose Computer Data under A.M. No. 17-11-03-SC), `COURT_ORDER`, `SUBPOENA`, `EMERGENCY`.
- New model `DataRequest` (one row per request; holds **no** exported data):

| Field | Notes |
|---|---|
| `id`, `createdAt` | |
| `createdById` | The superadmin |
| `subjectUserId` | The person the request is about |
| `agency` | e.g. "PNP Lucena City Police Station" |
| `officerName`, `officerContact` | Rank, name, unit; phone or email |
| `referenceNumber` | Case, blotter or docket number |
| `legalBasis` | `DataRequestBasis` |
| `fromDate`, `toDate` | The date range named in the request. Ignored for `EMERGENCY` |
| `includeChats`, `includeSupport` | Only allowed when the basis is `WARRANT` or `COURT_ORDER` and the document names that content |
| `verificationNote` | How the request was checked, e.g. "called PNP Lucena on the station's listed number" (required) |
| `paperworkDueAt` | `EMERGENCY` only: 72 hours after the release |
| `paperworkReceivedAt` | Set when the DPO marks the written request as received |

- `AdminActionType` gets `DATA_RELEASED`, `DATA_RELEASE_VIEWED`, `DATA_PAPERWORK_RECEIVED` and `SUPERADMIN_SET`.

## 5. What a release contains

**Normal release** (warrant, court order or subpoena), for the subject's trips within the date range, as host or as a passenger who requested, was approved or completed:

- the subject: name, university ID, role (student, faculty, staff)
- each trip: date and time, origin, destination, meeting point, status (open, completed, cancelled), the subject's role (driver or passenger), and the subject's request status
- the driver and the approved co-riders on that trip, **by name only**
- the car: make, model, colour, plate
- trip chat messages (sender name, time, text), only if `includeChats`
- the subject's support requests and replies, only if `includeSupport`

**Emergency release** (risk to life, for example a missing person). The minimum, as in policy section 4:

- the subject's most recent trip that started at or before now, and any trip of theirs starting within the next 24 hours
- for each: date and time, origin area, destination, the driver and approved co-riders by name, and the car with its plate
- no chats or support requests, whatever the flags say

**Never included:** passwords, sign-in codes, email addresses (other than the subject's own, which isn't needed and is also left out), security logs, IP addresses, other riders' history, and ratings.

The release page is printable (a "Print or save as PDF" button). It carries a header with the agency, reference number, legal basis, who released it and when, and a "Confidential: released under RA 10173" footer.

**Deleted accounts.** A deleted account's name, addresses and chats are already erased. The release shows what remains and says so plainly.

## 6. API (all under `/api/admin/data-requests`, superadmin only, 403 `SUPERADMIN_ONLY` otherwise)

| Method and path | Purpose |
|---|---|
| `GET /` | List requests, newest first, with an `overdue` flag for emergency paperwork past due |
| `POST /` | Create a request and release: body has the fields above plus `password`. Re-checks the password (401 `INVALID_PASSWORD`, rate-limited). Validates, then writes `DataRequest` and `DATA_RELEASED` in one transaction. Returns `{ request, release }` |
| `GET /:id` | Open an earlier release (regenerated) and write `DATA_RELEASE_VIEWED` |
| `PATCH /:id/paperwork` | Mark the written request received (`DATA_PAPERWORK_RECEIVED`) |

Validation errors (400 `INVALID_DATA_REQUEST` with `field`): missing agency, officer, reference number or verification note; unknown basis; a range longer than one year or ending before it starts; `includeChats` or `includeSupport` without a warrant or court order. `CANNOT_TARGET_SELF` when the subject is the superadmin. 404 `USER_NOT_FOUND`.

Changes to existing endpoints:

- `POST /api/admin/users/:id/promote` and `/demote`: superadmin only (403 `SUPERADMIN_ONLY`).
- Ban, demote: 409 `TARGET_IS_SUPERADMIN`.
- `GET /api/admin/users/:id`: `hostedTrips` becomes open and full trips only; `joinedMatches` is removed; adds `isSuperAdmin`.
- `GET /api/admin/actions`: for non-superadmins, the three data-request action types come without `targetUserId`, `targetUserName` and subject details.
- `GET /api/admin/overview`: adds `overdueDataPaperwork` (superadmin only).
- `DELETE /api/users/me`: 409 `LAST_SUPERADMIN` for the superadmin.

## 7. User experience

- **Admin console navigation:** a "Data requests" item, visible only to the superadmin.
- **Data requests page:** the list (date, agency, reference, basis, and an "Emergency paperwork due" badge), plus a "New request" button.
- **New request form:**
  - pick the person (by the existing user search)
  - agency, officer and contact, reference number, legal basis
  - date range (hidden for an emergency)
  - two checkboxes, enabled only for a warrant or court order: "The document names trip chat messages" and "… support requests"
  - how the request was verified
  - password
  - the button reads "Release records". Above it: "This is recorded permanently in the audit log."
- **Release page:** the printable summary from section 5. For an emergency release, a reminder that the written request is due by the `paperworkDueAt` time, and a "Written request received" button.
- **Admin user page:** shows "Superadmin" or "Admin" badges. Promote and demote buttons are shown only to the superadmin. Past and joined trip lists are removed (D8), with a note: "Trip history is released only through a data request."
- **Dashboard:** the superadmin's overview shows overdue emergency paperwork.

## 8. Scenarios

| # | Situation | Expected |
|---|---|---|
| A1 | An admin tries to promote or demote someone | 403 `SUPERADMIN_ONLY`; buttons hidden |
| A2 | An admin tries to ban or demote the superadmin | 409 `TARGET_IS_SUPERADMIN` |
| A3 | An admin opens a user's page | Sees open hosted trips only; no past or joined trips |
| A4 | An admin calls any data-request endpoint | 403 `SUPERADMIN_ONLY` |
| A5 | An admin reads the activity log | Sees "released records for data request (PNP Lucena, ref …, warrant)" without the person's name |
| S1 | Superadmin releases under a warrant for a date range | Summary has exactly the trips in that range, co-riders by name, car and plate; no chats unless asked; `DATA_RELEASED` written in the same transaction |
| S2 | Superadmin ticks "chat messages" with a subpoena | 400 `INVALID_DATA_REQUEST` (`includeChats`) |
| S3 | Superadmin enters a wrong password | 401 `INVALID_PASSWORD`; nothing written; repeated failures hit the sign-in rate limit |
| S4 | Emergency for a missing student | Most recent trip plus any in the next 24 hours, minimum fields; due date set 72 hours ahead |
| S5 | Emergency paperwork not marked received after 72 hours | Shown as overdue in the list and on the overview |
| S6 | Superadmin reopens an earlier release | Regenerated; `DATA_RELEASE_VIEWED` written |
| S7 | Superadmin requests their own records | 400 `CANNOT_TARGET_SELF` |
| S8 | Request about a deleted account | Release shows what remains and states the account was deleted |
| S9 | A co-rider appears in a release | Name only; none of their other trips, email or university ID |
| S10 | Range longer than one year, or reversed | 400 `INVALID_DATA_REQUEST` (`toDate`) |
| H1 | `make-superadmin` with no superadmin yet | Sets `isAdmin` and `isSuperAdmin`, writes `SUPERADMIN_SET` |
| H2 | `make-superadmin` when one exists | Refuses unless `--replace`, which removes superadmin from the old one (they stay an admin) |
| H3 | The superadmin tries to delete their account | 409 `LAST_SUPERADMIN` |
| H4 | Nobody is superadmin yet | Admins still work normally; promote and demote are unavailable until one is set |

## 9. Changes by area

| Area | Change |
|---|---|
| Schema | `isSuperAdmin`, `DataRequest`, `DataRequestBasis`, four action types |
| Server | `requireSuperAdmin` middleware; `authenticate` reads `isSuperAdmin`; `dataRequestService` (validation and building the release); data-request controller and routes; promote, demote and ban guards; admin user detail trimmed; activity log redaction; overview count; account deletion guard; `make-superadmin` script |
| Frontend | Data requests list, form and printable release page; admin nav item; user page badges and trimmed trip lists; activity log wording; overview card |
| Seeds | Demo: Liza becomes the superadmin, Carlo becomes a regular admin. Postman: the admin account becomes superadmin, plus a new regular admin to check the 403s |
| Tests | Jest for every scenario; web tests for labels and release formatting; Postman folder "16. Data requests" |
| Docs | Policy sections 2 and 9 (the tool now exists), AGENTS.md, OWASP review (A01 least privilege, A09 release logging), manuscript admin section |

## 10. Risks

| Risk | Mitigation |
|---|---|
| A fake warrant | The app records the reference and how it was verified; verifying the document stays with the DPO, outside the app |
| A stolen superadmin session | Password re-check and rate limit on every release; every release logged permanently |
| The superadmin leaves the school | Handover with `make-superadmin --replace` |
| The trimmed admin user page hides context admins used | Report cards already show the trip involved in each report; open trips remain for cancelling |
