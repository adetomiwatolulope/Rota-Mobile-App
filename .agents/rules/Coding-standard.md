---
trigger: always_on
---

# Coding Standards — Rota

## 1. Locked Implementation Rules

- Follow the stack and repository structure defined in `AGENTS.md` and the Rota PRD. Do not introduce replacement frameworks or libraries without explicit authorization.
- Use TypeScript for the mobile app, API, and shared TypeScript modules.
- Keep API business logic in domain/service modules rather than Express route handlers.
- Validate all external inputs at system boundaries, including API requests, environment configuration, webhook payloads, and background-job payloads.
- Never use `any` to bypass a type error when a safe, specific type can be defined.
- Reuse shared types and validation schemas where the mobile app and backend share the same contract.

## 2. API Contracts

- Keep REST endpoints under `/v1` and follow the endpoint contracts defined in the PRD.
- Use consistent success and error response formats. Do not return a successful response for a failed operation.
- Use appropriate HTTP status codes and stable machine-readable error codes.
- Use ISO 8601 UTC timestamps for API date-time values.
- Use cursor pagination for list endpoints where specified by the PRD.
- Never expose database records directly when the API contract requires a specific response shape.

## 3. Business Logic

- Enforce authorization and business rules on the backend. Mobile-side checks are for user experience, not security.
- Implement shift, invitation, approval, swap, and other workflow transitions according to the PRD.
- Reject invalid state transitions rather than silently correcting or ignoring them.
- Make retryable write operations idempotent where required by the PRD.
- Do not silently change existing business behavior while implementing an unrelated feature.

## 4. Error Handling

- Handle expected failures explicitly and return safe, actionable errors.
- Do not expose stack traces, secrets, internal prompts, credentials, or sensitive database details to clients.
- Log sufficient context to diagnose failures without logging passwords, tokens, payment credentials, or unnecessary personal data.
- Never swallow an error if doing so could leave a workflow in an inconsistent state.

## 5. Verification

- Add or update tests for new business rules, error paths, and regressions.
- Before declaring a task complete, run the relevant lint, type-check, and test commands defined by the repository.
- Do not claim that a test, build, deployment, or external integration succeeded unless it was actually verified.
- If a requirement is ambiguous or conflicts with the PRD, stop and identify the conflict instead of inventing behavior.