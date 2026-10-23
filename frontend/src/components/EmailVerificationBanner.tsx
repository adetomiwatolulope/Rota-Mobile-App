import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { apiPost } from "@/api/client";
import { getAccessToken, getDeviceId } from "@/lib/secureStore";
import { radii, spacing, typeStyle, useTheme, type ThemeColors } from "@/theme";

type VerifyResponse = { verified: boolean };

type Props = {
  email: string;
  onVerified: () => void;
};

/**
 * Asks the signed-in user to verify their email with the 6-digit code that was
 * emailed at registration. Soft verification: the account works meanwhile, but
 * the banner stays until the email is verified. [FR-001]
 */
export function EmailVerificationBanner({ email, onVerified }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const [token, deviceId] = await Promise.all([getAccessToken(), getDeviceId()]);
      const res = await apiPost<VerifyResponse>(
        "/auth/verify-email",
        { email, code, deviceId },
        token ?? undefined,
      );
      if ("error" in res) {
        setError(res.error.message);
        return;
      }
      onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.banner}>
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.body}>
        We sent a 6-digit code to {email}. Enter it below to verify your address.
      </Text>
      <TextInput
        accessibilityLabel="Verification code"
        value={code}
        onChangeText={(text) => {
          setCode(text.replace(/\D/g, "").slice(0, 6));
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
        accessibilityLabel="Verify email"
        disabled={submitting}
        onPress={handleSubmit}
        style={[styles.button, submitting ? styles.buttonDisabled : null]}
      >
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonLabel}>Verify</Text>
        )}
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    banner: {
      width: "100%",
      maxWidth: 420,
      gap: spacing.sm,
      padding: spacing.lg,
      borderRadius: radii.lg,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outline,
    },
    title: {
      ...typeStyle("title-medium"),
      color: colors.onSurface,
    },
    body: {
      ...typeStyle("body-medium"),
      color: colors.onSurfaceVariant,
    },
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
    inputError: {
      borderColor: colors.error,
    },
    error: {
      ...typeStyle("body-small"),
      color: colors.error,
    },
    button: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: radii.pill,
      marginTop: spacing.xs,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonLabel: {
      ...typeStyle("body-medium"),
      color: colors.onPrimary,
    },
  });
}
