/**
 * modules/billing/billing.routes.ts - Billing routes. [S-1]
 */
import { Router } from "express";
import { z } from "zod";
import {
  billingPlanChangeSchema,
  billingSessionSchema,
} from "@rota/shared";
import { requireAuth } from "../../middleware/auth.js";
import { requireMembership, requireCapability } from "../../middleware/membership.js";
import { userRateLimit } from "../../middleware/rate-limit.js";
import { AppError, ErrorCode } from "../../lib/errors.js";
import { billingService } from "./billing.service.js";

const router = Router();

function getIdempotencyKey(req: any): string | undefined {
  const key = req.headers["idempotency-key"] || req.headers["Idempotency-Key"];
  if (Array.isArray(key)) return key[0];
  return typeof key === "string" && key.length > 0 ? key : undefined;
}

router.get(
  "/businesses/:id/billing/plans",
  requireAuth,
  userRateLimit,
  requireMembership,
  requireCapability("manageBilling"),
  async (req, res, next) => {
    try {
      const plans = await billingService.getPlans();
      res.json({ data: { plans } });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/businesses/:id/subscription",
  requireAuth,
  userRateLimit,
  requireMembership,
  requireCapability("manageBilling"),
  async (req, res, next) => {
    try {
      const subscription = await billingService.getSubscription(req.membership!);
      res.json({ data: { subscription } });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/businesses/:id/billing/session",
  requireAuth,
  userRateLimit,
  requireMembership,
  requireCapability("manageBilling"),
  async (req, res, next) => {
    try {
      const body = billingSessionSchema.parse(req.body ?? {});
      const key = getIdempotencyKey(req);
      const session = await billingService.createSession(req.membership!, body, key);
      res.json({ data: session });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/businesses/:id/subscription/plan",
  requireAuth,
  userRateLimit,
  requireMembership,
  requireCapability("manageBilling"),
  async (req, res, next) => {
    try {
      const body = billingPlanChangeSchema.parse(req.body);
      const key = getIdempotencyKey(req);
      const session = await billingService.changePlan(req.membership!, body, key);
      res.json({ data: session });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/businesses/:id/subscription/cancel",
  requireAuth,
  userRateLimit,
  requireMembership,
  requireCapability("manageBilling"),
  async (req, res, next) => {
    try {
      const result = await billingService.cancel(req.membership!);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/businesses/:id/invoices",
  requireAuth,
  userRateLimit,
  requireMembership,
  requireCapability("manageBilling"),
  async (req, res, next) => {
    try {
      const invoices = await billingService.listInvoices(req.membership!);
      res.json({ data: { invoices } });
    } catch (err) {
      next(err);
    }
  },
);

const webhookSchema = z.object({}).passthrough();
const webhookRouter = Router();

// Webhook: signature verified in service/handler; route must accept raw? We use express.json; fine for now
webhookRouter.post("/webhooks/payments", async (req, res, next) => {
  try {
    // Signature check
    const provider = (await import("../../providers/payments/index.js")).getPaymentProvider();
    const header = req.headers["verif-hash"] || req.headers["Verif-Hash"] || req.headers["x-flutterwave-signature"];
    if (!provider.verifyWebhookHeader(header as any)) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid webhook signature" } });
    }
    const payload = webhookSchema.parse(req.body);
    // Enqueue job - import after route setup to avoid cycles
    const { enqueuePaymentWebhook } = await import("../../jobs/queues.js");
    const eventId = (payload as any).id || (payload as any).event_id || (payload as any).data?.id;
    if (eventId) {
      await enqueuePaymentWebhook({ eventId: String(eventId), payload });
    }
    res.status(200).json({ status: "ok" });
  } catch (err) {
    next(err);
  }
});

export { router as billingRouter, webhookRouter };
