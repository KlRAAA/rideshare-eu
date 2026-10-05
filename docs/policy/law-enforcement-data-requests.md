# Law enforcement and data request policy

**Status:** Draft for the research adviser and the MSEUF Data Protection Officer.
This is not legal advice. Confirm it with the MSEUF Data Protection Officer or legal office before RideShareEU is used outside the pilot.

## 1. Scope

This policy covers requests from the Philippine National Police (PNP), the NBI or another public authority for information about a RideShareEU user. A typical case is a missing person, where police ask for that person's trips and who was with them when they were last seen.

## 2. Who handles requests

- Requests are handled only by the **MSEUF Data Protection Officer (DPO)**, or a person the DPO names in writing.
- Regular RideShareEU admins **do not** release user data to anyone. An admin who receives a request forwards it to the DPO and records that in a support request or email.
- The DPO holds the app's single **superadmin** account (set from the server with `npm run make-superadmin`, never in the app). Records are released only through **Admin console → Data requests**, which records the request, re-checks the DPO's password, builds the summary described in section 6, and writes a permanent audit entry. Regular admins can't open a user's trip history at all; they see only open trips, so they can cancel one.

## 3. What a request must include

A request is in writing (letter or official email) and states:

1. The requesting officer's name, rank, unit and contact details.
2. The case, blotter or docket number.
3. The person concerned and the date range needed.
4. The legal basis. For computer data this is normally a **Warrant to Disclose Computer Data (WDCD)** issued under the Supreme Court's Rule on Cybercrime Warrants (A.M. No. 17-11-03-SC), which asks the holder of the data to respond within 72 hours. Another court order or a subpoena may also apply.

The DPO verifies the request (for example, by calling the unit on a number found independently) before releasing anything.

## 4. Emergency path

When there is a credible, immediate risk to someone's life or safety (for example, a missing student last seen on a RideShareEU trip), the DPO may release the **minimum** needed to protect that person at once:

- the person's most recent planned trip (origin area, destination, date and time),
- who was scheduled on it (driver and approved co-riders, by name),
- the car (make, model, colour, plate).

The written request and the court document follow afterwards. The emergency release is recorded the same way as any other (section 7). This follows the Data Privacy Act's allowance for processing that is needed to protect the life and health of a person who can't consent.

## 5. What RideShareEU holds, and what it doesn't

| Data | Held? | Notes |
|---|---|---|
| Planned trips (origin, destination, date, time, recurrence) | Yes | Addresses are encrypted at rest |
| Who requested and who was approved on each trip | Yes | Match records |
| Car and plate | Yes | |
| Whether a trip was marked completed | Yes | Marked completed by the host or automatically after the expected arrival time |
| **Where the person actually went (GPS trail)** | **No** | Live location is optional, and only the latest position is kept, overwritten each time |
| Trip chat messages | Yes | Private. Released only under a warrant that names chat content |
| Support requests to the admins | Yes | Released only under a warrant that names them |
| Data of a deleted account | No | Deleted accounts are anonymized: name, email, locations and chats are erased |

## 6. Minimum necessary

Following the Data Privacy Act (RA 10173):

- Release only the person and the date range named in the request.
- Name co-riders only where they are needed (for example, who was on the last trip), not their whole history.
- Prefer a summary (a table of trips) over raw database exports.
- Don't release passwords, sign-in codes or security logs. They aren't needed and could put accounts at risk.

## 7. Record keeping

The app records automatically, for every release: the agency, officer, reference number, legal basis, date range, whether chats or support requests were included, how the request was verified, who released it and when, and every later reopening. Other admins see in the activity log that a release happened, but not who it was about. For an emergency release the app shows the 72-hour paperwork deadline and flags it when overdue.

The DPO still keeps:

- the written request and the court document,
- how the release was handed over (for example, printed and signed for),
- whether the user was later informed, and why or why not.

Records are kept for as long as the university's records policy requires.

## 8. Retention

How long trip records are kept decides what can be released later, so it must be set before launch.

**Recommendation:** keep trip and match records for **one year** after the trip date, then anonymize them (remove addresses and link them to "Deleted user"). **To be decided by the thesis team and the adviser.**

## 9. Future work

- A short note in the Privacy Policy telling users that data may be disclosed to authorities when the law requires it.
