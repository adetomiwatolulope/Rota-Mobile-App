/**
 * jobs/send-verification-email.ts — Sends the FR-001 verification email.
 * Runs in the BullMQ worker, never in a request. [S-2]
 *
 * Idempotent: the job id includes email+code, and delivering the same email
 * twice is harmless (the code is unchanged). [L-4b]
 */
import { logger } from "../lib/logger.js";
import { smtpEmailProvider } from "../providers/email/smtp/index.js";
import type { SendVerificationEmailJob } from "./queues.js";

export async function handleSendVerificationEmail(
  job: SendVerificationEmailJob,
): Promise<void> {
  const result = await smtpEmailProvider.send({
    to: job.email,
    subject: "Your Rota verification code",
    textBody: [
      `Hi ${job.name},`,
      "",
      `Your Rota verification code is: ${job.code}`,
      "",
      "Enter it in the app to verify your email address. This code expires in 10 minutes.",
      "",
      "If you did not create a Rota account, you can ignore this email.",
    ].join("\n"),
  });

  // Never log the code itself — only delivery status. [P-5]
  if (!result.ok) {
    // Surface as a failed job so BullMQ retries with backoff.
    throw new Error(`Verification email not sent: ${result.reason}`);
  }

  logger.info(
    { to: job.email, providerMessageId: result.providerMessageId },
    "Verification email sent",
  );
}
