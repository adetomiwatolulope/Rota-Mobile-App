-- CreateEnum
CREATE TYPE "LedgerEntryKind" AS ENUM ('CHARGE', 'CREDIT', 'REFUND');

-- CreateEnum
CREATE TYPE "BillingCheckoutStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingCheckoutPurpose" AS ENUM ('SUBSCRIBE', 'UPGRADE');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "checkoutSeatCount" INTEGER,
ADD COLUMN     "pendingPlanCode" TEXT,
ADD COLUMN     "planCode" TEXT;

-- CreateTable
CREATE TABLE "Plan" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPriceMinor" INTEGER NOT NULL,
    "includedSeats" INTEGER NOT NULL,
    "extraSeatPriceMinor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'NGN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "BillingCheckout" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "planCode" TEXT NOT NULL,
    "purpose" "BillingCheckoutPurpose" NOT NULL,
    "status" "BillingCheckoutStatus" NOT NULL DEFAULT 'PENDING',
    "amountMinor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'NGN',
    "seatCount" INTEGER NOT NULL,
    "txRef" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "providerLink" TEXT,
    "providerRef" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingLedgerEntry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "kind" "LedgerEntryKind" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'NGN',
    "planCode" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "providerTxnRef" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckout_txRef_key" ON "BillingCheckout"("txRef");

-- CreateIndex
CREATE INDEX "BillingCheckout_subscriptionId_status_idx" ON "BillingCheckout"("subscriptionId", "status");

-- CreateIndex
CREATE INDEX "BillingCheckout_status_createdAt_idx" ON "BillingCheckout"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckout_businessId_idempotencyKey_key" ON "BillingCheckout"("businessId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BillingLedgerEntry_idempotencyKey_key" ON "BillingLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "BillingLedgerEntry_businessId_createdAt_idx" ON "BillingLedgerEntry"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingLedgerEntry_subscriptionId_createdAt_idx" ON "BillingLedgerEntry"("subscriptionId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingLedgerEntry_invoiceId_idx" ON "BillingLedgerEntry"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_subscriptionId_periodStart_key" ON "Invoice"("subscriptionId", "periodStart");

-- CreateIndex
CREATE INDEX "Subscription_planCode_idx" ON "Subscription"("planCode");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planCode_fkey" FOREIGN KEY ("planCode") REFERENCES "Plan"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_pendingPlanCode_fkey" FOREIGN KEY ("pendingPlanCode") REFERENCES "Plan"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCheckout" ADD CONSTRAINT "BillingCheckout_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCheckout" ADD CONSTRAINT "BillingCheckout_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCheckout" ADD CONSTRAINT "BillingCheckout_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCheckout" ADD CONSTRAINT "BillingCheckout_planCode_fkey" FOREIGN KEY ("planCode") REFERENCES "Plan"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLedgerEntry" ADD CONSTRAINT "BillingLedgerEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLedgerEntry" ADD CONSTRAINT "BillingLedgerEntry_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLedgerEntry" ADD CONSTRAINT "BillingLedgerEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLedgerEntry" ADD CONSTRAINT "BillingLedgerEntry_planCode_fkey" FOREIGN KEY ("planCode") REFERENCES "Plan"("code") ON DELETE SET NULL ON UPDATE CASCADE;


-- Seed the owner-approved plan catalog. These are data rows, not service
-- constants. Prices are NGN kobo: Starter N2,000, Team N5,000, Business N12,000.
INSERT INTO "Plan" ("code", "name", "monthlyPriceMinor", "includedSeats", "extraSeatPriceMinor", "currency", "isActive", "createdAt", "updatedAt") VALUES
  ('STARTER', 'Starter', 200000, 5, 0, 'NGN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('TEAM', 'Team', 500000, 15, 30000, 'NGN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('BUSINESS', 'Business', 1200000, 40, 20000, 'NGN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Existing trials keep their snapshotted seat price; start them on the default
-- catalog plan so the seat limit can be enforced without changing money data.
UPDATE "Subscription" SET "planCode" = 'STARTER' WHERE "planCode" IS NULL;

-- Money and catalog invariants. All values are integer kobo. [M-1, M-3]
ALTER TABLE "Plan" ADD CONSTRAINT plan_values_valid
  CHECK ("monthlyPriceMinor" > 0 AND "includedSeats" >= 0 AND "extraSeatPriceMinor" >= 0 AND "currency" = 'NGN');

ALTER TABLE "BillingCheckout" ADD CONSTRAINT billing_checkout_values_valid
  CHECK ("amountMinor" > 0 AND "seatCount" >= 0 AND "currency" = 'NGN');

ALTER TABLE "BillingLedgerEntry" ADD CONSTRAINT billing_ledger_values_valid
  CHECK ("amountMinor" > 0 AND "currency" = 'NGN');

-- Append-only ledger. Updates are never allowed. Deletes are allowed only
-- inside the FR-057 purge transaction through this explicit setting.
CREATE FUNCTION prevent_billing_ledger_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'BillingLedgerEntry is append-only';
  END IF;
  IF TG_OP = 'DELETE' AND COALESCE(current_setting('rota.allow_ledger_purge', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'BillingLedgerEntry rows are never deleted outside the purge';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_ledger_append_only
  BEFORE UPDATE OR DELETE ON "BillingLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION prevent_billing_ledger_mutation();