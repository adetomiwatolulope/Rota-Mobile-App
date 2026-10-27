/**
 * modules/billing/billing.service.ts - Billing business rules. [S-1,S-5]
 */
import {
  BILLING_PLAN_CODES,
  type BillingPlanCode,
  type BillingSessionResult,
  type InvoiceSummary,
  type SubscriptionSummary,
} from "@rota/shared";
import { AppError, ErrorCode, PaymentProviderError } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { getPaymentProvider, isBillingConfigured } from "../../providers/payments/index.js";
import { randomUUID } from "node:crypto";
import { billingRepository } from "./billing.repository.js";
import { calcProratedKobo, calcPeriodDays, calcRemainingDays } from "./billing.proration.js";
import type { MembershipContext } from "../../middleware/membership.js";
// @ts-ignore
import { DateTime } from "luxon";

const DEFAULT_PLAN: BillingPlanCode = "STARTER";

function isOwner(ctx: MembershipContext) {
  if (ctx.role !== "OWNER") {
    throw new AppError(ErrorCode.FORBIDDEN, 403, "Only the owner can manage billing");
  }
}

function requireBillingConfigured() {
  if (!isBillingConfigured()) {
    throw new AppError(ErrorCode.BILLING_NOT_CONFIGURED, 503, "Billing is not configured");
  }
}

function addMonths(d: Date, months: number) {
  const dt = DateTime.fromJSDate(d, { zone: "Africa/Lagos" }).plus({ months });
  return dt.toJSDate();
}

function startOfDayUTC(d: Date) {
  return DateTime.fromJSDate(d, { zone: "Africa/Lagos" }).startOf("day").toUTC().toJSDate();
}

export const billingService = {
  async getPlans() {
    const plans = await billingRepository.findAllPlans();
    return plans.map((p) => ({
      code: p.code as BillingPlanCode,
      name: p.name,
      monthlyPriceMinor: p.monthlyPriceMinor,
      includedSeats: p.includedSeats,
      extraSeatPriceMinor: p.extraSeatPriceMinor,
      currency: "NGN" as const,
    }));
  },

  async getSubscription(ctx: MembershipContext): Promise<SubscriptionSummary> {
    isOwner(ctx);
    let sub: any = await billingRepository.findSubscription(ctx.businessId) as any;
    if (!sub) {
      const plan = await billingRepository.findPlan(DEFAULT_PLAN);
      await prisma.subscription.create({
        data: {
          businessId: ctx.businessId,
          status: "TRIALING",
          currency: "NGN",
          seatPriceMinor: plan?.monthlyPriceMinor || 0,
          trialEndsAt: DateTime.utc().plus({ days: 14 }).toJSDate(),
          planCode: DEFAULT_PLAN,
        } as any,
      });
      sub = (await billingRepository.findSubscription(ctx.businessId)) as any;
    }
    if (!sub) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Subscription not found");
    }
    const s: any = sub;
    return {
      id: s.id,
      status: s.status,
      currency: "NGN",
      planCode: s.planCode as BillingPlanCode | null,
      pendingPlanCode: s.pendingPlanCode as BillingPlanCode | null,
      seatPriceMinor: s.seatPriceMinor,
      trialEndsAt: s.trialEndsAt.toISOString(),
      currentPeriodStart: s.currentPeriodStart ? s.currentPeriodStart.toISOString() : null,
      currentPeriodEnd: s.currentPeriodEnd ? s.currentPeriodEnd.toISOString() : null,
      graceEndsAt: s.graceEndsAt ? s.graceEndsAt.toISOString() : null,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      cancelledAt: s.cancelledAt ? s.cancelledAt.toISOString() : null,
    };
  },

  async listInvoices(ctx: MembershipContext): Promise<InvoiceSummary[]> {
    isOwner(ctx);
    const invoices = await billingRepository.listInvoices(ctx.businessId, 50);
    return invoices.map((inv) => ({
      id: inv.id,
      periodStart: inv.periodStart.toISOString(),
      periodEnd: inv.periodEnd.toISOString(),
      dueAt: inv.dueAt.toISOString(),
      seatCount: inv.seatCount,
      totalMinor: inv.totalMinor,
      currency: "NGN",
      status: inv.status,
      attemptCount: inv.attemptCount,
      nextAttemptAt: inv.nextAttemptAt ? inv.nextAttemptAt.toISOString() : null,
      paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
      createdAt: inv.createdAt.toISOString(),
      lines: inv.lines.map((l) => ({
        id: l.id,
        kind: l.kind,
        description: l.description,
        quantity: l.quantity,
        unitAmountMinor: l.unitAmountMinor,
        amountMinor: l.amountMinor,
      })),
    }));
  },

  async createSession(ctx: MembershipContext, input: { planCode?: BillingPlanCode }, idempotencyKey?: string): Promise<BillingSessionResult> {
    isOwner(ctx);
    requireBillingConfigured();
    if (!idempotencyKey) {
      throw new AppError(ErrorCode.IDEMPOTENCY_REQUIRED, 400, "Idempotency-Key header required");
    }
    let sub: any = await billingRepository.findSubscription(ctx.businessId) as any;
    if (!sub) {
      const plan = await billingRepository.findPlan(DEFAULT_PLAN);
      await prisma.subscription.create({
        data: {
          businessId: ctx.businessId,
          status: "TRIALING",
          currency: "NGN",
          seatPriceMinor: plan?.monthlyPriceMinor || 0,
          trialEndsAt: DateTime.utc().plus({ days: 14 }).toJSDate(),
          planCode: DEFAULT_PLAN,
        } as any,
      });
      sub = (await billingRepository.findSubscription(ctx.businessId)) as any;
    }
    if (!sub) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Subscription not found");
    }

    // Return existing checkout for same idempotency
    const existing = await billingRepository.findCheckoutByIdempotency(ctx.businessId, idempotencyKey);
    if (existing && existing.status === "PENDING" && existing.providerLink) {
      throw new AppError(ErrorCode.PENDING_CHECKOUT_EXISTS as any, 409, "A pending checkout already exists for this request. Please complete or wait for it to expire.");
    }

    // Prevent double charge: check for any pending checkouts for this subscription
    const pendingCheckouts = await prisma.billingCheckout.count({
      where: {
        subscriptionId: sub.id,
        status: "PENDING",
      },
    });
    if (pendingCheckouts > 0) {
      throw new AppError(ErrorCode.DOUBLE_CHARGE_ATTEMPT as any, 409, "You have a pending subscription payment. Please complete or cancel it before starting a new payment.");
    }

    if (sub.status === "READ_ONLY" || sub.status === "CANCELLED") {
      throw new AppError(ErrorCode.SUBSCRIPTION_READ_ONLY, 402, "Subscription is read-only");
    }

    const planCode = (input.planCode || (sub.planCode as BillingPlanCode) || DEFAULT_PLAN) as BillingPlanCode;
    if (!BILLING_PLAN_CODES.includes(planCode)) {
      throw new AppError(ErrorCode.PLAN_NOT_FOUND, 400, "Plan not found");
    }
    const plan = await billingRepository.findPlan(planCode);
    if (!plan) {
      throw new AppError(ErrorCode.PLAN_NOT_FOUND, 404, "Plan not found");
    }
    const currentPlan = sub.plan || (await billingRepository.findPlan(sub.planCode as BillingPlanCode));

    const seatCount = await billingRepository.countOpenSeatPeriodsNow(ctx.businessId);
    // For seat limit, enforce at invite time; for billing allow checkout
    let extraSeats = Math.max(0, seatCount - plan.includedSeats);
    if (plan.extraSeatPriceMinor === 0 && extraSeats > 0) {
      extraSeats = 0;
    }

    let amountMinor = 0;
    const now = new Date();
    const isActive = sub.status === "ACTIVE" && sub.currentPeriodStart && sub.currentPeriodEnd;
    
    if (isActive && currentPlan) {
      const currentPlanCode = sub.planCode as BillingPlanCode;
      // If same plan, just charge for extra seats prorated? Or full for period renewal
      if (currentPlanCode === planCode) {
        // Same plan - charge for extra seats at full rate if adding seats mid-period
        amountMinor = extraSeats * plan.extraSeatPriceMinor;
        if (amountMinor < 0) amountMinor = 0;
      } else {
        // Plan change - calculate proration
        const periodDays = Math.max(1, calcPeriodDays(sub.currentPeriodStart!, sub.currentPeriodEnd!));
        const remainingDays = Math.max(1, calcRemainingDays(now, sub.currentPeriodEnd!));
        
        // Check if downgrade
        const currentPlanPrice = currentPlan.monthlyPriceMinor;
        const newPlanPrice = plan.monthlyPriceMinor;
        if (newPlanPrice < currentPlanPrice) {
          // Downgrade - apply at period end, no immediate charge
          throw new AppError(ErrorCode.DOWNGRADE_SCHEDULED as any, 409, "Downgrade will be applied at the end of your current billing period. No charge will be made now.");
        }
        
        // Upgrade - calculate proration: charge for new plan for remaining time minus credit for unused old plan
        const newPlanCharge = calcProratedKobo(newPlanPrice, remainingDays, periodDays);
        const unusedCredit = calcProratedKobo(currentPlanPrice, remainingDays, periodDays);
        amountMinor = Math.max(0, newPlanCharge - unusedCredit);
        
        // Add prorated extra seats if any
        if (extraSeats > 0 && plan.extraSeatPriceMinor > 0) {
          const proratedExtraSeats = calcProratedKobo(plan.extraSeatPriceMinor * extraSeats, remainingDays, periodDays);
          amountMinor += proratedExtraSeats;
        }
      }
    } else {
      // New subscription or trial
      amountMinor = plan.monthlyPriceMinor + extraSeats * plan.extraSeatPriceMinor;
    }

    const txRef = `ROTA-${ctx.businessId.slice(0, 8)}-${Date.now()}-${randomUUID().slice(0, 8)}`;

    const provider = getPaymentProvider();
    let providerLink: string | null = null;
    try {
      const checkout = await provider.createCheckout({
        txRef,
        amountMinor,
        currency: "NGN",
        redirectUrl: env.FLUTTERWAVE_REDIRECT_URL || env.BILLING_RETURN_URL,
        customer: { email: ctx.userId }, // will be enriched later; use membership
        title: "Rota subscription",
        description: `Rota ${plan.name} plan`,
        meta: { businessId: ctx.businessId, subscriptionId: sub.id, planCode },
      });
      providerLink = checkout.link;
    } catch (err) {
      if (err instanceof PaymentProviderError) {
        throw new AppError(ErrorCode.PAYMENT_PROVIDER_ERROR, 502, err.message);
      }
      throw err;
    }

    const checkout = await billingRepository.createCheckout({
      business: { connect: { id: ctx.businessId } },
      subscription: { connect: { id: sub.id } },
      plan: { connect: { code: plan.code } },
      purpose: sub.status === "ACTIVE" && currentPlan && (sub.planCode as BillingPlanCode) !== planCode ? "UPGRADE" : sub.status === "ACTIVE" ? "RENEWAL" : "SUBSCRIBE",
      status: "PENDING",
      amountMinor,
      currency: "NGN",
      seatCount,
      txRef,
      idempotencyKey,
      providerLink,
    });

    // If upgrading active subscription with net charge, we need to track; provider checkout done
    return {
      checkoutId: checkout.id,
      url: providerLink,
      status: checkout.status,
      purpose: checkout.purpose,
      amountMinor: checkout.amountMinor,
      seatCount: checkout.seatCount,
    };
  },

  async changePlan(ctx: MembershipContext, input: { planCode: BillingPlanCode }, idempotencyKey?: string): Promise<BillingSessionResult> {
    // Same as create session with explicit plan
    return this.createSession(ctx, input, idempotencyKey);
  },

  async cancel(ctx: MembershipContext) {
    isOwner(ctx);
    const sub = await billingRepository.findSubscription(ctx.businessId);
    if (!sub) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Subscription not found");
    }
    if (sub.cancelAtPeriodEnd || sub.status === "CANCELLED") {
      return { cancelled: true, effectiveAt: sub.currentPeriodEnd?.toISOString() || sub.trialEndsAt.toISOString() };
    }
    if (sub.status === "TRIALING") {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: "CANCELLED",
          cancelAtPeriodEnd: true,
          cancelledAt: new Date(),
        },
      });
      return { cancelled: true, effectiveAt: sub.trialEndsAt.toISOString() };
    }
    await billingRepository.updateSubscription(ctx.businessId, {
      cancelAtPeriodEnd: true,
    });
    await prisma.auditLog.create({
      data: {
        businessId: ctx.businessId,
        actorId: (await prisma.membership.findFirst({ where: { businessId: ctx.businessId, role: "OWNER", status: "ACTIVE" } }))?.id,
        action: "BILLING_CANCEL",
        entityType: "Subscription",
        entityId: sub.id,
        metadata: {} as any,
      },
    });
    return { cancelled: true, effectiveAt: sub.currentPeriodEnd?.toISOString() || null };
  },

  async assertBusinessWritable(businessId: string) {
    const sub = await billingRepository.findSubscription(businessId);
    if (!sub) return;
    if (sub.status === "READ_ONLY" || sub.status === "CANCELLED") {
      throw new AppError(ErrorCode.SUBSCRIPTION_READ_ONLY, 402, "Subscription is read-only");
    }
  },

  async getBillableSeatCount(businessId: string) {
    return billingRepository.countOpenSeatPeriodsNow(businessId);
  },
};
