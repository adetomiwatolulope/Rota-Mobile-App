---
trigger: always_on
---

# Security Rules — Rota

## 1. Authentication and Authorization

- Treat every client, API request, background job, and external integration as untrusted until validated.
- Enforce authentication and authorization on the backend for every protected operation.
- Check the authenticated user's role, membership, business scope, and resource-level permissions before reading or modifying protected data.
- Never rely on hidden UI controls or mobile-side checks as the only authorization mechanism.
- Enforce the PRD's role and permission rules consistently across REST endpoints, background workers, and administrative operations.

## 2. Tenant and Personal Data Protection

- Every business-scoped read and write must be restricted to the authorized business and resource scope.
- Never expose one business's members, schedules, invitations, billing records, or other protected data to another business.
- Validate identifiers received from clients and verify ownership or authorized membership before using them.
- Collect, return, and log only the personal information required for the operation.
- Never send names, emails, phone numbers, or other direct identifiers to an AI provider when the PRD requires pseudonymization.

## 3. Secrets and Communications

- Store secrets in environment configuration or an approved secrets manager. Never hardcode them in source code or mobile bundles.
- Keep payment-provider secrets, database credentials, Redis credentials, and AI-provider keys on the backend.
- Use HTTPS for external and client-server communication in deployed environments.
- Never return secrets, authentication tokens, internal stack traces, or sensitive provider responses in API errors.

## 4. Input and Abuse Protection

- Validate request bodies, query parameters, path parameters, uploaded content, and external callback payloads.
- Apply shared rate limiting to sensitive and abuse-prone endpoints using the project's configured Redis-backed mechanism.
- Enforce authorization, validation, and appropriate size limits before performing expensive operations.
- Protect against replayed or duplicated requests where the operation could create duplicate records, trigger repeated notifications, or cause repeated financial effects.

## 5. Audit and Logging

- Record security-sensitive actions and other events required by the PRD with the appropriate actor, resource, timestamp, and outcome.
- Do not log passwords, full tokens, payment credentials, full AI prompts, or unnecessary personal information.
- Restrict access to operational logs and audit records according to their sensitivity.
- Never allow an ordinary user operation to alter or erase required audit history.

## 6. External Services and Background Jobs

- Verify payment webhook authenticity before processing payment events.
- Treat email, SMS, push, AI, Redis, and other provider responses as untrusted inputs.
- Re-check authorization and tenant scope when processing queued work; a job payload is not proof of permission.
- Ensure retryable jobs cannot bypass authorization, duplicate a protected action, or expose data across businesses.
- Fail safely when a required security check cannot be completed.