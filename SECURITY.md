# Rota security model

This document covers the MVP-A security controls required by the PRD. It is a
description of what the code does, not a claim that the controls replace the
legal, hosting, and payment reviews tracked in `AGENTS.md`.

## Threat model

### 1. Credential stuffing and password guessing

- Login, registration, email verification, device verification, Google
  sign-in, refresh, password forgot, and password reset are limited to **5
  requests per minute per IP and per email** by `authRateLimit`
  (`backend/src/middleware/rate-limit.ts`, PRD 7.3 / P-7).
- Counters live in Redis, so the limit is shared by every API instance
  (`S-10`). There is no in-memory fallback; a Redis failure is surfaced by the
  central error handler instead of silently disabling the limit.
- Passwords are hashed with argon2id (`P-1`). Login runs an argon2 hash even
  when the email does not exist, avoiding a user-enumeration timing difference.
- Email codes are six digits, expire after 10 minutes, and the 6th wrong entry
  consumes the code (`FR-001`, `P-4`). Invite codes have their own separate
  7-day / 5th-attempt rule (`FR-007`).

### 2. Stolen or replayed session tokens

- Access tokens are JWTs lasting 15 minutes and contain only `userId` and
  `sessionId` (`P-2`, `A-1`).
- Refresh tokens are opaque, lasting 30 days, stored only as SHA-256 hashes,
  and rotated on every use. Reusing an already-rotated token revokes every
  refresh token for that user (`P-2`, `auth.service.ts`).
- Logout revokes the calling session; logout-all revokes every refresh token.
- On the client, tokens are stored in `expo-secure-store`, never in plain
  AsyncStorage. Token refresh is single-flight so concurrent 401s cannot race
  and invalidate each other (`frontend/src/api/session.ts`).
- Mobile caches contain schedule data only and are cleared on logout or
  membership removal (`S-11`).

### 3. Broken access control / IDOR

- The server reads the caller's role from the `Membership` table on every
  request; no role is accepted from the client (`A-1`).
- Every business route resolves the business from the caller's membership, not
  from a body field (`A-2`). Child resources (`/members/:id`, `/shifts/:id`)
  resolve the owning business from the target row and then check the caller's
  membership there.
- A non-member receives the same `404 NOT_FOUND` as a missing resource, so
  business and member IDs cannot be probed.
- Capabilities are checked against the shared permission matrix on the server;
  hiding a mobile button is not treated as enforcement (`A-3`).
- Removing a member ends access on the next request because the membership is
  re-read and must be `ACTIVE` (`A-9`).

### 4. Cross-tenant data leakage

- Business-scoped queries include the business ID derived from the caller's
  membership (`A-2`); direct-by-id queries for members, invites, shifts, and
  notifications are checked against that business or the caller's user ID.
- The inbox endpoint filters by `req.session.userId`, never by a client-supplied
  user ID.
- The shift delete endpoint scopes its conditional delete by both `id` and
  `businessId`, so a stale or guessed ID cannot delete another tenant's row.
- Integration tests cover cross-business reads, role changes, deletes, and
  inbox isolation (`backend/src/security/security.test.ts`).

### 5. Malicious or malformed input

- Every boundary is validated with Zod: request bodies, query strings, provider
  payloads, and environment variables (`S-12`, `S-7`). Invalid input returns
  `400 VALIDATION` with field details; malformed JSON is also a 400, not a 500.
- `express.json` has a 256 KB limit, reducing oversized-body abuse.
- Prisma parameterizes database access. No raw SQL is built from request data.
- Error responses use one shape, `{ "error": { "code", "message" } }`, and never
  include stack traces (`S-1`).

### 6. Credential and PII exposure in logs

- `pino-http` uses custom request/response serializers that omit headers and
  strip query strings, so `Authorization` headers and invite tokens in URLs
  never reach the log (`P-5`).
- Logger redaction also covers passwords, password hashes, code hashes, token
  hashes, phone numbers, and payment token references.
- The API logs only delivery status and provider message IDs for email jobs; it
  does not log verification or reset codes during real delivery.
- The mobile app never receives provider secrets and never calls Flutterwave,
  Postmark, Termii, or other provider APIs directly (`S-4`).

### 7. Secret leakage through the mobile bundle

- Backend secrets are read only in `backend/src/config/env.ts` from
  `backend/.env`; `.env` is gitignored. `.env.example` documents names only.
- The mobile app reads only the three `EXPO_PUBLIC_` values listed below.
- A bundle inspection was run after `npx expo export --platform web`; the only
  API origin present was the configured API base URL. No database URL, JWT
  secret, SMTP password, Postmark token, Termii key, or Flutterwave key was
  present.

### 8. Denial of service and brute-force resource abuse

- Auth endpoints: 5/minute per IP and per email.
- Authenticated endpoints: 120/minute per user, including invite creation and
  resend (`P-7`). The limit runs before membership/database work.
- Public invite preview: 120/minute per IP.
- Redis holds all counters with a 60-second TTL; the increment and expiry run in
  one Lua script so a crash cannot leave a permanent blocking key.
- Payment endpoints do not exist in MVP-A. When billing is built in MVP-B, the
  same Redis limiter must be applied before any Flutterwave call.

## `EXPO_PUBLIC_` variables

Expo embeds every `EXPO_PUBLIC_` value in the shipped application bundle, so a
value is only allowed here if it is safe for an attacker to read.

| Variable | Why it is public |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | The base URL of the Rota API. Clients must know it to connect; it contains no credential. |
| `EXPO_PUBLIC_SITE_URL` | The public web origin used for canonical/Open Graph metadata. It is public by definition. |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | The public OAuth client ID used by Google sign-in. A client ID is not a client secret and is designed to be shipped in apps. |

No other `EXPO_PUBLIC_` variable is read by the app. Secrets belong in the API
environment only.

## Explicitly out of scope in MVP-A

- No billing, checkout, card entry, or Flutterwave code. Card data is never
  handled by Rota; MVP-B will use Flutterwave hosted checkout only (`M-4`,
  `M-5`, `L-7`).
- No audit-log screen or endpoint (`MVP-B`).
- No data purge or anonymization endpoints (`MVP-B`).
- TLS termination, WAF, database network isolation, backups, and secret
  rotation are deployment responsibilities and are tracked by the owner's
  hosting and legal reviews. The application still requires HTTPS in
  production and must never run with development secrets.
