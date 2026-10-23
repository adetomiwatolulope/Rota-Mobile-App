/**
 * modules/notifications/notifications.repository.ts — Data access for the
 * in-app inbox. Only repositories import Prisma. [S-1]
 *
 * FR-045: the inbox shows the last 90 days. PRD 7.1: lists use cursor
 * pagination. The cursor is keyset over (createdAt DESC, id DESC) so new rows
 * at the top do not shift the page and equal timestamps are never skipped.
 */
import { prisma } from "../../lib/prisma.js";
import type { Notification, NotificationType, Prisma } from "@prisma/client";

export const notificationsRepository = {
  /**
   * Fetch one page of the caller's notifications, newest first.
   * `take` is limit + 1: the extra row tells the service whether more remain
   * without a second count query.
   */
  listPage(params: {
    userId: string;
    take: number;
    since: Date;
    cursor?: { createdAt: Date; id: string };
  }): Promise<Notification[]> {
    const where: Prisma.NotificationWhereInput = {
      userId: params.userId,
      createdAt: { gte: params.since },
    };

    // Keyset: everything strictly "older" than the cursor in (createdAt, id)
    // order. Equal timestamps are ordered by id so none are skipped or repeated.
    if (params.cursor) {
      where.OR = [
        { createdAt: { lt: params.cursor.createdAt } },
        {
          createdAt: params.cursor.createdAt,
          id: { lt: params.cursor.id },
        },
      ];
    }

    return prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: params.take,
    });
  },

  /** Unread count for the inbox badge. [FR-045] */
  unreadCount(userId: string, since: Date): Promise<number> {
    return prisma.notification.count({
      where: { userId, readAt: null, createdAt: { gte: since } },
    });
  },

  /** Mark one notification read, but only if it belongs to the caller. [A-2] */
  markRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
  },

  findByIdForUser(userId: string, notificationId: string) {
    return prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });
  },

  /** Seed helper for volume testing. Kept here because it is a DB write. */
  createMany(
    rows: {
      userId: string;
      businessId?: string | null;
      type: NotificationType;
      title: string;
      body: string;
      readAt?: Date | null;
      createdAt: Date;
    }[],
  ) {
    return prisma.notification.createMany({ data: rows });
  },
};
