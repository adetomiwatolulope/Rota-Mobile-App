/**
 * middleware/read-only.ts - Enforce READ_ONLY for writes (M-13, MVP-B). [FR-052]
 */
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError, ErrorCode } from "../lib/errors.js";

const ALLOWED_PATHS = [
  "/v1/auth",
  "/v1/businesses", // creation allowed? business creation may be special
];

const ALLOWED_WRITE_ACTIONS = ["acknowledge", "billing"]; // rough allowlist

export async function requireNotReadOnly(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      return next();
    }
    const businessId = (req as any).membership?.businessId || (req.params as any)?.id || (req.body as any)?.businessId;
    if (!businessId) {
      return next();
    }
    // Skip auth endpoints
    if (req.path.startsWith("/v1/auth")) {
      return next();
    }
    // Allow billing actions
    if (req.path.includes("/billing") || req.path.includes("/subscription")) {
      // billing actions allowed
    }
    const sub = await prisma.subscription.findUnique({
      where: { businessId },
      select: { status: true },
    });
    if (!sub) {
      return next();
    }
    if (sub.status === "READ_ONLY") {
      // Allow specific billing/ack actions
      if (req.path.includes("/billing") || req.path.includes("/invoices") || req.path.includes("/subscription/plan") || req.path.includes("/subscription/cancel") || req.path.includes("/acknowledge")) {
        return next();
      }
      throw new AppError(ErrorCode.SUBSCRIPTION_READ_ONLY, 402, "Subscription is read-only");
    }
    return next();
  } catch (err) {
    return next(err);
  }
}
