/**
 * providers/payments/payment-provider.ts - Payment provider interface. [S-3, L-6]
 */
export interface PaymentCustomer {
  email: string;
  name?: string;
  phone?: string;
}

export interface CreateCheckoutInput {
  txRef: string;
  amountMinor: number; // kobo
  currency: "NGN";
  redirectUrl: string;
  customer: PaymentCustomer;
  title: string;
  description: string;
  meta?: Record<string, unknown>;
}

export interface CreateCheckoutResult {
  link: string;
}

export interface VerifyTransactionResult {
  providerRef: string;
  status: "successful" | "failed" | "pending";
  amountMinor: number;
  currency: string;
  txRef: string;
  cardToken?: string;
  raw?: unknown;
}

export interface ChargeTokenInput {
  token: string;
  amountMinor: number;
  currency: "NGN";
  country: "NG";
  email: string;
  txRef: string;
  narration?: string;
  redirectUrl: string;
  meta?: Record<string, unknown>;
}

export interface ChargeTokenResult {
  providerRef?: string;
  status: "successful" | "pending" | "failed";
  txRef: string;
  raw?: unknown;
}

export interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  verifyTransaction(txRef: string): Promise<VerifyTransactionResult>;
  chargeToken(input: ChargeTokenInput): Promise<ChargeTokenResult>;
  verifyWebhookHeader(headerValue: string | string[] | undefined): boolean;
}
