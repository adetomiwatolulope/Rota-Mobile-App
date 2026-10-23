/**
 * worker.ts — BullMQ worker entry point. [S-2, L-4b]
 * All heavy/slow work runs here, never inside API request handlers.
 * Workers can move to a separate process later.
 *
 * Jobs handled here (MVP-A scope):
 *   - swap-expiry      (every 1 min) [FR-027]
 *   - push-receipts    (every 5 min) [FR-044]
 *   - shift-reminders  (every 5 min) [FR-042]
 *   - ack-reminders    (every 15 min) [FR-022]
 *   - token-cleanup    (daily) [PRD 7.6]
 *
 * Handlers are registered but not yet fully implemented in the scaffold.
 * Each job handler must be idempotent. [L-4b]
 */
import "dotenv/config";
import { Worker } from "bullmq";
import { getRedis } from "./lib/redis.js";
import { logger } from "./lib/logger.js";
import { env } from "./config/env.js";
import {
  QUEUES,
  type SendDeviceCodeEmailJob,
  type SendInviteEmailJob,
  type SendPasswordResetEmailJob,
  type SendVerificationEmailJob,
  enqueueBillingJob,
} from "./jobs/queues.js";
import { handleSendVerificationEmail } from "./jobs/send-verification-email.js";
import { handleSendInviteEmail } from "./jobs/send-invite-email.js";
import { handleSendPasswordResetEmail } from "./jobs/send-password-reset-email.js";
import { handleSendDeviceCodeEmail } from "./jobs/send-device-code-email.js";
import { billingLifecycleJob } from "./jobs/billing-lifecycle.js";
import { pushJob } from "./jobs/push.js";

const connection = getRedis();

// Queue names live in jobs/queues.ts so producers and consumers share one source.
export { QUEUES } from "./jobs/queues.js";

// Map of job name → handler for the notifications queue. [S-2]
const notificationHandlers: Record<
  string,
  (data: unknown) => Promise<void>
> = {
  "send-verification-email": (data) =>
    handleSendVerificationEmail(data as SendVerificationEmailJob),
  "send-invite-email": (data) =>
    handleSendInviteEmail(data as SendInviteEmailJob),
  "send-password-reset-email": (data) =>
    handleSendPasswordResetEmail(data as SendPasswordResetEmailJob),
  "send-device-code-email": (data) =>
    handleSendDeviceCodeEmail(data as SendDeviceCodeEmailJob),
};

const billingWebhookHandlers: Record<string, (data: unknown) => Promise<void>> = {
  "process-webhook": async (data) => {
    const { billingWebhookJob } = await import("./jobs/billing-webhook.js");
    await billingWebhookJob(data);
  },
};

const billingLifecycleHandlers: Record<string, (data: unknown) => Promise<void>> = {
  "run-lifecycle": async (data) => billingLifecycleJob(data),
  "invoice-generation": async (data) => billingLifecycleJob({ type: "invoice-generation", ...(data as any) }),
  "payment-retries": async (data) => billingLifecycleJob({ type: "payment-retries", ...(data as any) }),
  "trial-reminders": async (data) => billingLifecycleJob({ type: "trial-reminders", ...(data as any) }),
  "grace-expiry": async (data) => billingLifecycleJob({ type: "grace-expiry", ...(data as any) }),
};

function startWorker(queueName: string) {
  const worker = new Worker(
    queueName,
    async (job) => {
      logger.info({ queue: queueName, jobId: job.id, name: job.name }, "Processing job");
      if (queueName === "push" || queueName === (QUEUES as any).PUSH || queueName === QUEUES.PUSH_RECEIPTS) {
        if (queueName === QUEUES.PUSH_RECEIPTS) {
          return;
        }
        await pushJob(job.data);
        return;
      }
      if (queueName === QUEUES.NOTIFICATIONS) {
        const handler = notificationHandlers[job.name];
        if (!handler) {
          logger.warn({ job: job.name }, "No handler registered for job");
          return;
        }
        await handler(job.data);
        return;
      }
      if (queueName === QUEUES.BILLING_WEBHOOKS) {
        const handler = billingWebhookHandlers[job.name];
        if (!handler) {
          logger.warn({ job: job.name }, "No handler registered for job");
          return;
        }
        await handler(job.data);
        return;
      }
      if (queueName === QUEUES.BILLING_LIFECYCLE) {
        const handler = billingLifecycleHandlers[job.name];
        if (handler) {
          await handler(job.data);
          return;
        }
        await billingLifecycleJob(job.data);
        return;
      }
      // Remaining queue handlers are implemented as each feature is built.
      // Every handler must be idempotent. [L-4b]
    },
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error(
      { queue: queueName, jobId: job?.id, err },
      "Job failed",
    );
  });

  return worker;
}

// Start all workers
const workers = [...Object.values(QUEUES), "push"].map(startWorker);

// Schedule repeatable billing jobs if scheduler supported
setTimeout(async () => {
  try {
    const { Queue } = await import("bullmq");
    const q = new Queue(QUEUES.BILLING_LIFECYCLE, { connection });
    // hourly lifecycle + daily invoice at 02:00 Lagos approximation
    await (q as any).upsertJobScheduler?.(
      "billing-lifecycle-hourly",
      { pattern: "0 * * * *", tz: "Africa/Lagos" },
      { name: "run-lifecycle" },
    );
    await (q as any).upsertJobScheduler?.(
      "billing-invoice-daily",
      { pattern: "0 2 * * *", tz: "Africa/Lagos" },
      { name: "invoice-generation" },
    );
    await (q as any).upsertJobScheduler?.(
      "billing-retries-hourly",
      { pattern: "0 * * * *", tz: "Africa/Lagos" },
      { name: "payment-retries" },
    );
    await q.close();
  } catch (e) {
    // ignore if not supported
  }
}, 1000);

logger.info(
  { queues: Object.values(QUEUES) },
  `Rota workers started (env: ${env.NODE_ENV})`,
);

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received — closing workers");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});
