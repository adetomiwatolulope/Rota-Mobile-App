/**
 * modules/notifications/notifications.service.ts �?" Inbox rules. [S-1]
 * FR-045: the in-app inbox, last 90 days, with unread count. Marking read does
 * not acknowledge a change.
 * PRD 7.1: cursor pagination for lists.
 */
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type CursorPage,
  type NotificationItem,
} from "@rota/shared";
import { AppError, ErrorCode } from "../../lib/errors.js";
import { INBOX_WINDOW_DAYS } from "../../lib/constants.js";
import { decodeCursor, encodeCursor } from "../../lib/cursor.js";
import { notificationsRepository } from "./notifications.repository.js";
import type { Notification } from "@prisma/client";
import { enqueuePush } from "../../jobs/queues.js";
import { prisma } from "../../lib/prisma.js";

export const notificationsService = {
  /**
   * One page of the caller's inbox, newest first. The cursor is keyset on
   * (createdAt, id) so concurrent inserts at the top never shift the page.
   */
  async list(
    userId: string,
    params: { cursor?: string; limit?: number },
  ): Promise<CursorPage<NotificationItem> & { unreadCount: number }> {
    const limit = clampLimit(params.limit);
    const since = inboxWindowStart();

    let cursor: { createdAt: Date; id: string } | undefined;
    if (params.cursor) {
      const decoded = decodeCursor(params.cursor);
      if (!decoded) {
        throw new AppError(ErrorCode.VALIDATION, 400, "Invalid cursor");
      }
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    // take + 1: the extra row signals whether an older page exists.
    const rows = await notificationsRepository.listPage({
      userId,
      take: limit + 1,
      since,
      cursor,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null;

    const unreadCount = await notificationsRepository.unreadCount(userId, since);

    return {
      items: page.map(toItem),
      nextCursor,
      hasMore,
      unreadCount,
    };
  },

  /** FR-045: mark one notification read. Idempotent; marks only own rows. */
  async markRead(userId: string, notificationId: string): Promise<void> {
    const row = await notificationsRepository.findByIdForUser(userId, notificationId);
    if (!row) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Notification not found");
    }
    await notificationsRepository.markRead(userId, notificationId);
  },
};

function clampLimit(requested: number | undefined): number {
  if (!requested || Number.isNaN(requested)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(requested), 1), MAX_PAGE_SIZE);
}

function inboxWindowStart(): Date {
  const since = new Date();
  since.setDate(since.getDate() - INBOX_WINDOW_DAYS);
  return since;
}

function toItem(n: Notification): NotificationItem {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    requiresAck: n.requiresAck,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
    data: n.data ?? null,
  };
}

export async function createAndDispatchNotification(input: {
  userId: string;
  businessId?: string | null;
  type: string;
  title: string;
  body: string;
  requiresAck?: boolean;
  data?: any;
}) {
  const created: any = await (notificationsRepository as any).create?.({
    userId: input.userId,
    businessId: input.businessId || null,
    type: input.type,
    title: input.title,
    body: input.body,
    requiresAck: input.requiresAck || false,
    data: input.data || null,
  }) || await (prisma as any).notification.create({
    data: {
      userId: input.userId,
      businessId: input.businessId || null,
      type: input.type,
      title: input.title,
      body: input.body,
      requiresAck: input.requiresAck || false,
      data: input.data || null,
    },
  });
  // Enqueue push job (never send inline in request). [S-2]
  try {
    await enqueuePush({ notificationId: created.id });
  } catch (e) {
    // ignore enqueue errors
  }
  return created;
}
