/**
 * providers/payments/index.ts - get payment provider
 */
import { env } from "../../config/env.js";
import type { PaymentProvider } from "./payment-provider.js";
import { flutterwaveProvider } from "./flutterwave/index.js";

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  // L-5: only Flutterwave
  cached = flutterwaveProvider;
  return cached;
}

export function isBillingConfigured(): boolean {
  return Boolean(env.FLUTTERWAVE_SECRET_KEY);
}
