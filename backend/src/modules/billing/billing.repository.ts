/**
 * modules/billing/billing.repository.ts - billing data access. [S-1, S-5]
 */
import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "@prisma/client";
import type { BillingPlanCode } from "@rota/shared";

export const billingRepository = {
  findPlan(code: BillingPlanCode) {
    return prisma.plan.findUnique({
      where: { code, isActive: true },
    });
  },

  findAllPlans() {
    return prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    });
  },

  findPlanByCode(code: string) {
    return prisma.plan.findUnique({
      where: { code },
    });
  },

  findSubscription(businessId: string) {
    return prisma.subscription.findUnique({
      where: { businessId },
      include: { plan: true, pendingPlan: true },
    });
  },

  upsertSubscription(businessId: string, data: Prisma.SubscriptionCreateInput) {
    return prisma.subscription.upsert({
      where: { businessId },
      create: data,
      update: {},
    });
  },

  updateSubscription(businessId: string, data: Prisma.SubscriptionUpdateInput) {
    return prisma.subscription.update({
      where: { businessId },
      data,
      include: { plan: true, pendingPlan: true },
    });
  },

  createCheckout(data: Prisma.BillingCheckoutCreateInput) {
    return prisma.billingCheckout.create({ data });
  },

  findCheckoutById(id: string) {
    return prisma.billingCheckout.findUnique({
      where: { id },
      include: { subscription: true, plan: true, invoice: true },
    });
  },

  findCheckoutByTxRef(txRef: string) {
    return prisma.billingCheckout.findUnique({
      where: { txRef },
      include: { subscription: true, plan: true, invoice: true },
    });
  },

  findCheckoutByIdempotency(businessId: string, idempotencyKey: string) {
    return prisma.billingCheckout.findUnique({
      where: {
        businessId_idempotencyKey: {
          businessId,
          idempotencyKey,
        },
      },
      include: { subscription: true, plan: true, invoice: true },
    });
  },

  updateCheckout(id: string, data: Prisma.BillingCheckoutUpdateInput) {
    return prisma.billingCheckout.update({
      where: { id },
      data,
    });
  },

  createLedgerEntry(data: Prisma.BillingLedgerEntryCreateInput) {
    return prisma.billingLedgerEntry.create({ data });
  },

  countLedgerEntry(idempotencyKey: string) {
    return prisma.billingLedgerEntry.count({
      where: { idempotencyKey },
    });
  },

  listInvoices(businessId: string, limit: number) {
    return prisma.invoice.findMany({
      where: { subscription: { businessId } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { lines: true },
    });
  },

  findInvoice(id: string) {
    return prisma.invoice.findUnique({
      where: { id },
      include: { lines: true, subscription: true },
    });
  },

  findInvoiceByIdForBusiness(id: string, businessId: string) {
    return prisma.invoice.findFirst({
      where: { id, subscription: { businessId } },
      include: { lines: true, subscription: true },
    });
  },

  findOpenInvoiceBySubscription(subscriptionId: string) {
    return prisma.invoice.findFirst({
      where: { subscriptionId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      include: { lines: true },
    });
  },

  countActiveNonOwnerSeatsAt(businessId: string, at: Date) {
    return prisma.seatPeriod.count({
      where: {
        businessId,
        startedAt: { lte: at },
        OR: [{ endedAt: null }, { endedAt: { gt: at } }],
        membership: {
          status: "ACTIVE",
          role: { not: "OWNER" },
        },
      },
    });
  },

  countOpenSeatPeriodsNow(businessId: string) {
    return prisma.seatPeriod.count({
      where: {
        businessId,
        endedAt: null,
        membership: {
          status: "ACTIVE",
          role: { not: "OWNER" },
        },
      },
    });
  },

  countPendingInvites(businessId: string) {
    return prisma.invite.count({
      where: {
        businessId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  },

  countBillableOccupants(businessId: string) {
    return prisma.$queryRaw<[{ count: bigint }]>`
      SELECT (COUNT(DISTINCT sp."membershipId")::bigint + 
              (SELECT COUNT(*)::bigint FROM "Invite" i 
               WHERE i."businessId" = ${businessId} 
               AND i."acceptedAt" IS NULL 
               AND i."revokedAt" IS NULL 
               AND i."expiresAt" > NOW())) as count
      FROM "SeatPeriod" sp
      JOIN "Membership" m ON m."id" = sp."membershipId"
      WHERE sp."businessId" = ${businessId}
        AND sp."endedAt" IS NULL
        AND m."status" = 'ACTIVE'
        AND m."role" != 'OWNER'
    `;
  },
};
