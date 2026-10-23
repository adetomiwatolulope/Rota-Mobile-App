/**
 * jobs/billing-lifecycle.ts - trial reminders, grace expiry, invoice generation, retries
 */
import { prisma } from "../lib/prisma.js";
// @ts-ignore
import { DateTime } from "luxon";
import { getPaymentProvider } from "../providers/payments/index.js";

export async function billingLifecycleJob(jobData: unknown) {
  const data = (jobData as any) || {};
  const type = data.type || "run-lifecycle";
  const now = new Date();

  if (type === "trial-reminders" || type === "run-lifecycle") {
    await handleTrialReminders(now);
  }
  if (type === "grace-expiry" || type === "run-lifecycle") {
    await handleGraceExpiry(now);
  }
  if (type === "invoice-generation") {
    await handleInvoiceGeneration(now);
  }
  if (type === "payment-retries") {
    await handlePaymentRetries(now);
  }
}

async function handleTrialReminders(now: Date) {
  const trials = await prisma.subscription.findMany({
    where: { status: "TRIALING", trialEndsAt: { lte: DateTime.fromJSDate(now).plus({ days: 7 }).toJSDate() } },
    include: { business: true },
  });
  for (const sub of trials) {
    const daysLeft = Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) {
      // read only immediately if no paid
      const paid = await prisma.invoice.findFirst({ where: { subscriptionId: sub.id, status: "PAID" } });
      if (!paid) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "READ_ONLY" },
        });
        // notify owners
        const owners = await prisma.membership.findMany({ where: { businessId: sub.businessId, role: "OWNER", status: "ACTIVE" } });
        for (const o of owners) {
          await prisma.notification.create({
            data: {
              userId: (await prisma.membership.findUnique({ where: { id: o.id }, select: { userId: true } }))!.userId,
              businessId: sub.businessId,
              type: "TRIAL_ENDING",
              title: "Trial ended",
              body: "Your trial has ended. Subscribe to continue.",
            },
          });
        }
      }
      continue;
    }
    // create reminders at 7,2,0 conceptually - simple notify once per threshold
    if (daysLeft === 7 || daysLeft === 2) {
      const owners = await prisma.membership.findMany({ where: { businessId: sub.businessId, role: "OWNER", status: "ACTIVE" }, include: { user: true } });
      for (const o of owners) {
        await prisma.notification.create({
          data: {
            userId: o.userId,
            businessId: sub.businessId,
            type: "TRIAL_ENDING",
            title: "Trial ending soon",
            body: `Your trial ends in ${daysLeft} days.`,
          },
        });
      }
    }
  }
}

async function handleGraceExpiry(now: Date) {
  const subs = await prisma.subscription.findMany({
    where: { status: "PAST_DUE", graceEndsAt: { lte: now } },
  });
  for (const sub of subs) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "READ_ONLY" },
    });
    const owners = await prisma.membership.findMany({ where: { businessId: sub.businessId, role: "OWNER", status: "ACTIVE" }, include: { user: true } });
    for (const o of owners) {
      await prisma.notification.create({
        data: {
          userId: o.userId,
          businessId: sub.businessId,
          type: "BILLING_ALERT",
          title: "Subscription read-only",
          body: "Payment failed. Your account is now read-only.",
        },
      });
    }
  }
}

async function handleInvoiceGeneration(now: Date) {
  const subs = await prisma.subscription.findMany({
    where: { status: { in: ["ACTIVE", "PAST_DUE"] }, currentPeriodEnd: { lte: now } },
    include: { plan: true, pendingPlan: true },
  });
  for (const sub of subs) {
    if (sub.cancelAtPeriodEnd) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "CANCELLED", cancelledAt: now },
      });
      continue;
    }
    // Check if invoice exists
    const existing = await prisma.invoice.findFirst({
      where: { subscriptionId: sub.id, periodStart: sub.currentPeriodEnd! },
    });
    if (existing) {
      continue;
    }
    const plan = sub.pendingPlan || sub.plan;
    if (!plan) continue;
    const periodStart = sub.currentPeriodEnd!;
    const periodEnd = DateTime.fromJSDate(periodStart, { zone: "Africa/Lagos" }).plus({ months: 1 }).toJSDate();
    const seatCount = await prisma.seatPeriod.count({
      where: {
        businessId: sub.businessId,
        startedAt: { lte: periodStart },
        OR: [{ endedAt: null }, { endedAt: { gt: periodStart } }],
        membership: { status: "ACTIVE", role: { not: "OWNER" } },
      },
    });
    let extraSeats = Math.max(0, seatCount - plan.includedSeats);
    if (plan.extraSeatPriceMinor === 0) extraSeats = 0;
    const total = plan.monthlyPriceMinor + extraSeats * plan.extraSeatPriceMinor;
    const invoice = await prisma.invoice.create({
      data: {
        subscriptionId: sub.id,
        periodStart,
        periodEnd,
        dueAt: periodStart,
        seatCount,
        totalMinor: total,
        currency: "NGN",
        status: "OPEN",
        lines: {
          create: [
            {
              kind: "SEATS",
              description: `${plan.name} plan`,
              quantity: 1,
              unitAmountMinor: plan.monthlyPriceMinor,
              amountMinor: plan.monthlyPriceMinor,
            },
            ...(extraSeats > 0
              ? [
                  {
                    kind: "SEATS" as const,
                    description: "Extra seats",
                    quantity: extraSeats,
                    unitAmountMinor: plan.extraSeatPriceMinor,
                    amountMinor: extraSeats * plan.extraSeatPriceMinor,
                  },
                ]
              : []),
          ],
        },
      },
    });
    try {
      await prisma.billingLedgerEntry.create({
        data: {
          businessId: sub.businessId,
          subscriptionId: sub.id,
          invoiceId: invoice.id,
          kind: "CHARGE",
          amountMinor: invoice.totalMinor,
          currency: "NGN",
          planCode: plan.code,
          periodStart: invoice.periodStart,
          periodEnd: invoice.periodEnd,
          idempotencyKey: `invoice:${invoice.id}:charge`,
        },
      });
    } catch (e) {}
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        planCode: plan.code,
        seatPriceMinor: plan.monthlyPriceMinor,
        pendingPlanCode: null,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextAttemptAt: periodStart,
        attemptCount: 0,
      } as any,
    });
  }
}

async function handlePaymentRetries(now: Date) {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: "OPEN",
      nextAttemptAt: { lte: now },
    },
    include: { subscription: { include: { business: true, plan: true } } },
    take: 100,
  });
  const provider = getPaymentProvider();
  for (const inv of invoices) {
    const sub = inv.subscription;
    if (!sub.providerPaymentTokenRef) {
      continue;
    }
    try {
      const txRef = `ROTA-RETRY-${inv.id.slice(0, 8)}-${Date.now()}`;
      const res = await provider.chargeToken({
        token: sub.providerPaymentTokenRef,
        amountMinor: inv.totalMinor,
        currency: "NGN",
        country: "NG",
        email: "billing@rota.app",
        txRef,
        narration: "Rota subscription renewal",
        redirectUrl: process.env.FLUTTERWAVE_REDIRECT_URL || "https://rota.app/billing/complete",
      });
      if (res.status === "successful") {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { status: "PAID", paidAt: new Date(), providerTxnRef: res.providerRef || txRef },
        });
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "ACTIVE", graceEndsAt: null },
        });
        continue;
      }
      // failed or pending
      const attemptCount = inv.attemptCount + 1;
      const offsets = [0, 1, 3, 5];
      let nextAttemptAt: Date | null = null;
      if (attemptCount < offsets.length) {
        nextAttemptAt = DateTime.fromJSDate(inv.dueAt).plus({ days: offsets[attemptCount] }).toJSDate();
      }
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { attemptCount, nextAttemptAt, status: attemptCount >= offsets.length ? "FAILED" : "OPEN" },
      });
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: "PAST_DUE",
          graceEndsAt: attemptCount === 1 ? DateTime.fromJSDate(inv.dueAt).plus({ days: 7 }).toJSDate() : sub.graceEndsAt,
        },
      });
      // notify
      const owners = await prisma.membership.findMany({ where: { businessId: sub.businessId, role: "OWNER", status: "ACTIVE" }, include: { user: true } });
      for (const o of owners) {
        await prisma.notification.create({
          data: {
            userId: o.userId,
            businessId: sub.businessId,
            type: "BILLING_ALERT",
            title: "Payment failed",
            body: "We couldn't charge your card. Please update your payment method.",
          },
        });
      }
    } catch (e) {
      // treat as failed
    }
  }
}
