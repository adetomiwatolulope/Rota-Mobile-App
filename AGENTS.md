# AGENTS.md: Rota

Read this whole file before every task. Then read the PRD sections the task names.

This file tells you HOW to behave while building. The PRD tells you WHAT to build. If this file and the PRD disagree, stop and ask (see section 7).

Place this file at the repository root. Do not create other rule files that contradict it.

## Owner controls

Only the owner edits this block. Never edit it yourself.

| Control | Value |
|---|---|
| Current phase | **MVP-A** |
| PRD file (source of truth) | `docs/Rota_PRD_v2.md` |
| Payment provider | **Flutterwave** (confirmed by the owner) |
| Decision D3: two-stage swap expiry (FR-023) | **PENDING** |

Validation gates from PRD Section 13:

| Gate | Status |
|---|---|
| V1 Owner interviews (10) | Owner to confirm |
| V2 Prototype test (5 managers) | Owner to confirm |
| V3 Device and email survey | Owner to confirm |
| V4 Payment sandbox test (Flutterwave only) | Owner to confirm |
| V5 Legal and tax advice | Owner to confirm |
| V6 Margin check | Owner to confirm |

Gate rule: V2 and V3 must pass before MVP-A feature code. V5 (legal advice) must pass before pilots launch. V1, V4, V5 (tax), and V6 must pass before MVP-B billing code. If a gate your phase needs is not marked PASSED, say so in your first message and ask whether to proceed. Proceed only on a written yes.

Decision D3 rule: while D3 is PENDING, implement only the first stage of FR-023 (`expiresAt` is the earlier of 48 hours after creation and the shift start). Put the 24-hour manager window behind one named constant, off by default, and do not wire it in.

---

## 1. What is this project?

**Rota** is a mobile app (iOS and Android) for small shift-based businesses such as restaurants, clinics, and retail stores. An owner creates a team and invites staff. Owners and managers create and publish shifts. Staff see their shifts, request swaps, and get notified of changes. Businesses pay a monthly fee per seat.

**Users:** Owner (full control, manages billing), Manager (creates shifts, approves swaps), Staff (views shifts, requests swaps, sets availability).

**Market:** Nigeria. Currency NGN. Default time zone `Africa/Lagos`. Language English.

**Version being built:** two releases, in order.

- **MVP-A:** a free pilot. No billing.
- **MVP-B:** the paid release.

Build only the phase named in "Owner controls".

**Source of truth:** `docs/Rota_PRD_v2.md`. Never edit it. Never summarize it into new rules. Features reach you as tasks from the owner. This file never lists a feature to build.

### What belongs to each phase

MVP-A, build these:

- Accounts, email verification, new-device codes, password reset.
- Business, one location, positions.
- Invites by link and code, by email and SMS.
- Draft, publish, edit, and cancel shifts. Conflict warnings. Copy Week.
- Change acknowledgements, including the short-notice rule.
- Swaps (DIRECT and POOL) with manager approval.
- Open shifts. Managers assign them directly.
- Push with email fallback, and the in-app inbox.
- Offline reading of the cached schedule.
- The uncovered-shift flag.
- The six analytics events.

MVP-B, build these only when the current phase says MVP-B:

- Trial enforcement, web checkout, per-seat billing, retries, read-only mode, the billing web page.
- Open-shift claims.
- Time-off requests.
- Availability and preferred hours.
- The audit log screen and endpoint.
- Anonymization tools and business deletion.

---

## 2. What is locked?

Never change, swap, upgrade across a major version, or "improve" any item below. Never add a second tool that does the same job.

| Layer | Locked choice |
|---|---|
| Mobile | React Native with Expo, iOS and Android, TypeScript, Expo Router, TanStack Query with a persisted cache, `expo-secure-store`, `expo-notifications`, `expo-linking`, EAS Build and EAS Update |
| Backend | Node.js with Express, TypeScript, REST under `/v1`, Zod |
| Database | PostgreSQL 16 |
| ORM | Prisma with Prisma Migrate. Raw SQL migrations for partial unique indexes and CHECK constraints |
| Cache, rate limiting, locks | Redis; hosted free tier such as Upstash is acceptable |
| Payments | **Flutterwave** |
| Email | Postmark |
| SMS | Termii, for invites only |
| Push | Expo Push Service |
| Errors | Sentry (app and API) |
| Analytics | PostHog |
| Password hashing | argon2id |
| Background jobs | BullMQ, backed by Redis |
| Hosting | Docker container on a managed container platform, with managed PostgreSQL |
| CI | GitHub Actions |
| Repository | One monorepo: `apps/mobile`, `apps/api`, `packages/shared` |

**The database design is locked.** The Prisma schema and the raw SQL block in PRD Section 10 are the design.

### Locked rules

**L-1.** Never change a locked item. If a locked tool fails a test, stop and report. Do not substitute another tool.

**L-2.** Add a new dependency only when no locked tool covers the need. List every new dependency in your task report.

**L-3.** Create the full PRD Section 10 schema, plus the raw SQL constraints and partial unique indexes, in the first migration. Build features only for the current phase on top of it.

**L-4.** Never rename, remove, or retype any model, field, enum value, index, or constraint from Section 10. Never add one without the owner. Change the schema only through a new Prisma migration. Never edit a migration that has already been applied. Never use `prisma db push` except on a throwaway local database.


**L-4a.** Redis is locked for shared caching, rate limiting, and distributed locks. A hosted service such as Upstash is acceptable, including its free tier during development. Configure connection details through validated environment variables; never commit credentials.

**L-4b.** BullMQ is the only background job queue and runs on Redis. Do not use `pg-boss` or introduce a second queue. Keep job handlers idempotent, configure retries/backoff intentionally, and ensure workers can run separately from the API process.

### Flutterwave rules

The owner chose Flutterwave as the only payment provider. This decision overrides any unresolved or older payment-provider comparison in the PRD.

**L-5.** Use Flutterwave as the only payment provider. Never add Paystack, Stripe, or any other payment SDK or API.

**L-6.** Put all Flutterwave code in `apps/api/src/providers/payments/flutterwave/`. Expose it only through a `PaymentProvider` interface. Build one adapter, the Flutterwave adapter. Keep the interface so the owner can replace the provider later. Never build a second adapter.

**L-7.** Use only Flutterwave's hosted checkout and card tokenization. Never build your own card form.

**L-8.** Read the current Flutterwave documentation before you write any Flutterwave code. Never guess an endpoint, a field name, or a webhook signature header. If the documentation is unclear, stop and ask.

**L-9.** Use Flutterwave test mode in every environment except production. Staging uses a sandbox account. Never put live keys in the repository, in logs, or in the mobile app. Read keys from environment variables that start with `FLUTTERWAVE_`. List each name in `.env.example` with no value.

**L-10.** Before you build renewals (retries and token charges), run a Flutterwave sandbox test of a recurring charge with a tokenized card (gate V4). Report the result. If the test fails, stop. Do not switch provider and do not build a workaround.

**L-11.** Charge in NGN only through Flutterwave.

---

## 3. What must never happen?

**Breaking any rule in this section means the task has failed, even if the code runs and the feature works.** If you cannot do a task without breaking a rule, stop and ask.

Rules marked † are added by the architect to enforce the PRD's intent. The others come from the PRD, with requirement numbers in brackets.

### Money and billing

**M-1.** Store every amount in the smallest unit (kobo) as a whole number. Never use decimals or floating-point numbers for money. Anywhere. Ever. [PRD 7.2, Section 8]

**M-2.** Convert between kobo and the amount format Flutterwave expects only inside `apps/api/src/lib/money.ts`, and call that conversion only from the Flutterwave adapter. Use integer-safe math. †

**M-3.** Charge in NGN only. Reject every other currency. Keep `USD` in the enum, unused. [FR-004, decision D1]

**M-4.** Never touch card data. Card details are entered only on Flutterwave's hosted page. Never receive, store, log, or pass a card number. Store only the token reference in `providerPaymentTokenRef`. [FR-047, PRD 7.8]

**M-5.** Never show a price, a purchase button, or a payment link inside the mobile app. The app opens a one-time web link and nothing else. Never build in-app purchases. [Section 8 "Store rules", FR-047, FR-050]

**M-6.** Never hard-code a price. Read `SEAT_PRICE` from configuration and copy it into `Subscription.seatPriceMinor` when a subscription starts. Never invent a number. If `SEAT_PRICE` is not set, stop and ask. [Section 8]

**M-7.** Count seats only from SeatPeriod rows that are open at period start. Never count from `activatedAt` or `removedAt`. Managers count as seats. The Owner does not. Pending invites and removed members do not. [FR-048, Section 10]

**M-8.** Bill each member once per billing period. If a member is removed and re-added in the same period, add no second charge. Prorate seats added mid-period as seat price x remaining days / days in period, rounded to the nearest minor unit, as a PRORATION line on the next invoice. Give no credit for removals. [FR-049]

**M-9.** Open a SeatPeriod when a member activates. Close it when the member is removed. Reactivate a removed member by reusing the same membership row and opening a new SeatPeriod. Keep the partial unique index that allows one open SeatPeriod per membership. [FR-007, FR-010, Section 10]

**M-10.** Never mark an invoice PAID from a webhook alone. For every payment webhook, in this order:
1. Verify the signature using the method in the current Flutterwave documentation.
2. Insert a `PaymentEvent` row first. If the (provider, providerEventId) pair already exists, return 200 and do nothing.
3. Check that the amount, currency, and transaction reference match the invoice. †
4. Use Flutterwave's transaction verification if the current documentation provides one. †
5. Process the event, then set `processedAt`.

[PRD 7.2 "Webhook rule"]

**M-11.** Apply the trial and renewal rules exactly. [MVP-B only]
- The trial lasts 14 days with no card. Allow one trial per verified email and per phone number. [FR-046, Section 8]
- Checkout charges the first month. The first paid period starts at trial end, or on the payment date if the trial has already ended. [FR-047]
- A trial that ends with no payment becomes READ_ONLY immediately. [FR-053]

**M-12.** Retry a failed renewal on days 0, 1, 3, and 5 after `Invoice.dueAt`. Keep full access (PAST_DUE) for 7 days from `dueAt`. After that, set READ_ONLY. [FR-051, MVP-B only]

**M-13.** In READ_ONLY, reject every write with HTTP 402 and code `SUBSCRIPTION_READ_ONLY`. Still allow viewing schedules, acknowledging changes, and billing actions. [FR-052, MVP-B only]

### Access and roles

**A-1.** Read the caller's role from the membership table on every request. The access token holds only the user ID and session ID. Never trust a role sent by the client. [PRD 7.3]

**A-2.** Scope every business query by the business ID taken from the caller's membership. Never use a business ID from the request body alone. [PRD 7.3]

**A-3.** Enforce the permission matrix in PRD 7.3 on the server. Hiding a button in the app is not enforcement.

**A-4.** Enforce the role limits. [FR-006, FR-009, FR-010, FR-011]
- Managers cannot change roles.
- Managers cannot remove Managers or the Owner.
- Managers can invite Staff only. Only the Owner can invite a Manager.
- The Owner role cannot change. The Owner cannot leave a business.

**A-5.** Assign a shift only to a member who holds the shift's position. Allow no override. [FR-014]

**A-6.** Handle conflict warnings (FR-015) in one way. Return the warnings. Proceed only when the manager confirms with an override flag. Write every override to `AuditLog`. Never block silently. Never pass silently. [Section 5 intro]

**A-7.** Never show DRAFT shifts to Staff. Show an open shift only to members who hold its position. [FR-017, FR-030]

**A-8.** Never let the requester or the accepting colleague approve their own swap. The only exception is FR-028. Never let a manager edit another member's availability. [FR-028, FR-041]

**A-9.** End a removed member's access on the very next request. Turn their future published shifts into open shifts. Cancel their active swaps and claims. [FR-010]

### Data safety

**D-1.** Store every instant in UTC. Store the IANA time zone on the location. Store availability as location-local minutes (the end may pass midnight, up to 2880). Store time off as location-local dates. [Section 12 item 6, Section 10]

**D-2.** Require the current `version` in an `If-Match` header on every shift edit. Return 409 on a stale version. Increment `version` and create a ShiftChange on every edit. [FR-019]

**D-3.** Run swap and claim decisions (accept, approve, reject) as one conditional update that only succeeds from the expected status. If no row changes, return 409. Never read first and write after. [FR-024, FR-025, FR-032]

**D-4.** Allow one active swap per shift. Follow the swap states and transitions in PRD 5.3 exactly. [Section 10 SQL]

**D-5.** Never edit a shift that has ended. The only exception is setting `uncoveredAt`. [FR-021]

**D-6.** Create every raw SQL constraint and partial unique index from PRD Section 10. Never skip one because Prisma cannot express it. [Section 10]

**D-7.** When you purge data, delete children first, in the fixed order in FR-057, inside one transaction per business. Never rely on cascade order. Never hard-delete a membership outside the purge. [FR-057, Section 10 "Deletion rules"]

**D-8.** Hide soft-deleted rows with a Prisma client extension that filters `deletedAt` for User, Business, and Location. Never rely on each query remembering to filter. [Section 10]

**D-9.** Delete data on the 24-month schedule in FR-057. Never invent another retention period. [FR-057]

### Privacy and security

**P-1.** Hash passwords with argon2id. Hash invite tokens, invite codes, auth codes, and refresh tokens. Never store any of them in plain text. [PRD 7.3, Section 10]

**P-2.** Issue access tokens as JWTs that last 15 minutes. Issue opaque refresh tokens that last 30 days and rotate on every use. If a rotated token is used again, revoke the session. [PRD 7.3]

**P-3.** Treat a device as known only when a Device row exists for the user and the app's `deviceId` with `trustedAt` set. An unknown device needs an email code, and a valid code sets `trustedAt`. [FR-002]

**P-4.** Apply the code limits exactly as written. Email codes last 10 minutes, and the 6th wrong code invalidates the code [FR-001]. Invites last 7 days, and the 5th wrong code locks the invite [FR-006, FR-007]. Do not make the two limits match.

**P-5.** Never log passwords, codes, tokens, phone numbers, or card data. [PRD 7.8]

**P-6.** Never commit secrets. Never put a provider secret in the mobile app. Read secrets from environment variables. `.env.example` lists names only. [PRD 7.7]

**P-7.** Apply rate limits: auth endpoints 5 per minute per IP and email, other endpoints 120 per minute per user, using Redis-backed shared counters. [PRD 7.3]

**P-8.** Send only the six analytics events in PRD Section 11 (`app_open`, `schedule_viewed`, `notification_opened`, `change_acknowledged`, `publish_started`, `publish_completed`). Never attach a name, email, or phone number to an event. †

**P-9.** Anonymize a removed member by setting `displayName` to "Former member" and clearing contact fields. Keep shift history. [FR-055, MVP-B only]

### Changes and notifications

**N-1.** Require acknowledgement for changes to time, assignee, or cancellation. Do not require it for notes-only changes. [FR-019]

**N-2.** Send push first. Send email at once when the user has no active push token, when the push ticket errors, or when a receipt reports failure. When a shift starts within 6 hours of the event, send push and email together. Fetch receipts every 5 minutes for tickets older than 15 minutes. [FR-044, PRD 7.4]

**N-3.** For a change made within 12 hours of the shift start, remind after 1 hour and flag to managers after 2 hours. Otherwise remind at 12 hours and flag at 24 hours. [FR-022]

**N-4.** Send only the notification events in the PRD 5.7 table. Never add a type.

### Scope

**X-1.** Build only the current phase. Never build ahead.

**X-2.** Never build a non-goal: payroll, time clock, chat, POS integrations, a web admin dashboard, labor-law enforcement, in-app purchases, multiple locations, languages other than English, or currencies other than NGN. [PRD Section 3]

**X-3.** Never build or scaffold Phase 2 or Phase 3 items. That includes AI drafting (no `ScheduleDrafter`, no language model SDK), calendar export, urgent-change SMS, phone-number login, bank transfer, in-app ownership transfer, shift templates, invoice PDFs, a web schedule view (unless the owner moves it into MVP-B in writing), and the public API. Never add placeholder screens or empty folders for them. [PRD Section 13]

**X-4.** Never add an endpoint, table, field, enum value, screen, notification type, environment variable, or dependency that the PRD does not contain.

**X-5.** When a requirement touches MVP-B data, build only its MVP-A part. In MVP-A, FR-015 returns OVERLAP, REST_GAP, and OVER_MAX_HOURS (use the 48-hour default). It returns OUTSIDE_AVAILABILITY and ON_TIME_OFF only in MVP-B. †

**X-6.** In MVP-A, create the `Subscription` row when a business is created (FR-004), but enforce nothing: no trial expiry, no read-only mode, no checkout, no billing page. Still write `AuditLog` rows for overrides, role changes, and removals. †

---

## 4. How is the work arranged?

Use this layout. Do not invent a different one.

```
rota/
  AGENTS.md
  package.json              # npm workspaces and the root scripts
  .nvmrc                    # Node.js Active LTS
  .env.example              # names only, no values
  docs/
    Rota_PRD_v2.md          # read only
  apps/
    api/
      prisma/
        schema.prisma
        migrations/         # Prisma migrations and the raw SQL ones
      src/
        main.ts             # starts the HTTP server
        worker.ts           # starts the BullMQ workers
        config/env.ts       # the only place that reads environment variables
        middleware/         # auth, membership, rate limit, errors, request ID, read-only gate
        modules/            # one folder per domain
          auth/ businesses/ members/ invites/ positions/
          shifts/ swaps/ claims/ time-off/ availability/
          notifications/ billing/ audit/
          # each module: *.routes.ts, *.service.ts, *.repository.ts, *.test.ts
        billing-web/        # server-rendered billing pages (MVP-B)
        providers/
          payments/flutterwave/
          email/postmark/
          sms/termii/
          push/expo/
          analytics/posthog/
        jobs/               # BullMQ job handlers and schedules
        lib/                # errors, logger, time, money, constants
      test/                 # integration test helpers
    mobile/
      app/                  # Expo Router routes
      src/
        features/           # one folder per domain, mirroring the API modules
        components/
        api/                # the typed client for the Rota API
        cache/              # persisted cache and the offline acknowledgement queue
        analytics/
        lib/
        theme.ts
  packages/
    shared/
      src/                  # Zod schemas, types, constants (roles, error codes, warning codes)
  .github/workflows/
```

### Architecture rules

These are hard rules. Breaking one fails the task, like the rules in section 3.

**S-1.** Keep four layers in the API: route, then Zod validation, then service, then repository. Routes stay thin. Services hold every business rule. Only repositories import the Prisma client. Never put a business rule in a route handler or in the mobile app. The server is the authority. The app may pre-check for convenience only.

**S-2.** Run heavy and slow work in BullMQ workers, never inside a request. That includes notification delivery, receipt polling, reminders, acknowledgement reminders, swap expiry, trial reminders, invoice generation, payment retries, grace expiry, and the purge. Request handlers only enqueue. Start workers from `worker.ts` so they can move to a separate process later. [PRD 7.6, 7.7]

**S-3.** Only code under `providers/` may import a provider SDK or call a provider's HTTP API (Flutterwave, Postmark, Termii, Expo push, PostHog). Put each behind an interface. Services depend on the interface, never on the SDK.

**S-4.** The mobile app talks only to the Rota API, plus PostHog events. The mobile app never calls Flutterwave, Postmark, or Termii, and never holds a provider secret.

**S-5.** Only `modules/billing` calculates seats, proration, invoices, and subscription status. Keep one seat-count function. No other module does money math.

**S-6.** Keep one conflict-warning function in `modules/shifts`. Call it from assign, edit, swap approval, claim approval, and Copy Week. Never copy its logic.

**S-7.** Put Zod schemas, shared types, error codes, and warning codes in `packages/shared`. Never duplicate them in an app.

**S-8.** Serve the billing web page as server-rendered HTML from `apps/api`: three screens (summary and pay, invoices, cancel), reached by a one-time link. Never build a separate web app. Never add a web framework or a single-page app. [FR-050]

**S-9.** Keep no state in process memory that must survive a request or be shared between requests. That includes rate limits, sessions, job state, and permission caches. The API must work with two instances.

**S-10.** Never add websockets. Redis is an approved infrastructure dependency and must be used for caching, shared rate limiting, distributed locks, and BullMQ job state. Do not use in-memory substitutes for cross-request or cross-instance coordination.

**S-11.** On mobile, cache shifts from 7 days back to 14 days ahead, plus the member list and the inbox. Allow offline reading only. Block offline writes, except acknowledgements, which are queued and sent on reconnect. Clear the cache on logout and when a membership is removed. [PRD 7.5]

**S-12.** Read environment variables only in `config/env.ts`, validated by Zod at startup. Never read `process.env` anywhere else.

**S-13.** Put every PRD number (15 minutes, 48 hours, 2 hours, 6 hours, 12 hours, 24 hours, 7 days, 14 days, 24 months) in one named constants file, with the FR number in a comment. Never repeat a number inline.

---

## 5. How should the code look?

The code must be clean, readable, and modern, and it must sit on LTS versions.

### Versions

- **Node.js:** pin the Active LTS release in `.nvmrc` and in `engines`. At the time this file was written that is Node.js 24. Check nodejs.org before pinning. Never use a Current (non-LTS) release.
- **Expo:** use the latest stable SDK when you scaffold, and pin it. Upgrade only when the owner asks.
- **PostgreSQL:** version 16 (locked).
- **Dependencies:** pin exact versions through the lockfile. Never use alpha, beta, or canary versions. Never add a deprecated package. Report any high-severity `npm audit` finding in your task report.

### TypeScript

- Turn on `strict` and `noUncheckedIndexedAccess`.
- Never use `any`. Never use `@ts-ignore`. Use `@ts-expect-error` only with a one-line reason.
- Use ES modules and `import type` for types.
- Use ESLint (`typescript-eslint` type-checked rules) and Prettier. Let the tools format. Never format by hand.

### Shape of the code

- Write small functions that do one job. Keep functions under about 40 lines and files under about 300.
- Use early returns. Avoid nesting deeper than three levels. Never use nested ternaries.
- Use `async` and `await`. Never leave a promise unhandled.
- Name files in `kebab-case`, components and types in `PascalCase`, and constants in `UPPER_SNAKE_CASE`. Name booleans `is`, `has`, or `can`. Use the exact names from the Prisma schema.
- Use named exports. Avoid default exports except where Expo Router requires them.
- Use Luxon for all date and time work. Never do time-zone arithmetic with raw `Date` math. Never parse dates from strings by hand. (Architect's choice, not in the PRD.)

### Errors, validation, logging

- Throw `AppError(code, httpStatus, message)`. Handle it in one central error middleware. Return `{ "error": { "code": "...", "message": "..." } }`. Define error codes in `packages/shared`. Never leak stack traces.
- Validate every boundary with Zod: requests, environment variables, provider payloads, and webhooks.
- Log with `pino` as JSON with a request ID. Never use `console.log` in the API. Never ship `console.log` in the mobile app.

### Comments and commits

- Write comments that explain why, never what. Cite the FR number where a rule is implemented.
- Never leave commented-out code. Never leave a `TODO`. If something is missing, follow section 7.
- Make small commits in conventional style, with the FR number: `feat(shifts): add conflict warnings (FR-015)`. Never commit `.env`.

### Mobile

- Write function components with hooks. Use Expo Router. Use TanStack Query for server data.
- Never add Redux or another global store.
- Keep colours, spacing, and type sizes in `theme.ts`. Never scatter inline styles.
- Give every interactive element an accessibility label.

### Tests

- Use Vitest for `apps/api` and `packages/shared`. Use Jest with `jest-expo` for `apps/mobile`.
- Run integration tests against a real PostgreSQL database in Docker. Never mock Prisma.
- Write at least one test for every rule ID in section 3 that your task touches. Put the rule ID or FR number in the test name.
- Always include these two tests from the PRD: a purge of a seeded business with 1,000 shifts, and a member removed and re-added inside one billing period. [PRD 7.8]
- Never skip, delete, or weaken a test to make the build pass.

---

## 6. What counts as done?

A task is done only when every item below is true.

1. Every requirement the task named is implemented and has a passing test.
2. Every rule in sections 2, 3, and 4 is kept.
3. These commands all pass with zero errors and zero warnings you introduced. Run them and show the results:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run format:check`
   - `npm test`
   - `npm run build` (API and shared)
   - `npx prisma validate` and `npx prisma migrate deploy` against a clean database
   - `npx expo export` for the mobile app
4. `npm run check` runs all of the above. Create these scripts the first time they are missing.
5. You added nothing outside the task: no new feature, endpoint, table, field, screen, or dependency.

If any command fails, the task is not done. Report the failure and its output. Never disable a check to get a pass. Never say "done" with a failing command.

### Always end every task with this report

```
## Task report
Task: <name>
Phase: <MVP-A or MVP-B>

### Requirements met
- [x] FR-0xx <one line> (evidence: <test name or command>)

### Requirements not met or deferred
- [ ] FR-0xx <one line> (reason)

### Rules check
Rules touched: <rule IDs, each with how you checked it>
All other rules: not touched

### Commands run
- npm run check: <passed or failed, with output if failed>

### Files changed
- <paths>

### New dependencies
- none, or <name, why, which locked tool did not cover it>

### Questions for the owner
- none, or <list>
```

If any box is unchecked, say so plainly. Never tick a box you did not verify.

---

## 7. What do you do when unsure?

Never guess. Never invent scope. Never write spaghetti to get around a gap.

### The procedure

1. Re-read the PRD section the task names. If the PRD answers the question, follow it.
2. If the PRD is silent, ambiguous, or contradicts itself, or two rules conflict, **stop** that part of the work.
3. Write a "Question for the owner": the question, the two or three options, and your recommendation.
4. Keep working only on parts the question does not affect. Never fill the gap with your own choice.

### Never do these

- Never add a feature, endpoint, table, field, screen, notification type, environment variable, or dependency that the PRD does not contain.
- Never build ahead into a later phase "to save time".
- Never fix a PRD inconsistency by picking a side. Report it.
- Never write a workaround, a hack, a copy-pasted duplicate, a stub with fake data, or a try/catch that swallows errors.
- Never silence a type error with a cast or `any`.
- Never leave commented-out code or a `TODO`.
- Never swap a locked tool when it fails or is hard to use. Stop and report.

### Known open items

Stop and ask if the task depends on any of these:

- The value of `SEAT_PRICE` and any minimum number of billable seats.
- Decision D3 (two-stage swap expiry). Use the D3 rule in "Owner controls".
- VAT treatment and invoice wording (accountant).
- The refund and chargeback policy wording.
- Legal advice on the Nigeria Data Protection Act, hosting location, and the 24-month retention rules.
- Whether Apple and Google policy allows web-only billing (before the first store submission).
- The consent wording for analytics.
- Any gate in "Owner controls" that is not marked PASSED.

### Known inconsistencies (report, do not fix)

- FR-001 invalidates a code on the 6th wrong attempt. FR-007 locks an invite on the 5th. Build both as written.
- Flutterwave is the locked payment provider. Complete the recurring-charge sandbox test (L-10) before building renewals.
