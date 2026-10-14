
---
name: api-route-scaffolder
description: Use whenever an API route, endpoint, route handler, or server action is created or edited. Enforces Rota's ordered request checks and thin-handler architecture.
---

# API Route Scaffolder

## Trigger
Any new or edited route, endpoint, Express handler, or server action.

## Before editing
1. Read `AGENTS.md` in full and the relevant PRD endpoint, FR, and permission-matrix sections.
2. Check current phase and validation gates. If a required gate is not PASSED, say so first and ask whether to proceed; proceed only on written yes.
3. Check whether the endpoint is explicitly in the PRD. Do not invent endpoints, response fields, error codes, notification types, or dependencies.

## Opening ritual — exact order
Every protected handler must follow this order:
1. **Session:** authenticate the session and identify the caller. The access token carries only user ID and session ID. Reject invalid/revoked sessions.
2. **Input:** validate all request boundaries with the shared Zod schema from `packages/shared` (path, query, body, and relevant headers such as `If-Match`). Return a structured validation error.
3. **Ownership:** load the caller's membership and role from the database for every request; derive business scope from that membership. Never trust a client-supplied business ID or role. Enforce the PRD permission matrix on the server.
4. **Limits:** apply Redis-backed rate limits and any explicitly applicable phase/plan/write gate. Auth endpoints: 5/minute per IP and email; other endpoints: 120/minute per user. Use shared Redis counters, not process memory.

Do not reorder these checks. For public auth routes, apply the applicable session behavior defined for that route rather than fabricating an authenticated session requirement; preserve the same explicit validation and limit requirements.

## Thin-handler discipline
- API layers are route → Zod validation → service → repository. Routes orchestrate only; services own business rules; only repositories import Prisma.
- Routes must not contain business rules, money math, direct Prisma calls, provider SDK calls, or slow work.
- Throw `AppError(code, httpStatus, message)` and let the central error middleware return `{ "error": { "code": "...", "message": "..." } }`. Never leak stack traces or swallow errors.
- Define shared schemas, types, error codes, and warning codes in `packages/shared`; do not duplicate them in apps.
- Slow work is enqueued to BullMQ; workers start from `apps/api/src/worker.ts`. Never do notification delivery, polling, reminders, expiry, retries, or purge inside a request.
- Writes that can be retried must be idempotent. State-machine decisions use one conditional update from the expected state; if no row changes, return 409. Never read first and then write.
- Shift edits require the current `version` in `If-Match`; stale versions return 409. Never edit ended shifts except setting `uncoveredAt`.
- Every business query is scoped by the business ID derived from caller membership. Read the current role from membership every request.

## R31 blocked-message pattern
The supplied `Rota_PRD_v2.md` and `AGENTS.md` do not define R31 or its blocked-message wording. Do not invent the text, status, or response shape and do not claim compliance based on a guess. Before implementing a behavior described as “R31 blocked-message pattern,” ask the owner to provide the authoritative R31 rule or point to its source. Until then, implement only independently specified route behavior and leave the R31-dependent portion blocked.

## Tests and completion
- Test access denial, malformed input, ownership/business isolation, rate limits, and route-specific FR/rule IDs.
- Do not mock Prisma in integration tests; use real PostgreSQL in Docker.
- Run `npm run check` and the individual required commands in AGENTS.md; report actual results.
- End with the AGENTS.md task report. Never mark unchecked requirements or commands as passed.
