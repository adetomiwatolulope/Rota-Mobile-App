const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000/v1";

type ApiResult<T> = { data: T } | { error: { code: string; message: string } };

export async function apiGet<T>(path: string, token?: string): Promise<ApiResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const json = await res.json();
  return json as ApiResult<T>;
}

export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<ApiResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return json as ApiResult<T>;
}
