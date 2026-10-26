/**
 * features/notifications/push.ts - Expo push registration and tap routing.
 *
 * The server sends pushes through the Expo Push Service. This module asks for
 * the Android/iOS permission, registers the device's Expo push token with the
 * Rota API, removes it on logout, and routes a tapped notification to the
 * inbox. Deep links for schedule, swaps, and billing start working as those
 * screens are added. [FR-043, FR-044]
 */
import { useEffect } from "react";
import { Linking, Platform } from "react-native";
import { useRootNavigationState, useRouter, type Href } from "expo-router";
import { isRunningInExpoGo } from "expo";
import type * as ExpoNotifications from "expo-notifications";
import Constants from "expo-constants";
import { registerPushToken, removePushToken, markNotificationRead } from "@/api/notifications";
import {
  clearPushToken,
  getAccessToken,
  getDeviceId,
  getPushToken,
  setPushToken,
} from "@/lib/secureStore";

const CHANNEL_ID = "default";

const canUseNativeNotifications =
  (Platform.OS === "android" || Platform.OS === "ios") &&
  !(Platform.OS === "android" && isRunningInExpoGo());

type NotificationsModule = typeof ExpoNotifications;

let loadedNotifications: NotificationsModule | null | undefined;

/**
 * Expo Go on Android does not register ExpoTopicSubscriptionModule, and
 * expo-notifications loads it at import time. Requiring the module only when
 * it is available keeps Expo Go usable; push still needs a development build.
 */
function getNotifications(): NotificationsModule | null {
  if (!canUseNativeNotifications) return null;
  if (loadedNotifications === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loadedNotifications = require("expo-notifications") as NotificationsModule;
  }
  return loadedNotifications;
}

export function configureNotifications() {
  const Notifications = getNotifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === "android") {
    void Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Rota alerts",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  }
}

/**
 * Ask for permission once the user is signed in, then register the Expo token.
 * Safe to call on every dashboard visit: upserts are idempotent and a denied
 * permission is not asked again.
 */
export async function registerForPushNotifications(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  const accessToken = await getAccessToken();
  if (!accessToken) return;

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== Notifications.PermissionStatus.GRANTED) {
    if (!current.canAskAgain) return;
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== Notifications.PermissionStatus.GRANTED) return;

  const projectId = getProjectId();
  if (!projectId) return;

  try {
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    const deviceId = await getDeviceId();
    const result = await registerPushToken(
      expoPushToken,
      Platform.OS === "ios" ? "IOS" : "ANDROID",
      deviceId,
    );
    if (!("error" in result)) {
      await setPushToken(expoPushToken);
    }
  } catch {
    // No network, no EAS credentials, or the device has no push service. The
    // next dashboard visit retries; reading the schedule is unaffected.
  }
}

/** Disable this device's token before the session is cleared. */
export async function unregisterPushNotifications(): Promise<void> {
  const [token] = await Promise.all([getPushToken(), getAccessToken()]);
  if (!token) return;
  try {
    await removePushToken(token);
  } catch {
    // Best effort: the local token is cleared regardless so a later login
    // registers the current account instead of the old one.
  }
  await clearPushToken();
}

/** Whether the OS currently allows notifications for Rota. */
export async function hasNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  const permission = await Notifications.getPermissionsAsync();
  return permission.status === Notifications.PermissionStatus.GRANTED;
}

/**
 * Request permission again if the OS still allows it, otherwise open the
 * system settings page so the user can turn notifications back on.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.status === Notifications.PermissionStatus.GRANTED) return true;
  if (current.canAskAgain) {
    const requested = await Notifications.requestPermissionsAsync();
    if (requested.status === Notifications.PermissionStatus.GRANTED) {
      await registerForPushNotifications();
      return true;
    }
    return false;
  }
  await Linking.openSettings();
  return false;
}

function getProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: unknown } }
    | undefined;
  const fromExtra = extra?.eas?.projectId;
  if (typeof fromExtra === "string" && fromExtra.length > 0) return fromExtra;
  const fromEas = Constants.easConfig?.projectId;
  return typeof fromEas === "string" && fromEas.length > 0 ? fromEas : undefined;
}

type NotificationData = {
  route?: { screen?: unknown; params?: Record<string, unknown> };
  notificationId?: unknown;
};

function hrefForNotification(data: NotificationData): Href {
  const notificationId =
    typeof data.notificationId === "string" ? data.notificationId : undefined;

  // Only the inbox exists in this build. Notification types that point at the
  // schedule, swaps, or billing fall back to the inbox until those screens
  // ship, so a tap never lands on a missing route.
  if (!notificationId) return "/inbox";
  return { pathname: "/inbox", params: { notificationId } };
}

/** Route taps made while the app is running and on a cold start. */
export function useNotificationRouting() {
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // A cold-start tap can arrive before the navigator is ready. Wait for the
    // root state, then handle the stored response exactly once.
    const Notifications = getNotifications();
    if (!navigationState?.key || !Notifications) return;
    let lastHandledId: string | null = null;

    const open = (response: ExpoNotifications.NotificationResponse) => {
      const request = response.notification.request;
      if (lastHandledId === request.identifier) return;
      lastHandledId = request.identifier;

      const data = request.content.data as NotificationData;
      if (typeof data.notificationId === "string") {
        void markNotificationRead(data.notificationId);
      }
      router.push(hrefForNotification(data));
    };

    const subscription =
      Notifications.addNotificationResponseReceivedListener(open);

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      open(response);
      void Notifications.clearLastNotificationResponseAsync();
    });

    return () => subscription.remove();
  }, [navigationState?.key, router]);
}
