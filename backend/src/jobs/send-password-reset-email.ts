/**
 * jobs/send-password-reset-email.ts — Sends the FR-003 reset code.
 * Runs in the BullMQ worker, never in a request. [S-2]
 *
 * Idempotent: the job id includes email+code, and delivering the same reset
 * email twice is harmless (the code is unchanged). [L-4b]
 * Never logs the code. [P-5]
 */
import { logger } from "../lib/logger.js";
import { smtpEmailProvider } from "../providers/email/smtp/index.js";
import type { SendPasswordResetEmailJob } from "./queues.js";

export async function handleSendPasswordResetEmail(
  job: SendPasswordResetEmailJob,
): Promise<void> {
  const result = await smtpEmailProvider.send({
    to: job.email,
    subject: "Reset your Rota password",
    textBody: [
      `Hi ${job.name},`,
      "",
      `Your Rota password reset code is: ${job.code}`,
      "",
      "Enter it in the app to choose a new password. This code expires in 10 minutes and can be used once.",
      "",
      "If you did not request a password reset, you can ignore this email.",
    ].join("\n"),
  });

  if (!result.ok) {
    // Surface as a failed job so BullMQ retries with backoff.
    throw new Error(`Password reset email not sent: ${result.reason}`);
  }

  logger.info(
    { to: job.email, providerMessageId: result.providerMessageId },
    "Password reset email sent",
  );
}
