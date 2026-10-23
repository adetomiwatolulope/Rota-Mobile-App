/**
 * modules/billing/billing.proration.ts - proration helpers. [FR-049]
 * Floor each line independently as recommended.
 */
import { floorDivide } from "../../lib/money.js";

export function calcProratedKobo(amountMinor: number, remainingDays: number, periodDays: number): number {
  if (periodDays <= 0 || remainingDays <= 0) {
    return 0;
  }
  const r = Math.min(remainingDays, periodDays);
  return floorDivide(amountMinor * r, periodDays);
}

export function calcPeriodDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) {
    return 1;
  }
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function calcRemainingDays(from: Date, end: Date): number {
  const ms = end.getTime() - from.getTime();
  if (ms <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
