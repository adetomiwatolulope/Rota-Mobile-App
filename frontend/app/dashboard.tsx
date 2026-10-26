import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/api/client";
import { endSession } from "@/api/session";
import { getAccessToken } from "@/lib/secureStore";
import {
  registerForPushNotifications,
  unregisterPushNotifications,
} from "@/features/notifications/push";
import { PageHead } from "@/components/PageHead";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { radii, spacing, typeStyle, useTheme, type ThemeColors } from "@/theme";

type Me = {
  id: string;
  email: string;
  name: string;
  emailVerifiedAt: string | null;
};

export default function Dashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [me, setMe] = useState<Me | null>(null);

  const loadMe = useCallback(async () => {
    const token = await getAccessToken();
    const res = await apiGet<Me>("/me", token ?? undefined);
    if (!("error" in res)) setMe(res.data);
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  // Signing in is the first point where a push token can be tied to an
  // account. The prompt is shown once; later visits only refresh the token.
  useEffect(() => {
    void registerForPushNotifications();
  }, []);

  return (
    <View style={styles.container}>
      <PageHead page="Dashboard" noIndex path="/dashboard" />
      <Text style={styles.title}>Dashboard</Text>
      {me && !me.emailVerifiedAt ? (
        <EmailVerificationBanner email={me.email} onVerified={() => void loadMe()} />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open team"
        style={styles.button}
        onPress={() => router.push("/team")}
      >
        <Text style={styles.buttonLabel}>Team</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open inbox"
        style={styles.secondaryButton}
        onPress={() => router.push("/inbox")}
      >
        <Text style={styles.secondaryButtonLabel}>Inbox</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        style={styles.secondaryButton}
        onPress={() => router.push("/settings")}
      >
        <Text style={styles.secondaryButtonLabel}>Settings</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a business"
        style={styles.secondaryButton}
        onPress={() => router.push("/business/create")}
      >
        <Text style={styles.secondaryButtonLabel}>Create a business</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Logout"
        style={styles.button}
        onPress={async () => {
          await unregisterPushNotifications();
          await endSession(false);
          queryClient.clear();
          router.replace("/auth");
        }}
      >
        <Text style={styles.buttonLabel}>Logout</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
      padding: spacing.lg,
      backgroundColor: colors.surface,
    },
    title: {
      ...typeStyle("headline-medium"),
      color: colors.onSurface,
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radii.pill,
    },
    buttonLabel: {
      ...typeStyle("body-medium"),
      color: colors.onPrimary,
    },
    secondaryButton: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    secondaryButtonLabel: {
      ...typeStyle("body-medium"),
      color: colors.primary,
    },
  });
}
