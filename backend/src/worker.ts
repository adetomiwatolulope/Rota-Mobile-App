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
import { Worker, Queue } from "bullmq";
import { getRedis } from "./lib/redis.js";
import { logger } from "./lib/logger.js";
import { env } from "./config/env.js";

const connection = getRedis();

// Named job queues — names are the contract; do not change without a migration
export const QUEUES = {
  NOTIFICATIONS: "notifications",
  SWAP_EXPIRY: "swap-expiry",
  ACK_REMINDERS: "ack-reminders",
  SHIFT_REMINDERS: "shift-reminders",
  PUSH_RECEIPTS: "push-receipts",
  TOKEN_CLEANUP: "token-cleanup",
} as const;

function startWorker(queueName: string) {
  const worker = new Worker(
    queueName,
    async (job) => {
      logger.info({ queue: queueName, jobId: job.id, name: job.name }, "Processing job");
      // Job handlers will be implemented as each feature is built.
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
const workers = Object.values(QUEUES).map(startWorker);

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
