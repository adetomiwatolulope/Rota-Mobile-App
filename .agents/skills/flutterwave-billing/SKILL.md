
---
name: flutterwave-billing
description: Use whenever money moves or billing state changes: payments, webhooks, subscriptions, credits, refunds, and any billing access/watermark gate.
---

# Flutterwave Billing

## Trigger
Any flow where money moves or billing state changes: payment checkout, webhook, subscriptions, credits, refunds, chargebacks, renewals, billing access gates, or watermark gates.

## Mandatory source and phase checks
1. Read `AGENTS.md` in full and the relevant PRD billing/business-model sections.
2. Read the current Flutterwave documentation before writing any Flutterwave code. Never guess endpoints, fields, signature headers, or verification behavior. If docs are unclear, stop and ask.
3. Confirm the current phase and gate status. MVP-A is a free pilot: no billing enforcement, trial expiry, checkout, read-only mode, or billing page. V1, V4, V5 tax, and V6 must pass before MVP-B billing work. If required gates are not PASSED, state this first and ask whether to proceed; proceed only after written yes.
4. Use only Flutterwave. All provider-specific code lives in `apps/api/src/providers/payments/flutterwave/` behind one `PaymentProvider` interface and one adapter. Hosted checkout and card tokenization only; never build a card form.

## Webhook order of operations — exact order
1. Verify the webhook signature using the current official Flutterwave documentation.
2. Insert a `PaymentEvent` row first. If `(provider, providerEventId)` already exists, return HTTP 200 and do nothing else.
3. Check amount, currency, and transaction reference against the invoice.
4. Perform Flutterwave transaction verification if current documentation provides it.
5. Process the event, then set `processedAt`.

Never mark an invoice PAID from a webhook alone. Validate webhook payloads with Zod. Do not log secrets, tokens, card data, or personal contact information.

## Money and atomicity
- Store all amounts as integer kobo; never use decimals or floating-point money math.
- NGN only. Keep `USD` in the enum unused.
- Convert between kobo and Flutterwave's expected amount format only in `apps/api/src/lib/money.ts`, called only by the Flutterwave adapter, using integer-safe math.
- Never receive/store/log/pass card numbers. Store only `providerPaymentTokenRef`.
- Never hard-code a seat price. Read `SEAT_PRICE` from validated config and snapshot it to `Subscription.seatPriceMinor` when a subscription starts. If unset, stop and ask.
- Seat counts come from `SeatPeriod` rows open at period start. Owner is free; managers count; pending invites and removed members do not. Bill each member once per period; removals do not create credits; mid-period additions are prorated as specified in FR-049.
- Balance and ledger mutations must be transactionally paired: if a task introduces a balance/ledger concept not present in the locked schema, stop and ask before adding fields/tables. Do not invent a ledger model for Rota.
- Idempotency must be anchored to the provider event/reference and existing unique constraints. Inspect the locked schema before designing any key.

## Access gates, refunds, and watermarks
The PRD defines `READ_ONLY` subscription behavior for MVP-B: write requests return HTTP 402 with `SUBSCRIPTION_READ_ONLY`, while schedule viewing, acknowledgements, and billing actions remain available. It does not define a watermark gate or credits balance. Do not add a watermark, credits, or ledger schema to Rota without owner approval; ask for the canonical requirement. Refunds and chargebacks are open items in AGENTS.md; ask for approved policy wording before implementing those flows.

## Verification
Test duplicate webhook replay, bad signature, amount/currency/reference mismatch, provider verification, transaction rollback, and correct `processedAt` handling. Test integer-kobo calculations and seat-period edge cases. Do not mock Prisma in integration tests. Report the Flutterwave sandbox result for recurring token charges before building renewals (gate V4); if it fails, stop, do not switch providers or add a workaround.
