/**
 * jobs/queues.ts — Queue producers. Routes/services only enqueue; workers run
 * the work. [S-2] Never do heavy work inside a request handler.
 *
 * Queue names are the contract and are shared with worker.ts.
 */
import { Queue } from "bullmq";
import { getRedis } from "../lib/redis.js";

export const QUEUES = {
  NOTIFICATIONS: "notifications",
  SWAP_EXPIRY: "swap-expiry",
  ACK_REMINDERS: "ack-reminders",
  SHIFT_REMINDERS: "shift-reminders",
  PUSH_RECEIPTS: "push-receipts",
  TOKEN_CLEANUP: "token-cleanup",
  BILLING_WEBHOOKS: "billing-webhooks",
  BILLING_LIFECYCLE: "billing-lifecycle",
  PUSH: "push",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export type SendVerificationEmailJob = {
  email: string;
  name: string;
  code: string;
};

export type SendInviteEmailJob = {
  email: string;
  businessName: string;
  invitedByName: string;
  role: string;
  code: string;
  link: string;
};

export type SendPasswordResetEmailJob = {
  email: string;
  name: string;
  code: string;
};

export type SendDeviceCodeEmailJob = {
  email: string;
  name: string;
  code: string;
};

export type BillingWebhookJob = {
  eventId: string;
  payload: unknown;
};

export type SendPushJob = {
  notificationId: string;
};

let _notificationsQueue: Queue | undefined;
let _billingWebhookQueue: Queue | undefined;
let _billingLifecycleQueue: Queue | undefined;
let _pushQueue: Queue | undefined;

function notificationsQueue(): Queue {
  if (!_notificationsQueue) {
    _notificationsQueue = new Queue(QUEUES.NOTIFICATIONS, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    });
  }
  return _notificationsQueue;
}

/** Enqueue the email-verification email. Fire-and-forget; the worker delivers it. */
export async function enqueueVerificationEmail(
  job: SendVerificationEmailJob,
): Promise<void> {
  await notificationsQueue().add("send-verification-email", job, {
    // Idempotency: one verification email per email address per code payload.
    jobId: `verify-email:${job.email}:${job.code}`,
  });
}

/**
 * Enqueue an invite email (FR-006). Fire-and-forget; the worker delivers it.
 * The invite link token and code are already stored hashed — this job carries
 * the plain values only long enough to put them in the email. [P-1]
 */
export async function enqueueInviteEmail(
  job: SendInviteEmailJob,
): Promise<void> {
  await notificationsQueue().add("send-invite-email", job, {
    jobId: `invite-email:${job.email}:${job.code}`,
  });
}

/** Enqueue the password-reset email. [FR-003, S-2] */
export async function enqueuePasswordResetEmail(
  job: SendPasswordResetEmailJob,
): Promise<void> {
  await notificationsQueue().add("send-password-reset-email", job, {
    jobId: `password-reset-email:${job.email}:${job.code}`,
  });
}

/** Enqueue the new-device login code. [FR-002, S-2] */
export async function enqueueDeviceCodeEmail(
  job: SendDeviceCodeEmailJob,
): Promise<void> {
  await notificationsQueue().add("send-device-code-email", job, {
    jobId: `device-code-email:${job.email}:${job.code}`,
  });
}

function billingWebhookQueue(): Queue {
  if (!_billingWebhookQueue) {
    _billingWebhookQueue = new Queue(QUEUES.BILLING_WEBHOOKS, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: 1_000,
        removeOnFail: 10_000,
      },
    });
  }
  return _billingWebhookQueue;
}

function billingLifecycleQueue(): Queue {
  if (!_billingLifecycleQueue) {
    _billingLifecycleQueue = new Queue(QUEUES.BILLING_LIFECYCLE, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    });
  }
  return _billingLifecycleQueue;
}

function pushQueue(): Queue {
  if (!_pushQueue) {
    _pushQueue = new Queue("push", {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }
  return _pushQueue;
}

export async function enqueuePaymentWebhook(job: BillingWebhookJob): Promise<void> {
  await billingWebhookQueue().add("process-webhook", job, {
    jobId: `billing-webhook:${job.eventId}`,
  });
}

export async function enqueueBillingJob(name: string, data: unknown = {}, opts?: any): Promise<void> {
  await billingLifecycleQueue().add(name, data, opts);
}

export async function enqueuePush(job: SendPushJob, delayMs = 0): Promise<void> {
  await pushQueue().add("send-push", job, {
    jobId: delayMs > 0 ? `push:${job.notificationId}:delayed` : `push:${job.notificationId}`,
    delay: delayMs > 0 ? delayMs : undefined,
  });
}
