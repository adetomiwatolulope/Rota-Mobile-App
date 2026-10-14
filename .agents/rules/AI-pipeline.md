---
trigger: always_on
---

# AI Pipeline Rules — Rota

## 1. Phase and Scope Control

- AI-assisted schedule drafting is a Phase 2 feature in the Rota PRD. Do not implement or activate it during the MVP unless the product owner explicitly authorizes a scope change.
- Do not add AI SDKs, provider credentials, or AI-related infrastructure to the MVP without that authorization.
- Before implementing the AI pipeline, confirm the approved Phase 2 requirements, evaluation criteria, privacy controls, and operational limits.

## 2. Provider-Neutral Integration

- When AI integration is authorized, expose model calls through a shared provider-independent interface, such as `ScheduleDrafter`.
- Keep Claude-specific and DeepSeek-specific request formats, authentication, response parsing, and error handling inside their respective adapters.
- Do not let provider-specific types or response formats leak into scheduling domain logic.
- Use a common validated input and output contract so the provider can be changed without rewriting scheduling rules.
- Do not assume that the providers have identical capabilities, structured-output support, context limits, latency, or pricing. Verify the selected model's actual capabilities before implementation.
- Use the existing approved dependencies and project architecture. Do not add provider SDKs or packages without checking repository rules and obtaining authorization where required.

## 3. Data Privacy

- Do not send direct personal identifiers to an AI provider. Replace names, emails, and phone numbers with aliases as specified by the PRD.
- Send only the scheduling data necessary to generate a suggestion.
- Enforce the PRD's input-size limit and provider timeout.
- Use a provider arrangement that prohibits training on submitted data, as required by the PRD.
- Do not store full prompts or raw personal data in AI logs.
- Store only the approved operational metadata, including input/output hashes, token counts, latency, and cost.

## 4. Deterministic Validation

- Treat every AI response as an untrusted suggestion, never as an authoritative scheduling decision.
- Validate the response against the expected output schema before using it.
- Run deterministic business-rule validation against the actual schedule and availability data.
- Reject or drop assignments that violate position requirements, shift overlap rules, minimum rest gaps, or other applicable hard constraints.
- Do not trust an AI-generated explanation as proof that a schedule is valid.
- AI output must never bypass the backend's normal authorization, transaction, or scheduling-integrity checks.

## 5. Approval and State Changes

- Save generated schedules only as `DRAFT` shifts labelled `Suggested`, as specified in the PRD.
- Never publish, assign, or approve an AI-generated schedule without the required manager action.
- If generation or validation fails, leave the existing schedule unchanged and return the approved safe failure response.
- Ensure retries cannot create duplicate drafts or apply the same suggestion repeatedly.

## 6. Reliability and Cost Control

- Apply the PRD's 30-second timeout and one-retry policy unless an approved requirement changes it.
- Implement a global kill switch that prevents new AI requests when disabled.
- Log cost per request and enforce the approved per-business monthly usage caps when configured.
- Do not silently fall back to another model or provider unless that behavior is explicitly approved.
- Keep provider failures distinguishable from invalid output, hard-rule validation failures, and configuration errors.

## 7. Evaluation and Release

- Maintain the PRD's fixed evaluation set of 20 real or realistic schedules.
- Do not release AI schedule drafting unless deterministic validation produces zero hard-rule violations on the evaluation set.
- Track the PRD's product metric: managers retain at least 70% of suggested shifts.
- Test both Claude and DeepSeek adapters against the same contract and scheduling evaluation suite if both are enabled.
- Record model and provider configuration needed for diagnosis without storing full prompts or unnecessary personal data.