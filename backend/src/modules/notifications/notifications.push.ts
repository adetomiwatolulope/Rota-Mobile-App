/**
 * modules/notifications/notifications.push.ts - Push dispatch helpers
 */
import { prisma } from "../../lib/prisma.js";
import { expoPushProvider } from "../../providers/push/expo/index.js";
// @ts-ignore
import { DateTime } from "luxon";

export function isInQuietHours(
  tz: string | null | undefined,
  quietEnabled: boolean,
  quietStart: number | null | undefined,
  quietEnd: number | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!quietEnabled || quietStart == null || quietEnd == null) return false;
  const zone = tz || "Africa/Lagos";
  const dt = DateTime.fromJSDate(now, { zone });
  const minutes = dt.hour * 60 + dt.minute;
  if (quietStart <= quietEnd) {
    // same day window
    return minutes >= quietStart && minutes < quietEnd;
  }
  // crosses midnight
  return minutes >= quietStart || minutes < quietEnd;
}

export async function getPreferences(userId: string) {
  // UserSettings is the single source of truth. [Requirement 7]
  const existing = await prisma.userSettings.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.userSettings.create({ data: { userId } });
}

export function shouldSendForType(pref: any, type: string) {
  // Map notification types to groups
  if (type.includes("SWAP") || type.includes("CLAIM")) {
    return pref.swaps !== false;
  }
  if (type.includes("TRIAL") || type.includes("BILLING") || type.includes("PAYMENT") || type.includes("SUBSCRIPTION")) {
    return pref.billing !== false;
  }
  if (type.includes("REMINDER")) {
    return pref.reminders !== false;
  }
  // shift changes
  if (type.includes("SHIFT") || type.includes("SCHEDULE") || type.includes("ASSIGN") || type.includes("CANCEL")) {
    return pref.shiftChanges !== false;
  }
  return true;
}

export async function sendPushForNotification(notification: any) {
  const pref = await getPreferences(notification.userId);
  if (!shouldSendForType(pref, notification.type)) {
    return;
  }
  const now = new Date();
  const inQuiet = isInQuietHours(pref.timezone, pref.quietHoursEnabled, pref.quietHoursStart, pref.quietHoursEnd, now);
  if (inQuiet) {
    // For non-urgent notifications, delay until quiet hours end. For urgent (billing failures), could still send; for MVP delay non-critical
    const critical = notification.type?.includes("PAYMENT") || notification.type?.includes("READ_ONLY") || notification.type?.includes("BILLING_ALERT");
    if (!critical) {
      // Delay by enqueueing again with delay? Or skip now - but requirement says "delays non-urgent notifications until 6am"
      // Compute delay to end of quiet hours
      try {
        const zone = pref.timezone || "Africa/Lagos";
        const dt = DateTime.fromJSDate(now, { zone });
        const quietEnd = pref.quietHoursEnd ?? 360;
        const endDt = dt.set({ hour: Math.floor(quietEnd / 60), minute: quietEnd % 60, second: 0, millisecond: 0 });
        const delayMs = endDt > dt ? endDt.toMillis() - dt.toMillis() : endDt.plus({ days: 1 }).toMillis() - dt.toMillis();
        if (delayMs > 0) {
          const { enqueuePush } = await import("../../jobs/queues.js");
          await enqueuePush({ notificationId: notification.id }, delayMs);
          return;
        }
      } catch (e) {
        // fall through
      }
    }
  }
  const tokens = await prisma.pushToken.findMany({
    where: { userId: notification.userId, disabledAt: null },
  });
  if (tokens.length === 0) {
    return { sent: false, reason: "no-tokens" };
  }
  const messages: any[] = tokens.map((t) => ({
    to: t.expoPushToken,
    title: notification.title,
    body: notification.body,
    data: {
      notificationId: notification.id,
      type: notification.type,
      businessId: notification.businessId,
      ...(notification.data || {}),
      // deep link info
      route: mapNotificationToRoute(notification),
    },
    sound: "default",
    priority: "high" as const,
  }));
  const results = await expoPushProvider.send(messages);
  // If error indicates invalid token, mark disabled? We'll handle in receipts; also mark on error
  for (let i = 0; i < results.length; i++) {
    if (results[i]?.status === "error") {
      const details: any = results[i]?.details || {};
      if (details.error === "DeviceNotRegistered") {
        await prisma.pushToken.update({
          where: { id: tokens[i]!.id },
          data: { disabledAt: new Date() },
        });
      }
    }
  }
  return { sent: true, count: tokens.length };
}

function mapNotificationToRoute(n: any) {
  const data = n.data || {};
  switch (n.type) {
    case "SWAP_OFFER":
    case "SWAP_ACCEPTED":
    case "SWAP_NEEDS_APPROVAL":
    case "SWAP_APPROVED":
    case "SWAP_REJECTED":
    case "SWAP_DECLINED":
    case "SWAP_CANCELLED":
    case "SWAP_EXPIRED":
      return { screen: "swaps", params: { swapId: data.swapRequestId } };
    case "OPEN_SHIFT_AVAILABLE":
    case "CLAIM_APPROVED":
    case "CLAIM_REJECTED":
      return { screen: "open-shifts", params: { businessId: n.businessId } };
    case "TIME_OFF_REQUESTED":
    case "TIME_OFF_APPROVED":
    case "TIME_OFF_DENIED":
      return { screen: "time-off", params: { businessId: n.businessId } };
    case "SHIFT_ASSIGNED":
    case "SHIFT_CHANGED":
    case "SHIFT_REMOVED":
    case "SHIFT_CANCELLED":
    case "SHIFT_REMINDER":
    case "ACK_REMINDER":
      return { screen: "shift", params: { shiftId: data.shiftId, businessId: n.businessId } };
    case "SCHEDULE_PUBLISHED":
      return { screen: "schedule", params: { businessId: n.businessId } };
    case "TRIAL_ENDING":
    case "PAYMENT_FAILED":
    case "GRACE_ENDING":
    case "SUBSCRIPTION_READ_ONLY":
    case "BILLING_ALERT":
      return { screen: "billing", params: { businessId: n.businessId } };
    default:
      return { screen: "inbox", params: { notificationId: n.id } };
  }
}
