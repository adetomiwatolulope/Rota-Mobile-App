---
trigger: glob
---

# Money and Billing Rules — Rota

## 1. Locked Payment Provider

- Flutterwave is the approved payment provider. Do not introduce Paystack or another payment provider unless the product owner explicitly changes the decision.
- Use the Flutterwave integration and payment methods approved by the PRD.
- Keep provider-specific API calls, webhook verification, and provider response mapping inside the billing integration layer.
- Rota remains responsible for its own subscription, invoice, and billing state. Do not treat the payment provider as the source of truth for Rota's complete subscription lifecycle.
- Verify support for recurring token charging with the intended Nigerian payment methods in the Flutterwave sandbox before implementing recurring charges. Do not assume that a feature supported for one payment method is supported for all others.

## 2. Monetary Values

- Store and calculate monetary amounts using integer minor units, such as kobo or cents, and retain the applicable currency.
- Never use floating-point arithmetic for monetary calculations or persisted payment amounts.
- Do not silently round, change currency, or reinterpret an amount received from a client or provider.
- Calculate payable amounts on the backend using approved pricing and billing rules. Never trust a client-supplied total as authoritative.
- Keep the original transaction amount and currency available for reconciliation.

## 3. Payment Verification

- Never mark a payment as successful solely because the client reports success or returns from a hosted checkout page.
- Verify payment status through the approved server-side Flutterwave verification or authenticated webhook flow before applying the corresponding billing state change.
- Validate the transaction reference, expected amount, currency, and relevant customer or business association before accepting a payment result.
- Reject invalid, mismatched, or unverifiable payment events without granting paid access.
- Keep payment secrets on the backend. Never expose secret keys or webhook verification secrets in the mobile app.

## 4. Webhook Idempotency and Transactions

- Assume payment webhooks can be delivered more than once or arrive out of order.
- Make processing idempotent using the appropriate provider transaction reference and database uniqueness constraints.
- A duplicate event must not create duplicate invoices, grant duplicate entitlements, or apply the same financial effect twice.
- Use database transactions for related billing-record and subscription-state changes that must succeed together.
- Do not hold a database transaction open while waiting for a remote payment-provider request.
- Record enough information to reconcile accepted, rejected, duplicate, and failed payment events without storing unnecessary sensitive data.

## 5. Subscription and Invoice Integrity

- Change subscription status only after the corresponding server-side payment or approved billing event has been verified.
- Keep invoice records consistent with the amounts, currency, billing period, and transaction references used for the charge.
- Do not silently mark a failed, pending, or unverified payment as paid.
- Do not assume that a successful charge automatically resolves every subscription lifecycle rule. Apply Rota's approved renewal, cancellation, expiry, and entitlement rules.
- Where recurring charging support remains unverified, stop and report the dependency rather than inventing a fallback payment flow.

## 6. Failures and Reconciliation

- Distinguish pending, successful, failed, and other payment states supported by the approved billing model.
- Handle provider timeouts and temporary failures without blindly submitting a second charge.
- Before retrying an uncertain transaction, use the approved reference and provider verification process to determine whether the original charge succeeded.
- Keep payment processing logs and reconciliation records sufficient to investigate discrepancies.
- Never log full payment credentials, secret keys, or other prohibited sensitive data.

## 7. Testing and Release

- Test successful payments, rejected payments, mismatched amounts, currency mismatches, invalid webhooks, duplicate events, provider timeouts, and out-of-order events.
- Verify that repeated delivery of the same successful event creates only one effective billing result.
- Test recurring token charging in the Flutterwave sandbox for the intended payment methods before enabling it.
- Do not enable a billing feature in production while a required payment capability or verification path remains unconfirmed.