/**
 * api/notifications.ts — Typed calls for the in-app inbox (FR-045).
 * Cursor pagination is handled by the caller: pass `nextCursor` back as
 * `cursor` to load the next (older) page.
 */
import type { CursorPage, NotificationItem } from "@rota/shared";
import { apiDelete, apiGet, apiPost, type ApiResult } from "./client";
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

export type PushPlatform = "IOS" | "ANDROID";

/** Register this device's Expo push token with the API. [FR-043] */
export async function registerPushToken(
  expoPushToken: string,
  platform: PushPlatform,
  deviceId: string,
): Promise<ApiResult<{ registered: true }>> {
  const token = (await getAccessToken()) ?? undefined;
  return apiPost("/push-tokens", { expoPushToken, platform, deviceId }, token);
}

/** Disable a push token on logout so this device stops receiving alerts. */
export async function removePushToken(
  expoPushToken: string,
): Promise<ApiResult<{ deleted: true }>> {
  const token = (await getAccessToken()) ?? undefined;
  return apiDelete(`/push-tokens/${encodeURIComponent(expoPushToken)}`, token);
}
