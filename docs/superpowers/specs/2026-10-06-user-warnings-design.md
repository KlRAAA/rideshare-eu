# Official warnings

**Date:** 2026-10-06
**Status:** Approved by the user ("build it")

## 1. Why

An admin can reply to whoever contacted support, review or dismiss a report, or ban someone. There's no step in
between: a driver who smoked in the car or drove too fast gets nothing, and never hears about it. The demo data even
says "we have reminded the driver" when nothing in the app can do that. A formal warning is the usual step before a
suspension.

## 2. Decisions

| # | Decision |
|---|---|
| W1 | Admins can warn from three places: a user's admin page, a support request linked to a trip ("Warn the driver"), and report review ("Send a warning", instead of a ban). |
| W2 | Reasons: `SMOKING`, `UNSAFE_DRIVING`, `LATE_OR_NO_SHOW`, `DISRESPECTFUL`, `OTHER`. Each has a standard sentence; an optional admin note (≤ 500 chars) is added. `OTHER` requires the note. |
| W3 | The warned user gets a notification (`WARNING`), an email, and a dashboard banner that stays until they tap "I understand" (`acknowledgedAt` is recorded). |
| W4 | The reporter is never named or quoted in anything the warned user sees. |
| W5 | Warnings never ban automatically. Two or more warnings in 30 days put the user on the watch list. |
| W6 | Every warning is an `AdminAction` (`WARNING_ISSUED`), in the same transaction. |
| W7 | No warning yourself (`CANNOT_TARGET_SELF`). A report review can warn or ban, not both (`WARN_OR_BAN`). A warning from a ticket must target that trip's driver, and one from a report must target the reported user (`WARNING_TARGET_MISMATCH`). |
| W8 | Warnings stay on record after account deletion, like reports (the user row is anonymized, not removed). |

## 3. Data model

`UserWarning`: `id`, `userId`, `issuedById`, `reason` (`WarningReason`), `note?`, `reportId?`, `ticketId?`,
`tripId?`, `createdAt`, `acknowledgedAt?`. Ids are plain strings, like `AdminAction`'s targets. Index
`(userId, createdAt)`. Enums gain `NotificationType.WARNING` and `AdminActionType.WARNING_ISSUED`.

## 4. API

| Method and path | Who | Purpose |
|---|---|---|
| `POST /api/admin/users/:id/warnings` | admin | `{ reason, note?, ticketId?, reportId? }` → 201 `{ warning }` |
| `PATCH /api/admin/reports/:id` | admin | also accepts `warn: { reason, note? }` with `status: 'REVIEWED'` |
| `GET /api/warnings/active` | user | your unacknowledged warnings (for the banner) |
| `PATCH /api/warnings/:id/acknowledge` | owner | 403 `NOT_AUTHORIZED` for others, 404 if missing |

`GET /api/admin/users/:id` adds `warnings` (newest first, with the issuer's name). `GET /api/admin/support/:id` adds
the related trip's `hostId` and `hostName`. The watch list adds "N warnings".

Errors: 400 `INVALID_REASON`, `NOTE_REQUIRED`, `NOTE_TOO_LONG`, `CANNOT_TARGET_SELF`, `WARN_OR_BAN`,
`WARNING_TARGET_MISMATCH`; 404 `USER_NOT_FOUND`.

## 5. Scenarios

| # | Situation | Expected |
|---|---|---|
| W-1 | Admin warns a user for smoking | 201; notification + email + audit; banner shows for that user |
| W-2 | User taps "I understand" | `acknowledgedAt` set; banner gone; others can't acknowledge it |
| W-3 | `OTHER` without a note | 400 `NOTE_REQUIRED` |
| W-4 | Admin warns themselves | 400 `CANNOT_TARGET_SELF` |
| W-5 | Warn the driver from Bea's safety ticket | Target must be that trip's host |
| W-6 | Review a report with a warning | Report REVIEWED and warning issued together; warn + ban → 400 |
| W-7 | Two warnings in 30 days | On the watch list as "2 warnings" |
| W-8 | Warned user's notification and email | Mention the reason, never the reporter |
| W-9 | Admin user page | Shows the warning history with acknowledged / not yet |
