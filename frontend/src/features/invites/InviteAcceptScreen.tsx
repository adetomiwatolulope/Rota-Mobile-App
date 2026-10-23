/**
 * features/invites/InviteAcceptScreen.tsx — Accept an invite. [FR-007]
 *
 * The token arrives from the deep link (`rota://invite/<token>`). The person
 * signs in or creates an account with the invited email, then enters the
 * 6-digit code from the invite email. Accepting activates the membership and
 * opens a seat. If sign-in is needed the token is remembered so the app can
 * return here instead of dropping the person on the dashboard.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import type { InvitePreview } from "@rota/shared";
import { acceptInvite, previewInvite } from "@/api/team";
import {
  clearPendingInviteToken,
  getAccessToken,
  setPendingInviteToken,
} from "@/lib/secureStore";
import { PageHead } from "@/components/PageHead";
import { radii, spacing, typeStyle, useTheme, type ThemeColors } from "@/theme";

export function InviteAcceptScreen({ token }: { token: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setError("This invite link is incomplete");
      setLoading(false);
      return;
    }
    const res = await previewInvite(token);
    if ("error" in res) {
      setError(res.error.message);
    } else {
      setPreview(res.data);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAccept = async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      // Keep the invite so auth can send the user straight back here. [FR-007]
      await setPendingInviteToken(token);
      router.push("/auth");
      return;
    }
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your invite email");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await acceptInvite({ token, code });
      if ("error" in res) {
        setError(res.error.message);
        return;
      }
      await clearPendingInviteToken();
      // Land on the team the person just joined, not an unrelated business.
      router.replace({
        pathname: "/team",
        params: { businessId: res.data.businessId },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <PageHead page="Accept invite" noIndex path="/invite" />
      <Text style={styles.title}>Join a business</Text>

      {loading ? <ActivityIndicator color={colors.primary} /> : null}

      {!loading && preview ? (
        <View style={styles.card}>
          <Text style={styles.body}>
            {preview.invitedByName} invited you to join{" "}
            <Text style={styles.strong}>{preview.businessName}</Text> as a{" "}
            <Text style={styles.strong}>{preview.role.toLowerCase()}</Text>.
          </Text>

          <TextInput
            accessibilityLabel="Invite code"
            value={code}
            onChangeText={(t) => {
              setCode(t.replace(/\D/g, "").slice(0, 6));
              if (error) setError(null);
            }}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor={colors.onSurfaceVariant}
            style={[styles.input, error ? styles.inputError : null]}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Accept invite"
            disabled={submitting}
            onPress={() => void handleAccept()}
            style={[styles.button, submitting ? styles.buttonDisabled : null]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonLabel}>Accept invite</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {!loading && !preview && error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      paddingTop: spacing.xxxl,
      backgroundColor: colors.surface,
    },
    title: { ...typeStyle("headline-medium"), color: colors.onSurface },
    card: {
      width: "100%",
      maxWidth: 420,
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radii.lg,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outline,
    },
    body: { ...typeStyle("body-medium"), color: colors.onSurfaceVariant },
    strong: { color: colors.onSurface },
    input: {
      ...typeStyle("headline-small"),
      color: colors.onSurface,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outline,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      textAlign: "center",
      letterSpacing: 8,
    },
    inputError: { borderColor: colors.error },
    error: { ...typeStyle("body-small"), color: colors.error, maxWidth: 420 },
    button: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: radii.pill,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonLabel: { ...typeStyle("body-medium"), color: colors.onPrimary },
  });
}
