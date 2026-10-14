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

  // Termii [locked: SMS for invites only]
  TERMII_API_KEY: z.string().default(""),
  TERMII_SENDER_ID: z.string().default("Rota"),

  // Expo Push [locked]
  EXPO_ACCESS_TOKEN: z.string().default(""),

  // Sentry [locked: error tracking]
  SENTRY_DSN_API: z.string().default(""),

  // PostHog [locked: analytics — 6 events only, P-8]
  POSTHOG_API_KEY: z.string().default(""),
});

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  console.error("❌  Invalid environment variables:");
  console.error(_parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = _parsed.data;
