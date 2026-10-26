import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const ACCESS = "rota_access_token";
const REFRESH = "rota_refresh_token";
const DEVICE = "rota_device_id";
const PENDING_INVITE = "rota_pending_invite_token";
const PUSH_TOKEN = "rota_push_token";

export async function setTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync(ACCESS, access);
  await SecureStore.setItemAsync(REFRESH, refresh);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
}

/** Remember an invite opened before sign-in so the app can return to it. */
export async function setPendingInviteToken(token: string) {
  await SecureStore.setItemAsync(PENDING_INVITE, token);
}

export async function getPendingInviteToken() {
  return SecureStore.getItemAsync(PENDING_INVITE);
}

export async function clearPendingInviteToken() {
  await SecureStore.deleteItemAsync(PENDING_INVITE);
}

/** The Expo push token registered for this install, if any. */
export async function setPushToken(token: string) {
  await SecureStore.setItemAsync(PUSH_TOKEN, token);
}

export async function getPushToken() {
  return SecureStore.getItemAsync(PUSH_TOKEN);
}

export async function clearPushToken() {
  await SecureStore.deleteItemAsync(PUSH_TOKEN);
}

/**
 * Stable per-install device id sent with auth calls. The API uses it for the
 * device-trust rules [FR-002, P-3]. It survives logout so a device stays
 * "known" after the user signs out; only membership removal clears trust
 * server-side.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE, id);
  return id;
}
