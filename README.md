# Rota

Rota is a mobile app for small shift-based businesses in Nigeria - restaurants,
clinics, and retail stores. Owners create a team and invite staff, managers
publish shifts, and staff see their schedule and get notified of changes.
Businesses pay a monthly subscription per active seat.

This repository is the working MVP. The source of truth for product scope is
`docs/Rota_PRD_v2.md`; the rules for how the code is built are in `AGENTS.md`.
Do not edit either to fit the code - change the code to fit them.

## Current status

The project is in **MVP-A** (free pilot) with the billing foundation for MVP-B
built ahead of the phase gate at the owner's written direction.

### Implemented

| Area | What works |
| --- | --- |
| Accounts | Register, email verification, login, new-device email codes, password reset, Google sign-in, JWT access tokens, rotating refresh tokens, logout. |
| Team | Create a business with a location, invite by link and code (email or SMS), accept an invite, list members and invites, change roles, remove members. |
| Roles and safety | Server-side role checks, tenant isolation, Redis-backed rate limits, argon2id passwords, hashed tokens, log redaction, read-only status and error code (write enforcement is not fully wired yet). |
| Shifts | Draft shift deletion endpoint (the wider schedule UI and CRUD are not built yet). |
| Inbox | Cursor-paginated in-app inbox, unread count, mark read, 90-day window, offline cache. |
| Billing | Plan catalog, trial subscription created with a business, checkout sessions through Flutterwave hosted checkout, tokenized renewals, invoices, immutable ledger, webhook ingestion, retries, grace/read-only lifecycle, seat limits. |
| Push delivery | Expo push adapter, push-token registration/removal, push fan-out from BullMQ, grouped notification preferences, quiet hours and timezone enforcement, deep-link payloads. |
| Push on device | Permission prompt after sign-in, Android notification channel, Expo token registration with device id, token removal on logout, foreground handler, and tap routing to the inbox. |
| Settings | Server-owned settings (timezone, language, theme, quiet hours, notification groups), conflict handling, optimistic updates with rollback, foreground refetch on Android. |

### Not built yet

- Schedule screens and shift create/edit/publish/cancel/Copy Week on mobile.
- Swaps, open shifts/claims, time off, availability and preferred hours.
- Billing web pages (summary/pay, invoices, cancel) served by the API.
- Audit log screen.
- Data retention purge and anonymization tools.
- CI workflow files.

## Repository layout

```
rota/
  AGENTS.md                 build rules (read before changing code)
  docs/
    Rota_PRD_v2.md          product source of truth (read only)
    BILLING_PRORATION.md    billing formulas, ledger design, edge cases
    SETTINGS_COORDINATION.md settings sync and conflict rules
  backend/                  Express + TypeScript API under /v1
    prisma/                 schema and migrations (PostgreSQL 16)
    src/
      modules/              auth, businesses, members, invites, shifts,
                            notifications, billing, settings, audit, ...
      jobs/                 BullMQ producers and handlers
      middleware/           auth, membership, rate limit, errors, read-only
      providers/            Postmark, Termii, Expo, PostHog, Flutterwave
  frontend/                 React Native + Expo app (Android, iOS, web)
    app/                    Expo Router routes
    src/                    api client, features, components, theme, cache
  packages/shared/          Zod schemas, types, roles, error and warning codes
```

## Stack

- **Mobile:** React Native with Expo SDK 57, Expo Router, TypeScript, TanStack
  Query with a persisted AsyncStorage cache, `expo-secure-store`,
  `expo-notifications`, `expo-linking`.
- **API:** Node.js 24, Express, TypeScript, Zod, REST under `/v1`.
- **Data:** PostgreSQL 16 with Prisma Migrate; Redis for rate limits, caching,
  locks, and BullMQ job state.
- **Providers:** Flutterwave (payments), Postmark (email), Termii (invite SMS),
  Expo Push Service, PostHog (six analytics events), Sentry.
- **Money:** NGN only, integer kobo everywhere. No floating-point money.

## Getting started

### Prerequisites

- Node.js 24 (see `.nvmrc`)
- PostgreSQL 16
- Redis
- An Expo Go app or an Android/iOS device with a development build

### Install

```bash
npm install
```

### Configure

Copy the examples and fill in local values. Never commit a real `.env`.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

On PowerShell use `Copy-Item backend/.env.example backend/.env` and the same for
the mobile example.

Backend values that matter locally:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `REDIS_URL` | Redis connection string. |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | At least 32 characters each. |
| `SEAT_PRICE` | Price in kobo; keep unset until the owner confirms pricing. |
| `FLUTTERWAVE_*` | Sandbox keys for billing. Never use live keys in development. |

Mobile values:

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | API origin plus `/v1`, e.g. `http://192.168.1.20:4000/v1`. |
| `EXPO_PUBLIC_SITE_URL` | Public web origin for metadata. |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Same OAuth client as the API; empty hides Google sign-in. |

### Database

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

Create migrations with `npx prisma migrate dev --name <name>`. Never use
`prisma db push` outside a throwaway database and never edit an applied
migration.

### Run

```bash
# API
npm run dev:backend

# Workers (separate process)
npm run dev:worker --workspace=@rota/api

# Mobile (Android emulator or device)
npm run dev:frontend
```

On Windows PowerShell, `npm run dev:backend` and the workspace command above
are the supported entry points.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run typecheck --workspaces --if-present` | TypeScript across API, shared, mobile. |
| `npm run build --workspace=@rota/api` | Compile the API. |
| `npm run test --workspace=@rota/api` | Vitest integration and unit tests. |
| `npm run test --workspace=@rota/shared` | Shared package tests. |
| `npm run check` | Typecheck, lint, format check, and tests for every workspace. |
| `npx expo export --platform android` (in `frontend/`) | Verify the Android bundle builds. |
| `npx prisma validate` (in `backend/`) | Validate the schema. |

Integration tests run against a real PostgreSQL database; Prisma is never
mocked. Redis must be running for rate-limit tests.

## API overview

All routes are under `/v1`. The full list is in PRD Section 7.2. The routes that
exist today:

- `POST /v1/auth/*` - register, verify email, login, device verification,
  refresh, logout, password reset, Google sign-in.
- `GET/POST /v1/businesses`, `GET /v1/businesses/:id`.
- `GET /v1/businesses/:id/members`, `PATCH/DELETE /v1/members/:id`.
- `GET/POST /v1/businesses/:id/invites`, invite preview/accept, resend, revoke.
- `DELETE /v1/shifts/:id` - delete a draft shift.
- `GET /v1/notifications`, `POST /v1/notifications/:id/read`.
- `POST/DELETE /v1/push-tokens`.
- `GET/PUT /v1/settings`.
- Billing: `GET /v1/businesses/:id/subscription`, `GET .../billing/plans`,
  `POST .../billing/session`, `POST .../subscription/plan`,
  `POST .../subscription/cancel`, `GET .../invoices`.
- `POST /v1/webhooks/payments` - signature-verified, idempotent webhook.

## Billing notes

- Flutterwave is the only payment provider. All provider code lives in
  `backend/src/providers/payments/flutterwave/` behind a `PaymentProvider`
  interface.
- The app never renders a price, purchase button, or payment link. Billing is
  completed on Flutterwave's hosted page and managed through the API's billing
  pages.
- Amounts are integer kobo. Conversion to a provider amount happens only in
  `backend/src/lib/money.ts`.
- Plans are seeded by migration: Starter N2,000 / 5 seats, Team N5,000 / 15
  seats plus N300 per extra seat, Business N12,000 / 40 seats plus N200 per
  extra seat. Confirm final pricing (gate V6) before a paid launch.
- Recurring token charges have **not** been verified in a Flutterwave sandbox
  (gate V4). Do not enable live billing until that test passes.
- The ledger is append-only; a database trigger blocks updates and blocks
  deletes unless `rota.allow_ledger_purge = 'on'`.

## Settings and notifications

Settings are stored once per user in `UserSettings`. Every device reads them on
focus and when the app returns to the foreground. Writes are optimistic with
rollback. The server stamps `updatedAt`; a stale write is rejected with `409`.

Before sending a push, the worker checks the user's notification group toggles
and the quiet-hours window in the user's timezone. Non-urgent pushes are delayed
with BullMQ until quiet hours end; billing failures stay urgent. See
`docs/SETTINGS_COORDINATION.md` for the conflict rule and its known weakness.

## Security

Passwords use argon2id. Access tokens are short-lived JWTs; refresh tokens are
opaque, hashed, rotated, and revoked on reuse. Invite tokens and codes are
hashed. Every business query is scoped by the caller's membership. Logs redact
secrets. Card data never reaches Rota. See `SECURITY.md` for the threat model
and checks.

## Documentation

- `AGENTS.md` - build rules, locked choices, phase gates.
- `docs/Rota_PRD_v2.md` - product requirements (source of truth).
- `docs/BILLING_PRORATION.md` - proration, invoices, ledger, edge cases.
- `docs/SETTINGS_COORDINATION.md` - settings sync and conflict handling.
- `STATE.md` - where each piece of client data lives.
- `SECURITY.md` - security model and verification.

## Known limitations

- The local development database can become corrupt; migrations are validated
  against a clean PostgreSQL 16 cluster. Recreate `rota_dev` if Prisma reports
  `could not open file base/...`.
- `npm run lint` and `npm run format:check` require ESLint/Prettier configuration
  that is not in the repository yet.
- MVP-B gates V1, V4, V5 (tax), and V6 are not recorded as passed. Treat billing
  as sandbox-only.
- Push tokens need an EAS project id (`extra.eas.projectId`) and a development
  build. Expo Go no longer supports remote push on Android. Until the EAS project
  is linked, the app skips token registration and still works normally.
- Push taps for schedule, swaps, and billing open the inbox until those screens
  are built; the server already sends the target route in the payload.
