# Rota PRD v2

## 1. Product summary

Rota is a mobile app (iOS and Android) that lets small shift-based businesses build, publish, and change work schedules. Owners create a team and invite staff, and owners and managers create and publish shifts. Staff see their shifts, request swaps, claim open shifts, request time off, and get notified of changes. Businesses pay a monthly fee per active team member other than the owner (seat). The launch market is Nigeria, billed in NGN. \[ASSUMPTION\]

## 2. Problem statement

Small teams run schedules in chat groups, paper, or spreadsheets. \[ASSUMPTION: this is the typical starting point in the launch market and is not verified by research. Validate in pilot interviews. Paid build work does not start until the validation gates in Section 13 pass.\] The pain differs by role.

| Role | Pain today | What Rota changes |
| --- | --- | --- |
| Owner | Time spent building schedules. No single record of who worked when. Billing for a tool must scale with team size. | One schedule per week. A change log. Cost grows only when headcount grows. |
| Manager | Swap and time-off requests arrive by message and get lost. Last-minute changes are hard to confirm. No warning when two shifts clash. | Swap and claim approvals in one queue. Conflict warnings before publish. Acknowledgement tracking on every change. |
| Staff | Unsure if the latest schedule is the right one. Swaps depend on a manager reading a message. Availability is not recorded anywhere. | One source of truth. Push alerts on changes. A swap flow with clear status. Availability saved once. |

### Alternatives

The prices and availability of the global tools in Nigeria are not checked. Check them in the owner interviews. \[ASSUMPTION\]

| Alternative | What it does today | Price in Nigeria | Why a team would switch |
| --- | --- | --- | --- |
| Chat groups (for example WhatsApp) | The schedule is posted as text or an image. Changes are sent by message. | Free | To be tested in interviews. Rota adds one source of truth, acknowledgement tracking, and a swap flow. |
| Spreadsheets | A grid shared by link or file. | Free or low | To be tested in interviews. Rota adds notifications, swaps, and conflict warnings. |
| Global scheduling tools (Deputy, When I Work, Sling, 7shifts, Homebase) | Full scheduling apps. | To be checked | To be tested in interviews. Possible reasons: local pricing in NGN, local payment methods, simpler setup. |

## 3. Goals and non-goals

### Goals

Targets are estimates for planning. \[ASSUMPTION\]

| ID | Goal | Target | Window |
| --- | --- | --- | --- |
| G1 | A manager publishes a full week for a 12-person team quickly | Median under 30 minutes of active editing time from first draft shift to publish. Under 10 minutes when using Copy Week. Baseline: each pilot manager's current time, recorded in the pilot interview. | By month 3 after MVP launch |
| G2 | Staff see and confirm schedule changes | 85% of changes that require acknowledgement are acknowledged within 24 hours | Rolling 30 days |
| G3 | Swaps get resolved | Median time to a manager decision under 12 hours. 85% of swaps end in a manager decision (APPROVED or REJECTED), not EXPIRED. | Rolling 30 days |
| G4 | Notifications reach people | 99% of notifications handed to the push service or sent by email within 1 minute of the event. For push failures found through receipts, email fallback is sent within 20 minutes. | Rolling 30 days |
| G5 | The product earns revenue | 20% of trials convert to paid within 7 days after trial end | Rolling 90 days |
| G6 | The app is stable | 99.5% crash-free sessions | Rolling 30 days |
| G7 | Shifts get covered | 80% of published open shifts are filled before they start. Fewer than 2% of shifts are flagged uncovered by a manager. | Rolling 30 days |

### Non-goals

- Payroll, wage calculation, or pay export.
- Time clock, clock-in, or attendance tracking.
- In-app chat or messaging.
- POS or accounting integrations.
- Web admin dashboard (MVP). A minimal billing web page, served as server-rendered pages from the Express API, is in scope. See FR-050.
- Enforcing labor laws. The app shows warnings only. \[ASSUMPTION\]
- In-app purchase billing.
- Billing in currencies other than NGN (MVP).
- Multiple locations per team (Phase 2).
- Languages other than English.

## 4. User personas

Names and businesses below are fictional examples.

The Owner pays, and the Manager does the daily work. A Manager who finds the app slow will stop using it, and the Owner will then cancel. Adoption depends on the Manager. \[ASSUMPTION\]

### Example business: "Lekki Grill", a 12-person restaurant in Lagos

| Member | Role | Positions | Seat? |
| --- | --- | --- | --- |
| Adaeze | Owner | none (does not work shifts) | No (owner is free) |
| Emeka | Manager | Server | Yes |
| 3 cooks | Staff | Cook | Yes (3) |
| 5 servers | Staff | Server | Yes (5) |
| 2 cashiers | Staff | Cashier | Yes (2) |

Seat count: 11. Time zone: Africa/Lagos. One location. About 70 shifts per week.

### Persona 1: Owner (Adaeze, 38)

- **Context:** Owns the restaurant. Checks her phone often, rarely sits at a computer. Pays business tools by card or bank transfer. Rota supports card only at launch.
- **Main job to be done:** Know the team is covered every week without doing the scheduling herself.
- **Top frustrations:** Paying for staff who left. Surprise gaps in coverage. Having no record when a dispute about hours arises.

### Persona 2: Manager (Emeka, 29)

- **Context:** Floor manager. Builds the weekly schedule on Sunday evening from his phone.
- **Main job to be done:** Publish a clean week fast, then handle changes without calls and messages.
- **Top frustrations:** Retyping last week's schedule. Staff who say they never saw a change. Two people booked at once.

### Persona 3: Staff (Chioma, 24)

- **Context:** Cashier. Mobile data is limited and signal drops on her commute. Also studies part time.
- **Main job to be done:** Know exactly when she works, and trade a shift when something comes up.
- **Top frustrations:** Finding out about a change late. Swaps that depend on one manager replying. Being scheduled when she told the manager she was unavailable.

## 5. Functional requirements

Role codes: O = Owner, M = Manager, S = Staff (any member with a Staff, Manager, or Owner membership unless noted). "Warning" means the action succeeds only after the manager confirms with an override. All overrides are written to the audit log.

### 5.1 Accounts, team, and invites

| ID | Role | Rule | Acceptance criteria |
| --- | --- | --- | --- |
| FR-001 | Anyone | Register with email, password (minimum 10 characters), and name. If the person joins through an email invite, entering the invite code verifies the email, and no second code is sent. If the person joins through a phone invite, they must add an email and verify it with a 6-digit code (valid 10 minutes) before accepting. \[ASSUMPTION\] | A user cannot create or join a business until email is verified. The 6th wrong code attempt invalidates the code. |
| FR-002 | Anyone | Log in with email and password. A login from a new device also requires an email code. \[ASSUMPTION\] | A device is known when a Device row exists for the user and the app's `deviceId`, with `trustedAt` set. A known device logs in with password only. An unknown `deviceId` is blocked until a valid code is entered, and the valid code sets `trustedAt`. Login and device-verification requests include `deviceId`. |
| FR-003 | Anyone | Reset a password with an email code. | After reset, all refresh tokens for the user are revoked. |
| FR-004 | Verified user | Create a business: name, type (restaurant, clinic, retail, other), location name, IANA time zone (default Africa/Lagos), country (default NG), and currency (NGN only in the MVP; the USD value stays in the schema for later). | One transaction creates the business, the location, the Owner membership, and a TRIALING subscription ending 14 days later. Currency cannot change after creation. |
| FR-005 | O, M | Create, rename, and archive positions (for example Cook, Server). Assign positions to members. | Position names are unique per business. A member can hold 1 or more positions. An archived position cannot be used on new shifts. |
| FR-006 | O, M | Invite a person by email or phone number with a role and positions. Managers can invite Staff only. Owners can invite Staff or Manager. The invite carries a link and a 6-digit code. It expires after 7 days. | Link and code are stored hashed. An invite needs an email or a phone number. Email invites send by email. Phone invites send by SMS. Email is the default channel. SMS is optional per invite. The invite screen always shows a copyable link. \[ASSUMPTION\] |
| FR-007 | Invitee | Accept an invite with the link and the code. If the invitee has no account, registration comes first. | The 5th wrong code attempt locks the invite. A valid acceptance creates an ACTIVE membership, records `activatedAt`, and opens a SeatPeriod. If the person was REMOVED earlier, the same membership row is reactivated and a new SeatPeriod opens. Position IDs on the invite are validated at acceptance, and archived positions are ignored. Pending invites are not seats. |
| FR-008 | O, M | Revoke an invite or resend it. | Resend issues a new link and code and voids the old ones. |
| FR-009 | O | Change a member between Staff and Manager. | Managers cannot change roles. The Owner role cannot be changed in the MVP. |
| FR-010 | O, M | Remove a member. Managers cannot remove Managers or the Owner. | On removal: membership becomes REMOVED and its open SeatPeriod is closed. Future published shifts of that member become open shifts. Their active swaps and claims become CANCELLED. Pending time-off requests become CANCELLED. Access ends on the next API request. |
| FR-011 | S | Leave a business. | Same effects as FR-010. The Owner cannot leave. Ownership transfer is handled by support in the MVP. \[ASSUMPTION\] |
| FR-012 | Any | Belong to more than one business and switch between them. | The app remembers the last business used. Every business API call includes the business ID. |

### 5.2 Shifts

| ID | Role | Rule | Acceptance criteria |
| --- | --- | --- | --- |
| FR-013 | O, M | Create a shift as DRAFT with date, start, end, break minutes, position, location, notes, and optional assignee. | End is after start. Duration is at most 24 hours. \[ASSUMPTION\] Break is shorter than the shift. Position is required. |
| FR-014 | O, M | Assign a shift only to a member who holds the shift's position. | Assigning a member without the position fails with a validation error. This is not overridable. |
| FR-015 | O, M | The app checks conflicts when a shift is assigned or edited and returns warnings. | Warning codes: OVERLAP (any overlap with the member's other shifts), REST_GAP (less than 8 hours between shifts \[ASSUMPTION\]), OVER_MAX_HOURS (weekly scheduled time above the member's preferred maximum, or above 48 hours if none is set \[ASSUMPTION\]), OUTSIDE_AVAILABILITY, ON_TIME_OFF (approved time off). The manager can confirm and proceed. A week runs Monday 00:00 to Sunday 24:00 in the location's time zone, and a shift that crosses midnight counts toward the day it starts. \[ASSUMPTION\] |
| FR-016 | O, M | View the schedule by day and by week for the location. | The week view loads within the targets in 7.9. Draft shifts are visibly marked. |
| FR-017 | S | View their own upcoming shifts, and the published team schedule. \[ASSUMPTION\] | Staff never see DRAFT shifts. |
| FR-018 | O, M | Publish selected drafts, or all drafts in a week. | Published shifts become visible to staff. Each affected member gets one summary notification for the batch, not one per shift. \[ASSUMPTION\] |
| FR-019 | O, M | Edit a published shift (time, position, assignee, notes) or cancel it. | Every edit increments `version` and creates a ShiftChange record. Changes to time, assignee, or cancellation require acknowledgement from the affected members. A notes-only change notifies without acknowledgement. An edit request must send the current `version` in an `If-Match` header. A stale version returns 409, and the app shows the latest shift. |
| FR-020 | O, M | Copy Week: copy all shifts from a source week to a target week as DRAFT. \[ASSUMPTION\] | Assignees carry over only if the member is ACTIVE, holds the position, and has no approved time off on that day. Otherwise the shift is created open. |
| FR-021 | O, M | Shifts that have ended cannot be edited, except that a manager can flag one as uncovered. | The API rejects edits to shifts with `endsAt` in the past, except setting `uncoveredAt` (one tap on a past shift). |
| FR-022 | S | Acknowledge a shift change by tapping Acknowledge. Acknowledgements made offline are queued and sent on reconnect. \[ASSUMPTION\] | An unacknowledged change after 12 hours triggers one reminder. After 24 hours the shift shows an "Unacknowledged" flag to managers. If the shift starts within 12 hours of the change, push and email are sent together, the reminder is sent after 1 hour, and the flag shows after 2 hours. \[ASSUMPTION\] |

#### Shift states

| From | Event | To | Notes |
| --- | --- | --- | --- |
| (none) | Create | DRAFT | Drafts can be deleted permanently. |
| DRAFT | Publish | PUBLISHED | Creates ShiftChange version 1. |
| PUBLISHED | Edit | PUBLISHED | `version` + 1. |
| PUBLISHED | Cancel | CANCELLED | Terminal. |

An open shift is a PUBLISHED shift with no assignee.

### 5.3 Swaps

| ID | Role | Rule | Acceptance criteria |
| --- | --- | --- | --- |
| FR-023 | S (assignee) | Request a swap for their own PUBLISHED shift that starts more than 2 hours from now. \[ASSUMPTION\] Scope is DIRECT (one named colleague who holds the shift's position) or POOL (any colleague who holds the position). | Only one active swap per shift. `expiresAt` is the earlier of 48 hours after creation and the shift start. When a colleague accepts, `expiresAt` resets to the earlier of 24 hours after acceptance and the shift start. \[ASSUMPTION: pending owner approval, because this changes confirmed assumption 9.\] |
| FR-024 | S | The named colleague accepts or declines a DIRECT swap. Any eligible colleague can accept a POOL swap. The first acceptance wins. | Acceptance, approval, and rejection each run as one conditional update that only succeeds from the expected status. If no row changes, return 409. A second acceptance gets a "Taken" response. The colleague sees an OVERLAP warning if they have a clashing shift. |
| FR-025 | O, M | Approve or reject a swap that a colleague has accepted. | The manager sees all conflict warnings for the new assignee. On approval, the assignee changes in one transaction, a ShiftChange is created, and the requester and the colleague are notified. Approve and reject use the same conditional update rule as FR-024. |
| FR-026 | S (requester) | Cancel a swap before a manager decides. | Status becomes CANCELLED. |
| FR-027 | System | Expire swaps. | A job runs every minute. Any non-terminal swap past `expiresAt` becomes EXPIRED and the requester is notified. |
| FR-028 | O, M | The approver must not be the requester or the accepting colleague. | If no other manager or owner exists, the Owner can approve their own swap. \[ASSUMPTION\] |
| FR-029 | System | If a manager edits the assignee or time of a shift, or cancels it, any active swap on that shift is cancelled. | The requester and any named colleague are notified with the reason. |

#### Swap states

| From | Event | To |
| --- | --- | --- |
| AWAITING_PEER | Colleague accepts (`expiresAt` resets, see FR-023) | AWAITING_MANAGER |
| AWAITING_PEER | Named colleague declines (DIRECT) | DECLINED |
| AWAITING_PEER, AWAITING_MANAGER | Requester cancels, or shift edited or cancelled | CANCELLED |
| AWAITING_PEER, AWAITING_MANAGER | Time passes `expiresAt` | EXPIRED |
| AWAITING_MANAGER | Manager approves | APPROVED |
| AWAITING_MANAGER | Manager rejects | REJECTED |

APPROVED, REJECTED, DECLINED, CANCELLED, and EXPIRED are terminal.

### 5.4 Open shifts

| ID | Role | Rule | Acceptance criteria |
| --- | --- | --- | --- |
| FR-030 | S | See open shifts that match one of their positions. | Members without the position do not see the shift. |
| FR-031 | S | Claim an open shift. Several members can claim the same shift. | One claim per member per shift. The claimer sees warnings. The status is PENDING. |
| FR-032 | O, M | Approve one claim. | The shift is assigned. All other claims become REJECTED and those members are notified. Approval uses the same conditional update rule as FR-024. |
| FR-033 | O, M | Assign an open shift directly at any time. | Pending claims become REJECTED. |
| FR-034 | System | Notify matching staff when an open shift is published. | One notification per member per publish batch. |

### 5.5 Time off

| ID | Role | Rule | Acceptance criteria |
| --- | --- | --- | --- |
| FR-035 | S | Request time off with a start date, an end date, and an optional note. Dates use the location's time zone. | Range is at most 60 days. \[ASSUMPTION\] Status is PENDING. |
| FR-036 | O, M | Approve or deny a request. Owner requests are approved automatically. Manager requests are approved by the Owner or another manager. \[ASSUMPTION\] | The requester is notified. Approved time off appears on the schedule. |
| FR-037 | O, M | Published shifts inside approved time off are flagged, not removed. | The flag shows on the shift. Creating a new clashing shift triggers ON_TIME_OFF. |
| FR-038 | S | Cancel a time-off request at any time before its end date. | If it was approved, managers are notified. |

### 5.6 Preferences

| ID | Role | Rule | Acceptance criteria |
| --- | --- | --- | --- |
| FR-039 | S | Set weekly availability as windows per day of week (ISO day 1 to 7, start and end minute). A member with no windows is treated as available at any time. \[ASSUMPTION\] | Windows on one day cannot overlap. Availability is advisory only. |
| FR-040 | S | Set a preferred maximum weekly hours value. | Used only for OVER_MAX_HOURS warnings. |
| FR-041 | O, M | See availability and preferred hours when assigning shifts. | Shown in the assign picker. Managers cannot edit another member's availability. |
| FR-042 | S | Turn the shift reminder on or off. Default is on. \[ASSUMPTION\] | Reminder is sent 2 hours before the shift. \[ASSUMPTION\] |

### 5.7 Notifications

| ID | Role | Rule | Acceptance criteria |
| --- | --- | --- | --- |
| FR-043 | System | Send these events. | See the event table below. |
| FR-044 | System | Deliver by push first. Fall back to email. | Email is sent immediately when the user has no active push token, when the push ticket returns an error, or when the push receipt reports a delivery failure (receipts are fetched every 5 minutes for tickets older than 15 minutes). If a shift starts within 6 hours of the event, push and email are sent together. An unacknowledged change also triggers email at 12 hours. |
| FR-045 | S | In-app inbox with unread count. | Shows the last 90 days. \[ASSUMPTION\] Marking read does not acknowledge a change. |

#### Notification events

| Event | Recipient | Acknowledgement required |
| --- | --- | --- |
| Schedule published | Members with shifts in the batch | No |
| Shift assigned to you | New assignee | Yes |
| Shift changed (time, position) | Assignee | Yes |
| Shift removed or cancelled | Previous assignee | Yes |
| Shift notes changed | Assignee | No |
| Open shift available | Members with the position | No |
| Swap offered to you | Named colleague (DIRECT) or eligible members (POOL) | No |
| Swap accepted, needs approval | Owner and managers | No |
| Swap approved, rejected, declined, cancelled, expired | Requester, and colleague where relevant | No |
| Claim approved or rejected | Claimer | No |
| Time off requested | Owner and managers | No |
| Time off approved or denied | Requester | No |
| Shift reminder (2 hours before) | Assignee | No |
| Acknowledgement reminder (12 hours) | Assignee | No |
| Trial ending (7 days, 2 days, and day of end) | Owner | No |
| Payment failed, grace ending, read-only | Owner | No |

Schedule published applies to the first publish of a shift. Shift assigned to you applies after publish: an approved swap, an approved claim, or a manager reassigning. Only the second requires acknowledgement.

### 5.8 Billing

| ID | Role | Rule | Acceptance criteria |
| --- | --- | --- | --- |
| FR-046 | System | A 14-day trial starts at business creation. No card needed. Full features. | Status TRIALING. `trialEndsAt` is creation time plus 14 days. |
| FR-047 | O | Subscribe through web checkout. | The app opens a browser link with a one-time token. The payment page is hosted by the payment provider. The app never handles card data. The first charge happens at checkout. The first paid period starts at trial end, so no trial days are lost. If the trial has already ended, it starts on the payment date. If the seat count at trial end is higher than at checkout, the difference is a PRORATION line on the first renewal invoice. If it is lower, there is no credit. \[ASSUMPTION\] |
| FR-048 | System | Bill monthly in advance. Seats billed = ACTIVE non-owner members at period start. | Managers count as seats. The owner does not. Seats are counted from SeatPeriod rows that are open at period start. Invoice lines show seat count, unit price, and total. |
| FR-049 | System | Prorate seats added mid-period. Removals take effect at the next period with no credit. \[ASSUMPTION\] | Proration = seat price x remaining days / days in period, rounded to the nearest minor unit. Charged as a PRORATION line on the next invoice. A member is billed once per billing period. If a SeatPeriod for the same member already overlaps the current period, reactivation in that period adds no second charge. |
| FR-050 | O | Manage billing on a minimal web billing page: payment method, invoices, cancel. | Reached only with a one-time link from the app. The page is server-rendered HTML served by the Express API, with three screens: summary and pay, invoices, and cancel. It is not a separate web app or a general admin dashboard. \[ASSUMPTION\] |
| FR-051 | System | Retry failed renewals. | Retries at day 0, 1, 3, and 5 after `Invoice.dueAt`. \[ASSUMPTION\] Status is PAST_DUE with full access for 7 days. After 7 days from `dueAt` the status becomes READ_ONLY. |
| FR-052 | System | Enforce read-only. | Write requests return HTTP 402 with code `SUBSCRIPTION_READ_ONLY`. Viewing schedules, acknowledging changes, and billing actions still work. |
| FR-053 | System | A trial that ends with no paid subscription becomes READ_ONLY immediately. The 7-day grace applies only to failed renewals. \[ASSUMPTION\] | Owner gets reminders at 7 days, 2 days, and day 0. |
| FR-054 | O | Cancel at period end. | Access continues until the period ends, then the status is CANCELLED and the business is read-only. The owner can resubscribe within the retention window. |

### 5.9 Data and privacy

| ID | Role | Rule | Acceptance criteria |
| --- | --- | --- | --- |
| FR-055 | O, or the removed member | Request anonymization of a removed member. | The membership display name becomes "Former member". Contact fields are cleared. Shift history stays. |
| FR-056 | Any | Delete their account. | The account is soft-deleted, then anonymized after 30 days. \[ASSUMPTION\] Blocked while the user is the Owner of a business that is not cancelled. |
| FR-057 | System | Delete data after 24 months. | A nightly job deletes shifts, swaps, claims, and time-off requests older than 24 months for all businesses. It deletes a business entirely when the business has had no activity for 24 months, or 24 months after cancellation. \[ASSUMPTION: confirm with legal advice.\] The purge runs one transaction per business and deletes in this order: acknowledgements, shift changes, claims, swaps, shifts, availability, time off, seat periods, notifications, audit logs, invites, memberships, then the business. It does not rely on database cascade order. |
| FR-058 | O | Delete the business. | The Owner types the business name to confirm. The business is soft-deleted, the subscription is cancelled, and the data is purged after 30 days using the FR-057 order. \[ASSUMPTION\] |

### 5.10 Edge cases

| Case | Rule |
| --- | --- |
| Removed staff | See FR-010. Future shifts become open. Past shifts keep the member for history. |
| Overlapping shifts | Warning OVERLAP. The manager can override. Peers see a warning when accepting a swap. |
| Expired swap | Status EXPIRED. The shift stays with the original assignee. |
| Edit after publish | Version increments. Active swaps on that shift are cancelled. Acknowledgement is required for time, assignee, and cancellation changes. |
| Time zone change | Only the Owner can change a location's time zone. The app asks whether to keep wall-clock times or keep exact instants. The default is to keep wall-clock times. All affected staff are notified. \[ASSUMPTION\] |
| Lapsed payment | See FR-051 to FR-053. |
| Same person in two businesses | Shifts from both businesses are not compared with each other. \[ASSUMPTION\] |
| Staff removed during an active claim | Claim becomes WITHDRAWN. |
| Member removed and re-added in the same billing period | The same membership row is reactivated and a new SeatPeriod opens. No second seat charge for that period (FR-049). |

## 6. AI processing pipeline

**MVP: Not in scope.** The MVP schedules by hand and by copying a week. Scheduling rules are simple enough that a deterministic check (FR-015) covers them without a model. \[ASSUMPTION: fallback, AI in Phase 2 only\]

**Phase 2: AI-assisted schedule drafting.** The pipeline is provider-agnostic. \[ASSUMPTION\]

| Stage | Detail |
| --- | --- |
| Trigger | A manager taps "Suggest draft" for an empty week. |
| Inputs | Shift slots to fill (from the manager's template or last week): position, start, end, headcount. For each member: positions, availability windows, approved time off, preferred weekly hours, and hours scheduled in the last 4 weeks for fairness. Hard rules: position match, no overlap, minimum rest gap. |
| Pre-processing | Replace names, emails, and phone numbers with aliases (m1, m2, and so on). Send no contact data. Cap input at about 8,000 tokens. |
| Generation | A `ScheduleDrafter` interface. A deterministic solver is the baseline. A language model may be added only if it beats the baseline on the evaluation set. Because the backend is Node, run the solver as a separate small service or use a JavaScript solver. Decide at Phase 2 start. \[ASSUMPTION\] Output schema: list of `{slotId, memberAlias}`, list of unfilled slots, list of warnings. |
| Validation | A deterministic validator checks every assignment against the hard rules and the availability data. Invalid assignments are dropped and the slot stays open. |
| Human review | The result is saved only as DRAFT shifts, labeled "Suggested". Nothing publishes without a manager action. |
| Failure handling | Timeout of 30 seconds. One retry. On failure the manager sees "Could not suggest a draft" and the week stays unchanged. |
| Cost control | Set per-business monthly caps after measuring cost per request in a pilot. A global kill switch. Cost per request is logged. |
| Privacy limits | No personal data leaves Rota. The provider contract must forbid training on submitted data. Stored per request: input and output hashes, token counts, latency, and cost. Do not store the full prompt. |
| Evaluation | A fixed test set of 20 real or realistic schedules. Release rule: 0 hard-rule violations after validation. Product metric: managers keep at least 70% of suggested shifts. \[ASSUMPTION\] |

## 7. Technical requirements

### 7.1 Architecture

| Layer | Choice |
| --- | --- |
| Mobile | React Native with Expo (iOS and Android). TypeScript. \[ASSUMPTION\] Expo Router for navigation, TanStack Query with a persisted cache for data and offline reads, `expo-secure-store` for tokens, `expo-notifications` for push, `expo-linking` for invite deep links, EAS Build and EAS Update for releases. \[ASSUMPTION\] |
| Backend | Node.js with Express, written in TypeScript. \[ASSUMPTION\] REST API under `/v1`. Zod for request validation. Server-rendered pages for the billing web page (FR-050). |
| Database | PostgreSQL 16. Prisma as the ORM. Prisma Migrate for schema changes. Raw SQL migrations for partial unique indexes and check constraints. A Prisma client extension hides rows where `deletedAt` is set for User, Business, and Location. \[ASSUMPTION\] |
| Background jobs | BullMQ, backed by Redis. Redis also provides shared caching, rate limiting, and distributed locks. A hosted free tier such as Upstash is acceptable for development. |
| Email | A transactional email service (Postmark). \[ASSUMPTION\] |
| SMS | A Nigerian SMS gateway (Termii), used for invites only. \[ASSUMPTION\] |
| Push | Expo Push Service (APNs and FCM behind it). |
| Payments | Flutterwave: hosted checkout, card tokenization, and webhooks. \[ASSUMPTION\] Verify recurring token charging for local cards before build (the sandbox test in Section 13). Rota owns subscription and invoice logic, so the provider only moves money and can be replaced. |
| Error tracking | Sentry for the app and the API. \[ASSUMPTION\] |
| Analytics | A product analytics service (PostHog). Events are listed in Section 11. \[ASSUMPTION\] |
| CI | GitHub Actions: lint, type check, tests, and Prisma migration check. \[ASSUMPTION\] |

The repository is a monorepo with `apps/mobile`, `apps/api`, and `packages/shared` (shared Zod schemas and types). \[ASSUMPTION\]

The Phase 2 web schedule view needs a web framework. Choose it at Phase 2 start. Next.js is a candidate. \[ASSUMPTION\]

### 7.2 API style and key endpoints

JSON over HTTPS. Cursor pagination for lists. ISO 8601 UTC timestamps. Money in minor units (kobo or cents). Writes that can be retried (acknowledge, accept, approve) are idempotent.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /v1/auth/register`, `/auth/verify-email`, `/auth/login`, `/auth/login/verify-device`, `/auth/refresh`, `/auth/logout`, `/auth/password/forgot`, `/auth/password/reset` |
| Me | `GET /v1/me` (profile and memberships), `DELETE /v1/me` |
| Business | `POST /v1/businesses`, `GET /v1/businesses/:id`, `PATCH /v1/businesses/:id`, `DELETE /v1/businesses/:id` (Owner), `PATCH /v1/locations/:id` |
| Positions | `GET/POST /v1/businesses/:id/positions`, `PATCH /v1/positions/:id` |
| Members | `GET /v1/businesses/:id/members`, `PATCH /v1/members/:id` (role, positions), `DELETE /v1/members/:id`, `POST /v1/members/:id/anonymize` |
| Invites | `POST/GET /v1/businesses/:id/invites`, `POST /v1/invites/:id/resend`, `DELETE /v1/invites/:id`, `GET /v1/invites/preview?token=` (shows the business name before accepting), `POST /v1/invites/accept` |
| Shifts | `GET /v1/businesses/:id/shifts?from&to&assigneeId`, `POST /v1/businesses/:id/shifts`, `PATCH /v1/shifts/:id`, `POST /v1/businesses/:id/shifts/publish`, `POST /v1/shifts/:id/cancel`, `POST /v1/shifts/:id/uncovered`, `POST /v1/businesses/:id/shifts/copy-week`, `GET /v1/businesses/:id/shifts/unacknowledged` (Owner, Manager). `PATCH` requires an `If-Match` version header. |
| Acknowledgements | `POST /v1/shift-changes/:id/ack` |
| Swaps | `POST /v1/shifts/:id/swaps`, `GET /v1/businesses/:id/swaps?status=` (Owner, Manager: the approval queue), `POST /v1/swaps/:id/accept`, `/decline`, `/cancel`, `/approve`, `/reject` |
| Open shifts | `POST /v1/shifts/:id/claims`, `GET /v1/businesses/:id/claims?status=` (Owner, Manager), `POST /v1/claims/:id/approve`, `/reject`, `/withdraw` |
| Time off | `POST/GET /v1/businesses/:id/time-off`, `POST /v1/time-off/:id/approve`, `/deny`, `/cancel` |
| Preferences | `PUT /v1/members/:id/availability`, `PATCH /v1/members/:id/preferences` |
| Notifications | `GET /v1/notifications`, `POST /v1/notifications/:id/read`, `POST /v1/push-tokens`, `DELETE /v1/push-tokens/:token` |
| Billing | `GET /v1/businesses/:id/subscription`, `POST /v1/businesses/:id/billing/session` (returns the one-time web link), `POST /v1/businesses/:id/subscription/cancel`, `GET /v1/businesses/:id/invoices` (Owner, shown on the billing page), `POST /v1/webhooks/payments` (signature verified, idempotent) |
| Audit | `GET /v1/businesses/:id/audit-log` (Owner) |

**Webhook rule.** The handler inserts the event into `PaymentEvent` first. If the provider event ID already exists, it returns 200 and does nothing. Otherwise it processes the event and then sets `processedAt`.

### 7.3 Auth and role permissions

- Passwords are hashed with argon2id. \[ASSUMPTION\]
- Access token: JWT, 15 minutes, holds user ID and session ID only. Refresh token: opaque random value, 30 days, rotated on each use, stored hashed. Reuse of a rotated token revokes the session.
- A device is known when a Device row exists for the user and the app's `deviceId`, with `trustedAt` set. The app creates a random `deviceId` on first launch and keeps it in secure storage. \[ASSUMPTION\]
- Role is looked up from the membership table on every request, so removal takes effect immediately.
- Every business query is scoped by the business ID taken from the membership, never from the request body alone.
- Rate limits: auth endpoints 5 per minute per IP and email. Other endpoints 120 per minute per user. Enforced with Redis-backed shared counters so limits remain consistent across API instances. Redis also provides shared caching and distributed locks; a hosted service such as Upstash is acceptable.

| Capability | Owner | Manager | Staff |
| --- | --- | --- | --- |
| Manage billing and subscription | Yes | No | No |
| Edit business and location settings | Yes | No | No |
| Delete business | Yes | No | No |
| Manage positions | Yes | Yes | No |
| Invite Staff | Yes | Yes | No |
| Invite Managers, change roles | Yes | No | No |
| Remove Staff | Yes | Yes | No |
| Remove Managers | Yes | No | No |
| Create, edit, publish, cancel shifts | Yes | Yes | No |
| Flag a past shift as uncovered | Yes | Yes | No |
| View DRAFT shifts | Yes | Yes | No |
| View published team schedule | Yes | Yes | Yes |
| Request a swap on own shift | Yes | Yes | Yes |
| Accept a swap offer (matching position) | Yes | Yes | Yes |
| Approve or reject swaps, claims, time off | Yes | Yes (not own) | No |
| Claim an open shift (matching position) | Yes | Yes | Yes |
| Request time off | Yes | Yes | Yes |
| Set own availability and preferences | Yes | Yes | Yes |
| View audit log | Yes | No | No |

### 7.4 Push notification flow

1. The app asks for notification permission after the first successful login, then registers the Expo push token with `POST /v1/push-tokens`.
2. A domain event creates a Notification row and queues a delivery job.
3. The job sends to the Expo Push Service and stores the ticket ID. A ticket error queues an email.
4. A job runs every 5 minutes and fetches receipts for tickets older than 15 minutes. (Verify the 15-minute wait in Expo's docs.) A `DeviceNotRegistered` receipt disables that token and queues an email.
5. A user with no active token gets email at once. If a shift starts within 6 hours of the event, push and email are sent together.
6. Opening a notification marks it read. Acknowledgement is a separate action.

### 7.5 Offline behavior

- The app caches the business's shifts from 7 days back to 14 days ahead, the member list, and the inbox.
- Offline, the app shows cached data with a "Last updated" time.
- Offline writes are blocked with a clear message, except acknowledgements, which are queued and sent on reconnect. \[ASSUMPTION\]
- The cache clears on logout and when a membership is removed.

### 7.6 Background jobs

BullMQ is the locked queue implementation and uses Redis for job state and coordination. Redis is also the shared cache, rate-limit store, and distributed-lock store. Workers must be safe to run separately from the API process. Use bounded retries with backoff, idempotent handlers for retried work, and observable terminal failure handling. Do not use `BullMQ` or an in-memory queue.

| Job | Schedule | Action |
| --- | --- | --- |
| Swap expiry | Every 1 minute | Set EXPIRED on swaps past `expiresAt`. Notify requesters. |
| Shift reminders | Every 5 minutes | Notify assignees 2 hours before start. |
| Acknowledgement reminders | Every 15 minutes | Remind at 12 hours. Flag at 24 hours. For changes made within 12 hours of the shift start: remind at 1 hour, flag at 2 hours. |
| Push receipts | Every 5 minutes | Fetch receipts for tickets older than 15 minutes. Disable bad tokens. Queue email fallbacks. |
| Trial reminders and expiry | Hourly | Notify at 7 days, 2 days, 0 days. Move to READ_ONLY at trial end with no payment. |
| Invoice generation | Daily at 02:00 Africa/Lagos | Create invoices for subscriptions whose period ends. |
| Payment retries | Hourly | Charge OPEN invoices at their `nextAttemptAt`. |
| Grace expiry | Hourly | Set READ_ONLY seven days after `Invoice.dueAt`. |
| Token and code cleanup | Daily | Delete expired auth codes and refresh tokens. |
| Retention purge | Nightly | See FR-056, FR-057, and FR-058. |

### 7.7 Hosting and environments

- The API runs in a Docker container on a managed container platform, with managed PostgreSQL. \[ASSUMPTION\] Choose the region with the lowest measured latency from Lagos, among Europe and Cape Town. \[ASSUMPTION\]
- Environments: local, staging, production. Staging uses a separate database and a sandbox payment account.
- Config through environment variables. Secrets in the platform secret store.
- The API runs as a single instance in the MVP, with a second instance added before the first paid cohort if load tests require it. Workers can later run as a separate process from the API. \[ASSUMPTION\]

### 7.8 Logging, backups, and security

- Logs: `pino`, JSON, with a request ID. No passwords, codes, tokens, or phone numbers in logs.
- Backups: automated daily snapshots kept 14 days, plus point-in-time recovery for 7 days if the host supports it. A restore test every quarter. Target recovery point 24 hours, or 15 minutes with point-in-time recovery. Target recovery time 4 hours. \[ASSUMPTION\]
- Security: TLS everywhere including the database connection. Helmet headers. Input validation on every endpoint. Parameterized queries through Prisma. Webhook signature checks. Audit log for role changes, removals, overrides, and billing actions.
- Card data never touches Rota servers.
- Tests: an integration test purges a seeded business with 1,000 shifts and passes. A test covers remove and re-add of a member inside one billing period.

### 7.9 Performance targets

| Target | Value |
| --- | --- |
| API read p95 | Under 300 ms at 200 concurrent users |
| API write p95 | Under 500 ms |
| Week schedule payload | At most 50 KB gzipped for 100 shifts |
| Cold start to schedule on 4G | Under 3 seconds. Under 1 second from cache. |
| Notification enqueue after publish | Under 5 seconds |
| Year-1 capacity | 500 businesses, 10,000 members \[ASSUMPTION\] |
| Supported devices | The minimum OS versions of the Expo SDK in use. Confirm coverage with the pilot device survey. \[ASSUMPTION\] |
| App download size | Under 40 MB \[ASSUMPTION\] |
| Mobile data | Under 5 MB per staff member per week \[ASSUMPTION\] |

## 8. Business model

| Item | Rule |
| --- | --- |
| Pricing | Monthly subscription. Price = active seats x `SEAT_PRICE`. \[ASSUMPTION: no price set. `SEAT_PRICE` is a placeholder.\] |
| Currency | NGN only in the MVP. Stored in minor units (kobo). The `Currency` enum keeps USD for later. USD is added only when a customer asks. \[ASSUMPTION\] |
| Seat definition | Every ACTIVE member except the Owner, counted from SeatPeriod rows. Managers count. Pending invites and removed members do not count. |
| Billing timing | Monthly in advance. The period anchor is the start of the first paid period. For anchors on day 29 to 31, short months use the last day of the month. \[ASSUMPTION\] |
| Mid-period additions | Prorated, charged on the next invoice. A member is billed once per billing period, so removing and re-adding the same member in one period adds no second charge. See FR-049. |
| Removals | No credit. Seat reduction applies at the next period. \[ASSUMPTION\] |
| Trial | 14 days, no card, full features. One trial per verified email and per phone number. \[ASSUMPTION\] |
| Failed payment | Retries on days 0, 1, 3, and 5 after `Invoice.dueAt`. PAST_DUE with full access for 7 days. Then READ_ONLY. |
| Trial end with no payment | READ_ONLY immediately. \[ASSUMPTION\] |
| Cancellation | At period end. Data kept per FR-057. |
| Price changes | Each subscription keeps the seat price it started with until the owner accepts a change. \[ASSUMPTION\] |
| Payment flow | The app opens a one-time web link. The owner pays on the provider's hosted page. Checkout charges the first month, and the first paid period starts at trial end. The provider calls the webhook, and Rota activates the subscription and issues the invoice. Payment provider: Flutterwave only, confirmed by the owner; recurring billing requires a successful sandbox test in Section 13. \[ASSUMPTION\] |
| Store rules | Billing runs on the web. The app shows no purchase button or price. \[ASSUMPTION: confirm with current Apple and Google rules.\] |
| Tax | Prices are shown without VAT. VAT is added on invoices if the business must charge it. Confirm with an accountant before launch. \[ASSUMPTION\] |
| Refunds | No refund for partial periods. Duplicate or failed charges are refunded within 7 days on request. \[ASSUMPTION\] |
| Chargebacks | The subscription moves to PAST_DUE and the owner is notified. \[ASSUMPTION\] |

### Cost per seat

Every variable below must be measured in the pilot. \[ASSUMPTION\]

| Cost item | Variable | How it is measured |
| --- | --- | --- |
| Payment gateway fee | `GATEWAY_FEE_PCT` | Percentage of each charge, applied to `SEAT_PRICE` |
| SMS invites | `SMS_COST` | Cost per SMS, times SMS invites sent per seat |
| Email | `EMAIL_COST` | Cost per email, times emails sent per seat per month |
| Hosting and database | `HOSTING_COST` | Monthly bill divided by active seats |
| Support | `SUPPORT_MIN` | Support minutes per seat per month, times the hourly cost of support |

Contribution margin per seat = `SEAT_PRICE` minus the gateway fee on `SEAT_PRICE` minus all other per-seat costs. It must be above zero at `SEAT_PRICE` before MVP-B build starts.

### Revenue example

Lekki Grill has 1 owner, 1 manager, and 10 staff. Seats = 11 (owner is free).

- Monthly invoice = 11 x `SEAT_PRICE`.
- 100 teams of this size = 1,100 seats, so monthly revenue = 1,100 x `SEAT_PRICE`.
- Proration: a staff member activates on day 11 of a 30-day period. Remaining days = 20. Charge = `SEAT_PRICE` x 20 / 30, about 0.67 x `SEAT_PRICE`, added to the next invoice.

## 9. Risks

Thresholds in the Early warning column are planning values. \[ASSUMPTION\]

| Risk | Likelihood | Impact | Mitigation | Early warning |
| --- | --- | --- | --- | --- |
| Free alternatives (chat groups, spreadsheets) are good enough | High | High | Validation gate in Section 13. Measure hours saved in the pilot. | Pilot owners say they would not pay at any tested price |
| App store rules restrict billing outside the app, or restrict showing external payment links | Medium | High | Show no price or purchase link in the app. State that billing is managed by the owner on the web. Review current Apple and Google policy before submission. Test with a review build early. | Review build is rejected or flagged |
| Push notifications arrive late or not at all on some Android devices (battery optimization) | High | High | Email fallback. Short-notice changes send push and email together. Acknowledgement reminders. Show a "Last updated" time on the schedule. Pull-to-refresh. | Push failure rate by device model is above the G4 target |
| Staff with low tech comfort do not adopt the app | Medium | High | Short onboarding. A "My shifts" home screen. Invite by SMS or email with a copyable link. Managers see who has not acknowledged a change. | Fewer than 70% of invited staff accept within 7 days |
| Staff lack smartphones, email addresses, or recent Android versions | Medium | High | Pilot device and email survey. Phone-number login with SMS codes in Phase 2 if the survey shows the need. | More than 20% of invitees cannot join |
| Managers find phone-only scheduling too slow | Medium | High | Copy Week in the MVP. Tablet-friendly layout. Prototype test before build. Web view trigger in Section 13. | 3 of the first 10 pilot managers name it the top friction |
| Repeat trials: owners create new businesses to avoid paying | Medium | Medium | One trial per verified email and per phone number. Flag businesses created from the same device. | More than one business created per device |
| Data privacy and compliance (Nigeria Data Protection Act 2023) \[ASSUMPTION\] | Medium | High | Privacy policy, notification consent, anonymization (FR-055), retention limits (FR-057). Get legal advice on registration duties and cross-border hosting before launch. | Legal advice names a duty that the PRD does not cover |
| Payment provider does not support recurring token charges for local cards | Medium | High | Verify in sandbox before build. Use Flutterwave only; investigate the recurring-charge limitation and stop billing implementation if the required flow cannot be supported. | Sandbox test fails |
| Card payment failures in the local market cause involuntary churn | Medium | Medium | Retry schedule, grace period, owner reminders, and a bank transfer option in Phase 2. | More than 20% of renewals fail on the first attempt |
| SMS delivery is delayed or blocked (sender ID rules, DND routing) | Medium | Medium | Email is the default channel. SMS is optional per invite. Always show the invite link for manual sharing. | SMS invites are accepted much later than email invites |
| Poor mobile data connectivity | High | Medium | Small payloads, persisted cache, offline reading, and the data budget in 7.9. | Cold start from cache takes more than 1 second, or data use is above 5 MB per week |
| Disputes about who changed what | Medium | Medium | ShiftChange history and the audit log. | Repeated disputes reported in pilot interviews |
| Single-instance API is a single point of failure | Medium | Medium | Health checks and auto-restart. Add a second instance before the first paid cohort. Backups and restore tests. | Any downtime incident in the pilot |
| Scope creep (payroll, chat, time clock) | High | Medium | Non-goals are fixed. Review requests against the roadmap. | Pilot owners ask for payroll or chat in interviews |

## 10. Prisma data model

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---------- Enums ----------

enum Role {
  OWNER
  MANAGER
  STAFF
}

enum MembershipStatus {
  ACTIVE
  REMOVED
}

enum BusinessType {
  RESTAURANT
  CLINIC
  RETAIL
  OTHER
}

enum Currency {
  NGN
  USD
}

enum Platform {
  IOS
  ANDROID
}

enum AuthCodePurpose {
  VERIFY_EMAIL
  LOGIN_NEW_DEVICE
  PASSWORD_RESET
}

enum ShiftStatus {
  DRAFT
  PUBLISHED
  CANCELLED
}

enum ShiftChangeType {
  PUBLISHED
  TIME_CHANGED
  ASSIGNEE_CHANGED
  POSITION_CHANGED
  NOTES_CHANGED
  CANCELLED
}

enum SwapScope {
  DIRECT
  POOL
}

enum SwapStatus {
  AWAITING_PEER
  AWAITING_MANAGER
  APPROVED
  REJECTED
  DECLINED
  CANCELLED
  EXPIRED
}

enum ClaimStatus {
  PENDING
  APPROVED
  REJECTED
  WITHDRAWN
}

enum TimeOffStatus {
  PENDING
  APPROVED
  DENIED
  CANCELLED
}

enum NotificationType {
  SCHEDULE_PUBLISHED
  SHIFT_ASSIGNED
  SHIFT_CHANGED
  SHIFT_REMOVED
  SHIFT_NOTES_CHANGED
  OPEN_SHIFT_AVAILABLE
  SWAP_OFFERED
  SWAP_NEEDS_APPROVAL
  SWAP_RESOLVED
  CLAIM_RESOLVED
  TIME_OFF_REQUESTED
  TIME_OFF_RESOLVED
  SHIFT_REMINDER
  ACK_REMINDER
  TRIAL_ENDING
  BILLING_ALERT
}

enum DeliveryChannel {
  PUSH
  EMAIL
  SMS
}

enum DeliveryStatus {
  QUEUED
  SENT
  DELIVERED
  FAILED
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  READ_ONLY
  CANCELLED
}

enum InvoiceStatus {
  OPEN
  PAID
  FAILED
  VOID
}

enum InvoiceLineKind {
  SEATS
  PRORATION
}

// ---------- Identity and sessions ----------

model User {
  id              String    @id @default(cuid())
  email           String    @unique // stored lowercase
  passwordHash    String
  name            String
  phoneE164       String?
  emailVerifiedAt DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?

  memberships   Membership[]
  refreshTokens RefreshToken[]
  pushTokens    PushToken[]
  authCodes     AuthCode[]
  devices       Device[]
  notifications Notification[]
}

model AuthCode {
  id         String          @id @default(cuid())
  userId     String?
  user       User?           @relation(fields: [userId], references: [id], onDelete: Cascade)
  email      String
  purpose    AuthCodePurpose
  codeHash   String
  attempts   Int             @default(0)
  expiresAt  DateTime
  consumedAt DateTime?
  createdAt  DateTime        @default(now())

  @@index([email, purpose, createdAt])
}

model RefreshToken {
  id                String    @id @default(cuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash         String    @unique
  deviceLabel       String?
  deviceId          String?
  device            Device?   @relation(fields: [deviceId], references: [id])
  expiresAt         DateTime
  revokedAt         DateTime?
  replacedByTokenId String?
  createdAt         DateTime  @default(now())

  @@index([userId])
}

model PushToken {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  expoPushToken String    @unique
  platform      Platform
  createdAt     DateTime  @default(now())
  lastSeenAt    DateTime  @default(now())
  disabledAt    DateTime?

  @@index([userId])
}

model Device {
  id            String         @id @default(cuid())
  userId        String
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  deviceId      String // random ID made by the app, kept in secure storage
  label         String?
  trustedAt     DateTime? // set after a valid new-device code
  lastSeenAt    DateTime       @default(now())
  createdAt     DateTime       @default(now())
  refreshTokens RefreshToken[]

  @@unique([userId, deviceId])
}

// ---------- Business structure ----------

model Business {
  id          String       @id @default(cuid())
  name        String
  type        BusinessType
  countryCode String       @default("NG")
  currency    Currency     @default(NGN)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  deletedAt   DateTime?

  locations       Location[]
  positions       Position[]
  memberships     Membership[]
  invites         Invite[]
  shifts          Shift[]
  swapRequests    SwapRequest[]
  timeOffRequests TimeOffRequest[]
  notifications   Notification[]
  auditLogs       AuditLog[]
  seatPeriods     SeatPeriod[]
  subscription    Subscription?
}

model Location {
  id         String    @id @default(cuid())
  businessId String
  business   Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name       String
  address    String?
  timezone   String // IANA name, for example Africa/Lagos
  createdAt  DateTime  @default(now())
  archivedAt DateTime?

  shifts Shift[]

  @@index([businessId])
}

model Position {
  id         String    @id @default(cuid())
  businessId String
  business   Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name       String
  createdAt  DateTime  @default(now())
  archivedAt DateTime?

  members MembershipPosition[]
  shifts  Shift[]

  @@unique([businessId, name])
}

model Membership {
  id                        String           @id @default(cuid())
  userId                    String
  user                      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  businessId                String
  business                  Business         @relation(fields: [businessId], references: [id], onDelete: Cascade)
  role                      Role
  status                    MembershipStatus @default(ACTIVE)
  displayName               String
  preferredMaxWeeklyMinutes Int?
  activatedAt               DateTime         @default(now())
  removedAt                 DateTime?
  anonymizedAt              DateTime?

  positions       MembershipPosition[]
  availability    AvailabilityWindow[]
  invitesSent     Invite[]             @relation("InviteSender")
  shiftsAssigned  Shift[]              @relation("ShiftAssignee")
  shiftsCreated   Shift[]              @relation("ShiftCreator")
  shiftChanges    ShiftChange[]        @relation("ShiftChanger")
  shiftChangeAcks ShiftChangeAck[]
  swapsRequested  SwapRequest[]        @relation("SwapRequester")
  swapsTargeted   SwapRequest[]        @relation("SwapTarget")
  swapsAccepted   SwapRequest[]        @relation("SwapAcceptor")
  swapsDecided    SwapRequest[]        @relation("SwapDecider")
  claims          ShiftClaim[]         @relation("ClaimClaimer")
  claimsDecided   ShiftClaim[]         @relation("ClaimDecider")
  timeOff         TimeOffRequest[]     @relation("TimeOffRequester")
  timeOffDecided  TimeOffRequest[]     @relation("TimeOffDecider")
  auditLogs       AuditLog[]
  seatPeriods     SeatPeriod[]

  @@unique([userId, businessId])
  @@index([businessId, status, role])
}

model MembershipPosition {
  membershipId String
  membership   Membership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  positionId   String
  position     Position   @relation(fields: [positionId], references: [id], onDelete: Cascade)

  @@id([membershipId, positionId])
}

model SeatPeriod {
  id           String     @id @default(cuid())
  businessId   String
  business     Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
  membershipId String
  membership   Membership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  startedAt    DateTime
  endedAt      DateTime? // null while the member is active

  @@index([businessId, startedAt, endedAt])
  @@index([membershipId])
}

model Invite {
  id               String     @id @default(cuid())
  businessId       String
  business         Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
  invitedById      String
  invitedBy        Membership @relation("InviteSender", fields: [invitedById], references: [id])
  role             Role       @default(STAFF)
  email            String?
  phoneE164        String?
  positionIds      String[]
  tokenHash        String     @unique
  codeHash         String
  codeAttempts     Int        @default(0)
  expiresAt        DateTime
  acceptedAt       DateTime?
  acceptedByUserId String?
  revokedAt        DateTime?
  createdAt        DateTime   @default(now())

  @@index([businessId])
  @@index([email])
}

// ---------- Preferences and time off ----------

model AvailabilityWindow {
  id           String     @id @default(cuid())
  membershipId String
  membership   Membership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  dayOfWeek    Int // ISO: 1 = Monday ... 7 = Sunday
  startMinute  Int // minutes from local midnight
  endMinute    Int // may pass midnight: values above 1440 mean the next day, up to 2880

  @@index([membershipId, dayOfWeek])
}

model TimeOffRequest {
  id           String        @id @default(cuid())
  businessId   String
  business     Business      @relation(fields: [businessId], references: [id], onDelete: Cascade)
  membershipId String
  membership   Membership    @relation("TimeOffRequester", fields: [membershipId], references: [id])
  startDate    DateTime      @db.Date // location-local dates
  endDate      DateTime      @db.Date
  note         String?
  status       TimeOffStatus @default(PENDING)
  decidedById  String?
  decidedBy    Membership?   @relation("TimeOffDecider", fields: [decidedById], references: [id])
  decidedAt    DateTime?
  createdAt    DateTime      @default(now())

  @@index([businessId, status])
  @@index([membershipId, startDate])
}

// ---------- Shifts, changes, swaps, claims ----------

model Shift {
  id           String      @id @default(cuid())
  businessId   String
  business     Business    @relation(fields: [businessId], references: [id], onDelete: Cascade)
  locationId   String
  location     Location    @relation(fields: [locationId], references: [id])
  positionId   String
  position     Position    @relation(fields: [positionId], references: [id])
  assigneeId   String? // null on a PUBLISHED shift means open shift
  assignee     Membership? @relation("ShiftAssignee", fields: [assigneeId], references: [id])
  startsAt     DateTime // UTC
  endsAt       DateTime // UTC
  breakMinutes Int         @default(0)
  notes        String?
  status       ShiftStatus @default(DRAFT)
  version      Int         @default(1)
  publishedAt  DateTime?
  cancelledAt  DateTime?
  uncoveredAt  DateTime? // set when a manager flags a past shift as uncovered
  createdById  String
  createdBy    Membership  @relation("ShiftCreator", fields: [createdById], references: [id])
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  changes      ShiftChange[]
  swapRequests SwapRequest[]
  claims       ShiftClaim[]

  @@index([businessId, startsAt])
  @@index([assigneeId, startsAt])
  @@index([locationId, startsAt])
}

model ShiftChange {
  id          String          @id @default(cuid())
  shiftId     String
  shift       Shift           @relation(fields: [shiftId], references: [id], onDelete: Cascade)
  version     Int
  type        ShiftChangeType
  summary     String
  requiresAck Boolean         @default(false)
  changedById String
  changedBy   Membership      @relation("ShiftChanger", fields: [changedById], references: [id])
  createdAt   DateTime        @default(now())

  acks ShiftChangeAck[]

  @@unique([shiftId, version])
}

model ShiftChangeAck {
  id            String      @id @default(cuid())
  shiftChangeId String
  shiftChange   ShiftChange @relation(fields: [shiftChangeId], references: [id], onDelete: Cascade)
  membershipId  String
  membership    Membership  @relation(fields: [membershipId], references: [id])
  createdAt     DateTime    @default(now())
  ackedAt       DateTime? // null until the member taps Acknowledge

  @@unique([shiftChangeId, membershipId])
  @@index([membershipId, ackedAt])
}

model SwapRequest {
  id              String      @id @default(cuid())
  businessId      String
  business        Business    @relation(fields: [businessId], references: [id], onDelete: Cascade)
  shiftId         String
  shift           Shift       @relation(fields: [shiftId], references: [id], onDelete: Cascade)
  requesterId     String
  requester       Membership  @relation("SwapRequester", fields: [requesterId], references: [id])
  scope           SwapScope
  targetId        String? // set for DIRECT
  target          Membership? @relation("SwapTarget", fields: [targetId], references: [id])
  acceptedById    String?
  acceptedBy      Membership? @relation("SwapAcceptor", fields: [acceptedById], references: [id])
  status          SwapStatus  @default(AWAITING_PEER)
  expiresAt       DateTime // earlier of createdAt + 48h and shift start
  peerRespondedAt DateTime?
  decidedById     String?
  decidedBy       Membership? @relation("SwapDecider", fields: [decidedById], references: [id])
  decidedAt       DateTime?
  decisionNote    String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([businessId, status])
  @@index([status, expiresAt])
  @@index([shiftId])
}

model ShiftClaim {
  id           String      @id @default(cuid())
  shiftId      String
  shift        Shift       @relation(fields: [shiftId], references: [id], onDelete: Cascade)
  membershipId String
  membership   Membership  @relation("ClaimClaimer", fields: [membershipId], references: [id])
  status       ClaimStatus @default(PENDING)
  decidedById  String?
  decidedBy    Membership? @relation("ClaimDecider", fields: [decidedById], references: [id])
  decidedAt    DateTime?
  createdAt    DateTime    @default(now())

  @@unique([shiftId, membershipId])
  @@index([shiftId, status])
}

// ---------- Notifications ----------

model Notification {
  id          String           @id @default(cuid())
  userId      String
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  businessId  String?
  business    Business?        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  type        NotificationType
  title       String
  body        String
  data        Json?
  requiresAck Boolean          @default(false)
  readAt      DateTime?
  createdAt   DateTime         @default(now())

  deliveries NotificationDelivery[]

  @@index([userId, createdAt])
}

model NotificationDelivery {
  id             String          @id @default(cuid())
  notificationId String
  notification   Notification    @relation(fields: [notificationId], references: [id], onDelete: Cascade)
  channel        DeliveryChannel
  status         DeliveryStatus  @default(QUEUED)
  providerRef    String? // Expo ticket ID, email message ID, SMS ID
  error          String?
  attempts       Int             @default(0)
  sentAt         DateTime?
  createdAt      DateTime        @default(now())

  @@index([notificationId])
  @@index([channel, status])
}

// ---------- Billing ----------

model Subscription {
  id                      String             @id @default(cuid())
  businessId              String             @unique
  business                Business           @relation(fields: [businessId], references: [id], onDelete: Cascade)
  status                  SubscriptionStatus @default(TRIALING)
  currency                Currency
  seatPriceMinor          Int // snapshot of the seat price in kobo or cents
  trialEndsAt             DateTime
  currentPeriodStart      DateTime?
  currentPeriodEnd        DateTime?
  graceEndsAt             DateTime?
  cancelAtPeriodEnd       Boolean            @default(false)
  cancelledAt             DateTime?
  providerName            String?
  providerCustomerRef     String?
  providerPaymentTokenRef String? // token reference only, never card data
  createdAt               DateTime           @default(now())
  updatedAt               DateTime           @updatedAt

  invoices Invoice[]

  @@index([status, currentPeriodEnd])
}

model Invoice {
  id             String        @id @default(cuid())
  subscriptionId String
  subscription   Subscription  @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  periodStart    DateTime
  periodEnd      DateTime
  dueAt          DateTime // starts the retry and grace clock
  seatCount      Int
  totalMinor     Int
  currency       Currency
  status         InvoiceStatus @default(OPEN)
  attemptCount   Int           @default(0)
  nextAttemptAt  DateTime?
  providerTxnRef String?       @unique
  paidAt         DateTime?
  createdAt      DateTime      @default(now())

  lines InvoiceLine[]

  @@index([subscriptionId, status])
  @@index([status, nextAttemptAt])
}

model InvoiceLine {
  id              String          @id @default(cuid())
  invoiceId       String
  invoice         Invoice         @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  kind            InvoiceLineKind
  description     String
  quantity        Int
  unitAmountMinor Int
  amountMinor     Int

  @@index([invoiceId])
}

model PaymentEvent {
  id              String    @id @default(cuid())
  provider        String
  providerEventId String
  type            String
  payload         Json
  receivedAt      DateTime  @default(now())
  processedAt     DateTime?

  @@unique([provider, providerEventId])
}

// ---------- Audit ----------

model AuditLog {
  id         String      @id @default(cuid())
  businessId String
  business   Business    @relation(fields: [businessId], references: [id], onDelete: Cascade)
  actorId    String?
  actor      Membership? @relation(fields: [actorId], references: [id])
  action     String // for example SHIFT_OVERRIDE, MEMBER_REMOVED
  entityType String
  entityId   String
  metadata   Json?
  createdAt  DateTime    @default(now())

  @@index([businessId, createdAt])
}
```

### Raw SQL migration rules (Prisma cannot express these)

```sql
-- One active owner per business
CREATE UNIQUE INDEX one_active_owner_per_business
  ON "Membership" ("businessId")
  WHERE role = 'OWNER' AND status = 'ACTIVE';

-- One active swap per shift
CREATE UNIQUE INDEX one_active_swap_per_shift
  ON "SwapRequest" ("shiftId")
  WHERE status IN ('AWAITING_PEER', 'AWAITING_MANAGER');

-- Shift time sanity
ALTER TABLE "Shift" ADD CONSTRAINT shift_end_after_start CHECK ("endsAt" > "startsAt");

-- Availability sanity (end may pass midnight, up to 2880)
ALTER TABLE "AvailabilityWindow" ADD CONSTRAINT availability_valid
  CHECK ("dayOfWeek" BETWEEN 1 AND 7
     AND "startMinute" BETWEEN 0 AND 1439
     AND "endMinute" BETWEEN 1 AND 2880
     AND "endMinute" > "startMinute"
     AND "endMinute" - "startMinute" <= 1440);

-- One open seat period per membership
CREATE UNIQUE INDEX one_open_seat_period_per_membership
  ON "SeatPeriod" ("membershipId")
  WHERE "endedAt" IS NULL;

-- Seat period sanity
ALTER TABLE "SeatPeriod" ADD CONSTRAINT seat_period_valid
  CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt");
```

### Model notes

| Model | Note |
| --- | --- |
| User | Global login. Soft-deleted, then anonymized after 30 days (FR-056). |
| AuthCode | Hashed 6-digit codes for email verification, new-device login, and password reset. 10-minute expiry, 5 attempts. |
| RefreshToken | Rotated on use. Reuse of a rotated token revokes the chain. Linked to a Device. |
| PushToken | One row per device. Disabled on `DeviceNotRegistered`. |
| Device | One row per app install per user, keyed by the app's `deviceId`. `trustedAt` is set after a valid new-device code. |
| Business | The tenant. Currency is fixed at creation. |
| Location | Holds the IANA time zone. One per business in the MVP, enforced in the service layer. |
| Position | Unique name per business. Archive instead of delete. |
| Membership | A user's role in one business. Re-inviting a REMOVED member reactivates the same row. Seats are counted from SeatPeriod rows, and `activatedAt` is for display only. `displayName` is what other members see. Anonymization edits this row. |
| MembershipPosition | Join table for members and positions. |
| SeatPeriod | One row per active stretch of a member. Opened on activation, closed on removal. Billing and proration read this table. At most one open row per member (partial unique index). |
| Invite | Link token and code stored hashed. `positionIds` is a denormalized list copied to the membership on accept. It is validated at accept time, and archived positions are ignored. |
| AvailabilityWindow | Weekly windows in location-local minutes. The end may pass midnight (up to 2880). No rows means available at any time. |
| TimeOffRequest | Date-only range in the location's time zone. |
| Shift | UTC instants. An open shift is PUBLISHED with `assigneeId` null. `uncoveredAt` is set when a manager flags a past shift as uncovered. |
| ShiftChange | One row per version after publish. `requiresAck` is set by change type. |
| ShiftChangeAck | One row per affected member per change. `ackedAt` is null until they confirm. |
| SwapRequest | Holds the full swap state machine. Expiry is stored so the job is a simple query. |
| ShiftClaim | One claim per member per open shift. |
| Notification | In-app inbox entry. |
| NotificationDelivery | One row per channel attempt, used for fallback decisions and delivery metrics. |
| Subscription | One per business. Seat price is a snapshot. Stores token references only. |
| Invoice and InvoiceLine | Generated daily. Lines separate seat charges from proration. `dueAt` starts the retry and grace clock. |
| PaymentEvent | One row per payment provider event. The unique provider event ID makes webhooks safe to replay. |
| AuditLog | Records role changes, removals, overrides, and billing actions. |

**Deletion rules.** Do not rely on database cascade order. The purge in FR-057 deletes children first, in a fixed order, inside one transaction per business. Membership rows are never hard-deleted outside the purge. Prisma does not hide soft-deleted rows by itself, so a client extension filters `deletedAt` for User, Business, and Location.

## 11. Success metrics

All targets are planning estimates. \[ASSUMPTION\]

| Metric | Formula | Target | Window |
| --- | --- | --- | --- |
| Activation | Businesses with 3 or more ACTIVE non-owner members and 1 or more published week within 7 days of creation, divided by businesses created | 40% | Cohorts of the first 3 months after launch |
| Weekly active teams | Businesses with 1 or more publish or shift change in the ISO week and at least 50% of active staff with an `app_open` event that week, divided by paying and trialing businesses | 60% | Weekly |
| Swap decision rate | Swaps that end APPROVED or REJECTED, divided by swaps created, excluding CANCELLED | 85% | Rolling 30 days |
| Swap approval rate | Swaps APPROVED divided by swaps created, excluding CANCELLED | Tracked, no target | Rolling 30 days |
| Swap decision time | Median hours from AWAITING_MANAGER to APPROVED or REJECTED | Under 12 hours | Rolling 30 days |
| Time to publish a schedule | Median active editing time, from the first draft shift in a week to publish, for teams of 8 to 15 members. Gaps longer than 10 minutes are excluded. | Under 30 minutes. Under 10 with Copy Week. | Monthly |
| Acknowledgement rate | Required acknowledgements completed within 24 hours, divided by required acknowledgements | 85% | Rolling 30 days |
| Open shifts filled before start | Published open shifts that get an assignee before they start, divided by published open shifts | 80% | Rolling 30 days |
| Uncovered shifts | Shifts flagged uncovered by a manager (FR-021), divided by published shifts that have ended | Under 2% | Rolling 30 days |
| Trial-to-paid conversion | Trials that become ACTIVE within 7 days after trial end, divided by trials ended | 20% | Rolling 90 days |
| Monthly churn (businesses) | Businesses that cancel or reach READ_ONLY from non-payment in the month, divided by paying businesses at the start of the month | Under 5% | Monthly |
| Notification handoff | Notifications handed to the push service or sent by email within 1 minute of the event, divided by notifications sent | 99% | Rolling 30 days |
| Receipt-failure fallback | Push receipt failures with an email sent within 20 minutes, divided by push receipt failures | 99% | Rolling 30 days |
| Notification open rate | Push notifications opened within 24 hours divided by push notifications handed off | 50% | Rolling 30 days |
| Crash-free sessions | Sessions without a crash divided by all sessions | 99.5% | Rolling 30 days |

### Baseline

Each pilot manager's current time to build a weekly schedule is recorded in the pilot interview before they start using Rota. G1 and "Time to publish" are judged against that baseline.

### Instrumentation

- Events: `app_open`, `schedule_viewed`, `notification_opened`, `change_acknowledged`, `publish_started`, `publish_completed`.
- Tool: a product analytics service (PostHog). \[ASSUMPTION\]
- Consent wording goes in the privacy policy before pilots start.
- Database events (shift changes, swaps, invoices) are read from PostgreSQL. App opens and notification opens come from the analytics events.

### Reporting rule

Report a percentage only when the denominator is at least 20. Otherwise report the counts. \[ASSUMPTION\]

## 12. Assumptions

### Confirmed (given in the brief, treated as decided)

1. A person can belong to more than one business with one login.
2. Staff hold one or more positions. Shifts carry a position. Swaps only work between matching positions.
3. One location per team in the MVP. Multi-location is Phase 2.
4. Staff join by invite link plus a one-time code sent by email or SMS.
5. No web admin in the MVP. Staff can view the last synced schedule offline. Edits need a connection.
6. English only. One time zone per location. All times stored in UTC.
7. Shift fields: date, start, end, break length, position, location, notes, and an assigned staff member or open status.
8. Staff preferences are weekly availability, time-off requests, and a preferred maximum of weekly hours. They are advisory.
9. Swap flow and expiry as in FR-023 to FR-029. Expiry is 48 hours after creation or at shift start, whichever is first. **v2 adds a second 24-hour window for the manager decision after a colleague accepts. Pending owner approval, because it changes this assumption (Section 14, decision D3).**
10. A published shift change triggers a push notification and an acknowledgement.
11. Conflicts produce a warning. The manager can override.
12. Removed staff's future shifts become open shifts. Open shifts and time off are in the MVP.
13. Every active member, including managers, counts as a seat. Owner is free. 14-day trial with no card. 7-day grace period, then read-only.
14. Billing runs through web checkout, not in-app purchase.
15. Auth is email and password plus email one-time code, with JWT access and refresh tokens.
16. Expo push with email fallback. Push plus pull-to-refresh. No websockets in the MVP.
17. Data kept 24 months (FR-057 says what is deleted). Removed staff anonymized on request.
18. Non-goals: payroll, time clock, chat, POS integrations.

### Fallbacks used for open items you did not answer

| Open item | Fallback used |
| --- | --- |
| Launch country and currency | Nigeria, NGN only in the MVP (Sections 1, 8) |
| Price per seat | `SEAT_PRICE` placeholder, no number invented (Section 8) |
| Payment provider | Flutterwave only, as confirmed by the owner. Recurring charges still require a successful sandbox test before renewals are implemented. |
| Labor law rules | None enforced. Warnings only (Section 3, FR-015) |
| Use of AI | Phase 2 only, schedule drafting with a solver baseline (Section 6) |
| Compliance | Privacy policy, notification consent, and the Nigeria Data Protection Act 2023 (Sections 5.9, 9) |

### Added by this PRD

| Section | Assumption | How to validate | By when |
| --- | --- | --- | --- |
| 1 | The launch market is Nigeria, billed in NGN. | Owner interviews in Lagos. Payment sandbox test. | Before MVP-A build |
| 2 | Small teams use chat groups, paper, or spreadsheets. Local prices and availability of alternatives are not checked. | Owner interviews. Check each alternative's local price and availability. | Before MVP-A build |
| 3 | All goal targets are estimates, including G7. Labor laws are not enforced. | Compare to pilot data. | End of MVP-A pilot |
| 4 | The Owner pays, and the Manager decides whether the team adopts. | Ask pilot owners and managers who decided. | During MVP-A pilot |
| 5.1 | An email invite code verifies the email. Phone-invited people add and verify an email. New-device login needs an email code. Ownership transfer is support-assisted. Email is the default invite channel, SMS is optional, and a copyable link is always shown. | Pilot survey on how many staff lack email. Test the sign-up flow. | Survey before MVP-A build |
| 5.2 | Maximum shift length 24 hours. REST_GAP of 8 hours. Default weekly limit of 48 hours. Weeks run Monday to Sunday. Staff see the published team schedule. One summary notification per publish batch. Copy Week is in the MVP. Offline acknowledgements are queued. Short-notice changes (within 12 hours): remind at 1 hour, flag at 2 hours. | Pilot feedback. Check real shift lengths in the pilot. | During MVP-A pilot |
| 5.3 | Swaps only more than 2 hours before the shift. The Owner can approve their own swap when no other approver exists. A 24-hour manager window after a colleague accepts. | Pilot swap decision times. Owner approval of the expiry change. | Before FR-023 build |
| 5.5 | Time-off range of at most 60 days. Owner requests are auto-approved. Manager requests are approved by the Owner or another manager. | Pilot feedback. | During MVP-B |
| 5.6 | No availability windows means available at any time. The shift reminder is on by default and sent 2 hours before. | Pilot feedback on reminder timing. | During MVP-A pilot |
| 5.7 | The in-app inbox shows 90 days. | Pilot feedback. | During MVP-B |
| 5.8 | Checkout charges the first month, and the first paid period starts at trial end. Seat difference at trial end is charged on the first renewal if higher, with no credit if lower. Mid-period additions are prorated on the next invoice. Removals give no credit. The billing page is three server-rendered screens. Retries on days 0, 1, 3, and 5. A trial that ends with no payment is read-only at once. | Payment sandbox test. Owner interviews on billing. | Before MVP-B build |
| 5.9 | Account deletion anonymizes after 30 days. A deleted business is purged after 30 days. Records older than 24 months are deleted, and businesses are deleted 24 months after cancellation or last activity. | Legal advice. | Before pilots launch |
| 5.10 | A time zone change keeps wall-clock times. Shifts in two different businesses are not compared. | Pilot feedback. | During MVP-A pilot |
| 6 | AI is Phase 2 only. A solver is the baseline. A language model is added only if it beats the baseline. The solver runs as a separate small service or a JavaScript solver. Caps are set after cost is measured. A 70% keep rate is the product target. | An evaluation set of 20 schedules from pilots. | Phase 2 start |
| 7.1 | TypeScript, Expo Router, TanStack Query, `expo-secure-store`, `expo-notifications`, `expo-linking`, EAS Build and Update, BullMQ, Redis (Upstash acceptable), Postmark, Termii, Flutterwave, Sentry, PostHog, GitHub Actions, and the monorepo layout. A Prisma client extension for soft-deleted rows. The Phase 2 web framework is chosen later (Next.js is a candidate). | Spike each vendor. Test email and SMS delivery to Nigerian numbers and addresses. | Before MVP-A build |
| 7.3 | argon2id hashing. Redis-backed rate limiting and distributed locks; Upstash is an acceptable hosted Redis option. Device trust through `deviceId`. | Spike and load test. | Before MVP-A build |
| 7.4 | Expo receipts are fetched for tickets older than 15 minutes. Changes to shifts starting within 6 hours send push and email together. | Verify in Expo's docs. Test on real devices. | Before MVP-A build |
| 7.7 | Docker on a managed container platform with managed PostgreSQL. Region chosen by latency from Lagos. Single instance in the MVP. Workers can move to a separate process later. | Latency test from Lagos. Load test. | Before pilots launch |
| 7.8 | Backups kept 14 days. Point-in-time recovery for 7 days. Quarterly restore tests. Recovery point and time targets. | Restore test. | Before pilots launch |
| 7.9 | Year-1 capacity of 500 businesses and 10,000 members. Supported devices follow the Expo SDK minimums. App download under 40 MB. Under 5 MB of data per staff member per week. | Pilot device survey. Measure in the pilot. | Survey before MVP-A build |
| 8 | Billing anchor and short-month rule. Price snapshot per subscription. No price or purchase button in the app. One trial per verified email and per phone number. Tax, refund, and chargeback rules. Cost-per-seat variables. | Accountant. Legal advice. Measure costs in the pilot. | Before MVP-B build |
| 9 | The early-warning thresholds. | Review monthly in the pilot. | During the pilot |
| 11 | All metric targets. PostHog is the analytics tool. Gaps over 10 minutes are excluded from editing time. A minimum denominator of 20 for percentages. | Compare to the pilot baseline. | End of MVP-A pilot |
| 13 | Phases are ordered by scope, not dates. The MVP-A and MVP-B exit numbers, the web-view trigger (3 of 10 managers), and the stop rule (fewer than 5 of 10 businesses). | Review with your build capacity. | Before planning |

### Hidden assumptions now stated

| Assumption | How to validate |
| --- | --- |
| Staff own smartphones that run the app. | Pilot device survey. |
| Staff have email addresses, or will add one. | Pilot survey on email. |
| Managers can build a full week on a phone. | Prototype test: five managers each build a 40-shift sample week, and at least four finish in under 20 minutes. |
| Owners can pay online by card. | Owner interviews and the payment sandbox test. |
| Expo push is reliable on common Nigerian Android devices. | Test on a set of common devices. Track push failure rate by device model. |
| Apple and Google developer accounts can be created and kept active. | Set both up before the first store submission. |

## 13. Phased roadmap

Phases are ordered by scope, not by calendar date. \[ASSUMPTION\]

### Validation gates

| Gate | What must be true | Must pass before |
| --- | --- | --- |
| V1 Owner interviews | 10 owner interviews recorded: current method, hours per week spent scheduling, and willingness to pay at three price points | MVP-B build (run them before MVP-A so the baseline exists) |
| V2 Prototype test | Five managers each build a 40-shift sample week in a clickable prototype, and at least four finish in under 20 minutes | MVP-A build |
| V3 Device and email survey | Pilot staff report their phone model, OS version, and whether they have an email address | MVP-A build |
| V4 Payment sandbox test | Flutterwave is tested for recurring token charges with local cards | MVP-B build |
| V5 Legal and tax | Legal advice on the Nigeria Data Protection Act and retention. An accountant's view on tax and invoices | Pilots launch (legal), MVP-B build (tax) |
| V6 Margin check | Contribution margin per seat is above zero at `SEAT_PRICE` (Section 8) | MVP-B build |

### MVP-A (free pilot)

- Accounts, email verification, new-device codes, password reset.
- Create a business, one location, positions.
- Invites by link and code, by email and SMS.
- Draft, publish, edit, and cancel shifts. Conflict warnings. Copy Week.
- Acknowledgement of changes, including the short-notice rule.
- Swaps (DIRECT and POOL) with manager approval.
- Open shifts. Managers assign them directly. Claims come in MVP-B.
- Push notifications with email fallback, and an in-app inbox.
- Offline reading of the cached schedule.
- Uncovered-shift flag (FR-021).
- Analytics events (Section 11).

**Exit criteria:**

- 10 pilot businesses live.
- At least 6 publish a schedule every week for 4 consecutive weeks.
- Crash-free sessions at least 99%.
- Notification handoff at least 99%.
- Zero open severity-1 bugs.

### MVP-B (paid)

- 14-day trial, web checkout, per-seat monthly billing, retries, read-only mode, and the billing web page.
- Open-shift claims.
- Time-off requests.
- Availability and preferred hours.
- Audit log screen.
- Anonymization tools and business deletion.

**Exit criteria:**

- 20 pilot businesses live.
- At least 10 publish a schedule in 4 consecutive weeks.
- At least 3 are paying.
- Crash-free sessions at least 99%.
- Notification handoff at least 99%.
- Zero open severity-1 bugs.

### Triggers and stop rules

- **Web view trigger:** if 3 or more of the first 10 pilot managers name phone scheduling as the top friction, move the web schedule view from Phase 2 into MVP-B. \[ASSUMPTION\]
- **Stop rule:** if fewer than 5 of the 10 MVP-A pilot businesses publish weekly after 8 weeks, stop and re-interview before building MVP-B. \[ASSUMPTION\]
- **Severity-1:** the schedule cannot be viewed or published, notifications are not sent, or billing charges the wrong amount.

### Phase 2

- Multiple locations per business.
- Web schedule view for managers (unless moved into MVP-B by the trigger above).
- AI-assisted schedule drafting (Section 6).
- Calendar export (ICS).
- SMS notifications for urgent changes.
- Phone-number login with SMS codes, if the pilot survey shows the need.
- Bank transfer payment option.
- Ownership transfer in the app.
- Shift templates.
- Invoice PDFs.
- USD billing, only if a customer asks.

**Exit criteria:**

- 150 paying businesses.
- Monthly churn under 5% for 3 months.
- Median time to publish under 20 minutes.
- At least 30% of managers use the web view weekly.
- AI drafts: 0 hard-rule violations after validation and at least 70% of suggested shifts kept.

### Phase 3

- Web admin dashboard.
- Rule packs for local labor rules, with per-country settings.
- Availability as an optional hard constraint.
- CSV export of hours for external payroll tools (not payroll itself).
- Additional languages.
- Integrations through a public API.

**Exit criteria:**

- 500 paying businesses.
- Net revenue retention at or above 100%.
- At least 2 languages in production with a localization review.
- Public API with documentation and rate limits live.

## 14. Open questions

### Decisions made

| # | Decision | Applied in |
| --- | --- | --- |
| D1 | Launch in Lagos, NGN only. Add USD only when a customer asks. | FR-004, Section 8 |
| D2 | Paying during the trial keeps the trial days. The first month is charged at checkout, and the first paid period starts at trial end. | FR-047 |
| D3 | Swap expiry has two stages: 48 hours for the colleague (capped at shift start), then 24 hours for the manager (capped at shift start). **Pending your approval, because it changes confirmed assumption 9.** | FR-023 |
| D4 | No labor rules are enforced in the MVP. Warnings only. | Section 3, FR-015 |
| D5 | AI is Phase 2. A solver is the baseline. A language model is added only if it beats the solver. | Section 6 |
| D6 | A trial that ends with no payment goes read-only at once. | FR-053 |
| D7 | Staff see the published team schedule. | FR-017 |
| D8 | Removals give no credit in the MVP. | FR-049 |
| D9 | Ownership transfer is support-assisted in the MVP and in-app in Phase 2. | FR-011 |
| D10 | Email is the default invite channel. SMS is optional per invite. A copyable link is always shown. | FR-006 |
| D11 | The MVP is phone-first with a tablet-friendly week view. A web view trigger is set. | Section 13 |
| D12 | The owner is free even if the owner also works shifts. | Section 8 |

### Still open

| # | Question | Recommended answer | Owner | Deadline | If unanswered |
| --- | --- | --- | --- | --- | --- |
| 1 | What is the seat price, and is there a minimum number of billable seats? | Interview 10 pilot owners before setting a price. Consider a minimum of 5 billable seats. Do not set the price until pilot data is in. | You | Before MVP-B build | The margin check cannot run, and billing cannot launch. |
| 2 | Which payment provider? | Flutterwave is the only payment provider. Test recurring token charges for local cards in its sandbox before implementing renewals. | You, with the engineer | Before MVP-B build | Billing build is blocked. |
| 3 | Does the Nigeria Data Protection Act require registration for Rota? Can data be hosted outside Nigeria? Are the 24-month retention rules acceptable? | Get legal advice before the pilots launch. Do not assume. | Legal adviser | Before pilots launch | Pilot data may be held unlawfully. |
| 4 | Does current Apple and Google policy allow web-only billing for a business app? | Check before the first store submission. If needed, show no price or purchase link and describe billing only on the web. | You, with the engineer | Before first store submission | The app may be rejected. |
| 5 | How should VAT and invoices be handled? | Ask an accountant. Show prices without VAT until advised. | Accountant | Before MVP-B build | Invoices may be wrong. |
| 6 | Do you approve the two-stage swap expiry (D3)? | Approve. A swap accepted late should not expire before a manager can decide. | You | Before FR-023 build | Builders implement the old 48-hour rule only. |
| 7 | Is the refund and chargeback policy in Section 8 acceptable? | Accept it for the MVP and revisit after the first renewals. | You | Before MVP-B build | Billing support has no policy. |
| 8 | Which analytics tool, and what consent wording? | Use PostHog and add consent wording to the privacy policy. | You, with the legal adviser | Before pilots launch | Metrics cannot be computed. |
| 9 | How many pilot staff have no email address? | Ask in the device and email survey (V3). If more than 20% have none, add phone-number login in Phase 2. | You | Before MVP-A build | The Phase 2 login decision has no data. |
| 10 | How many people build this, and how much time do they have? | State it, so the MVP-A and MVP-B split can be dated. | You | Before planning | The roadmap cannot be given dates. |
