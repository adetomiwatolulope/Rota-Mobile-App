/**
 * providers/email/postmark/index.ts — Postmark email adapter. [L-1, S-3]
 * The only place that talks to Postmark. Services use the EmailProvider
 * interface, never this module directly.
 *
 * Postmark is called over its HTTP API. This keeps the adapter dependency-free
 * and avoids adding an SDK that no locked tool requires. [L-2]
 *
 * Token-when-ready: with no POSTMARK_TOKEN configured the adapter reports a
 * clear failure instead of throwing, so the app keeps working in dev. [owner]
 */
import { z } from "zod";
import { env } from "../../../config/env.js";
import { logger } from "../../../lib/logger.js";
import type {
  EmailProvider,
  SendEmailInput,
  SendEmailResult,
} from "../index.js";

const POSTMARK_ENDPOINT = "https://api.postmarkapp.com/email";

// Validate the provider payload shape rather than trusting it. [S-1]
const postmarkResponseSchema = z.object({
  MessageID: z.string(),
  ErrorCode: z.number(),
  Message: z.string(),
});

export const postmarkEmailProvider: EmailProvider = {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (env.POSTMARK_TOKEN.length === 0) {
      // Not configured yet — expected in local dev until the token is added.
      logger.warn({ to: input.to }, "Postmark not configured; email not sent");
      return { ok: false, reason: "EMAIL_PROVIDER_NOT_CONFIGURED" };
    }

    const res = await fetch(POSTMARK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Postmark-Server-Token": env.POSTMARK_TOKEN,
      },
      body: JSON.stringify({
        From: env.EMAIL_FROM,
        To: input.to,
        Subject: input.subject,
        TextBody: input.textBody,
        ...(input.htmlBody ? { HtmlBody: input.htmlBody } : {}),
        MessageStream: "outbound",
      }),
    });

    if (!res.ok) {
      logger.error(
        { to: input.to, status: res.status },
        "Postmark send failed",
      );
      return { ok: false, reason: `POSTMARK_HTTP_${res.status}` };
    }

    const parsed = postmarkResponseSchema.safeParse(await res.json());
    if (!parsed.success || parsed.data.ErrorCode !== 0) {
      logger.error({ to: input.to }, "Postmark returned an error payload");
      return { ok: false, reason: "POSTMARK_ERROR" };
    }

    return { ok: true, providerMessageId: parsed.data.MessageID };
  },
};
