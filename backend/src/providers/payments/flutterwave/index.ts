/**
 * providers/payments/flutterwave/index.ts - Flutterwave adapter. [L-5,L-6,L-8]
 * Only this file calls Flutterwave SDK/HTTP API for payments.
 */
import { env } from "../../../config/env.js";
import { PaymentProviderError } from "../../../lib/errors.js";
import { flutterwaveMajorToKobo, koboToFlutterwaveAmount } from "../../../lib/money.js";
import type {
  ChargeTokenInput,
  ChargeTokenResult,
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProvider,
  VerifyTransactionResult,
} from "../payment-provider.js";

const BASE_URL = "https://api.flutterwave.com/v3";

function getSecret(): string {
  const key = env.FLUTTERWAVE_SECRET_KEY;
  if (!key) {
    throw new PaymentProviderError("Flutterwave secret key not configured");
  }
  return key;
}

function getWebhookSecret(): string {
  return env.FLUTTERWAVE_WEBHOOK_SECRET || env.FLUTTERWAVE_SECRET_KEY;
}

export function createFlutterwaveProvider(): PaymentProvider {
  return {
    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      const secret = getSecret();
      const body = {
        tx_ref: input.txRef,
        amount: koboToFlutterwaveAmount(input.amountMinor),
        currency: input.currency,
        redirect_url: input.redirectUrl,
        payment_options: "card",
        customer: {
          email: input.customer.email,
          name: input.customer.name,
          phonenumber: input.customer.phone,
        },
        customizations: {
          title: input.title,
          description: input.description,
        },
        meta: input.meta,
      };

      const res = await fetch(`${BASE_URL}/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new PaymentProviderError(`Flutterwave checkout failed: ${res.status}`);
      }

      const json = (await res.json()) as {
        status?: string;
        message?: string;
        data?: { link?: string };
      };
      if (json.status !== "success" || !json.data?.link) {
        throw new PaymentProviderError("Flutterwave checkout returned unexpected response");
      }
      return { link: json.data.link };
    },

    async verifyTransaction(txRef: string): Promise<VerifyTransactionResult> {
      const secret = getSecret();
      const url = `${BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new PaymentProviderError(`Flutterwave verification failed: ${res.status}`);
      }

      const json = (await res.json()) as {
        status?: string;
        data?: any;
      };
      if (json.status !== "success" || !json.data) {
        throw new PaymentProviderError("Flutterwave verification returned unexpected response");
      }
      const data = json.data;
      const statusRaw = String(data.status || "").toLowerCase();
      let status: "successful" | "failed" | "pending" = "failed";
      if (statusRaw === "successful") status = "successful";
      else if (statusRaw === "pending" || statusRaw === "pending-approval") status = "pending";

      const amountMinor = flutterwaveMajorToKobo(data.amount);
      const cardToken = data.card?.token || data.token || undefined;

      return {
        providerRef: String(data.id),
        status,
        amountMinor,
        currency: String(data.currency || "NGN"),
        txRef: String(data.tx_ref || txRef),
        cardToken,
        raw: json,
      };
    },

    async chargeToken(input: ChargeTokenInput): Promise<ChargeTokenResult> {
      const secret = getSecret();
      const body = {
        token: input.token,
        email: input.email,
        currency: input.currency,
        country: input.country,
        amount: koboToFlutterwaveAmount(input.amountMinor),
        tx_ref: input.txRef,
        narration: input.narration,
        redirect_url: input.redirectUrl,
        meta: input.meta,
      };

      const res = await fetch(`${BASE_URL}/tokenized-charges`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new PaymentProviderError(`Flutterwave token charge failed: ${res.status}`);
      }

      const json = (await res.json()) as {
        status?: string;
        data?: any;
      };
      if (!json.data) {
        throw new PaymentProviderError("Flutterwave token charge returned unexpected response");
      }
      const data = json.data;
      const statusRaw = String(data.status || json.status || "").toLowerCase();
      let status: "successful" | "pending" | "failed" = "failed";
      if (statusRaw === "successful") status = "successful";
      else if (statusRaw === "pending" || statusRaw === "pending-approval" || statusRaw === "auth") status = "pending";

      return {
        providerRef: data.id ? String(data.id) : undefined,
        status,
        txRef: String(data.tx_ref || input.txRef),
        raw: json,
      };
    },

    verifyWebhookHeader(headerValue: string | string[] | undefined): boolean {
      const secret = getWebhookSecret();
      if (!secret) {
        return false;
      }
      const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
      if (!value) {
        return false;
      }
      // Flutterwave uses "verif-hash" header containing the secret hash value.
      return value === secret;
    },
  };
}

export const flutterwaveProvider = createFlutterwaveProvider();
