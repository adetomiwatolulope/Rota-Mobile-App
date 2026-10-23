/**
 * api/session.ts — Token lifecycle for the mobile app. [P-2]
 *
 * The access token lasts 15 minutes. When it expires the client exchanges the
 * refresh token for a new pair and retries the failed request once. Refresh is
 * single-flight: parallel requests share one exchange, so the same refresh
 * token is never presented twice (which the API treats as theft and revokes).
 */
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/secureStore";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000/v1";

type TokenPair = { accessToken: string; refreshToken: string };

function isTokenPair(value: unknown): value is { data: TokenPair } {
  if (typeof value !== "object" || value === null) return false;
  const data = (value as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return false;
  const pair = data as { accessToken?: unknown; refreshToken?: unknown };
  return typeof pair.accessToken === "string" && typeof pair.refreshToken === "string";
}

let inFlightRefresh: Promise<string | null> | null = null;

/**
 * Exchange the stored refresh token for a new pair. Returns the new access
 * token, or null when the session can no longer be refreshed.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;

  inFlightRefresh = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        await clearTokens();
        return null;
      }
      const json: unknown = await res.json();
      if (!isTokenPair(json)) {
        await clearTokens();
        return null;
      }
      await setTokens(json.data.accessToken, json.data.refreshToken);
      return json.data.accessToken;
    } catch {
      return null;
    }
  })().finally(() => {
    inFlightRefresh = null;
  });

  return inFlightRefresh;
}

async function revokeOnServer(accessToken: string, allDevices: boolean): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ allDevices }),
  });
}

/** Revoke the current session (or every session) on the API, then clear local tokens. */
export async function endSession(allDevices: boolean): Promise<void> {
  const accessToken = await getAccessToken();
  if (accessToken) {
    try {
      const res = await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ allDevices }),
      });
      if (res.status === 401) {
        // Access token expired; refresh once so the server still revokes.
        const refreshed = await refreshAccessToken();
        if (refreshed) await revokeOnServer(refreshed, allDevices);
      }
    } catch {
      // Local sign-out still proceeds if the network is unavailable.
    }
  }
  await clearTokens();
}
