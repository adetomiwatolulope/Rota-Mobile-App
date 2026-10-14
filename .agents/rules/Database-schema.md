---
trigger: always_on
---

# Database Schema Rules — Rota

## 1. Source of Truth

- The Rota PRD and the existing approved Prisma schema are the source of truth for entities, fields, relationships, enums, and business constraints.
- Do not invent, rename, remove, or reinterpret schema fields or business entities without explicit authorization.
- Use PostgreSQL 16 and Prisma as specified in the project architecture.
- Use Prisma Migrate for schema changes. Use reviewed SQL migrations when Prisma cannot express a required PostgreSQL constraint or index.

## 2. Data Integrity

- Enforce critical business invariants in PostgreSQL wherever possible; do not rely solely on application-level validation.
- Use foreign keys, unique constraints, check constraints, and appropriate indexes to enforce the approved data model.
- Enforce shift-assignment and scheduling conflict rules at the database layer where the PRD requires them.
- Use database transactions for multi-step operations that must succeed or fail together.
- Protect concurrent writes against stale updates and conflicting state transitions using the concurrency controls defined by the PRD.
- Never use a read-then-write sequence as the only protection against concurrent requests that could violate a uniqueness or scheduling rule.

## 3. Tenant Isolation

- Scope business-owned records and queries to the authenticated user's authorized business or membership.
- Never trust a business, location, or user identifier supplied by a client without checking access.
- Ensure background jobs and scheduled tasks apply the same tenant boundaries as ordinary API requests.
- Treat Redis caches and job payloads as potential cross-tenant data exposure points. Include the appropriate tenant scope in cache keys and job context.

## 4. Schema Changes and Data Preservation

- Never drop, rename, or destructively alter existing production data as an incidental part of a feature.
- Use backward-compatible migrations when old and new application versions may overlap during deployment.
- Provide a safe data migration when a schema change requires existing records to be transformed.
- Do not edit an already-applied migration to change production history; create a new migration.
- Keep seed data deterministic and separate from production data.

## 5. History and Deletion

- Preserve schedule-change history and other audit records required by the PRD.
- Do not overwrite or delete historical records that the PRD requires for auditability.
- Apply the approved soft-deletion policy for User, Business, and Location records, including the `deletedAt` behavior specified by the architecture.
- Ensure ordinary queries do not unintentionally expose soft-deleted records.

## 6. Money and Time

- Store monetary values in integer minor units, such as kobo or cents, with the applicable currency.
- Never use floating-point values for persisted or calculated monetary amounts.
- Store timestamps consistently in UTC and convert them to the relevant business or user time zone for display and scheduling.
- Preserve the distinction between an event's recorded time and its business-effective time when the PRD requires both.

## 7. Indexes and Verification

- Add indexes based on actual query patterns, foreign keys, uniqueness requirements, and documented performance needs.
- Do not add indexes indiscriminately without a query or constraint that justifies them.
- Test migrations against a representative database and verify important constraints, existing data, and rollback or recovery implications before release.