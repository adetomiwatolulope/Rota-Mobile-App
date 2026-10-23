/**
 * jobs/push.ts - Send push for a notification
 */
import { prisma } from "../lib/prisma.js";
import { sendPushForNotification } from "../modules/notifications/notifications.push.js";

export async function pushJob(jobData: unknown) {
  const data = jobData as any;
  const notificationId = data?.notificationId;
  if (!notificationId) return;
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!notification) return;
  await sendPushForNotification(notification);
}
