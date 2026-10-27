import { API_BASE } from "./base";
import { fetchWithTimeout } from "./fetch";
import { refreshAccessToken } from "./session";

export type ApiResult<T> = { data: T } | { error: { code: string; message: string } };

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function request<T>(
  method: Method,
  path: string,
  body: unknown,
  token?: string,
  allowRefresh = true,
  extraHeaders?: Record<string, string>,
): Promise<ApiResult<T>> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(extraHeaders || {}),
    },
    // GET and DELETE carry no body.
    ...(method === "GET" || method === "DELETE"
      ? {}
      : { body: JSON.stringify(body ?? {}) }),
  });

  // A 15-minute access token will expire during normal use. Rotate the refresh
  // token, store the new pair, and retry the request once. [P-2]
  if (res.status === 401 && token && allowRefresh && !path.startsWith("/auth/")) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(method, path, body, refreshed, false);
    }
  }

  const json = (await res.json()) as ApiResult<T>;
  return json;
}

export function apiGet<T>(path: string, token?: string): Promise<ApiResult<T>> {
  return request<T>("GET", path, undefined, token);
}

export function apiPost<T>(path: string, body: unknown, token?: string, options?: { headers?: Record<string, string> }): Promise<ApiResult<T>> {
  return request<T>("POST", path, body, token, true, options?.headers);
}

export function apiPatch<T>(path: string, body: unknown, token?: string): Promise<ApiResult<T>> {
  return request<T>("PATCH", path, body, token);
}

export function apiPut<T>(path: string, body: unknown, token?: string): Promise<ApiResult<T>> {
  return request<T>("PUT", path, body, token);
}

export function apiDelete<T>(path: string, token?: string): Promise<ApiResult<T>> {
  return request<T>("DELETE", path, undefined, token);
}
