---
trigger: always_on
---

# Offline Sync and Notifications — Rota

## 1. Offline Policy
- Follow the PRD's offline policy exactly.
- Cached schedules, member lists, and inbox data may be read offline where permitted by the PRD.
- Block offline writes unless explicitly permitted by the PRD.
- Acknowledgements are the permitted exception: queue them offline and synchronize them when connectivity returns.
- Never display a queued acknowledgement as server-confirmed before synchronization succeeds.

## 2. Synchronization Integrity
- Make queued acknowledgements safe against duplicate submissions and retries.
- Preserve acknowledgement state until synchronization is confirmed.
- Handle synchronization failures without silently discarding queued acknowledgements.
- Apply backend authorization and validation when queued actions reach the server.
- Do not assume that a queued action remains authorized simply because it was created while the user was online.

## 3. Notification Processing
- Follow the PRD's notification timing, event types, push-to-email fallback, and receipt-polling rules.
- Do not invent notification types or delivery behavior without approval.
- Use the approved background-job mechanism for notification processing; do not perform notification delivery directly inside ordinary API request handlers.
- Make notification jobs safe against duplicate processing and retries.
- Preserve delivery records and relevant outcomes so retries do not create unintended duplicate notifications.
- Keep provider credentials on the backend and avoid logging sensitive notification content.

## 4. Verification
- Test offline acknowledgement queuing, reconnection and synchronization, duplicate submissions, failed synchronization, notification retries, and push-to-email fallback.
- Verify that notification delivery records reflect the actual processing outcome.
- Do not claim an acknowledgement or notification was delivered until the relevant confirmation is received.