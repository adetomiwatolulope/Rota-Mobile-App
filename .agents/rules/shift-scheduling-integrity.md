---
trigger: always_on
---

# Shift Scheduling Integrity — Rota

## 1. Business Rules
- Enforce the PRD's role permissions, shift-state transitions, position requirements, and scheduling conflict rules on the backend.
- Never rely on mobile-side validation as the only protection against invalid assignments, conflicting shifts, or unauthorized approvals.
- Do not introduce scheduling rules that are not defined in the PRD without approval.

## 2. Concurrent Updates
- Use database transactions and appropriate concurrency controls for scheduling operations that can race.
- Prevent duplicate assignments, duplicate active swaps, and inconsistent shift states under concurrent requests.
- Enforce optimistic concurrency using the PRD-defined `If-Match` version mechanism.
- Return HTTP `409 Conflict` when a shift update uses a stale version.
- Increment the shift version and record the corresponding `ShiftChange` whenever an edit succeeds, as required by the PRD.

## 3. Verification
- Test conflicting assignments, simultaneous edits, stale versions, invalid transitions, and unauthorized changes.
- Do not mark scheduling work complete until the applicable integrity rules are covered by tests.