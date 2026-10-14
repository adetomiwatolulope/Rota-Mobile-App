
---
name: ai-provider-adapter
description: Use for changes inside apps/api/src/services/ai involving adapters, prompts, confidence mapping, validation, normalization, or provider selection.
---

# AI Provider Adapter

## Trigger
Any work inside `apps/api/src/services/ai`: provider adapters, prompts, confidence mapping, response validation, normalization, or provider switching.

## Phase gate — do not bypass
Read `AGENTS.md` and PRD Sections 6 and 13. Rota AI-assisted schedule drafting is Phase 2 and is not in MVP-A. AGENTS.md explicitly forbids scaffolding Phase 2/3 AI items, including `ScheduleDrafter` and a language-model SDK. In the current phase, do not create or scaffold AI code, directories, interfaces, prompts, or dependencies. If asked to implement it, state the phase conflict and ask for written owner authorization to change phase and confirm the validation gates.

## Provider-agnostic design (only after authorized phase change)
The PRD describes a provider-agnostic `ScheduleDrafter` interface, a deterministic solver baseline, and a model only if it outperforms the baseline on a fixed evaluation set. At Phase 2 start, the implementation choice (separate service or JavaScript solver) is explicitly unresolved. Stop and ask rather than selecting one prematurely.
- Send aliases (m1, m2, …), never names, emails, or phone numbers.
- Cap inputs at about 8,000 tokens.
- Timeout after 30 seconds and retry once. On failure, leave the week unchanged and show the specified failure message.
- Persist only input/output hashes, token counts, latency, and cost per request; do not store the full prompt.
- Provider contract must forbid training on submitted data.
- Deterministic validation must reject every assignment violating hard rules; invalid assignments are dropped and slots remain open.
- Save suggestions as DRAFT shifts labeled “Suggested”; nothing publishes without manager action.
- Release evaluation: 20 real or realistic schedules, zero hard-rule violations after validation, and managers keep at least 70% of suggested shifts.

## Contract, sign-offs, R11 fabrication net
The supplied `Rota_PRD_v2.md` and `AGENTS.md` do not define an `AiService` contract, R11, a confidence-mapping policy, fabrication-net algorithm, or the two dated human sign-offs requested in the task. Do not fabricate interface methods, confidence thresholds, sign-off names/dates, or an R11 enforcement mechanism. Ask the owner to supply the canonical contract and both dated approvals. Until supplied, do not implement the AI work; these missing decisions are blockers, not permission to invent defaults.

## Tests when authorized
Use deterministic fixtures and a fixed evaluation set. Test provider payload validation, malformed/extra output, hard-rule rejection, alias-only privacy, timeout/retry, no-save-on-failure, and zero violations after validation. Tests must cite the approved rule IDs and contract once provided.
