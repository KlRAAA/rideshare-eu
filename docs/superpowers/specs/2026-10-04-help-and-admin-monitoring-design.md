# Help, support inbox and admin monitoring

**Date:** 2026-10-04
**Status:** Draft for review
**Builds on:** the admin role (`2026-09-30-admin-role-design.md`) and the security event log

## 1. Why

- Users can only report another rider about a specific trip. They have no way to reach an admin about a broken screen, a sign-in problem, a fuel-share disagreement or a safety worry that isn't tied to one rider.
- The app has no emergency guidance. Nothing tells a user in danger to call 911 instead of waiting for an admin.
- The admin overview shows totals, but not what needs attention: how long reports have waited, who keeps cancelling, whether someone is guessing passwords, or how to reach every user at once (for example when classes are suspended).

## 2. Goals and non-goals

**Goals**
1. A **Help page** with emergency guidance first, then a **Contact admin** form.
2. A **Support inbox** for admins: categories, replies inside the app, open/answered/closed, safety tickets first.
3. **Monitoring** on the admin overview: queues with waiting times, today's activity, patterns worth a look, security spikes, a link to error reports.
4. **Announcements** to all users.

**Non-goals**
- Live tracking of users. Admins see counts and reports, never anyone's current location.
- Reading trip chats. Admins still cannot.
- The law-enforcement data request workflow. It's written up as a policy document, and the DPO-only export is future work.
- Email delivery of support replies. In-app notifications only.

## 3. Decisions (flag any you disagree with)

| # | Decision | Reason |
|---|---|---|
| H1 | The Help page is public (`/help`). The contact form needs sign-in. | Emergency guidance must work even for someone who can't sign in. Tickets need a verified account to stop spam. |
| H2 | Emergency block: **911** (national emergency hotline) and "nearest police station". A campus security number appears only if one is configured (`NEXT_PUBLIC_CAMPUS_SECURITY_PHONE`). | The team doesn't have the official campus number. A wrong number in an emergency is worse than none. |
| H3 | Ticket categories: Problem with the app, Account or sign-in, Safety concern, Fuel share, Other. | Covers the cases above. "Safety concern" sorts first in the inbox. |
| H4 | A ticket may link one of the user's own trips (as host or rider). | Gives admins context without searching. Another user's trip can't be attached. |
| H5 | At most **5 open tickets per user**, and at most **10 new tickets per day**. Text up to 2,000 characters. | Stops flooding the inbox. |
| H6 | Admin replies notify the user (new notification type `SUPPORT_REPLY`). A user reply reopens an answered ticket. Either side can close it. | Normal help-desk flow. |
| H7 | Every admin reply and close is written to the audit log (`SUPPORT_REPLIED`, `SUPPORT_CLOSED`). | Same accountability as other admin actions. |
| H8 | Deleting an account deletes that user's tickets and messages. | Support text often contains personal details and isn't needed for anyone else's records. |
| M1 | Security events are also **stored** (`SecurityEvent` table): event, reason, user id when known, route, time. **No IP, no email.** Kept 30 days. | Admins need counts and spikes. The stderr log stays for full incident detail, and the database copy holds as little personal data as possible. |
| M2 | Pattern thresholds (last 30 days): at least 3 passenger cancellations; at least 2 trips cancelled after riders were approved; at least 2 reports received; at least 5 failed sign-ins on one account in 24 hours. Kept as constants. | Starting points the adviser can tune. They only flag a user for a look and never act automatically. |
| M3 | Announcements show as a dismissible banner on the dashboard and appear in everyone's notifications list. They can have an end date. | Reaches people who open the app without a notification for every user. |
| M4 | The Sentry link comes from an environment variable (`ADMIN_ERRORS_URL`). If it isn't set, it's hidden. | Avoids putting a team account URL in the code. |

## 4. Data model

```prisma
enum SupportCategory { APP_PROBLEM ACCOUNT SAFETY FUEL_SHARE OTHER }
enum SupportStatus   { OPEN ANSWERED CLOSED }

model SupportTicket {
  id            String          @id @default(cuid())
  userId        String
  user          User            @relation(fields: [userId], references: [id])
  category      SupportCategory
  subject       String          // up to 120 characters
  relatedTripId String?
  status        SupportStatus   @default(OPEN)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  closedAt      DateTime?
  messages      SupportMessage[]
  @@index([status, category, createdAt])
  @@index([userId, status])
}

model SupportMessage {
  id        String        @id @default(cuid())
  ticketId  String
  ticket    SupportTicket @relation(fields: [ticketId], references: [id])
  authorId  String
  author    User          @relation(fields: [authorId], references: [id])
  fromAdmin Boolean
  body      String        // up to 2,000 characters
  createdAt DateTime      @default(now())
  @@index([ticketId, createdAt])
}

model Announcement {
  id          String    @id @default(cuid())
  title       String    // up to 100
  body        String    // up to 1,000
  createdById String
  createdBy   User      @relation(fields: [createdById], references: [id])
  createdAt   DateTime  @default(now())
  endsAt      DateTime?
  @@index([createdAt])
}

model SecurityEvent {
  id        String   @id @default(cuid())
  event     String   // LOGIN_FAILED, OTP_FAILED, OTP_LOCKED, RATE_LIMITED, PASSWORD_RECHECK_FAILED, ACCESS_DENIED
  reason    String?
  userId    String?  // no relation: the account may not exist (unknown email)
  route     String
  createdAt DateTime @default(now())
  @@index([createdAt])
  @@index([event, createdAt])
}
```

Enum additions: `NotificationType` gets `SUPPORT_REPLY` and `ANNOUNCEMENT`. `AdminActionType` gets `SUPPORT_REPLIED`, `SUPPORT_CLOSED` and `ANNOUNCEMENT_POSTED`.

**Announcement notifications:** one `ANNOUNCEMENT` notification per active user, created in batches in the same request. That's fine at campus scale (thousands of rows), and the notification list and unread badge already work this way.

**Security event writes:** `securityLog.js` gets a second sink that inserts the row. It is fire-and-forget, so a database error never changes the HTTP response. Rows older than 30 days are deleted by a new daily schedule in the existing `node-cron` setup in `server.js` (which today runs the 5-minute reminder job).

## 5. API

**Users (signed in)**

| Method and path | Purpose |
|---|---|
| `POST /api/support` | Create a ticket: `{ category, subject, body, relatedTripId? }`. Errors: 400 `INVALID_TICKET` (field), 403 `TRIP_NOT_YOURS`, 429 `TOO_MANY_TICKETS` (H5). |
| `GET /api/support` | My tickets, newest first. |
| `GET /api/support/:id` | One of my tickets with its messages (404 if it isn't mine). |
| `POST /api/support/:id/messages` | Reply. This reopens an answered ticket (409 if closed). |
| `PATCH /api/support/:id/close` | Close my ticket. |
| `GET /api/announcements/active` | Announcements that haven't ended. |

**Admins (`/api/admin/*`)**

| Method and path | Purpose |
|---|---|
| `GET /support?status=OPEN` | Inbox, ordered safety first, then oldest first. |
| `GET /support/:id` | Ticket with messages, the user's name and the linked trip summary. |
| `POST /support/:id/messages` | Reply: sets status ANSWERED, notifies the user, writes the audit log. |
| `PATCH /support/:id/close` | Close and write the audit log. |
| `GET /announcements`, `POST /announcements`, `PATCH /announcements/:id/end` | List, post (notifies everyone, audit log), end early. |
| `GET /overview` | Extended (section 6). |
| `GET /watchlist` | Users flagged by the pattern rules (M2), with the reason for each. |

## 6. Admin console

**Overview (extended)**

| Card | Contents |
|---|---|
| Needs attention | Open reports: count and oldest waiting ("3 open, oldest 2 days"). Open support tickets: count, safety tickets, oldest waiting. Each links to its queue. |
| Today | Rides departing today, new sign-ups in the last 24 hours, active bans. |
| Security (24 h) | Failed sign-ins, code lockouts, rate-limit hits, denied-access attempts. Accounts with 5 or more failed sign-ins (M2) link to their admin user page. |
| Watch list | How many users are flagged. Links to the Watch list page. |
| System | "Open error reports" link (M4). |
| Recent admin activity | Unchanged. |

**New tabs:** Support (inbox and ticket view), Announcements, Watch list.

**Watch list page:** each flagged user is shown with plain reasons, e.g. "4 passenger cancellations in 30 days", "2 reports received". It links to their admin user page, where existing actions (ban, review reports) apply. Nothing is automatic.

**User detail page:** adds that user's support tickets and recent security events (counts, not raw log lines).

## 7. User side

**Help page (`/help`)**
1. **In an emergency:** "If you or someone else is in danger, call **911** now or go to the nearest police station. RideShareEU admins can't respond to emergencies." (plus the campus number when configured, H2).
2. **Report a rider:** explains the existing Report button on trips and profiles.
3. **Contact admin:** the form (category, subject, message, optional trip from a list of your own trips). After sending: "Sent. You'll get a notification when an admin replies."
4. **My requests:** your tickets with their status. Opening one shows the conversation, a reply box and Close.

**Entry points:**
- a "Help and support" card on the Profile page, and "Help" in the desktop top navigation
- a link in the footer of the login and register pages (public part only)
- "Contact admin" on the suspended-account screen, next to the existing appeal email

**Announcements:** a banner at the top of the dashboard showing the newest active announcement. Users can dismiss it, which is remembered in their browser. Each announcement also appears in the notifications list.

## 8. Scenarios (each becomes a test)

| # | Situation | Expected |
|---|---|---|
| T1 | Signed-out visitor opens `/help` | Sees emergency guidance and how to report; the contact form asks them to sign in |
| T2 | User sends a ticket with a valid category and text | 201, status OPEN; it appears in the admin inbox |
| T3 | User attaches someone else's trip | 403 `TRIP_NOT_YOURS`, nothing created |
| T4 | User already has 5 open tickets | 429 `TOO_MANY_TICKETS` |
| T5 | Safety ticket and older app-problem ticket both open | Safety ticket is listed first |
| T6 | Admin replies | Status ANSWERED, user notified, audit log row written |
| T7 | User replies to an answered ticket | Status back to OPEN |
| T8 | User replies to a closed ticket | 409 |
| T9 | User opens another user's ticket | 404 |
| T10 | Non-admin calls an admin support route | 403 `ADMIN_ONLY` (and an ACCESS_DENIED security event) |
| T11 | Account deleted | That user's tickets and messages are gone |
| T12 | Admin posts an announcement | Every active user has an ANNOUNCEMENT notification; banner shows; audit log row written |
| T13 | Announcement past its end date | Not returned by `/active`; banner gone |
| T14 | Five wrong passwords on one account | Shown under Security on the overview and on that user's admin page |
| T15 | Security event write fails (database down) | The sign-in response is unchanged |
| T16 | Security events older than 30 days | Deleted by the daily cleanup |
| T17 | Passenger cancels 3 approved rides in 30 days | Appears on the Watch list with that reason |
| T18 | Host's trip is cancelled by an admin | Doesn't count against the host (M2 counts host cancellations only) |
| T19 | Overview "oldest waiting" | Matches the oldest open report or ticket |
| T20 | Error-reports link with no `ADMIN_ERRORS_URL` | Hidden |

## 9. Testing and docs

- **Jest:** one integration test per scenario above, plus unit tests for the watch-list rules and ticket validation.
- **Postman:** a "14. Help and support" folder (create, list, reply, close, rate limit, admin inbox and reply, announcement).
- **Browser:** check the Help page, a ticket round trip, the inbox, an announcement and the extended overview with the demo accounts. The demo seed gets one ticket and one announcement.
- **Docs:**
  - AGENTS.md section.
  - The test plan gains feature **F-16 Help and support** and **F-17 Admin monitoring**.
  - The manuscript describes the support and monitoring features.
  - A new `docs/policy/law-enforcement-data-requests.md` (the DPO process: written request, legal basis, emergency path, minimum data, logging, retention), as agreed.

## 10. Build order

1. Schema and security event storage (with the 30-day cleanup).
2. Support API (user and admin) with tests.
3. Help page, contact form, My requests, entry points.
4. Admin Support tab.
5. Announcements (API, admin tab, banner, notifications).
6. Overview monitoring and the Watch list.
7. Postman, demo seed, docs and policy, then full regression and a browser walkthrough.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Users treat Help as an emergency line | The emergency block comes first and states that admins can't respond to emergencies |
| Inbox floods | Per-user limits (H5); safety first in the queue |
| Watch list is unfair or misread | Flags only, with plain reasons; thresholds are constants for the adviser to tune; no automatic action |
| Security event table grows | 30-day cleanup; only counts are shown |
| Scope next to the Women+ work | Separate branch; each build step ships on its own |
