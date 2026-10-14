
---
name: pipeline-job-builder
description: Use for worker-executed work: pipeline stages, job types, BullMQ processors, batch handling, exports, and scheduled jobs.
---

# Pipeline Job Builder

## Trigger
Anything that runs in a worker: pipeline stages, job types, queue processors, batch processing, exports, or scheduled jobs.

## Phase and scope gate
Read `AGENTS.md` and the relevant PRD sections first. BullMQ backed by Redis is the only queue. Do not add another queue or put long-running work in an HTTP request. Rota's AI schedule-drafting pipeline is Phase 2 and explicitly out of scope for MVP-A; do not scaffold it, add a `ScheduleDrafter`, or add a model SDK before the owner changes phase in writing and gates permit it.

## Worker contract
- Keep workers separately startable from `apps/api/src/worker.ts`; the API and worker must be separable processes.
- Use BullMQ with Redis. Job handlers must be idempotent, with intentional retry/backoff and failure handling.
- Use stable job identifiers/deduplication where the business operation requires it. Persist state that must survive requests or be shared across instances; never use process memory as coordination.
- Request handlers enqueue slow work. Workers perform delivery, receipt polling, reminders, swap expiry, billing jobs, and purge only where the current phase permits those features.
- Validate job payloads with Zod at boundaries. Log with Pino JSON and request/job correlation identifiers; never log secrets or personal contact data.
- Use named constants for PRD time thresholds; keep the FR number in comments. Do not repeat PRD numbers inline.
- Test duplicate delivery, retry behavior, partial failures, terminal states, and idempotent replay.

## Batch semantics
The requested `PARTIAL` batch semantics are not defined in the supplied PRD or AGENTS.md. Do not infer whether PARTIAL means a job status, per-item result, retry policy, or API response. Ask the owner for the authoritative definition before implementing it. Until then, keep independently specified job behavior explicit and do not invent a PARTIAL enum/status.

## AI cost gates
The Rota PRD specifies AI Phase 2 cost controls as: measure cost per request, log cost per request, set per-business monthly caps after pilot measurement, and provide a global kill switch. The three ordered cost gates mentioned in the task are not specified in the supplied files. Do not invent their names, thresholds, or order; ask the owner for the canonical three-gate rule. Never spend on AI before those gates are defined and enabled by an approved phase.

## Export stage, watermark, and diagram edges
The supplied PRD/AGENTS do not specify an export stage, export watermark, or pipeline diagram edges; calendar export is explicitly listed as a Phase 2/3 item not to scaffold. Do not create export code, watermark logic, placeholder jobs, or speculative diagram edges in MVP-A. Ask for the authoritative design if the phase and scope are changed in writing.

## Required checks
Verify BullMQ retry/backoff, idempotency, concurrency/locks, and failure behavior. Use tests named with the touched FR/rule ID. Run the required check suite and provide the exact task report from AGENTS.md.
