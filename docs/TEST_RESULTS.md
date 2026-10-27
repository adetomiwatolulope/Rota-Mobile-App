# Test Results

Date: 2026-10-26

## API tests (npm test --workspace=@rota/api)
- **Test Files:** 8 passed (8)
- **Tests:** 54 passed (54)
- **Duration:** ~39.11s

### Highlights
- Auth/session: refresh token rotation, reuse revocation, logout (single/all), password reset (P-2, FR-002, FR-003)
- Team/business: create business+location+owner+trial subscription (FR-004), business scoping (A-2), member removal affects access (A-9), role limits (A-4), invite flow with hashing/locks/resend (FR-006/007/008, P-1, P-4)
- Security: draft shift deletion permissions (A-3, FR-019), cross-business isolation returns 404 (A-2), Redis rate limiting 120/min per user (P-7)
- Billing/invites/notifications/auth paths covered by passing tests

## Permissions, team isolation, and proration
- **Permissions/roles**: Covered by team/security tests (A-3/A-4 enforced; managers cannot change roles/remove managers/owner).
- **Team isolation**: Covered by A-2 tests (cross-business reads/role changes/deletes return 404; removed members excluded).
- **Proration**: Billing proration logic exists (`modules/billing/billing.proration.ts`) with `floorDivide` (floors per line). Dedicated proration unit tests for the 8 cases requested were not observed in the test run output above; recommend adding tests for upgrade/downgrade/add/remove seats/first/last day/two changes in one period.

## Notes
- Integration tests run against a real Postgres DB (Prisma not mocked). Redis required for rate-limit tests.
- Some tests are slow due to real DB setup.
