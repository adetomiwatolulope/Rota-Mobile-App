/**
 * api/settings.ts - Server-owned user settings. [Requirement 7]
 *
 * The server is the single source of truth. Every write returns the canonical
 * row (including the server's `updatedAt`), so callers replace the optimistic
 * value immediately and roll back on failure.
 */
import type { ApiResult } from "./client";
import { apiGet, apiPut } from "./client";
import { getAccessToken } from "@/lib/secureStore";

export type UserSettings = {
  id: string;
  userId: string;
  timezone: string;
  language: string;
  theme: "light" | "dark" | "system";
  quietHoursEnabled: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  shiftChanges: boolean;
  swaps: boolean;
  billing: boolean;
  reminders: boolean;
  updatedAt: string;
  createdAt: string;
};

export type UserSettingsPatch = Partial<
  Omit<UserSettings, "id" | "userId" | "createdAt" | "updatedAt">
> & {
  updatedAt?: string;
};

export async function getSettings(): Promise<ApiResult<{ settings: UserSettings }>> {
  const token = (await getAccessToken()) ?? undefined;
  return apiGet<{ settings: UserSettings }>("/settings", token);
}

export async function updateSettings(
  patch: UserSettingsPatch,
): Promise<ApiResult<{ settings: UserSettings }>> {
  const token = (await getAccessToken()) ?? undefined;
  return apiPut<{ settings: UserSettings }>("/settings", patch, token);
}
