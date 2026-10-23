# Billing proration design (MVP-B, not yet implemented)

Status: **blocked**. No billing code has been written. The owner chose to pause
until validation gates V1, V4, V5 (tax), and V6 pass. This document records the
agreed pricing direction and the pending decisions so the implementation can
start without inventing rules later.

## Agreed direction

- Prices are NGN amounts, stored as integer **kobo** (`M-1`, `M-3`, `M-6`).
  Plan amounts have **not** been supplied yet.
- The plan catalog will be added through a new Prisma migration approved by the
  owner. Applied migrations will not be edited (`L-4`).
- An immutable ledger table will be added for charges, credits, and refunds.
  Corrections are new rows; rows are never updated or deleted.
- Payment provider remains Flutterwave only (`L-5`, `L-6`). Checkout uses the
  hosted page; no card data reaches Rota (`M-4`).
- Proration is calculated by Rota. No provider proration feature is used.

## Plan parameters

The catalog is data, not code. Each plan needs:

| Field | Meaning |
|---|---|
| `monthlyPriceMinor` | Full monthly price in kobo |
| `includedSeats` | Seats covered by the monthly price |
| `extraSeatPriceMinor` | Monthly price per seat above the included count; `0` means extra seats are unavailable |

The requirement supplied USD reference points (Starter $20 / 5 seats, Team $50 /
15 seats / $3 extra, Business $120 / 40 seats / $2 extra). They are **not**
billable values under the locked NGN rule. Equivalent NGN amounts must come
from the owner before implementation.

## Billing period

- Monthly in advance. The anchor is the start of the first paid period.
- `periodStart` and `periodEnd` are stored in UTC; billing days are computed on
  calendar dates in `Africa/Lagos`.
- `periodDays = dateDiff(periodStartDate, periodEndDate)`.
- `remainingDays = dateDiff(changeDate, periodEndDate)`.
- A change at any time on the first day has `remainingDays = periodDays`.
- A change at any time on the last day has `remainingDays = 1`.

The supplied example uses a 30-day period beginning on the 1st and a change on
the 11th, giving 20 remaining days.

## Formula

All arithmetic is integer arithmetic on kobo. No floating point (`M-1`).

### Credit for the unused part of the current plan

```
unusedCreditMinor = floor(
  currentPlan.monthlyPriceMinor * remainingDays / periodDays
)
```

### Charge for the new plan for the rest of the period

```
newPlanChargeMinor = floor(
  newPlan.monthlyPriceMinor * remainingDays / periodDays
)
```

### Amount due today on an upgrade

```
amountDueMinor = newPlanChargeMinor - unusedCreditMinor
```

If `amountDueMinor` is negative, the change is treated as a downgrade, not an
upgrade.

### Extra seats

For seats above `includedSeats`:

```
proratedSeatMinor = floor(
  plan.extraSeatPriceMinor * remainingDays / periodDays
)
seatChargeMinor = proratedSeatMinor * seatsAdded
```

Open decision: whether the floor applies per seat or to the line total. The
recommended rule is per seat, then multiply by quantity, so every invoice line
can be rebuilt from its unit price and quantity.

### Downgrade

A downgrade applies at `periodEnd`. No credit is issued and no refund is made.
The current plan remains active until the period ends; the next invoice starts
the lower plan. This matches the requirement and avoids partial refunds.

### Two changes in one period

Changes are processed in order, each against the plan active at that moment:

1. Credit only the unused part of the plan being replaced.
2. Charge only the replacement plan for the same remaining days.
3. Store both ledger rows and the resulting invoice lines.
4. Never credit a plan that was already credited earlier in the period.

A later downgrade is scheduled for period end; it does not create an immediate
credit.

## Rounding rule

Requirement 5's example uses **floor** on each plan line
(`2000 x 20 / 30 = 1333`, `5000 x 20 / 30 = 3333`). PRD FR-049 instead says
"rounded to the nearest minor unit". These conflict.

Working rule: **floor each plan or seat line independently**, matching the
supplied worked example. This must be confirmed by the owner before code is
written, because the PRD is the stated source of truth.

Consequences of per-line floor:

- The amount charged can be at most one kobo per line below the exact
  time-weighted amount.
- Invoice lines always reproduce the invoice total exactly.
- Rounding never creates a negative amount or a refund by itself.

## Ledger design (proposed, not implemented)

Each row is append-only:

| Field | Purpose |
|---|---|
| `id` | Primary key |
| `businessId` | Tenant boundary |
| `subscriptionId` | Owning subscription |
| `invoiceId` | Related invoice, when applicable |
| `kind` | `CHARGE`, `CREDIT`, or `REFUND` |
| `amountMinor` | Signed or unsigned integer kobo, fixed by `kind` |
| `currency` | `NGN` only |
| `planCode` | Plan at the time of the entry |
| `periodStart`, `periodEnd` | Billing period |
| `idempotencyKey` | Unique key for replay-safe writes |
| `providerTxnRef` | Provider reference when paid |
| `createdAt` | Immutable timestamp |
| `metadata` | JSON snapshot of the inputs used to compute the row |

The subscription's monetary state must be reconstructable by replaying ledger
rows in `createdAt, id` order. The current plan and period may be cached on
`Subscription`, but the ledger is authoritative.

## Tests required before billing ships

At least these eight cases, using kobo and a 30-day period:

1. Upgrade on day 11: credit unused old plan, charge new plan, net due.
2. Downgrade on day 11: no credit, switch scheduled at period end.
3. Add one or more extra seats mid-period.
4. Remove seats mid-period: no credit, next period uses the lower count.
5. Change on the first day: full-period charge, no unused credit beyond the
   full old-plan price.
6. Change on the last day: one remaining day.
7. Two upgrades in one period: sequential credits, no double credit.
8. Upgrade then downgrade in one period: immediate upgrade charge, downgrade at
   period end, no refund.
9. Member removed and re-added in the same period: billed once (`M-8`).
10. Rounding: floor result is exact for the supplied 1333 / 3333 / 2000 example.

Payment-flow tests must also cover: signature verification, duplicate provider
event IDs, background-job processing, idempotency keys, failed renewal retries
at days 0, 1, 3, and 5, and READ_ONLY after 7 days (`M-10`, `M-12`, `M-13`).

## Gates that must pass first

| Gate | Needed for |
|---|---|
| V1 Owner interviews | Pricing and plan validation |
| V4 Flutterwave sandbox recurring token charge | Renewals and tokenized charges |
| V5 Tax advice | Invoice wording and VAT |
| V6 Margin check | Confirming the NGN plan prices are viable |

No payment endpoint, webhook handler, plan schema, ledger table, or billing
screen should be built until these are marked PASSED and the owner supplies the
NGN plan amounts.
