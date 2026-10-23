/**
 * jobs/billing-webhook.ts - process payment webhook
 */
import { prisma } from "../lib/prisma.js";
import { getPaymentProvider } from "../providers/payments/index.js";
import { AppError, ErrorCode } from "../lib/errors.js";
// @ts-ignore
import { DateTime } from "luxon";

function getPayload(data: any) {
  return data?.payload || data;
}

export async function billingWebhookJob(jobData: unknown) {
  const payload = getPayload(jobData);
  const eventId = (payload as any)?.id || (payload as any)?.event_id || (payload as any)?.data?.id;
  if (!eventId) {
    return;
  }
  const providerName = "flutterwave";
  try {
    await prisma.paymentEvent.create({
      data: {
        provider: providerName,
        providerEventId: String(eventId),
        type: String((payload as any)?.event || (payload as any)?.type || "unknown"),
        payload: payload as any,
      },
    });
  } catch (e: any) {
    // Duplicate
    if (e?.code === "P2002") {
      return;
    }
    throw e;
  }

  const data = (payload as any).data || payload;
  const txRef = data?.tx_ref || data?.txRef;
  if (!txRef) {
    return;
  }

  const checkout = await prisma.billingCheckout.findUnique({
    where: { txRef },
    include: { subscription: true, plan: true, business: true },
  });
  if (!checkout) {
    await prisma.paymentEvent.updateMany({
      where: { provider: providerName, providerEventId: String(eventId), processedAt: null },
      data: { processedAt: new Date() },
    });
    return;
  }
  if (checkout.status === "COMPLETED") {
    await prisma.paymentEvent.updateMany({
      where: { provider: providerName, providerEventId: String(eventId), processedAt: null },
      data: { processedAt: new Date() },
    });
    return;
  }

  const provider = getPaymentProvider();
  try {
    const verification = await provider.verifyTransaction(txRef);
    if (verification.status !== "successful") {
      await prisma.billingCheckout.update({
        where: { id: checkout.id },
        data: { status: "FAILED" },
      });
      await prisma.paymentEvent.updateMany({
        where: { provider: providerName, providerEventId: String(eventId), processedAt: null },
        data: { processedAt: new Date() },
      });
      return;
    }
    // Check amount/currency match
    if (verification.amountMinor !== checkout.amountMinor || verification.currency !== checkout.currency) {
      await prisma.billingCheckout.update({
        where: { id: checkout.id },
        data: { status: "FAILED" },
      });
      await prisma.paymentEvent.updateMany({
        where: { provider: providerName, providerEventId: String(eventId), processedAt: null },
        data: { processedAt: new Date() },
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.billingCheckout.update({
        where: { id: checkout.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          providerRef: verification.providerRef,
        },
      });
      // Update subscription
      const sub = checkout.subscription;
      if (sub.status === "TRIALING" || sub.status === "READ_ONLY" || sub.status === "PAST_DUE" || checkout.purpose === "SUBSCRIBE") {
        const now = new Date();
        const periodStart = sub.status === "TRIALING" ? sub.trialEndsAt : now;
        const periodEnd = DateTime.fromJSDate(periodStart, { zone: "Africa/Lagos" }).plus({ months: 1 }).toJSDate();
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            status: "ACTIVE",
            planCode: checkout.planCode,
            seatPriceMinor: checkout.plan.monthlyPriceMinor,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            graceEndsAt: null,
            providerPaymentTokenRef: verification.cardToken || sub.providerPaymentTokenRef,
            providerName: "flutterwave",
            checkoutSeatCount: checkout.seatCount,
          },
        });
        // Create invoice
        const invoice = await tx.invoice.create({
          data: {
            subscriptionId: sub.id,
            periodStart,
            periodEnd,
            dueAt: periodStart,
            seatCount: checkout.seatCount,
            totalMinor: checkout.amountMinor,
            currency: "NGN",
            status: "PAID",
            paidAt: new Date(),
            providerTxnRef: verification.txRef,
            lines: {
              create: {
                kind: "SEATS",
                description: `${checkout.plan.name} plan`,
                quantity: 1,
                unitAmountMinor: checkout.amountMinor,
                amountMinor: checkout.amountMinor,
              },
            },
          },
        });
        try {
          await tx.billingLedgerEntry.create({
            data: {
              businessId: checkout.businessId,
              subscriptionId: sub.id,
              invoiceId: invoice.id,
              kind: "CHARGE",
              amountMinor: invoice.totalMinor,
              currency: "NGN",
              planCode: checkout.planCode,
              periodStart: invoice.periodStart,
              periodEnd: invoice.periodEnd,
              idempotencyKey: `invoice:${invoice.id}:charge`,
              providerTxnRef: verification.txRef,
            },
          });
        } catch (e) {
          // ignore duplicate
        }
      } else if (checkout.purpose === "UPGRADE") {
        // immediate upgrade - simplified: update plan
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            planCode: checkout.planCode,
            seatPriceMinor: checkout.plan.monthlyPriceMinor,
          },
        });
      }
    });

    await prisma.paymentEvent.updateMany({
      where: { provider: providerName, providerEventId: String(eventId), processedAt: null },
      data: { processedAt: new Date() },
    });
  } catch (err) {
    await prisma.paymentEvent.updateMany({
      where: { provider: providerName, providerEventId: String(eventId), processedAt: null },
      data: { processedAt: new Date() },
    });
    throw err;
  }
}
