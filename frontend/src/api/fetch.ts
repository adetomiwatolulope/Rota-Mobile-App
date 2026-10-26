const REQUEST_TIMEOUT_MS = 15_000;
const NETWORK_ERROR_MESSAGE =
  "Cannot reach the Rota server. Check your connection and try again.";

export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  } finally {
    clearTimeout(timeout);
  }
}
