/**
 * lib/logger.ts — pino JSON logger with request ID. [PRD 7.8]
 * Never log passwords, codes, tokens, phone numbers, or card data. [P-5]
 */
import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  ...(env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, ignore: "pid,hostname" },
    },
  }),
  redact: {
    // Never log these fields anywhere in the API [P-5]
    paths: [
      "password",
      "passwordHash",
      "codeHash",
      "tokenHash",
      "phoneE164",
      "providerPaymentTokenRef",
      "authorization",
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie",
      "*.password",
      "*.passwordHash",
      "*.codeHash",
      "*.tokenHash",
      "*.authorization",
    ],
    censor: "[REDACTED]",
  },
});
