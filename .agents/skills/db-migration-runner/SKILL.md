
---
name: db-migration-runner
description: Use for any database schema change, Prisma change, migration, or new data that must be stored. Protects Rota's locked schema, integer-kobo money rules, constraints, and deletion order.
---

# DB Migration Runner

## Trigger
Any schema change; any mention of Prisma, migration, schema, adding something to store, indexes, constraints, or data retention.

## Required source-of-truth ritual
1. Read the repository-root `AGENTS.md` in full.
2. Read the relevant PRD section; for database work, read Section 10 and the affected FRs, plus Sections 7–8 and FR-057 when relevant.
3. Check the owner controls and current phase. Do not build ahead. If a required validation gate is not marked PASSED, state that in the first response and ask whether to proceed; proceed only after a written yes.
4. If the request conflicts with a locked schema or an absent requirement, stop and ask. Do not resolve ambiguity by guessing.

## Locked-schema rules
- PostgreSQL 16, Prisma, and Prisma Migrate are locked. Never substitute tools.
- The complete PRD Section 10 schema, all raw SQL constraints, CHECK constraints, and partial unique indexes belong in the first migration. Build current-phase behavior on top of that baseline.
- Never rename, remove, or retype a model, field, enum value, index, or constraint from Section 10. Never add schema objects without owner approval.
- All changes go through a new Prisma migration. Never edit an applied migration.
- Never use `prisma db push` except against a throwaway local database.
- Prisma cannot express every required constraint: preserve the raw SQL constraints and partial unique indexes from PRD Section 10. Do not silently omit them.
- Keep soft-delete filtering for `User`, `Business`, and `Location` in the Prisma client extension; do not rely on each query to remember `deletedAt`.

## Safe migration sequence
1. Confirm phase, affected FRs, locked model/field/enum/index/constraint definitions, and whether the proposed data is already represented.
2. If the requested change is absent from the PRD schema or requires a new field/table/enum/index/constraint, stop and ask the owner before authoring the migration.
3. Write a forward-only migration; do not modify historical migrations.
4. Preserve all Section 10 raw SQL constraints and partial unique indexes. Review generated SQL rather than trusting Prisma's diff alone.
5. Check money columns and computations: every amount is a whole-number minor unit (NGN kobo); never use decimal or floating-point money.
6. Review foreign keys and deletion behavior. Do not assume database cascade order implements business purge rules.
7. Add tests for each touched rule ID/FR, including constraint violations and the intended relationship behavior. Never mock Prisma in integration tests.
8. Run `npx prisma validate`, apply migrations to a clean PostgreSQL 16 database with `npx prisma migrate deploy`, and run the repository's `npm run check` plus required commands from AGENTS.md. Report actual output; do not claim unrun checks passed.
9. Include the required task report: requirements, deferred items, rules checked, commands, files changed, dependencies, and owner questions.

## Money invariants
- Store all amounts as integer kobo. No decimal values or floating-point calculations for money.
- `USD` remains in the enum but is unused; accept NGN only.
- Conversion to/from Flutterwave's expected amount format is only in `apps/api/src/lib/money.ts`, called only by the Flutterwave adapter, with integer-safe math.
- Do not invent `SEAT_PRICE`. If it is unset, stop and ask. MVP-A creates the `Subscription` row but does not enforce trial expiry, checkout, read-only mode, or billing.

## Deletion invariants
- Never rely on database cascade order for purge.
- Purge one business per transaction, deleting children in this exact FR-057 order: acknowledgements, shift changes, claims, swaps, shifts, availability, time off, seat periods, notifications, audit logs, invites, memberships, then business.
- Never hard-delete a membership outside the purge.
- Follow the specified 24-month retention and 30-day soft-delete/anonymization rules; do not invent another retention period.

## Stop conditions
Stop and ask if a migration changes locked schema, adds an unapproved schema object, omits a Section 10 constraint, requires a phase-gated feature, or if the PRD/AGENTS conflict. Do not create a schema object merely to satisfy a task description.
