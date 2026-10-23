/**
 * config/env.ts — The ONLY place that reads process.env in the API. [S-12]
 * All values are validated by Zod at startup. If any required var is missing,
 * the process exits immediately rather than failing at runtime.
 */
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  // Database
  DATABASE_URL: z.string().min(1),

  // Redis — shared cache, rate limiting, distributed locks, BullMQ [L-4a]
  REDIS_URL: z.string().min(1),

  // JWT — access tokens last 15 minutes, refresh tokens 30 days [P-2]
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  // Postmark [locked: email provider]
  POSTMARK_TOKEN: z.string().default(""),
  EMAIL_FROM: z.string().email().default("noreply@rota.app"),

  // SMTP (Nodemailer) — owner override of the locked email provider [L-1].
  // When SMTP_HOST is empty the adapter uses Nodemailer's JSON transport, which
  // prints the message to the worker log instead of sending (local dev only).
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // Termii [locked: SMS for invites only]
  TERMII_API_KEY: z.string().default(""),
  TERMII_SENDER_ID: z.string().default("Rota"),

  // Expo Push [locked]
  EXPO_ACCESS_TOKEN: z.string().default(""),

  // Sentry [locked: error tracking]
  SENTRY_DSN_API: z.string().default(""),

  // PostHog [locked: analytics — 6 events only, P-8]
  POSTHOG_API_KEY: z.string().default(""),

  // Google sign-in — owner-approved PRD deviation. Public OAuth client ID
  // (not a secret); empty disables POST /v1/auth/google at runtime.
  GOOGLE_CLIENT_ID: z.string().default(""),

  // Billing — MVP-A creates the Subscription row but enforces nothing [X-6].
  // SEAT_PRICE is in kobo [M-1, M-6] and must not be set to a real price until
  // the pilot data and margin check (V6) are in. Default 0 = "not set".
  SEAT_PRICE: z.coerce.number().int().min(0).default(0),

  // Deep-link base for invite links (FR-006). The app scheme, not a web URL —
  // the API serves no HTML for invites. [S-4]
  APP_LINK_BASE_URL: z.string().default("rota://invite"),

  // Flutterwave (MVP-B billing). L-5/L-9: server-side only, never in mobile app.
  FLUTTERWAVE_PUBLIC_KEY: z.string().default(""),
  FLUTTERWAVE_SECRET_KEY: z.string().default(""),
  FLUTTERWAVE_ENCRYPTION_KEY: z.string().default(""),
  FLUTTERWAVE_WEBHOOK_SECRET: z.string().default(""),
  FLUTTERWAVE_REDIRECT_URL: z
    .string()
    .url()
    .default("https://rota.app/billing/complete"),
  BILLING_RETURN_URL: z.string().url().default("https://rota.app/billing/complete"),
});

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  console.error("❌  Invalid environment variables:");
  console.error(_parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = _parsed.data;
