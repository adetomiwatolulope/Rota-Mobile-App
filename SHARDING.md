# SHARDING.md

## Current approach: Tenant isolation (no horizontal sharding)

Rota is currently designed for **tenant isolation by `businessId`** on every business-scoped query. All data is in a single Postgres 16 database. This matches the current scale and AGENTS.md constraints.

### How isolation works
- Role/membership checked on every request (A-1). Every business query scoped by caller's membership businessId (A-2).
- Prisma models are scoped by business where applicable; repositories enforce filters.
- Redis used for shared rate limiting, locks, and BullMQ (cross-instance safe) (S-9/S-10).
- Soft deletes and tenant boundaries prevent cross-tenant access.

## When sharding would be considered

Horizontal sharding may be considered if:
- A single business grows extremely large (beyond vertical scaling)
- Write/read volume exceeds single-DB capacity
- Compliance requires data residency per region

## Possible sharding strategies (future)
- **Shard by businessId** (hash/range) - most natural for this multi-tenant model. Requires routing layer, careful cross-shard queries (reports/analytics).
- **Read replicas** - easier first step for read scaling.
- **Citus/partitioning** - consider partitioning large tables (shifts, notifications) by `businessId` or time before full sharding.

## Notes
- Do **not** shard now. Keep tenant isolation as the primary boundary.
- Any sharding change must preserve all security rules (isolation, rate limiting, auditability).
