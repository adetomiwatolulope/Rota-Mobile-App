/**
 * jobs/send-device-code-email.ts — Sends the FR-002 new-device login code.
 * Runs in the BullMQ worker, never in a request. [S-2]
 *
 * Idempotent: the job id includes email+code, and delivering the same code
 * email twice is harmless. [L-4b]
 * Never logs the code. [P-5]
 */
import { logger } from "../lib/logger.js";
import { smtpEmailProvider } from "../providers/email/smtp/index.js";
import type { SendDeviceCodeEmailJob } from "./queues.js";

export async function handleSendDeviceCodeEmail(
  job: SendDeviceCodeEmailJob,
): Promise<void> {
  const result = await smtpEmailProvider.send({
    to: job.email,
    subject: "Your Rota sign-in code",
    textBody: [
      `Hi ${job.name},`,
      "",
      `Your Rota sign-in code is: ${job.code}`,
      "",
      "Enter it in the app to finish signing in on this device. This code expires in 10 minutes.",
      "",
      "If you did not try to sign in, change your password.",
    ].join("\n"),
  });

  if (!result.ok) {
    // Surface as a failed job so BullMQ retries with backoff.
    throw new Error(`Device code email not sent: ${result.reason}`);
  }

  logger.info(
    { to: job.email, providerMessageId: result.providerMessageId },
    "Device code email sent",
  );
}
