
---
name: r2-storage-handler
description: Use whenever files are uploaded, downloaded, signed, stored, or deleted, or when deleting a book or account. Enforces ownership-scoped keys and row/object deletion parity.
---

# R2 Storage Handler

## Trigger
Any file movement or deletion: uploads, downloads, signed URLs, object keys, storage metadata, or deletion of a book/account.

## Rota source and scope check
Read `AGENTS.md` and the relevant PRD privacy/data-deletion requirements. The supplied Rota PRD and AGENTS.md do not specify Cloudflare R2, a book entity, or an object-storage integration. Do not introduce R2, book models, storage fields, dependencies, or endpoints as part of Rota without written owner approval and a corresponding PRD/schema change. If the task assumes those already exist, ask for their authoritative location before changing code.

## Storage invariants when explicitly authorized
- Encode ownership into every object key using the approved canonical format, so an object cannot be confused across users/businesses. The exact key format is not specified in the supplied files: ask before choosing a format.
- Authenticate and authorize against database ownership before issuing a signed URL. Signed URLs must be scoped to the one authorized object, intended operation, and minimum required lifetime from the approved policy. Never treat an object key supplied by the client as proof of ownership.
- Keep database metadata and object storage paired. A database row and its object are two sides of one lifecycle; document which side is authoritative and define recovery for partial failure before implementation.
- Original uploads are immutable. Transformations, if authorized, create separate derived objects and never overwrite the original.
- Never log signed URLs, credentials, private object keys, or sensitive file contents.
- Validate file type, size, and allowed operation at the boundary. Do not trust filename extensions or client-supplied MIME type alone.

## Full deletion-parity procedure
1. Resolve the caller's ownership from trusted database relationships, not request data alone.
2. Enumerate all object keys associated with the owned records using the approved metadata source.
3. Determine the required database retention/soft-delete window from the PRD. Do not immediately delete objects when records must remain recoverable.
4. Apply the approved lifecycle plan to both the database rows and stored objects; do not report success while either side is known to be orphaned.
5. Make retries safe and idempotent. Record failures without exposing secrets, and provide a safe retry/reconciliation path.
6. Verify parity after deletion: no unauthorized live row points to a missing object, and no object remains outside the approved retention/deletion policy.
7. For Rota business purge, preserve the exact FR-057 child-first database deletion order in one transaction per business. The PRD does not define object-storage deletion ordering or a saga; get owner approval for how object operations coordinate with the database transaction rather than inventing atomicity across systems.

## Account and business deletion
- Follow Rota's exact policy: account soft-deletion then anonymization after 30 days (subject to FR-056 conditions); business soft-deletion and purge after 30 days; 24-month retention rules in FR-057.
- Do not hard-delete a membership outside the approved purge. Do not rely on cascade order.
- R2 is not a locked Rota dependency in the supplied files. Stop and ask before adding it.

## Verification
Test unauthorized key access, key-ownership mismatch, expired/replayed signed URLs where applicable, immutable-original behavior, row/object partial failure, idempotent deletion retries, and deletion parity. Do not mock Prisma in integration tests. Include the affected FR/rule IDs and exact commands/results in the required task report.
