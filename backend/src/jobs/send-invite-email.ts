/**
 * jobs/send-invite-email.ts — Sends the FR-006 invite email.
 * Runs in the BullMQ worker, never in a request. [S-2]
 *
 * Idempotent: the job id includes email+code, and delivering the same invite
 * email twice is harmless (link and code are unchanged). [L-4b]
 * Never logs the code or the link token. [P-5]
 */
import { logger } from "../lib/logger.js";
import { smtpEmailProvider } from "../providers/email/smtp/index.js";
import type { SendInviteEmailJob } from "./queues.js";

export async function handleSendInviteEmail(
  job: SendInviteEmailJob,
): Promise<void> {
  const result = await smtpEmailProvider.send({
    to: job.email,
    subject: `${job.invitedByName} invited you to ${job.businessName} on Rota`,
    textBody: [
      `Hi,`,
      "",
      `${job.invitedByName} invited you to join ${job.businessName} on Rota as a ${job.role.toLowerCase()}.`,
      "",
      `Your invite code is: ${job.code}`,
      "",
      `Or open this link: ${job.link}`,
      "",
      "This invite expires in 7 days.",
      "",
      "If you were not expecting this invitation, you can ignore this email.",
    ].join("\n"),
  });

  if (!result.ok) {
    // Surface as a failed job so BullMQ retries with backoff.
    throw new Error(`Invite email not sent: ${result.reason}`);
  }

  logger.info(
    { to: job.email, providerMessageId: result.providerMessageId },
    "Invite email sent",
  );
}
