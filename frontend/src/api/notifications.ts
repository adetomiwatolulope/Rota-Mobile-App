/**
 * api/notifications.ts — Typed calls for the in-app inbox (FR-045).
 * Cursor pagination is handled by the caller: pass `nextCursor` back as
 * `cursor` to load the next (older) page.
 */
import type { CursorPage, NotificationItem } from "@rota/shared";
import { apiGet, apiPost, type ApiResult } from "./client";
import { getAccessToken } from "@/lib/secureStore";

export type InboxPage = CursorPage<NotificationItem> & { unreadCount: number };

export async function listNotifications(
  cursor?: string | null,
  limit = 20,
): Promise<ApiResult<InboxPage>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  const token = (await getAccessToken()) ?? undefined;
  return apiGet<InboxPage>(`/notifications?${params.toString()}`, token);
}

export async function markNotificationRead(
  id: string,
): Promise<ApiResult<{ read: true }>> {
  const token = (await getAccessToken()) ?? undefined;
  return apiPost(`/notifications/${id}/read`, {}, token);
}
