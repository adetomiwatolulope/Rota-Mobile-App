/**
 * providers/email/smtp/index.ts — Nodemailer SMTP adapter.
 *
 * OWNER OVERRIDE: replaces the locked Postmark provider with Nodemailer/SMTP.
 * The EmailProvider interface is unchanged, so services and jobs are untouched.
 *
 * With SMTP_HOST empty the adapter uses Nodemailer's JSON transport: the message
 * (including the code) is written to the worker log instead of being sent, so
 * the flow can be tested locally without any credentials.
 */
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../../config/env.js";
import { logger } from "../../../lib/logger.js";
import type {
  EmailProvider,
  SendEmailInput,
  SendEmailResult,
} from "../index.js";

let _transporter: Transporter | undefined;

function buildTransporter(): Transporter {
  if (env.SMTP_HOST.length > 0) {
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth:
        env.SMTP_USER.length > 0
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });
  }

  // No host configured — JSON transport logs the message instead of sending.
  logger.warn("SMTP not configured; using JSON transport (email logged, not sent)");
  return nodemailer.createTransport({ jsonTransport: true });
}

function transporter(): Transporter {
  if (!_transporter) {
    _transporter = buildTransporter();
  }
  return _transporter;
}

export const smtpEmailProvider: EmailProvider = {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    try {
      const info = await transporter().sendMail({
        from: env.EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        text: input.textBody,
        ...(input.htmlBody ? { html: input.htmlBody } : {}),
      });

      // In JSON transport there is no server; log the full message so the code
      // is visible in dev. [owner, P-5 applies to real delivery only]
      if (env.SMTP_HOST.length === 0 && info.message) {
        logger.info(
          { to: input.to, message: JSON.parse(info.message) },
          "Email captured by JSON transport",
        );
      }

      return { ok: true, providerMessageId: info.messageId };
    } catch (err) {
      logger.error({ to: input.to, err }, "SMTP send failed");
      return { ok: false, reason: "SMTP_SEND_FAILED" };
    }
  },
};
